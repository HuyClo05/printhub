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
import { ref, computed, onMounted } from 'vue'
import { db } from '../../firebase/init'
import { collection, getDocs } from 'firebase/firestore'

import ActionsBar from '@/components/ActionsBar.vue'
import PrintJobsTable from '@/components/PrintJobsTable.vue'
import PrinterFilterBar from '@/components/PrinterFilterBar.vue'
import PrinterGrid from '@/components/PrinterGrid.vue'

// Data from Firestore
const printers = ref([])
const printJobs = ref([])

onMounted(async () => {
  // Get all printers
  const printersSnapshot = await getDocs(collection(db, 'printers'))
  printers.value = printersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // Get all print jobs
  const jobsSnapshot = await getDocs(collection(db, 'printJobs'))
  printJobs.value = jobsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
})

// Search and filter state
const searchQuery = ref('')
const statusFilter = ref('')

// Filtered printers based on search and status filter
const filteredPrinters = computed(() => {
  return printers.value.filter(printer => {
    const searchTerm = searchQuery.value.toLowerCase()
    const matchesSearch = !searchTerm ||
      printer.name?.toLowerCase().includes(searchTerm) ||
      printer.model?.toLowerCase().includes(searchTerm) ||
      printer.status?.state?.toLowerCase().includes(searchTerm) ||
      printer.ownerId?.toLowerCase().includes(searchTerm)

    const matchesStatus = !statusFilter.value ||
      printer.status?.state?.toLowerCase() === statusFilter.value.toLowerCase()

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
