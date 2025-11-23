<template>
  <div class="home">
    <!-- Ad Slideshow -->
    <div class="ad-section">
      <div class="ad-slideshow">
        <div class="ad-container">
          <AdCard
            v-for="ad in visibleAds"
            :key="ad.id"
            :image="ad.image"
            :title="ad.title"
            :link="ad.link"
            :description="ad.description"
            :ctaText="ad.ctaText"
            :href="ad.href"
          />
        </div>
      </div>
    </div>

    <div class="trending-tag">

    </div>

    <div class="content-section">
      <h3>
        Featured Models
      </h3>
      <div class="carousel-container">
        <button class="carousel-button carousel-button-left" @click="scrollLeft" aria-label="Scroll left">
          <span>&#8249;</span>
        </button>
        <div class="row" ref="scrollContainer">
          <ModelCard
            v-for="model in visibleModels"
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
        <button class="carousel-button carousel-button-right" @click="scrollRight" aria-label="Scroll right">
          <span>&#8250;</span>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import ModelCard from '@/components/ModelCard.vue';
import AdCard from '@/components/AdCard.vue'
import { models } from '@/data/models';
import { ads } from '@/data/ads.js'

const currentPage = ref(0);
const adPage = ref(0);
const cardsPerPage = 4;
let autoScrollInterval;

const visibleModels = computed(() => {
  const start = currentPage.value * cardsPerPage;
  return models.slice(start, start + cardsPerPage);
});

const visibleAds = computed(() => {
  return [ads[adPage.value % ads.length]];
});

const scrollLeft = () => {
  if (currentPage.value > 0) {
    currentPage.value--;
  }
};

const scrollRight = () => {
  const maxPage = Math.ceil(models.length / cardsPerPage) - 1;
  if (currentPage.value < maxPage) {
    currentPage.value++;
  }
};

const startAutoScroll = () => {
  autoScrollInterval = setInterval(() => {
    scrollRightAds();
  }, 30000); // Auto-scroll every 30 seconds
};

const stopAutoScroll = () => {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
  }
};

const scrollRightAds = () => {
  adPage.value = (adPage.value + 1) % ads.length;
};

// Lifecycle hooks
onMounted(() => {
  startAutoScroll();
});

onBeforeUnmount(() => {
  stopAutoScroll();
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.home {
  padding: 0px 0px 80px 0px;
}

.ad-section {
  width: 100%;
  padding: 20px 20px;
}

.ad-slideshow {
  display: flex;
  align-items: stretch;
  position: relative;
  gap: 16px;
  width: 100%;
}

.ad-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  border-radius: 8px;
  height: 400px;
}

.ad-container > * {
  width: 100%;
  height: 100%;
}

.carousel-container {
  display: flex;
  align-items: stretch;
  position: relative;
  gap: 16px;
}

.row {
  display: flex;
  overflow: hidden;
  flex: 1;
  gap: 16px;
}

.row > * {
  flex: 0 0 calc(25% - 12px);
  min-width: calc(25% - 12px);
}

.carousel-button {
  flex-shrink: 0;
  width: 40px;
  border: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-button-left {
  order: -1;
}

.carousel-button-right {
  order: 1;
}

.carousel-button:hover {
  background-color: #2c2c2c;
}

h3 {
  margin-bottom: 15px;
  font-size: 2rem;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 20px 20px 20px;
  width: 100%;
  border-top: 2px solid var(--border-color);
}

.content-section:first-of-type {
  border-top: none;
}
</style>
