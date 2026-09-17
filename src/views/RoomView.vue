<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarMark from '../components/AvatarMark.vue'
import ChatPanel from '../components/ChatPanel.vue'
import JoinGate from '../components/JoinGate.vue'
import MemberList from '../components/MemberList.vue'
import RoomLockGate from '../components/RoomLockGate.vue'
import PressPlayCard from '../components/PressPlayCard.vue'
import RoomPlayer from '../components/RoomPlayer.vue'
import { api, clearHostToken, getHostToken, setRoomKey } from '../api'
import { getIdentity, hasJoinedBefore, rememberJoined, setIdentity } from '../identity'
import { looksLikeSeek, selectLatestPlayback } from '../playback'
import { notifyChatMessage } from '../notifications'
import { latestServerTime } from '../receipts'
import { applyReactionUpdate } from '../reactions'
import {
  attachmentKind,
  releaseAttachments,
  seedAttachment,
  shrinkImage,
  uploadAttachment,
} from '../attachments'
import { applyTyping, pruneTyping, typingLabel, typingNames } from '../typing'
import { failMessage, mergeChatMessages, newClientId, pendingMessage, withProgress } from '../roomState'
import { connectToRoom } from '../stomp'
import ProviderLogo from '../components/ProviderLogo.vue'
import { detectProvider, isSetUrl, isSupportedUrl, parseUrls, providerBadge, urlLabel } from '../providers'
import { largeArtwork } from '../soundcloud'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const DRIFT_MS = 2500 // listeners re-seek when further than this from the host
const SYNC_INTERVAL_MS = 3000 // how often listeners check their drift
const HEARTBEAT_MS = 5000 // how often the host re-broadcasts its position
const AUTOPLAY_CHECK_MS = 900 // how long to give the player before calling autoplay blocked
const RECEIPT_DEBOUNCE_MS = 350 // one acknowledgement for a burst of messages, not one each
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
const reactions = ref({})
const typingPeople = ref({})
let clockOffset = 0 // client clock minus server clock

// The host named themselves when they made the room; guests pick a name and face at the door.
const identity = ref(getIdentity())
/**
 * The door is asked once. Coming back to a room this browser has already walked into — a reload,
 * a reopened tab — goes straight back inside, with the same name, face and unlocked key.
 */
const joined = ref(isHost || (hasJoinedBefore(props.id) && Boolean(identity.value.name)))
// A private room answers with a locked summary until its password has been answered.
const locked = ref(false)
const unlocking = ref(false)
const unlockError = ref('')
const myId = identity.value.memberId
/** Whether *our* audio is actually running: present in the room is not the same as listening. */
const selfListening = ref(false)
/** Set when the browser refused to start the music by itself, which needs one tap to undo. */
const autoplayBlocked = ref(false)

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
const queueNote = ref('')
const trackQueue = ref([])
const activeQueueIndex = ref(-1)
let pendingAutoplay = false
let pendingTrackUrl = ''
/** A track the host asked to play before the server had it in the queue. */
let pendingActiveUrl = ''
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
let queueNoteTimer = null
let typingTimer = null
let autoplayCheckTimer = null
let receiptTimer = null

const isChatRoom = computed(() => room.value?.kind === 'CHAT')
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

