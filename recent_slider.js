// recent_slider.js - Latest Releases Slider (Live Sync, Deterministic Notifications, Release Baseline)

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};
if (!window.app.state.carouselLibrarySet) window.app.state.carouselLibrarySet = new Set();

// --- SAFE FIREBASE INIT ---
let firebaseInitRecent = false;
const initFirebaseRecent = async () => {
    if (firebaseInitRecent) return;
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
        firebaseInitRecent = true;
    } catch (err) {
        console.error("Firebase Init Error (Recent Slider):", err);
    }
};

// --- SVG UI UPDATER ---
window.app.updateRecentBtnUI = (btn, isAdded) => {
    if (!btn) return;
    const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
    const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;
    
    btn.dataset.added = isAdded ? "true" : "false";
    btn.innerHTML = isAdded ? savedSvg : unsavedSvg;
    
    btn.classList.remove('bg-black/50', 'bg-black/70', 'bg-black/80');
    btn.classList.add(isAdded ? 'bg-black/80' : 'bg-black/70');
};

// --- INSTANT SAVE & NOTIFY LOGIC ---
window.app.toggleRecentLibrary = async (event, btn, id, title, img, ep = 0, status = 'RELEASING') => {
    event.stopPropagation(); 
    
    try {
        await initFirebaseRecent();
        const { doc, setDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        
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
        const notifDocRef = doc(db, "users", auth.currentUser.uid, "notifications", `lib_${docIdStr}`);

        // Base payload for Release Manager baseline tracking
        const payload = {
            id: docIdStr,
            title,
            img,
            timestamp: Date.now(),
            lastKnownEpisode: parseInt(ep) || 0,
            releaseStatus: status
        };

        if (isAdded) {
            // Optimistic UI update
            window.app.updateRecentBtnUI(btn, false);
            window.app.state.carouselLibrarySet.delete(docIdStr);

            // DB Updates
            await deleteDoc(libDocRef);
            await setDoc(notifDocRef, {
                id: `lib_${docIdStr}`,
                type: 'library',
                title: 'Library Updated',
                message: `You removed ${title} from your library.`,
                image: img,
                animeId: docIdStr, // Required for Info.html routing
                timestamp: Date.now(),
                read: false
            }, { merge: true });

            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
        } else {
            // Optimistic UI update
            window.app.updateRecentBtnUI(btn, true);
            window.app.state.carouselLibrarySet.add(docIdStr);

            // DB Updates
            await setDoc(libDocRef, payload, { merge: true });
            await setDoc(notifDocRef, {
                id: `lib_${docIdStr}`,
                type: 'library',
                title: 'Library Updated',
                message: `You added ${title} to your library!`,
                image: img,
                animeId: docIdStr, // Required for Info.html routing
                timestamp: Date.now(),
                read: false
            }, { merge: true });

            if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
        }
    } catch (error) { 
        console.error("Library sync error:", error);
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
    }
};

window.app.components.recentSlider = async () => {
    const container = document.getElementById('recent-container');
    if (!container) return;

    // 1. SHOW SKELETON (140px / 190px sizes)
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Newest Releases</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    // --- SETUP LIVE LISTENER ---
    try {
        await initFirebaseRecent();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        if (window.app.auth) {
            onAuthStateChanged(window.app.auth, (user) => {
                if (window.app.state.recentSliderUnsubscribe) {
                    window.app.state.recentSliderUnsubscribe();
                }
                
                if (user && !user.isAnonymous) {
                    const libRef = collection(window.app.db, "users", user.uid, "library");
                    window.app.state.recentSliderUnsubscribe = onSnapshot(libRef, (snapshot) => {
                        window.app.state.carouselLibrarySet.clear();
                        snapshot.forEach(doc => {
                            window.app.state.carouselLibrarySet.add(String(doc.id));
                        });
                        
                        document.querySelectorAll('.recent-lib-btn').forEach(btn => {
                            const id = btn.getAttribute('data-id');
                            if (id) {
                                const isAdded = window.app.state.carouselLibrarySet.has(id);
                                window.app.updateRecentBtnUI(btn, isAdded);
                            }
                        });
                    });
                } else {
                    window.app.state.carouselLibrarySet.clear();
                    document.querySelectorAll('.recent-lib-btn').forEach(btn => {
                        window.app.updateRecentBtnUI(btn, false);
                    });
                }
            });
        }
    } catch (fbErr) {
        console.error("Recent Slider Live Listener failed:", fbErr);
    }

    try {
        // 2. FETCH LATEST EPISODES FROM CUSTOM API
        const baseUrl = 'https://anikoto-api-lyart.vercel.app';
        const rawResponse = await fetch(`${baseUrl}/api/latest-episodes`);
        const response = await rawResponse.json();
        
        const recentEpisodes = response.data || response.results || [];

        if (recentEpisodes.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // Limit to top 15 to keep it fast
        const topRecent = recentEpisodes.slice(0, 15);

        // 3. ENRICH WITH ANILIST HIGH-RES COVERS & STATUS (Parallel Fetch)
        const enrichedSlides = await Promise.all(topRecent.map(async (slide) => {
            const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
            let finalImage = slide.image || slide.poster;
            let finalStatus = 'RELEASING'; // Safe default for latest episodes
            
            try {
                const query = `query ($search: String) { 
                    Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                        coverImage { extraLarge } 
                        status
                    } 
                }`;
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: cleanTitle } })
                });
                const aniData = await aniRes.json();
                if (aniData?.data?.Media) {
                    if (aniData.data.Media.coverImage?.extraLarge) {
                        finalImage = aniData.data.Media.coverImage.extraLarge;
                    }
                    if (aniData.data.Media.status) {
                        finalStatus = aniData.data.Media.status;
                    }
                }
            } catch(e) {}

            return {
                id: slide.id,
                title: cleanTitle,
                image: finalImage,
                episode: slide.episodeNumber || slide.episode || null,
                type: slide.type || 'TV',
                sub: slide.tvInfo?.sub || slide.sub || '?',
                dub: slide.tvInfo?.dub || slide.dub || 0,
                status: finalStatus
            };
        }));

        // 4. RENDER CARDS
        let cardsHtml = enrichedSlides.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            const epBadge = anime.episode ? `<span class="bg-white text-black text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-black border border-black/10">EP ${anime.episode}</span>` : '';

            return `
            <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <button onclick="window.app.toggleRecentLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}', ${anime.episode || 0}, '${anime.status}')" 
                            data-added="${isAdded}"
                            data-id="${docIdStr}"
                            class="recent-lib-btn absolute top-2 right-2 z-30 p-2 rounded ${isAdded ? 'bg-black/80' : 'bg-black/70'} backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        ${epBadge}
                        <span class="bg-[#F47521]/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold">CC ${anime.sub}</span>
                        ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold"><i class="fas fa-microphone text-[10px]"></i> ${anime.dub}</span>` : ''}
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
                        Newest Releases
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="recent-slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="recent-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="recent-slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        const track = document.getElementById('recent-slider-track');
        const leftBtn = document.getElementById('recent-slide-left-btn');
        const rightBtn = document.getElementById('recent-slide-right-btn');
        
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
        console.error("Recent Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};
