// popular_slider.js - "Super Rich" One-Card-At-A-Time Slider (Orange Theme)

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.popularSlider = async () => {
    const container = document.getElementById('popular-container');
    if (!container) return;

    // 1. SHOW SKELETON (Wide format for 1-card + glance)
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">All-Time Popular</h2>
            <div class="flex gap-4 overflow-hidden">
                <div class="min-w-[85vw] md:min-w-[600px] h-[180px] md:h-[240px] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                <div class="min-w-[85vw] md:min-w-[600px] h-[180px] md:h-[240px] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
            </div>
        </div>
    `;

    try {
        // 2. FETCH ALL-TIME POPULAR & DESCRIPTIONS FROM ANILIST
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 15) { 
                    media(type: ANIME, sort: POPULARITY_DESC) { 
                        id
                        title { english romaji } 
                        coverImage { extraLarge } 
                        bannerImage
                        averageScore
                        format
                        description(asHtml: false)
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
            const cleanDesc = ani.description ? ani.description.replace(/<[^>]*>?/gm, '').trim() : 'No description available for this series.';
            
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
                        banner: ani.bannerImage || ani.coverImage.extraLarge,
                        score: ani.averageScore || 'N/A',
                        desc: cleanDesc,
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

        // 4. RENDER "SUPER RICH" CARDS (Orange Theme, No heavy gradients)
        let cardsHtml = finalSliderItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            const scoreHtml = anime.score !== 'N/A' 
                ? `<div class="flex items-center gap-1 text-[#F47521] mb-1 md:mb-2">
                       <i class="fas fa-star text-[10px] md:text-xs"></i>
                       <span class="text-[10px] md:text-xs font-black tracking-widest uppercase">${anime.score}% Score</span>
                   </div>`
                : '';

            return `
            <div class="pop-card snap-start shrink-0 w-[85vw] max-w-[600px] md:max-w-[700px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.02] hover:z-20"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="w-full h-[180px] md:h-[240px] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-[#111] flex relative">
                    
                    <!-- Faded watermark backdrop on the right side -->
                    <div class="absolute inset-0 z-0 opacity-[0.08] pointer-events-none" style="mask-image: linear-gradient(to left, black 30%, transparent 80%); -webkit-mask-image: linear-gradient(to left, black 30%, transparent 80%);">
                        <img src="${anime.banner}" class="w-full h-full object-cover">
                    </div>

                    <!-- Left: Poster Image -->
                    <div class="w-[120px] md:w-[160px] h-full shrink-0 relative z-10 p-2 md:p-3">
                        <img src="${anime.image}" class="w-full h-full object-cover rounded shadow-md border border-white/5">
                        
                        <!-- Top Left Format Badge -->
                        <div class="absolute top-3 left-3 p-1 flex flex-col gap-1 items-start z-10 pointer-events-none">
                            <span class="bg-black/80 backdrop-blur-sm text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                        </div>
                    </div>
                    
                    <!-- Right: Super Rich Details -->
                    <div class="flex-1 flex flex-col justify-start py-3 md:py-4 pr-12 md:pr-14 pl-1 md:pl-2 relative z-10 min-w-0">
                        
                        ${scoreHtml}
                        
                        <h3 class="text-base md:text-2xl font-black text-white line-clamp-1 md:line-clamp-2 drop-shadow-md mb-1.5 group-hover:text-[#F47521] transition-colors">${anime.title}</h3>
                        
                        <!-- Sub/Dub Badges -->
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-[#F47521]/90 backdrop-blur-sm text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded shadow-sm font-bold">CC ${anime.sub}</span>
                            ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded shadow-sm font-bold"><i class="fas fa-microphone text-[8px]"></i> ${anime.dub}</span>` : ''}
                        </div>
                        
                        <!-- Description -->
                        <p class="text-[10px] md:text-xs text-gray-400 line-clamp-3 md:line-clamp-4 leading-relaxed font-medium pr-2 mt-1">
                            ${anime.desc}
                        </p>
                    </div>

                    <!-- Permanent Save Button SVG -->
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-2 rounded bg-black/70 backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        All-Time Popular
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="pop-slide-left-btn" class="hidden md:flex absolute -left-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <!-- Track handles sliding 1 card at a time. The right padding ensures the last card doesn't get cut off. -->
                    <div id="popular-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0 pr-8 md:pr-16">
                        ${cardsHtml}
                    </div>
                    
                    <button id="pop-slide-right-btn" class="hidden md:flex absolute -right-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. ATTACH EXACT 1-CARD SCROLL LOGIC
        const track = document.getElementById('popular-slider-track');
        const leftBtn = document.getElementById('pop-slide-left-btn');
        const rightBtn = document.getElementById('pop-slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            leftBtn.addEventListener('click', () => { 
                const card = track.querySelector('.pop-card');
                const scrollAmount = card ? card.clientWidth + 16 : window.innerWidth * 0.85; // 16px is the gap
                track.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); 
            });
            rightBtn.addEventListener('click', () => { 
                const card = track.querySelector('.pop-card');
                const scrollAmount = card ? card.clientWidth + 16 : window.innerWidth * 0.85; 
                track.scrollBy({ left: scrollAmount, behavior: 'smooth' }); 
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