onMounted(async () => {
  try {
    const data = await api.getRoom(props.id)
    if (data.locked) {
      room.value = data
      locked.value = true
      return
    }
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
  if (joined.value) start()
})

onBeforeUnmount(teardown)

function applySnapshot(data) {
  room.value = data
  members.value = data.members || []
  playback.value = selectLatestPlayback(playback.value, data.playback)
  chat.value = mergeChatMessages(chat.value, data.chat, MAX_CHAT)
  receipts.value = data.receipts && typeof data.receipts === 'object' ? data.receipts : {}
  reactions.value = data.reactions && typeof data.reactions === 'object' ? data.reactions : {}
  applyQueueState(data.queue)
}

/** A link chosen on the home page before the room existed. */
function restoreQueuedSource() {
  try {
    const queued = JSON.parse(window.sessionStorage.getItem('soundstream:queued-source'))
    window.sessionStorage.removeItem('soundstream:queued-source')
    if (queued?.permalinkUrl && isSupportedUrl(queued.permalinkUrl)) {
      pendingActiveUrl = queued.permalinkUrl
      pendingAutoplay = true
      // Chosen deliberately on the home page, so the room announces it even if the embed
      // refuses to start on its own.
      hostStarted = true
      showInPlayer(queued.permalinkUrl)
    }
  } catch {
    // Ignore unavailable or malformed session storage.
  }
}

async function unlockRoom(password) {
  unlocking.value = true
  unlockError.value = ''
  try {
    const { accessKey } = await api.unlockRoom(props.id, password)
    // Kept for this browser, so the password is asked once and not again on every reload.
    setRoomKey(props.id, accessKey)
    const data = await api.getRoom(props.id)
    if (data.locked) {
      unlockError.value = 'That password does not open this room.'
      return
    }
    locked.value = false
    applySnapshot(data)
    clockOffset = Date.now() - data.serverNow
    if (joined.value) start()
  } catch (e) {
    unlockError.value = e.message
  } finally {
    unlocking.value = false
  }
}

function joinRoom(chosen) {
  // Keep the stable member id: the gate only chooses a name and a face.
  identity.value = { ...identity.value, ...chosen }
  setIdentity(chosen)
  rememberJoined(props.id)
  joined.value = true
  start()
}

function start() {
  document.addEventListener('visibilitychange', onVisibilityChange)
  // Audio that the browser refused to start on its own is started by the first real tap.
  document.addEventListener('pointerdown', onUserGesture)
  document.addEventListener('keydown', onUserGesture)
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
          // A link carried in from the home page only reaches the queue once we are connected.
          if (pendingActiveUrl) connection?.addQueueTrack(pendingActiveUrl)
          broadcastState()
        } else {
          refreshPlaybackState()
        }
      },
      onError: (message) => (realtimeError.value = message),
      onPlayback: (state) => {
        // A jump is followed exactly; ordinary playing is left to the drift check.
        const seeked = looksLikeSeek(playback.value, state)
        playback.value = state
        syncToHost(seeked)
      },
      onQueue: applyQueueState,
      onMembers: (list) => (members.value = Array.isArray(list) ? list : []),
      onReceipts: (map) => (receipts.value = map && typeof map === 'object' ? map : {}),
      onReactions: (update) => (reactions.value = applyReactionUpdate(reactions.value, update)),
      onTyping: (notice) => (typingPeople.value = applyTyping(typingPeople.value, notice)),
      onChat: (message) => {
        chat.value = mergeChatMessages(chat.value, [message], MAX_CHAT)
        notifyChatMessage(message, { roomName: room.value?.name, myId })
        acknowledgeChat()
      },
      onClosed: (payload) => {
        closed.value = true
        closedReason.value = payload?.reason === 'host' ? 'host' : 'abandoned'
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

  if (!isChatRoom.value) {
    timer = isHost ? setInterval(broadcastState, HEARTBEAT_MS) : setInterval(syncToHost, SYNC_INTERVAL_MS)
  }
  // Indicators expire here rather than on the server, so a lost "stopped typing" self-heals.
  typingTimer = setInterval(() => (typingPeople.value = pruneTyping(typingPeople.value)), 1500)
  // Coming back to a room this browser already knows counts as having walked in.
  if (joined.value) rememberJoined(props.id)
}

