<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { WIDGET_OPTIONS, embedUrl, loadWidgetApi } from '../soundcloud'

const props = defineProps({
  // Only used for the first render; later tracks go through load() to keep the same widget.
  initialUrl: { type: String, required: true },
  autoPlay: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'play', 'pause', 'seek', 'finish', 'error'])

const CALL_TIMEOUT_MS = 2000
const LOAD_TIMEOUT_MS = 8000

const frame = ref(null)
const src = ref('')
let widget = null
let loadedUrl = props.initialUrl

onMounted(async () => {
  let SC
  try {
    SC = await loadWidgetApi()
  } catch (e) {
    emit('error', e.message)
    return
  }
  // Render the iframe only after the API is loaded so the READY event can't be missed.
  src.value = embedUrl(props.initialUrl, props.autoPlay)
  await nextTick()
  widget = SC.Widget(frame.value)
  const { Events } = SC.Widget
  widget.bind(Events.READY, () => emit('ready'))
  widget.bind(Events.PLAY, () => emit('play'))
  widget.bind(Events.PAUSE, () => emit('pause'))
  widget.bind(Events.SEEK, () => emit('seek'))
  widget.bind(Events.FINISH, () => emit('finish'))
  widget.bind(Events.ERROR, () => emit('error', 'SoundCloud could not play this track.'))
})

onBeforeUnmount(() => {
  if (widget) Object.values(window.SC.Widget.Events).forEach((event) => widget.unbind(event))
  widget = null
})

// Widget getters are callback-based and silently never answer if the widget isn't ready.
function ask(getter) {
  return new Promise((resolve) => {
    if (!widget) return resolve(null)
    const timeout = setTimeout(() => resolve(null), CALL_TIMEOUT_MS)
    widget[getter]((value) => {
      clearTimeout(timeout)
      resolve(value)
    })
  })
}

function load(url, { autoPlay = false } = {}) {
  loadedUrl = url
  return new Promise((resolve) => {
    if (!widget) return resolve()
    const timeout = setTimeout(resolve, LOAD_TIMEOUT_MS)
    widget.load(url, {
      ...WIDGET_OPTIONS,
      auto_play: autoPlay,
      callback: () => {
        clearTimeout(timeout)
        resolve()
      },
    })
  })
}

defineExpose({
  load,
  loadedUrl: () => loadedUrl,
  play: () => widget?.play(),
  pause: () => widget?.pause(),
  seekTo: (ms) => widget?.seekTo(ms),
  setVolume: (volume) => widget?.setVolume(volume),
  getPosition: () => ask('getPosition'),
  isPaused: () => ask('isPaused'),
  getCurrentSound: () => ask('getCurrentSound'),
})
</script>

<template>
  <iframe
    v-if="src"
    ref="frame"
    class="sc-frame"
    :src="src"
    allow="autoplay; encrypted-media"
    scrolling="no"
    frameborder="no"
    title="SoundCloud player"
  />
</template>
