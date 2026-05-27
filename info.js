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

    // Master Trigger function to navigate and load data without full-page reloads
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

            // 2. Fetch corresponding episode lists safely using your API array schema rules
            let episodesList = [];
            try {
                const epsResponse = await fetch(`${baseUrl}/api/episodes/${animeId}`);
                const epsJson = await epsResponse.json();
                
                if (epsJson && epsJson.success && Array.isArray(epsJson.results)) {
                    const payloadContainer = epsJson.results[0];
                    if (payloadContainer && Array.isArray(payloadContainer.episodes)) {
                        episodesList = payloadContainer.episodes;
                    }
                } else if (epsJson && epsJson.success && epsJson.results?.episodes) {
                    episodesList = epsJson.results.episodes;
                }
            } catch (e) {
                console.log("No matching episodes payload layout detected.");
            }

            // 3. Fetch Schedule Countdown Data if available
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

            const profile = window.app.state && window.app.state.activeProfile ? window.app.state.activeProfile : null;
            let playBtnText = "Play E01";
            let targetEpisodeId = episodesList.length > 0 ? (episodesList[0].id || "1") : '1';
            
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
            console.error("Info System Breakdown Handled Securely:", error);
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

    // --- CRUNCH RECOMMENDATIONS GENERATION MAP ---
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

            <div class="w-full max-w-7xl mx-auto px-4 md:px-12 mt-8 flex flex-col gap-8">
                
                <div id="verified-relations-pill-box" class="w-full hidden">
                    <h3 class="text-white text-xs font-black mb-3 uppercase tracking-widest text-gray-400">Seasons & Alternative Media</h3>
                    <div id="relations-horizontal-slider" class="w-full flex gap-3 overflow-x-auto pb-3 hide-scrollbar snap-x"></div>
                </div>

                <div class="flex items-center justify-center w-full max-w-2xl border-b border-white/10 text-xs md:text-sm font-bold uppercase tracking-widest pt-2">
                    <button onclick="window.app.switchInfoTab('information')" id="tab-information" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'information' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Information</button>
                    <button onclick="window.app.switchInfoTab('episodes')" id="tab-episodes" class="flex-1 text-center pb-3 transition-colors ${window.app.state.activeInfoTab === 'episodes' ? 'text-white border-b-2 border-[#F47521]' : 'text-gray-500 hover:text-white'}">Episodes</button>
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

// INLINE ROUTER: Loads tab view codes directly into page container
window.app.renderInfoInlineTabContent = () => {
    const activeTab = window.app.state.activeInfoTab;
    if (activeTab === 'information') {
        if (window.app.components.informationtab) window.app.components.informationtab();
    } else if (activeTab === 'episodes') {
        if (window.app.components.episodestab) window.app.components.episodestab();
    }
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
        } catch (e) {
            console.log("Alternative mapping failure.");
        }
    }

    if (validPillsCount > 0 && containerBox) {
        containerBox.classList.remove('hidden');
    }
}

window.app.searchAndRouteToAnime = async (titleKeyword) => {
    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const response = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(titleKeyword)}`);
        const json = await response.json();
        
        if (json.success && Array.isArray(json.results) && json.results.length > 0) {
            window.app.loadInfoPageData(json.results[0].id);
        } else {
            if (window.app.showCustomAlert) window.app.showCustomAlert("This season is not available on streaming indexes yet.", "error");
            else alert("This season is not available yet.");
        }
    } catch(e) {
        console.error(e);
    }
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

window.app.handlePlayClick = async (episodeUrlId, animeId) => {
    try {
        if (window.app.state && window.app.state.activeProfile && window.app.state.activeProfile.uid) {
            window.location.href = `play.html?id=${encodeURIComponent(episodeUrlId)}&anime=${animeId}`;
            return;
        }

        const randomNum = Math.floor(Math.random() * 90000) + 10000;
        const generatedName = `Guest-${randomNum}`;
        const generatedPfp = `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`; 
        const guestUid = 'anon_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

        const newProfile = {
            uid: guestUid,
            name: generatedName,
            email: "Guest Account",
            pfp: generatedPfp,
            history: [],
            watchlist: [],
            createdAt: new Date().toISOString()
        };

        window.app.state.activeProfile = newProfile;
        localStorage.setItem('blazex_user_profile', JSON.stringify(newProfile));

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userRef = firestore.doc(window.app.db, "users", guestUid);
            await firestore.setDoc(userRef, newProfile);
        } catch (dbError) {
            console.log("DB save failed: ", dbError);
        }

        window.location.href = `play.html?id=${encodeURIComponent(episodeUrlId)}&anime=${animeId}`;

    } catch (err) {
        console.error("Play redirect error:", err);
        window.location.href = `play.html?id=${encodeURIComponent(episodeUrlId)}&anime=${animeId}`;
    }
};
