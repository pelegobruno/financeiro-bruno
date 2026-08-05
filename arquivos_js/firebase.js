import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, updateDoc, doc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCrNmckgyxPHWY2F_mIACKxVnrtidqJOXA",
    authDomain: "financeiro-brunno.firebaseapp.com",
    projectId: "financeiro-brunno",
    storageBucket: "financeiro-brunno.firebasestorage.app",
    messagingSenderId: "831004577494",
    appId: "1:831004577494:web:6792d8a23c76dff0010377",
    measurementId: "G-8YVF2MRYW1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, getDoc, updateDoc, doc, increment, deleteDoc };