import { describe, expect, it } from 'vitest'
import {
  embedUrl,
  isSoundCloudSetUrl,
  isSoundCloudUrl,
  largeArtwork,
  parseSoundCloudUrls,
  soundCloudUrlLabel,
} from './soundcloud'

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

  it('parses a multiline queue and ignores blank lines', () => {
    expect(parseSoundCloudUrls(' https://soundcloud.com/a/one\n\nhttps://soundcloud.com/b/two ')).toEqual([
      'https://soundcloud.com/a/one',
      'https://soundcloud.com/b/two',
    ])
  })

  it('recognizes playlists and albums from their set URLs', () => {
    expect(isSoundCloudSetUrl('https://soundcloud.com/artist/sets/public-album')).toBe(true)
    expect(isSoundCloudSetUrl('https://soundcloud.com/artist/single')).toBe(false)
  })

  it('creates a readable label without requiring the SoundCloud API', () => {
    expect(soundCloudUrlLabel('https://soundcloud.com/my-artist/my-song')).toBe('my artist · my song')
    expect(soundCloudUrlLabel('https://soundcloud.com/my-artist/sets/my-album')).toBe('my album')
  })

  it('requests larger artwork', () => {
    expect(largeArtwork('https://i1.sndcdn.com/artworks-id-large.jpg')).toContain('-t300x300.')
  })
})
