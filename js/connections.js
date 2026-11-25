
import { auth, db } from "./firebase.js";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const receivedTab = document.getElementById("receivedTab");
const sentTab = document.getElementById("sentTab");
const connectedTab = document.getElementById("connectedTab");

const receivedContainer = document.getElementById("receivedContainer");
const sentContainer = document.getElementById("sentContainer");
const connectedContainer = document.getElementById("connectedContainer");

const receivedCount = document.getElementById("receivedCount");
const connectedCount = document.getElementById("connectedCount");

let currentUser = null;
let activeTab = "received";

// ---------- PROFILE HELPERS ----------

async function getPublicProfile(userId) {
  const snap = await getDoc(doc(db, "publicProfiles", userId));

  if (snap.exists()) {
    return snap.data();
  }

  return null;
}

function previewToProfile(preview) {
  if (!preview) return null;

  return {
    displayName: preview.displayName || "Student",
    grade: preview.grade || "",
    subjects: preview.subjects || [],
    studyStyle: preview.studyStyle || ""
  };
}

async function getRequestPreview(requestData, userId) {
  // Prefer the limited preview saved with the request.
  if (requestData.senderPreview && requestData.senderId === userId) {
    return previewToProfile(requestData.senderPreview);
  }

  // Otherwise, try the public profile.
  const publicProfile = await getPublicProfile(userId);

  if (publicProfile) {
    return previewToProfile(publicProfile);
  }

  // If the request contains a share token, try its limited preview.
  if (requestData.shareToken) {
    const shareSnap = await getDoc(
      doc(db, "profileShares", requestData.shareToken)
    );

    if (shareSnap.exists()) {
      const shareData = shareSnap.data();

      if (shareData.ownerId === userId) {
        return previewToProfile(shareData);
      }
    }
  }

  return null;
}

// ---------- UI HELPERS ----------

function createCard(profile, statusText = "") {
  const card = document.createElement("div");
  card.className = "connection-card";

  const name = document.createElement("h3");
  name.textContent = profile.displayName || "Student";

  const grade = document.createElement("p");
  grade.textContent = profile.grade ? `Grade ${profile.grade}` : "";

  const subjects = document.createElement("p");
  subjects.textContent =
    Array.isArray(profile.subjects)
      ? profile.subjects.join(", ")
      : "";

  const style = document.createElement("p");
  style.textContent = profile.studyStyle || "";

  const status = document.createElement("p");
  status.className = "connection-status";
  status.textContent = statusText;

  card.append(name, grade, subjects, style, status);

  return card;
}

function createButton(text, callback, className = "") {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = className;

  button.addEventListener("click", callback);

  return button;
}

function showMessage(container, message) {
  container.replaceChildren();

  const p = document.createElement("p");
  p.textContent = message;

  container.appendChild(p);
}

function setTab(tab) {
  activeTab = tab;

  receivedContainer.style.display =
    tab === "received" ? "block" : "none";

  sentContainer.style.display =
    tab === "sent" ? "block" : "none";

  connectedContainer.style.display =
    tab === "connected" ? "block" : "none";

  receivedTab.classList.toggle("active", tab === "received");
  sentTab.classList.toggle("active", tab === "sent");
  connectedTab.classList.toggle("active", tab === "connected");

  loadCurrentTab();
}

// ---------- RECEIVED REQUESTS ----------

