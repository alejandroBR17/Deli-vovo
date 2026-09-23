import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCQeb5OBSGqhow90KWkDxaqGGfm7Ih-3bI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "deliciasdavovo-3f61c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "deliciasdavovo-3f61c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "deliciasdavovo-3f61c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "388065422234",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:388065422234:web:e7a678f480dbf3e3382823"
};

// Initialize Firebase only if config is present
let app;
let auth: any = null;
let googleProvider: any = null;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile
};
