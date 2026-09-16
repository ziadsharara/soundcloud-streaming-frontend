<script setup>
import { computed } from 'vue'
import { avatarById } from '../avatars'

const props = defineProps({
  id: { type: String, default: 'bun' },
  size: { type: Number, default: 40 },
  flat: { type: Boolean, default: false },
})

// The markup comes from our own avatar table, never from a room member's message.
const avatar = computed(() => avatarById(props.id))
</script>

<template>
  <span
    class="avatar-mark"
    :class="[`marker-${avatar.marker}`, { 'avatar-mark--flat': flat }]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="avatar.label"
  >
    <svg viewBox="0 0 48 48" aria-hidden="true" v-html="avatar.svg" />
  </span>
</template>
