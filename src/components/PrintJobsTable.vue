<template>
  <div class="printjobs-table-container">
    <div class="table-header">
      <h3 class="h3">Current Print Jobs</h3>
      <div class="per-page-selector">
        <label>Show:</label>
        <select v-model="perPage">
          <option v-for="option in perPageOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </div>
    </div>

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
          v-for="job in paginatedJobs"
          :key="job.jobId"
          class="job-row"
        >
          <td>
            <router-link :to="`/jobs/${job.jobId}`" class="table-link">
              {{ job.jobName }}
            </router-link>
          </td>
          <td>
            <router-link :to="`/users/${job.createdBy}`" class="table-link">
              {{ job.createdBy }}
            </router-link>
          </td>
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

    <!-- Pagination Controls -->
    <div class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="currentPage--"
      >
        &lt;
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="currentPage++"
      >
        &gt;
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  jobs: {
    type: Array,
    default: () => []
  }
})

defineEmits(['select'])

// Pagination state
const currentPage = ref(1)
const perPage = ref(5)
const perPageOptions = [3, 5, 10, 15, 20]

// Total pages
const totalPages = computed(() => {
  return Math.max(1, Math.ceil(props.jobs.length / perPage.value))
})

// Paginated jobs
const paginatedJobs = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  const end = start + perPage.value
  return props.jobs.slice(start, end)
})

// Empty rows to fill the table
const emptyRows = computed(() => {
  return Math.max(0, perPage.value - paginatedJobs.value.length)
})

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

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.h3 {
  margin: 0;
  color: #ffffff;
  font-size: 1.5rem;
}

.per-page-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.per-page-selector select {
  padding: 0.25rem 0.5rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
}

.printjobs-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--text-primary);
}

.printjobs-table th,
.printjobs-table td {
  border: 1px solid var(--border-color);
  padding: 0.75rem 1.25rem;
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

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: auto;
}

.page-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition: var(--transition);
}

.page-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: #000;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-secondary);
  font-size: 0.9rem;
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

/* Table links */
.table-link {
  color: var(--primary-color);
  text-decoration: none;
  transition: var(--transition);
}

.table-link:hover {
  text-decoration: underline;
  color: var(--text-primary);
}

.status-failed {
  background: #f44336;
  color: #fff;
}
</style>
