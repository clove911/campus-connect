
import { auth } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut,
    deleteUser
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");
const deleteAccountButton = document.getElementById("deleteAccountButton");
const dashboardMessage = document.getElementById("dashboardMessage");

let currentUser = null;
let authReady = false;


// CHECK AUTHENTICATION
onAuthStateChanged(auth, (user) => {
    authReady = true;
    currentUser = user;

    if (!user) {
        window.location.replace("login.html");
        return;
    }

    welcomeMessage.textContent =
        `Welcome, ${user.displayName || "Student"}!`;
});


// LOG OUT
logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("login.html");
    } catch (error) {
        console.error("Logout error:", error);
        dashboardMessage.textContent =
            "Could not log out. Please try again.";
    }
});


// DELETE ACCOUNT
deleteAccountButton.addEventListener("click", async () => {

    if (!authReady || !currentUser) {
        dashboardMessage.textContent =
            "Please wait for your account to load.";
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to permanently delete your account? This cannot be undone."
    );

    if (!confirmed) return;

    deleteAccountButton.disabled = true;
    dashboardMessage.textContent = "Deleting your account...";

    try {
        await deleteUser(currentUser);

        window.location.replace("index.html");

    } catch (error) {
        console.error("Account deletion error:", error);

        if (error.code === "auth/requires-recent-login") {
            dashboardMessage.textContent =
                "Please log out, log back in, and try deleting your account again.";
        } else {
            dashboardMessage.textContent =
                "Account deletion failed. Please try again.";
        }

        deleteAccountButton.disabled = false;
    }
});
