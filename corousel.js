// carousel.js

window.app.components.carousel = async () => {
    const container = document.getElementById('carousel-container');

    // 1. Loading Skeleton
    container.innerHTML = `
        <div class="w-full aspect-[4/5] md:aspect-[21/9] bg-[#0a0a0a] animate-pulse flex items-center justify-center">
            <div class="tk-loader scale-50">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
        </div>
    `;

    // 2. Fetch Data (Using recent-anime endpoint as standard proxy for Anikoto's catalog)
    const response = await window.app.api.fetch('/recent-anime?page=1');
    
    // Safety check
    if (!response || !response.data || response.data.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm border border-gray-800 mx-4 rounded-lg bg-[#111]">Carousel offline. Check API connection.</div>`;
        return;
    }

    // Grab the top 5 items
    const slides = response.data.slice(0, 5);

    // 3. Build HTML
    let slidesHtml = '';
    let dotsHtml = '';

    slides.forEach((s, i) => {
        const id = s.id || s.slug;
        const title = s.title || s.name;
        const desc = s.description || 'No synopsis available for this series.';
        const img = s.background_image || s.poster || 'https://via.placeholder.com/1280x720?text=No+Image';

        // FADE LOGIC: Active slide is opacity-100 & z-20. Hidden slides are opacity-0 & z-10.
        slidesHtml += `
            <div class="carousel-slide absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === 0 ? 'opacity-100 z-20' : 'opacity-0 z-10'}" id="slide-${i}">
                <img src="${img}" class="absolute inset-0 w-full h-full object-cover blur-backdrop opacity-50 z-0">
                
                <!-- Heavy gradients to make text readable -->
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent z-10"></div>
                
                <!-- Content Area -->
                <div class="absolute bottom-8 left-4 md:bottom-12 md:left-12 z-30 max-w-[85%] md:max-w-2xl pr-8">
                    <h2 class="text-3xl md:text-5xl font-black text-white mb-3 drop-shadow-lg line-clamp-1">${title}</h2>
                    <p class="text-xs md:text-sm text-gray-300 line-clamp-3 mb-6 drop-shadow-md">${desc}</p>
                    
                    <div class="flex gap-3">
                        <!-- PLAY BUTTON -> opens play.html as requested -->
                        <button onclick="window.location.href='play.html?id=${id}'" class="bg-[#F47521] text-black px-6 py-2.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.4)] font-bold text-xs md:text-sm hover:bg-white hover:shadow-none transition-all flex items-center gap-2">
                            <i class="fas fa-play"></i> PLAY
                        </button>
                        
                        <!-- ADD TO LIBRARY BUTTON -> triggers Firebase DB update -->
                        <button onclick='window.app.addToLibrary(${JSON.stringify({id: id, title: title.replace(/'/g, ""), img: s.poster || img})})' class="bg-gray-800/80 backdrop-blur text-white px-5 py-2.5 rounded font-bold text-xs md:text-sm hover:bg-gray-700 transition-colors border border-white/10 flex items-center gap-2">
                            <i class="fas fa-bookmark"></i> LIBRARY
                        </button>
                    </div>
                </div>
            </div>
        `;

        // VERTICAL SQUARE DOTS: Active dot is taller (h-6)
        dotsHtml += `
            <div class="carousel-dot w-2 h-2 md:w-2.5 md:h-2.5 transition-all duration-300 ${i === 0 ? 'bg-[#F47521] h-6 md:h-8' : 'bg-white/30'}" id="dot-${i}"></div>
        `;
    });

    // Mount to the DOM
    container.innerHTML = `
        <div class="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden group bg-black">
            <!-- Fade Slides Container -->
            <div id="hero-slides" class="relative w-full h-full">
                ${slidesHtml}
            </div>
            
            <!-- Vertical Indicators (Positioned on the Right) -->
            <div class="absolute right-4 md:right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-30" id="carousel-indicators">
                ${dotsHtml}
            </div>
        </div>
    `;

    // 4. Start the Cross-Fade Logic
    startFadeCarousel(slides.length);
};


// --- HELPER: ANIMATION LOGIC ---
function startFadeCarousel(count) {
    let currentIndex = 0;

    // Clear any existing intervals to prevent overlapping bugs
    if (window.app.state.carouselInterval) clearInterval(window.app.state.carouselInterval);

    window.app.state.carouselInterval = setInterval(() => {
        // Stop timer if user navigates away from the home view
        if (window.app.state.currentView !== 'home' || !document.getElementById('hero-slides')) {
            clearInterval(window.app.state.carouselInterval);
            return;
        }

        const currentSlide = document.getElementById(`slide-${currentIndex}`);
        const currentDot = document.getElementById(`dot-${currentIndex}`);

        // Fade OUT current
        if(currentSlide) {
            currentSlide.classList.replace('opacity-100', 'opacity-0');
            currentSlide.classList.replace('z-20', 'z-10');
        }
        if(currentDot) {
            currentDot.classList.replace('bg-[#F47521]', 'bg-white/30');
            currentDot.classList.replace('h-6', 'h-2');
            currentDot.classList.replace('md:h-8', 'md:h-2.5');
        }

        // Calculate next index
        currentIndex = (currentIndex + 1) % count;

        const nextSlide = document.getElementById(`slide-${currentIndex}`);
        const nextDot = document.getElementById(`dot-${currentIndex}`);

        // Fade IN next
        if(nextSlide) {
            nextSlide.classList.replace('opacity-0', 'opacity-100');
            nextSlide.classList.replace('z-10', 'z-20');
        }
        if(nextDot) {
            nextDot.classList.replace('bg-white/30', 'bg-[#F47521]');
            nextDot.classList.replace('h-2', 'h-6');
            nextDot.classList.replace('md:h-2.5', 'md:h-8');
        }

    }, 5000); // Fades every 5 seconds
}


// --- HELPER: FIREBASE LIBRARY UPDATE ---
window.app.addToLibrary = async (anime) => {
    // 1. Check if user is loaded and logged in
    const profile = window.app.state.activeProfile;
    if (!profile || !profile.uid) {
        alert("Please wait for your profile to sync.");
        return;
    }

    // 2. Check if already in library to prevent duplicates
    const alreadyExists = profile.watchlist.some(item => item.id === anime.id);
    if (alreadyExists) {
        alert("This anime is already in your Library!");
        return;
    }

    // 3. Add to local state immediately (Instant UI feedback)
    profile.watchlist.unshift(anime);
    alert(`Added "${anime.title}" to your Library!`);

    // 4. Update Firebase Firestore Document
    try {
        // Using dynamic imports because this script isn't a module
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        
        await firestore.updateDoc(userRef, {
            watchlist: firestore.arrayUnion(anime)
        });
        console.log("Successfully synced to Firebase!");
    } catch (error) {
        console.error("Error saving to Firebase:", error);
    }
};
