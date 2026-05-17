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

    // Dynamic Loader
    container.innerHTML = `<div class="w-full h-screen flex items-center justify-center -mt-10"><div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div></div>`;

    try {
        // 1. Fetch from your Anikoto Proxy
        const baseUrl = (window.app && window.app.config && window.app.config.anikotoBase) ? window.app.config.anikotoBase : 'https://snowy-bonus-9c22.prashant-yash69.workers.dev';
        const rawResponse = await fetch(`${baseUrl}/series/${animeId}`);
        const response = await rawResponse.json();
        
        // --- API DATA PARSER ---
        const payload = response.data || response; 
        const baseAnime = payload.anime || payload; 
        const episodesList = payload.episodes || baseAnime.episodes || []; 

        if (!baseAnime || (!baseAnime.title && !baseAnime.name)) throw new Error("Invalid anime data received.");

        // 2. Fetch Exhaustive Sync Data from AniList
        let aniData = {};
        const cleanTitleForSearch = (baseAnime.title || baseAnime.name || '').replace(/\(Dub\)|\(Sub\)/gi, '').trim();

        try {
            const query = `query ($search: String) { 
                Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                    title { romaji native english }
                    bannerImage 
                    coverImage { extraLarge } 
                    description 
                    synonyms 
                    format 
                    source 
                    status 
                    averageScore 
                    genres 
                    studios(isMain: true) { nodes { name } } 
                    staff(perPage: 9, sort: RELEVANCE) { 
                        nodes { 
                            name { full } 
                            image { large }
                            primaryOccupations 
                        } 
                    }
                } 
            }`;
            const aniRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables: { search: cleanTitleForSearch } })
            });
            const aniJson = await aniRes.json();
            if (aniJson?.data?.Media) aniData = aniJson.data.Media;
        } catch (e) { console.log("AniList sync failed."); }

        // 3. Construct Global Page State (Prioritizing AniList data)
        const finalTitle = aniData.title?.romaji || aniData.title?.english || baseAnime.title || baseAnime.name;
        const finalJpTitle = aniData.title?.native || baseAnime.alternative || 'N/A';
        const finalDesc = aniData.description || baseAnime.description || baseAnime.synopsis || 'No description available.';

        window.app.state.currentAnimePage = {
            id: animeId,
            title: finalTitle,
            jpTitle: finalJpTitle,
            synopsis: finalDesc,
            poster: aniData.coverImage?.extraLarge || baseAnime.poster || baseAnime.image || 'https://via.placeholder.com/800x1200/111/fff?text=No+Poster',
            banner: aniData.bannerImage || baseAnime.background_image || baseAnime.cover || 'https://via.placeholder.com/1280x720/111/fff?text=No+Background',
            episodes: episodesList,
            aniList: aniData
        };

        // DEFAULT TO INFORMATION TAB
        window.app.state.activeInfoTab = 'information'; 
        window.app.state.epSearchValue = '';
        window.app.state.epRangeFilter = '1-100';

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
        window.app.state.currentAnimePage.smartPlayAction = targetEpisodeId;
        window.app.state.currentAnimePage.smartPlayText = playBtnText;

        // 5. Render Shell
        renderAnimeInfoShell();

    } catch (error) {
        console.error("Info Page Fatal Error:", error);
        container.innerHTML = `<div class="w-full h-screen flex flex-col items-center justify-center -mt-10"><i class="fas fa-exclamation-triangle text-5xl text-[#F47521] mb-4"></i><h2 class="text-2xl font-black text-white mb-2">Oops! Something went wrong.</h2><p class="text-gray-400 text-sm mb-6">${error.message}</p><button onclick="window.location.reload()" class="bg-white/10 px-6 py-2 rounded font-bold text-sm tracking-wide">Try Again</button></div>`;
    }
};


// --- UI PAINTER ENGINE ---

