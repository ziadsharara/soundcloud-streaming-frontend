import { describe, expect, it } from 'vitest'
import { shouldNotify } from './notifications'

const base = { enabled: true, permission: 'granted', hidden: true, fromSelf: false }

describe('chat notification rules', () => {
  it('notifies for someone else’s message while the tab is hidden', () => {
    expect(shouldNotify(base)).toBe(true)
  })

  it('stays quiet while you are looking at the room', () => {
    expect(shouldNotify({ ...base, hidden: false })).toBe(false)
  })

  it('never notifies you about your own message', () => {
    expect(shouldNotify({ ...base, fromSelf: true })).toBe(false)
  })

  it('respects the permission and the preference', () => {
    expect(shouldNotify({ ...base, permission: 'default' })).toBe(false)
    expect(shouldNotify({ ...base, permission: 'denied' })).toBe(false)
    expect(shouldNotify({ ...base, enabled: false })).toBe(false)
  })
})
