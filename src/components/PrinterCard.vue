<template>
  <div class="printer-card">
    <div class="snapshot-container">
      <img :src="printerSnapshot" alt="Printer snapshot" />
    </div>

    <div class="printer-info">
      <div class="printer-header">
        <h2>{{ printerName }}</h2>
        <span class="status-badge" :class="statusClass">{{ status }}</span>
      </div>

      <div class="printer-stats">
        <div class="stat-row">
          <span class="stat-label">Job</span>
          <span class="stat-value">{{ currentPrintJob }}</span>
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

      <div class="action-buttons">
        <ClearButton
          class="action-btn btn"
          caption="Pause"
          size="auto"
          hoverColor="var(--primary-color)"
        />
        <ClearButton
          class="action-btn btn"
          caption="Stop"
          size="auto"
          hoverColor="#f44336"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ProgressBar from './ProgressBar.vue'
import ClearButton from './ClearButton.vue'

const props = defineProps({
  printerName: {
    type: String,
    default: "Printer-1"
  },
  printerSnapshot: {
    type: String,
    default: "https://via.placeholder.com/260"
  },
  currentPrintJob: {
    type: String,
    default: "No active job"
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

const statusClass = computed(() => {
  const status = props.status.toLowerCase()
  if (status.includes('printing')) return 'status-printing'
  if (status.includes('ready')) return 'status-ready'
  if (status.includes('error') || status.includes('fail')) return 'status-error'
  return 'status-ready'
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
  width: 220px;
  height: 100%;
  object-fit: cover;
  display: block;
}

.status-badge {
  top: 10px;
  left: 10px;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-printing {
  background: var(--primary-color);
  color: #000;
}

.status-ready {
  background: #4caf50;
  color: #fff;
}

.status-error {
  background: #f44336;
  color: #fff;
}

/* Info Section */
.printer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
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

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-dark);
  border-top: 1px solid var(--border-color);
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.btn {
  background: var(--bg-light);
  border: 1px solid var(--border-color);
}
</style>
