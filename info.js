// info.js

window.app.components.info = async () => {
    const container = document.getElementById('info-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    let animeId = urlParams.get('id');

    if (!animeId || animeId === 'unknown' || animeId === 'undefined') {
        container.innerHTML = `<div class="mt-32 text-center text-gray-400 font-bold uppercase"><i class="fas fa-search text-4xl mb-4 text-[#F47521]"></i><br>Invalid Anime ID in URL<br><button onclick="window.location.href='index.html'" class="mt-6 text-xs text-white bg-white/10 px-6 py-2 rounded hover:bg-[#F47521]">Go Home</button></div>`;
        return;
    }

    // High-performance state injection & data fetch thread
    window.app.loadInfoPageData = async (targetId) => {
        animeId = targetId;
        const newUrl = `${window.location.pathname}?id=${targetId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        container.innerHTML = `
            <div class="w-full h-[60vh] flex items-center justify-center">
                <div class="tk-loader scale-75">
                    <div class="tk-dot tk-dot-1"></div>
                    <div class="tk-dot tk-dot-2"></div>
                </div>
            </div>
        `;

        try {
            const baseUrl = 'https://anikoto-api-xi.vercel.app';
            
            // 1. Fetch metadata directly from /api/info
            const infoResponse = await fetch(`${baseUrl}/api/info?id=${animeId}`);
            const infoJson = await infoResponse.json();
            
            if (!infoJson || !infoJson.success || !infoJson.data) {
                throw new Error("Target anime metadata could not be parsed from server payload.");
            }
            
            const baseAnime = infoJson.data;

            // 2. Fetch corresponding episode list map configurations safely
            let episodesList = [];
            try {
                const epsResponse = await fetch(`${baseUrl}/api/episodes/${animeId}`);
                const epsJson = await epsResponse.json();
                
                if (epsJson && epsJson.success) {
                    if (epsJson.results && epsJson.results.episodes) {
                        episodesList = epsJson.results.episodes;
                    } else if (Array.isArray(epsJson.results)) {
                        episodesList = epsJson.results;
                    } else if (Array.isArray(epsJson.data)) {
                        episodesList = epsJson.data;
                    }
                }
            } catch (e) {
                console.log("No matching episodes payload layout detected.");
            }

            // 3. Fetch Schedule Countdown Data if Available
            let scheduleData = null;
            try {
                const schedRes = await fetch(`${baseUrl}/api/schedule/${animeId}`);
                const schedJson = await schedRes.json();
                if (schedJson && schedJson.success && schedJson.results) {
                    scheduleData = schedJson.results.nextEpisodeSchedule || null;
                }
            } catch (e) {
                console.log("No schedule tracking module available.");
            }

            // --- ANILIST API SYNC BLOCK ---
            let aniData = {};
            const hasValidAniId = baseAnime.anilistId && !isNaN(baseAnime.anilistId);
            
            const query = hasValidAniId 
                ? `query ($id: Int) { 
                    Media (id: $id, type: ANIME) { 
                        id title { romaji native english } bannerImage coverImage { extraLarge } description synonyms format source status averageScore trending genres 
                        studios(isMain: true) { nodes { name } } 
                        staff(perPage: 12, sort: RELEVANCE) { nodes { name { full } image { large } primaryOccupations } }
                        relations { nodes { id type format status bannerImage coverImage { extraLarge } title { romaji english } } }
                    } 
                  }`
                : `query ($search: String) { 
                    Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                        id title { romaji native english } bannerImage coverImage { extraLarge } description synonyms format source status averageScore trending genres 
                        studios(isMain: true) { nodes { name } } 
                        staff(perPage: 12, sort: RELEVANCE) { nodes { name { full } image { large } primaryOccupations } }
                        relations { nodes { id type format status bannerImage coverImage { extraLarge } title { romaji english } } }
                } 
              }`;

            try {
                const variables = hasValidAniId ? { id: parseInt(baseAnime.anilistId) } : { search: baseAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim() };
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables })
                });
                const json = await aniRes.json();
                aniData = json?.data?.Media || {};
            } catch (e) {
                console.log("GraphQL dynamic fallback state handled.");
            }

            // Fallback allocations
            const finalTitle = baseAnime.title || aniData.title?.english || aniData.title?.romaji || 'Unknown Title';
            const finalJpTitle = baseAnime.japanese_title || aniData.title?.native || 'N/A';
            const finalDesc = baseAnime.description || aniData.description || 'No description available.';
            const finalBanner = aniData.bannerImage || aniData.coverImage?.extraLarge || baseAnime.poster || 'https://via.placeholder.com/1280x720/111/fff?text=No+Background';

            // Extract and clean raw data relations array
            let extractedRelations = [];
            if (aniData.relations && aniData.relations.nodes) {
                extractedRelations = aniData.relations.nodes.filter(node => node.type === 'ANIME');
            }

            window.app.state.currentAnimePage = {
                id: animeId,
                title: finalTitle,
                jpTitle: finalJpTitle,
                synopsis: finalDesc,
                poster: aniData.coverImage?.extraLarge || baseAnime.poster || 'https://via.placeholder.com/800x1200/111/fff?text=No+Poster',
                banner: finalBanner,
                episodes: episodesList,
                relations: extractedRelations,
                aniList: aniData,
                scheduleCountdown: scheduleData,
                rawPayload: baseAnime
            };

            window.app.state.activeInfoTab = 'information'; 
            window.app.state.epSearchValue = '';
            window.app.state.epRangeFilter = '1-100';

            // Core playlist index resolution
            const profile = window.app.state && window.app.state.activeProfile ? window.app.state.activeProfile : null;
            let playBtnText = "Play E01";
            let targetEpisodeId = episodesList.length > 0 ? (episodesList[0].id || episodesList[0].episode_no) : '';
            
            if (profile && profile.history) {
                const historyItem = profile.history.find(h => h.animeId === animeId);
                if (historyItem) {
                    playBtnText = `Resume E${historyItem.episodeNumber || '?'}`;
                    targetEpisodeId = historyItem.episodeId || targetEpisodeId;
                }
            }
            window.app.state.currentAnimePage.smartPlayAction = targetEpisodeId;
            window.app.state.currentAnimePage.smartPlayText = playBtnText;

            renderAnimeInfoShell();

        } catch (error) {
            console.error("Info View Sync Exception Handling Thread:", error);
            container.innerHTML = `<div class="w-full h-screen flex flex-col items-center justify-center -mt-10"><i class="fas fa-exclamation-triangle text-5xl text-[#F47521] mb-4"></i><h2 class="text-2xl font-black text-white mb-2">Oops! Something went wrong.</h2><p class="text-gray-400 text-sm mb-6">${error.message}</p><button onclick="window.location.reload()" class="bg-white/10 px-6 py-2 rounded font-bold text-sm tracking-wide">Try Again</button></div>`;
        }
    };

    window.app.loadInfoPageData(animeId);
};

function renderAnimeInfoShell() {
    const container = document.getElementById('info-container');
    const data = window.app.state.currentAnimePage;
    const ani = data.aniList;
    const raw = data.rawPayload;

    const cleanDesc = (data.synopsis || '').replace(/<[^>]*>?/gm, '');
    
    let genresStr = 'Anime Series';
    if (ani && ani.genres) genresStr = ani.genres.join(' • ');
    else if (raw && raw.genres) genresStr = Array.isArray(raw.genres) ? raw.genres.join(' • ') : raw.genres;

    // Direct check for production/release lifecycle stages
    const isUpcoming = (raw?.status && raw.status.toString().toLowerCase().includes('upcoming')) || 
                       (ani?.status && ani.status.toString().toLowerCase().includes('not_yet_released'));

    const upcomingBadge = isUpcoming ? `<span class="bg-red-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded shadow-sm uppercase tracking-wider animate-pulse"><i class="fas fa-clock mr-1"></i> Upcoming</span>` : '';
    const trendingBadge = ani && ani.trending ? `<span class="bg-[#F47521]/10 border border-[#F47521]/30 px-2 py-0.5 rounded backdrop-blur-sm">#${ani.trending} Trending</span>` : '';
    
    const scoreVal = (ani && ani.averageScore) ? `${ani.averageScore}%` : (raw && raw.mal ? `${raw.mal}/10` : null);
    const scoreBadge = scoreVal ? `<span class="flex items-center gap-1"><i class="fas fa-star"></i> ${scoreVal} SCORE</span>` : '';

    container.innerHTML = `
        <div class="w-full flex flex-col bg-[#050505] min-h-screen pb-24">
            
            <div class="relative w-full min-h-[55vh] md:min-h-[65vh] flex items-center py-10 border-b border-white/5 overflow-hidden">
                <div class="absolute inset-0 z-0 pointer-events-none">
                    <img src="${data.banner}" class="w-full h-full object-cover object-top opacity-50 md:opacity-70">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/20 to-transparent hidden md:block"></div>
                </div>

                <div class="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-12 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 mt-4">
                    <div class="w-[45%] max-w-[180px] md:w-1/4 md:max-w-[260px] flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                        <img src="${data.poster}" class="w-full h-full object-cover aspect-[2/3]">
                    </div>

                    <div class="flex-1 flex flex-col items-center md:items-start text-center md:text-left w-full pt-2">
                        <div class="flex flex-wrap items-center justify-center md:justify-start gap-3 text-[#F47521] text-[10px] md:text-xs font-black tracking-widest drop-shadow-md mb-2 md:mb-3 uppercase w-full">
                            ${upcomingBadge}
                            ${trendingBadge}
                            ${scoreBadge}
                        </div>

                        <h1 class="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-2 drop-shadow-lg leading-tight tracking-tight">${data.title}</h1>
                        <p class="text-xs md:text-base text-gray-400 font-medium mb-3 drop-shadow-md">${data.jpTitle}</p>
                        <p class="text-[10px] md:text-xs text-[#F47521] font-bold tracking-widest mb-8 uppercase">${genresStr}</p>
                        
                        <div class="flex flex-wrap justify-center md:justify-start gap-3 md:gap-4 mb-8 w-full">
                            ${!isUpcoming ? `
                            <button onclick="window.app.handlePlayClick('${data.smartPlayAction}', '${data.id}')" class="bg-[#F47521] text-white px-8 py-3.5 rounded-lg shadow-md font-black text-xs md:text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                                <i class="fas fa-play"></i> ${data.smartPlayText}
                            </button>` : ''}
                            
                            <button onclick="window.app.addToLibrary('${data.id}', '${data.title.replace(/'/g, "\\'")}', '${data.poster}')" class="bg-white/10 backdrop-blur-md text-white px-6 py-3.5 rounded-lg shadow-md font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>

                        <div class="relative w-full max-w-3xl transition-all duration-300">
                            <p id="info-desc" class="text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed drop-shadow-md">${cleanDesc}</p>
                            ${cleanDesc.length > 130 ? `<button onclick="window.app.togglePageDesc()" id="read-more-btn" class="text-[#F47521] text-[10px] md:text-xs font-bold uppercase tracking-wider mt-3 hover:text-white transition-colors">See More <i class="fas fa-chevron-down ml-1"></i></button>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="w-full max-w-7xl mx-auto px-4 md:px-12 mt-8 flex flex-col gap-6">
                
                <div id="verified-relations-pill-box" class="w-full hidden">
                    <h3 class="text-white text-xs font-black mb-3 uppercase tracking-widest text-gray-400">Seasons & Alternative Media</h3>
                    <div id="relations-horizontal-slider" class="w-full flex gap-3 overflow-x-auto pb-3 hide-scrollbar snap-x"></div>
                </div>

                <div class="flex items-center justify-center w-full max-w-2xl border-b border-white/10 text-xs md:text-sm font-bold uppercase tracking-widest pt-2">
                    <button onclick="window.app.switchInfoTab('information')" id="tab-information" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Information</button>
                    <button onclick="window.app.switchInfoTab('episodes')" id="tab-episodes" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Episodes</button>
                </div>
                
                <div id="dynamic-tab-content-area" class="py-4"></div>
            </div>
        </div>
    `;

    renderDynamicTabContent();
    injectVerifiedAlternativePills();
    setupDropdownListener();
}

// Intercepts AniList IDs to map against internal index files
async function injectVerifiedAlternativePills() {
    const data = window.app.state.currentAnimePage;
    const slider = document.getElementById('relations-horizontal-slider');
    const containerBox = document.getElementById('verified-relations-pill-box');
    
    if (!slider || !data.relations || data.relations.length === 0) return;

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    let validPillsCount = 0;

    for (const rel of data.relations) {
        try {
            const relTitle = rel.title?.english || rel.title?.romaji;
            if (!relTitle) continue;

            // Step 1: Call endpoint query keyword match lookup
            const response = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(relTitle)}`);
            const json = await response.json();

            if (json.success && json.results && json.results.length > 0) {
                // Step 2: Extract anilist ID mapping config safely
                const targetMatch = json.results.find(item => item.id && (item.id === rel.id || String(item.title).toLowerCase() === String(relTitle).toLowerCase()));
                const activeId = targetMatch ? targetMatch.id : json.results[0].id;

                const bgImage = rel.bannerImage || rel.coverImage?.extraLarge || '';
                const formatBadge = rel.format ? `<span class="bg-[#F47521] text-white text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide uppercase">${rel.format}</span>` : '';
                const statusStr = rel.status ? rel.status.toLowerCase().replace('_', ' ') : '';

                const blockDiv = document.createElement('div');
                blockDiv.className = `relative w-[260px] md:w-[320px] h-20 rounded-xl overflow-hidden border border-white/5 hover:border-[#F47521]/50 cursor-pointer transition-all flex items-center px-4 group shadow-lg flex-shrink-0`;
                blockDiv.onclick = () => window.app.loadInfoPageData(activeId);
                
                blockDiv.innerHTML = `
                    <div class="absolute inset-0 z-0 bg-black">
                        <img src="${bgImage}" class="w-full h-full object-cover opacity-35 group-hover:scale-105 transition-transform duration-500 object-center">
                        <div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
                    </div>
                    <div class="relative z-10 flex flex-col gap-1 min-w-0 pr-4">
                        <div class="flex items-center gap-2">
                            ${formatBadge}
                            <span class="text-gray-400 font-bold capitalize text-[10px] tracking-wider">${statusStr}</span>
                        </div>
                        <h4 class="text-white font-black text-xs md:text-sm truncate drop-shadow-md tracking-tight">${relTitle}</h4>
                    </div>
                    <i class="fas fa-chevron-right text-gray-500 group-hover:text-[#F47521] ml-auto relative z-10 transition-colors text-xs"></i>
                `;

                slider.appendChild(blockDiv);
                validPillsCount++;
            }
        } catch (e) {
            console.log("Alternative mapping sequence entry failed initialization parameters.");
        }
    }

    if (validPillsCount > 0 && containerBox) {
        containerBox.classList.remove('hidden');
    }
}

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
    const ani = data.aniList;
    const raw = data.rawPayload;

    if (window.app.state.activeInfoTab === 'information') {
        const studios = ani?.studios?.nodes?.map(s => s.name).join(', ') || (raw?.studios ? (Array.isArray(raw.studios) ? raw.studios.join(', ') : raw.studios) : 'N/A');
        const producers = raw?.producers ? (Array.isArray(raw.producers) ? raw.producers.join(', ') : raw.producers) : 'N/A';
        const formatStr = raw?.type ? (Array.isArray(raw.type) ? raw.type.join(', ') : raw.type) : (ani?.format || 'N/A');
        const statusStr = raw?.status ? (Array.isArray(raw.status) ? raw.status.join(', ') : raw.status) : (ani?.status?.toLowerCase().replace('_', ' ') || 'N/A');
        const airedTimeline = raw?.aired ? (Array.isArray(raw.aired) ? raw.aired.join(', ') : raw.aired) : 'N/A';
        const premSeason = raw?.premiered ? (Array.isArray(raw.premiered) ? raw.premiered.join(', ') : raw.premiered) : 'N/A';
        const trackDuration = raw?.duration ? (Array.isArray(raw.duration) ? raw.duration.join(', ') : raw.duration) : 'N/A';
        const totalEpsCount = raw?.episodes ? (Array.isArray(raw.episodes) ? raw.episodes.join(', ') : raw.episodes) : (data.episodes?.length || 'N/A');

        let synonymsList = [];
        if (ani?.synonyms) synonymsList = [...ani.synonyms];
        if (raw?.animeInfo?.Synonyms) synonymsList.push(raw.animeInfo.Synonyms);
        const uniqueSynonyms = [...new Set(synonymsList)].filter(Boolean);

        const staffHtml = ani?.staff?.nodes?.map(s => `
            <div class="bg-[#111] p-3 rounded-lg border border-white/5 shadow-inner flex items-center gap-3 md:gap-4 hover:border-white/20 transition-colors">
                <img src="${s.image?.large || 'https://via.placeholder.com/150/222/fff?text=?'}" class="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-white/10 shadow-md">
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white text-xs md:text-sm truncate">${s.name.full}</div>
                    <div class="text-[10px] md:text-xs text-[#F47521] truncate mt-0.5">${s.primaryOccupations.join(', ')}</div>
                </div>
            </div>
        `).join('') || '<div class="text-gray-500 text-xs">No configuration entries recorded for key staff.</div>';

        contentArea.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-1 flex flex-col gap-5 bg-[#0a0a0a] p-6 rounded-xl border border-white/5 shadow-lg h-fit text-xs">
                    <h4 class="text-white font-black uppercase tracking-widest text-[#F47521] border-b border-white/5 pb-2">Full Specifications</h4>
                    <div class="flex flex-col gap-4">
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Format Type</span><span class="text-white capitalize font-medium">${formatStr}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Current Status</span><span class="text-white capitalize font-medium">${statusStr}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Primary Studio</span><span class="text-white font-medium">${studios}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Producers List</span><span class="text-white font-medium">${producers}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Total Episodes Matrix</span><span class="text-white font-medium">${totalEpsCount} Units</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Runtime Duration</span><span class="text-white font-medium">${trackDuration}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Premiered Season</span><span class="text-white uppercase font-medium">${premSeason}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Aired Window</span><span class="text-white font-medium">${airedTimeline}</span></div>
                        <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Source Material</span><span class="text-white capitalize font-medium">${ani?.source?.toLowerCase().replace('_', ' ') || 'N/A'}</span></div>
                    </div>

                    ${uniqueSynonyms.length > 0 ? `
                    <div class="pt-4 border-t border-white/5 mt-2">
                        <h5 class="text-gray-500 font-bold uppercase tracking-wider mb-2">Alternative Titles</h5>
                        <div class="text-gray-400 leading-relaxed space-y-1.5 text-[11px]">
                            ${uniqueSynonyms.map(syn => `<p class="truncate"><i class="fas fa-marker text-[#F47521]/40 text-[9px] mr-1.5"></i>${syn}</p>`).join('')}
                        </div>
                    </div>` : ''}
                </div>

                <div class="lg:col-span-2 flex flex-col gap-6">
                    <h3 class="text-white text-base md:text-lg font-black tracking-tight border-b-2 border-[#F47521] inline-block pb-1">Production & Voice Cast</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${staffHtml}</div>
                </div>
            </div>
        `;
    } else {
        const isUpcoming = (raw?.status && raw.status.toString().toLowerCase().includes('upcoming')) || 
                           (ani?.status && ani.status.toString().toLowerCase().includes('not_yet_released'));

        if (isUpcoming) {
            const expectedDate = raw?.aired || premSeason || "TBA 2026";
            const liveCountdown = data.scheduleCountdown ? `<p class="text-sm font-black text-[#F47521] bg-[#F47521]/10 px-4 py-2 border border-[#F47521]/20 rounded-md tracking-wider max-w-sm mx-auto uppercase"><i class="fas fa-satellite-dish mr-1.5"></i> Next Ep Live: ${data.scheduleCountdown}</p>` : '';

            contentArea.innerHTML = `
                <div class="w-full text-center py-16 bg-[#0a0a0a] rounded-xl border border-white/5 p-6 flex flex-col gap-4 max-w-2xl mx-auto shadow-xl">
                    <i class="fas fa-hourglass-start text-4xl text-[#F47521] animate-bounce"></i>
                    <h3 class="text-xl font-black text-white tracking-tight uppercase">Upcoming Transmission</h3>
                    <p class="text-gray-400 text-xs max-w-md mx-auto leading-relaxed">This series has been successfully indexed on Blaze-X but hasn't broadcasted episodes yet.</p>
                    <div class="my-2">
                        <span class="text-gray-600 uppercase font-black text-[10px] tracking-widest block mb-1">Expected Timeline</span>
                        <p class="text-white text-sm font-bold capitalize">${expectedDate}</p>
                    </div>
                    ${liveCountdown}
                </div>
            `;
            return;
        }

        const totalEps = data.episodes ? data.episodes.length : 0;
        let dropdownHtml = '';
        let currentLabel = 'N/A';

        if (totalEps > 0) {
            for (let i = 0; i < totalEps; i += 100) {
                const startNum = i + 1;
                const endNum = Math.min(i + 100, totalEps);
                const val = `${startNum}-${endNum}`;
                const label = `Episodes ${startNum} - ${endNum}`;
                if (!window.app.state.epRangeFilter && i === 0) window.app.state.epRangeFilter = val;
                if (window.app.state.epRangeFilter === val) currentLabel = label;
                dropdownHtml += `<button onclick="window.app.selectDropdownOption('${label}', '${val}')" class="w-full text-left px-4 py-3 text-xs md:text-sm font-bold text-white hover:bg-[#F47521] hover:text-black transition-colors border-b border-white/5 last:border-0">${label}</button>`;
            }
        } else {
            currentLabel = 'No Episodes';
            dropdownHtml = `<div class="px-4 py-3 text-xs text-gray-500">N/A</div>`;
        }

        contentArea.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0a0a0a] p-3 md:p-4 rounded-xl border border-white/5 shadow-md">
                <div class="relative w-full sm:w-64" id="custom-dropdown-container">
                    <button id="custom-dropdown-btn" onclick="window.app.toggleDropdown()" class="flex items-center justify-between w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm font-bold py-3 pl-4 pr-4 rounded-lg outline-none hover:border-white/30 focus:border-[#F47521] transition-all">
                        <span id="custom-dropdown-selected">${currentLabel}</span>
                        <i id="custom-dropdown-icon" class="fas fa-chevron-down text-gray-400 text-xs transition-transform duration-300"></i>
                    </button>
                    <div id="custom-dropdown-menu" class="absolute left-0 mt-2 w-full bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 hidden overflow-hidden flex flex-col max-h-60 overflow-y-auto hide-scrollbar">
                        ${dropdownHtml}
                    </div>
                </div>
                <div class="relative w-full sm:w-auto flex-1 max-w-sm">
                    <input type="number" id="episode-search-box" value="${window.app.state.epSearchValue}" onkeyup="window.app.runEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600 transition-colors">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>
            <div id="numeric-episodes-grid" class="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-20 gap-2"></div>
        `;
        renderNumericEpisodeGrid();
    }
}

