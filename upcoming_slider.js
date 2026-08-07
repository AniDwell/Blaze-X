// upcoming_slider.js - 100% AniList Upcoming Slider & Full-Screen Detail Modal

window.app = window.app || {};
window.app.components = window.app.components || {};

// --- Helper: Format AniList Date ---
const formatAniListDate = (dateObj) => {
    if (!dateObj || !dateObj.year) return "TBA";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (dateObj.month && dateObj.day) return `${months[dateObj.month - 1]} ${dateObj.day}, ${dateObj.year}`;
    if (dateObj.month) return `${months[dateObj.month - 1]} ${dateObj.year}`;
    return `${dateObj.year}`;
};

// --- MODAL LOGIC (Bottom Sheet to Full Screen) ---
window.app.openUpcomingModal = async (animeId) => {
    // 1. Inject Modal HTML into body if it doesn't exist
    if (!document.getElementById('upcoming-modal-wrapper')) {
        const modalHtml = `
            <div id="upcoming-modal-wrapper" class="fixed inset-0 z-[9999] flex flex-col justify-end pointer-events-none">
                <!-- Dark Backdrop -->
                <div id="upcoming-modal-backdrop" class="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 transition-opacity duration-500 pointer-events-auto" onclick="window.app.closeUpcomingModal()"></div>
                
                <!-- Bottom Sheet / Full Screen Content -->
                <div id="upcoming-modal-content" class="w-full h-[95vh] md:h-[100vh] bg-[#0a0a0a] rounded-t-3xl md:rounded-none transform translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] pointer-events-auto flex flex-col overflow-hidden relative shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                    
                    <!-- Close Button -->
                    <button onclick="window.app.closeUpcomingModal()" class="absolute top-4 right-4 md:top-6 md:right-6 z-[60] w-10 h-10 bg-black/50 hover:bg-[#F47521] backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors border border-white/10 shadow-lg">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                    
                    <!-- Drag Handle (Mobile) -->
                    <div class="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full z-[60] md:hidden"></div>

                    <!-- Scrollable Content Area -->
                    <div id="upcoming-modal-scroll" class="flex-1 overflow-y-auto hide-scrollbar relative pb-20">
                        <div id="upcoming-modal-body" class="min-h-full">
                            <!-- Loading Skeleton inside Modal -->
                            <div class="flex flex-col items-center justify-center h-[50vh] text-[#F47521]">
                                <i class="fas fa-circle-notch fa-spin text-4xl mb-4"></i>
                                <p class="text-sm font-bold tracking-widest uppercase text-white">Fetching Details...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // 2. Animate Modal Open
    const wrapper = document.getElementById('upcoming-modal-wrapper');
    const backdrop = document.getElementById('upcoming-modal-backdrop');
    const content = document.getElementById('upcoming-modal-content');
    const body = document.getElementById('upcoming-modal-body');
    
    wrapper.classList.remove('hidden');
    // Force reflow
    void wrapper.offsetWidth;
    
    backdrop.classList.remove('opacity-0');
    backdrop.classList.add('opacity-100');
    content.classList.remove('translate-y-full');
    content.classList.add('translate-y-0');

    // 3. Fetch Detailed AniList Data
    try {
        const query = `
            query($id: Int) { 
                Media(id: $id) { 
                    title { english romaji native }
                    coverImage { extraLarge }
                    bannerImage
                    format
                    episodes
                    status
                    description(asHtml: false)
                    startDate { year month day }
                    genres
                    studios(isMain: true) { nodes { name } }
                    trailer { id site }
                    recommendations(page: 1, perPage: 8, sort: RATING_DESC) {
                        nodes { mediaRecommendation { id title { english romaji } coverImage { large } format status } }
                    }
                } 
            }
        `;
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: parseInt(animeId) } })
        });
        const json = await res.json();
        const data = json.data.Media;

        const title = data.title.english || data.title.romaji;
        const banner = data.bannerImage || 'https://via.placeholder.com/1200x400/111/111';
        const cover = data.coverImage.extraLarge;
        const releaseDate = formatAniListDate(data.startDate);
        const description = (data.description || "No description available yet.").replace(/<[^>]*>?/gm, '');
        const studio = data.studios?.nodes?.[0]?.name || "Unknown Studio";
        
        // Trailer Iframe
        let trailerHtml = '';
        if (data.trailer && data.trailer.site === 'youtube') {
            trailerHtml = `
                <div class="w-full max-w-4xl mx-auto mt-8 px-4">
                    <h3 class="text-white font-black text-lg mb-3 uppercase tracking-wider border-l-4 border-[#F47521] pl-2">Official Trailer</h3>
                    <div class="relative w-full aspect-video rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5">
                        <iframe class="absolute inset-0 w-full h-full" src="https://www.youtube.com/embed/${data.trailer.id}" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>
            `;
        }

        // Genres
        let genresHtml = (data.genres || []).map(g => `<span class="bg-white/10 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-gray-300 shadow-sm">${g}</span>`).join('');

        // Related Mini Slider
        let recsHtml = '';
        const recs = (data.recommendations?.nodes || []).filter(n => n.mediaRecommendation);
        if (recs.length > 0) {
            recsHtml = `
                <div class="w-full mt-10 px-4 pb-10">
                    <h3 class="text-white font-black text-lg mb-4 uppercase tracking-wider border-l-4 border-[#F47521] pl-2">Similar Anime</h3>
                    <div class="flex gap-3 overflow-x-auto hide-scrollbar snap-x pb-4">
                        ${recs.map(r => {
                            const recAnime = r.mediaRecommendation;
                            const rTitle = recAnime.title.english || recAnime.title.romaji;
                            return `
                                <div class="snap-start shrink-0 w-[110px] md:w-[140px] relative group border border-white/5 rounded-lg overflow-hidden">
                                    <div class="w-full aspect-[2/3]">
                                        <img src="${recAnime.coverImage.large}" class="w-full h-full object-cover">
                                    </div>
                                    <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                    <div class="absolute bottom-0 left-0 w-full p-2">
                                        <h4 class="text-white text-[10px] md:text-xs font-bold truncate drop-shadow-md">${rTitle}</h4>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Render Modal Body
        body.innerHTML = `
            <!-- Top Banner Header -->
            <div class="relative w-full h-48 md:h-72 bg-[#111]">
                <img src="${banner}" class="w-full h-full object-cover opacity-40">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-transparent to-transparent"></div>
            </div>

            <!-- Content Container overlapping the banner -->
            <div class="relative px-4 md:px-10 -mt-20 md:-mt-32 z-10">
                <div class="flex gap-4 md:gap-8 items-end md:items-stretch">
                    <!-- Left Cover Image -->
                    <div class="w-28 md:w-48 shrink-0 relative">
                        <img src="${cover}" class="w-full aspect-[2/3] object-cover rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] border-2 border-white/10">
                        <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#F47521] text-white text-[9px] md:text-xs font-black uppercase px-3 py-1 rounded shadow-lg whitespace-nowrap">
                            ${data.status.replace(/_/g, ' ')}
                        </div>
                    </div>
                    
                    <!-- Right Titles & Info -->
                    <div class="flex-1 pb-2 md:py-6">
                        <h2 class="text-xl md:text-4xl font-black text-white leading-tight drop-shadow-lg mb-1 md:mb-2">${title}</h2>
                        <h3 class="text-xs md:text-sm text-gray-400 font-bold mb-3 line-clamp-1">${data.title.native || ''}</h3>
                        
                        <!-- Sub/Dub & Format Badges -->
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            <span class="bg-white/10 text-white text-[10px] md:text-xs px-2 py-0.5 rounded font-bold uppercase border border-white/5">${data.format || 'TV'}</span>
                            <span class="bg-black/50 text-[#F47521] border border-[#F47521]/30 text-[10px] md:text-xs px-2 py-0.5 rounded font-bold">SUB: TBA</span>
                            <span class="bg-black/50 text-purple-400 border border-purple-400/30 text-[10px] md:text-xs px-2 py-0.5 rounded font-bold">DUB: TBA</span>
                        </div>
                        
                        <p class="text-gray-300 text-xs md:text-sm font-semibold flex items-center gap-2">
                            <i class="far fa-calendar-alt text-[#F47521]"></i> 
                            Airing: <span class="text-white">${releaseDate}</span>
                        </p>
                    </div>
                </div>
            </div>

            <!-- Genres & Studio Section -->
            <div class="px-4 md:px-10 mt-8 max-w-4xl mx-auto">
                <div class="flex flex-wrap gap-2 mb-6">
                    ${genresHtml}
                </div>
                
                <div class="bg-white/5 border border-white/5 rounded-xl p-4 md:p-6 shadow-lg">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-gray-400 text-xs font-bold uppercase tracking-widest">Studio</span>
                        <span class="text-white text-sm md:text-base font-black">${studio}</span>
                    </div>
                    <p class="text-sm md:text-base text-gray-300 leading-relaxed font-medium">
                        ${description}
                    </p>
                </div>
            </div>

            <!-- Trailer Section -->
            ${trailerHtml}

            <!-- Recommendations Mini Slider -->
            ${recsHtml}
        `;

    } catch (e) {
        console.error(e);
        body.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">Failed to load details. Try again.</div>`;
    }
};

window.app.closeUpcomingModal = () => {
    const backdrop = document.getElementById('upcoming-modal-backdrop');
    const content = document.getElementById('upcoming-modal-content');
    
    if (backdrop && content) {
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
        
        content.classList.remove('translate-y-0');
        content.classList.add('translate-y-full');
        
        setTimeout(() => {
            const wrapper = document.getElementById('upcoming-modal-wrapper');
            if (wrapper) wrapper.classList.add('hidden');
        }, 500); // Wait for transition
    }
};


// --- SLIDER RENDERING ---
window.app.components.upcomingSlider = async () => {
    const container = document.getElementById('upcoming-slider-container');
    if (!container) return;

    // 1. SHOW SKELETON (Smaller Sizes matching Action Slider 140/190px)
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Upcoming Releases</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4, 5].map(() => `
                    <div class="min-w-[140px] md:min-w-[190px] aspect-[2/3] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 2. FETCH 100% FROM ANILIST
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

        if (upcomingList.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 3. RENDER CARDS (Orange Theme, No Gradient, No Play Button)
        let cardsHtml = upcomingList.map(anime => {
            const safeTitle = (anime.title.english || anime.title.romaji).replace(/'/g, "\\'");
            const docIdStr = String(anime.id);
            const releaseDate = formatAniListDate(anime.startDate);
            const format = anime.format || 'TV';
            
            // Reusing Library Save logic for consistency
            const isAdded = window.app.state.carouselLibrarySet && window.app.state.carouselLibrarySet.has(docIdStr);
            const savedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#F47521] drop-shadow-[0_0_5px_rgba(244,117,33,0.5)]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
            const unsavedSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>`;

            return `
            <div class="snap-start shrink-0 w-[140px] md:w-[190px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.app.openUpcomingModal('${anime.id}')">
                
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-black">
                    <img src="${anime.coverImage.extraLarge}" loading="lazy" class="w-full h-full object-cover">
                    
                    <!-- Permanent Save Button SVG (No Gradient, No Play Button) -->
                    <button onclick="window.app.toggleSliderLibrary(event, this, '${anime.id}', '${safeTitle}', '${anime.coverImage.extraLarge}')" 
                            data-added="${isAdded}"
                            class="absolute top-2 right-2 z-30 p-2 rounded bg-black/70 backdrop-blur-md border border-white/10 shadow-lg hover:bg-black transition-all flex items-center justify-center">
                        ${isAdded ? savedSvg : unsavedSvg}
                    </button>
                    
                    <!-- Release Date Badge at bottom left -->
                    <div class="absolute bottom-2 left-2 z-20 pointer-events-none">
                        <span class="bg-[#F47521] text-white text-[9px] md:text-[10px] px-1.5 py-1 rounded shadow-md font-black uppercase tracking-wide">
                            ${releaseDate}
                        </span>
                    </div>
                    
                    <!-- Top Left Format Badge -->
                    <div class="absolute top-0 left-0 p-2 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
                        <span class="bg-black/80 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-0.5 rounded border border-white/10 font-bold uppercase shadow-md">${format}</span>
                    </div>
                </div>
                
                <h3 class="mt-2 text-sm md:text-base text-gray-100 font-bold truncate group-hover:text-white transition-colors drop-shadow-md">${safeTitle}</h3>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Upcoming Releases
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="upcoming-slide-left-btn" class="hidden md:flex absolute -left-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="upcoming-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="upcoming-slide-right-btn" class="hidden md:flex absolute -right-5 top-[40%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        const track = document.getElementById('upcoming-slider-track');
        const leftBtn = document.getElementById('upcoming-slide-left-btn');
        const rightBtn = document.getElementById('upcoming-slide-right-btn');
        
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
        console.error("Upcoming Slider Error:", error);
        container.innerHTML = ''; 
    }
};
