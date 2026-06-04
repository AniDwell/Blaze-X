// play.js - Cinematic Heavy Player Engine (v2.1 - API Fixed & Robust)

window.app.components.play = async () => {
    const workspace = document.getElementById('player-workspace');
    if (!workspace) return;

    // --- DIAGNOSTIC BOOT HUD ---
    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            workspace.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-[60vh] bg-[#050505] border border-red-500/20 rounded-xl shadow-2xl">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4 animate-pulse"></i>
                    <h3 class="text-white font-black text-lg uppercase tracking-widest">Playback Halted</h3>
                    <p class="text-red-400 font-mono text-xs mt-2 bg-red-500/10 px-4 py-2 rounded border border-red-500/20 max-w-md">${msg}</p>
                    <button onclick="window.location.reload()" class="mt-6 border border-white/10 bg-white/5 px-8 py-3 rounded-xl text-xs font-black uppercase text-white hover:bg-[#F47521] hover:text-black transition-all duration-300">Reboot Stream</button>
                </div>
            `;
        } else {
            if (!document.getElementById('boot-overlay')) {
                workspace.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-center p-6 w-full h-[60vh] bg-[#050505] rounded-xl border border-white/5" id="boot-overlay">
                        <div class="tk-loader scale-150 z-0 mb-8"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
                        <p id="boot-status-text" class="text-[#F47521] font-mono font-black uppercase tracking-widest text-[10px] md:text-xs px-6 py-2 rounded shadow-2xl animate-pulse bg-[#F47521]/10 border border-[#F47521]/20">${msg}</p>
                    </div>
                `;
            } else {
                const statusEl = document.getElementById('boot-status-text');
                if (statusEl) statusEl.innerText = msg;
            }
        }
    };

    setBootStatus("Initializing Engine...");

    // 🚀 FIXED: PROPER PARAMETER EXTRACTION
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); // For Info & Episodes (e.g. re-zero-...)
    const episodeId = urlParams.get('id'); // For Stream API (e.g. 1)
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    let audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !episodeId) {
        setBootStatus("Missing core URL parameters (anime or id).", true);
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    const profile = window.app.state?.activeProfile || null;
    let autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
    let autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

    // Inject Custom Heavy CSS
    if (!document.getElementById('blazex-heavy-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-heavy-css';
        style.innerHTML = `
            .heavy-transition { transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); }
            .player-ui-layer { opacity: 1; transition: opacity 0.5s ease; }
            .player-ui-layer.idle { opacity: 0; cursor: none; pointer-events: none; }
            
            /* Custom Premium Progress Bar */
            .custom-slider-container { position: relative; width: 100%; height: 24px; display: flex; align-items: center; cursor: pointer; }
            .custom-slider-track { position: absolute; top: 50%; transform: translateY(-50%); width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; transition: height 0.2s; }
            .custom-slider-container:hover .custom-slider-track { height: 6px; }
            .custom-slider-fill { position: absolute; top: 0; left: 0; height: 100%; background: #F47521; width: 0%; pointer-events: none; transition: width 0.1s linear; }
            .custom-slider-marker { position: absolute; top: 0; height: 100%; background: rgba(168, 85, 247, 0.7); pointer-events: none; } 
            .custom-slider-thumb { position: absolute; top: 50%; left: 0%; transform: translate(-50%, -50%) scale(0); width: 14px; height: 14px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5); pointer-events: none; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            .custom-slider-container:hover .custom-slider-thumb { transform: translate(-50%, -50%) scale(1); }
            
            /* Fullscreen Fixes */
            #blazex-player-root:fullscreen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
            #blazex-player-root:-webkit-full-screen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
        `;
        document.head.appendChild(style);
    }

    // Load HLS.js safely
    if (typeof window.Hls === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (e) {
            setBootStatus(`HLS Engine injection failed. Check connection.`, true);
            return;
        }
    }

    try {
        setBootStatus(`Connecting to Server ${targetServer.toUpperCase()}...`);
        
        let streamData = null;
        let episodesList = [];
        let animeInfo = {};

        // 🚀 FIXED: Fetch Stream using `episodeId` instead of `animeId`
        const [streamRes, epsRes, infoRes] = await Promise.all([
            fetch(`${baseUrl}/api/stream?id=${episodeId}&server=${targetServer}&type=${audioType}`).then(r => r.json()).catch(()=>null),
            fetch(`${baseUrl}/api/episodes/${animeId}`).then(r => r.json()).catch(()=>null),
            fetch(`${baseUrl}/api/info?id=${animeId}`).then(r => r.json()).catch(()=>null)
        ]);

        if (streamRes && streamRes.success && streamRes.data?.m3u8) {
            streamData = streamRes.data;
        } else {
            setBootStatus("Primary server offline. Auto-switching to fallback HD-2...");
            const fallbackServer = targetServer === 'hd-1' ? 'hd-2' : 'hd-1';
            const fbRes = await fetch(`${baseUrl}/api/stream?id=${episodeId}&server=${fallbackServer}&type=${audioType}`).then(r=>r.json()).catch(()=>null);
            
            if (fbRes && fbRes.success && fbRes.data?.m3u8) {
                streamData = fbRes.data;
                targetServer = fallbackServer;
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('server', targetServer);
                window.history.replaceState({}, '', newUrl);
            } else {
                throw new Error("All streaming servers are unresponsive for this episode. Please try another server or Audio Type.");
            }
        }

        if (infoRes && infoRes.success) animeInfo = infoRes.data;
        if (epsRes && epsRes.success) {
            if (Array.isArray(epsRes.data)) episodesList = epsRes.data;
            else if (epsRes.results && Array.isArray(epsRes.results.episodes)) episodesList = epsRes.results.episodes;
        }

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

        const animeTitle = animeInfo.title || animeId.replace(/-/g, ' ').toUpperCase();

        // 🚀 MASTER PLAYER UI HTML
        workspace.innerHTML = `
            <div class="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in opacity-0 heavy-transition" id="play-content-wrapper">
                
                <div id="blazex-player-root" class="w-full aspect-video md:aspect-[21/9] bg-black rounded-xl shadow-2xl border border-white/5 overflow-hidden flex flex-col relative group select-none">
                    
                    <video id="main-video-player" playsinline class="w-full h-full object-contain pointer-events-none absolute inset-0"></video>
                    
                    <!-- Gesture Overlay (Handles Taps) -->
                    <div id="gesture-overlay" class="absolute inset-0 z-10 cursor-pointer"></div>
                    
                    <!-- 2x Speed Indicator -->
                    <div id="speed-indicator" class="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-300 opacity-0 z-40 flex items-center gap-2 border border-[#F47521]/30 shadow-[0_0_15px_rgba(244,117,33,0.3)] pointer-events-none">
                        <span>2x Speed</span> <i class="fas fa-forward text-[#F47521]"></i>
                    </div>

                    <!-- Double Tap Feedback -->
                    <div id="dt-left" class="absolute left-1/4 top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center text-white/90 opacity-0 transition-opacity duration-300 z-20 pointer-events-none bg-black/40 p-4 rounded-full backdrop-blur-sm">
                        <div class="flex"><i class="fas fa-caret-left text-3xl"></i><i class="fas fa-caret-left text-3xl -ml-2"></i></div>
                        <span class="text-xs font-black mt-1">10s</span>
                    </div>
                    <div id="dt-right" class="absolute right-1/4 top-1/2 -translate-y-1/2 translate-x-1/2 flex flex-col items-center text-white/90 opacity-0 transition-opacity duration-300 z-20 pointer-events-none bg-black/40 p-4 rounded-full backdrop-blur-sm">
                        <div class="flex"><i class="fas fa-caret-right text-3xl"></i><i class="fas fa-caret-right text-3xl -ml-2"></i></div>
                        <span class="text-xs font-black mt-1">10s</span>
                    </div>

                    <!-- Skip Buttons -->
                    <button id="skip-intro-btn" class="absolute bottom-24 right-6 bg-white/95 backdrop-blur-md text-black font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-lg shadow-2xl heavy-transition transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white hover:scale-105 z-40 border border-white/20">
                        Skip Intro <i class="fas fa-forward ml-2"></i>
                    </button>
                    <button id="skip-outro-btn" class="absolute bottom-24 right-6 bg-white/95 backdrop-blur-md text-black font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-lg shadow-2xl heavy-transition transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white hover:scale-105 z-40 border border-white/20">
                        ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-2"></i>` : `Skip Outro <i class="fas fa-forward ml-2"></i>`}
                    </button>

                    <!-- UI CONTROLS LAYER -->
                    <div id="ui-layer" class="player-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/95 via-transparent to-black/80 pointer-events-none">
                        
                        <!-- Top Bar (Title & Settings) -->
                        <div class="w-full flex items-center justify-between p-4 md:p-6 pointer-events-auto">
                            <button id="in-player-ep-btn" class="flex flex-col items-start hover:bg-white/10 p-2 -m-2 rounded-lg heavy-transition group">
                                <span class="text-[#F47521] text-[9px] font-black uppercase tracking-widest mb-0.5 group-hover:text-white">${animeTitle}</span>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-white text-sm md:text-lg font-black tracking-wide drop-shadow-md">Episode ${currentEpNum}</h2>
                                    <i class="fas fa-chevron-down text-gray-400 text-[10px] group-hover:translate-y-0.5 heavy-transition"></i>
                                </div>
                            </button>
                            
                            <div class="flex items-center gap-3">
                                ${targetServer === 'hd-2' ? '<span class="bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-sm">Server 2</span>' : ''}
                                <button id="master-settings-btn" class="w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white hover:text-[#F47521] hover:border-[#F47521] heavy-transition flex items-center justify-center backdrop-blur-md">
                                    <i class="fas fa-cog text-lg transition-transform duration-500" id="master-settings-icon"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Center Play/Pause (Animated) -->
                        <div class="flex items-center justify-center pointer-events-none">
                            <div id="center-play-anim" class="w-20 h-20 bg-black/50 backdrop-blur-md border-2 border-white/20 rounded-full text-white flex items-center justify-center opacity-0 scale-150 heavy-transition">
                                <i id="center-anim-icon" class="fas fa-play text-3xl ml-1"></i>
                            </div>
                        </div>

                        <!-- Bottom Controls -->
                        <div class="w-full flex flex-col px-4 md:px-6 pb-4 pt-8 pointer-events-auto">
                            
                            <!-- Custom Interactive Progress Bar -->
                            <div class="w-full flex items-center gap-4 mb-3">
                                <span id="time-current" class="text-white text-[11px] font-mono font-bold w-12 text-right">00:00</span>
                                
                                <div id="progress-container" class="custom-slider-container flex-1">
                                    <div class="custom-slider-track">
                                        <div id="intro-marker" class="custom-slider-marker hidden"></div>
                                        <div id="outro-marker" class="custom-slider-marker hidden"></div>
                                        <div id="progress-fill" class="custom-slider-fill"></div>
                                    </div>
                                    <div id="progress-thumb" class="custom-slider-thumb"></div>
                                </div>

                                <span id="time-duration" class="text-gray-400 text-[11px] font-mono font-bold w-12">00:00</span>
                            </div>

                            <!-- Action Buttons -->
                            <div class="w-full flex items-center justify-between">
                                <div class="flex items-center gap-5">
                                    <button id="bottom-play-btn" class="text-white hover:text-[#F47521] heavy-transition w-8 flex justify-center"><i id="bottom-play-icon" class="fas fa-play text-xl"></i></button>
                                    <button id="vol-btn" class="text-white hover:text-[#F47521] heavy-transition hidden sm:block w-8 flex justify-center"><i id="vol-icon" class="fas fa-volume-up text-lg"></i></button>
                                </div>
                                <div class="flex items-center gap-5">
                                    <button id="skip-fwd-btn" class="text-white hover:text-[#F47521] heavy-transition w-8 flex justify-center hidden sm:block"><i class="fas fa-forward text-lg"></i></button>
                                    <button id="fs-btn" class="text-white hover:text-[#F47521] heavy-transition w-8 flex justify-center"><i id="fs-icon" class="fas fa-expand text-xl"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- OVERLAYS (Settings & Episodes) -->
                    
                    <!-- Settings Modal -->
                    <div id="settings-modal" class="absolute inset-y-0 right-0 w-full sm:w-80 bg-black/95 backdrop-blur-2xl border-l border-white/10 z-[60] transform translate-x-full heavy-transition flex flex-col pointer-events-auto">
                        <div class="p-4 border-b border-white/10 flex items-center justify-between bg-[#111]">
                            <h3 class="text-white font-black uppercase tracking-widest text-sm"><i class="fas fa-sliders-h text-[#F47521] mr-2"></i> Player Settings</h3>
                            <button id="close-settings-btn" class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 heavy-transition"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-6">
                            
                            <!-- Quality -->
                            <div>
                                <h4 class="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-2">Video Quality</h4>
                                <div id="settings-quality-list" class="flex flex-col gap-1"></div>
                            </div>

                            <!-- Audio / Server -->
                            <div>
                                <h4 class="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-2">Audio & Server</h4>
                                <div class="grid grid-cols-2 gap-2 mb-2">
                                    <button onclick="window.app.changePlayerConfig('type', 'sub')" class="py-2 rounded-lg text-xs font-bold ${audioType === 'sub' ? 'bg-[#F47521] text-black' : 'bg-[#111] text-white border border-white/10 hover:bg-white/10'} heavy-transition">Sub</button>
                                    <button onclick="window.app.changePlayerConfig('type', 'dub')" class="py-2 rounded-lg text-xs font-bold ${audioType === 'dub' ? 'bg-[#F47521] text-black' : 'bg-[#111] text-white border border-white/10 hover:bg-white/10'} heavy-transition">Dub</button>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <button onclick="window.app.changePlayerConfig('server', 'hd-1')" class="py-2 rounded-lg text-xs font-bold ${targetServer === 'hd-1' ? 'bg-white text-black' : 'bg-[#111] text-white border border-white/10 hover:bg-white/10'} heavy-transition">HD-1</button>
                                    <button onclick="window.app.changePlayerConfig('server', 'hd-2')" class="py-2 rounded-lg text-xs font-bold ${targetServer === 'hd-2' ? 'bg-white text-black' : 'bg-[#111] text-white border border-white/10 hover:bg-white/10'} heavy-transition">HD-2</button>
                                </div>
                            </div>

                            <!-- Subtitles -->
                            <div>
                                <h4 class="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-2">Captions / Subtitles</h4>
                                <div id="settings-subs-list" class="flex flex-col gap-1"></div>
                            </div>

                        </div>
                    </div>

                    <!-- Episodes In-Player Modal -->
                    <div id="episodes-modal" class="absolute inset-0 bg-black/95 backdrop-blur-2xl z-[60] flex flex-col transform -translate-y-full heavy-transition pointer-events-auto">
                        <div class="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-b from-[#111] to-transparent">
                            <h3 class="text-white font-black uppercase tracking-widest text-sm"><i class="fas fa-list text-[#F47521] mr-2"></i> Select Episode</h3>
                            <button id="close-episodes-btn" class="text-gray-400 hover:text-white w-8 h-8 flex justify-center items-center rounded-full bg-white/5 hover:bg-[#F47521] hover:text-black heavy-transition"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="flex-1 overflow-y-auto hide-scrollbar p-4">
                            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-12 gap-2" id="in-player-ep-grid"></div>
                        </div>
                    </div>

                </div>
                
                <!-- OUTSIDE PLAYER CONTROLS -->
                <div class="w-full flex items-center justify-between gap-4 bg-[#0a0a0a] p-4 rounded-xl border border-white/5 shadow-md mt-2">
                    <h1 class="text-lg md:text-xl font-black text-white tracking-tight leading-tight truncate flex-1">E${currentEpNum}: ${animeTitle}</h1>
                    <div class="flex items-center gap-5 text-[10px] font-black uppercase tracking-wider text-gray-400 shrink-0">
                        <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" id="toggle-skip-intro" class="hidden" onchange="window.app.toggleAutoSkip('intro')" ${autoSkipIntro ? 'checked' : ''}>
                            <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg"><div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div></div>
                            Skip Intro
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" id="toggle-skip-outro" class="hidden" onchange="window.app.toggleAutoSkip('outro')" ${autoSkipOutro ? 'checked' : ''}>
                            <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg"><div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div></div>
                            Skip Outro
                        </label>
                    </div>
                </div>
            </div>
        `;

        const tStyle = document.createElement('style');
        tStyle.innerHTML = `input:checked + .toggle-bg { background-color: #F47521; border-color: #F47521; } input:checked + .toggle-bg .toggle-dot { transform: translateX(14px); background-color: black; }`;
        document.head.appendChild(tStyle);

        setTimeout(() => { 
            const wrapper = document.getElementById('play-content-wrapper');
            if(wrapper) wrapper.classList.remove('opacity-0'); 
        }, 150);

        // --- DOM REFERENCES ---
        const video = document.getElementById('main-video-player');
        const overlay = document.getElementById('gesture-overlay');
        const uiLayer = document.getElementById('ui-layer');
        const playBtnBottom = document.getElementById('bottom-play-btn');
        const playIconBottom = document.getElementById('bottom-play-icon');
        const centerAnim = document.getElementById('center-play-anim');
        const centerAnimIcon = document.getElementById('center-anim-icon');
        const fsBtn = document.getElementById('fs-btn');
        const timeCurr = document.getElementById('time-current');
        const timeDur = document.getElementById('time-duration');
        
        const progContainer = document.getElementById('progress-container');
        const progFill = document.getElementById('progress-fill');
        const progThumb = document.getElementById('progress-thumb');
        const introMarker = document.getElementById('intro-marker');
        const outroMarker = document.getElementById('outro-marker');

        let hlsInstance = null;

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

        // --- HLS ENGINE ---
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                buildSettingsMenu(hlsInstance, video);
                // Resume Progress
                if (profile && profile.uid) {
                    const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.lastWatchedEp == currentEpNum && parsed.lastTime > 0) {
                            video.currentTime = parsed.lastTime;
                        }
                    }
                }
                video.play().catch(e=>console.log("Autoplay blocked by browser"));
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
                    else { setBootStatus(`HLS Fatal Error: ${data.details}`, true); hlsInstance.destroy(); }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => { video.play().catch(e=>e); buildSettingsMenu(null, video); });
        }

        // --- PROGRESS BAR LOGIC (CUSTOM) ---
        const formatTime = (sec) => {
            if (isNaN(sec)) return "00:00";
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
            return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        };

        video.addEventListener('loadedmetadata', () => {
            timeDur.innerText = formatTime(video.duration);
            // Draw Highlight Markers for Intro/Outro
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
            if (isDraggingProgress) return;
            const pct = (video.currentTime / video.duration) * 100;
            progFill.style.width = `${pct}%`;
            progThumb.style.left = `${pct}%`;
            timeCurr.innerText = formatTime(video.currentTime);
            
            // Auto Save Progress every 5 sec
            if (Math.floor(video.currentTime) % 5 === 0 && video.currentTime > 0) saveProgress(video.currentTime);
        });

        let isDraggingProgress = false;
        const updateProgressFromEvent = (e) => {
            const rect = progContainer.getBoundingClientRect();
            let pct = (e.clientX || (e.touches ? e.touches[0].clientX : 0)) - rect.left;
            pct = Math.max(0, Math.min(1, pct / rect.width));
            progFill.style.width = `${pct * 100}%`;
            progThumb.style.left = `${pct * 100}%`;
            timeCurr.innerText = formatTime(pct * video.duration);
            return pct;
        };

        progContainer.addEventListener('mousedown', (e) => { isDraggingProgress = true; updateProgressFromEvent(e); });
        progContainer.addEventListener('touchstart', (e) => { isDraggingProgress = true; updateProgressFromEvent(e); }, {passive: true});
        
        document.addEventListener('mousemove', (e) => { if(isDraggingProgress) updateProgressFromEvent(e); });
        document.addEventListener('touchmove', (e) => { if(isDraggingProgress) updateProgressFromEvent(e); }, {passive: true});
        
        document.addEventListener('mouseup', (e) => { if(isDraggingProgress) { video.currentTime = updateProgressFromEvent(e) * video.duration; isDraggingProgress = false; } });
        document.addEventListener('touchend', (e) => { if(isDraggingProgress) { isDraggingProgress = false; } });

        // --- PLAY/PAUSE ANIMATION ---
        const triggerCenterAnim = (iconClass) => {
            centerAnimIcon.className = `${iconClass} text-3xl`;
            if (iconClass.includes('play')) centerAnimIcon.classList.add('ml-1'); else centerAnimIcon.classList.remove('ml-1');
            
            centerAnim.classList.remove('opacity-0', 'scale-150');
            centerAnim.classList.add('opacity-100', 'scale-100');
            setTimeout(() => {
                centerAnim.classList.remove('opacity-100', 'scale-100');
                centerAnim.classList.add('opacity-0', 'scale-150');
            }, 400);
        };

        const togglePlayPause = () => {
            if (video.paused) { video.play(); triggerCenterAnim('fas fa-play'); }
            else { video.pause(); triggerCenterAnim('fas fa-pause'); }
        };

        video.addEventListener('play', () => { playIconBottom.className = 'fas fa-pause text-xl'; resetHideTimer(); });
        video.addEventListener('pause', () => { playIconBottom.className = 'fas fa-play text-xl ml-0.5'; uiLayer.classList.remove('idle'); clearTimeout(hideTimer); });
        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });

        // --- AUTO-HIDE UI ---
        let hideTimer;
        const resetHideTimer = () => {
            uiLayer.classList.remove('idle');
            workspace.style.cursor = 'default';
            clearTimeout(hideTimer);
            if (!video.paused) {
                hideTimer = setTimeout(() => {
                    if(!isSettingsOpen && !isEpisodesOpen) {
                        uiLayer.classList.add('idle');
                        workspace.style.cursor = 'none';
                    }
                }, 4000);
            }
        };

        overlay.addEventListener('mousemove', resetHideTimer);
        uiLayer.addEventListener('mousemove', resetHideTimer);

        // --- GESTURES (HEAVY DELAY LOGIC) ---
        let lastTapTime = 0;
        let tapTimeout;
        let pressTimer;
        let isLongPressing = false;

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
            resetHideTimer();
        };

        const handleGestureStart = () => {
            pressTimer = setTimeout(() => {
                isLongPressing = true;
                video.playbackRate = 2.0;
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 500); 
        };

        const handleGestureEnd = (xPos) => {
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
                clearTimeout(tapTimeout); // Cancel single tap
                handleDoubleTap(xPos);
            } else {
                // Wait 300ms to confirm it's not a double tap
                tapTimeout = setTimeout(() => {
                    if(!isLongPressing) {
                        if(uiLayer.classList.contains('idle')) resetHideTimer();
                        else togglePlayPause();
                    }
                }, 300);
            }
            lastTapTime = currentTime;
        };

        overlay.addEventListener('touchstart', (e) => handleGestureStart(), {passive: true});
        overlay.addEventListener('touchend', (e) => handleGestureEnd(e.changedTouches[0].clientX));
        overlay.addEventListener('mousedown', (e) => handleGestureStart());
        overlay.addEventListener('mouseup', (e) => handleGestureEnd(e.clientX));

        // --- FULLSCREEN ---
        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const root = document.getElementById('blazex-player-root');
            if (!document.fullscreenElement) {
                if (root.requestFullscreen) root.requestFullscreen();
                else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
                document.getElementById('fs-icon').className = 'fas fa-compress text-xl';
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                document.getElementById('fs-icon').className = 'fas fa-expand text-xl';
            }
        });

        // --- MODALS (Settings & Episodes) ---
        let isSettingsOpen = false;
        let isEpisodesOpen = false;
        const setModal = document.getElementById('settings-modal');
        const epModal = document.getElementById('episodes-modal');

        document.getElementById('master-settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            isSettingsOpen = true;
            setModal.classList.remove('translate-x-full');
            document.getElementById('master-settings-icon').classList.add('rotate-90');
            resetHideTimer();
        });
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            isSettingsOpen = false;
            setModal.classList.add('translate-x-full');
            document.getElementById('master-settings-icon').classList.remove('rotate-90');
            resetHideTimer();
        });

        document.getElementById('in-player-ep-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            isEpisodesOpen = true;
            epModal.classList.remove('-translate-y-full');
            populateInPlayerEpisodes();
            resetHideTimer();
        });
        document.getElementById('close-episodes-btn').addEventListener('click', () => {
            isEpisodesOpen = false;
            epModal.classList.add('-translate-y-full');
            resetHideTimer();
        });

        function buildSettingsMenu(hls, vid) {
            const qList = document.getElementById('settings-quality-list');
            const cList = document.getElementById('settings-subs-list');
            
            // Qualities (Upto 144p dynamically from m3u8)
            if (hls && hls.levels && hls.levels.length > 0) {
                qList.innerHTML = `<button onclick="window.setQuality(-1)" class="w-full text-left text-xs px-4 py-3 rounded-lg bg-[#F47521] text-black font-black heavy-transition q-btn" data-level="-1">Auto Quality</button>`;
                
                const sortedLevels = hls.levels.map((l, i) => ({...l, oIdx: i})).sort((a,b) => b.height - a.height);
                
                sortedLevels.forEach(l => {
                    qList.innerHTML += `<button onclick="window.setQuality(${l.oIdx})" class="w-full text-left text-xs px-4 py-3 rounded-lg bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5 heavy-transition q-btn" data-level="${l.oIdx}">${l.height}p</button>`;
                });
                
                window.setQuality = (levelIndex) => {
                    hls.currentLevel = levelIndex;
                    document.querySelectorAll('.q-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-level')) === levelIndex) b.className = 'w-full text-left text-xs px-4 py-3 rounded-lg bg-[#F47521] text-black font-black heavy-transition q-btn';
                        else b.className = 'w-full text-left text-xs px-4 py-3 rounded-lg bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5 heavy-transition q-btn';
                    });
                };
            } else {
                qList.innerHTML = `<div class="bg-[#111] border border-white/5 text-xs text-gray-500 p-3 rounded-lg text-center">Auto (Native API)</div>`;
            }

            // Subtitles
            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button onclick="window.setCC(-1)" class="w-full text-left text-xs px-4 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 border border-white/10 heavy-transition mb-2 c-btn" data-idx="-1">Turn Off Subs</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button onclick="window.setCC(${i})" class="w-full text-left text-xs px-4 py-3 rounded-lg ${tk.mode==='showing' ? 'bg-[#F47521] text-black font-black' : 'bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5'} heavy-transition mb-2 c-btn" data-idx="${i}">${tk.label || 'Lang '+i}</button>`;
                }

                window.setCC = (idx) => {
                    for (let i=0; i<vid.textTracks.length; i++) { vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden'; }
                    document.querySelectorAll('.c-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'w-full text-left text-xs px-4 py-3 rounded-lg bg-[#F47521] text-black font-black heavy-transition mb-2 c-btn';
                        else b.className = 'w-full text-left text-xs px-4 py-3 rounded-lg bg-[#111] text-gray-300 hover:bg-white/10 border border-white/5 heavy-transition mb-2 c-btn';
                    });
                };
            } else {
                cList.innerHTML = `<div class="bg-[#111] border border-white/5 text-xs text-gray-500 p-3 rounded-lg text-center">Hardcoded or Not Available</div>`;
            }
        }

        function populateInPlayerEpisodes() {
            const grid = document.getElementById('in-player-ep-grid');
            if(!grid || episodesList.length === 0) return;
            
            grid.innerHTML = episodesList.map(ep => {
                const epNum = ep.num || ep.episode_no;
                const slug = ep.slug || ep.id || String(epNum);
                const isCurrent = parseInt(epNum) === currentEpNum;
                const isSubSupported = audioType === 'sub' && ep.isSub !== false;
                const isDubSupported = audioType === 'dub' && ep.isDub === true;
                const isValid = isSubSupported || isDubSupported;

                if (!isValid) return `<div class="w-full aspect-square flex items-center justify-center rounded-lg bg-black/50 border border-white/5 text-gray-700 text-xs font-black opacity-50 cursor-not-allowed">${epNum}</div>`;

                return `<button onclick="window.app.resolveEpisodeStreamAndRoute('${slug}', ${epNum}, '${animeId}')" class="w-full aspect-square flex items-center justify-center rounded-lg border ${isCurrent ? 'bg-[#F47521] border-[#F47521] text-black font-black shadow-[0_0_15px_rgba(244,117,33,0.5)]' : 'bg-[#111] border-white/5 text-white hover:border-[#F47521] hover:text-[#F47521] transition-colors'} text-sm font-bold">${epNum}</button>`;
            }).join('');
        }

        // --- AUTO-SKIP LOGIC ---
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');

        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

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

        document.getElementById('skip-fwd-btn')?.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime += 10; });

        function saveProgress(time) {
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

        // External Components Init
        if (window.app.components.commentsss) window.app.components.commentsss();

    } catch (error) {
        setBootStatus(error.message, true);
    }
};

window.app.resolveEpisodeStreamAndRoute = (epId, epNum, animeId) => {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('id', epId); urlParams.set('ep', epNum); urlParams.set('anime', animeId);
    window.location.search = urlParams.toString();
};

window.app.changePlayerConfig = (param, value) => {
    if (param === 'type') localStorage.setItem('blazex_audio', value);
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get(param) === value) return;
    urlParams.set(param, value);
    window.location.search = urlParams.toString();
};

window.app.toggleAutoSkip = (type) => {
    const isChecked = document.getElementById(`toggle-skip-${type}`).checked;
    localStorage.setItem(`blazex_autoskip_${type}`, isChecked ? 'true' : 'false');
};
