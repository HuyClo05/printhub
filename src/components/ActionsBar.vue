<template>
  <div class="actions-bar">
    <h3 class="h3">Actions Bar</h3>
    <ClearButton
      v-for="action in actions"
      :key="action.id"
      class="action-btn"
      :caption="action.caption"
      size="auto"
      hoverColor="var(--primary-color)"
      @click="$emit('action', action.id)"
    />
  </div>
</template>

<script setup>
import ClearButton from '@/components/ClearButton.vue'

defineEmits(['action'])

const actions = [
  { id: 'start-job', caption: 'Start A Print Job' },
  { id: 'add-printer', caption: 'Add a Printer' }
]
</script>

<style scoped>
.actions-bar {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 200px;
}

.h3 {
  margin: 0;
  color: #ffffff;
  font-size: 1.5rem;
  text-align: center;
}

.action-btn {
  width: 100% !important;
  height: auto !important;
  padding: 0.75rem 1rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  text-align: center;
  color: var(--text-primary);
}

.action-btn:hover {
  background: var(--primary-color);
  color: #000;
}
</style>
