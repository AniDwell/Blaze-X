// genre_sliders.js - Bulletproof, Lazy-Loaded Vertical Stack of Genre Sliders

window.app = window.app || {};
window.app.components = window.app.components || {};

// Global scroll helper for dynamically generated tracks
window.app.scrollGenreTrack = (trackId, direction) => {
    const track = document.getElementById(trackId);
    if (track) {
        const scrollAmount = window.innerWidth > 768 ? 600 : 300;
        track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
};

window.app.components.genreSliders = async () => {
    const container = document.getElementById('genrebased-container');
    if (!container) return;

    try {
        // 1. FETCH ALL GENRES FROM ANILIST
        const query = `query { GenreCollection }`;
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await res.json();
        let genres = json.data?.GenreCollection || [];

        // 2. EXCLUDE ACTION (Already built as a separate slider)
        const excludedGenres = ['Action'];
        genres = genres.filter(g => !excludedGenres.includes(g));

        if (genres.length === 0) return;

        // 3. BUILD SKELETON ROWS FOR EACH GENRE
        let html = '';
        genres.forEach((genre, index) => {
            const is18 = genre.toLowerCase() === 'hentai' || genre.toLowerCase() === 'explicit';
            
            const bgClass = is18 ? 'bg-red-950/20 border-y border-red-900/50 py-8 my-6' : 'py-4 my-2';
            const titleColor = is18 ? 'text-red-500 border-red-600 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-white border-[#F47521]';
            const titleText = is18 ? `${genre} (18+ Adult)` : genre;
            const btnColor = is18 ? 'hover:bg-red-600' : 'hover:bg-[#F47521]';
            
            // Safe unique ID string
            const safeId = genre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const trackId = `track-${safeId}-${index}`;

            html += `
                <div class="genre-row-container relative ${bgClass} w-full min-h-[220px] group/slider" data-genre="${genre}" data-is18="${is18}">
                    <div class="px-4 md:px-8 mb-4 flex items-center justify-between">
                        <h2 class="text-xl md:text-2xl font-black ${titleColor} border-l-4 pl-3 uppercase tracking-wider drop-shadow-md">
                            ${titleText}
                        </h2>
                    </div>
                    
                    <div class="relative w-full">
                        <button class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 ${btnColor} border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl" onclick="window.app.scrollGenreTrack('${trackId}', -1)">
                            <i class="fas fa-chevron-left text-lg"></i>
                        </button>
                        
                        <div id="${trackId}" class="genre-slider-track flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-4 md:px-8 pb-4">
                            <!-- Skeletons -->
                            ${[1, 2, 3, 4, 5, 6].map(() => `
                                <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5 shrink-0"></div>
                            `).join('')}
                        </div>
                        
                        <button class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 ${btnColor} border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl" onclick="window.app.scrollGenreTrack('${trackId}', 1)">
                            <i class="fas fa-chevron-right text-lg"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // 4. STAGGERED & INTERSECTION OBSERVER LAZY LOADING
        // This queues requests so AniList doesn't block or rate-limit concurrent fetches.
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetEl = entry.target;
                    obs.unobserve(targetEl); // Unobserve immediately to prevent duplicate triggers

                    const genre = targetEl.getAttribute('data-genre');
                    const is18 = targetEl.getAttribute('data-is18') === 'true';
                    const trackId = targetEl.querySelector('.genre-slider-track').id;
                    
                    // Safely queue execution with a small tick delay to prevent main-thread stuttering
                    setTimeout(() => {
                        loadGenreDataSafely(genre, trackId, is18, targetEl);
                    }, 50);
                }
            });
        }, { rootMargin: '600px' }); // Pre-load when 600px away from the viewport

        document.querySelectorAll('.genre-row-container').forEach(el => observer.observe(el));

    } catch (e) {
        console.warn("Genre Sliders Initialization recovered:", e);
    }
};

// 6. BULLETPROOF SAFE LOADER
async function loadGenreDataSafely(genre, trackId, is18, rowElement) {
    const track = document.getElementById(trackId);
    if (!track) return;

    try {
        const aniQuery = `
            query ($genre: String) { 
                Page(page: 1, perPage: 12) { 
                    media(type: ANIME, genre_in: [$genre], sort: TRENDING_DESC) { 
                        id
                        title { english romaji } 
                        coverImage { extraLarge } 
                        format
                    } 
                } 
            }
        `;
        
        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aniQuery, variables: { genre } })
        });
        
        if (!aniRes.ok) throw new Error("AniList network request failed");
        
        const aniData = await aniRes.json();
        const animeList = aniData?.data?.Page?.media || [];

        if (animeList.length === 0) {
            rowElement.style.display = 'none';
            return;
        }

        // Cross-reference with custom API with a built-in safety net fallback
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const crossReferenced = await Promise.all(animeList.map(async (ani) => {
            const title = ani.title.english || ani.title.romaji;
            if (!title) return null;

            try {
                const searchRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(title)}`);
                if (!searchRes.ok) throw new Error();
                const searchJson = await searchRes.json();
                const results = searchJson.data || searchJson.results || [];
                
                if (results.length > 0) {
                    const match = results[0]; 
                    return {
                        id: match.id,
                        title: title, 
                        image: ani.coverImage.extraLarge || match.image || match.poster, 
                        type: match.type || ani.format || 'TV',
                        sub: match.tvInfo?.sub || match.sub || '?',
                        dub: match.tvInfo?.dub || match.dub || 0
                    };
                }
            } catch(e) {}
            
            // Fallback: If custom API lookup fails, use raw AniList ID and cover so it never breaks
            return {
                id: ani.id,
                title: title,
                image: ani.coverImage.extraLarge,
                type: ani.format || 'TV',
                sub: '?',
                dub: 0
            };
        }));

        const finalItems = crossReferenced.filter(item => item !== null);

        if (finalItems.length === 0) {
            rowElement.style.display = 'none'; 
            return;
        }

        // Render Cards
        track.innerHTML = finalItems.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${is18 ? 'text-red-500' : 'text-[#F47521]'} drop-shadow-md" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            const hoverBorder = is18 ? 'group-hover:border-red-500/70' : 'group-hover:border-[#F47521]/70';
            const badgeColor = is18 ? 'bg-red-600/90' : 'bg-[#F47521]/90';

            return `
            <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 ${hoverBorder} transition-colors bg-[#111]">
                    <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                    
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-2 rounded bg-black/70 backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        <span class="bg-black/80 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${anime.type}</span>
                        <span class="${badgeColor} backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold">CC ${anime.sub}</span>
                        ${anime.dub > 0 ? `<span class="bg-purple-600/90 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md font-bold"><i class="fas fa-microphone text-[10px]"></i> ${anime.dub}</span>` : ''}
                    </div>
                </div>
                
                <h3 class="mt-2 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-white transition-colors drop-shadow-md">${anime.title}</h3>
            </div>
            `;
        }).join('');

    } catch (err) {
        // Silently hide row on failure so the rest of the application remains pristine
        if (rowElement) rowElement.style.display = 'none';
    }
}
