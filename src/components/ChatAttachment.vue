<script setup>
import { onMounted, ref } from 'vue'
import { attachmentUrl, formatBytes, formatDuration } from '../attachments'

/**
 * Something somebody sent to the room: a voice note, a video note, a photo, or a file.
 *
 * The bytes come from the room rather than from a plain link, because a private room's files
 * need its key on the request — so each of these fetches once, then plays from the browser.
 */
const props = defineProps({
  roomId: { type: String, required: true },
  attachment: { type: Object, required: true },
})

const source = ref('')
const failed = ref(false)

onMounted(async () => {
  source.value = await attachmentUrl(props.roomId, props.attachment)
  failed.value = !source.value
})
</script>

<template>
  <div class="attachment" :class="`attachment--${attachment.kind.toLowerCase()}`">
    <p v-if="failed" class="muted attachment-gone">
      This file is no longer in the room.
    </p>

    <template v-else-if="attachment.kind === 'VOICE'">
      <div class="voice-note">
        <span class="voice-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
        <audio v-if="source" :src="source" controls preload="metadata"></audio>
        <small v-if="attachment.durationMs">{{ formatDuration(attachment.durationMs) }}</small>
      </div>
    </template>

    <template v-else-if="attachment.kind === 'VIDEO_NOTE'">
      <video v-if="source" class="video-note" :src="source" controls playsinline preload="metadata"></video>
    </template>

    <template v-else-if="attachment.kind === 'VIDEO'">
      <video v-if="source" class="attachment-video" :src="source" controls playsinline preload="metadata"></video>
      <small class="attachment-name">{{ attachment.name }} · {{ formatBytes(attachment.size) }}</small>
    </template>

    <template v-else-if="attachment.kind === 'IMAGE'">
      <a v-if="source" :href="source" target="_blank" rel="noopener">
        <img class="attachment-image" :src="source" :alt="attachment.name" />
      </a>
    </template>

    <template v-else-if="attachment.kind === 'AUDIO'">
      <audio v-if="source" :src="source" controls preload="metadata"></audio>
      <small class="attachment-name">{{ attachment.name }} · {{ formatBytes(attachment.size) }}</small>
    </template>

    <a v-else class="attachment-file" :href="source" :download="attachment.name">
      <span class="attachment-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
      </span>
      <span class="attachment-text">
        <strong>{{ attachment.name }}</strong>
        <small>{{ formatBytes(attachment.size) }}</small>
      </span>
    </a>
  </div>
</template>
