// play.js - Advanced Custom HLS Player Engine with Gestures & Retry Logic

window.app.components.play = async () => {
    const workspace = document.getElementById('player-workspace');
    if (!workspace) return;

    // --- 1. READ URL PARAMETERS ---
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id'); 
    const animeId = urlParams.get('anime'); 
    const currentEpNum = urlParams.get('ep') || '1';
    
    let currentAudioType = urlParams.get('type');
    let currentServer = urlParams.get('server') || 'hd-1';

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

    // --- 2. PREFERENCES & HISTORY ---
    let autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
    let autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

    if (profile && profile.preferences) {
        if (profile.preferences.skipIntro !== undefined) autoSkipIntro = profile.preferences.skipIntro;
        if (profile.preferences.skipOutro !== undefined) autoSkipOutro = profile.preferences.skipOutro;
        if (!currentAudioType && profile.preferences.audioType) currentAudioType = profile.preferences.audioType;
    }
    if (!currentAudioType) currentAudioType = 'sub';

    window.app.state.epSearchValue = '';
    window.app.state.epRangeFilter = null;
    window.app.state.activeLanguageType = currentAudioType;
    window.app.state.currentPlayingEpNum = parseInt(currentEpNum);

    // Watch History
    if (profile && profile.uid) {
        let mockProgressHistory = { lastWatchedEp: currentEpNum, lastSlug: episodeId, finishedEp: false, watchedHistoryList: [parseInt(currentEpNum)] };
        const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
        if (stored) {
            try {
                let parsed = JSON.parse(stored);
                parsed.lastWatchedEp = currentEpNum; parsed.lastSlug = episodeId;
                if(!parsed.watchedHistoryList) parsed.watchedHistoryList = [];
                if(!parsed.watchedHistoryList.includes(parseInt(currentEpNum))) parsed.watchedHistoryList.push(parseInt(currentEpNum));
                mockProgressHistory = parsed;
            } catch(e){}
        }
        localStorage.setItem(`blazex_progress_${profile.uid}_${animeId}`, JSON.stringify(mockProgressHistory));
    }

    // --- 3. DYNAMIC UI SKELETON WITH CUSTOM PLAYER CONTAINER ---
    workspace.innerHTML = `
        <style>
            /* Custom Range Slider */
            input[type=range] { -webkit-appearance: none; background: transparent; width: 100%; cursor: pointer; }
            input[type=range]:focus { outline: none; }
            input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.2); }
            input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #F47521; margin-top: -4px; box-shadow: 0 0 10px rgba(244,117,33,0.8); transition: transform 0.1s; }
            input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.3); }
            
            /* Player Animations */
            .controls-active { opacity: 1 !important; visibility: visible !important; }
            .ripple-icon { animation: ripplePing 0.6s ease-out forwards; }
            @keyframes ripplePing { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
            
            /* Gestures Overlay Block Context Menu */
            .no-select { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
        </style>

        <div class="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in opacity-0 transition-opacity duration-300" id="play-content-wrapper">
            
            <div id="blazex-player-root" class="relative w-full aspect-video md:aspect-[21/9] bg-black rounded-xl shadow-lg border border-white/5 overflow-hidden group no-select">
                <div class="absolute inset-0 flex flex-col items-center justify-center z-0" id="player-boot-screen">
                    <div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                    <p id="player-boot-text" class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-4">Initializing Engine...</p>
                </div>
            </div>

            <div class="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0a0a0a] p-3 rounded-lg border border-white/5 shadow-md">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-black px-2 py-1 rounded border border-white/5">Audio</span>
                        <div class="flex bg-[#111] p-1 border border-white/10 rounded-md text-[10px] font-black select-none tracking-wider uppercase">
                            <button onclick="window.app.changePlayerConfig('type', 'sub')" class="px-3 py-1 rounded transition-all ${currentAudioType === 'sub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Sub</button>
                            <button onclick="window.app.changePlayerConfig('type', 'dub')" class="px-3 py-1 rounded transition-all ${currentAudioType === 'dub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Dub</button>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-black px-2 py-1 rounded border border-white/5">Server</span>
                        <div class="flex bg-[#111] p-1 border border-white/10 rounded-md text-[10px] font-black select-none tracking-wider uppercase">
                            <button onclick="window.app.changePlayerConfig('server', 'hd-1')" id="btn-srv-hd1" class="px-3 py-1 rounded transition-all ${currentServer === 'hd-1' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}">HD-1</button>
                            <button onclick="window.app.changePlayerConfig('server', 'hd-2')" id="btn-srv-hd2" class="px-3 py-1 rounded transition-all ${currentServer === 'hd-2' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}">HD-2</button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" id="toggle-skip-intro" class="hidden" onchange="window.app.toggleAutoSkip('intro')" ${autoSkipIntro ? 'checked' : ''}>
                        <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg"><div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div></div>
                        Auto Skip
                    </label>
                </div>
            </div>

            <div class="flex flex-col md:flex-row items-start md:items-start justify-between gap-6 py-2 pb-6 relative">
                <div class="flex-1 flex gap-4 w-full">
                    <div class="w-20 md:w-28 flex-shrink-0 rounded-lg overflow-hidden shadow-md border border-white/10 hidden sm:block bg-[#111]">
                        <img id="play-anime-poster" src="https://via.placeholder.com/200x300/111/fff?text=..." class="w-full h-full object-cover aspect-[2/3] animate-pulse">
                    </div>
                    <div class="flex-1 flex flex-col min-w-0">
                        <p id="current-anime-title" class="text-[10px] md:text-xs text-[#F47521] font-bold uppercase tracking-widest mb-1 truncate">Loading Anime Data...</p>
                        <h1 id="current-ep-title" class="text-lg md:text-2xl font-black text-white tracking-tight leading-tight truncate w-full">Episode ${currentEpNum}</h1>
                        <div class="relative mt-2">
                            <p id="current-anime-desc" class="text-xs text-gray-400 line-clamp-2 leading-relaxed max-w-2xl transition-all duration-300"></p>
                            <button id="desc-load-more-btn" onclick="window.app.togglePlayDesc()" class="text-[#F47521] text-[10px] font-bold uppercase tracking-widest mt-2 hover:text-white transition-colors hidden">See More <i class="fas fa-chevron-down ml-1"></i></button>
                        </div>
                    </div>
                </div>
                <div class="flex flex-row md:flex-col lg:flex-row items-center justify-start md:justify-end gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <div class="flex items-center gap-2">
                        <button onclick="window.app.handleReaction('like')" id="btn-like" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-[#F47521] px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-400 group relative">
                            <i class="fas fa-thumbs-up group-hover:-translate-y-0.5 transition-transform"></i> <span id="like-count-display" class="font-mono">0</span>
                        </button>
                        <button onclick="window.app.handleReaction('dislike')" id="btn-dislike" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-white/40 px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-400 group relative">
                            <i class="fas fa-thumbs-down group-hover:translate-y-0.5 transition-transform"></i> <span id="dislike-count-display" class="font-mono">0</span>
                        </button>
                    </div>
                    <button onclick="if(window.app.components.comment) window.app.components.comment()" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-[#F47521] hover:text-black border border-white/10 px-5 py-2 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm group">
                        <i class="fas fa-comment-alt group-hover:scale-110 transition-transform"></i> <span>Discuss</span>
                    </button>
                </div>
            </div>

            <div class="w-full flex flex-col gap-4 mt-2 bg-[#0a0a0a] p-4 md:p-5 rounded-xl border border-white/5 shadow-md">
                <h3 class="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-2"><i class="fas fa-list text-[#F47521]"></i> Episodes Vault</h3>
                <div id="episodes-grid-mount-point"></div>
            </div>

            <div class="w-full mt-4">
                <h3 class="text-white text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-comments text-[#F47521]"></i> Community</h3>
                <div id="comments-section-root" class="min-h-[200px] flex items-center justify-center bg-[#0a0a0a] rounded-xl border border-white/5 shadow-md"></div>
            </div>
        </div>
    `;

    // ADD TOGGLE CSS
    const style = document.createElement('style');
    style.innerHTML = `
        input:checked + .toggle-bg { background-color: #F47521; border-color: #F47521; }
        input:checked + .toggle-bg .toggle-dot { transform: translateX(14px); background-color: black; }
    `;
    document.head.appendChild(style);

    setTimeout(() => { document.getElementById('play-content-wrapper').classList.remove('opacity-0'); }, 10);

    // --- 4. ASYNC PLAYER LOGIC (RETRY, FALLBACK, UI) ---
    window.app.components.playerEngine = async () => {
        const playerRoot = document.getElementById('blazex-player-root');
        const bootText = document.getElementById('player-boot-text');
        
        const setBootStatus = (msg, isError = false) => {
            if (!bootText) return;
            bootText.innerText = msg;
            if (isError) {
                bootText.classList.replace('text-gray-500', 'text-red-500');
                bootText.innerHTML += `<br><button onclick="window.location.reload()" class="mt-4 bg-white/10 px-4 py-2 rounded text-white">Reload Page</button>`;
            }
        };

        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

        // LOAD HLS.JS
        if (typeof window.Hls === 'undefined') {
            try {
                setBootStatus("Loading Video Engine...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            } catch (e) {
                setBootStatus("Engine blocked by browser/adblocker.", true); return;
            }
        }

        // --- FETCH WITH RETRY & AUTO-FALLBACK ---
        let streamData = null;
        let isFallback = false;

        const fetchWithRetry = async (serverType, maxRetries = 4) => {
            for (let i = 1; i <= maxRetries; i++) {
                try {
                    setBootStatus(`Fetching Stream [${serverType}] (Attempt ${i}/${maxRetries})...`);
                    const targetUrl = `${baseUrl}/api/stream?id=${animeId}&ep=${currentEpNum}&server=${serverType}&type=${currentAudioType}`;
                    const res = await fetch(targetUrl);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    
                    const contentType = res.headers.get("content-type");
                    if (!contentType || !contentType.includes("application/json")) throw new Error("API Route crashed");
                    
                    const json = await res.json();
                    if (json.success && json.data && json.data.m3u8) return json.data;
                    throw new Error("Empty Stream Data");
                } catch (err) {
                    if (i === maxRetries) return null;
                    await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
                }
            }
        };

        // Try primary server
        streamData = await fetchWithRetry(currentServer, 4);

        // If primary failed, auto-switch to alternative
        if (!streamData) {
            setBootStatus(`Server ${currentServer} Unresponsive. Switching nodes...`);
            const fallbackServer = currentServer === 'hd-1' ? 'hd-2' : 'hd-1';
            currentServer = fallbackServer;
            
            // Update UI Button silently
            document.getElementById('btn-srv-hd1').className = `px-3 py-1 rounded transition-all ${currentServer === 'hd-1' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`;
            document.getElementById('btn-srv-hd2').className = `px-3 py-1 rounded transition-all ${currentServer === 'hd-2' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`;
            
            streamData = await fetchWithRetry(currentServer, 4);
        }

        // If still failed, try raw fallback endpoint
        if (!streamData) {
            try {
                setBootStatus(`Trying emergency fallback...`);
                const fRes = await fetch(`${baseUrl}/api/stream/fallback?id=${animeId}&ep=${currentEpNum}&server=${currentServer}&type=${currentAudioType}`);
                const fJson = await fRes.json();
                if (fJson.success && fJson.data && fJson.data.m3u8) {
                    streamData = fJson.data;
                    isFallback = true;
                }
            } catch(e){}
        }

        if (!streamData) {
            setBootStatus("All servers currently offline for this episode. Try again later.", true);
            return;
        }

        setBootStatus("Building Custom Player...");

        const streamUrl = streamData.m3u8; 
        const targetReferer = streamData.referer || "https://vidwish.live/";
        const proxiedStreamUrl = customProxyUrl + encodeURIComponent(streamUrl) + '&referer=' + encodeURIComponent(targetReferer);

        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        // Check if NEXT episode exists globally
        const episodesList = window.app.state.currentEpisodesListProcessed || [];
        const currentIndex = episodesList.findIndex(e => (e.num || e.episode_no) == currentEpNum);
        const hasNextEpisode = currentIndex !== -1 && currentIndex < episodesList.length - 1;
        let nextEpNum = null;
        let nextEpSlug = null;
        if (hasNextEpisode) {
            const nextEpObj = episodesList[currentIndex + 1];
            nextEpNum = nextEpObj.num || nextEpObj.episode_no;
            nextEpSlug = nextEpObj.slug || nextEpObj.id || String(nextEpNum);
        }

        // --- INJECT CUSTOM PLAYER HTML ---
        playerRoot.innerHTML = `
            <video id="main-video" crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black"></video>

            <div id="gesture-indicator" class="absolute inset-0 m-auto w-24 h-24 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 transition-opacity z-20 pointer-events-none transform scale-50">
                <i class="fas fa-play text-3xl mb-1" id="gesture-icon"></i>
                <span id="gesture-text" class="text-[10px] font-black tracking-wider uppercase"></span>
            </div>

            <div class="absolute inset-0 flex z-10" id="gesture-zones" oncontextmenu="event.preventDefault();">
                <div class="w-1/3 h-full" id="zone-left"></div>
                <div class="w-1/3 h-full" id="zone-center"></div>
                <div class="w-1/3 h-full" id="zone-right"></div>
            </div>

            <div id="quality-menu" class="absolute bottom-16 right-4 bg-[#111]/90 backdrop-blur-md border border-white/10 rounded-xl p-2 flex flex-col gap-1 z-40 hidden shadow-2xl min-w-[120px]">
                <button data-level="-1" class="quality-btn w-full text-left px-3 py-2 text-xs font-bold text-[#F47521] bg-white/5 rounded-lg">Auto</button>
            </div>

            <button id="skip-intro-btn" class="absolute bottom-20 right-4 bg-white text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded shadow-2xl transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-20 right-4 bg-white text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded shadow-2xl transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40">
                ${hasNextEpisode ? 'Next Ep <i class="fas fa-step-forward ml-1"></i>' : 'Skip Outro <i class="fas fa-forward ml-1"></i>'}
            </button>

            <div id="custom-controls" class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-3 px-4 z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 flex flex-col gap-2">
                
                <div class="w-full flex items-center relative group/slider cursor-pointer h-4" id="progress-container">
                    <div class="absolute left-0 h-1 w-full bg-white/20 rounded-full pointer-events-none"></div>
                    <div id="progress-loaded" class="absolute left-0 h-1 bg-white/40 rounded-full pointer-events-none" style="width: 0%;"></div>
                    <div id="progress-filled" class="absolute left-0 h-1 bg-[#F47521] rounded-full pointer-events-none" style="width: 0%;"></div>
                    <div id="progress-thumb" class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#F47521] rounded-full shadow-[0_0_10px_rgba(244,117,33,0.8)] pointer-events-none opacity-0 group-hover/slider:opacity-100 transition-opacity" style="left: 0%;"></div>
                </div>

                <div class="flex items-center justify-between mt-1">
                    <div class="flex items-center gap-4 text-white">
                        <button id="ctrl-play" class="hover:text-[#F47521] transition text-lg w-6 flex items-center justify-center"><i class="fas fa-play"></i></button>
                        <button id="ctrl-vol" class="hover:text-[#F47521] transition text-sm w-6 hidden md:flex items-center justify-center"><i class="fas fa-volume-up"></i></button>
                        <span id="ctrl-time" class="text-[10px] font-mono font-bold tracking-wider text-gray-300">00:00 / 00:00</span>
                    </div>
                    <div class="flex items-center gap-4 text-white">
                        <button id="ctrl-settings" class="hover:text-[#F47521] transition text-sm"><i class="fas fa-cog"></i></button>
                        <button id="ctrl-fullscreen" class="hover:text-[#F47521] transition text-sm"><i class="fas fa-expand"></i></button>
                    </div>
                </div>
            </div>
        `;

        const video = document.getElementById('main-video');
        const controls = document.getElementById('custom-controls');
        
        // Setup HLS
        let hls;
        if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 30 });
            hls.loadSource(proxiedStreamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
                video.play().catch(() => console.log("Autoplay blocked."));
                
                // Build Quality Menu
                const qMenu = document.getElementById('quality-menu');
                if (data.levels.length > 0) {
                    data.levels.forEach((level, index) => {
                        const btn = document.createElement('button');
                        btn.className = 'quality-btn w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-white/10 rounded-lg transition-colors';
                        btn.dataset.level = index;
                        btn.innerText = level.height ? `${level.height}p` : `Level ${index}`;
                        qMenu.appendChild(btn);
                    });
                    
                    document.querySelectorAll('.quality-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const lvl = parseInt(e.target.dataset.level);
                            hls.currentLevel = lvl;
                            document.querySelectorAll('.quality-btn').forEach(b => {
                                b.classList.remove('text-[#F47521]', 'bg-white/5');
                                b.classList.add('text-white');
                            });
                            e.target.classList.remove('text-white');
                            e.target.classList.add('text-[#F47521]', 'bg-white/5');
                            qMenu.classList.add('hidden');
                        });
                    });
                }
            });

            hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => video.play().catch(()=>{}));
        }

        // --- UI & GESTURE LOGIC ---
        
        // 1. Controls Hover / Idle Timeout
        let idleTimeout;
        const resetIdleTimer = () => {
            controls.classList.add('opacity-100');
            controls.classList.remove('opacity-0');
            playerRoot.style.cursor = 'default';
            clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => {
                if (!video.paused) {
                    controls.classList.remove('opacity-100');
                    controls.classList.add('opacity-0');
                    playerRoot.style.cursor = 'none';
                    document.getElementById('quality-menu').classList.add('hidden');
                }
            }, 3000);
        };
        playerRoot.addEventListener('mousemove', resetIdleTimer);
        playerRoot.addEventListener('touchstart', resetIdleTimer, {passive:true});

        // 2. Formatting Time
        const formatTime = (seconds) => {
            if(isNaN(seconds)) return "00:00";
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        // 3. Progress Bar Logic
        const progressContainer = document.getElementById('progress-container');
        const progressFilled = document.getElementById('progress-filled');
        const progressLoaded = document.getElementById('progress-loaded');
        const progressThumb = document.getElementById('progress-thumb');
        
        video.addEventListener('timeupdate', () => {
            const percent = (video.currentTime / video.duration) * 100 || 0;
            progressFilled.style.width = `${percent}%`;
            progressThumb.style.left = `calc(${percent}% - 6px)`;
            document.getElementById('ctrl-time').innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

            // Skip Buttons Logic (Show for 5s)
            handleSkipButtons(video.currentTime);
        });

        video.addEventListener('progress', () => {
            if(video.buffered.length > 0) {
                const loadedEnd = video.buffered.end(video.buffered.length - 1);
                const percent = (loadedEnd / video.duration) * 100 || 0;
                progressLoaded.style.width = `${percent}%`;
            }
        });

        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });

        // 4. Play/Pause & Fullscreen Buttons
        const playBtn = document.getElementById('ctrl-play');
        const togglePlay = () => {
            if(video.paused) { video.play(); playBtn.innerHTML = '<i class="fas fa-pause"></i>'; }
            else { video.pause(); playBtn.innerHTML = '<i class="fas fa-play"></i>'; resetIdleTimer(); }
        };
        playBtn.addEventListener('click', togglePlay);
        video.addEventListener('play', () => playBtn.innerHTML = '<i class="fas fa-pause"></i>');
        video.addEventListener('pause', () => playBtn.innerHTML = '<i class="fas fa-play"></i>');

        document.getElementById('ctrl-fullscreen').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                playerRoot.requestFullscreen().catch(err => alert("Fullscreen unsupported."));
            } else {
                document.exitFullscreen();
            }
        });

        document.getElementById('ctrl-settings').addEventListener('click', () => {
            document.getElementById('quality-menu').classList.toggle('hidden');
        });

        // 5. GESTURES ENGINE
        const gestureIcon = document.getElementById('gesture-icon');
        const gestureText = document.getElementById('gesture-text');
        const gestureIndicator = document.getElementById('gesture-indicator');

        const showGesture = (icon, text) => {
            gestureIcon.className = `fas ${icon} text-3xl mb-1`;
            gestureText.innerText = text;
            gestureIndicator.classList.remove('opacity-0', 'scale-50');
            gestureIndicator.classList.add('opacity-100', 'scale-100', 'ripple-icon');
            setTimeout(() => {
                gestureIndicator.classList.remove('opacity-100', 'scale-100', 'ripple-icon');
                gestureIndicator.classList.add('opacity-0', 'scale-50');
            }, 600);
        };

        let tapTimer = 0;
        let isLongPress = false;
        let longPressTimeout;

        const handleZoneTouch = (zone, e) => {
            e.preventDefault(); // Prevent standard double tap zoom on mobile
            
            // Long Press Logic Setup
            isLongPress = false;
            longPressTimeout = setTimeout(() => {
                isLongPress = true;
                video.playbackRate = 2.0;
                gestureIcon.className = "fas fa-forward text-3xl mb-1";
                gestureText.innerText = "2x SPEED";
                gestureIndicator.classList.remove('opacity-0', 'scale-50');
                gestureIndicator.classList.add('opacity-100', 'scale-100');
            }, 500);

            // Double Tap Logic
            const currentTime = new Date().getTime();
            const tapLength = currentTime - tapTimer;
            
            if (tapLength < 300 && tapLength > 0) {
                clearTimeout(longPressTimeout); // Cancel long press
                if (zone === 'left') { video.currentTime -= 10; showGesture('fa-backward', '-10 SEC'); }
                if (zone === 'right') { video.currentTime += 10; showGesture('fa-forward', '+10 SEC'); }
                if (zone === 'center') { togglePlay(); }
                tapTimer = 0;
            } else {
                tapTimer = currentTime;
                // Single tap timeout (triggers play/pause if not double tapped)
                setTimeout(() => {
                    if (tapTimer !== 0 && !isLongPress) {
                        if (zone === 'center' || zone === 'left' || zone === 'right') {
                            resetIdleTimer(); // Just wake up controls
                        }
                    }
                }, 300);
            }
        };

        const handleZoneEnd = () => {
            clearTimeout(longPressTimeout);
            if (isLongPress) {
                video.playbackRate = 1.0;
                gestureIndicator.classList.remove('opacity-100', 'scale-100');
                gestureIndicator.classList.add('opacity-0', 'scale-50');
                isLongPress = false;
            }
        };

        ['left', 'center', 'right'].forEach(z => {
            const el = document.getElementById(`zone-${z}`);
            el.addEventListener('touchstart', (e) => handleZoneTouch(z, e));
            el.addEventListener('touchend', handleZoneEnd);
            el.addEventListener('touchcancel', handleZoneEnd);
            
            // Mouse equivalents for desktop
            el.addEventListener('mousedown', (e) => handleZoneTouch(z, e));
            el.addEventListener('mouseup', handleZoneEnd);
            el.addEventListener('mouseleave', handleZoneEnd);
        });


        // 6. SKIP BUTTONS (5s Auto-Hide Logic)
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');
        let introBtnTimeout, outroBtnTimeout;
        let introBtnVisible = false, outroBtnVisible = false;

        const handleSkipButtons = (t) => {
            const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

            // INTRO
            if (introEnd > 0 && t >= introStart && t < introEnd) {
                if (autoSkipIntro) { video.currentTime = introEnd; } 
                else if (!introBtnVisible) {
                    introBtnVisible = true;
                    skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
                    clearTimeout(introBtnTimeout);
                    introBtnTimeout = setTimeout(() => {
                        skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0');
                    }, 5000); // Hide after 5s
                }
            } else {
                if (introBtnVisible) {
                    introBtnVisible = false;
                    skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0');
                    clearTimeout(introBtnTimeout);
                }
            }

            // OUTRO
            if (outroEnd > 0 && t >= outroStart && t < outroEnd) {
                if (autoSkipOutro) { 
                    if(hasNextEpisode) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, nextEpNum, animeId); 
                } else if (!outroBtnVisible) {
                    outroBtnVisible = true;
                    skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
                    clearTimeout(outroBtnTimeout);
                    outroBtnTimeout = setTimeout(() => {
                        skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0');
                    }, 5000); // Hide after 5s
                }
            } else {
                if (outroBtnVisible) {
                    outroBtnVisible = false;
                    skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0');
                    clearTimeout(outroBtnTimeout);
                }
            }
        };

        skipIntroBtn.addEventListener('click', () => { video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', () => { 
            if(hasNextEpisode) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, nextEpNum, animeId);
            else video.currentTime = video.duration;
        });

    };

    // TRIGGER COMPILATION
    window.app.renderPlayEpisodesUI();
    window.app.components.playerEngine();
};
