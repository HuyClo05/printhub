<template>
  <footer class="footer-bar">
    <div class="footer-links">
      <a href="#">Support The Project</a>
      <span class="separator">-</span>
      <a href="#">Help</a>
      <span class="separator">-</span>
      <a href="#">Privacy</a>
      <span class="separator">-</span>
      <a href="#">TOS</a>
    </div>
    <a href="#" class="profile-icon">👤</a>
  </footer>
</template>

<script setup>
// No logic needed for now, pure layout
</script>

<style scoped>
.footer-bar {
  background-color: var(--primary-color);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.footer-links a {
  text-decoration: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  transition: var(--transition);
}

.footer-links a:hover {
  text-decoration: underline;
}

.separator {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.profile-icon {
  font-size: 1.5rem;
  text-decoration: none;
  color: var(--primary-color);
  background: var(--bg-light);
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
