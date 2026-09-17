import { describe, expect, it } from 'vitest'
import { continuesBlock, dayLabel, messageTime, startsNewDay } from './chatTime'

const at = (isoLocal) => new Date(isoLocal).getTime()

describe('messageTime', () => {
  it('shows hours and minutes in the reader’s own clock', () => {
    expect(messageTime(at('2026-03-12T14:32:00'), 'en-GB')).toBe('14:32')
  })

  it('is empty when there is no timestamp', () => {
    expect(messageTime(0)).toBe('')
    expect(messageTime(undefined)).toBe('')
  })
})

describe('dayLabel', () => {
  const now = at('2026-03-12T10:00:00')

  it('names today and yesterday', () => {
    expect(dayLabel(at('2026-03-12T01:00:00'), now)).toBe('Today')
    expect(dayLabel(at('2026-03-11T23:59:00'), now)).toBe('Yesterday')
  })

  it('falls back to the date itself', () => {
    expect(dayLabel(at('2026-03-09T12:00:00'), now, 'en-GB')).toBe('9 Mar')
  })

  it('adds the year once it is a different one', () => {
    expect(dayLabel(at('2025-12-30T12:00:00'), now, 'en-GB')).toContain('2025')
  })
})

describe('grouping', () => {
  it('starts a new day above the first message of each day', () => {
    const yesterday = { serverTime: at('2026-03-11T22:00:00') }
    const today = { serverTime: at('2026-03-12T09:00:00') }

    expect(startsNewDay(yesterday, null)).toBe(true)
    expect(startsNewDay(today, yesterday)).toBe(true)
    expect(startsNewDay({ serverTime: at('2026-03-12T09:30:00') }, today)).toBe(false)
  })

  it('blocks messages from one person sent moments apart', () => {
    const first = { memberId: 'me', serverTime: at('2026-03-12T09:00:00') }
    const quick = { memberId: 'me', serverTime: at('2026-03-12T09:00:30') }
    const later = { memberId: 'me', serverTime: at('2026-03-12T09:05:00') }
    const other = { memberId: 'you', serverTime: at('2026-03-12T09:00:10') }

    expect(continuesBlock(quick, first)).toBe(true)
    expect(continuesBlock(later, first)).toBe(false)
    expect(continuesBlock(other, first)).toBe(false)
    expect(continuesBlock(first, null)).toBe(false)
  })
})
