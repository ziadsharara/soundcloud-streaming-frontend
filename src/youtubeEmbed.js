/**
 * Loader for the YouTube IFrame Player API.
 *
 * The script calls one global when it is ready, so the promise is shared: two players on a page
 * must not both define window.onYouTubeIframeAPIReady.
 */
const API_SRC = 'https://www.youtube.com/iframe_api'
const TIMEOUT_MS = 8000

let apiPromise = null

export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve, reject) => {
    const fail = () => {
      clearTimeout(timeout)
      apiPromise = null
      reject(new Error('YouTube\u2019s player didn\u2019t load. Check your connection or ad blocker.'))
    }
    const timeout = setTimeout(fail, TIMEOUT_MS)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      clearTimeout(timeout)
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = fail
    document.head.appendChild(script)
  })
  return apiPromise
}
