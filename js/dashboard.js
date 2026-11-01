
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        welcomeMessage.textContent =
            `Welcome, ${user.displayName || "Student"}!`;
    } else {
        window.location.href = "login.html";
    }
});


// LOG OUT
logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        dashboardMessage.textContent =
            "Could not log out. Please try again.";
    }
});


// DELETE ACCOUNT
deleteAccountButton.addEventListener("click", async () => {
    const user = auth.currentUser;

    if (!user) {
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to permanently delete your Campus Connect account? This action cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    deleteAccountButton.disabled = true;
    dashboardMessage.textContent = "Deleting your account...";

    try {
        await deleteUser(user);

        window.location.href = "index.html";

    } catch (error) {
        console.error("Account deletion error:", error);

        if (error.code === "auth/requires-recent-login") {
            dashboardMessage.textContent =
                "For security, please log out, log back in, and try deleting your account again.";
        } else {
            dashboardMessage.textContent =
                "Account deletion failed. Please try again.";
        }

        deleteAccountButton.disabled = false;
    }
});
