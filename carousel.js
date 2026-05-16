// carousel.js

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-[#0a0a0a] flex items-center justify-center border-b border-white/5">
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
                <div class="p-6 text-center text-gray-500 text-xs border border-white/5 mx-4 rounded-xl bg-[#0a0a0a] tracking-widest uppercase">
                    <i class="fas fa-exclamation-circle mr-1 text-[#F47521]"></i> Stream Offline
                </div>
            `;
            return;
        }

        const topSlides = rawSlides.slice(0, 5);
        
        // --- ANILIST INTEGRATION: Fetching Textless Covers & Trailer IDs ---
        const enrichedSlides = await Promise.all(topSlides.map(async (slide) => {
            const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
            
            let finalPoster = slide.image || slide.cover || slide.poster || 'https://via.placeholder.com/800x1200/111/fff?text=No+Image';
            let finalRating = null;
            let trailerId = null;

            try {
                // Changed to coverImage for textless posters, and requested trailer
                const query = `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { coverImage { extraLarge } averageScore trailer { id site } } }`;
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: cleanTitle } })
                });
                
                const aniData = await aniRes.json();
                if (aniData?.data?.Media) {
                    if (aniData.data.Media.coverImage?.extraLarge) finalPoster = aniData.data.Media.coverImage.extraLarge;
                    if (aniData.data.Media.averageScore) finalRating = aniData.data.Media.averageScore;
                    if (aniData.data.Media.trailer?.site === "youtube") trailerId = aniData.data.Media.trailer.id;
                }
            } catch (e) {
                console.log("AniList fetch failed for:", cleanTitle);
            }

            return { ...slide, finalPoster, finalRating, trailerId };
        }));

        window.app.state.carouselItems = enrichedSlides; 
        window.app.state.carouselCurrentIndex = 0;

        let slidesHtml = '';
        let dotsHtml = '';

        enrichedSlides.forEach((s, i) => {
            const id = s.id || 'unknown';
            const title = s.title || 'Unknown Title';
            const desc = s.description || 'No synopsis available.';
            const img = s.finalPoster;
            
            const ratingHtml = s.finalRating 
                ? `<div class="flex items-center gap-1.5 mb-1.5 md:mb-2 text-[#F47521] text-[10px] md:text-xs font-black tracking-widest drop-shadow-md">
                     <i class="fas fa-star"></i> ${s.finalRating}% SCORE
                   </div>` 
                : '';

            slidesHtml += `
                <div class="carousel-slide absolute inset-0 flex flex-col md:flex-row bg-black" id="slide-${i}" style="opacity: ${i === 0 ? '1' : '0'}; z-index: ${i === 0 ? '20' : '10'}; transition: opacity 1.5s ease-in-out;">
                    
                    <div class="absolute inset-0 md:left-[40%] md:w-[60%] cursor-pointer z-0 group overflow-hidden bg-black" onclick="window.location.href='info.html?id=${id}'">
                        <img src="${img}" class="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[10s] group-hover:scale-105 opacity-80 md:opacity-100">
                        
                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent md:hidden"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent hidden md:block w-full"></div>
                    </div>
                    
                    <div class="absolute bottom-6 left-4 right-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:w-[35%] z-30">
                        ${ratingHtml}
                        <h2 class="text-2xl md:text-4xl font-black text-white mb-2 md:mb-3 drop-shadow-2xl line-clamp-2 md:line-clamp-3 tracking-tight cursor-pointer leading-tight" onclick="window.location.href='info.html?id=${id}'">${title}</h2>
                        <p class="text-[11px] md:text-xs text-gray-400 line-clamp-3 md:line-clamp-4 mb-5 md:mb-6 drop-shadow-lg leading-relaxed">${desc}</p>
                        
                        <div class="flex gap-2.5 relative z-40">
                            <button onclick="window.location.href='info.html?id=${id}'" class="bg-[#F47521] text-black px-5 py-2 md:px-6 md:py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-bold text-[10px] md:text-xs uppercase tracking-wider hover:bg-white hover:shadow-none transition-all flex items-center gap-2">
                                <i class="fas fa-play ml-0.5"></i> Play
                            </button>
                            
                            <button onclick="window.app.handleCarouselLibraryClick(event, ${i})" class="bg-white/10 backdrop-blur-md text-white px-4 py-2 md:px-5 md:py-2.5 rounded font-bold text-[10px] md:text-xs uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>
                    </div>
                </div>
            `;

            dotsHtml += `
                <div onclick="window.app.goToCarouselSlide(${i})" class="carousel-dot w-2 h-2 md:w-2 md:h-2 rounded-sm transition-all duration-300 cursor-pointer pointer-events-auto shadow-md ${i === 0 ? 'bg-[#F47521] md:h-6 h-2 w-6 md:w-2' : 'bg-white/30 hover:bg-white/60'} shrink-0" id="dot-${i}"></div>
            `;
        });

        // Structure includes standard slides + a dedicated Preview Layer on top
        container.innerHTML = `
            <div class="relative w-full aspect-[4/5] md:aspect-[21/9] max-h-[75vh] overflow-hidden bg-[#0a0a0a] border-b border-white/5">
                <div id="hero-slides" class="relative w-full h-full">${slidesHtml}</div>
                
                <div id="carousel-preview-layer" class="absolute inset-0 z-[60] opacity-0 pointer-events-none transition-opacity duration-500 bg-[#0a0a0a] flex flex-col md:flex-row"></div>
                
                <div class="absolute right-0 left-0 bottom-3 md:bottom-auto md:left-auto md:right-8 md:top-1/2 md:-translate-y-1/2 flex flex-row md:flex-col justify-center gap-2 z-[70]" id="carousel-indicators">${dotsHtml}</div>
            </div>
        `;

        startAutoRotate();
        
    } catch (err) {
        console.error("Carousel Script Error:", err);
    }
};

// --- DYNAMIC TRAILER ENGINE (Call this from your Sliders) ---
window.app.showPreview = (title, desc, posterUrl, rating, trailerId) => {
    // 1. Pause auto-rotation
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);

    const previewLayer = document.getElementById('carousel-preview-layer');
    if (!previewLayer) return;

    // 2. Build the UI for the hovered anime
    const ratingHtml = rating ? `<div class="flex items-center gap-1.5 mb-1.5 md:mb-2 text-[#F47521] text-[10px] md:text-xs font-black tracking-widest drop-shadow-md"><i class="fas fa-star"></i> ${rating}% SCORE</div>` : '';
    
    // Iframe Trick: Scaled up to 150% to hide YouTube watermarks and controls, unclickable via pointer-events-none
    const videoHtml = trailerId ? `
        <div class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <iframe id="preview-trailer-iframe" class="absolute top-1/2 left-1/2 w-[150vw] h-[150vh] md:w-[150%] md:h-[150%] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-opacity duration-1000" src="https://www.youtube.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&playlist=${trailerId}&loop=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>
        </div>
    ` : '';

    previewLayer.innerHTML = `
        <div class="absolute inset-0 md:left-[40%] md:w-[60%] z-0 bg-black overflow-hidden">
            <img id="preview-poster" src="${posterUrl}" class="absolute inset-0 w-full h-full object-cover object-center z-10 transition-opacity duration-1000">
            ${videoHtml}
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent md:hidden z-20"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent hidden md:block w-full z-20"></div>
        </div>
        
        <div class="absolute bottom-6 left-4 right-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:w-[35%] z-30">
            ${ratingHtml}
            <h2 class="text-2xl md:text-4xl font-black text-white mb-2 md:mb-3 drop-shadow-2xl line-clamp-2 md:line-clamp-3 tracking-tight leading-tight">${title}</h2>
            <p class="text-[11px] md:text-xs text-gray-400 line-clamp-3 md:line-clamp-4 mb-5 md:mb-6 drop-shadow-lg leading-relaxed">${desc}</p>
        </div>
    `;

    // Show the layer
    previewLayer.classList.remove('opacity-0');
    previewLayer.classList.add('opacity-100');

    // Hide image and show video once iframe loads
    const iframe = document.getElementById('preview-trailer-iframe');
    const poster = document.getElementById('preview-poster');
    if (iframe && poster) {
        iframe.onload = () => {
            setTimeout(() => {
                iframe.classList.remove('opacity-0');
                poster.classList.add('opacity-0');
            }, 1500); // 1.5s delay to let YouTube buffer internally
        };
    }
};

window.app.hidePreview = () => {
    const previewLayer = document.getElementById('carousel-preview-layer');
    if (previewLayer) {
        previewLayer.classList.remove('opacity-100');
        previewLayer.classList.add('opacity-0');
        // Clear content to stop video playing in background
        setTimeout(() => { previewLayer.innerHTML = ''; }, 500); 
    }
    startAutoRotate(); // Resume normal carousel
};


// --- STANDARD CAROUSEL CONTROLS ---
window.app.goToCarouselSlide = (targetIndex) => {
    const currentIndex = window.app.state.carouselCurrentIndex;
    if (targetIndex === currentIndex) return;
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);
    transitionSlide(currentIndex, targetIndex);
    window.app.state.carouselCurrentIndex = targetIndex;
    startAutoRotate();
};

function transitionSlide(oldIndex, newIndex) {
    const oldSlide = document.getElementById(`slide-${oldIndex}`);
    const oldDot = document.getElementById(`dot-${oldIndex}`);
    const newSlide = document.getElementById(`slide-${newIndex}`);
    const newDot = document.getElementById(`dot-${newIndex}`);

    if (oldSlide) {
        oldSlide.style.opacity = '0';
        oldSlide.classList.replace('z-20', 'z-10');
    }
    if (oldDot) {
        oldDot.classList.remove('bg-[#F47521]');
        oldDot.classList.add('bg-white/30');
        oldDot.className = oldDot.className.replace(/h-6 w-6 md:h-8 md:w-8/g, 'h-2 w-2 md:h-2 md:w-2'); // Reset dot size
    }
    if (newSlide) {
        newSlide.style.opacity = '1';
        newSlide.classList.replace('z-10', 'z-20');
    }
    if (newDot) {
        newDot.classList.remove('bg-white/30');
        newDot.classList.add('bg-[#F47521]');
        // Expand dot depending on mobile (width) vs desktop (height)
        newDot.className += window.innerWidth < 768 ? ' w-6' : ' md:h-6'; 
    }
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

window.app.handleCarouselLibraryClick = async (event, index) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) {
        if (window.app.components.auth) window.app.components.auth();
        else alert("Please log in or create an account to save to your Library!");
        return;
    }
    const rawData = window.app.state.carouselItems[index];
    if (!rawData) return;
    const formattedAnime = { id: rawData.id, title: rawData.title, img: rawData.finalPoster };
    if (profile.watchlist && profile.watchlist.some(item => item.id === formattedAnime.id)) return alert("This series is already in your Library!");
    
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
