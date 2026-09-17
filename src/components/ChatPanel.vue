<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ChatMessages from './ChatMessages.vue'
import StickerMark from './StickerMark.vue'
import { EMOJI_GROUPS } from '../emoji'
import { STICKERS } from '../stickers'
import { RECEIPT_LABELS, receiptStateFrom, receiptThresholds } from '../receipts'
import { summariseReactions } from '../reactions'
import { continuesBlock, dayLabel, messageTime, startsNewDay } from '../chatTime'
import { attachmentKind } from '../attachments'
import { recordingSupported, startRecording } from '../recorder'
import {
  disableNotifications,
  enableNotifications,
  notificationsEnabled,
  notificationsSupported,
} from '../notifications'

/**
 * Room chat. Names and faces come from the member who joined, so there is no name field here —
 * the server attributes every message from the sender's own session.
 */
const props = defineProps({
  roomId: { type: String, required: true },
  messages: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  receipts: { type: Object, default: () => ({}) },
  reactions: { type: Object, default: () => ({}) },
  myId: { type: String, default: '' },
  connected: { type: Boolean, default: false },
  typingLabel: { type: String, default: '' },
})
const emit = defineEmits(['send', 'sticker', 'typing', 'react', 'attachment'])
/** Uploading belongs to the room, which can draw the message while it is still going up. */

/*
 * Typing is announced at most every couple of seconds, and withdrawn once the keys stop, so a
 * long message is one or two little messages rather than one per keystroke.
 */
const TYPING_REPEAT_MS = 2000
const TYPING_IDLE_MS = 2500
let typingSentAt = 0
let typingStopTimer = null

function onTyping() {
  const now = Date.now()
  if (now - typingSentAt > TYPING_REPEAT_MS) {
    emit('typing', true)
    typingSentAt = now
  }
  clearTimeout(typingStopTimer)
  typingStopTimer = setTimeout(stopTyping, TYPING_IDLE_MS)
}

function stopTyping() {
  clearTimeout(typingStopTimer)
  if (typingSentAt) emit('typing', false)
  typingSentAt = 0
}

const text = ref('')
const list = ref(null)
const tray = ref('') // '', 'emoji' or 'stickers'
const notifyError = ref('')

// ---- Voice notes, video notes and files ----
const fileInput = ref(null)
const attachError = ref('')
const canRecord = recordingSupported()
/** The recording in progress, if any: 'VOICE' or 'VIDEO_NOTE'. */
const recordingKind = ref('')
const recordedSeconds = ref(0)
const preview = ref(null) // the camera, so a video note is not recorded blind
let recording = null
let recordingTimer = null

/** A recording cannot run for ever; at three minutes it sends itself. */
const MAX_RECORDING_MS = 180_000

async function beginRecording(kind) {
  if (recordingKind.value) return
  attachError.value = ''
  try {
    recording = await startRecording({ video: kind === 'VIDEO_NOTE' })
    recordingKind.value = kind
    recordedSeconds.value = 0
    await nextTick()
    if (preview.value) {
      preview.value.srcObject = recording.stream
      preview.value.play?.().catch(() => {})
    }
    recordingTimer = setInterval(() => {
      recordedSeconds.value = Math.round((Date.now() - recording.startedAt) / 1000)
      if (recordedSeconds.value * 1000 >= MAX_RECORDING_MS) finishRecording()
    }, 250)
  } catch (e) {
    recording = null
    attachError.value =
      e?.name === 'NotAllowedError'
        ? `Your browser is blocking the ${kind === 'VIDEO_NOTE' ? 'camera' : 'microphone'} for this site.`
        : 'That recording could not be started.'
  }
}

function stopTimer() {
  clearInterval(recordingTimer)
  recordingTimer = null
}

function cancelRecording() {
  stopTimer()
  recording?.cancel()
  recording = null
  recordingKind.value = ''
}

async function finishRecording() {
  if (!recording) return
  const kind = recordingKind.value
  stopTimer()
  const current = recording
  recording = null
  recordingKind.value = ''
  try {
    const { file, durationMs } = await current.stop()
    // A tap that never became a recording is nothing to send.
    if (file.size > 0 && durationMs > 400) sendFile(file, kind, durationMs)
  } catch {
    attachError.value = 'That recording could not be saved.'
  }
}

function onFilesChosen(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  files.forEach((file) => sendFile(file, attachmentKind(file)))
}

