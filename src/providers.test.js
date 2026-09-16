import { describe, expect, it } from 'vitest'
import {
  detectProvider,
  isSetUrl,
  isSupportedUrl,
  parseUrls,
  providerBadge,
  spotifyUri,
  urlLabel,
  youtubeIds,
} from './providers'

describe('music providers', () => {
  it('recognises links from each supported service', () => {
    expect(detectProvider('https://soundcloud.com/forss/flickermood')).toBe('soundcloud')
    expect(detectProvider('https://on.soundcloud.com/AbCdEf')).toBe('soundcloud')
    expect(detectProvider('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe('spotify')
    expect(detectProvider('https://open.spotify.com/intl-de/album/1ATL5GLyefJaxhQzSPVrLX')).toBe('spotify')
    expect(detectProvider('https://play.anghami.com/song/1234567')).toBe('anghami')
  })

  it('treats YouTube Music and plain YouTube as one provider', () => {
    expect(detectProvider('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://music.youtube.com/playlist?list=PLabc123')).toBe('youtube')
  })

  it('badges YouTube Music and YouTube with their own name and mark', () => {
    const music = providerBadge('https://music.youtube.com/watch?v=dQw4w9WgXcQ')
    const video = providerBadge('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    expect(music).toMatchObject({ id: 'youtube', label: 'YouTube Music', logo: 'youtubemusic' })
    expect(video).toMatchObject({ id: 'youtube', label: 'YouTube', logo: 'youtube' })
    expect(providerBadge('https://soundcloud.com/a/b')).toMatchObject({ label: 'SoundCloud', logo: 'soundcloud' })
    expect(providerBadge('https://not-music.example/x')).toBeNull()
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
    expect(isSupportedUrl('javascript:alert(1)')).toBe(false)
    expect(isSupportedUrl('')).toBe(false)
  })

  it('rejects links that are not a playable entity', () => {
    expect(isSupportedUrl('https://open.spotify.com/user/someone')).toBe(false)
    expect(isSupportedUrl('https://www.youtube.com/feed/subscriptions')).toBe(false)
  })

  it('knows which links play more than one track on their own', () => {
    expect(isSetUrl('https://soundcloud.com/artist/sets/summer')).toBe(true)
    expect(isSetUrl('https://soundcloud.com/artist/one-song')).toBe(false)
    expect(isSetUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true)
    expect(isSetUrl('https://music.youtube.com/playlist?list=PLabc123')).toBe(true)
    expect(isSetUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })

  it('converts Spotify links into the URI its embed controller expects', () => {
    expect(spotifyUri('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(
      'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
    )
  })

  it('splits pasted lists on whitespace and commas', () => {
    expect(parseUrls('https://a.test/1\nhttps://a.test/2 , https://a.test/3')).toEqual([
      'https://a.test/1',
      'https://a.test/2',
      'https://a.test/3',
    ])
  })

  it('builds a readable label without leaking locale segments', () => {
    expect(urlLabel('https://soundcloud.com/forss/flickermood')).toBe('forss · flickermood')
    expect(urlLabel('https://open.spotify.com/intl-de/album/1ATL5GLyefJaxhQzSPVrLX')).toBe('Album')
    expect(urlLabel('https://music.youtube.com/playlist?list=PLabc123')).toBe('Playlist')
  })
})
