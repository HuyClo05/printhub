<template>
  <nav ref="navbar" class="navbar">
    <div class="left-section">
      <div class="logo">
        <router-link to="/">PrintHub</router-link>
      </div>
      <ul class="nav-links">
        <li><router-link to="/models">3D Models</router-link></li>
      </ul>
    </div>

    <div class="center-section">
      <SearchBar @search="onSearch" />
    </div>

    <div class="right-section">
      <ul class="nav-links">
        <!-- Profile removed -->
      </ul>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from 'vue'
import SearchBar from '@/components/SearchBar.vue'

const navbar = ref(null)
const height = ref(0)

// Function to update height dynamically
const updateHeight = () => {
  height.value = navbar.value?.offsetHeight || 0
}

onMounted(() => {
  // Set initial height
  updateHeight()

  // Listen for window resize (in case navbar layout changes)
  window.addEventListener('resize', updateHeight)

  // listen for font load/layout shifts
  const resizeObserver = new ResizeObserver(updateHeight)
  if (navbar.value) resizeObserver.observe(navbar.value)

  // Clean up when component unmounts
  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateHeight)
    resizeObserver.disconnect()
  })
})

// Expose height to parent (App.vue)
defineExpose({ height })

const onSearch = (query) => {
  console.log('Search query:', query)
}
</script>

<style scoped>
.navbar {
  font-family: Arial, sans-serif;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 6px 20px;
  background-color: var(--primary-color);
}

.logo a {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
  transition: var(--transition);
}

.nav-links {
  display: flex;
  gap: 1.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-links a {
  text-decoration: none;
  color: #fff;
  transition: var(--transition);
}

.profile-link {
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-icon {
  width: 24px;
  height: 24px;
  transition: var(--transition);
}

.profile-link:hover .profile-icon {
  filter: brightness(1.2);
}

.left-section {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.center-section {
  display: flex;
  justify-content: center;
  width: 100%;
}

.right-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 60px;
}
</style>