/**
 * Hands the file to the room, which shows it immediately and uploads it behind the scenes.
 * Waiting here for the upload before drawing anything is what made sending a voice note feel
 * like nothing had happened.
 */
function sendFile(file, kind, durationMs = 0) {
  attachError.value = ''
  emit('attachment', { file, kind, durationMs, text: text.value.trim() })
  text.value = ''
  tray.value = ''
}

const recordingLabel = computed(() => {
  const seconds = recordedSeconds.value
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

/**
 * The chat as it is drawn: a date divider where the day turns over, one block per run of messages
 * from the same person, and the ticks and reactions each message needs.
 *
 * All of it is worked out here, once, rather than in the template — which asked for the same ticks
 * five times per message, every time anything on the page changed, typing included.
 */
const rows = computed(() => {
  const thresholds = receiptThresholds({
    receipts: props.receipts,
    members: props.members,
    myId: props.myId,
  })
  return props.messages.map((message, index) => {
    const previous = props.messages[index - 1]
    const newDay = startsNewDay(message, previous)
    const ticks = receiptStateFrom(message, thresholds, props.myId)
    return {
      key: message.clientId ? `${message.memberId}:${message.clientId}` : message.id,
      message,
      divider: newDay ? dayLabel(message.serverTime) : '',
      grouped: continuesBlock(message, previous) && !newDay,
      time: messageTime(message.serverTime),
      iso: message.serverTime ? new Date(message.serverTime).toISOString() : '',
      ticks,
      tickLabel: ticks ? RECEIPT_LABELS[ticks] : '',
      reactions: summariseReactions(props.reactions, message.id, props.myId),
    }
  })
})

// Watching the rows, not just how many there are: a message confirmed, a reaction added or a
// voice note settling all change the height of the list without changing its length.
watch(rows, keepUpWithTheChat)

/** Within this much of the end counts as "reading the newest", not reading back through history. */
const NEAR_BOTTOM_PX = 80

const atBottom = () =>
  !list.value || list.value.scrollHeight - list.value.scrollTop - list.value.clientHeight < NEAR_BOTTOM_PX

const pin = () => {
  if (list.value) list.value.scrollTop = list.value.scrollHeight
}

/** Whether the view has been put on the newest message yet; a fresh list opens at the top. */
let following = false

/**
 * Follows the conversation, without dragging you away from what you were reading.
 *
 * Opening a room lands on the newest message; after that it only keeps up while you are already
 * at the end, so a message arriving mid-scroll does not yank you out of the history.
 *
 * Pinned twice: once as the message is added, and again on the next frame, because a voice note
 * or a row of ticks settles into its height a moment after it first appears — which used to leave
 * the newest message just off the bottom edge.
 */
async function keepUpWithTheChat() {
  const follow = !following || atBottom()
  await nextTick()
  if (!follow) return
  following = true
  pin()
  requestAnimationFrame(pin)
}

onMounted(keepUpWithTheChat)



function send() {
  const body = text.value.trim()
  if (!body) return
  emit('send', body)
  text.value = ''
  tray.value = ''
  stopTyping()
}

function addEmoji(emoji) {
  text.value = `${text.value}${emoji}`.slice(0, 500)
}

function sendSticker(id) {
  emit('sticker', id)
  tray.value = ''
}

const toggleTray = (name) => (tray.value = tray.value === name ? '' : name)

/*
 * A named handler, not an inline arrow: a fresh function on every render is a changed prop, and
 * the message list would redraw itself on every letter typed into the box below it.
 */
const onReact = (messageId, emoji) => emit('react', messageId, emoji)

onBeforeUnmount(() => {
  stopTyping()
  cancelRecording()
})

const notifyLabel = computed(() =>
  notificationsEnabled.value ? 'Message notifications on' : 'Notify me about new messages',
)

async function toggleNotifications() {
  notifyError.value = ''
  if (notificationsEnabled.value) {
    disableNotifications()
    return
  }
  const result = await enableNotifications()
  if (result === 'denied') notifyError.value = 'Your browser is blocking notifications for this site.'
  if (result === 'unsupported') notifyError.value = 'This browser can’t show notifications.'
}
</script>

<template>
  <section class="card chat sketch-frame">
    <div class="chat-head">
      <h3>Chat</h3>
      <button
        v-if="notificationsSupported"
        class="tool-button"
        type="button"
        :class="{ active: notificationsEnabled }"
        :aria-pressed="notificationsEnabled"
        :title="notifyLabel"
        :aria-label="notifyLabel"
        @click="toggleNotifications"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
          <path d="M13.7 20a2 2 0 0 1-3.4 0" />
          <path v-if="!notificationsEnabled" d="M4 4l16 16" />
        </svg>
      </button>
    </div>
    <p v-if="notifyError" class="field-error">{{ notifyError }}</p>

    <ul ref="list" class="chat-list">
      <li v-if="!messages.length" class="muted chat-empty">No messages yet. Say hi.</li>
      <ChatMessages :room-id="roomId" :rows="rows" @react="onReact" />
    </ul>

    <div v-if="tray === 'emoji'" class="tray">
      <div v-for="group in EMOJI_GROUPS" :key="group.label" class="tray-group">
        <p class="tray-label">{{ group.label }}</p>
        <div class="tray-items">
          <button
            v-for="emoji in group.emoji"
            :key="emoji"
            class="emoji-button"
            type="button"
            @click="addEmoji(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="tray === 'stickers'" class="tray">
      <div class="tray-items tray-items--stickers">
        <button
          v-for="sticker in STICKERS"
          :key="sticker.id"
          class="sticker-button"
          type="button"
          :title="sticker.label"
          @click="sendSticker(sticker.id)"
        >
          <StickerMark :id="sticker.id" :size="40" />
        </button>
      </div>
    </div>

    <p v-if="typingLabel" class="typing-note" aria-live="polite">
      <span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      {{ typingLabel }}
    </p>

    <div v-if="recordingKind" class="recording-bar" role="status">
      <video v-if="recordingKind === 'VIDEO_NOTE'" ref="preview" class="recording-preview" muted playsinline></video>
      <span class="recording-dot" aria-hidden="true"></span>
      <span class="recording-time">{{ recordingLabel }}</span>
      <span class="muted">{{ recordingKind === 'VIDEO_NOTE' ? 'Recording a video note' : 'Recording a voice note' }}</span>
      <button class="quiet-button" type="button" @click="cancelRecording">Cancel</button>
      <button class="btn btn--compact" type="button" @click="finishRecording">Send</button>
    </div>

    <p v-if="attachError" class="field-error">{{ attachError }}</p>

    <!-- Input on its own row: squeezed between the tools and Send it cropped its own placeholder. -->
    <form class="chat-form" @submit.prevent="send">
      <input
        v-model="text"
        placeholder="Message"
        maxlength="500"
        aria-label="Message the room"
        @input="onTyping"
        @blur="stopTyping"
        @keydown.enter.prevent="send"
      />
      <div class="chat-actions">
        <div class="chat-tools">
          <button
            class="tool-button"
            type="button"
            :class="{ active: tray === 'emoji' }"
            aria-label="Emoji"
            @click="toggleTray('emoji')"
          >
            🙂
          </button>
          <button
            class="tool-button"
            type="button"
            :class="{ active: tray === 'stickers' }"
            aria-label="Stickers"
            @click="toggleTray('stickers')"
          >
            <StickerMark id="star" :size="20" />
          </button>

          <!-- Anything at all: a photo, a video, a document. -->
          <button
            class="tool-button"
            type="button"
            aria-label="Attach a file"
            title="Attach a file"
            @click="fileInput?.click()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 5 5l-8 8a1.8 1.8 0 0 1-2.5-2.5l7-7" />
            </svg>
          </button>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            multiple
            tabindex="-1"
            aria-hidden="true"
            @change="onFilesChosen"
          />

          <button
            v-if="canRecord"
            class="tool-button"
            type="button"
            :class="{ active: recordingKind === 'VOICE' }"
            aria-label="Record a voice note"
            title="Record a voice note"
            :disabled="Boolean(recordingKind)"
            @click="beginRecording('VOICE')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>

          <button
            v-if="canRecord"
            class="tool-button"
            type="button"
            :class="{ active: recordingKind === 'VIDEO_NOTE' }"
            aria-label="Record a video note"
            title="Record a video note"
            :disabled="Boolean(recordingKind)"
            @click="beginRecording('VIDEO_NOTE')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="6" width="13" height="12" rx="3" />
              <path d="m16 12 5-3v9l-5-3z" />
            </svg>
          </button>
        </div>
        <button class="btn btn--compact" type="submit" :disabled="!connected">Send</button>
      </div>
    </form>
  </section>
</template>
