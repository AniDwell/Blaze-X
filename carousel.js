// carousel.js

// 1. Initial Load Check - This proves the browser actually read the file!
console.log("Carousel script initialized.");

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    
    // Failsafe: If the container doesn't exist in HTML, stop here.
    if (!container) {
        console.error("CRITICAL: 'carousel-container' div is missing from index.html!");
        return;
    }

    // 2. Wrap EVERYTHING in a massive Try/Catch block to catch silent crashes
    try {
        // Show Loading Skeleton
        container.innerHTML = `
            <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-[#111] flex flex-col items-center justify-center border-b border-white/5">
                <div class="tk-loader scale-50 mb-4">
                    <div class="tk-dot tk-dot-1"></div>
                    <div class="tk-dot tk-dot-2"></div>
                </div>
                <p class="text-xs text-[#F47521] font-bold tracking-widest uppercase">Fetching Anime Data...</p>
            </div>
        `;

        // 3. Attempt to Fetch Data
        console.log("Fetching from /api/anikoto/recent-anime?page=1...");
        const response = await window.app.api.fetch('/recent-anime?page=1');
        
        // Error Catch 1: No Response (Proxy Failure or 404)
        if (!response) {
            throw new Error("Network request returned NULL. The Cloudflare _redirects proxy might be failing or the API is completely down.");
        }

        // Error Catch 2: Unexpected Data Structure
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
            throw new Error("API connected, but 'data' array is empty or missing. Anikoto might have changed their JSON structure: " + JSON.stringify(response));
        }

        // 4. Data is safe! Let's build the UI.
        const slides = response.data.slice(0, 5);
        window.app.state.carouselItems = slides; // Stash safely in memory

        let slidesHtml = '';
        let dotsHtml = '';

        slides.forEach((s, i) => {
            // Extreme fallback mapping to prevent undefined variable crashes
            const id = s.id || s.slug || 'unknown';
            const title = s.title || s.name || 'Unknown Title';
            const desc = s.description || 'No synopsis available for this title.';
            const img = s.background_image || s.poster || 'https://via.placeholder.com/1280x720?text=No+Image';

            slidesHtml += `
                <div class="carousel-slide absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === 0 ? 'opacity-100 z-20' : 'opacity-0 z-10'}" id="slide-${i}">
                    <img src="${img}" class="absolute inset-0 w-full h-full object-cover blur-backdrop opacity-40 z-0">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent z-10"></div>
                    
                    <div class="absolute bottom-8 left-4 md:bottom-12 md:left-12 z-30 max-w-[85%] md:max-w-2xl pr-8">
                        <h2 class="text-3xl md:text-5xl font-black text-white mb-3 drop-shadow-2xl line-clamp-2 tracking-tight">${title}</h2>
                        <p class="text-xs md:text-sm text-gray-300 line-clamp-3 mb-6 drop-shadow-lg leading-relaxed font-medium">${desc}</p>
                        
                        <div class="flex gap-3">
                            <button onclick="window.location.hash='watch/${id}/1/sub'" class="bg-[#F47521] text-black px-6 py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-bold text-xs uppercase tracking-wide">
                                <i class="fas fa-play"></i> Play
                            </button>
                            
                            <button onclick="window.app.handleCarouselLibraryClick(${i})" class="bg-white/10 backdrop-blur-md text-white px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>
                    </div>
                </div>
            `;

            dotsHtml += `
                <div class="carousel-dot w-1.5 h-1.5 md:w-2 md:h-2 rounded-sm transition-all duration-300 ${i === 0 ? 'bg-[#F47521] h-5 md:h-7' : 'bg-white/20'}" id="dot-${i}"></div>
            `;
        });

        container.innerHTML = `
            <div class="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden bg-black border-b border-white/5">
                <div id="hero-slides" class="relative w-full h-full">${slidesHtml}</div>
                <div class="absolute right-4 md:right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-1.5 z-30" id="carousel-indicators">${dotsHtml}</div>
            </div>
        `;

        startFadeCarousel(slides.length);

    } catch (error) {
        // --- THE MASTER ERROR CATCHER ---
        console.error("CAROUSEL CRASHED:", error);
        
        container.innerHTML = `
            <div class="w-full aspect-[4/5] md:aspect-video flex flex-col items-center justify-center bg-red-950/30 border-b border-red-500/50 p-6">
                <i class="fas fa-bug text-red-500 text-5xl mb-4"></i>
                <h2 class="text-red-500 font-black text-xl mb-2 text-center uppercase tracking-widest">Carousel System Crash</h2>
                <div class="bg-black border border-red-500/30 p-4 rounded text-left max-w-lg w-full">
                    <p class="text-red-400 font-mono text-xs mb-2"><b>Error Message:</b><br>${error.message}</p>
                    <p class="text-gray-500 font-mono text-[10px] break-all"><b>Stack Trace:</b><br>${error.stack}</p>
                </div>
            </div>
        `;
    }
};

// --- ANIMATION ENGINE ---
function startFadeCarousel(count) {
    let currentIndex = 0;
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);

    window.app.state.carouselInterval = setInterval(() => {
        if (window.app.state.currentView !== 'home' || !document.getElementById('hero-slides')) {
            clearInterval(window.app.state.carouselInterval);
            return;
        }

        const currentSlide = document.getElementById(`slide-${currentIndex}`);
        const currentDot = document.getElementById(`dot-${currentIndex}`);

        if (currentSlide) {
            currentSlide.classList.replace('opacity-100', 'opacity-0');
            currentSlide.classList.replace('z-20', 'z-10');
        }
        if (currentDot) {
            currentDot.classList.remove('bg-[#F47521]', 'h-5', 'md:h-7');
            currentDot.classList.add('bg-white/20', 'h-1.5', 'md:h-2');
        }

        currentIndex = (currentIndex + 1) % count;

        const nextSlide = document.getElementById(`slide-${currentIndex}`);
        const nextDot = document.getElementById(`dot-${currentIndex}`);

        if (nextSlide) {
            nextSlide.classList.replace('opacity-0', 'opacity-100');
            nextSlide.classList.replace('z-10', 'z-20');
        }
        if (nextDot) {
            nextDot.classList.remove('bg-white/20', 'h-1.5', 'md:h-2');
            nextDot.classList.add('bg-[#F47521]', 'h-5', 'md:h-7');
        }
    }, 5000);
}

// --- FIREBASE DB LIBRARY FUNCTION ---
window.app.handleCarouselLibraryClick = async (index) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) return alert("Syncing user session. Please wait.");

    const rawData = window.app.state.carouselItems[index];
    if (!rawData) return;

    const formattedAnime = {
        id: rawData.id,
        title: rawData.title,
        img: rawData.poster || rawData.background_image || ''
    };

    if (profile.watchlist.some(item => item.id === formattedAnime.id)) {
        return alert("This series is already in your Library!");
    }

    profile.watchlist.unshift(formattedAnime);
    alert(`Added to library!`);

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { watchlist: firestore.arrayUnion(formattedAnime) });
    } catch (error) {
        console.error("Firebase update failed:", error);
    }
};
