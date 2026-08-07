// recent_slider.js - Latest Releases Slider (No Gradient, Permanent UI)

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.recentSlider = async () => {
    // Hooks into the <div id="recent-container"> already in your index.html
    const container = document.getElementById('recent-container');
    if (!container) return;

    // 1. SHOW SKELETON (140px / 190px sizes)
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Newest Releases</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5, 6].map(() => `
                    <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 2. FETCH LATEST EPISODES FROM CUSTOM API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const rawResponse = await fetch(`${baseUrl}/api/latest-episodes`);
        const response = await rawResponse.json();
        
        const recentEpisodes = response.data || response.results || [];

        if (recentEpisodes.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // Limit to top 15 to keep it fast
        const topRecent = recentEpisodes.slice(0, 15);

        // 3. ENRICH WITH ANILIST HIGH-RES COVERS
        const enrichedSlides = await Promise.all(topRecent.map(async (slide) => {
            // Clean up titles like "One Piece (Dub) Episode 1080" for better searching
            const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
            let finalImage = slide.image || slide.poster;
            
            try {
                const query = `query ($search: String) { 
                    Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                        coverImage { extraLarge } 
                    } 
                }`;
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: cleanTitle } })
                });
                const aniData = await aniRes.json();
                if (aniData?.data?.Media?.coverImage?.extraLarge) {
                    finalImage = aniData.data.Media.coverImage.extraLarge;
                }
            } catch(e) {}

            return {
                id: slide.id,
                title: cleanTitle,
                image: finalImage,
                episode: slide.episodeNumber || slide.episode || null,
                type: slide.type || 'TV',
                sub: slide.tvInfo?.sub || slide.sub || '?',
                dub: slide.tvInfo?.dub || slide.dub || 0
            };
        }));

        // 4. RENDER CARDS (No Gradient, No Play Button)
        let cardsHtml = enrichedSlides.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            // Highlight the latest episode number if available
            const epBadge = anime.episode ? `<span class="bg-white text-black text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-black border border-black/10">EP ${anime.episode}</span>` : '';

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
                        ${epBadge}
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
                        Newest Releases
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="recent-slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="recent-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="recent-slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        const track = document.getElementById('recent-slider-track');
        const leftBtn = document.getElementById('recent-slide-left-btn');
        const rightBtn = document.getElementById('recent-slide-right-btn');
        
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
