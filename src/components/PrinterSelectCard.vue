<template>
  <div
    class="printer-select-card"
    :class="{ selected: selected }"
    @click="$emit('select')"
  >
    <span class="printer-name">{{ printerName }}</span>
    <StatusBadge :status="status" />
  </div>
</template>

<script setup>
import StatusBadge from './StatusBadge.vue'

defineProps({
  printerName: {
    type: String,
    default: 'Printer'
  },
  status: {
    type: String,
    default: 'offline'
  },
  selected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])
</script>

<style scoped>
.printer-select-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
  cursor: pointer;
}

.printer-select-card.selected {
  border-color: var(--primary-color);
  background: rgba(0, 188, 212, 0.1);
}

.printer-name {
  color: var(--text-primary);
  font-weight: 500;
  font-size: 0.9rem;
}
</style>
