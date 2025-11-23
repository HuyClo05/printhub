<template>
  <div class="image-carousel">
    <div class="carousel-main">
      <img :src="currentImage" :alt="alt" />
    </div>
    <button v-if="images.length > 1" class="carousel-nav prev" @click="prevImage">❮</button>
    <button v-if="images.length > 1" class="carousel-nav next" @click="nextImage">❯</button>
    <div v-if="images.length > 1" class="carousel-indicators">
      <span 
        v-for="(_, idx) in images" 
        :key="idx"
        class="indicator"
        :class="{ active: currentImageIndex === idx }"
        @click="currentImageIndex = idx"
      ></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  images: {
    type: Array,
    required: true
  },
  alt: {
    type: String,
    default: 'Image'
  }
})

const currentImageIndex = ref(0)

const currentImage = computed(() => {
  return props.images[currentImageIndex.value]
})

const nextImage = () => {
  currentImageIndex.value = (currentImageIndex.value + 1) % props.images.length
}

const prevImage = () => {
  currentImageIndex.value = (currentImageIndex.value - 1 + props.images.length) % props.images.length
}
</script>

<style scoped>
.image-carousel {
  position: relative;
  border: 2px solid var(--border-color);
  overflow: hidden;
}

.carousel-main {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-darker);
}

.carousel-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.carousel-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
  transition: all 0.3s ease;
}

.carousel-nav:hover {
  background-color: var(--primary-color);
  color: #000;
}

.carousel-nav.prev {
  left: 10px;
}

.carousel-nav.next {
  right: 10px;
}

.carousel-indicators {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}

.indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.3s ease;
}

.indicator.active {
  background-color: var(--primary-color);
  transform: scale(1.2);
}

.indicator:hover {
  background-color: rgba(255, 255, 255, 0.8);
}
</style>
