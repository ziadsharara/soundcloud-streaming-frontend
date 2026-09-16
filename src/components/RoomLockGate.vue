<script setup>
import { ref } from 'vue'
import AvatarMark from './AvatarMark.vue'

/** The door on a private room: a name, who is hosting, and a password field. */
const props = defineProps({
  roomName: { type: String, default: '' },
  hostName: { type: String, default: '' },
  hostAvatarId: { type: String, default: '' },
  error: { type: String, default: '' },
  checking: { type: Boolean, default: false },
})
const emit = defineEmits(['unlock'])

const password = ref('')

function submit() {
  const value = password.value.trim()
  if (value) emit('unlock', value)
}
</script>

<template>
  <form class="card lock-gate sketch-frame" @submit.prevent="submit">
    <span class="lock-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <rect x="11" y="21" width="26" height="19" rx="5" />
        <path d="M17 21v-5a7 7 0 0 1 14 0v5" />
        <path d="M24 28v5" />
      </svg>
    </span>

    <p class="eyebrow">Private room</p>
    <h2>{{ roomName || 'This room is private' }}</h2>
    <p class="muted host-line">
      <AvatarMark v-if="hostAvatarId" :id="hostAvatarId" :size="26" flat />
      Hosted by {{ hostName || 'someone' }}
    </p>

    <div class="field-group">
      <label for="room-password">Room password</label>
      <input
        id="room-password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        placeholder="Ask the host for it"
        maxlength="100"
      />
    </div>

    <p v-if="error" class="field-error">{{ error }}</p>
    <button class="btn btn--large btn--full" type="submit" :disabled="checking">
      {{ checking ? 'Checking…' : 'Unlock the room' }}
    </button>
  </form>
</template>
