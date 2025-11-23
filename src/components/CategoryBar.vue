<template>
  <aside class="category-bar">
    <h3>Categories</h3>
    <ul>
      <li v-for="category in categories" :key="category">
        <button @click="select(category)" :class="{ active: category === selected }">
          {{ category }}
        </button>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { ref } from 'vue'

const categories = ['All', 'Toys', 'Tools', 'Decor', 'Gadgets', 'Other']
const selected = ref('All')

function select(category) {
  selected.value = category
}
</script>

<style scoped>
.category-bar {
  font-family: Arial, sans-serif;
  width: 12.5%;
  background: var(--bg-darker);
  border-right: 2px solid var(--border-color);
  padding: 20px;
  height: 100%;
  position: sticky;
}

.category-bar h3 {
  margin-bottom: 15px;
  font-size: 1.3rem;
  font-weight: 600;
}

.category-bar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-bar button {
  display: block;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 6px;
}

.category-bar button:hover {
  background: var(--bg-light);
  color: var(--text-primary);
}

.category-bar button.active {
  background: var(--primary-color);
  color: #000000;
}
</style>
