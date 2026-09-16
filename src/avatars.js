/**
 * Faces people pick when they join. Drawn as line art rather than photographs or generated
 * blobs: outlines stay readable at 28px, recolour themselves in dark mode, and need no licence.
 *
 * Each entry is the inside of a 48x48 <svg>. Strokes inherit currentColor; the marker names the
 * pen the avatar is drawn with.
 */
export const AVATARS = [
  {
    id: 'cassette',
    label: 'Cassette',
    marker: 'coral',
    svg: '<rect x="6" y="13" width="36" height="23" rx="4"/><circle cx="18" cy="23" r="4"/><circle cx="30" cy="23" r="4"/><path d="M22 23h4"/><path d="m14 36 3-6h14l3 6"/>',
  },
  {
    id: 'vinyl',
    label: 'Vinyl',
    marker: 'grape',
    svg: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="4"/><path d="M24 13a11 11 0 0 1 11 11"/>',
  },
  {
    id: 'headphones',
    label: 'Headphones',
    marker: 'sky',
    svg: '<path d="M11 28v-4a13 13 0 0 1 26 0v4"/><rect x="6" y="26" width="9" height="13" rx="4"/><rect x="33" y="26" width="9" height="13" rx="4"/>',
  },
  {
    id: 'boombox',
    label: 'Boombox',
    marker: 'sun',
    svg: '<rect x="5" y="16" width="38" height="22" rx="3"/><circle cx="16" cy="27" r="5"/><circle cx="32" cy="27" r="5"/><path d="M15 16v-3a9 9 0 0 1 18 0v3"/>',
  },
  {
    id: 'mic',
    label: 'Microphone',
    marker: 'mint',
    svg: '<rect x="19" y="7" width="10" height="19" rx="5"/><path d="M14 22a10 10 0 0 0 20 0"/><path d="M24 32v7"/><path d="M18 39h12"/>',
  },
  {
    id: 'radio',
    label: 'Radio',
    marker: 'teal',
    svg: '<rect x="6" y="19" width="36" height="20" rx="3"/><circle cx="33" cy="29" r="4"/><path d="M12 25h12M12 32h12"/><path d="m15 19 18-11"/>',
  },
  {
    id: 'reel',
    label: 'Tape reel',
    marker: 'coral',
    svg: '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="3"/><path d="M24 9v7M24 32v7M9 24h7M32 24h7"/>',
  },
  {
    id: 'speaker',
    label: 'Speaker',
    marker: 'grape',
    svg: '<rect x="13" y="6" width="22" height="36" rx="4"/><circle cx="24" cy="16" r="4"/><circle cx="24" cy="30" r="7"/>',
  },
  {
    id: 'synth',
    label: 'Synth',
    marker: 'sky',
    svg: '<rect x="5" y="17" width="38" height="18" rx="3"/><path d="M13 17v12M20 17v12M28 17v12M35 17v12"/><path d="M5 29h38"/>',
  },
  {
    id: 'guitar',
    label: 'Guitar',
    marker: 'sun',
    svg: '<circle cx="18" cy="30" r="11"/><circle cx="18" cy="30" r="3"/><path d="m26 22 13-13"/><path d="m35 6 7 7"/>',
  },
  {
    id: 'metronome',
    label: 'Metronome',
    marker: 'mint',
    svg: '<path d="M18 40 24 7l6 33z"/><path d="M13 40h22"/><path d="m24 34 8-19"/>',
  },
  {
    id: 'note',
    label: 'Note',
    marker: 'teal',
    svg: '<path d="M20 34V12l16-5v22"/><circle cx="15" cy="34" r="5"/><circle cx="31" cy="29" r="5"/>',
  },
]

export const DEFAULT_AVATAR = 'cassette'

export const avatarById = (id) => AVATARS.find((avatar) => avatar.id === id) || AVATARS[0]
