<script setup>
import AvatarMark from './AvatarMark.vue'

defineProps({
  members: { type: Array, default: () => [] },
})
</script>

<template>
  <section class="card members sketch-frame-2">
    <div class="members-head">
      <p class="eyebrow">In the room</p>
      <h3>{{ members.length }} {{ members.length === 1 ? 'listener' : 'listeners' }}</h3>
    </div>

    <ul v-if="members.length" class="member-list">
      <li v-for="member in members" :key="member.id">
        <AvatarMark :id="member.avatarId" :size="34" />
        <span class="member-name">{{ member.name }}</span>
        <span v-if="member.host" class="badge">host</span>
      </li>
    </ul>
    <p v-else class="muted">Nobody here yet. Share the invite link.</p>
  </section>
</template>
