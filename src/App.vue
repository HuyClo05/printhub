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
  padding: 10px 0px 0px 0px;
}

#app main {
  flex: 1;
}

.app {
  background-color: var(--bg-dark);
  flex-direction: column;
  min-height: 100vh;
}
</style>
