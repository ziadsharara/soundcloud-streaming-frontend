<script setup>
import { nextTick, ref, watch } from 'vue'
import AvatarMark from './AvatarMark.vue'
import StickerMark from './StickerMark.vue'
import { EMOJI_GROUPS } from '../emoji'
import { STICKERS } from '../stickers'

/**
 * Room chat. Names and faces come from the member who joined, so there is no name field here —
 * the server attributes every message from the sender's own session.
 */
const props = defineProps({
  messages: { type: Array, default: () => [] },
  connected: { type: Boolean, default: false },
})
const emit = defineEmits(['send', 'sticker'])

const text = ref('')
const list = ref(null)
const tray = ref('') // '', 'emoji' or 'stickers'

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
}

function addEmoji(emoji) {
  text.value = `${text.value}${emoji}`.slice(0, 500)
}

function sendSticker(id) {
  emit('sticker', id)
  tray.value = ''
}

const toggleTray = (name) => (tray.value = tray.value === name ? '' : name)
</script>

<template>
  <section class="card chat sketch-frame">
    <h3>Chat</h3>

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

    <form class="chat-form" @submit.prevent="send">
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
      <input v-model="text" placeholder="Message the room" maxlength="500" />
      <button class="btn btn--compact" type="submit" :disabled="!connected">Send</button>
    </form>
  </section>
</template>
