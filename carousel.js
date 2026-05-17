// carousel.js

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
        const response = await window.app.api.fetch('/recent-anime?page=1');
        
        let rawSlides = [];
        if (response && Array.isArray(response)) {
            rawSlides = response;
        } else if (response && response.data && Array.isArray(response.data)) {
            rawSlides = response.data;
        }

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
            
            // STRICTLY USE EXACT ID FROM JSON
            const exactId = slide.id; 
            
            let finalImage = slide.image || slide.cover || slide.poster || 'https://via.placeholder.com/1280x720/111/fff?text=No+Image';
            let finalRating = null;
            let trendingScore = 0;

            try {
                const query = `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { trending averageScore coverImage { extraLarge } } }`;
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: cleanTitle } })
                });
                
                const aniData = await aniRes.json();
                if (aniData?.data?.Media) {
                    if (aniData.data.Media.coverImage?.extraLarge) finalImage = aniData.data.Media.coverImage.extraLarge;
                    if (aniData.data.Media.averageScore) finalRating = aniData.data.Media.averageScore;
                    if (aniData.data.Media.trending) trendingScore = aniData.data.Media.trending;
                }
            } catch (e) {
                console.log("AniList sync failed for:", cleanTitle);
            }

            return { ...slide, exactId, finalImage, finalRating, trendingScore };
        }));

        // Sort by trending score (highest first) and take top 5
        enrichedSlides.sort((a, b) => b.trendingScore - a.trendingScore);
        const topSlides = enrichedSlides.slice(0, 5);

        window.app.state.carouselItems = topSlides; 
        window.app.state.carouselCurrentIndex = 0;

        let imageSlidesHtml = '';
        let dotsHtml = '';

        // Build Background Image Slides
        topSlides.forEach((s, i) => {
            // NEW: Added window.app.handleCarouselImageClick() to the background wrapper
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

        // 3. RENDER FINAL UI (Removes loader)
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

    // PERFECT ID LOCK
    const id = data.exactId || 'unknown';
    const ratingHtml = data.finalRating ? `<span class="flex items-center gap-1"><i class="fas fa-star"></i> ${data.finalRating}% SCORE</span>` : '';

    uiLayer.style.opacity = '0';

    setTimeout(() => {
        uiLayer.innerHTML = `
            <div class="flex items-center gap-3 text-[#F47521] text-[10px] md:text-xs font-black tracking-widest drop-shadow-md mb-2 md:mb-3 uppercase">
                <span class="bg-[#F47521]/10 border border-[#F47521]/30 px-2 py-0.5 rounded backdrop-blur-sm">#${index + 1} Trending</span>
                ${ratingHtml}
            </div>

            <h2 class="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] line-clamp-2 tracking-tight cursor-pointer leading-tight hover:text-[#F47521] transition-colors" onclick="window.app.handleCarouselImageClick()">${data.title || 'Unknown'}</h2>
            <p class="text-[11px] md:text-xs text-gray-300 line-clamp-3 md:line-clamp-4 mb-5 md:mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed font-medium">${data.description || 'No synopsis available.'}</p>
            
            <div class="flex gap-2.5 relative z-40">
                <button onclick="window.app.handleCarouselImageClick()" class="bg-[#F47521] text-white px-6 py-2 md:px-8 md:py-3 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-black text-[10px] md:text-sm tracking-wider uppercase hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                    <i class="fas fa-play"></i> Watch Now
                </button>
                
                <button onclick="window.app.handleCarouselLibraryClick(event, ${index})" class="bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-3 rounded font-bold text-[10px] md:text-sm tracking-wider uppercase hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                    <i class="fas fa-plus"></i> Library
                </button>
            </div>
        `;
        uiLayer.style.opacity = '1';
    }, 300);
};


// --- SAFE ROUTING LOGIC FOR IMAGES & BUTTONS ---
window.app.handleCarouselImageClick = () => {
    const currentIndex = window.app.state.carouselCurrentIndex;
    const currentSlideData = window.app.state.carouselItems[currentIndex];
    
    // Grabs the exact locked ID from the currently visible slide
    if (currentSlideData && currentSlideData.exactId) {
        window.location.href = `info.html?id=${currentSlideData.exactId}`;
    } else {
        alert("Unable to load details for this series.");
    }
};


// --- ROTATION & SLIDE CONTROLS ---
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

// --- LIBRARY LOGIC ---
window.app.handleCarouselLibraryClick = async (event, index) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) {
        if (window.app.components.auth) window.app.components.auth();
        else alert("Please log in or create an account to save to your Library!");
        return;
    }
    const rawData = window.app.state.carouselItems[index];
    if (!rawData) return;
    
    // Grabs EXACT ID from state
    const formattedAnime = { 
        id: rawData.exactId, 
        title: rawData.title, 
        img: rawData.finalImage 
    };
    
    if (profile.watchlist && profile.watchlist.some(item => item.id == formattedAnime.id)) return alert("This series is already in your Library!");
    
    if(!profile.watchlist) profile.watchlist = [];
    profile.watchlist.unshift(formattedAnime);
    
    const btn = event.currentTarget || event.target.closest('button');
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check text-green-400"></i> Added`;
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    }
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { watchlist: firestore.arrayUnion(formattedAnime) });
    } catch (error) { console.error("Firebase update failed:", error); }
};
