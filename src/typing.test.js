import { describe, expect, it } from 'vitest'
import { applyTyping, pruneTyping, typingLabel, typingNames } from './typing'

describe('typing indicator', () => {
  it('adds and removes people as they start and stop', () => {
    const started = applyTyping({}, { memberId: 'sara', name: 'Sara', typing: true }, 1_000)
    expect(started.sara).toEqual({ name: 'Sara', at: 1_000 })

    const stopped = applyTyping(started, { memberId: 'sara', name: 'Sara', typing: false }, 1_100)
    expect(stopped.sara).toBeUndefined()
  })

  it('ignores a notice with nobody attached to it', () => {
    expect(applyTyping({}, { typing: true })).toEqual({})
    expect(applyTyping({}, null)).toEqual({})
  })

  it('expires anyone whose last keystroke is stale, so an indicator cannot stick', () => {
    const current = { sara: { name: 'Sara', at: 1_000 }, omar: { name: 'Omar', at: 9_000 } }

    expect(pruneTyping(current, 10_000)).toEqual({ omar: { name: 'Omar', at: 9_000 } })
  })

  it('never lists you typing to yourself', () => {
    const current = { me: { name: 'Ziad', at: 1 }, sara: { name: 'Sara', at: 1 } }

    expect(typingNames(current, 'me')).toEqual(['Sara'])
  })

  it('reads naturally for one, two, or a crowd', () => {
    expect(typingLabel([])).toBe('')
    expect(typingLabel(['Sara'])).toBe('Sara is typing…')
    expect(typingLabel(['Sara', 'Omar'])).toBe('Sara and Omar are typing…')
    expect(typingLabel(['Sara', 'Omar', 'Ziad'])).toBe('Several people are typing…')
  })
})
