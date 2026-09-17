import { describe, expect, it } from 'vitest'
import { failMessage, mergeChatMessages, newClientId, pendingMessage } from './roomState'

describe('room state helpers', () => {
  it('merges history with live messages in chronological order', () => {
    const live = { id: '2', author: 'Guest', text: 'Second', host: false, serverTime: 200 }
    const history = { id: '1', author: 'Host', text: 'First', host: true, serverTime: 100 }

    expect(mergeChatMessages([live], [history])).toEqual([history, live])
  })

  it('deduplicates a message received by REST and WebSocket', () => {
    const message = { id: '1', author: 'Guest', text: 'Hello', host: false, serverTime: 100 }

    expect(mergeChatMessages([message], [{ ...message }])).toEqual([{ ...message }])
  })

  it('keeps only the newest configured number of messages', () => {
    const messages = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      author: 'Guest',
      text: String(index),
      host: false,
      serverTime: index,
    }))

    expect(mergeChatMessages([], messages, 3).map((message) => message.id)).toEqual(['2', '3', '4'])
  })
})

describe('messages drawn before the room confirms them', () => {
  const pending = pendingMessage({ clientId: 'c1', memberId: 'me', author: 'Me', avatarId: 'bun', text: 'hi' })

  it('shows what you sent straight away', () => {
    expect(pending.pending).toBe(true)
    expect(pending.text).toBe('hi')
  })

  it('is replaced by the room’s own copy rather than doubled', () => {
    const confirmed = {
      id: 'server-1',
      clientId: 'c1',
      memberId: 'me',
      author: 'Me',
      avatarId: 'bun',
      kind: 'TEXT',
      text: 'hi',
      serverTime: pending.serverTime + 40,
    }

    const merged = mergeChatMessages([pending], [confirmed])

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('server-1')
    expect(merged[0].pending).toBeUndefined()
  })

  it('never lets a late pending copy overwrite the confirmed one', () => {
    const confirmed = { id: 'server-1', clientId: 'c1', memberId: 'me', author: 'Me', text: 'hi', serverTime: 10 }

    const merged = mergeChatMessages([confirmed], [{ ...pending, serverTime: 5 }])

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('server-1')
  })

  it('keeps two people’s messages apart even if their ids collided', () => {
    const mine = pendingMessage({ clientId: 'same', memberId: 'me', author: 'Me', text: 'mine' })
    const theirs = { id: 's2', clientId: 'same', memberId: 'you', author: 'You', text: 'theirs', serverTime: 2 }

    expect(mergeChatMessages([mine], [theirs])).toHaveLength(2)
  })

  it('marks one that never made it', () => {
    const failed = failMessage([pending], 'c1')

    expect(failed[0].failed).toBe(true)
    expect(failed[0].pending).toBe(false)
  })

  it('gives every message its own id', () => {
    expect(newClientId()).not.toBe(newClientId())
  })
})
