<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SoundCloudPlayer from '../components/SoundCloudPlayer.vue'
import { api, clearHostToken, getHostToken, getNickname, setNickname } from '../api'
import { selectLatestPlayback } from '../playback'
import { mergeChatMessages } from '../roomState'
import { connectToRoom } from '../stomp'
import {
  isSoundCloudSetUrl,
  isSoundCloudUrl,
  largeArtwork,
  parseSoundCloudUrls,
  soundCloudUrlLabel,
} from '../soundcloud'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const DRIFT_MS = 2500 // listeners re-seek when further than this from the host
const SYNC_INTERVAL_MS = 3000 // how often listeners check their drift
const HEARTBEAT_MS = 5000 // how often the host re-broadcasts its position
const MAX_CHAT = 100

const hostToken = getHostToken(props.id)
const isHost = Boolean(hostToken)

const room = ref(null)
const error = ref('')
const realtimeError = ref('')
const closed = ref(false)
const status = ref('connecting')
const listeners = ref(0)
const playback = ref(null)
let clockOffset = 0 // client clock minus server clock

const player = ref(null)
const playerUrl = ref('')
const playerReady = ref(false)
const playerError = ref('')
const playerKey = ref(0)
const tunedIn = ref(false)
const resyncing = ref(false)
const volume = ref(80)

const trackInput = ref('')
const formError = ref('')
const trackQueue = ref(readQueue())
const activeQueueIndex = ref(-1)
let pendingAutoplay = false
let pendingTrackUrl = ''
let hostStarted = false
let queueServerTime = 0

const chat = ref([])
const chatText = ref('')
const chatList = ref(null)
const nickname = ref(getNickname())
const inviteFeedback = ref('')
const canNativeShare = typeof navigator.share === 'function'

let connection = null
let timer = null
let syncing = false
let broadcasting = false
let broadcastQueued = false
let broadcastRetryTimer = null
let inviteFeedbackTimer = null

const statusLabel = computed(
  () => ({ connected: 'Connected', connecting: 'Connecting…', disconnected: 'Reconnecting…' })[status.value],
)
const artwork = computed(() => largeArtwork(playback.value?.artworkUrl))
const activeQueueUrl = computed(() => trackQueue.value[activeQueueIndex.value] || '')
const inviteButtonLabel = computed(
  () => inviteFeedback.value || (canNativeShare ? 'Share invite' : 'Copy invite link'),
)

watch(
  trackQueue,
  () => {
    persistQueue()
    broadcastQueue()
  },
  { deep: true },
)
watch(activeQueueIndex, broadcastQueue)

