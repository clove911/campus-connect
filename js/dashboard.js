
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const welcomeMessage = document.getElementById("welcomeMessage");
const logoutButton = document.getElementById("logoutButton");
const deleteAccountButton = document.getElementById("deleteAccountButton");
const dashboardMessage = document.getElementById("dashboardMessage");

const profileGrade = document.getElementById("profileGrade");
const profileSubjects = document.getElementById("profileSubjects");
const profileStudyStyle = document.getElementById("profileStudyStyle");

let currentUser = null;


// LOAD STUDENT PROFILE
async function loadProfile(user) {
    // Set clear temporary values
    profileGrade.textContent = "Loading...";
    profileSubjects.textContent = "Loading...";
    profileStudyStyle.textContent = "Loading...";

    try {
        const profileRef = doc(db, "profiles", user.uid);
        const snapshot = await getDoc(profileRef);

        console.log("Profile document exists:", snapshot.exists());

        if (!snapshot.exists()) {
            profileGrade.textContent = "Not added yet";
            profileSubjects.textContent = "No subjects selected";
            profileStudyStyle.textContent = "Not added yet";
            return;
        }

        const profile = snapshot.data();

        console.log("Fetched profile:", profile);

        welcomeMessage.textContent =
            `Welcome, ${profile.displayName || user.displayName || "Student"}!`;

        profileGrade.textContent =
            profile.grade ? `Class ${profile.grade}` : "Not added yet";

        profileSubjects.replaceChildren();

        if (Array.isArray(profile.subjects) && profile.subjects.length > 0) {
            profile.subjects.forEach(subject => {
                const tag = document.createElement("span");
                tag.className = "subject-tag";
                tag.textContent = subject;
                profileSubjects.appendChild(tag);
            });
        } else {
            profileSubjects.textContent = "No subjects selected";
        }

        const styles = {
            quiet: "Quiet co-study",
            discussion: "Discussion and explaining",
            "check-ins": "Independent study with check-ins"
        };

        profileStudyStyle.textContent =
            styles[profile.studyStyle] || "Not specified";

    } catch (error) {
        console.error("Profile loading error:", error);

        profileGrade.textContent = "Could not load";
        profileSubjects.textContent = "Could not load";
        profileStudyStyle.textContent = "Could not load";

        dashboardMessage.textContent =
            `Profile error: ${error.code || error.message}`;
    }
}


// AUTHENTICATION
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;

    welcomeMessage.textContent =
        `Welcome, ${user.displayName || "Student"}!`;

    await loadProfile(user);
});


// LOGOUT
logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("login.html");
    } catch (error) {
        console.error(error);
        dashboardMessage.textContent = "Logout failed.";
    }
});


// SECURE ACCOUNT DELETION
deleteAccountButton.addEventListener("click", async () => {

    if (!currentUser) {
        dashboardMessage.textContent = "Please wait for your account to load.";
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to permanently delete your account?"
    );

    if (!confirmed) return;

    const password = window.prompt(
        "Re-enter your password to confirm account deletion:"
    );

    if (password === null) return;

    if (!password) {
        dashboardMessage.textContent = "Password cannot be empty.";
        return;
    }

    deleteAccountButton.disabled = true;
    dashboardMessage.textContent = "Verifying your identity...";

    try {
        const credential = EmailAuthProvider.credential(
            currentUser.email,
            password
        );

        await reauthenticateWithCredential(
            currentUser,
            credential
        );

        dashboardMessage.textContent = "Deleting account...";

        await deleteUser(currentUser);

        window.location.replace("index.html");

    } catch (error) {
        console.error("Account deletion error:", error);

        if (error.code === "auth/wrong-password" ||
            error.code === "auth/invalid-credential") {
            dashboardMessage.textContent =
                "Incorrect password. Your account has not been deleted.";
        } else if (error.code === "auth/requires-recent-login") {
            dashboardMessage.textContent =
                "Please log in again before deleting your account.";
        } else {
            dashboardMessage.textContent =
                "Account deletion failed. Please try again.";
        }

        deleteAccountButton.disabled = false;
    }
});
