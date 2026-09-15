import { Client } from '@stomp/stompjs'
import { webSocketUrl } from './api'

/**
 * Opens a STOMP connection for one room and wires its topics to callbacks.
 * Reconnects automatically; subscriptions are re-created on every connect.
 */
export function connectToRoom(roomId, { onStatus, onPlayback, onListeners, onChat, onClosed, onError }) {
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
  client.onWebSocketClose = () => {
    onStatus?.('disconnected')
    onError?.('The live connection was interrupted. Retrying automatically…')
  }
  client.onWebSocketError = () => onError?.('The live connection failed. Retrying automatically…')
  client.onStompError = (frame) => {
    onError?.(frame.headers.message || 'The room server rejected the live connection.')
    console.error('STOMP error', frame.headers.message, frame.body)
  }
  client.activate()

  const publish = (destination, body) => {
    if (client.connected) client.publish({ destination, body: JSON.stringify(body) })
  }

  return {
    publishPlayback: (state) => publish(`/app/rooms/${roomId}/playback`, state),
    sendChat: (message) => publish(`/app/rooms/${roomId}/chat`, message),
    reconnect: async () => {
      onStatus?.('connecting')
      await client.deactivate({ force: true })
      client.activate()
    },
    disconnect: () => client.deactivate(),
  }
}
