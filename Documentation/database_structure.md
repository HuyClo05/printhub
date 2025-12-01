# PrintHub Database Structure

## Overview

PrintHub uses Firebase Firestore (NoSQL) to store data. The structure follows these relationships:

- **Users** own **Printers**
- **Users** create **Print Jobs**
- **Print Jobs** contain multiple **Print Tasks**
- **Print Tasks** have 1 STL file and can be assigned to 1+ **Printers**
- Each **Printer** has a queue of **Print Tasks**

---

## Collections

### 1. Users Collection

**Path:** `users/{userId}`

```javascript
{
  // Authentication
  "uid": "user_xyz789",
  "email": "john@example.com",
  
  // Profile
  "userName": "john_doe",
  "avatarUrl": "https://storage.firebase.com/avatars/user_xyz789.jpg",
  "createdAt": "2025-01-15T10:00:00Z",
  
  // References
  "printers": ["printer_abc123", "printer_def456"],
  "savedModels": ["file1.stl", "file2.stl"]
  
  // Preferences
  "preferences": {
    "emailNotifications": true,
    "theme": "dark"
  },
  
  // Statistics
  "stats": {
    "totalPrints": 47,
    "successfulPrints": 44,
    "failedPrints": 3,
    "totalPrintTime": 234000,       // seconds
    "totalFilamentUsed": 2300       // grams
  }
}
```

---

### 2. Printers Collection

**Path:** `printers/{printerId}`

```javascript
{
  // Basic Info
  "printerId": "printer_abc123",
  "model": "Ender 3 V2",
  "printerName": "Ender 3 V2",
  
  // Ownership
  "ownerId": "user_xyz789",
  "sharedWith": ["user_123", "user_456"],
  
  // Connection (OctoEverywhere / Klipper)
  "connection": {
    "octoeverywhereUrl": "oe_share_code_here",
    "lastSeen": "2025-11-30T14:30:00Z"
  },
  
  // Current Status
  "status": {
    "state": "printing",            // See Status Types below
    "nozzleTemp": 210,
    "nozzleTempTarget": 210,
    "bedTemp": 60,
    "bedTempTarget": 60,
    "fanSpeed": 100,
    "webcam": "htpps://webcamUrl"
  },
  
  // Print Tasks Queue
  "printerQueue": {
    // See Printer Queue below
  },

  // Presets (List of JSON Printer Preset Files Generate from Orca Slicer)
  "printerPresets": []

  // Filaments (List of JSON Filaments Preset Files Generate from Orca Slicer)
  "printerFilaments": []

  // Processes (List of JSON Process Preset Files Generate from Orca Slicer)
  "printerProcesses": []

  // Statistics
  "stats": {
    "totalPrints": 47,
    "successfulPrints": 44,
    "failedPrints": 3,
    "totalPrintTime": 234000,
    "totalFilamentUsed": 2300
  },
  
  // Metadata
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-11-30T14:30:00Z"
}
```

---

### 3. Printer Queue (Subcollection)

**Path:** `printers/{printerId}/queue/{queuePosition}`

Each printer has its own queue of pending print tasks.

```javascript
{
  "position": 1,
  "taskId": "task_002",
  "jobId": "job_12345",
  "fileName": "phone_case.stl",
  "thumbnailUrl": // Generated from the slicer,
  "addedAt": "2025-11-30T14:00:00Z",
  "addedBy": "user_xyz789",
  "status": "queued",               // "queued", "slicing", "ready"
  "estimatedTime": 7200             // seconds
}
```

---

### 4. Print Jobs Collection

**Path:** `printJobs/{jobId}`

A Print Job is a batch that contains multiple Print Tasks.

Print Jobs allow you to organize and manage projects that consist of multiple distinct parts, each requiring separate print tasks.

