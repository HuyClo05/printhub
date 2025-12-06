// Print Job Service - handles database operations for print jobs, tasks, and printer queues
import { db } from '../../firebase/init'
import { storage } from '../../firebase/init'
import {
  doc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

/**
 * Generate a unique ID with prefix
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Upload a file to Firebase Storage and create stlFiles document
 * @param {File} file - The file to upload
 * @param {string} userId - The user uploading the file
 * @returns {Promise<Object>} - The file document with URLs
 */
async function uploadStlFile(file, userId) {
  const fileId = generateId('file')
  const now = new Date().toISOString()

  // Determine file extension and storage path
  const fileExt = file.name.split('.').pop().toLowerCase()
  const storagePath = `stl/${fileId}_${file.name}`

  try {
    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath)
    const snapshot = await uploadBytes(storageRef, file)
    const downloadUrl = await getDownloadURL(snapshot.ref)

    // Create stlFiles document
    const fileDoc = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      stlUrl: downloadUrl,
      gcodeUrl: null,
      thumbnailUrl: null,
      uploadedBy: userId,
      uploadedAt: now
    }

    await setDoc(doc(db, 'stlFiles', fileId), fileDoc)
    console.log(`Uploaded file: ${fileId}`)

    return fileDoc
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

/**
 * Create a new print job with its associated tasks and update printer queues
 * Following example data structure from exampleData folder
 *
 * Creates documents in:
 * - printJobs/{jobId}
 * - printTasks/{taskId}
 * - printers/{printerId}/queue/{queuePosition}
 * - stlFiles/{fileId} (for uploaded files)
 *
 * @param {Object} jobData - The job data from CreatePrintJobView
 * @param {string} userId - The user ID creating the job
 * @returns {Promise<Object>} - The created job with its ID
 */
export async function createPrintJob(jobData, userId) {
  const jobId = generateId('job')
  const now = new Date().toISOString()

  // Prepare tasks from jobData
  const tasksToCreate = []
  const printerQueueUpdates = []
  const uploadedFiles = []

  for (const task of jobData.tasks) {
    const taskId = generateId('task')

    // Check if model needs to be uploaded (temp files from device)
    let fileId = task.model.id
    let thumbnailUrl = task.model.thumbnailUrl || 'https://via.placeholder.com/100'

    if (task.model.id.startsWith('temp_') && task.model.file) {
      // Upload the file to Firebase Storage and create stlFiles document
      const uploadedFile = await uploadStlFile(task.model.file, userId)
      fileId = uploadedFile.fileId
      thumbnailUrl = uploadedFile.thumbnailUrl || 'https://via.placeholder.com/100'
      uploadedFiles.push(uploadedFile)
    }

    // Build assigned array for each printer (matches example_printTasks.js)
    const assigned = task.selectedPrinters.map(printerId => ({
      printerId,
      status: 'pending',
      progress: 0,
      startedAt: null,
      completedAt: null
    }))

    // Create task document (matches example_printTasks.js structure)
    const taskDoc = {
      taskId,
      jobId,
      fileId,
      status: 'pending',
      assigned,
      createdAt: now,
      estimatedPrintTime: task.estimatedPrintTime || null
    }

    tasksToCreate.push(taskDoc)

    // Queue updates for each printer (matches example_printerQueues.js structure)
    for (const printerId of task.selectedPrinters) {
      printerQueueUpdates.push({
        printerId,
        taskId,
        jobId,
        addedAt: now,
        addedBy: userId,
        status: 'ready',
        estimatedTime: task.estimatedPrintTime || null,
        thumbnailUrl
      })
    }
  }

  // Create the print job document (matches example_printJobs.js structure)
  const jobDoc = {
    jobId,
    createdBy: userId,
    jobName: jobData.jobName || `Job_${Date.now()}`,
    status: 'pending',
    createdAt: now,
    startedAt: null,
    completedAt: null,
    estimatedEndAt: null,
    totalTasks: tasksToCreate.length,
    completedTasks: 0,
    failedTasks: 0
  }

  try {
    // 1. Add printJobs document to printJobs/{jobId}
    await setDoc(doc(db, 'printJobs', jobId), jobDoc)
    console.log(`Created printJobs/${jobId}`)

    // 2. Add printTasks document to printTasks/{taskId}
    for (const task of tasksToCreate) {
      await setDoc(doc(db, 'printTasks', task.taskId), task)
      console.log(`Created printTasks/${task.taskId}`)
    }

    // 3. Update printers/{printerId}/queue/ with new printTasks
    for (const queueItem of printerQueueUpdates) {
      // Use timestamp-based queue position
      const queuePosition = Date.now()
      await setDoc(
        doc(db, 'printers', queueItem.printerId, 'queue', String(queuePosition)),
        {
          queuePosition,
          taskId: queueItem.taskId,
          jobId: queueItem.jobId,
          addedAt: queueItem.addedAt,
          addedBy: queueItem.addedBy,
          status: queueItem.status,
          estimatedTime: queueItem.estimatedTime,
          thumbnailUrl: queueItem.thumbnailUrl
        }
      )
      console.log(`Updated printers/${queueItem.printerId}/queue/${queuePosition}`)
    }

    return {
      success: true,
      jobId,
      job: jobDoc,
      tasks: tasksToCreate,
      uploadedFiles
    }
  } catch (error) {
    console.error('Error creating print job:', error)
    throw error
  }
}

/**
 * Update a print task status
 */
export async function updateTaskStatus(taskId, status, printerUpdates = null) {
  const updates = { status }

  if (printerUpdates) {
    updates.assigned = printerUpdates
  }

  await updateDoc(doc(db, 'printTasks', taskId), updates)
}

/**
 * Update a print job status
 */
export async function updateJobStatus(jobId, status, additionalData = {}) {
  const updates = {
    status,
    ...additionalData
  }

  await updateDoc(doc(db, 'printJobs', jobId), updates)
}

export default {
  createPrintJob,
  updateTaskStatus,
  updateJobStatus
}
