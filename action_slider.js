// action_slider.js - Action Anime Slider (Slightly Smaller)

window.app = window.app || {};
window.app.components = window.app.components || {};

// --- GLOBAL PAGE TRANSITION EFFECT ---
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        const overlay = document.getElementById('page-transition-overlay');
        if (overlay) overlay.remove();
    }
});

window.app.sliderNavigate = (id, title, image, type, sub, dub) => {
    if (!document.getElementById('slider-transition-styles')) {
        const style = document.createElement('style');
        style.id = 'slider-transition-styles';
        style.innerHTML = `
            @keyframes loadingSlide {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
        `;
        document.head.appendChild(style);
    }

    const overlayHtml = `
        <div id="page-transition-overlay" class="fixed inset-0 z-[9999] flex flex-col transition-opacity duration-300 opacity-0">
            <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
            <div class="w-full h-1 bg-black/50 relative overflow-hidden z-10">
                <div class="w-1/2 h-full bg-[#F47521] rounded-r-full shadow-[0_0_10px_#F47521] animate-[loadingSlide_1s_infinite_ease-in-out]"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
    
    const overlayEl = document.getElementById('page-transition-overlay');
    requestAnimationFrame(() => {
        overlayEl.classList.remove('opacity-0');
        overlayEl.classList.add('opacity-100');
    });

    setTimeout(() => {
        if (typeof window.saveAndGo === 'function') {
            window.saveAndGo(id, title, image, type, sub, dub);
        } else {
            window.location.href = `info.html?id=${id}`;
        }
    }, 300);
};

// --- INSTANT SAVE / LIBRARY SYNC LOGIC ---
window.app.toggleSliderLibrary = async (event, btn, id, title, img) => {
    event.stopPropagation(); 
    
    try {
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
        const { doc, setDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        
        const auth = window.app.auth || getAuth();
        const db = window.app.db;
        
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Please log in to save to your Library!", "error");
            return;
        }

        const docIdStr = String(id);
        const isAdded = btn.dataset.added === "true";
        const libDocRef = doc(db, "users", auth.currentUser.uid, "library", docIdStr);

        const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
        const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

        if (isAdded) {
            btn.dataset.added = "false";
            btn.innerHTML = unsavedSvg;
            btn.classList.replace('bg-black/80', 'bg-black/50');
            if (window.app.state.carouselLibrarySet) window.app.state.carouselLibrarySet.delete(docIdStr);
            await deleteDoc(libDocRef);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
        } else {
            btn.dataset.added = "true";
            btn.innerHTML = savedSvg;
            btn.classList.replace('bg-black/50', 'bg-black/80');
            if (window.app.state.carouselLibrarySet) window.app.state.carouselLibrarySet.add(docIdStr);
            await setDoc(libDocRef, { id: docIdStr, title, img, timestamp: Date.now() });
            if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
        }
    } catch (error) { 
        if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
    }
};

window.app.components.actionSlider = async () => {
    const container = document.getElementById('action-slider-container');
    if (!container) return;

    // SCALED DOWN SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-4">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider">Top Action Anime</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
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
            } catch(e) {}
            return null; 
        }));

        const finalSliderItems = crossReferenced.filter(item => item !== null);

        if (finalSliderItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        let cardsHtml = finalSliderItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            // SCALED DOWN CARD SIZES (140px & 190px)
            return `
            <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-2 rounded bg-black/70 backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        <span class="bg-black/80 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                        <span class="bg-[#F47521]/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold">CC ${anime.sub}</span>
                        ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold"><i class="fas fa-microphone text-[10px]"></i> ${anime.dub}</span>` : ''}
                    </div>
                </div>
                
                <h3 class="mt-2 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-white transition-colors drop-shadow-md">${anime.title}</h3>
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
                    <button id="slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="action-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        const track = document.getElementById('action-slider-track');
        const leftBtn = document.getElementById('slide-left-btn');
        const rightBtn = document.getElementById('slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            const scrollAmount = window.innerWidth > 768 ? 600 : 300;
            leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
            rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

    } catch (error) {
        container.innerHTML = ''; 
    }
};
