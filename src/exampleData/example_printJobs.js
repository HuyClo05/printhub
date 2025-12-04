// Example Print Jobs Data (following database_structure.md)
// Path: printJobs/{jobId}

export const printJobs = [
  {
    jobId: 'job_12345',
    createdBy: 'user_xyz789',
    jobName: 'Batch Print - Phone Cases',
    status: 'in-progress',
    createdAt: '2025-11-30T10:00:00Z',
    startedAt: '2025-11-30T12:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-11-30T18:00:00Z',
    totalTasks: 3,
    completedTasks: 1,
    failedTasks: 0
  },
  {
    jobId: 'job_12346',
    createdBy: 'user_abc123',
    jobName: 'Prototype Parts - Robot Arm',
    status: 'pending',
    createdAt: '2025-11-29T09:00:00Z',
    startedAt: null,
    completedAt: null,
    estimatedEndAt: '2025-12-01T12:00:00Z',
    totalTasks: 5,
    completedTasks: 0,
    failedTasks: 0
  },
  {
    jobId: 'job_12347',
    createdBy: 'user_xyz789',
    jobName: 'Custom Enclosure',
    status: 'completed',
    createdAt: '2025-11-28T14:00:00Z',
    startedAt: '2025-11-28T15:00:00Z',
    completedAt: '2025-11-29T22:00:00Z',
    estimatedEndAt: '2025-11-29T20:00:00Z',
    totalTasks: 2,
    completedTasks: 2,
    failedTasks: 0
  },
  {
    jobId: 'job_12348',
    createdBy: 'user_def456',
    jobName: 'Miniatures Collection',
    status: 'in-progress',
    createdAt: '2025-11-27T10:00:00Z',
    startedAt: '2025-11-27T11:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-12-01T08:00:00Z',
    totalTasks: 4,
    completedTasks: 2,
    failedTasks: 1
  },
  {
    jobId: 'job_12349',
    createdBy: 'user_abc123',
    jobName: 'Cancelled Project',
    status: 'cancelled',
    createdAt: '2025-11-25T08:00:00Z',
    startedAt: null,
    completedAt: null,
    estimatedEndAt: null,
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0
  },
  {
    jobId: 'job_12350',
    createdBy: 'user_xyz789',
    jobName: 'Large Vase Project',
    status: 'in-progress',
    createdAt: '2025-12-02T07:00:00Z',
    startedAt: '2025-12-02T08:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-12-02T12:00:00Z',
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0
  },
  {
    jobId: 'job_12351',
    createdBy: 'user_def456',
    jobName: 'Keyboard Case Build',
    status: 'in-progress',
    createdAt: '2025-12-02T08:30:00Z',
    startedAt: '2025-12-02T09:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-12-02T14:00:00Z',
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0
  },
  {
    jobId: 'job_12352',
    createdBy: 'user_abc123',
    jobName: 'Drone Frame Parts',
    status: 'in-progress',
    createdAt: '2025-12-02T05:00:00Z',
    startedAt: '2025-12-02T06:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-12-02T09:00:00Z',
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0
  },
  {
    jobId: 'job_12353',
    createdBy: 'user_xyz789',
    jobName: 'Cable Organizer Set',
    status: 'in-progress',
    createdAt: '2025-12-02T09:30:00Z',
    startedAt: '2025-12-02T10:00:00Z',
    completedAt: null,
    estimatedEndAt: '2025-12-02T11:30:00Z',
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0
  }
]

export default printJobs
