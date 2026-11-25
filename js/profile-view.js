
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// ==========================================
// ELEMENTS
// ==========================================

const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileGrade = document.getElementById("profileGrade");
const profileSubjects = document.getElementById("profileSubjects");
const profileStudyStyle = document.getElementById("profileStudyStyle");

const sendRequestButton = document.getElementById("sendRequestButton");
const requestMessage = document.getElementById("requestMessage");

const profileViewContent = document.getElementById("profileViewContent");
const profileError = document.getElementById("profileError");
const profileErrorMessage = document.getElementById("profileErrorMessage");


// ==========================================
// STATE
// ==========================================

let currentUser = null;
let targetUserId = null;
let shareToken = null;


// ==========================================
// HELPERS
// ==========================================

function showRequestMessage(message) {
  requestMessage.textContent = message;
}

function showProfileError(message) {
  profileViewContent.style.display = "none";
  profileError.style.display = "block";
  profileErrorMessage.textContent = message;
}

function getConnectionId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function renderSubjects(subjects) {
  profileSubjects.replaceChildren();

  if (!Array.isArray(subjects) || subjects.length === 0) {
    const tag = document.createElement("span");
    tag.textContent = "No subjects listed";
    profileSubjects.appendChild(tag);
    return;
  }

  subjects.forEach(subject => {
    const tag = document.createElement("span");
    tag.className = "subject-tag";
    tag.textContent = subject;
    profileSubjects.appendChild(tag);
  });
}

function formatStudyStyle(style) {
  const styles = {
    quiet: "Quiet study",
    discussion: "Discussion-based study",
    "check-ins": "Study with check-ins"
  };

  return styles[style] || "Not specified";
}


// ==========================================
// LOAD SHARE PROFILE
// ==========================================

async function loadShareProfile() {
  if (!shareToken) {
    showProfileError("This profile link is invalid.");
    return;
  }

  const shareRef = doc(db, "profileShares", shareToken);
  const shareSnapshot = await getDoc(shareRef);

  if (!shareSnapshot.exists()) {
    showProfileError(
      "This profile link has expired or been revoked."
    );
    return;
  }

  const profile = shareSnapshot.data();

  targetUserId = profile.ownerId;

  if (!targetUserId || targetUserId === currentUser.uid) {
    showProfileError(
      "You cannot send a connection request to this profile."
    );
    return;
  }

  profileAvatar.textContent =
    profile.displayName?.charAt(0).toUpperCase() || "?";

  profileName.textContent = profile.displayName || "Student";
  profileGrade.textContent = profile.grade
    ? `Class ${profile.grade}`
    : "Student";

  renderSubjects(profile.subjects);

  profileStudyStyle.textContent =
    formatStudyStyle(profile.studyStyle);

  await checkConnectionStatus();
}


// ==========================================
// CHECK EXISTING REQUEST / CONNECTION
// ==========================================

async function checkConnectionStatus() {
  sendRequestButton.disabled = true;
  sendRequestButton.textContent = "Checking...";

  try {
    const connectionQuery = query(
      collection(db, "connections"),
      where("userIds", "array-contains", currentUser.uid)
    );

    const connectionSnapshot = await getDocs(connectionQuery);

    const alreadyConnected = connectionSnapshot.docs.some(
      connection => connection.data().userIds.includes(targetUserId)
    );

    if (alreadyConnected) {
      sendRequestButton.textContent = "Already Connected";
      showRequestMessage(
        "You're already connected. Visit your Connections page."
      );
      return;
    }

    const outgoingQuery = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", currentUser.uid)
    );

    const outgoingSnapshot = await getDocs(outgoingQuery);

    const existingRequest = outgoingSnapshot.docs.find(
      request => request.data().receiverId === targetUserId
    );

    if (existingRequest) {
      const status = existingRequest.data().status;

      if (status === "pending") {
        sendRequestButton.textContent = "Request Sent";
        showRequestMessage(
          "You've already sent a connection request."
        );
        return;
      }

      if (status === "accepted") {
        sendRequestButton.textContent = "Already Connected";
        showRequestMessage(
          "This connection has already been accepted."
        );
        return;
      }

      if (status === "declined") {
        sendRequestButton.textContent = "Request Previously Declined";
        showRequestMessage(
          "This request was previously declined."
        );
        return;
      }
    }

    sendRequestButton.disabled = false;
    sendRequestButton.textContent = "Send Connection Request";

  } catch (error) {
    console.error("Connection status error:", error);

    sendRequestButton.disabled = true;
    sendRequestButton.textContent = "Unable to check status";

    showRequestMessage(
      "Couldn't check your connection status."
    );
  }
}


// ==========================================
// SEND REQUEST
// ==========================================

sendRequestButton.addEventListener("click", async () => {
  if (!currentUser || !targetUserId || !shareToken) return;

  if (currentUser.uid === targetUserId) {
    showRequestMessage("You cannot connect with yourself.");
    return;
  }

  sendRequestButton.disabled = true;
  sendRequestButton.textContent = "Sending...";

  try {
    const requestId = `${currentUser.uid}_${targetUserId}`;

    const requestRef = doc(
      db,
      "connectionRequests",
      requestId
    );

    await setDoc(requestRef, {
      senderId: currentUser.uid,
      receiverId: targetUserId,
      status: "pending",
      createdAt: serverTimestamp(),
      shareToken
    });

    sendRequestButton.textContent = "Request Sent";

    showRequestMessage(
      "Request sent successfully! ✨"
    );

  } catch (error) {
    console.error("Connection request error:", error);

    sendRequestButton.disabled = false;
    sendRequestButton.textContent = "Send Connection Request";

    showRequestMessage(
      "Couldn't send the request. Please try again."
    );
  }
});


// ==========================================
// AUTHENTICATION
// ==========================================

const params = new URLSearchParams(window.location.search);

shareToken = params.get("token");

onAuthStateChanged(auth, async user => {
  if (!user) {
    const returnUrl = window.location.href;

    window.location.replace(
      "login.html?redirect=" + encodeURIComponent(returnUrl)
    );

    return;
  }

  currentUser = user;

  try {
    await loadShareProfile();
  } catch (error) {
    console.error("Share profile loading error:", error);

    showProfileError(
      "Couldn't load this profile. Please try again."
    );
  }
});
