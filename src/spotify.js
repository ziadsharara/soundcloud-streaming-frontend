/**
 * Host-only Spotify connect, using the browser PKCE flow so no client secret ever ships.
 *
 * Spotify's Web API is in development mode for hobby apps: since February 2026 only five
 * allow-listed Premium accounts can authorise an app, and extended quota needs a registered
 * company. So this is a convenience for the host's own library, never a requirement for guests.
 */
const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim()
const SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read'
const TOKEN_KEY = 'soundstream:spotify-token'
const VERIFIER_KEY = 'soundstream:spotify-verifier'
const RETURN_KEY = 'soundstream:spotify-return'
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

export const spotifyConfigured = Boolean(CLIENT_ID)
export const spotifyRedirectUri = () => `${window.location.origin}/spotify/callback`

function session(fn, fallback) {
  try {
    return fn(window.sessionStorage)
  } catch {
    return fallback
  }
}

function readToken() {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can be blocked; the token then lives only for this page view.
  }
}

export const spotifyConnected = () => Boolean(readToken()?.refresh_token || readToken()?.access_token)

export function disconnectSpotify() {
  writeToken(null)
}

function randomVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  return [...bytes].map((byte) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[byte % 62]).join('')
}

function base64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Sends the host to Spotify's consent screen; they come back to /spotify/callback. */
export async function connectSpotify(returnTo) {
  if (!spotifyConfigured) throw new Error('Spotify isn\u2019t set up on this site yet.')
  const verifier = randomVerifier()
  const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  session((s) => s.setItem(VERIFIER_KEY, verifier))
  session((s) => s.setItem(RETURN_KEY, returnTo || '/'))

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

async function requestToken(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description || 'Spotify couldn\u2019t sign you in.')
  writeToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token || readToken()?.refresh_token || '',
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  })
  return data.access_token
}

/** Completes the redirect. Returns where the host should be sent back to. */
export async function completeSpotifyLogin(search = window.location.search) {
  const params = new URLSearchParams(search)
  const returnTo = session((s) => s.getItem(RETURN_KEY), '/') || '/'
  session((s) => s.removeItem(RETURN_KEY))
  const error = params.get('error')
  if (error) throw Object.assign(new Error(`Spotify sign-in was cancelled (${error}).`), { returnTo })

  const code = params.get('code')
  const verifier = session((s) => s.getItem(VERIFIER_KEY), '')
  session((s) => s.removeItem(VERIFIER_KEY))
  if (!code || !verifier) throw Object.assign(new Error('That Spotify sign-in link has expired.'), { returnTo })

  await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotifyRedirectUri(),
    code_verifier: verifier,
  })
  return returnTo
}

async function accessToken() {
  const token = readToken()
  if (!token) throw new Error('Connect Spotify first.')
  if (token.access_token && Date.now() < token.expires_at - 30_000) return token.access_token
  if (!token.refresh_token) throw new Error('Your Spotify session expired. Connect again.')
  return requestToken({ grant_type: 'refresh_token', refresh_token: token.refresh_token })
}

async function spotifyGet(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } })
  if (res.status === 401) {
    disconnectSpotify()
    throw new Error('Your Spotify session expired. Connect again.')
  }
  if (res.status === 403) {
    throw new Error('Spotify hasn’t approved this account for SoundStream yet.')
  }
  if (!res.ok) throw new Error(`Spotify request failed (${res.status}).`)
  return res.json()
}

const playlistItem = (playlist) => ({
  id: playlist.id,
  name: playlist.name,
  subtitle: `${playlist.tracks?.total ?? 0} tracks`,
  url: playlist.external_urls?.spotify || '',
  artwork: playlist.images?.[0]?.url || '',
})

export async function listSpotifyPlaylists() {
  const data = await spotifyGet('/me/playlists?limit=50')
  return (data.items || []).filter(Boolean).map(playlistItem).filter((item) => item.url)
}

export async function listSpotifyLikes() {
  const data = await spotifyGet('/me/tracks?limit=50')
  return (data.items || [])
    .map((item) => item.track)
    .filter(Boolean)
    .map((track) => ({
      id: track.id,
      name: track.name,
      subtitle: (track.artists || []).map((artist) => artist.name).join(', '),
      url: track.external_urls?.spotify || '',
      artwork: track.album?.images?.[0]?.url || '',
    }))
    .filter((item) => item.url)
}
