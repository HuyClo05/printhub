<template>
  <div id="app">
    <NavBar ref="navbarRef" v-if="!isAuthPage" />
    <main>
      <RouterView />
    </main>
    <FooterBar v-if="!isAuthPage" />
  </div>
</template>

<script setup>
import { ref, watchEffect, computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'

const navbarRef = ref(null)
const navbarHeight = ref(0)

watchEffect(() => {
  navbarHeight.value = navbarRef.value?.height || 0
})

const route = useRoute()

// Hide NavBar and FooterBar on auth pages
const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/signup'
})
</script>

<style>
/* ===== GLOBAL COLORS & THEME ===== */
:root {
  --primary-color: #00bcd4;
  --bg-dark: #181818;
  --bg-darker: #1e1e1e;
  --bg-light: #2a2a2a;
  --border-color: #2c2c2c;
  --text-primary: #ffffff;
  --text-secondary: #ddd;
  --transition: all 0.3s ease;
}

html, body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-darker);
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app {
  padding-top: var(--navbar-height, 0px);
  background-color: var(--bg-dark);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ===== COMMON UTILITY CLASSES ===== */
a {
  transition: var(--transition);
}

button {
  transition: var(--transition);
}

/* ===== COMMON LINK STYLES ===== */
.nav-link {
  text-decoration: none;
  color: var(--text-primary);
}

.nav-link:hover {
  color: var(--primary-color);
}

/* ===== COMMON CARD STYLES ===== */
.card-base {
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
}

.card-base:hover {
  transform: translateY(-2.5px);
}

/* ===== COMMON INPUT STYLES ===== */
.input-base {
  background-color: var(--bg-light);
  border: none;
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 8px;
}

.input-base:focus {
  outline: none;
}

/* ===== COMMON BUTTON STYLES ===== */
.btn-base {
  background: none;
  border: none;
  cursor: pointer;
  transition: var(--transition);
}

.btn-icon-hover:hover {
  filter: brightness(0) invert(0);
}

/* ===== ROUTER VIEW LAYOUT ===== */
.app-main {
  flex: 1;
}

main {
  flex: 1;
  overflow-y: auto;
}
</style>
