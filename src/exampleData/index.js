// Export all example data
// Following database_structure.md

export { users } from './example_users.js'
export { printers } from './example_printers.js'
export { printJobs } from './example_printJobs.js'
export { printTasks } from './example_printTasks.js'
export { stlFiles } from './example_stlFiles.js'
export { printerQueues } from './example_printerQueues.js'

// Default export with all data
import { users } from './example_users.js'
import { printers } from './example_printers.js'
import { printJobs } from './example_printJobs.js'
import { printTasks } from './example_printTasks.js'
import { files } from './example_stlFiles.js'
import { printerQueues } from './example_printerQueues.js'

export default {
  users,
  printers,
  printJobs,
  printTasks,
  files,
  printerQueues
}
