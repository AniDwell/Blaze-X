// carousel.js

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');

    // 1. Loading Skeleton (TikTok style dots inside container bounds)
    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-[#0a0a0a] flex items-center justify-center">
            <div class="tk-loader scale-50">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
        </div>
    `;

    // 2. Fetch Data using proxy path
    const response = await window.app.api.fetch('/recent-anime?page=1');
    
    if (!response || !response.data || response.data.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-gray-500 text-xs border border-white/5 mx-4 rounded-xl bg-[#0a0a0a] tracking-widest uppercase">
                <i class="fas fa-exclamation-circle mr-1 text-[#F47521]"></i> Content Stream Unavailable
            </div>
        `;
        return;
    }

    // Grab top 5 items and stash them safely in application state to prevent character encoding bugs
    const slides = response.data.slice(0, 5);
    window.app.state.carouselItems = slides;

    // 3. Build HTML Layout cleanly
    let slidesHtml = '';
    let dotsHtml = '';

    slides.forEach((s, i) => {
        const id = s.id;
        const title = s.title;
        const desc = s.description || 'No synopsis available for this title.';
        const img = s.background_image || s.poster || 'https://via.placeholder.com/1280x720?text=No+Image';

        // Cross-Fade Stacked State UI
        slidesHtml += `
            <div class="carousel-slide absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === 0 ? 'opacity-100 z-20' : 'opacity-0 z-10'}" id="slide-${i}">
                <img src="${img}" class="absolute inset-0 w-full h-full object-cover blur-backdrop opacity-40 z-0">
                
                <!-- Advanced Contrast Masking -->
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent z-10"></div>
                
                <!-- Context Meta Layout -->
                <div class="absolute bottom-8 left-4 md:bottom-12 md:left-12 z-30 max-w-[85%] md:max-w-2xl pr-8">
                    <h2 class="text-3xl md:text-5xl font-black text-white mb-3 drop-shadow-2xl line-clamp-2 tracking-tight">${title}</h2>
                    <p class="text-xs md:text-sm text-gray-300 line-clamp-3 mb-6 drop-shadow-lg leading-relaxed font-medium">${desc}</p>
                    
                    <div class="flex gap-3">
                        <!-- Play Button routes via standard query mapping to standalone play.html -->
                        <button onclick="window.location.href='play.html?id=${id}'" class="bg-[#F47521] text-black px-6 py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-bold text-xs uppercase tracking-wider hover:bg-white hover:shadow-none transition-all flex items-center gap-2">
                            <i class="fas fa-play"></i> Play
                        </button>
                        
                        <!-- Library Action safely passes numerical array indices now to avoid single-quote code execution crashes -->
                        <button onclick="window.app.handleCarouselLibraryClick(${i})" class="bg-white/10 backdrop-blur-md text-white px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                            <i class="fas fa-plus"></i> Library
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Interactive Square Vertical Indicator Strips
        dotsHtml += `
            <div class="carousel-dot w-1.5 h-1.5 md:w-2 md:h-2 rounded-sm transition-all duration-300 ${i === 0 ? 'bg-[#F47521] h-5 md:h-7' : 'bg-white/20'}" id="dot-${i}"></div>
        `;
    });

    container.innerHTML = `
        <div class="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden bg-black border-b border-white/5">
            <div id="hero-slides" class="relative w-full h-full">
                ${slidesHtml}
            </div>
            <div class="absolute right-4 md:right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-1.5 z-30" id="carousel-indicators">
                ${dotsHtml}
            </div>
        </div>
    `;

    // 4. Initiate Safe Animation Loops
    startFadeCarousel(slides.length);
};

// --- CORE ANIMATION LOOP ENGINE ---
function startFadeCarousel(count) {
    let currentIndex = 0;

    if (window.app.state.carouselInterval) {
        clearInterval(window.app.state.carouselInterval);
    }

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

// --- SECURED ROUTING DATA HANDLER FOR FIREBASE ---
window.app.handleCarouselLibraryClick = async (index) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) {
        alert("Syncing user session. Please try again in a moment.");
        return;
    }

    // Retrieve full data packet safely by index from local cache memory
    const rawData = window.app.state.carouselItems[index];
    if (!rawData) return;

    const formattedAnime = {
        id: rawData.id,
        title: rawData.title,
        img: rawData.poster || rawData.background_image || ''
    };

    const alreadyExists = profile.watchlist.some(item => item.id === formattedAnime.id);
    if (alreadyExists) {
        alert("This series is already in your Library!");
        return;
    }

    // Update UI client state immediately for snappy execution speed
    profile.watchlist.unshift(formattedAnime);
    alert(`Added to library!`);

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        
        await firestore.updateDoc(userRef, {
            watchlist: firestore.arrayUnion(formattedAnime)
        });
        console.log("Database updated successfully.");
    } catch (error) {
        console.error("Firebase update failed:", error);
    }
};
) {
        console.error("Error saving to Firebase:", error);
    }
};