function renderAnimeInfoShell() {
    const container = document.getElementById('info-container');
    const data = window.app.state.currentAnimePage;
    const ani = data.aniList;

    const cleanDesc = data.synopsis.replace(/<[^>]*>?/gm, '');
    const genresStr = ani.genres ? ani.genres.join(' • ') : 'Anime Series';

    container.innerHTML = `
        <div class="w-full flex flex-col bg-[#050505] min-h-screen pb-24">
            
            <div class="relative w-full min-h-[40vh] md:min-h-[55vh] flex items-center py-10 border-b border-white/5 overflow-hidden">
                
                <div class="absolute inset-0 z-0">
                    <img src="${data.banner}" class="w-full h-full object-cover opacity-30 blur-sm scale-105">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent"></div>
                </div>

                <div class="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-12 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 mt-4">
                    
                    <div class="w-[45%] max-w-[180px] md:w-1/4 md:max-w-[260px] flex-shrink-0 rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-white/10">
                        <img src="${data.poster}" class="w-full h-full object-cover aspect-[2/3]">
                    </div>

                    <div class="flex-1 flex flex-col items-center md:items-start text-center md:text-left w-full pt-2">
                        
                        <h1 class="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-2 drop-shadow-lg leading-tight tracking-tight">${data.title}</h1>
                        <p class="text-xs md:text-base text-gray-400 font-medium mb-3 drop-shadow-md">${data.jpTitle}</p>
                        <p class="text-[10px] md:text-xs text-[#F47521] font-bold tracking-widest mb-8 uppercase">${genresStr}</p>
                        
                        <div class="flex flex-wrap justify-center md:justify-start gap-3 md:gap-4 mb-8 w-full">
                            <button onclick="if('${data.smartPlayAction}' !== '') { window.location.href='play.html?id=${data.smartPlayAction}&anime=${data.id}' } else { alert('No episodes!') }" class="bg-[#F47521] text-white px-8 py-3.5 rounded-lg shadow-[0_0_20px_rgba(244,117,33,0.4)] font-black text-xs md:text-sm uppercase tracking-wider hover:bg-white hover:text-[#F47521] transition-all flex items-center gap-2">
                                <i class="fas fa-play"></i> ${data.smartPlayText}
                            </button>
                            
                            <button onclick="window.app.addToLibrary('${data.id}', '${data.title.replace(/'/g, "\\'")}', '${data.poster}')" class="bg-white/10 backdrop-blur-md text-white px-6 py-3.5 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>

                        <div class="relative w-full max-w-3xl">
                            <p id="info-desc" class="text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed drop-shadow-md">${cleanDesc}</p>
                            ${cleanDesc.length > 130 ? `<button onclick="window.app.togglePageDesc()" id="read-more-btn" class="text-[#F47521] text-[10px] md:text-xs font-bold uppercase tracking-wider mt-3 hover:text-white transition-colors">See More <i class="fas fa-chevron-down ml-1"></i></button>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="w-full mt-4">
                <div class="flex items-center justify-center w-full max-w-2xl mx-auto border-b border-white/10 text-xs md:text-sm font-bold uppercase tracking-widest pt-4">
                    <button onclick="window.app.switchInfoTab('information')" id="tab-information" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Information</button>
                    <button onclick="window.app.switchInfoTab('episodes')" id="tab-episodes" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Episodes</button>
                </div>
                
                <div id="dynamic-tab-content-area" class="px-4 md:px-12 py-8 max-w-7xl mx-auto"></div>
            </div>
        </div>
    `;

    renderDynamicTabContent();
}

// --- TAB STATE MANAGEMENT & RENDERING ---

window.app.switchInfoTab = (tabName) => {
    if (window.app.state.activeInfoTab === tabName) return;
    window.app.state.activeInfoTab = tabName;
    
    document.getElementById('tab-information').className = `flex-1 text-center pb-3 transition-colors ${tabName === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    document.getElementById('tab-episodes').className = `flex-1 text-center pb-3 transition-colors ${tabName === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    
    renderDynamicTabContent();
};

function renderDynamicTabContent() {
    const contentArea = document.getElementById('dynamic-tab-content-area');
    const data = window.app.state.currentAnimePage;

    if (window.app.state.activeInfoTab === 'information') {
        // --- INFORMATION TAB WITH STAFF IMAGES ---
        const ani = data.aniList;
        if (!ani || Object.keys(ani).length === 0) {
            contentArea.innerHTML = `<div class="text-gray-500 py-10 text-center flex flex-col items-center"><i class="fas fa-satellite-dish text-3xl mb-4"></i> Extended AniList details not available for this series.</div>`;
            return;
        }

        const genresHtml = ani.genres ? ani.genres.map(g => `<span class="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-[10px] md:text-xs text-white font-medium">${g}</span>`).join('') : 'N/A';
        const studios = ani.studios?.nodes?.map(s => s.name).join(', ') || 'Unknown';
        
        // Staff mapping with Images
        const staffHtml = ani.staff?.nodes?.map(s => `
            <div class="bg-[#111] p-3 rounded-lg border border-white/5 shadow-inner flex items-center gap-3 md:gap-4">
                <img src="${s.image?.large || 'https://via.placeholder.com/150/222/fff?text=?'}" class="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border border-white/10 shadow-md">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-xs md:text-sm truncate">${s.name.full}</div>
                    <div class="text-[10px] md:text-xs text-gray-500 truncate mt-0.5">${s.primaryOccupations.join(', ')}</div>
                </div>
            </div>
        `).join('') || '<div class="text-gray-500 text-sm">No staff info available.</div>';

        contentArea.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-1 flex flex-col gap-5 bg-[#0a0a0a] p-6 rounded-xl border border-white/5 shadow-lg h-fit">
                    <div class="flex items-center gap-4 border-b border-white/5 pb-4">
                        <div class="w-12 h-12 rounded-full bg-[#F47521]/10 flex items-center justify-center text-[#F47521] text-xl">
                            <i class="fas fa-star"></i>
                        </div>
                        <div>
                            <span class="text-gray-500 text-[10px] font-bold uppercase block tracking-widest">Average Score</span>
                            <span class="text-white font-black text-xl">${ani.averageScore || '?'}%</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="text-gray-600 text-[10px] font-bold uppercase block mb-1 tracking-wider">Status</span><span class="text-white font-medium capitalize text-xs md:text-sm">${ani.status ? ani.status.toLowerCase().replace('_', ' ') : 'Unknown'}</span></div>
                        <div><span class="text-gray-600 text-[10px] font-bold uppercase block mb-1 tracking-wider">Format</span><span class="text-white font-medium text-xs md:text-sm">${ani.format || 'TV'}</span></div>
                        <div><span class="text-gray-600 text-[10px] font-bold uppercase block mb-1 tracking-wider">Source</span><span class="text-white font-medium capitalize text-xs md:text-sm">${ani.source ? ani.source.toLowerCase().replace('_', ' ') : 'N/A'}</span></div>
                        <div><span class="text-gray-600 text-[10px] font-bold uppercase block mb-1 tracking-wider">Main Studio</span><span class="text-white font-medium text-xs md:text-sm truncate block">${studios}</span></div>
                    </div>
                    
                    ${ani.synonyms && ani.synonyms.length > 0 ? `<div class="pt-2 border-t border-white/5"><span class="text-gray-600 text-[10px] font-bold uppercase block mb-2 tracking-wider">Alternative Titles</span><div class="text-gray-400 text-xs leading-relaxed space-y-1.5">${ani.synonyms.map(t => `<p>• ${t}</p>`).join('')}</div></div>` : ''}
                </div>

                <div class="lg:col-span-2 flex flex-col gap-8">
                    <div>
                        <h3 class="text-white text-base md:text-lg font-black mb-4 tracking-tight border-b-2 border-[#F47521] inline-block pb-1">Genres</h3>
                        <div class="flex flex-wrap gap-2 md:gap-3">${genresHtml}</div>
                    </div>
                    <div>
                        <h3 class="text-white text-base md:text-lg font-black mb-4 tracking-tight border-b-2 border-[#F47521] inline-block pb-1">Primary Staff</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">${staffHtml}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // --- EPISODES TAB ---
        const totalEps = data.episodes.length;
        let rangeOptions = '';
        if (totalEps > 0) {
            for (let i = 0; i < totalEps; i += 100) {
                const startNum = i + 1;
                const endNum = Math.min(i + 100, totalEps);
                const val = `${startNum}-${endNum}`;
                const isSelected = window.app.state.epRangeFilter === val ? 'selected' : '';
                rangeOptions += `<option value="${val}" ${isSelected}>Episodes ${startNum} - ${endNum}</option>`;
            }
            if (!window.app.state.epRangeFilter) window.app.state.epRangeFilter = `1-${Math.min(100, totalEps)}`;
        } else {
            rangeOptions = `<option>N/A</option>`;
        }

        contentArea.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0a0a0a] p-3 md:p-4 rounded-xl border border-white/5 shadow-md">
                <div class="relative w-full sm:w-64">
                    <select id="ep-range-dropdown" onchange="window.app.updateEpFilterRange(this.value)" class="appearance-none w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm font-bold py-2.5 pl-4 pr-10 rounded-lg cursor-pointer outline-none hover:border-white/30 focus:border-[#F47521]">
                        ${rangeOptions}
                    </select>
                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                </div>
                <div class="relative w-full sm:w-auto flex-1 max-w-sm">
                    <input type="number" id="episode-search-box" value="${window.app.state.epSearchValue}" onkeyup="window.app.runEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm py-2.5 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>
            
            <div id="numeric-episodes-grid" class="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-20 gap-2"></div>
        `;
        renderNumericEpisodeGrid();
    }
}

