// info.js

window.app.components.info = async () => {
    const container = document.getElementById('info-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id');

    if (!animeId) {
        container.innerHTML = `<div class="mt-32 text-center text-gray-400 font-bold uppercase"><i class="fas fa-search text-4xl mb-4 text-[#F47521]"></i><br>No Anime Selected<br><button onclick="window.location.href='index.html'" class="mt-6 text-xs text-white bg-white/10 px-6 py-2 rounded hover:bg-[#F47521]">Go Home</button></div>`;
        return;
    }

    container.innerHTML = `<div class="w-full h-screen flex items-center justify-center -mt-10"><div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div></div>`;

    try {
        // 1. Fetch from your Anikoto Proxy
        const baseUrl = (window.app && window.app.config && window.app.config.anikotoBase) ? window.app.config.anikotoBase : 'https://snowy-bonus-9c22.prashant-yash69.workers.dev';
        const rawResponse = await fetch(`${baseUrl}/series/${animeId}`);
        const response = await rawResponse.json();
        
        const payload = response.data || response; 
        const baseAnime = payload.anime || payload; 
        const episodesList = payload.episodes || baseAnime.episodes || []; 

        if (!baseAnime || (!baseAnime.title && !baseAnime.name)) throw new Error("Invalid anime data received.");

        // 2. Fetch Exhaustive Data from AniList
        let aniData = {};
        const cleanTitle = (baseAnime.title || baseAnime.name || '').replace(/\(Dub\)|\(Sub\)/gi, '').trim();

        try {
            const query = `query ($search: String) { 
                Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                    bannerImage 
                    coverImage { extraLarge } 
                    trailer { id site } 
                    description 
                    synonyms 
                    format 
                    source 
                    status 
                    averageScore 
                    genres 
                    studios(isMain: true) { nodes { name } } 
                    staff(perPage: 4, sort: RELEVANCE) { nodes { name { full } primaryOccupations } }
                } 
            }`;
            const aniRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables: { search: cleanTitle } })
            });
            const aniJson = await aniRes.json();
            if (aniJson?.data?.Media) aniData = aniJson.data.Media;
        } catch (e) { console.log("AniList sync failed."); }

        // 3. Save to Global State for Tab Switching
        window.app.state.currentAnime = {
            id: animeId,
            title: baseAnime.title || baseAnime.name,
            originalDesc: baseAnime.description || baseAnime.synopsis || aniData.description || 'No description available.',
            poster: aniData.coverImage?.extraLarge || baseAnime.poster || baseAnime.image || 'https://via.placeholder.com/800x1200/111/fff?text=No+Poster',
            banner: aniData.bannerImage || baseAnime.background_image || baseAnime.cover || 'https://via.placeholder.com/1280x720/111/fff?text=No+Background',
            trailerId: aniData.trailer?.site === "youtube" ? aniData.trailer.id : null,
            episodes: episodesList,
            aniList: aniData
        };

        // Initialize Tab State
        window.app.state.infoTab = 'episodes'; // 'episodes' or 'info'
        window.app.state.epSearch = '';
        window.app.state.epRange = '1-100';

        // 4. Smart Play Button Logic
        const profile = window.app.state && window.app.state.activeProfile ? window.app.state.activeProfile : null;
        let playBtnText = "Play E01";
        let targetEpisodeId = episodesList.length > 0 ? episodesList[0].id : '';
        
        if (profile && profile.history) {
            const historyItem = profile.history.find(h => h.animeId === animeId);
            if (historyItem) {
                playBtnText = `Resume E${historyItem.episodeNumber || '?'}`;
                targetEpisodeId = historyItem.episodeId || targetEpisodeId;
            }
        }

        window.app.state.currentAnime.playAction = targetEpisodeId;
        window.app.state.currentAnime.playText = playBtnText;

        // 5. Render Main Shell
        renderInfoShell();

    } catch (error) {
        console.error("Info Page Error:", error);
        container.innerHTML = `<div class="w-full h-screen flex flex-col items-center justify-center -mt-10"><i class="fas fa-exclamation-triangle text-5xl text-[#F47521] mb-4"></i><h2 class="text-2xl font-black text-white mb-2">Oops! Something went wrong.</h2><p class="text-gray-400 text-sm mb-6">${error.message}</p><button onclick="window.location.reload()" class="bg-white/10 px-6 py-2 rounded font-bold text-sm">Try Again</button></div>`;
    }
};

// --- RENDER ENGINE ---

