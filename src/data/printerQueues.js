// Example Printer Queues Data (following database_structure.md)
// Path: printers/{printerId}/queue/{queuePosition}

export const printerQueues = {
  // Queue for printer_abc123 (Workshop Ender)
  printer_abc123: [
    {
      position: 1,
      taskId: 'task_001',
      jobId: 'job_12345',
      fileName: 'phone_case_v1.stl',
      thumbnailUrl: 'https://via.placeholder.com/100',
      addedAt: '2025-11-30T11:00:00Z',
      addedBy: 'user_xyz789',
      status: 'printing',
      estimatedTime: 7200
    },
    {
      position: 2,
      taskId: 'task_011',
      jobId: 'job_12348',
      fileName: 'miniature_base.stl',
      thumbnailUrl: 'https://via.placeholder.com/100',
      addedAt: '2025-11-30T13:00:00Z',
      addedBy: 'user_def456',
      status: 'queued',
      estimatedTime: 3600
    }
  ],

  // Queue for printer_def456 (Prusa Workshop)
  printer_def456: [
    {
      position: 1,
      taskId: 'task_002',
      jobId: 'job_12345',
      fileName: 'phone_case_v2.stl',
      thumbnailUrl: 'https://via.placeholder.com/100',
      addedAt: '2025-11-30T10:30:00Z',
      addedBy: 'user_xyz789',
      status: 'queued',
      estimatedTime: 6800
    }
  ],

  // Queue for printer_ghi789 (Bambu Speed) - empty after completing task
  printer_ghi789: [],

  // Queue for printer_jkl012 (Voron Beast) - has error
  printer_jkl012: [
    {
      position: 1,
      taskId: 'task_005',
      jobId: 'job_12346',
      fileName: 'gear_assembly.stl',
      thumbnailUrl: 'https://via.placeholder.com/100',
      addedAt: '2025-11-30T07:30:00Z',
      addedBy: 'user_abc123',
      status: 'error',
      estimatedTime: 10800
    },
    {
      position: 2,
      taskId: 'task_012',
      jobId: 'job_12348',
      fileName: 'miniature_hero.stl',
      thumbnailUrl: 'https://via.placeholder.com/100',
      addedAt: '2025-11-30T08:00:00Z',
      addedBy: 'user_def456',
      status: 'queued',
      estimatedTime: 4500
    }
  ],

  // Queue for printer_mno345 (K1 Speedy) - offline
  printer_mno345: [
    {
      position: 1,
      taskId: 'task_013',
      jobId: 'job_12348',
      fileName: 'miniature_weapon.stl',
      thumbnailUrl: 'https://via.placeholder.com/100',
      addedAt: '2025-11-27T12:00:00Z',
      addedBy: 'user_def456',
      status: 'queued',
      estimatedTime: 2400
    }
  ]
}

export default printerQueues
