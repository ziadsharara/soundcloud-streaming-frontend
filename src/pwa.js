import { ref } from 'vue'

/**
 * Installing SoundStream to a phone or desktop, the way a web player does it.
 *
 * Chrome and Edge fire `beforeinstallprompt` — possibly before any component has mounted, which
 * is why the listener is registered at module scope rather than in a component. iOS Safari fires
 * nothing at all and installs only through the share sheet, so it gets a short instruction instead.
 */
const installPrompt = ref(null)
const installed = ref(false)

/** True once the app is running from the home screen / app window rather than a browser tab. */
export function isStandaloneDisplay(win = typeof window === 'undefined' ? undefined : window) {
  if (!win) return false
  const standaloneMatch = win.matchMedia?.('(display-mode: standalone)')?.matches
  // iOS Safari predates display-mode and reports it on navigator instead.
  return Boolean(standaloneMatch || win.navigator?.standalone)
}

/** iOS never exposes an install prompt, so it needs the share-sheet instruction. */
export function isIosDevice(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!nav) return false
  const ua = nav.userAgent || ''
  const iPadOnDesktopUa = /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1
  return /iPad|iPhone|iPod/.test(ua) || iPadOnDesktopUa
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's own mini-infobar from firing so the button in the header is the one prompt.
    event.preventDefault()
    installPrompt.value = event
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    installPrompt.value = null
  })
}

export function usePwaInstall() {
  const standalone = isStandaloneDisplay()

  async function install() {
    const event = installPrompt.value
    if (!event) return 'unavailable'
    installPrompt.value = null
    event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') installed.value = true
    return outcome
  }

  return {
    installed,
    installPrompt,
    standalone,
    canPrompt: installPrompt,
    needsIosInstructions: isIosDevice() && !standalone,
    install,
  }
}
