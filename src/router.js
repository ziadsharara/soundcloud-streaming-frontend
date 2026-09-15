import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import RoomView from './views/RoomView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/room/:id', name: 'room', component: RoomView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
