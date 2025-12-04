<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <h1>{{ printer?.name || 'Printer' }}</h1>
            <StatusBadge :status="printer?.status?.state || 'offline'" />
          </div>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>

        <!-- Main Content -->
        <div class="modal-body">
          <!-- Webcam Section -->
          <div class="webcam-section">
            <div class="webcam-placeholder">
              <img v-if="printer?.status?.webcam" :src="printer.status.webcam" alt="Webcam" />
              <span v-else>Webcam</span>
            </div>
          </div>

          <!-- Temperature Cards Section -->
          <div class="temp-cards-section">
            <div class="temp-card">
              <div class="temp-card-label">Nozzle temperature</div>
              <div class="temp-card-value">
                {{ printer?.status?.nozzleTemp || 0 }}→{{ printer?.status?.nozzleTempTarget || 0 }}°C
              </div>
            </div>
            <div class="temp-card">
              <div class="temp-card-label">Bed temperature</div>
              <div class="temp-card-value">
                {{ printer?.status?.bedTemp || 0 }}→{{ printer?.status?.bedTempTarget || 0 }}°C
              </div>
            </div>
            <div class="temp-card">
              <div class="temp-card-label">Material</div>
              <div class="temp-card-value">
                {{ printer?.material || 'PLA' }}
              </div>
            </div>
            <div class="temp-card">
              <div class="temp-card-label">Speed</div>
              <div class="temp-card-value">
                {{ printer?.status?.fanSpeed || 100 }}%
              </div>
            </div>
            <div class="temp-card">
              <div class="temp-card-label">Current Z-height</div>
              <div class="temp-card-value">
                {{ printer?.zHeight || '0.00' }}mm
              </div>
            </div>
          </div>

          <!-- Print Task Queue Section -->
          <QueueSection
            title="Print Task Queue"
            :items="queueTasks"
            itemLabel="Task"
            emptyMessage="No tasks in queue"
            namePrefix="Print Task "
          />

          <!-- Printer Statistics Section -->
          <StatisticsSection
            title="Printer Statistics"
            :statsList="printerStatsList"
            :showChart="true"
            :completedPercent="completedPercent"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import StatusBadge from './StatusBadge.vue'
import QueueSection from './QueueSection.vue'
import StatisticsSection from './StatisticsSection.vue'

const props = defineProps({
  printer: {
    type: Object,
    required: true
  },
  printerQueue: {
    type: Array,
    default: () => []
  },
  printTasks: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close'])

// Get queue tasks with details
const queueTasks = computed(() => {
  return props.printerQueue.map(queueItem => {
    const task = props.printTasks.find(t => t.taskId === queueItem.taskId)
    return {
      ...queueItem,
      ...task
    }
  })
})

// Mock statistics - in real app, fetch from Firestore
const stats = ref({
  totalPrintTime: 583560, // seconds
  longestPrintTime: 183180, // seconds
  averagePrintTime: 76452, // seconds
  totalFilamentUsed: 2276.2,
  totalJobs: 92
})

// Convert stats to list format for StatisticsSection
const printerStatsList = computed(() => [
  { label: 'Total Print Time', value: stats.value.totalPrintTime, type: 'time' },
  { label: 'Longest Print Time', value: stats.value.longestPrintTime, type: 'time' },
  { label: 'Print Time - Ø', value: stats.value.averagePrintTime, type: 'time' },
  { label: 'Total Filament Used', value: stats.value.totalFilamentUsed, suffix: 'm' },
  { label: 'Total Jobs', value: stats.value.totalJobs }
])

// Completed percentage for donut chart
const completedPercent = computed(() => {
  // Mock value - replace with real calculation
  return 75
})

onMounted(() => {
  // Could initialize data fetching here
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-darker);
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  border: 2px solid var(--border-color);
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.modal-content::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--primary-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.modal-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: var(--text-primary);
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-secondary);
}

.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Webcam Section */
.webcam-section {
  width: 100%;
}

.webcam-placeholder {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--text-secondary);
}

.webcam-placeholder img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Temperature Cards Section */
.temp-cards-section {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.temp-card {
  flex: 1;
  background: var(--bg-light);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.temp-card-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.temp-card-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .temp-cards-section {
    flex-wrap: wrap;
  }

  .temp-card {
    flex: 1 1 45%;
  }
}
</style>
