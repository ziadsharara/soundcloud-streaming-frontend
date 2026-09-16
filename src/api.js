const REQUEST_TIMEOUT_MS = 15000
const configuredBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/$/, '')

function responseMessage(res, data) {
  if (data && typeof data === 'object' && (data.detail || data.message)) return data.detail || data.message
  if (res.status === 404 && res.headers.get('x-vercel-error')) {
    return 'SoundStream isn’t reachable right now. Try again in a moment.'
  }
  return ''
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${configuredBase}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('SoundStream is taking too long to answer. Try again.')
    throw new Error('Can’t reach SoundStream. Check your connection and try again.')
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      message = responseMessage(res, data) || message
    } catch {
      message = responseMessage(res) || message
    }
    throw new Error(message)
  }
  if (res.status === 204) return null
  const contentType = res.headers.get('content-type') || ''
  return contentType.includes('application/json') ? res.json() : null
}

export const api = {
  listRooms: () => request('/rooms'),
  getRoom: (id) => request(`/rooms/${encodeURIComponent(id)}`),
  createRoom: (name, hostName, hostAvatarId) =>
    request('/rooms', { method: 'POST', body: { name, hostName, hostAvatarId } }),
  closeRoom: (id, hostToken) =>
    request(`/rooms/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Host-Token': hostToken } }),
}

export function webSocketUrl() {
  const configuredSocket = import.meta.env.VITE_WS_URL?.trim()
  if (configuredSocket) return configuredSocket.replace(/\/$/, '')
  const apiUrl = new URL(configuredBase, window.location.origin)
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${apiUrl.host}/ws`
}

// localStorage can throw (private mode, blocked storage) — never let that break the app.
function storage(fn, fallback) {
  try {
    return fn(window.localStorage)
  } catch {
    return fallback
  }
}

const tokenKey = (roomId) => `soundstream:host:${roomId}`

export const getHostToken = (roomId) => storage((s) => s.getItem(tokenKey(roomId)), null)
export const setHostToken = (roomId, token) => storage((s) => s.setItem(tokenKey(roomId), token))
export const clearHostToken = (roomId) => storage((s) => s.removeItem(tokenKey(roomId)))