async function loadReceived() {
  showMessage(receivedContainer, "Loading requests...");

  const q = query(
    collection(db, "connectionRequests"),
    where("receiverId", "==", currentUser.uid),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(q);

  receivedCount.textContent = snapshot.size;

  receivedContainer.replaceChildren();

  if (snapshot.empty) {
    showMessage(receivedContainer, "No pending requests yet.");
    return;
  }

  for (const requestDoc of snapshot.docs) {
    const requestData = requestDoc.data();

    const profile = await getRequestPreview(
      requestData,
      requestData.senderId
    );

    const card = createCard(
      profile || { displayName: "Unavailable profile" },
      "Wants to connect with you"
    );

    if (profile) {
      const acceptButton = createButton("Accept", async () => {
        await respondToRequest(requestDoc.id, "accepted");
      });

      const declineButton = createButton("Decline", async () => {
        await respondToRequest(requestDoc.id, "declined");
      });

      card.append(acceptButton, declineButton);
    }

    receivedContainer.appendChild(card);
  }
}

// ---------- SENT REQUESTS ----------

async function loadSent() {
  showMessage(sentContainer, "Loading sent requests...");

  const q = query(
    collection(db, "connectionRequests"),
    where("senderId", "==", currentUser.uid),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(q);

  sentContainer.replaceChildren();

  if (snapshot.empty) {
    showMessage(sentContainer, "You haven't sent any pending requests.");
    return;
  }

  for (const requestDoc of snapshot.docs) {
    const requestData = requestDoc.data();

    const profile = await getRequestPreview(
      requestData,
      requestData.receiverId
    );

    const card = createCard(
      profile || { displayName: "Unavailable profile" },
      "Request pending"
    );

    sentContainer.appendChild(card);
  }
}

// ---------- ACCEPT / DECLINE ----------

async function respondToRequest(requestId, response) {
  try {
    const requestRef = doc(db, "connectionRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      alert("This request no longer exists.");
      return;
    }

    const requestData = requestSnap.data();

    if (requestData.receiverId !== currentUser.uid) {
      alert("You cannot respond to this request.");
      return;
    }

    if (requestData.status !== "pending") {
      alert("This request has already been handled.");
      return;
    }

    const batch = writeBatch(db);

    batch.update(requestRef, {
      status: response
    });

    if (response === "accepted") {
      const senderId = requestData.senderId;
      const receiverId = requestData.receiverId;

      const sortedIds = [senderId, receiverId].sort();
      const connectionId = sortedIds.join("_");

      const connectionRef = doc(db, "connections", connectionId);

      batch.set(connectionRef, {
        userIds: sortedIds,
        requestId: requestId,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();

    alert(
      response === "accepted"
        ? "Connection accepted!"
        : "Request declined."
    );

    await loadCurrentTab();
  } catch (error) {
    console.error(error);
    alert("Something went wrong. Check the console.");
  }
}

// ---------- CONNECTED USERS ----------

async function loadConnected() {
  showMessage(connectedContainer, "Loading connections...");

  const q = query(
    collection(db, "connections"),
    where("userIds", "array-contains", currentUser.uid)
  );

  const snapshot = await getDocs(q);

  connectedCount.textContent = snapshot.size;

  connectedContainer.replaceChildren();

  if (snapshot.empty) {
    showMessage(connectedContainer, "No connections yet.");
    return;
  }

  for (const connectionDoc of snapshot.docs) {
    const connectionData = connectionDoc.data();

    const otherUserId = connectionData.userIds.find(
      id => id !== currentUser.uid
    );

    if (!otherUserId) continue;

    let profile = await getPublicProfile(otherUserId);

    // Fallback to the original request's preview when possible.
    if (!profile && connectionData.requestId) {
      const requestSnap = await getDoc(
        doc(db, "connectionRequests", connectionData.requestId)
      );

      if (requestSnap.exists()) {
        const requestData = requestSnap.data();

        profile = await getRequestPreview(
          requestData,
          otherUserId
        );
      }
    }

    const card = createCard(
      profile || { displayName: "Connected student" },
      "Connected"
    );

    const messageButton = createButton("Message", () => {
      const conversationId = connectionDoc.id;

      window.location.href =
        `messages.html?conversationId=${encodeURIComponent(conversationId)}`;
    });

    card.appendChild(messageButton);

    connectedContainer.appendChild(card);
  }
}

// ---------- TAB ROUTER ----------

async function loadCurrentTab() {
  if (!currentUser) return;

  try {
    if (activeTab === "received") {
      await loadReceived();
    } else if (activeTab === "sent") {
      await loadSent();
    } else if (activeTab === "connected") {
      await loadConnected();
    }
  } catch (error) {
    console.error(error);

    const container =
      activeTab === "received"
        ? receivedContainer
        : activeTab === "sent"
        ? sentContainer
        : connectedContainer;

    showMessage(container, "Unable to load this section.");
  }
}

// ---------- TAB EVENTS ----------

receivedTab.addEventListener("click", () => setTab("received"));
sentTab.addEventListener("click", () => setTab("sent"));
connectedTab.addEventListener("click", () => setTab("connected"));

// ---------- AUTH ----------

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  setTab("received");
});
