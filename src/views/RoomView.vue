<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SoundCloudPlayer from '../components/SoundCloudPlayer.vue'
import SoundCloudLibrary from '../components/SoundCloudLibrary.vue'
import { api, clearHostToken, getHostToken, getNickname, setNickname } from '../api'
import { connectToRoom } from '../stomp'
import { SOUNDCLOUD_URL, largeArtwork } from '../soundcloud'
import { useSoundCloudAuth } from '../soundcloudAuth'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const { profile: soundCloudProfile } = useSoundCloudAuth()

const DRIFT_MS = 2500 // listeners re-seek when further than this from the host
const SYNC_INTERVAL_MS = 3000 // how often listeners check their drift
const HEARTBEAT_MS = 5000 // how often the host re-broadcasts its position
const MAX_CHAT = 100

const hostToken = getHostToken(props.id)
const isHost = Boolean(hostToken)

const room = ref(null)
const error = ref('')
const closed = ref(false)
const status = ref('connecting')
const listeners = ref(0)
const playback = ref(null)
let clockOffset = 0 // client clock minus server clock

const player = ref(null)
const playerUrl = ref('')
const playerReady = ref(false)
const playerError = ref('')
const tunedIn = ref(false)
const volume = ref(80)

const trackInput = ref('')
const formError = ref('')
let pendingAutoplay = false
let hostStarted = false

const chat = ref([])
const chatText = ref('')
const chatList = ref(null)
const nickname = ref(getNickname())
const copied = ref(false)

let connection = null
let timer = null
let syncing = false

const statusLabel = computed(
  () => ({ connected: 'Connected', connecting: 'Connecting…', disconnected: 'Reconnecting…' })[status.value],
)
const artwork = computed(() => largeArtwork(playback.value?.artworkUrl))

onMounted(async () => {
  try {
    const data = await api.getRoom(props.id)
    room.value = data
    listeners.value = data.listeners
    playback.value = data.playback
    clockOffset = Date.now() - data.serverNow
  } catch (e) {
    error.value = e.message
    return
  }

  // A host who reloads the page gets their last track back in the player (not auto-playing).
  if (isHost && playback.value?.trackUrl) playerUrl.value = playback.value.trackUrl
  if (isHost && !playerUrl.value) {
    try {
      const queued = JSON.parse(window.sessionStorage.getItem('soundstream:queued-source'))
      window.sessionStorage.removeItem('soundstream:queued-source')
      if (queued?.permalinkUrl && SOUNDCLOUD_URL.test(queued.permalinkUrl)) {
        playerUrl.value = queued.permalinkUrl
      }
    } catch {
      // Ignore unavailable or malformed session storage.
    }
  }

  connection = connectToRoom(props.id, {
    onStatus: (s) => {
      status.value = s
      if (s === 'connected' && isHost) broadcastState()
    },
    onPlayback: (state) => {
      playback.value = state
      syncToHost()
    },
    onListeners: (count) => (listeners.value = count),
    onChat: (message) => {
      chat.value.push(message)
      if (chat.value.length > MAX_CHAT) chat.value.shift()
      scrollChatToBottom()
    },
    onClosed: () => {
      closed.value = true
      teardown()
    },
  })

  timer = isHost ? setInterval(broadcastState, HEARTBEAT_MS) : setInterval(syncToHost, SYNC_INTERVAL_MS)
})

onBeforeUnmount(teardown)

function teardown() {
  clearInterval(timer)
  connection?.disconnect()
  connection = null
}

watch(volume, (v) => player.value?.setVolume(v))

function onPlayerReady() {
  playerReady.value = true
  playerError.value = ''
  player.value.setVolume(volume.value)
  if (isHost && pendingAutoplay) {
    pendingAutoplay = false
    player.value.play()
  }
  syncToHost()
}

function onPlayerError(message) {
  playerError.value = message
}

// ---- Host ----

