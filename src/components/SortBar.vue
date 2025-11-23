<template>
  <div class="day-sort-bar">
    <ul class="categories">
      <li v-for="category in categories" :key="category">
        <button
          @click="selectCategory(category)"
          :class="{ active: category === selectedCategory }"
        >
          {{ category }}
        </button>
      </li>
    </ul>

    <select v-model="selectedSort" @change="emitChange">
      <option value="24_Hours">24 Hours</option>
      <option value="7_Days">7 Days</option>
      <option value="30_Days">30 Days</option>
      <option value="Year">Year</option>
      <option value="All Time">All Time</option>
    </select>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue'

const emit = defineEmits(['filterChange'])

const categories = ['Trending', 'New uploads', 'Downloads', 'Views', 'Random']
const selectedCategory = ref('All')
const selectedSort = ref('24_Hours')

// emit event to trigger API call
const emitChange = () => {
  emit('filterChange', {
    category: selectedCategory.value,
    sort: selectedSort.value,
  })
}

const selectCategory = (category) => {
  selectedCategory.value = category
  emitChange()
}
</script>

<style scoped>
.day-sort-bar {
  font-family: Arial, sans-serif;
  display: flex;
  align-items: center;
  gap: 20px;
  justify-content: left;
  background-color: #1e1e1e;
  color: #fff;
  padding: 16px 20px 16px 20px;
  border-bottom: 2px solid #2c2c2c;
}

.categories {
  list-style: none;
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0;
}

.categories button {
  background: none;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
}

.categories button:hover {
  background: #00bcd4;
  color: #000;
}

.categories button.active {
  background: #00bcd4;
  color: #000;
}

select {
  background-color: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.95rem;
  cursor: pointer;
}

select:hover {
  border-color: #00bcd4;
}

option {
  background-color: #1e1e1e;
  color: #fff;
}
</style>
