<script setup>
import Doodle from './Doodle.vue'

/**
 * Shown only when the browser actually refused to start the music.
 *
 * The room tries to start playing by itself, and usually manages it; when a browser blocks that
 * outright there is nothing for it but one tap, and this is how the room asks for it.
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
        <!-- the listener: head, then shoulders that actually meet it -->
        <circle cx="52" cy="44" r="20" />
        <path d="M31 42v-3a21 21 0 0 1 42 0v3" />
        <rect x="25" y="40" width="11" height="17" rx="5.5" />
        <rect x="68" y="40" width="11" height="17" rx="5.5" />
        <path d="M45 42v.2M59 42v.2" />
        <path d="M46 51a6.5 4 0 0 0 12 0" />
        <path d="M22 118a30 48 0 0 1 60 0" />
        <!-- an arm off the shoulder, reaching for the button -->
        <path d="M76 90c14 0 26-5 35-11" />
        <circle cx="118" cy="76" r="5.5" />
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
        Your browser blocked the sound from starting on its own. Tap play once on the player below —
        after that {{ hosting ? 'everyone follows you' : 'you stay in step with the host' }}, with
        nothing more to press.
      </p>
      <p class="hand press-play-note">
        one tap, then you’re in
        <Doodle name="arrow" :width="52" class="press-play-arrow marker-coral" />
      </p>
    </div>
  </section>
</template>
