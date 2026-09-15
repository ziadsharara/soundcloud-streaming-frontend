// SoundCloud Widget API: https://developers.soundcloud.com/docs/api/html5-widget

export const WIDGET_OPTIONS = {
  visual: true,
  show_comments: false,
  show_reposts: false,
  show_teaser: false,
  hide_related: true,
  buying: false,
  sharing: false,
  download: false,
}

const SOUNDCLOUD_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'])

export function isSoundCloudUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return (
      url.protocol === 'https:' &&
      SOUNDCLOUD_HOSTS.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname !== '/'
    )
  } catch {
    return false
  }
}

export function parseSoundCloudUrls(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean)
}

export function isSoundCloudSetUrl(value) {
  if (!isSoundCloudUrl(value)) return false
  try {
    return new URL(value).pathname.toLowerCase().includes('/sets/')
  } catch {
    return false
  }
}

export function soundCloudUrlLabel(value) {
  try {
    const url = new URL(value)
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
    const labelParts = parts.includes('sets') ? parts.slice(-1) : parts.slice(-2)
    return labelParts.join(' · ').replaceAll('-', ' ') || 'SoundCloud link'
  } catch {
    return 'SoundCloud link'
  }
}

let apiPromise = null
const WIDGET_API_TIMEOUT_MS = 8000

export function loadWidgetApi() {
  if (window.SC?.Widget) return Promise.resolve(window.SC)
  apiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://w.soundcloud.com/player/api.js'
    const failed = () => {
      clearTimeout(timeout)
      script.remove()
      apiPromise = null
      reject(new Error('Could not load the SoundCloud player. Check your connection or ad blocker.'))
    }
    const timeout = setTimeout(failed, WIDGET_API_TIMEOUT_MS)
    script.onload = () => {
      if (!window.SC?.Widget) {
        failed()
        return
      }
      clearTimeout(timeout)
      resolve(window.SC)
    }
    script.onerror = failed
    document.head.appendChild(script)
  })
  return apiPromise
}

export function embedUrl(trackUrl, autoPlay = false) {
  const params = new URLSearchParams({ url: trackUrl, auto_play: String(autoPlay) })
  Object.entries(WIDGET_OPTIONS).forEach(([key, value]) => params.set(key, String(value)))
  return `https://w.soundcloud.com/player/?${params}`
}

/** SoundCloud serves 100px "-large" artwork by default; ask for a sharper size. */
export function largeArtwork(url) {
  return url ? url.replace('-large.', '-t300x300.') : ''
}
