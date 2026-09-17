import { describe, expect, it } from 'vitest'
import { latestServerTime, receiptState, receiptStateFrom, receiptThresholds } from './receipts'

const me = 'member-me'
const message = { id: 'm1', memberId: me, serverTime: 1_000 }
const members = [
  { id: me, name: 'Ziad' },
  { id: 'member-sara', name: 'Sara' },
  { id: 'member-omar', name: 'Omar' },
]

describe('read receipts', () => {
  it('shows no ticks on somebody else’s message', () => {
    const theirs = { id: 'm2', memberId: 'member-sara', serverTime: 1_000 }

    expect(receiptState(theirs, { members, myId: me })).toBeNull()
  })

  it('shows a single tick while nobody else has received it', () => {
    expect(receiptState(message, { members, myId: me, receipts: {} })).toBe('sent')
  })

  it('needs everyone to have received it before it counts as delivered', () => {
    const onlyOne = { 'member-sara': { deliveredAt: 1_000, readAt: 0 } }
    const both = {
      'member-sara': { deliveredAt: 1_000, readAt: 0 },
      'member-omar': { deliveredAt: 2_000, readAt: 0 },
    }

    expect(receiptState(message, { members, myId: me, receipts: onlyOne })).toBe('sent')
    expect(receiptState(message, { members, myId: me, receipts: both })).toBe('delivered')
  })

  it('only turns read when every other member has read that far', () => {
    const oneRead = {
      'member-sara': { deliveredAt: 2_000, readAt: 2_000 },
      'member-omar': { deliveredAt: 2_000, readAt: 0 },
    }
    const allRead = {
      'member-sara': { deliveredAt: 2_000, readAt: 2_000 },
      'member-omar': { deliveredAt: 2_000, readAt: 1_000 },
    }

    expect(receiptState(message, { members, myId: me, receipts: oneRead })).toBe('delivered')
    expect(receiptState(message, { members, myId: me, receipts: allRead })).toBe('read')
  })

  it('treats a receipt from before the message as not having seen it', () => {
    const stale = {
      'member-sara': { deliveredAt: 999, readAt: 999 },
      'member-omar': { deliveredAt: 999, readAt: 999 },
    }

    expect(receiptState(message, { members, myId: me, receipts: stale })).toBe('sent')
  })

  it('stays at a single tick when you are alone in the room', () => {
    expect(receiptState(message, { members: [{ id: me }], myId: me })).toBe('sent')
  })

  it('finds the newest message to acknowledge', () => {
    expect(latestServerTime([{ serverTime: 5 }, { serverTime: 40 }, { serverTime: 12 }])).toBe(40)
    expect(latestServerTime([])).toBe(0)
  })
})

describe('receiptThresholds', () => {
  const members = [{ id: 'me' }, { id: 'a' }, { id: 'b' }]

  it('draws the same ticks as walking every member, at a fraction of the work', () => {
    const receipts = { a: { deliveredAt: 100, readAt: 100 }, b: { deliveredAt: 100, readAt: 50 } }
    const thresholds = receiptThresholds({ receipts, members, myId: 'me' })

    for (const serverTime of [40, 60, 100, 120]) {
      const message = { memberId: 'me', serverTime }
      expect(receiptStateFrom(message, thresholds, 'me')).toBe(
        receiptState(message, { receipts, members, myId: 'me' }),
      )
    }
  })

  it('is decided by whoever is furthest behind', () => {
    const receipts = { a: { deliveredAt: 100, readAt: 100 }, b: { deliveredAt: 100, readAt: 0 } }
    const thresholds = receiptThresholds({ receipts, members, myId: 'me' })

    expect(receiptStateFrom({ memberId: 'me', serverTime: 90 }, thresholds, 'me')).toBe('delivered')
  })

  it('says sent when you are the only one here', () => {
    const thresholds = receiptThresholds({ receipts: {}, members: [{ id: 'me' }], myId: 'me' })

    expect(thresholds.alone).toBe(true)
    expect(receiptStateFrom({ memberId: 'me', serverTime: 1 }, thresholds, 'me')).toBe('sent')
  })

  it('puts no ticks on someone else’s message', () => {
    const thresholds = receiptThresholds({ receipts: {}, members, myId: 'me' })

    expect(receiptStateFrom({ memberId: 'a', serverTime: 1 }, thresholds, 'me')).toBeNull()
  })
})