// --- EPISODE FILTERING ---

window.app.updateEpFilterRange = (val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    renderNumericEpisodeGrid();
};

window.app.runEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    renderNumericEpisodeGrid();
};

function renderNumericEpisodeGrid() {
    const gridDiv = document.getElementById('numeric-episodes-grid');
    if (!gridDiv) return;

    const data = window.app.state.currentAnimePage;
    const searchVal = window.app.state.epSearchValue;
    const rangeArray = window.app.state.epRangeFilter.split('-');
    
    let episodesToRender = data.episodes;

    if (searchVal !== '') {
        episodesToRender = data.episodes.filter((ep, idx) => {
            const epNumber = ep.number || (idx + 1);
            return epNumber.toString().includes(searchVal);
        });
    } else if (rangeArray.length === 2) {
        const startEpNum = parseInt(rangeArray[0]);
        const endEpNum = parseInt(rangeArray[1]);
        episodesToRender = data.episodes.filter((ep, idx) => {
            const epNumber = ep.number || (idx + 1);
            return epNumber >= startEpNum && epNumber <= endEpNum;
        });
    }

    if (episodesToRender.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-sm">No episodes match criteria.</div>`;
        return;
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const originalArrayIdx = data.episodes.findIndex(e => e.id === ep.id);
        const epNumber = ep.number || (originalArrayIdx + 1);
        
        const epTitleLower = (ep.title || '').toLowerCase();
        const isActuallyFiller = epTitleLower.includes('filler') || epTitleLower.includes('recap'); 
        
        const fillerIconDot = isActuallyFiller ? `<div class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></div>` : '';
        const hoverClasses = isActuallyFiller ? 'border-red-500/30 text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500' : 'border-white/5 text-gray-300 hover:bg-[#F47521] hover:text-white hover:border-[#F47521]';

        gridHtml += `
            <button onclick="window.location.href='play.html?id=${ep.id}&anime=${data.id}'" class="relative w-full aspect-square flex items-center justify-center rounded border transition-all duration-200 group bg-white/5 ${hoverClasses}">
                <span class="font-bold text-xs md:text-sm">${epNumber}</span>
                ${fillerIconDot}
            </button>
        `;
    });
    gridDiv.innerHTML = gridHtml;
}

