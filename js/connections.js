import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const connectionList = document.getElementById("connectionList");
const connectionMessage = document.getElementById("connectionMessage");
const receivedCount = document.getElementById("receivedCount");
const connectedCount = document.getElementById("connectedCount");
const tabs = document.querySelectorAll(".connection-tab");

let currentUser = null;
let activeTab = "received";

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;
    loadConnections();
});

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(item => item.classList.remove("active"));

        tab.classList.add("active");
        activeTab = tab.dataset.tab;

        loadConnections();
    });
});

function showMessage(message) {
    connectionMessage.textContent = message;
    connectionMessage.style.display = "block";
}

function hideMessage() {
    connectionMessage.style.display = "none";
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

function getConnectionId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

async function getPublicProfile(userId) {
    const profileSnapshot = await getDoc(
        doc(db, "publicProfiles", userId)
    );

    if (!profileSnapshot.exists()) {
        return null;
    }

    return profileSnapshot.data();
}

function createStudentCard(profile, userId, details, actions) {
    const card = createElement("article", "connection-card", "");

    const person = createElement("div", "connection-person", "");

    const avatar = createElement(
        "div",
        "connection-avatar",
        profile.displayName?.charAt(0).toUpperCase() || "?"
    );

    const info = createElement("div", "", "");

    const name = createElement(
        "h3",
        "",
        profile.displayName || "Campus student"
    );

    const grade = createElement(
        "p",
        "",
        profile.grade ? `Class ${profile.grade}` : "Student"
    );

    info.append(name, grade);
    person.append(avatar, info);

    const description = createElement(
        "p",
        "connection-details",
        details || `Subjects: ${(profile.subjects || []).join(", ")}`
    );

    card.append(person, description);

    if (actions) {
        card.append(actions);
    }

    return card;
}

async function loadConnections() {
    if (!currentUser) return;

    connectionList.replaceChildren();
    showMessage("Loading...");

    try {
        if (activeTab === "received") {
            await loadReceivedRequests();
        } else if (activeTab === "sent") {
            await loadSentRequests();
        } else {
            await loadAcceptedConnections();
        }
    } catch (error) {
        console.error("Connections loading error:", error);
        showMessage("Couldn't load this section. Please try again.");
    }
}

async function loadReceivedRequests() {
    const requestsQuery = query(
        collection(db, "connectionRequests"),
        where("receiverId", "==", currentUser.uid),
        where("status", "==", "pending")
    );

    const snapshot = await getDocs(requestsQuery);

    receivedCount.textContent = snapshot.size;

    if (snapshot.empty) {
        showMessage("No incoming requests yet. Your campus circle is waiting!");
        return;
    }

    hideMessage();

    for (const requestDoc of snapshot.docs) {
        const request = requestDoc.data();
        const profile = await getPublicProfile(request.senderId);

        if (!profile) continue;

        const actions = createElement("div", "connection-actions", "");

        const acceptButton = createElement(
            "button",
            "connection-action accept-button",
            "Accept"
        );

        const declineButton = createElement(
            "button",
            "connection-action decline-button",
            "Decline"
        );

        acceptButton.addEventListener("click", () =>
            respondToRequest(requestDoc.id, request, "accepted", acceptButton, declineButton)
        );

        declineButton.addEventListener("click", () =>
            respondToRequest(requestDoc.id, request, "declined", acceptButton, declineButton)
        );

        actions.append(acceptButton, declineButton);

        connectionList.appendChild(
            createStudentCard(profile, request.senderId, null, actions)
        );
    }
}

async function loadSentRequests() {
    const requestsQuery = query(
        collection(db, "connectionRequests"),
        where("senderId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(requestsQuery);

    if (snapshot.empty) {
        showMessage("You haven't sent any connection requests yet.");
        return;
    }

    const requests = snapshot.docs.filter(
        item => item.data().status === "pending"
    );

    if (requests.length === 0) {
        showMessage("No pending sent requests.");
        return;
    }

    hideMessage();

    for (const requestDoc of requests) {
        const request = requestDoc.data();
        const profile = await getPublicProfile(request.receiverId);

        if (!profile) continue;

        const status = createElement(
            "span",
            "status-label",
            "Request sent"
        );

        connectionList.appendChild(
            createStudentCard(profile, request.receiverId, null, status)
        );
    }
}

async function loadAcceptedConnections() {
    const connectionsQuery = query(
        collection(db, "connections"),
        where("userIds", "array-contains", currentUser.uid)
    );

    const snapshot = await getDocs(connectionsQuery);

    connectedCount.textContent = snapshot.size;

    if (snapshot.empty) {
        showMessage("Your connections will appear here after requests are accepted.");
        return;
    }

    hideMessage();

    for (const connectionDoc of snapshot.docs) {
        const connection = connectionDoc.data();

        const otherUserId = connection.userIds.find(
            uid => uid !== currentUser.uid
        );

        if (!otherUserId) continue;

        const profile = await getPublicProfile(otherUserId);

        if (!profile) continue;

        const status = createElement(
            "span",
            "status-label",
            "✓ Connected"
        );

        connectionList.appendChild(
            createStudentCard(profile, otherUserId, null, status)
        );
    }
}

async function respondToRequest(
    requestId,
    request,
    newStatus,
    acceptButton,
    declineButton
) {
    acceptButton.disabled = true;
    declineButton.disabled = true;

    try {
        const batch = writeBatch(db);

        const requestRef = doc(db, "connectionRequests", requestId);

        batch.update(requestRef, {
            status: newStatus
        });

        if (newStatus === "accepted") {
            const connectionId = getConnectionId(
                request.senderId,
                request.receiverId
            );

            const connectionRef = doc(
                db,
                "connections",
                connectionId
            );

            batch.set(connectionRef, {
                userIds: [
                    request.senderId,
                    request.receiverId
                ].sort(),
                requestId: requestId,
                createdAt: request.createdAt
            });
        }

        await batch.commit();

        showMessage(
            newStatus === "accepted"
                ? "Connection accepted!"
                : "Request declined."
        );

        await loadConnections();

    } catch (error) {
        console.error("Request response error:", error);

        acceptButton.disabled = false;
        declineButton.disabled = false;

        showMessage(
            "Couldn't update this request. Please try again."
        );
    }
}