function teardown() {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('pointerdown', onUserGesture)
  document.removeEventListener('keydown', onUserGesture)
  clearInterval(timer)
  clearInterval(typingTimer)
  clearTimeout(broadcastRetryTimer)
  clearTimeout(inviteFeedbackTimer)
  clearTimeout(queueNoteTimer)
  clearTimeout(autoplayCheckTimer)
  clearTimeout(receiptTimer)
  broadcastQueued = false
  connection?.disconnect()
  connection = null
  // Let go of the voice notes and files this page had downloaded; the room still has them.
  releaseAttachments()
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
    checkAutoplay()
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
  if (type === 'play') {
    setListening(true)
    autoplayBlocked.value = false
  }
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

/**
 * Browsers refuse to start audio that nobody asked for. We try anyway — a tap on the join door
 * usually counts — and only if the player is still silent do we ask for the one tap.
 */
function checkAutoplay() {
  clearTimeout(autoplayCheckTimer)
  autoplayCheckTimer = setTimeout(async () => {
    if (!player.value || !playerReady.value) return
    const wanted = isHost ? hostStarted : Boolean(playback.value?.playing)
    if (!wanted) return
    const paused = await player.value.isPaused()
    autoplayBlocked.value = paused === true
  }, AUTOPLAY_CHECK_MS)
}

/** A real tap or key press unlocks audio; spend it on the music that was refused. */
function onUserGesture() {
  if (!autoplayBlocked.value) return
  if (isHost) player.value?.play()
  else syncToHost(true)
  checkAutoplay()
}

// ---- Queue ----

/**
 * Adding is open to the room: anyone can put a track on the end, and the server does the
 * appending so two people adding at once cannot overwrite each other. Removing, reordering and
 * choosing what plays stay with the host.
 */
function addUrls(playFirst) {
  const urls = parseUrls(trackInput.value)
  if (!urls.length) {
    formError.value = 'Paste at least one SoundCloud or YouTube link.'
    return
  }
  const invalidIndex = urls.findIndex((url) => !isSupportedUrl(url))
  if (invalidIndex >= 0) {
    formError.value = `Link ${invalidIndex + 1} isn’t a SoundCloud or YouTube link.`
    return
  }
  if (status.value !== 'connected') {
    formError.value = 'Not connected to the room yet — try again in a moment.'
    return
  }
  formError.value = ''
  urls.forEach((url) => connection?.addQueueTrack(url))
  trackInput.value = ''

  if (isHost && playFirst) {
    pendingActiveUrl = urls[0]
    loadSource(urls[0])
    return
  }
  showQueueNote(urls.length === 1 ? 'Added to the queue' : `${urls.length} tracks added to the queue`)
}

function showQueueNote(message) {
  queueNote.value = message
  clearTimeout(queueNoteTimer)
  queueNoteTimer = setTimeout(() => (queueNote.value = ''), 2500)
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
  checkAutoplay()
}

function playQueueItem(index) {
  const url = trackQueue.value[index]
  if (!url || !isHost) return
  activeQueueIndex.value = index
  publishQueue()
  loadSource(url)
}

function playNext() {
  if (activeQueueIndex.value < trackQueue.value.length - 1) playQueueItem(activeQueueIndex.value + 1)
}

function playPrevious() {
  if (activeQueueIndex.value > 0) playQueueItem(activeQueueIndex.value - 1)
}

/** Host only, and the server checks the token again rather than trusting this. */
function removeQueueItem(index) {
  if (!isHost) return
  trackQueue.value.splice(index, 1)
  if (index < activeQueueIndex.value) activeQueueIndex.value -= 1
  else if (index === activeQueueIndex.value) activeQueueIndex.value = -1
  publishQueue()
}

function clearQueue() {
  if (!isHost) return
  trackQueue.value = []
  activeQueueIndex.value = -1
  publishQueue()
}

function publishQueue() {
  if (!isHost || !connection) return
  connection.publishQueue({
    hostToken,
    trackUrls: [...trackQueue.value],
    activeIndex: activeQueueIndex.value,
  })
}

/** The server owns the queue; every browser, the host's included, draws what it sends back. */
function applyQueueState(state) {
  if (!state || state.serverTime < queueServerTime) return
  queueServerTime = state.serverTime
  trackQueue.value = Array.isArray(state.trackUrls) ? [...state.trackUrls] : []
  activeQueueIndex.value = Number.isInteger(state.activeIndex) ? state.activeIndex : -1

  // A track the host started before the server had it: mark it as the one playing.
  if (isHost && pendingActiveUrl) {
    const index = trackQueue.value.indexOf(pendingActiveUrl)
    if (index >= 0) {
      pendingActiveUrl = ''
      activeQueueIndex.value = index
      publishQueue()
    }
  }
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
  if (!window.confirm(isChatRoom.value ? 'Close this room for everyone?' : 'End the stream for everyone?')) {
    return
  }
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

/**
 * Follows the host: same track, same play or pause, same moment. Nobody has to press anything —
 * a listener's player is loaded already playing, and only a browser that refuses autoplay asks
 * for a tap.
 */
async function syncToHost(force = false) {
  const state = playback.value
  if (isHost || !joined.value || !state?.trackUrl || syncing) return

  // A different service means a different embed; remount rather than cross-load.
  if (!playerUrl.value || detectProvider(state.trackUrl) !== playerProvider.value) {
    showInPlayer(state.trackUrl, { autoPlay: state.playing })
    checkAutoplay()
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
    if (state.playing && paused) {
      player.value.play()
      checkAutoplay()
    } else if (!state.playing && !paused) {
      player.value.pause()
    }

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

/**
 * Sending, without the wait.
 *
 * The room's server can be most of a second away, and publishing and then waiting for the message
 * to come back before drawing it is what makes a chat feel slow. Each message is drawn the moment
 * it is sent, carrying an id of this browser's own; the server echoes that id back, and the copy
 * that returns takes the place of the one already on screen.
 */
function ownMessage(extra) {
  return pendingMessage({
    clientId: newClientId(),
    memberId: myId,
    author: (isHost ? room.value?.hostName : identity.value.name) || identity.value.name || 'You',
    avatarId: (isHost ? room.value?.hostAvatarId : identity.value.avatarId) || identity.value.avatarId,
    host: isHost,
    ...extra,
  })
}

function show(message) {
  chat.value = mergeChatMessages(chat.value, [message], MAX_CHAT)
  return message.clientId
}

function sendChat(text) {
  const clientId = show(ownMessage({ text }))
  connection?.sendChat({ hostToken, text, clientId })
}

function sendSticker(stickerId) {
  const clientId = show(ownMessage({ kind: 'STICKER', stickerId }))
  connection?.sendSticker({ hostToken, stickerId, clientId })
}

/**
 * A voice note, video note or file: on screen and playable from this browser's own copy while it
 * is still going up, and never downloaded back again once it lands.
 */
async function sendAttachment({ file, kind, durationMs = 0, text = '' }) {
  const message = ownMessage({
    kind: 'ATTACHMENT',
    text,
    attachment: {
      id: '',
      name: file.name,
      contentType: file.type,
      size: file.size,
      kind: attachmentKind(file, { recorded: kind }),
      durationMs,
      localUrl: URL.createObjectURL(file),
    },
  })
  show(message)

  // The bar only moves in steps: a progress event every few milliseconds would redraw the chat
  // more often than anyone can see.
  let shown = 0
  const onProgress = (fraction) => {
    if (fraction < 1 && fraction - shown < 0.05) return
    shown = fraction
    chat.value = withProgress(chat.value, message.clientId, fraction)
  }

  try {
    // A photo off a phone is megabytes of detail a chat bubble will never show.
    const sending = await shrinkImage(file)
    const attachment = await uploadAttachment(props.id, sending, {
      kind,
      memberId: myId,
      durationMs,
      onProgress,
    })
    seedAttachment(props.id, attachment.id, sending)
    connection?.sendAttachment({ hostToken, attachmentId: attachment.id, text, clientId: message.clientId })
  } catch (e) {
    chat.value = failMessage(chat.value, message.clientId)
    realtimeError.value = e.message
  }
}
const reactToMessage = (messageId, emoji) => connection?.sendReaction(messageId, emoji)

/**
 * Tells the room how far we have got through the chat. Reading the newest message implies
 * reading every message before it, so one timestamp is enough to draw ticks for the whole history.
 * A hidden tab has received but not read them.
 */
/**
 * Acknowledged in one go rather than per message: every receipt is broadcast to the whole room,
 * so a burst of arrivals would otherwise cost everyone a round of traffic each.
 */
function acknowledgeChat() {
  clearTimeout(receiptTimer)
  receiptTimer = setTimeout(() => {
    const through = latestServerTime(chat.value)
    if (!through || !connection) return
    connection.sendReceipt({ read: !document.hidden, throughServerTime: through })
  }, RECEIPT_DEBOUNCE_MS)
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
      <h2>{{ closedReason === 'host' ? 'The host closed this room' : 'This room was removed' }}</h2>
      <p class="muted">
        {{
          closedReason === 'host'
            ? 'Thanks for listening. The host ended it for everyone.'
            : 'Nobody had been in it for a very long time.'
        }}
      </p>
      <RouterLink class="btn" to="/">Find another stream</RouterLink>
    </div>

    <template v-else-if="room">
      <header class="room-header">
        <div class="room-title">
          <p class="eyebrow">
            <span v-if="!locked" class="live-dot" :class="`live-dot--${status}`"></span>
            {{
              locked
                ? 'Private room'
                : isHost
                  ? 'You are hosting'
                  : isChatRoom
                    ? 'In the chat room'
                    : 'Listening along'
            }}
          </p>
          <h1>{{ room.name }}</h1>
          <div class="meta">
            <span class="host-chip">
              <AvatarMark :id="room.hostAvatarId" :size="26" flat />
              {{ room.hostName }}
            </span>
            <template v-if="!locked">
              <span class="pill" :class="`pill--${status}`">{{ statusLabel }}</span>
              <span>{{ members.length }} in the room</span>
            </template>
            <span v-if="isChatRoom" class="pill">Chat only</span>
            <span v-if="room.privateRoom" class="pill">Private</span>
            <span>Code <strong class="mono">{{ room.id }}</strong></span>
          </div>
        </div>
        <div class="actions">
          <button v-if="!locked" class="btn btn--ghost" type="button" @click="shareInvite">{{ inviteButtonLabel }}</button>
          <button v-if="isHost" class="btn btn--danger" type="button" @click="endStream">
            {{ isChatRoom ? 'Close room' : 'End stream' }}
          </button>
          <RouterLink v-else class="btn btn--ghost" to="/">Leave</RouterLink>
        </div>
      </header>

      <p v-if="error" class="notice notice--error">{{ error }}</p>
      <div v-if="realtimeError" class="notice notice--error split-notice" role="alert">
        <span>{{ realtimeError }}</span>
        <button class="btn btn--ghost btn--compact" type="button" @click="retryConnection">Reconnect now</button>
      </div>

      <RoomLockGate
        v-if="locked"
        :room-name="room.name"
        :host-name="room.hostName"
        :host-avatar-id="room.hostAvatarId"
        :error="unlockError"
        :checking="unlocking"
        @unlock="unlockRoom"
      />

      <JoinGate
        v-else-if="!joined"
        :room-name="room.name"
        :host-name="room.hostName"
        :chat-only="isChatRoom"
        @join="joinRoom"
      />

      <div v-else class="room-grid" :class="{ 'room-grid--chat': isChatRoom }">
        <div v-if="!isChatRoom" class="stack">
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

          <form class="card sketch-frame-2" @submit.prevent="addUrls(isHost)">
            <label for="track-url">SoundCloud or YouTube links</label>
            <textarea
              id="track-url"
              v-model="trackInput"
              rows="3"
              placeholder="Paste one link per line"
              autocomplete="off"
            ></textarea>
            <div class="button-row">
              <button v-if="isHost" class="btn" type="submit">Play first + queue all</button>
              <button v-else class="btn" type="submit">Add to queue</button>
              <button v-if="isHost" class="btn btn--ghost" type="button" @click="addUrls(false)">
                Add to queue
              </button>
            </div>
            <p v-if="formError" class="field-error">{{ formError }}</p>
            <p v-if="queueNote" class="field-note">{{ queueNote }}</p>
            <p class="hint">
              {{
                isHost
                  ? 'Songs, playlists and albums all work. Everyone in the room hears the same moment of the same track.'
                  : 'Anyone can add to the queue. The host chooses what plays and what comes off it.'
              }}
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

          <PressPlayCard v-if="playerUrl && autoplayBlocked" :hosting="isHost" />

          <section
            v-if="playerUrl"
            class="card sketch-frame-2 player-card"
            :class="{ 'player-card--set': isSetUrl(playerUrl) }"
          >
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
            <p v-if="!isHost" class="hint">The host controls playback. You follow automatically.</p>
          </section>

          <p v-else-if="!isHost" class="muted">Tuned in. Music starts when the host plays something.</p>

          <div v-if="playerError" class="notice notice--error split-notice">
            <span>{{ playerError }}</span>
            <button class="btn btn--ghost btn--compact" type="button" @click="retryPlayer">Retry player</button>
          </div>
        </div>

        <aside class="stack side-column">
          <MemberList :members="members" :chat-only="isChatRoom" />
          <ChatPanel
            :room-id="id"
            :messages="chat"
            :members="members"
            :receipts="receipts"
            :reactions="reactions"
            :my-id="myId"
            :connected="status === 'connected'"
            :typing-label="typingIndicator"
            @send="sendChat"
            @sticker="sendSticker"
            @attachment="sendAttachment"
            @react="reactToMessage"
            @typing="(typing) => connection?.sendTyping(typing)"
          />
        </aside>
      </div>
    </template>

    <p v-else class="muted">Loading room…</p>
  </main>
</template>
