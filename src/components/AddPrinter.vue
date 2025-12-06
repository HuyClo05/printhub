<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Add a Printer</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <!-- Instructions Section -->
        <div class="section instructions">
          <h3>How to Get Your OctoEverywhere Share URL</h3>
          <ol class="instruction-list">
            <li>Go to <a href="https://octoeverywhere.com" target="_blank">octoeverywhere.com</a> and log in to your account</li>
            <li>Select the printer you want to connect</li>
            <li>Click on <strong>"Share"</strong> in the printer menu</li>
            <li>Create a new share link or copy an existing one</li>
            <li>Paste the share URL below</li>
          </ol>
        </div>

        <!-- Connection Form -->
        <div class="section form-section">
          <h3>Printer Connection</h3>
          
          <div class="form-group">
            <label>Printer Name</label>
            <input
              type="text"
              v-model="printerName"
              placeholder="Enter printer name..."
            />
          </div>

          <div class="form-group">
            <label>Printer Model</label>
            <input
              type="text"
              v-model="printerModel"
              placeholder="e.g., Ender 3 V2, Prusa MK3S+..."
            />
          </div>

          <div class="form-group">
            <label>OctoEverywhere Share URL</label>
            <input
              type="text"
              v-model="octoeverywhereUrl"
              placeholder="https://octoeverywhere.com/share/..."
            />
          </div>
        </div>

        <!-- Preset Uploaders -->
        <div class="section presets-section">
          <h3>Printer Presets (Optional)</h3>
          <p class="preset-hint">Upload preset files from your slicer software (multiple files allowed)</p>

          <!-- Printer Preset -->
          <div class="preset-uploader">
            <label>Printer Presets</label>
            <div class="upload-row">
              <div class="file-name-input">
                {{ printerPresetFiles.length === 0 ? 'No files selected' : `${printerPresetFiles.length} file(s) selected` }}
              </div>
              <button class="upload-btn" @click="triggerFileInput('printer')">
                Choose Files
              </button>
            </div>
            <div class="file-list" v-if="printerPresetFiles.length > 0">
              <div class="file-item" v-for="(file, index) in printerPresetFiles" :key="index">
                <span>{{ file.name }}</span>
                <button class="remove-file-btn" @click="removeFile('printer', index)">×</button>
              </div>
            </div>
            <input
              ref="printerPresetInput"
              type="file"
              accept=".json,.ini,.cfg"
              multiple
              hidden
              @change="handlePresetSelect($event, 'printer')"
            />
          </div>

          <!-- Filament Preset -->
          <div class="preset-uploader">
            <label>Filament Presets</label>
            <div class="upload-row">
              <div class="file-name-input">
                {{ filamentPresetFiles.length === 0 ? 'No files selected' : `${filamentPresetFiles.length} file(s) selected` }}
              </div>
              <button class="upload-btn" @click="triggerFileInput('filament')">
                Choose Files
              </button>
            </div>
            <div class="file-list" v-if="filamentPresetFiles.length > 0">
              <div class="file-item" v-for="(file, index) in filamentPresetFiles" :key="index">
                <span>{{ file.name }}</span>
                <button class="remove-file-btn" @click="removeFile('filament', index)">×</button>
              </div>
            </div>
            <input
              ref="filamentPresetInput"
              type="file"
              accept=".json,.ini,.cfg"
              multiple
              hidden
              @change="handlePresetSelect($event, 'filament')"
            />
          </div>

          <!-- Process Preset -->
          <div class="preset-uploader">
            <label>Process Presets</label>
            <div class="upload-row">
              <div class="file-name-input">
                {{ processPresetFiles.length === 0 ? 'No files selected' : `${processPresetFiles.length} file(s) selected` }}
              </div>
              <button class="upload-btn" @click="triggerFileInput('process')">
                Choose Files
              </button>
            </div>
            <div class="file-list" v-if="processPresetFiles.length > 0">
              <div class="file-item" v-for="(file, index) in processPresetFiles" :key="index">
                <span>{{ file.name }}</span>
                <button class="remove-file-btn" @click="removeFile('process', index)">×</button>
              </div>
            </div>
            <input
              ref="processPresetInput"
              type="file"
              accept=".json,.ini,.cfg"
              multiple
              hidden
              @change="handlePresetSelect($event, 'process')"
            />
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
          caption="Add Printer"
          size="auto"
          hoverColor="var(--primary-color)"
          :disabled="!canSubmit"
          @click="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ClearButton from '@/components/ClearButton.vue'

const emit = defineEmits(['close', 'add'])

// Form data
const printerName = ref('')
const printerModel = ref('')
const octoeverywhereUrl = ref('')

// Preset files (arrays for multiple files)
const printerPresetFiles = ref([])
const filamentPresetFiles = ref([])
const processPresetFiles = ref([])

// File input refs
const printerPresetInput = ref(null)
const filamentPresetInput = ref(null)
const processPresetInput = ref(null)

// Validation
const canSubmit = computed(() => {
  return printerName.value.trim() && octoeverywhereUrl.value.trim()
})

// Methods
const triggerFileInput = (type) => {
  switch (type) {
    case 'printer':
      printerPresetInput.value?.click()
      break
    case 'filament':
      filamentPresetInput.value?.click()
      break
    case 'process':
      processPresetInput.value?.click()
      break
  }
}

const handlePresetSelect = (event, type) => {
  const files = Array.from(event.target.files || [])
  if (files.length === 0) return

  switch (type) {
    case 'printer':
      printerPresetFiles.value.push(...files)
      break
    case 'filament':
      filamentPresetFiles.value.push(...files)
      break
    case 'process':
      processPresetFiles.value.push(...files)
      break
  }
  
  // Reset input so same file can be selected again
  event.target.value = ''
}

const removeFile = (type, index) => {
  switch (type) {
    case 'printer':
      printerPresetFiles.value.splice(index, 1)
      break
    case 'filament':
      filamentPresetFiles.value.splice(index, 1)
      break
    case 'process':
      processPresetFiles.value.splice(index, 1)
      break
  }
}

const handleSubmit = () => {
  const printerData = {
    name: printerName.value.trim(),
    model: printerModel.value.trim(),
    octoeverywhereUrl: octoeverywhereUrl.value.trim(),
    presets: {
      printer: printerPresetFiles.value,
      filament: filamentPresetFiles.value,
      process: processPresetFiles.value
    }
  }

  emit('add', printerData)
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
  max-width: 600px;
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

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  padding: 1rem;
}

.section h3 {
  margin: 0 0 1rem;
  color: var(--text-primary);
  font-size: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--primary-color);
}

.instruction-list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--text-secondary);
  line-height: 1.8;
}

.instruction-list li {
  margin-bottom: 0.5rem;
}

.instruction-list a {
  color: var(--primary-color);
  text-decoration: none;
}

.instruction-list a:hover {
  text-decoration: underline;
}

.instruction-list strong {
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-group input::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.preset-hint {
  margin: 0 0 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.preset-uploader {
  margin-bottom: 1rem;
}

.preset-uploader:last-child {
  margin-bottom: 0;
}

.preset-uploader label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.upload-row {
  display: flex;
  gap: 0.5rem;
}

.file-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.upload-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.upload-btn:hover {
  background: var(--primary-color);
  color: #000;
  border-color: var(--primary-color);
}

.file-list {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.75rem;
  background: var(--bg-darker);
  border: 1px solid var(--border-color);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.file-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-file-btn {
  background: none;
  border: none;
  color: #ff5252;
  font-size: 1rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.remove-file-btn:hover {
  color: #ff0000;
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
