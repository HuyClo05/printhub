// Export all example data
// Following database_structure.md

export { users } from './example_users.js'
export { printers } from './example_printers.js'
export { printerQueues } from './example_printerQueues.js'
export { printJobs } from './example_printJobs.js'
export { printTasks } from './example_printTasks.js'
export { stlFiles } from './example_stlFiles.js'

// Default export with all data
import { users } from './example_users.js'
import { printers } from './example_printers.js'
import { printerQueues } from './example_printerQueues.js'
import { printJobs } from './example_printJobs.js'
import { printTasks } from './example_printTasks.js'
import { stlFiles } from './example_stlFiles.js'

export default {
  users,
  printers,
  printerQueues,
  printJobs,
  printTasks,
  stlFiles,
}
