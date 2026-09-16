<script setup>
import { useRoute } from 'vue-router'
import { useTheme } from './theme'

const route = useRoute()
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink to="/" class="brand" aria-label="SoundStream home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span>SoundStream</span>
      </RouterLink>

      <nav class="main-nav" aria-label="Main navigation">
        <RouterLink to="/" :class="{ active: route.name === 'home' }">Home</RouterLink>
        <a href="/#live">Live rooms</a>
        <a href="/#start">Start</a>
      </nav>

      <div class="topbar-actions">
        <button
          class="icon-button"
          type="button"
          :aria-label="`Use ${theme === 'dark' ? 'light' : 'dark'} mode`"
          @click="toggleTheme"
        >
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <a class="btn btn--compact" href="/#start">Start a room</a>
      </div>
    </header>

    <RouterView :key="$route.fullPath" />

    <footer class="footer">
      <RouterLink to="/" class="brand brand--small">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        SoundStream
      </RouterLink>
      <p class="hand">shared moments, one play button</p>
      <p class="muted footer-note">
        Plays through the official SoundCloud and Spotify embeds. Not affiliated with SoundCloud,
        Spotify or Anghami.
      </p>
    </footer>
  </div>
</template>
