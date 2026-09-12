// index_popup.js - Global Firebase Release Notification Popup

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyChgVcbDPzc6AMeoac1hCOx39YK_1mEKvU",
    authDomain: "blaze-x-db2f5.firebaseapp.com",
    projectId: "blaze-x-db2f5"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// Injects the necessary CSS and HTML for the popup directly into index.html
const injectPopupDOM = () => {
    if (document.getElementById('global-release-popup-wrapper')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        .index-popup-enter { animation: idxPopupFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .index-popup-exit { animation: idxPopupFadeOut 0.4s ease-in forwards; }
        @keyframes idxPopupFadeIn {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes idxPopupFadeOut {
            from { opacity: 1; transform: translateY(10px) scale(0.98); }
            to { opacity: 0; transform: translateY(20px) scale(0.95); }
        }
    `;
    document.head.appendChild(style);

    const html = `
    <div id="global-release-popup-wrapper" class="fixed inset-0 z-[9999] hidden flex items-center justify-center p-4 pointer-events-none">
        <div id="global-release-popup-backdrop" class="absolute inset-0 bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-auto"></div>
        
        <div id="global-release-popup-content" class="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/10 opacity-0 pointer-events-auto flex flex-col">
            
            <button id="global-popup-close-btn" class="absolute top-4 right-4 z-40 w-8 h-8 bg-black/50 hover:bg-[#F47521] backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors border border-white/10 shadow-lg">
                <i class="fas fa-times"></i>
            </button>

            <div class="relative w-full h-56 md:h-64 bg-[#111]">
                <img id="global-popup-poster" src="" class="w-full h-full object-cover opacity-60">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-transparent to-transparent"></div>
                
                <div class="absolute bottom-4 left-4 right-4 z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <span id="global-popup-badge" class="bg-[#F47521] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md"></span>
                    </div>
                    <h2 id="global-popup-title" class="text-2xl font-black text-white leading-tight drop-shadow-lg line-clamp-2 mb-1"></h2>
                    <h3 id="global-popup-subtitle" class="text-sm text-[#F47521] font-bold tracking-wide drop-shadow-md"></h3>
                </div>
            </div>

            <div class="p-4 md:p-5 flex-1 bg-[#0a0a0a]">
                <div id="global-popup-genres" class="flex flex-wrap gap-1.5 mb-3"></div>
                <p id="global-popup-synopsis" class="text-gray-300 text-xs md:text-sm line-clamp-3 leading-relaxed mb-6 font-medium"></p>
                
                <div class="flex gap-3">
                    <button id="global-popup-watch-btn" class="flex-1 bg-[#F47521] hover:bg-[#e06616] text-white font-black text-sm uppercase tracking-wider py-3 rounded-xl transition-colors shadow-[0_4px_15px_rgba(244,117,33,0.3)] flex items-center justify-center gap-2">
                        <i class="fas fa-play"></i> Watch Now
                    </button>
                    <button id="global-popup-share-btn" class="w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl flex items-center justify-center text-white transition-colors">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

// Handle showing the UI
const showGlobalReleasePopup = (notif) => {
    const wrapper = document.getElementById('global-release-popup-wrapper');
    const backdrop = document.getElementById('global-release-popup-backdrop');
    const content = document.getElementById('global-release-popup-content');

    // Populate data
    document.getElementById('global-popup-poster').src = notif.image || 'https://via.placeholder.com/400x600/111/fff';
    document.getElementById('global-popup-title').innerText = notif.title || 'Unknown Anime';
    document.getElementById('global-popup-subtitle').innerText = notif.message || 'New update available';
    document.getElementById('global-popup-synopsis').innerText = notif.synopsis || 'No description available for this release.';
    
    const badge = document.getElementById('global-popup-badge');
    if (notif.type === 'episode_released') { badge.innerText = 'New Episode'; badge.className = 'bg-[#F47521] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md'; }
    else if (notif.type === 'series_released') { badge.innerText = 'Series Released'; badge.className = 'bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md'; }
    else if (notif.type === 'release_delayed') { badge.innerText = 'Delayed'; badge.className = 'bg-yellow-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md'; }

    const genresContainer = document.getElementById('global-popup-genres');
    if (notif.genres && Array.isArray(notif.genres)) {
        genresContainer.innerHTML = notif.genres.slice(0, 3).map(g => `<span class="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-[10px] font-bold text-gray-300">${g}</span>`).join('');
    } else { genresContainer.innerHTML = ''; }

    // Buttons
    const closePopup = () => {
        backdrop.classList.remove('opacity-100');
        content.classList.remove('index-popup-enter');
        content.classList.add('index-popup-exit');
        setTimeout(() => wrapper.classList.add('hidden'), 400);
    };

    document.getElementById('global-popup-close-btn').onclick = closePopup;
    backdrop.onclick = closePopup;

    document.getElementById('global-popup-watch-btn').onclick = () => {
        closePopup();
        window.location.href = `/info.html?id=${notif.animeId}`;
    };

    document.getElementById('global-popup-share-btn').onclick = () => {
        if(window.navigator.share) {
            window.navigator.share({ title: notif.title, text: notif.message, url: `${window.location.origin}/info.html?id=${notif.animeId}` });
        }
    };

    // Show sequence
    wrapper.classList.remove('hidden');
    void wrapper.offsetWidth; 
    backdrop.classList.add('opacity-100');
    content.classList.remove('opacity-0');
    content.classList.add('index-popup-enter');
    content.classList.remove('index-popup-exit');
};

// Monitor Firebase for Notifications
onAuthStateChanged(auth, (user) => {
    if (!user) return;

    injectPopupDOM();
    
    // Check localStorage to see what we have already popped up for the user
    let shownPopups = JSON.parse(localStorage.getItem('shown_blazex_popups') || '[]');

    const notifRef = collection(db, "users", user.uid, "notifications");
    // Get the most recent 10 notifications
    const q = query(notifRef, orderBy("timestamp", "desc"), limit(10));

    onSnapshot(q, (snapshot) => {
        const releaseTypes = ['episode_released', 'series_released', 'release_delayed'];
        
        snapshot.docs.forEach((doc) => {
            const notif = doc.data();
            notif.id = doc.id;

            // If it is a release notification AND we have never shown it on this device
            if (releaseTypes.includes(notif.type) && !shownPopups.includes(notif.id)) {
                
                // Show it immediately
                showGlobalReleasePopup(notif);
                
                // Save it to memory so we never show this exact notification again
                shownPopups.push(notif.id);
                
                // Keep localStorage clean (only save the last 50 IDs so memory doesn't bloat)
                if (shownPopups.length > 50) shownPopups = shownPopups.slice(-50);
                localStorage.setItem('shown_blazex_popups', JSON.stringify(shownPopups));
            }
        });
    });
});
