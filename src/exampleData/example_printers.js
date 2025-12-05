// Example Printers Data (following database_structure.md)
// Path: printers/{printerId}
// Note: Queue is a subcollection at printers/{printerId}/queue/{queuePosition}

export const printers = [
  {
    printerId: 'printer_abc123',
    ownerId: 'user_xyz789',
    sharedWith: ['user_abc123'],
    model: 'Ender 3 V2',
    name: 'Workshop Ender',
    connection: {
      octoeverywhereUrl: 'oe_abc123_share',
      lastSeen: '2025-11-30T14:30:00Z'
    },
    printerPresets: [
      { id: 'pp_1', name: 'Ender 3 V2 Default' }
    ],
    processPresets: [
      { id: 'proc_1', name: '0.2mm Standard' },
      { id: 'proc_2', name: '0.12mm Fine' }
    ],
    filamentPresets: [
      { id: 'fil_1', name: 'Generic PLA' },
      { id: 'fil_2', name: 'Generic PETG' }
    ],
    status: {
      state: 'printing',
      nozzleTemp: 210,
      nozzleTempTarget: 210,
      bedTemp: 60,
      bedTempTarget: 60,
      fanSpeed: 100,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: 'task_001',
    createdAt: '2025-01-15T10:00:00Z'
  },
  {
    printerId: 'printer_def456',
    ownerId: 'user_xyz789',
    sharedWith: [],
    model: 'Prusa MK3S+',
    name: 'Prusa Workshop',
    connection: {
      octoeverywhereUrl: 'oe_def456_share',
      lastSeen: '2025-11-30T14:25:00Z'
    },
    printerPresets: [
      { id: 'pp_2', name: 'Prusa MK3S+ Default' }
    ],
    processPresets: [
      { id: 'proc_3', name: '0.2mm Quality' },
      { id: 'proc_4', name: '0.15mm Detail' }
    ],
    filamentPresets: [
      { id: 'fil_3', name: 'Prusament PLA' },
      { id: 'fil_4', name: 'Prusament PETG' }
    ],
    status: {
      state: 'ready',
      nozzleTemp: 25,
      nozzleTempTarget: 0,
      bedTemp: 22,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: null,
    createdAt: '2025-02-01T08:00:00Z'
  },
  {
    printerId: 'printer_ghi789',
    ownerId: 'user_abc123',
    sharedWith: ['user_xyz789'],
    model: 'Bambu Lab X1C',
    name: 'Bambu Speed',
    connection: {
      octoeverywhereUrl: 'oe_ghi789_share',
      lastSeen: '2025-11-30T14:20:00Z'
    },
    printerPresets: [
      { id: 'pp_3', name: 'X1C 0.4mm Nozzle' }
    ],
    processPresets: [
      { id: 'proc_5', name: '0.2mm Speed' },
      { id: 'proc_6', name: '0.08mm Ultra Fine' }
    ],
    filamentPresets: [
      { id: 'fil_5', name: 'Bambu PLA Basic' },
      { id: 'fil_6', name: 'Bambu ABS' }
    ],
    status: {
      state: 'ready',
      nozzleTemp: 23,
      nozzleTempTarget: 0,
      bedTemp: 21,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: null,
    createdAt: '2025-03-15T12:00:00Z'
  },
  {
    printerId: 'printer_jkl012',
    ownerId: 'user_def456',
    sharedWith: [],
    model: 'Voron 2.4',
    name: 'Voron Beast',
    connection: {
      octoeverywhereUrl: 'oe_jkl012_share',
      lastSeen: '2025-11-30T10:00:00Z'
    },
    printerPresets: [
      { id: 'pp_4', name: 'Voron 2.4 350mm' }
    ],
    processPresets: [
      { id: 'proc_7', name: '0.2mm Fast' }
    ],
    filamentPresets: [
      { id: 'fil_7', name: 'ABS' },
      { id: 'fil_8', name: 'ASA' }
    ],
    status: {
      state: 'error',
      nozzleTemp: 185,
      nozzleTempTarget: 210,
      bedTemp: 60,
      bedTempTarget: 60,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: 'task_005',
    createdAt: '2025-01-20T16:00:00Z'
  },
  {
    printerId: 'printer_mno345',
    ownerId: 'user_def456',
    sharedWith: ['user_xyz789', 'user_abc123'],
    model: 'Creality K1 Max',
    name: 'K1 Speedy',
    connection: {
      octoeverywhereUrl: 'oe_mno345_share',
      lastSeen: '2025-11-28T08:00:00Z'
    },
    printerPresets: [
      { id: 'pp_5', name: 'K1 Max Default' }
    ],
    processPresets: [
      { id: 'proc_8', name: '0.2mm High Speed' }
    ],
    filamentPresets: [
      { id: 'fil_9', name: 'Hyper PLA' }
    ],
    status: {
      state: 'offline',
      nozzleTemp: 0,
      nozzleTempTarget: 0,
      bedTemp: 0,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: null,
    createdAt: '2025-04-05T11:00:00Z'
  },
  {
    printerId: 'printer_pqr678',
    ownerId: 'user_xyz789',
    sharedWith: [],
    model: 'Anycubic Kobra 2 Max',
    name: 'Big Kobra',
    connection: {
      octoeverywhereUrl: 'oe_pqr678_share',
      lastSeen: '2025-12-02T09:15:00Z'
    },
    printerPresets: [
      { id: 'pp_6', name: 'Kobra 2 Max Default' }
    ],
    processPresets: [
      { id: 'proc_9', name: '0.2mm Standard' }
    ],
    filamentPresets: [
      { id: 'fil_10', name: 'Generic PLA' }
    ],
    status: {
      state: 'printing',
      nozzleTemp: 215,
      nozzleTempTarget: 215,
      bedTemp: 65,
      bedTempTarget: 65,
      fanSpeed: 80,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: 'task_020',
    createdAt: '2025-05-10T14:00:00Z'
  },
  {
    printerId: 'printer_stu901',
    ownerId: 'user_abc123',
    sharedWith: ['user_def456'],
    model: 'Elegoo Neptune 4 Pro',
    name: 'Neptune Lab',
    connection: {
      octoeverywhereUrl: 'oe_stu901_share',
      lastSeen: '2025-12-02T08:30:00Z'
    },
    printerPresets: [
      { id: 'pp_7', name: 'Neptune 4 Pro Default' }
    ],
    processPresets: [
      { id: 'proc_10', name: '0.2mm Balanced' }
    ],
    filamentPresets: [
      { id: 'fil_11', name: 'PLA+' }
    ],
    status: {
      state: 'ready',
      nozzleTemp: 24,
      nozzleTempTarget: 0,
      bedTemp: 23,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: null,
    createdAt: '2025-02-28T10:00:00Z'
  },
  {
    printerId: 'printer_vwx234',
    ownerId: 'user_def456',
    sharedWith: ['user_xyz789'],
    model: 'Bambu Lab P1S',
    name: 'P1S Workhorse',
    connection: {
      octoeverywhereUrl: 'oe_vwx234_share',
      lastSeen: '2025-12-02T10:00:00Z'
    },
    printerPresets: [
      { id: 'pp_8', name: 'P1S 0.4mm Nozzle' }
    ],
    processPresets: [
      { id: 'proc_11', name: '0.2mm Standard' },
      { id: 'proc_12', name: '0.16mm Optimal' }
    ],
    filamentPresets: [
      { id: 'fil_12', name: 'Bambu PLA Matte' }
    ],
    status: {
      state: 'printing',
      nozzleTemp: 220,
      nozzleTempTarget: 220,
      bedTemp: 55,
      bedTempTarget: 55,
      fanSpeed: 100,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: 'task_021',
    createdAt: '2025-01-05T09:00:00Z'
  },
  {
    printerId: 'printer_yza567',
    ownerId: 'user_xyz789',
    sharedWith: ['user_abc123', 'user_def456'],
    model: 'Prusa MK4',
    name: 'MK4 Reliable',
    connection: {
      octoeverywhereUrl: 'oe_yza567_share',
      lastSeen: '2025-12-01T22:00:00Z'
    },
    printerPresets: [
      { id: 'pp_9', name: 'Prusa MK4 Default' }
    ],
    processPresets: [
      { id: 'proc_13', name: '0.2mm Structural' }
    ],
    filamentPresets: [
      { id: 'fil_13', name: 'Prusament PLA' },
      { id: 'fil_14', name: 'Prusament ASA' }
    ],
    status: {
      state: 'ready',
      nozzleTemp: 25,
      nozzleTempTarget: 0,
      bedTemp: 24,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: null,
    createdAt: '2025-03-01T15:00:00Z'
  },
  {
    printerId: 'printer_bcd890',
    ownerId: 'user_abc123',
    sharedWith: [],
    model: 'Sovol SV07 Plus',
    name: 'Sovol Big Boy',
    connection: {
      octoeverywhereUrl: 'oe_bcd890_share',
      lastSeen: '2025-12-02T07:45:00Z'
    },
    printerPresets: [
      { id: 'pp_10', name: 'SV07 Plus Default' }
    ],
    processPresets: [
      { id: 'proc_14', name: '0.2mm Draft' }
    ],
    filamentPresets: [
      { id: 'fil_15', name: 'PLA' }
    ],
    status: {
      state: 'paused',
      nozzleTemp: 200,
      nozzleTempTarget: 210,
      bedTemp: 60,
      bedTempTarget: 60,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: 'task_022',
    createdAt: '2025-06-20T11:00:00Z'
  },
  {
    printerId: 'printer_efg123',
    ownerId: 'user_def456',
    sharedWith: [],
    model: 'Creality Ender 5 S1',
    name: 'Ender Cube',
    connection: {
      octoeverywhereUrl: 'oe_efg123_share',
      lastSeen: '2025-11-25T16:00:00Z'
    },
    printerPresets: [
      { id: 'pp_11', name: 'Ender 5 S1 Default' }
    ],
    processPresets: [
      { id: 'proc_15', name: '0.2mm Normal' }
    ],
    filamentPresets: [
      { id: 'fil_16', name: 'Generic PLA' }
    ],
    status: {
      state: 'offline',
      nozzleTemp: 0,
      nozzleTempTarget: 0,
      bedTemp: 0,
      bedTempTarget: 0,
      fanSpeed: 0,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: null,
    createdAt: '2025-04-15T13:00:00Z'
  },
  {
    printerId: 'printer_hij456',
    ownerId: 'user_xyz789',
    sharedWith: [],
    model: 'Flashforge Adventurer 5M Pro',
    name: 'Flash Speed',
    connection: {
      octoeverywhereUrl: 'oe_hij456_share',
      lastSeen: '2025-12-02T10:30:00Z'
    },
    printerPresets: [
      { id: 'pp_12', name: 'Adventurer 5M Pro Default' }
    ],
    processPresets: [
      { id: 'proc_16', name: '0.2mm Fast' }
    ],
    filamentPresets: [
      { id: 'fil_17', name: 'FlashForge PLA' }
    ],
    status: {
      state: 'printing',
      nozzleTemp: 205,
      nozzleTempTarget: 205,
      bedTemp: 50,
      bedTempTarget: 50,
      fanSpeed: 90,
      webcam: 'https://via.placeholder.com/260x200'
    },
    currentTaskId: 'task_023',
    createdAt: '2025-01-25T08:00:00Z'
  }
]

export default printers
