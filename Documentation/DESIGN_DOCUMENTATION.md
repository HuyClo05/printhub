# PrintHub - Design Documentation

## Overview

PrintHub is a Vue.js 3 web application for managing 3D printers, print jobs, and print queues. It provides a centralized platform to monitor multiple printers, create print jobs with multiple tasks, and manage print queues across a fleet of 3D printers.

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **Vue 3** | Frontend framework with Composition API |
| **Vue Router** | Client-side routing |
| **Firebase Auth** | User authentication |
| **Firebase Firestore** | NoSQL database |
| **Firebase Storage** | File storage for STL/3MF/GCODE files |
| **Vite** | Build tool and dev server |

---

## Project Structure

```
printhub/
├── Documentation/          # Project documentation
├── firebase/               # Firebase configuration and services
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images, icons, logos
│   ├── components/        # Reusable Vue components
│   ├── exampleData/       # Sample data for database seeding
│   ├── router/            # Vue Router configuration
│   ├── services/          # Business logic and API services
│   └── views/             # Page-level components
├── index.html             # Entry HTML file
├── package.json           # Dependencies and scripts
└── vite.config.js         # Vite configuration
```

---

## Firebase Configuration

### `/firebase/init.js`

Initializes Firebase services used throughout the application:

- **Firebase App** - Core Firebase instance
- **Firebase Auth** - User authentication
- **Firebase Firestore** - Database
- **Firebase Storage** - File uploads
- **Firebase Analytics** - Usage tracking

**Exports:** `auth`, `db`, `storage`, `analytics`

### `/firebase/authentication.js`

Provides authentication composable `useAuth()` with:

| Function | Description |
|----------|-------------|
| `signup(email, password, displayName)` | Create new user account |
| `login(emailOrUsername, password)` | Login with email or username |
| `logout()` | Sign out current user |
| `isAuthenticated` | Reactive boolean for auth state |
| `user` | Current Firebase user object |
| `userProfile` | User's Firestore profile data |
| `error` | Error messages from auth operations |

### `/firebase/nodeConfig.js`

Node.js Firebase configuration for server-side scripts (e.g., database seeding).

### `/firebase/add_example_data.js`

Script to populate Firestore with example data for development/testing.

---

## Router Configuration

### `/src/router/index.js`

Defines application routes with authentication guards:

| Path | Component | Auth Required |
|------|-----------|---------------|
| `/` | HomeView | ✅ Yes |
| `/login` | LoginView | ❌ No |
| `/signup` | SignupView | ❌ No |
| `/create-printjob` | CreatePrintJobView | ✅ Yes |

**Navigation Guards:**
- Unauthenticated users are redirected to `/login`
- Authenticated users are redirected away from auth pages

---

## Views

### `/src/views/HomeView.vue`

Main dashboard displaying:
- Printer grid with status cards
- Print jobs table
- Statistics section
- Quick actions bar

### `/src/views/LoginView.vue`

Login page with:
- Full-screen dark background
- Centered login form
- Email/username + password authentication

### `/src/views/SignupView.vue`

Registration page with:
- Email, username, password fields
- Password requirements validation
- Automatic login after signup

### `/src/views/CreatePrintJobView.vue`

Print job creation workflow:
- Job name input
- Task cards for each file to print
- Per-task printer selection
- Print profile editing per printer
- File upload from device or existing files

---

## Components

### Layout Components

| Component | Description |
|-----------|-------------|
| `NavBar.vue` | Top navigation with logo, user menu |
| `FooterBar.vue` | Bottom footer bar |
| `ActionsBar.vue` | Quick action buttons (Start Print, Add Printer) |

### Printer Components

| Component | Description |
|-----------|-------------|
| `PrinterGrid.vue` | Grid layout for printer cards |
| `PrinterCard.vue` | Individual printer status card with webcam, temps, progress |
| `PrinterQuickView.vue` | Detailed printer view with queue |
| `PrinterFilterBar.vue` | Filter/search for printers |
| `PrinterSelectCard.vue` | Selectable printer card for job creation |
| `AddPrinter.vue` | Modal to add new printer with OctoEverywhere URL |

### Print Job Components

| Component | Description |
|-----------|-------------|
| `PrintJobsTable.vue` | Table listing all print jobs |
| `CreatePrintTask.vue` | Task card for selecting files and printers |
| `PrintProfileEditor.vue` | Tabbed editor for print settings (printer/filament/process presets) |

### Queue & Status Components

| Component | Description |
|-----------|-------------|
| `QueueSection.vue` | Printer queue display |
| `StatusBadge.vue` | Status indicator (printing, ready, error, etc.) |
| `ProgressBar.vue` | Print progress visualization |
| `StatisticsSection.vue` | Dashboard statistics |

