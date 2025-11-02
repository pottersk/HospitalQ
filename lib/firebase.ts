import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  update,
  set,
  runTransaction, 
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDH5nZNwSAR7E7HTVZV1hm8tzTP9y8iCkw',
  authDomain: 'hospital-queue-cc4c7.firebaseapp.com',
  databaseURL: 'https://hospital-queue-cc4c7-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'hospital-queue-cc4c7',
  storageBucket: 'hospital-queue-cc4c7.appspot.com',
  messagingSenderId: '485234538703',
  appId: '1:485234538703:web:0fc3e4d7c6938ce31c1fba',
  measurementId: "G-05P87WD05X"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export { ref, onValue, update, set, runTransaction }; 