function playTrack(sourceUrl) {
  const url = typeof sourceUrl === 'string' ? sourceUrl.trim() : trackInput.value.trim()
  if (!SOUNDCLOUD_URL.test(url)) {
    formError.value = 'Paste a link to a SoundCloud track or playlist.'
    return
  }
  formError.value = ''
  playerError.value = ''
  if (!playerUrl.value) {
    pendingAutoplay = true
    playerUrl.value = url
  } else {
    player.value.load(url, { autoPlay: true })
  }
  trackInput.value = ''
}

function playLibraryItem(item) {
  if (item?.streamable && item.permalinkUrl) playTrack(item.permalinkUrl)
}

function onHostPlayerEvent(type) {
  if (!isHost) return
  if (type === 'play') hostStarted = true
  broadcastState()
}

async function broadcastState() {
  // Don't broadcast a restored-but-idle player; wait until the host actually presses play.
  if (!isHost || !hostStarted || !playerReady.value || !connection) return
  const [sound, position, paused] = await Promise.all([
    player.value.getCurrentSound(),
    player.value.getPosition(),
    player.value.isPaused(),
  ])
  if (!sound || paused === null || !connection) return
  connection.publishPlayback({
    hostToken,
    trackUrl: sound.permalink_url,
    title: sound.title,
    artist: sound.user?.username ?? '',
    artworkUrl: sound.artwork_url || sound.user?.avatar_url || '',
    playing: !paused,
    positionMs: Math.round(position ?? 0),
  })
}

async function endStream() {
  if (!window.confirm('End the stream for everyone?')) return
  try {
    await api.closeRoom(props.id, hostToken)
    clearHostToken(props.id)
    router.push('/')
  } catch (e) {
    error.value = e.message
  }
}

// ---- Listener ----

function tuneIn() {
  tunedIn.value = true
  if (playback.value?.trackUrl) playerUrl.value = playback.value.trackUrl
}

function expectedPosition(state) {
  if (!state.playing) return state.positionMs
  const serverNow = Date.now() - clockOffset
  return state.positionMs + Math.max(0, serverNow - state.serverTime)
}

async function syncToHost() {
  const state = playback.value
  if (isHost || !tunedIn.value || !state?.trackUrl || syncing) return
  if (!playerUrl.value) {
    playerUrl.value = state.trackUrl // first track after tuning in; onPlayerReady re-runs the sync
    return
  }
  if (!playerReady.value) return

  syncing = true
  try {
    if (player.value.loadedUrl() !== state.trackUrl) {
      await player.value.load(state.trackUrl, { autoPlay: state.playing })
    }
    const paused = await player.value.isPaused()
    if (paused === null) return
    if (state.playing && paused) player.value.play()
    else if (!state.playing && !paused) player.value.pause()

    const target = expectedPosition(state)
    const position = await player.value.getPosition()
    if (position !== null && Math.abs(position - target) > DRIFT_MS) player.value.seekTo(target)
  } finally {
    syncing = false
  }
}

// ---- Chat & sharing ----

function sendChat() {
  const text = chatText.value.trim()
  if (!text || !connection) return
  const author = nickname.value.trim()
  if (!isHost && author) setNickname(author)
  connection.sendChat({ hostToken, author, text })
  chatText.value = ''
}

