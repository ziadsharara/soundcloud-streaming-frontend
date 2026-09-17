<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AvatarMark from './AvatarMark.vue'
import ChatAttachment from './ChatAttachment.vue'
import StickerMark from './StickerMark.vue'
import { REACTION_PALETTE } from '../reactions'

/**
 * The messages themselves, kept apart from the box you type in.
 *
 * Everything each message needs is worked out once, in the row handed to us, so drawing the chat
 * is only drawing. And because this is its own component, typing a letter re-renders the composer
 * and leaves a hundred messages alone.
 */
defineProps({
  roomId: { type: String, required: true },
  rows: { type: Array, default: () => [] },
})
const emit = defineEmits(['react'])

/** Which message has its reaction palette open; only ever one. */
const reactingTo = ref('')

const toggleReactionPalette = (messageId) =>
  (reactingTo.value = reactingTo.value === messageId ? '' : messageId)

function react(messageId, emoji) {
  emit('react', messageId, emoji)
  reactingTo.value = ''
}

/** A palette left open is closed by the next click anywhere else, or by Escape. */
function onDocumentPointerDown(event) {
  if (reactingTo.value && !event.target.closest?.('.react-anchor')) reactingTo.value = ''
}
const onDocumentKeydown = (event) => {
  if (event.key === 'Escape') reactingTo.value = ''
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <template v-for="row in rows" :key="row.key">
    <li v-if="row.divider" class="chat-day" role="separator">
      <span class="hand">{{ row.divider }}</span>
    </li>
    <li
      class="chat-message"
      :class="{ 'chat-message--grouped': row.grouped, 'chat-message--pending': row.message.pending }"
    >
      <AvatarMark v-if="!row.grouped" :id="row.message.avatarId" :size="30" flat />
      <span v-else class="chat-gutter" aria-hidden="true"></span>

      <div class="chat-body">
        <p v-if="!row.grouped" class="chat-meta">
          <strong :class="{ 'is-host': row.message.host }">{{ row.message.author }}</strong>
          <span v-if="row.message.host" class="badge">host</span>
        </p>
        <div class="chat-said">
          <StickerMark v-if="row.message.kind === 'STICKER'" :id="row.message.stickerId" :size="64" />
          <div v-else-if="row.message.kind === 'ATTACHMENT' && row.message.attachment" class="chat-sent-file">
            <ChatAttachment :room-id="roomId" :attachment="row.message.attachment" />
            <p v-if="row.message.text" class="chat-text">{{ row.message.text }}</p>
          </div>
          <p v-else class="chat-text">{{ row.message.text }}</p>
          <time class="chat-stamp" :datetime="row.iso">{{ row.time }}</time>
        </div>

        <p v-if="row.message.failed" class="field-error chat-failed">Not sent. Check your connection.</p>
        <span
          v-else-if="row.message.pending && row.message.progress > 0"
          class="upload-bar"
          role="progressbar"
          :aria-valuenow="Math.round(row.message.progress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <i :style="{ width: `${Math.round(row.message.progress * 100)}%` }"></i>
        </span>

        <ul v-if="row.reactions.length" class="reactions">
          <li v-for="reaction in row.reactions" :key="reaction.emoji">
            <button
              class="reaction"
              type="button"
              :class="{ mine: reaction.mine }"
              :aria-pressed="reaction.mine"
              :aria-label="`${reaction.emoji} ${reaction.count}`"
              @click="react(row.message.id, reaction.emoji)"
            >
              <span aria-hidden="true">{{ reaction.emoji }}</span>
              <small>{{ reaction.count }}</small>
            </button>
          </li>
        </ul>
      </div>

      <span class="chat-aside">
        <span v-if="!row.message.pending" class="react-anchor">
          <button
            class="react-button"
            type="button"
            :class="{ active: reactingTo === row.message.id }"
            :aria-expanded="reactingTo === row.message.id"
            aria-label="React to this message"
            @click="toggleReactionPalette(row.message.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 10v.2M15 10v.2" />
              <path d="M8.5 14.5a4.5 3 0 0 0 7 0" />
            </svg>
          </button>
          <div v-if="reactingTo === row.message.id" class="reaction-palette" role="menu">
            <button
              v-for="emoji in REACTION_PALETTE"
              :key="emoji"
              class="emoji-button"
              type="button"
              role="menuitem"
              :aria-label="`React with ${emoji}`"
              @click="react(row.message.id, emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </span>

        <!-- On its way: one faint tick until the room has it. -->
        <span v-if="row.message.pending" class="ticks ticks--pending" title="Sending" aria-label="Sending">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" />
          </svg>
        </span>
        <span
          v-else-if="row.ticks"
          class="ticks"
          :class="`ticks--${row.ticks}`"
          :title="row.tickLabel"
          :aria-label="row.tickLabel"
        >
          <svg viewBox="0 0 18 12" aria-hidden="true">
            <path d="m1 6.4 3.1 3.3L10.6 2.4" />
            <path v-if="row.ticks !== 'sent'" d="m6.6 6.4 3.1 3.3L16.2 2.4" />
          </svg>
        </span>
      </span>
    </li>
  </template>
</template>
