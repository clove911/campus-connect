
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const profileForm = document.getElementById("profileForm");
const displayNameInput = document.getElementById("displayName");
const gradeInput = document.getElementById("grade");
const studyStyleInput = document.getElementById("studyStyle");
const saveButton = document.getElementById("saveProfileButton");
const message = document.getElementById("profileMessage");

let currentUser = null;
let existingProfile = null;


// LOAD THE SIGNED-IN USER'S PROFILE
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;

    try {
        const profileRef = doc(db, "profiles", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (profileSnapshot.exists()) {
            existingProfile = profileSnapshot.data();

            displayNameInput.value = existingProfile.displayName;
            gradeInput.value = existingProfile.grade;
            studyStyleInput.value = existingProfile.studyStyle;

            const savedSubjects = existingProfile.subjects || [];

            document.querySelectorAll(
                'input[name="subjects"]'
            ).forEach((checkbox) => {
                checkbox.checked = savedSubjects.includes(checkbox.value);
            });

            saveButton.textContent = "Update profile";

        } else {
            displayNameInput.value = user.displayName || "";
        }

    } catch (error) {
        console.error("Profile loading error:", error);
        message.textContent = "Could not load your profile. Please refresh.";
    }
});


// SAVE OR UPDATE PROFILE
profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
        message.textContent = "Please log in first.";
        return;
    }

    const displayName = displayNameInput.value.trim();
    const grade = gradeInput.value;
    const studyStyle = studyStyleInput.value;

    const subjects = Array.from(
        document.querySelectorAll('input[name="subjects"]:checked')
    ).map((checkbox) => checkbox.value);

    if (displayName.length < 2) {
        message.textContent = "Your display name must have at least 2 characters.";
        return;
    }

    if (subjects.length === 0) {
        message.textContent = "Please select at least one subject.";
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    message.textContent = "";

    try {
        const profileRef = doc(db, "profiles", currentUser.uid);

        const profileData = {
            displayName,
            grade,
            subjects,
            studyStyle,
            createdAt: existingProfile
                ? existingProfile.createdAt
                : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(profileRef, profileData);

        await updateProfile(currentUser, {
            displayName
        });

        existingProfile = {
            ...profileData,
            createdAt: existingProfile
                ? existingProfile.createdAt
                : null
        };

        message.textContent = "Profile saved successfully! ✨";
        saveButton.textContent = "Update profile";

    } catch (error) {
        console.error("Profile saving error:", error);
        message.textContent = "Could not save your profile. Please try again.";
        saveButton.textContent = "Save profile";

    } finally {
        saveButton.disabled = false;
    }
});
