import { createRouter, createWebHistory } from 'vue-router'

// import your page components
import HomeView from '../views/HomeView.vue'
import ModelsGrid from '@/views/ModelsGrid.vue'

// define route-to-component mapping
const routes = [
  { path: '/', component: HomeView },
  { path: '/models', component: ModelsGrid },
]

// create the router
const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
