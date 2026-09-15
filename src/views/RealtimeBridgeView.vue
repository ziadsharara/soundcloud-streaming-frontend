<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { connectToRoomDirect } from '../stomp'

const ALLOWED_PARENT_ORIGINS = new Set(['https://soundstreaming.vercel.app'])
const params = new URLSearchParams(window.location.search)
const parentOrigin = params.get('parentOrigin') || ''
const channelId = params.get('channel') || ''
const enabled = ALLOWED_PARENT_ORIGINS.has(parentOrigin) && Boolean(channelId) && window.parent !== window

let connection = null

function send(name, payload) {
  if (!enabled) return
  window.parent.postMessage({ channelId, type: 'event', name, payload }, parentOrigin)
}

function onMessage(event) {
  if (!enabled || event.origin !== parentOrigin || event.source !== window.parent) return
  const message = event.data
  if (!message || message.channelId !== channelId || message.type !== 'command') return

  if (message.action === 'connect') {
    const roomId = message.payload?.roomId
    if (!/^[A-Z0-9]{6}$/.test(roomId || '') || connection) return
    connection = connectToRoomDirect(roomId, {
      onStatus: (status) => send('status', status),
      onPlayback: (playback) => send('playback', playback),
      onListeners: (listeners) => send('listeners', listeners),
      onChat: (chat) => send('chat', chat),
      onClosed: () => send('closed'),
    })
  } else if (message.action === 'playback') {
    connection?.publishPlayback(message.payload)
  } else if (message.action === 'chat') {
    connection?.sendChat(message.payload)
  } else if (message.action === 'disconnect') {
    connection?.disconnect()
    connection = null
  }
}

onMounted(() => {
  if (!enabled) return
  window.addEventListener('message', onMessage)
  send('ready')
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  connection?.disconnect()
})
</script>

<template>
  <span v-if="!enabled">Realtime bridge unavailable.</span>
</template>
