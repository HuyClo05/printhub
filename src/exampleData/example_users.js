// Example Users Data (following database_structure.md)
// Path: users/{userId}

export const users = [
  {
    uid: 'user_xyz789',
    email: 'john@example.com',
    userName: 'john_doe',
    avatarUrl: 'https://via.placeholder.com/100',
    createdAt: '2025-01-15T10:00:00Z',
    preferences: {
      emailNotifications: true,
      theme: 'dark'
    }
  },
  {
    uid: 'user_abc123',
    email: 'jane@example.com',
    userName: 'jane_smith',
    avatarUrl: 'https://via.placeholder.com/100',
    createdAt: '2025-02-20T14:30:00Z',
    preferences: {
      emailNotifications: false,
      theme: 'dark'
    }
  },
  {
    uid: 'user_def456',
    email: 'bob@example.com',
    userName: 'bob_maker',
    avatarUrl: 'https://via.placeholder.com/100',
    createdAt: '2025-03-10T09:15:00Z',
    preferences: {
      emailNotifications: true,
      theme: 'light'
    }
  }
]

export default users
