<template>
  <div class="printer-grid">
    <PrinterCard
      v-for="printer in printers"
      :key="printer.printerId"
      :printerName="printer.name"
      :printerSnapshot="printer.status?.webcam"
      :currentPrintTask="printer.currentTaskId || ''"
      :status="printer.status?.state"
      :nozzleTemp="printer.status?.nozzleTemp"
      :bedTemp="printer.status?.bedTemp"
      :percentage="getTaskProgress(printer.printerId, printer.currentTaskId)"
      @click="$emit('select', printer)"
    />
    <div v-if="printers.length === 0" class="no-printers">
      No printers found
    </div>
  </div>
</template>

<script setup>
import PrinterCard from '@/components/PrinterCard.vue'

const props = defineProps({
  printers: {
    type: Array,
    default: () => []
  },
  printTasks: {
    type: Array,
    default: () => []
  }
})

// Get progress for a specific printer from its current task
const getTaskProgress = (printerId, currentTaskId) => {
  if (!currentTaskId) return 0
  const task = props.printTasks.find(t => t.taskId === currentTaskId)
  if (!task || !task.assigned) return 0
  // Find this printer's assignment in the task
  const assignment = task.assigned.find(a => a.printerId === printerId)
  return assignment?.progress || 0
}

defineEmits(['select'])
</script>

<style scoped>
.printer-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
  justify-content: center;
}

.no-printers {
  color: var(--text-secondary);
  font-size: 1rem;
  padding: 2rem;
  text-align: center;
  width: 100%;
}
</style>
