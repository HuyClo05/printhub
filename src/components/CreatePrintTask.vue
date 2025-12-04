<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Print Task</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <!-- Editor To All Print Profile -->
      <div class="section preset-editor">
        <h3>Editor To All Print Profile</h3>
        <div class="preset-tabs">
          <button
            v-for="tab in presetTabs"
            :key="tab.id"
            class="preset-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="editor-content">
          <div v-if="activeTab === 'quality'" class="editor-fields">
            <div class="field-row">
              <label>Layer Height</label>
              <input type="number" v-model="globalSettings.quality.layerHeight" step="0.05" /> mm
            </div>
            <div class="field-row">
              <label>First Layer Height</label>
              <input type="number" v-model="globalSettings.quality.firstLayerHeight" step="0.05" /> mm
            </div>
            <div class="field-row">
              <label>Line Width</label>
              <input type="number" v-model="globalSettings.quality.lineWidth" step="0.05" /> mm
            </div>
          </div>
          <div v-else-if="activeTab === 'strength'" class="editor-fields">
            <div class="field-row">
              <label>Infill Density</label>
              <input type="number" v-model="globalSettings.strength.infillDensity" min="0" max="100" /> %
            </div>
            <div class="field-row">
              <label>Infill Pattern</label>
              <select v-model="globalSettings.strength.infillPattern">
                <option value="grid">Grid</option>
                <option value="gyroid">Gyroid</option>
                <option value="honeycomb">Honeycomb</option>
                <option value="lines">Lines</option>
              </select>
            </div>
            <div class="field-row">
              <label>Wall Count</label>
              <input type="number" v-model="globalSettings.strength.wallCount" min="1" />
            </div>
          </div>
          <div v-else-if="activeTab === 'speed'" class="editor-fields">
            <div class="field-row">
              <label>Print Speed</label>
              <input type="number" v-model="globalSettings.speed.printSpeed" /> mm/s
            </div>
            <div class="field-row">
              <label>Travel Speed</label>
              <input type="number" v-model="globalSettings.speed.travelSpeed" /> mm/s
            </div>
            <div class="field-row">
              <label>First Layer Speed</label>
              <input type="number" v-model="globalSettings.speed.firstLayerSpeed" /> mm/s
            </div>
          </div>
          <div v-else-if="activeTab === 'support'" class="editor-fields">
            <div class="field-row">
              <label>Enable Support</label>
              <input type="checkbox" v-model="globalSettings.support.enabled" />
            </div>
            <div class="field-row">
              <label>Support Type</label>
              <select v-model="globalSettings.support.type" :disabled="!globalSettings.support.enabled">
                <option value="normal">Normal</option>
                <option value="tree">Tree</option>
              </select>
            </div>
            <div class="field-row">
              <label>Support Density</label>
              <input type="number" v-model="globalSettings.support.density" min="0" max="100" :disabled="!globalSettings.support.enabled" /> %
            </div>
          </div>
          <div v-else-if="activeTab === 'mm'" class="editor-fields">
            <div class="field-row">
              <label>Nozzle Temperature</label>
              <input type="number" v-model="globalSettings.material.nozzleTemp" /> °C
            </div>
            <div class="field-row">
              <label>Bed Temperature</label>
              <input type="number" v-model="globalSettings.material.bedTemp" /> °C
            </div>
            <div class="field-row">
              <label>Retraction Distance</label>
              <input type="number" v-model="globalSettings.material.retractionDistance" step="0.1" /> mm
            </div>
          </div>
          <div v-else-if="activeTab === 'others'" class="editor-fields">
            <div class="field-row">
              <label>Brim</label>
              <input type="checkbox" v-model="globalSettings.others.brim" />
            </div>
            <div class="field-row">
              <label>Raft</label>
              <input type="checkbox" v-model="globalSettings.others.raft" />
            </div>
            <div class="field-row">
              <label>Skirt Loops</label>
              <input type="number" v-model="globalSettings.others.skirtLoops" min="0" />
            </div>
          </div>
        </div>
        <div class="apply-all-btn">
          <ClearButton
            caption="Apply To All Printers"
            size="auto"
            hoverColor="var(--primary-color)"
            @click="applyToAllPrinters"
          />
        </div>
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
              :key="printer.id"
              class="printer-profile-card"
              :class="{ selected: isProfileSelected(printer.id) }"
              @click="selectPrinterProfile(printer)"
            >
              <div class="printer-card-name">{{ printer.name }}</div>
              <div class="preset-selectors">
                <div class="preset-select">
                  <label>Printer Preset</label>
                  <select v-model="printerProfiles[printer.id].printerPreset" @click.stop>
                    <option value="">Select...</option>
                    <option v-for="preset in printer.printerPresets" :key="preset.id" :value="preset.id">
                      {{ preset.name }}
                    </option>
                  </select>
                </div>
                <div class="preset-select">
                  <label>Process Preset</label>
                  <select v-model="printerProfiles[printer.id].processPreset" @click.stop>
                    <option value="">Select...</option>
                    <option v-for="preset in printer.processPresets" :key="preset.id" :value="preset.id">
                      {{ preset.name }}
                    </option>
                  </select>
                </div>
                <div class="preset-select">
                  <label>Filament Preset</label>
                  <select v-model="printerProfiles[printer.id].filamentPreset" @click.stop>
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
import { db } from '../../firebase/init'
import { collection, getDocs } from 'firebase/firestore'
import ClearButton from '@/components/ClearButton.vue'

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