// --- GLOBAL UTILITIES ---

window.app.togglePageDesc = () => {
    const descP = document.getElementById('info-desc');
    const btn = document.getElementById('read-more-btn');
    if (descP.classList.contains('line-clamp-3')) {
        descP.className = "text-xs md:text-sm text-gray-300 leading-relaxed drop-shadow-md pr-4 pb-2";
        btn.innerHTML = `Show Less <i class="fas fa-chevron-up ml-1"></i>`;
    } else {
        descP.className = "text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed drop-shadow-md pr-4";
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
    const formattedAnimeEntry = { id, title, img };
    if (profile.watchlist && profile.watchlist.some(item => item.id == formattedAnimeEntry.id)) return alert("Already in Library!");
    
    if(!profile.watchlist) profile.watchlist = [];
    profile.watchlist.unshift(formattedAnimeEntry);
    
    const clickedBtn = event.currentTarget;
    if (clickedBtn) {
        const originalBtnHtml = clickedBtn.innerHTML;
        clickedBtn.innerHTML = `<i class="fas fa-check text-green-400"></i> Added`;
        setTimeout(() => clickedBtn.innerHTML = originalBtnHtml, 2000);
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userFirestoreRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userFirestoreRef, { watchlist: firestore.arrayUnion(formattedAnimeEntry) });
    } catch (error) { console.error("Firebase library sync failed:", error); }
};
                Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                    bannerImage 
                    coverImage { extraLarge } 
                    description 
                    synonyms 
                    format 
                    source 
                    status 
                    averageScore 
                    genres 
                    studios(isMain: true) { nodes { name } } 
                    staff(perPage: 6, sort: RELEVANCE) { nodes { name { full } primaryOccupations } }
                } 
            }`;
            const aniRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables: { search: cleanTitleForSearch } })
            });
            const aniJson = await aniRes.json();
            if (aniJson?.data?.Media) aniData = aniJson.data.Media;
        } catch (e) { console.log("AniList sync failed."); }

        // 3. Construct Global Page State
        window.app.state.currentAnimePage = {
            id: animeId,
            title: baseAnime.title || baseAnime.name,
            jpTitle: baseAnime.titles || baseAnime.alternative || 'N/A',
            synopsis: baseAnime.description || baseAnime.synopsis || aniData.description || 'No description available.',
            poster: aniData.coverImage?.extraLarge || baseAnime.poster || baseAnime.image || 'https://via.placeholder.com/800x1200/111/fff?text=No+Poster',
            banner: aniData.bannerImage || baseAnime.background_image || baseAnime.cover || 'https://via.placeholder.com/1280x720/111/fff?text=No+Background',
            episodes: episodesList,
            aniList: aniData
        };

        window.app.state.activeInfoTab = 'episodes'; 
        window.app.state.epSearchValue = '';
        window.app.state.epRangeFilter = '1-100';

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
        window.app.state.currentAnimePage.smartPlayAction = targetEpisodeId;
        window.app.state.currentAnimePage.smartPlayText = playBtnText;

        // 5. Render Shell
        renderAnimeInfoShell();

    } catch (error) {
        console.error("Info Page Fatal Error:", error);
        container.innerHTML = `<div class="w-full h-screen flex flex-col items-center justify-center -mt-10"><i class="fas fa-exclamation-triangle text-5xl text-[#F47521] mb-4"></i><h2 class="text-2xl font-black text-white mb-2">Oops! Something went wrong.</h2><p class="text-gray-400 text-sm mb-6">${error.message}</p><button onclick="window.location.reload()" class="bg-white/10 px-6 py-2 rounded font-bold text-sm tracking-wide">Try Again</button></div>`;
    }
};


// --- UI PAINTER ENGINE ---

function renderAnimeInfoShell() {
    const container = document.getElementById('info-container');
    const data = window.app.state.currentAnimePage;
    const ani = data.aniList;

    const cleanDesc = data.synopsis.replace(/<[^>]*>?/gm, '');
    const genresStr = ani.genres ? ani.genres.join(' • ') : 'Action • Adventure';

    container.innerHTML = `
        <div class="w-full flex flex-col bg-[#050505] min-h-screen pb-24 mt-[60px] md:mt-0">
            
            <div class="relative w-full h-[35vh] md:h-[50vh]">
                <img src="${data.banner}" class="w-full h-full object-cover opacity-50 md:opacity-60">
                <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent"></div>
            </div>

            <div class="relative px-4 md:px-12 -mt-16 md:-mt-24 max-w-7xl mx-auto w-full z-20">
                
                <div class="flex flex-row gap-4 md:gap-8 items-end md:items-center">
                    
                    <div class="w-[35%] md:w-1/4 max-w-[140px] md:max-w-[240px] flex-shrink-0 rounded-lg overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.8)] border border-white/10 z-30">
                        <img src="${data.poster}" class="w-full h-full object-cover aspect-[2/3]">
                    </div>

                    <div class="flex-1 pb-1 z-30">
                        <h1 class="text-2xl md:text-5xl font-black text-white mb-1 drop-shadow-md leading-tight tracking-tight line-clamp-2 md:line-clamp-none">${data.title}</h1>
                        <p class="text-[11px] md:text-sm text-gray-400 font-medium mb-1 drop-shadow-md line-clamp-1">${data.jpTitle}</p>
                        <p class="text-[9px] md:text-xs text-[#F47521] font-bold tracking-widest mb-4 uppercase line-clamp-1">${genresStr}</p>
                        
                        <div class="flex flex-wrap gap-2.5 md:gap-4">
                            <button onclick="if('${data.smartPlayAction}' !== '') { window.location.href='play.html?id=${data.smartPlayAction}&anime=${data.id}' } else { alert('No episodes!') }" class="bg-[#F47521] text-black px-5 py-2 md:px-8 md:py-3 rounded md:rounded-lg shadow-[0_0_15px_rgba(244,117,33,0.3)] font-black text-[11px] md:text-sm uppercase tracking-wider hover:bg-white transition-all flex items-center gap-1.5 md:gap-2">
                                <i class="fas fa-play"></i> ${data.smartPlayText}
                            </button>
                            
                            <button onclick="window.app.addToLibrary('${data.id}', '${data.title.replace(/'/g, "\\'")}', '${data.poster}')" class="bg-white/10 backdrop-blur-md text-white px-4 py-2 md:px-6 md:py-3 rounded md:rounded-lg font-bold text-[11px] md:text-sm uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-1.5 md:gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mt-6 md:mt-8 w-full max-w-4xl">
                    <p id="info-desc" class="text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed drop-shadow-md pr-4">${cleanDesc}</p>
                    ${cleanDesc.length > 130 ? `<button onclick="window.app.togglePageDesc()" id="read-more-btn" class="text-[#F47521] text-[10px] md:text-xs font-bold uppercase tracking-wider mt-2 hover:text-white transition-colors">See More <i class="fas fa-chevron-down ml-1"></i></button>` : ''}
                </div>
            </div>

            <div class="w-full mt-6 md:mt-10">
                <div class="flex items-center gap-8 px-4 md:px-12 border-b border-white/10 text-xs md:text-sm font-bold uppercase tracking-widest pt-2 max-w-7xl mx-auto">
                    <button onclick="window.app.switchInfoTab('information')" id="tab-information" class="pb-3 transition-colors ${window.app.state.activeInfoTab === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Information</button>
                    <button onclick="window.app.switchInfoTab('episodes')" id="tab-episodes" class="pb-3 transition-colors ${window.app.state.activeInfoTab === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Episodes</button>
                </div>
                <div id="dynamic-tab-content-area" class="px-4 md:px-12 py-6 md:py-8 max-w-7xl mx-auto"></div>
            </div>
        </div>
    `;

    renderDynamicTabContent();
}

// --- TAB STATE MANAGEMENT & RENDERING ---

window.app.switchInfoTab = (tabName) => {
    if (window.app.state.activeInfoTab === tabName) return;
    window.app.state.activeInfoTab = tabName;
    
    document.getElementById('tab-information').className = `pb-3 transition-colors ${tabName === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    document.getElementById('tab-episodes').className = `pb-3 transition-colors ${tabName === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    
    renderDynamicTabContent();
};

function renderDynamicTabContent() {
    const contentArea = document.getElementById('dynamic-tab-content-area');
    const data = window.app.state.currentAnimePage;

    if (window.app.state.activeInfoTab === 'information') {
        const ani = data.aniList;
        if (!ani || Object.keys(ani).length === 0) {
            contentArea.innerHTML = `<div class="text-gray-500 py-10 text-center flex flex-col items-center"><i class="fas fa-satellite-dish text-3xl mb-4"></i> Extended AniList details not available for this series.</div>`;
            return;
        }

        const genresHtml = ani.genres ? ani.genres.map(g => `<span class="bg-white/10 px-3 py-1 rounded-full text-[10px] md:text-xs text-white font-medium">${g}</span>`).join('') : 'N/A';
        const studios = ani.studios?.nodes?.map(s => s.name).join(', ') || 'Unknown';
        const staffHtml = ani.staff?.nodes?.map(s => `<div class="bg-[#111] p-3 rounded-lg border border-white/5"><div class="font-bold text-white text-xs md:text-sm">${s.name.full}</div><div class="text-[10px] md:text-xs text-gray-500">${s.primaryOccupations.join(', ')}</div></div>`).join('') || 'Unknown';

        contentArea.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <div class="md:col-span-1 flex flex-col gap-4 bg-[#0a0a0a] p-5 rounded-xl border border-white/5">
                    <div><span class="text-gray-600 text-[10px] md:text-xs font-bold uppercase block mb-1">Score</span><span class="text-[#F47521] font-black text-xl"><i class="fas fa-star text-sm"></i> ${ani.averageScore || '?'}% Average</span></div>
                    <div><span class="text-gray-600 text-[10px] md:text-xs font-bold uppercase block mb-1">Status</span><span class="text-white font-medium capitalize text-sm">${ani.status ? ani.status.toLowerCase().replace('_', ' ') : 'Unknown'}</span></div>
                    <div><span class="text-gray-600 text-[10px] md:text-xs font-bold uppercase block mb-1">Format</span><span class="text-white font-medium text-sm">${ani.format || 'TV'}</span></div>
                    <div><span class="text-gray-600 text-[10px] md:text-xs font-bold uppercase block mb-1">Studio</span><span class="text-white font-medium text-sm">${studios}</span></div>
                    ${ani.synonyms && ani.synonyms.length > 0 ? `<div><span class="text-gray-600 text-[10px] md:text-xs font-bold uppercase block mb-1">Alternative Titles</span><div class="text-gray-300 text-xs leading-relaxed space-y-1">${ani.synonyms.map(t => `<p>• ${t}</p>`).join('')}</div></div>` : ''}
                </div>

                <div class="md:col-span-2 flex flex-col gap-8">
                    <div>
                        <h3 class="text-white text-base md:text-lg font-black mb-4 tracking-tight">Genres</h3>
                        <div class="flex flex-wrap gap-2">${genresHtml}</div>
                    </div>
                    <div>
                        <h3 class="text-white text-base md:text-lg font-black mb-4 tracking-tight">Primary Staff</h3>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${staffHtml}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Episodes Tab
        const totalEps = data.episodes.length;
        let rangeOptions = '';
        if (totalEps > 0) {
            for (let i = 0; i < totalEps; i += 100) {
                const startNum = i + 1;
                const endNum = Math.min(i + 100, totalEps);
                const val = `${startNum}-${endNum}`;
                const isSelected = window.app.state.epRangeFilter === val ? 'selected' : '';
                rangeOptions += `<option value="${val}" ${isSelected}>Episodes ${startNum} - ${endNum}</option>`;
            }
            if (!window.app.state.epRangeFilter) window.app.state.epRangeFilter = `1-${Math.min(100, totalEps)}`;
        } else {
            rangeOptions = `<option>N/A</option>`;
        }

        contentArea.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-[#0a0a0a] p-3 md:p-4 rounded-xl border border-white/5">
                <div class="relative w-full sm:w-64">
                    <select id="ep-range-dropdown" onchange="window.app.updateEpFilterRange(this.value)" class="appearance-none w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm font-bold py-2.5 pl-4 pr-10 rounded-lg cursor-pointer outline-none hover:border-white/30 focus:border-[#F47521]">
                        ${rangeOptions}
                    </select>
                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                </div>
                <div class="relative w-full sm:w-auto flex-1 max-w-sm">
                    <input type="number" id="episode-search-box" value="${window.app.state.epSearchValue}" onkeyup="window.app.runEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm py-2.5 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>
            <div id="numeric-episodes-grid" class="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2"></div>
        `;
        renderNumericEpisodeGrid();
    }
}

