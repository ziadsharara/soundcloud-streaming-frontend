import { describe, expect, it } from 'vitest'
import { isIosDevice, isStandaloneDisplay } from './pwa'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120'

describe('install detection', () => {
  it('knows when the app is already running standalone', () => {
    const installed = { matchMedia: () => ({ matches: true }), navigator: {} }
    const inTab = { matchMedia: () => ({ matches: false }), navigator: {} }

    expect(isStandaloneDisplay(installed)).toBe(true)
    expect(isStandaloneDisplay(inTab)).toBe(false)
  })

  it('falls back to the iOS-only navigator flag, which predates display-mode', () => {
    const iosInstalled = { matchMedia: () => ({ matches: false }), navigator: { standalone: true } }

    expect(isStandaloneDisplay(iosInstalled)).toBe(true)
  })

  it('survives a browser without matchMedia', () => {
    expect(isStandaloneDisplay({ navigator: {} })).toBe(false)
    expect(isStandaloneDisplay(undefined)).toBe(false)
  })

  it('spots iOS, including an iPad that reports a desktop user agent', () => {
    expect(isIosDevice({ userAgent: IPHONE })).toBe(true)
    expect(isIosDevice({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 })).toBe(true)
    expect(isIosDevice({ userAgent: MAC, maxTouchPoints: 0 })).toBe(false)
    expect(isIosDevice(undefined)).toBe(false)
  })
})
