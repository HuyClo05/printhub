<template>
  <div class="printer-filter-bar">
    <button
      v-for="filter in filters"
      :key="filter.value"
      class="filter-btn"
      :class="{ active: modelValue === filter.value }"
      @click="$emit('update:modelValue', filter.value)"
    >
      {{ filter.label }}
    </button>
    <input
      :value="searchQuery"
      type="text"
      placeholder="Search..."
      class="search-input"
      @input="$emit('update:searchQuery', $event.target.value)"
    />
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue', 'update:searchQuery'])

const filters = [
  { label: 'All', value: '' },
  { label: 'Printing', value: 'printing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Idle', value: 'idle' },
  { label: 'Error', value: 'error' },
  { label: 'Offline', value: 'offline' }
]
</script>

<style scoped>
.printer-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.5rem;
  background: var(--bg-light);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.filter-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: var(--transition);
}

.filter-btn:hover {
  color: var(--text-primary);
  background: var(--bg-darker);
}

.filter-btn.active {
  color: var(--primary-color);
  background: var(--bg-darker);
}

.search-input {
  flex: 1;
  padding: 0.5rem 1rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}
</style>
