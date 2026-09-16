import { describe, expect, it } from 'vitest'
import {
  detectProvider,
  isSetUrl,
  isSupportedUrl,
  parseUrls,
  providerBadge,
  urlLabel,
  youtubeIds,
} from './providers'

describe('music providers', () => {
  it('accepts SoundCloud links in every share shape', () => {
    expect(detectProvider('https://soundcloud.com/forss/flickermood')).toBe('soundcloud')
    expect(detectProvider('https://on.soundcloud.com/AbCdEf')).toBe('soundcloud')
    expect(detectProvider('https://m.soundcloud.com/artist/track')).toBe('soundcloud')
  })

  it('treats YouTube Music and plain YouTube as one provider', () => {
    expect(detectProvider('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://music.youtube.com/playlist?list=PLabc123')).toBe('youtube')
  })

  it('no longer accepts services that cannot be synced', () => {
    expect(isSupportedUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(false)
    expect(isSupportedUrl('https://play.anghami.com/song/1234567')).toBe(false)
    expect(isSupportedUrl('https://music.apple.com/us/album/thriller/1440843616')).toBe(false)
  })

  it('badges YouTube Music and YouTube with their own name and mark', () => {
    expect(providerBadge('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      label: 'YouTube Music',
      logo: 'youtubemusic',
    })
    expect(providerBadge('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      label: 'YouTube',
      logo: 'youtube',
    })
    expect(providerBadge('https://soundcloud.com/a/b')).toMatchObject({
      label: 'SoundCloud',
      logo: 'soundcloud',
    })
    expect(providerBadge('https://open.spotify.com/track/abc')).toBeNull()
  })

  it('pulls the video and playlist ids the YouTube player needs', () => {
    expect(youtubeIds('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      videoId: 'dQw4w9WgXcQ',
      playlistId: '',
    })
    expect(youtubeIds('https://youtu.be/dQw4w9WgXcQ')).toEqual({ videoId: 'dQw4w9WgXcQ', playlistId: '' })
    expect(youtubeIds('https://music.youtube.com/playlist?list=PLabc123')).toEqual({
      videoId: '',
      playlistId: 'PLabc123',
    })
  })

  it('rejects insecure, credentialed and lookalike hosts', () => {
    expect(isSupportedUrl('http://soundcloud.com/a/b')).toBe(false)
    expect(isSupportedUrl('https://soundcloud.com.evil.example/a/b')).toBe(false)
    expect(isSupportedUrl('https://user@soundcloud.com/a/b')).toBe(false)
    expect(isSupportedUrl('https://soundcloud.com:8443/a/b')).toBe(false)
    expect(isSupportedUrl('https://soundcloud.com/')).toBe(false)
    expect(isSupportedUrl('https://www.youtube.com/feed/subscriptions')).toBe(false)
    expect(isSupportedUrl('javascript:alert(1)')).toBe(false)
    expect(isSupportedUrl('')).toBe(false)
  })

  it('knows which links play more than one track on their own', () => {
    expect(isSetUrl('https://soundcloud.com/artist/sets/summer')).toBe(true)
    expect(isSetUrl('https://soundcloud.com/artist/one-song')).toBe(false)
    expect(isSetUrl('https://music.youtube.com/playlist?list=PLabc123')).toBe(true)
    expect(isSetUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })

  it('splits pasted lists on whitespace and commas', () => {
    expect(parseUrls('https://a.test/1\nhttps://a.test/2 , https://a.test/3')).toEqual([
      'https://a.test/1',
      'https://a.test/2',
      'https://a.test/3',
    ])
  })

  it('builds a readable label for each source', () => {
    expect(urlLabel('https://soundcloud.com/forss/flickermood')).toBe('forss · flickermood')
    expect(urlLabel('https://music.youtube.com/playlist?list=PLabc123')).toBe('Playlist')
    expect(urlLabel('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('Track')
  })
})
