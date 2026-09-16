<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { youtubeIds } from '../providers'
import { loadYouTubeApi } from '../youtubeEmbed'

/**
 * YouTube Music, played through the YouTube IFrame Player API.
 *
 * YouTube Music share links carry ordinary YouTube ids, and this API exposes real transport
 * control, so this is the second source (with SoundCloud) that can be held in true sync.
 *
 * Units: the API works in seconds, the room works in milliseconds.
 */
const props = defineProps({
  initialUrl: { type: String, required: true },
  autoPlay: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'play', 'pause', 'seek', 'finish', 'error'])

const host = ref(null)
let player = null
let loadedUrl = props.initialUrl
let ready = false

// Some labels disable embedding entirely; that arrives as an error code, not a failed load.
const EMBED_ERRORS = new Set([101, 150])

function idsFor(url) {
  const { videoId, playlistId } = youtubeIds(url)
  return { videoId, playlistId }
}

onMounted(async () => {
  let YT
  try {
    YT = await loadYouTubeApi()
  } catch (e) {
    emit('error', e.message)
    return
  }
  await nextTick()
  if (!host.value) return

  const { videoId, playlistId } = idsFor(props.initialUrl)
  player = new YT.Player(host.value, {
    width: '100%',
    height: '300',
    videoId: videoId || undefined,
    playerVars: {
      autoplay: props.autoPlay ? 1 : 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      ...(playlistId && !videoId ? { listType: 'playlist', list: playlistId } : {}),
    },
    events: {
      onReady: () => {
        ready = true
        emit('ready')
        if (props.autoPlay) player.playVideo()
      },
      onStateChange: ({ data }) => {
        if (data === YT.PlayerState.PLAYING) emit('play')
        else if (data === YT.PlayerState.PAUSED) emit('pause')
        else if (data === YT.PlayerState.ENDED) emit('finish')
      },
      onError: ({ data }) => {
        emit('error', EMBED_ERRORS.has(data)
          ? 'The owner doesn\u2019t allow this song to play outside YouTube. Try another link.'
          : 'YouTube couldn\u2019t play this song.')
      },
    },
  })
})

onBeforeUnmount(() => {
  try {
    player?.destroy()
  } catch {
    // The iframe may already be gone when the room unmounts.
  }
  player = null
})

function load(url, { autoPlay = false } = {}) {
  loadedUrl = url
  if (!player || !ready) return Promise.resolve()
  const { videoId, playlistId } = idsFor(url)
  if (videoId) {
    if (autoPlay) player.loadVideoById(videoId)
    else player.cueVideoById(videoId)
  } else if (playlistId) {
    player.loadPlaylist({ listType: 'playlist', list: playlistId })
    if (!autoPlay) player.pauseVideo()
  }
  return Promise.resolve()
}

const state = () => (player && ready ? player.getPlayerState() : null)

defineExpose({
  load,
  loadedUrl: () => loadedUrl,
  play: () => player?.playVideo(),
  pause: () => player?.pauseVideo(),
  seekTo: (ms) => player?.seekTo(Math.max(0, ms / 1000), true),
  setVolume: (volume) => player?.setVolume(volume),
  getPosition: () => Promise.resolve(player && ready ? (player.getCurrentTime() || 0) * 1000 : null),
  isPaused: () => {
    const current = state()
    if (current === null) return Promise.resolve(null)
    return Promise.resolve(current !== 1) // 1 = PLAYING
  },
  getCurrentSound: () => {
    if (!player || !ready) return Promise.resolve(null)
    const data = player.getVideoData?.() || {}
    const { videoId } = idsFor(loadedUrl)
    return Promise.resolve({
      title: data.title || '',
      permalink_url: loadedUrl,
      artwork_url: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
      user: { username: data.author || '' },
    })
  },
})
</script>

<template>
  <div class="youtube-player">
    <div ref="host"></div>
  </div>
</template>
