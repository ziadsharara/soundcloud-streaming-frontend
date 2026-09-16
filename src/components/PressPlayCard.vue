<script setup>
import Doodle from './Doodle.vue'

/**
 * The one instruction every listener needs: browsers will not start audio on their own, so the
 * room stays silent until each person presses play once.
 *
 * Drawn rather than written, in the house style — a figure reaching for the play button, line art
 * on currentColor, no gradients — because a drawing of the action is understood before the
 * sentence under it is read.
 */
defineProps({
  hosting: { type: Boolean, default: false },
})
</script>

<template>
  <section class="card sketch-frame press-play">
    <figure class="press-play-art">
      <svg viewBox="0 0 200 140" aria-hidden="true">
        <!-- the listener -->
        <circle cx="54" cy="46" r="21" />
        <path d="M33 44v-4a21 21 0 0 1 42 0v4" />
        <rect x="27" y="42" width="11" height="17" rx="5.5" />
        <rect x="70" y="42" width="11" height="17" rx="5.5" />
        <path d="M47 44v.2M62 44v.2" />
        <path d="M48 53a7 4.5 0 0 0 12 0" />
        <path d="M24 132a31 29 0 0 1 60 0" />
        <!-- reaching out to press play -->
        <path d="M80 96c14-3 24-9 33-17" />
        <circle cx="119" cy="76" r="5.5" />
        <!-- the play button -->
        <circle cx="156" cy="70" r="27" />
        <path d="M148 56l20 14-20 14z" />
        <path d="M188 52a24 24 0 0 1 0 36" />
      </svg>
    </figure>

    <div class="press-play-copy">
      <p class="eyebrow">Almost there</p>
      <h3>{{ hosting ? 'Press play to start the room' : 'Press play to hear the room' }}</h3>
      <p class="muted">
        Your browser won’t start music on its own. Tap play once on the player below — after that
        {{ hosting ? 'everyone follows you' : 'you stay in step with the host' }}.
      </p>
      <p class="hand press-play-note">
        one tap, then you’re in
        <Doodle name="arrow" :width="52" class="press-play-arrow marker-coral" />
      </p>
    </div>
  </section>
</template>
