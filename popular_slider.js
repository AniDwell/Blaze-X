// popular_slider.js - Cinematic One-Card-At-A-Time Slider for All-Time Popular Anime

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.popularSlider = async () => {
    // Hooks into the <div id="popular-container"> in your index.html
    const container = document.getElementById('popular-container');
    if (!container) return;

    // 1. SHOW CINEMATIC LOADING SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative max-w-[1200px] mx-auto">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-yellow-500 pl-3 uppercase tracking-wider drop-shadow-md">All-Time Popular</h2>
            <div class="w-full h-[220px] md:h-[300px] bg-white/5 animate-pulse rounded-2xl border border-white/5"></div>
        </div>
    `;

    try {
        // 2. FETCH ALL-TIME POPULAR FROM ANILIST
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 20) { 
                    media(type: ANIME, sort: POPULARITY_DESC) { 
                        id
                        title { english romaji } 
                        coverImage { extraLarge } 
                        bannerImage
                        averageScore
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
        const popularList = aniData?.data?.Page?.media || [];

        // 3. CROSS-REFERENCE WITH CUSTOM API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        const crossReferenced = await Promise.all(popularList.map(async (ani) => {
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
                        banner: ani.bannerImage || ani.coverImage.extraLarge, // Fallback to cover if no banner
                        score: ani.averageScore || 'N/A',
                        type: match.type || ani.format || 'TV',
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

        // 4. RENDER WIDE CINEMATIC CARDS
        let cardsHtml = finalSliderItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            const scoreHtml = anime.score !== 'N/A' 
                ? `<div class="flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 md:px-3 md:py-1.5 rounded-lg w-fit mb-2 shadow-lg backdrop-blur-md">
                       <i class="fas fa-star text-[10px] md:text-sm"></i>
                       <span class="text-[11px] md:text-[13px] font-black tracking-widest uppercase">${anime.score}% Rating</span>
                   </div>`
                : '';

            return `
            <div class="snap-center shrink-0 w-full relative rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 group cursor-pointer transition-transform duration-300 hover:border-yellow-500/50"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <!-- Background Banner Image -->
                <div class="absolute inset-0 z-0 bg-black">
                    <img src="${anime.banner}" loading="lazy" class="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-700 object-center">
                    
                    <!-- Heavy Gradients to ensure text readability -->
                    <div class="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/90 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
                </div>
                
                <!-- Content Container -->
                <div class="relative z-10 flex p-4 md:p-6 h-[220px] md:h-[300px] gap-4 md:gap-8 items-center">
                    
                    <!-- Left: Cover Poster -->
                    <img src="${anime.image}" class="w-[110px] md:w-[170px] h-full object-cover rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 group-hover:-translate-y-1 transition-transform duration-300">
                    
                    <!-- Right: Text Information -->
                    <div class="flex flex-col flex-1 justify-center py-2 min-w-0 pr-10 md:pr-16">
                        
                        <!-- Most Important: Rating -->
                        ${scoreHtml}
                        
                        <!-- Title -->
                        <h3 class="text-xl md:text-4xl font-black text-white line-clamp-2 md:line-clamp-3 leading-tight drop-shadow-md mb-3 md:mb-4 group-hover:text-yellow-500 transition-colors">${anime.title}</h3>
                        
                        <!-- Sub/Dub & Type Badges -->
                        <div class="flex flex-wrap items-center gap-2 mt-auto">
                            <span class="bg-black/60 backdrop-blur-md text-white text-[10px] md:text-xs px-2.5 py-1 rounded font-bold uppercase border border-white/10 shadow-sm">${anime.type}</span>
                            <span class="bg-[#F47521] text-black text-[10px] md:text-xs px-2.5 py-1 rounded shadow-sm font-black tracking-wider border border-[#F47521]">CC ${anime.sub}</span>
                            ${anime.dub > 0 ? `<span class="bg-purple-600 text-white text-[10px] md:text-xs px-2.5 py-1 rounded shadow-sm font-black tracking-wider border border-purple-500"><i class="fas fa-microphone text-[9px] md:text-[11px]"></i> ${anime.dub}</span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Save Button (Top Right) -->
                <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                        data-added="${isAdded}"
                        class="absolute top-4 right-4 z-30 p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                    ${isAdded ? savedSvg : unsavedSvg}
                </button>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative max-w-[1200px] mx-auto">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-yellow-500 pl-3 uppercase tracking-wider drop-shadow-md">
                        All-Time Popular
                    </h2>
                </div>
                
                <div class="relative group/slider rounded-2xl">
                    <button id="pop-slide-left-btn" class="hidden md:flex absolute -left-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-yellow-500 hover:text-black border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <!-- Track handles sliding 1 card at a time perfectly -->
                    <div id="popular-slider-track" class="flex gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-2">
                        ${cardsHtml}
                    </div>
                    
                    <button id="pop-slide-right-btn" class="hidden md:flex absolute -right-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-yellow-500 hover:text-black border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. ATTACH SCROLL LOGIC
        const track = document.getElementById('popular-slider-track');
        const leftBtn = document.getElementById('pop-slide-left-btn');
        const rightBtn = document.getElementById('pop-slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            // Scroll by exactly one card width + gap
            leftBtn.addEventListener('click', () => { 
                const cardWidth = track.clientWidth;
                track.scrollBy({ left: -cardWidth, behavior: 'smooth' }); 
            });
            rightBtn.addEventListener('click', () => { 
                const cardWidth = track.clientWidth;
                track.scrollBy({ left: cardWidth, behavior: 'smooth' }); 
            });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

    } catch (error) {
        console.error("Popular Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};
