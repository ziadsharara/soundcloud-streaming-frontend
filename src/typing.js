/**
 * "Sara is typing…", the way a messaging app shows it.
 *
 * The server only relays these, so each client expires them itself: a "stopped typing" that never
 * arrives — a closed laptop, a dropped socket — would otherwise leave an indicator up forever.
 */
export const TYPING_TTL_MS = 4500

/** Applies one relayed notice to the map of who is currently typing. */
export function applyTyping(current = {}, notice, now = Date.now()) {
  if (!notice?.memberId) return current
  const next = { ...current }
  if (notice.typing) next[notice.memberId] = { name: notice.name || 'Someone', at: now }
  else delete next[notice.memberId]
  return next
}

/**
 * Drops anyone whose last keystroke is old enough that they have clearly stopped.
 *
 * Returns the map it was given when nobody has dropped out, so the check that runs every second
 * and a half costs nothing when nothing has changed — a new object every time would redraw the
 * whole room for no reason.
 */
export function pruneTyping(current = {}, now = Date.now(), ttl = TYPING_TTL_MS) {
  const entries = Object.entries(current)
  const kept = entries.filter(([, entry]) => now - (entry?.at ?? 0) < ttl)
  return kept.length === entries.length ? current : Object.fromEntries(kept)
}

export function typingNames(current = {}, myId = '') {
  return Object.entries(current)
    .filter(([memberId]) => memberId !== myId)
    .map(([, entry]) => entry.name)
}

/** One name reads better than a list; past two, nobody cares who. */
export function typingLabel(names = []) {
  if (!names.length) return ''
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return 'Several people are typing…'
}
