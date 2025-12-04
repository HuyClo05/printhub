import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import dotenv from 'dotenv'

// Load .env file from project root
dotenv.config({ path: '../.env' })

const firebaseConfig = {
  // eslint-disable-next-line no-undef
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  // eslint-disable-next-line no-undef
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  // eslint-disable-next-line no-undef
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  // eslint-disable-next-line no-undef
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  // eslint-disable-next-line no-undef
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  // eslint-disable-next-line no-undef
  appId: process.env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

export { app, db, auth }
