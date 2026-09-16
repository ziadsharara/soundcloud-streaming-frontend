import { ref } from 'vue'

/**
 * Desktop/phone notifications for chat, for when the room is open in a background tab.
 *
 * Permission is only ever requested from a click: browsers penalise sites that ask on load, and
 * a prompt nobody asked for is the fastest way to get permanently blocked.
 */
const PREF_KEY = 'soundstream:notify'

export const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window

function storage(fn, fallback) {
  try {
    return fn(window.localStorage)
  } catch {
    return fallback
  }
}

const permission = () => (notificationsSupported ? Notification.permission : 'denied')

export const notificationsEnabled = ref(
  notificationsSupported && permission() === 'granted' && storage((s) => s.getItem(PREF_KEY), null) !== 'off',
)

/** Pure so the rules can be tested without a browser: no self-notifications, none while watching. */
export function shouldNotify({ enabled, permission: state, hidden, fromSelf }) {
  return Boolean(enabled) && state === 'granted' && Boolean(hidden) && !fromSelf
}

export async function enableNotifications() {
  if (!notificationsSupported) return 'unsupported'
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  notificationsEnabled.value = result === 'granted'
  storage((s) => s.setItem(PREF_KEY, result === 'granted' ? 'on' : 'off'))
  return result
}

export function disableNotifications() {
  notificationsEnabled.value = false
  storage((s) => s.setItem(PREF_KEY, 'off'))
}

/** Shows one notification for a chat message, or returns false explaining nothing was shown. */
export function notifyChatMessage(message, { roomName = 'SoundStream', myId } = {}) {
  if (!notificationsSupported || !message) return false
  const allowed = shouldNotify({
    enabled: notificationsEnabled.value,
    permission: permission(),
    hidden: document.hidden,
    fromSelf: message.memberId === myId,
  })
  if (!allowed) return false

  const body = message.kind === 'STICKER' ? 'Sent a sticker' : message.text
  try {
    const notification = new Notification(`${message.author} · ${roomName}`, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // One notification per room rather than a pile of them.
      tag: `soundstream-chat-${roomName}`,
      renotify: true,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
