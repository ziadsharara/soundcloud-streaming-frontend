import { describe, expect, it } from 'vitest'
import { mergeChatMessages } from './roomState'

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
