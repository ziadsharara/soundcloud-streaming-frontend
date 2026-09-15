import { describe, expect, it } from 'vitest'
import { parseRoomCode } from './roomCode'

describe('parseRoomCode', () => {
  it('normalizes valid room codes', () => {
    expect(parseRoomCode(' b2a9gk ', 'https://app.example.com')).toBe('B2A9GK')
  })

  it('extracts codes from invite links with query strings', () => {
    expect(parseRoomCode('https://app.example.com/room/K7QH2M?from=share#join', 'https://app.example.com')).toBe('K7QH2M')
  })

  it.each(['', 'ABC', 'ABC10O', 'not a code', 'https://app.example.com/room/TOO-LONG'])(
    'rejects invalid input %s',
    (value) => expect(parseRoomCode(value, 'https://app.example.com')).toBe(''),
  )
})
