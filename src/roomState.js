/**
 * The chat as the room holds it.
 *
 * A message you send is drawn immediately, before the server has seen it: the room's backend may
 * be a second away, and watching a round trip before your own words appear is what makes a chat
 * feel slow. The server echoes back the sender's own id for the message, so when the real one
 * arrives it replaces the one already on screen instead of appearing beside it.
 */

/** Identifies a message in the list: the sender's own id while pending, the room's once confirmed. */
const keyOf = (message) =>
  message.clientId ? `${message.memberId}:${message.clientId}` : message.id ||
  `${message.serverTime}:${message.author}:${message.text}:${message.host}`

/** Merge REST chat history with live messages without duplicating messages received during the request. */
export function mergeChatMessages(current = [], incoming = [], maxMessages = 100) {
  const messages = new Map()
  for (const message of [...current, ...incoming]) {
    if (!message) continue
    const key = keyOf(message)
    // A confirmed message replaces the pending one it came from; a pending one never
    // overwrites what the server has already said.
    const existing = messages.get(key)
    if (existing && message.pending && !existing.pending) continue
    messages.set(key, message)
  }
  return [...messages.values()]
    .sort((left, right) => left.serverTime - right.serverTime)
    .slice(-maxMessages)
}

/** A message drawn the moment it is sent, before the room has confirmed it. */
export function pendingMessage({
  clientId,
  memberId,
  author,
  avatarId,
  host = false,
  kind = 'TEXT',
  text = '',
  stickerId = '',
  attachment = null,
  serverTime = Date.now(),
}) {
  return {
    id: `pending:${clientId}`,
    clientId,
    memberId,
    author,
    avatarId,
    kind,
    text,
    stickerId,
    attachment,
    host,
    serverTime,
    pending: true,
  }
}

/** How far a file being sent has got, 0 to 1, for the bar under the bubble. */
export function withProgress(messages = [], clientId, progress) {
  return messages.map((message) =>
    message.clientId === clientId && message.pending ? { ...message, progress } : message,
  )
}

/** Marks a pending message as one that never made it, so it is not left looking sent. */
export function failMessage(messages = [], clientId) {
  return messages.map((message) =>
    message.clientId === clientId && message.pending ? { ...message, pending: false, failed: true } : message,
  )
}

export function newClientId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replaceAll('-', '')
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
