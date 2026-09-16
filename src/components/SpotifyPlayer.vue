<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { spotifyUri } from '../providers'
import { loadSpotifyEmbedApi, spotifyMetadata } from '../spotifyEmbed'

/**
 * Spotify embed, wrapped in the same shape as the SoundCloud player so the room can drive either.
 *
 * Two quirks of Spotify's API this has to absorb:
 *  - seek() takes SECONDS, while playback_update reports position in MILLISECONDS.
 *  - programmatic playback starts a ~30s preview, even for Premium listeners.
 */
const props = defineProps({
  initialUrl: { type: String, required: true },
  autoPlay: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'play', 'pause', 'seek', 'finish', 'error'])

const host = ref(null)
let controller = null
let loadedUrl = props.initialUrl
let position = 0
let duration = 0
let paused = true
let started = false

onMounted(async () => {
  let api
  try {
    api = await loadSpotifyEmbedApi()
  } catch (e) {
    emit('error', e.message)
    return
  }
  await nextTick()
  if (!host.value) return

  api.createController(
    host.value,
    { uri: spotifyUri(props.initialUrl), width: '100%', height: 352 },
    (embedController) => {
      controller = embedController

      // The 'ready' event can fire before this callback attaches a listener, so announce
      // readiness here and let the event act only as a backup. Missing it once left the room
      // showing the previous track forever.
      let announced = false
      const announceReady = () => {
        if (announced) return
        announced = true
        emit('ready')
        if (props.autoPlay) play()
      }
      controller.addListener('ready', announceReady)
      announceReady()
      controller.addListener('playback_update', ({ data }) => {
        if (!data) return
        position = data.position ?? position
        duration = data.duration ?? duration
        const wasPaused = paused
        paused = Boolean(data.isPaused)
        if (wasPaused !== paused) emit(paused ? 'pause' : 'play')
        // Spotify has no finish event; the preview simply stops at the end.
        if (paused && duration && position >= duration - 750) emit('finish')
      })
    },
  )
})

onBeforeUnmount(() => {
  try {
    controller?.destroy()
  } catch {
    // The iframe may already be gone when the room unmounts.
  }
  controller = null
})

function play() {
  if (!controller) return
  started = true
  // resume() continues where the listener is; play() restarts from the top.
  if (typeof controller.resume === 'function') controller.resume()
  else controller.play()
}

function load(url, { autoPlay = false } = {}) {
  loadedUrl = url
  position = 0
  duration = 0
  paused = true
  started = false
  if (!controller) return Promise.resolve()
  controller.loadUri(spotifyUri(url))
  if (autoPlay) {
    // loadUri does not start playback on its own.
    setTimeout(play, 400)
  }
  return Promise.resolve()
}

defineExpose({
  load,
  loadedUrl: () => loadedUrl,
  play,
  pause: () => controller?.pause(),
  // seek() is in seconds; the room works in milliseconds everywhere else.
  seekTo: (ms) => {
    if (!controller) return
    if (!started) play()
    controller.seek(Math.max(0, Math.round(ms / 1000)))
  },
  // The embed gives no volume control; the listener uses Spotify's own slider.
  setVolume: () => {},
  getPosition: () => Promise.resolve(position),
  isPaused: () => Promise.resolve(paused),
  getCurrentSound: async () => {
    const { title, artwork } = await spotifyMetadata(loadedUrl)
    return { title, permalink_url: loadedUrl, artwork_url: artwork, user: { username: '' } }
  },
})
</script>

<template>
  <div class="spotify-player">
    <div ref="host"></div>
    <p class="hint">
      Spotify only plays a 30-second preview here, even with Premium. For full songs, use SoundCloud or YouTube.
    </p>
  </div>
</template>
