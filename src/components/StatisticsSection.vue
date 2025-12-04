<template>
  <div class="stats-section">
    <h3>{{ title }}</h3>
    <div class="stats-content">
      <!-- Stats Table -->
      <div class="stats-table">
        <div
          v-for="stat in statsList"
          :key="stat.label"
          class="stat-row"
        >
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value">{{ formatValue(stat) }}</span>
        </div>
      </div>

      <!-- Stats Chart (Pie/Donut) -->
      <div v-if="showChart" class="stats-chart">
        <div class="donut-chart">
          <svg viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#333"
              stroke-width="15"
            />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="var(--primary-color)"
              stroke-width="15"
              :stroke-dasharray="`${completedPercent * 2.51} 251`"
              stroke-dashoffset="0"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div class="chart-legend">
            <div
              v-for="legend in legendItems"
              :key="legend.label"
              class="legend-item"
            >
              <span class="legend-dot" :class="legend.class"></span> {{ legend.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Statistics'
  },
  statsList: {
    type: Array,
    default: () => []
    // Expected format: [{ label: 'Total Time', value: 123, type: 'time' }, ...]
  },
  showChart: {
    type: Boolean,
    default: true
  },
  completedPercent: {
    type: Number,
    default: 0
  },
  legendItems: {
    type: Array,
    default: () => [
      { label: 'Offline', class: 'offline' },
      { label: 'Cancelled', class: 'cancelled' },
      { label: 'Completed', class: 'completed' }
    ]
  }
})

// Format time from seconds to human readable
const formatTime = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

const formatValue = (stat) => {
  if (stat.type === 'time') {
    return formatTime(stat.value)
  }
  if (stat.suffix) {
    return `${stat.value}${stat.suffix}`
  }
  return stat.value
}
</script>

<style scoped>
.stats-section {
  background: var(--bg-light);
  padding: 1rem;
}

.stats-section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  text-align: center;
}

.stats-content {
  display: flex;
  gap: 2rem;
}

.stats-table {
  flex: 1;
}

.stats-table .stat-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.stats-table .stat-label {
  color: var(--text-secondary);
}

.stats-table .stat-value {
  font-weight: 500;
}

/* Stats Chart */
.stats-chart {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.donut-chart {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.donut-chart svg {
  width: 100px;
  height: 100px;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-primary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.offline { background: #616161; }
.legend-dot.cancelled { background: #f44336; }
.legend-dot.completed { background: var(--primary-color); }

/* Responsive */
@media (max-width: 768px) {
  .stats-content {
    flex-direction: column;
  }
}
</style>
