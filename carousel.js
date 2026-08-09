// carousel.js - Firestore Subcollections Native, Fixed Sync & Auth Listeners & Share Modal

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};

// In-memory set to instantly check if a carousel item is in the library
window.app.state.carouselLibrarySet = new Set();
window.app.state.libraryUnsubscribe = null; 

// --- GLOBAL FIREBASE INITIALIZATION ---
let app, auth, db;
let firebaseInitialized = false;

const initFirebase = async () => {
    if (firebaseInitialized) return;
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

        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApps()[0];
        }
        
        auth = getAuth(app);
        db = getFirestore(app);
        window.app.db = db; 
        firebaseInitialized = true;
    } catch (err) {
        console.error("Firebase Init Error:", err);
    }
};

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    // 1. SHOW LOADING SCREEN IMMEDIATELY
    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-black flex items-center justify-center border-b border-white/5">
            <div class="tk-loader scale-50">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
        </div>
    `;

    // Initialize Share Modal in DOM
    injectShareModal();

    // --- FIREBASE SYNC: Live Listener for Auth & Library ---
    try {
        await initFirebase();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        onAuthStateChanged(auth, async (user) => {
            if (window.app.state.libraryUnsubscribe) {
                window.app.state.libraryUnsubscribe(); 
            }

            if (user && !user.isAnonymous) {
                try {
                    const libRef = collection(db, "users", user.uid, "library");
                    
                    window.app.state.libraryUnsubscribe = onSnapshot(libRef, (snapshot) => {
                        window.app.state.carouselLibrarySet.clear();
                        snapshot.forEach(doc => {
                            window.app.state.carouselLibrarySet.add(String(doc.id));
                        });

                        if (document.getElementById('carousel-ui-layer')) {
                            window.app.updateCarouselUI(window.app.state.carouselCurrentIndex);
                        }
                    });
                } catch (e) {
                    console.error("Failed to sync live library for carousel:", e);
                }
            } else {
                window.app.state.carouselLibrarySet.clear();
                if (document.getElementById('carousel-ui-layer')) {
                    window.app.updateCarouselUI(window.app.state.carouselCurrentIndex);
                }
            }
        });
    } catch (fbError) {
        console.error("Firebase Auth listener failed in Carousel:", fbError);
    }

    // --- FETCH CAROUSEL DATA ---
    try {
        const topSlides = [];
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 20) { 
                    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { 
                        title { romaji english }
                        description
                        averageScore
                        coverImage { extraLarge } 
                    } 
                } 
            }
        `;

        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: aniQuery })
        });
        
        const aniData = await aniRes.json();
        const aniListMedia = aniData?.data?.Page?.media || [];

        for (const media of aniListMedia) {
            if (topSlides.length >= 5) break; 

            const romaji = media.title.romaji || '';
            const english = media.title.english || '';
            const searchKeyword = english || romaji; 

            if (!searchKeyword) continue;

            try {
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(searchKeyword)}`);
                if (!searchRes.ok) continue;

                const searchData = await searchRes.json();
                const apiResults = searchData.data || searchData.results || searchData || [];

                const exactMatch = apiResults.find(r => {
                    const apiTitle = (r.title || '').toLowerCase();
                    return apiTitle === romaji.toLowerCase() || apiTitle === english.toLowerCase();
                });

                if (!exactMatch) continue;

                topSlides.push({
                    exactId: exactMatch.id,
                    title: searchKeyword,
                    finalImage: media.coverImage?.extraLarge || 'https://via.placeholder.com/1280x720/111/fff?text=No+Image',
                    finalRating: media.averageScore || null,
                    finalDescription: media.description ? media.description.replace(/<[^>]*>?/gm, '').trim() : 'No synopsis available.',
                });

            } catch (e) {
                console.log(`Search failed for ${searchKeyword}`, e);
            }
        }

        if (topSlides.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-gray-500 text-xs border border-white/5 mx-4 rounded-xl bg-black tracking-widest uppercase">
                    <i class="fas fa-exclamation-circle mr-1 text-[#F47521]"></i> Stream Offline
                </div>
            `;
            return;
        }

        window.app.state.carouselItems = topSlides; 
        window.app.state.carouselCurrentIndex = 0;

        let imageSlidesHtml = '';
        let dotsHtml = '';

        topSlides.forEach((s, i) => {
            imageSlidesHtml += `
                <div class="absolute inset-0 cursor-pointer z-0 group overflow-hidden bg-black" id="slide-bg-${i}" style="opacity: ${i === 0 ? '1' : '0'}; z-index: ${i === 0 ? '20' : '10'}; transition: opacity 0.8s ease-in-out;" onclick="window.app.handleCarouselImageClick()">
                    <img src="${s.finalImage}" class="absolute inset-0 w-full h-full object-cover object-[center_top] transition-transform duration-[10s] group-hover:scale-105">
                </div>
            `;

            const dotClass = i === 0 
                ? 'carousel-dot w-2 h-8 bg-[#F47521] transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm'
                : 'carousel-dot w-2 h-2 bg-white/30 hover:bg-white/60 transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm';

            dotsHtml += `
                <div onclick="window.app.goToCarouselSlide(${i})" class="${dotClass}" id="dot-${i}"></div>
            `;
        });

        container.innerHTML = `
            <div class="relative w-full aspect-[4/5] md:aspect-[21/9] max-h-[75vh] overflow-hidden bg-black border-b border-white/5">
                <div id="hero-slides" class="absolute inset-0 z-0">
                    ${imageSlidesHtml}
                    <div class="absolute bottom-0 left-0 right-0 h-[65%] bg-gradient-to-t from-black via-black/90 to-transparent md:hidden z-30 pointer-events-none"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent hidden md:block w-[80%] z-30 pointer-events-none"></div>
                </div>

                <div id="carousel-ui-layer" class="absolute bottom-8 left-4 right-8 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:w-[40%] z-40 pr-4 transition-opacity duration-300 opacity-100">
                </div>
                
                <div class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col justify-center gap-2.5 z-[70]" id="carousel-indicators">
                    ${dotsHtml}
                </div>
            </div>
        `;

        window.app.updateCarouselUI(0);
        startAutoRotate();
        
    } catch (err) {
        console.error("Carousel Script Error:", err);
    }
};

