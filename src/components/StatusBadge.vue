<template>
  <span class="status-badge" :class="statusClass">{{ status }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'Ready'
  }
})

const statusClass = computed(() => {
  const status = props.status.toLowerCase()
  if (status.includes('printing')) return 'status-printing'
  if (status.includes('ready') || status.includes('idle')) return 'status-ready'
  if (status.includes('paused')) return 'status-paused'
  if (status.includes('error') || status.includes('fail')) return 'status-error'
  if (status.includes('offline')) return 'status-offline'
  return 'status-ready'
})
</script>

<style scoped>
.status-badge {
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  display: inline-block;
}

.status-printing {
  background: #2196f3;
  color: #fff;
}

.status-ready {
  background: #4caf50;
  color: #fff;
}

.status-paused {
  background: #ff9800;
  color: #000;
}

.status-error {
  background: #f44336;
  color: #fff;
}

.status-offline {
  background: #616161;
  color: #fff;
}
</style>
