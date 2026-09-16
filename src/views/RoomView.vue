<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarMark from '../components/AvatarMark.vue'
import ChatPanel from '../components/ChatPanel.vue'
import JoinGate from '../components/JoinGate.vue'
import MemberList from '../components/MemberList.vue'
import PressPlayCard from '../components/PressPlayCard.vue'
import RoomPlayer from '../components/RoomPlayer.vue'
import { api, clearHostToken, getHostToken } from '../api'
import { getIdentity, setIdentity } from '../identity'
import { selectLatestPlayback } from '../playback'
import { notifyChatMessage } from '../notifications'
import { latestServerTime } from '../receipts'
import { applyTyping, pruneTyping, typingLabel, typingNames } from '../typing'
import { mergeChatMessages } from '../roomState'
import { connectToRoom } from '../stomp'
import ProviderLogo from '../components/ProviderLogo.vue'
import { detectProvider, isSetUrl, isSupportedUrl, parseUrls, providerBadge, urlLabel } from '../providers'
import { largeArtwork } from '../soundcloud'

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
const closedReason = ref('')
const status = ref('connecting')
const members = ref([])
const playback = ref(null)
const chat = ref([])
const receipts = ref({})
const typingPeople = ref({})
let clockOffset = 0 // client clock minus server clock

// The host named themselves when they made the room; guests pick a name and face at the door.
const identity = ref(getIdentity())
const joined = ref(isHost)
const myId = identity.value.memberId
/** Whether *our* audio is actually running: present in the room is not the same as listening. */
const selfListening = ref(false)

const player = ref(null)
const playerUrl = ref('')
const playerProvider = ref('')
const playerReady = ref(false)
const playerError = ref('')
const playerKey = ref(0)
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

const inviteFeedback = ref('')
const canNativeShare = typeof navigator.share === 'function'

let connection = null
let timer = null
let syncing = false
let broadcasting = false
let broadcastQueued = false
let broadcastRetryTimer = null
let inviteFeedbackTimer = null
let typingTimer = null

const statusLabel = computed(
  () => ({ connected: 'Live', connecting: 'Connecting…', disconnected: 'Reconnecting…' })[status.value],
)
const artwork = computed(() => largeArtwork(playback.value?.artworkUrl))
const activeQueueUrl = computed(() => trackQueue.value[activeQueueIndex.value] || '')
const nowPlaying = computed(() => providerBadge(playback.value?.trackUrl || ''))
const typingIndicator = computed(() => typingLabel(typingNames(typingPeople.value, myId)))
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
watch(volume, (v) => player.value?.setVolume(v))

onMounted(async () => {
  try {
    const data = await api.getRoom(props.id)
    applySnapshot(data)
    clockOffset = Date.now() - data.serverNow
  } catch (e) {
    error.value = e.message
    return
  }

  // A host who reloads gets their last track back in the player, paused.
  if (isHost && playback.value?.trackUrl) {
    showInPlayer(playback.value.trackUrl)
    activeQueueIndex.value = trackQueue.value.indexOf(playback.value.trackUrl)
  }
  if (isHost && !playerUrl.value) restoreQueuedSource()
  if (isHost) start()
})

onBeforeUnmount(teardown)

function applySnapshot(data) {
  room.value = data
  members.value = data.members || []
  playback.value = selectLatestPlayback(playback.value, data.playback)
  chat.value = mergeChatMessages(chat.value, data.chat, MAX_CHAT)
  receipts.value = data.receipts && typeof data.receipts === 'object' ? data.receipts : {}
  if (!isHost) applyQueueState(data.queue)
}

/** A link chosen on the home page before the room existed. */
function restoreQueuedSource() {
  try {
    const queued = JSON.parse(window.sessionStorage.getItem('soundstream:queued-source'))
    window.sessionStorage.removeItem('soundstream:queued-source')
    if (queued?.permalinkUrl && isSupportedUrl(queued.permalinkUrl)) {
      activeQueueIndex.value = addToQueue(queued.permalinkUrl)
      pendingAutoplay = true
      showInPlayer(queued.permalinkUrl)
    }
  } catch {
    // Ignore unavailable or malformed session storage.
  }
}

