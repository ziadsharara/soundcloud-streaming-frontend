import { describe, expect, it } from 'vitest'
import { selectLatestPlayback } from './playback'

describe('playback state selection', () => {
  it('uses the first available server snapshot', () => {
    const snapshot = { trackUrl: 'https://soundcloud.com/a/song', serverTime: 100 }

    expect(selectLatestPlayback(null, snapshot)).toBe(snapshot)
  })

  it('keeps a newer WebSocket event when a stale request finishes later', () => {
    const liveEvent = { trackUrl: 'https://soundcloud.com/a/new', serverTime: 200 }
    const staleSnapshot = { trackUrl: 'https://soundcloud.com/a/old', serverTime: 100 }

    expect(selectLatestPlayback(liveEvent, staleSnapshot)).toBe(liveEvent)
  })

  it('does not clear active playback with an empty stale snapshot', () => {
    const liveEvent = { trackUrl: 'https://soundcloud.com/a/new', serverTime: 200 }

    expect(selectLatestPlayback(liveEvent, null)).toBe(liveEvent)
  })
})