window.app.toggleDropdown = () => {
    const menu = document.getElementById('custom-dropdown-menu');
    const icon = document.getElementById('custom-dropdown-icon');
    if (!menu) return;
    if(menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
};

window.app.selectDropdownOption = (label, val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('custom-dropdown-selected').innerText = label;
    window.app.toggleDropdown();
    document.getElementById('episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    renderNumericEpisodeGrid();
};

function setupDropdownListener() {
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('custom-dropdown-menu');
        const btn = document.getElementById('custom-dropdown-btn');
        if (menu && !menu.classList.contains('hidden')) {
            if (btn && !btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.getElementById('custom-dropdown-icon').style.transform = 'rotate(0deg)';
            }
        }
    });
}

window.app.runEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    renderNumericEpisodeGrid();
};

function renderNumericEpisodeGrid() {
    const gridDiv = document.getElementById('numeric-episodes-grid');
    if (!gridDiv || !window.app.state.currentAnimePage.episodes) return;

    const data = window.app.state.currentAnimePage;
    const searchVal = window.app.state.epSearchValue;
    const rangeArray = window.app.state.epRangeFilter ? window.app.state.epRangeFilter.split('-') : [];
    
    let episodesToRender = data.episodes || [];

    if (searchVal !== '') {
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.episode_no;
            return epNumber && epNumber.toString().includes(searchVal);
        });
    } else if (rangeArray.length === 2) {
        const startEpNum = parseInt(rangeArray[0]);
        const endEpNum = parseInt(rangeArray[1]);
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.episode_no;
            return epNumber && epNumber >= startEpNum && epNumber <= endEpNum;
        });
    }

    if (episodesToRender.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-sm">No episodes listed yet.</div>`;
        return;
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const epNumber = ep.episode_no;
        const targetId = ep.id;
        
        const epTitleLower = (ep.title || '').toLowerCase();
        const isActuallyFiller = epTitleLower.includes('filler') || epTitleLower.includes('recap'); 
        
        const fillerIconDot = isActuallyFiller ? `<div class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></div>` : '';
        const hoverClasses = isActuallyFiller ? 'border-red-500/30 text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-sm' : 'border-white/5 text-gray-300 hover:bg-[#F47521] hover:text-black hover:border-[#F47521] shadow-sm';

        gridHtml += `
            <button onclick="window.app.handlePlayClick('${targetId}', '${data.id}')" class="relative w-full aspect-square flex items-center justify-center rounded border transition-all duration-200 group bg-white/5 ${hoverClasses}">
                <span class="font-bold text-xs md:text-sm">${epNumber}</span>
                ${fillerIconDot}
            </button>
        `;
    });
    gridDiv.innerHTML = gridHtml;
}

window.app.togglePageDesc = () => {
    const descP = document.getElementById('info-desc');
    const btn = document.getElementById('read-more-btn');
    if (descP.classList.contains('line-clamp-3')) {
        descP.className = "text-xs md:text-sm text-gray-300 leading-relaxed drop-shadow-md pr-4 pb-2 transition-all duration-300";
        btn.innerHTML = `Show Less <i class="fas fa-chevron-up ml-1"></i>`;
    } else {
        descP.className = "text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed drop-shadow-md pr-4 transition-all duration-300";
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

window.app.handlePlayClick = async (episodeId, animeId) => {
    if (!episodeId || episodeId === '') {
        if(window.app.showCustomAlert) window.app.showCustomAlert('No streaming links available for this entry yet!', 'error');
        else alert('No episodes available yet!');
        return;
    }
    // Route matching play parameter configurations
    window.location.href = `play.html?id=${episodeId}&anime=${animeId}`;
};
