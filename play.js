// play.js

window.app.components.play = async () => {
    const workspace = document.getElementById('player-workspace');
    if (!workspace) return;

    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id'); 
    const animeId = urlParams.get('anime'); 
    const currentEpNum = urlParams.get('ep') || '1';
    let currentAudioType = urlParams.get('type');

    if (!episodeId || !animeId) {
        workspace.innerHTML = `
            <div class="w-full text-center py-20 mt-10">
                <i class="fas fa-video-slash text-5xl text-gray-600 mb-4"></i>
                <h2 class="text-white font-black text-xl tracking-wider uppercase mb-2">Stream Offline</h2>
                <p class="text-gray-400 text-xs">Invalid streaming parameters provided.</p>
                <button onclick="window.location.href='index.html'" class="mt-6 text-xs text-white bg-white/10 px-6 py-2 rounded hover:bg-[#F47521]">Go Home</button>
            </div>
        `;
        return;
    }

    const profile = window.app.state?.activeProfile || null;

    // 2. Cloud-Synced Preferences Check
    let autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
    let autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

    // Override with DB preferences if logged in
    if (profile && profile.preferences) {
        if (profile.preferences.skipIntro !== undefined) autoSkipIntro = profile.preferences.skipIntro;
        if (profile.preferences.skipOutro !== undefined) autoSkipOutro = profile.preferences.skipOutro;
        if (!currentAudioType && profile.preferences.audioType) currentAudioType = profile.preferences.audioType;
    }
    
    // Default fallback
    if (!currentAudioType) currentAudioType = 'sub';

    // 3. Initialize Core State
    window.app.state.epSearchValue = '';
    window.app.state.epRangeFilter = null;
    window.app.state.activeLanguageType = currentAudioType;
    window.app.state.currentPlayingEpNum = parseInt(currentEpNum);

    // Watch History DB & Local Sync
    if (profile && profile.uid) {
        let mockProgressHistory = { 
            lastWatchedEp: currentEpNum, 
            lastSlug: episodeId, 
            finishedEp: false, 
            watchedHistoryList: [parseInt(currentEpNum)] 
        };
        const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
        if (stored) {
            try {
                let parsed = JSON.parse(stored);
                parsed.lastWatchedEp = currentEpNum;
                parsed.lastSlug = episodeId;
                if(!parsed.watchedHistoryList) parsed.watchedHistoryList = [];
                if(!parsed.watchedHistoryList.includes(parseInt(currentEpNum))) {
                    parsed.watchedHistoryList.push(parseInt(currentEpNum));
                }
                mockProgressHistory = parsed;
            } catch(e){}
        }
        localStorage.setItem(`blazex_progress_${profile.uid}_${animeId}`, JSON.stringify(mockProgressHistory));
    }

    // 4. DYNAMIC UI SKELETON GENERATION
    workspace.innerHTML = `
        <div class="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in opacity-0 transition-opacity duration-500" id="play-content-wrapper">
            
            <!-- VIDEO PLAYER MOUNT POINT (Loads player.js) -->
            <div id="blazex-player-root" class="w-full aspect-video md:aspect-[21/9] bg-black rounded-xl shadow-lg border border-white/5 overflow-hidden flex flex-col items-center justify-center relative group">
                <div class="tk-loader scale-125 z-0">
                    <div class="tk-dot tk-dot-1"></div>
                    <div class="tk-dot tk-dot-2"></div>
                </div>
                <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-6">Loading Player Engine...</p>
            </div>

            <!-- PLAYER UTILITY BAR (Skip Intro/Outro & Server/Lang Toggles) -->
            <div class="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0a0a0a] p-3 rounded-lg border border-white/5">
                
                <div class="flex items-center gap-3">
                    <span class="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-black px-2 py-1 rounded border border-white/5">Audio</span>
                    <div class="flex bg-[#111] p-1 border border-white/10 rounded-md text-[10px] font-black select-none tracking-wider uppercase">
                        <button onclick="window.app.changeCurrentPlayerAudio('sub')" class="px-3 py-1.5 rounded transition-all ${currentAudioType === 'sub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Sub</button>
                        <button onclick="window.app.changeCurrentPlayerAudio('dub')" class="px-3 py-1.5 rounded transition-all ${currentAudioType === 'dub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Dub</button>
                    </div>
                </div>

                <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" id="toggle-skip-intro" class="hidden" onchange="window.app.toggleAutoSkip('intro')" ${autoSkipIntro ? 'checked' : ''}>
                        <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg">
                            <div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div>
                        </div>
                        Auto-Skip Intro
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" id="toggle-skip-outro" class="hidden" onchange="window.app.toggleAutoSkip('outro')" ${autoSkipOutro ? 'checked' : ''}>
                        <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg">
                            <div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div>
                        </div>
                        Auto-Skip Outro
                    </label>
                </div>
            </div>

            <!-- EPISODE METADATA & ACTIONS BAR -->
            <div class="flex flex-col md:flex-row items-start md:items-start justify-between gap-6 py-2 border-b border-white/5 pb-6">
                
                <!-- Anime & Episode Info Block -->
                <div class="flex-1 flex gap-4 w-full">
                    <div class="w-20 md:w-28 flex-shrink-0 rounded-lg overflow-hidden shadow-md border border-white/10 hidden sm:block">
                        <img id="play-anime-poster" src="https://via.placeholder.com/200x300/111/fff?text=..." class="w-full h-full object-cover aspect-[2/3] animate-pulse">
                    </div>
                    <div class="flex-1 flex flex-col justify-center min-w-0">
                        <p id="current-anime-title" class="text-[10px] md:text-xs text-[#F47521] font-bold uppercase tracking-widest mb-1 truncate">Loading Anime Data...</p>
                        <h1 id="current-ep-title" class="text-lg md:text-2xl font-black text-white tracking-tight leading-tight truncate w-full">Episode ${currentEpNum}</h1>
                        <p id="current-anime-desc" class="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed max-w-2xl"></p>
                        
                        <div id="play-schedule-container" class="mt-3 hidden"></div>
                    </div>
                </div>
                
                <!-- Interaction Buttons -->
                <div class="flex flex-row md:flex-col lg:flex-row items-center justify-start md:justify-end gap-2 shrink-0 w-full md:w-auto">
                    <div class="flex items-center gap-2">
                        <button onclick="window.app.handleReaction('like')" id="btn-like" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-[#F47521] px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-400">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <button onclick="window.app.handleReaction('dislike')" id="btn-dislike" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-white/40 px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-400">
                            <i class="fas fa-thumbs-down"></i>
                        </button>
                    </div>
                    <button onclick="if(window.app.components.comment) window.app.components.comment()" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-[#F47521] hover:text-black border border-white/10 px-5 py-2 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm">
                        <i class="fas fa-comment-alt"></i> Discuss
                    </button>
                </div>
            </div>

            <!-- DYNAMIC EPISODES MATRIX GRID (Clean Style) -->
            <div class="w-full flex flex-col gap-4 mt-2 bg-[#0a0a0a] p-4 md:p-5 rounded-xl border border-white/5 shadow-md">
                <h3 class="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-2"><i class="fas fa-list text-[#F47521]"></i> Episodes Vault</h3>
                <div id="episodes-grid-mount-point"></div>
            </div>

            <!-- COMMENTS SECTION MOUNT POINT -->
            <div class="w-full mt-4">
                <h3 class="text-white text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-comments text-[#F47521]"></i> Community Discussion</h3>
                <div id="comments-section-root" class="min-h-[200px] flex items-center justify-center bg-[#0a0a0a] rounded-xl border border-white/5 shadow-md">
                    <div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                </div>
            </div>

        </div>
    `;

    // Apply custom styling dynamically for toggles
    const style = document.createElement('style');
    style.innerHTML = `
        input:checked + .toggle-bg { background-color: #F47521; border-color: #F47521; }
        input:checked + .toggle-bg .toggle-dot { transform: translateX(14px); background-color: black; }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        const wrapper = document.getElementById('play-content-wrapper');
        if (wrapper) wrapper.classList.remove('opacity-0');
    }, 50);

    // 5. FETCH ANIME DATA & EPISODES PROPERLY
    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        let episodesList = [];
        let baseAnime = {};
        let aniData = {};

        // A. Fetch Info (API)
        try {
            const infoResponse = await fetch(`${baseUrl}/api/info?id=${animeId}`);
            const infoJson = await infoResponse.json();
            if (infoJson && infoJson.success && infoJson.data) baseAnime = infoJson.data;
        } catch(e) { console.error("Info fetch failed."); }

        // B. Fetch AniList Metadata for Schedule & High-Res Poster
        try {
            const hasValidAniId = baseAnime.anilistId && !isNaN(baseAnime.anilistId);
            const query = `query ($id: Int, $search: String) { 
                Media (id: $id, search: $search, type: ANIME) { 
                    id title { romaji english native } description coverImage { extraLarge }
                    nextAiringEpisode { airingAt timeUntilAiring episode }
                } 
            }`;
            const variables = hasValidAniId ? { id: parseInt(baseAnime.anilistId) } : { search: (baseAnime.title || animeId).replace(/\(Dub\)|\(Sub\)/gi, '').trim() };
            const aniRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables })
            });
            const json = await aniRes.json();
            aniData = json?.data?.Media || {};
        } catch (e) { console.log("AniList sync bypassed."); }

        // C. Fetch Episode List
        try {
            const epsResponse = await fetch(`${baseUrl}/api/episodes/${animeId}`);
            const epsJson = await epsResponse.json();
            if (epsJson && epsJson.success && Array.isArray(epsJson.data)) {
                episodesList = epsJson.data;
            } else if (epsJson && epsJson.success && epsJson.results && Array.isArray(epsJson.results.episodes)) {
                episodesList = epsJson.results.episodes;
            }
        } catch(e) { console.error("Episode list fetch failed."); }

        // Update Header UI Meta Data
        const finalTitle = baseAnime.title || aniData.title?.english || aniData.title?.romaji || animeId.replace(/-/g, ' ').toUpperCase();
        const finalDesc = (baseAnime.description || aniData.description || 'No description available.').replace(/<[^>]*>?/gm, '');
        const finalPoster = aniData.coverImage?.extraLarge || baseAnime.poster || 'https://via.placeholder.com/800x1200/111/fff?text=Poster';

        document.getElementById('current-anime-title').innerText = finalTitle;
        document.getElementById('current-anime-desc').innerText = finalDesc;
        
        const posterImg = document.getElementById('play-anime-poster');
        if(posterImg) {
            posterImg.src = finalPoster;
            posterImg.classList.remove('animate-pulse');
        }

        // Parse Next Airing Episode
        if (aniData.nextAiringEpisode) {
            const timeRaw = aniData.nextAiringEpisode.timeUntilAiring;
            const days = Math.floor(timeRaw / (3600*24));
            const hours = Math.floor(timeRaw % (3600*24) / 3600);
            const scheduleHtml = `
                <div class="inline-flex items-center gap-2 bg-[#F47521]/10 border border-[#F47521]/30 text-[#F47521] px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest mt-2">
                    <i class="fas fa-broadcast-tower"></i> Ep ${aniData.nextAiringEpisode.episode} in ${days}d ${hours}h
                </div>
            `;
            const schedContainer = document.getElementById('play-schedule-container');
            if(schedContainer) {
                schedContainer.innerHTML = scheduleHtml;
                schedContainer.classList.remove('hidden');
            }
        }

        // Set Episode Specific Title
        if (episodesList && episodesList.length > 0) {
            const currentEpObj = episodesList.find(e => (e.num || e.episode_no) == currentEpNum);
            const epTitleEl = document.getElementById('current-ep-title');
            if (currentEpObj && epTitleEl) {
                const titleStr = currentEpObj.title ? currentEpObj.title : `Episode ${currentEpNum}`;
                epTitleEl.innerText = `E${currentEpNum}: ${titleStr}`;
            }
        }

        // Initialize Like/Dislike DB States
        if (profile && profile.likedAnime && profile.likedAnime.includes(animeId)) {
            window.app.handleReactionUI('like');
        } else if (profile && profile.dislikedAnime && profile.dislikedAnime.includes(animeId)) {
            window.app.handleReactionUI('dislike');
        }

        // Setup global episodes data state
        window.app.state.currentEpisodesListProcessed = episodesList;
        window.app.state.currentAnimePage = { id: animeId };

        // Render the Episodes Grid Engine
        window.app.renderPlayEpisodesUI();

        // 6. INITIALIZE EXTERNAL COMPONENTS
        if (window.app.components.player) window.app.components.player(); 
        if (window.app.components.commentsss) window.app.components.commentsss();

    } catch (err) {
        console.error("Failed to compile player environment:", err);
    }
};

// ==========================================
// --- CLOUD-SYNCED PLAYER ACTIONS ---
// ==========================================

window.app.syncPreferencesToDB = async (updatesObject) => {
    const profile = window.app.state?.activeProfile || null;
    if (!profile || !profile.uid || profile.uid.startsWith('anon_')) return;

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        
        // Ensure preferences object exists locally
        if(!profile.preferences) profile.preferences = {};
        Object.assign(profile.preferences, updatesObject);
        localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

        await firestore.setDoc(userRef, { preferences: updatesObject }, { merge: true });
    } catch (error) { console.log("Silent cloud pref sync dropped."); }
};

window.app.toggleAutoSkip = (type) => {
    const isChecked = document.getElementById(`toggle-skip-${type}`).checked;
    localStorage.setItem(`blazex_autoskip_${type}`, isChecked ? 'true' : 'false');
    
    // Cloud Sync
    const prefKey = type === 'intro' ? 'skipIntro' : 'skipOutro';
    window.app.syncPreferencesToDB({ [prefKey]: isChecked });
};

window.app.changeCurrentPlayerAudio = (type) => {
    localStorage.setItem('blazex_audio', type);
    window.app.syncPreferencesToDB({ audioType: type });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type') === type) return;
    urlParams.set('type', type);
    window.location.search = urlParams.toString();
};

window.app.handleReactionUI = (type) => {
    const likeBtn = document.getElementById('btn-like');
    const dislikeBtn = document.getElementById('btn-dislike');
    
    if (type === 'like') {
        likeBtn.classList.add('text-[#F47521]', 'border-[#F47521]');
        dislikeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    } else if (type === 'dislike') {
        dislikeBtn.classList.add('text-[#F47521]', 'border-[#F47521]');
        likeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    } else {
        likeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
        dislikeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    }
};

window.app.handleReaction = async (type) => {
    const profile = window.app.state?.activeProfile || null;
    if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
        if(window.app.components.auth) window.app.components.auth();
        return;
    }

    const animeId = window.app.state.currentAnimePage.id;
    if(!profile.likedAnime) profile.likedAnime = [];
    if(!profile.dislikedAnime) profile.dislikedAnime = [];

    // Toggle Logic
    if (type === 'like') {
        if (profile.likedAnime.includes(animeId)) {
            profile.likedAnime = profile.likedAnime.filter(id => id !== animeId);
            window.app.handleReactionUI('none');
        } else {
            profile.likedAnime.push(animeId);
            profile.dislikedAnime = profile.dislikedAnime.filter(id => id !== animeId);
            window.app.handleReactionUI('like');
        }
    } else if (type === 'dislike') {
        if (profile.dislikedAnime.includes(animeId)) {
            profile.dislikedAnime = profile.dislikedAnime.filter(id => id !== animeId);
            window.app.handleReactionUI('none');
        } else {
            profile.dislikedAnime.push(animeId);
            profile.likedAnime = profile.likedAnime.filter(id => id !== animeId);
            window.app.handleReactionUI('dislike');
        }
    }

    localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

    // Cloud Sync
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { 
            likedAnime: profile.likedAnime,
            dislikedAnime: profile.dislikedAnime 
        });
    } catch (e) { console.log("Reaction sync dropped."); }
};

// ==========================================
// --- REPLICATED EPISODES GRID ENGINE ---
// ==========================================

window.app.renderPlayEpisodesUI = () => {
    const mountPoint = document.getElementById('episodes-grid-mount-point');
    if (!mountPoint) return;

    const episodesList = window.app.state.currentEpisodesListProcessed || [];
    const totalEps = episodesList.length;

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
            rangeDropdownHtml += `<button onclick="window.app.selectPlayDropdownOption('${label}', '${val}')" class="w-full text-left px-4 py-3 text-xs md:text-sm font-bold text-white hover:bg-[#F47521] hover:text-black transition-colors border-b border-white/5 last:border-0">${label}</button>`;
        }
    } else {
        currentRangeLabel = 'No Episodes Found';
        rangeDropdownHtml = `<div class="px-4 py-3 text-xs text-gray-500">N/A</div>`;
    }

    const currentLang = window.app.state.activeLanguageType || 'sub';

    mountPoint.innerHTML = `
        <div class="flex flex-col gap-4">
            <!-- Grid Filters -->
            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#111] p-2.5 rounded-xl border border-white/5">
                
                <div class="flex bg-black p-1 border border-white/10 rounded-lg max-w-xs md:w-44 text-[11px] font-black select-none tracking-wider uppercase h-10 shrink-0">
                    <button onclick="window.app.togglePlayGridAudio('sub')" id="play-lang-btn-sub" class="flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${currentLang === 'sub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}">Sub</button>
                    <button onclick="window.app.togglePlayGridAudio('dub')" id="play-lang-btn-dub" class="flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${currentLang === 'dub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}">Dub</button>
                </div>

                <div class="relative w-full sm:w-56 shrink-0" id="play-dropdown-container">
                    <button id="play-dropdown-btn" onclick="window.app.togglePlayDropdown()" class="flex items-center justify-between w-full bg-black border border-white/10 text-white text-xs font-bold h-10 px-4 rounded-lg outline-none hover:border-white/30 focus:border-[#F47521] transition-all">
                        <span id="play-dropdown-selected">${currentRangeLabel}</span>
                        <i id="play-dropdown-icon" class="fas fa-chevron-down text-gray-400 text-xs transition-transform duration-300"></i>
                    </button>
                    <div id="play-dropdown-menu" class="absolute left-0 mt-2 w-full bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 hidden overflow-hidden flex flex-col max-h-60 overflow-y-auto hide-scrollbar">
                        ${rangeDropdownHtml}
                    </div>
                </div>

                <div class="relative flex-1 max-w-md w-full">
                    <input type="number" id="play-episode-search-box" value="${window.app.state.epSearchValue || ''}" onkeyup="window.app.runPlayEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-black border border-white/10 text-white text-xs h-10 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600 transition-colors">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>

            <!-- Grid Numbers -->
            <div id="play-numeric-episodes-grid" class="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-2 w-full max-h-[350px] overflow-y-auto hide-scrollbar pr-1 pb-2"></div>
        </div>
    `;

    window.app.renderPlayGridItems();
};

window.app.togglePlayDropdown = () => {
    const menu = document.getElementById('play-dropdown-menu');
    const icon = document.getElementById('play-dropdown-icon');
    if (!menu) return;
    if(menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
};

window.app.selectPlayDropdownOption = (label, val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('play-dropdown-selected').innerText = label;
    window.app.togglePlayDropdown();
    document.getElementById('play-episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    window.app.renderPlayGridItems();
};

window.app.runPlayEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    window.app.renderPlayGridItems();
};

window.app.togglePlayGridAudio = (langMode) => {
    if (window.app.state.activeLanguageType === langMode) return;
    window.app.state.activeLanguageType = langMode;
    document.getElementById('play-lang-btn-sub').className = `flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${langMode === 'sub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}`;
    document.getElementById('play-lang-btn-dub').className = `flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${langMode === 'dub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}`;
    window.app.renderPlayGridItems();
};

window.app.renderPlayGridItems = () => {
    const gridDiv = document.getElementById('play-numeric-episodes-grid');
    if (!gridDiv) return;

    const animeId = window.app.state.currentAnimePage.id;
    const episodesToFilter = window.app.state.currentEpisodesListProcessed || [];
    const searchVal = window.app.state.epSearchValue || '';
    const rangeArray = window.app.state.epRangeFilter ? window.app.state.epRangeFilter.split('-') : [];
    const currentLangMode = window.app.state.activeLanguageType || 'sub';
    const currentlyPlayingEp = window.app.state.currentPlayingEpNum;
    
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
        gridDiv.innerHTML = `<div class="col-span-full text-center py-6 text-gray-500 text-xs">No matching audio sources found.</div>`;
        return;
    }

    const profile = window.app.state?.activeProfile || null;
    let localHistoryMap = null;
    if (profile && profile.uid) {
        const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
        if (stored) { try { localHistoryMap = JSON.parse(stored); } catch(e){} }
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const epNumber = ep.num || ep.episode_no;
        const targetEpisodeSlugId = ep.slug || ep.id || String(epNumber); 
        
        const isFillerEpisode = ep.isFiller === true;
        const fillerIconDot = isFillerEpisode ? `<div class="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></div>` : '';
        const isSupportedByLang = (currentLangMode === 'sub' && ep.isSub !== false) || 
                                  (currentLangMode === 'dub' && ep.isDub === true);

        let isAlreadyWatched = false;
        if (localHistoryMap && localHistoryMap.watchedHistoryList) {
            isAlreadyWatched = localHistoryMap.watchedHistoryList.includes(parseInt(epNumber));
        } else if (localHistoryMap && localHistoryMap.lastWatchedEp) {
            isAlreadyWatched = parseInt(epNumber) < parseInt(localHistoryMap.lastWatchedEp);
        }

        const isCurrentlyPlaying = (parseInt(epNumber) === currentlyPlayingEp);

        let buttonStyleClass = '';
        let conditionalLabelBadge = '';
        let interactiveActionAttr = '';

        if (isSupportedByLang) {
            interactiveActionAttr = `onclick="window.location.href='play.html?id=${encodeURIComponent(targetEpisodeSlugId)}&anime=${animeId}&ep=${epNumber}&type=${currentLangMode}'"`;
            
            if (isCurrentlyPlaying) {
                // Flat, non-glowing solid orange for active state
                buttonStyleClass = 'border-[#F47521] text-black bg-[#F47521] font-black text-base z-10';
            } else if (isAlreadyWatched) {
                buttonStyleClass = 'border-[#F47521]/30 text-[#F47521] bg-[#F47521]/5 hover:bg-[#F47521] hover:text-black font-black text-base transition-colors';
            } else {
                buttonStyleClass = isFillerEpisode 
                    ? 'border-red-500/30 text-gray-300 hover:bg-red-500 hover:text-white hover:border-red-500 font-black text-base transition-colors bg-red-500/5' 
                    : 'border-white/10 bg-[#111] text-gray-300 hover:bg-[#F47521] hover:text-black hover:border-[#F47521] font-black text-base transition-colors shadow-sm';
            }
        } else {
            interactiveActionAttr = 'disabled';
            buttonStyleClass = 'opacity-20 border-dashed border-white/5 text-gray-600 bg-black/40 font-black text-base cursor-not-allowed';
            conditionalLabelBadge = `<span class="absolute bottom-0.5 text-[7px] font-black text-gray-600 tracking-tighter uppercase">Sub Only</span>`;
        }

        gridHtml += `
            <button ${interactiveActionAttr} class="relative w-full aspect-square flex flex-col items-center justify-center rounded border p-1 group ${buttonStyleClass}">
                <span class="${!isSupportedByLang ? '-translate-y-1' : ''}">${epNumber}</span>
                ${fillerIconDot}
                ${conditionalLabelBadge}
            </button>
        `;
    });
    gridDiv.innerHTML = gridHtml;

    setTimeout(() => {
        const activeTile = gridDiv.querySelector('.bg-\\[\\#F47521\\]');
        if (activeTile) activeTile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('play-dropdown-menu');
    const btn = document.getElementById('play-dropdown-btn');
    if (menu && !menu.classList.contains('hidden')) {
        if (btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
            document.getElementById('play-dropdown-icon').style.transform = 'rotate(0deg)';
        }
    }
});

// Immediately invoke play engine initialization
window.app.components.play();
