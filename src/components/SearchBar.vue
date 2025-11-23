<template>
  <div class="search-bar">
    <input
      type="text"
      v-model="query"
      @keyup.enter="handleSearch"
      placeholder="Search..."
    />
    <img src="@/assets/icons/search.svg" alt="Search" class="icon" />
    
  </div>
</template>

<script setup>
import { ref } from 'vue'

// holds the text user types
const query = ref('')

// emits search event to parent
const emit = defineEmits(['search'])

const handleSearch = () => {
  emit('search', query.value.trim())
}
</script>

<style scoped>
.search-bar {
  display: flex;
  width: 30%;
  align-items: center;
  background-color: var(--bg-light);
  padding: 6px 10px;
  border-radius: 8px;
}

.search-bar input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 1rem;
  padding: 4px;
}
</style>
