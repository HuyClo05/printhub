// Example Print Jobs Data (following database_structure.md)

export const printJobs = [
  {
    jobId: 'job_12345',
    jobName: 'Batch Print - Phone Cases',
    createdBy: 'user_xyz789',
    createdAt: '2025-11-30T10:00:00Z',
    updatedAt: '2025-11-30T14:30:00Z',
    status: 'in-progress',
    tasks: ['task_001', 'task_002', 'task_003'],
    totalTasks: 3,
    completedTasks: 1,
    failedTasks: 0,
    startedAt: '2025-11-30T12:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-11-30T18:00:00Z'
  },
  {
    jobId: 'job_12346',
    jobName: 'Prototype Parts - Robot Arm',
    createdBy: 'user_abc123',
    createdAt: '2025-11-29T09:00:00Z',
    updatedAt: '2025-11-30T08:00:00Z',
    status: 'pending',
    tasks: ['task_004', 'task_005', 'task_006', 'task_007', 'task_008'],
    totalTasks: 5,
    completedTasks: 0,
    failedTasks: 0,
    startedAt: null,
    completedAt: null,
    estimatedEndAt: '2025-12-01T12:00:00Z'
  },
  {
    jobId: 'job_12347',
    jobName: 'Custom Enclosure',
    createdBy: 'user_xyz789',
    createdAt: '2025-11-28T14:00:00Z',
    updatedAt: '2025-11-29T22:00:00Z',
    status: 'completed',
    tasks: ['task_009', 'task_010'],
    totalTasks: 2,
    completedTasks: 2,
    failedTasks: 0,
    startedAt: '2025-11-28T15:00:00Z',
    completedAt: '2025-11-29T22:00:00Z',
    estimatedEndAt: '2025-11-29T20:00:00Z'
  },
  {
    jobId: 'job_12348',
    jobName: 'Miniatures Collection',
    createdBy: 'user_def456',
    createdAt: '2025-11-27T10:00:00Z',
    updatedAt: '2025-11-30T10:00:00Z',
    status: 'in-progress',
    tasks: ['task_011', 'task_012', 'task_013', 'task_014'],
    totalTasks: 4,
    completedTasks: 2,
    failedTasks: 1,
    startedAt: '2025-11-27T11:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-12-01T08:00:00Z'
  },
  {
    jobId: 'job_12349',
    jobName: 'Cancelled Project',
    createdBy: 'user_abc123',
    createdAt: '2025-11-25T08:00:00Z',
    updatedAt: '2025-11-26T10:00:00Z',
    status: 'cancelled',
    tasks: ['task_015'],
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0,
    startedAt: null,
    completedAt: null,
    estimatedEndAt: null
  }
]

export default printJobs
