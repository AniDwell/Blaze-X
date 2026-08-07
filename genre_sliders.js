// genre_sliders.js - Sequential Lazy-Loaded Vertical Stack of Genre Sliders

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

    // 1. SETUP THE BASE STRUCTURE WITH THE LOADER
    container.innerHTML = `
        <div id="genre-tracks-wrapper" class="flex flex-col w-full"></div>
        
        <!-- Loading Animation (Matches Carousel) -->
        <div id="genre-loader" class="w-full flex flex-col items-center justify-center py-12 transition-opacity duration-300">
            <div class="tk-loader scale-75 mb-4">
                <div class="tk-dot tk-dot-1"></div>
                <div class="tk-dot tk-dot-2"></div>
            </div>
            <span class="text-[#F47521] text-[10px] font-black tracking-widest uppercase animate-pulse">Loading Genres...</span>
        </div>
    `;

    const wrapper = document.getElementById('genre-tracks-wrapper');
    const loader = document.getElementById('genre-loader');

    try {
        // 2. FETCH ALL GENRES FROM ANILIST
        const query = `query { GenreCollection }`;
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await res.json();
        let genres = json.data?.GenreCollection || [];

        // 3. EXCLUDE SPECIFIC GENRES
        const excludedGenres = ['Action']; 
        window.app.state.genreQueue = genres.filter(g => !excludedGenres.includes(g));
        window.app.state.isFetchingGenre = false;

        if (window.app.state.genreQueue.length === 0) {
            loader.style.display = 'none';
            return;
        }

        // 4. SETUP INTERSECTION OBSERVER FOR SEQUENTIAL LOADING
        const observer = new IntersectionObserver(async (entries) => {
            const entry = entries[0];
            // If the loader comes into view and we aren't already fetching one...
            if (entry.isIntersecting && !window.app.state.isFetchingGenre) {
                await processNextGenre(wrapper, loader, observer);
            }
        }, { rootMargin: '300px' }); // Trigger load when 300px away from the bottom

        observer.observe(loader);

    } catch (e) {
        console.error("Genre Sliders Initialization Error:", e);
        container.innerHTML = '';
    }
};

// --- CORE SEQUENTIAL LOADING LOGIC ---
async function processNextGenre(wrapper, loader, observer) {
    if (window.app.state.genreQueue.length === 0) {
        loader.style.display = 'none';
        observer.disconnect();
        return;
    }

    // Lock to prevent multiple parallel fetches
    window.app.state.isFetchingGenre = true;
    
    // Pop the next genre off the queue
    const genre = window.app.state.genreQueue.shift();
    const is18 = genre.toLowerCase() === 'hentai' || genre.toLowerCase() === 'explicit';

    try {
        // Fetch top trending for this specific genre
        const aniQuery = `
            query { 
                Page(page: 1, perPage: 15) { 
                    media(type: ANIME, genre_in: ["${genre}"], sort: TRENDING_DESC) { 
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
            body: JSON.stringify({ query: aniQuery })
        });
        const aniData = await aniRes.json();
        const animeList = aniData?.data?.Page?.media || [];

        if (animeList.length > 0) {
            // Cross-reference with custom API
            const baseUrl = 'https://anikoto-api-xi.vercel.app';
            const crossReferenced = await Promise.all(animeList.map(async (ani) => {
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
                            type: match.type || ani.format || 'TV',
                            sub: match.tvInfo?.sub || match.sub || '?',
                            dub: match.tvInfo?.dub || match.dub || 0
                        };
                    }
                } catch(e) {}
                return null; 
            }));

            const finalItems = crossReferenced.filter(item => item !== null);

            // If we have items after filtering, render the HTML block
            if (finalItems.length > 0) {
                const html = buildGenreRowHtml(genre, finalItems, is18);
                wrapper.insertAdjacentHTML('beforeend', html);
                
                // Attach scroll listeners to the newly injected buttons
                attachGenreScrollListeners(genre.replace(/[^a-zA-Z0-9]/g, '-'));
            }
        }
    } catch (e) {
        console.error(`Error loading genre ${genre}:`, e);
    }

    // Unlock
    window.app.state.isFetchingGenre = false;

    // VERY IMPORTANT: If the previous genre had 0 results, the loader is STILL on screen.
    // Or if the screen is super tall. We must trigger the next one immediately.
    const loaderRect = loader.getBoundingClientRect();
    const isInView = (loaderRect.top <= window.innerHeight + 300 && loaderRect.bottom >= 0);
    
    if (isInView && window.app.state.genreQueue.length > 0) {
        await processNextGenre(wrapper, loader, observer);
    } else if (window.app.state.genreQueue.length === 0) {
        loader.style.display = 'none';
        observer.disconnect();
    }
}

// --- HTML BUILDER ---
function buildGenreRowHtml(genre, items, is18) {
    const slug = genre.replace(/[^a-zA-Z0-9]/g, '-');
    const trackId = `track-${slug}`;
    const leftBtnId = `btn-left-${slug}`;
    const rightBtnId = `btn-right-${slug}`;

    // Styling logic for 18+ vs Standard
    const bgClass = is18 ? 'bg-red-950/20 border-y border-red-900/50 py-8 my-4' : 'py-6';
    const titleColor = is18 ? 'text-red-500 border-red-600 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-white border-[#F47521]';
    const titleText = is18 ? `${genre} (18+ Adult)` : genre;
    const btnColor = is18 ? 'hover:bg-red-600' : 'hover:bg-[#F47521]';
    const hoverBorder = is18 ? 'group-hover:border-red-500/70' : 'group-hover:border-[#F47521]/70';
    const badgeColor = is18 ? 'bg-red-600/90' : 'bg-[#F47521]/90';
    const savedSvgColor = is18 ? 'text-red-500' : 'text-[#F47521]';

    const cardsHtml = items.map(anime => {
        const safeTitle = anime.title.replace(/'/g, "\\'");
        const docIdStr = String(anime.id);
        const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
        
        const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${savedSvgColor} drop-shadow-[0_0_5px_currentColor]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
        const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

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

    return `
        <div class="genre-row-container relative w-full ${bgClass} animate-fade-in group/slider">
            <div class="px-4 md:px-8 mb-4 flex items-center justify-between">
                <h2 class="text-xl md:text-2xl font-black ${titleColor} border-l-4 pl-3 uppercase tracking-wider drop-shadow-md">
                    ${titleText}
                </h2>
            </div>
            
            <div class="relative w-full">
                <button id="${leftBtnId}" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 ${btnColor} border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0" onclick="window.app.scrollGenreTrack('${trackId}', -1)">
                    <i class="fas fa-chevron-left text-lg"></i>
                </button>
                
                <div id="${trackId}" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-8">
                    ${cardsHtml}
                </div>
                
                <button id="${rightBtnId}" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 ${btnColor} border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0" onclick="window.app.scrollGenreTrack('${trackId}', 1)">
                    <i class="fas fa-chevron-right text-lg"></i>
                </button>
            </div>
        </div>
    `;
}

// Ensure the scroll buttons hide/show automatically at boundaries
function attachGenreScrollListeners(slug) {
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
}
