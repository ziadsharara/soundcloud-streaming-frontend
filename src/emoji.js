/** A small hand-picked set. A full emoji library is megabytes for a chat box this size. */
export const EMOJI_GROUPS = [
  {
    label: 'Reactions',
    emoji: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😭', '🤯', '😴', '👀', '🙌'],
  },
  {
    label: 'Hands',
    emoji: ['👍', '👎', '👏', '🙏', '🤝', '✌️', '🤟', '💪'],
  },
  {
    label: 'Music',
    emoji: ['🎵', '🎶', '🎧', '🎤', '🎸', '🥁', '🎹', '📻', '💿', '🔊'],
  },
  {
    label: 'Feelings',
    emoji: ['❤️', '🔥', '✨', '⭐', '💯', '🎉', '☕', '🌙'],
  },
]

export const ALL_EMOJI = EMOJI_GROUPS.flatMap((group) => group.emoji)
