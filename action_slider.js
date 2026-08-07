// action_slider.js - Netflix-style Action Anime Slider with Library & Loading Transitions

window.app = window.app || {};
window.app.components = window.app.components || {};

// Ensure the library set exists (in case slider loads before carousel)
window.app.state = window.app.state || {};
window.app.state.carouselLibrarySet = window.app.state.carouselLibrarySet || new Set();

// --- 1. PAGE TRANSITION & LOADING ANIMATION ---
window.app.openAnimeInfo = (id) => {
    // Inject the CSS for the looping orange bar if it doesn't exist
    if (!document.getElementById('slider-loader-style')) {
        const style = document.createElement('style');
        style.id = 'slider-loader-style';
        style.textContent = `
            @keyframes sliderLoadingBar {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200vw); }
            }
            .slider-loading-bar {
                position: fixed;
                top: 0;
                left: 0;
                width: 50vw;
                height: 3px;
                background-color: #F47521;
                z-index: 100000;
                animation: sliderLoadingBar 0.8s infinite linear;
                box-shadow: 0 0 10px #F47521, 0 0 5px #F47521;
            }
        `;
        document.head.appendChild(style);
    }

    // Create the dark screen overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] transition-opacity duration-300 opacity-0';
    document.body.appendChild(overlay);
    
    // Create the moving orange bar
    const loader = document.createElement('div');
    loader.className = 'slider-loading-bar';
    document.body.appendChild(loader);

    // Trigger the fade-in effect smoothly
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
    });

    // Navigate to info.html after a tiny delay so the user sees the animation
    setTimeout(() => {
        window.location.href = `info.html?id=${id}`;
    }, 150);
};

// --- 2. INSTANT LIBRARY SYNC (Just like carousel.js) ---
window.app.handleSliderLibraryClick = async (event, id, title, img) => {
    event.stopPropagation(); // Prevent the card click from opening info.html
    const btn = event.currentTarget;
    const docIdStr = String(id);
    const isAdded = btn.dataset.added === "true";

    try {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const auth = getAuth();
        
        // Ensure user is logged in
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Please log in to save to your Library!", "error");
            return;
        }

        const { getFirestore, doc, setDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const db = window.app.db || getFirestore();
        const libDocRef = doc(db, "users", auth.currentUser.uid, "library", docIdStr);

        if (isAdded) {
            // OPTIMISTIC UI: Instantly remove
            window.app.state.carouselLibrarySet.delete(docIdStr);
            btn.dataset.added = "false";
            btn.innerHTML = '<i class="fas fa-plus text-white text-sm"></i>';
            
            // Sync with Firestore
            await deleteDoc(libDocRef);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
        } else {
            // OPTIMISTIC UI: Instantly add
            window.app.state.carouselLibrarySet.add(docIdStr);
            btn.dataset.added = "true";
            btn.innerHTML = '<i class="fas fa-check text-green-500 text-sm drop-shadow-md"></i>';

            // Sync with Firestore
            await setDoc(libDocRef, { id: docIdStr, title, img, timestamp: Date.now() });
            if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
        }
    } catch (err) {
        console.error("Slider Library Sync Error:", err);
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
    }
};

