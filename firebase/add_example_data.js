// Import everything
import data from '../src/exampleData/index.js'
import { doc, setDoc } from "firebase/firestore"
import { db } from './nodeConfig.js'  // Use nodeConfig instead of init

// Add users to Firestore
async function addData() {
  console.log('Adding users...')
  for (const user of data.users) {
    await setDoc(doc(db, "users", user.uid), user)
    console.log(`Added user: ${user.userName}`)
  }

  console.log('\nAdding printers...')
  for (const printer of data.printers) {
    await setDoc(doc(db, "printers", printer.printerId), printer)
    console.log(`Added printer: ${printer.name}`)
  }

  // Add printer queues (subcollection)
  console.log('\nAdding printer queues...')
  for (const [printerId, queueItems] of Object.entries(data.printerQueues)) {
    for (const queueItem of queueItems) {
      await setDoc(
        doc(db, "printers", printerId, "queue", String(queueItem.queuePosition)),
        queueItem
      )
      console.log(`Added queue item for ${printerId}: position ${queueItem.queuePosition}`)
    }
  }

  console.log('\nAdding print jobs...')
  for (const job of data.printJobs) {
    await setDoc(doc(db, "printJobs", job.jobId), job)
    console.log(`Added job: ${job.jobName}`)
  }

  console.log('\nAdding print tasks...')
  for (const task of data.printTasks) {
    await setDoc(doc(db, "printTasks", task.taskId), task)
    console.log(`Added task: ${task.taskId}`)
  }

  console.log('\nAdding files...')
  for (const file of data.stlFiles) {
    await setDoc(doc(db, "stlFiles", file.fileId), file)
    console.log(`Added file: ${file.fileName}`)
  }

  console.log('\nDone!')
}

addData()
