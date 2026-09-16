<script setup>
import { computed } from 'vue'
import { stickerById } from '../stickers'

const props = defineProps({
  id: { type: String, required: true },
  size: { type: Number, default: 72 },
})

// Unknown ids render as nothing rather than a broken drawing.
const sticker = computed(() => stickerById(props.id))
</script>

<template>
  <span
    v-if="sticker"
    class="sticker-mark"
    :class="`marker-${sticker.marker}`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="sticker.label"
  >
    <svg viewBox="0 0 64 64" aria-hidden="true" v-html="sticker.svg" />
  </span>
  <span v-else class="muted">[sticker]</span>
</template>
