import { Client } from '@stomp/stompjs'
import { webSocketUrl } from './api'

const bridgeOrigin = (import.meta.env.VITE_WS_BRIDGE_ORIGIN || '').trim().replace(/\/$/, '')

/**
 * Opens a STOMP connection for one room and wires its topics to callbacks.
 * Reconnects automatically; subscriptions are re-created on every connect.
 */
export function connectToRoomDirect(roomId, { onStatus, onPlayback, onListeners, onChat, onClosed }) {
  const client = new Client({ brokerURL: webSocketUrl(), reconnectDelay: 3000 })
  const json = (handler) => (message) => handler?.(JSON.parse(message.body))

  client.onConnect = () => {
    client.subscribe(`/topic/rooms/${roomId}/listeners`, json(onListeners))
    client.subscribe(`/topic/rooms/${roomId}/chat`, json(onChat))
    client.subscribe(`/topic/rooms/${roomId}/closed`, json(onClosed))
    // Subscribed last: this is the subscription the server counts as "in the room"
    client.subscribe(`/topic/rooms/${roomId}/playback`, json(onPlayback))
    onStatus?.('connected')
  }
  client.onWebSocketClose = () => onStatus?.('disconnected')
  client.onStompError = (frame) => console.error('STOMP error', frame.headers.message, frame.body)
  client.activate()

  const publish = (destination, body) => {
    if (client.connected) client.publish({ destination, body: JSON.stringify(body) })
  }

  return {
    publishPlayback: (state) => publish(`/app/rooms/${roomId}/playback`, state),
    sendChat: (message) => publish(`/app/rooms/${roomId}/chat`, message),
    disconnect: () => client.deactivate(),
  }
}

export function connectToRoom(roomId, handlers) {
  if (!bridgeOrigin || window.location.origin === bridgeOrigin) {
    return connectToRoomDirect(roomId, handlers)
  }
  return connectThroughBridge(roomId, handlers)
}

function connectThroughBridge(roomId, handlers) {
  const channelId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.title = 'SoundStream realtime connection'
  frame.src = `${bridgeOrigin}/realtime-bridge?parentOrigin=${encodeURIComponent(window.location.origin)}&channel=${encodeURIComponent(channelId)}`

  let ready = false
  let connected = false
  const post = (action, payload) => {
    if (!ready || !frame.contentWindow) return
    frame.contentWindow.postMessage({ channelId, type: 'command', action, payload }, bridgeOrigin)
  }

  const onMessage = (event) => {
    if (event.origin !== bridgeOrigin || event.source !== frame.contentWindow) return
    const message = event.data
    if (!message || message.channelId !== channelId || message.type !== 'event') return
    if (message.name === 'ready') {
      ready = true
      post('connect', { roomId })
      return
    }
    if (message.name === 'status') {
      connected = message.payload === 'connected'
      handlers.onStatus?.(message.payload)
      return
    }
    const callback = {
      playback: handlers.onPlayback,
      listeners: handlers.onListeners,
      chat: handlers.onChat,
      closed: handlers.onClosed,
    }[message.name]
    callback?.(message.payload)
  }

  window.addEventListener('message', onMessage)
  document.body.appendChild(frame)

  const publish = (action, payload) => {
    if (connected) post(action, payload)
  }

  return {
    publishPlayback: (state) => publish('playback', state),
    sendChat: (message) => publish('chat', message),
    disconnect: () => {
      post('disconnect')
      window.removeEventListener('message', onMessage)
      frame.remove()
      ready = false
      connected = false
    },
  }
}
