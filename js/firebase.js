
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// Replace these values with your Firebase web app configuration.

const firebaseConfig = {
    apiKey: "AIzaSyDn0TpZLfjXM63mxP_4cURgqj8bA8A0OCI",
    authDomain: "campus-connect-de6b5.firebaseapp.com",
    projectId: "campus-connect-de6b5",
    storageBucket: "campus-connect-de6b5.firebasestorage.app",
    messagingSenderId: "74972117863",
    appId: "1:74972117863:web:81b3109f5633bd12f04dc2"
};

// Initialize Firebase

const app = initializeApp(firebaseConfig);

// Initialize Authentication

const auth = getAuth(app);

// Initialize Firestore

const db = getFirestore(app);

// Export Firebase services

export { app, auth, db };