window.app.updateCarouselUI = (index) => {
    const uiLayer = document.getElementById('carousel-ui-layer');
    if (!uiLayer) return;

    const data = window.app.state.carouselItems[index];
    if (!data) return;

    const docIdStr = String(data.exactId);
    const isAdded = window.app.state.carouselLibrarySet.has(docIdStr);
    const safeTitle = (data.title || 'Unknown').replace(/'/g, "\\'");

    const ratingHtml = data.finalRating ? `<span class="flex items-center gap-1"><i class="fas fa-star"></i> ${data.finalRating}% SCORE</span>` : '';

    const libraryBtnHtml = isAdded 
        ? `<button id="carousel-lib-btn" onclick="window.app.handleCarouselLibraryClick(event, ${index})" data-added="true" class="bg-white text-black px-5 py-2 md:px-6 md:py-3 rounded font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-gray-200 transition-colors border border-white flex items-center gap-2 shadow-lg">
               <i class="fas fa-check"></i> Added
           </button>`
        : `<button id="carousel-lib-btn" onclick="window.app.handleCarouselLibraryClick(event, ${index})" data-added="false" class="bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2 shadow-lg">
               <i class="fas fa-plus"></i> Library
           </button>`;

    uiLayer.style.opacity = '0';

    setTimeout(() => {
        uiLayer.innerHTML = `
            <div class="flex items-center gap-3 text-[#F47521] text-[10px] md:text-xs font-black tracking-widest drop-shadow-md mb-2 md:mb-3 uppercase pointer-events-none">
                <span class="bg-[#F47521]/10 border border-[#F47521]/30 px-2 py-0.5 rounded backdrop-blur-sm">#${index + 1} Trending</span>
                ${ratingHtml}
            </div>

            <h2 class="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] line-clamp-2 tracking-tight cursor-pointer leading-tight hover:text-[#F47521] transition-colors" onclick="window.app.handleCarouselImageClick()">${data.title || 'Unknown'}</h2>
            
            <p class="text-[11px] md:text-xs text-gray-300 line-clamp-3 md:line-clamp-4 mb-5 md:mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed font-medium pointer-events-none">${data.finalDescription}</p>
            
            <div class="flex flex-wrap gap-2.5 relative z-40">
                <button onclick="window.app.handleCarouselImageClick()" class="bg-[#F47521] text-white px-6 py-2 md:px-8 md:py-3 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                    <i class="fas fa-play"></i> Watch
                </button>
                
                ${libraryBtnHtml}
                
                <button onclick="event.stopPropagation(); window.app.openShareModal(this, '${data.exactId}', '${safeTitle}')" class="bg-white/10 backdrop-blur-md text-white px-4 py-2 md:px-5 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-[#F47521] hover:border-[#F47521] transition-colors border border-white/10 flex items-center gap-2 shadow-lg">
                    <i class="fas fa-share-nodes"></i>
                </button>
            </div>
        `;
        uiLayer.style.opacity = '1';
    }, 300);
};

window.app.handleCarouselImageClick = () => {
    const currentIndex = window.app.state.carouselCurrentIndex;
    const currentSlideData = window.app.state.carouselItems[currentIndex];
    if (currentSlideData && currentSlideData.exactId) {
        window.location.href = `info.html?id=${currentSlideData.exactId}`;
    }
};

window.app.goToCarouselSlide = (targetIndex) => {
    const currentIndex = window.app.state.carouselCurrentIndex;
    if (targetIndex === currentIndex) return;
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);
    transitionSlide(currentIndex, targetIndex);
    window.app.state.carouselCurrentIndex = targetIndex;
    startAutoRotate();
};