function joinRoom(chosen) {
  // Keep the stable member id: the gate only chooses a name and a face.
  identity.value = { ...identity.value, ...chosen }
  setIdentity(chosen)
  joined.value = true
  start()
}

function start() {
  document.addEventListener('visibilitychange', onVisibilityChange)
  connection = connectToRoom(
    props.id,
    {
      onStatus: (s) => {
        status.value = s
        if (s !== 'connected') return
        realtimeError.value = ''
        connection?.sendListening(selfListening.value)
        acknowledgeChat()
        if (isHost) {
          broadcastState()
          broadcastQueue()
        } else {
          refreshPlaybackState()
        }
      },
      onError: (message) => (realtimeError.value = message),
      onPlayback: (state) => {
        playback.value = state
        syncToHost()
      },
      onQueue: applyQueueState,
      onMembers: (list) => (members.value = Array.isArray(list) ? list : []),
      onReceipts: (map) => (receipts.value = map && typeof map === 'object' ? map : {}),
      onTyping: (notice) => (typingPeople.value = applyTyping(typingPeople.value, notice)),
      onChat: (message) => {
        chat.value = mergeChatMessages(chat.value, [message], MAX_CHAT)
        notifyChatMessage(message, { roomName: room.value?.name, myId })
        acknowledgeChat()
      },
      onClosed: (payload) => {
        closed.value = true
        closedReason.value = payload?.reason === 'empty' ? 'empty' : 'host'
        teardown()
      },
    },
    () => ({
      hostToken,
      memberId: myId,
      name: identity.value.name,
      avatarId: identity.value.avatarId,
    }),
  )

  timer = isHost ? setInterval(broadcastState, HEARTBEAT_MS) : setInterval(syncToHost, SYNC_INTERVAL_MS)
  // Indicators expire here rather than on the server, so a lost "stopped typing" self-heals.
  typingTimer = setInterval(() => (typingPeople.value = pruneTyping(typingPeople.value)), 1500)
}

function teardown() {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearInterval(timer)
  clearInterval(typingTimer)
  clearTimeout(broadcastRetryTimer)
  clearTimeout(inviteFeedbackTimer)
  broadcastQueued = false
  connection?.disconnect()
  connection = null
}

// ---- Player ----

/**
 * Points the player at a URL. Each provider is a different embed, so changing provider
 * remounts the component instead of asking one widget to load another service's link.
 */
function showInPlayer(url, { autoPlay = false } = {}) {
  const provider = detectProvider(url)
  playerProvider.value = provider
  playerReady.value = false
  pendingAutoplay = autoPlay
  playerUrl.value = url
  playerKey.value += 1
}

