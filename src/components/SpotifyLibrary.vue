<script setup>
import { ref } from 'vue'
import {
  connectSpotify,
  disconnectSpotify,
  listSpotifyLikes,
  listSpotifyPlaylists,
  spotifyConfigured,
  spotifyConnected,
} from '../spotify'

/**
 * The host's own Spotify library, for queueing without pasting links.
 *
 * Deliberately host-only and optional: Spotify's development-mode apps admit five allow-listed
 * Premium accounts, so this can never be part of the guest path.
 */
const emit = defineEmits(['queue'])

const connected = ref(spotifyConnected())
const tab = ref('playlists')
const items = ref([])
const loading = ref(false)
const error = ref('')

async function load(which) {
  tab.value = which
  loading.value = true
  error.value = ''
  try {
    items.value = which === 'playlists' ? await listSpotifyPlaylists() : await listSpotifyLikes()
    connected.value = true
  } catch (e) {
    error.value = e.message
    connected.value = spotifyConnected()
  } finally {
    loading.value = false
  }
}

async function connect() {
  error.value = ''
  try {
    await connectSpotify(window.location.pathname)
  } catch (e) {
    error.value = e.message
  }
}

function disconnect() {
  disconnectSpotify()
  connected.value = false
  items.value = []
}
</script>

<template>
  <section class="card spotify-library sketch-frame-2">
    <div class="members-head">
      <p class="eyebrow">Your library</p>
      <h3>Spotify</h3>
    </div>

    <p v-if="!spotifyConfigured" class="muted">
      Set <code>VITE_SPOTIFY_CLIENT_ID</code> to browse your own playlists and likes here. Pasting
      Spotify links works without it.
    </p>

    <template v-else-if="!connected">
      <p class="muted">
        Connect to queue straight from your playlists and liked songs. Spotify allows five
        allow-listed Premium accounts per hobby app, so this is for you, not your guests.
      </p>
      <button class="btn btn--soft btn--full" type="button" @click="connect">Connect Spotify</button>
    </template>

    <template v-else>
      <div class="tabs">
        <button type="button" :class="{ active: tab === 'playlists' }" @click="load('playlists')">Playlists</button>
        <button type="button" :class="{ active: tab === 'likes' }" @click="load('likes')">Liked songs</button>
        <button class="tab-quiet" type="button" @click="disconnect">Disconnect</button>
      </div>

      <p v-if="loading" class="muted">Loading…</p>
      <ul v-else-if="items.length" class="library-list">
        <li v-for="item in items" :key="item.id">
          <button type="button" @click="emit('queue', item.url)">
            <img v-if="item.artwork" :src="item.artwork" alt="" />
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.subtitle }}</small>
            </span>
            <span class="library-add">+</span>
          </button>
        </li>
      </ul>
      <p v-else class="muted">Pick a tab to load your library.</p>
    </template>

    <p v-if="error" class="field-error">{{ error }}</p>
  </section>
</template>
