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
  },
  {
    printerId: 'printer_pqr678',
    model: 'Anycubic Kobra 2 Max',
    printerName: 'Big Kobra',
    ownerId: 'user_xyz789',
    sharedWith: [],
    connection: {
      octoeverywhereUrl: 'oe_pqr678_share',
      lastSeen: '2025-12-02T09:15:00Z'
    },
    status: {
      state: 'printing',
      nozzleTemp: 215,
      nozzleTempTarget: 215,
      bedTemp: 65,
      bedTempTarget: 65,
      fanSpeed: 80,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: {
      taskId: 'task_020',
      fileName: 'large_vase.stl',
      progress: 78,
      estimatedTimeRemaining: 1800
    },
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 18,
      successfulPrints: 17,
      failedPrints: 1,
      totalPrintTime: 320000,
      totalFilamentUsed: 4200
    },
    createdAt: '2025-05-10T14:00:00Z',
    updatedAt: '2025-12-02T09:15:00Z'
  },
  {
    printerId: 'printer_stu901',
    model: 'Elegoo Neptune 4 Pro',
    printerName: 'Neptune Lab',
    ownerId: 'user_abc123',
    sharedWith: ['user_def456'],
    connection: {
      octoeverywhereUrl: 'oe_stu901_share',
      lastSeen: '2025-12-02T08:30:00Z'
    },
    status: {
      state: 'idle',
      nozzleTemp: 24,
      nozzleTempTarget: 0,
      bedTemp: 23,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: null,
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 65,
      successfulPrints: 62,
      failedPrints: 3,
      totalPrintTime: 198000,
      totalFilamentUsed: 2100
    },
    createdAt: '2025-02-28T10:00:00Z',
    updatedAt: '2025-12-02T08:30:00Z'
  },
  {
    printerId: 'printer_vwx234',
    model: 'Bambu Lab P1S',
    printerName: 'P1S Workhorse',
    ownerId: 'user_def456',
    sharedWith: ['user_xyz789'],
    connection: {
      octoeverywhereUrl: 'oe_vwx234_share',
      lastSeen: '2025-12-02T10:00:00Z'
    },
    status: {
      state: 'printing',
      nozzleTemp: 220,
      nozzleTempTarget: 220,
      bedTemp: 55,
      bedTempTarget: 55,
      fanSpeed: 100,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: {
      taskId: 'task_021',
      fileName: 'keyboard_case.stl',
      progress: 12,
      estimatedTimeRemaining: 14400
    },
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 112,
      successfulPrints: 108,
      failedPrints: 4,
      totalPrintTime: 520000,
      totalFilamentUsed: 5800
    },
    createdAt: '2025-01-05T09:00:00Z',
    updatedAt: '2025-12-02T10:00:00Z'
  },
  {
    printerId: 'printer_yza567',
    model: 'Prusa MK4',
    printerName: 'MK4 Reliable',
    ownerId: 'user_xyz789',
    sharedWith: ['user_abc123', 'user_def456'],
    connection: {
      octoeverywhereUrl: 'oe_yza567_share',
      lastSeen: '2025-12-01T22:00:00Z'
    },
    status: {
      state: 'ready',
      nozzleTemp: 25,
      nozzleTempTarget: 0,
      bedTemp: 24,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: null,
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 89,
      successfulPrints: 87,
      failedPrints: 2,
      totalPrintTime: 410000,
      totalFilamentUsed: 4100
    },
    createdAt: '2025-03-01T15:00:00Z',
    updatedAt: '2025-12-01T22:00:00Z'
  },
  {
    printerId: 'printer_bcd890',
    model: 'Sovol SV07 Plus',
    printerName: 'Sovol Big Boy',
    ownerId: 'user_abc123',
    sharedWith: [],
    connection: {
      octoeverywhereUrl: 'oe_bcd890_share',
      lastSeen: '2025-12-02T07:45:00Z'
    },
    status: {
      state: 'paused',
      nozzleTemp: 200,
      nozzleTempTarget: 210,
      bedTemp: 60,
      bedTempTarget: 60,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: {
      taskId: 'task_022',
      fileName: 'drone_frame.stl',
      progress: 34,
      estimatedTimeRemaining: 7200
    },
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 28,
      successfulPrints: 26,
      failedPrints: 2,
      totalPrintTime: 245000,
      totalFilamentUsed: 3200
    },
    createdAt: '2025-06-20T11:00:00Z',
    updatedAt: '2025-12-02T07:45:00Z'
  },
  {
    printerId: 'printer_efg123',
    model: 'Creality Ender 5 S1',
    printerName: 'Ender Cube',
    ownerId: 'user_def456',
    sharedWith: [],
    connection: {
      octoeverywhereUrl: 'oe_efg123_share',
      lastSeen: '2025-11-25T16:00:00Z'
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
      totalPrints: 41,
      successfulPrints: 39,
      failedPrints: 2,
      totalPrintTime: 156000,
      totalFilamentUsed: 1600
    },
    createdAt: '2025-04-15T13:00:00Z',
    updatedAt: '2025-11-25T16:00:00Z'
  },
  {
    printerId: 'printer_hij456',
    model: 'Flashforge Adventurer 5M Pro',
    printerName: 'Flash Speed',
    ownerId: 'user_xyz789',
    sharedWith: [],
    connection: {
      octoeverywhereUrl: 'oe_hij456_share',
      lastSeen: '2025-12-02T10:30:00Z'
    },
    status: {
      state: 'printing',
      nozzleTemp: 205,
      nozzleTempTarget: 205,
      bedTemp: 50,
      bedTempTarget: 50,
      fanSpeed: 90,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTask: {
      taskId: 'task_023',
      fileName: 'cable_organizer.stl',
      progress: 92,
      estimatedTimeRemaining: 480
    },
    printerPresets: [],
    printerFilaments: [],
    printerProcesses: [],
    stats: {
      totalPrints: 156,
      successfulPrints: 152,
      failedPrints: 4,
      totalPrintTime: 380000,
      totalFilamentUsed: 3900
    },
    createdAt: '2025-01-25T08:00:00Z',
    updatedAt: '2025-12-02T10:30:00Z'
  }
]

export default printers
