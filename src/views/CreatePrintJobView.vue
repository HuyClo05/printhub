<template>
  <div class="create-printjob-page">
    <div class="page-header">
      <div class="header-title">
        <h1>Create Print Job</h1>
        <input
          type="text"
          class="job-name-input"
          v-model="jobName"
          placeholder="Enter job name..."
        />
      </div>
      <div class="header-actions">
        <ClearButton
          caption="Cancel"
          size="auto"
          hoverColor="#ff4444"
          @click="handleCancel"
        />
        <ClearButton
          caption="Create Job"
          size="auto"
          hoverColor="var(--primary-color)"
          :disabled="!canCreateJob"
          @click="handleCreateJob"
        />
      </div>
    </div>

    <div class="create-layout">
      <!-- Task Creation Section -->
      <div class="section task-creation">
        <h3>Task Creation</h3>
        <div class="tasks-container">
          <div
            v-for="(task, index) in printTasks"
            :key="index"
            class="task-card"
            :class="{ active: selectedTaskIndex === index }"
          >
            <div class="task-header">Print Task</div>
            <div class="task-body" @click="handleTaskClick(index)">
              <div class="task-model" v-if="task.model">
                <img :src="task.model.thumbnailUrl || 'https://via.placeholder.com/60'" alt="Model" />
              </div>
              <div class="task-model empty" v-else>
                <span>Click to<br/>Select Model</span>
              </div>
            </div>
            <div class="task-footer">
              {{ task.model?.name || 'No Model' }}
            </div>
            <button
              class="edit-presets-btn"
              :disabled="task.selectedPrinters?.length === 0"
              @click="openTaskEditorForIndex(index)"
            >
              Edit Printer Presets
            </button>
            <div class="task-printers-badge" v-if="task.selectedPrinters?.length > 0">
              🖨️ {{ task.selectedPrinters.length }}
            </div>
            <button class="remove-task" @click.stop="removeTask(index)" v-if="printTasks.length > 1">×</button>
          </div>
          <div class="add-task-card" @click="addTask">
            <span class="plus-icon">+</span>
            <span>Add Task</span>
          </div>
        </div>
      </div>

      <!-- Hidden file input for model selection -->
      <input
        ref="fileInput"
        type="file"
        accept=".stl,.obj,.3mf,.gcode"
        hidden
        @change="handleFileSelect"
      />
    </div>

    <!-- Printer Select Section -->
    <div class="section printer-select">
      <h3>Printer Select</h3>
      <PrinterFilterBar
        v-model="statusFilter"
        v-model:searchQuery="printerSearch"
      />
      <div class="printer-select-grid">
        <PrinterSelectCard
          v-for="printer in filteredPrinters"
          :key="printer.printerId || printer.id"
          :printerName="printer.name"
          :status="printer.status?.state || 'offline'"
          :selected="selectedPrinters.includes(printer.printerId || printer.id)"
          @select="togglePrinterSelection(printer)"
        />
        <div v-if="filteredPrinters.length === 0" class="no-printers">
          No printers found
        </div>
      </div>
    </div>

    <!-- Bottom Summary -->
    <div class="job-summary" v-if="printTasks.some(t => t.model && t.selectedPrinters?.length > 0)">
      <h3>Job Summary</h3>
      <div class="summary-content">
        <div class="summary-item">
          <span class="summary-label">Ready Tasks:</span>
          <span class="summary-value">{{ printTasks.filter(t => t.model && t.selectedPrinters?.length > 0).length }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Current Task Printers:</span>
          <span class="summary-value">{{ selectedPrinters.length }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Models:</span>
          <span class="summary-value">{{ uniqueModels.length }}</span>
        </div>
      </div>
    </div>

    <!-- CreatePrintTask Popup -->
    <CreatePrintTask
      v-if="showTaskEditor"
      :task="editingTask"
      :printers="printers"
      :selectedPrinterIds="selectedPrinters"
      @close="closeTaskEditor"
      @save="saveTaskSettings"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../../firebase/init'
import { collection, getDocs } from 'firebase/firestore'
import { useAuth } from '../../firebase/authentication'
import { createPrintJob } from '@/services/printJobService'

import ClearButton from '@/components/ClearButton.vue'
import PrinterSelectCard from '@/components/PrinterSelectCard.vue'
import PrinterFilterBar from '@/components/PrinterFilterBar.vue'
import CreatePrintTask from '@/components/CreatePrintTask.vue'

const router = useRouter()
const { user } = useAuth()

// Data
const printers = ref([])
const fileInput = ref(null)
const jobName = ref('')

// Print Tasks
const printTasks = ref([{ model: null, settings: {}, selectedPrinters: [] }])
const selectedTaskIndex = ref(0)
const showTaskEditor = ref(false)
const editingTask = ref(null)

// Printer Selection (computed from current task)
const selectedPrinters = computed({
  get: () => printTasks.value[selectedTaskIndex.value]?.selectedPrinters || [],
  set: (val) => {
    if (printTasks.value[selectedTaskIndex.value]) {
      printTasks.value[selectedTaskIndex.value].selectedPrinters = val
    }
  }
})
const printerSearch = ref('')
const statusFilter = ref('')

// Fetch data on mount
onMounted(async () => {
  // Get all printers
  const printersSnapshot = await getDocs(collection(db, 'printers'))
  printers.value = printersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
})

// Computed
const filteredPrinters = computed(() => {
  return printers.value.filter(printer => {
    const searchTerm = printerSearch.value.toLowerCase()
    const matchesSearch = !searchTerm ||
      printer.name?.toLowerCase().includes(searchTerm) ||
      printer.model?.toLowerCase().includes(searchTerm)

    const matchesStatus = !statusFilter.value ||
      printer.status?.state?.toLowerCase() === statusFilter.value.toLowerCase()

    return matchesSearch && matchesStatus
  })
})

const uniqueModels = computed(() => {
  const models = printTasks.value
    .filter(t => t.model)
    .map(t => t.model.id)
  return [...new Set(models)]
})

const canCreateJob = computed(() => {
  // At least one task must have a model AND printers selected
  return printTasks.value.some(t => t.model && t.selectedPrinters?.length > 0)
})

// Methods
const handleTaskClick = (index) => {
  selectedTaskIndex.value = index
  const task = printTasks.value[index]

  // If task has no model, open file selector
  if (!task.model) {
    triggerFileInput()
  }
}

const openTaskEditorForIndex = (index) => {
  selectedTaskIndex.value = index
  editingTask.value = { ...printTasks.value[index], index }
  showTaskEditor.value = true
}

const closeTaskEditor = () => {
  showTaskEditor.value = false
  editingTask.value = null
}

const saveTaskSettings = (updatedTask) => {
  if (editingTask.value !== null && editingTask.value.index !== undefined) {
    printTasks.value[editingTask.value.index] = {
      ...printTasks.value[editingTask.value.index],
      ...updatedTask
    }
  }
  closeTaskEditor()
}

const addTask = () => {
  printTasks.value.push({ model: null, settings: {}, selectedPrinters: [] })
  selectedTaskIndex.value = printTasks.value.length - 1
}

const removeTask = (index) => {
  printTasks.value.splice(index, 1)
  if (selectedTaskIndex.value >= printTasks.value.length) {
    selectedTaskIndex.value = printTasks.value.length - 1
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const files = event.target.files
  if (files?.length > 0) {
    handleFileUpload(files[0])
  }
}

const handleFileUpload = (file) => {
  // Create a temporary model from the uploaded file
  const tempModel = {
    id: `temp_${Date.now()}`,
    name: file.name,
    thumbnailUrl: null,
    file: file
  }
  // Assign to currently selected task
  printTasks.value[selectedTaskIndex.value].model = tempModel
}

const togglePrinterSelection = (printer) => {
  const printerId = printer.printerId || printer.id
  const currentTask = printTasks.value[selectedTaskIndex.value]
  if (!currentTask) return

  const index = currentTask.selectedPrinters.indexOf(printerId)
  if (index === -1) {
    currentTask.selectedPrinters.push(printerId)
  } else {
    currentTask.selectedPrinters.splice(index, 1)
  }
}

const handleCancel = () => {
  router.push('/')
}

const handleCreateJob = async () => {
  if (!canCreateJob.value) return

  try {
    // Filter tasks that have both model and printers
    const tasksWithModels = printTasks.value.filter(t => t.model && t.selectedPrinters?.length > 0)

    // Prepare job data for the service
    const jobData = {
      jobName: jobName.value.trim() || `Job_${Date.now()}`,
      tasks: tasksWithModels.map(t => ({
        model: t.model,
        selectedPrinters: t.selectedPrinters,
        globalSettings: t.globalSettings || null,
        printerProfiles: t.printerProfiles || {},
        estimatedPrintTime: t.estimatedPrintTime || null
      }))
    }

    // Create job, tasks, and update printer queues
    const result = await createPrintJob(jobData, user.value?.uid || 'anonymous')

    console.log('Print job created:', result)

    // Navigate back to home
    router.push('/')
  } catch (error) {
    console.error('Error creating print job:', error)
  }
}
</script>

<style scoped>
.create-printjob-page {
  padding: 50px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-light);
  padding: 1.25rem 2rem;
  border: 2px solid var(--border-color);
}

.header-title {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.75rem;
  font-weight: 600;
}

.job-name-input {
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.75rem;
  color: var(--text-primary);
  font-size: 1rem;
  min-width: 300px;
}

.job-name-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.job-name-input::placeholder {
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.create-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  padding: 1.5rem;
}

.section h3 {
  margin: 0 0 1.25rem;
  color: var(--text-primary);
  font-size: 1.1rem;
  font-weight: 600;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--primary-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section h3::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--primary-color);
}

.tasks-container {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 0.5rem;
  margin: -0.5rem;
}

.task-card,
.add-task-card {
  flex: 0 0 140px;
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
  cursor: pointer;
  position: relative;
}

.task-card.active {
  border-color: var(--primary-color);
}

.add-task-card {
  border-style: dashed;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  min-height: 160px;
}

.task-header {
  background: var(--primary-color);
  padding: 0.6rem;
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: #000;
}

.task-body {
  padding: 1.25rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.task-model {
  width: 70px;
  height: 70px;
  border: 2px dashed var(--border-color);
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-light);
}

.task-model img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.task-model.empty {
  color: var(--text-secondary);
  font-size: 0.65rem;
  text-align: center;
  line-height: 1.3;
}

.task-footer {
  padding: 0.6rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(0, 0, 0, 0.2);
}

.remove-task {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  background: #ff5252;
  color: white;
  border: 2px solid var(--bg-darker);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-printers-badge {
  position: absolute;
  bottom: 50px;
  right: 4px;
  background: var(--primary-color);
  color: #000;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
}

.edit-presets-btn {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-light);
  border: none;
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
}

.edit-presets-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: #000;
}

.edit-presets-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plus-icon {
  font-size: 2.5rem;
  font-weight: 300;
}

.printer-select {
  margin-top: 0.5rem;
}

.printer-select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.no-printers {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
}

.job-summary {
  background: var(--bg-light);
  border: 2px solid var(--primary-color);
  padding: 1.25rem 2rem;
}

.job-summary h3 {
  margin: 0 0 1rem;
  color: var(--primary-color);
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.job-summary h3::before {
  content: '✓';
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--primary-color);
  color: #000;
  font-size: 0.8rem;
  font-weight: bold;
}

.summary-content {
  display: flex;
  gap: 3rem;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.summary-label {
  color: var(--text-secondary);
}

.summary-value {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 1.1rem;
  background: var(--bg-darker);
  padding: 0.25rem 0.75rem;
  min-width: 30px;
  text-align: center;
}

.tasks-container::-webkit-scrollbar {
  height: 8px;
}

.tasks-container::-webkit-scrollbar-track {
  background: var(--bg-darker);
}

.tasks-container::-webkit-scrollbar-thumb {
  background: var(--border-color);
}

@media (max-width: 768px) {
  .summary-content {
    flex-wrap: wrap;
    gap: 1.5rem;
  }
}
</style>
