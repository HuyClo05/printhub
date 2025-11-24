import { ref, computed } from 'vue'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
      // Check if username already exists
      if (displayName) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('userName', '==', displayName))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          error.value = 'This username is already taken. Please choose another one.'
          throw new Error(error.value)
        }
      }

      // Create authentication user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user

      // Create Firestore user document
      const userData = {
        uid: userCredential.user.uid,
        email: email,
        userName: displayName,
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
      // Convert Firebase error codes to readable messages
      if (err.code === 'auth/email-already-in-use') {
        error.value = 'This email is already registered. Please login or use a different email.'
      } else if (err.code === 'auth/invalid-email') {
        error.value = 'Please enter a valid email address.'
      } else if (!error.value) {
        error.value = err.message
      }
      throw err
    }
  }

  const login = async (emailOrUsername, password) => {
    error.value = null
    try {
      let email = emailOrUsername

      // Check if input is a username (no @ symbol)
      if (!emailOrUsername.includes('@')) {
        // Query Firestore to find email by username
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('userName', '==', emailOrUsername))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          error.value = 'Username not found. Please check your username or sign up.'
          throw new Error(error.value)
        }

        // Get the email from the user document
        email = querySnapshot.docs[0].data().email
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user

      // Load user profile
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid))
      if (userDoc.exists()) {
        userProfile.value = userDoc.data()
      }

      return user.value
    } catch (err) {
      // Convert Firebase error codes to readable messages
      if (err.code === 'auth/invalid-credential') {
        error.value = 'Invalid email/username or password. Please try again.'
      } else if (err.code === 'auth/user-not-found') {
        error.value = 'No account found with this email. Please sign up first.'
      } else if (err.code === 'auth/wrong-password') {
        error.value = 'Incorrect password. Please try again.'
      } else if (err.code === 'auth/invalid-email') {
        error.value = 'Please enter a valid email address.'
      } else if (err.code === 'auth/too-many-requests') {
        error.value = 'Too many failed login attempts. Please try again later.'
      } else if (!error.value) {
        error.value = err.message
      }
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