function onPlayerReady() {
  playerReady.value = true
  playerError.value = ''
  player.value.setVolume(volume.value)
  if (isHost) {
    if (pendingTrackUrl) {
      const url = pendingTrackUrl
      pendingTrackUrl = ''
      player.value.load(url, { autoPlay: true })
      return
    }
    if (pendingAutoplay) {
      pendingAutoplay = false
      player.value.play()
    }
    // Announce the loaded track even if the embed refuses to start on its own, which YouTube
    // does whenever autoplay is blocked. Without this the room would keep showing the previous
    // track. broadcastState() ignores a merely restored player.
    broadcastState()
    return
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

function setListening(listening) {
  if (selfListening.value === listening) return
  selfListening.value = listening
  connection?.sendListening(listening)
}

function onPlayerEvent(type) {
  // Everyone reports this, host included: it is what the member list means by "listening".
  if (type === 'play') setListening(true)
  if (type === 'pause' || type === 'finish') setListening(false)
  if (!isHost) return
  if (type === 'play') hostStarted = true
  if (
    type === 'finish' &&
    activeQueueIndex.value >= 0 &&
    !isSetUrl(activeQueueUrl.value) &&
    activeQueueIndex.value < trackQueue.value.length - 1
  ) {
    playNext()
    return
  }
  broadcastState()
  clearTimeout(broadcastRetryTimer)
  broadcastRetryTimer = setTimeout(broadcastState, 250)
}

// ---- Host: queue ----

function readQueue() {
  if (!isHost) return []
  try {
    const saved = JSON.parse(window.localStorage.getItem(`soundstream:queue:${props.id}`))
    return Array.isArray(saved) ? saved.filter(isSupportedUrl).slice(0, 100) : []
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
  const urls = parseUrls(trackInput.value)
  if (!urls.length) {
    formError.value = 'Paste at least one SoundCloud or YouTube link.'
    return
  }
  const invalidIndex = urls.findIndex((url) => !isSupportedUrl(url))
  if (invalidIndex >= 0) {
    formError.value = `Link ${invalidIndex + 1} isn\u2019t a SoundCloud or YouTube link.`
    return
  }
  formError.value = ''
  const firstIndex = addToQueue(urls[0])
  urls.slice(1).forEach(addToQueue)
  trackInput.value = ''
  if (playFirst) playQueueItem(firstIndex)
}

function queueFromLibrary(url) {
  const index = addToQueue(url)
  if (activeQueueIndex.value < 0) playQueueItem(index)
}

function loadSource(sourceUrl) {
  const url = sourceUrl.trim()
  if (!isSupportedUrl(url)) {
    formError.value = 'Paste a link to a SoundCloud or YouTube song, playlist or album.'
    return
  }
  formError.value = ''
  playerError.value = ''
  // The host picked this deliberately, so it is theirs to broadcast — even after a reload, where
  // hostStarted is false because no play event has happened yet in this page view.
  hostStarted = true

  if (!playerUrl.value || detectProvider(url) !== playerProvider.value) {
    showInPlayer(url, { autoPlay: true })
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

// ---- Host: broadcasting ----

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
  if (!sound || !connection) return
  connection.publishPlayback({
    hostToken,
    trackUrl: sound.permalink_url || playerUrl.value,
    title: sound.title,
    artist: sound.user?.username ?? '',
    artworkUrl: sound.artwork_url || sound.user?.avatar_url || '',
    // Providers without a player report null; treat the host's intent as "playing".
    playing: paused === null ? true : !paused,
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
    clockOffset = Date.now() - data.serverNow
    applySnapshot(data)
    await syncToHost(forceSync)
  } catch (e) {
    realtimeError.value = `Connected, but the latest playback state could not be loaded. ${e.message}`
  }
}

async function syncToHost(force = false) {
  const state = playback.value
  if (isHost || !joined.value || !state?.trackUrl || syncing) return

  // A different service means a different embed; remount rather than cross-load.
  if (!playerUrl.value || detectProvider(state.trackUrl) !== playerProvider.value) {
    showInPlayer(state.trackUrl, { autoPlay: state.playing })
    return
  }
  if (!playerReady.value) return

  syncing = true
  try {
    if (player.value.loadedUrl() !== state.trackUrl) {
      await player.value.load(state.trackUrl, { autoPlay: state.playing })
    }
    const paused = await player.value.isPaused()
    // A player that cannot report its state yet: leave it alone rather than guess.
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

const sendChat = (text) => connection?.sendChat({ hostToken, text })
const sendSticker = (stickerId) => connection?.sendSticker({ hostToken, stickerId })

/**
 * Tells the room how far we have got through the chat. Reading the newest message implies
 * reading every message before it, so one timestamp is enough to draw ticks for the whole history.
 * A hidden tab has received but not read them.
 */
function acknowledgeChat() {
  const through = latestServerTime(chat.value)
  if (!through || !connection) return
  connection.sendReceipt({ read: !document.hidden, throughServerTime: through })
}

function onVisibilityChange() {
  if (!document.hidden) acknowledgeChat()
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
      showInviteFeedback('Invite shared')
      return
    } catch (e) {
      if (e?.name === 'AbortError') return
      // Fall back to copying when native sharing is unavailable or fails.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    showInviteFeedback('Link copied')
  } catch {
    window.prompt('Copy this invite link:', url)
  }
}
</script>

<template>
  <main class="page room-page">
    <div v-if="error && !room" class="card ended sketch-frame">
      <h2>{{ error }}</h2>
      <p class="muted">The stream may have ended, or the code is wrong.</p>
      <RouterLink class="btn" to="/">Back home</RouterLink>
    </div>

    <div v-else-if="closed" class="card ended sketch-frame">
      <h2>{{ closedReason === 'empty' ? 'This room was closed' : 'The stream has ended' }}</h2>
      <p class="muted">
        {{
          closedReason === 'empty'
            ? 'Everyone had left, so the room was cleaned up.'
            : 'The host closed the room. Thanks for listening.'
        }}
      </p>
      <RouterLink class="btn" to="/">Find another stream</RouterLink>
    </div>

    <template v-else-if="room">
      <header class="room-header">
        <div class="room-title">
          <p class="eyebrow">
            <span class="live-dot" :class="`live-dot--${status}`"></span>
            {{ isHost ? 'You are hosting' : 'Listening along' }}
          </p>
          <h1>{{ room.name }}</h1>
          <div class="meta">
            <span class="host-chip">
              <AvatarMark :id="room.hostAvatarId" :size="26" flat />
              {{ room.hostName }}
            </span>
            <span class="pill" :class="`pill--${status}`">{{ statusLabel }}</span>
            <span>{{ members.length }} in the room</span>
            <span>Code <strong class="mono">{{ room.id }}</strong></span>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" @click="shareInvite">{{ inviteButtonLabel }}</button>
          <button v-if="isHost" class="btn btn--danger" type="button" @click="endStream">End stream</button>
          <RouterLink v-else class="btn btn--ghost" to="/">Leave</RouterLink>
        </div>
      </header>

      <p v-if="error" class="notice notice--error">{{ error }}</p>
      <div v-if="realtimeError" class="notice notice--error split-notice" role="alert">
        <span>{{ realtimeError }}</span>
        <button class="btn btn--ghost btn--compact" type="button" @click="retryConnection">Reconnect now</button>
      </div>

      <JoinGate
        v-if="!joined"
        :room-name="room.name"
        :host-name="room.hostName"
        @join="joinRoom"
      />

      <div v-else class="room-grid">
        <div class="stack">
          <section class="card now-playing sketch-frame">
            <img v-if="artwork" :src="artwork" alt="" class="artwork" />
            <div v-else class="artwork artwork--empty">♪</div>
            <div class="np-text">
              <p class="eyebrow">
                {{ playback?.playing ? 'Now playing' : playback?.trackUrl ? 'Paused' : 'Nothing playing yet' }}
              </p>
              <h2 class="track-title">
                {{ playback?.title || (isHost ? 'Paste a link to start' : 'Waiting for the host…') }}
              </h2>
              <p v-if="playback?.artist" class="muted">{{ playback.artist }}</p>
              <p v-if="nowPlaying" class="provider-note">
                <span class="provider-chip">
                  <ProviderLogo :logo="nowPlaying.logo" :label="nowPlaying.label" :size="18" />
                  {{ nowPlaying.label }}
                </span>
              </p>
            </div>
          </section>

          <form v-if="isHost" class="card sketch-frame-2" @submit.prevent="addUrls(true)">
            <label for="track-url">SoundCloud or YouTube links</label>
            <textarea
              id="track-url"
              v-model="trackInput"
              rows="3"
              placeholder="Paste one link per line"
              autocomplete="off"
            ></textarea>
            <div class="button-row">
              <button class="btn" type="submit">Play first + queue all</button>
              <button class="btn btn--ghost" type="button" @click="addUrls(false)">Add to queue</button>
            </div>
            <p v-if="formError" class="field-error">{{ formError }}</p>
            <p class="hint">
              Songs, playlists and albums all work. Everyone in the room hears the same moment of the
              same track.
            </p>
          </form>

          <section v-if="trackQueue.length" class="card sketch-frame">
            <div class="queue-heading">
              <div>
                <p class="eyebrow">{{ isHost ? 'Up next' : 'Coming up' }}</p>
                <h3>Room queue <span>{{ trackQueue.length }}</span></h3>
              </div>
              <div v-if="isHost" class="queue-controls">
                <button class="btn btn--ghost btn--compact" type="button" :disabled="activeQueueIndex <= 0" @click="playPrevious">Previous</button>
                <button class="btn btn--ghost btn--compact" type="button" :disabled="activeQueueIndex < 0 || activeQueueIndex >= trackQueue.length - 1" @click="playNext">Next</button>
                <button class="quiet-button" type="button" @click="clearQueue">Clear</button>
              </div>
            </div>
            <ol class="queue-list">
              <li v-for="(url, index) in trackQueue" :key="url" :class="{ active: index === activeQueueIndex }">
                <component
                  :is="isHost ? 'button' : 'div'"
                  class="queue-play"
                  :type="isHost ? 'button' : undefined"
                  @click="isHost && playQueueItem(index)"
                >
                  <span class="queue-index">{{ index === activeQueueIndex ? '▶' : index + 1 }}</span>
                  <span class="queue-text">
                    <strong>{{ urlLabel(url) }}</strong>
                    <small>
                      <ProviderLogo
                        v-if="providerBadge(url)"
                        :logo="providerBadge(url).logo"
                        :label="providerBadge(url).label"
                        :size="15"
                      />
                      {{ providerBadge(url)?.label }}
                      · {{ isSetUrl(url) ? 'Playlist or album' : 'Single track' }}
                    </small>
                  </span>
                </component>
                <button
                  v-if="isHost"
                  class="queue-remove"
                  type="button"
                  :aria-label="`Remove ${urlLabel(url)} from queue`"
                  @click="removeQueueItem(index)"
                >
                  ×
                </button>
              </li>
            </ol>
          </section>

          <PressPlayCard v-if="playerUrl && !selfListening" :hosting="isHost" />

          <section v-if="playerUrl" class="card sketch-frame-2 player-card">
            <RoomPlayer
              :key="`${playerProvider}-${playerKey}`"
              ref="player"
              :initial-url="playerUrl"
              :auto-play="pendingAutoplay"
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
              <button v-if="!isHost" class="btn btn--ghost btn--compact" type="button" :disabled="resyncing" @click="resyncNow">
                {{ resyncing ? 'Syncing…' : 'Sync now' }}
              </button>
            </div>
            <p v-if="!isHost" class="hint">The host controls playback. You stay in sync automatically.</p>
          </section>

          <p v-else-if="!isHost" class="muted">Tuned in. Music starts when the host plays something.</p>

          <div v-if="playerError" class="notice notice--error split-notice">
            <span>{{ playerError }}</span>
            <button class="btn btn--ghost btn--compact" type="button" @click="retryPlayer">Retry player</button>
          </div>
        </div>

        <aside class="stack side-column">
          <MemberList :members="members" />
          <ChatPanel
            :messages="chat"
            :members="members"
            :receipts="receipts"
            :my-id="myId"
            :connected="status === 'connected'"
            :typing-label="typingIndicator"
            @send="sendChat"
            @sticker="sendSticker"
            @typing="(typing) => connection?.sendTyping(typing)"
          />
        </aside>
      </div>
    </template>

    <p v-else class="muted">Loading room…</p>
  </main>
</template>
