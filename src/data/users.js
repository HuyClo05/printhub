// Example Users Data (following database_structure.md)

export const users = [
  {
    uid: 'user_xyz789',
    email: 'john@example.com',
    userName: 'john_doe',
    avatarUrl: 'https://via.placeholder.com/100',
    createdAt: '2025-01-15T10:00:00Z',
    printers: ['printer_abc123', 'printer_def456'],
    savedModels: ['file_001.stl', 'file_002.stl'],
    preferences: {
      emailNotifications: true,
      theme: 'dark'
    },
    stats: {
      totalPrints: 47,
      successfulPrints: 44,
      failedPrints: 3,
      totalPrintTime: 234000,
      totalFilamentUsed: 2300
    }
  },
  {
    uid: 'user_abc123',
    email: 'jane@example.com',
    userName: 'jane_smith',
    avatarUrl: 'https://via.placeholder.com/100',
    createdAt: '2025-02-20T14:30:00Z',
    printers: ['printer_ghi789'],
    savedModels: ['file_003.stl'],
    preferences: {
      emailNotifications: false,
      theme: 'dark'
    },
    stats: {
      totalPrints: 23,
      successfulPrints: 21,
      failedPrints: 2,
      totalPrintTime: 120000,
      totalFilamentUsed: 1100
    }
  },
  {
    uid: 'user_def456',
    email: 'bob@example.com',
    userName: 'bob_maker',
    avatarUrl: 'https://via.placeholder.com/100',
    createdAt: '2025-03-10T09:15:00Z',
    printers: ['printer_jkl012', 'printer_mno345'],
    savedModels: [],
    preferences: {
      emailNotifications: true,
      theme: 'light'
    },
    stats: {
      totalPrints: 89,
      successfulPrints: 85,
      failedPrints: 4,
      totalPrintTime: 456000,
      totalFilamentUsed: 4500
    }
  }
]

export default users