function renderInfoShell() {
    const container = document.getElementById('info-container');
    const data = window.app.state.currentAnime;

    // Clean up HTML tags from AniList description
    const cleanDesc = data.originalDesc.replace(/<[^>]*>?/gm, '');

    container.innerHTML = `
        <div class="relative w-full h-[60vh] md:h-[75vh] bg-black overflow-hidden mt-[60px] md:mt-0">
            <div id="info-hero-bg" class="absolute inset-0 z-0 transition-opacity duration-1000">
                <img src="${data.banner}" class="w-full h-full object-cover opacity-50">
            </div>
            
            <div id="info-trailer-container" class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-0 transition-opacity duration-1000 bg-black"></div>
            
            <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent z-10"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent hidden md:block w-[75%] z-10"></div>

            <div class="absolute inset-0 z-20 flex flex-col md:flex-row items-end md:items-center px-4 pb-8 md:px-12 gap-6 md:gap-10">
                
                <div class="w-[30%] md:w-1/4 max-w-[220px] md:max-w-[280px] flex-shrink-0 rounded-lg overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/10 hidden md:block z-30">
                    <img src="${data.poster}" class="w-full h-full object-cover">
                </div>

                <div class="flex-1 w-full max-w-4xl z-30">
                    <h1 class="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] leading-tight tracking-tight">${data.title}</h1>
                    
                    <div class="flex flex-wrap gap-3 mb-6">
                        <button onclick="if('${data.playAction}' !== '') { window.location.href='play.html?id=${data.playAction}&anime=${data.id}' } else { alert('No episodes!') }" class="bg-[#F47521] text-black px-8 py-3.5 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-black text-xs md:text-sm uppercase tracking-wider hover:bg-white transition-all flex items-center gap-2">
                            <i class="fas fa-play"></i> ${data.playText}
                        </button>
                        
                        <button onclick="window.app.addToLibrary('${data.id}', '${data.title.replace(/'/g, "\\'")}', '${data.poster}')" class="bg-white/10 backdrop-blur-md text-white px-6 py-3.5 rounded font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                            <i class="fas fa-plus"></i> Library
                        </button>
                    </div>

                    <div class="relative max-w-3xl">
                        <p id="info-desc" class="text-xs md:text-sm text-gray-300 line-clamp-2 md:line-clamp-3 leading-relaxed drop-shadow-md pr-4">${cleanDesc}</p>
                        ${cleanDesc.length > 130 ? `<button onclick="window.app.toggleDesc()" id="read-more-btn" class="text-[#F47521] text-[10px] md:text-xs font-bold uppercase tracking-wider mt-2 hover:text-white transition-colors">See More <i class="fas fa-chevron-down ml-1"></i></button>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <div class="w-full bg-[#050505] min-h-[50vh]">
            <div class="flex items-center gap-8 px-4 md:px-12 border-b border-white/10 text-xs md:text-sm font-bold uppercase tracking-widest pt-4">
                <button onclick="window.app.switchTab('episodes')" id="tab-episodes" class="pb-3 transition-colors ${window.app.state.infoTab === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Episodes</button>
                <button onclick="window.app.switchTab('info')" id="tab-info" class="pb-3 transition-colors ${window.app.state.infoTab === 'info' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Information</button>
            </div>
            
            <div id="tab-content-area" class="px-4 md:px-12 py-8 max-w-7xl mx-auto"></div>
        </div>
    `;

    // Render the default selected tab content
    renderTabContent();

    // Trigger Trailer Timer (mute=0 to allow audio, hidden UI)
    if (data.trailerId) {
        setTimeout(() => {
            const trailerContainer = document.getElementById('info-trailer-container');
            const heroBg = document.getElementById('info-hero-bg');
            if (trailerContainer && heroBg) {
                // controls=0 (No UI), mute=0 (Audio On), pointer-events-none (Can't click video)
                trailerContainer.innerHTML = `
                    <iframe class="absolute top-1/2 left-1/2 w-[150vw] h-[150vh] md:w-[150%] md:h-[150%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
                            src="https://www.youtube.com/embed/${data.trailerId}?autoplay=1&mute=0&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&playlist=${data.trailerId}&loop=1" 
                            frameborder="0" allow="autoplay; encrypted-media"></iframe>
                `;
                setTimeout(() => {
                    trailerContainer.classList.remove('opacity-0');
                    heroBg.classList.add('opacity-0');
                }, 1500); 
            }
        }, 3000);
    }
}

// --- TAB SWITCHING & RENDERING ---

window.app.switchTab = (tabName) => {
    window.app.state.infoTab = tabName;
    
    // Update Menu Styling
    document.getElementById('tab-episodes').className = `pb-3 transition-colors ${tabName === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    document.getElementById('tab-info').className = `pb-3 transition-colors ${tabName === 'info' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    
    renderTabContent();
};

function renderTabContent() {
    const area = document.getElementById('tab-content-area');
    const data = window.app.state.currentAnime;

    if (window.app.state.infoTab === 'info') {
        // --- INFORMATION TAB UI ---
        const ani = data.aniList;
        if (!ani || Object.keys(ani).length === 0) {
            area.innerHTML = `<div class="text-gray-500 py-10 text-center">Extended AniList details not available for this series.</div>`;
            return;
        }

        const genres = ani.genres ? ani.genres.map(g => `<span class="bg-white/10 px-3 py-1 rounded-full text-xs text-white">${g}</span>`).join('') : 'N/A';
        const studios = ani.studios?.nodes?.map(s => s.name).join(', ') || 'Unknown';
        const staff = ani.staff?.nodes?.map(s => `<div class="bg-[#111] p-3 rounded border border-white/5"><div class="font-bold text-white text-sm">${s.name.full}</div><div class="text-xs text-gray-500">${s.primaryOccupations.join(', ')}</div></div>`).join('') || 'Unknown';

        area.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 flex flex-col gap-6 bg-[#0a0a0a] p-6 rounded-xl border border-white/5">
                    <div><span class="text-gray-500 text-xs font-bold uppercase block mb-1">Score</span><span class="text-[#F47521] font-black text-xl"><i class="fas fa-star text-sm"></i> ${ani.averageScore || '?'}%</span></div>
                    <div><span class="text-gray-500 text-xs font-bold uppercase block mb-1">Status</span><span class="text-white capitalize">${ani.status ? ani.status.toLowerCase().replace('_', ' ') : 'Unknown'}</span></div>
                    <div><span class="text-gray-500 text-xs font-bold uppercase block mb-1">Format</span><span class="text-white">${ani.format || 'TV'}</span></div>
                    <div><span class="text-gray-500 text-xs font-bold uppercase block mb-1">Source</span><span class="text-white capitalize">${ani.source ? ani.source.toLowerCase().replace('_', ' ') : 'Manga'}</span></div>
                    <div><span class="text-gray-500 text-xs font-bold uppercase block mb-1">Studio</span><span class="text-white">${studios}</span></div>
                    
                    ${ani.synonyms && ani.synonyms.length > 0 ? `
                        <div><span class="text-gray-500 text-xs font-bold uppercase block mb-1">Alternative Titles</span>
                        <div class="text-gray-300 text-xs leading-relaxed">${ani.synonyms.join(', ')}</div></div>
                    ` : ''}
                </div>

                <div class="md:col-span-2 flex flex-col gap-8">
                    <div>
                        <h3 class="text-white font-bold mb-4 tracking-wide">Genres</h3>
                        <div class="flex flex-wrap gap-2">${genres}</div>
                    </div>
                    
                    <div>
                        <h3 class="text-white font-bold mb-4 tracking-wide">Primary Staff</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${staff}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // --- EPISODES TAB UI ---
        // Calculate ranges for the dropdown (Groups of 100)
        const totalEps = data.episodes.length;
        let rangeOptions = '';
        
        if (totalEps > 0) {
            for (let i = 0; i < totalEps; i += 100) {
                const start = i + 1;
                const end = Math.min(i + 100, totalEps);
                const value = `${start}-${end}`;
                const isSelected = window.app.state.epRange === value ? 'selected' : '';
                rangeOptions += `<option value="${value}" ${isSelected}>Episodes ${start} - ${end}</option>`;
            }
            // Fallback if state range isn't in dropdown (e.g., initial load)
            if (!window.app.state.epRange && totalEps > 0) window.app.state.epRange = `1-${Math.min(100, totalEps)}`;
        } else {
            rangeOptions = `<option>No Episodes</option>`;
        }

        area.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0a0a0a] p-4 rounded-xl border border-white/5">
                
                <div class="relative w-full sm:w-64">
                    <select id="ep-range-select" onchange="window.app.updateEpRange(this.value)" class="appearance-none w-full bg-[#111] border border-white/10 text-white text-sm font-bold py-3 pl-4 pr-10 rounded cursor-pointer outline-none hover:border-white/30 transition-colors focus:border-[#F47521]">
                        ${rangeOptions}
                    </select>
                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>

                <div class="relative w-full sm:w-auto flex-1 max-w-sm">
                    <input type="number" id="ep-search-input" value="${window.app.state.epSearch}" onkeyup="window.app.searchEpisode(this.value)" placeholder="Search episode number..." class="w-full bg-[#111] border border-white/10 text-white text-sm py-3 pl-10 pr-4 rounded outline-none focus:border-[#F47521] transition-colors placeholder-gray-600">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                </div>
            </div>

            <div id="episodes-grid" class="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 md:gap-3">
                </div>
        `;
        
        renderEpisodeGrid();
    }
}

