// slider.js - Netflix-style Action Anime Slider

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.actionSlider = async () => {
    // Requires a div with id="action-slider-container" in your HTML
    const container = document.getElementById('action-slider-container');
    if (!container) return;

    // 1. SHOW LOADING SKELETON IMMEDIATELY
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
        // 2. FETCH TOP ACTION ANIME FROM ANILIST
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

        // 3. CROSS-REFERENCE WITH YOUR CUSTOM API
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        const crossReferenced = await Promise.all(actionAnimeList.map(async (ani) => {
            const title = ani.title.english || ani.title.romaji;
            try {
                // Search your database for the Anilist title
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(title)}`);
                const searchJson = await searchRes.json();
                
                // Account for both possible JSON response structures from your API
                const results = searchJson.data || searchJson.results || [];
                
                if (results.length > 0) {
                    const match = results[0]; // Grab the best match
                    return {
                        id: match.id,
                        title: title, // Use Anilist title for cleaner UI
                        image: ani.coverImage.extraLarge || match.image || match.poster, // Prefer HQ Anilist poster
                        type: match.type || 'TV',
                        sub: match.tvInfo?.sub || match.sub || '?',
                        dub: match.tvInfo?.dub || match.dub || 0
                    };
                }
            } catch(e) {
                console.log("Slider: API match failed for", title);
            }
            return null; // Return null if not found in your API
        }));

        // Filter out anime that don't exist on your API
        const finalSliderItems = crossReferenced.filter(item => item !== null);

        if (finalSliderItems.length === 0) {
            container.innerHTML = ''; // Hide component if completely empty
            return;
        }

        // 4. RENDER THE NETFLIX-STYLE UI
        let cardsHtml = finalSliderItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            
            // Reusing window.saveAndGo() from search.js for unified history tracking & routing
            return `
            <div class="snap-start shrink-0 w-[130px] md:w-[180px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.saveAndGo('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/5 group-hover:border-[#F47521]/70 transition-colors">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <!-- Hover Overlay -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 md:p-3">
                        <button onclick="event.stopPropagation(); window.saveAndGo('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')" 
                                class="bg-[#F47521] text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,117,33,0.5)] hover:scale-110 transition-transform mb-1">
                            <i class="fas fa-play text-xs md:text-sm pl-0.5"></i>
                        </button>
                    </div>
                    
                    <!-- Top Info Badges (Visible on Hover) -->
                    <div class="absolute top-0 left-0 w-full p-2 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <span class="bg-black/70 backdrop-blur-sm text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                        <div class="flex flex-col gap-1 items-end">
                            <span class="bg-[#F47521]/90 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded shadow-md font-bold">CC ${anime.sub}</span>
                            ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded shadow-md font-bold"><i class="fas fa-microphone text-[8px]"></i> ${anime.dub}</span>` : ''}
                        </div>
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
                
                <!-- Slider Container -->
                <div class="relative group/slider">
                    <!-- Left scroll button (Desktop Only) -->
                    <button id="slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-10 h-10 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    
                    <!-- Scrollable Track -->
                    <div id="action-slider-track" class="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <!-- Right scroll button (Desktop Only) -->
                    <button id="slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-10 h-10 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. ATTACH SCROLL LOGIC FOR BUTTONS
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
            
            // Auto-hide buttons when at the edges
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; // Hidden initially since we're at left edge
        }

    } catch (error) {
        console.error("Action Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};

// Initialize the component when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.app.components.actionSlider) {
        window.app.components.actionSlider();
    }
});
