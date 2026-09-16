<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarMark from '../components/AvatarMark.vue'
import Doodle from '../components/Doodle.vue'
import { api, clearHostToken, getHostToken, setHostToken } from '../api'
import { AVATARS } from '../avatars'
import { getIdentity, setIdentity } from '../identity'
import ProviderLogo from '../components/ProviderLogo.vue'
import { SOURCE_CARDS, isSupportedUrl, providerBadge } from '../providers'
import { largeArtwork } from '../soundcloud'
import { parseRoomCode } from '../roomCode'

const REFRESH_MS = 10000
const router = useRouter()

const rooms = ref([])
const loading = ref(true)
const listError = ref('')
const deletingRoomId = ref('')

const saved = getIdentity()
const roomName = ref('')
const hostName = ref(saved.name)
const hostAvatarId = ref(saved.avatarId)
const sourceUrl = ref('')
const creating = ref(false)
const createError = ref('')

const code = ref('')
const joinError = ref('')
let timer = null

async function refresh() {
  try {
    const result = await api.listRooms()
    rooms.value = Array.isArray(result) ? result : []
    listError.value = ''
  } catch (e) {
    listError.value = e.message
  } finally {
    loading.value = false
  }
}

const canDeleteRoom = (roomId) => Boolean(getHostToken(roomId))

async function deleteRoom(room) {
  const hostToken = getHostToken(room.id)
  if (!hostToken || !window.confirm(`Delete “${room.name}” for everyone?`)) return

  deletingRoomId.value = room.id
  listError.value = ''
  try {
    await api.closeRoom(room.id, hostToken)
    clearHostToken(room.id)
    rooms.value = rooms.value.filter(({ id }) => id !== room.id)
  } catch (e) {
    listError.value = e.message
  } finally {
    deletingRoomId.value = ''
  }
}

