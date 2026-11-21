import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBmhwmG-qcWl3sPXG0RFLCtvlfGzdcGG94",
  authDomain: "://firebaseapp.com",
  projectId: "shine-cab",
  storageBucket: "shine-cab.firebasestorage.app",
  messagingSenderId: "807888430839",
  appId: "1:807888430839:web:6f7a54f442c37c2b8201b2",
  measurementId: "G-EBS2ZHGE7S"
};

const app = getApps().length ? getApps() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
