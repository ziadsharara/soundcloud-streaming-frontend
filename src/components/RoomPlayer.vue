<script setup>
import { computed, ref } from 'vue'
import AnghamiCard from './AnghamiCard.vue'
import SoundCloudPlayer from './SoundCloudPlayer.vue'
import SpotifyPlayer from './SpotifyPlayer.vue'
import YouTubePlayer from './YouTubePlayer.vue'
import { detectProvider } from '../providers'

/**
 * Picks the player for whatever the host is playing and presents one interface to the room.
 *
 * Switching provider means a different embed entirely, so the room remounts this component
 * (keyed on provider) rather than asking a SoundCloud widget to load a YouTube link.
 */
const props = defineProps({
  initialUrl: { type: String, required: true },
  autoPlay: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'play', 'pause', 'seek', 'finish', 'error'])

const provider = computed(() => detectProvider(props.initialUrl))
const inner = ref(null)

const call = (method, ...args) => inner.value?.[method]?.(...args)

defineExpose({
  provider: () => provider.value,
  load: (url, options) => call('load', url, options) ?? Promise.resolve(),
  loadedUrl: () => call('loadedUrl') ?? props.initialUrl,
  play: () => call('play'),
  pause: () => call('pause'),
  seekTo: (ms) => call('seekTo', ms),
  setVolume: (volume) => call('setVolume', volume),
  getPosition: () => call('getPosition') ?? Promise.resolve(null),
  isPaused: () => call('isPaused') ?? Promise.resolve(null),
  getCurrentSound: () => call('getCurrentSound') ?? Promise.resolve(null),
})
</script>

<template>
  <SoundCloudPlayer
    v-if="provider === 'soundcloud'"
    ref="inner"
    :initial-url="initialUrl"
    :auto-play="autoPlay"
    @ready="emit('ready')"
    @play="emit('play')"
    @pause="emit('pause')"
    @seek="emit('seek')"
    @finish="emit('finish')"
    @error="emit('error', $event)"
  />
  <YouTubePlayer
    v-else-if="provider === 'youtube'"
    ref="inner"
    :initial-url="initialUrl"
    :auto-play="autoPlay"
    @ready="emit('ready')"
    @play="emit('play')"
    @pause="emit('pause')"
    @seek="emit('seek')"
    @finish="emit('finish')"
    @error="emit('error', $event)"
  />
  <SpotifyPlayer
    v-else-if="provider === 'spotify'"
    ref="inner"
    :initial-url="initialUrl"
    :auto-play="autoPlay"
    @ready="emit('ready')"
    @play="emit('play')"
    @pause="emit('pause')"
    @seek="emit('seek')"
    @finish="emit('finish')"
    @error="emit('error', $event)"
  />
  <AnghamiCard
    v-else-if="provider === 'anghami'"
    ref="inner"
    :initial-url="initialUrl"
    :auto-play="autoPlay"
    @ready="emit('ready')"
    @error="emit('error', $event)"
  />
</template>
