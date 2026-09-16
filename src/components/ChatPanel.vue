<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AvatarMark from './AvatarMark.vue'
import StickerMark from './StickerMark.vue'
import { EMOJI_GROUPS } from '../emoji'
import { STICKERS } from '../stickers'
import { RECEIPT_LABELS, receiptState } from '../receipts'
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
  messages: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  receipts: { type: Object, default: () => ({}) },
  myId: { type: String, default: '' },
  connected: { type: Boolean, default: false },
  typingLabel: { type: String, default: '' },
})
const emit = defineEmits(['send', 'sticker', 'typing'])

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

onBeforeUnmount(stopTyping)

const text = ref('')
const list = ref(null)
const tray = ref('') // '', 'emoji' or 'stickers'
const notifyError = ref('')

watch(() => props.messages.length, scrollToBottom)

async function scrollToBottom() {
  await nextTick()
  if (list.value) list.value.scrollTop = list.value.scrollHeight
}

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

const ticksFor = (message) =>
  receiptState(message, { receipts: props.receipts, members: props.members, myId: props.myId })

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
      <li v-for="message in messages" :key="message.id" class="chat-message">
        <AvatarMark :id="message.avatarId" :size="30" flat />
        <div class="chat-body">
          <p class="chat-meta">
            <strong :class="{ 'is-host': message.host }">{{ message.author }}</strong>
            <span v-if="message.host" class="badge">host</span>
          </p>
          <StickerMark v-if="message.kind === 'STICKER'" :id="message.stickerId" :size="64" />
          <p v-else class="chat-text">{{ message.text }}</p>
        </div>

        <span
          v-if="ticksFor(message)"
          class="ticks"
          :class="`ticks--${ticksFor(message)}`"
          :title="RECEIPT_LABELS[ticksFor(message)]"
          :aria-label="RECEIPT_LABELS[ticksFor(message)]"
        >
          <svg viewBox="0 0 18 12" aria-hidden="true">
            <path d="m1 6.4 3.1 3.3L10.6 2.4" />
            <path v-if="ticksFor(message) !== 'sent'" d="m6.6 6.4 3.1 3.3L16.2 2.4" />
          </svg>
        </span>
      </li>
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
        </div>
        <button class="btn btn--compact" type="submit" :disabled="!connected">Send</button>
      </div>
    </form>
  </section>
</template>