async function createRoom() {
  createError.value = ''
  const url = sourceUrl.value.trim()
  if (url && !isSupportedUrl(url)) {
    createError.value = 'Paste a SoundCloud or YouTube link — or leave it empty.'
    return
  }
  creating.value = true
  try {
    const { room, hostToken } = await api.createRoom(
      roomName.value.trim(),
      hostName.value.trim(),
      hostAvatarId.value,
    )
    setHostToken(room.id, hostToken)
    setIdentity({ name: hostName.value.trim(), avatarId: hostAvatarId.value })
    if (url) {
      try {
        window.sessionStorage.setItem('soundstream:queued-source', JSON.stringify({ permalinkUrl: url }))
      } catch {
        // The host can still paste the link again inside the room.
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
  const id = parseRoomCode(code.value)
  if (!id) {
    joinError.value = 'Enter a six-character room code or paste an invite link.'
    return
  }
  joinError.value = ''
  router.push({ name: 'room', params: { id } })
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
        <p class="hand hand-kicker">one room, one moment</p>
        <h1>
          Play it once.<br />
          <span class="underlined">
            Everyone hears it
            <Doodle name="underline" :width="230" class="doodle-underline marker-coral" />
          </span>
          together.
        </h1>
        <p class="lede">
          Paste a link from SoundCloud, YouTube Music or YouTube. Share one room code. Your friends
          land in the same song, at the same second, with a name and a face.
        </p>
        <div class="hero-actions">
          <a class="btn btn--large" href="#start">Start a room</a>
          <a class="btn btn--outline btn--large" href="#live">See who is live</a>
          <Doodle name="arrow" :width="64" class="doodle-hero-arrow marker-coral" />
        </div>

        <div class="works-with">
          <p class="hand">works with</p>
          <ul>
            <li><ProviderLogo logo="soundcloud" label="SoundCloud" :size="26" /></li>
            <li><ProviderLogo logo="youtubemusic" label="YouTube Music" :size="26" /></li>
            <li><ProviderLogo logo="youtube" label="YouTube" :size="26" /></li>
          </ul>
        </div>
      </div>

      <figure class="hero-art tilt-r">
        <div class="hero-art-room sketch-frame sketch-shadow">
          <p class="eyebrow">Now playing</p>
          <h3>Midnight drive</h3>
          <p class="muted">SoundStream Radio</p>
          <div class="hero-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <ul class="hero-members">
            <li v-for="avatar in AVATARS.slice(0, 5)" :key="avatar.id">
              <AvatarMark :id="avatar.id" :size="34" />
            </li>
          </ul>
          <p class="hand hero-note">everyone on the same bar</p>
        </div>
      </figure>
    </section>

    <section id="start" class="page section">
      <div class="section-heading">
        <p class="eyebrow">Start listening together</p>
        <h2>Open a room, or walk into one</h2>
      </div>

      <div class="launch-grid">
        <form class="card sketch-frame sketch-shadow" @submit.prevent="createRoom">
          <h3>Host a room</h3>
          <p class="muted">You hold the play button. Everyone else follows.</p>

          <div class="field-group">
            <label for="room-name">Room name</label>
            <input id="room-name" v-model="roomName" placeholder="Late night lo-fi" maxlength="60" required />
          </div>
          <div class="field-group">
            <label for="host-name">Your name</label>
            <input id="host-name" v-model="hostName" placeholder="What should we call you?" maxlength="40" required />
          </div>

          <fieldset class="avatar-picker">
            <legend>Your face in the room</legend>
            <div class="avatar-grid">
              <button
                v-for="avatar in AVATARS"
                :key="avatar.id"
                type="button"
                class="avatar-choice"
                :class="{ chosen: avatar.id === hostAvatarId }"
                :aria-pressed="avatar.id === hostAvatarId"
                :title="avatar.label"
                @click="hostAvatarId = avatar.id"
              >
                <AvatarMark :id="avatar.id" :size="40" />
              </button>
            </div>
          </fieldset>

          <div class="field-group">
            <label for="source-url">First link <span class="muted">(optional)</span></label>
            <input id="source-url" v-model="sourceUrl" type="url" placeholder="https://soundcloud.com/artist/song" autocomplete="url" />
          </div>

          <p v-if="createError" class="field-error">{{ createError }}</p>
          <button class="btn btn--large btn--full" type="submit" :disabled="creating">
            {{ creating ? 'Opening your room…' : 'Create the room' }}
          </button>
        </form>

        <form class="card sketch-frame-2 sketch-shadow tilt-l" @submit.prevent="joinByCode">
          <h3>Join friends</h3>
          <p class="muted">Paste the invite link or type the six-character code.</p>
          <div class="field-group">
            <label for="code">Invite link or room code</label>
            <input id="code" v-model="code" class="mono" placeholder="K7QH2M" autocomplete="off" required />
          </div>
          <p v-if="joinError" class="field-error">{{ joinError }}</p>
          <button class="btn btn--outline btn--large btn--full" type="submit">Join the room</button>
          <p class="hand">no account, ever</p>
        </form>
      </div>
    </section>

    <section class="page section">
      <div class="section-heading">
        <p class="eyebrow">Bring your own music</p>
        <h2>Where the songs come from</h2>
      </div>
      <div class="source-grid">
        <article v-for="source in SOURCE_CARDS" :key="source.logo" class="card sketch-frame-2 source-card">
          <div class="source-head">
            <ProviderLogo :logo="source.logo" :label="source.label" :size="30" />
            <strong>{{ source.label }}</strong>
          </div>
          <p class="muted">{{ source.note }}</p>
        </article>
      </div>
      <p class="hand sources-note">no accounts, no installs — just paste a link</p>
    </section>

    <section id="live" class="page section">
      <div class="section-heading live-heading">
        <div>
          <p class="eyebrow">Happening now</p>
          <h2>Live rooms</h2>
        </div>
        <button class="btn btn--outline btn--compact" type="button" @click="refresh">Refresh</button>
      </div>

      <p v-if="listError" class="notice notice--error">Can't reach the server: {{ listError }}</p>
      <p v-else-if="loading" class="muted">Looking for live rooms…</p>
      <div v-else-if="!rooms.length" class="card sketch-frame empty-live">
        <Doodle name="scribble" :width="70" class="marker-coral" />
        <h3>The stage is yours</h3>
        <p class="muted">No rooms are live yet. Start the first one.</p>
        <a class="btn btn--compact" href="#start">Create a room</a>
      </div>

      <ul v-else class="room-list">
        <li v-for="room in rooms" :key="room.id" class="card sketch-frame-2 room-tile">
          <RouterLink :to="{ name: 'room', params: { id: room.id } }" class="room-tile-link">
            <img v-if="room.playback?.artworkUrl" :src="largeArtwork(room.playback.artworkUrl)" alt="" class="room-art" />
            <AvatarMark v-else :id="room.hostAvatarId" :size="56" />
            <span class="room-tile-copy">
              <strong>{{ room.name }}</strong>
              <span class="muted">{{ room.hostName }}</span>
              <small>
                <ProviderLogo
                  v-if="providerBadge(room.playback?.trackUrl || '')"
                  :logo="providerBadge(room.playback.trackUrl).logo"
                  :label="providerBadge(room.playback.trackUrl).label"
                  :size="16"
                />
                {{ room.playback?.title || 'Warming up' }}
              </small>
            </span>
            <span class="listener-count">{{ room.listeners }} in</span>
          </RouterLink>
          <button
            v-if="canDeleteRoom(room.id)"
            class="quiet-button"
            type="button"
            :disabled="deletingRoomId === room.id"
            :aria-label="`Delete ${room.name}`"
            @click="deleteRoom(room)"
          >
            {{ deletingRoomId === room.id ? 'Deleting…' : 'Delete' }}
          </button>
        </li>
      </ul>
    </section>

    <section class="page section">
      <div class="section-heading">
        <p class="eyebrow">How it works</p>
        <h2>Three steps, no accounts</h2>
      </div>
      <ol class="steps">
        <li>
          <span class="step-number hand">1</span>
          <h3>Paste the soundtrack</h3>
          <p class="muted">A song, playlist or album link from SoundCloud or YouTube.</p>
        </li>
        <li>
          <span class="step-number hand">2</span>
          <h3>Share one code</h3>
          <p class="muted">Friends pick a name and a face, then they are in. Nothing to install.</p>
        </li>
        <li>
          <span class="step-number hand">3</span>
          <h3>Press play once</h3>
          <p class="muted">Play, pause, seek or skip — the room follows you, and drift heals itself.</p>
        </li>
      </ol>
    </section>
  </main>
</template>
