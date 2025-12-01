<template>
  <div class="printjobs-table-container">
    <h3 class="h3">Current Print Jobs</h3>
    <table class="printjobs-table">
      <thead>
        <tr>
          <th>Job Name</th>
          <th>Created By</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Started At</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="job in jobs"
          :key="job.jobId"
          @click="$emit('select', job)"
          class="job-row"
        >
          <td>{{ job.jobName }}</td>
          <td>{{ job.createdBy }}</td>
          <td>
            <span :class="['status-badge', `status-${job.status}`]">
              {{ job.status }}
            </span>
          </td>
          <td>{{ job.completedTasks }}/{{ job.totalTasks }}</td>
          <td>{{ formatDate(job.startedAt) }}</td>
        </tr>
        <!-- Empty rows for placeholder -->
        <tr v-for="n in emptyRows" :key="'empty-' + n">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  jobs: {
    type: Array,
    default: () => []
  },
  minRows: {
    type: Number,
    default: 5
  }
})

defineEmits(['select'])

const emptyRows = computed(() => Math.max(0, props.minRows - props.jobs.length))

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString()
}
</script>

<style scoped>
.printjobs-table-container {
  flex: 1;
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.h3 {
  margin: 0;
  color: #ffffff;
  font-size: 1.5rem;
  text-align: center;
}

.printjobs-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--text-primary);
}

.printjobs-table th,
.printjobs-table td {
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  text-align: left;
}

.printjobs-table th {
  background: var(--bg-darker);
  font-weight: 600;
  font-size: 0.9rem;
}

.printjobs-table td {
  background: var(--bg-dark);
  font-size: 0.85rem;
}

.job-row {
  cursor: pointer;
}

.job-row:hover td {
  background: var(--bg-light);
}

/* Status badges */
.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: capitalize;
}

.status-in-progress {
  background: var(--primary-color);
  color: #000;
}

.status-pending {
  background: #ffc107;
  color: #000;
}

.status-completed {
  background: #4caf50;
  color: #fff;
}

.status-cancelled {
  background: #9e9e9e;
  color: #fff;
}

.status-failed {
  background: #f44336;
  color: #fff;
}
</style>
