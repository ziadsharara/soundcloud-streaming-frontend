import { describe, expect, it } from 'vitest'
import { REACTION_PALETTE, applyReactionUpdate, summariseReactions } from './reactions'

describe('summariseReactions', () => {
  const reactions = { m1: { '👍': ['me', 'you'], '🔥': ['you'] } }

  it('counts each emoji and marks the ones that are mine', () => {
    expect(summariseReactions(reactions, 'm1', 'me')).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '🔥', count: 1, mine: false },
    ])
  })

  it('is empty for a message nobody has reacted to', () => {
    expect(summariseReactions(reactions, 'm2', 'me')).toEqual([])
    expect(summariseReactions(undefined, 'm1', 'me')).toEqual([])
  })

  it('drops an emoji whose last member took it back', () => {
    expect(summariseReactions({ m1: { '👍': [] } }, 'm1', 'me')).toEqual([])
  })
})

describe('applyReactionUpdate', () => {
  it('replaces one message without touching the others', () => {
    const current = { m1: { '👍': ['me'] }, m2: { '🔥': ['you'] } }

    expect(applyReactionUpdate(current, { messageId: 'm1', reactions: { '❤️': ['me'] } })).toEqual({
      m1: { '❤️': ['me'] },
      m2: { '🔥': ['you'] },
    })
  })

  it('forgets a message once its last reaction is taken back', () => {
    expect(applyReactionUpdate({ m1: { '👍': ['me'] } }, { messageId: 'm1', reactions: {} })).toEqual({})
  })

  it('ignores a malformed update', () => {
    const current = { m1: { '👍': ['me'] } }
    expect(applyReactionUpdate(current, null)).toBe(current)
    expect(applyReactionUpdate(current, { reactions: {} })).toBe(current)
  })
})

it('offers a small, fixed palette', () => {
  expect(REACTION_PALETTE).toContain('👍')
  expect(new Set(REACTION_PALETTE).size).toBe(REACTION_PALETTE.length)
})