function transitionSlide(oldIndex, newIndex) {
    const oldSlide = document.getElementById(`slide-bg-${oldIndex}`);
    const oldDot = document.getElementById(`dot-${oldIndex}`);
    const newSlide = document.getElementById(`slide-bg-${newIndex}`);
    const newDot = document.getElementById(`dot-${newIndex}`);

    if (oldSlide) { oldSlide.style.opacity = '0'; oldSlide.classList.replace('z-20', 'z-10'); }
    if (newSlide) { newSlide.style.opacity = '1'; newSlide.classList.replace('z-10', 'z-20'); }
    if (oldDot) oldDot.className = "carousel-dot w-2 h-2 bg-white/30 hover:bg-white/60 transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm";
    if (newDot) newDot.className = "carousel-dot w-2 h-8 bg-[#F47521] transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm";
    
    window.app.updateCarouselUI(newIndex);
}

function startAutoRotate() {
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);
    window.app.state.carouselInterval = setInterval(() => {
        if (window.app.state.currentView !== 'home' || !document.getElementById('hero-slides')) {
            clearInterval(window.app.state.carouselInterval);
            return;
        }
        const count = window.app.state.carouselItems.length;
        const nextIndex = (window.app.state.carouselCurrentIndex + 1) % count;
        transitionSlide(window.app.state.carouselCurrentIndex, nextIndex);
        window.app.state.carouselCurrentIndex = nextIndex;
    }, 6000); 
}

// --- DYNAMIC LIBRARY LOGIC (ADD/REMOVE & NOTIFICATION) ---
window.app.handleCarouselLibraryClick = async (event, index) => {
    event.stopPropagation(); 
    const btn = event.currentTarget;
    
    try {
        await initFirebase(); 
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            return;
        }

        const rawData = window.app.state.carouselItems[index];
        if (!rawData) return;
        
        const docIdStr = String(rawData.exactId);
        const isAdded = btn.dataset.added === "true"; 

        const { doc, setDoc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const libDocRef = doc(db, "users", auth.currentUser.uid, "library", docIdStr);

        if (isAdded) {
            window.app.state.carouselLibrarySet.delete(docIdStr);
            btn.dataset.added = "false";
            btn.className = "bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2 shadow-lg";
            btn.innerHTML = `<i class="fas fa-plus"></i> Library`;

            await deleteDoc(libDocRef);

        } else {
            window.app.state.carouselLibrarySet.add(docIdStr);
            btn.dataset.added = "true";
            btn.className = "bg-white text-black px-5 py-2 md:px-6 md:py-3 rounded font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-gray-200 transition-colors border border-white flex items-center gap-2 shadow-lg";
            btn.innerHTML = `<i class="fas fa-check"></i> Added`;

            await setDoc(libDocRef, { 
                id: docIdStr, 
                title: rawData.title, 
                img: rawData.finalImage,
                timestamp: Date.now()
            });

            // Write Notification to Database
            try {
                const notifRef = doc(collection(db, "users", auth.currentUser.uid, "notifications"));
                await setDoc(notifRef, {
                    title: "Added to Library",
                    message: `You successfully added ${rawData.title} to your anime library.`,
                    type: "library",
                    image: rawData.finalImage,
                    timestamp: Date.now()
                });
            } catch (notifErr) { console.error("Failed to write notification", notifErr); }
        }
    } catch (error) { 
        console.error("Firebase update failed:", error); 
    }
};

