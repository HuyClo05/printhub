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
  uid
  email
  userName
  avatarUrl
  createdAt
  preferences: {
    emailNotifications: true,
    theme: "dark"
  }
}
```

---

### 2. Printers Collection

**Path:** `printers/{printerId}`

```javascript
{
  ownerId
  sharedWith: []

  model
  name

  connection: {
    octoeverywhereUrl,
    lastSeen
  }

  status: {
    state,              // printing, ready, paused, error, offline
    nozzleTemp,
    nozzleTempTarget,
    bedTemp,
    bedTempTarget,
    fanSpeed,
    webcam
  }

  currentTaskId,        // null if idle

  createdAt
}
```

---

### 3. Printer Queue (Subcollection)

**Path:** `printers/{printerId}/queue/{queuePosition}`

Each printer has its own queue of pending print tasks.

```javascript
{
  taskId
  jobId
  addedAt
  addedBy
  status        // queued, slicing, ready
  estimatedTime // seconds
  thumbnailUrl
}
```

---

### 4. Print Jobs Collection

**Path:** `printJobs/{jobId}`

A Print Job is a batch that contains multiple Print Tasks.

Print Jobs allow you to organize and manage projects that consist of multiple distinct parts, each requiring separate print tasks.

```javascript
{
  createdBy
  jobName
  status          // pending, in-progress, completed, cancelled
  
  createdAt
  startedAt
  completedAt
  estimatedEndAt

  totalTasks
  completedTasks
  failedTasks
}
```

---

### 5. Print Tasks Collection

**Path:** `printTasks/{taskId}`

A Print Task represents a single STL file that can be printed on one or more printers.

```javascript
{
  jobId
  fileId

  status        // pending, slicing, queued, printing, completed, failed

  assigned: [
    {
      printerId,
      status,          // queued, printing, completed
      progress,        // 0-100
      startedAt,
      completedAt
    }
  ]

  createdAt
  estimatedPrintTime // seconds
}
```

---

### 6. Files Collection

**Path:** `files/{fileId}`

Stores metadata for uploaded STL files.

```javascript
files/{fileId} {
  fileName
  fileSize

  stlUrl
  gcodeUrl
  thumbnailUrl

  uploadedBy
  uploadedAt
}
```

---

## Status Types

### Printer Status

| Status       | Description               |
| ------------ | ------------------------- |
| `printing` | Currently printing a task |
| `ready`    | Idle, ready for new tasks |
| `paused`   | Print paused by user      |
| `error`    | Error occurred            |
| `offline`  | Printer not connected     |

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
