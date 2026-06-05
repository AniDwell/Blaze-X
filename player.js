// player.js - Custom Cinematic Video Engine

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // Global references for teardown
    let hideTimer;
    let tapTimeout;
    let pressTimer;
    let hlsInstance = null;

    const profile = window.app.state?.activeProfile || { uid: 'guest' };
    const settingsKey = `blazex_settings_${profile.uid}`;
    
    // Load User Preferences
    const userSettings = JSON.parse(localStorage.getItem(settingsKey)) || {
        speed: 1.0,
        fit: 'object-contain', // object-contain (Fit), object-cover (Crop), object-fill (Stretch)
        subSize: '20px',
        subBg: 'rgba(0,0,0,0.7)',
        subOutline: '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000' // Fake border
    };

    const saveUserSettings = () => {
        localStorage.setItem(settingsKey, JSON.stringify(userSettings));
    };

    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500 rounded-xl z-50 absolute inset-0">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2"></i>
                    <h3 class="text-white font-black text-sm uppercase tracking-widest">Playback Halted</h3>
                    <p class="text-red-400 font-mono text-[10px] mt-2 bg-red-500/10 px-3 py-1 rounded max-w-md">${msg}</p>
                    <button onclick="window.location.reload()" class="mt-5 bg-white/10 px-6 py-2 rounded-lg text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:text-black">Reboot Stream</button>
                </div>
            `;
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); 
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    const audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) { setBootStatus("Missing Parameters.", true); return; }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    // --- CUSTOM CSS MODULES & ::CUE STYLING ---
    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            :root {
                --bx-sub-size: ${userSettings.subSize};
                --bx-sub-bg: ${userSettings.subBg};
                --bx-sub-outline: ${userSettings.subOutline};
            }
            .blazex-slider { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; height: 6px; outline: none; }
            .blazex-slider::-webkit-slider-runnable-track { background: rgba(255,255,255,0.2); height: 4px; border-radius: 4px; }
            .blazex-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #F47521; margin-top: -4px; transition: transform 0.1s; }
            .blazex-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }
            
            .blazex-popup { display: none; position: absolute; bottom: 100%; right: 0; margin-bottom: 1rem; width: 16rem; background: rgba(10,10,10,0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 0.5rem; flex-direction: column; gap: 0.25rem; z-index: 50; }
            .blazex-popup.active { display: flex; }
            .blazex-menu-btn { text-align: left; font-size: 11px; padding: 0.5rem 0.75rem; border-radius: 0.25rem; color: #d1d5db; transition: background 0.2s; }
            .blazex-menu-btn:hover { background: rgba(255,255,255,0.1); }
            .blazex-menu-btn.active { background: #F47521; color: black; font-weight: 900; }
            
            .blazex-ui-layer { transition: opacity 0.3s ease; opacity: 1; }
            .blazex-ui-layer.idle { opacity: 0; cursor: none; }
            
            /* Native Subtitles Styling */
            ::cue {
                font-family: sans-serif;
                font-weight: bold;
                font-size: var(--bx-sub-size);
                background-color: var(--bx-sub-bg);
                color: white;
                text-shadow: var(--bx-sub-outline);
            }

            /* Glitch Logo Animation */
            .blazex-glitch-logo {
                position: relative;
                animation: glitch-anim 2s infinite linear alternate-reverse;
            }
            @keyframes glitch-anim {
                0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 2px); }
                20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -2px); }
                40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 1px); }
                60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -1px); }
                80% { clip-path: inset(10% 0 70% 0); transform: translate(-1px, 2px); }
                100% { clip-path: inset(30% 0 50% 0); transform: translate(1px, -2px); }
            }
        `;
        document.head.appendChild(style);
    } else {
        // Update variables if CSS already exists
        document.documentElement.style.setProperty('--bx-sub-size', userSettings.subSize);
        document.documentElement.style.setProperty('--bx-sub-bg', userSettings.subBg);
        document.documentElement.style.setProperty('--bx-sub-outline', userSettings.subOutline);
    }

    try {
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
            targetServer = 'hd-2';
            streamData = await fetchStream(targetServer);
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('server', 'hd-2');
            window.history.replaceState({}, '', newUrl);
        }

        if (!streamData) throw new Error("Servers are unresponsive for this episode.");

        const streamUrl = streamData.m3u8; 
        const targetReferer = streamData.referer || "https://vidwish.live/";
        const tracks = streamData.subtitles || []; 
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;
        const proxiedStreamUrl = customProxyUrl + encodeURIComponent(streamUrl) + '&referer=' + encodeURIComponent(targetReferer);

        const epsList = window.app.state?.currentEpisodesListProcessed || [];
        const hasNextEp = epsList.some(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
        let nextEpSlug = null;
        if (hasNextEp) {
            const nextEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
            nextEpSlug = nextEpData.slug || nextEpData.id || String(currentEpNum + 1);
        }

        // Mock Meta Data (Replace with real API data if available)
        const epMetaTitle = `Episode ${currentEpNum}`;
        const epMetaDesc = window.app.state?.animeDetails?.description?.substring(0, 80) + "..." || "No description available for this episode. Prepare for the next phase of the journey.";

        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
                
                <!-- SPLASH SCREEN -->
                <div id="blazex-splash" class="absolute inset-0 z-50 bg-[#050505] flex items-center justify-center transition-opacity duration-500">
                    <img src="/logo.png" class="w-48 md:w-64 h-auto blazex-glitch-logo" alt="BlazeX">
                    <!-- Free techy UI sound -->
                    <audio id="splash-audio" src="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" preload="auto"></audio>
                </div>

                <!-- MAIN VIDEO -->
                <video id="main-video-player" crossorigin="anonymous" playsinline class="w-full h-full ${userSettings.fit} pointer-events-none"></video>
                
                <!-- BUFFERING SPINNER -->
                <div id="buffer-spinner" class="absolute inset-0 z-20 flex items-center justify-center hidden pointer-events-none">
                    <div class="w-16 h-16 border-4 border-[#F47521] border-t-transparent rounded-full animate-spin"></div>
                </div>

                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>
                
                <div id="dt-left" class="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-left text-3xl"></i><i class="fas fa-caret-left text-3xl -ml-2"></i></div>
                    <span class="text-sm font-bold mt-1">10s</span>
                </div>
                <div id="dt-right" class="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-right text-3xl"></i><i class="fas fa-caret-right text-3xl -ml-2"></i></div>
                    <span class="text-sm font-bold mt-1">10s</span>
                </div>

                <!-- SKIP BUTTONS -->
                <button id="skip-intro-btn" class="absolute bottom-24 right-6 bg-black/80 text-white font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] border border-white/20 z-40">
                    Skip Intro <i class="fas fa-forward ml-1"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-24 right-6 bg-black/80 text-white font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] border border-white/20 z-40">
                    ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-1"></i>` : `Skip Outro <i class="fas fa-forward ml-1"></i>`}
                </button>

                <!-- UI CONTROLS LAYER -->
                <div id="ui-layer" class="blazex-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/80 pointer-events-none">
                    
                    <!-- TOP BAR: INFO -->
                    <div class="w-full flex flex-col p-6 pointer-events-auto">
                        <h2 class="text-white text-lg md:text-xl font-black tracking-wide pr-4">${epMetaTitle}</h2>
                        <p class="text-gray-400 text-[10px] md:text-xs max-w-lg mt-1 line-clamp-2">${epMetaDesc}</p>
                        ${targetServer === 'hd-2' ? '<span class="bg-[#F47521] text-black px-2 py-0.5 rounded text-[8px] font-black uppercase w-max mt-2">HD-2 Server</span>' : ''}
                    </div>
                    
                    <!-- CENTER PLAY -->
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="hidden w-20 h-20 bg-black/60 border border-white/20 rounded-full text-white flex items-center justify-center hover:bg-[#F47521] transition-colors">
                            <i id="center-play-icon" class="fas fa-play text-3xl ml-1"></i>
                        </button>
                    </div>

                    <!-- BOTTOM BAR -->
                    <div class="w-full flex flex-col px-6 pb-6 pt-4 pointer-events-auto">
                        <div class="w-full flex items-center gap-4 mb-3">
                            <span id="time-current" class="text-white text-[11px] font-mono w-10 text-right">00:00</span>
                            <input type="range" id="progress-bar" class="blazex-slider flex-1" value="0" min="0" step="0.1">
                            <span id="time-duration" class="text-gray-400 text-[11px] font-mono w-10">00:00</span>
                        </div>

                        <div class="w-full flex items-center justify-between">
                            <div class="flex items-center gap-5">
                                <button id="bottom-play-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="bottom-play-icon" class="fas fa-play text-xl"></i></button>
                            </div>
                            
                            <div class="flex items-center gap-5 relative">
                                
                                <!-- Speed Control -->
                                <div class="relative group menu-container">
                                    <button id="speed-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-tachometer-alt text-lg"></i></button>
                                    <div id="speed-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Playback Speed</div>
                                        <div id="speed-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Subtitle Styling Control -->
                                <div class="relative group menu-container">
                                    <button id="substyle-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-font text-lg"></i></button>
                                    <div id="substyle-menu" class="blazex-popup w-56">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Subtitle Appearance</div>
                                        <div class="flex flex-col gap-2 px-2 py-1">
                                            <label class="text-[10px] text-gray-300">Size</label>
                                            <input type="range" id="sub-size-slider" class="blazex-slider" min="12" max="40" value="${parseInt(userSettings.subSize)}">
                                            
                                            <label class="text-[10px] text-gray-300 mt-2">Background</label>
                                            <select id="sub-bg-select" class="w-full bg-white/10 text-white text-[10px] p-1 rounded outline-none border border-white/20">
                                                <option value="transparent">None</option>
                                                <option value="rgba(0,0,0,0.5)">Dark (Soft)</option>
                                                <option value="rgba(0,0,0,0.8)">Dark (Solid)</option>
                                            </select>
                                            
                                            <label class="text-[10px] text-gray-300 mt-2">Outline</label>
                                            <select id="sub-outline-select" class="w-full bg-white/10 text-white text-[10px] p-1 rounded outline-none border border-white/20">
                                                <option value="none">Off</option>
                                                <option value="2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000">Black Border</option>
                                                <option value="0px 0px 4px rgba(0,0,0,0.8)">Soft Shadow</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Audio Tracks -->
                                <div class="relative hidden menu-container audio-wrapper">
                                    <button id="audio-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-headphones text-lg"></i></button>
                                    <div id="audio-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Audio Track</div>
                                        <div id="audio-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Subtitles Select -->
                                <div class="relative menu-container subs-wrapper">
                                    <button id="subs-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-closed-captioning text-lg"></i></button>
                                    <div id="subs-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Subtitles</div>
                                        <div id="subs-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Quality -->
                                <div class="relative menu-container quality-wrapper">
                                    <button id="quality-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-video text-lg"></i></button>
                                    <div id="quality-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Quality</div>
                                        <div id="quality-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Video Fit -->
                                <button id="fit-btn" class="text-white hover:text-[#F47521] transition-colors" title="Adjust Video Fit"><i class="fas fa-crop-alt text-lg"></i></button>

                                <!-- Fullscreen -->
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
        const bufferSpinner = document.getElementById('buffer-spinner');
        const splashScreen = document.getElementById('blazex-splash');
        const splashAudio = document.getElementById('splash-audio');

        // Apply initial settings
        video.playbackRate = userSettings.speed;
        document.getElementById('sub-bg-select').value = userSettings.subBg;
        document.getElementById('sub-outline-select').value = userSettings.subOutline;

        // Dismiss Splash Screen Helper
        let splashDismissed = false;
        const dismissSplash = () => {
            if(splashDismissed) return;
            splashDismissed = true;
            splashScreen.style.opacity = '0';
            setTimeout(() => splashScreen.classList.add('hidden'), 500);
            
            // Attempt to play techy sound
            try { splashAudio.play().catch(e => console.log("Audio autoplay blocked by browser.")); } catch(e){}
        };

        // Menu Elements Array
        const menus = [
            { btn: document.getElementById('speed-btn'), pop: document.getElementById('speed-menu') },
            { btn: document.getElementById('substyle-btn'), pop: document.getElementById('substyle-menu') },
            { btn: document.getElementById('audio-btn'), pop: document.getElementById('audio-menu') },
            { btn: document.getElementById('subs-btn'), pop: document.getElementById('subs-menu') },
            { btn: document.getElementById('quality-btn'), pop: document.getElementById('quality-menu') }
        ];

        const closeAllMenus = () => {
            menus.forEach(m => m.pop.classList.remove('active'));
        };

        menus.forEach(m => {
            m.btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = m.pop.classList.contains('active');
                closeAllMenus();
                if(!isActive) m.pop.classList.add('active');
                resetHideTimer();
            });
        });

        uiLayer.addEventListener('click', closeAllMenus);

        // Fit Button Logic
        const fitBtn = document.getElementById('fit-btn');
        const fitModes = ['object-contain', 'object-cover', 'object-fill'];
        fitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let currentIdx = fitModes.indexOf(userSettings.fit);
            let nextIdx = (currentIdx + 1) % fitModes.length;
            
            video.classList.remove(...fitModes);
            video.classList.add(fitModes[nextIdx]);
            userSettings.fit = fitModes[nextIdx];
            saveUserSettings();
            resetHideTimer();
        });

        // Subtitle Style Logic
        document.getElementById('sub-size-slider').addEventListener('input', (e) => {
            const val = `${e.target.value}px`;
            document.documentElement.style.setProperty('--bx-sub-size', val);
            userSettings.subSize = val;
            saveUserSettings();
        });
        document.getElementById('sub-bg-select').addEventListener('change', (e) => {
            document.documentElement.style.setProperty('--bx-sub-bg', e.target.value);
            userSettings.subBg = e.target.value;
            saveUserSettings();
        });
        document.getElementById('sub-outline-select').addEventListener('change', (e) => {
            document.documentElement.style.setProperty('--bx-sub-outline', e.target.value);
            userSettings.subOutline = e.target.value;
            saveUserSettings();
        });

        // Subtitles Track Loading
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

        // HLS LOGIC
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                buildSettingsMenus(hlsInstance, video);
                const epKey = `blazex_time_${profile.uid}_${animeId}_${currentEpNum}`;
                const storedTime = localStorage.getItem(epKey);
                if (storedTime && !isNaN(storedTime)) video.currentTime = parseFloat(storedTime);
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => buildSettingsMenus(null, video));
        }

        // Buffering & Playback Events
        video.addEventListener('waiting', () => { bufferSpinner.classList.remove('hidden'); });
        video.addEventListener('playing', () => { bufferSpinner.classList.add('hidden'); dismissSplash(); });
        video.addEventListener('canplay', () => { dismissSplash(); });

        // Auto-Hide UI Logic
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

        // Toggle Playback
        const togglePlay = () => {
            if (video.paused) video.play();
            else video.pause();
        };

        video.addEventListener('play', () => {
            playIconBottom.className = 'fas fa-pause text-xl';
            playBtnCenter.classList.add('hidden');
            resetHideTimer();
        });

        video.addEventListener('pause', () => {
            playIconBottom.className = 'fas fa-play text-xl';
            playBtnCenter.classList.remove('hidden');
            uiLayer.classList.remove('idle');
            clearTimeout(hideTimer);
        });

        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
        playBtnCenter.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

        // Unified Gestures
        let lastTapTime = 0;
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

        overlay.addEventListener('pointerup', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                clearTimeout(tapTimeout);
                handleDoubleTap(e);
            } else {
                tapTimeout = setTimeout(() => {
                    togglePlay();
                    resetHideTimer();
                }, 300);
            }
            lastTapTime = currentTime;
        });

        // Time Updates
        const formatTime = (sec) => {
            if (isNaN(sec) || !isFinite(sec)) return "00:00";
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
            return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        };

        video.addEventListener('loadedmetadata', () => {
            progressBar.max = video.duration;
            document.getElementById('time-duration').innerText = formatTime(video.duration);
        });

        video.addEventListener('timeupdate', () => {
            progressBar.value = video.currentTime;
            document.getElementById('time-current').innerText = formatTime(video.currentTime);
            const pct = (video.currentTime / video.duration) * 100;
            progressBar.style.background = `linear-gradient(to right, #F47521 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
            if (Math.floor(video.currentTime) % 5 === 0) saveProgress(video.currentTime);
        });

        progressBar.addEventListener('input', (e) => {
            video.currentTime = e.target.value;
            const pct = (e.target.value / video.duration) * 100;
            e.target.style.background = `linear-gradient(to right, #F47521 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
        });

        // Fullscreen
        fsBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                else if (playerRoot.webkitRequestFullscreen) playerRoot.webkitRequestFullscreen();
                fsIcon.className = 'fas fa-compress text-lg';
                if (screen.orientation && screen.orientation.lock) try { await screen.orientation.lock('landscape'); } catch (err) {}
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                fsIcon.className = 'fas fa-expand text-lg';
                if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            }
        });

        // Dynamic Menu Builders
        function buildSettingsMenus(hls, vid) {
            const sList = document.getElementById('speed-list');
            const qList = document.getElementById('quality-list');
            const cList = document.getElementById('subs-list');
            const aList = document.getElementById('audio-list');

            // Speed Build
            const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
            sList.innerHTML = '';
            speeds.forEach(sp => {
                sList.innerHTML += `<button class="blazex-menu-btn s-btn ${userSettings.speed === sp ? 'active' : ''}" data-val="${sp}">${sp}x ${sp===1?'(Normal)':''}</button>`;
            });
            sList.onclick = (e) => {
                const btn = e.target.closest('.s-btn');
                if(!btn) return;
                const sp = parseFloat(btn.getAttribute('data-val'));
                video.playbackRate = sp;
                userSettings.speed = sp;
                saveUserSettings();
                document.querySelectorAll('.s-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                closeAllMenus();
            };

            // Quality Build
            if (hls && hls.levels) {
                qList.innerHTML = `<button class="blazex-menu-btn q-btn active" data-level="-1">Auto</button>`;
                hls.levels.forEach((l, i) => { qList.innerHTML += `<button class="blazex-menu-btn q-btn" data-level="${i}">${l.height}p</button>`; });
                qList.onclick = (e) => {
                    const btn = e.target.closest('.q-btn');
                    if (!btn) return;
                    hls.currentLevel = parseInt(btn.getAttribute('data-level'));
                    document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    closeAllMenus();
                };
            } else { qList.innerHTML = `<span class="text-[11px] text-gray-500 px-2">Auto (Native)</span>`; }

            // Subtitles Build
            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button class="blazex-menu-btn c-btn active" data-idx="-1">Off</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button class="blazex-menu-btn c-btn ${tk.mode==='showing'?'active':''}" data-idx="${i}">${tk.label || 'Lang '+i}</button>`;
                }
                cList.onclick = (e) => {
                    const btn = e.target.closest('.c-btn');
                    if (!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    for (let i=0; i<vid.textTracks.length; i++) vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden';
                    document.querySelectorAll('.c-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    closeAllMenus();
                };
            } else { cList.innerHTML = `<span class="text-[11px] text-gray-500 px-2">No Subtitles Found</span>`; }

            // Audio Build
            if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
                document.querySelector('.audio-wrapper').classList.remove('hidden');
                aList.innerHTML = '';
                hls.audioTracks.forEach((t, i) => { aList.innerHTML += `<button class="blazex-menu-btn a-btn ${hls.audioTrack === i ? 'active':''}" data-idx="${i}">${t.name || 'Audio '+i}</button>`; });
                aList.onclick = (e) => {
                    const btn = e.target.closest('.a-btn');
                    if(!btn) return;
                    hls.audioTrack = parseInt(btn.getAttribute('data-idx'));
                    document.querySelectorAll('.a-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    closeAllMenus();
                };
            }
        }

        // Auto Skip Buttons Logic
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');
        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            if (introEnd > 0 && t >= introStart && t < introEnd) skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
            else skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0');
            if (outroEnd > 0 && t >= outroStart && t < outroEnd) skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
            else skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0');
        });
        skipIntroBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); 
            else video.currentTime = video.duration; 
        });

        function saveProgress(time) {
            const uid = profile.uid;
            localStorage.setItem(`blazex_time_${uid}_${animeId}_${currentEpNum}`, time);
            
            const seriesKey = `blazex_series_${uid}_${animeId}`;
            let seriesData = JSON.parse(localStorage.getItem(seriesKey)) || { watchedEps: [], lastWatchedEp: currentEpNum };
            seriesData.lastWatchedEp = currentEpNum;
            if (video.duration && time > (video.duration * 0.85)) {
                if (!seriesData.watchedEps.includes(currentEpNum)) seriesData.watchedEps.push(currentEpNum);
            }
            localStorage.setItem(seriesKey, JSON.stringify(seriesData));
        }

    } catch (error) { setBootStatus(error.message, true); }

    window.app.components.player.destroy = () => {
        clearTimeout(hideTimer); clearTimeout(tapTimeout); clearTimeout(pressTimer);
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        const vid = document.getElementById('main-video-player');
        if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
        playerRoot.replaceWith(playerRoot.cloneNode(true));
    };
};
