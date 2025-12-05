// Print Job Service - handles database operations for print jobs, tasks, and printer queues
import { db } from '../../firebase/init'
import { 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  collection, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore'

/**
 * Generate a unique ID with prefix
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new print job with its associated tasks and update printer queues
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
  
  for (const task of jobData.tasks) {
    const taskId = generateId('task')
    
    // Build assigned array for each printer
    const assigned = task.selectedPrinters.map(printerId => ({
      printerId,
      status: 'queued',
      progress: 0,
      startedAt: null,
      completedAt: null,
      // Include preset settings if available
      printerPreset: task.printerProfiles?.[printerId]?.printerPreset || null,
      processPreset: task.printerProfiles?.[printerId]?.processPreset || null,
      filamentPreset: task.printerProfiles?.[printerId]?.filamentPreset || null
    }))
    
    // Create task document
    const taskDoc = {
      taskId,
      jobId,
      fileId: task.model.id,
      fileName: task.model.name,
      status: 'queued',
      assigned,
      createdAt: now,
      estimatedPrintTime: task.estimatedPrintTime || null,
      globalSettings: task.globalSettings || null
    }
    
    tasksToCreate.push(taskDoc)
    
    // Queue updates for each printer
    for (const printerId of task.selectedPrinters) {
      printerQueueUpdates.push({
        printerId,
        taskId,
        jobId,
        fileId: task.model.id,
        fileName: task.model.name,
        addedAt: now
      })
    }
  }
  
  // Create the print job document
  const jobDoc = {
    jobId,
    createdBy: userId,
    jobName: jobData.jobName || `Job_${Date.now()}`,
    status: 'queued',
    createdAt: now,
    startedAt: null,
    completedAt: null,
    estimatedEndAt: null,
    totalTasks: tasksToCreate.length,
    completedTasks: 0,
    failedTasks: 0
  }
  
  try {
    // 1. Create the print job
    await setDoc(doc(db, 'printJobs', jobId), jobDoc)
    console.log(`Created job: ${jobId}`)
    
    // 2. Create all print tasks
    for (const task of tasksToCreate) {
      await setDoc(doc(db, 'printTasks', task.taskId), task)
      console.log(`Created task: ${task.taskId}`)
    }
    
    // 3. Add to printer queues (subcollection)
    for (const queueItem of printerQueueUpdates) {
      // Get next queue position (simplified - in production you'd query for max position)
      const queuePosition = Date.now()
      await setDoc(
        doc(db, 'printers', queueItem.printerId, 'queue', String(queuePosition)),
        {
          queuePosition,
          taskId: queueItem.taskId,
          jobId: queueItem.jobId,
          fileId: queueItem.fileId,
          fileName: queueItem.fileName,
          addedAt: queueItem.addedAt,
          status: 'queued'
        }
      )
      console.log(`Added to queue for printer ${queueItem.printerId}`)
    }
    
    return {
      success: true,
      jobId,
      job: jobDoc,
      tasks: tasksToCreate
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
