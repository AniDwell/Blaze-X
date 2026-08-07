// genre_sliders.js - Sequential Queue Infinite Scroll (No Glow, Clean UI)

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

    // 1. SETUP THE INFINITE SCROLL CONTAINER & SINGLE LOADER
    container.innerHTML = `
        <div id="genre-tracks-wrapper" class="flex flex-col w-full"></div>
        
        <!-- The Single Master Loading Animation -->
        <div id="master-genre-loader" class="w-full flex flex-col items-center justify-center py-12 transition-opacity duration-300">
            <div class="tk-loader scale-75 mb-4">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
            <span class="text-[#F47521] text-[10px] font-black tracking-widest uppercase animate-pulse">Loading Next Genre...</span>
        </div>
    `;

    try {
        // 2. FETCH ALL GENRES FROM ANILIST ONCE
        const query = `query { GenreCollection }`;
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await res.json();
        let allGenres = json.data?.GenreCollection || [];

        // 3. EXCLUDE SPECIFIC GENRES AND INITIALIZE QUEUE
        const excludedGenres = ['Action']; 
        window.app.state.genreQueue = allGenres.filter(g => !excludedGenres.includes(g));
        window.app.state.isFetchingGenre = false;

        const loader = document.getElementById('master-genre-loader');

        if (window.app.state.genreQueue.length === 0) {
            loader.style.display = 'none';
            return;
        }

        // 4. SETUP THE INTERSECTION OBSERVER
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting) {
                window.app.processNextGenreInQueue();
            }
        }, { rootMargin: '400px' }); 

        observer.observe(loader);

    } catch (e) {
        console.error("Genre Initialization Error:", e);
        container.innerHTML = '';
    }
};

// --- CORE SEQUENTIAL LOADING LOGIC ---
window.app.processNextGenreInQueue = async () => {
    if (window.app.state.isFetchingGenre) return;
    window.app.state.isFetchingGenre = true;

    const wrapper = document.getElementById('genre-tracks-wrapper');
    const loader = document.getElementById('master-genre-loader');

    while (window.app.state.genreQueue.length > 0) {
        const genre = window.app.state.genreQueue.shift(); 
        const is18 = genre.toLowerCase() === 'hentai' || genre.toLowerCase() === 'explicit';

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
            const aniData = await aniRes.json();
            const animeList = aniData?.data?.Page?.media || [];

            if (animeList.length > 0) {
                const baseUrl = 'https://anikoto-api-xi.vercel.app';
                const crossReferenced = await Promise.all(animeList.map(async (ani) => {
                    const title = ani.title.english || ani.title.romaji;
                    if (!title) return null;

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
                                type: match.type || ani.format || 'TV',
                                sub: match.tvInfo?.sub || match.sub || '?',
                                dub: match.tvInfo?.dub || match.dub || 0
                            };
                        }
                    } catch(e) {}
                    
                    return {
                        id: ani.id, title: title, image: ani.coverImage.extraLarge, type: ani.format || 'TV', sub: '?', dub: 0
                    };
                }));

                const finalItems = crossReferenced.filter(item => item !== null);

                if (finalItems.length > 0) {
                    const rowHtml = window.app.buildGenreRowHtml(genre, finalItems, is18);
                    wrapper.insertAdjacentHTML('beforeend', rowHtml);
                    
                    const safeSlug = genre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                    window.app.attachGenreScrollListeners(safeSlug);
                    
                    window.app.state.isFetchingGenre = false;

                    const loaderRect = loader.getBoundingClientRect();
                    if (loaderRect.top <= window.innerHeight + 100) {
                        setTimeout(window.app.processNextGenreInQueue, 100);
                    }
                    return; 
                }
            }
        } catch (e) {
            console.error(`Skipping genre ${genre} due to error:`, e);
        }
    }

    window.app.state.isFetchingGenre = false;
    if (loader) loader.style.display = 'none';
};

