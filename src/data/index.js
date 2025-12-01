// Export all example data
// Following database_structure.md

export { users } from './users'
export { printers } from './printers'
export { printJobs } from './printJobs'
export { printTasks } from './printTasks'
export { files } from './files'
export { printerQueues } from './printerQueues'

// Default export with all data
import users from './users'
import printers from './printers'
import printJobs from './printJobs'
import printTasks from './printTasks'
import files from './files'
import printerQueues from './printerQueues'

export default {
  users,
  printers,
  printJobs,
  printTasks,
  files,
  printerQueues
}
