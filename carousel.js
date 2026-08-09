// carousel.js - Firestore Subcollections Native, Fixed Sync & Auth Listeners

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};

// In-memory set to instantly check if a carousel item is in the library
window.app.state.carouselLibrarySet = new Set();
window.app.state.libraryUnsubscribe = null; // Store listener to avoid duplicates

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

    // --- FIREBASE SYNC: Live Listener for Auth & Library ---
    try {
        await initFirebase();
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');

        onAuthStateChanged(auth, async (user) => {
            if (window.app.state.libraryUnsubscribe) {
                window.app.state.libraryUnsubscribe(); // Cleanup old listener
            }

            if (user && !user.isAnonymous) {
                try {
                    const libRef = collection(db, "users", user.uid, "library");
                    
                    // LIVE LISTENER: Instantly updates memory set when library changes
                    window.app.state.libraryUnsubscribe = onSnapshot(libRef, (snapshot) => {
                        window.app.state.carouselLibrarySet.clear();
                        snapshot.forEach(doc => {
                            window.app.state.carouselLibrarySet.add(String(doc.id));
                        });

                        // Re-render the current slide's buttons immediately on data change
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

    // --- FETCH CAROUSEL DATA: AniList First, exact API match second ---
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

                if (!exactMatch) {
                    continue;
                }

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
                
                <button id="carousel-share-btn" onclick="event.stopPropagation(); window.app.shareAnime('${data.exactId}', '${safeTitle}')" class="bg-white/10 backdrop-blur-md text-white px-4 py-2 md:px-5 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase transition-all duration-300 border border-white/10 flex items-center gap-2 shadow-lg">
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
    } else {
        if (window.app.showCustomAlert) window.app.showCustomAlert("Unable to load details for this series.", "error");
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

    if (oldSlide) {
        oldSlide.style.opacity = '0';
        oldSlide.classList.replace('z-20', 'z-10');
    }
    if (newSlide) {
        newSlide.style.opacity = '1';
        newSlide.classList.replace('z-10', 'z-20');
    }

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
        const currentIndex = window.app.state.carouselCurrentIndex;
        const nextIndex = (currentIndex + 1) % count;
        transitionSlide(currentIndex, nextIndex);
        window.app.state.carouselCurrentIndex = nextIndex;
    }, 6000); 
}

// --- DYNAMIC LIBRARY LOGIC (ADD & REMOVE WITH NOTIFICATIONS) ---
window.app.handleCarouselLibraryClick = async (event, index) => {
    event.stopPropagation(); 
    const btn = event.currentTarget;
    
    try {
        await initFirebase(); 
        
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Please log in to save to your Library!", "error");
            return;
        }

        const rawData = window.app.state.carouselItems[index];
        if (!rawData) return;
        
        const docIdStr = String(rawData.exactId);
        const formattedAnime = { 
            id: docIdStr, 
            title: rawData.title, 
            img: rawData.finalImage,
            timestamp: Date.now()
        };

        const isAdded = btn.dataset.added === "true"; 

        const { doc, setDoc, deleteDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const libDocRef = doc(db, "users", auth.currentUser.uid, "library", docIdStr);

        if (isAdded) {
            window.app.state.carouselLibrarySet.delete(docIdStr);
            btn.dataset.added = "false";
            btn.className = "bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2 shadow-lg";
            btn.innerHTML = `<i class="fas fa-plus"></i> Library`;

            await deleteDoc(libDocRef);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
        } else {
            window.app.state.carouselLibrarySet.add(docIdStr);
            btn.dataset.added = "true";
            btn.className = "bg-white text-black px-5 py-2 md:px-6 md:py-3 rounded font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-gray-200 transition-colors border border-white flex items-center gap-2 shadow-lg";
            btn.innerHTML = `<i class="fas fa-check"></i> Added`;

            await setDoc(libDocRef, formattedAnime);
            
            // --- NEW: Generate Notification ---
            const notifRef = doc(collection(db, "users", auth.currentUser.uid, "notifications"));
            await setDoc(notifRef, {
                id: notifRef.id,
                type: 'library',
                title: 'Added to Library',
                message: `You added ${rawData.title} to your library.`,
                image: rawData.finalImage,
                timestamp: Date.now()
            });

            if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
        }
    } catch (error) { 
        console.error("Firebase update failed:", error); 
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
    }
};


// --- DYNAMIC SHARE OVERLAY & LOGIC ---
window.app.shareAnime = async (exactId, title) => {
    // 1. Turn Share Button Orange
    const shareBtn = document.getElementById('carousel-share-btn');
    if (shareBtn) {
        shareBtn.classList.remove('bg-white/10', 'border-white/10');
        shareBtn.classList.add('bg-[#F47521]', 'border-[#F47521]', 'shadow-[0_0_15px_rgba(244,117,33,0.3)]');
    }

    // 2. Inject Overlay HTML if not exists
    if (!document.getElementById('share-overlay')) {
        const overlayHtml = `
            <div id="share-overlay-backdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] opacity-0 transition-opacity hidden" onclick="window.app.closeShareOverlay()"></div>
            <div id="share-overlay" class="fixed bottom-0 left-0 w-full h-[50vh] bg-[#0a0a0a] rounded-t-3xl z-[101] transform translate-y-full transition-transform duration-300 flex flex-col pt-3 pb-6 px-4 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] border-t border-white/10">
                
                <!-- Handle -->
                <div class="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-4 cursor-pointer" onclick="window.app.closeShareOverlay()"></div>
                
                <h3 class="text-white font-bold text-lg mb-3 tracking-wide">Share <span class="text-[#F47521]">${title}</span></h3>

                <!-- Search Bar -->
                <div class="flex gap-2 mb-4">
                    <input type="text" id="share-chat-search" oninput="window.app.searchShareChats(this.value)" placeholder="Search chats..." class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F47521] transition-colors placeholder-gray-500">
                    <button onclick="window.app.searchShareChats(document.getElementById('share-chat-search').value)" class="bg-[#F47521] text-white px-5 rounded-xl transition-transform hover:scale-105"><i class="fas fa-search"></i></button>
                </div>

                <!-- Chats List -->
                <div id="share-chats-list" class="flex-1 overflow-y-auto flex flex-col gap-1 mb-4 scrollbar-hide border border-white/5 rounded-xl bg-black/50 p-2">
                    <div class="flex justify-center py-6"><i class="fas fa-spinner fa-spin text-[#F47521] text-xl"></i></div>
                </div>

                <!-- Socials Row -->
                <div class="pt-2 flex justify-between items-center px-1">
                    <button id="share-copy-btn" class="flex flex-col items-center gap-2 group transition-transform hover:scale-105"><div class="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center group-hover:bg-white/20"><i class="fas fa-link text-white text-lg"></i></div><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Copy</span></button>
                    <button id="share-whatsapp-btn" class="flex flex-col items-center gap-2 group transition-transform hover:scale-105"><div class="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center"><i class="fab fa-whatsapp text-white text-xl"></i></div><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp</span></button>
                    <button id="share-x-btn" class="flex flex-col items-center gap-2 group transition-transform hover:scale-105"><div class="w-12 h-12 rounded-full bg-black border border-gray-700 flex items-center justify-center"><i class="fab fa-x-twitter text-white text-lg"></i></div><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">X</span></button>
                    <button id="share-telegram-btn" class="flex flex-col items-center gap-2 group transition-transform hover:scale-105"><div class="w-12 h-12 rounded-full bg-[#0088cc] flex items-center justify-center"><i class="fab fa-telegram-plane text-white text-xl"></i></div><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Telegram</span></button>
                    <button id="share-ig-btn" class="flex flex-col items-center gap-2 group transition-transform hover:scale-105"><div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#f09433] to-[#bc1888] flex items-center justify-center"><i class="fab fa-instagram text-white text-xl"></i></div><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Instagram</span></button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHtml);
    }

    // 3. Setup Social Buttons logic
    const shareUrl = `${window.location.origin}/info.html?id=${exactId}`;
    const shareText = `Check out ${title} on Blaze-X!`;
    
    document.getElementById('share-copy-btn').onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        if (window.app.showCustomAlert) window.app.showCustomAlert('Link copied to clipboard!', 'success');
    };
    document.getElementById('share-whatsapp-btn').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`);
    document.getElementById('share-x-btn').onclick = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`);
    document.getElementById('share-telegram-btn').onclick = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
    document.getElementById('share-ig-btn').onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        if (window.app.showCustomAlert) window.app.showCustomAlert('Link copied! Open Instagram to paste.', 'success');
        setTimeout(() => window.open('https://instagram.com'), 1200);
    };

    // 4. Reveal Overlay
    const backdrop = document.getElementById('share-overlay-backdrop');
    const overlay = document.getElementById('share-overlay');
    backdrop.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        overlay.classList.remove('translate-y-full');
    }, 10);

    // 5. Fetch Chats
    window.app.currentShareData = { exactId, title }; // Save for searching
    await window.app.searchShareChats(""); // Fetch initial top 5
};

window.app.searchShareChats = async (queryStr = "") => {
    const chatsListContainer = document.getElementById('share-chats-list');
    
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        chatsListContainer.innerHTML = '<div class="text-center text-xs font-bold text-gray-500 py-8 uppercase tracking-widest">Login to view chats</div>';
        return;
    }

    try {
        await initFirebase();
        const { collection, getDocs, query, limit } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        
        // If there's no query, just fetch a limit of 5. If searching, fetch all and filter client side.
        const chatRef = collection(db, "users", auth.currentUser.uid, "chat_lists");
        const q = queryStr.trim() === "" ? query(chatRef, limit(5)) : query(chatRef);
        const snap = await getDocs(q);

        if (snap.empty) {
            chatsListContainer.innerHTML = '<div class="text-center text-xs text-gray-500 font-bold py-8 uppercase tracking-widest">No recent chats found</div>';
            return;
        }

        let chatHtml = '';
        snap.forEach(doc => {
            const data = doc.data();
            const name = data.name || data.participantName || data.username || 'Unknown User';
            
            // Client side filter
            if (name.toLowerCase().includes(queryStr.toLowerCase())) {
                const avatar = data.avatar || data.participantAvatar || data.profilePic || 'https://via.placeholder.com/150/111/fff?text=User';
                const safeTitle = (window.app.currentShareData.title || '').replace(/'/g, "\\'");
                
                chatHtml += `
                    <div class="flex items-center gap-3 p-2.5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-white/5" onclick="window.app.sendShareToChat('${doc.id}', '${window.app.currentShareData.exactId}', '${safeTitle}')">
                        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover shadow-md border border-white/10">
                        <span class="text-sm font-bold flex-1 text-white truncate tracking-wide">${name}</span>
                        <button class="text-[10px] bg-white/10 text-white border border-white/20 px-4 py-1.5 rounded font-black tracking-widest uppercase hover:bg-[#F47521] hover:border-[#F47521] transition-colors shadow-lg">Send</button>
                    </div>
                `;
            }
        });

        if (chatHtml === '') {
            chatsListContainer.innerHTML = '<div class="text-center text-xs text-gray-500 font-bold py-8 uppercase tracking-widest">No matches found</div>';
        } else {
            chatsListContainer.innerHTML = chatHtml;
        }
    } catch (err) {
        console.error("Error loading share chats", err);
        chatsListContainer.innerHTML = '<div class="text-center text-xs text-red-500 font-bold py-8 uppercase tracking-widest">Error loading chats</div>';
    }
};

window.app.sendShareToChat = (chatId, exactId, title) => {
    // Note: Add your actual database messaging logic here
    if (window.app.showCustomAlert) {
        window.app.showCustomAlert(`Sent ${title} to chat!`, 'success');
    }
    window.app.closeShareOverlay();
};

window.app.closeShareOverlay = () => {
    const backdrop = document.getElementById('share-overlay-backdrop');
    const overlay = document.getElementById('share-overlay');
    
    if (overlay) overlay.classList.add('translate-y-full');
    if (backdrop) {
        backdrop.classList.add('opacity-0');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
    
    // Reset Share Button UI
    const shareBtn = document.getElementById('carousel-share-btn');
    if (shareBtn) {
        shareBtn.classList.remove('bg-[#F47521]', 'border-[#F47521]', 'shadow-[0_0_15px_rgba(244,117,33,0.3)]');
        shareBtn.classList.add('bg-white/10', 'border-white/10');
    }
};
