
import { auth } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const conversationCount =
    document.getElementById("conversationCount");

const conversationSearch =
    document.getElementById("conversationSearch");

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.replace("login.html");
        return;
    }

    conversationCount.textContent = "0";
});

// Search will filter actual conversations
// once the Firestore conversation system is connected.
conversationSearch.addEventListener("input", () => {
    // Conversation filtering will be implemented
    // when real conversations are loaded.
});
