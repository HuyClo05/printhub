// Example Printers Data (following database_structure.md)

export const printers = [
  {
    printerId: 'printer_abc123',
    model: 'Ender 3 V2',
    printerName: 'Workshop Ender',
    ownerId: 'user_xyz789',
    sharedWith: ['user_abc123'],
    connection: {
      octoeverywhereUrl: 'oe_abc123_share',
      lastSeen: '2025-11-30T14:30:00Z'
    },
    status: {
      state: 'printing',
      nozzleTemp: 210,
      nozzleTempTarget: 210,
      bedTemp: 60,
      bedTempTarget: 60,
      fanSpeed: 100,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: {
      taskId: 'task_001',
      fileName: 'phone_case.stl',
      progress: 45,
      estimatedTimeRemaining: 3960
    },
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 47,
      successfulPrints: 44,
      failedPrints: 3,
      totalPrintTime: 234000,
      totalFilamentUsed: 2300
    },
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-11-30T14:30:00Z'
  },
  {
    printerId: 'printer_def456',
    model: 'Prusa MK3S+',
    printerName: 'Prusa Workshop',
    ownerId: 'user_xyz789',
    sharedWith: [],
    connection: {
      octoeverywhereUrl: 'oe_def456_share',
      lastSeen: '2025-11-30T14:25:00Z'
    },
    status: {
      state: 'paused',
      nozzleTemp: 25,
      nozzleTempTarget: 0,
      bedTemp: 22,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: null,
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 32,
      successfulPrints: 31,
      failedPrints: 1,
      totalPrintTime: 180000,
      totalFilamentUsed: 1800
    },
    createdAt: '2025-02-01T08:00:00Z',
    updatedAt: '2025-11-30T14:25:00Z'
  },
  {
    printerId: 'printer_ghi789',
    model: 'Bambu Lab X1C',
    printerName: 'Bambu Speed',
    ownerId: 'user_abc123',
    sharedWith: ['user_xyz789'],
    connection: {
      octoeverywhereUrl: 'oe_ghi789_share',
      lastSeen: '2025-11-30T14:20:00Z'
    },
    status: {
      state: 'ready',
      nozzleTemp: 23,
      nozzleTempTarget: 0,
      bedTemp: 21,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: null,
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 23,
      successfulPrints: 21,
      failedPrints: 2,
      totalPrintTime: 120000,
      totalFilamentUsed: 1100
    },
    createdAt: '2025-03-15T12:00:00Z',
    updatedAt: '2025-11-30T14:20:00Z'
  },
  {
    printerId: 'printer_jkl012',
    model: 'Voron 2.4',
    printerName: 'Voron Beast',
    ownerId: 'user_def456',
    sharedWith: [],
    connection: {
      octoeverywhereUrl: 'oe_jkl012_share',
      lastSeen: '2025-11-30T10:00:00Z'
    },
    status: {
      state: 'error',
      nozzleTemp: 185,
      nozzleTempTarget: 210,
      bedTemp: 60,
      bedTempTarget: 60,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: {
      taskId: 'task_005',
      fileName: 'gear_assembly.stl',
      progress: 23,
      estimatedTimeRemaining: 0
    },
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 56,
      successfulPrints: 52,
      failedPrints: 4,
      totalPrintTime: 280000,
      totalFilamentUsed: 2800
    },
    createdAt: '2025-01-20T16:00:00Z',
    updatedAt: '2025-11-30T10:00:00Z'
  },
  {
    printerId: 'printer_mno345',
    model: 'Creality K1 Max',
    printerName: 'K1 Speedy',
    ownerId: 'user_def456',
    sharedWith: ['user_xyz789', 'user_abc123'],
    connection: {
      octoeverywhereUrl: 'oe_mno345_share',
      lastSeen: '2025-11-28T08:00:00Z'
    },
    status: {
      state: 'offline',
      nozzleTemp: 0,
      nozzleTempTarget: 0,
      bedTemp: 0,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: null,
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 33,
      successfulPrints: 33,
      failedPrints: 0,
      totalPrintTime: 176000,
      totalFilamentUsed: 1700
    },
    createdAt: '2025-04-05T11:00:00Z',
    updatedAt: '2025-11-28T08:00:00Z'
  }
]

export default printers
