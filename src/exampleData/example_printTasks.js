// Example Print Tasks Data (following database_structure.md)
// Path: printTasks/{taskId}

export const printTasks = [
  {
    taskId: 'task_001',
    jobId: 'job_12345',
    fileId: 'file_001',
    status: 'printing',
    assigned: [
      {
        printerId: 'printer_abc123',
        status: 'printing',
        progress: 45,
        startedAt: '2025-11-30T12:00:00Z',
        completedAt: null
      }
    ],
    createdAt: '2025-11-30T10:00:00Z',
    estimatedPrintTime: 7200
  },
  {
    taskId: 'task_002',
    jobId: 'job_12345',
    fileId: 'file_002',
    status: 'queued',
    assigned: [
      {
        printerId: 'printer_def456',
        status: 'queued',
        progress: 0,
        startedAt: null,
        completedAt: null
      }
    ],
    createdAt: '2025-11-30T10:00:00Z',
    estimatedPrintTime: 6800
  },
  {
    taskId: 'task_003',
    jobId: 'job_12345',
    fileId: 'file_003',
    status: 'completed',
    assigned: [
      {
        printerId: 'printer_ghi789',
        status: 'completed',
        progress: 100,
        startedAt: '2025-11-30T10:30:00Z',
        completedAt: '2025-11-30T12:30:00Z'
      }
    ],
    createdAt: '2025-11-30T10:00:00Z',
    estimatedPrintTime: 7200
  },
  {
    taskId: 'task_004',
    jobId: 'job_12346',
    fileId: 'file_004',
    status: 'pending',
    assigned: [],
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 14400
  },
  {
    taskId: 'task_005',
    jobId: 'job_12346',
    fileId: 'file_005',
    status: 'failed',
    assigned: [
      {
        printerId: 'printer_jkl012',
        status: 'printing',
        progress: 23,
        startedAt: '2025-11-30T08:00:00Z',
        completedAt: null
      }
    ],
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 10800
  },
  {
    taskId: 'task_006',
    jobId: 'job_12346',
    fileId: 'file_006',
    status: 'pending',
    assigned: [],
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 3600
  },
  {
    taskId: 'task_007',
    jobId: 'job_12346',
    fileId: 'file_007',
    status: 'pending',
    assigned: [],
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 1800
  },
  {
    taskId: 'task_008',
    jobId: 'job_12346',
    fileId: 'file_008',
    status: 'pending',
    assigned: [],
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 5400
  },
  {
    taskId: 'task_020',
    jobId: 'job_12350',
    fileId: 'file_020',
    status: 'printing',
    assigned: [
      {
        printerId: 'printer_pqr678',
        status: 'printing',
        progress: 78,
        startedAt: '2025-12-02T08:00:00Z',
        completedAt: null
      }
    ],
    createdAt: '2025-12-02T07:00:00Z',
    estimatedPrintTime: 9000
  },
  {
    taskId: 'task_021',
    jobId: 'job_12351',
    fileId: 'file_021',
    status: 'printing',
    assigned: [
      {
        printerId: 'printer_vwx234',
        status: 'printing',
        progress: 12,
        startedAt: '2025-12-02T09:00:00Z',
        completedAt: null
      }
    ],
    createdAt: '2025-12-02T08:30:00Z',
    estimatedPrintTime: 16200
  },
  {
    taskId: 'task_022',
    jobId: 'job_12352',
    fileId: 'file_022',
    status: 'printing',
    assigned: [
      {
        printerId: 'printer_bcd890',
        status: 'printing',
        progress: 34,
        startedAt: '2025-12-02T06:00:00Z',
        completedAt: null
      }
    ],
    createdAt: '2025-12-02T05:00:00Z',
    estimatedPrintTime: 10800
  },
  {
    taskId: 'task_023',
    jobId: 'job_12353',
    fileId: 'file_023',
    status: 'printing',
    assigned: [
      {
        printerId: 'printer_hij456',
        status: 'printing',
        progress: 92,
        startedAt: '2025-12-02T10:00:00Z',
        completedAt: null
      }
    ],
    createdAt: '2025-12-02T09:30:00Z',
    estimatedPrintTime: 5400
  }
]

export default printTasks
