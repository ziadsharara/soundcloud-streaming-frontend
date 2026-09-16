<script setup>
import { computed } from 'vue'

/**
 * Service marks, so a link is recognisable at a glance.
 *
 * These are simplified in-house drawings in each service's brand colour, used only to identify
 * where a link points — not official brand assets. Each service publishes its own logo files and
 * usage rules; swap these for the approved assets if this ever goes commercial.
 *
 * Deliberately the one place brand colour overrides the paper-and-ink palette: a logo that is not
 * its own colour stops being recognisable, which is the only reason it is on the page.
 */
const LOGOS = {
  soundcloud: {
    brand: '#ff5500',
    svg:
      '<rect x="1" y="13" width="1.8" height="5" rx=".9"/><rect x="4.2" y="10.5" width="1.8" height="7.5" rx=".9"/>'
      + '<rect x="7.4" y="8.5" width="1.8" height="9.5" rx=".9"/><rect x="10.6" y="11" width="1.8" height="7" rx=".9"/>'
      + '<path d="M14 18V7.6a5.2 5.2 0 0 1 7.7 4.2A3.3 3.3 0 0 1 20.8 18z"/>',
  },
  youtubemusic: {
    brand: '#ff0000',
    svg:
      '<circle cx="12" cy="12" r="11"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#fff" stroke-width="1.5"/>'
      + '<path d="M10.2 8.6 15.4 12l-5.2 3.4z" fill="#fff"/>',
  },
  youtube: {
    brand: '#ff0000',
    svg:
      '<rect x="1" y="4.5" width="22" height="15" rx="4.6"/>'
      + '<path d="M10 8.8 15.8 12 10 15.2z" fill="#fff"/>',
  },
}

const props = defineProps({
  // A logo key: soundcloud, youtubemusic or youtube.
  logo: { type: String, required: true },
  label: { type: String, default: '' },
  size: { type: Number, default: 20 },
})

const mark = computed(() => LOGOS[props.logo] || null)
</script>

<template>
  <span
    v-if="mark"
    class="provider-logo"
    :style="{ width: `${size}px`, height: `${size}px`, color: mark.brand }"
    :title="label"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" v-html="mark.svg" />
  </span>
</template>
