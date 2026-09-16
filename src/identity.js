import { AVATARS, DEFAULT_AVATAR } from './avatars'

const NAME_KEY = 'soundstream:name'
const AVATAR_KEY = 'soundstream:avatar'
const MEMBER_KEY = 'soundstream:member-id'

function storage(fn, fallback) {
  try {
    return fn(window.localStorage)
  } catch {
    return fallback
  }
}

const isKnownAvatar = (id) => AVATARS.some((avatar) => avatar.id === id)

function randomMemberId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replaceAll('-', '')
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * A stable id for this browser, so one person stays one member across reconnects and tabs.
 * Read receipts are counted per person, and a socket id would reset every time the socket did.
 */
export function getMemberId() {
  const saved = storage((s) => s.getItem(MEMBER_KEY), '') || ''
  if (/^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved
  const fresh = randomMemberId()
  storage((s) => s.setItem(MEMBER_KEY, fresh))
  return fresh
}

/** The name and face this browser shows in rooms. Chosen once, reused everywhere. */
export function getIdentity() {
  const name = storage((s) => s.getItem(NAME_KEY), '') || ''
  const avatarId = storage((s) => s.getItem(AVATAR_KEY), '') || ''
  return {
    name: name.slice(0, 40),
    avatarId: isKnownAvatar(avatarId) ? avatarId : DEFAULT_AVATAR,
    memberId: getMemberId(),
  }
}

export function setIdentity({ name, avatarId }) {
  storage((s) => s.setItem(NAME_KEY, String(name || '').slice(0, 40)))
  if (isKnownAvatar(avatarId)) storage((s) => s.setItem(AVATAR_KEY, avatarId))
}

export const hasIdentity = () => Boolean(getIdentity().name)

/** A face for whoever has not picked one, kept stable per name so it does not flicker. */
export function avatarFor(name, avatarId) {
  if (isKnownAvatar(avatarId)) return avatarId
  const seed = [...String(name || '')].reduce((total, char) => total + char.charCodeAt(0), 0)
  return AVATARS[seed % AVATARS.length].id
}
