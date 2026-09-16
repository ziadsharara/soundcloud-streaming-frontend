/**
 * The music services SoundStream accepts links from, and how closely each one can be synced.
 *
 * SoundCloud is the only free source that plays full tracks under our control. Spotify's embed
 * obeys play/pause/seek but starts preview playback for everyone, and Anghami publishes no player
 * API at all, so its links are handed to the listener to open themselves.
 */
export const PROVIDERS = {
  soundcloud: {
    id: 'soundcloud',
    label: 'SoundCloud',
    sync: 'full',
    syncNote: 'Full track, everyone in sync',
    marker: 'coral',
  },
  spotify: {
    id: 'spotify',
    label: 'Spotify',
    sync: 'preview',
    syncNote: 'Spotify only lets embeds play a ~30s preview',
    marker: 'mint',
  },
  anghami: {
    id: 'anghami',
    label: 'Anghami',
    sync: 'none',
    syncNote: 'No player API — opens in Anghami',
    marker: 'grape',
  },
}

const HOSTS = new Map([
  ['soundcloud.com', 'soundcloud'],
  ['www.soundcloud.com', 'soundcloud'],
  ['m.soundcloud.com', 'soundcloud'],
  ['on.soundcloud.com', 'soundcloud'],
  ['open.spotify.com', 'spotify'],
  ['play.spotify.com', 'spotify'],
  ['spotify.link', 'spotify'],
  ['anghami.com', 'anghami'],
  ['www.anghami.com', 'anghami'],
  ['play.anghami.com', 'anghami'],
  ['open.anghami.com', 'anghami'],
])

const SPOTIFY_PATH = /^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)\/?$/

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
  return provider
}

export const isSupportedUrl = (value) => Boolean(detectProvider(value))

export const providerMeta = (value) => PROVIDERS[detectProvider(value)] || null

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
    const path = new URL(value).pathname.toLowerCase()
    if (provider === 'soundcloud') return path.includes('/sets/')
    if (provider === 'spotify') return path.includes('/playlist/') || path.includes('/album/')
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

export function anghamiUrl(value) {
  return isSupportedUrl(value) && detectProvider(value) === 'anghami' ? value : ''
}
