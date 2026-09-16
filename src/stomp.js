import { Client } from '@stomp/stompjs'
import { webSocketUrl } from './api'

/**
 * Opens a STOMP connection for one room and wires its topics to callbacks.
 *
 * Reconnects automatically; subscriptions and the join announcement are re-sent on every
 * connect, because the server identifies members by STOMP session and a reconnect is a new one.
 *
 * `identity` is a getter, not a value, so a name changed mid-session is picked up on reconnect.
 */
export function connectToRoom(
  roomId,
  { onStatus, onPlayback, onQueue, onMembers, onChat, onClosed, onError },
  identity = () => ({}),
) {
  const client = new Client({ brokerURL: webSocketUrl(), reconnectDelay: 3000 })
  const json = (handler) => (message) => handler?.(JSON.parse(message.body))

  const publish = (destination, body) => {
    if (client.connected) client.publish({ destination, body: JSON.stringify(body) })
  }
  const announce = () => publish(`/app/rooms/${roomId}/join`, identity())

  client.onConnect = () => {
    client.subscribe(`/topic/rooms/${roomId}/members`, json(onMembers))
    client.subscribe(`/topic/rooms/${roomId}/chat`, json(onChat))
    client.subscribe(`/topic/rooms/${roomId}/queue`, json(onQueue))
    client.subscribe(`/topic/rooms/${roomId}/closed`, json(onClosed))
    // Subscribed last: this is the subscription that carries the room's playback state.
    client.subscribe(`/topic/rooms/${roomId}/playback`, json(onPlayback))
    announce()
    onStatus?.('connected')
  }
  client.onWebSocketClose = () => {
    onStatus?.('disconnected')
    onError?.('The live connection was interrupted. Retrying automatically…')
  }
  client.onWebSocketError = () => onError?.('The live connection failed. Retrying automatically…')
  client.onStompError = (frame) => {
    onError?.(frame.headers.message || 'Couldn’t join this room’s live updates.')
    console.error('STOMP error', frame.headers.message, frame.body)
  }
  client.activate()

  return {
    announce,
    publishPlayback: (state) => publish(`/app/rooms/${roomId}/playback`, state),
    publishQueue: (state) => publish(`/app/rooms/${roomId}/queue`, state),
    sendChat: (message) => publish(`/app/rooms/${roomId}/chat`, { kind: 'TEXT', ...message }),
    sendSticker: (message) => publish(`/app/rooms/${roomId}/chat`, { kind: 'STICKER', ...message }),
    reconnect: async () => {
      onStatus?.('connecting')
      await client.deactivate({ force: true })
      client.activate()
    },
    disconnect: () => client.deactivate(),
  }
}
