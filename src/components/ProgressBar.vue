<template>
  <div class="progress-bar">
    <div class="bar" :style="{ width: percentage + '%' }"></div>
  </div>
</template>

<script setup>
defineProps({
  percentage: {
    type: Number,
    default: 0
  }
})
</script>

<style scoped>
.progress-bar {
  width: 100%;
  height: 20px;
  background-color: var(--bg-dark);
  overflow: hidden;
}

.bar {
  height: 100%;
  background-color: var(--primary-color);
  transition: width 0.3s ease;
}
</style>
