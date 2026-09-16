/**
 * The music services SoundStream accepts links from.
 *
 * Both publish real player APIs, so every room stays in true sync — there is no second tier and
 * nothing to warn people about. Spotify (embeds only ever play a ~30s preview) and Anghami (no
 * player API at all) were dropped rather than shipped as a worse experience wearing the same badge.
 *
 * YouTube is one provider with two faces: music.youtube.com and ordinary youtube.com links share
 * video ids and the same player API, and plenty of songs only exist on YouTube proper.
 */
export const PROVIDERS = {
  soundcloud: {
    id: 'soundcloud',
    label: 'SoundCloud',
    brand: '#ff5500',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube Music',
    altLabel: 'YouTube',
    brand: '#ff0000',
  },
}

/** What the landing page lists. YouTube earns two cards because people think of them separately. */
export const SOURCE_CARDS = [
  {
    logo: 'soundcloud',
    label: 'SoundCloud',
    note: 'Any public song, playlist or album link.',
  },
  {
    logo: 'youtubemusic',
    label: 'YouTube Music',
    note: 'Anything you listen to in YouTube Music.',
  },
  {
    logo: 'youtube',
    label: 'YouTube',
    note: 'For the songs that only exist as a YouTube video.',
  },
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
])

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
    if (provider === 'soundcloud') return url.pathname.toLowerCase().includes('/sets/')
    return url.pathname.toLowerCase().includes('/playlist') || url.searchParams.has('list')
  } catch {
    return false
  }
}

export function urlLabel(value) {
  try {
    const url = new URL(value)
    const provider = detectProvider(value)
    if (provider === 'youtube') {
      return url.searchParams.has('list') && !url.searchParams.has('v') ? 'Playlist' : 'Track'
    }
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
    const labelParts = parts.includes('sets') ? parts.slice(-1) : parts.slice(-2)
    return labelParts.join(' · ').replaceAll('-', ' ') || 'SoundCloud link'
  } catch {
    return 'Music link'
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