// --- EPISODE FILTERING & GRID RENDERING ---

window.app.updateEpRange = (range) => {
    window.app.state.epRange = range;
    document.getElementById('ep-search-input').value = ''; // Clear search when changing range
    window.app.state.epSearch = '';
    renderEpisodeGrid();
};

window.app.searchEpisode = (val) => {
    window.app.state.epSearch = val;
    renderEpisodeGrid();
};

function renderEpisodeGrid() {
    const grid = document.getElementById('episodes-grid');
    if (!grid) return;

    const data = window.app.state.currentAnime;
    const search = window.app.state.epSearch;
    const range = window.app.state.epRange.split('-');
    
    let filteredEps = data.episodes;

    if (search !== '') {
        // If searching, ignore range and search exact number
        filteredEps = data.episodes.filter((ep, idx) => {
            const num = ep.number || (idx + 1);
            return num.toString().includes(search);
        });
    } else if (range.length === 2) {
        // Apply Range (e.g., 1-100)
        const start = parseInt(range[0]);
        const end = parseInt(range[1]);
        filteredEps = data.episodes.filter((ep, idx) => {
            const num = ep.number || (idx + 1);
            return num >= start && num <= end;
        });
    }

    if (filteredEps.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">No episodes found.</div>`;
        return;
    }

    let html = '';
    filteredEps.forEach((ep) => {
        // Calculate original episode number to maintain consistency
        const originalIndex = data.episodes.findIndex(e => e.id === ep.id);
        const epNum = ep.number || (originalIndex + 1);
        
        // MOCK FILLER CHECK: Since standard APIs don't flag fillers, we simulate it here.
        // If an API ever returns `ep.is_filler`, use that instead.
        const titleL = (ep.title || '').toLowerCase();
        const isFiller = titleL.includes('filler') || titleL.includes('recap'); 
        
        const fillerBadge = isFiller ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Filler"></div>` : '';
        const bgClass = isFiller ? 'bg-red-500/10 border-red-500/20 text-gray-300 hover:bg-red-500 hover:text-white hover:border-red-500' : 'bg-white/5 border-white/5 text-gray-300 hover:bg-[#F47521] hover:text-white hover:border-[#F47521]';

        html += `
            <button onclick="window.location.href='play.html?id=${ep.id}&anime=${data.id}'" class="relative w-full aspect-square flex items-center justify-center rounded border transition-all duration-200 group ${bgClass}">
                <span class="font-bold text-sm md:text-base">${epNum}</span>
                ${fillerBadge}
            </button>
        `;
    });

    grid.innerHTML = html;
}