```javascript
{
  "jobId": "job_12345",
  "jobName": "Batch Print - Phone Cases",
  
  // Owner
  "createdBy": "user_xyz789",
  "createdAt": "2025-11-30T10:00:00Z",
  "updatedAt": "2025-11-30T14:30:00Z",
  
  // Status
  "status": "in-progress",          // "pending", "in-progress", "completed", "cancelled"
  
  // Task References
  "tasks": ["task_001", "task_002", "task_003"],
  "totalTasks": 3,
  "completedTasks": 1,
  "failedTasks": 0,
  
  // Timing
  "startedAt": "2025-11-30T12:00:00Z",
  "completedAt": null,
  "estimatedEndAt": "2025-11-30T18:00:00Z"
}
```

---

### 5. Print Tasks Collection

**Path:** `printTasks/{taskId}`

A Print Task represents a single STL file that can be printed on one or more printers.

```javascript
{
  "taskId": "task_001",
  "jobId": "job_12345",             // Parent job reference
  
  // Single STL File
  "file": {
    "fileId": "file_xyz",
    "fileName": "phone_case.stl",
    "fileSize": 1024000,            // bytes
    "stlUrl": "https://storage.firebase.com/stl/phone_case.stl",
    "gcodeUrl": "https://storage.firebase.com/gcode/phone_case.gcode",
    "thumbnailUrl": "https://storage.firebase.com/thumbnails/phone_case.png"
  },
  
  // Assigned Printers (1 or more)
  "assignedPrinters": [
    {
      "printerId": "printer_abc123",
      "printerName": "Ender 3",
      "status": "printing",
      "progress": 75,
      "queuePosition": null,        // null if currently printing
      "startedAt": "2025-11-30T12:00:00Z",
      "completedAt": null
    },
    {
      "printerId": "printer_def456",
      "printerName": "Ender 5",
      "status": "queued",
      "progress": 0,
      "queuePosition": 2,
      "startedAt": null,
      "completedAt": null
    }
  ],
  
  // Overall Task Status
  "status": "in-progress",    // "pending", "slicing", "queued", "in-progress", "completed", "failed", "cancelled"
  
  // Timing
  "createdAt": "2025-11-30T10:00:00Z",
  "estimatedPrintTime": 7200,       // seconds
  
  // Results (after completion)
  "results": {
    "successCount": 0,
    "failCount": 0,
    "totalFilamentUsed": 0          // grams
  }
}
```

---

### 6. Files Collection

**Path:** `files/{fileId}`

Stores metadata for uploaded STL files.

```javascript
{
  "fileId": "file_xyz",
  "fileName": "phone_case.stl",
  "fileSize": 1024000,              // bytes
  
  // Storage URLs
  "stlUrl": "https://storage.firebase.com/stl/phone_case.stl",
  "thumbnailUrl": // Generated from Slicer,
  
  // Metadata
  "uploadedBy": "user_xyz789",
  "uploadedAt": "2025-11-30T10:00:00Z",
}
```

---

## Status Types

### Printer Status

