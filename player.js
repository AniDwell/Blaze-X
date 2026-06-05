// player.js - Custom Cinematic Video Engine (Heavy Feel + Working Base)

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // --- BOOT SEQUENCE LOGGER ---
    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500/20 rounded-xl shadow-2xl z-50 absolute inset-0">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2 animate-pulse"></i>
                    <h3 class="text-white font-black text-sm uppercase tracking-widest">Playback Halted</h3>
                    <p class="text-red-400 font-mono text-[10px] mt-2 bg-red-500/10 px-3 py-1 rounded border border-red-500/20 max-w-md">${msg}</p>
                    <button onclick="window.location.reload()" class="mt-5 border border-white/10 bg-white/5 px-6 py-2 rounded-lg text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:text-black transition-colors">Reboot Stream</button>
                </div>
            `;
        } else {
            if (!document.getElementById('boot-status-text')) {
                playerRoot.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] z-50 absolute inset-0" id="boot-overlay">
                        <div class="tk-loader scale-100 z-0 mb-6"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                        <p id="boot-status-text" class="text-[#F47521] font-mono font-bold uppercase tracking-widest text-[9px] md:text-[10px] px-4 py-1.5 rounded animate-pulse">${msg}</p>
                    </div>
                `;
            } else {
                document.getElementById('boot-status-text').innerText = msg;
            }
        }
    };

    setBootStatus("Analyzing URL Parameters...");

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); 
    const episodeId = urlParams.get('id'); 
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    const audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !episodeId || !currentEpNum) {
        setBootStatus("Missing URL Parameters (Anime ID, Episode ID or Ep Number).", true);
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 
    const profile = window.app.state?.activeProfile || null;

    // Inject Heavy Player CSS safely
    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            .heavy-transition { transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); }
            .player-ui-layer { transition: opacity 0.4s ease; opacity: 1; }
            .player-ui-layer.idle { opacity: 0; cursor: none; pointer-events: none; }
            
            input[type=range].blazex-slider { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; height: 100%; outline: none; margin: 0; z-index: 10; position: relative; }
            input[type=range].blazex-slider::-webkit-slider-runnable-track { background: transparent; height: 100%; border-radius: 4px; }
            input[type=range].blazex-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%; background: #F47521; margin-top: -5px; box-shadow: 0 0 10px rgba(244,117,33,0.8); transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1); }
            input[type=range].blazex-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }
            
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
                script.onerror = () => reject(new Error("Blocked script injection."));
                document.head.appendChild(script);
            });
        } catch (e) {
            setBootStatus(`Engine Failure: ${e.message}`, true);
            return;
        }
    }

    let hlsInstance = null; // Declare early for teardown

    try {
        setBootStatus(`Connecting to ${targetServer.toUpperCase()}...`);
        
        let streamData = null;
        let animeInfo = {};
        let episodesList = [];
        
        // Parallel Fetch for Performance
        const [streamRes, infoRes, epsRes] = await Promise.all([
            fetch(`${baseUrl}/api/stream?id=${episodeId}&server=${targetServer}&type=${audioType}`).then(r => r.json()).catch(()=>null),
            fetch(`${baseUrl}/api/info?id=${animeId}`).then(r => r.json()).catch(()=>null),
            fetch(`${baseUrl}/api/episodes/${animeId}`).then(r => r.json()).catch(()=>null)
        ]);

        if (streamRes && streamRes.success && streamRes.data?.m3u8) {
            streamData = streamRes.data;
        } else {
            setBootStatus("HD-1 Offline. Auto-switching to HD-2...");
            targetServer = targetServer === 'hd-1' ? 'hd-2' : 'hd-1';
            const fbRes = await fetch(`${baseUrl}/api/stream?id=${episodeId}&server=${targetServer}&type=${audioType}`).then(r=>r.json()).catch(()=>null);
            
            if (fbRes && fbRes.success && fbRes.data?.m3u8) {
                streamData = fbRes.data;
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('server', targetServer);
                window.history.replaceState({}, '', newUrl);
            } else {
                throw new Error("All stream servers are unresponsive for this episode.");
            }
        }

        if (infoRes && infoRes.success) animeInfo = infoRes.data;
        if (epsRes && epsRes.success) {
            if (Array.isArray(epsRes.data)) episodesList = epsRes.data;
            else if (epsRes.results && Array.isArray(epsRes.results.episodes)) episodesList = epsRes.results.episodes;
        }

        setBootStatus("Constructing Cinematic Pipeline...");

        const streamUrl = streamData.m3u8; 
        const targetReferer = streamData.referer || "https://vidwish.live/";
        const tracks = streamData.subtitles || []; 
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        const proxiedStreamUrl = customProxyUrl + encodeURIComponent(streamUrl) + '&referer=' + encodeURIComponent(targetReferer);

        const hasNextEp = episodesList.some(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
        let nextEpSlug = null;
        if (hasNextEp) {
            const nextEpData = episodesList.find(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
            nextEpSlug = nextEpData.slug || nextEpData.id || String(currentEpNum + 1);
        }

        const titleString = animeInfo.title || animeId.replace(/-/g, ' ').toUpperCase();

        // --- CUSTOM UI HTML ---
        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black group flex items-center justify-center overflow-hidden">
                <video id="main-video-player" playsinline class="w-full h-full object-contain pointer-events-none"></video>
                
                <div id="gesture-overlay" class="absolute inset-0 z-10 cursor-pointer"></div>
                
                <div id="speed-indicator" class="absolute top-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-400 opacity-0 z-40 flex items-center gap-2 border border-[#F47521]/40 shadow-lg pointer-events-none">
                    <span>2x Speed</span> <i class="fas fa-forward text-[#F47521]"></i>
                </div>

                <div id="dt-left" class="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity duration-300 z-20 pointer-events-none bg-black/40 p-4 rounded-full backdrop-blur-sm">
                    <div class="flex"><i class="fas fa-caret-left text-3xl"></i><i class="fas fa-caret-left text-3xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1">10s</span>
                </div>
                <div id="dt-right" class="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity duration-300 z-20 pointer-events-none bg-black/40 p-4 rounded-full backdrop-blur-sm">
                    <div class="flex"><i class="fas fa-caret-right text-3xl"></i><i class="fas fa-caret-right text-3xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1">10s</span>
                </div>

                <button id="skip-intro-btn" class="absolute bottom-24 right-6 bg-white/90 backdrop-blur-md text-black font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-lg shadow-2xl heavy-transition transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    Skip Intro <i class="fas fa-forward ml-1"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-24 right-6 bg-white/90 backdrop-blur-md text-black font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-lg shadow-2xl heavy-transition transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-1"></i>` : `Skip Outro <i class="fas fa-forward ml-1"></i>`}
                </button>

                <div id="episodes-modal" class="absolute top-16 left-4 w-64 md:w-80 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-400 transform scale-95 opacity-0 pointer-events-none hidden max-h-[70vh]">
                    <div class="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 class="text-white font-black uppercase tracking-widest text-[10px]"><i class="fas fa-list text-[#F47521] mr-1"></i> Episodes Vault</h3>
                        <button id="close-eps-btn" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto hide-scrollbar p-3 grid grid-cols-4 sm:grid-cols-5 gap-2" id="in-player-ep-grid"></div>
                </div>

                <div id="settings-modal" class="absolute top-16 right-4 w-64 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-400 transform scale-95 opacity-0 pointer-events-none hidden max-h-[75vh]">
                    <div class="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 class="text-white font-black uppercase tracking-widest text-[10px]"><i class="fas fa-cog text-[#F47521] mr-1"></i> Settings</h3>
                        <button id="close-settings-btn" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-4">
                        <div>
                            <h4 class="text-gray-500 text-[8px] font-black uppercase tracking-widest mb-1.5">Server & Audio</h4>
                            <div class="grid grid-cols-2 gap-2 mb-2">
                                <button onclick="window.app.changePlayerConfig('type', 'sub')" class="py-2 rounded-md text-[10px] font-bold ${audioType === 'sub' ? 'bg-[#F47521] text-black' : 'bg-[#111] text-white border border-white/10'} heavy-transition">Sub</button>
                                <button onclick="window.app.changePlayerConfig('type', 'dub')" class="py-2 rounded-md text-[10px] font-bold ${audioType === 'dub' ? 'bg-[#F47521] text-black' : 'bg-[#111] text-white border border-white/10'} heavy-transition">Dub</button>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="window.app.changePlayerConfig('server', 'hd-1')" class="py-2 rounded-md text-[10px] font-bold ${targetServer === 'hd-1' ? 'bg-white text-black' : 'bg-[#111] text-white border border-white/10'} heavy-transition">HD-1</button>
                                <button onclick="window.app.changePlayerConfig('server', 'hd-2')" class="py-2 rounded-md text-[10px] font-bold ${targetServer === 'hd-2' ? 'bg-white text-black' : 'bg-[#111] text-white border border-white/10'} heavy-transition">HD-2</button>
                            </div>
                        </div>
                        <div>
                            <h4 class="text-gray-500 text-[8px] font-black uppercase tracking-widest mb-1.5">Quality</h4>
                            <div id="quality-list" class="flex flex-col gap-1"></div>
                        </div>
                        <div>
                            <h4 class="text-gray-500 text-[8px] font-black uppercase tracking-widest mb-1.5">Subtitles</h4>
                            <div id="subs-list" class="flex flex-col gap-1"></div>
                        </div>
                    </div>
                </div>

                <div id="ui-layer" class="player-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/95 via-transparent to-black/80 pointer-events-none">
                    
                    <div class="w-full flex items-start justify-between p-4 md:p-6 pointer-events-auto">
                        <button id="open-eps-btn" class="flex flex-col items-start hover:bg-white/10 p-2 -m-2 rounded-lg heavy-transition group">
                            <span class="text-[#F47521] text-[9px] font-black uppercase tracking-widest mb-0.5 group-hover:text-white truncate max-wxs">${titleString}</span>
                            <div class="flex items-center gap-2">
                                <h2 class="text-white text-sm md:text-base font-bold tracking-wide drop-shadow-md">Episode ${currentEpNum}</h2>
                                <i class="fas fa-chevron-down text-gray-400 text-[10px] group-hover:translate-y-0.5 heavy-transition"></i>
                            </div>
                        </button>
                        
                        <div class="flex items-center gap-3">
                            ${targetServer === 'hd-2' ? '<span class="bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-sm">HD-2</span>' : ''}
                            <button id="master-settings-btn" class="w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white hover:text-[#F47521] hover:border-[#F47521] transition-all duration-500 flex items-center justify-center backdrop-blur-md">
                                <i class="fas fa-cog text-lg" id="master-settings-icon"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="w-16 h-16 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full text-white flex items-center justify-center hover:bg-[#F47521]/90 hover:border-[#F47521] hover:scale-110 heavy-transition">
                            <i id="center-play-icon" class="fas fa-play text-2xl ml-1"></i>
                        </button>
                    </div>

                    <div class="w-full flex flex-col px-4 md:px-6 pb-4 pt-8 pointer-events-auto">
                        
                        <div class="w-full flex items-center gap-4 mb-3">
                            <span id="time-current" class="text-white text-[11px] font-mono font-bold w-12 text-right">00:00</span>
                            
                            <div class="relative flex-1 flex items-center h-5" id="progress-container">
                                <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full overflow-hidden pointer-events-none bg-white/20">
                                    <div id="intro-marker" class="absolute h-full bg-purple-500/90 hidden" style="z-index:1;"></div>
                                    <div id="outro-marker" class="absolute h-full bg-red-500/90 hidden" style="z-index:1;"></div>
                                </div>
                                <input type="range" id="progress-bar" class="blazex-slider absolute inset-0 w-full" value="0" min="0" step="0.1">
                            </div>

                            <span id="time-duration" class="text-gray-400 text-[11px] font-mono font-bold w-12">00:00</span>
                        </div>

                        <div class="w-full flex items-center justify-between">
                            <div class="flex items-center gap-5">
                                <button id="bottom-play-btn" class="text-white hover:text-[#F47521] heavy-transition w-8 flex justify-center"><i id="bottom-play-icon" class="fas fa-play text-xl"></i></button>
                            </div>
                            
                            <div class="flex items-center gap-5">
                                <button id="fs-btn" class="text-white hover:text-[#F47521] heavy-transition w-8 flex justify-center"><i id="fs-icon" class="fas fa-expand text-xl"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const video = document.getElementById('main-video-player');
        const overlay = document.getElementById('gesture-overlay');
        const uiLayer = document.getElementById('ui-layer');
        const progressBar = document.getElementById('progress-bar');
        const playBtnBottom = document.getElementById('bottom-play-btn');
        const playIconBottom = document.getElementById('bottom-play-icon');
        const playBtnCenter = document.getElementById('center-play-btn');
        const playIconCenter = document.getElementById('center-play-icon');
        const fsBtn = document.getElementById('fs-btn');
        const fsIcon = document.getElementById('fs-icon');
        const timeCurr = document.getElementById('time-current');
        const timeDur = document.getElementById('time-duration');
        const introMarker = document.getElementById('intro-marker');
        const outroMarker = document.getElementById('outro-marker');

        // --- SUBTITLES ---
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

        // --- HLS LOGIC ---
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                buildSettingsMenu(hlsInstance, video);
                populateEpisodesMenu();
                
                // Attempt to resume progress
                if (profile && profile.uid) {
                    const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.lastWatchedEp == currentEpNum && parsed.lastTime > 0) {
                            video.currentTime = parsed.lastTime;
                        }
                    }
                }
                video.play().catch(e => console.log("Autoplay blocked."));
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hlsInstance.recoverMediaError();
                    } else {
                        setBootStatus(`Stream Data Corrupted. Details: ${data.details}`, true);
                        hlsInstance.destroy();
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e=>e);
                buildSettingsMenu(null, video);
                populateEpisodesMenu();
            });
        }

        // --- UI AUTO-HIDE LOGIC ---
        let hideTimer;
        let isModalOpen = false;

        const resetHideTimer = () => {
            uiLayer.classList.remove('idle');
            playerRoot.style.cursor = 'default';
            clearTimeout(hideTimer);
            if (!video.paused && !isModalOpen) {
                hideTimer = setTimeout(() => {
                    uiLayer.classList.add('idle');
                    playerRoot.style.cursor = 'none';
                    closeAllModals();
                }, 4000);
            }
        };

        overlay.addEventListener('mousemove', resetHideTimer);
        overlay.addEventListener('touchstart', resetHideTimer, {passive: true});
        uiLayer.addEventListener('mousemove', resetHideTimer);
        playerRoot.addEventListener('mouseleave', () => { if(!video.paused && !isModalOpen) { uiLayer.classList.add('idle'); } });

        // --- PLAY/PAUSE LOGIC ---
        const togglePlay = () => {
            if (video.paused) video.play();
            else video.pause();
        };

        video.addEventListener('play', () => {
            playIconBottom.className = 'fas fa-pause text-lg';
            playIconCenter.className = 'fas fa-pause text-2xl ml-0';
            playBtnCenter.classList.add('opacity-0', 'scale-150'); 
            setTimeout(() => playBtnCenter.classList.add('hidden'), 400);
            resetHideTimer();
        });

        video.addEventListener('pause', () => {
            playIconBottom.className = 'fas fa-play text-lg';
            playIconCenter.className = 'fas fa-play text-2xl ml-1';
            playBtnCenter.classList.remove('hidden');
            setTimeout(() => playBtnCenter.classList.remove('opacity-0', 'scale-150'), 10);
            uiLayer.classList.remove('idle');
            clearTimeout(hideTimer);
        });

        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
        playBtnCenter.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

        // --- PROGRESS BAR LOGIC WITH HIGHLIGHTS ---
        const formatTime = (sec) => {
            if (isNaN(sec)) return "00:00";
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
            return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        };

        video.addEventListener('loadedmetadata', () => {
            progressBar.max = video.duration;
            timeDur.innerText = formatTime(video.duration);
            
            // Draw Intro/Outro Highlights
            if(introEnd > 0 && video.duration > 0) {
                introMarker.style.left = `${(introStart/video.duration)*100}%`;
                introMarker.style.width = `${((introEnd-introStart)/video.duration)*100}%`;
                introMarker.classList.remove('hidden');
            }
            if(outroEnd > 0 && video.duration > 0) {
                outroMarker.style.left = `${(outroStart/video.duration)*100}%`;
                outroMarker.style.width = `${((outroEnd-outroStart)/video.duration)*100}%`;
                outroMarker.classList.remove('hidden');
            }
        });

        video.addEventListener('timeupdate', () => {
            progressBar.value = video.currentTime;
            timeCurr.innerText = formatTime(video.currentTime);
            const pct = (video.currentTime / video.duration) * 100;
            // Native slider fill via CSS gradient
            progressBar.style.background = `linear-gradient(to right, #F47521 ${pct}%, transparent ${pct}%)`;

            if (Math.floor(video.currentTime) % 5 === 0 && video.currentTime > 0) saveProgress(video.currentTime);
        });

        progressBar.addEventListener('input', (e) => {
            video.currentTime = e.target.value;
            const pct = (e.target.value / video.duration) * 100;
            e.target.style.background = `linear-gradient(to right, #F47521 ${pct}%, transparent ${pct}%)`;
            resetHideTimer();
        });

        // --- FLAWLESS GESTURES: DOUBLE TAP & LONG PRESS ---
        let lastTapTime = 0;
        let tapTimeout;
        let pressTimer;
        let isLongPressing = false;
        const DOUBLE_TAP_DELAY = 250;

        const handleDoubleTap = (xPos) => {
            const rect = overlay.getBoundingClientRect();
            if (xPos > rect.width / 2) {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                const icon = document.getElementById('dt-right');
                icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 400);
            } else {
                video.currentTime = Math.max(0, video.currentTime - 10);
                const icon = document.getElementById('dt-left');
                icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 400);
            }
        };

        overlay.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                isLongPressing = true;
                video.playbackRate = 2.0;
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 500); 
        }, {passive: true});

        overlay.addEventListener('touchend', (e) => {
            clearTimeout(pressTimer);
            if (isLongPressing) {
                video.playbackRate = 1.0;
                document.getElementById('speed-indicator').classList.add('opacity-0');
                isLongPressing = false;
                return;
            }

            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            const clientX = e.changedTouches[0].clientX;
            
            if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
                clearTimeout(tapTimeout);
                handleDoubleTap(clientX);
                lastTapTime = 0; // Prevent triple tap bug
            } else {
                tapTimeout = setTimeout(() => {
                    togglePlay();
                    resetHideTimer();
                }, DOUBLE_TAP_DELAY);
                lastTapTime = currentTime;
            }
        });

        // Mouse Support for Desktop
        overlay.addEventListener('mousedown', (e) => {
            pressTimer = setTimeout(() => {
                isLongPressing = true;
                video.playbackRate = 2.0;
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 500);
        });

        overlay.addEventListener('mouseup', (e) => {
            clearTimeout(pressTimer);
            if (isLongPressing) {
                video.playbackRate = 1.0;
                document.getElementById('speed-indicator').classList.add('opacity-0');
                isLongPressing = false;
                return;
            }

            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            const clientX = e.clientX;
            
            if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
                clearTimeout(tapTimeout);
                handleDoubleTap(clientX);
                lastTapTime = 0; 
            } else {
                tapTimeout = setTimeout(() => {
                    togglePlay();
                    resetHideTimer();
                }, DOUBLE_TAP_DELAY);
                lastTapTime = currentTime;
            }
        });

        // --- FULLSCREEN ---
        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                else if (playerRoot.webkitRequestFullscreen) playerRoot.webkitRequestFullscreen();
                fsIcon.className = 'fas fa-compress text-lg';
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                fsIcon.className = 'fas fa-expand text-lg';
            }
        });

        // --- MODALS (Settings & Episodes) ---
        const settingsModal = document.getElementById('settings-modal');
        const episodesModal = document.getElementById('episodes-modal');

        const closeAllModals = () => {
            isModalOpen = false;
            settingsModal.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            settingsModal.classList.remove('translate-x-0');
            settingsModal.classList.add('translate-x-full');
            const masterIcon = document.getElementById('master-settings-icon');
            if(masterIcon) masterIcon.classList.remove('rotate-90');
            
            episodesModal.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            episodesModal.classList.remove('translate-y-0');
            episodesModal.classList.add('-translate-y-full');
        };

        document.getElementById('master-settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllModals();
            isModalOpen = true;
            settingsModal.classList.remove('hidden');
            setTimeout(() => {
                settingsModal.classList.remove('opacity-0', 'scale-95', 'pointer-events-none', 'translate-x-full');
                settingsModal.classList.add('translate-x-0');
                document.getElementById('master-settings-icon').classList.add('rotate-90');
            }, 10);
            clearTimeout(hideTimer);
        });

        document.getElementById('open-eps-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllModals();
            isModalOpen = true;
            episodesModal.classList.remove('hidden');
            setTimeout(() => {
                episodesModal.classList.remove('opacity-0', 'scale-95', 'pointer-events-none', '-translate-y-full');
                episodesModal.classList.add('translate-y-0');
            }, 10);
            clearTimeout(hideTimer);
        });

        document.getElementById('close-settings-btn').addEventListener('click', () => { closeAllModals(); resetHideTimer(); });
        document.getElementById('close-eps-btn').addEventListener('click', () => { closeAllModals(); resetHideTimer(); });

        function buildSettingsMenu(hls, vid) {
            const qList = document.getElementById('quality-list');
            const cList = document.getElementById('subs-list');
            
            // Qualities Extraction from M3U8
            if (hls && hls.levels && hls.levels.length > 0) {
                qList.innerHTML = `<button onclick="window.setQuality(-1)" class="w-full text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-black heavy-transition q-btn mb-1" data-level="-1">Auto Quality</button>`;
                
                const sortedLevels = hls.levels.map((l, i) => ({...l, oIdx: i})).sort((a,b) => b.height - a.height);
                
                sortedLevels.forEach(l => {
                    qList.innerHTML += `<button onclick="window.setQuality(${l.oIdx})" class="w-full text-left text-[10px] px-3 py-2 rounded bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5 heavy-transition q-btn mb-1" data-level="${l.oIdx}">${l.height}p</button>`;
                });
                
                window.setQuality = (levelIndex) => {
                    hls.currentLevel = levelIndex;
                    document.querySelectorAll('.q-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-level')) === levelIndex) b.className = 'w-full text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-black heavy-transition q-btn mb-1';
                        else b.className = 'w-full text-left text-[10px] px-3 py-2 rounded bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5 heavy-transition q-btn mb-1';
                    });
                };
            } else {
                qList.innerHTML = `<div class="bg-[#111] border border-white/5 text-[10px] text-gray-500 p-2 rounded text-center">Auto (Native)</div>`;
            }

            // Subtitles
            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button onclick="window.setCC(-1)" class="w-full text-left text-[10px] px-3 py-2 rounded bg-white/10 text-white hover:bg-white/20 border border-white/10 heavy-transition mb-1 c-btn" data-idx="-1">Turn Off Subs</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button onclick="window.setCC(${i})" class="w-full text-left text-[10px] px-3 py-2 rounded ${tk.mode==='showing' ? 'bg-[#F47521] text-black font-black' : 'bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5'} heavy-transition mb-1 c-btn" data-idx="${i}">${tk.label || 'Lang '+i}</button>`;
                }

                window.setCC = (idx) => {
                    for (let i=0; i<vid.textTracks.length; i++) { vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden'; }
                    document.querySelectorAll('.c-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'w-full text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-black heavy-transition mb-1 c-btn';
                        else b.className = 'w-full text-left text-[10px] px-3 py-2 rounded bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5 heavy-transition mb-1 c-btn';
                    });
                };
            } else {
                cList.innerHTML = `<div class="bg-[#111] border border-white/5 text-[10px] text-gray-500 p-2 rounded text-center">Hardcoded or None</div>`;
            }
        }

        function populateEpisodesMenu() {
            const grid = document.getElementById('in-player-ep-grid');
            if(!grid || episodesList.length === 0) return;
            
            // Get local history to dull watched episodes
            let historyList = [];
            if (profile && profile.uid) {
                const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
                if (stored) { try { historyList = JSON.parse(stored).watchedHistoryList || []; } catch(e){} }
            }
            
            grid.innerHTML = episodesList.map(ep => {
                const epNum = parseInt(ep.num || ep.episode_no);
                const slug = ep.slug || ep.id || String(epNum);
                const isCurrent = epNum === currentEpNum;
                const isWatched = historyList.includes(epNum) && !isCurrent;
                const isFiller = ep.isFiller === true;
                
                const isValid = (audioType === 'sub' && ep.isSub !== false) || (audioType === 'dub' && ep.isDub === true);
                if (!isValid) return `<div class="w-full aspect-square flex items-center justify-center rounded bg-black/50 border border-white/5 text-gray-700 text-xs font-black opacity-50 cursor-not-allowed">${epNum}</div>`;

                let btnClass = 'bg-[#111] border-white/5 text-white hover:border-[#F47521] hover:text-[#F47521]';
                if (isCurrent) btnClass = 'bg-[#F47521] border-[#F47521] text-black shadow-[0_0_10px_rgba(244,117,33,0.5)] scale-105 z-10';
                else if (isWatched) btnClass = 'bg-white/5 border-transparent text-gray-500 opacity-60 hover:opacity-100 hover:text-white';
                else if (isFiller) btnClass = 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white';

                return `<button onclick="window.app.resolveEpisodeStreamAndRoute('${slug}', ${epNum}, '${animeId}')" class="w-full aspect-square flex flex-col items-center justify-center rounded border transition-all duration-300 text-xs font-bold ${btnClass} relative">
                    ${epNum}
                    ${isFiller && !isCurrent ? '<div class="absolute top-1 right-1 w-1 h-1 bg-red-500 rounded-full"></div>' : ''}
                </button>`;
            }).join('');
        }

        // --- AUTO-SKIP LOGIC ---
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');

        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';
            
            if (introEnd > 0 && t >= introStart && t < introEnd) {
                if (autoSkipIntro) { video.currentTime = introEnd; } 
                else { skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); }
            } else { skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0'); }

            if (outroEnd > 0 && t >= outroStart && t < outroEnd) {
                if (autoSkipOutro) { if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); } 
                else { skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); }
            } else { skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0'); }
        });

        skipIntroBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); 
            else video.currentTime = video.duration; 
        });

        // Hide skip buttons after 5 seconds
        const hideSkipObserver = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (!m.target.classList.contains('opacity-0')) {
                    setTimeout(() => m.target.classList.add('translate-x-[150%]', 'opacity-0'), 5000);
                }
            });
        });
        hideSkipObserver.observe(skipIntroBtn, { attributes: true, attributeFilter: ['class'] });
        hideSkipObserver.observe(skipOutroBtn, { attributes: true, attributeFilter: ['class'] });

        // Save Progress
        function saveProgress(time) {
            if (profile && profile.uid) {
                const key = `blazex_progress_${profile.uid}_${animeId}`;
                let history = JSON.parse(localStorage.getItem(key)) || { watchedHistoryList: [] };
                history.lastWatchedEp = currentEpNum;
                history.lastSlug = episodeId;
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

    // --- TEARDOWN & CLEANUP ---
    // Ensure memory isn't leaked across routes
    window.app.components.player.destroy = () => {
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        const vid = document.getElementById('main-video-player');
        if (vid) {
            vid.pause();
            vid.removeAttribute('src');
            vid.load();
        }
        
        playerRoot.replaceWith(playerRoot.cloneNode(true));
        console.log("Player teardown complete. Ready for next route.");
    };
};

window.app.resolveEpisodeStreamAndRoute = (epId, epNum, animeId) => {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('id', epId); urlParams.set('ep', epNum); urlParams.set('anime', animeId);
    window.location.search = urlParams.toString();
};

window.app.changePlayerConfig = (param, value) => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get(param) === value) return;
    urlParams.set(param, value);
    window.location.search = urlParams.toString();
};
