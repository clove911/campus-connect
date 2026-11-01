
import { auth } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");
const dashboardMessage = document.getElementById("dashboardMessage");

onAuthStateChanged(auth, (user) => {
    if (user) {
        welcomeMessage.textContent = `Welcome, ${user.displayName || "Student"}!`;
    } else {
        window.location.href = "login.html";
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        dashboardMessage.textContent = "Could not log out. Please try again.";
    }
});
