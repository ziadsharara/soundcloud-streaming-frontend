/**
 * Faces people pick when they join.
 *
 * Drawn as line art rather than photographs or generated blobs: outlines stay readable at 28px,
 * recolour themselves in dark mode, and need no licence.
 *
 * They are told apart by silhouette — hair and headwear — not by facial detail, because at the
 * size these actually render (a 30px chip beside a chat message) eyes and mouths are all the same
 * three dots. Each entry is the inside of a 48x48 <svg>; strokes inherit the marker colour.
 */
const EYES = '<path d="M20 22v.1M28 22v.1"/>'
const SMILE = '<path d="M20.6 27.4a4 2.6 0 0 0 6.8 0"/>'

export const AVATARS = [
  {
    id: 'bun',
    label: 'Top bun',
    marker: 'coral',
    svg: `<circle cx="24" cy="22" r="11.5"/><circle cx="24" cy="6.2" r="3.6"/>`
      + `<path d="M14 16.5a10.5 10.5 0 0 1 20 0"/>${EYES}${SMILE}`,
  },
  {
    id: 'curls',
    label: 'Curls',
    marker: 'grape',
    svg: `<circle cx="24" cy="23.5" r="11"/><circle cx="16.2" cy="11.8" r="3.3"/>`
      + `<circle cx="24" cy="9" r="3.8"/><circle cx="31.8" cy="11.8" r="3.3"/>${EYES}${SMILE}`,
  },
  {
    id: 'cap',
    label: 'Cap',
    marker: 'sky',
    svg: `<circle cx="24" cy="23.5" r="11.5"/><path d="M13.2 16a10.8 10.8 0 0 1 21.6 0z"/>`
      + `<path d="M34.8 16h7"/>${EYES}${SMILE}`,
  },
  {
    id: 'headphones',
    label: 'Headphones',
    marker: 'sun',
    svg: `<circle cx="24" cy="23" r="10.8"/><path d="M11 22.5v-2.5a13 13 0 0 1 26 0v2.5"/>`
      + `<rect x="7.6" y="20" width="6" height="9" rx="3"/><rect x="34.4" y="20" width="6" height="9" rx="3"/>`
      + `${EYES}${SMILE}`,
  },
  {
    id: 'glasses',
    label: 'Glasses',
    marker: 'mint',
    svg: `<circle cx="24" cy="23" r="11.5"/><circle cx="19.4" cy="21.8" r="3.9"/>`
      + `<circle cx="28.6" cy="21.8" r="3.9"/><path d="M23.3 21.8h1.4"/>${SMILE}`,
  },
  {
    id: 'beard',
    label: 'Beard',
    marker: 'teal',
    svg: `<circle cx="24" cy="21" r="10.8"/><path d="M14 24.5c0 8 4.4 12 10 12s10-4 10-12"/>`
      + `${EYES}<path d="M21 27.6h6"/>`,
  },
  {
    id: 'headscarf',
    label: 'Headscarf',
    marker: 'coral',
    // The scarf has to frame a visible round face, or it just reads as an egg.
    svg: `<path d="M24 6.5c7.4 0 12.4 5.8 12.4 13.4 0 6.2-2.4 10.4-5 13-1.6 1.6-3.2 2.1-7.4 2.1s-5.8-.5-7.4-2.1c-2.6-2.6-5-6.8-5-13C11.6 12.3 16.6 6.5 24 6.5z"/>`
      + `<circle cx="24" cy="21.5" r="7.8"/>${EYES}${SMILE}`,
  },
  {
    id: 'afro',
    label: 'Afro',
    marker: 'grape',
    svg: `<circle cx="24" cy="24.5" r="10.2"/>`
      + `<path d="M24 5a11 11 0 0 1 11 11c0 2-.6 3.9-1.7 5.4H14.7A9.7 9.7 0 0 1 13 16 11 11 0 0 1 24 5z"/>`
      + `<path d="M20 23.5v.1M28 23.5v.1"/><path d="M20.6 28.6a4 2.6 0 0 0 6.8 0"/>`,
  },
  {
    id: 'longhair',
    label: 'Long hair',
    marker: 'sky',
    svg: `<circle cx="24" cy="22" r="10.8"/>`
      + `<path d="M12.8 21.5v-3.2a11.2 11.2 0 0 1 22.4 0v3.2M12.8 21.5v15M35.2 21.5v15"/>${EYES}${SMILE}`,
  },
  {
    id: 'shaved',
    label: 'Shaved',
    marker: 'sun',
    // Ears rather than eyebrows: brows this close to the eyes just merge into them at 30px.
    svg: `<circle cx="24" cy="23" r="11.5"/>`
      + `<path d="M12.4 21.5a2.7 2.7 0 0 0 0 5.4M35.6 21.5a2.7 2.7 0 0 1 0 5.4"/>${EYES}${SMILE}`,
  },
  {
    id: 'braids',
    label: 'Braids',
    marker: 'mint',
    svg: `<circle cx="24" cy="22" r="10.8"/><path d="M13.6 18.4a10.4 10.4 0 0 1 20.8 0"/>`
      + `<path d="M13.4 24.5c-3 3.6-3.5 8.2-2.5 12.2M34.6 24.5c3 3.6 3.5 8.2 2.5 12.2"/>${EYES}${SMILE}`,
  },
  {
    id: 'beanie',
    label: 'Beanie',
    marker: 'teal',
    svg: `<circle cx="24" cy="24.5" r="11.2"/><path d="M13.6 17.5a10.4 10.4 0 0 1 20.8 0z"/>`
      + `<path d="M12.2 17.5h23.6"/><circle cx="24" cy="5.4" r="2.2"/>`
      + `<path d="M20 24v.1M28 24v.1"/><path d="M20.6 28.8a4 2.6 0 0 0 6.8 0"/>`,
  },
]

export const DEFAULT_AVATAR = 'bun'

export const avatarById = (id) => AVATARS.find((avatar) => avatar.id === id) || AVATARS[0]
