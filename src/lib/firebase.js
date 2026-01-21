import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ЗАМЕНИ НА СВОИ ДАННЫЕ, КОГДА БУДУТ
const firebaseConfig = {
  apiKey: "AIzaSyBZMXeZ4RmrIRSozmzOxavQCFNQwFr3-9o",
  authDomain: "reestr-mkd.firebaseapp.com",
  projectId: "reestr-mkd",
  storageBucket: "reestr-mkd.firebasestorage.app",
  messagingSenderId: "208582574141",
  appId: "1:208582574141:web:f4a4b3551d3080ca73aa54"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 👇 ИСПРАВЛЕНО ЗДЕСЬ (APP_ID большими буквами):
export const APP_ID = 'my-registry-v1';