// --- EPISODE FILTERING ---

window.app.updateEpFilterRange = (val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    renderNumericEpisodeGrid();
};

window.app.runEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    renderNumericEpisodeGrid();
};

function renderNumericEpisodeGrid() {
    const gridDiv = document.getElementById('numeric-episodes-grid');
    if (!gridDiv) return;

    const data = window.app.state.currentAnimePage;
    const searchVal = window.app.state.epSearchValue;
    const rangeArray = window.app.state.epRangeFilter.split('-');
    
    let episodesToRender = data.episodes;

    if (searchVal !== '') {
        episodesToRender = data.episodes.filter((ep, idx) => {
            const epNumber = ep.number || (idx + 1);
            return epNumber.toString().includes(searchVal);
        });
    } else if (rangeArray.length === 2) {
        const startEpNum = parseInt(rangeArray[0]);
        const endEpNum = parseInt(rangeArray[1]);
        episodesToRender = data.episodes.filter((ep, idx) => {
            const epNumber = ep.number || (idx + 1);
            return epNumber >= startEpNum && epNumber <= endEpNum;
        });
    }

    if (episodesToRender.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-sm">No episodes match criteria.</div>`;
        return;
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const originalArrayIdx = data.episodes.findIndex(e => e.id === ep.id);
        const epNumber = ep.number || (originalArrayIdx + 1);
        
        const epTitleLower = (ep.title || '').toLowerCase();
        const isActuallyFiller = epTitleLower.includes('filler') || epTitleLower.includes('recap'); 
        
        const fillerIconDot = isActuallyFiller ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></div>` : '';
        const hoverClasses = isActuallyFiller ? 'border-red-500/20 text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500' : 'border-white/5 text-gray-300 hover:bg-[#F47521] hover:text-white hover:border-[#F47521]';

        gridHtml += `
            <button onclick="window.location.href='play.html?id=${ep.id}&anime=${data.id}'" class="relative w-full aspect-square flex items-center justify-center rounded border transition-all duration-200 group bg-white/5 ${hoverClasses}">
                <span class="font-bold text-sm">${epNumber}</span>
                ${fillerIconDot}
            </button>
        `;
    });
    gridDiv.innerHTML = gridHtml;
}

// --- GLOBAL UTILITIES ---

window.app.togglePageDesc = () => {
    const descP = document.getElementById('info-desc');
    const btn = document.getElementById('read-more-btn');
    if (descP.classList.contains('line-clamp-3') || descP.classList.contains('line-clamp-2')) {
        descP.className = "text-xs md:text-sm text-gray-300 leading-relaxed drop-shadow-md pr-4 pb-2";
        btn.innerHTML = `Show Less <i class="fas fa-chevron-up ml-1"></i>`;
    } else {
        descP.className = "text-xs md:text-sm text-gray-300 line-clamp-2 md:line-clamp-3 leading-relaxed drop-shadow-md pr-4";
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
    const formattedAnimeEntry = { id, title, img };
    if (profile.watchlist && profile.watchlist.some(item => item.id == formattedAnimeEntry.id)) return alert("Already in Library!");
    
    if(!profile.watchlist) profile.watchlist = [];
    profile.watchlist.unshift(formattedAnimeEntry);
    
    const clickedBtn = event.currentTarget;
    if (clickedBtn) {
        const originalBtnHtml = clickedBtn.innerHTML;
        clickedBtn.innerHTML = `<i class="fas fa-check text-green-400"></i> Added`;
        setTimeout(() => clickedBtn.innerHTML = originalBtnHtml, 2000);
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userFirestoreRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userFirestoreRef, { watchlist: firestore.arrayUnion(formattedAnimeEntry) });
    } catch (error) { console.error("Firebase library sync failed:", error); }
};
