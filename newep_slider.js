// newep_slider.js - Upcoming Episodes Slider (Live Sync, Add/Remove Notifs, Auto-Release Notifs)

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};
if (!window.app.state.carouselLibrarySet) window.app.state.carouselLibrarySet = new Set();

// --- SAFE FIREBASE INIT ---
let firebaseInitNewEp = false;
const initFirebaseNewEp = async () => {
    if (firebaseInitNewEp) return;
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
        firebaseInitNewEp = true;
    } catch (err) {
        console.error("Firebase Init Error (NewEp Slider):", err);
    }
};

// --- SVG UI UPDATER ---
window.app.updateNewEpBtnUI = (btn, isAdded) => {
    if (!btn) return;
    const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
    const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;
    
    btn.dataset.added = isAdded ? "true" : "false";
    btn.innerHTML = isAdded ? savedSvg : unsavedSvg;
    
    btn.classList.remove('bg-black/50', 'bg-black/70', 'bg-black/80');
    btn.classList.add(isAdded ? 'bg-black/80' : 'bg-black/70');
};

// --- INSTANT SAVE & NOTIFY LOGIC ---
window.app.toggleNewEpLibrary = async (event, btn, id, title, img) => {
    event.stopPropagation(); 
    
    try {
        await initFirebaseNewEp();
        const { doc, setDoc, deleteDoc, collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        
        const auth = window.app.auth;
        const db = window.app.db;
        
        if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Please log in to save to your Library!", "error");
            return;
        }

        const docIdStr = String(id);
        const isAdded = btn.dataset.added === "true";
        const libDocRef = doc(db, "users", auth.currentUser.uid, "library", docIdStr);
        const notifRef = collection(db, "users", auth.currentUser.uid, "notifications");

        if (isAdded) {
            window.app.updateNewEpBtnUI(btn, false);
            window.app.state.carouselLibrarySet.delete(docIdStr);

            await deleteDoc(libDocRef);
            await addDoc(notifRef, {
                type: 'library',
                title: 'Library Updated',
                message: `You removed ${title} from your library.`,
                image: img,
                timestamp: Date.now()
            });

            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
        } else {
            window.app.updateNewEpBtnUI(btn, true);
            window.app.state.carouselLibrarySet.add(docIdStr);

            await setDoc(libDocRef, { id: docIdStr, title, img, timestamp: Date.now() });
            await addDoc(notifRef, {
                type: 'library',
                title: 'Library Updated',
                message: `You added ${title} to your library!`,
                image: img,
                timestamp: Date.now()
            });

            if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
        }
    } catch (error) { 
        console.error("Library sync error:", error);
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
    }
};

// --- EPISODE RELEASE NOTIFICATION LOGIC ---
window.app.triggerEpisodeReleaseNotification = async (id, title, img, ep) => {
    try {
        await initFirebaseNewEp();
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const auth = window.app.auth;
        
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            const notifRef = collection(window.app.db, "users", auth.currentUser.uid, "notifications");
            await addDoc(notifRef, {
                type: 'library',
                title: 'New Episode Released!',
                message: `Episode ${ep} of ${title} is now airing!`,
                image: img,
                timestamp: Date.now(),
                animeId: id 
            });
            // Show toast so the user knows it dropped while they were browsing
            if (window.app.showCustomAlert) window.app.showCustomAlert(`Episode ${ep} of ${title} is out!`, "success");
        }
    } catch (err) {
        console.error("Failed to push release notification", err);
    }
};

