/**
 * Emoji reactions under a chat message.
 *
 * The server stores who put which emoji where, and sends the whole of one message's reactions
 * whenever they change. The room keeps them as `{ messageId: { emoji: [memberId] } }` and this
 * turns that into what a message needs to draw: the emoji, how many, and whether one is yours.
 */

/** Kept in step with the palette the server accepts; anything else is refused there. */
export const REACTION_PALETTE = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎵']

export function summariseReactions(reactions = {}, messageId, myId) {
  const byEmoji = reactions?.[messageId]
  if (!byEmoji) return []
  return Object.entries(byEmoji)
    .map(([emoji, members]) => ({
      emoji,
      count: Array.isArray(members) ? members.length : 0,
      mine: Array.isArray(members) && members.includes(myId),
    }))
    .filter((reaction) => reaction.count > 0)
}

/** Folds one message's update into the room's map, dropping messages left with nothing. */
export function applyReactionUpdate(current = {}, update) {
  if (!update?.messageId) return current
  const next = { ...current }
  const reactions = update.reactions || {}
  if (Object.keys(reactions).length) next[update.messageId] = reactions
  else delete next[update.messageId]
  return next
}
