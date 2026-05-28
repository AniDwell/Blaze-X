// info.js

window.app.components.info = async () => {
    const container = document.getElementById('info-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    let animeId = urlParams.get('id');

    if (!animeId || animeId === 'unknown' || animeId === 'undefined') {
        container.innerHTML = `
            <div class="mt-32 text-center text-gray-400 font-bold uppercase">
                <i class="fas fa-search text-4xl mb-4 text-[#F47521]"></i><br>Invalid Anime ID in URL<br>
                <button onclick="window.location.href='index.html'" class="mt-6 text-xs text-white bg-white/10 px-6 py-2 rounded hover:bg-[#F47521]">Go Home</button>
            </div>
        `;
        return;
    }

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
            if (!infoJson || !infoJson.success || !infoJson.data) throw new Error("Anime metadata parsing aborted.");
            const baseAnime = infoJson.data;

            // 2. Fetch corresponding episode lists matching /api/episodes/{param} strictly
            let episodesList = [];
            try {
                const epsResponse = await fetch(`${baseUrl}/api/episodes/${animeId}`);
                const epsJson = await epsResponse.json();
                if (epsJson && epsJson.success && Array.isArray(epsJson.data)) episodesList = epsJson.data;
            } catch (e) { console.log("Episode list download skipped."); }

            // 3. Fetch Schedule Countdown Data straight from /api/schedule/:id
            let scheduleData = null;
            try {
                const schedRes = await fetch(`${baseUrl}/api/schedule/${animeId}`);
                const schedJson = await schedRes.json();
                if (schedJson && schedJson.success && schedJson.results) {
                    scheduleData = schedJson.results.nextEpisodeSchedule || null;
                }
            } catch (e) { console.log("Schedule countdown unpopulated."); }

            // 4. FIXED: Fetch characters matching your exact coupled endpoint schema -> results.data
            let characterList = [];
            try {
                const charRes = await fetch(`${baseUrl}/api/character/list/${animeId}`);
                const charJson = await charRes.json();
                if (charJson && charJson.success && charJson.results && Array.isArray(charJson.results.data)) {
                    characterList = charJson.results.data;
                }
            } catch (e) { console.log("Character list not found."); }

            // --- ANILIST API BACKGROUND SYNC BLOCK ---
            let aniData = {};
            const hasValidAniId = baseAnime.anilistId && !isNaN(baseAnime.anilistId);
            const query = `query ($id: Int, $search: String) { Media (id: $id, search: $search, type: ANIME) { id title { romaji english native } bannerImage coverImage { extraLarge } description synonyms format source status averageScore trending genres studios(isMain: true) { nodes { name } } staff(perPage: 12, sort: RELEVANCE) { nodes { name { full } image { large } primaryOccupations } } relations { nodes { id type format status bannerImage coverImage { extraLarge } title { romaji english } } } } }`;

            try {
                const variables = hasValidAniId ? { id: parseInt(baseAnime.anilistId) } : { search: baseAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim() };
                const aniRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables })
                });
                const json = await aniRes.json();
                aniData = json?.data?.Media || {};
            } catch (e) { console.log("AniList network sync bypassed."); }

            // Fallback structural allocations
            const finalTitle = baseAnime.title || aniData.title?.english || aniData.title?.romaji || 'Unknown Title';
            const finalJpTitle = baseAnime.japanese_title || aniData.title?.native || 'N/A';
            const finalDesc = baseAnime.description || aniData.description || 'No description available.';
            const finalBanner = aniData.bannerImage || aniData.coverImage?.extraLarge || baseAnime.poster || 'https://via.placeholder.com/1280x720/111/fff?text=No+Background';

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
                characters: characterList,
                aniList: aniData,
                scheduleCountdown: scheduleData,
                rawPayload: baseAnime
            };

            // Setup UI defaults
            window.app.state.activeInfoTab = 'episodes'; 
            window.app.state.activeMetaTab = 'characters'; 
            window.app.state.epSearchValue = '';
            window.app.state.epRangeFilter = '1-100';
            window.app.state.activeLanguageType = 'sub';

            // Smart progression watch state calculator
            const profile = window.app.state?.activeProfile || null;
            let playBtnText = "Play E01";
            let targetEpisodeSlug = episodesList.length > 0 ? (episodesList[0].slug || "1") : '1';
            let targetEpNum = 1;

            if (profile && profile.uid) {
                const localHistory = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
                if (localHistory) {
                    try {
                        const trackObj = JSON.parse(localHistory); 
                        if (trackObj && trackObj.lastWatchedEp) {
                            targetEpNum = parseInt(trackObj.lastWatchedEp);
                            targetEpisodeSlug = trackObj.lastSlug || String(targetEpNum);

                            if (trackObj.finishedEp === true) {
                                const totalAvailableEps = episodesList.length;
                                if (targetEpNum < totalAvailableEps) {
                                    targetEpNum += 1;
                                    const nextEpObj = episodesList.find(e => (e.num || e.episode_no) == targetEpNum);
                                    targetEpisodeSlug = nextEpObj ? (nextEpObj.slug || nextEpObj.id) : String(targetEpNum);
                                    playBtnText = `Play E${targetEpNum < 10 ? '0' + targetEpNum : targetEpNum}`;
                                } else {
                                    playBtnText = `Replay Last Ep`;
                                }
                            } else {
                                playBtnText = `Resume E${targetEpNum < 10 ? '0' + targetEpNum : targetEpNum}`;
                            }
                        }
                    } catch(e) { console.log("History trackers validation bypassed."); }
                }
            }

            window.app.state.currentAnimePage.smartPlayAction = targetEpisodeSlug;
            window.app.state.currentAnimePage.smartPlayNumber = targetEpNum;
            window.app.state.currentAnimePage.smartPlayText = playBtnText;

            renderAnimeInfoShell();

        } catch (error) {
            console.error("Master Layout Assembly Failed:", error);
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

    const isUpcoming = (raw?.status && raw.status.toString().toLowerCase().includes('upcoming')) || 
                       (ani?.status && ani.status.toString().toLowerCase().includes('not_yet_released'));

    const upcomingBadge = isUpcoming ? `<span class="bg-red-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded shadow-sm uppercase tracking-wider animate-pulse"><i class="fas fa-clock mr-1"></i> Upcoming</span>` : '';
    const trendingBadge = ani && ani.trending ? `<span class="bg-[#F47521]/10 border border-[#F47521]/30 px-2 py-0.5 rounded backdrop-blur-sm">#${ani.trending} Trending</span>` : '';
    
    const scoreVal = (ani && ani.averageScore) ? `${ani.averageScore}%` : (raw && raw.mal ? `${raw.mal}/10` : null);
    const scoreBadge = scoreVal ? `<span class="flex items-center gap-1"><i class="fas fa-star"></i> ${scoreVal} SCORE</span>` : '';

    let recommendationsHtml = '';
    if (raw && raw.recommendations && raw.recommendations.length > 0) {
        raw.recommendations.forEach(rec => {
            recommendationsHtml += `
                <div onclick="window.app.loadInfoPageData('${rec.id}')" class="w-[110px] md:w-[140px] flex-shrink-0 cursor-pointer group snap-start">
                    <div class="w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/5 group-hover:border-[#F47521]/50 shadow-md relative bg-[#111] mb-2 transition-all">
                        <img src="${rec.image || rec.poster}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                    </div>
                    <h5 class="text-white font-bold text-[11px] md:text-xs line-clamp-2 leading-tight group-hover:text-[#F47521] transition-colors">${rec.title}</h5>
                </div>
            `;
        });
    }

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
                            <button onclick="window.app.resolveEpisodeStreamAndRoute('${data.smartPlayAction}', ${data.smartPlayNumber}, '${data.id}')" class="bg-[#F47521] text-white px-8 py-3.5 rounded-lg shadow-md font-black text-xs md:text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-colors flex items-center gap-2">
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

            <div class="w-full max-w-7xl mx-auto px-4 md:px-12 mt-8 flex flex-col gap-8">
                
                <div id="verified-relations-pill-box" class="w-full hidden">
                    <h3 class="text-white text-xs font-black mb-3 uppercase tracking-widest text-gray-400">Seasons & Alternative Media</h3>
                    <div id="relations-horizontal-slider" class="w-full flex gap-3 overflow-x-auto pb-3 hide-scrollbar snap-x"></div>
                </div>

                <div class="flex items-center justify-center w-full max-w-2xl border-b border-white/10 text-xs md:text-sm font-bold uppercase tracking-widest pt-2">
                    <button onclick="window.app.switchInfoTab('episodes')" id="tab-episodes" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Episodes</button>
                    <button onclick="window.app.switchInfoTab('information')" id="tab-information" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Information</button>
                </div>
                
                <div id="dynamic-tab-content-area" class="py-2"></div>

                ${recommendationsHtml !== '' ? `
                <div class="w-full border-t border-white/5 pt-8 mt-4">
                    <h3 class="text-white text-sm md:text-base font-black uppercase tracking-widest text-gray-300 mb-4"><i class="fas fa-heart text-[#F47521] mr-1.5"></i> If You Liked This, Watch These</h3>
                    <div class="w-full flex gap-3.5 overflow-x-auto pb-4 hide-scrollbar snap-x pointer-events-auto">
                        ${recommendationsHtml}
                    </div>
                </div>` : ''}

            </div>
        </div>
    `;

    window.app.renderInfoInlineTabContent();
    injectVerifiedAlternativePills();
    setupDropdownListener();
}

window.app.renderInfoInlineTabContent = () => {
    const activeTab = window.app.state.activeInfoTab;
    if (activeTab === 'information') window.app.components.informationtab();
    else if (activeTab === 'episodes') window.app.components.episodestab();
};

window.app.switchInfoTab = (tabName) => {
    if (window.app.state.activeInfoTab === tabName) return;
    window.app.state.activeInfoTab = tabName;
    document.getElementById('tab-information').className = `flex-1 text-center pb-3 transition-colors ${tabName === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    document.getElementById('tab-episodes').className = `flex-1 text-center pb-3 transition-colors ${tabName === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}`;
    window.app.renderInfoInlineTabContent();
};

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

            const response = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(relTitle)}`);
            const json = await response.json();

            if (json.success && Array.isArray(json.results) && json.results.length > 0) {
                const matchIndex = json.results.find(item => String(item.id).toLowerCase() === String(rel.id).toLowerCase() || String(item.title).toLowerCase() === String(relTitle).toLowerCase());
                const targetApiId = matchIndex ? matchIndex.id : json.results[0].id;

                const bgImage = rel.bannerImage || rel.coverImage?.extraLarge || '';
                const formatBadge = rel.format ? `<span class="bg-[#F47521] text-white text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide uppercase">${rel.format}</span>` : '';
                const statusStr = rel.status ? rel.status.toLowerCase().replace('_', ' ') : '';

                const blockDiv = document.createElement('div');
                blockDiv.className = `relative w-[260px] md:w-[320px] h-20 rounded-xl overflow-hidden border border-white/5 hover:border-[#F47521]/50 cursor-pointer transition-all flex items-center px-4 group shadow-lg flex-shrink-0 snap-start`;
                blockDiv.onclick = () => window.app.loadInfoPageData(targetApiId);
                
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
        } catch (e) { console.log("Alternative mapping failure."); }
    }
    if (validPillsCount > 0 && containerBox) containerBox.classList.remove('hidden');
}

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
    const profile = window.app.state?.activeProfile || null;
    if (!profile || !profile.uid) {
        if (window.app.components.auth) window.app.components.auth();
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


// ============================================================================
// --- EMBEDDED COMPONENT SUB-MODULE 1: INFORMATION TAB VIEW LAYOUT ENGINE ---
// ============================================================================
window.app.components.informationtab = () => {
    const contentArea = document.getElementById('dynamic-tab-content-area');
    if (!contentArea) return;

    const data = window.app.state.currentAnimePage;
    const ani = data.aniList;
    const raw = data.rawPayload;

    const unpackArrayString = (field) => Array.isArray(field) ? field.join(', ') : (field || 'N/A');

    const formatStr = unpackArrayString(raw?.type || ani?.format);
    const statusStr = unpackArrayString(raw?.status || ani?.status?.toLowerCase().replace('_', ' '));
    const airedTimeline = unpackArrayString(raw?.aired);
    const premSeason = unpackArrayString(raw?.premiered);
    const trackDuration = unpackArrayString(raw?.duration);
    const totalEpsCount = unpackArrayString(raw?.episodes || data.episodes?.length);

    const rawStudioStr = ani?.studios?.nodes?.map(s => s.name).join(', ') || unpackArrayString(raw?.studios);
    const studioButtonsHtml = rawStudioStr !== 'N/A' 
        ? rawStudioStr.split(',').map(s => `<button onclick="window.location.href='results.html?producer=${encodeURIComponent(s.trim())}'" class="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white text-[11px] font-bold uppercase hover:bg-[#F47521] hover:text-black transition-colors shadow-sm text-left truncate max-w-full">${s.trim()}</button>`).join('')
        : '<span class="text-white font-medium">N/A</span>';

    const rawProducerStr = unpackArrayString(raw?.producers);
    const producerButtonsHtml = rawProducerStr !== 'N/A'
        ? rawProducerStr.split(',').map(p => `<button onclick="window.location.href='results.html?producer=${encodeURIComponent(p.trim())}'" class="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white text-[11px] font-bold uppercase hover:bg-[#F47521] hover:text-black transition-colors shadow-sm text-left truncate max-w-full">${p.trim()}</button>`).join('')
        : '<span class="text-white font-medium">N/A</span>';

    let synonymsList = [];
    if (ani?.synonyms) synonymsList = [...ani.synonyms];
    if (raw?.animeInfo?.Synonyms) synonymsList.push(raw.animeInfo.Synonyms);
    const uniqueSynonyms = [...new Set(synonymsList)].filter(Boolean);

    const activeMeta = window.app.state.activeMetaTab || 'characters';
    
    // --- FIXED: CHARACTER CARDS UPDATED TO PARSE YOUR EXACT COUPLED DATA SCHEMA ---
    let characterCardsHtml = '';
    if (data.characters && data.characters.length > 0) {
        data.characters.forEach(item => {
            const charObj = item.character || {};
            const primaryVa = (item.voiceActors && item.voiceActors.length > 0) ? item.voiceActors[0] : null;

            // Voice actor element markup block check
            const vaHtml = primaryVa ? `
                <div class="flex items-center gap-1.5 border-l border-white/10 pl-2 ml-auto min-w-0 max-w-[45%]">
                    <div class="text-right min-w-0">
                        <div class="text-[10px] font-bold text-gray-300 truncate leading-tight">${primaryVa.name}</div>
                        <div class="text-[8px] text-[#F47521] tracking-tighter uppercase">JA Seiyuu</div>
                    </div>
                    <img src="${primaryVa.poster || 'https://via.placeholder.com/100/222/fff?text=?'}" class="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0 shadow-md">
                </div>
            ` : '';

            characterCardsHtml += `
                <div class="bg-[#111] p-2 rounded-lg border border-white/5 shadow-inner flex items-center justify-between gap-2 hover:border-white/20 transition-colors w-full">
                    <div class="flex items-center gap-2 min-w-0 max-w-[55%]">
                        <img src="${charObj.poster || 'https://via.placeholder.com/120/222/fff?text=?'}" class="w-9 h-11 rounded object-cover border border-white/10 shrink-0 shadow-md">
                        <div class="min-w-0">
                            <div class="font-black text-white text-[11px] md:text-xs truncate leading-snug">${charObj.name || 'Unknown character'}</div>
                            <div class="text-[9px] text-gray-400 truncate mt-0.5 uppercase tracking-wide font-bold">${charObj.cast || 'Supporting'}</div>
                        </div>
                    </div>
                    ${vaHtml}
                </div>
            `;
        });
    } else { characterCardsHtml = `<div class="col-span-full text-gray-500 text-xs py-2"><i class="fas fa-info-circle mr-1"></i> Character profiles mapping unindexed.</div>`; }

    let staffCardsHtml = '';
    if (ani?.staff?.nodes && ani.staff.nodes.length > 0) {
        ani.staff.nodes.forEach(s => {
            staffCardsHtml += `
                <div class="bg-[#111] p-2.5 rounded-lg border border-white/5 shadow-inner flex items-center gap-3 hover:border-white/20 transition-colors w-full">
                    <img src="${s.image?.large || 'https://via.placeholder.com/150/222/fff?text=?'}" class="w-11 h-11 rounded-full object-cover border border-white/10 shadow-md">
                    <div class="flex-1 min-w-0">
                        <div class="font-black text-white text-xs truncate">${s.name?.full}</div>
                        <div class="text-[10px] text-[#F47521] truncate mt-0.5">${s.primaryOccupations?.[0] || 'Production'}</div>
                    </div>
                </div>
            `;
        });
    } else { staffCardsHtml = `<div class="col-span-full text-gray-500 text-xs py-2">Production staff details unavailable.</div>`; }

    contentArea.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-xs">
            <div class="lg:col-span-1 flex flex-col gap-5 bg-[#0a0a0a] p-5 rounded-xl border border-white/5 shadow-lg h-fit text-xs">
                <h4 class="text-white font-black uppercase tracking-widest text-[#F47521] border-b border-white/5 pb-2">Full Specifications</h4>
                <div class="flex flex-col gap-4">
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Format Type</span><span class="text-white capitalize font-medium">${formatStr}</span></div>
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Current Status</span><span class="text-white capitalize font-medium">${statusStr}</span></div>
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Production Studios</span><div class="flex flex-wrap gap-1.5 w-full">${studioButtonsHtml}</div></div>
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Industrial Producers</span><div class="flex flex-wrap gap-1.5 w-full">${producerButtonsHtml}</div></div>
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Total Units</span><span class="text-white font-medium">${totalEpsCount} Eps</span></div>
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Runtime Length</span><span class="text-white font-medium">${trackDuration}</span></div>
                    <div><span class="text-gray-500 font-bold uppercase tracking-wider block mb-0.5">Season Window</span><span class="text-white uppercase font-medium">${premSeason} (${airedTimeline})</span></div>
                </div>
                ${uniqueSynonyms.length > 0 ? `<div class="pt-4 border-t border-white/5 mt-1"><h5 class="text-gray-500 font-bold uppercase tracking-wider mb-2">Alternative Titles</h5><div class="text-gray-400 leading-relaxed space-y-1 text-[11px] truncate">${uniqueSynonyms.map(syn => `<p>• ${syn}</p>`).join('')}</div></div>` : ''}
            </div>

            <div class="lg:col-span-2 flex flex-col gap-4">
                <div class="flex items-center gap-4 border-b border-white/5 text-[11px] font-black uppercase tracking-wider pb-1">
                    <button onclick="window.app.switchMetaContentTab('characters')" id="subtab-characters" class="pb-2 transition-colors ${activeMeta === 'characters' ? 'text-white border-b border-[#F47521]' : 'text-gray-500 hover:text-white'}">Characters</button>
                    <button onclick="window.app.switchMetaContentTab('staff')" id="subtab-staff" class="pb-2 transition-colors ${activeMeta === 'staff' ? 'text-white border-b border-[#F47521]' : 'text-gray-500 hover:text-white'}">Staff Core</button>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    ${activeMeta === 'characters' ? characterCardsHtml : staffCardsHtml}
                </div>
            </div>
        </div>
    `;
};

window.app.switchMetaContentTab = (metaTarget) => {
    window.app.state.activeMetaTab = metaTarget;
    window.app.components.informationtab();
};


// ============================================================================
// --- EMBEDDED COMPONENT SUB-MODULE 2: EPISODES MATRIX VIEW LAYOUT ENGINE ----
// ============================================================================
window.app.components.episodestab = () => {
    const contentArea = document.getElementById('dynamic-tab-content-area');
    if (!contentArea) return;

    const data = window.app.state.currentAnimePage;
    const ani = data.aniList;
    const raw = data.rawPayload;

    const isUpcoming = (raw?.status && raw.status.toString().toLowerCase().includes('upcoming')) || 
                       (ani?.status && ani.status.toString().toLowerCase().includes('not_yet_released'));

    let scheduleContainerHtml = '';
    if (data.scheduleCountdown) {
        scheduleContainerHtml = `
            <div class="w-full mt-6 bg-[#0a0a0a] border border-white/5 rounded-xl p-4 text-center shadow-lg animate-fade-in max-w-xl mx-auto">
                <span class="text-[#F47521] text-[10px] font-black uppercase tracking-widest block mb-1"><i class="fas fa-broadcast-tower mr-1"></i> Live Broadcast Schedule</span>
                <p class="text-white text-xs font-bold font-mono tracking-wide bg-white/5 border border-white/10 px-4 py-2 rounded inline-block mt-1">${data.scheduleCountdown}</p>
            </div>
        `;
    }

    if (isUpcoming) {
        const expectedDate = raw?.aired || raw?.premiered || "TBA 2026";
        contentArea.innerHTML = `
            <div class="w-full text-center py-16 bg-[#0a0a0a] rounded-xl border border-white/5 p-6 flex flex-col gap-4 max-w-2xl mx-auto shadow-xl animate-fade-in">
                <i class="fas fa-hourglass-start text-4xl text-[#F47521] animate-bounce"></i>
                <h3 class="text-xl font-black text-white tracking-tight uppercase">Upcoming Transmission</h3>
                <p class="text-gray-400 text-xs max-w-md mx-auto leading-relaxed">This series has been successfully indexed on Blaze-X but hasn't broadcasted episodes yet.</p>
                <div class="my-2">
                    <span class="text-gray-600 uppercase font-black text-[10px] tracking-widest block mb-1">Expected Timeline</span>
                    <p class="text-white text-sm font-bold capitalize">${expectedDate}</p>
                </div>
                ${scheduleContainerHtml}
            </div>
        `;
        return;
    }

    let finalEpisodesArray = data.episodes || [];
    window.app.state.currentEpisodesListProcessed = finalEpisodesArray;

    const totalEps = finalEpisodesArray.length;
    let rangeDropdownHtml = '';
    let currentRangeLabel = 'N/A';

    if (totalEps > 0) {
        for (let i = 0; i < totalEps; i += 100) {
            const startNum = i + 1;
            const endNum = Math.min(i + 100, totalEps);
            const val = `${startNum}-${endNum}`;
            const label = `Episodes ${startNum} - ${endNum}`;
            if (!window.app.state.epRangeFilter && i === 0) window.app.state.epRangeFilter = val;
            if (window.app.state.epRangeFilter === val) currentRangeLabel = label;
            rangeDropdownHtml += `<button onclick="window.app.selectDropdownOption('${label}', '${val}')" class="w-full text-left px-4 py-3 text-xs md:text-sm font-bold text-white hover:bg-[#F47521] hover:text-black transition-colors border-b border-white/5 last:border-0">${label}</button>`;
        }
    } else {
        currentRangeLabel = 'No Episodes';
        rangeDropdownHtml = `<div class="px-4 py-3 text-xs text-gray-500">N/A</div>`;
    }

    const currentLang = window.app.state.activeLanguageType || 'sub';

    contentArea.innerHTML = `
        <div class="animate-fade-in flex flex-col gap-5">
            
            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#0a0a0a] p-3 rounded-xl border border-white/5 shadow-md w-full">
                <div class="flex bg-[#111] p-1 border border-white/10 rounded-lg max-w-xs md:w-44 text-[11px] font-black select-none tracking-wider uppercase h-10 shrink-0">
                    <button onclick="window.app.toggleActiveAudioLanguage('sub')" id="lang-btn-sub" class="flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${currentLang === 'sub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}">Sub</button>
                    <button onclick="window.app.toggleActiveAudioLanguage('dub')" id="lang-btn-dub" class="flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${currentLang === 'dub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}">Dub</button>
                </div>

                <div class="relative w-full sm:w-56 shrink-0" id="custom-dropdown-container">
                    <button id="custom-dropdown-btn" onclick="window.app.toggleDropdown()" class="flex items-center justify-between w-full bg-[#111] border border-white/10 text-white text-xs font-bold h-10 px-4 rounded-lg outline-none hover:border-white/30 focus:border-[#F47521] transition-all">
                        <span id="custom-dropdown-selected">${currentRangeLabel}</span>
                        <i id="custom-dropdown-icon" class="fas fa-chevron-down text-gray-400 text-xs transition-transform duration-300"></i>
                    </button>
                    <div id="custom-dropdown-menu" class="absolute left-0 mt-2 w-full bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 hidden overflow-hidden flex flex-col max-h-60 overflow-y-auto hide-scrollbar">
                        ${rangeDropdownHtml}
                    </div>
                </div>

                <div class="relative flex-1 max-w-md w-full">
                    <input type="number" id="episode-search-box" value="${window.app.state.epSearchValue || ''}" onkeyup="window.app.runEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-[#111] border border-white/10 text-white text-xs h-10 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600 transition-colors">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>

            <div id="numeric-episodes-grid" class="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-18 gap-2 w-full"></div>

            ${scheduleContainerHtml}
        </div>
    `;
    
    window.app.renderNumericEpisodeGrid();
};

window.app.toggleActiveAudioLanguage = (langMode) => {
    if (window.app.state.activeLanguageType === langMode) return;
    window.app.state.activeLanguageType = langMode;
    document.getElementById('lang-btn-sub').className = `flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${langMode === 'sub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}`;
    document.getElementById('lang-btn-dub').className = `flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${langMode === 'dub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}`;
    window.app.renderNumericEpisodeGrid();
};

window.app.selectDropdownOption = (label, val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('custom-dropdown-selected').innerText = label;
    window.app.toggleDropdown();
    document.getElementById('episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    window.app.renderNumericEpisodeGrid();
};

window.app.runEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    window.app.renderNumericEpisodeGrid();
};

window.app.renderNumericEpisodeGrid = () => {
    const gridDiv = document.getElementById('numeric-episodes-grid');
    if (!gridDiv) return;

    const data = window.app.state.currentAnimePage;
    const episodesToFilter = window.app.state.currentEpisodesListProcessed || [];
    const searchVal = window.app.state.epSearchValue || '';
    const rangeArray = window.app.state.epRangeFilter ? window.app.state.epRangeFilter.split('-') : [];
    const currentLangMode = window.app.state.activeLanguageType || 'sub';
    
    let episodesToRender = [...episodesToFilter];

    if (searchVal !== '') {
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.num || ep.episode_no;
            return epNumber && epNumber.toString().includes(searchVal);
        });
    } else if (rangeArray.length === 2) {
        const startEpNum = parseInt(rangeArray[0]);
        const endEpNum = parseInt(rangeArray[1]);
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.num || ep.episode_no;
            return epNumber && epNumber >= startEpNum && epNumber <= endEpNum;
        });
    }

    if (episodesToRender.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-xs">No matching audio sources found.</div>`;
        return;
    }

    const profile = window.app.state?.activeProfile || null;
    let localHistoryMap = null;
    if (profile && profile.uid) {
        const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${data.id}`);
        if (stored) { try { localHistoryMap = JSON.parse(stored); } catch(e){} }
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const epNumber = ep.num || ep.episode_no;
        const targetEpisodeSlugId = ep.slug || ep.id || String(epNumber); 
        
        const isFillerEpisode = ep.isFiller === true;
        const fillerIconDot = isFillerEpisode ? `<div class="absolute top-0.5 right-0.5 w-1 h-1 bg-red-500 rounded-full"></div>` : '';
        const isSupportedByLang = (currentLangMode === 'sub' && ep.isSub !== false) || 
                                  (currentLangMode === 'dub' && ep.isDub === true);

        let isAlreadyWatched = false;
        if (localHistoryMap && localHistoryMap.watchedHistoryList) {
            isAlreadyWatched = localHistoryMap.watchedHistoryList.includes(parseInt(epNumber));
        } else if (localHistoryMap && localHistoryMap.lastWatchedEp) {
            isAlreadyWatched = parseInt(epNumber) <= parseInt(localHistoryMap.lastWatchedEp);
        }

        let buttonStyleClass = '';
        let interactiveActionAttr = '';
        let conditionalLabelBadge = '';

        if (isSupportedByLang) {
            interactiveActionAttr = `onclick="window.app.resolveEpisodeStreamAndRoute('${targetEpisodeSlugId}', ${epNumber}, '${data.id}')"`;
            if (isAlreadyWatched) {
                buttonStyleClass = 'border-[#F47521]/40 text-[#F47521] bg-[#F47521]/5 cursor-pointer hover:bg-[#F47521] hover:text-black font-black text-base shadow-sm';
            } else {
                buttonStyleClass = isFillerEpisode 
                    ? 'border-red-500/20 text-gray-300 hover:bg-red-500 hover:text-white hover:border-red-500 cursor-pointer font-black text-base shadow-sm' 
                    : 'border-white/5 text-gray-300 hover:bg-[#F47521] hover:text-black hover:border-[#F47521] cursor-pointer font-black text-base shadow-sm';
            }
        } else {
            interactiveActionAttr = 'disabled';
            buttonStyleClass = 'opacity-20 border-dashed border-white/5 text-gray-600 cursor-not-allowed bg-black/40 font-black text-base';
            conditionalLabelBadge = `<span class="absolute bottom-0.5 text-[7px] font-black text-gray-600 tracking-tighter uppercase">Sub Only</span>`;
        }

        gridHtml += `
            <button ${interactiveActionAttr} class="relative w-full aspect-square flex flex-col items-center justify-center rounded border transition-all duration-150 p-1 group bg-white/5 ${buttonStyleClass}">
                <span class="${!isSupportedByLang ? '-translate-y-1' : ''}">${epNumber}</span>
                ${fillerIconDot}
                ${conditionalLabelBadge}
            </button>
        `;
    });
    gridDiv.innerHTML = gridHtml;
};

window.app.resolveEpisodeStreamAndRoute = async (episodeSlug, episodeNumber, animeId) => {
    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const targetServer = 'hd-1';
        const targetType = window.app.state.activeLanguageType || 'sub';

        const streamUrl = `${baseUrl}/api/stream?id=${encodeURIComponent(episodeSlug)}&server=${targetServer}&type=${targetType}`;
        const response = await fetch(streamUrl);
        const json = await response.json();

        let verifiedStreamData = null;
        if (json && json.success && json.results?.streamingLink) {
            verifiedStreamData = json.results;
        } else {
            const fallbackUrl = `${baseUrl}/api/stream/fallback?id=${encodeURIComponent(episodeSlug)}&server=${targetServer}&type=${targetType}`;
            const fbResponse = await fetch(fallbackUrl);
            const fbJson = await fbResponse.json();
            if (fbJson && fbJson.success && fbJson.results?.streamingLink) verifiedStreamData = fbJson.results;
        }

        if (!verifiedStreamData) {
            alert("Sources are caching on host mirrors. Try another server!");
            return;
        }

        window.app.state.resolvedStreamManifest = verifiedStreamData;

        const profile = window.app.state?.activeProfile || null;
        if (profile && profile.uid) {
            let mockProgressHistory = { lastWatchedEp: episodeNumber, lastSlug: episodeSlug, finishedEp: false, watchedHistoryList: [episodeNumber] };
            const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
            if (stored) {
                try {
                    let parsed = JSON.parse(stored);
                    parsed.lastWatchedEp = episodeNumber;
                    parsed.lastSlug = episodeSlug;
                    if(!parsed.watchedHistoryList) parsed.watchedHistoryList = [];
                    if(!parsed.watchedHistoryList.includes(episodeNumber)) parsed.watchedHistoryList.push(episodeNumber);
                    mockProgressHistory = parsed;
                } catch(e){}
            }
            localStorage.setItem(`blazex_progress_${profile.uid}_${animeId}`, JSON.stringify(mockProgressHistory));
        }

        window.location.href = `play.html?id=${encodeURIComponent(episodeSlug)}&anime=${animeId}&ep=${episodeNumber}&type=${targetType}`;
    } catch (error) {
        window.location.href = `play.html?id=${encodeURIComponent(episodeSlug)}&anime=${animeId}&ep=${episodeNumber}&type=${window.app.state.activeLanguageType || 'sub'}`;
    }
};
