// firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // <--- NEW: Import getFirestore

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxgZjxmrQmyXFhS_oQn53kqSmHNPdTH8M",
  authDomain: "greenovation-login.firebaseapp.com",
  projectId: "greenovation-login",
  storageBucket: "greenovation-login.appspot.com",
  messagingSenderId: "24163054415",
  appId: "1:24163054415:web:9ff8d62e16898c24f78b3a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// <--- NEW: Initialize Cloud Firestore
const db = getFirestore(app);

// Export auth, googleProvider, and now db (Firestore instance)
export { auth, googleProvider, db };
