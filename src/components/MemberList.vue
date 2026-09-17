<script setup>
import { computed } from 'vue'
import AvatarMark from './AvatarMark.vue'

/**
 * Who is here, and who actually has the music playing.
 *
 * In a listening room those are different questions: someone can have the page open with audio
 * never started, or paused, and the room would otherwise count them as a listener.
 */
const props = defineProps({
  members: { type: Array, default: () => [] },
  /** A chat room has no music, so there is nothing to be listening to. */
  chatOnly: { type: Boolean, default: false },
})

const listening = computed(() => props.members.filter((member) => member.listening).length)
</script>

<template>
  <section class="card members sketch-frame-2">
    <div class="members-head">
      <p class="eyebrow">In the room</p>
      <h3 v-if="chatOnly">{{ members.length }} here</h3>
      <h3 v-else>
        {{ listening }} listening
        <span v-if="members.length !== listening" class="muted">of {{ members.length }} here</span>
      </h3>
    </div>

    <ul v-if="members.length" class="member-list">
      <li v-for="member in members" :key="member.id" :class="{ 'is-listening': member.listening }">
        <AvatarMark :id="member.avatarId" :size="34" />
        <span class="member-name">{{ member.name }}</span>
        <span v-if="member.host" class="badge">host</span>
        <span
          v-if="!chatOnly"
          class="member-state"
          :title="member.listening ? 'Playing, in sync' : 'Here, not playing'"
        >
          <template v-if="member.listening">
            <span class="member-bars" aria-hidden="true"><i></i><i></i><i></i></span>
            listening
          </template>
          <template v-else>idle</template>
        </span>
      </li>
    </ul>
    <p v-else class="muted">Nobody here yet. Share the invite link.</p>
  </section>
</template>
