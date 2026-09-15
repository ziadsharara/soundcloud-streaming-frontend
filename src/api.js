const configuredBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${configuredBase}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      message = data.detail || data.message || message
    } catch {
      // non-JSON error body
    }
    throw new Error(message)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  listRooms: () => request('/rooms'),
  getRoom: (id) => request(`/rooms/${encodeURIComponent(id)}`),
  createRoom: (name, hostName) => request('/rooms', { method: 'POST', body: { name, hostName } }),
  closeRoom: (id, hostToken) =>
    request(`/rooms/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Host-Token': hostToken } }),
  soundCloudConfig: () => request('/auth/soundcloud/config'),
  soundCloudSession: (sessionId) =>
    request('/auth/soundcloud/session', { headers: { Authorization: `Bearer ${sessionId}` } }),
  soundCloudLibrary: (sessionId) =>
    request('/soundcloud/library', { headers: { Authorization: `Bearer ${sessionId}` } }),
  disconnectSoundCloud: (sessionId) =>
    request('/auth/soundcloud/session', { method: 'DELETE', headers: { Authorization: `Bearer ${sessionId}` } }),
}

export function soundCloudConnectUrl() {
  return `${configuredBase}/auth/soundcloud/start?returnTo=${encodeURIComponent(window.location.origin)}`
}

export function webSocketUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
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

export const getNickname = () => storage((s) => s.getItem('soundstream:nickname'), '') || ''
export const setNickname = (name) => storage((s) => s.setItem('soundstream:nickname', name))
