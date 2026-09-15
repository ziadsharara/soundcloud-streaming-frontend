const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/

export function parseRoomCode(value, baseUrl = window.location.origin) {
  const input = String(value || '').trim()
  if (!input) return ''

  let candidate = input
  if (input.includes('/') || input.includes('?') || input.includes('#')) {
    try {
      const url = new URL(input, baseUrl)
      candidate = url.pathname.split('/').filter(Boolean).pop() || ''
    } catch {
      return ''
    }
  }

  const normalized = candidate.trim().toUpperCase()
  return ROOM_CODE.test(normalized) ? normalized : ''
}
