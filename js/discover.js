import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    limit,
    getDocs,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const searchInput = document.getElementById("studentSearch");
const resultsContainer = document.getElementById("searchResults");
const searchMessage = document.getElementById("searchMessage");

let currentUser = null;
let searchVersion = 0;

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;

    if (searchInput.value.trim().length >= 2) {
        searchStudents(searchInput.value.trim().toLowerCase());
    }
});

function showMessage(message) {
    searchMessage.textContent = message;
}

function getConnectionId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

async function getStudentConnectionStatus(studentId) {
    const outgoingId = `${currentUser.uid}_${studentId}`;
    const incomingId = `${studentId}_${currentUser.uid}`;
    const connectionId = getConnectionId(currentUser.uid, studentId);

    const [outgoingSnap, incomingSnap, connectionSnap] =
        await Promise.all([
            getDoc(doc(db, "connectionRequests", outgoingId)),
            getDoc(doc(db, "connectionRequests", incomingId)),
            getDoc(doc(db, "connections", connectionId))
        ]);

    if (connectionSnap.exists()) {
        return "connected";
    }

    if (outgoingSnap.exists()) {
        const status = outgoingSnap.data().status;

        if (status === "pending") return "sent";
        if (status === "accepted") return "connected";
        if (status === "declined") return "declined";
    }

    if (incomingSnap.exists()) {
        const status = incomingSnap.data().status;

        if (status === "pending") return "received";
        if (status === "accepted") return "connected";
    }

    return "none";
}

function createConnectionButton(studentId, status) {
    const button = document.createElement("button");
    button.className = "connection-button";

    function setButtonState(nextStatus) {
        button.dataset.status = nextStatus;
        button.disabled = nextStatus !== "none";

        const labels = {
            none: "＋ Add Connection",
            sent: "Request Sent",
            received: "Request Received",
            connected: "✓ Connected",
            declined: "Request Declined",
            loading: "Sending..."
        };

        button.textContent = labels[nextStatus] || "Unavailable";
    }

    setButtonState(status);

    button.addEventListener("click", async () => {
        if (!currentUser || button.disabled) return;

        setButtonState("loading");

        try {
            const requestId = `${currentUser.uid}_${studentId}`;
            const requestRef = doc(
                db,
                "connectionRequests",
                requestId
            );

            // Check again before creating, to avoid duplicates.
            const existingRequest = await getDoc(requestRef);

            if (existingRequest.exists()) {
                const latestStatus = await getStudentConnectionStatus(studentId);
                setButtonState(latestStatus);
                return;
            }

            await setDoc(requestRef, {
                senderId: currentUser.uid,
                receiverId: studentId,
                status: "pending",
                createdAt: serverTimestamp()
            });

            setButtonState("sent");

        } catch (error) {
            console.error("Connection request error:", error);

            setButtonState("none");
            showMessage(
                "Couldn't send the request. Please try again."
            );
        }
    });

    return button;
}

async function renderStudents(students, version) {
    resultsContainer.replaceChildren();

    const cards = await Promise.all(
        students.map(async student => {
            const card = document.createElement("article");
            card.className = "student-card";

            const heading = document.createElement("div");
            heading.className = "student-heading";

            const avatar = document.createElement("div");
            avatar.className = "student-avatar";
            avatar.textContent =
                student.displayName.charAt(0).toUpperCase();

            const name = document.createElement("h3");
            name.textContent = student.displayName;

            heading.append(avatar, name);

            const grade = document.createElement("p");
            grade.textContent = `Class ${student.grade}`;

            const subjects = document.createElement("p");
            subjects.textContent =
                `Subjects: ${student.subjects.join(", ")}`;

            const style = document.createElement("p");
            style.textContent =
                `Study preference: ${student.studyStyle}`;

            card.append(heading, grade, subjects, style);

            try {
                const status = await getStudentConnectionStatus(student.id);
                const button = createConnectionButton(student.id, status);
                card.appendChild(button);
            } catch (error) {
                console.error("Couldn't load connection status:", error);

                const button = document.createElement("button");
                button.className = "connection-button";
                button.textContent = "Unavailable";
                button.disabled = true;
                card.appendChild(button);
            }

            return card;
        })
    );

    if (version !== searchVersion) return;

    resultsContainer.replaceChildren(...cards);
}

async function searchStudents(searchTerm) {
    const version = ++searchVersion;

    resultsContainer.replaceChildren();

    if (!currentUser) {
        showMessage("Loading your account...");
        return;
    }

    if (searchTerm.length < 2) {
        showMessage("Type at least 2 characters to search.");
        return;
    }

    showMessage("Searching students...");

    try {
        const studentsQuery = query(
            collection(db, "publicProfiles"),
            orderBy("displayNameLower"),
            startAt(searchTerm),
            endAt(searchTerm + "\uf8ff"),
            limit(20)
        );

        const snapshot = await getDocs(studentsQuery);

        if (version !== searchVersion) return;

        const students = snapshot.docs
            .filter(document => document.id !== currentUser.uid)
            .map(document => ({
                id: document.id,
                ...document.data()
            }));

        if (students.length === 0) {
            showMessage("No matching students found.");
            return;
        }

        showMessage(`Found ${students.length} student(s).`);
        await renderStudents(students, version);

    } catch (error) {
        console.error("Student search error:", error);
        showMessage("Couldn't search right now. Please try again.");
    }
}

searchInput.addEventListener("input", () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    searchStudents(searchTerm);
});
