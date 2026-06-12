// carousel.js - WITH DYNAMIC ADD/REMOVE LIBRARY FEATURE (Firestore Subcollections Only)

window.app = window.app || {};
window.app.components = window.app.components || {};
window.app.state = window.app.state || {};

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

    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        // Fetching from the official latest episodes route
        const rawResponse = await fetch(`${baseUrl}/api/latest-episodes`);
        const response = await rawResponse.json();
        
        const rawSlides = response.data || [];

        if (rawSlides.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-gray-500 text-xs border border-white/5 mx-4 rounded-xl bg-black tracking-widest uppercase">
                    <i class="fas fa-exclamation-circle mr-1 text-[#F47521]"></i> Stream Offline
                </div>
            `;
            return;
        }

        // 2. WAIT FOR ALL ANILIST MATCHES
        const enrichedSlides = await Promise.all(rawSlides.map(async (slide) => {
            const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
            const exactId = slide.id; 
            
            let finalImage = slide.image || 'https://via.placeholder.com/1280x720/111/fff?text=No+Image';
            let finalRating = null;
            let trendingScore = 0;
            let finalDescription = 'No synopsis available.';

            try {
                const query = `query ($search: String) { 
                    Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                        trending 
                        averageScore 
                        description
                        coverImage { extraLarge } 
                    } 
                }`;
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: cleanTitle } })
                });
                
                const aniData = await aniRes.json();
                const media = aniData?.data?.Media;
                if (media) {
                    if (media.coverImage?.extraLarge) finalImage = media.coverImage.extraLarge;
                    if (media.averageScore) finalRating = media.averageScore;
                    if (media.trending) trendingScore = media.trending;
                    
                    if (media.description) {
                        finalDescription = media.description.replace(/<[^>]*>?/gm, '').trim();
                    }
                }
            } catch (e) {
                console.log("AniList sync failed for:", cleanTitle);
            }

            return { ...slide, exactId, finalImage, finalRating, trendingScore, finalDescription };
        }));

        enrichedSlides.sort((a, b) => b.trendingScore - a.trendingScore);
        const topSlides = enrichedSlides.slice(0, 5);

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

        // 3. RENDER FINAL UI
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

// --- DYNAMIC UI UPDATER ---
window.app.updateCarouselUI = (index) => {
    const uiLayer = document.getElementById('carousel-ui-layer');
    if (!uiLayer) return;

    const data = window.app.state.carouselItems[index];
    if (!data) return;

    // Use centralized in-memory profile state
    const profile = window.app.state.activeProfile;
    
    // Check if the anime is already in the user's library
    let isAdded = false;
    if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
        isAdded = profile.library.some(item => String(item.id) === String(data.exactId));
    }

    const ratingHtml = data.finalRating ? `<span class="flex items-center gap-1"><i class="fas fa-star"></i> ${data.finalRating}% SCORE</span>` : '';

    // Dynamic Button State
    const libraryBtnHtml = isAdded 
        ? `<button onclick="window.app.handleCarouselLibraryClick(event, ${index})" class="bg-white text-black px-5 py-2 md:px-6 md:py-3 rounded font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-gray-200 transition-colors border border-white flex items-center gap-2">
               <i class="fas fa-check text-green-500"></i> Added
           </button>`
        : `<button onclick="window.app.handleCarouselLibraryClick(event, ${index})" class="bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
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
            
            <div class="flex gap-2.5 relative z-40">
                <button onclick="window.app.handleCarouselImageClick()" class="bg-[#F47521] text-white px-6 py-2 md:px-8 md:py-3 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                    <i class="fas fa-play"></i> Watch Now
                </button>
                
                ${libraryBtnHtml}
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

// --- DYNAMIC LIBRARY LOGIC (ADD & REMOVE) ---
window.app.handleCarouselLibraryClick = async (event, index) => {
    event.stopPropagation(); 
    const profile = window.app.state.activeProfile;
    
    // Auth Check
    if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
        if (window.app.components && window.app.components.auth) window.app.components.auth();
        else if (window.app.showCustomAlert) window.app.showCustomAlert("Please log in to save to your Library!", "error");
        return;
    }

    const rawData = window.app.state.carouselItems[index];
    if (!rawData) return;
    
    if(!profile.library) profile.library = [];
    
    const docIdStr = String(rawData.exactId);
    const formattedAnime = { 
        id: docIdStr, 
        title: rawData.title, 
        img: rawData.finalImage,
        timestamp: Date.now()
    };

    const existingItemIndex = profile.library.findIndex(item => String(item.id) === docIdStr);
    const isCurrentlyAdded = existingItemIndex !== -1;
    const btn = event.currentTarget || event.target.closest('button');

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        // Aligning with search.js: Using a subcollection
        const libDocRef = firestore.doc(window.app.db, "users", profile.uid, "library", docIdStr);

        if (isCurrentlyAdded) {
            // --- REMOVE FROM LIBRARY ---
            profile.library.splice(existingItemIndex, 1); 

            // Instant UI Update to 'Not Added' State
            if (btn) {
                btn.className = "bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2";
                btn.innerHTML = `<i class="fas fa-plus"></i> Library`;
            }

            // Sync with Firestore
            await firestore.deleteDoc(libDocRef);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");

        } else {
            // --- ADD TO LIBRARY ---
            profile.library.unshift(formattedAnime);

            // Instant UI Update to 'Added' State
            if (btn) {
                btn.className = "bg-white text-black px-5 py-2 md:px-6 md:py-3 rounded font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-gray-200 transition-colors border border-white flex items-center gap-2";
                btn.innerHTML = `<i class="fas fa-check text-green-500"></i> Added`;
            }

            // Sync with Firestore
            await firestore.setDoc(libDocRef, formattedAnime);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
        }
    } catch (error) { 
        console.error("Firebase update failed:", error); 
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
    }
};
