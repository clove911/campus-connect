
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
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// ==========================================
// DOM ELEMENTS
// ==========================================

const profileForm = document.getElementById("profileForm");
const displayNameInput = document.getElementById("displayName");
const gradeInput = document.getElementById("grade");
const studyStyleInput = document.getElementById("studyStyle");
const discoverableInput = document.getElementById("discoverable");

const saveProfileButton = document.getElementById("saveProfileButton");
const profileMessage = document.getElementById("profileMessage");

// Share-link elements
const shareLinkInput = document.getElementById("shareLink");
const copyShareLinkButton = document.getElementById("copyShareLinkButton");
const regenerateShareLinkButton = document.getElementById("regenerateShareLinkButton");
const shareMessage = document.getElementById("shareMessage");


// ==========================================
// STATE
// ==========================================

let currentUser = null;
let existingProfile = null;
let currentShareToken = null;


// ==========================================
// HELPERS
// ==========================================

function showProfileMessage(message, isError = false) {
  if (!profileMessage) return;

  profileMessage.textContent = message;
  profileMessage.style.display = "block";
  profileMessage.style.color = isError ? "#d9534f" : "";
}

function showShareMessage(message, isError = false) {
  if (!shareMessage) return;

  shareMessage.textContent = message;
  shareMessage.style.display = "block";
  shareMessage.style.color = isError ? "#d9534f" : "";
}

function getSelectedSubjects() {
  return Array.from(
    document.querySelectorAll('input[name="subjects"]:checked')
  ).map(input => input.value);
}

function generateSecureToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildShareUrl(token) {
  const profilePage = new URL(
    "profile-view.html",
    window.location.href
  );

  profilePage.searchParams.set("token", token);

  return profilePage.href;
}

function buildSharePreview(profile) {
  return {
    ownerId: currentUser.uid,
    displayName: profile.displayName,
    grade: profile.grade,
    subjects: profile.subjects,
    studyStyle: profile.studyStyle,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function displayShareLink(token) {
  currentShareToken = token;

  if (shareLinkInput) {
    shareLinkInput.value = buildShareUrl(token);
  }
}


// ==========================================
// SHARE LINK CREATION / SYNCHRONISATION
// ==========================================

async function ensureShareLink(profile) {
  const settingsRef = doc(
    db,
    "profileShareSettings",
    currentUser.uid
  );

  const settingsSnapshot = await getDoc(settingsRef);

  let token = settingsSnapshot.exists()
    ? settingsSnapshot.data().token
    : null;

  if (!token) {
    token = generateSecureToken();
  }

  const shareRef = doc(db, "profileShares", token);
  const shareSnapshot = await getDoc(shareRef);

  const batch = writeBatch(db);

  const preview = buildSharePreview(profile);

  if (shareSnapshot.exists()) {
    preview.createdAt = shareSnapshot.data().createdAt;

    batch.update(shareRef, {
      ...preview
    });
  } else {
    batch.set(shareRef, preview);
  }

  batch.set(settingsRef, {
    token,
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  displayShareLink(token);
}


// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile(user) {
  const profileRef = doc(db, "profiles", user.uid);
  const publicRef = doc(db, "publicProfiles", user.uid);

  const [profileSnapshot, publicSnapshot] = await Promise.all([
    getDoc(profileRef),
    getDoc(publicRef)
  ]);

  if (profileSnapshot.exists()) {
    existingProfile = profileSnapshot.data();

    displayNameInput.value = existingProfile.displayName || "";
    gradeInput.value = existingProfile.grade || "";
    studyStyleInput.value = existingProfile.studyStyle || "";

    const savedSubjects = existingProfile.subjects || [];

    document
      .querySelectorAll('input[name="subjects"]')
      .forEach(input => {
        input.checked = savedSubjects.includes(input.value);
      });
  }

  if (discoverableInput) {
    discoverableInput.checked = publicSnapshot.exists();
  }

  if (existingProfile) {
    try {
      await ensureShareLink(existingProfile);
    } catch (error) {
      console.error("Share link loading error:", error);
      showShareMessage(
        "Your profile loaded, but the share link couldn't be prepared.",
        true
      );
    }
  }
}


// ==========================================
// SAVE PROFILE
// ==========================================

profileForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  const displayName = displayNameInput.value.trim();
  const grade = gradeInput.value;
  const studyStyle = studyStyleInput.value;
  const subjects = getSelectedSubjects();

  if (displayName.length < 2 || displayName.length > 30) {
    showProfileMessage(
      "Your display name must be between 2 and 30 characters.",
      true
    );
    return;
  }

  if (!grade || !studyStyle || subjects.length === 0) {
    showProfileMessage(
      "Please complete all profile fields and select at least one subject.",
      true
    );
    return;
  }

  saveProfileButton.disabled = true;
  saveProfileButton.textContent = "Saving...";

  try {
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

    await setDoc(
      doc(db, "profiles", currentUser.uid),
      profileData
    );

    await updateProfile(currentUser, {
      displayName
    });

    existingProfile = {
      ...profileData,
      createdAt: existingProfile
        ? existingProfile.createdAt
        : new Date()
    };

    // Update or remove the Discover profile.
    const publicProfileRef = doc(
      db,
      "publicProfiles",
      currentUser.uid
    );

    if (discoverableInput.checked) {
      await setDoc(publicProfileRef, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
        grade,
        subjects,
        studyStyle,

        createdAt: existingProfile.createdAt,
        updatedAt: serverTimestamp()
      });
    } else {
      await deleteDoc(publicProfileRef);
    }

    // Keep the shared preview synchronised,
    // even when the profile is private.
    await ensureShareLink(existingProfile);

    showProfileMessage("Profile saved successfully! ✨");

  } catch (error) {
    console.error("Profile saving error:", error);

    showProfileMessage(
      "Couldn't save your profile. Please try again.",
      true
    );

  } finally {
    saveProfileButton.disabled = false;
    saveProfileButton.textContent = "Save Profile";
  }
});


