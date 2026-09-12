// upcoming_slider.js - 100% AniList Upcoming Slider & Full-Screen Detail Modal (Live Sync & Deterministic Premiere Notifs)

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};
if (!window.app.state.carouselLibrarySet) window.app.state.carouselLibrarySet = new Set();

// --- Helper: Format AniList Date ---
const formatAniListDate = (dateObj) => {
    if (!dateObj || !dateObj.year) return "TBA";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (dateObj.month && dateObj.day) return `${months[dateObj.month - 1]} ${dateObj.day}, ${dateObj.year}`;
    if (dateObj.month) return `${months[dateObj.month - 1]} ${dateObj.year}`;
    return `${dateObj.year}`;
};

// --- SAFE FIREBASE INIT ---
let firebaseInitUpcoming = false;
const initFirebaseUpcoming = async () => {
    if (firebaseInitUpcoming) return;
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
        firebaseInitUpcoming = true;
    } catch (err) {
        console.error("Firebase Init Error (Upcoming Slider):", err);
    }
};

// --- SVG UI UPDATER ---
window.app.updateUpcomingBtnUI = (btn, isAdded) => {
    if (!btn) return;
    const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
    const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;
    
    btn.dataset.added = isAdded ? "true" : "false";
    btn.innerHTML = isAdded ? savedSvg : unsavedSvg;
    
    btn.classList.remove('bg-black/50', 'bg-black/70', 'bg-black/80');
    btn.classList.add(isAdded ? 'bg-black/80' : 'bg-black/70');
};

