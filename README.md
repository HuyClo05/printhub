# PrintHub

A web-based 3D printing platform that integrates open-source slicers with remote printer management.

## Features

- **User Authentication** - Secure signup and login with Firebase Authentication
- **Username or Email Login** - Flexible login options for user convenience
- **Password Security** - Strong password requirements with real-time validation
- **Dark Theme UI** - Modern, eye-friendly interface

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Python 3.13+ (for backend)
- Firebase project with Authentication and Firestore enabled

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/HuyClo05/printhub.git
cd printhub
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Firebase

Create a `.env` file in the root directory with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id_here
```

You can get these values from your Firebase Console:

1. Go to Project Settings
2. Scroll down to "Your apps"
3. Select your web app or create a new one
4. Copy the configuration values

### 5. Run the Development Server

**Frontend:**

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

**Backend (optional, for future features):**

```bash
python run.py
```

## Project Structure

```
printhub/
├── src/
│   ├── components/     # Vue components
│   ├── views/          # Page views
│   ├── router/         # Vue Router configuration
│   └── assets/         # Static assets
├── firebase/           # Firebase configuration
├── server/             # Python backend (Flask)
├── public/             # Public static files
└── .env                # Environment variables (create this)
```

## Security Notes

- Never commit `.env` files to version control
- Firebase client-side API keys are safe to expose (protected by Security Rules)
- Ensure Firebase Security Rules are properly configured in your Firebase Console

## Future Features

- STL file upload with drag-and-drop
- OrcaSlicer API integration
- OctoEverywhere printer connectivity
- Real-time print monitoring
- Printer management dashboard

## License

Private repository - all rights reserved.

## Contact

For questions or issues, contact the repository owner.
