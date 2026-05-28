// play.js

window.app.components.play = async () => {
    const workspace = document.getElementById('player-workspace');
    if (!workspace) return;

    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id'); // e.g., frieren-beyond-journeys-end-18542?ep=107257
    const animeId = urlParams.get('anime'); // e.g., frieren-beyond-journeys-end-18542
    const currentEpNum = urlParams.get('ep') || '1';
    const currentAudioType = urlParams.get('type') || 'sub';

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

    // 2. Initialize Core State
    window.app.state.epSearchValue = '';
    window.app.state.epRangeFilter = null;
    window.app.state.activeLanguageType = currentAudioType;
    window.app.state.currentPlayingEpNum = parseInt(currentEpNum);

    // Save initial watch history locally
    const profile = window.app.state?.activeProfile || null;
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

    // Default Skip Settings (Loaded from LocalStorage)
    const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
    const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

    // 3. DYNAMIC UI SKELETON GENERATION
    workspace.innerHTML = `
        <div class="w-full flex flex-col gap-5 animate-fade-in opacity-0 transition-opacity duration-500" id="play-content-wrapper">
            
            <!-- VIDEO PLAYER MOUNT POINT (Loads player.js) -->
            <div id="blazex-player-root" class="w-full aspect-video md:aspect-[21/9] bg-black rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden flex flex-col items-center justify-center relative group">
                <div class="tk-loader scale-125 z-0">
                    <div class="tk-dot tk-dot-1"></div>
                    <div class="tk-dot tk-dot-2"></div>
                </div>
                <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-6">Loading Player Engine...</p>
            </div>

            <!-- PLAYER UTILITY BAR (Skip Intro/Outro & Server/Lang Toggles) -->
            <div class="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0a0a0a] p-3 rounded-lg border border-white/5">
                
                <!-- Current Episode Specific Lang Selector -->
                <div class="flex items-center gap-3">
                    <span class="text-gray-500 text-[10px] font-black uppercase tracking-widest bg-black px-2 py-1 rounded border border-white/5">Audio</span>
                    <div class="flex bg-[#111] p-1 border border-white/10 rounded-md text-[10px] font-black select-none tracking-wider uppercase">
                        <button onclick="window.app.changeCurrentPlayerAudio('sub')" class="px-3 py-1.5 rounded transition-all ${currentAudioType === 'sub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Sub</button>
                        <button onclick="window.app.changeCurrentPlayerAudio('dub')" class="px-3 py-1.5 rounded transition-all ${currentAudioType === 'dub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Dub</button>
                    </div>
                </div>

                <!-- Auto Skip Toggles -->
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
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-2 border-b border-white/5 pb-4">
                <div class="flex-1">
                    <h1 id="current-ep-title" class="text-xl md:text-2xl font-black text-white tracking-tight leading-tight">Episode ${currentEpNum}</h1>
                    <p id="current-anime-title" class="text-xs text-[#F47521] font-bold uppercase tracking-widest mt-1 animate-pulse">Loading Anime Data...</p>
                </div>
                
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="window.app.handleReaction('like')" id="btn-like" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-[#F47521] hover:text-[#F47521] px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-300">
                        <i class="fas fa-thumbs-up"></i> <span>Like</span>
                    </button>
                    <button onclick="window.app.handleReaction('dislike')" id="btn-dislike" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-white/40 px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-300">
                        <i class="fas fa-thumbs-down"></i>
                    </button>
                    <!-- Triggers comment.js modal -->
                    <button onclick="if(window.app.components.comment) window.app.components.comment()" class="flex items-center gap-2 bg-[#F47521] text-black hover:bg-white px-5 py-2 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-md">
                        <i class="fas fa-comment-alt"></i> Comment
                    </button>
                </div>
            </div>

            <!-- DYNAMIC EPISODES MATRIX GRID -->
            <div class="w-full flex flex-col gap-4 mt-2">
                <h3 class="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2"><i class="fas fa-list text-[#F47521]"></i> Episodes Vault</h3>
                <div id="episodes-grid-mount-point"></div>
            </div>

            <!-- COMMENTS SECTION MOUNT POINT (Loads commentsss.js) -->
            <div class="w-full mt-8 border-t border-white/5 pt-6">
                <h3 class="text-white text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-comments text-[#F47521]"></i> Community Discussion</h3>
                <div id="comments-section-root" class="min-h-[200px] flex items-center justify-center bg-[#0a0a0a] rounded-xl border border-white/5">
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

    // 4. FETCH ANIME DATA & EPISODES PROPERLY
    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        // Fetch specific episode list to build matrix
        let episodesList = [];
        try {
            const epsResponse = await fetch(`${baseUrl}/api/episodes/${animeId}`);
            const epsJson = await epsResponse.json();
            
            // Handle your specific API response schema natively
            if (epsJson && epsJson.success && Array.isArray(epsJson.data)) {
                episodesList = epsJson.data;
            } else if (epsJson && epsJson.success && epsJson.results && Array.isArray(epsJson.results.episodes)) {
                episodesList = epsJson.results.episodes;
            }
        } catch(e) {
            console.error("Episode list fetch failed:", e);
        }

        // Fetch Anime title for header mapping
        try {
            const infoResponse = await fetch(`${baseUrl}/api/info?id=${animeId}`);
            const infoJson = await infoResponse.json();
            
            let animeTitle = animeId.replace(/-/g, ' ').toUpperCase();
            if (infoJson && infoJson.success && infoJson.data && infoJson.data.title) {
                animeTitle = infoJson.data.title;
            }
            
            const titleEl = document.getElementById('current-anime-title');
            if(titleEl) {
                titleEl.innerText = animeTitle;
                titleEl.classList.remove('animate-pulse');
            }
        } catch(e) {
            console.error("Anime Details fetch failed:", e);
        }

        // Locate current episode data for accurate title
        if (episodesList && episodesList.length > 0) {
            const currentEpObj = episodesList.find(e => (e.num || e.episode_no) == currentEpNum);
            const epTitleEl = document.getElementById('current-ep-title');
            
            if (currentEpObj && epTitleEl) {
                // If title exists and is not just "Episode X", display it correctly
                const titleStr = currentEpObj.title ? currentEpObj.title : `Episode ${currentEpNum}`;
                epTitleEl.innerText = `E${currentEpNum}: ${titleStr}`;
            }
        }

        // Setup global episodes data state
        window.app.state.currentEpisodesListProcessed = episodesList;
        window.app.state.currentAnimePage = { id: animeId };

        // Render the Episodes Grid Engine
        window.app.renderPlayEpisodesUI();

        // 5. INITIALIZE EXTERNAL COMPONENTS
        
        // Load Custom Player
        if (window.app.components.player) {
            window.app.components.player(); 
        } else {
            console.warn("player.js component not found.");
        }
        
        // Load Comments Section at the bottom
        if (window.app.components.commentsss) {
            window.app.components.commentsss();
        } else {
            document.getElementById('comments-section-root').innerHTML = `
                <p class="text-gray-500 text-xs py-10 font-bold uppercase tracking-widest"><i class="fas fa-wrench mr-2"></i> Comments system initializing...</p>
            `;
        }

    } catch (err) {
        console.error("Failed to compile player grid matrix:", err);
    }
};

// ==========================================
// --- PLAYER UTILITY ACTIONS ---
// ==========================================

window.app.toggleAutoSkip = (type) => {
    const isChecked = document.getElementById(`toggle-skip-${type}`).checked;
    localStorage.setItem(`blazex_autoskip_${type}`, isChecked ? 'true' : 'false');
};

window.app.changeCurrentPlayerAudio = (type) => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type') === type) return;
    urlParams.set('type', type);
    window.location.search = urlParams.toString();
};

window.app.handleReaction = (type) => {
    const likeBtn = document.getElementById('btn-like');
    const dislikeBtn = document.getElementById('btn-dislike');
    
    if (type === 'like') {
        likeBtn.classList.add('text-[#F47521]', 'border-[#F47521]');
        dislikeBtn.classList.remove('text-red-500', 'border-red-500');
    } else {
        dislikeBtn.classList.add('text-red-500', 'border-red-500');
        likeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    }
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
            <div id="play-numeric-episodes-grid" class="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-18 gap-2 w-full max-h-[300px] overflow-y-auto hide-scrollbar pr-1 pb-2"></div>
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
        const fillerIconDot = isFillerEpisode ? `<div class="absolute top-0.5 right-0.5 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_5px_red]"></div>` : '';
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
                buttonStyleClass = 'border-[#F47521] text-black bg-[#F47521] font-black text-base shadow-[0_0_10px_#F47521] scale-105 z-10';
            } else if (isAlreadyWatched) {
                buttonStyleClass = 'border-[#F47521]/40 text-[#F47521] bg-[#F47521]/5 hover:bg-[#F47521] hover:text-black font-black text-base transition-colors';
            } else {
                buttonStyleClass = isFillerEpisode 
                    ? 'border-red-500/30 text-gray-300 hover:bg-red-500 hover:text-white hover:border-red-500 font-black text-base transition-colors' 
                    : 'border-white/10 bg-[#0a0a0a] text-gray-300 hover:bg-[#F47521] hover:text-black hover:border-[#F47521] font-black text-base transition-colors shadow-sm';
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
        const activeTile = gridDiv.querySelector('.border-\\[\\#F47521\\]');
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