// --- INSTANT SAVE & NOTIFY LOGIC ---
window.app.toggleUpcomingLibrary = async (event, btn, id, title, img, knownEpisodeCount = 0) => {
    event.stopPropagation(); 
    
    try {
        await initFirebaseUpcoming();
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

        // Ensure Release Tracking Baseline is integrated even for Upcoming
        const payload = {
            id: docIdStr,
            title,
            img,
            timestamp: Date.now(),
            lastKnownEpisode: knownEpisodeCount, 
            releaseStatus: 'NOT_YET_RELEASED'
        };

        if (isAdded) {
            window.app.updateUpcomingBtnUI(btn, false);
            window.app.state.carouselLibrarySet.delete(docIdStr);

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
            window.app.updateUpcomingBtnUI(btn, true);
            window.app.state.carouselLibrarySet.add(docIdStr);

            await setDoc(libDocRef, payload, { merge: true });
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

// --- DETERMINISTIC PREMIERE RELEASE NOTIFICATION LOGIC ---
window.app.triggerUpcomingReleaseNotification = async (id, title, img, ep) => {
    try {
        await initFirebaseUpcoming();
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const auth = window.app.auth;
        
        if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
            // UNIQUE DETERMINISTIC ID -> Prevents duplicate creation
            const notifId = `ep_release_${id}_${ep}`;
            const notifRef = doc(window.app.db, "users", auth.currentUser.uid, "notifications", notifId);
            
            await setDoc(notifRef, {
                id: notifId,
                type: 'episode_released', // Standardized for notification UI mapping
                title: 'New Series Premiere!',
                message: `${title} Episode ${ep} has officially started airing!`,
                image: img,
                timestamp: Date.now(),
                animeId: id,
                read: false
            }, { merge: true });

            if (window.app.showCustomAlert) window.app.showCustomAlert(`${title} is now out!`, "success");
        }
    } catch (err) {
        console.error("Failed to push release notification", err);
    }
};

// --- MODAL LOGIC (Bottom Sheet to Full Screen) ---
window.app.openUpcomingModal = async (animeId) => {
    if (!document.getElementById('upcoming-modal-wrapper')) {
        const modalHtml = `
            <div id="upcoming-modal-wrapper" class="fixed inset-0 z-[9999] flex flex-col justify-end pointer-events-none">
                <div id="upcoming-modal-backdrop" class="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 transition-opacity duration-500 pointer-events-auto"></div>
                
                <div id="upcoming-modal-content" class="w-full h-[95vh] md:h-[100vh] bg-[#0a0a0a] rounded-t-3xl md:rounded-none transform translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] pointer-events-auto flex flex-col overflow-hidden relative shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                    
                    <button id="upcoming-close-btn-top" class="absolute top-4 right-4 md:top-6 md:right-6 z-[60] w-10 h-10 bg-black/50 hover:bg-[#F47521] backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors border border-white/10 shadow-lg">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                    
                    <div class="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full z-[60] md:hidden"></div>

                    <div id="upcoming-modal-scroll" class="flex-1 overflow-y-auto hide-scrollbar relative pb-20">
                        <div id="upcoming-modal-body" class="min-h-full">
                            <div class="flex flex-col items-center justify-center h-[50vh] text-[#F47521]">
                                <i class="fas fa-circle-notch fa-spin text-4xl mb-4"></i>
                                <p class="text-sm font-bold tracking-widest uppercase text-white">Fetching Details...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const wrapper = document.getElementById('upcoming-modal-wrapper');
    const backdrop = document.getElementById('upcoming-modal-backdrop');
    const content = document.getElementById('upcoming-modal-content');
    const body = document.getElementById('upcoming-modal-body');
    const closeBtnTop = document.getElementById('upcoming-close-btn-top');
    
    wrapper.classList.remove('hidden');
    void wrapper.offsetWidth;
    
    backdrop.classList.remove('opacity-0');
    backdrop.classList.add('opacity-100');
    content.classList.remove('translate-y-full');
    content.classList.add('translate-y-0');

    // Clean Event Listener Attachment
    const closeHandler = () => window.app.closeUpcomingModal();
    backdrop.onclick = closeHandler;
    closeBtnTop.onclick = closeHandler;

    try {
        const query = `
            query($id: Int) { 
                Media(id: $id) { 
                    title { english romaji native }
                    coverImage { extraLarge }
                    bannerImage
                    format
                    episodes
                    status
                    description(asHtml: false)
                    startDate { year month day }
                    genres
                    studios(isMain: true) { nodes { name } }
                    trailer { id site }
                    recommendations(page: 1, perPage: 8, sort: RATING_DESC) {
                        nodes { mediaRecommendation { id title { english romaji } coverImage { large } format status } }
                    }
                } 
            }
        `;
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: parseInt(animeId) } })
        });
        const json = await res.json();
        const data = json.data.Media;

        const title = data.title.english || data.title.romaji;
        const banner = data.bannerImage || 'https://via.placeholder.com/1200x400/111/111';
        const cover = data.coverImage.extraLarge;
        const releaseDate = formatAniListDate(data.startDate);
        const description = (data.description || "No description available yet.").replace(/<[^>]*>?/gm, '');
        const studio = data.studios?.nodes?.[0]?.name || "Unknown Studio";
        
        let trailerHtml = '';
        if (data.trailer && data.trailer.site === 'youtube') {
            trailerHtml = `
                <div class="w-full max-w-4xl mx-auto mt-8 px-4">
                    <h3 class="text-white font-black text-lg mb-3 uppercase tracking-wider border-l-4 border-[#F47521] pl-2">Official Trailer</h3>
                    <div class="relative w-full aspect-video rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5">
                        <iframe class="absolute inset-0 w-full h-full" src="https://www.youtube.com/embed/${data.trailer.id}" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>
            `;
        }

        let genresHtml = (data.genres || []).map(g => `<span class="bg-white/10 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-gray-300 shadow-sm">${g}</span>`).join('');

        let recsHtml = '';
        const recs = (data.recommendations?.nodes || []).filter(n => n.mediaRecommendation);
        if (recs.length > 0) {
            recsHtml = `
                <div class="w-full mt-10 px-4 pb-10">
                    <h3 class="text-white font-black text-lg mb-4 uppercase tracking-wider border-l-4 border-[#F47521] pl-2">Similar Anime</h3>
                    <div class="flex gap-3 overflow-x-auto hide-scrollbar snap-x pb-4">
                        ${recs.map(r => {
                            const recAnime = r.mediaRecommendation;
                            const rTitle = recAnime.title.english || recAnime.title.romaji;
                            return `
                                <div class="snap-start shrink-0 w-[110px] md:w-[140px] relative group border border-white/5 rounded-lg overflow-hidden">
                                    <div class="w-full aspect-[2/3]">
                                        <img src="${recAnime.coverImage.large}" class="w-full h-full object-cover">
                                    </div>
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                    <div class="absolute bottom-0 left-0 w-full p-2">
                                        <h4 class="text-white text-[10px] md:text-xs font-bold truncate drop-shadow-md">${rTitle}</h4>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        body.innerHTML = `
            <div class="relative w-full h-48 md:h-72 bg-[#111]">
                <img src="${banner}" class="w-full h-full object-cover opacity-40">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-transparent to-transparent"></div>
            </div>
            <div class="relative px-4 md:px-10 -mt-20 md:-mt-32 z-10">
                <div class="flex gap-4 md:gap-8 items-end md:items-stretch">
                    <div class="w-28 md:w-48 shrink-0 relative">
                        <img src="${cover}" class="w-full aspect-[2/3] object-cover rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border-2 border-white/10">
                        <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#F47521] text-white text-[9px] md:text-xs font-black uppercase px-3 py-1 rounded shadow-lg whitespace-nowrap">
                            ${data.status.replace(/_/g, ' ')}
                        </div>
                    </div>
                    <div class="flex-1 pb-2 md:py-6">
                        <h2 class="text-xl md:text-4xl font-black text-white leading-tight drop-shadow-lg mb-1 md:mb-2">${title}</h2>
                        <h3 class="text-xs md:text-sm text-gray-400 font-bold mb-3 line-clamp-1">${data.title.native || ''}</h3>
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <span class="bg-white/10 text-white text-[10px] md:text-xs px-2 py-0.5 rounded font-bold uppercase border border-white/5">${data.format || 'TV'}</span>
                            <span class="bg-black/50 text-[#F47521] border border-[#F47521]/30 text-[10px] md:text-xs px-2 py-0.5 rounded font-bold">SUB: TBA</span>
                            <span class="bg-black/50 text-purple-400 border border-purple-400/30 text-[10px] md:text-xs px-2 py-0.5 rounded font-bold">DUB: TBA</span>
                        </div>
                        <p class="text-gray-300 text-xs md:text-sm font-semibold flex items-center gap-2">
                            <i class="far fa-calendar-alt text-[#F47521]"></i> 
                            Airing: <span class="text-white">${releaseDate}</span>
                        </p>
                    </div>
                </div>
            </div>
            <div class="px-4 md:px-10 mt-8 max-w-4xl mx-auto">
                <div class="flex flex-wrap gap-2 mb-6">
                    ${genresHtml}
                </div>
                <div class="bg-white/5 border border-white/5 rounded-xl p-4 md:p-6 shadow-lg">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-gray-400 text-xs font-bold uppercase tracking-widest">Studio</span>
                        <span class="text-white text-sm md:text-base font-black">${studio}</span>
                    </div>
                    <p class="text-sm md:text-base text-gray-300 leading-relaxed font-medium">
                        ${description}
                    </p>
                </div>
            </div>
            ${trailerHtml}
            ${recsHtml}
        `;

    } catch (e) {
        console.error(e);
        body.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">Failed to load details. Try again.</div>`;
    }
};

window.app.closeUpcomingModal = () => {
    const backdrop = document.getElementById('upcoming-modal-backdrop');
    const content = document.getElementById('upcoming-modal-content');
    
    if (backdrop && content) {
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
        content.classList.remove('translate-y-0');
        content.classList.add('translate-y-full');
        setTimeout(() => {
            const wrapper = document.getElementById('upcoming-modal-wrapper');
            if (wrapper) wrapper.classList.add('hidden');
        }, 500); 
    }
};

// --- SLIDER RENDERING ---
window.app.components.upcomingSlider = async () => {
    const container = document.getElementById('upcoming-slider-container');
    if (!container) return;

    // 1. SHOW SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Upcoming Releases</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5].map(() => `
                    <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    // --- SETUP LIVE LISTENER ---
    try {
        await initFirebaseUpcoming();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        if (window.app.auth) {
            onAuthStateChanged(window.app.auth, (user) => {
                if (window.app.state.upcomingSliderUnsubscribe) {
                    window.app.state.upcomingSliderUnsubscribe();
                }
                
                if (user && !user.isAnonymous) {
                    const libRef = collection(window.app.db, "users", user.uid, "library");
                    window.app.state.upcomingSliderUnsubscribe = onSnapshot(libRef, (snapshot) => {
                        window.app.state.carouselLibrarySet.clear();
                        snapshot.forEach(doc => {
                            window.app.state.carouselLibrarySet.add(String(doc.id));
                        });
                        
                        document.querySelectorAll('.upcoming-lib-btn').forEach(btn => {
                            const id = btn.getAttribute('data-id');
                            if (id) {
                                const isAdded = window.app.state.carouselLibrarySet.has(id);
                                window.app.updateUpcomingBtnUI(btn, isAdded);
                            }
                        });
                    });
                } else {
                    window.app.state.carouselLibrarySet.clear();
                    document.querySelectorAll('.upcoming-lib-btn').forEach(btn => {
                        window.app.updateUpcomingBtnUI(btn, false);
                    });
                }
            });
        }
    } catch (fbErr) {
        console.error("Upcoming Slider Live Listener failed:", fbErr);
    }

    try {
        // 2. FETCH FROM ANILIST (Added nextAiringEpisode for Premiere Notifications)
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 15) { 
                    media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) { 
                        id
                        title { english romaji } 
                        coverImage { extraLarge } 
                        startDate { year month day }
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
        const upcomingList = aniData?.data?.Page?.media || [];

        if (upcomingList.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 3. RENDER CARDS
        let cardsHtml = upcomingList.map(anime => {
            const safeTitle = (anime.title.english || anime.title.romaji).replace(/'/g, "\\'");
            const attrTitle = (anime.title.english || anime.title.romaji).replace(/"/g, '&quot;');
            const docIdStr = String(anime.id);
            const releaseDate = formatAniListDate(anime.startDate);
            const format = anime.format || 'TV';
            
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            // Base tracking config
            const nextEpNum = anime.nextAiringEpisode ? anime.nextAiringEpisode.episode : 0;
            const currentKnownEp = Math.max(0, nextEpNum - 1); 

            // Invisible tracker for pushing release notifications dynamically
            let hiddenTimerHtml = '';
            if (anime.nextAiringEpisode) {
                const targetTimestampMs = anime.nextAiringEpisode.airingAt * 1000;
                hiddenTimerHtml = `<div class="upcoming-live-timer hidden" data-target="${targetTimestampMs}" data-id="${docIdStr}" data-title="${attrTitle}" data-image="${anime.coverImage.extraLarge}" data-ep="${anime.nextAiringEpisode.episode}" data-notified="false"></div>`;
            }

            return `
            <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.openUpcomingModal('${anime.id}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-black">
                    <img src="${anime.coverImage.extraLarge}" loading="lazy" class="w-full h-full object-cover">
                    
                    ${hiddenTimerHtml}

                    <button onclick="window.app.toggleUpcomingLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.coverImage.extraLarge}', ${currentKnownEp})" 
                            data-added="${isAdded}"
                            data-id="${docIdStr}"
                            class="upcoming-lib-btn absolute top-2 right-2 z-30 p-2 rounded ${isAdded ? 'bg-black/80' : 'bg-black/70'} backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <div class="absolute bottom-2 left-2 z-20 pointer-events-none">
                        <span class="bg-[#F47521] text-white text-[9px] md:text-[10px] px-1.5 py-1 rounded shadow-md font-black uppercase tracking-wide">
                            ${releaseDate}
                        </span>
                    </div>
                    
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        <span class="bg-black/80 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${format}</span>
                    </div>
                </div>
                
                <h3 class="mt-2 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-white transition-colors drop-shadow-md">${safeTitle}</h3>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Upcoming Releases
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="upcoming-slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="upcoming-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="upcoming-slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 4. START HIDDEN LIVE RELEASE CHECKER
        if (window.app.state.upcomingTimerInterval) {
            clearInterval(window.app.state.upcomingTimerInterval);
        }
        
        const checkUpcomingReleases = () => {
            const timerElements = document.querySelectorAll('.upcoming-live-timer');
            if (timerElements.length === 0) return;

            const now = new Date().getTime();

            timerElements.forEach(el => {
                const target = parseInt(el.getAttribute('data-target'));
                const diff = target - now;

                if (diff <= 0 && el.getAttribute('data-notified') === 'false') {
                    el.setAttribute('data-notified', 'true');
                    
                    const aId = el.getAttribute('data-id');
                    const aTitle = el.getAttribute('data-title');
                    const aImg = el.getAttribute('data-image');
                    const aEp = el.getAttribute('data-ep');

                    if (window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(aId)) {
                        window.app.triggerUpcomingReleaseNotification(aId, aTitle, aImg, aEp);
                    }
                }
            });
        };
        
        checkUpcomingReleases(); 
        window.app.state.upcomingTimerInterval = setInterval(checkUpcomingReleases, 1000);

        // 5. ATTACH SCROLL LOGIC
        const track = document.getElementById('upcoming-slider-track');
        const leftBtn = document.getElementById('upcoming-slide-left-btn');
        const rightBtn = document.getElementById('upcoming-slide-right-btn');
        
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
        console.error("Upcoming Slider Error:", error);
        container.innerHTML = ''; 
    }
};
