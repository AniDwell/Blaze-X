// top10_slider.js - Top 10 Slider (Live Sync, Deterministic Notifications, Release Baseline)

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};
if (!window.app.state.carouselLibrarySet) window.app.state.carouselLibrarySet = new Set();

// --- SAFE FIREBASE INIT ---
let firebaseInitTop10 = false;
const initFirebaseTop10 = async () => {
    if (firebaseInitTop10) return;
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
        firebaseInitTop10 = true;
    } catch (err) {
        console.error("Firebase Init Error (Top 10 Slider):", err);
    }
};

// --- SVG UI UPDATER ---
window.app.updateTop10BtnUI = (btn, isAdded) => {
    if (!btn) return;
    const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
    const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;
    
    btn.dataset.added = isAdded ? "true" : "false";
    btn.innerHTML = isAdded ? savedSvg : unsavedSvg;
    
    btn.classList.remove('bg-black/50', 'bg-black/70', 'bg-black/80');
    btn.classList.add(isAdded ? 'bg-black/80' : 'bg-black/50');
};

// --- INSTANT SAVE & NOTIFY LOGIC ---
window.app.toggleTop10Library = async (event, btn, id, title, img, episodes = 0, status = 'UNKNOWN') => {
    event.stopPropagation(); 
    
    try {
        await initFirebaseTop10();
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
        const formattedAnime = {
            id: docIdStr,
            title,
            img,
            timestamp: Date.now(),
            lastKnownEpisode: parseInt(episodes) || 0,
            releaseStatus: status
        };

        if (isAdded) {
            // Optimistic UI update
            window.app.updateTop10BtnUI(btn, false);
            window.app.state.carouselLibrarySet.delete(docIdStr);

            // DB Updates
            await deleteDoc(libDocRef);
            await setDoc(notifDocRef, {
                id: `lib_${docIdStr}`,
                type: 'library',
                title: 'Library Updated',
                message: `You removed ${title} from your library.`,
                image: img,
                animeId: docIdStr,
                timestamp: Date.now(),
                read: false
            }, { merge: true });

            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
        } else {
            // Optimistic UI update
            window.app.updateTop10BtnUI(btn, true);
            window.app.state.carouselLibrarySet.add(docIdStr);

            // DB Updates
            await setDoc(libDocRef, formattedAnime, { merge: true });
            await setDoc(notifDocRef, {
                id: `lib_${docIdStr}`,
                type: 'library',
                title: 'Library Updated',
                message: `You added ${title} to your library!`,
                image: img,
                animeId: docIdStr,
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

window.app.components.topTenSlider = async () => {
    const container = document.getElementById('top10-slider-container');
    if (!container) return;
    if (window.app.state.currentView !== 'home') return;
    const currentYear = new Date().getFullYear();

    // 1. INJECT CUSTOM CSS SCALED DOWN SLIGHTLY
    if (!document.getElementById('top10-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'top10-custom-styles';
        style.innerHTML = `
            .top10-swiper {
                width: 100%;
                height: auto;
                overflow: visible; 
                position: relative;
                margin: 10px 0;
            }
            .top10-swiper-wrapper {
                display: flex;
                align-items: flex-start;
                gap: 28px;  
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                padding: 10px 10px 30px 45px; 
                scrollbar-width: none;  
            }
            .top10-swiper-wrapper::-webkit-scrollbar {
                display: none; 
            }
            .top10-swiper-slide {
                flex: 0 0 auto;
                width: 140px; 
                scroll-snap-align: center;
                position: relative;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            @media (min-width: 768px) {
                .top10-swiper-slide { width: 190px; } 
            }
            .top10-swiper-slide:hover {
                transform: scale(1.03);
                z-index: 20;
            }
            .top10-slide-number {
                position: absolute;
                bottom: -5px;
                left: -35px; 
                color: white;  
                font-size: 100px; 
                line-height: 0.8;
                font-weight: bold;
                padding: 8px 14px;
                border-radius: 14px;
                text-shadow: 0 0 14px rgba(0,0,0,0.9), 0 0 25px rgba(0,0,0,0.7);
                background: rgba(0,0,0,0.15);
                z-index: 10;
                pointer-events: none; 
            }
            @media (min-width: 768px) {
                .top10-slide-number {
                    font-size: 120px; 
                    left: -45px; 
                }
            }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div class="px-4 md:px-8 py-2">
            <h2 class="text-xl md:text-2xl font-black text-white mb-2 pl-3 drop-shadow-md">Top 10 Anime of ${currentYear}</h2>
            <div class="top10-swiper-wrapper">
                ${[1, 2, 3, 4, 5].map((num) => `
                    <div class="top10-swiper-slide">
                        <div class="relative w-full aspect-[2/3] bg-white/5 animate-pulse rounded-[16px]">
                            <span class="top10-slide-number text-gray-700">${num}</span>
                        </div>
                        <div class="w-3/4 h-4 bg-white/5 animate-pulse rounded mt-3"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // --- SETUP LIVE LISTENER ---
    try {
        await initFirebaseTop10();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        if (window.app.auth) {
            onAuthStateChanged(window.app.auth, (user) => {
                if (window.app.state.top10SliderUnsubscribe) {
                    window.app.state.top10SliderUnsubscribe();
                }
                
                if (user && !user.isAnonymous) {
                    const libRef = collection(window.app.db, "users", user.uid, "library");
                    window.app.state.top10SliderUnsubscribe = onSnapshot(libRef, (snapshot) => {
                        window.app.state.carouselLibrarySet.clear();
                        snapshot.forEach(doc => {
                            window.app.state.carouselLibrarySet.add(String(doc.id));
                        });
                        
                        document.querySelectorAll('.top10-lib-btn').forEach(btn => {
                            const id = btn.getAttribute('data-id');
                            if (id) {
                                const isAdded = window.app.state.carouselLibrarySet.has(id);
                                window.app.updateTop10BtnUI(btn, isAdded);
                            }
                        });
                    });
                } else {
                    window.app.state.carouselLibrarySet.clear();
                    document.querySelectorAll('.top10-lib-btn').forEach(btn => {
                        window.app.updateTop10BtnUI(btn, false);
                    });
                }
            });
        }
    } catch (fbErr) {
        console.error("Top 10 Slider Live Listener failed:", fbErr);
    }

    try {
        const aniQuery = `
            query($year: Int) { 
                Page(page: 1, perPage: 25) { 
                    media(type: ANIME, seasonYear: $year, sort: POPULARITY_DESC) { 
                        title { english romaji } 
                        coverImage { extraLarge } 
                    } 
                } 
            }
        `;
        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aniQuery, variables: { year: currentYear } })
        });
        const aniData = await aniRes.json();
        const topAnimeList = aniData?.data?.Page?.media || [];

        const baseUrl = 'https://anikoto-api-lyart.vercel.app';
        
        const crossReferenced = await Promise.all(topAnimeList.map(async (ani) => {
            const title = ani.title.english || ani.title.romaji;
            try {
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(title)}`);
                const searchJson = await searchRes.json();
                const results = searchJson.data || searchJson.results || [];
                if (results.length > 0) {
                    const match = results[0]; 
                    
                    let epCount = match.episodes?.sub || match.episodes?.dub || match.episodes || match.episodeCount || 0;
                    if (typeof epCount === 'object') epCount = 0;

                    return {
                        id: match.id,
                        title: title, 
                        image: ani.coverImage.extraLarge || match.image || match.poster, 
                        type: match.type || 'TV',
                        sub: match.tvInfo?.sub || match.sub || '?',
                        dub: match.tvInfo?.dub || match.dub || 0,
                        episodes: parseInt(epCount, 10) || 0,
                        status: match.status || 'UNKNOWN'
                    };
                }
            } catch(e) {}
            return null; 
        }));

        const finalTop10 = crossReferenced.filter(item => item !== null).slice(0, 10);

        if (finalTop10.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        let slidesHtml = finalTop10.map((anime, index) => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const rank = index + 1;
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            return `
                <div class="top10-swiper-slide group" onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                    <div class="relative w-full aspect-[2/3] rounded-[16px] shadow-[0_6px_18px_rgba(0,0,0,0.35)] group-hover:border-[#F47521]/70 border border-transparent transition-colors">
                        <span class="top10-slide-number">${rank}</span>
                        <img src="${anime.image}" alt="Slide ${rank}" class="w-full h-full object-cover rounded-[16px] block">
                        <button onclick="window.app.toggleTop10Library(event, this, '${anime.id}', '${safeTitle}', '${anime.image}', ${anime.episodes}, '${anime.status}')" 
                                data-added="${isAdded}"
                                data-id="${docIdStr}"
                                class="top10-lib-btn absolute top-2 right-2 z-30 p-2 rounded-[8px] ${isAdded ? 'bg-black/80' : 'bg-black/50'} backdrop-blur-md border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)] hover:bg-black/90 hover:scale-110 transition-all flex items-center justify-center">
                            ${isAdded ? savedSvg : unsavedSvg}
                        </button>
                    </div>
                    <h3 class="mt-3 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-white transition-colors drop-shadow-md pl-1">${anime.title}</h3>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="pt-6 relative overflow-visible">
                <div class="px-4 md:px-8 flex items-center justify-between">
                    <h2 class="text-xl md:text-2xl font-black text-white drop-shadow-md border-l-4 border-[#F47521] pl-3 uppercase tracking-wider">
                        Top 10 of ${currentYear}
                    </h2>
                </div>
                <div class="top10-swiper">
                    <div class="top10-swiper-wrapper">
                        ${slidesHtml}
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        container.innerHTML = ''; 
    }
};
