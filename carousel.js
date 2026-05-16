// carousel.js

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    // ADDED: mt-[60px] md:mt-0 to push down on mobile, but keep cinematic overlay on desktop
    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-black flex items-center justify-center border-b border-white/5 mt-[60px] md:mt-0">
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
                <div class="p-6 text-center text-gray-500 text-xs border border-white/5 mx-4 mt-[60px] md:mt-0 rounded-xl bg-black tracking-widest uppercase">
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
                        <img src="${img}" class="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[10s] group-hover:scale-105 opacity-90 md:opacity-100">
                        
                        <div class="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-black via-black/90 to-transparent md:hidden"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent hidden md:block w-[70%]"></div>
                    </div>
                    
                    <div class="absolute bottom-8 left-4 right-8 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:w-[35%] z-30 pr-4">
                        ${ratingHtml}
                        <h2 class="text-3xl md:text-5xl font-black text-white mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] line-clamp-2 md:line-clamp-3 tracking-tight cursor-pointer leading-tight" onclick="window.location.href='info.html?id=${id}'">${title}</h2>
                        <p class="text-[11px] md:text-xs text-gray-300 line-clamp-3 md:line-clamp-4 mb-5 md:mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed">${desc}</p>
                        
                        <div class="flex gap-2.5 relative z-40">
                            <button onclick="window.location.href='info.html?id=${id}'" class="bg-[#F47521] text-black px-6 py-2 md:px-7 md:py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-bold text-[10px] md:text-xs uppercase tracking-wider hover:bg-white hover:shadow-none transition-all flex items-center gap-2">
                                <i class="fas fa-play ml-0.5"></i> Play
                            </button>
                            
                            <button onclick="window.app.handleCarouselLibraryClick(event, ${i})" class="bg-white/10 backdrop-blur-md text-white px-5 py-2 md:px-6 md:py-2.5 rounded font-bold text-[10px] md:text-xs uppercase tracking-wider hover:bg-white/30 transition-colors border border-white/10 flex items-center gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const dotClass = i === 0 
                ? 'carousel-dot w-2 h-8 bg-[#F47521] transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm'
                : 'carousel-dot w-2 h-2 bg-white/30 hover:bg-white/60 transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm';

            dotsHtml += `
                <div onclick="window.app.goToCarouselSlide(${i})" class="${dotClass}" id="dot-${i}"></div>
            `;
        });

        // ADDED: mt-[60px] md:mt-0
        container.innerHTML = `
            <div class="relative w-full aspect-[4/5] md:aspect-[21/9] max-h-[75vh] overflow-hidden bg-black border-b border-white/5 mt-[60px] md:mt-0">
                <div id="hero-slides" class="relative w-full h-full">${slidesHtml}</div>
                
                <div id="carousel-preview-layer" class="absolute inset-0 z-[60] opacity-0 pointer-events-none transition-opacity duration-500 bg-black flex flex-col md:flex-row"></div>
                
                <div class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col justify-center gap-2.5 z-[70]" id="carousel-indicators">${dotsHtml}</div>
            </div>
        `;

        startAutoRotate();
        
    } catch (err) {
        console.error("Carousel Script Error:", err);
    }
};

window.app.showPreview = (title, desc, posterUrl, rating, trailerId) => {
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);

    const previewLayer = document.getElementById('carousel-preview-layer');
    if (!previewLayer) return;

    const ratingHtml = rating ? `<div class="flex items-center gap-1.5 mb-1.5 md:mb-2 text-[#F47521] text-[10px] md:text-xs font-black tracking-widest drop-shadow-md"><i class="fas fa-star"></i> ${rating}% SCORE</div>` : '';
    
    const videoHtml = trailerId ? `
        <div class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-black">
            <iframe id="preview-trailer-iframe" class="absolute top-1/2 left-1/2 w-[150vw] h-[150vh] md:w-[150%] md:h-[150%] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-opacity duration-1000" src="https://www.youtube.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&playlist=${trailerId}&loop=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>
        </div>
    ` : '';

    previewLayer.innerHTML = `
        <div class="absolute inset-0 md:left-[40%] md:w-[60%] z-0 bg-black overflow-hidden">
            <img id="preview-poster" src="${posterUrl}" class="absolute inset-0 w-full h-full object-cover object-center z-10 transition-opacity duration-1000">
            ${videoHtml}
            <div class="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-black via-black/90 to-transparent md:hidden z-20"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent hidden md:block w-[70%] z-20"></div>
        </div>
        
        <div class="absolute bottom-8 left-4 right-8 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:w-[35%] z-30 pr-4">
            ${ratingHtml}
            <h2 class="text-3xl md:text-5xl font-black text-white mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] line-clamp-2 md:line-clamp-3 tracking-tight leading-tight">${title}</h2>
            <p class="text-[11px] md:text-xs text-gray-300 line-clamp-3 md:line-clamp-4 mb-5 md:mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed">${desc}</p>
        </div>
    `;

    previewLayer.classList.remove('opacity-0');
    previewLayer.classList.add('opacity-100');

    const iframe = document.getElementById('preview-trailer-iframe');
    const poster = document.getElementById('preview-poster');
    if (iframe && poster) {
        iframe.onload = () => {
            setTimeout(() => {
                iframe.classList.remove('opacity-0');
                poster.classList.add('opacity-0');
            }, 1500); 
        };
    }
};

window.app.hidePreview = () => {
    const previewLayer = document.getElementById('carousel-preview-layer');
    if (previewLayer) {
        previewLayer.classList.remove('opacity-100');
        previewLayer.classList.add('opacity-0');
        setTimeout(() => { previewLayer.innerHTML = ''; }, 500); 
    }
    startAutoRotate(); 
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
    const oldSlide = document.getElementById(`slide-${oldIndex}`);
    const oldDot = document.getElementById(`dot-${oldIndex}`);
    const newSlide = document.getElementById(`slide-${newIndex}`);
    const newDot = document.getElementById(`dot-${newIndex}`);

    if (oldSlide) {
        oldSlide.style.opacity = '0';
        oldSlide.classList.replace('z-20', 'z-10');
    }
    
    if (oldDot) {
        oldDot.className = "carousel-dot w-2 h-2 bg-white/30 hover:bg-white/60 transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm";
    }
    if (newSlide) {
        newSlide.style.opacity = '1';
        newSlide.classList.replace('z-10', 'z-20');
    }
    if (newDot) {
        newDot.className = "carousel-dot w-2 h-8 bg-[#F47521] transition-all duration-300 cursor-pointer pointer-events-auto shadow-md shrink-0 rounded-sm";
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
