/**
 * Loader for Spotify's embed IFrame API.
 *
 * The script calls a global when it is ready, so the promise is shared: two players on one page
 * must not both define window.onSpotifyIframeApiReady.
 */
const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1'
const TIMEOUT_MS = 8000

let apiPromise = null

export function loadSpotifyEmbedApi() {
  apiPromise ??= new Promise((resolve, reject) => {
    const fail = () => {
      clearTimeout(timeout)
      apiPromise = null
      reject(new Error('Could not load the Spotify player. Check your connection or ad blocker.'))
    }
    const timeout = setTimeout(fail, TIMEOUT_MS)

    window.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timeout)
      resolve(api)
    }
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = fail
    document.head.appendChild(script)
  })
  return apiPromise
}

/**
 * Spotify's embed exposes no title, so ask the public oEmbed endpoint. It needs no key.
 * Failure is fine — the room falls back to a label built from the URL.
 */
const metadataCache = new Map()

export async function spotifyMetadata(url) {
  if (metadataCache.has(url)) return metadataCache.get(url)
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
    if (!res.ok) throw new Error(`oEmbed ${res.status}`)
    const data = await res.json()
    const metadata = { title: data.title || '', artwork: data.thumbnail_url || '' }
    metadataCache.set(url, metadata)
    return metadata
  } catch {
    const empty = { title: '', artwork: '' }
    metadataCache.set(url, empty)
    return empty
  }
}