| Status       | Color                  | Description               |
| ------------ | ---------------------- | ------------------------- |
| `printing` | 🟦 Cyan (#00bcd4)      | Currently printing a task |
| `ready`    | 🟩 Green (#4caf50)     | Idle, ready for new tasks |
| `paused`   | 🟧 Orange (#ff9800)    | Print paused by user      |
| `error`    | 🟥 Red (#f44336)       | Error occurred            |
| `offline`  | ⬛ Dark Gray (#616161) | Printer not connected     |

### Print Task Status

| Status          | Description                      |
| --------------- | -------------------------------- |
| `pending`     | Task created, not yet processed  |
| `in-progress` | At least one printer is printing |
| `completed`   | All assigned printers finished   |
| `failed`      | Print failed on all printers     |
| `cancelled`   | Cancelled by user                |

### Print Job Status

| Status          | Description                   |
| --------------- | ----------------------------- |
| `pending`     | Job created, no tasks started |
| `in-progress` | At least one task is active   |
| `completed`   | All tasks completed           |
| `cancelled`   | Job cancelled by user         |

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           USERS                                 │
│  ┌─────────────┐                                                │
│  │   User      │                                                │
│  │  userId     │──────────┐                                     │
│  │  printers[] │          │                                     │
│  └─────────────┘          │                                     │
│                           │ owns                                │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      PRINTERS                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │  Printer 1  │  │  Printer 2  │  │  Printer 3  │      │    │
│  │  │  printerId  │  │  printerId  │  │  printerId  │      │    │
│  │  │  queue[]    │  │  queue[]    │  │  queue[]    │      │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │    │
│  │         │                │                │             │    │
│  └─────────┼────────────────┼────────────────┼─────────────┘    │
│            │                │                │                  │
│            │ queue contains │                │                  │
│            ▼                ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     PRINT TASKS                         │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Print Task                                     │    │    │
│  │  │  taskId                                         │    │    │
│  │  │  jobId (parent reference)                       │    │    │
│  │  │  file: { 1 STL file }                           │    │    │
│  │  │  assignedPrinters: [ 1 or more printers ]       │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                               │ belongs to                      │
│                               ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      PRINT JOBS                         │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Print Job                                      │    │    │
│  │  │  jobId                                          │    │    │
│  │  │  tasks: [ task_001, task_002, task_003 ]        │    │    │
│  │  │  createdBy: userId                              │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Firebase Storage Structure

```
storage/
├── stl/
│   └── {fileId}.stl              # Original STL files
│
├── gcode/
│   └── {gcodeId}.gcode           # Sliced G-code files
│
├── thumbnails/
│   └── {fileId}.png              # File preview images
│
├── snapshots/
│   └── {printerId}.jpg           # Printer webcam snapshots
│
└── avatars/
    └── {userId}.jpg              # User profile pictures
```

---

## Example Firestore Queries

### Get User's Printers

```javascript
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/init'

const getUserPrinters = async (userId) => {
  const q = query(
    collection(db, 'printers'),
    where('ownerId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

### Get Printer Queue

```javascript
const getPrinterQueue = async (printerId) => {
  const q = query(
    collection(db, 'printers', printerId, 'queue'),
    orderBy('position', 'asc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

### Get User's Print Jobs

```javascript
const getUserJobs = async (userId) => {
  const q = query(
    collection(db, 'printJobs'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

### Get Tasks for a Job

```javascript
const getJobTasks = async (jobId) => {
  const q = query(
    collection(db, 'printTasks'),
    where('jobId', '==', jobId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

### Real-time Printer Status

```javascript
import { doc, onSnapshot } from 'firebase/firestore'

const subscribeToPrinter = (printerId, callback) => {
  return onSnapshot(doc(db, 'printers', printerId), (doc) => {
    callback({ id: doc.id, ...doc.data() })
  })
}
```

---

## Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  
    // Printers - owner and shared users can access
    match /printers/{printerId} {
      allow read: if request.auth != null && 
        (resource.data.ownerId == request.auth.uid || 
         request.auth.uid in resource.data.sharedWith);
      allow write: if request.auth != null && 
        resource.data.ownerId == request.auth.uid;
  
      // Queue subcollection
      match /queue/{queueId} {
        allow read, write: if request.auth != null;
      }
    }
  
    // Print Jobs - only creator can access
    match /printJobs/{jobId} {
      allow read, write: if request.auth != null && 
        resource.data.createdBy == request.auth.uid;
    }
  
    // Print Tasks - check parent job ownership
    match /printTasks/{taskId} {
      allow read, write: if request.auth != null;
    }
  
    // Files - uploader can access
    match /files/{fileId} {
      allow read: if request.auth != null && 
        (resource.data.uploadedBy == request.auth.uid || resource.data.isPublic);
      allow write: if request.auth != null && 
        resource.data.uploadedBy == request.auth.uid;
    }
  }
}
```

---

## Summary

| Collection              | Purpose               | Key Fields                   |
| ----------------------- | --------------------- | ---------------------------- |
| `users`               | User accounts         | email, userName, printers[]  |
| `printers`            | Printer info & status | ownerId, status, currentTask |
| `printers/{id}/queue` | Printer task queue    | position, taskId             |
| `printJobs`           | Batch of tasks        | tasks[], status              |
| `printTasks`          | Single STL print      | file, assignedPrinters[]     |
| `files`               | STL file metadata     | stlUrl, gcodeUrl             |
