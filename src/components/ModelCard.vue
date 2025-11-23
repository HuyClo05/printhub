<template>
  <div class="card">
    <!-- Author Section -->
    <div class="author">
      <img :src="authorLogo" :alt="author" class="author-logo" />
      <p><b>{{ author }}</b></p>
    </div>

    <!-- Model Section (Thumbnail, Title, Bar) -->
    <div class="model">
      <!-- Thumbnail -->
      <img :src="thumbnail" :alt="name" class="thumbnail" />

      <div class="title">
        <h3>{{ name }}</h3>
      </div>

      <!-- Info Bar -->
      <div class="bar">
        <!-- Stats -->
        <div class="stats">
          <span>⭐ {{ rating }}</span>
          <span>⬇️ {{ formattedDownloads }}</span>
        </div>

        <!-- Action Buttons -->
        <div class="actions">
          <ClearButton hoverColor="#00bcd4" activeColor="#00bcd4" @click.stop>
            <template #icon>
              <img src="@/assets/icons/like.svg" alt="Like" />
            </template>
          </ClearButton>

          <ClearButton hoverColor="#00bcd4" activeColor="#00bcd4" @click.stop>
            <template #icon>
              <img src="@/assets/icons/save.svg" alt="Save" />
            </template>
          </ClearButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ClearButton from './ClearButton.vue'

const props = defineProps({
  id: Number,
  name: String,
  author: String,
  authorLogo: String,
  thumbnail: String,
  rating: [String, Number],
  downloads: Number
})

// Format download count (e.g., 1234 -> 1.2k)
const formatCount = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return count.toString()
}

const formattedDownloads = formatCount(props.downloads)
</script>

<style scoped>
.card {
  background: var(--bg-darker);
  overflow: hidden;
  border: 2px solid var(--border-color);
  cursor: pointer;
}

.model {
  display: block;
  text-decoration: none;
  color: inherit;
}

/* Thumbnail image */
.thumbnail {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

/* Author Section */
.author {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--bg-darker);
  color: white;
  padding: 0.6rem;
  text-decoration: none;
  cursor: pointer;
}

.author:hover {
  background-color: var(--bg-light);
}

.author p {
  position: relative;
  top: 2px;
  margin: 0;
}

.author-logo {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
}

.title h3 {
  margin: 0;
  font-size: 1.3rem;
  padding-left: 13px;
  padding-top: 7px;
  color: #ffffff;
}

/* Info Bar (rating + downloads + actions) */
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 0 0 6px 6px;
}

.bar .stats {
  display: flex;
  gap: 12px;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.bar .actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.bar .actions img {
  width: 20px;
  height: 20px;
  filter: brightness(0) invert(0.4);
}

.bar .actions img:hover {
  filter: brightness(0) invert(0);
}
</style>
