// player.js - Custom Cinematic Video Engine

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    let hideTimer, tapTimeout, pressTimer;
    let hlsInstance = null;

    // --- USER SETTINGS DATABASE ---
    const defaultSettings = {
        speed: 1.0,
        fit: 'contain', // contain, cover, fill
        subSize: 100, // percentage
        subColor: '#ffffff',
        subBg: '#000000',
        subBgAlpha: 50, // percentage
        subBorder: true,
        subBorderColor: '#000000'
    };
    let playerSettings = JSON.parse(localStorage.getItem('blazex_player_settings')) || defaultSettings;

    const savePlayerSettings = () => {
        localStorage.setItem('blazex_player_settings', JSON.stringify(playerSettings));
        applyDynamicSubtitleStyles();
    };

    // --- DYNAMIC SUBTITLE CSS ENGINE ---
    const applyDynamicSubtitleStyles = () => {
        let styleEl = document.getElementById('blazex-dynamic-subs');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'blazex-dynamic-subs';
            document.head.appendChild(styleEl);
        }
        
        const alpha = playerSettings.subBgAlpha / 100;
        let r = parseInt(playerSettings.subBg.slice(1, 3), 16), g = parseInt(playerSettings.subBg.slice(3, 5), 16), b = parseInt(playerSettings.subBg.slice(5, 7), 16);
        const bgRgba = `rgba(${r},${g},${b},${alpha})`;
        
        const sizeEm = playerSettings.subSize / 100;
        const bc = playerSettings.subBorderColor;
        const textShadow = playerSettings.subBorder 
            ? `text-shadow: 1px 1px 0 ${bc}, -1px -1px 0 ${bc}, 1px -1px 0 ${bc}, -1px 1px 0 ${bc}, 0px 2px 2px rgba(0,0,0,0.5) !important;` 
            : 'text-shadow: none !important;';

        styleEl.innerHTML = `
            ::cue {
                font-size: ${sizeEm}em !important;
                color: ${playerSettings.subColor} !important;
                background-color: ${bgRgba} !important;
                font-family: sans-serif !important;
                ${textShadow}
            }
        `;
    };
    applyDynamicSubtitleStyles();

    // --- BOOT SEQUENCE LOGGER ---
    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500/20 z-50 absolute inset-0">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2 animate-pulse"></i>
                    <h3 class="text-white font-black text-sm uppercase tracking-widest">Playback Halted</h3>
                    <p class="text-red-400 font-mono text-[10px] mt-2 bg-red-500/10 px-3 py-1 rounded border border-red-500/20 max-w-md">${msg}</p>
                    <button onclick="window.location.reload()" class="mt-5 border border-white/10 bg-white/5 px-6 py-2 rounded text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:text-black transition-colors">Reboot Stream</button>
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
    const audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) { return setBootStatus("Missing URL Parameters (Anime ID or Episode).", true); }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            input[type=range].blazex-slider { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; height: 6px; outline: none; }
            input[type=range].blazex-slider::-webkit-slider-runnable-track { background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; }
            input[type=range].blazex-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #F47521; margin-top: -4px; transition: transform 0.1s; }
            input[type=range].blazex-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }
            .player-ui-layer { transition: opacity 0.3s ease; opacity: 1; }
            .player-ui-layer.idle { opacity: 0; cursor: none; }
            #blazex-player-root:fullscreen, #blazex-player-root:-webkit-full-screen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
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
        } catch (e) { return setBootStatus(`Engine Failure: ${e.message}`, true); }
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

        const epsList = window.app.state?.currentEpisodesListProcessed || [];
        const hasNextEp = epsList.some(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
        let nextEpSlug = null;
        if (hasNextEp) {
            const nextEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
            nextEpSlug = nextEpData.slug || nextEpData.id || String(currentEpNum + 1);
        }
        
        // Fetch Episode Meta
        const currentEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum) || {};
        const epTitle = currentEpData.title || `Episode ${currentEpNum}`;
        const epDesc = currentEpData.description ? (currentEpData.description.substring(0, 100) + '...') : '';

        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black group flex items-center justify-center overflow-hidden">
                <!-- crossOrigin enables proper VTT loading -->
                <video id="main-video-player" playsinline crossorigin="anonymous" class="w-full h-full object-${playerSettings.fit} pointer-events-none"></video>
                
                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>
                
                <!-- Buffering Spinner -->
                <div id="buffering-spinner" class="absolute inset-0 z-20 flex items-center justify-center hidden bg-black/20 backdrop-blur-sm pointer-events-none">
                    <i class="fas fa-circle-notch fa-spin text-4xl text-[#F47521]"></i>
                </div>
                
                <div id="speed-indicator" class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-200 opacity-0 z-40 flex items-center gap-2 border border-white/10">
                    <span>2x Speed</span> <i class="fas fa-forward text-[#F47521]"></i>
                </div>

                <div id="dt-left" class="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-left text-4xl text-[#F47521]"></i><i class="fas fa-caret-left text-4xl -ml-3 text-[#F47521]"></i></div>
                    <span class="text-sm font-bold mt-1 drop-shadow-md">-10s</span>
                </div>
                <div id="dt-right" class="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-right text-4xl text-[#F47521]"></i><i class="fas fa-caret-right text-4xl -ml-3 text-[#F47521]"></i></div>
                    <span class="text-sm font-bold mt-1 drop-shadow-md">+10s</span>
                </div>

                <button id="skip-intro-btn" class="absolute bottom-24 right-4 bg-white/90 backdrop-blur-sm text-black font-black uppercase tracking-widest text-xs px-4 py-2 rounded transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40">
                    Skip Intro <i class="fas fa-forward ml-1"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-24 right-4 bg-white/90 backdrop-blur-sm text-black font-black uppercase tracking-widest text-xs px-4 py-2 rounded transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40">
                    ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-1"></i>` : `Skip Outro <i class="fas fa-forward ml-1"></i>`}
                </button>

                <div id="ui-layer" class="player-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/80 pointer-events-none">
                    
                    <div class="w-full flex items-start justify-between p-4 pointer-events-auto">
                        <div class="flex flex-col pr-4">
                            <h2 class="text-white text-sm md:text-base font-bold tracking-wide truncate flex items-center gap-2">
                                <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-black text-gray-300 border border-white/5">Ep ${currentEpNum}</span>
                                ${epTitle}
                            </h2>
                            ${epDesc ? `<p class="text-gray-400 text-[10px] md:text-xs mt-1 truncate max-w-sm md:max-w-lg">${epDesc}</p>` : ''}
                        </div>
                        ${targetServer === 'hd-2' ? '<span class="bg-[#F47521] text-black px-2 py-0.5 rounded text-[10px] font-black uppercase border border-black shrink-0">HD-2</span>' : ''}
                    </div>
                    
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="w-20 h-20 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full text-white flex items-center justify-center hover:bg-[#F47521]/90 hover:border-[#F47521] hover:scale-110 transition-all">
                            <i id="center-play-icon" class="fas fa-play text-3xl ml-2"></i>
                        </button>
                    </div>

                    <div class="w-full flex flex-col px-4 pb-4 pt-4 pointer-events-auto bg-gradient-to-t from-black to-transparent">
                        
                        <div class="w-full flex items-center gap-3 mb-3">
                            <span id="time-current" class="text-white text-xs font-mono w-12 text-right">00:00</span>
                            <input type="range" id="progress-bar" class="blazex-slider flex-1" value="0" min="0" step="0.1">
                            <span id="time-duration" class="text-gray-400 text-xs font-mono w-12">00:00</span>
                        </div>

                        <div class="w-full flex items-center justify-between">
                            <div class="flex items-center gap-6">
                                <button id="bottom-play-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="bottom-play-icon" class="fas fa-play text-xl"></i></button>
                            </div>
                            
                            <div class="flex items-center gap-5 relative">
                                
                                <!-- Speed Menu -->
                                <div class="relative group speed-container">
                                    <button id="speed-btn" class="text-white hover:text-[#F47521] transition-colors relative"><i class="fas fa-tachometer-alt text-lg"></i><span class="absolute -top-2 -right-3 text-[8px] font-bold bg-white/20 px-1 rounded" id="speed-label">${playerSettings.speed}x</span></button>
                                    <div id="speed-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded p-2 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="text-[10px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Playback Speed</div>
                                        <div id="speed-list" class="grid grid-cols-3 gap-1">
                                            ${[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(s => `<button class="text-xs px-2 py-2 rounded ${playerSettings.speed === s ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 bg-white/5 hover:bg-white/10'} sp-btn" data-speed="${s}">${s}x</button>`).join('')}
                                        </div>
                                    </div>
                                </div>

                                <!-- Fit Menu -->
                                <div class="relative group fit-container">
                                    <button id="fit-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-crop-alt text-lg"></i></button>
                                    <div id="fit-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded p-2 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="text-[10px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Aspect Ratio</div>
                                        <button class="text-left text-xs px-3 py-2 rounded ${playerSettings.fit === 'contain' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 f-btn" data-fit="contain">Fit (Default)</button>
                                        <button class="text-left text-xs px-3 py-2 rounded ${playerSettings.fit === 'cover' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 f-btn" data-fit="cover">Crop to Fill</button>
                                        <button class="text-left text-xs px-3 py-2 rounded ${playerSettings.fit === 'fill' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 f-btn" data-fit="fill">Stretch</button>
                                    </div>
                                </div>

                                <!-- Audio Tracks -->
                                <div class="relative hidden group audio-container">
                                    <button id="audio-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-headphones text-lg"></i></button>
                                    <div id="audio-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded p-2 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="text-[10px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Audio Track</div>
                                        <div id="audio-list" class="flex flex-col gap-1 max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <!-- Subtitles -->
                                <div class="relative group subs-container">
                                    <button id="subs-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-closed-captioning text-lg"></i></button>
                                    <div id="subs-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded p-2 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="flex justify-between items-center px-2 pt-1 pb-2 border-b border-white/10 mb-2">
                                            <span class="text-[10px] font-black uppercase text-gray-500">Subtitles</span>
                                            <button id="subs-settings-btn" class="text-gray-400 hover:text-white"><i class="fas fa-cog"></i></button>
                                        </div>
                                        <div id="subs-list" class="flex flex-col gap-1 max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>

                                    <!-- Subtitle Settings Panel -->
                                    <div id="subs-stg-menu" class="hidden absolute bottom-full right-0 mb-4 w-64 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded p-3 flex flex-col gap-3 z-50 shadow-2xl text-xs text-white">
                                        <div class="flex justify-between items-center mb-1">
                                            <span class="text-[10px] font-black uppercase text-[#F47521]">Subtitle Style</span>
                                            <button id="close-subs-stg" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                                        </div>
                                        
                                        <div class="flex flex-col gap-1">
                                            <label class="text-[10px] text-gray-400">Size: <span id="stg-size-val">${playerSettings.subSize}%</span></label>
                                            <input type="range" id="stg-size" class="blazex-slider" min="50" max="200" value="${playerSettings.subSize}">
                                        </div>
                                        
                                        <div class="grid grid-cols-2 gap-2">
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] text-gray-400">Text Color</label>
                                                <input type="color" id="stg-color" value="${playerSettings.subColor}" class="w-full h-6 bg-transparent cursor-pointer rounded">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] text-gray-400">Bg Color</label>
                                                <input type="color" id="stg-bg" value="${playerSettings.subBg}" class="w-full h-6 bg-transparent cursor-pointer rounded">
                                            </div>
                                        </div>

                                        <div class="flex flex-col gap-1">
                                            <label class="text-[10px] text-gray-400">Bg Opacity: <span id="stg-alpha-val">${playerSettings.subBgAlpha}%</span></label>
                                            <input type="range" id="stg-alpha" class="blazex-slider" min="0" max="100" value="${playerSettings.subBgAlpha}">
                                        </div>

                                        <div class="flex items-center justify-between mt-1">
                                            <label class="text-[10px] text-gray-400 flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" id="stg-border-chk" ${playerSettings.subBorder ? 'checked' : ''} class="accent-[#F47521]"> Text Border
                                            </label>
                                            <input type="color" id="stg-border-color" value="${playerSettings.subBorderColor}" class="w-8 h-6 bg-transparent cursor-pointer rounded ${playerSettings.subBorder ? '' : 'opacity-50 pointer-events-none'}">
                                        </div>
                                    </div>
                                </div>

                                <!-- Quality -->
                                <div class="relative group quality-container">
                                    <button id="quality-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-video text-lg"></i></button>
                                    <div id="quality-menu" class="hidden absolute bottom-full right-0 mb-4 w-56 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded p-2 flex flex-col gap-1 z-50 shadow-2xl">
                                        <div class="text-[10px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Quality</div>
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
        video.playbackRate = playerSettings.speed;

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
        const spinner = document.getElementById('buffering-spinner');

        // Menu Buttons
        const menus = {
            audio: { btn: document.getElementById('audio-btn'), list: document.getElementById('audio-menu') },
            subs: { btn: document.getElementById('subs-btn'), list: document.getElementById('subs-menu') },
            quality: { btn: document.getElementById('quality-btn'), list: document.getElementById('quality-menu') },
            speed: { btn: document.getElementById('speed-btn'), list: document.getElementById('speed-menu') },
            fit: { btn: document.getElementById('fit-btn'), list: document.getElementById('fit-menu') },
            subsStg: { list: document.getElementById('subs-stg-menu') }
        };

        const closeAllMenus = () => Object.values(menus).forEach(m => m.list && m.list.classList.add('hidden'));

        // BUFFERING EVENTS
        video.addEventListener('waiting', () => spinner.classList.remove('hidden'));
        video.addEventListener('playing', () => spinner.classList.add('hidden'));
        video.addEventListener('canplay', () => spinner.classList.add('hidden'));

        // SUBTITLES INJECTION
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

        // HLS LOGIC & PROGRESS RESUME
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                buildSettingsMenus(hlsInstance, video);
                const profile = window.app.state?.activeProfile || { uid: 'guest' };
                const epKey = `blazex_time_${profile.uid}_${animeId}_${currentEpNum}`;
                const storedTime = localStorage.getItem(epKey);
                if (storedTime && !isNaN(storedTime)) video.currentTime = parseFloat(storedTime);
                video.play().catch(() => console.log("Autoplay blocked."));
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
                    else { setBootStatus(`Stream Data Corrupted. Details: ${data.details}`, true); hlsInstance.destroy(); }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => { video.play().catch(e=>e); buildSettingsMenus(null, video); });
        }

        // UI AUTO-HIDE LOGIC
        const resetHideTimer = () => {
            uiLayer.classList.remove('idle');
            playerRoot.style.cursor = 'default';
            clearTimeout(hideTimer);
            if (!video.paused) {
                hideTimer = setTimeout(() => { uiLayer.classList.add('idle'); playerRoot.style.cursor = 'none'; closeAllMenus(); }, 4000);
            }
        };

        playerRoot.addEventListener('mousemove', resetHideTimer);
        playerRoot.addEventListener('touchstart', resetHideTimer, {passive: true});
        playerRoot.addEventListener('mouseleave', () => { if(!video.paused) { uiLayer.classList.add('idle'); closeAllMenus(); } });
        
        // Block clicks on UI from passing to background
        document.querySelectorAll('.player-ui-layer button, .player-ui-layer input, .player-ui-layer div[id$="-menu"]').forEach(el => {
            el.addEventListener('pointerdown', e => e.stopPropagation());
            el.addEventListener('pointerup', e => e.stopPropagation());
            el.addEventListener('click', e => e.stopPropagation());
        });

        // PLAY/PAUSE LOGIC
        const togglePlay = () => { if (video.paused) video.play(); else video.pause(); };

        video.addEventListener('play', () => {
            playIconBottom.className = 'fas fa-pause text-xl';
            playIconCenter.className = 'fas fa-pause text-3xl ml-0';
            playBtnCenter.classList.add('opacity-0', 'scale-150'); 
            setTimeout(() => playBtnCenter.classList.add('hidden'), 300);
            resetHideTimer();
        });

        video.addEventListener('pause', () => {
            playIconBottom.className = 'fas fa-play text-xl';
            playIconCenter.className = 'fas fa-play text-3xl ml-1';
            playBtnCenter.classList.remove('hidden');
            setTimeout(() => playBtnCenter.classList.remove('opacity-0', 'scale-150'), 10);
            uiLayer.classList.remove('idle');
            clearTimeout(hideTimer);
        });

        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
        playBtnCenter.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

        // PROGRESS BAR
        const formatTime = (sec) => {
            if (isNaN(sec) || !isFinite(sec)) return "00:00";
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
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

        // --- GESTURES: SINGLE / DOUBLE CLICK ---
        let lastTapTime = 0;
        let isLongPressing = false;

        const handleDoubleTap = (e) => {
            const rect = overlay.getBoundingClientRect();
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            if (clientX - rect.left > rect.width / 2) {
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
                video.playbackRate = Math.min(3.0, playerSettings.speed + 1.0);
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 600);
        });

        overlay.addEventListener('pointerup', (e) => {
            clearTimeout(pressTimer);
            if (isLongPressing) {
                video.playbackRate = playerSettings.speed;
                document.getElementById('speed-indicator').classList.add('opacity-0');
                isLongPressing = false;
                return;
            }
            const tapLength = new Date().getTime() - lastTapTime;
            if (tapLength < 300 && tapLength > 0) {
                clearTimeout(tapTimeout);
                handleDoubleTap(e);
            } else {
                tapTimeout = setTimeout(() => { togglePlay(); resetHideTimer(); closeAllMenus(); }, 300);
            }
            lastTapTime = new Date().getTime();
        });

        // --- FULLSCREEN ---
        fsBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                else if (playerRoot.webkitRequestFullscreen) playerRoot.webkitRequestFullscreen();
                fsIcon.className = 'fas fa-compress text-lg';
                if (screen.orientation && screen.orientation.lock) { try { await screen.orientation.lock('landscape'); } catch (err) {} }
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                fsIcon.className = 'fas fa-expand text-lg';
                if (screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); }
            }
        });

        // --- MENU TOGGLES ---
        Object.keys(menus).forEach(k => {
            if (menus[k].btn) {
                menus[k].btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isHidden = menus[k].list.classList.contains('hidden');
                    closeAllMenus();
                    if(isHidden) menus[k].list.classList.remove('hidden');
                    resetHideTimer();
                });
            }
        });

        // --- SPEED & FIT LOGIC ---
        menus.speed.list.addEventListener('click', (e) => {
            const btn = e.target.closest('.sp-btn');
            if(!btn) return;
            const s = parseFloat(btn.getAttribute('data-speed'));
            playerSettings.speed = s;
            video.playbackRate = s;
            document.getElementById('speed-label').innerText = s + 'x';
            savePlayerSettings();
            
            document.querySelectorAll('.sp-btn').forEach(b => {
                if(parseFloat(b.getAttribute('data-speed')) === s) b.className = 'text-xs px-2 py-2 rounded bg-[#F47521] text-black font-bold sp-btn';
                else b.className = 'text-xs px-2 py-2 rounded text-gray-300 bg-white/5 hover:bg-white/10 sp-btn';
            });
            closeAllMenus();
        });

        menus.fit.list.addEventListener('click', (e) => {
            const btn = e.target.closest('.f-btn');
            if(!btn) return;
            const f = btn.getAttribute('data-fit');
            playerSettings.fit = f;
            video.className = `w-full h-full object-${f} pointer-events-none`;
            savePlayerSettings();
            
            document.querySelectorAll('.f-btn').forEach(b => {
                if(b.getAttribute('data-fit') === f) b.className = 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 f-btn';
                else b.className = 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 f-btn';
            });
            closeAllMenus();
        });

        // --- SUBTITLE SETTINGS LOGIC ---
        document.getElementById('subs-settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            menus.subs.list.classList.add('hidden');
            menus.subsStg.list.classList.remove('hidden');
        });
        document.getElementById('close-subs-stg').addEventListener('click', (e) => {
            e.stopPropagation();
            menus.subsStg.list.classList.add('hidden');
            menus.subs.list.classList.remove('hidden');
        });

        // Listeners for Subtitle settings changes
        document.getElementById('stg-size').addEventListener('input', e => { playerSettings.subSize = e.target.value; document.getElementById('stg-size-val').innerText = e.target.value+'%'; savePlayerSettings(); });
        document.getElementById('stg-color').addEventListener('input', e => { playerSettings.subColor = e.target.value; savePlayerSettings(); });
        document.getElementById('stg-bg').addEventListener('input', e => { playerSettings.subBg = e.target.value; savePlayerSettings(); });
        document.getElementById('stg-alpha').addEventListener('input', e => { playerSettings.subBgAlpha = e.target.value; document.getElementById('stg-alpha-val').innerText = e.target.value+'%'; savePlayerSettings(); });
        document.getElementById('stg-border-chk').addEventListener('change', e => { 
            playerSettings.subBorder = e.target.checked; 
            document.getElementById('stg-border-color').classList.toggle('opacity-50', !e.target.checked);
            document.getElementById('stg-border-color').classList.toggle('pointer-events-none', !e.target.checked);
            savePlayerSettings(); 
        });
        document.getElementById('stg-border-color').addEventListener('input', e => { playerSettings.subBorderColor = e.target.value; savePlayerSettings(); });

        // --- BUILD POPUPS (Subs, Audio, Quality) ---
        function buildSettingsMenus(hls, vid) {
            const qList = document.getElementById('quality-list');
            const cList = document.getElementById('subs-list');
            const aList = document.getElementById('audio-list');
            
            if (hls && hls.levels) {
                qList.innerHTML = `<button class="text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn" data-level="-1">Auto</button>`;
                hls.levels.forEach((l, i) => { qList.innerHTML += `<button class="text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors q-btn" data-level="${i}">${l.height}p</button>`; });
                
                qList.onclick = (e) => {
                    const btn = e.target.closest('.q-btn'); if (!btn) return;
                    const lv = parseInt(btn.getAttribute('data-level')); hls.currentLevel = lv;
                    document.querySelectorAll('.q-btn').forEach(b => {
                        b.className = parseInt(b.getAttribute('data-level')) === lv ? 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn' : 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors mb-1 q-btn';
                    });
                    closeAllMenus();
                };
            }

            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button class="text-left text-xs px-3 py-2 rounded bg-white/10 text-white hover:bg-white/20 mb-1 c-btn" data-idx="-1">Off</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button class="text-left text-xs px-3 py-2 rounded ${tk.mode==='showing' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 c-btn" data-idx="${i}">${tk.label || 'Lang '+i}</button>`;
                }
                cList.onclick = (e) => {
                    const btn = e.target.closest('.c-btn'); if (!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    for (let i=0; i<vid.textTracks.length; i++) vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden';
                    document.querySelectorAll('.c-btn').forEach(b => {
                        b.className = parseInt(b.getAttribute('data-idx')) === idx ? 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 c-btn' : 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 c-btn';
                    });
                    closeAllMenus();
                };
            } else { cList.innerHTML = `<span class="text-xs text-gray-500 px-2">No Subtitles Provided</span>`; }

            if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
                document.querySelector('.audio-container').classList.remove('hidden');
                aList.innerHTML = '';
                hls.audioTracks.forEach((t, i) => {
                    aList.innerHTML += `<button class="text-left text-xs px-3 py-2 rounded ${hls.audioTrack === i ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 a-btn" data-idx="${i}">${t.name || 'Audio '+i}</button>`;
                });
                aList.onclick = (e) => {
                    const btn = e.target.closest('.a-btn'); if(!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx')); hls.audioTrack = idx;
                    document.querySelectorAll('.a-btn').forEach(b => {
                        b.className = parseInt(b.getAttribute('data-idx')) === idx ? 'text-left text-xs px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 a-btn' : 'text-left text-xs px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 a-btn';
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
                if (autoSkipIntro) video.currentTime = introEnd; else skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
            } else skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0');

            if (outroEnd > 0 && t >= outroStart && t < outroEnd) {
                if (autoSkipOutro && hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); 
                else skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
            } else skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0');
        });

        skipIntroBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', (e) => { e.stopPropagation(); if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); else video.currentTime = video.duration; });

        // --- TRACK PROGRESS ---
        function saveProgress(time) {
            const profile = window.app.state?.activeProfile || { uid: 'guest' };
            const uid = profile.uid;
            localStorage.setItem(`blazex_time_${uid}_${animeId}_${currentEpNum}`, time);
            
            const seriesKey = `blazex_series_${uid}_${animeId}`;
            let seriesData = JSON.parse(localStorage.getItem(seriesKey)) || { watchedEps: [], lastWatchedEp: currentEpNum };
            seriesData.lastWatchedEp = currentEpNum;
            if (video.duration && time > (video.duration * 0.85) && !seriesData.watchedEps.includes(currentEpNum)) seriesData.watchedEps.push(currentEpNum);
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
