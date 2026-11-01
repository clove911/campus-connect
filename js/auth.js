
import { auth } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

// REGISTRATION
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const displayName = document.getElementById("displayName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        const message = document.getElementById("registerMessage");
        const button = document.getElementById("registerButton");

        if (displayName.length < 2) {
            message.textContent = "Please enter a longer display name.";
            return;
        }

        if (password !== confirmPassword) {
            message.textContent = "Your passwords do not match.";
            return;
        }

        button.disabled = true;
        button.textContent = "Creating account...";
        message.textContent = "";

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await updateProfile(userCredential.user, {
                displayName: displayName
            });

            window.location.href = "dashboard.html";

        } catch (error) {
            message.textContent = getFriendlyError(error.code);
            button.disabled = false;
            button.textContent = "Create account";
        }
    });
}


// LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("loginMessage");
        const button = document.getElementById("loginButton");

        button.disabled = true;
        button.textContent = "Logging in...";
        message.textContent = "";

        try {
            await signInWithEmailAndPassword(auth, email, password);

            window.location.href = "dashboard.html";

        } catch (error) {
            message.textContent = getFriendlyError(error.code);
            button.disabled = false;
            button.textContent = "Log in";
        }
    });
}


// PASSWORD RESET
const resetButton = document.getElementById("forgotPassword");

if (resetButton) {
    resetButton.addEventListener("click", async () => {
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("loginMessage");

        if (!email) {
            message.textContent = "Enter your email address first.";
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            message.textContent = "If the account exists, a reset email will be sent.";
        } catch (error) {
            message.textContent = getFriendlyError(error.code);
        }
    });
}


// FRIENDLIER ERROR MESSAGES
function getFriendlyError(code) {
    const errors = {
        "auth/email-already-in-use": "This email already has an account. Try logging in.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Choose a stronger password with at least 6 characters.",
        "auth/invalid-credential": "Incorrect email or password. Please try again.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
        "auth/network-request-failed": "Network error. Check your internet connection."
    };

    return errors[code] || "Something went wrong. Please try again.";
}


// PROTECT AUTH PAGES FROM ALREADY LOGGED-IN USERS
onAuthStateChanged(auth, (user) => {
    const isAuthPage = registerForm || loginForm;

    if (user && isAuthPage) {
        window.location.href = "dashboard.html";
    }
});
