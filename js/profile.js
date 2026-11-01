
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const profileForm = document.getElementById("profileForm");
const displayNameInput = document.getElementById("displayName");
const gradeInput = document.getElementById("grade");
const studyStyleInput = document.getElementById("studyStyle");
const discoverableInput = document.getElementById("discoverable");
const saveButton = document.getElementById("saveProfileButton");
const message = document.getElementById("profileMessage");

let currentUser = null;
let existingProfile = null;
let existingPublicProfile = null;


// LOAD PROFILE
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;

    try {
        const profileRef = doc(db, "profiles", user.uid);
        const publicProfileRef = doc(db, "publicProfiles", user.uid);

        const [profileSnapshot, publicSnapshot] = await Promise.all([
            getDoc(profileRef),
            getDoc(publicProfileRef)
        ]);

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

        if (publicSnapshot.exists()) {
            existingPublicProfile = publicSnapshot.data();
            discoverableInput.checked = true;
        } else {
            discoverableInput.checked = false;
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
    const isDiscoverable = discoverableInput.checked;

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

    if (!grade || !studyStyle) {
        message.textContent = "Please complete all profile fields.";
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    message.textContent = "";

    try {
        const profileRef = doc(db, "profiles", currentUser.uid);
        const publicProfileRef = doc(db, "publicProfiles", currentUser.uid);

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

        // Save the private profile
        await setDoc(profileRef, profileData);

        // Update Firebase Authentication display name
        await updateProfile(currentUser, { displayName });

        // Publish or remove the discovery profile
        if (isDiscoverable) {
            const publicProfileData = {
    displayName,
    displayNameLower: displayName.trim().toLowerCase(),
    grade,
    subjects,
    studyStyle,
    createdAt: existingPublicProfile
        ? existingPublicProfile.createdAt
        : serverTimestamp(),
    updatedAt: serverTimestamp()
};

            await setDoc(publicProfileRef, publicProfileData);

            existingPublicProfile = publicProfileData;
        } else {
            await deleteDoc(publicProfileRef);
            existingPublicProfile = null;
        }

        // Reload saved data, including the server timestamps
        const savedSnapshot = await getDoc(profileRef);
        existingProfile = savedSnapshot.data();

        message.textContent = isDiscoverable
            ? "Profile saved! You're now discoverable. ✨"
            : "Profile saved! You're hidden from discovery. ✨";

        saveButton.textContent = "Update profile";

    } catch (error) {
        console.error("Profile saving error:", error);
        message.textContent =
            "Could not save your profile. Please check your connection and try again.";
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Update profile";
    }
});
