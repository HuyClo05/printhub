<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Print Task</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <!-- Editor To All Print Profile -->
      <div class="section">
        <PrintProfileEditor
          :settings="globalSettings"
          title="Editor To All Print Profile"
          @apply="applyToAllPrinters"
        />
      </div>

      <!-- Print Profile Selector -->
      <div class="section profile-selector">
        <h3>Print Profile Selector</h3>

        <div
          v-for="printerType in printerTypes"
          :key="printerType.id"
          class="printer-type-section"
        >
          <div class="printer-type-header">
            {{ printerType.name }}
          </div>
          <div class="profile-search">
            <input
              type="text"
              placeholder="Print Profile Search Bar"
              v-model="printerType.searchQuery"
            />
          </div>
          <div class="printer-cards-grid">
            <div
              v-for="printer in getFilteredPrinters(printerType)"
              :key="printer.printerId || printer.id"
              class="printer-profile-card"
              :class="{ selected: isProfileSelected(printer.printerId || printer.id) }"
              @click="selectPrinterProfile(printer)"
            >
              <div class="printer-card-name">{{ printer.name }}</div>
              <div class="preset-selectors">
                <div class="preset-select">
                  <label>Printer Preset</label>
                  <select v-model="printerProfiles[printer.printerId || printer.id].printerPreset" @click.stop>
                    <option value="">Select...</option>
                    <option v-for="preset in printer.printerPresets" :key="preset.id" :value="preset.id">
                      {{ preset.name }}
                    </option>
                  </select>
                </div>
                <div class="preset-select">
                  <label>Process Preset</label>
                  <select v-model="printerProfiles[printer.printerId || printer.id].processPreset" @click.stop>
                    <option value="">Select...</option>
                    <option v-for="preset in printer.processPresets" :key="preset.id" :value="preset.id">
                      {{ preset.name }}
                    </option>
                  </select>
                </div>
                <div class="preset-select">
                  <label>Filament Preset</label>
                  <select v-model="printerProfiles[printer.printerId || printer.id].filamentPreset" @click.stop>
                    <option value="">Select...</option>
                    <option v-for="preset in printer.filamentPresets" :key="preset.id" :value="preset.id">
                      {{ preset.name }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <ClearButton
          caption="Cancel"
          size="auto"
          hoverColor="#ff4444"
          @click="$emit('close')"
        />
        <ClearButton
          caption="Save Task"
          size="auto"
          hoverColor="var(--primary-color)"
          @click="saveTask"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import ClearButton from '@/components/ClearButton.vue'
import PrintProfileEditor from '@/components/PrintProfileEditor.vue'

const props = defineProps({
  task: {
    type: Object,
    default: () => ({})
  },
  printers: {
    type: Array,
    default: () => []
  },
  selectedPrinterIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'save'])

// Global settings that apply to all printers
const globalSettings = reactive({
  quality: {
    layerHeight: 0.2,
    firstLayerHeight: 0.3,
    lineWidth: 0.4
  },
  strength: {
    infillDensity: 20,
    infillPattern: 'grid',
    wallCount: 2
  },
  speed: {
    printSpeed: 60,
    travelSpeed: 120,
    firstLayerSpeed: 30
  },
  support: {
    enabled: false,
    type: 'normal',
    density: 15
  },
  material: {
    nozzleTemp: 200,
    bedTemp: 60,
    retractionDistance: 1.0
  },
  others: {
    brim: false,
    raft: false,
    skirtLoops: 2
  }
})

// Printer types
const printerTypes = ref([])
const filteredPrinters = ref([])
const printerProfiles = reactive({})

// Fetch data on mount
onMounted(async () => {
  // Filter printers to only show selected ones
  // Presets are stored directly in the printer document as arrays
  filteredPrinters.value = props.printers
    .filter(printer => {
      const printerId = printer.printerId || printer.id
      return props.selectedPrinterIds.includes(printerId)
    })
    .map(printer => ({
      ...printer,
      // Use existing presets from printer document, or empty arrays as fallback
      printerPresets: printer.printerPresets || [],
      processPresets: printer.processPresets || [],
      filamentPresets: printer.filamentPresets || []
    }))

  // Group printers by type
  const typeMap = {}
  filteredPrinters.value.forEach(printer => {
    const typeName = printer.model || 'Other'
    if (!typeMap[typeName]) {
      typeMap[typeName] = {
        id: typeName.toLowerCase().replace(/\s+/g, '-'),
        name: typeName,
        searchQuery: '',
        printers: []
      }
    }
    typeMap[typeName].printers.push(printer)

    // Initialize printer profile settings
    const printerId = printer.printerId || printer.id
    printerProfiles[printerId] = {
      printerPreset: '',
      processPreset: '',
      filamentPreset: '',
      customSettings: { ...globalSettings }
    }
  })

  printerTypes.value = Object.values(typeMap)
})

// Methods
const getFilteredPrinters = (printerType) => {
  const query = printerType.searchQuery?.toLowerCase() || ''
  return printerType.printers.filter(printer =>
    !query || printer.name?.toLowerCase().includes(query)
  )
}

const isProfileSelected = (printerId) => {
  return props.selectedPrinterIds.includes(printerId)
}

const applyToAllPrinters = () => {
  Object.keys(printerProfiles).forEach(printerId => {
    printerProfiles[printerId].customSettings = JSON.parse(JSON.stringify(globalSettings))
  })
}

const saveTask = () => {
  emit('save', {
    globalSettings: { ...globalSettings },
    printerProfiles: { ...printerProfiles }
  })
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 2px solid var(--border-color);
  background: var(--bg-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
}

.close-btn:hover {
  color: var(--text-primary);
}

.section {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  margin: 1rem;
  padding: 1rem;
}

.section h3 {
  margin: 0 0 1rem;
  color: var(--text-primary);
  font-size: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--primary-color);
}

.printer-type-section {
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  margin-bottom: 1rem;
}

.printer-type-header {
  background: var(--primary-color);
  padding: 0.5rem 1rem;
  font-weight: 600;
  color: #000;
  text-align: center;
}

.profile-search {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.profile-search input {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-light);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.printer-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  padding: 0.75rem;
}

.printer-profile-card {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  padding: 0.75rem;
  cursor: pointer;
}

.printer-profile-card.selected {
  border-color: var(--primary-color);
  background: rgba(0, 188, 212, 0.15);
}

.printer-card-name {
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.preset-selectors {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preset-select {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.preset-select label {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.preset-select select {
  padding: 0.3rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.75rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 2px solid var(--border-color);
  background: var(--bg-light);
}

.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: var(--bg-darker);
}

.modal-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
}
</style>
