<template>
  <div class="home-page">
    <!-- Upper Section: Actions Bar + Print Jobs Table -->
    <div class="upper-section">
      <ActionsBar @action="handleAction" />
      <PrintJobsTable :jobs="printJobs" @select="handleJobSelect" />
    </div>

    <!-- Grid of Accessible Printers -->
    <div class="printer-section">
      <PrinterFilterBar
        v-model="statusFilter"
        v-model:searchQuery="searchQuery"
      />
      <PrinterGrid :printers="filteredPrinters" @select="handlePrinterSelect" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { printers as printersData } from '@/data/printers'
import { printJobs as printJobsData } from '@/data/printJobs'
import ActionsBar from '@/components/ActionsBar.vue'
import PrintJobsTable from '@/components/PrintJobsTable.vue'
import PrinterFilterBar from '@/components/PrinterFilterBar.vue'
import PrinterGrid from '@/components/PrinterGrid.vue'

// Data from data folder
const printers = ref(printersData)
const printJobs = ref(printJobsData)

// Search and filter state
const searchQuery = ref('')
const statusFilter = ref('')

// Filtered printers based on search and status filter
const filteredPrinters = computed(() => {
  return printers.value.filter(printer => {
    const query = searchQuery.value.toLowerCase()
    const matchesSearch = !query ||
      printer.printerName.toLowerCase().includes(query) ||
      printer.model.toLowerCase().includes(query) ||
      printer.status.state.toLowerCase().includes(query) ||
      printer.ownerId.toLowerCase().includes(query)

    const matchesStatus = !statusFilter.value ||
      printer.status.state.toLowerCase() === statusFilter.value.toLowerCase()

    return matchesSearch && matchesStatus
  })
})

// Event handlers
const handleAction = (actionId) => {
  console.log('Action clicked:', actionId)
  // TODO: Implement action handlers
}

const handleJobSelect = (job) => {
  console.log('Job selected:', job)
  // TODO: Navigate to job details
}

const handlePrinterSelect = (printer) => {
  console.log('Printer selected:', printer)
  // TODO: Navigate to printer details
}
</script>

<style scoped>
.home-page {
  padding: 50px 20px 60px 20px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Upper Section: Actions + Table side by side */
.upper-section {
  display: flex;
  gap: 1.5rem;
}

/* Printer Section */
.printer-section {
  padding: 1.5rem, 1.5rem, 1.5rem, 1.5rem;
}
</style>
