// header.js

// 1. Import Firebase Modular SDKs via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

window.app.firebaseApp = firebaseApp;
window.app.auth = auth;
window.app.db = db;

// 4. Header Component Logic
window.app.components.header = () => {
    const container = document.getElementById('header-container');
    if (!container) return;

    // Load initial profile state synchronously from LocalStorage to prevent UI flickering
    const localProfile = localStorage.getItem('blazex_user_profile');
    if (localProfile) {
        try {
            window.app.state.activeProfile = JSON.parse(localProfile);
        } catch (e) {
            console.error("Failed to parse local profile.");
        }
    }

    // Build the Header UI
    container.innerHTML = `
        <nav class="fixed top-0 left-0 right-0 w-full h-[60px] bg-[#050505]/95 backdrop-blur-md border-b border-white/5 px-4 md:px-8 flex items-center justify-between z-[90]">
            
            <div class="flex items-center gap-4 md:gap-6">
                <i class="fas fa-bars text-white text-lg md:text-xl cursor-pointer hover:text-[#F47521] transition-colors" onclick="if(window.app.components.hamburgerMenu) window.app.components.hamburgerMenu()"></i>
                <img src="logo.png" alt="Blaze-X" class="h-5 md:h-6 cursor-pointer" onclick="window.location.href='index.html'">
            </div>
            
            <div class="flex items-center gap-5 md:gap-6">
                <i class="fas fa-search text-white text-lg md:text-xl cursor-pointer hover:text-[#F47521] transition-colors" onclick="window.location.href='search.html'"></i>
                
                <div id="header-profile-btn" class="cursor-pointer transition-transform hover:scale-105" onclick="window.app.handleProfileClick()">
                    </div>
            </div>
        </nav>
    `;

    // Render the initial PFP or SVG instantly
    renderProfileIcon();

    // 5. Firebase Live Auth Sync
    // Silently checks the database in the background to ensure PFP and details are up to date
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(userDocRef);
                
                if (docSnap.exists()) {
                    const profileData = docSnap.data();
                    window.app.state.activeProfile = profileData;
                    localStorage.setItem('blazex_user_profile', JSON.stringify(profileData));
                    renderProfileIcon(); // Re-render to show updated Database PFP
                }
            } catch (err) {
                console.error("Failed to sync profile from DB:", err);
            }
        }
    });
};

// --- DYNAMIC PROFILE ICON RENDERER ---
function renderProfileIcon() {
    const profileBtn = document.getElementById('header-profile-btn');
    if (!profileBtn) return;
    
    const profile = window.app.state.activeProfile;

    // If user has a profile and a PFP, show the image (No Glow, Flat Border)
    if (profile && profile.pfp) {
        profileBtn.innerHTML = `
            <div class="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border border-white/10 hover:border-[#F47521] transition-colors bg-[#111]">
                <img src="${profile.pfp}" class="w-full h-full object-cover">
            </div>
        `;
    } 
    // Otherwise, show clean Vector SVG (FontAwesome default)
    else {
        profileBtn.innerHTML = `
            <i class="fas fa-user-circle text-gray-400 text-[28px] md:text-[32px] hover:text-white transition-colors"></i>
        `;
    }
}

// --- PROFILE CLICK ROUTER ---
window.app.handleProfileClick = () => {
    const profile = window.app.state.activeProfile;
    
    // Check if the user is a fully registered logged-in user
    const isFullyRegistered = profile && profile.uid && !profile.uid.startsWith('anon_');

    if (isFullyRegistered) {
        // If logged in properly, send them to their profile dashboard
        window.location.href = 'profile.html';
    } else {
        // If they are a Guest, logged out, or anonymous, trigger the Auth.js Popup Modal
        if (typeof window.app.components.auth === 'function') {
            window.app.components.auth();
        } else {
            console.error("auth.js component not found! Make sure auth.js is loaded in your HTML.");
        }
    }
};
