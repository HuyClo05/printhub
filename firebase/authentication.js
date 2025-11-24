import { ref, computed } from 'vue'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from './init'

const user = ref(null)
const error = ref(null)
const userProfile = ref(null)

// Listen for auth state changes
onAuthStateChanged(auth, async (firebaseUser) => {
  user.value = firebaseUser

  // Load user profile from Firestore when authenticated
  if (firebaseUser) {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
    if (userDoc.exists()) {
      userProfile.value = userDoc.data()
    }
  } else {
    userProfile.value = null
  }
})

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value)

  const signup = async (email, password, displayName = '') => {
    error.value = null
    try {
      // Create authentication user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user

      // Create Firestore user document
      const userData = {
        uid: userCredential.user.uid,
        email: email,
        displayName: displayName,
        createdAt: new Date().toISOString(),
        savedModels: [],
        printHistory: [],
        printers: [],
        preferences: {
          theme: 'light',
          emailNotifications: true
        }
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), userData)
      userProfile.value = userData

      return user.value
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const login = async (email, password) => {
    error.value = null
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user

      // Load user profile
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid))
      if (userDoc.exists()) {
        userProfile.value = userDoc.data()
      }

      return user.value
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const logout = async () => {
    error.value = null
    try {
      await signOut(auth)
      user.value = null
      userProfile.value = null
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  return {
    user,
    userProfile,
    error,
    isAuthenticated,
    signup,
    login,
    logout
  }
}
