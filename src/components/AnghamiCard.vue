<script setup>
import { onMounted } from 'vue'
import { urlLabel } from '../providers'

/**
 * Anghami publishes no player API, so there is nothing to drive and nothing to sync.
 * The room shows the link and everyone opens it themselves.
 *
 * It still answers the player interface so the room's sync loop can skip it cleanly:
 * getPosition and isPaused return null, which the room reads as "no opinion".
 */
const props = defineProps({
  initialUrl: { type: String, required: true },
  autoPlay: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'play', 'pause', 'seek', 'finish', 'error'])

let loadedUrl = props.initialUrl

onMounted(() => emit('ready'))

defineExpose({
  load: (url) => {
    loadedUrl = url
    return Promise.resolve()
  },
  loadedUrl: () => loadedUrl,
  play: () => {},
  pause: () => {},
  seekTo: () => {},
  setVolume: () => {},
  getPosition: () => Promise.resolve(null),
  isPaused: () => Promise.resolve(null),
  getCurrentSound: () => Promise.resolve({
    title: urlLabel(loadedUrl),
    permalink_url: loadedUrl,
    artwork_url: '',
    user: { username: 'Anghami' },
  }),
})
</script>

<template>
  <div class="anghami-card sketch-frame">
    <p class="eyebrow">Anghami</p>
    <h3>{{ urlLabel(initialUrl) }}</h3>
    <p class="muted">
      Anghami has no public player API, so this one cannot be synced. Open it in Anghami and press
      play when the host does.
    </p>
    <a class="btn" :href="initialUrl" target="_blank" rel="noreferrer">Open in Anghami ↗</a>
  </div>
</template>
