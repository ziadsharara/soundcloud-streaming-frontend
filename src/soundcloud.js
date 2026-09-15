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

export const SOUNDCLOUD_URL = /^https?:\/\/((www|m|on)\.)?soundcloud\.com\/\S+/i

let apiPromise = null

export function loadWidgetApi() {
  if (window.SC?.Widget) return Promise.resolve(window.SC)
  apiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://w.soundcloud.com/player/api.js'
    script.onload = () => resolve(window.SC)
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Could not load the SoundCloud player. Check your connection or ad blocker.'))
    }
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
