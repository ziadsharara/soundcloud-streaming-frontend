/**
 * Ticks beside a message, the way a messaging app shows them.
 *
 * Receipts are stored per member as two timestamps — how far they have received, and how far they
 * have read — because reading a message implies reading everything before it. A message is
 * delivered or read only when *everyone else in the room* has got that far, which is what makes
 * the second tick meaningful in a group.
 */
export const RECEIPT_LABELS = {
  sent: 'Sent',
  delivered: 'Delivered to everyone',
  read: 'Read by everyone',
}

export function receiptState(message, { receipts = {}, members = [], myId } = {}) {
  // Ticks belong on your own messages only; nobody needs a receipt for someone else's.
  if (!message || !myId || message.memberId !== myId) return null

  const others = members.filter((member) => member && member.id !== myId)
  if (!others.length) return 'sent'

  const everyoneReached = (field) =>
    others.every((member) => (receipts[member.id]?.[field] ?? 0) >= message.serverTime)

  if (everyoneReached('readAt')) return 'read'
  if (everyoneReached('deliveredAt')) return 'delivered'
  return 'sent'
}

/** The newest message in a list, which is all an acknowledgement needs to name. */
export function latestServerTime(messages = []) {
  return messages.reduce((newest, message) => Math.max(newest, message?.serverTime ?? 0), 0)
}
