import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDMzWyeYQtc_4fgiSzNMw4eR1Npa8wPPWc",
  authDomain: "studio-8550736767-b9073.firebaseapp.com",
  projectId: "studio-8550736767-b9073",
  storageBucket: "studio-8550736767-b9073.appspot.com",
  messagingSenderId: "199053972563",
  appId: "1:199053972563:web:274f93a9bb770edb5722a6",
  databaseURL: "https://studio-8550736767-b9073-default-rtdb.firebaseio.com",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

export { db, auth, storage, rtdb };
