// upcoming_slider.js - Larger Slider for Upcoming Anime (Permanent UI)

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.upcomingSlider = async () => {
    const container = document.getElementById('upcoming-slider-container');
    if (!container) return;

    // 1. SHOW LOADING SKELETON (Larger Dimensions)
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#3b82f6] pl-3 uppercase tracking-wider drop-shadow-md">Upcoming Releases</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5].map(() => `
                    <div class="min-w-[160px] md:min-w-[220px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 2. FETCH UPCOMING ANIME FROM ANILIST
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 15) { 
                    media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) { 
                        id
                        title { english romaji } 
                        coverImage { extraLarge } 
                        startDate { year month day }
                        format
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
        const upcomingList = aniData?.data?.Page?.media || [];

        // 3. CROSS-REFERENCE WITH YOUR CUSTOM API (Graceful Fallback)
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        const crossReferenced = await Promise.all(upcomingList.map(async (ani) => {
            const title = ani.title.english || ani.title.romaji;
            
            // Format Release Date
            let releaseDate = "TBA";
            if (ani.startDate?.year) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                if (ani.startDate.month && ani.startDate.day) {
                    releaseDate = `${months[ani.startDate.month - 1]} ${ani.startDate.day}, ${ani.startDate.year}`;
                } else if (ani.startDate.month) {
                    releaseDate = `${months[ani.startDate.month - 1]} ${ani.startDate.year}`;
                } else {
                    releaseDate = `${ani.startDate.year}`;
                }
            }

            // Default object (uses AniList ID if not found in custom API)
            let matchData = {
                id: ani.id, 
                title: title,
                image: ani.coverImage.extraLarge,
                type: ani.format || 'TV',
                sub: '?',
                dub: 0,
                releaseDate: releaseDate
            };

            try {
                // Check if it's already in your system
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(title)}`);
                const searchJson = await searchRes.json();
                const results = searchJson.data || searchJson.results || [];
                
                if (results.length > 0) {
                    const match = results[0]; 
                    matchData.id = match.id;
                    matchData.image = match.image || match.poster || matchData.image;
                    matchData.type = match.type || matchData.type;
                    matchData.sub = match.tvInfo?.sub || match.sub || '?';
                    matchData.dub = match.tvInfo?.dub || match.dub || 0;
                }
            } catch(e) {}
            
            return matchData;
        }));

        if (crossReferenced.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 4. RENDER LARGER, PERMANENT-UI CARDS
        let cardsHtml = crossReferenced.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            
            // Check memory state globally maintained by Carousel/Search
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            // Scaled up SVG icons
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            return `
            <div class="snap-start shrink-0 w-[160px] md:w-[220px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#3b82f6]/70 transition-colors">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <!-- Permanent Dark Gradient for text readability -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"></div>

                    <!-- Permanent Save Button -->
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-2 rounded bg-black/70 backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <!-- Permanent Play Button & Date Ribbon at the bottom -->
                    <div class="absolute inset-0 flex flex-col justify-end p-2 md:p-3 z-20 pointer-events-none">
                        <div class="flex items-center justify-between mb-1 w-full pointer-events-auto">
                            <span class="bg-[#3b82f6] text-white text-[10px] md:text-xs px-2 py-1.5 rounded shadow-md font-black uppercase tracking-wide">
                                <i class="far fa-calendar-alt mr-1"></i> ${anime.releaseDate}
                            </span>
                            
                            <button onclick="event.stopPropagation(); window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')" 
                                    class="bg-white text-black w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)] hover:scale-110 transition-transform">
                                <i class="fas fa-play text-xs md:text-sm pl-0.5"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Permanent Top Left Info Badges -->
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        <span class="bg-black/80 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                        ${anime.sub !== '?' ? `<span class="bg-[#F47521]/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold">CC ${anime.sub}</span>` : ''}
                        ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold"><i class="fas fa-microphone text-[10px]"></i> ${anime.dub}</span>` : ''}
                    </div>
                </div>
                
                <h3 class="mt-2 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-[#3b82f6] transition-colors drop-shadow-md">${anime.title}</h3>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#3b82f6] pl-3 uppercase tracking-wider drop-shadow-md">
                        Upcoming Releases
                    </h2>
                </div>
                
                <!-- Slider Container -->
                <div class="relative group/slider">
                    <!-- Left scroll button -->
                    <button id="upcoming-slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#3b82f6] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <!-- Scrollable Track -->
                    <div id="upcoming-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <!-- Right scroll button -->
                    <button id="upcoming-slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#3b82f6] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. ATTACH SCROLL LOGIC
        const track = document.getElementById('upcoming-slider-track');
        const leftBtn = document.getElementById('upcoming-slide-left-btn');
        const rightBtn = document.getElementById('upcoming-slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            const scrollAmount = window.innerWidth > 768 ? 700 : 350; // Increased scroll for wider cards
            
            leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
            rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

    } catch (error) {
        console.error("Upcoming Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};