window.app.components.newEpSlider = async () => {
    const container = document.getElementById('newep-container');
    if (!container) return;

    // 1. SHOW SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Release Schedule</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    // --- SETUP LIVE LISTENER ---
    try {
        await initFirebaseNewEp();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        if (window.app.auth) {
            onAuthStateChanged(window.app.auth, (user) => {
                if (window.app.state.newEpSliderUnsubscribe) {
                    window.app.state.newEpSliderUnsubscribe();
                }
                
                if (user && !user.isAnonymous) {
                    const libRef = collection(window.app.db, "users", user.uid, "library");
                    window.app.state.newEpSliderUnsubscribe = onSnapshot(libRef, (snapshot) => {
                        window.app.state.carouselLibrarySet.clear();
                        snapshot.forEach(doc => {
                            window.app.state.carouselLibrarySet.add(String(doc.id));
                        });
                        
                        document.querySelectorAll('.newep-lib-btn').forEach(btn => {
                            const id = btn.getAttribute('data-id');
                            if (id) {
                                const isAdded = window.app.state.carouselLibrarySet.has(id);
                                window.app.updateNewEpBtnUI(btn, isAdded);
                            }
                        });
                    });
                } else {
                    window.app.state.carouselLibrarySet.clear();
                    document.querySelectorAll('.newep-lib-btn').forEach(btn => {
                        window.app.updateNewEpBtnUI(btn, false);
                    });
                }
            });
        }
    } catch (fbErr) {
        console.error("New Ep Slider Live Listener failed:", fbErr);
    }

    try {
        // 2. FETCH ANILIST DATA
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 25) { 
                    media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) { 
                        id
                        title { english romaji } 
                        coverImage { extraLarge } 
                        format
                        nextAiringEpisode {
                            episode
                            airingAt
                            timeUntilAiring
                        }
                    } 
                } 
            }
        `;
        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aniQuery })
        });
        const aniData = await aniRes.json();
        
        let releasingList = (aniData?.data?.Page?.media || []).filter(anime => anime.nextAiringEpisode);
        releasingList.sort((a, b) => a.nextAiringEpisode.timeUntilAiring - b.nextAiringEpisode.timeUntilAiring);

        // 3. CROSS-REFERENCE API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        const crossReferenced = await Promise.all(releasingList.map(async (ani) => {
            const title = ani.title.english || ani.title.romaji;
            try {
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(title)}`);
                const searchJson = await searchRes.json();
                
                const results = searchJson.data || searchJson.results || [];
                if (results.length > 0) {
                    const match = results[0]; 
                    return {
                        id: match.id,
                        title: title, 
                        image: ani.coverImage.extraLarge || match.image || match.poster, 
                        type: match.type || ani.format || 'TV',
                        sub: match.tvInfo?.sub || match.sub || '?',
                        dub: match.tvInfo?.dub || match.dub || 0,
                        nextEpData: ani.nextAiringEpisode
                    };
                }
            } catch(e) {}
            return null; 
        }));

        const finalSliderItems = crossReferenced.filter(item => item !== null);

        if (finalSliderItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 4. RENDER CARDS
        let cardsHtml = finalSliderItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const attrTitle = anime.title.replace(/"/g, '&quot;'); // For HTML data attributes
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            const epNumber = anime.nextEpData.episode;
            const targetTimestampMs = anime.nextEpData.airingAt * 1000;

            return `
            <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-black">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none"></div>

                    <!-- Permanent Save Button -->
                    <button onclick="window.app.toggleNewEpLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            data-id="${docIdStr}"
                            class="newep-lib-btn absolute top-2 right-2 z-30 p-2 rounded ${isAdded ? 'bg-black/80' : 'bg-black/70'} backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        <span class="bg-black/80 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                    </div>

                    <!-- Live Timer -->
                    <div class="absolute bottom-0 left-0 w-full p-2 z-20 flex flex-col items-center justify-end pointer-events-none">
                        <span class="text-white text-[10px] md:text-xs font-black uppercase tracking-widest drop-shadow-md mb-1 border-b border-white/20 pb-1">
                            Episode ${epNumber}
                        </span>
                        <div class="live-ep-timer bg-[#F47521] text-black text-[10px] md:text-xs font-mono font-black px-2 py-1 rounded shadow-[0_0_10px_rgba(244,117,33,0.5)] tracking-tight w-full text-center" 
                             data-target="${targetTimestampMs}"
                             data-id="${docIdStr}"
                             data-title="${attrTitle}"
                             data-image="${anime.image}"
                             data-ep="${epNumber}"
                             data-notified="false">
                            Calculating...
                        </div>
                    </div>
                </div>
                
                <h3 class="mt-2 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-white transition-colors drop-shadow-md">${anime.title}</h3>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Release Schedule
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="newep-slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="newep-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="newep-slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. START LIVE COUNTDOWN TIMER & AUTO-NOTIFY LOGIC
        if (window.app.state.newEpTimerInterval) {
            clearInterval(window.app.state.newEpTimerInterval);
        }
        
        const updateTimers = () => {
            const timerElements = document.querySelectorAll('.live-ep-timer');
            if (timerElements.length === 0) return;

            const now = new Date().getTime();

            timerElements.forEach(el => {
                const target = parseInt(el.getAttribute('data-target'));
                const diff = target - now;

                if (diff <= 0) {
                    el.innerHTML = '<i class="fas fa-broadcast-tower animate-pulse mr-1"></i> AIRING NOW';
                    el.classList.add('bg-red-500', 'text-white');
                    el.classList.remove('bg-[#F47521]', 'text-black');

                    // Trigger Push Notification if they have it saved and it just hit zero
                    if (el.getAttribute('data-notified') === 'false') {
                        el.setAttribute('data-notified', 'true');
                        
                        const aId = el.getAttribute('data-id');
                        const aTitle = el.getAttribute('data-title');
                        const aImg = el.getAttribute('data-image');
                        const aEp = el.getAttribute('data-ep');

                        if (window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(aId)) {
                            window.app.triggerEpisodeReleaseNotification(aId, aTitle, aImg, aEp);
                        }
                    }
                    return;
                }

                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const m = Math.floor((diff / 1000 / 60) % 60);
                const s = Math.floor((diff / 1000) % 60);

                let timeStr = '';
                if (d > 0) timeStr += `${d}d `;
                timeStr += `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                
                el.innerText = timeStr;
            });
        };
        
        updateTimers(); 
        window.app.state.newEpTimerInterval = setInterval(updateTimers, 1000);

        // 6. ATTACH SCROLL LOGIC
        const track = document.getElementById('newep-slider-track');
        const leftBtn = document.getElementById('newep-slide-left-btn');
        const rightBtn = document.getElementById('newep-slide-right-btn');
        
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
        console.error("New Ep Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};
