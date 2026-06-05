// player.js - Custom Cinematic Video Engine

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    let hideTimer;
    let tapTimeout;
    let pressTimer;
    let hlsInstance = null;

    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500/20 rounded-xl z-50 absolute inset-0">
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
                        <div class="tk-loader scale-125 z-0 mb-6"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
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
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    let audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) {
        setBootStatus("Missing URL Parameters (Anime ID or Episode).", true);
        return;
    }

    // --- FETCH EPISODE METADATA ---
    const epsList = window.app.state?.currentEpisodesListProcessed || [];
    const currEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum) || {};
    const epTitleStr = currEpData.title || `Episode ${currentEpNum}`;
    const epDescStr = currEpData.description ? currEpData.description.substring(0, 80) + '...' : 'No description available for this episode.';

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    // Inject Player CSS safely (Custom Subtitle CSS & Sliders)
    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            :root { --sub-size: 16px; }
            input[type=range].blazex-slider { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; height: 6px; outline: none; }
            input[type=range].blazex-slider::-webkit-slider-runnable-track { background: rgba(255,255,255,0.2); height: 4px; border-radius: 4px; }
            input[type=range].blazex-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #F47521; margin-top: -4px; transition: transform 0.1s; }
            input[type=range].blazex-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }
            
            .player-ui-layer { transition: opacity 0.3s ease, background 0.3s ease; opacity: 1; }
            .player-ui-layer.idle { opacity: 0; cursor: none; }
            
            #blazex-player-root:fullscreen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
            #blazex-player-root:-webkit-full-screen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
            
            /* CUSTOM SUBTITLE ENGINE STYLES */
            video::cue {
                background-color: rgba(0, 0, 0, 0.7);
                color: #ffcc00;
                font-family: "Inter", "Segoe UI", sans-serif;
                font-weight: 700;
                font-size: var(--sub-size);
                text-shadow: 1px 1px 2px black, 0 0 1em black;
                padding: 4px 8px;
                border-radius: 4px;
            }
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
                setTimeout(() => reject(new Error("Timeout HLS engine.")), 5000);
            });
        } catch (e) {
            setBootStatus(`Engine Failure: ${e.message}`, true);
            return;
        }
    }

    try {
        setBootStatus(`Connecting to ${targetServer.toUpperCase()}...`);
        
        let streamData = null;
        
        const fetchStream = async (srv) => {
            try {
                const res = await fetch(`${baseUrl}/api/stream?id=${animeId}&ep=${currentEpNum}&server=${srv}&type=${audioType}`);
                const json = await res.json();
                if (json.success && json.data?.m3u8) return json.data;
            } catch (err) {}
            return null;
        };

        streamData = await fetchStream(targetServer);
        
        if (!streamData && targetServer === 'hd-1') {
            setBootStatus("HD-1 Offline. Auto-switching to HD-2...");
            targetServer = 'hd-2';
            streamData = await fetchStream(targetServer);
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('server', 'hd-2');
            window.history.replaceState({}, '', newUrl);
        }

        if (!streamData) throw new Error("All stream servers are unresponsive for this episode.");

        setBootStatus("Constructing Cinematic Pipeline...");

        const streamUrl = streamData.m3u8; 
        const targetReferer = streamData.referer || "https://vidwish.live/";
        const tracks = streamData.subtitles || []; 
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        const proxiedStreamUrl = customProxyUrl + encodeURIComponent(streamUrl) + '&referer=' + encodeURIComponent(targetReferer);

        const hasNextEp = epsList.some(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
        let nextEpSlug = null;
        if (hasNextEp) {
            const nextEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
            nextEpSlug = nextEpData.slug || nextEpData.id || String(currentEpNum + 1);
        }

        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black group flex items-center justify-center overflow-hidden">
                <!-- IMPORTANT: crossorigin="anonymous" is required to render external VTT subtitles -->
                <video id="main-video-player" crossorigin="anonymous" playsinline class="w-full h-full object-contain pointer-events-none"></video>
                
                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>

                <!-- BUFFERING ANIMATION -->
                <div id="buffering-spinner" class="absolute inset-0 flex items-center justify-center bg-black/40 z-20 hidden pointer-events-none transition-opacity">
                    <div class="tk-loader scale-150"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                </div>
                
                <div id="speed-indicator" class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-200 opacity-0 z-40 flex items-center gap-2 border border-white/10">
                    <span>2x Speed</span> <i class="fas fa-forward text-[#F47521]"></i>
                </div>

                <div id="dt-left" class="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-left text-2xl"></i><i class="fas fa-caret-left text-2xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1">10s</span>
                </div>
                <div id="dt-right" class="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-right text-2xl"></i><i class="fas fa-caret-right text-2xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1">10s</span>
                </div>

                <button id="skip-intro-btn" class="absolute bottom-20 right-4 bg-white/90 backdrop-blur-sm text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    Skip Intro <i class="fas fa-forward ml-1"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-20 right-4 bg-white/90 backdrop-blur-sm text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-1"></i>` : `Skip Outro <i class="fas fa-forward ml-1"></i>`}
                </button>

                <div id="ui-layer" class="player-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none">
                    
                    <!-- DYNAMIC HEADER -->
                    <div class="w-full flex items-start justify-between p-4 pointer-events-auto">
                        <div class="flex flex-col max-w-[70%]">
                            <div class="flex items-center gap-2">
                                <h2 class="text-white text-sm md:text-base font-bold tracking-wide truncate">${currentEpNum}. ${epTitleStr}</h2>
                                <button id="type-toggle-btn" class="bg-white/10 hover:bg-[#F47521] hover:text-black text-white px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors border border-white/20 flex items-center gap-1">
                                    ${audioType === 'sub' ? 'Switch to DUB' : 'Switch to SUB'} <i class="fas fa-exchange-alt"></i>
                                </button>
                            </div>
                            <p class="text-gray-400 text-xs mt-0.5 hidden md:block line-clamp-1">${epDescStr}</p>
                        </div>
                        ${targetServer === 'hd-2' ? '<span class="bg-[#F47521] text-black px-2 py-0.5 rounded text-[8px] font-black uppercase border border-black">HD-2</span>' : ''}
                    </div>
                    
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="w-16 h-16 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full text-white flex items-center justify-center hover:bg-[#F47521]/90 hover:border-[#F47521] hover:scale-110 transition-all">
                            <i id="center-play-icon" class="fas fa-play text-2xl ml-1"></i>
                        </button>
                    </div>

                    <div class="w-full flex flex-col px-4 pb-3 pt-4 pointer-events-auto">
                        
                        <div class="w-full flex items-center gap-3 mb-2">
                            <span id="time-current" class="text-white text-[10px] font-mono w-10 text-right">00:00</span>
                            <input type="range" id="progress-bar" class="blazex-slider flex-1" value="0" min="0" step="0.1">
                            <span id="time-duration" class="text-gray-400 text-[10px] font-mono w-10">00:00</span>
                        </div>

                        <div class="w-full flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <button id="bottom-play-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="bottom-play-icon" class="fas fa-play text-lg"></i></button>
                            </div>
                            
                            <div class="flex items-center gap-4 relative">
                                <!-- Audio Tracks Menu (Wider) -->
                                <div class="relative hidden group audio-container">
                                    <button id="audio-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-headphones text-lg"></i></button>
                                    <div id="audio-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 md:w-64 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="text-[10px] font-black uppercase text-gray-400 px-2 pb-2 border-b border-white/10 mb-2">Audio Track</div>
                                        <div id="audio-list" class="flex flex-col gap-1 max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Subtitles Menu (Wider & With Size Toggles) -->
                                <div class="relative group subs-container">
                                    <button id="subs-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-closed-captioning text-lg"></i></button>
                                    <div id="subs-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 md:w-64 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="flex items-center justify-between px-2 pb-2 border-b border-white/10 mb-2">
                                            <span class="text-[10px] font-black uppercase text-gray-400">Subtitles</span>
                                            <div class="flex items-center gap-2 bg-black/50 rounded px-2 py-1">
                                                <button class="sub-size-btn text-xs text-gray-400 hover:text-white" data-size="12px">A</button>
                                                <button class="sub-size-btn text-sm text-[#F47521] font-bold" data-size="16px">A</button>
                                                <button class="sub-size-btn text-base text-gray-400 hover:text-white" data-size="22px">A</button>
                                            </div>
                                        </div>
                                        <div id="subs-list" class="flex flex-col gap-1 max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Video Quality Menu (Wider) -->
                                <div class="relative group quality-container">
                                    <button id="quality-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-video text-lg"></i></button>
                                    <div id="quality-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 md:w-64 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="text-[10px] font-black uppercase text-gray-400 px-2 pb-2 border-b border-white/10 mb-2">Quality</div>
                                        <div id="quality-list" class="flex flex-col gap-1 max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <button id="fs-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="fs-icon" class="fas fa-expand text-lg"></i></button>
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
        const bufferingSpinner = document.getElementById('buffering-spinner');

        // Menus
        const audioBtn = document.getElementById('audio-btn');
        const audioMenu = document.getElementById('audio-menu');
        const subsBtn = document.getElementById('subs-btn');
        const subsMenu = document.getElementById('subs-menu');
        const qualityBtn = document.getElementById('quality-btn');
        const qualityMenu = document.getElementById('quality-menu');
        const typeToggleBtn = document.getElementById('type-toggle-btn');

        const closeAllMenus = () => {
            audioMenu.classList.add('hidden');
            subsMenu.classList.add('hidden');
            qualityMenu.classList.add('hidden');
        };

        // --- SUB/DUB TOGGLE LOGIC ---
        typeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newType = audioType === 'sub' ? 'dub' : 'sub';
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('type', newType);
            window.location.href = newUrl.toString(); // Hard reload ensures state is perfectly wiped and restarted
        });

        // --- SUBTITLE INJECTION ---
        tracks.forEach((track, index) => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track');
                trackEl.kind = track.kind;
                trackEl.label = track.label || `Track ${index+1}`;
                trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                // Proxy is critical here
                trackEl.src = customProxyUrl + encodeURIComponent(track.file) + '&referer=' + encodeURIComponent(targetReferer); 
                if (track.default) trackEl.default = true;
                video.appendChild(trackEl);
            }
        });

        // --- SUBTITLE SIZE STYLING LOGIC ---
        document.querySelectorAll('.sub-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const size = e.target.getAttribute('data-size');
                document.documentElement.style.setProperty('--sub-size', size);
                
                // Reset active styles
                document.querySelectorAll('.sub-size-btn').forEach(b => {
                    b.classList.remove('text-[#F47521]', 'font-bold');
                    b.classList.add('text-gray-400');
                });
                e.target.classList.remove('text-gray-400');
                e.target.classList.add('text-[#F47521]', 'font-bold');
            });
        });

        // --- BUFFERING EVENTS ---
        video.addEventListener('waiting', () => { bufferingSpinner.classList.remove('hidden'); });
        video.addEventListener('playing', () => { bufferingSpinner.classList.add('hidden'); });
        video.addEventListener('canplay', () => { bufferingSpinner.classList.add('hidden'); });

        // --- HLS LOGIC & PROGRESS RESUME ---
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                buildSettingsMenus(hlsInstance, video);
                
                const profile = window.app.state?.activeProfile || { uid: 'guest' };
                const epKey = `blazex_time_${profile.uid}_${animeId}_${currentEpNum}`;
                const storedTime = localStorage.getItem(epKey);
                
                if (storedTime && !isNaN(storedTime)) {
                    video.currentTime = parseFloat(storedTime);
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
                buildSettingsMenus(null, video);
            });
        }

        // --- UI AUTO-HIDE ---
        const resetHideTimer = () => {
            uiLayer.classList.remove('idle');
            playerRoot.style.cursor = 'default';
            clearTimeout(hideTimer);
            if (!video.paused) {
                hideTimer = setTimeout(() => {
                    uiLayer.classList.add('idle');
                    playerRoot.style.cursor = 'none';
                    closeAllMenus();
                }, 4000);
            }
        };

        playerRoot.addEventListener('mousemove', resetHideTimer);
        playerRoot.addEventListener('touchstart', resetHideTimer, {passive: true});
        playerRoot.addEventListener('mouseleave', () => { if(!video.paused) { uiLayer.classList.add('idle'); closeAllMenus(); } });
        uiLayer.addEventListener('click', closeAllMenus); 

        // --- PLAY/PAUSE LOGIC ---
        const togglePlay = () => {
            if (video.paused) video.play();
            else video.pause();
        };

        video.addEventListener('play', () => {
            playIconBottom.className = 'fas fa-pause text-lg';
            playIconCenter.className = 'fas fa-pause text-2xl ml-0';
            playBtnCenter.classList.add('opacity-0', 'scale-150'); 
            setTimeout(() => playBtnCenter.classList.add('hidden'), 300);
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

        // --- PROGRESS BAR ---
        const formatTime = (sec) => {
            if (isNaN(sec) || !isFinite(sec)) return "00:00";
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
            if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        };

        video.addEventListener('loadedmetadata', () => {
            progressBar.max = video.duration;
            timeDur.innerText = formatTime(video.duration);
        });

        video.addEventListener('timeupdate', () => {
            progressBar.value = video.currentTime;
            timeCurr.innerText = formatTime(video.currentTime);
            const pct = (video.currentTime / video.duration) * 100;
            progressBar.style.background = `linear-gradient(to right, #F47521 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
            if (Math.floor(video.currentTime) % 5 === 0) saveProgress(video.currentTime);
        });

        progressBar.addEventListener('input', (e) => {
            video.currentTime = e.target.value;
            const pct = (e.target.value / video.duration) * 100;
            e.target.style.background = `linear-gradient(to right, #F47521 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
        });

        // --- UNIFIED GESTURES: SINGLE CLICK / DOUBLE CLICK / LONG PRESS ---
        let lastTapTime = 0;
        let isLongPressing = false;

        const handleDoubleTap = (e) => {
            const rect = overlay.getBoundingClientRect();
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const x = clientX - rect.left;
            
            if (x > rect.width / 2) {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                const icon = document.getElementById('dt-right');
                icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 500);
            } else {
                video.currentTime = Math.max(0, video.currentTime - 10);
                const icon = document.getElementById('dt-left');
                icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 500);
            }
        };

        overlay.addEventListener('pointerdown', (e) => {
            pressTimer = setTimeout(() => {
                isLongPressing = true;
                video.playbackRate = 2.0;
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 600);
        });

        overlay.addEventListener('pointerup', (e) => {
            clearTimeout(pressTimer);
            if (isLongPressing) {
                video.playbackRate = 1.0;
                document.getElementById('speed-indicator').classList.add('opacity-0');
                isLongPressing = false;
                return;
            }

            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                clearTimeout(tapTimeout);
                handleDoubleTap(e);
            } else {
                // Single Click Play/Pause Toggle
                tapTimeout = setTimeout(() => {
                    togglePlay();
                    resetHideTimer();
                }, 300);
            }
            lastTapTime = currentTime;
        });

        // --- FULLSCREEN ---
        fsBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                else if (playerRoot.webkitRequestFullscreen) playerRoot.webkitRequestFullscreen();
                fsIcon.className = 'fas fa-compress text-lg';
                if (screen.orientation && screen.orientation.lock) {
                    try { await screen.orientation.lock('landscape'); } catch (err) { }
                }
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                fsIcon.className = 'fas fa-expand text-lg';
                if (screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); }
            }
        });

        // --- MENU TOGGLES ---
        audioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = audioMenu.classList.contains('hidden');
            closeAllMenus();
            if(isHidden) audioMenu.classList.remove('hidden');
            resetHideTimer();
        });

        subsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = subsMenu.classList.contains('hidden');
            closeAllMenus();
            if(isHidden) subsMenu.classList.remove('hidden');
            resetHideTimer();
        });

        qualityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = qualityMenu.classList.contains('hidden');
            closeAllMenus();
            if(isHidden) qualityMenu.classList.remove('hidden');
            resetHideTimer();
        });

        // --- BUILD POPUPS ---
        function buildSettingsMenus(hls, vid) {
            const qList = document.getElementById('quality-list');
            const cList = document.getElementById('subs-list');
            const aList = document.getElementById('audio-list');
            
            // Quality (Video)
            if (hls && hls.levels) {
                qList.innerHTML = `<button class="text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn" data-level="-1">Auto</button>`;
                hls.levels.forEach((l, i) => {
                    qList.innerHTML += `<button class="text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors q-btn" data-level="${i}">${l.height}p</button>`;
                });
                
                qList.onclick = (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('.q-btn');
                    if (!btn) return;
                    const levelIndex = parseInt(btn.getAttribute('data-level'));
                    hls.currentLevel = levelIndex;
                    document.querySelectorAll('.q-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-level')) === levelIndex) b.className = 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn';
                        else b.className = 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors mb-1 q-btn';
                    });
                    closeAllMenus();
                };
            } else {
                qList.innerHTML = `<span class="text-xs text-gray-500 px-2">Auto (Native)</span>`;
            }

            // Subtitles
            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button class="text-left text-xs px-3 py-2 rounded bg-white/10 text-white hover:bg-white/20 mb-1 c-btn" data-idx="-1">Off</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button class="text-left text-xs px-3 py-2 rounded ${tk.mode==='showing' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 c-btn" data-idx="${i}">${tk.label || 'Lang '+i}</button>`;
                }

                cList.onclick = (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('.c-btn');
                    if (!btn) return;
                    // Dont close menu if clicking the size buttons
                    if (e.target.classList.contains('sub-size-btn')) return;

                    const idx = parseInt(btn.getAttribute('data-idx'));
                    for (let i=0; i<vid.textTracks.length; i++) {
                        vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden';
                    }
                    document.querySelectorAll('.c-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 c-btn';
                        else b.className = 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 c-btn';
                    });
                    closeAllMenus();
                };
            } else {
                cList.innerHTML = `<span class="text-xs text-gray-500 px-2">No Subtitles Provided By Server</span>`;
            }

            // Audio Tracks (HLS Multi-Audio)
            if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
                document.querySelector('.audio-container').classList.remove('hidden');
                aList.innerHTML = '';
                hls.audioTracks.forEach((t, i) => {
                    aList.innerHTML += `<button class="text-left text-xs px-3 py-2 rounded ${hls.audioTrack === i ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 a-btn" data-idx="${i}">${t.name || 'Audio '+i}</button>`;
                });
                
                aList.onclick = (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('.a-btn');
                    if(!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    hls.audioTrack = idx;
                    document.querySelectorAll('.a-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 a-btn';
                        else b.className = 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 a-btn';
                    });
                    closeAllMenus();
                };
            }
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
            if(hasNextEp && window.app?.resolveEpisodeStreamAndRoute) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); 
            else video.currentTime = video.duration; 
        });

        // --- PROGRESS SAVING ---
        function saveProgress(time) {
            const profile = window.app.state?.activeProfile || { uid: 'guest' };
            const uid = profile.uid;
            
            const epKey = `blazex_time_${uid}_${animeId}_${currentEpNum}`;
            localStorage.setItem(epKey, time);
            
            const seriesKey = `blazex_series_${uid}_${animeId}`;
            let seriesData = JSON.parse(localStorage.getItem(seriesKey)) || { watchedEps: [], lastWatchedEp: currentEpNum };
            seriesData.lastWatchedEp = currentEpNum;
            
            if (video.duration && time > (video.duration * 0.85)) {
                if (!seriesData.watchedEps.includes(currentEpNum)) {
                    seriesData.watchedEps.push(currentEpNum);
                }
            }
            
            localStorage.setItem(seriesKey, JSON.stringify(seriesData));
        }

    } catch (error) {
        setBootStatus(error.message, true);
    }

    window.app.components.player.destroy = () => {
        clearTimeout(hideTimer);
        clearTimeout(tapTimeout);
        clearTimeout(pressTimer);
        
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        const vid = document.getElementById('main-video-player');
        if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
        
        playerRoot.replaceWith(playerRoot.cloneNode(true));
    };
};