// ==========================================
// COPY SHARE LINK
// ==========================================

if (copyShareLinkButton) {
  copyShareLinkButton.addEventListener("click", async () => {
    if (!currentShareToken) {
      showShareMessage("Your share link isn't ready yet.", true);
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildShareUrl(currentShareToken)
      );

      showShareMessage("Profile link copied! Share it with a friend. ✨");

    } catch (error) {
      console.error("Copy link error:", error);

      showShareMessage(
        "Couldn't copy automatically. You can copy the link from the box.",
        true
      );
    }
  });
}


// ==========================================
// REGENERATE SHARE LINK
// ==========================================

if (regenerateShareLinkButton) {
  regenerateShareLinkButton.addEventListener("click", async () => {
    if (!currentUser || !existingProfile) {
      showShareMessage("Save your profile first.", true);
      return;
    }

    const confirmed = window.confirm(
      "Regenerate your profile link? Your old link will stop working."
    );

    if (!confirmed) return;

    regenerateShareLinkButton.disabled = true;

    try {
      const settingsRef = doc(
        db,
        "profileShareSettings",
        currentUser.uid
      );

      const settingsSnapshot = await getDoc(settingsRef);

      const oldToken = settingsSnapshot.exists()
        ? settingsSnapshot.data().token
        : currentShareToken;

      const newToken = generateSecureToken();

      const newShareRef = doc(
        db,
        "profileShares",
        newToken
      );

      const batch = writeBatch(db);

      batch.set(
        newShareRef,
        buildSharePreview(existingProfile)
      );

      if (oldToken) {
        const oldShareRef = doc(
          db,
          "profileShares",
          oldToken
        );

        batch.delete(oldShareRef);
      }

      batch.set(settingsRef, {
        token: newToken,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      displayShareLink(newToken);

      showShareMessage(
        "New link created! Your previous link has been revoked."
      );

    } catch (error) {
      console.error("Link regeneration error:", error);

      showShareMessage(
        "Couldn't regenerate your link. Please try again.",
        true
      );

    } finally {
      regenerateShareLinkButton.disabled = false;
    }
  });
}


// ==========================================
// AUTHENTICATION
// ==========================================

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  currentUser = user;

  try {
    await loadProfile(user);
  } catch (error) {
    console.error("Profile loading error:", error);

    showProfileMessage(
      "Couldn't load your profile. Please refresh the page.",
      true
    );
  }
});