### Form Components

| Component | Description |
|-----------|-------------|
| `loginForm.vue` | Login form with validation |
| `signupForm.vue` | Signup form with password requirements |
| `PasswordRequirements.vue` | Password strength indicator |
| `ClearButton.vue` | Reusable button component |

---

## Services

### `/src/services/printJobService.js`

Handles print job database operations:

| Function | Description |
|----------|-------------|
| `createPrintJob(jobData, userId)` | Creates job, tasks, and queue entries |
| `uploadStlFile(file, userId)` | Uploads file to Storage, creates stlFiles doc |
| `updateTaskStatus(taskId, status)` | Update task status |
| `updateJobStatus(jobId, status)` | Update job status |

**Database Operations:**
1. Creates `printJobs/{jobId}` document
2. Creates `printTasks/{taskId}` documents
3. Updates `printers/{printerId}/queue/{position}` subcollections
4. Creates `stlFiles/{fileId}` for uploaded files

### `/src/services/printerService.js`

Handles printer database operations:

| Function | Description |
|----------|-------------|
| `addPrinter(printerData, userId)` | Add new printer with presets |
| `updatePrinter(printerId, updates)` | Update printer settings |
| `deletePrinter(printerId)` | Delete printer and subcollections |
| `addPresetToPrinter(printerId, type, file)` | Add preset to subcollection |
| `removePresetFromPrinter(printerId, type, presetId)` | Remove preset |
| `sharePrinter(printerId, userId)` | Share printer with user |
| `unsharePrinter(printerId, userId)` | Remove sharing |

**Preset Subcollections:**
- `printers/{printerId}/printerPresets/{presetId}`
- `printers/{printerId}/filamentPresets/{presetId}`
- `printers/{printerId}/processPresets/{presetId}`

---

## Example Data

Located in `/src/exampleData/`:

| File | Description |
|------|-------------|
| `example_users.js` | Sample user profiles |
| `example_printers.js` | Sample printers with presets and status |
| `example_printerQueues.js` | Sample queue entries |
| `example_printJobs.js` | Sample print jobs |
| `example_printTasks.js` | Sample print tasks |
| `example_stlFiles.js` | Sample file records |
| `index.js` | Exports all example data |

---

## Database Structure

See `database_structure.md` for complete Firestore schema.

### Collections Overview

```
users/{uid}
printers/{printerId}
  └── queue/{queuePosition}
  └── printerPresets/{presetId}
  └── filamentPresets/{presetId}
  └── processPresets/{presetId}
printJobs/{jobId}
printTasks/{taskId}
stlFiles/{fileId}
```

---

## Styling

### CSS Variables (defined in App.vue)

```css
:root {
  --primary-color: #00bcd4;    /* Cyan accent */
  --bg-dark: #181818;          /* Dark background */
  --bg-darker: #1e1e1e;        /* Darker background */
  --bg-light: #2a2a2a;         /* Light background */
  --border-color: #2c2c2c;     /* Border color */
  --text-primary: #ffffff;     /* Primary text */
  --text-secondary: #ddd;      /* Secondary text */
  --transition: all 0.3s ease; /* Default transition */
}
```

### Design Principles

- Dark theme throughout
- No border-radius (sharp corners)
- Consistent spacing and padding
- Responsive grid layouts

---

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  Firebase   │────▶│  HomeView   │
│   View      │     │    Auth     │     │  (Dashboard)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Signup    │     │  Firestore  │
│   View      │────▶│  User Doc   │
└─────────────┘     └─────────────┘
```

---

## Print Job Creation Flow

```
┌─────────────────┐
│ CreatePrintJob  │
│     View        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Add Tasks      │────▶│  Select Files   │
│  (CreateTask)   │     │  (Upload/Pick)  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Select Printers │────▶│  Edit Presets   │
│ (Per Task)      │     │ (Per Printer)   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Submit Job     │
│  (printJobSvc)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│              Firestore                   │
│  • printJobs/{jobId}                    │
│  • printTasks/{taskId}                  │
│  • printers/{id}/queue/{pos}            │
│  • stlFiles/{fileId} (if uploaded)      │
└─────────────────────────────────────────┘
```

---

## Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run linters
```

### Environment Variables

Create `.env` file with:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### Seeding Database

```bash
cd firebase
node add_example_data.js
```

---

## Future Considerations

- Real-time printer status via OctoEverywhere API
- Gcode generation/slicing integration
- Thumbnail generation for uploaded files
- Print history and analytics
- Multi-user collaboration features
- Mobile-responsive design improvements
