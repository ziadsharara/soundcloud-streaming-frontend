<script setup>
import { ref } from 'vue'
import AvatarMark from './AvatarMark.vue'
import { AVATARS } from '../avatars'
import { getIdentity } from '../identity'

/** Asks for a name and a face before a guest walks into a room. */
const props = defineProps({
  roomName: { type: String, default: '' },
  hostName: { type: String, default: '' },
  chatOnly: { type: Boolean, default: false },
})
const emit = defineEmits(['join'])

const saved = getIdentity()
const name = ref(saved.name)
const avatarId = ref(saved.avatarId)
const error = ref('')

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = 'Pick a name so the room knows who is listening.'
    return
  }
  error.value = ''
  emit('join', { name: trimmed, avatarId: avatarId.value })
}
</script>

<template>
  <form class="card join-gate sketch-frame" @submit.prevent="submit">
    <p class="eyebrow">You are about to join</p>
    <h2>{{ roomName || 'this room' }}</h2>
    <p class="muted">Hosted by {{ hostName || 'someone with good taste' }}.</p>

    <div class="field-group">
      <label for="join-name">Your name</label>
      <input id="join-name" v-model="name" maxlength="40" placeholder="What should we call you?" autocomplete="nickname" />
    </div>

    <fieldset class="avatar-picker">
      <legend>Pick a face</legend>
      <div class="avatar-grid">
        <button
          v-for="avatar in AVATARS"
          :key="avatar.id"
          type="button"
          class="avatar-choice"
          :class="{ chosen: avatar.id === avatarId }"
          :aria-pressed="avatar.id === avatarId"
          :title="avatar.label"
          @click="avatarId = avatar.id"
        >
          <AvatarMark :id="avatar.id" :size="44" />
        </button>
      </div>
    </fieldset>

    <p v-if="error" class="field-error">{{ error }}</p>
    <button class="btn btn--large btn--full" type="submit">Join the room</button>
    <p class="hint">
      {{
        chatOnly
          ? 'Your name and face are how the room knows you. You are asked this once.'
          : 'One tap here lets your browser start the music on its own. You are asked this once.'
      }}
    </p>
  </form>
</template>
