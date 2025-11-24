import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../../firebase/authentication'

// import your page components
import HomeView from '../views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import SignupView from '@/views/SignupView.vue'

// define route-to-component mapping
const routes = [
  {
    path: '/',
    component: HomeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    component: LoginView
  },
  {
    path: '/signup',
    component: SignupView
  }
]

// create the router
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication
router.beforeEach((to, from, next) => {
  const { isAuthenticated } = useAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next('/login')
  } else if ((to.path === '/login' || to.path === '/signup') && isAuthenticated.value && (from.path !== '/login' && from.path !== '/signup')) {
    // Only redirect to home if coming from a non-auth page
    next('/')
  } else {
    next()
  }
})

export default router
