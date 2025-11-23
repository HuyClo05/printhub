<template>
  <div class="home">
    <div class="content">
      <CategoryBar class="category-bar" />
      <main class="main">
        <SortBar />
        <div class="grid">
          <ModelCard
            v-for="model in models"
            :key="model.id"
            :id="model.id"
            :name="model.name"
            :authorLogo="model.authorLogo"
            :author="model.author"
            :thumbnail="model.thumbnail"
            :rating="model.rating"
            :downloads="model.downloads"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import CategoryBar from '@/components/CategoryBar.vue'
import SortBar from '@/components/SortBar.vue'
import ModelCard from '@/components/ModelCard.vue'
import { models } from '@/data/models.js'
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.home {
  font-family: Arial, sans-serif;
  background-color: #121212;
  color: #fff;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.category-bar {
  width: 250px;
  height: 100%;
  background-color: #1e1e1e;
  border-right: 2px solid #2c2c2c;
  overflow-y: auto;
}

.main {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
  background-color: #181818;
}

.category-bar,
.main {
  scrollbar-width: thin;
  scrollbar-color: #444 #1e1e1e;
}

.category-bar::-webkit-scrollbar,
.main::-webkit-scrollbar {
  width: 8px;
}

.category-bar::-webkit-scrollbar-thumb,
.main::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.main .grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 48px;
  padding: 0 20px 40px 32px;
  width: 100%;
}
</style>
