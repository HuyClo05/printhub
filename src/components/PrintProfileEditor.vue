<template>
  <div class="preset-editor">
    <h3 v-if="showTitle">{{ title }}</h3>
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
          <input type="number" v-model="localSettings.quality.layerHeight" step="0.05" /> mm
        </div>
        <div class="field-row">
          <label>First Layer Height</label>
          <input type="number" v-model="localSettings.quality.firstLayerHeight" step="0.05" /> mm
        </div>
        <div class="field-row">
          <label>Line Width</label>
          <input type="number" v-model="localSettings.quality.lineWidth" step="0.05" /> mm
        </div>
      </div>
      <div v-else-if="activeTab === 'strength'" class="editor-fields">
        <div class="field-row">
          <label>Infill Density</label>
          <input type="number" v-model="localSettings.strength.infillDensity" min="0" max="100" /> %
        </div>
        <div class="field-row">
          <label>Infill Pattern</label>
          <select v-model="localSettings.strength.infillPattern">
            <option value="grid">Grid</option>
            <option value="gyroid">Gyroid</option>
            <option value="honeycomb">Honeycomb</option>
            <option value="lines">Lines</option>
          </select>
        </div>
        <div class="field-row">
          <label>Wall Count</label>
          <input type="number" v-model="localSettings.strength.wallCount" min="1" />
        </div>
      </div>
      <div v-else-if="activeTab === 'speed'" class="editor-fields">
        <div class="field-row">
          <label>Print Speed</label>
          <input type="number" v-model="localSettings.speed.printSpeed" /> mm/s
        </div>
        <div class="field-row">
          <label>Travel Speed</label>
          <input type="number" v-model="localSettings.speed.travelSpeed" /> mm/s
        </div>
        <div class="field-row">
          <label>First Layer Speed</label>
          <input type="number" v-model="localSettings.speed.firstLayerSpeed" /> mm/s
        </div>
      </div>
      <div v-else-if="activeTab === 'support'" class="editor-fields">
        <div class="field-row">
          <label>Enable Support</label>
          <input type="checkbox" v-model="localSettings.support.enabled" />
        </div>
        <div class="field-row">
          <label>Support Type</label>
          <select v-model="localSettings.support.type" :disabled="!localSettings.support.enabled">
            <option value="normal">Normal</option>
            <option value="tree">Tree</option>
          </select>
        </div>
        <div class="field-row">
          <label>Support Density</label>
          <input type="number" v-model="localSettings.support.density" min="0" max="100" :disabled="!localSettings.support.enabled" /> %
        </div>
      </div>
      <div v-else-if="activeTab === 'material'" class="editor-fields">
        <div class="field-row">
          <label>Nozzle Temperature</label>
          <input type="number" v-model="localSettings.material.nozzleTemp" /> °C
        </div>
        <div class="field-row">
          <label>Bed Temperature</label>
          <input type="number" v-model="localSettings.material.bedTemp" /> °C
        </div>
        <div class="field-row">
          <label>Retraction Distance</label>
          <input type="number" v-model="localSettings.material.retractionDistance" step="0.1" /> mm
        </div>
      </div>
      <div v-else-if="activeTab === 'others'" class="editor-fields">
        <div class="field-row">
          <label>Brim</label>
          <input type="checkbox" v-model="localSettings.others.brim" />
        </div>
        <div class="field-row">
          <label>Raft</label>
          <input type="checkbox" v-model="localSettings.others.raft" />
        </div>
        <div class="field-row">
          <label>Skirt Loops</label>
          <input type="number" v-model="localSettings.others.skirtLoops" min="0" />
        </div>
      </div>
    </div>
    <div v-if="showApplyButton" class="apply-btn">
      <slot name="action">
        <ClearButton
          caption="Apply To All Printers"
          size="auto"
          hoverColor="var(--primary-color)"
          @click="$emit('apply')"
        />
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import ClearButton from '@/components/ClearButton.vue'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    default: 'Editor To All Print Profile'
  },
  showTitle: {
    type: Boolean,
    default: true
  },
  showApplyButton: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['apply', 'update:settings'])

// Create local reactive copy to avoid prop mutation
const localSettings = reactive(JSON.parse(JSON.stringify(props.settings)))

// Watch for external changes to settings prop
watch(() => props.settings, (newSettings) => {
  Object.assign(localSettings, JSON.parse(JSON.stringify(newSettings)))
}, { deep: true })

// Emit updates when local settings change
watch(localSettings, (newSettings) => {
  emit('update:settings', JSON.parse(JSON.stringify(newSettings)))
}, { deep: true })

const presetTabs = [
  { id: 'quality', label: 'Quality' },
  { id: 'strength', label: 'Strength' },
  { id: 'speed', label: 'Speed' },
  { id: 'support', label: 'Support' },
  { id: 'material', label: 'Material' },
  { id: 'others', label: 'Others' }
]

const activeTab = ref('quality')
</script>

<style scoped>
.preset-editor h3 {
  margin: 0 0 1rem;
  color: var(--text-primary);
  font-size: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--primary-color);
}

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
  accent-color: var(--primary-color);
}

.apply-btn {
  display: flex;
  justify-content: flex-end;
}
</style>
