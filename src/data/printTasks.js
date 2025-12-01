// Example Print Tasks Data (following database_structure.md)

export const printTasks = [
  {
    taskId: 'task_001',
    jobId: 'job_12345',
    file: {
      fileId: 'file_001',
      fileName: 'phone_case_v1.stl',
      fileSize: 1024000,
      stlUrl: 'https://storage.firebase.com/stl/phone_case_v1.stl',
      gcodeUrl: 'https://storage.firebase.com/gcode/phone_case_v1.gcode',
      thumbnailUrl: 'https://via.placeholder.com/100'
    },
    assignedPrinters: [
      {
        printerId: 'printer_abc123',
        printerName: 'Workshop Ender',
        status: 'printing',
        progress: 45,
        queuePosition: null,
        startedAt: '2025-11-30T12:00:00Z',
        completedAt: null
      }
    ],
    status: 'in-progress',
    createdAt: '2025-11-30T10:00:00Z',
    estimatedPrintTime: 7200,
    results: {
      successCount: 0,
      failCount: 0,
      totalFilamentUsed: 0
    }
  },
  {
    taskId: 'task_002',
    jobId: 'job_12345',
    file: {
      fileId: 'file_002',
      fileName: 'phone_case_v2.stl',
      fileSize: 1100000,
      stlUrl: 'https://storage.firebase.com/stl/phone_case_v2.stl',
      gcodeUrl: 'https://storage.firebase.com/gcode/phone_case_v2.gcode',
      thumbnailUrl: 'https://via.placeholder.com/100'
    },
    assignedPrinters: [
      {
        printerId: 'printer_def456',
        printerName: 'Prusa Workshop',
        status: 'queued',
        progress: 0,
        queuePosition: 1,
        startedAt: null,
        completedAt: null
      }
    ],
    status: 'queued',
    createdAt: '2025-11-30T10:00:00Z',
    estimatedPrintTime: 6800,
    results: {
      successCount: 0,
      failCount: 0,
      totalFilamentUsed: 0
    }
  },
  {
    taskId: 'task_003',
    jobId: 'job_12345',
    file: {
      fileId: 'file_003',
      fileName: 'phone_stand.stl',
      fileSize: 850000,
      stlUrl: 'https://storage.firebase.com/stl/phone_stand.stl',
      gcodeUrl: 'https://storage.firebase.com/gcode/phone_stand.gcode',
      thumbnailUrl: 'https://via.placeholder.com/100'
    },
    assignedPrinters: [
      {
        printerId: 'printer_ghi789',
        printerName: 'Bambu Speed',
        status: 'completed',
        progress: 100,
        queuePosition: null,
        startedAt: '2025-11-30T10:30:00Z',
        completedAt: '2025-11-30T12:30:00Z'
      }
    ],
    status: 'completed',
    createdAt: '2025-11-30T10:00:00Z',
    estimatedPrintTime: 7200,
    results: {
      successCount: 1,
      failCount: 0,
      totalFilamentUsed: 45
    }
  },
  {
    taskId: 'task_004',
    jobId: 'job_12346',
    file: {
      fileId: 'file_004',
      fileName: 'robot_arm_base.stl',
      fileSize: 2500000,
      stlUrl: 'https://storage.firebase.com/stl/robot_arm_base.stl',
      gcodeUrl: null,
      thumbnailUrl: 'https://via.placeholder.com/100'
    },
    assignedPrinters: [],
    status: 'pending',
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 14400,
    results: {
      successCount: 0,
      failCount: 0,
      totalFilamentUsed: 0
    }
  },
  {
    taskId: 'task_005',
    jobId: 'job_12346',
    file: {
      fileId: 'file_005',
      fileName: 'gear_assembly.stl',
      fileSize: 1800000,
      stlUrl: 'https://storage.firebase.com/stl/gear_assembly.stl',
      gcodeUrl: 'https://storage.firebase.com/gcode/gear_assembly.gcode',
      thumbnailUrl: 'https://via.placeholder.com/100'
    },
    assignedPrinters: [
      {
        printerId: 'printer_jkl012',
        printerName: 'Voron Beast',
        status: 'error',
        progress: 23,
        queuePosition: null,
        startedAt: '2025-11-30T08:00:00Z',
        completedAt: null
      }
    ],
    status: 'failed',
    createdAt: '2025-11-29T09:00:00Z',
    estimatedPrintTime: 10800,
    results: {
      successCount: 0,
      failCount: 1,
      totalFilamentUsed: 25
    }
  }
]

export default printTasks
