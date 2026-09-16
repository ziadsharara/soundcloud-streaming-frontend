<script setup>
import { computed, ref } from 'vue'
import { usePwaInstall } from '../pwa'

/**
 * "Install app", shown only when installing is actually possible: hidden once the app runs
 * standalone, and replaced by a share-sheet hint on iOS, which offers no install prompt.
 */
const { installed, installPrompt, standalone, needsIosInstructions, install } = usePwaInstall()

const showIosHint = ref(false)

const visible = computed(() => !standalone && !installed.value && (installPrompt.value || needsIosInstructions))

async function onClick() {
  if (installPrompt.value) {
    await install()
    return
  }
  showIosHint.value = !showIosHint.value
}
</script>

<template>
  <div v-if="visible" class="install-wrap">
    <button class="btn btn--outline btn--compact install-button" type="button" @click="onClick">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      Install app
    </button>

    <p v-if="showIosHint" class="install-hint">
      Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
    </p>
  </div>
</template>
