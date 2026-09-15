<script setup>
import { useRoute } from 'vue-router'
import { useTheme } from './theme'
import { useSoundCloudAuth } from './soundcloudAuth'

const route = useRoute()
const { theme, toggleTheme } = useTheme()
const { profile, configured, loading, connect, disconnect } = useSoundCloudAuth()
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

        <div v-if="profile" class="profile-menu">
          <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" />
          <span>{{ profile.username }}</span>
          <button type="button" title="Disconnect SoundCloud" aria-label="Disconnect SoundCloud" @click="disconnect">×</button>
        </div>
        <button v-else class="btn btn--compact" type="button" :disabled="loading || configured === false" @click="connect">
          <svg class="button-icon soundcloud-icon" viewBox="0 0 28 16" aria-hidden="true"><path d="M12.4 2.2A6.3 6.3 0 0 1 24.2 6a4.6 4.6 0 1 1-.3 9.2H12.4zM9.9 4.8h1.2v10.4H9.9zm-2.4 2h1.2v8.4H7.5zm-2.4 1.6h1.2v6.8H5.1zm-2.4 1.4h1.2v5.4H2.7zM.3 11h1.2v4.2H.3z" /></svg>
          <span class="desktop-only">Connect SoundCloud</span>
          <span class="mobile-only">Connect</span>
        </button>
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
