// header.js

// 1. Import Firebase Modular SDKs via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// 2. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyChgVcbDPzc6AMeoac1hCOx39YK_1mEKvU",
    authDomain: "blaze-x-db2f5.firebaseapp.com",
    projectId: "blaze-x-db2f5",
    storageBucket: "blaze-x-db2f5.firebasestorage.app",
    messagingSenderId: "770812306638",
    appId: "1:770812306638:web:eaf5ded647861f32c25c9f"
};

// 3. Initialize Firebase & Export to Global App Object
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

window.app.auth = auth;
window.app.db = db;

// 4. Header Component Logic
window.app.components.header = () => {
    const container = document.getElementById('header-container');

    // Default UI state before Firebase loads
    container.innerHTML = `
        <nav class="bg-black/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-lg relative z-50">
            <div class="flex items-center gap-4">
                <!-- Hamburger Menu -->
                <i class="fas fa-bars text-white text-xl cursor-pointer hover:text-[#F47521] transition-colors" onclick="if(window.app.components.hamburgerMenu) window.app.components.hamburgerMenu()"></i>
                
                <!-- Blaze-X Logo Image (Loads from root directory) -->
                <div class="flex items-center cursor-pointer" onclick="window.app.renderHome()">
                    <img src="logo.png" alt="Blaze-X" class="h-8 object-contain">
                </div>
            </div>
            
            <div class="flex gap-5 items-center">
                <!-- Search Icon -->
                <i class="fas fa-search text-white text-xl cursor-pointer hover:text-[#F47521] transition-colors" onclick="window.location.href = 'search.html'"></i>
                
                <!-- Profile Icon (Defaults to placeholder, updates on Auth) -->
                <img id="header-profile-img" src="https://iili.io/fWydBMG.md.png" class="w-8 h-8 rounded-full border-2 border-transparent object-cover cursor-pointer hover:border-[#F47521] transition-colors" onclick="if(window.app.components.profile) window.app.components.profile()">
            </div>
        </nav>
    `;

    // 5. Handle Anonymous Authentication & Database Setup
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User logged in anonymously with UID:", user.uid);
            
            // Reference to this specific user's document in Firestore
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                // User exists, pull their data into global state
                const userData = userSnap.data();
                window.app.state.activeProfile = userData;
                
                // Update profile image if they have a custom one
                if(userData.pfp) {
                    document.getElementById('header-profile-img').src = userData.pfp;
                }
            } else {
                // First time user, create their database shell
                const newUserProfile = {
                    uid: user.uid,
                    username: "Anonymous User",
                    pfp: "https://iili.io/fWydBMG.md.png", // Default image
                    history: [],
                    watchlist: [],
                    searchHistory: [],
                    likes: [],
                    comments: [],
                    createdAt: new Date().toISOString()
                };

                // Save to Firestore
                await setDoc(userRef, newUserProfile);
                
                // Set to global state
                window.app.state.activeProfile = newUserProfile;
            }
        } else {
            // If no user is detected, force an anonymous sign-in
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Authentication failed:", error);
            }
        }
    });
};