// --- UTILITIES ---

window.app.toggleDesc = () => {
    const desc = document.getElementById('info-desc');
    const btn = document.getElementById('read-more-btn');
    if (desc.classList.contains('line-clamp-3') || desc.classList.contains('line-clamp-2')) {
        desc.className = "text-xs md:text-sm text-gray-300 leading-relaxed drop-shadow-md pr-4";
        btn.innerHTML = `Show Less <i class="fas fa-chevron-up ml-1"></i>`;
    } else {
        desc.className = "text-xs md:text-sm text-gray-300 line-clamp-2 md:line-clamp-3 leading-relaxed drop-shadow-md pr-4";
        btn.innerHTML = `See More <i class="fas fa-chevron-down ml-1"></i>`;
    }
};

window.app.addToLibrary = async (id, title, img) => {
    const profile = window.app.state && window.app.state.activeProfile ? window.app.state.activeProfile : null;
    if (!profile || !profile.uid) {
        if (window.app.components && window.app.components.auth) window.app.components.auth();
        else alert("Please log in to save to your Library!");
        return;
    }
    const formattedAnime = { id, title, img };
    if (profile.watchlist && profile.watchlist.some(item => item.id == formattedAnime.id)) return alert("Already in Library!");
    
    if(!profile.watchlist) profile.watchlist = [];
    profile.watchlist.unshift(formattedAnime);
    
    const btn = event.currentTarget;
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check text-green-400"></i> Added`;
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { watchlist: firestore.arrayUnion(formattedAnime) });
    } catch (error) { console.error("Firebase update failed:", error); }
};
