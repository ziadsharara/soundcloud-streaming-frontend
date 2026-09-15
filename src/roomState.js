/** Merge REST chat history with live messages without duplicating messages received during the request. */
export function mergeChatMessages(current = [], incoming = [], maxMessages = 100) {
  const messages = new Map()
  for (const message of [...current, ...incoming]) {
    if (!message) continue
    const key = message.id || `${message.serverTime}:${message.author}:${message.text}:${message.host}`
    messages.set(key, message)
  }
  return [...messages.values()]
    .sort((left, right) => left.serverTime - right.serverTime)
    .slice(-maxMessages)
}
