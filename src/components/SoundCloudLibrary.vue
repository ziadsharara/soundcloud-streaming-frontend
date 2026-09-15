<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import { largeArtwork } from '../soundcloud'
import { useSoundCloudAuth } from '../soundcloudAuth'

const props = defineProps({
  compact: { type: Boolean, default: false },
  picker: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const { sessionId } = useSoundCloudAuth()
const library = ref(null)
const activeTab = ref('playlists')
const loading = ref(true)
const error = ref('')

const tabs = computed(() => [
  { id: 'playlists', label: 'My playlists', count: library.value?.playlists?.length ?? 0 },
  { id: 'likedTracks', label: 'Liked tracks', count: library.value?.likedTracks?.length ?? 0 },
  { id: 'likedPlaylists', label: 'Liked playlists', count: library.value?.likedPlaylists?.length ?? 0 },
])
const items = computed(() => library.value?.[activeTab.value] ?? [])

onMounted(loadLibrary)

async function loadLibrary() {
  if (!sessionId.value) return
  loading.value = true
  error.value = ''
  try {
    library.value = await api.soundCloudLibrary(sessionId.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function duration(ms) {
  const minutes = Math.round((ms || 0) / 60000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}
</script>

<template>
  <section class="library-shell" :class="{ 'library-shell--compact': compact }">
    <div class="section-heading library-heading">
      <div>
        <p class="eyebrow">Your SoundCloud</p>
        <h2>{{ picker ? 'Choose what plays next' : 'Your library, ready to stream' }}</h2>
      </div>
      <button v-if="error" class="btn btn--ghost btn--compact" type="button" @click="loadLibrary">Try again</button>
    </div>

    <div class="library-tabs" role="tablist" aria-label="SoundCloud library">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }} <span>{{ tab.count }}</span>
      </button>
    </div>

    <div v-if="loading" class="library-loading" aria-label="Loading your SoundCloud library">
      <div v-for="i in compact ? 3 : 4" :key="i" class="media-card skeleton-card"><span></span><i></i><i></i></div>
    </div>
    <p v-else-if="error" class="notice notice--error">{{ error }}</p>
    <div v-else-if="!items.length" class="empty-library">
      <span>♫</span>
      <strong>Nothing here yet</strong>
      <p>This collection is empty in your SoundCloud account.</p>
    </div>
    <div v-else class="library-grid">
      <article v-for="item in items" :key="`${item.kind}-${item.urn}`" class="media-card">
        <div class="media-art">
          <img v-if="item.artworkUrl" :src="largeArtwork(item.artworkUrl)" alt="" />
          <span v-else aria-hidden="true">♫</span>
          <button
            type="button"
            class="media-play"
            :disabled="!item.streamable"
            :aria-label="item.streamable ? `Stream ${item.title}` : `${item.title} is not streamable`"
            @click="emit('select', item)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5z" /></svg>
          </button>
        </div>
        <div class="media-copy">
          <strong :title="item.title">{{ item.title }}</strong>
          <span>{{ item.artist || (item.kind === 'playlist' ? 'Playlist' : 'SoundCloud') }}</span>
          <small>
            {{ item.kind === 'playlist' ? `${item.trackCount} tracks` : duration(item.durationMs) }}
            <template v-if="!item.streamable"> · unavailable</template>
          </small>
        </div>
      </article>
    </div>
  </section>
</template>