// Preset tabs
const presetTabs = [
  { id: 'quality', label: 'Quality' },
  { id: 'strength', label: 'Strength' },
  { id: 'speed', label: 'Speed' },
  { id: 'support', label: 'Support' },
  { id: 'mm', label: 'MM' },
  { id: 'others', label: 'Others' }
]

const activeTab = ref('quality')

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
  filteredPrinters.value = props.printers
    .filter(printer => {
      const printerId = printer.printerId || printer.id
      return props.selectedPrinterIds.includes(printerId)
    })
    .map(printer => ({
      ...printer,
      printerPresets: [],
      processPresets: [],
      filamentPresets: []
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
    printerProfiles[printer.id] = {
      printerPreset: '',
      processPreset: '',
      filamentPreset: '',
      customSettings: { ...globalSettings }
    }
  })

  printerTypes.value = Object.values(typeMap)

  // Fetch presets for each printer
  for (const printer of filteredPrinters.value) {
    try {
      // Get printer presets
      const printerPresetsSnap = await getDocs(collection(db, `printers/${printer.id}/printerPresets`))
      printer.printerPresets = printerPresetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Get process presets
      const processPresetsSnap = await getDocs(collection(db, `printers/${printer.id}/processPresets`))
      printer.processPresets = processPresetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Get filament presets
      const filamentPresetsSnap = await getDocs(collection(db, `printers/${printer.id}/filamentPresets`))
      printer.filamentPresets = filamentPresetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (error) {
      console.log(`No presets found for printer ${printer.id}`)
    }
  }
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

const selectPrinterProfile = (printer) => {
  // Toggle selection or just highlight
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
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

/* Section */
.section {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  margin: 1rem;
  padding: 1rem;
}

.section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--primary-color);
}

/* Preset Editor */
.preset-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.preset-tab {
  padding: 0.5rem 1rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
}

.preset-tab.active {
  background: var(--primary-color);
  color: #000;
  border-color: var(--primary-color);
}

.editor-content {
  background: var(--bg-darker);
  padding: 1rem;
  border: 1px solid var(--border-color);
  margin-bottom: 1rem;
}

.editor-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.field-row label {
  flex: 0 0 150px;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.field-row input[type="number"],
.field-row input[type="text"],
.field-row select {
  flex: 1;
  max-width: 150px;
  padding: 0.4rem 0.6rem;
  background: var(--bg-light);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.field-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.apply-all-btn {
  display: flex;
  justify-content: flex-end;
}

/* Profile Selector */
.printer-type-section {
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  margin-bottom: 1rem;
}

.printer-type-header {
  background: #8bc34a;
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
  background: #5c9bd5;
  border: 2px solid var(--border-color);
  padding: 0.75rem;
  cursor: pointer;
}

.printer-profile-card.selected {
  border-color: var(--primary-color);
}

.printer-card-name {
  font-weight: 600;
  color: #000;
  text-align: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0,0,0,0.2);
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
  color: rgba(0,0,0,0.7);
}

.preset-select select {
  padding: 0.3rem;
  background: white;
  border: 1px solid var(--border-color);
  font-size: 0.75rem;
}

/* Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 2px solid var(--border-color);
  background: var(--bg-light);
}

/* Scrollbar */
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
