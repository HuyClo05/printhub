// Printer Service - handles database operations for printers
import { db } from '../../firebase/init'
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs
} from 'firebase/firestore'

/**
 * Generate a unique ID with prefix
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Parse preset file and extract preset data
 * @param {File} file - The preset file
 * @returns {Promise<Object>} - Parsed preset data
 */
const parsePresetFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        // Try to parse as JSON first
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content)
          resolve({
            id: generateId('preset'),
            name: data.name || file.name.replace(/\.[^/.]+$/, ''),
            data: data
          })
        } else {
          // For .ini or .cfg files, just store the name
          resolve({
            id: generateId('preset'),
            name: file.name.replace(/\.[^/.]+$/, ''),
            rawContent: content
          })
        }
      } catch (error) {
        // If parsing fails, just use filename
        resolve({
          id: generateId('preset'),
          name: file.name.replace(/\.[^/.]+$/, '')
        })
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Add a new printer to the database
 * @param {Object} printerData - The printer data from AddPrinter form
 * @param {string} userId - The user ID adding the printer
 * @returns {Promise<Object>} - The created printer with its ID
 */
export async function addPrinter(printerData, userId) {
  const printerId = generateId('printer')
  const now = new Date().toISOString()

  // Parse preset files
  const printerPresets = []
  const filamentPresets = []
  const processPresets = []

  // Process printer preset files
  if (printerData.presets?.printer?.length > 0) {
    for (const file of printerData.presets.printer) {
      const preset = await parsePresetFile(file)
      printerPresets.push(preset)
    }
  }

  // Process filament preset files
  if (printerData.presets?.filament?.length > 0) {
    for (const file of printerData.presets.filament) {
      const preset = await parsePresetFile(file)
      filamentPresets.push(preset)
    }
  }

  // Process process preset files
  if (printerData.presets?.process?.length > 0) {
    for (const file of printerData.presets.process) {
      const preset = await parsePresetFile(file)
      processPresets.push(preset)
    }
  }

  // Create printer document (presets will be subcollections)
  const printerDoc = {
    printerId,
    ownerId: userId,
    sharedWith: [],
    model: printerData.model || '',
    name: printerData.name,
    connection: {
      octoeverywhereUrl: printerData.octoeverywhereUrl,
      lastSeen: now
    },
    status: {
      state: 'offline',
      nozzleTemp: 0,
      nozzleTempTarget: 0,
      bedTemp: 0,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: null
    },
    currentTaskId: null,
    createdAt: now
  }

  try {
    // Save printer document to Firestore
    await setDoc(doc(db, 'printers', printerId), printerDoc)
    console.log(`Created printer: ${printerId}`)

    // Save printerPresets as subcollection: printers/{printerId}/printerPresets/{presetId}
    for (const preset of printerPresets) {
      await setDoc(doc(db, 'printers', printerId, 'printerPresets', preset.id), preset)
      console.log(`Added printerPreset: ${preset.name}`)
    }

    // Save filamentPresets as subcollection: printers/{printerId}/filamentPresets/{presetId}
    for (const preset of filamentPresets) {
      await setDoc(doc(db, 'printers', printerId, 'filamentPresets', preset.id), preset)
      console.log(`Added filamentPreset: ${preset.name}`)
    }

    // Save processPresets as subcollection: printers/{printerId}/processPresets/{presetId}
    for (const preset of processPresets) {
      await setDoc(doc(db, 'printers', printerId, 'processPresets', preset.id), preset)
      console.log(`Added processPreset: ${preset.name}`)
    }

    return {
      success: true,
      printerId,
      printer: printerDoc,
      presets: { printerPresets, filamentPresets, processPresets }
    }
  } catch (error) {
    console.error('Error adding printer:', error)
    throw error
  }
}

/**
 * Update an existing printer
 * @param {string} printerId - The printer ID to update
 * @param {Object} updates - The fields to update
 */
export async function updatePrinter(printerId, updates) {
  try {
    await updateDoc(doc(db, 'printers', printerId), updates)
    console.log(`Updated printer: ${printerId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating printer:', error)
    throw error
  }
}

/**
 * Delete a printer
 * @param {string} printerId - The printer ID to delete
 */
export async function deletePrinter(printerId) {
  try {
    // Delete queue subcollection
    const queueSnapshot = await getDocs(collection(db, `printers/${printerId}/queue`))
    for (const queueDoc of queueSnapshot.docs) {
      await deleteDoc(doc(db, `printers/${printerId}/queue`, queueDoc.id))
    }

    // Delete printerPresets subcollection
    const printerPresetsSnapshot = await getDocs(collection(db, `printers/${printerId}/printerPresets`))
    for (const presetDoc of printerPresetsSnapshot.docs) {
      await deleteDoc(doc(db, `printers/${printerId}/printerPresets`, presetDoc.id))
    }

    // Delete filamentPresets subcollection
    const filamentPresetsSnapshot = await getDocs(collection(db, `printers/${printerId}/filamentPresets`))
    for (const presetDoc of filamentPresetsSnapshot.docs) {
      await deleteDoc(doc(db, `printers/${printerId}/filamentPresets`, presetDoc.id))
    }

    // Delete processPresets subcollection
    const processPresetsSnapshot = await getDocs(collection(db, `printers/${printerId}/processPresets`))
    for (const presetDoc of processPresetsSnapshot.docs) {
      await deleteDoc(doc(db, `printers/${printerId}/processPresets`, presetDoc.id))
    }

    // Delete printer document
    await deleteDoc(doc(db, 'printers', printerId))
    console.log(`Deleted printer: ${printerId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting printer:', error)
    throw error
  }
}

/**
 * Add a preset to a printer
 * @param {string} printerId - The printer ID
 * @param {string} presetType - 'printer', 'filament', or 'process'
 * @param {File} file - The preset file
 */
export async function addPresetToPrinter(printerId, presetType, file) {
  try {
    const preset = await parsePresetFile(file)
    const subcollectionName = `${presetType}Presets`

    // Add preset to subcollection: printers/{printerId}/{presetType}Presets/{presetId}
    await setDoc(doc(db, 'printers', printerId, subcollectionName, preset.id), preset)

    console.log(`Added ${presetType} preset to printer ${printerId}`)
    return { success: true, preset }
  } catch (error) {
    console.error('Error adding preset:', error)
    throw error
  }
}

/**
 * Remove a preset from a printer
 * @param {string} printerId - The printer ID
 * @param {string} presetType - 'printer', 'filament', or 'process'
 * @param {string} presetId - The preset ID to remove
 */
export async function removePresetFromPrinter(printerId, presetType, presetId) {
  try {
    const subcollectionName = `${presetType}Presets`

    // Delete preset from subcollection: printers/{printerId}/{presetType}Presets/{presetId}
    await deleteDoc(doc(db, 'printers', printerId, subcollectionName, presetId))

    console.log(`Removed ${presetType} preset ${presetId} from printer ${printerId}`)
    return { success: true }
  } catch (error) {
    console.error('Error removing preset:', error)
    throw error
  }
}

/**
 * Share a printer with another user
 * @param {string} printerId - The printer ID
 * @param {string} userId - The user ID to share with
 */
export async function sharePrinter(printerId, userId) {
  try {
    const printerRef = doc(db, 'printers', printerId)
    const { getDoc, arrayUnion } = await import('firebase/firestore')

    await updateDoc(printerRef, {
      sharedWith: arrayUnion(userId)
    })

    console.log(`Shared printer ${printerId} with user ${userId}`)
    return { success: true }
  } catch (error) {
    console.error('Error sharing printer:', error)
    throw error
  }
}

/**
 * Unshare a printer from a user
 * @param {string} printerId - The printer ID
 * @param {string} userId - The user ID to remove share from
 */
export async function unsharePrinter(printerId, userId) {
  try {
    const printerRef = doc(db, 'printers', printerId)
    const { getDoc, arrayRemove } = await import('firebase/firestore')

    await updateDoc(printerRef, {
      sharedWith: arrayRemove(userId)
    })

    console.log(`Unshared printer ${printerId} from user ${userId}`)
    return { success: true }
  } catch (error) {
    console.error('Error unsharing printer:', error)
    throw error
  }
}

export default {
  addPrinter,
  updatePrinter,
  deletePrinter,
  addPresetToPrinter,
  removePresetFromPrinter,
  sharePrinter,
  unsharePrinter
}
