// continue_watching.js - Cloud-Synced Horizontal Continue Watching Slider

window.app = window.app || {};
window.app.components = window.app.components || {};

// --- SAFE FIREBASE INITIALIZATION ---
let firebaseInitCW = false;
const initFirebaseCW = async () => {
    if (firebaseInitCW) return;
    try {
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        const firebaseConfig = {
            apiKey: "AIzaSyChgVcbDPzc6AMeoac1hCOx39YK_1mEKvU",
            authDomain: "blaze-x-db2f5.firebaseapp.com",
            projectId: "blaze-x-db2f5",
            storageBucket: "blaze-x-db2f5.firebasestorage.app",
            messagingSenderId: "770812306638",
            appId: "1:770812306638:web:eaf5ded647861f32c25c9f"
        };

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        window.app.auth = getAuth(app);
        window.app.db = getFirestore(app);
        firebaseInitCW = true;
    } catch (err) {
        console.error("Firebase Init Error (Continue Watching):", err);
    }
};

// --- CUSTOM CSS MODAL LOGIC ---
window.app.showConfirmModal = (title, message, confirmCallback) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    
    if (!overlay || !content) return;

    content.innerHTML = `
        <div class="text-center">
            <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i class="fas fa-exclamation-triangle text-2xl text-red-500"></i>
            </div>
            <h3 class="text-white font-black text-lg uppercase tracking-wider mb-2 drop-shadow-md">${title}</h3>
            <p class="text-gray-400 text-sm mb-6 leading-relaxed">${message}</p>
            <div class="flex gap-3 justify-center">
                <button id="modal-cancel-btn" class="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-lg transition-colors border border-white/10 text-sm tracking-wide">Cancel</button>
                <button id="modal-confirm-btn" class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg transition-colors shadow-lg shadow-red-600/20 text-sm tracking-wide">Confirm</button>
            </div>
        </div>
    `;

    const closeModal = () => {
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { overlay.classList.add('hidden'); }, 300);
    };

    document.getElementById('modal-cancel-btn').onclick = closeModal;
    document.getElementById('modal-confirm-btn').onclick = () => {
        closeModal();
        if(confirmCallback) confirmCallback();
    };

    overlay.classList.remove('hidden');
    void overlay.offsetWidth; 
    content.classList.remove('scale-95', 'opacity-0');
    content.classList.add('scale-100', 'opacity-100');
};

// --- CLOUD DELETION LOGIC ---
window.app.deleteContinueWatching = async (event, animeId, animeTitle) => {
    event.stopPropagation(); 
    
    window.app.showConfirmModal(
        "Remove Anime",
        `Are you sure you want to remove <span class="text-white font-bold">${animeTitle}</span> from your continue watching list?`,
        async () => {
            try {
                await initFirebaseCW();
                const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
                const uid = profile.uid || 'guest';
                
                // 1. Delete from Cloud
                if (uid !== 'guest' && window.app.db) {
                    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                    await deleteDoc(doc(window.app.db, "users", uid, "continue_watching", String(animeId)));
                }

                // 2. Delete from Legacy Local Storage (Cleanup)
                const keysToDelete = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith(`blazex_progress_${uid}_${animeId}`) || key.startsWith(`blazex_time_${uid}_${animeId}`))) {
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(k => localStorage.removeItem(k));
                
                // 3. Re-render
                if (window.app.components.continueWatching) window.app.components.continueWatching();
            } catch(e) {
                console.error("Failed to delete watch history", e);
            }
        }
    );
};

window.app.clearAllContinueWatching = async () => {
    window.app.showConfirmModal(
        "Clear History",
        "Are you sure you want to permanently clear all your continue watching progress? This cannot be undone.",
        async () => {
            try {
                await initFirebaseCW();
                const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
                const uid = profile.uid || 'guest';
                
                // 1. Delete all from Cloud
                if (uid !== 'guest' && window.app.db) {
                    const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                    const cwRef = collection(window.app.db, "users", uid, "continue_watching");
                    const snapshot = await getDocs(cwRef);
                    snapshot.forEach(async (d) => {
                        await deleteDoc(doc(window.app.db, "users", uid, "continue_watching", d.id));
                    });
                }

                // 2. Clear Legacy Local Storage
                const keysToDelete = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith(`blazex_progress_${uid}_`) || key.startsWith(`blazex_time_${uid}_`))) {
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(k => localStorage.removeItem(k));
                
                // 3. Re-render
                if (window.app.components.continueWatching) window.app.components.continueWatching();
            } catch(e) {
                console.error("Failed to clear watch history", e);
            }
        }
    );
};


