<template>
  <div class="printer-grid">
    <PrinterCard
      v-for="printer in printers"
      :key="printer.printerId"
      :printerName="printer.name"
      :printerSnapshot="printer.status?.webcam"
      :currentPrintJob="printer.currentTaskId || ''"
      :status="printer.status?.state"
      :nozzleTemp="printer.status?.nozzleTemp"
      :bedTemp="printer.status?.bedTemp"
      :percentage="0"
      @click="$emit('select', printer)"
    />
    <div v-if="printers.length === 0" class="no-printers">
      No printers found
    </div>
  </div>
</template>

<script setup>
import PrinterCard from '@/components/PrinterCard.vue'

defineProps({
  printers: {
    type: Array,
    default: () => []
  }
})

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
