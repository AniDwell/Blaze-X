// top10_slider.js - Custom Swiper Layout Top 10 with Instant Save

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.topTenSlider = async () => {
    const container = document.getElementById('top10-slider-container');
    if (!container) return;

    // Only render if on home view
    if (window.app.state.currentView !== 'home') return;

    const currentYear = new Date().getFullYear();

    // 1. INJECT CUSTOM CSS ONCE
    if (!document.getElementById('top10-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'top10-custom-styles';
        style.innerHTML = `
            .top10-swiper {
                width: 100%;
                height: auto;
                overflow: hidden;
                position: relative;
                margin: 10px 0;
            }
            .top10-swiper-wrapper {
                display: flex;
                align-items: flex-start;
                gap: 28px;  
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                padding: 10px 10px 30px 40px; /* 40px left padding so the first number isn't cut off */
                scrollbar-width: none;  /* Firefox */
            }
            .top10-swiper-wrapper::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Edge */
            }
            .top10-swiper-slide {
                flex: 0 0 auto;
                width: 120px;
                scroll-snap-align: center;
                position: relative;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            .top10-swiper-slide:hover {
                transform: scale(1.05);
                z-index: 20;
            }
            .top10-swiper-slide img {
                width: 100%;
                aspect-ratio: 2/3;
                object-fit: cover;
                border-radius: 16px;   
                box-shadow: 0 6px 18px rgba(0,0,0,0.35); 
                display: block;
            }
            .top10-slide-number {
                position: absolute;
                bottom: 5px;
                left: -30px;
                color: white;  
                font-size: 90px;
                line-height: 0.8;
                font-weight: bold;
                padding: 8px 14px;
                border-radius: 14px;
                text-shadow: 0 0 14px rgba(0,0,0,0.9), 0 0 25px rgba(0,0,0,0.7);
                background: rgba(0,0,0,0.15);
                z-index: 10;
                pointer-events: none; /* Allows clicking through the number */
            }
        `;
        document.head.appendChild(style);
    }

    // 2. SHOW LOADING SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-2">
            <h2 class="text-xl md:text-2xl font-black text-white mb-2 pl-3 drop-shadow-md">Top 10 Anime of ${currentYear}</h2>
            <div class="top10-swiper-wrapper">
                ${[1, 2, 3, 4, 5].map((num) => `
                    <div class="top10-swiper-slide">
                        <span class="top10-slide-number text-gray-700">${num}</span>
                        <div class="w-full aspect-[2/3] bg-white/5 animate-pulse rounded-[16px]"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 3. FETCH TOP ANIME OF CURRENT YEAR FROM ANILIST
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

        // 4. CROSS-REFERENCE WITH YOUR CUSTOM API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
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

        // 5. RENDER THE CUSTOM LAYOUT UI
        let slidesHtml = finalTop10.map((anime, index) => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const rank = index + 1;
            
            // Check memory state globally maintained by Carousel/Search
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            // Wrapping click handler safely, reusing action_slider's navigation
            return `
                <div class="top10-swiper-slide" onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                    <span class="top10-slide-number">${rank}</span>
                    <img src="${anime.image}" alt="Slide ${rank}">
                    
                    <!-- Permanent Save Button SVG -->
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-1.5 rounded-[8px] ${isAdded ? 'bg-black/80' : 'bg-black/50'} backdrop-blur-md border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)] hover:bg-black/90 hover:scale-110 transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="pt-6 relative overflow-visible">
                <div class="px-4 md:px-8 flex items-center justify-between">
                    <h2 class="text-xl md:text-2xl font-black text-white drop-shadow-md border-l-4 border-[#F47521] pl-3 uppercase tracking-wider">
                        Top 10 of ${currentYear}
                    </h2>
                </div>
                
                <div class="top10-swiper">
                    <div class="top10-swiper-wrapper">
                        ${slidesHtml}
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Top 10 Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};