// --- CLOUD SYNC & SLIDER RENDERING ---
window.app.components.continueWatching = async () => {
    const container = document.getElementById('history-container');
    if (!container) return;

    await initFirebaseCW();

    const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
    const uid = profile.uid || 'guest';
    
    // --- 1. SILENT MIGRATION: Push legacy local storage to cloud to ensure zero data loss ---
    if (uid !== 'guest' && window.app.db) {
        try {
            const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const prefix = `blazex_progress_${uid}_`;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const animeId = key.replace(prefix, '');
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && data.lastWatchedEp) {
                            const timeKey = `blazex_time_${uid}_${animeId}_${data.lastWatchedEp}`;
                            const timeProgress = parseFloat(localStorage.getItem(timeKey)) || 0;
                            
                            // Push to firestore
                            await setDoc(doc(window.app.db, "users", uid, "continue_watching", animeId), {
                                animeId: animeId,
                                epNum: parseInt(data.lastWatchedEp),
                                slug: data.lastSlug || String(data.lastWatchedEp),
                                time: timeProgress,
                                timestamp: Date.now() // Update timestamp to put it at front
                            }, { merge: true });
                            
                            // Remove legacy local storage so it relies entirely on cloud moving forward
                            localStorage.removeItem(key);
                            localStorage.removeItem(timeKey);
                        }
                    } catch(e) {}
                }
            }
        } catch(e) { console.error("Migration phase failed", e); }
    }

    // --- 2. FETCH FROM CLOUD (Saving All History) ---
    let historyItems = [];
    
    if (uid !== 'guest' && window.app.db) {
        try {
            const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            // Extract up to 50 items (Removing the old limit of 3-10)
            const q = query(collection(window.app.db, "users", uid, "continue_watching"), orderBy("timestamp", "desc"), limit(50));
            const snapshot = await getDocs(q);
            
            snapshot.forEach(doc => {
                historyItems.push(doc.data());
            });
        } catch(e) {
            console.error("Failed to fetch cloud history", e);
        }
    }

    if (historyItems.length === 0) {
        container.innerHTML = ''; 
        return;
    }

    // 3. SHOW HORIZONTAL LOADING SKELETON
    container.innerHTML = `
        <div class="py-6 relative overflow-visible">
            <div class="px-4 md:px-8 mb-4 flex items-center justify-between">
                <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Continue Watching</h2>
            </div>
            <div class="flex gap-4 md:gap-5 overflow-hidden pl-4 md:pl-8">
                ${[1, 2, 3].map(() => `
                    <div class="min-w-[240px] md:min-w-[320px] aspect-[16/9] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 4. FETCH METADATA
        const baseUrl = 'https://anikoto-api-lyart.vercel.app';
        const enrichedItems = [];

        // Parallel fetch for speed
        const fetchPromises = historyItems.map(async (item) => {
            try {
                const res = await fetch(`${baseUrl}/api/info?id=${item.animeId}`);
                const json = await res.json();
                if (json && json.success && json.data) {
                    return {
                        ...item,
                        title: json.data.title || 'Unknown Title',
                        image: json.data.banner || json.data.poster || 'https://via.placeholder.com/1280x720/111/fff'
                    };
                }
            } catch(e) {}
            return null;
        });

        const resolvedItems = await Promise.all(fetchPromises);
        resolvedItems.forEach(item => { if(item) enrichedItems.push(item); });

        if (enrichedItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 5. RENDER HORIZONTAL CARDS WITH SLIM PROGRESS BARS
        let cardsHtml = enrichedItems.map(item => {
            const targetUrl = `play.html?id=${encodeURIComponent(item.slug)}&anime=${item.animeId}&ep=${item.epNum}&type=sub`;
            let progressPct = (item.time / 1440) * 100; // 24 mins avg episode length
            if (progressPct > 100) progressPct = 100;
            if (progressPct < 2) progressPct = 2; 

            // Escape quotes for the onclick function
            const safeTitleForFunc = item.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            return `
            <div class="snap-start shrink-0 w-[240px] md:w-[320px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-20"
                 onclick="window.location.href='${targetUrl}'">
                
                <div class="relative w-full aspect-[16/9] rounded-lg overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.35)] border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-[#111]">
                    
                    <img src="${item.image}" loading="lazy" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 object-center">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none"></div>

                    <!-- Individual Delete Button -->
                    <button onclick="window.app.deleteContinueWatching(event, '${item.animeId}', '${safeTitleForFunc}')" 
                            class="absolute top-2 right-2 z-[40] w-7 h-7 bg-black/60 hover:bg-red-600 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors border border-white/10 shadow-lg">
                        <i class="fas fa-times text-xs"></i>
                    </button>

                    <!-- Play Icon Overlay -->
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                        <div class="w-12 h-12 md:w-14 md:h-14 bg-[#F47521] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,117,33,0.6)]">
                            <i class="fas fa-play text-white ml-1 text-lg"></i>
                        </div>
                    </div>

                    <!-- Details -->
                    <div class="absolute bottom-4 left-3 right-3 z-20 pointer-events-none">
                        <h3 class="text-sm md:text-base text-white font-black truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">${item.title}</h3>
                        <p class="text-[10px] md:text-xs text-gray-300 font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Episode ${item.epNum}</p>
                    </div>
                    
                    <!-- SLIM PROGRESS BAR -->
                    <div class="absolute bottom-0 left-0 w-full h-[2px] bg-white/20 z-30">
                        <div class="h-full bg-[#F47521] transition-all duration-500 ease-out" style="width: ${progressPct}%"></div>
                    </div>

                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="py-6 relative overflow-visible">
                <div class="px-4 md:px-8 flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Continue Watching
                    </h2>
                    
                    <!-- Clear All Button -->
                    <button onclick="window.app.clearAllContinueWatching()" class="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span class="hidden md:inline">Clear All</span>
                    </button>
                </div>
                
                <div class="relative group/slider">
                    <button id="cw-slide-left-btn" class="hidden md:flex absolute left-2 top-[50%] -translate-y-1/2 z-30 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="cw-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-6 pt-2 pl-4 md:pl-8 pr-12">
                        ${cardsHtml}
                    </div>
                    
                    <button id="cw-slide-right-btn" class="hidden md:flex absolute right-2 top-[50%] -translate-y-1/2 z-30 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 6. ATTACH SCROLL LOGIC
        const track = document.getElementById('cw-slider-track');
        const leftBtn = document.getElementById('cw-slide-left-btn');
        const rightBtn = document.getElementById('cw-slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            const scrollAmount = window.innerWidth > 768 ? 600 : 300;
            leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
            rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

    } catch (error) {
        console.error("Continue Watching Slider Error:", error);
        container.innerHTML = ''; 
    }
};

// --- GLOBAL HELPER FOR PLAYER TO UPDATE CLOUD SYNC ---
// You can call this from your play.js file when video progress is made.
window.app.saveWatchProgressToCloud = async (animeId, epNum, slug, timeSeconds) => {
    try {
        await initFirebaseCW();
        const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
        const uid = profile.uid;
        
        if (uid && uid !== 'guest' && window.app.db) {
            const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            await setDoc(doc(window.app.db, "users", uid, "continue_watching", String(animeId)), {
                animeId: String(animeId),
                epNum: parseInt(epNum),
                slug: String(slug),
                time: parseFloat(timeSeconds),
                timestamp: Date.now()
            }, { merge: true });
        }
    } catch(e) {
        console.error("Cloud watch progress save failed", e);
    }
};
