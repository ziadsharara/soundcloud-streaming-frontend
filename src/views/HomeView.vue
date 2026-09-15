<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SoundCloudLibrary from '../components/SoundCloudLibrary.vue'
import { api, getNickname, setHostToken, setNickname } from '../api'
import { largeArtwork } from '../soundcloud'
import { useSoundCloudAuth } from '../soundcloudAuth'

const REFRESH_MS = 10000
const router = useRouter()
const { profile, configured, error: authError, connect } = useSoundCloudAuth()

const rooms = ref([])
const loading = ref(true)
const listError = ref('')
const roomName = ref('')
const hostName = ref(getNickname())
const creating = ref(false)
const createError = ref('')
const code = ref('')
const selectedSource = ref(null)
const createCard = ref(null)
let timer = null

async function refresh() {
  try {
    rooms.value = await api.listRooms()
    listError.value = ''
  } catch (e) {
    listError.value = e.message
  } finally {
    loading.value = false
  }
}

async function createRoom() {
  createError.value = ''
  creating.value = true
  try {
    const { room, hostToken } = await api.createRoom(roomName.value.trim(), hostName.value.trim())
    setHostToken(room.id, hostToken)
    setNickname(hostName.value.trim())
    if (selectedSource.value) {
      try {
        window.sessionStorage.setItem('soundstream:queued-source', JSON.stringify(selectedSource.value))
      } catch {
        // The host can still pick the item again inside the room.
      }
    }
    router.push({ name: 'room', params: { id: room.id } })
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

function joinByCode() {
  const id = code.value.trim().split('/').filter(Boolean).pop()?.toUpperCase()
  if (id) router.push({ name: 'room', params: { id } })
}

function queueSource(item) {
  selectedSource.value = item
  if (!roomName.value) roomName.value = `${item.title} live`
  createCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main>
    <section class="hero page">
      <div class="hero-copy">
        <div class="hero-kicker"><span></span> Live listening rooms</div>
        <h1>Your SoundCloud.<br /><em>One room. One moment.</em></h1>
        <p>
          Host a live session from your playlists and likes. Share one link, press play once, and everyone hears the same track at the same time.
        </p>
        <div class="hero-actions">
          <a class="btn btn--large" href="#start">Start a room <span>↗</span></a>
          <a class="btn btn--ghost btn--large" href="#live">
            <span class="live-dot"></span> Explore live rooms
          </a>
        </div>
        <div class="trust-row">
          <div class="avatar-stack"><span>Z</span><span>S</span><span>♫</span></div>
          <p><strong>Real-time playback</strong><br />Synced over a live WebSocket room</p>
        </div>
      </div>

      <div class="hero-visual" aria-label="SoundStream live player preview">
        <div class="orb orb--one"></div><div class="orb orb--two"></div>
        <div class="mock-player">
          <div class="mock-top"><span class="live-badge"><i></i> LIVE</span><span>•••</span></div>
          <div class="vinyl-wrap">
            <div class="vinyl"><div class="vinyl-label">S</div></div>
            <div class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </div>
          <p class="eyebrow">Now streaming</p>
          <h2>Midnight drive</h2>
          <p class="muted">SoundStream Radio</p>
          <div class="mock-progress"><span></span></div>
          <div class="mock-time"><span>1:42</span><span>4:08</span></div>
          <div class="mock-controls"><button>↶</button><button class="mock-play">Ⅱ</button><button>↷</button></div>
        </div>
        <div class="floating-card floating-card--listeners">
          <span class="floating-icon">♬</span><div><strong>24 listeners</strong><small>Listening together</small></div>
        </div>
        <div class="floating-card floating-card--sync">
          <span class="sync-check">✓</span><div><strong>Perfectly synced</strong><small>Live for everyone</small></div>
        </div>
      </div>
    </section>

    <section id="start" class="launch-section">
      <div class="page">
        <div class="section-heading section-heading--center">
          <p class="eyebrow">Start listening together</p>
          <h2>Go live in seconds</h2>
          <p>Open a room for your friends or jump into one with an invite code.</p>
        </div>

        <div class="launch-grid">
          <form ref="createCard" class="card launch-card launch-card--primary" @submit.prevent="createRoom">
            <div class="card-icon card-icon--orange">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 16.5a6 6 0 0 1 0-9m7 0a6 6 0 0 1 0 9M5.5 19.5a10 10 0 0 1 0-15m13 0a10 10 0 0 1 0 15M12 12h.01" /></svg>
            </div>
            <div><h3>Start a live room</h3><p class="muted">You control the music. Everyone else stays in sync.</p></div>
            <div class="field-group">
              <label for="room-name">Room name</label>
              <input id="room-name" v-model="roomName" placeholder="Late night lo-fi" maxlength="60" required />
            </div>
            <div class="field-group">
              <label for="host-name">Your display name</label>
              <input id="host-name" v-model="hostName" placeholder="DJ you" maxlength="40" required />
            </div>
            <div v-if="selectedSource" class="queued-source">
              <img v-if="selectedSource.artworkUrl" :src="largeArtwork(selectedSource.artworkUrl)" alt="" />
              <span v-else>♫</span>
              <div><small>Ready to play</small><strong>{{ selectedSource.title }}</strong></div>
              <button type="button" aria-label="Remove queued music" @click="selectedSource = null">×</button>
            </div>
            <p v-if="createError" class="field-error">{{ createError }}</p>
            <button class="btn btn--large btn--full" type="submit" :disabled="creating">
              {{ creating ? 'Opening your room…' : 'Create live room' }} <span>→</span>
            </button>
          </form>

          <form class="card launch-card" @submit.prevent="joinByCode">
            <div class="card-icon card-icon--purple">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l4.5-4.5a3.18 3.18 0 0 1 4.5 4.5l-6 6a3.18 3.18 0 0 1-4.5 0l-1-1m-3-1-1-1a3.18 3.18 0 0 0-4.5 0l-2 2a3.18 3.18 0 0 0 4.5 4.5L11 15m-2-1 6-6" /></svg>
            </div>
            <div><h3>Join your friends</h3><p class="muted">Paste an invite link or enter the six-character room code.</p></div>
            <div class="field-group">
              <label for="code">Invite link or room code</label>
              <input id="code" v-model="code" class="mono" placeholder="e.g. K7QH2M" autocomplete="off" required />
            </div>
            <div class="join-preview"><span>01</span><i></i><span>02</span><i></i><span>♫</span></div>
            <button class="btn btn--soft btn--large btn--full" type="submit">Join room <span>→</span></button>
            <p class="privacy-note"><span>✓</span> No account needed for listeners</p>
          </form>
        </div>
      </div>
    </section>

    <section class="page library-section">
      <SoundCloudLibrary v-if="profile" @select="queueSource" />
      <div v-else class="connect-banner">
        <div class="connect-cloud" aria-hidden="true">
          <svg viewBox="0 0 28 16"><path d="M12.4 2.2A6.3 6.3 0 0 1 24.2 6a4.6 4.6 0 1 1-.3 9.2H12.4zM9.9 4.8h1.2v10.4H9.9zm-2.4 2h1.2v8.4H7.5zm-2.4 1.6h1.2v6.8H5.1zm-2.4 1.4h1.2v5.4H2.7zM.3 11h1.2v4.2H.3z" /></svg>
        </div>
        <div>
          <p class="eyebrow">Your music is waiting</p>
          <h2>Bring your SoundCloud library</h2>
          <p>Connect once to see your playlists, liked tracks, and liked playlists directly in the streaming portal.</p>
          <p v-if="authError" class="field-error">{{ authError }}</p>
        </div>
        <button class="btn btn--light btn--large" type="button" :disabled="configured === false" @click="connect">
          {{ configured === false ? 'API setup required' : 'Connect SoundCloud' }}
        </button>
      </div>
    </section>

    <section id="live" class="live-section page">
      <div class="section-heading live-heading">
        <div><p class="eyebrow">Happening now</p><h2>Live rooms</h2></div>
        <button class="btn btn--ghost btn--compact" type="button" @click="refresh">Refresh ↻</button>
      </div>
      <p v-if="listError" class="notice notice--error">Can't reach the server: {{ listError }}</p>
      <div v-else-if="loading" class="room-grid-list"><div v-for="i in 3" :key="i" class="room-tile skeleton-card"></div></div>
      <div v-else-if="!rooms.length" class="empty-live">
        <span class="live-ring"><i></i></span><h3>The stage is yours</h3><p>No rooms are live yet. Start the first session.</p>
        <a class="btn btn--compact" href="#start">Create a room</a>
      </div>
      <div v-else class="room-grid-list">
        <RouterLink v-for="room in rooms" :key="room.id" :to="{ name: 'room', params: { id: room.id } }" class="room-tile">
          <div class="room-art">
            <img v-if="room.playback?.artworkUrl" :src="largeArtwork(room.playback.artworkUrl)" alt="" />
            <span v-else>♫</span>
            <i class="room-live-dot"></i>
          </div>
          <div class="room-tile-copy"><strong>{{ room.name }}</strong><span>{{ room.hostName }}</span><small>{{ room.playback?.title || 'Warming up' }}</small></div>
          <span class="listener-count">◉ {{ room.listeners }}</span>
        </RouterLink>
      </div>
    </section>

    <section class="how-section">
      <div class="page">
        <div class="section-heading section-heading--center"><p class="eyebrow">How it works</p><h2>Three steps. Zero delay drama.</h2></div>
        <div class="steps-grid">
          <article><span>1</span><div class="step-icon">♬</div><h3>Pick the soundtrack</h3><p>Choose a playlist, a liked track, or paste any playable SoundCloud URL.</p></article>
          <article><span>2</span><div class="step-icon">↗</div><h3>Share one link</h3><p>Friends join from any browser. They do not need a SoundStream account.</p></article>
          <article><span>3</span><div class="step-icon">≋</div><h3>Stay in sync</h3><p>Play, pause, seek, or skip. Every listener follows the host automatically.</p></article>
        </div>
      </div>
    </section>
  </main>
</template>
