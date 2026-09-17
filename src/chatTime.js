/**
 * When a message was sent.
 *
 * Times are shown in the reader's own clock and language — the server sends one timestamp and
 * every browser renders it locally — with a date only where the day changes, so a long chat
 * reads as a conversation rather than a log.
 */
const MINUTE = 60_000
const DAY = 86_400_000

export function messageTime(serverTime, locale = undefined) {
  if (!serverTime) return ''
  return new Date(serverTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/** Midnight before a moment, in local time: two messages share a day if these match. */
function startOfDay(time) {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const sameDay = (left, right) => startOfDay(left) === startOfDay(right)

/** "Today", "Yesterday", or the date itself once it is older than that. */
export function dayLabel(serverTime, now = Date.now(), locale = undefined) {
  if (!serverTime) return ''
  const days = Math.round((startOfDay(now) - startOfDay(serverTime)) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  const sameYear = new Date(serverTime).getFullYear() === new Date(now).getFullYear()
  return new Date(serverTime).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** A date divider goes above the first message of each day. */
export const startsNewDay = (message, previous) =>
  Boolean(message?.serverTime) && (!previous?.serverTime || !sameDay(previous.serverTime, message.serverTime))

/** Consecutive messages from one person within a minute are drawn as one block. */
export const continuesBlock = (message, previous) =>
  Boolean(
    previous &&
      message &&
      previous.memberId === message.memberId &&
      message.serverTime - previous.serverTime < MINUTE &&
      sameDay(previous.serverTime, message.serverTime),
  )
