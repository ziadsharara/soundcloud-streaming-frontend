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
        <span class="brand-mark" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i>
        </span>
        <span>Sound<span>Stream</span></span>
      </RouterLink>

      <nav class="main-nav" aria-label="Main navigation">
        <RouterLink to="/" :class="{ active: route.name === 'home' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
          Home
        </RouterLink>
        <a href="/#live">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 16.5a6 6 0 0 1 0-9m7 0a6 6 0 0 1 0 9M5.5 19.5a10 10 0 0 1 0-15m13 0a10 10 0 0 1 0 15M12 12h.01" /></svg>
          Live rooms
        </a>
      </nav>

      <div class="topbar-actions">
        <button class="icon-button" type="button" :aria-label="`Use ${theme === 'dark' ? 'light' : 'dark'} mode`" @click="toggleTheme">
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
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
      <p>Shared moments, one play button.</p>
      <a href="https://soundcloud.com" target="_blank" rel="noreferrer">Powered by SoundCloud ↗</a>
    </footer>
  </div>
</template>
