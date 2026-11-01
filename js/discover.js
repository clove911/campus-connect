
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
    getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const searchInput = document.getElementById("studentSearch");
const resultsContainer = document.getElementById("searchResults");
const searchMessage = document.getElementById("searchMessage");

let currentUser = null;
let searchVersion = 0;

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
});

function showMessage(message) {
    searchMessage.textContent = message;
}

function renderStudents(students) {
    resultsContainer.replaceChildren();

    students.forEach(student => {
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
        resultsContainer.appendChild(card);
    });
}

async function searchStudents(searchTerm) {
    const version = ++searchVersion;

    resultsContainer.replaceChildren();

    if (!currentUser) return;

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
            .filter(doc => doc.id !== currentUser.uid)
            .map(doc => doc.data());

        if (students.length === 0) {
            showMessage("No matching students found.");
            return;
        }

        showMessage(`${students.length} student(s) found.`);
        renderStudents(students);

    } catch (error) {
        console.error("Student search error:", error);
        showMessage("Couldn't search right now. Please try again.");
    }
}

searchInput.addEventListener("input", () => {
    const searchTerm = searchInput.value
        .trim()
        .toLowerCase();

    searchStudents(searchTerm);
});
