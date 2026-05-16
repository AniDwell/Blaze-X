// carousel.js

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');
    if (!container) return;

    // 1. Loading Skeleton
    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-[#0a0a0a] flex items-center justify-center border-b border-white/5">
            <div class="tk-loader scale-50">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
        </div>
    `;

    try {
        // Fetch from our active worker path
        const response = await window.app.api.fetch('/recent-anime?page=1');
        
        // Data Parser
        let rawSlides = [];
        if (response && Array.isArray(response)) {
            rawSlides = response;
        } else if (response && response.data && Array.isArray(response.data)) {
            rawSlides = response.data;
        }

        // Failsafe
        if (rawSlides.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-gray-500 text-xs border border-white/5 mx-4 rounded-xl bg-[#0a0a0a] tracking-widest uppercase">
                    <i class="fas fa-exclamation-circle mr-1 text-[#F47521]"></i> Stream Offline
                </div>
            `;
            return;
        }

        const slides = rawSlides.slice(0, 5);
        window.app.state.carouselItems = slides; 
        window.app.state.carouselCurrentIndex = 0;

        let slidesHtml = '';
        let dotsHtml = '';

        slides.forEach((s, i) => {
            const id = s.id || 'unknown';
            const title = s.title || 'Unknown Title';
            const desc = s.description || 'No synopsis available.';
            const img = s.image || s.cover || s.poster || s.background_image || s.thumbnail || 'https://via.placeholder.com/1280x720/111/fff?text=No+Image';

            slidesHtml += `
                <div class="carousel-slide absolute inset-0" id="slide-${i}" style="opacity: ${i === 0 ? '1' : '0'}; z-index: ${i === 0 ? '20' : '10'}; transition: opacity 1.5s ease-in-out;">
                    
                    <div class="absolute inset-0 cursor-pointer z-0 group" onclick="window.location.href='info.html?id=${id}'">
                        <img src="${img}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-105">
                        
                        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent md:w-2/3"></div>
                    </div>
                    
                    <div class="absolute bottom-8 left-4 md:bottom-12 md:left-12 z-30 max-w-[85%] md:max-w-2xl pr-8">
                        <h2 class="text-3xl md:text-5xl font-black text-white mb-3 drop-shadow-2xl line-clamp-2 tracking-tight cursor-pointer" onclick="window.location.href='info.html?id=${id}'">${title}</h2>
                        <p class="text-xs md:text-sm text-gray-300 line-clamp-3 mb-6 drop-shadow-lg leading-relaxed font-medium">${desc}</p>
                        
                        <div class="flex gap-3 relative z-40">
                            <button onclick="window.location.href='info.html?id=${id}'" class="bg-[#F47521] text-black px-6 py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-bold text-xs uppercase tracking-wider hover:bg-white hover:shadow-none transition-all flex items-center gap-2">
                                <i class="fas fa-play"></i> Play
                            </button>
                            
                            <button onclick="window.app.handleCarouselLibraryClick(${i})" class="bg-white/10 backdrop-blur-md text-white px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // HITBOX DOTS: The outer div is invisible but large so thumbs can easily tap it.
            dotsHtml += `
                <div onclick="window.app.goToCarouselSlide(${i})" class="py-2 pl-4 pr-2 cursor-pointer pointer-events-auto flex items-center justify-center">
                    <div class="carousel-dot w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm transition-all duration-300 shadow-md ${i === 0 ? 'bg-[#F47521] h-6 md:h-8' : 'bg-white/50 hover:bg-white'}" id="dot-${i}"></div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden bg-black border-b border-white/5">
                <div id="hero-slides" class="relative w-full h-full">${slidesHtml}</div>
                <div class="absolute right-2 md:right-8 top-1/2 transform -translate-y-1/2 flex flex-col z-50 pointer-events-auto" id="carousel-indicators">${dotsHtml}</div>
            </div>
        `;

        startAutoRotate();
        
    } catch (err) {
        console.error("Carousel Script Error:", err);
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
    const oldSlide = document.getElementById(`slide-${oldIndex}`);
    const oldDot = document.getElementById(`dot-${oldIndex}`);
    const newSlide = document.getElementById(`slide-${newIndex}`);
    const newDot = document.getElementById(`dot-${newIndex}`);

    if (oldSlide) {
        oldSlide.style.opacity = '0';
        oldSlide.classList.replace('z-20', 'z-10');
    }
    if (oldDot) {
        oldDot.classList.remove('bg-[#F47521]', 'h-6', 'md:h-8');
        oldDot.classList.add('bg-white/50');
    }

    if (newSlide) {
        newSlide.style.opacity = '1';
        newSlide.classList.replace('z-10', 'z-20');
    }
    if (newDot) {
        newDot.classList.remove('bg-white/50');
        newDot.classList.add('bg-[#F47521]', 'h-6', 'md:h-8');
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

window.app.handleCarouselLibraryClick = async (index) => {
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) return alert("Syncing user session. Please wait.");

    const rawData = window.app.state.carouselItems[index];
    if (!rawData) return;

    const formattedAnime = {
        id: rawData.id,
        title: rawData.title,
        img: rawData.image || rawData.cover || rawData.poster || rawData.background_image || ''
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
