<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { completeSpotifyLogin } from '../spotify'

/** Where Spotify sends the host back to. Exchanges the code, then returns them to their room. */
const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    const returnTo = await completeSpotifyLogin()
    router.replace(returnTo || '/')
  } catch (e) {
    error.value = e.message
    setTimeout(() => router.replace(e.returnTo || '/'), 2500)
  }
})
</script>

<template>
  <main class="page narrow-page">
    <div class="card sketch-frame">
      <h2>{{ error ? 'Spotify sign-in failed' : 'Connecting Spotify…' }}</h2>
      <p class="muted">{{ error || 'One moment, finishing the handshake.' }}</p>
    </div>
  </main>
</template>