// --- 3. SLIDER RENDERING COMPONENT ---
window.app.components.actionSlider = async () => {
    const container = document.getElementById('action-slider-container');
    if (!container) return;

    // Show Loading Skeleton Immediately
    container.innerHTML = `
        <div class="px-4 md:px-8 py-4">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider">Top Action Anime</h2>
            <div class="flex gap-3 md:gap-4 overflow-hidden">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="min-w-[130px] md:min-w-[180px] h-[195px] md:h-[270px] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // Fetch top Action anime from AniList
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 15) { 
                    media(type: ANIME, genre_in: ["Action"], sort: TRENDING_DESC) { 
                        title { english romaji } 
                        coverImage { extraLarge } 
                    } 
                } 
            }
        `;
        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aniQuery })
        });
        const aniData = await aniRes.json();
        const actionAnimeList = aniData?.data?.Page?.media || [];

        // Cross-reference with your custom API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        const crossReferenced = await Promise.all(actionAnimeList.map(async (ani) => {
            const title = ani.title.english || ani.title.romaji;
            try {
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(title)}`);
                const searchJson = await searchRes.json();
                
                const results = searchJson.data || searchJson.results || [];
                if (results.length > 0) {
                    const match = results[0]; 
                    return {
                        id: match.id,
                        title: title, 
                        image: ani.coverImage.extraLarge || match.image || match.poster, 
                        type: match.type || 'TV',
                        sub: match.tvInfo?.sub || match.sub || '?',
                        dub: match.tvInfo?.dub || match.dub || 0
                    };
                }
            } catch(e) {
                console.log("Slider: API match failed for", title);
            }
            return null; 
        }));

        const finalSliderItems = crossReferenced.filter(item => item !== null);

        if (finalSliderItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // Render Cards
        let cardsHtml = finalSliderItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            
            // Check memory set to see if already in library
            const isAdded = window.app.state.carouselLibrarySet.has(String(anime.id));
            const btnIcon = isAdded ? '<i class="fas fa-check text-green-500 text-sm drop-shadow-md"></i>' : '<i class="fas fa-plus text-white text-sm"></i>';
            
            return `
            <div class="snap-start shrink-0 w-[130px] md:w-[180px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.openAnimeInfo('${anime.id}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/5 group-hover:border-[#F47521]/70 transition-colors">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <!-- Permanent Top-Right Library Button -->
                    <button onclick="window.app.handleSliderLibraryClick(event, '${anime.id}', '${safeTitle}', '${anime.image}')"
                            class="absolute top-2 right-2 z-20 w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all hover:bg-white/20 hover:scale-110 shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                            data-added="${isAdded ? 'true' : 'false'}">
                        ${btnIcon}
                    </button>
                    
                    <!-- Hover Overlay (Play Button) -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 md:p-3 pointer-events-none">
                        <div class="bg-[#F47521] text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,117,33,0.5)] mb-1">
                            <i class="fas fa-play text-xs md:text-sm pl-0.5"></i>
                        </div>
                    </div>
                    
                    <!-- Top Info Badges -->
                    <div class="absolute top-0 left-0 w-full p-2 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <span class="bg-black/70 backdrop-blur-sm text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                        <!-- Space left so it doesn't overlap the library button -->
                    </div>

                    <!-- Bottom Info Badges -->
                    <div class="absolute bottom-0 right-0 p-2 flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <span class="bg-[#F47521]/90 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded shadow-md font-bold">CC ${anime.sub}</span>
                        ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded shadow-md font-bold"><i class="fas fa-microphone text-[8px]"></i> ${anime.dub}</span>` : ''}
                    </div>
                </div>
                
                <h3 class="mt-2 text-xs md:text-sm text-gray-200 font-bold truncate group-hover:text-white transition-colors drop-shadow-md">${anime.title}</h3>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Action Anime
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <!-- Left scroll button -->
                    <button id="slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-30 w-10 h-10 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    
                    <!-- Scrollable Track -->
                    <div id="action-slider-track" class="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <!-- Right scroll button -->
                    <button id="slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-30 w-10 h-10 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        // Attach Horizontal Scroll Logic
        const track = document.getElementById('action-slider-track');
        const leftBtn = document.getElementById('slide-left-btn');
        const rightBtn = document.getElementById('slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            const scrollAmount = window.innerWidth > 768 ? 600 : 300;
            
            leftBtn.addEventListener('click', () => {
                track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
            
            rightBtn.addEventListener('click', () => {
                track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

    } catch (error) {
        console.error("Action Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};

// Initialize if scripts load late
document.addEventListener('DOMContentLoaded', () => {
    if (window.app.components.actionSlider) {
        window.app.components.actionSlider();
    }
});
