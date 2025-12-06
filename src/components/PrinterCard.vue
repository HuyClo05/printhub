<template>
  <div class="printer-card">
    <div class="snapshot-container">
      <img :src="imageSource" alt="Printer snapshot" />
    </div>

    <div class="printer-info">
      <div class="printer-header">
        <h2>{{ printerName }}</h2>
        <StatusBadge :status="status" />
      </div>

      <div class="printer-stats">
        <div class="stat-row">
          <span class="stat-label">Task</span>
          <span class="stat-value">{{ currentPrintTask }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Nozzle</span>
          <span class="stat-value">{{ nozzleTemp }}°C</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Bed</span>
          <span class="stat-value">{{ bedTemp }}°C</span>
        </div>

        <div class="progress-section">
          <div class="progress-header">
            <span>Progress</span>
            <span>{{ percentage }}%</span>
          </div>
          <ProgressBar :percentage="percentage" />
        </div>
      </div>

      <div class="navigation-section">
        <ClearButton
          class="nav-btn"
          caption="Klipper"
          size="auto"
          hoverColor="var(--primary-color)"
        />
        <ClearButton
          class="nav-btn"
          caption="Quick View"
          size="auto"
          hoverColor="var(--primary-color)"
          @click.stop="$emit('quickView')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'
import ClearButton from './ClearButton.vue'
import StatusBadge from './StatusBadge.vue'
import ender3Image from '@/assets/images/Ender-3Size.jpg'
import printerImage from '@/assets/images/images.jpg'

defineEmits(['quickView'])

// Default images array
const defaultImages = [ender3Image, printerImage]

const props = defineProps({
  printerName: {
    type: String,
    default: "Printer-1"
  },
  printerSnapshot: {
    type: String,
    default: null
  },
  currentPrintTask: {
    type: String,
    default: "No active task"
  },
  status: {
    type: String,
    default: "Ready"
  },
  nozzleTemp: {
    type: Number,
    default: 0
  },
  bedTemp: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  }
})

// Use local images instead of placeholder URLs
const imageSource = computed(() => {
  // If no snapshot or it's a placeholder URL, use local images
  if (!props.printerSnapshot || props.printerSnapshot.includes('placeholder')) {
    // Use printer name to consistently pick an image (not random each render)
    const index = props.printerName.length % defaultImages.length
    return defaultImages[index]
  }
  return props.printerSnapshot
})
</script>

<style scoped>
.printer-card {
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
  overflow: hidden;
  display: flex;
  width: 520px;
  transition: all 0.3s ease;
}

/* Snapshot Section */
.snapshot-container {
  position: relative;
  flex-shrink: 0;
}

.snapshot-container img {
  width: 260px;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Info Section */
.printer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-left: 2px solid var(--border-color);
}

.printer-header {
  background: var(--primary-color);
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
}

.printer-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

/* Stats Section */
.printer-stats {
  padding: 1rem;
  flex: 1;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border-color);
}

.stat-row:last-of-type {
  border-bottom: none;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.stat-value {
  color: var(--text-primary);
  font-weight: 500;
  font-size: 0.9rem;
}

/* Progress Section */
.progress-section {
  margin-top: 1rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.progress-header span:last-child {
  color: var(--primary-color);
  font-weight: 600;
}

/* Navigation Section */
.navigation-section {
  display: flex;
  border-top: 2px solid var(--border-color);
}

.nav-btn {
  flex: 1;
  width: 50% !important;
  height: auto !important;
  padding: 0.75rem 1rem;
  background: var(--bg-dark);
  border: none;
  border-radius: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.nav-btn:first-child {
  border-right: 1px solid var(--border-color);
}
</style>
