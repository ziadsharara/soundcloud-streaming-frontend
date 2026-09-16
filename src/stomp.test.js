import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const client = {
    connected: true,
    subscribe: vi.fn(),
    publish: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn().mockResolvedValue(undefined),
  }
  return {
    client,
    Client: vi.fn(function MockClient() {
      return client
    }),
  }
})

vi.mock('@stomp/stompjs', () => ({ Client: mocks.Client }))
vi.mock('./api', () => ({
  webSocketUrl: () => 'wss://api.example.com/ws',
  getRoomKey: () => 'room-key-for-tests',
}))

import { connectToRoom } from './stomp'

describe('room realtime connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.client.connected = true
    mocks.client.deactivate.mockResolvedValue(undefined)
  })

  it('subscribes to every room topic after connecting', () => {
    const onStatus = vi.fn()

    connectToRoom('ABC123', { onStatus })
    mocks.client.onConnect()

    expect(mocks.client.subscribe.mock.calls.map(([destination]) => destination)).toEqual([
      '/topic/rooms/ABC123/members',
      '/topic/rooms/ABC123/chat',
      '/topic/rooms/ABC123/receipts',
      '/topic/rooms/ABC123/typing',
      '/topic/rooms/ABC123/queue',
      '/topic/rooms/ABC123/closed',
      '/topic/rooms/ABC123/playback',
    ])
    expect(onStatus).toHaveBeenCalledWith('connected')
  })

  it('carries the private-room key on connect, where the server checks it', () => {
    connectToRoom('ABC123', {})

    expect(mocks.Client).toHaveBeenCalledWith(
      expect.objectContaining({ connectHeaders: { roomKey: 'room-key-for-tests' } }),
    )
  })

  it('announces who joined on every connect, so a reconnect restores the member', () => {
    const identity = vi.fn(() => ({ name: 'Ziad', avatarId: 'vinyl', hostToken: 'token' }))

    connectToRoom('ABC123', {}, identity)
    mocks.client.onConnect()
    mocks.client.onConnect()

    const joins = mocks.client.publish.mock.calls.filter(
      ([frame]) => frame.destination === '/app/rooms/ABC123/join',
    )
    expect(joins).toHaveLength(2)
    expect(JSON.parse(joins[0][0].body)).toEqual({ name: 'Ziad', avatarId: 'vinyl', hostToken: 'token' })
  })

  it('tags chat and sticker messages with their kind', () => {
    const connection = connectToRoom('ABC123', {})

    connection.sendChat({ hostToken: 'token', text: 'hi' })
    connection.sendSticker({ hostToken: 'token', stickerId: 'fire' })

    const bodies = mocks.client.publish.mock.calls.map(([frame]) => JSON.parse(frame.body))
    expect(bodies[0]).toEqual({ kind: 'TEXT', hostToken: 'token', text: 'hi' })
    expect(bodies[1]).toEqual({ kind: 'STICKER', hostToken: 'token', stickerId: 'fire' })
  })

  it('sends receipts, typing and listening state on their own destinations', () => {
    const connection = connectToRoom('ABC123', {})

    connection.sendReceipt({ read: true, throughServerTime: 42 })
    connection.sendTyping(true)
    connection.sendListening(false)

    const sent = mocks.client.publish.mock.calls.map(([frame]) => [frame.destination, JSON.parse(frame.body)])
    expect(sent).toEqual([
      ['/app/rooms/ABC123/receipt', { read: true, throughServerTime: 42 }],
      ['/app/rooms/ABC123/typing', { typing: true }],
      ['/app/rooms/ABC123/status', { listening: false }],
    ])
  })

  it('surfaces WebSocket failures while automatic reconnect is active', () => {
    const onError = vi.fn()

    connectToRoom('ABC123', { onError })
    mocks.client.onWebSocketError()

    expect(onError).toHaveBeenCalledWith('The live connection failed. Retrying automatically…')
  })

  it('shows recovery guidance when an established socket closes', () => {
    const onStatus = vi.fn()
    const onError = vi.fn()

    connectToRoom('ABC123', { onStatus, onError })
    mocks.client.onWebSocketClose()

    expect(onStatus).toHaveBeenCalledWith('disconnected')
    expect(onError).toHaveBeenCalledWith('The live connection was interrupted. Retrying automatically…')
  })

  it('publishes host queue updates to the validated application destination', () => {
    const connection = connectToRoom('ABC123', {})
    const queue = { hostToken: 'token', trackUrls: ['https://soundcloud.com/a/song'], activeIndex: 0 }

    connection.publishQueue(queue)

    expect(mocks.client.publish).toHaveBeenCalledWith({
      destination: '/app/rooms/ABC123/queue',
      body: JSON.stringify(queue),
    })
  })

  it('can force a fresh connection from the recovery control', async () => {
    const onStatus = vi.fn()
    const connection = connectToRoom('ABC123', { onStatus })

    await connection.reconnect()

    expect(onStatus).toHaveBeenCalledWith('connecting')
    expect(mocks.client.deactivate).toHaveBeenCalledWith({ force: true })
    expect(mocks.client.activate).toHaveBeenCalledTimes(2)
  })
})
