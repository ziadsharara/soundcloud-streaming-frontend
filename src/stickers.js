/**
 * Drawn stickers for the chat. Same reasoning as the avatars: stroked line art, one file,
 * no image requests, and they recolour themselves in dark mode.
 *
 * Each entry is the inside of a 64x64 <svg>.
 */
export const STICKERS = [
  {
    id: 'heart',
    label: 'Love this',
    marker: 'coral',
    svg: '<path d="M32 54S10 41 10 26a11 11 0 0 1 22-5 11 11 0 0 1 22 5c0 15-22 28-22 28z"/>',
  },
  {
    id: 'fire',
    label: 'This goes hard',
    marker: 'sun',
    svg: '<path d="M32 56c9 0 16-6 16-15 0-12-11-16-9-27-8 3-13 10-13 16-2-2-3-4-3-7-5 4-7 11-7 18 0 9 7 15 16 15z"/>',
  },
  {
    id: 'star',
    label: 'Certified',
    marker: 'sun',
    svg: '<path d="m32 8 7 15 17 2-12 11 3 16-15-8-15 8 3-16L8 25l17-2z"/>',
  },
  {
    id: 'vinyl',
    label: 'Spin it',
    marker: 'grape',
    svg: '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="6"/><path d="M32 14a18 18 0 0 1 18 18"/>',
  },
  {
    id: 'boombox',
    label: 'Turn it up',
    marker: 'sky',
    svg: '<rect x="6" y="21" width="52" height="29" rx="4"/><circle cx="20" cy="35" r="7"/><circle cx="44" cy="35" r="7"/><path d="M20 21v-4a12 12 0 0 1 24 0v4"/>',
  },
  {
    id: 'loud',
    label: 'Louder',
    marker: 'teal',
    svg: '<path d="M12 26h8l11-9v30l-11-9h-8z"/><path d="M40 24a11 11 0 0 1 0 16M47 18a19 19 0 0 1 0 28"/>',
  },
  {
    id: 'tick',
    label: 'Agreed',
    marker: 'mint',
    svg: '<path d="m13 34 13 13 25-30"/>',
  },
  {
    id: 'sparkle',
    label: 'Magic',
    marker: 'grape',
    svg: '<path d="M23 9v22M12 20h22"/><path d="M45 34v16M37 42h16"/>',
  },
  {
    id: 'zzz',
    label: 'Sleepy',
    marker: 'sky',
    svg: '<path d="M18 16h16L18 34h16"/><path d="M38 38h12L38 52h12"/>',
  },
]

export const stickerById = (id) => STICKERS.find((sticker) => sticker.id === id) || null