onMounted(async () => {
  try {
    const data = await api.getRoom(props.id)
    room.value = data
    listeners.value = data.listeners
    playback.value = data.playback
    chat.value = mergeChatMessages([], data.chat, MAX_CHAT)
    if (!isHost) applyQueueState(data.queue)
    clockOffset = Date.now() - data.serverNow
    scrollChatToBottom()
  } catch (e) {
    error.value = e.message
    return
  }

  // A host who reloads the page gets their last track back in the player (not auto-playing).
  if (isHost && playback.value?.trackUrl) {
    playerUrl.value = playback.value.trackUrl
    activeQueueIndex.value = trackQueue.value.indexOf(playback.value.trackUrl)
  }
  // Prime a listener's widget before their direct SoundCloud Play click.
  if (!isHost && playback.value?.trackUrl) playerUrl.value = playback.value.trackUrl
  if (isHost && !playerUrl.value) {
    try {
      const queued = JSON.parse(window.sessionStorage.getItem('soundstream:queued-source'))
      window.sessionStorage.removeItem('soundstream:queued-source')
      if (queued?.permalinkUrl && isSoundCloudUrl(queued.permalinkUrl)) {
        activeQueueIndex.value = addToQueue(queued.permalinkUrl)
        pendingAutoplay = true
        playerUrl.value = queued.permalinkUrl
      }
    } catch {
      // Ignore unavailable or malformed session storage.
    }
  }

  connection = connectToRoom(props.id, {
    onStatus: (s) => {
      status.value = s
      if (s === 'connected') {
        realtimeError.value = ''
        if (isHost) {
          broadcastState()
          broadcastQueue()
        }
        else refreshPlaybackState()
      }
    },
    onError: (message) => (realtimeError.value = message),
    onPlayback: (state) => {
      playback.value = state
      syncToHost()
    },
    onQueue: applyQueueState,
    onListeners: (count) => (listeners.value = count),
    onChat: (message) => {
      chat.value = mergeChatMessages(chat.value, [message], MAX_CHAT)
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
  clearTimeout(broadcastRetryTimer)
  clearTimeout(inviteFeedbackTimer)
  broadcastQueued = false
  connection?.disconnect()
  connection = null
}

watch(volume, (v) => player.value?.setVolume(v))

function onPlayerReady() {
  playerReady.value = true
  playerError.value = ''
  player.value.setVolume(volume.value)
  if (isHost && pendingTrackUrl) {
    const url = pendingTrackUrl
    pendingTrackUrl = ''
    player.value.load(url, { autoPlay: true })
    return
  }
  if (isHost && pendingAutoplay) {
    pendingAutoplay = false
    player.value.play()
  }
  syncToHost()
}

function onPlayerError(message) {
  playerError.value = message
}

function retryPlayer() {
  playerError.value = ''
  playerReady.value = false
  playerKey.value += 1
}

// ---- Host ----

function readQueue() {
  if (!isHost) return []
  try {
    const saved = JSON.parse(window.localStorage.getItem(`soundstream:queue:${props.id}`))
    return Array.isArray(saved) ? saved.filter(isSoundCloudUrl).slice(0, 100) : []
  } catch {
    return []
  }
}

function persistQueue() {
  if (!isHost) return
  try {
    window.localStorage.setItem(`soundstream:queue:${props.id}`, JSON.stringify(trackQueue.value))
  } catch {
    // Private browsing can block storage; the in-memory queue still works.
  }
}

function addToQueue(url) {
  const existing = trackQueue.value.indexOf(url)
  if (existing >= 0) return existing
  trackQueue.value.push(url)
  return trackQueue.value.length - 1
}

function addUrls(playFirst) {
  const urls = parseSoundCloudUrls(trackInput.value)
  if (!urls.length) {
    formError.value = 'Paste at least one SoundCloud song, playlist, or album URL.'
    return
  }
  const invalidIndex = urls.findIndex((url) => !isSoundCloudUrl(url))
  if (invalidIndex >= 0) {
    formError.value = `Line ${invalidIndex + 1} is not a valid public SoundCloud URL.`
    return
  }
  formError.value = ''
  const firstIndex = addToQueue(urls[0])
  urls.slice(1).forEach(addToQueue)
  trackInput.value = ''
  if (playFirst) playQueueItem(firstIndex)
}

function loadSource(sourceUrl) {
  const url = sourceUrl.trim()
  if (!isSoundCloudUrl(url)) {
    formError.value = 'Paste a link to a SoundCloud song, playlist, or album.'
    return
  }
  formError.value = ''
  playerError.value = ''
  if (!playerUrl.value) {
    pendingAutoplay = true
    playerUrl.value = url
  } else if (playerReady.value && player.value) {
    player.value.load(url, { autoPlay: true })
  } else {
    pendingTrackUrl = url
  }
}

function playQueueItem(index) {
  const url = trackQueue.value[index]
  if (!url) return
  activeQueueIndex.value = index
  loadSource(url)
}

function playNext() {
  if (activeQueueIndex.value < trackQueue.value.length - 1) playQueueItem(activeQueueIndex.value + 1)
}

function playPrevious() {
  if (activeQueueIndex.value > 0) playQueueItem(activeQueueIndex.value - 1)
}

function removeQueueItem(index) {
  trackQueue.value.splice(index, 1)
  if (index < activeQueueIndex.value) activeQueueIndex.value -= 1
  else if (index === activeQueueIndex.value) activeQueueIndex.value = -1
}

function clearQueue() {
  trackQueue.value = []
  activeQueueIndex.value = -1
}

function broadcastQueue() {
  if (!isHost || !connection) return
  connection.publishQueue({
    hostToken,
    trackUrls: [...trackQueue.value],
    activeIndex: activeQueueIndex.value,
  })
}

function applyQueueState(state) {
  if (isHost || !state || state.serverTime < queueServerTime) return
  queueServerTime = state.serverTime
  trackQueue.value = Array.isArray(state.trackUrls) ? [...state.trackUrls] : []
  activeQueueIndex.value = Number.isInteger(state.activeIndex) ? state.activeIndex : -1
}

function onPlayerEvent(type) {
  if (!isHost) {
    if (type === 'play' && !tunedIn.value) {
      tunedIn.value = true
      syncToHost()
    }
    return
  }
  if (type === 'play') hostStarted = true
  if (
    type === 'finish' &&
    activeQueueIndex.value >= 0 &&
    !isSoundCloudSetUrl(activeQueueUrl.value) &&
    activeQueueIndex.value < trackQueue.value.length - 1
  ) {
    playNext()
    return
  }
  broadcastState()
  clearTimeout(broadcastRetryTimer)
  broadcastRetryTimer = setTimeout(broadcastState, 250)
}

async function broadcastState() {
  // Don't broadcast a restored-but-idle player; wait until the host actually presses play.
  if (!isHost || !hostStarted || !playerReady.value || !connection) return
  if (broadcasting) {
    broadcastQueued = true
    return
  }

  broadcasting = true
  try {
    do {
      broadcastQueued = false
      await broadcastSnapshot()
    } while (broadcastQueued && connection)
  } finally {
    broadcasting = false
  }
}

async function broadcastSnapshot() {
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

function expectedPosition(state) {
  if (!state.playing) return state.positionMs
  const serverNow = Date.now() - clockOffset
  return state.positionMs + Math.max(0, serverNow - state.serverTime)
}

async function refreshPlaybackState(forceSync = false) {
  if (isHost || closed.value) return
  try {
    const data = await api.getRoom(props.id)
    if (closed.value) return
    room.value = data
    listeners.value = data.listeners
    clockOffset = Date.now() - data.serverNow
    // A playback event can arrive while this request is in flight; never replace it with an older snapshot.
    playback.value = selectLatestPlayback(playback.value, data.playback)
    applyQueueState(data.queue)
    chat.value = mergeChatMessages(chat.value, data.chat, MAX_CHAT)
    scrollChatToBottom()
    await syncToHost(forceSync)
  } catch (e) {
    realtimeError.value = `Connected, but the latest playback state could not be loaded. ${e.message}`
  }
}

async function syncToHost(force = false) {
  const state = playback.value
  if (isHost || !state?.trackUrl || syncing) return
  if (!playerUrl.value) {
    playerUrl.value = state.trackUrl // prime the widget; onPlayerReady re-runs the sync
    return
  }
  if (!playerReady.value) return

  syncing = true
  try {
    if (player.value.loadedUrl() !== state.trackUrl) {
      await player.value.load(state.trackUrl, { autoPlay: tunedIn.value && state.playing })
    }
    if (!tunedIn.value) return
    const paused = await player.value.isPaused()
    if (paused === null) return
    if (state.playing && paused) player.value.play()
    else if (!state.playing && !paused) player.value.pause()

    const target = expectedPosition(state)
    const position = await player.value.getPosition()
    if (position !== null && (force || Math.abs(position - target) > DRIFT_MS)) player.value.seekTo(target)
  } finally {
    syncing = false
  }
}

async function resyncNow() {
  if (resyncing.value) return
  resyncing.value = true
  try {
    await refreshPlaybackState(true)
  } finally {
    resyncing.value = false
  }
}

async function retryConnection() {
  realtimeError.value = ''
  try {
    await connection?.reconnect()
  } catch {
    realtimeError.value = 'Could not restart the live connection. Retrying automatically…'
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

function showInviteFeedback(message) {
  inviteFeedback.value = message
  clearTimeout(inviteFeedbackTimer)
  inviteFeedbackTimer = setTimeout(() => (inviteFeedback.value = ''), 2000)
}

async function shareInvite() {
  const url = `${window.location.origin}/room/${props.id}`
  if (canNativeShare) {
    try {
      await navigator.share({
        title: room.value?.name || 'SoundStream room',
        text: `Join ${room.value?.hostName || 'the host'} on SoundStream.`,
        url,
      })
      showInviteFeedback('Invite shared ✓')
      return
    } catch (e) {
      if (e?.name === 'AbortError') return
      // Fall back to copying when native sharing is unavailable or fails.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    showInviteFeedback('Link copied ✓')
  } catch {
    window.prompt('Copy this invite link:', url)
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
          <button class="btn btn--ghost" type="button" @click="shareInvite">
            {{ inviteButtonLabel }}
          </button>
          <button v-if="isHost" class="btn btn--danger" type="button" @click="endStream">End stream</button>
          <RouterLink v-else class="btn btn--ghost" to="/">Leave</RouterLink>
        </div>
      </header>

      <p v-if="error" class="notice notice--error">{{ error }}</p>
      <div v-if="realtimeError" class="notice notice--error player-error" role="alert">
        <span>{{ realtimeError }}</span>
        <button class="btn btn--ghost btn--compact" type="button" @click="retryConnection">Reconnect now</button>
      </div>

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

          <form v-if="isHost" class="card queue-form" @submit.prevent="addUrls(true)">
            <label for="track-url">SoundCloud songs, playlists, or albums</label>
            <textarea
                id="track-url"
                v-model="trackInput"
                rows="3"
                placeholder="Paste one SoundCloud URL per line"
                autocomplete="off"
              ></textarea>
            <div class="queue-form-actions">
              <button class="btn" type="submit">Play first + queue all</button>
              <button class="btn btn--ghost" type="button" @click="addUrls(false)">Add to queue</button>
            </div>
            <p v-if="formError" class="field-error">{{ formError }}</p>
            <p class="hint">Paste several links at once. Playlists and albums continue through their own SoundCloud track list.</p>
          </form>

          <section v-if="isHost && trackQueue.length" class="card host-queue">
            <div class="queue-heading">
              <div><p class="eyebrow">Up next</p><h3>Room queue <span>{{ trackQueue.length }}</span></h3></div>
              <div class="queue-controls">
                <button class="btn btn--ghost btn--compact" type="button" :disabled="activeQueueIndex <= 0" @click="playPrevious">Previous</button>
                <button class="btn btn--ghost btn--compact" type="button" :disabled="activeQueueIndex < 0 || activeQueueIndex >= trackQueue.length - 1" @click="playNext">Next</button>
                <button class="queue-clear" type="button" @click="clearQueue">Clear</button>
              </div>
            </div>
            <ol class="queue-list">
              <li v-for="(url, index) in trackQueue" :key="url" :class="{ active: index === activeQueueIndex }">
                <button class="queue-play" type="button" @click="playQueueItem(index)">
                  <span>{{ index === activeQueueIndex ? '▶' : index + 1 }}</span>
                  <span><strong>{{ soundCloudUrlLabel(url) }}</strong><small>{{ isSoundCloudSetUrl(url) ? 'Playlist or album' : 'Song or share link' }}</small></span>
                </button>
                <button class="queue-remove" type="button" :aria-label="`Remove ${soundCloudUrlLabel(url)} from queue`" @click="removeQueueItem(index)">×</button>
              </li>
            </ol>
          </section>

          <section v-else-if="trackQueue.length" class="card host-queue listener-queue">
            <div class="queue-heading">
              <div>
                <p class="eyebrow">Coming up</p>
                <h3>Room queue <span>{{ trackQueue.length }}</span></h3>
              </div>
            </div>
            <ol class="queue-list">
              <li v-for="(url, index) in trackQueue" :key="url" :class="{ active: index === activeQueueIndex }">
                <div class="queue-play queue-play--readonly">
                  <span>{{ index === activeQueueIndex ? '▶' : index + 1 }}</span>
                  <span>
                    <strong>{{ soundCloudUrlLabel(url) }}</strong>
                    <small>
                      {{ index === activeQueueIndex ? 'Playing now' : isSoundCloudSetUrl(url) ? 'Playlist or album' : 'Up next' }}
                    </small>
                  </span>
                </div>
              </li>
            </ol>
          </section>

          <section v-if="!isHost && !tunedIn && !playerReady" class="card tune-in">
            <p v-if="!playback?.trackUrl" class="muted">Waiting for the host to choose the first track.</p>
            <p v-else class="muted">Preparing the SoundCloud player…</p>
          </section>

          <section v-if="playerUrl" class="card player-card">
            <SoundCloudPlayer
              :key="playerKey"
              ref="player"
              :initial-url="playerUrl"
              :auto-play="isHost && pendingAutoplay"
              @ready="onPlayerReady"
              @play="onPlayerEvent('play')"
              @pause="onPlayerEvent('pause')"
              @seek="onPlayerEvent('seek')"
              @finish="onPlayerEvent('finish')"
              @error="onPlayerError"
            />
            <div class="player-controls">
              <div class="volume">
                <label for="volume">Volume</label>
                <input id="volume" v-model.number="volume" type="range" min="0" max="100" />
              </div>
              <button
                v-if="!isHost && tunedIn"
                class="btn btn--ghost btn--compact"
                type="button"
                :disabled="resyncing"
                @click="resyncNow"
              >
                {{ resyncing ? 'Syncing…' : 'Sync now' }}
              </button>
            </div>
            <p v-if="!isHost && !tunedIn" class="hint">
              Press the orange Play button in SoundCloud once to tune in. Your browser requires this direct click for audio.
            </p>
            <p v-else-if="!isHost" class="hint">The host controls playback. You'll stay in sync automatically.</p>
          </section>

          <p v-else-if="!isHost && tunedIn" class="muted">Tuned in. Music will start when the host plays something.</p>
          <div v-if="playerError" class="notice notice--error player-error">
            <span>{{ playerError }}</span>
            <button class="btn btn--ghost btn--compact" type="button" @click="retryPlayer">Retry player</button>
          </div>
        </div>

        <aside class="card chat">
          <h3>Chat</h3>
          <ul ref="chatList" class="chat-list">
            <li v-if="!chat.length" class="muted">No messages yet. Say hi 👋</li>
            <li v-for="(message, i) in chat" :key="message.id || i">
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
