// carousel.js

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:h-[550px] bg-[#0a0a0a] flex items-center justify-center border-b border-white/5">
            <div class="tk-loader scale-50">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
        </div>
    `;

    try {
        const response = await window.app.api.fetch('/recent-anime?page=1');
        let rawSlides = Array.isArray(response) ? response : (response?.data || []);

        if (rawSlides.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-500 uppercase tracking-widest"><i class="fas fa-exclamation-circle text-[#F47521]"></i> Stream Offline</div>`;
            return;
        }

        const topSlides = rawSlides.slice(0, 5);
        
        // --- ANILIST API: Fetching Clean Posters & YouTube Trailers ---
        const enrichedSlides = await Promise.all(topSlides.map(async (slide) => {
            const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
            let finalPoster = slide.image || 'https://via.placeholder.com/800x1200/111/fff?text=No+Image';
            let finalRating = null;
            let trailerId = null;

            try {
                // Fetching extraLarge coverImage (textless poster) and trailer details
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
        
        // Render the base layout for the Dynamic Hero
        renderDynamicHero(enrichedSlides[0]); // Load the first one immediately

        // Start cycling through the top 5
        startHeroAutoRotate(enrichedSlides);
        
    } catch (err) {
        console.error("Carousel Script Error:", err);
    }
};

// --- DYNAMIC HERO RENDERER (Handles Layout & Trailers) ---
function renderDynamicHero(animeData) {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    const id = animeData.id || 'unknown';
    const title = animeData.title || 'Unknown Title';
    const desc = animeData.description || 'No synopsis available.';
    const img = animeData.finalPoster;
    const ratingHtml = animeData.finalRating 
        ? `<div class="flex items-center gap-1.5 mb-2 text-[#F47521] text-xs md:text-sm font-black tracking-widest drop-shadow-md">
             <i class="fas fa-star"></i> ${animeData.finalRating}% SCORE
           </div>` 
        : '';

    // If it has a trailer, build the YouTube embed link (Muted, Auto-playing, No Controls, Looping)
    const trailerHtml = animeData.trailerId 
        ? `<iframe class="absolute inset-0 w-full h-full object-cover scale-[1.35] pointer-events-none opacity-0 transition-opacity duration-1000 z-10" 
            id="hero-trailer" 
            src="https://www.youtube-nocookie.com/embed/${animeData.trailerId}?autoplay=1&mute=1&controls=0&disablekb=1&loop=1&playlist=${animeData.trailerId}&modestbranding=1&playsinline=1" 
            frameborder="0" allow="autoplay; encrypted-media" 
            onload="setTimeout(() => { document.getElementById('hero-poster').style.opacity = '0'; this.style.opacity = '1'; }, 1500)">
           </iframe>` 
        : '';

    container.innerHTML = `
        <div class="relative w-full aspect-[4/5] md:h-[550px] md:aspect-auto overflow-hidden bg-black border-b border-white/5 animate-fade-in group">
            
            <div class="absolute inset-0 md:inset-auto md:right-0 md:top-0 md:w-[60%] md:h-full z-0 flex items-center justify-end">
                
                <img id="hero-poster" src="${img}" class="absolute inset-0 md:relative w-full h-full object-cover object-center md:object-right transition-opacity duration-1000 z-20 mask-image-gradient">
                
                ${trailerHtml}
                
                <div class="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/60 to-transparent z-30 md:hidden"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#000000] via-[#000000]/80 to-transparent z-30 hidden md:block w-full"></div>
                <div class="absolute inset-0 bg-gradient-to-t from-[#000000] to-transparent z-30 hidden md:block h-full"></div>
            </div>
            
            <div class="absolute bottom-8 left-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 z-40 w-[90%] md:w-[45%] pr-4 md:pr-0">
                ${ratingHtml}
                <h2 class="text-3xl md:text-5xl font-black text-white mb-3 drop-shadow-2xl line-clamp-2 md:line-clamp-3 tracking-tight cursor-pointer" onclick="window.location.href='info.html?id=${id}'">${title}</h2>
                <p class="text-xs md:text-sm text-gray-300 line-clamp-3 mb-6 drop-shadow-lg leading-relaxed font-medium">${desc}</p>
                
                <div class="flex gap-3">
                    <button onclick="window.location.href='info.html?id=${id}'" class="bg-[#F47521] text-black px-6 py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-bold text-xs uppercase tracking-wider hover:bg-white hover:shadow-none transition-all flex items-center gap-2">
                        <i class="fas fa-play"></i> Play
                    </button>
                    
                    <button onclick="window.app.handleHeroLibraryClick(this, '${id}', '${title.replace(/'/g, "\\'")}', '${img}')" class="bg-white/10 backdrop-blur-md text-white px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                        <i class="fas fa-plus"></i> Library
                    </button>
                </div>
            </div>
        </div>
    `;
}

// --- GLOBAL HOVER LISTENER ---
// You will call this function from your sliders (e.g., recent.js) using:
// onmouseenter="window.app.updateHeroPreview(animeDataObject)"
window.app.updateHeroPreview = async (animeData) => {
    // Stop the auto-rotation when the user takes control via hover
    if (window.app.state.heroInterval) clearInterval(window.app.state.heroInterval);
    
    // We need to fetch the AniList data for the hovered item quickly if it doesn't have it
    let previewData = { ...animeData };
    
    if (!previewData.finalPoster) {
        try {
            const cleanTitle = (animeData.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
            const query = `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { coverImage { extraLarge } averageScore trailer { id site } } }`;
            const aniRes = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { search: cleanTitle } }) });
            const aniData = await aniRes.json();
            
            if (aniData?.data?.Media) {
                previewData.finalPoster = aniData.data.Media.coverImage?.extraLarge || animeData.image;
                previewData.finalRating = aniData.data.Media.averageScore;
                previewData.trailerId = aniData.data.Media.trailer?.site === "youtube" ? aniData.data.Media.trailer.id : null;
            }
        } catch (e) {
            previewData.finalPoster = animeData.image;
        }
    }

    renderDynamicHero(previewData);
};

// --- AUTO ROTATE LOGIC ---
function startHeroAutoRotate(slides) {
    if (window.app.state.heroInterval) clearInterval(window.app.state.heroInterval);
    let index = 0;

    window.app.state.heroInterval = setInterval(() => {
        // If the user navigates away, kill the timer
        if (window.app.state.currentView !== 'home' || !document.getElementById('carousel-container')) {
            clearInterval(window.app.state.heroInterval);
            return;
        }
        index = (index + 1) % slides.length;
        renderDynamicHero(slides[index]);
    }, 8000); // 8 seconds per slide to allow trailers to start playing
}

// --- LIBRARY BUTTON LOGIC ---
window.app.handleHeroLibraryClick = async (btn, id, title, img) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) {
        if (window.app.components.auth) window.app.components.auth();
        else alert("Please log in or create an account to save to your Library!");
        return;
    }

    const formattedAnime = { id, title, img };

    if (profile.watchlist && profile.watchlist.some(item => item.id === id)) {
        return alert("This series is already in your Library!");
    }

    if(!profile.watchlist) profile.watchlist = [];
    profile.watchlist.unshift(formattedAnime);
    
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check text-green-400"></i> Added`;
    setTimeout(() => btn.innerHTML = originalHtml, 2000);

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { watchlist: firestore.arrayUnion(formattedAnime) });
    } catch (error) {
        console.error("Firebase update failed:", error);
    }
};
