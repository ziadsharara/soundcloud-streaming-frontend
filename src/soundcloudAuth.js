import { readonly, ref } from 'vue'
import { api, soundCloudConnectUrl } from './api'

const SESSION_KEY = 'soundstream:soundcloud-session'

const sessionId = ref(readSession())
const profile = ref(null)
const configured = ref(null)
const loading = ref(true)
const error = ref('')
let initialized = false

function readSession() {
  try {
    return window.localStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}

function saveSession(value) {
  sessionId.value = value
  try {
    if (value) window.localStorage.setItem(SESSION_KEY, value)
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private browsing can block storage.
  }
}

function consumeOAuthResult() {
  if (!window.location.hash) return
  const result = new URLSearchParams(window.location.hash.slice(1))
  const newSession = result.get('soundcloud_session')
  const oauthError = result.get('soundcloud_error')
  if (!newSession && !oauthError) return
  if (newSession) saveSession(newSession)
  if (oauthError) error.value = 'SoundCloud sign-in was cancelled or could not be completed.'
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
}

async function initializeSoundCloud() {
  if (initialized) return
  initialized = true
  consumeOAuthResult()
  loading.value = true
  try {
    const config = await api.soundCloudConfig()
    configured.value = config.configured
    if (sessionId.value) {
      try {
        profile.value = await api.soundCloudSession(sessionId.value)
      } catch {
        saveSession('')
        profile.value = null
      }
    }
  } catch (e) {
    configured.value = false
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function connect() {
  if (!configured.value) {
    error.value = 'SoundCloud login needs API credentials before it can be used.'
    return
  }
  window.location.assign(soundCloudConnectUrl())
}

async function disconnect() {
  const current = sessionId.value
  saveSession('')
  profile.value = null
  if (current) {
    try {
      await api.disconnectSoundCloud(current)
    } catch {
      // Local sign-out still succeeds if the server session already expired.
    }
  }
}

export function useSoundCloudAuth() {
  initializeSoundCloud()
  return {
    sessionId: readonly(sessionId),
    profile: readonly(profile),
    configured: readonly(configured),
    loading: readonly(loading),
    error: readonly(error),
    connect,
    disconnect,
  }
}
