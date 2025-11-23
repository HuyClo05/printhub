// Import the functions you need from the SDKs you need
import {getFirestore} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDgpcuYUEDRNNcb1bbvX4n3AkSZFAXd--Q",
  authDomain: "printhub-59cc7.firebaseapp.com",
  projectId: "printhub-59cc7",
  storageBucket: "printhub-59cc7.firebasestorage.app",
  messagingSenderId: "39900016572",
  appId: "1:39900016572:web:a84a9a67b3156963b345b9",
  measurementId: "G-FLP0NRW3SX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore()
export default db
