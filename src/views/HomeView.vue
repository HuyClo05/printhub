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
;      <PrinterGrid
        :printers="filteredPrinters"
        :printTasks="printTasks"
        @select="handlePrinterSelect"
        @quickView="handleQuickView"
      />
    </div>

    <!-- Quick View Popup -->
    <PrinterQuickView
      v-if="showQuickView"
      :printer="selectedPrinter"
      :printerQueue="selectedPrinterQueue"
      :printTasks="printTasks"
      @close="showQuickView = false"
    />

    <!-- Add Printer Popup -->
    <AddPrinter
      v-if="showAddPrinter"
      @close="showAddPrinter = false"
      @add="handleAddPrinter"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../../firebase/init'
import { collection, getDocs } from 'firebase/firestore'

import ActionsBar from '@/components/ActionsBar.vue'
import PrintJobsTable from '@/components/PrintJobsTable.vue'
import PrinterFilterBar from '@/components/PrinterFilterBar.vue'
import PrinterGrid from '@/components/PrinterGrid.vue'
import PrinterQuickView from '@/components/PrinterQuickView.vue'
import AddPrinter from '@/components/AddPrinter.vue'
import { addPrinter } from '@/services/printerService'
import { useAuth } from '../../firebase/authentication'

const router = useRouter()
const { user } = useAuth()

// Data from Firestore
const printers = ref([])
const printJobs = ref([])
const printTasks = ref([])
const printerQueues = ref({})

// Quick View state
const showQuickView = ref(false)
const selectedPrinter = ref(null)
const selectedPrinterQueue = ref([])

// Add Printer state
const showAddPrinter = ref(false)

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

  // Get all print tasks
  const tasksSnapshot = await getDocs(collection(db, 'printTasks'))
  printTasks.value = tasksSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // Get printer queues for each printer
  for (const printer of printers.value) {
    const queueSnapshot = await getDocs(collection(db, `printers/${printer.printerId}/queue`))
    printerQueues.value[printer.printerId] = queueSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }
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
  if (actionId === 'start-job') {
    router.push('/create-printjob')
  } else if (actionId === 'add-printer') {
    showAddPrinter.value = true
  }
}

const handleAddPrinter = async (printerData) => {
  try {
    const result = await addPrinter(printerData, user.value?.uid || 'anonymous')
    console.log('Printer added:', result)

    // Add to local printers list
    printers.value.push(result.printer)

    showAddPrinter.value = false
  } catch (error) {
    console.error('Error adding printer:', error)
  }
}

const handleJobSelect = (job) => {
  console.log('Job selected:', job)
  // TODO: Navigate to job details
}

const handlePrinterSelect = (printer) => {
  console.log('Printer selected:', printer)
  // TODO: Navigate to printer details
}

const handleQuickView = (printer) => {
  selectedPrinter.value = printer
  selectedPrinterQueue.value = printerQueues.value[printer.printerId] || []
  showQuickView.value = true
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
