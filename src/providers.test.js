import { describe, expect, it } from 'vitest'
import { detectProvider, isSetUrl, isSupportedUrl, parseUrls, spotifyUri, urlLabel } from './providers'

describe('music providers', () => {
  it('recognises links from each supported service', () => {
    expect(detectProvider('https://soundcloud.com/forss/flickermood')).toBe('soundcloud')
    expect(detectProvider('https://on.soundcloud.com/AbCdEf')).toBe('soundcloud')
    expect(detectProvider('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe('spotify')
    expect(detectProvider('https://open.spotify.com/intl-de/album/1ATL5GLyefJaxhQzSPVrLX')).toBe('spotify')
    expect(detectProvider('https://play.anghami.com/song/1234567')).toBe('anghami')
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

  it('rejects Spotify URLs that are not a playable entity', () => {
    expect(isSupportedUrl('https://open.spotify.com/user/someone')).toBe(false)
    expect(isSupportedUrl('https://open.spotify.com/track/../../etc')).toBe(false)
  })

  it('knows which links play more than one track on their own', () => {
    expect(isSetUrl('https://soundcloud.com/artist/sets/summer')).toBe(true)
    expect(isSetUrl('https://soundcloud.com/artist/one-song')).toBe(false)
    expect(isSetUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true)
    expect(isSetUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(false)
  })

  it('converts Spotify links into the URI its embed controller expects', () => {
    expect(spotifyUri('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(
      'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
    )
    expect(spotifyUri('https://open.spotify.com/intl-de/album/1ATL5GLyefJaxhQzSPVrLX')).toBe(
      'spotify:album:1ATL5GLyefJaxhQzSPVrLX',
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
  })
})
