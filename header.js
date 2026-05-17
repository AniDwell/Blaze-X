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

// Ensure global app object exists
window.app = window.app || { state: {}, components: {}, api: {}, config: {} };

// 3. Initialize Firebase & Export to Global App Object
// (This allows auth.js, info.js, and carousel.js to share the exact same connection)
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

window.app.firebaseApp = firebaseApp;
window.app.auth = auth;
window.app.db = db;

// 4. Header Component Logic
window.app.components.header = async () => {
    const container = document.getElementById('header-container');
    if (!container) return;

    // A. INSTANT UI RESTORE: Check local storage for lightning-fast rendering
    const localProfile = localStorage.getItem('blazex_user_profile');
    if (localProfile) {
        window.app.state.activeProfile = JSON.parse(localProfile);
    }

    // Render the UI immediately
    renderHeaderUI();

    // B. BACKGROUND SYNC: Keep the header data perfectly synced with Firebase
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // If they are logged into a real account (not an anonymous local guest)
            if (!window.app.state.activeProfile || !window.app.state.activeProfile.uid.startsWith('anon_')) {
                try {
                    const userDocRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(userDocRef);
                    
                    if (docSnap.exists()) {
                        const freshData = docSnap.data();
                        window.app.state.activeProfile = freshData;
                        localStorage.setItem('blazex_user_profile', JSON.stringify(freshData));
                        
                        // Re-render silently to update PFP if they changed it elsewhere
                        renderHeaderUI(); 
                    }
                } catch (e) {
                    console.error("Header DB Sync Error", e);
                }
            }
        }
    });
};

// --- UI RENDER ENGINE ---
function renderHeaderUI() {
    const container = document.getElementById('header-container');
    const profile = window.app.state.activeProfile;

    // Dynamic Profile Avatar Logic
    let profileHtml = '';
    if (profile && profile.pfp) {
        // Logged in with a custom PFP
        profileHtml = `<img src="${profile.pfp}" alt="Profile" class="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border-2 border-transparent hover:border-[#F47521] transition-colors shadow-md">`;
    } else {
        // Not logged in or missing PFP: Show sleek default SVG icon
        profileHtml = `
            <div class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/10 flex items-center justify-center border-2 border-transparent hover:border-[#F47521] transition-colors text-gray-300 hover:text-white shadow-md">
                <i class="fas fa-user text-sm md:text-base"></i>
            </div>
        `;
    }

    // Render Navbar (Fixed at top, with a spacer to prevent content overlapping)
    container.innerHTML = `
        <nav class="fixed top-0 left-0 right-0 h-[60px] bg-[#050505]/95 backdrop-blur-md border-b border-white/10 px-4 md:px-8 flex items-center justify-between shadow-xl z-50 transition-all duration-300">
            
            <div class="flex items-center gap-4">
                <button onclick="if(window.app.components.hamburgerMenu) window.app.components.hamburgerMenu()" class="text-white hover:text-[#F47521] transition-colors focus:outline-none">
                    <i class="fas fa-bars text-xl md:text-2xl"></i>
                </button>
                
                <a href="index.html" class="flex items-center gap-2 group cursor-pointer ml-2">
                    <span class="text-white font-black text-xl md:text-2xl tracking-tighter drop-shadow-md group-hover:text-[#F47521] transition-colors">BLAZE<span class="text-[#F47521]">X</span></span>
                </a>
            </div>

            <div class="flex items-center gap-5 md:gap-6">
                
                <button onclick="window.location.href='search.html'" class="text-white hover:text-[#F47521] transition-colors focus:outline-none">
                    <i class="fas fa-search text-lg md:text-xl"></i>
                </button>

                <button onclick="window.app.handleProfileClick()" class="focus:outline-none relative group transition-transform hover:scale-105">
                    ${profileHtml}
                    ${!profile ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#F47521] rounded-full shadow-[0_0_8px_rgba(244,117,33,1)]"></span>` : ''}
                </button>

            </div>
        </nav>
        
        <div class="h-[60px] w-full"></div>
    `;
}

// --- PROFILE CLICK ROUTER ---
window.app.handleProfileClick = () => {
    const profile = window.app.state.activeProfile;
    
    // Check if the user exists in state (Standard Account OR Guest Account)
    if (profile && profile.uid) {
        // They are logged in! Send them to their library/profile page.
        window.location.href = 'profile.html';
    } else {
        // They are completely unauthenticated. Trigger the auth.js Modal!
        if (window.app.components && window.app.components.auth) {
            window.app.components.auth();
        } else {
            console.error("auth.js is missing! Ensure it is linked in your HTML file.");
            alert("Please log in to access this feature.");
        }
    }
};
