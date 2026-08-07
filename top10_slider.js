// top10_slider.js - Netflix-style Top 10 of the Year Slider

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.topTenSlider = async () => {
    const container = document.getElementById('top10-slider-container');
    if (!container) return;

    const currentYear = new Date().getFullYear();

    // 1. SHOW LOADING SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-white pl-3 uppercase tracking-wider">Top 10 Anime of ${currentYear}</h2>
            <div class="flex gap-2 md:gap-4 overflow-hidden">
                ${[1, 2, 3, 4, 5].map((num) => `
                    <div class="flex items-center">
                        <div class="w-[60px] md:w-[100px] h-[120px] md:h-[180px] bg-white/5 animate-pulse rounded"></div>
                        <div class="w-[110px] md:w-[150px] h-[160px] md:h-[220px] bg-white/10 animate-pulse rounded-md -ml-6"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 2. FETCH TOP ANIME OF CURRENT YEAR FROM ANILIST (Fetch 25 to guarantee we get 10 matches on your API)
        const aniQuery = `
            query($year: Int) { 
                Page(page: 1, perPage: 25) { 
                    media(type: ANIME, seasonYear: $year, sort: POPULARITY_DESC) { 
                        title { english romaji } 
                        coverImage { extraLarge } 
                    } 
                } 
            }
        `;
        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aniQuery, variables: { year: currentYear } })
        });
        const aniData = await aniRes.json();
        const topAnimeList = aniData?.data?.Page?.media || [];

        // 3. CROSS-REFERENCE WITH CUSTOM API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        let matchedCount = 0;
        
        // We run in sequence or Promise.all, but we specifically need EXACTLY 10.
        // We'll map them all, filter nulls, and slice the top 10.
        const crossReferenced = await Promise.all(topAnimeList.map(async (ani) => {
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

        // Filter out unmatched and take exactly the top 10
        const finalTop10 = crossReferenced.filter(item => item !== null).slice(0, 10);

        if (finalTop10.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 4. RENDER THE TOP 10 UI WITH GIANT NUMBERS
        let cardsHtml = finalTop10.map((anime, index) => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const rank = index + 1;
            
            // Check memory state globally maintained by Carousel/Search
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            return `
            <div class="snap-start shrink-0 relative flex items-end h-[160px] md:h-[220px] group cursor-pointer hover:z-20 transition-transform duration-300 hover:scale-[1.03] ml-2 md:ml-6 pr-4"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <!-- Giant Stroke Number -->
                <div class="text-[100px] md:text-[150px] font-black leading-[0.75] tracking-tighter z-0 absolute left-0 bottom-0 pointer-events-none drop-shadow-[4px_4px_0_rgba(0,0,0,1)]" 
                     style="color: #050505; -webkit-text-stroke: 3px #ffffff; transform: translateX(-40%); font-family: 'Arial Black', Impact, sans-serif;">
                    ${rank}
                </div>
                
                <!-- Anime Poster -->
                <div class="relative w-[110px] md:w-[150px] aspect-[2/3] rounded-md overflow-hidden shadow-2xl z-10 border border-white/10 group-hover:border-white/50 transition-colors bg-black ml-[40px] md:ml-[70px]">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <!-- Permanent Save Button SVG -->
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-1.5 rounded ${isAdded ? 'bg-black/80' : 'bg-black/50'} backdrop-blur-md border border-white/10 shadow-lg hover:bg-black/90 hover:scale-110 transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <!-- Hover Overlay (Play Button) -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 md:p-3">
                        <button onclick="event.stopPropagation(); window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')" 
                                class="bg-white text-black w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] hover:scale-110 transition-transform mb-1">
                            <i class="fas fa-play text-xs md:text-sm pl-0.5"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="py-6 relative overflow-visible">
                <div class="px-4 md:px-8 flex items-center justify-between mb-2">
                    <h2 class="text-xl md:text-2xl font-black text-white drop-shadow-md">
                        Top 10 Anime in ${currentYear}
                    </h2>
                </div>
                
                <!-- Slider Container -->
                <div class="relative group/slider">
                    <!-- Left scroll button -->
                    <button id="top10-left-btn" class="hidden md:flex absolute left-2 top-[50%] -translate-y-1/2 z-30 w-10 h-10 bg-black/90 hover:bg-white hover:text-black border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    
                    <!-- Scrollable Track -->
                    <div id="top10-slider-track" class="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-6 pt-4 pl-4 md:pl-8 pr-12">
                        ${cardsHtml}
                    </div>
                    
                    <!-- Right scroll button -->
                    <button id="top10-right-btn" class="hidden md:flex absolute right-2 top-[50%] -translate-y-1/2 z-30 w-10 h-10 bg-black/90 hover:bg-white hover:text-black border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. ATTACH SCROLL LOGIC
        const track = document.getElementById('top10-slider-track');
        const leftBtn = document.getElementById('top10-left-btn');
        const rightBtn = document.getElementById('top10-right-btn');
        
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
        console.error("Top 10 Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};
