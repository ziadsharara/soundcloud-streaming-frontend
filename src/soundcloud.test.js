import { describe, expect, it } from 'vitest'
import { embedUrl, isSoundCloudUrl, largeArtwork } from './soundcloud'

describe('SoundCloud helpers', () => {
  it.each([
    'https://soundcloud.com/artist/track',
    'https://soundcloud.com/artist/sets/public-playlist',
    'https://soundcloud.com/artist/sets/public-album',
    'https://www.soundcloud.com/artist/track',
    'https://m.soundcloud.com/artist/track',
    'https://on.soundcloud.com/AbCdEf',
  ])('accepts supported SoundCloud links', (url) => expect(isSoundCloudUrl(url)).toBe(true))

  it.each([
    'http://soundcloud.com/artist/track',
    'https://soundcloud.com.evil.example/artist/track',
    'https://user@soundcloud.com/artist/track',
    'https://soundcloud.com:8443/artist/track',
    'https://soundcloud.com/',
    'not a url',
  ])('rejects unsafe or incomplete links', (url) => expect(isSoundCloudUrl(url)).toBe(false))

  it('builds the widget URL with autoplay and privacy options', () => {
    const url = new URL(embedUrl('https://soundcloud.com/artist/track', true))
    expect(url.origin).toBe('https://w.soundcloud.com')
    expect(url.searchParams.get('url')).toBe('https://soundcloud.com/artist/track')
    expect(url.searchParams.get('auto_play')).toBe('true')
    expect(url.searchParams.get('show_comments')).toBe('false')
  })

  it('requests larger artwork', () => {
    expect(largeArtwork('https://i1.sndcdn.com/artworks-id-large.jpg')).toContain('-t300x300.')
  })
})
