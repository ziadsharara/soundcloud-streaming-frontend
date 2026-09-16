<script setup>
import { computed } from 'vue'

/**
 * Marginalia: arrows, scribbles and ticks drawn in the margin around content.
 *
 * All stroked paths on currentColor, all aria-hidden, no filters and no gradients — a dozen of
 * these cost less than one blurred drop shadow. A mark must never cross text.
 */
const DOODLES = {
  arrow: {
    viewBox: '0 0 80 60',
    svg: '<path d="M6 8c22 2 40 14 48 34"/><path d="M44 36l10 8 2-13"/>',
  },
  underline: {
    viewBox: '0 0 200 14',
    svg: '<path d="M3 9c38-6 84-8 194-4"/><path d="M12 13c44-5 92-6 172-3"/>',
  },
  scribble: {
    viewBox: '0 0 60 40',
    svg: '<path d="M4 30c10-18 18 6 26-10s14 8 24-12"/>',
  },
  star: {
    viewBox: '0 0 40 40',
    svg: '<path d="M20 4v32M4 20h32M8 8l24 24M32 8 8 32"/>',
  },
  tick: {
    viewBox: '0 0 40 30',
    svg: '<path d="m4 16 10 10L36 4"/>',
  },
  hatch: {
    viewBox: '0 0 60 40',
    svg: '<path d="M4 34 20 4M18 34 34 4M32 34 48 4M46 34 56 14"/>',
  },
}

const props = defineProps({
  name: { type: String, required: true },
  width: { type: Number, default: 70 },
})

const doodle = computed(() => DOODLES[props.name] || DOODLES.scribble)
</script>

<template>
  <svg
    class="doodle"
    :viewBox="doodle.viewBox"
    :style="{ width: `${width}px` }"
    aria-hidden="true"
    v-html="doodle.svg"
  />
</template>
