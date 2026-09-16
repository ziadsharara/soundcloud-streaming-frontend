/**
 * The music services SoundStream accepts links from, and how closely each one can be synced.
 *
 * The sync level is decided by the service, not by us:
 *  - SoundCloud and YouTube publish real player APIs, so listeners can be held to the host's playhead.
 *  - Spotify's embed obeys play/pause/seek but starts preview playback for everyone.
 *  - Anghami publishes no player API at all, so its links are shared, not driven.
 *
 * YouTube is one provider with two faces: music.youtube.com and ordinary youtube.com links share
 * video ids and the same player API, and plenty of songs only exist on YouTube proper.
 */
export const PROVIDERS = {
  soundcloud: {
    id: 'soundcloud',
    label: 'SoundCloud',
    sync: 'full',
    syncLabel: 'Full sync',
    syncNote: 'Full track, everyone in sync',
    brand: '#ff5500',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube Music',
    altLabel: 'YouTube',
    sync: 'full',
    syncLabel: 'Full sync',
    syncNote: 'Full track, everyone in sync — YouTube Music and plain YouTube links both work',
    brand: '#ff0000',
  },
  spotify: {
    id: 'spotify',
    label: 'Spotify',
    sync: 'preview',
    syncLabel: 'Preview only',
    syncNote: 'Plays a 30-second preview only',
    brand: '#1db954',
  },
  anghami: {
    id: 'anghami',
    label: 'Anghami',
    sync: 'none',
    syncLabel: 'Link only',
    syncNote: 'Opens in the Anghami app',
    brand: '#7b2ff7',
  },
}

/** Display order: the services that can actually hold a room together come first. */
export const PROVIDER_LIST = [
  PROVIDERS.soundcloud,
  PROVIDERS.youtube,
  PROVIDERS.spotify,
  PROVIDERS.anghami,
]

const HOSTS = new Map([
  ['soundcloud.com', 'soundcloud'],
  ['www.soundcloud.com', 'soundcloud'],
  ['m.soundcloud.com', 'soundcloud'],
  ['on.soundcloud.com', 'soundcloud'],
  ['music.youtube.com', 'youtube'],
  ['youtube.com', 'youtube'],
  ['www.youtube.com', 'youtube'],
  ['m.youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['open.spotify.com', 'spotify'],
  ['play.spotify.com', 'spotify'],
  ['spotify.link', 'spotify'],
  ['anghami.com', 'anghami'],
  ['www.anghami.com', 'anghami'],
  ['play.anghami.com', 'anghami'],
  ['open.anghami.com', 'anghami'],
])

const SPOTIFY_PATH = /^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)\/?$/
const YOUTUBE_PATH = /^\/(watch|playlist)\/?$|^\/([A-Za-z0-9_-]{5,})\/?$/

/** Returns the provider id for a share link, or '' when it is not a link we accept. */
export function detectProvider(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    return ''
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname === '/') return ''
  const provider = HOSTS.get(url.hostname.toLowerCase())
  if (!provider) return ''
  // A bare spotify.link short URL has no parsable type; everything else must look like a real entity.
  if (provider === 'spotify' && url.hostname !== 'spotify.link' && !SPOTIFY_PATH.test(url.pathname)) return ''
  if (provider === 'youtube' && !YOUTUBE_PATH.test(url.pathname)) return ''
  return provider
}

export const isSupportedUrl = (value) => Boolean(detectProvider(value))

export const providerMeta = (value) => PROVIDERS[detectProvider(value)] || null

export function isYouTubeMusicUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase() === 'music.youtube.com'
  } catch {
    return false
  }
}

/**
 * What to show beside a link: the service's name and which mark to draw.
 * YouTube Music and YouTube are the same player but not the same brand.
 */
export function providerBadge(value) {
  const id = detectProvider(value)
  if (!id) return null
  const meta = PROVIDERS[id]
  if (id !== 'youtube') return { ...meta, logo: id }
  const music = isYouTubeMusicUrl(value)
  return { ...meta, label: music ? meta.label : meta.altLabel, logo: music ? 'youtubemusic' : 'youtube' }
}

export function parseUrls(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .map((url) => url.trim())
    .filter(Boolean)
}

/** True for links that play several tracks by themselves, so we must not auto-advance past them. */
export function isSetUrl(value) {
  const provider = detectProvider(value)
  if (!provider) return false
  try {
    const url = new URL(value)
    const path = url.pathname.toLowerCase()
    if (provider === 'soundcloud') return path.includes('/sets/')
    if (provider === 'youtube') return path.includes('/playlist') || url.searchParams.has('list')
    return path.includes('/playlist/') || path.includes('/album/')
  } catch {
    return false
  }
}

export function urlLabel(value) {
  try {
    const url = new URL(value)
    const parts = url.pathname
      .split('/')
      .filter(Boolean)
      .filter((part) => !/^intl-[a-z-]+$/i.test(part))
      .map((part) => decodeURIComponent(part))
    const provider = detectProvider(value)
    if (provider === 'soundcloud') {
      const labelParts = parts.includes('sets') ? parts.slice(-1) : parts.slice(-2)
      return labelParts.join(' · ').replaceAll('-', ' ') || 'SoundCloud link'
    }
    if (provider === 'youtube') {
      return url.searchParams.has('list') && !url.searchParams.has('v') ? 'Playlist' : 'Track'
    }
    // Spotify and Anghami paths end in an opaque id, so lead with the entity type.
    const [type] = parts
    const slug = parts.slice(1, -1).join(' ').replaceAll('-', ' ')
    return (slug || type || 'Track').replace(/^\w/, (c) => c.toUpperCase())
  } catch {
    return 'Music link'
  }
}

/** Spotify's embed controller wants a spotify: URI; fall back to the URL for short links. */
export function spotifyUri(value) {
  try {
    const match = SPOTIFY_PATH.exec(new URL(value).pathname)
    return match ? `spotify:${match[1]}:${match[2]}` : value
  } catch {
    return value
  }
}

/** The YouTube IFrame player takes a bare video id, or a playlist id for a set. */
export function youtubeIds(value) {
  try {
    const url = new URL(value)
    const videoId = url.hostname === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v')
    return { videoId: videoId || '', playlistId: url.searchParams.get('list') || '' }
  } catch {
    return { videoId: '', playlistId: '' }
  }
}
