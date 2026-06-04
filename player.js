// player.js - Heavy Cinematic Player Engine

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // --- BOOT SEQUENCE LOGGER (Heavy Feel) ---
    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500/20 rounded-xl shadow-2xl z-50 absolute inset-0 animate-fade-in duration-700">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4 animate-pulse"></i>
                    <h3 class="text-white font-black text-sm uppercase tracking-widest">Stream Interrupted</h3>
                    <p class="text-red-400 font-mono text-[10px] mt-2 bg-red-500/10 px-3 py-1 rounded border border-red-500/20 max-w-md">${msg}</p>
                    <button onclick="window.location.reload()" class="mt-6 border border-white/10 bg-white/5 px-8 py-3 rounded-lg text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:text-black transition-all duration-500 shadow-lg">Re-Initialize</button>
                </div>
            `;
        } else {
            if (!document.getElementById('boot-status-text')) {
                playerRoot.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] z-50 absolute inset-0 transition-opacity duration-700 ease-in-out" id="boot-overlay">
                        <div class="tk-loader scale-125 z-0 mb-8"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                        <p id="boot-status-text" class="text-[#F47521] font-mono font-bold uppercase tracking-widest text-[9px] md:text-[10px] transition-all duration-500">${msg}</p>
                    </div>
                `;
            } else {
                document.getElementById('boot-status-text').innerText = msg;
            }
        }
    };

    setBootStatus("Establishing Secure Connection...");

    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id'); 
    const animeId = urlParams.get('anime');
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    const audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!episodeId) {
        setBootStatus("Critical Error: Missing Episode ID.", true);
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    // --- CINEMATIC CSS INJECTION ---
    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            .cinematic-ui { transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1); opacity: 1; }
            .cinematic-ui.idle { opacity: 0; cursor: none; pointer-events: none; }
            
            /* Custom Progress Bar with Highlights behind it */
            .progress-wrapper { position: relative; width: 100%; height: 6px; cursor: pointer; display: flex; items-center; }
            .progress-track { position: absolute; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; top: 1px; overflow: hidden; }
            .progress-fill { position: absolute; left: 0; height: 100%; background: #F47521; transition: width 0.1s linear; }
            .progress-highlight { position: absolute; height: 100%; background: rgba(244,117,33,0.5); z-index: 1; border-radius: 2px; }
            .progress-thumb { position: absolute; width: 12px; height: 12px; background: #fff; border-radius: 50%; top: -3px; transform: translateX(-50%); box-shadow: 0 0 10px rgba(244,117,33,0.8); z-index: 10; transition: transform 0.2s; pointer-events: none; }
            .progress-wrapper:hover .progress-thumb { transform: translateX(-50%) scale(1.3); }

            /* Heavy Modals */
            .heavy-modal { backdrop-filter: blur(24px); background: rgba(10,10,10,0.9); border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.8); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            
            #blazex-player-root:fullscreen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
            #blazex-player-root:-webkit-full-screen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
        `;
        document.head.appendChild(style);
    }

    if (typeof window.Hls === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                script.onload = resolve;
                script.onerror = () => reject(new Error("Engine injection blocked."));
                document.head.appendChild(script);
            });
        } catch (e) {
            setBootStatus(`Engine Failure: ${e.message}`, true);
            return;
        }
    }

    try {
        setBootStatus("Handshaking with API Nodes...");
        
        let streamData = null;
        let serverList = [];
        
        // 🚀 NEW API RESPONSE STRUCTURE PARSING
        const fetchStream = async (srv) => {
            try {
                const res = await fetch(`${baseUrl}/api/stream?id=${episodeId}&server=${srv}&type=${audioType}`);
                const json = await res.json();
                if (json.success && json.results?.streamingLink?.length > 0) {
                    return json.results;
                }
            } catch (err) {}
            return null;
        };

        let apiResults = await fetchStream(targetServer);
        
        if (!apiResults && targetServer !== 'hd-2') {
            setBootStatus("Primary Node Unresponsive. Shifting to Backup...");
            targetServer = 'hd-2';
            apiResults = await fetchStream(targetServer);
            
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('server', targetServer);
            window.history.replaceState({}, '', newUrl);
        }

        if (!apiResults || !apiResults.streamingLink || apiResults.streamingLink.length === 0) {
            throw new Error("Video payload empty. Episode might be unavailable.");
        }

        streamData = apiResults.streamingLink[0];
        serverList = apiResults.servers || [];

        setBootStatus("Igniting Playback Pipeline...");

        const streamUrl = streamData.link?.file; 
        if(!streamUrl) throw new Error("Manifest URL is missing from API payload.");

        const targetReferer = streamData.server || "https://vidwish.live/";
        const tracks = streamData.tracks || []; 
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        const proxiedStreamUrl = customProxyUrl + encodeURIComponent(streamUrl) + '&referer=' + encodeURIComponent(targetReferer);

        // 🚀 SMART NEXT EPISODE LOGIC
        const epsList = window.app.state.currentEpisodesListProcessed || [];
        const hasNextEp = epsList.some(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
        let nextEpSlug = null;
        if (hasNextEp) {
            const nextEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
            nextEpSlug = nextEpData.slug || nextEpData.id || String(currentEpNum + 1);
        }

        // --- EPISODE LIST HTML GENERATION ---
        let epListHtml = epsList.map(ep => {
            const epNum = ep.num || ep.episode_no;
            const targetSlug = ep.slug || ep.id || String(epNum);
            const isPlaying = epNum === currentEpNum;
            return `
                <button onclick="window.app.resolveEpisodeStreamAndRoute('${targetSlug}', ${epNum}, '${animeId}')" 
                        class="w-full text-left px-4 py-3 border-b border-white/5 flex items-center gap-3 hover:bg-white/10 transition-colors ${isPlaying ? 'text-[#F47521] font-black bg-black/40' : 'text-gray-300'}">
                    <span class="text-[10px] bg-black/50 px-2 py-1 rounded">EP ${epNum}</span>
                    <span class="text-xs truncate">${ep.title || 'Episode '+epNum}</span>
                    ${isPlaying ? '<i class="fas fa-play ml-auto text-[10px]"></i>' : ''}
                </button>
            `;
        }).join('');

        // --- HEAVY UI HTML ---
        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black group flex items-center justify-center overflow-hidden touch-manipulation">
                <video id="main-video-player" playsinline class="w-full h-full object-contain pointer-events-none"></video>
                
                <!-- GESTURE OVERLAY -->
                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>
                
                <!-- 2x SPEED INDICATOR -->
                <div id="speed-indicator" class="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-300 opacity-0 z-40 flex items-center gap-2 border border-[#F47521]/30 shadow-[0_0_20px_rgba(244,117,33,0.2)]">
                    <span>2x Speed</span> <i class="fas fa-forward text-[#F47521]"></i>
                </div>

                <!-- DOUBLE TAP RIPPLES & ICONS -->
                <div id="dt-left" class="absolute left-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity duration-300 z-20 pointer-events-none scale-150">
                    <div class="flex"><i class="fas fa-caret-left text-3xl"></i><i class="fas fa-caret-left text-3xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1 drop-shadow-md">10s</span>
                </div>
                <div id="dt-right" class="absolute right-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity duration-300 z-20 pointer-events-none scale-150">
                    <div class="flex"><i class="fas fa-caret-right text-3xl"></i><i class="fas fa-caret-right text-3xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1 drop-shadow-md">10s</span>
                </div>

                <!-- SMART SKIP BUTTONS -->
                <button id="skip-intro-btn" class="absolute bottom-24 right-6 bg-white/95 backdrop-blur-md text-black font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-lg shadow-2xl transition-all duration-500 transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    Skip Intro <i class="fas fa-forward ml-2"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-24 right-6 bg-white/95 backdrop-blur-md text-black font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-lg shadow-2xl transition-all duration-500 transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-2"></i>` : `Skip Outro <i class="fas fa-forward ml-2"></i>`}
                </button>

                <!-- MAIN CINEMATIC UI LAYER -->
                <div id="ui-layer" class="cinematic-ui absolute inset-0 z-30 flex flex-col justify-between pointer-events-none">
                    
                    <!-- TOP BAR (Gradient Down) -->
                    <div class="w-full flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/90 to-transparent pointer-events-auto">
                        <button id="top-ep-selector" class="flex items-center gap-3 text-white hover:text-[#F47521] transition-colors group">
                            <i class="fas fa-list text-sm"></i>
                            <div class="flex flex-col items-start">
                                <span class="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">Currently Playing</span>
                                <h2 class="text-xs md:text-sm font-black tracking-wide drop-shadow-md">Episode ${currentEpNum} <i class="fas fa-chevron-down text-[10px] ml-1 group-hover:translate-y-0.5 transition-transform"></i></h2>
                            </div>
                        </button>
                        
                        <div class="flex items-center gap-4">
                            <button id="top-settings-btn" class="text-white hover:text-[#F47521] transition-colors p-2"><i class="fas fa-cog text-xl transition-transform duration-500" id="settings-icon"></i></button>
                        </div>
                    </div>
                    
                    <!-- CENTER PLAY PAUSE (Big & Heavy) -->
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="w-20 h-20 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-white flex items-center justify-center hover:bg-[#F47521] hover:border-[#F47521] hover:text-black transition-all duration-500 scale-100 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                            <i id="center-play-icon" class="fas fa-play text-3xl ml-2"></i>
                        </button>
                    </div>

                    <!-- BOTTOM BAR (Gradient Up) -->
                    <div class="w-full flex flex-col px-4 md:px-6 pb-4 md:pb-6 pt-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto">
                        
                        <!-- Custom Interactive Progress Bar -->
                        <div class="w-full flex items-center gap-4 mb-4">
                            <span id="time-current" class="text-white text-[10px] font-mono font-bold w-10 text-right drop-shadow">00:00</span>
                            <div class="progress-wrapper flex-1 group" id="custom-progress">
                                <div class="progress-track">
                                    <div id="intro-hl" class="progress-highlight hidden"></div>
                                    <div id="outro-hl" class="progress-highlight hidden"></div>
                                    <div id="progress-fill" class="progress-fill w-0"></div>
                                </div>
                                <div id="progress-thumb" class="progress-thumb" style="left: 0%;"></div>
                            </div>
                            <span id="time-duration" class="text-gray-400 text-[10px] font-mono font-bold w-10 drop-shadow">00:00</span>
                        </div>

                        <!-- Bottom Controls -->
                        <div class="w-full flex items-center justify-between">
                            <div class="flex items-center gap-5">
                                <button id="bottom-play-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="bottom-play-icon" class="fas fa-play text-xl"></i></button>
                                <button id="vol-btn" class="text-white hover:text-[#F47521] transition-colors hidden sm:block"><i id="vol-icon" class="fas fa-volume-up text-lg"></i></button>
                            </div>
                            
                            <div class="flex items-center gap-5">
                                <button id="fs-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="fs-icon" class="fas fa-expand text-xl"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- EPISODES MODAL (Left Side Slide-in) -->
                <div id="episodes-modal" class="heavy-modal absolute top-4 bottom-4 left-4 w-72 rounded-2xl z-50 flex flex-col transform -translate-x-[150%] opacity-0 pointer-events-none">
                    <div class="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 class="text-white font-black text-sm uppercase tracking-widest"><i class="fas fa-list text-[#F47521] mr-2"></i> Episodes</h3>
                        <button id="close-ep-modal" class="text-gray-500 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
                        ${epListHtml || '<div class="p-4 text-xs text-gray-500">No episodes found.</div>'}
                    </div>
                </div>

                <!-- SETTINGS MODAL (Right Side Dropdown) -->
                <div id="settings-modal" class="heavy-modal absolute top-16 right-4 w-64 rounded-xl z-50 flex flex-col transform scale-95 opacity-0 pointer-events-none origin-top-right">
                    <div class="p-3 border-b border-white/5 flex gap-2 overflow-x-auto hide-scrollbar">
                        <button class="set-tab text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded bg-[#F47521] text-black" data-target="set-qual">Quality</button>
                        <button class="set-tab text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded text-gray-400 hover:text-white" data-target="set-sub">Subs</button>
                        <button class="set-tab text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded text-gray-400 hover:text-white" data-target="set-srv">Server</button>
                    </div>
                    <div class="p-2 max-h-60 overflow-y-auto hide-scrollbar">
                        <div id="set-qual" class="set-pane flex flex-col gap-1"></div>
                        <div id="set-sub" class="set-pane flex flex-col gap-1 hidden"></div>
                        <div id="set-srv" class="set-pane flex flex-col gap-1 hidden">
                            ${serverList.map(s => `
                                <button onclick="window.app.changePlayerConfig('server', '${s.server_name.toLowerCase()}')" 
                                    class="text-left text-xs px-3 py-2 rounded ${targetServer === s.server_name.toLowerCase() ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1">
                                    ${s.server_name}
                                </button>
                            `).join('') || '<div class="text-xs text-gray-500 p-2">Servers not available</div>'}
                        </div>
                    </div>
                </div>

            </div>
        `;

        const video = document.getElementById('main-video-player');
        const overlay = document.getElementById('gesture-overlay');
        const uiLayer = document.getElementById('ui-layer');
        const customProgress = document.getElementById('custom-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressThumb = document.getElementById('progress-thumb');
        const introHl = document.getElementById('intro-hl');
        const outroHl = document.getElementById('outro-hl');
        const playBtnBottom = document.getElementById('bottom-play-btn');
        const playIconBottom = document.getElementById('bottom-play-icon');
        const playBtnCenter = document.getElementById('center-play-btn');
        const playIconCenter = document.getElementById('center-play-icon');
        const fsBtn = document.getElementById('fs-btn');
        const fsIcon = document.getElementById('fs-icon');
        const timeCurr = document.getElementById('time-current');
        const timeDur = document.getElementById('time-duration');
        
        // Modals
        const epSelector = document.getElementById('top-ep-selector');
        const epModal = document.getElementById('episodes-modal');
        const closeEpBtn = document.getElementById('close-ep-modal');
        const settingsBtn = document.getElementById('top-settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        
        let hlsInstance = null;

        // --- MODAL LOGIC ---
        const closeAllModals = () => {
            epModal.classList.add('-translate-x-[150%]', 'opacity-0', 'pointer-events-none');
            settingsModal.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
            document.getElementById('settings-icon').classList.remove('rotate-90');
        };

        epSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            if (epModal.classList.contains('opacity-0')) {
                closeAllModals();
                epModal.classList.remove('-translate-x-[150%]', 'opacity-0', 'pointer-events-none');
            } else closeAllModals();
        });

        closeEpBtn.addEventListener('click', (e) => { e.stopPropagation(); closeAllModals(); });

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (settingsModal.classList.contains('opacity-0')) {
                closeAllModals();
                settingsModal.classList.remove('scale-95', 'opacity-0', 'pointer-events-none');
                document.getElementById('settings-icon').classList.add('rotate-90');
            } else closeAllModals();
        });

        document.querySelectorAll('.set-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.set-tab').forEach(t => t.className = 'set-tab text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded text-gray-400 hover:text-white');
                tab.className = 'set-tab text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded bg-[#F47521] text-black';
                document.querySelectorAll('.set-pane').forEach(p => p.classList.add('hidden'));
                document.getElementById(tab.getAttribute('data-target')).classList.remove('hidden');
            });
        });

        // --- SUBTITLES INJECTION ---
        tracks.forEach((track, index) => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track');
                trackEl.kind = track.kind;
                trackEl.label = track.label || `Track ${index+1}`;
                trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                trackEl.src = customProxyUrl + encodeURIComponent(track.file) + '&referer=' + encodeURIComponent(targetReferer); 
                if (track.default) trackEl.default = true;
                video.appendChild(trackEl);
            }
        });

        // --- HLS ENGINE BOOT ---
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                buildDynamicSettings(hlsInstance, video);
                const profile = window.app.state?.activeProfile || null;
                if (profile && profile.uid) {
                    const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.lastWatchedEp == currentEpNum && parsed.lastTime > 0) video.currentTime = parsed.lastTime;
                    }
                }
                const bootLayer = document.getElementById('boot-overlay');
                if(bootLayer) { bootLayer.classList.add('opacity-0'); setTimeout(()=>bootLayer.remove(), 700); }
                video.play().catch(e => console.log("Autoplay blocked."));
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
                    else { setBootStatus(`Fatal Data Corruption: ${data.details}`, true); hlsInstance.destroy(); }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => {
                const bootLayer = document.getElementById('boot-overlay');
                if(bootLayer) { bootLayer.classList.add('opacity-0'); setTimeout(()=>bootLayer.remove(), 700); }
                video.play().catch(e=>e);
                buildDynamicSettings(null, video);
            });
        }

        // --- UI AUTO-HIDE ---
        let hideTimer;
        const resetHideTimer = () => {
            uiLayer.classList.remove('idle');
            document.getElementById('video-container').style.cursor = 'default';
            clearTimeout(hideTimer);
            if (!video.paused) {
                hideTimer = setTimeout(() => {
                    uiLayer.classList.add('idle');
                    document.getElementById('video-container').style.cursor = 'none';
                    closeAllModals();
                }, 5000);
            }
        };

        // --- GESTURES: HEAVY SINGLE TAP / DOUBLE TAP / HOLD ---
        let tapCount = 0;
        let tapTimer = null;
        let holdTimer = null;
        let isHolding = false;

        const handleSingleTap = () => {
            if (video.paused) video.play();
            else video.pause();
            resetHideTimer();
        };

        const handleDoubleTap = (e) => {
            const rect = overlay.getBoundingClientRect();
            const x = (e.clientX || e.changedTouches?.[0]?.clientX) - rect.left;
            if (x > rect.width / 2) {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                const icon = document.getElementById('dt-right');
                icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 400);
            } else {
                video.currentTime = Math.max(0, video.currentTime - 10);
                const icon = document.getElementById('dt-left');
                icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 400);
            }
            resetHideTimer();
        };

        const onTouchStart = (e) => {
            holdTimer = setTimeout(() => {
                isHolding = true;
                video.playbackRate = 2.0;
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 500);
        };

        const onTouchEnd = (e) => {
            clearTimeout(holdTimer);
            if (isHolding) {
                video.playbackRate = 1.0;
                document.getElementById('speed-indicator').classList.add('opacity-0');
                isHolding = false;
                return; // Prevent tap registering if it was a hold
            }

            e.preventDefault(); // Stop phantom clicks on mobile
            tapCount++;
            if (tapCount === 1) {
                tapTimer = setTimeout(() => {
                    tapCount = 0;
                    handleSingleTap();
                }, 300); // 300ms Cinematic Delay for Single Tap
            } else if (tapCount === 2) {
                clearTimeout(tapTimer);
                tapCount = 0;
                handleDoubleTap(e);
            }
        };

        overlay.addEventListener('mousedown', onTouchStart);
        overlay.addEventListener('touchstart', onTouchStart, {passive: true});
        overlay.addEventListener('mouseup', onTouchEnd);
        overlay.addEventListener('touchend', onTouchEnd);
        
        // Mouse move wakes UI
        overlay.addEventListener('mousemove', resetHideTimer);
        uiLayer.addEventListener('mousemove', resetHideTimer);

        // --- PLAY/PAUSE VISUALS ---
        video.addEventListener('play', () => {
            playIconBottom.className = 'fas fa-pause text-xl';
            playIconCenter.className = 'fas fa-pause text-3xl ml-0';
            playBtnCenter.classList.add('opacity-0', 'scale-150');
            resetHideTimer();
        });

        video.addEventListener('pause', () => {
            playIconBottom.className = 'fas fa-play text-xl';
            playIconCenter.className = 'fas fa-play text-3xl ml-2';
            playBtnCenter.classList.remove('opacity-0', 'scale-150');
            uiLayer.classList.remove('idle');
            clearTimeout(hideTimer);
        });

        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); handleSingleTap(); });
        playBtnCenter.addEventListener('click', (e) => { e.stopPropagation(); handleSingleTap(); });

        // --- PROGRESS BAR & HIGHLIGHTS LOGIC ---
        const formatTime = (sec) => {
            if(isNaN(sec)) return "00:00";
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        };

        video.addEventListener('loadedmetadata', () => {
            timeDur.innerText = formatTime(video.duration);
            
            // Plot Intro Highlights
            if (introEnd > introStart) {
                introHl.classList.remove('hidden');
                introHl.style.left = `${(introStart / video.duration) * 100}%`;
                introHl.style.width = `${((introEnd - introStart) / video.duration) * 100}%`;
            }
            // Plot Outro Highlights
            if (outroEnd > outroStart) {
                outroHl.classList.remove('hidden');
                outroHl.style.left = `${(outroStart / video.duration) * 100}%`;
                outroHl.style.width = `${((outroEnd - outroStart) / video.duration) * 100}%`;
            }
        });

        video.addEventListener('timeupdate', () => {
            const pct = (video.currentTime / video.duration) * 100;
            progressFill.style.width = `${pct}%`;
            progressThumb.style.left = `${pct}%`;
            timeCurr.innerText = formatTime(video.currentTime);

            if (Math.floor(video.currentTime) % 5 === 0) saveProgress(video.currentTime);
            
            // Auto Skip Logic
            const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

            const skipIntroBtn = document.getElementById('skip-intro-btn');
            const skipOutroBtn = document.getElementById('skip-outro-btn');

            if (introEnd > 0 && video.currentTime >= introStart && video.currentTime < introEnd) {
                if (autoSkipIntro) { video.currentTime = introEnd; } 
                else { skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); }
            } else { skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0'); }

            if (outroEnd > 0 && video.currentTime >= outroStart && video.currentTime < outroEnd) {
                if (autoSkipOutro) { if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); } 
                else { skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); }
            } else { skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0'); }
        });

        // Interactive Custom Progress Bar
        const updateProgressFromEvent = (e) => {
            const rect = customProgress.getBoundingClientRect();
            let x = e.clientX;
            if (e.touches) x = e.touches[0].clientX;
            let pct = (x - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));
            video.currentTime = pct * video.duration;
            progressFill.style.width = `${pct * 100}%`;
            progressThumb.style.left = `${pct * 100}%`;
        };

        let isDragging = false;
        customProgress.addEventListener('mousedown', (e) => { isDragging = true; updateProgressFromEvent(e); });
        customProgress.addEventListener('touchstart', (e) => { isDragging = true; updateProgressFromEvent(e); }, {passive:true});
        document.addEventListener('mousemove', (e) => { if(isDragging) updateProgressFromEvent(e); });
        document.addEventListener('touchmove', (e) => { if(isDragging) updateProgressFromEvent(e); }, {passive:true});
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('touchend', () => isDragging = false);

        // --- BUILD SETTINGS ---
        function buildDynamicSettings(hls, vid) {
            const qList = document.getElementById('set-qual');
            const cList = document.getElementById('set-sub');
            
            if (hls && hls.levels) {
                qList.innerHTML = `<button onclick="window.setQuality(-1)" class="text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn" data-level="-1">Auto (Best)</button>`;
                hls.levels.forEach((l, i) => {
                    qList.innerHTML += `<button onclick="window.setQuality(${i})" class="text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors q-btn" data-level="${i}">${l.height}p</button>`;
                });
                
                window.setQuality = (levelIndex) => {
                    hls.currentLevel = levelIndex;
                    document.querySelectorAll('.q-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-level')) === levelIndex) b.className = 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn';
                        else b.className = 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors mb-1 q-btn';
                    });
                };
            } else qList.innerHTML = `<span class="text-xs text-gray-500 px-2 py-2">Auto Managed</span>`;

            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button onclick="window.setCC(-1)" class="text-left text-xs px-3 py-2 rounded bg-white/10 text-white hover:bg-white/20 mb-1 c-btn" data-idx="-1">Off</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button onclick="window.setCC(${i})" class="text-left text-xs px-3 py-2 rounded ${tk.mode==='showing' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 c-btn" data-idx="${i}">${tk.label || 'Sub '+i}</button>`;
                }

                window.setCC = (idx) => {
                    for (let i=0; i<vid.textTracks.length; i++) {
                        vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden';
                    }
                    document.querySelectorAll('.c-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 c-btn';
                        else b.className = 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 c-btn';
                    });
                };
            } else cList.innerHTML = `<span class="text-xs text-gray-500 px-2 py-2">No Subtitles</span>`;
        }

        // --- SKIP BUTTON ACTIONS ---
        document.getElementById('skip-intro-btn').addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = introEnd; });
        document.getElementById('skip-outro-btn').addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); 
            else video.currentTime = video.duration; 
        });

        // --- FULLSCREEN ---
        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                else if (playerRoot.webkitRequestFullscreen) playerRoot.webkitRequestFullscreen();
                fsIcon.className = 'fas fa-compress text-xl';
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                fsIcon.className = 'fas fa-expand text-xl';
            }
        });

        function saveProgress(time) {
            const profile = window.app.state?.activeProfile || null;
            if (profile && profile.uid) {
                const key = `blazex_progress_${profile.uid}_${animeId}`;
                let history = JSON.parse(localStorage.getItem(key)) || { watchedHistoryList: [] };
                history.lastWatchedEp = currentEpNum;
                history.lastSlug = urlParams.get('id');
                history.lastTime = time;
                if(!history.watchedHistoryList.includes(parseInt(currentEpNum))) {
                    if (time > (video.duration * 0.85)) history.watchedHistoryList.push(parseInt(currentEpNum));
                }
                localStorage.setItem(key, JSON.stringify(history));
            }
        }

    } catch (error) {
        setBootStatus(error.message, true);
    }
};