async function scrollChatToBottom() {
  await nextTick()
  if (chatList.value) chatList.value.scrollTop = chatList.value.scrollHeight
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${props.id}`)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    window.prompt('Copy this invite link:', `${window.location.origin}/room/${props.id}`)
  }
}
</script>

<template>
  <main class="page">
    <div v-if="error && !room" class="card ended">
      <h2>{{ error }}</h2>
      <p class="muted">The stream may have ended or the code is wrong.</p>
      <RouterLink class="btn" to="/">Back home</RouterLink>
    </div>

    <div v-else-if="closed" class="card ended">
      <h2>The stream has ended</h2>
      <p class="muted">The host closed this room. Thanks for listening!</p>
      <RouterLink class="btn" to="/">Find another stream</RouterLink>
    </div>

    <template v-else-if="room">
      <header class="room-header room-header--studio">
        <div>
          <p class="eyebrow"><span class="live-dot"></span> {{ isHost ? 'Your live studio' : `Hosted by ${room.hostName}` }}</p>
          <h1>{{ room.name }}</h1>
          <div class="meta">
            <span class="pill" :class="`pill--${status}`">{{ statusLabel }}</span>
            <span>{{ listeners }} in the room</span>
            <span>Code <strong class="mono">{{ room.id }}</strong></span>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" @click="copyLink">
            {{ copied ? 'Link copied ✓' : 'Copy invite link' }}
          </button>
          <button v-if="isHost" class="btn btn--danger" type="button" @click="endStream">End stream</button>
          <RouterLink v-else class="btn btn--ghost" to="/">Leave</RouterLink>
        </div>
      </header>

      <p v-if="error" class="notice notice--error">{{ error }}</p>

      <div class="room-grid">
        <div class="stack">
          <section class="card now-playing studio-now-playing">
            <img v-if="artwork" :src="artwork" alt="" class="artwork" />
            <div v-else class="artwork artwork--empty">♪</div>
            <div class="np-text">
              <p class="eyebrow">
                {{ playback?.playing ? 'Now playing' : playback?.trackUrl ? 'Paused' : 'Nothing playing yet' }}
              </p>
              <h2 class="track-title">
                {{ playback?.title || (isHost ? 'Paste a SoundCloud link to start' : 'Waiting for the host…') }}
              </h2>
              <p v-if="playback?.artist" class="muted">{{ playback.artist }}</p>
            </div>
            <span v-if="playback?.playing" class="live-badge">LIVE</span>
          </section>

          <form v-if="isHost" class="card" @submit.prevent="playTrack">
            <label for="track-url">SoundCloud track or playlist link</label>
            <div class="row">
              <input
                id="track-url"
                v-model="trackInput"
                placeholder="https://soundcloud.com/artist/track"
                autocomplete="off"
              />
              <button class="btn" type="submit">Play for everyone</button>
            </div>
            <p v-if="formError" class="field-error">{{ formError }}</p>
            <p class="hint">Play, pause, seek or skip in the player below. Listeners follow along automatically.</p>
          </form>

          <SoundCloudLibrary
            v-if="isHost && soundCloudProfile"
            class="card room-library"
            compact
            picker
            @select="playLibraryItem"
          />

          <section v-if="!isHost && !tunedIn" class="card tune-in">
            <p class="muted">Your browser needs one click before it can play audio.</p>
            <button class="btn btn--big" type="button" @click="tuneIn">▶ Tune in</button>
          </section>

          <section v-if="playerUrl" class="card player-card">
            <SoundCloudPlayer
              ref="player"
              :initial-url="playerUrl"
              @ready="onPlayerReady"
              @play="onHostPlayerEvent('play')"
              @pause="onHostPlayerEvent('pause')"
              @seek="onHostPlayerEvent('seek')"
              @finish="onHostPlayerEvent('finish')"
              @error="onPlayerError"
            />
            <div class="volume">
              <label for="volume">Volume</label>
              <input id="volume" v-model.number="volume" type="range" min="0" max="100" />
            </div>
            <p v-if="!isHost" class="hint">The host controls playback. You'll stay in sync automatically.</p>
          </section>

          <p v-else-if="!isHost && tunedIn" class="muted">Tuned in. Music will start when the host plays something.</p>
          <p v-if="playerError" class="notice notice--error">{{ playerError }}</p>
        </div>

        <aside class="card chat">
          <h3>Chat</h3>
          <ul ref="chatList" class="chat-list">
            <li v-if="!chat.length" class="muted">No messages yet. Say hi 👋</li>
            <li v-for="(message, i) in chat" :key="i">
              <strong :class="{ 'is-host': message.host }">{{ message.author }}</strong>
              <span v-if="message.host" class="badge">host</span>
              {{ message.text }}
            </li>
          </ul>
          <form class="chat-form" @submit.prevent="sendChat">
            <input v-if="!isHost" v-model="nickname" placeholder="Your name" maxlength="40" />
            <div class="row">
              <input v-model="chatText" placeholder="Message" maxlength="500" />
              <button class="btn" type="submit" :disabled="status !== 'connected'">Send</button>
            </div>
          </form>
        </aside>
      </div>
    </template>

    <p v-else class="muted">Loading room…</p>
  </main>
</template>
