import { describe, expect, it } from 'vitest'
import { looksLikeSeek, selectLatestPlayback } from './playback'

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

describe('looksLikeSeek', () => {
  const at = (positionMs, serverTime, playing = true) => ({
    trackUrl: 'https://soundcloud.com/a/b',
    positionMs,
    serverTime,
    playing,
  })

  it('is false while the host simply plays on', () => {
    expect(looksLikeSeek(at(10_000, 1000), at(15_000, 6000))).toBe(false)
  })

  it('is true when the host jumps forward or back', () => {
    expect(looksLikeSeek(at(10_000, 1000), at(90_000, 6000))).toBe(true)
    expect(looksLikeSeek(at(90_000, 1000), at(10_000, 6000))).toBe(true)
  })

  it('is false while the host is paused and nothing moves', () => {
    expect(looksLikeSeek(at(10_000, 1000, false), at(10_000, 60_000, false))).toBe(false)
  })

  it('is true when the host scrubs while paused', () => {
    expect(looksLikeSeek(at(10_000, 1000, false), at(40_000, 2000, false))).toBe(true)
  })

  it('says nothing about a change of track, which is handled by loading it', () => {
    const other = { trackUrl: 'https://soundcloud.com/a/other', positionMs: 0, serverTime: 6000, playing: true }
    expect(looksLikeSeek(at(10_000, 1000), other)).toBe(false)
    expect(looksLikeSeek(null, at(0, 1))).toBe(false)
  })
})