// --- SHARE MODAL & LOGIC ---
function injectShareModal() {
    if (document.getElementById('carousel-share-modal')) return;
    const shareHtml = `
        <div id="carousel-share-modal" class="fixed inset-0 z-[100] pointer-events-none flex flex-col justify-end" style="visibility: hidden;">
            <div id="share-modal-bg" class="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-auto" onclick="window.app.closeShareModal()"></div>
            
            <div id="share-modal-content" class="relative bg-[#111] w-full h-[60vh] md:h-[50vh] rounded-t-3xl border-t border-white/10 transform translate-y-full transition-transform duration-300 pointer-events-auto flex flex-col pb-6">
                <div class="w-full flex justify-center py-4 cursor-pointer" onclick="window.app.closeShareModal()">
                    <div class="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                
                <h3 class="text-center font-black text-lg mb-4 uppercase tracking-wider">Share Anime</h3>
                
                <div class="px-5 mb-4 flex gap-2">
                    <div class="relative flex-1">
                        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="share-search-input" placeholder="Search chats..." class="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#F47521] transition-colors">
                    </div>
                    <button onclick="window.app.searchShareChats()" class="bg-[#F47521] text-white px-4 rounded-xl shadow-lg hover:bg-[#d9661c] transition-colors flex items-center justify-center">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>

                <div id="share-chats-container" class="flex-1 overflow-y-auto px-5 flex flex-col gap-2 mb-2 scrollbar-hide">
                    <div class="text-center text-gray-500 text-xs py-8 uppercase tracking-widest"><i class="fas fa-spinner fa-spin mr-2"></i>Loading Chats...</div>
                </div>

                <div class="px-5 pt-4 border-t border-white/10 flex gap-6 overflow-x-auto scrollbar-hide shrink-0 snap-x">
                    <button onclick="window.app.shareToSocial('whatsapp')" class="flex flex-col items-center gap-2 min-w-[60px] snap-start hover:scale-110 transition-transform">
                        <div class="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xl shadow-lg"><i class="fab fa-whatsapp"></i></div>
                        <span class="text-[10px] text-gray-400 font-bold tracking-wider">WhatsApp</span>
                    </button>
                    <button onclick="window.app.shareToSocial('instagram')" class="flex flex-col items-center gap-2 min-w-[60px] snap-start hover:scale-110 transition-transform">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white text-xl shadow-lg"><i class="fab fa-instagram"></i></div>
                        <span class="text-[10px] text-gray-400 font-bold tracking-wider">Instagram</span>
                    </button>
                    <button onclick="window.app.shareToSocial('twitter')" class="flex flex-col items-center gap-2 min-w-[60px] snap-start hover:scale-110 transition-transform">
                        <div class="w-12 h-12 rounded-full bg-black border border-white/20 flex items-center justify-center text-white text-xl shadow-lg"><i class="fab fa-x-twitter"></i></div>
                        <span class="text-[10px] text-gray-400 font-bold tracking-wider">X</span>
                    </button>
                    <button onclick="window.app.shareToSocial('telegram')" class="flex flex-col items-center gap-2 min-w-[60px] snap-start hover:scale-110 transition-transform">
                        <div class="w-12 h-12 rounded-full bg-[#0088cc] flex items-center justify-center text-white text-xl shadow-lg"><i class="fab fa-telegram-plane"></i></div>
                        <span class="text-[10px] text-gray-400 font-bold tracking-wider">Telegram</span>
                    </button>
                    <button onclick="window.app.shareToSocial('copy')" class="flex flex-col items-center gap-2 min-w-[60px] snap-start hover:scale-110 transition-transform">
                        <div class="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl shadow-lg"><i class="fas fa-link"></i></div>
                        <span class="text-[10px] text-gray-400 font-bold tracking-wider">Copy Link</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', shareHtml);
}

window.app.openShareModal = async (btn, id, title) => {
    // Make button orange to indicate active state
    btn.classList.add('bg-[#F47521]', 'border-[#F47521]', 'scale-95');
    btn.classList.remove('bg-white/10', 'border-white/10');
    setTimeout(() => btn.classList.remove('scale-95'), 150);

    // Save current share targets
    window.app.state.currentShareUrl = `${window.location.origin}/info.html?id=${id}`;
    window.app.state.currentShareTitle = `Check out ${title} on Blaze-X!`;

    const modal = document.getElementById('carousel-share-modal');
    const bg = document.getElementById('share-modal-bg');
    const content = document.getElementById('share-modal-content');
    
    modal.style.visibility = 'visible';
    requestAnimationFrame(() => {
        bg.classList.add('opacity-100');
        bg.classList.remove('opacity-0');
        content.classList.remove('translate-y-full');
    });

    // Load Chats (Top 5)
    await loadShareChats();
};

window.app.closeShareModal = () => {
    const bg = document.getElementById('share-modal-bg');
    const content = document.getElementById('share-modal-content');
    
    bg.classList.remove('opacity-100');
    bg.classList.add('opacity-0');
    content.classList.add('translate-y-full');
    
    // Reset Share button styling
    const btns = document.querySelectorAll('button i.fa-share-nodes');
    btns.forEach(icon => {
        const pBtn = icon.closest('button');
        if (pBtn) {
            pBtn.classList.remove('bg-[#F47521]', 'border-[#F47521]');
            pBtn.classList.add('bg-white/10', 'border-white/10');
        }
    });

    setTimeout(() => {
        document.getElementById('carousel-share-modal').style.visibility = 'hidden';
        document.getElementById('share-search-input').value = '';
    }, 300);
};

async function loadShareChats() {
    const container = document.getElementById('share-chats-container');
    
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 uppercase tracking-widest">Log in to share with friends</div>`;
        return;
    }

    try {
        const { collection, query, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const q = query(collection(db, "users", auth.currentUser.uid, "chat_lists"), limit(5));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 uppercase tracking-widest">No recent chats found</div>`;
            return;
        }

        let html = '';
        window.app.state.cachedShareChats = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            window.app.state.cachedShareChats.push({ id: doc.id, ...data });
            
            const name = data.name || data.participantName || "Unknown User";
            const img = data.pfp || data.participantPfp || "https://via.placeholder.com/50/111/fff?text=User";

            html += `
                <div class="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                    <div class="flex items-center gap-3">
                        <img src="${img}" class="w-10 h-10 rounded-full object-cover border border-white/10">
                        <span class="text-sm font-bold text-white tracking-wide">${name}</span>
                    </div>
                    <button onclick="window.app.sendToChat('${doc.id}')" class="text-xs bg-white/10 hover:bg-[#F47521] text-white px-4 py-2 rounded-lg font-bold tracking-wider uppercase transition-colors">Send</button>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (err) {
        console.error("Error loading share chats", err);
        container.innerHTML = `<div class="text-center text-red-500 text-xs py-8 uppercase tracking-widest">Failed to load chats</div>`;
    }
}

window.app.searchShareChats = () => {
    const query = document.getElementById('share-search-input').value.toLowerCase();
    const container = document.getElementById('share-chats-container');
    const cached = window.app.state.cachedShareChats || [];
    
    if (cached.length === 0) return;
    
    const filtered = cached.filter(c => {
        const name = (c.name || c.participantName || "").toLowerCase();
        return name.includes(query);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 uppercase tracking-widest">No friends found</div>`;
        return;
    }

    let html = '';
    filtered.forEach(data => {
        const name = data.name || data.participantName || "Unknown User";
        const img = data.pfp || data.participantPfp || "https://via.placeholder.com/50/111/fff?text=User";
        html += `
            <div class="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3">
                    <img src="${img}" class="w-10 h-10 rounded-full object-cover border border-white/10">
                    <span class="text-sm font-bold text-white tracking-wide">${name}</span>
                </div>
                <button onclick="window.app.sendToChat('${data.id}')" class="text-xs bg-white/10 hover:bg-[#F47521] text-white px-4 py-2 rounded-lg font-bold tracking-wider uppercase transition-colors">Send</button>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.app.sendToChat = (chatId) => {
    // Implement direct send to chat database logic here if needed
    alert("Sent to chat ID: " + chatId);
    window.app.closeShareModal();
};

window.app.shareToSocial = (platform) => {
    const url = encodeURIComponent(window.app.state.currentShareUrl);
    const text = encodeURIComponent(window.app.state.currentShareTitle);

    if (platform === 'whatsapp') {
        window.open(`https://wa.me/?text=${text} - ${url}`, '_blank');
    } else if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
    } else if (platform === 'telegram') {
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    } else if (platform === 'instagram') {
        // Instagram doesn't support pre-filled web intents easily. Copy link and redirect to app.
        navigator.clipboard.writeText(`${window.app.state.currentShareTitle} ${window.app.state.currentShareUrl}`);
        alert("Link copied! Paste it in Instagram to share.");
        window.open('https://instagram.com', '_blank');
    } else if (platform === 'copy') {
        navigator.clipboard.writeText(`${window.app.state.currentShareTitle} ${window.app.state.currentShareUrl}`);
        alert("Link copied to clipboard!");
    }
};
