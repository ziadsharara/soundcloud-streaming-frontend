import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import RoomView from './views/RoomView.vue'
import { parseRoomCode } from './roomCode'

function canonicalRoom(to) {
  const id = parseRoomCode(to.params.id)
  if (id && to.params.id !== id) return { name: 'room', params: { id }, replace: true }
}

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/room/:id', name: 'room', component: RoomView, props: true, beforeEnter: canonicalRoom },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
