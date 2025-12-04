// Example Printer Queue Data (following database_structure.md)
// Path: printers/{printerId}/queue/{queuePosition}
// This is a subcollection of printers

export const printerQueues = {
  // Queue for printer_abc123
  'printer_abc123': [
    {
      queuePosition: 1,
      taskId: 'task_001',
      jobId: 'job_12345',
      addedAt: '2025-11-30T10:00:00Z',
      addedBy: 'user_xyz789',
      status: 'ready',
      estimatedTime: 7200,
      thumbnailUrl: 'https://via.placeholder.com/100'
    }
  ],

  // Queue for printer_def456 (empty - ready state)
  'printer_def456': [],

  // Queue for printer_ghi789 (empty - ready state)
  'printer_ghi789': [],

  // Queue for printer_jkl012
  'printer_jkl012': [
    {
      queuePosition: 1,
      taskId: 'task_005',
      jobId: 'job_12346',
      addedAt: '2025-11-30T08:00:00Z',
      addedBy: 'user_abc123',
      status: 'ready',
      estimatedTime: 10800,
      thumbnailUrl: 'https://via.placeholder.com/100'
    }
  ],

  // Queue for printer_mno345 (empty - offline)
  'printer_mno345': [],

  // Queue for printer_pqr678
  'printer_pqr678': [
    {
      queuePosition: 1,
      taskId: 'task_020',
      jobId: 'job_12350',
      addedAt: '2025-12-02T08:00:00Z',
      addedBy: 'user_xyz789',
      status: 'ready',
      estimatedTime: 9000,
      thumbnailUrl: 'https://via.placeholder.com/100'
    }
  ],

  // Queue for printer_stu901 (empty - ready)
  'printer_stu901': [],

  // Queue for printer_vwx234
  'printer_vwx234': [
    {
      queuePosition: 1,
      taskId: 'task_021',
      jobId: 'job_12351',
      addedAt: '2025-12-02T09:00:00Z',
      addedBy: 'user_def456',
      status: 'ready',
      estimatedTime: 16200,
      thumbnailUrl: 'https://via.placeholder.com/100'
    }
  ],

  // Queue for printer_yza567 (empty - ready)
  'printer_yza567': [],

  // Queue for printer_bcd890
  'printer_bcd890': [
    {
      queuePosition: 1,
      taskId: 'task_022',
      jobId: 'job_12352',
      addedAt: '2025-12-02T06:00:00Z',
      addedBy: 'user_abc123',
      status: 'ready',
      estimatedTime: 10800,
      thumbnailUrl: 'https://via.placeholder.com/100'
    }
  ],

  // Queue for printer_efg123 (empty - offline)
  'printer_efg123': [],

  // Queue for printer_hij456
  'printer_hij456': [
    {
      queuePosition: 1,
      taskId: 'task_023',
      jobId: 'job_12353',
      addedAt: '2025-12-02T10:00:00Z',
      addedBy: 'user_xyz789',
      status: 'ready',
      estimatedTime: 5400,
      thumbnailUrl: 'https://via.placeholder.com/100'
    }
  ]
}

export default printerQueues