// --- HTML BUILDER FOR EACH ROW ---
window.app.buildGenreRowHtml = (genre, items, is18) => {
    const slug = genre.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const trackId = `track-${slug}`;
    const leftBtnId = `btn-left-${slug}`;
    const rightBtnId = `btn-right-${slug}`;

    // Styling logic for 18+ vs Standard (No glows, flat UI)
    const titleHtml = is18 
        ? `<h2 class="text-xs md:text-sm font-black text-white bg-red-600 px-3 py-1.5 rounded tracking-widest uppercase inline-block">${genre} (18+)</h2>`
        : `<h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider">${genre}</h2>`;
        
    const btnColor = is18 ? 'hover:bg-red-600' : 'hover:bg-[#F47521]';
    const hoverBorder = is18 ? 'group-hover:border-red-500' : 'group-hover:border-[#F47521]';
    const badgeColor = is18 ? 'bg-red-600' : 'bg-[#F47521]';
    const savedSvgColor = is18 ? 'text-red-500' : 'text-[#F47521]';

    const cardsHtml = items.map(anime => {
        const safeTitle = anime.title.replace(/'/g, "\\'");
        const docIdStr = String(anime.id);
        const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
        
        const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${savedSvgColor}" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
        const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

        return `
        <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
             onclick="window.app.sliderNavigate('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')">
            
            <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/10 ${hoverBorder} transition-colors bg-[#111]">
                <img src="${anime.image}" loading="lazy" class="w-full h-full object-cover">
                
                <!-- Save Button (Flat, no glow) -->
                <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.image}')" 
                        data-added="${isAdded}"
                        class="absolute top-2 right-2 z-30 p-1.5 rounded bg-black/70 backdrop-blur-md border border-white/10 hover:bg-black transition-all flex items-center justify-center">
                    ${isAdded ? savedSvg : unsavedSvg}
                </button>
                
                <!-- Badges (Flat, no glow) -->
                <div class="absolute top-0 left-0 p-2 flex flex-col gap-1 items-start z-10 pointer-events-none">
                    <span class="bg-black/80 backdrop-blur-sm text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-bold uppercase">${anime.type}</span>
                    <span class="${badgeColor} text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded font-bold">CC ${anime.sub}</span>
                    ${anime.dub > 0 ? `<span class="bg-purple-600 text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded font-bold"><i class="fas fa-microphone text-[8px]"></i> ${anime.dub}</span>` : ''}
                </div>
            </div>
            
            <h3 class="mt-2 text-xs md:text-sm text-gray-100 font-bold truncate group-hover:text-white transition-colors">${anime.title}</h3>
        </div>
        `;
    }).join('');

    return `
        <div class="genre-row-container relative w-full py-6 animate-fade-in group/slider">
            <div class="px-4 md:px-8 mb-4 flex items-center justify-between">
                ${titleHtml}
            </div>
            
            <div class="relative w-full">
                <button id="${leftBtnId}" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 ${btnColor} border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all disabled:opacity-0" onclick="window.app.scrollGenreTrack('${trackId}', -1)">
                    <i class="fas fa-chevron-left text-lg"></i>
                </button>
                
                <div id="${trackId}" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-8">
                    ${cardsHtml}
                </div>
                
                <button id="${rightBtnId}" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 ${btnColor} border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all disabled:opacity-0" onclick="window.app.scrollGenreTrack('${trackId}', 1)">
                    <i class="fas fa-chevron-right text-lg"></i>
                </button>
            </div>
        </div>
    `;
};

// Ensure the scroll buttons hide/show automatically at boundaries
window.app.attachGenreScrollListeners = (slug) => {
    const track = document.getElementById(`track-${slug}`);
    const leftBtn = document.getElementById(`btn-left-${slug}`);
    const rightBtn = document.getElementById(`btn-right-${slug}`);
    
    if (track && leftBtn && rightBtn) {
        track.addEventListener('scroll', () => {
            leftBtn.disabled = track.scrollLeft <= 0;
            rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
        });
        leftBtn.disabled = true; 
    }
};
