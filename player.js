// player.js - Custom Cinematic Video Engine with VAST Ad Support

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    let hideTimer;
    let tapTimeout;
    let pressTimer;
    let hlsInstance = null;
    let adsManager = null;
    let adsLoader = null;
    let adDisplayContainer = null;

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

    setBootStatus("Initializing Environment...");

    // 1. Inject Required Delegate-CH Meta Tag
    if (!document.querySelector('meta[http-equiv="Delegate-CH"]')) {
        const meta = document.createElement('meta');
        meta.httpEquiv = "Delegate-CH";
        meta.content = "Sec-CH-UA https://s.magsrv.com; Sec-CH-UA-Mobile https://s.magsrv.com; Sec-CH-UA-Arch https://s.magsrv.com; Sec-CH-UA-Model https://s.magsrv.com; Sec-CH-UA-Platform https://s.magsrv.com; Sec-CH-UA-Platform-Version https://s.magsrv.com; Sec-CH-UA-Bitness https://s.magsrv.com; Sec-CH-UA-Full-Version-List https://s.magsrv.com; Sec-CH-UA-Full-Version https://s.magsrv.com;";
        document.head.appendChild(meta);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); 
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    let audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) {
        setBootStatus("Missing URL Parameters (Anime ID or Episode).", true);
        return;
    }

    const baseUrl = 'https://anikoto-api-lyart.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 
    const vastAdUrl = 'https://s.magsrv.com/v1/vast.php?idz=6027746';

    // Inject Player CSS
    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            :root {
                --sub-color: #FFFFFF;
                --sub-bg: transparent;
                --sub-font: sans-serif;
                --sub-size: 100%;
                --sub-shadow: 1px 1px 3px rgba(0,0,0,0.8), 0px 0px 5px rgba(0,0,0,0.8);
                --sub-elev: 0px;
            }
            video::-webkit-media-text-track-display { transform: translateY(var(--sub-elev)) !important; }
            ::cue { color: var(--sub-color); background-color: var(--sub-bg); font-family: var(--sub-font); font-size: var(--sub-size); text-shadow: var(--sub-shadow); font-weight: 800; }
            input[type=range].blazex-slider { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; height: 6px; outline: none; }
            input[type=range].blazex-slider::-webkit-slider-runnable-track { background: rgba(255,255,255,0.2); height: 4px; border-radius: 4px; }
            input[type=range].blazex-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #F47521; margin-top: -4px; transition: transform 0.1s; }
            input[type=range].blazex-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }
            
            .player-ui-layer { transition: opacity 0.3s ease, background 0.3s ease; opacity: 1; }
            .player-ui-layer.idle { opacity: 0; cursor: none; }
            
            #ep-desc { display: none; }
            #blazex-player-root:fullscreen #ep-desc { display: -webkit-box; }
            #blazex-player-root:-webkit-full-screen #ep-desc { display: -webkit-box; }
            #blazex-player-root:fullscreen, #blazex-player-root:-webkit-full-screen { width: 100vw; height: 100vh; max-width: none; border-radius: 0; border: none; }
            
            .loader-ring { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-left-color: #F47521; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

    // 2. Inject External Scripts (HLS.js and Google IMA SDK)
    try {
        await Promise.all([
            new Promise((resolve, reject) => {
                if (typeof window.Hls !== 'undefined') return resolve();
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                script.onload = resolve;
                script.onerror = () => reject(new Error("Blocked HLS script injection."));
                document.head.appendChild(script);
            }),
            new Promise((resolve, reject) => {
                if (typeof window.google !== 'undefined' && window.google.ima) return resolve();
                const script = document.createElement('script');
                script.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
                script.onload = resolve;
                script.onerror = () => reject(new Error("Blocked IMA Ad SDK injection."));
                document.head.appendChild(script);
            })
        ]);
    } catch (e) { 
        setBootStatus(`Engine Failure: ${e.message}`, true); 
        return; 
    }

    try {
        setBootStatus("Fetching Available Servers...");
        
        let availableServersList = [];
        try {
            const srvRes = await fetch(`${baseUrl}/api/servers?id=${animeId}&ep=${currentEpNum}`);
            const srvJson = await srvRes.json();
            if (srvJson.success && srvJson.data) availableServersList = srvJson.data;
        } catch(e) {}

        let typeServers = availableServersList.filter(s => s.type === audioType).map(s => s.serverName);
        if (typeServers.length === 0) typeServers = ['hd-1', 'hd-2', 'vidstream-2'];
        if (typeServers.includes(targetServer)) typeServers = [targetServer, ...typeServers.filter(s => s !== targetServer)];

        const fetchStream = async (srv, type) => {
            try {
                const res = await fetch(`${baseUrl}/api/stream?id=${animeId}&ep=${currentEpNum}&server=${srv}&type=${type}`);
                const json = await res.json();
                if (json.success && json.data?.m3u8) return json.data;
            } catch (err) {}
            return null;
        };

        let streamData = null;
        let activeServer = targetServer;

        for (const srv of typeServers) {
            setBootStatus(`Connecting to ${srv.toUpperCase()} (${audioType.toUpperCase()})...`);
            streamData = await fetchStream(srv, audioType);
            if (streamData) {
                activeServer = srv;
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('server', activeServer);
                newUrl.searchParams.set('type', audioType);
                window.history.replaceState({}, '', newUrl);
                break;
            }
        }

        if (!streamData) throw new Error(`All servers are currently unresponsive for Episode ${currentEpNum} (${audioType.toUpperCase()}).`);
        setBootStatus("Constructing Cinematic Pipeline...");

        const streamUrl = streamData.m3u8; 
        const targetReferer = streamData.referer || "https://vidwish.live/";
        const tracks = streamData.subtitles || []; 
        const introStart = streamData.intro?.start || 0, introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0, outroEnd = streamData.outro?.end || 0;
        const proxiedStreamUrl = customProxyUrl + encodeURIComponent(streamUrl) + '&referer=' + encodeURIComponent(targetReferer);

        const epsList = window.app.state?.currentEpisodesListProcessed || [];
        const hasNextEp = epsList.some(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
        let nextEpSlug = null;
        if (hasNextEp) {
            const nextEpData = epsList.find(e => parseInt(e.num || e.episode_no) === currentEpNum + 1);
            nextEpSlug = nextEpData.slug || nextEpData.id || String(currentEpNum + 1);
        }

        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black group flex items-center justify-center overflow-hidden">
                <video id="main-video-player" crossorigin="anonymous" playsinline class="w-full h-full object-contain pointer-events-none"></video>
                
                <!-- 3. Ad Container for VAST rendering -->
                <div id="ad-container" class="absolute inset-0 z-[60] bg-black hidden"></div>

                <div id="buffer-overlay" class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 hidden">
                    <div class="loader-ring"></div>
                </div>

                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>
                
                <div id="speed-indicator" class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-200 opacity-0 z-40 flex items-center gap-2 border border-white/10 pointer-events-none">
                    <span id="speed-indicator-text">2x Speed</span> <i class="fas fa-forward text-[#F47521]"></i>
                </div>

                <div id="dt-left" class="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-left text-2xl"></i><i class="fas fa-caret-left text-2xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1">10s</span>
                </div>
                <div id="dt-right" class="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 opacity-0 transition-opacity z-20 pointer-events-none">
                    <div class="flex"><i class="fas fa-caret-right text-2xl"></i><i class="fas fa-caret-right text-2xl -ml-2"></i></div>
                    <span class="text-xs font-bold mt-1">10s</span>
                </div>

                <button id="skip-intro-btn" class="absolute bottom-24 right-4 bg-white/90 backdrop-blur-sm text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    Skip Intro <i class="fas fa-forward ml-1"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-24 right-4 bg-white/90 backdrop-blur-sm text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-40 border border-white/20">
                    Next Episode <i class="fas fa-step-forward ml-1"></i>
                </button>

                <!-- UI Layer omitted for brevity (Keep your existing UI Layer HTML here) -->
                <div id="ui-layer" class="player-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none">
                    ${ /* Paste all your inner UI HTML here (buttons, sliders, settings menus) */ '' }
                </div>
            </div>
        `;

        const video = document.getElementById('main-video-player');
        const overlay = document.getElementById('gesture-overlay');
        const uiLayer = document.getElementById('ui-layer');
        const adContainer = document.getElementById('ad-container');
        const bufferOverlay = document.getElementById('buffer-overlay');
        const progressBar = document.getElementById('progress-bar');
        const playBtnBottom = document.getElementById('bottom-play-btn');
        const playIconBottom = document.getElementById('bottom-play-icon');
        const playBtnCenter = document.getElementById('center-play-btn');
        const playIconCenter = document.getElementById('center-play-icon');
        const fsBtn = document.getElementById('fs-btn');
        const fsIcon = document.getElementById('fs-icon');
        const timeCurr = document.getElementById('time-current');
        const timeDur = document.getElementById('time-duration');
        
        video.addEventListener('waiting', () => bufferOverlay.classList.remove('hidden'));
        video.addEventListener('playing', () => bufferOverlay.classList.add('hidden'));
        video.addEventListener('canplay', () => bufferOverlay.classList.add('hidden'));

        // 4. Initialize IMA SDK Integration
        const initializeAdSystem = () => {
            adDisplayContainer = new google.ima.AdDisplayContainer(adContainer, video);
            adsLoader = new google.ima.AdsLoader(adDisplayContainer);
            
            adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (event) => {
                const adsRenderingSettings = new google.ima.AdsRenderingSettings();
                adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
                
                adsManager = event.getAdsManager(video, adsRenderingSettings);
                
                // Handle Ad Errors - Fallback to main content
                adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (e) => {
                    console.warn("Ad Error:", e.getError());
                    adContainer.classList.add('hidden');
                    if (adsManager) adsManager.destroy();
                    video.play().catch(console.warn);
                });

                // Content Pause (Ad Starts)
                adsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
                    video.pause();
                    adContainer.classList.remove('hidden');
                    uiLayer.style.display = 'none'; // Hide custom UI during ad
                });

                // Content Resume (Ad Ends)
                adsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
                    adContainer.classList.add('hidden');
                    uiLayer.style.display = 'flex'; // Restore custom UI
                    video.play().catch(console.warn);
                });

                try {
                    adDisplayContainer.initialize();
                    adsManager.init(video.clientWidth, video.clientHeight, google.ima.ViewMode.NORMAL);
                    adsManager.start();
                } catch (adError) {
                    video.play().catch(console.warn);
                }
            });

            adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (e) => {
                console.warn("AdsLoader error:", e.getError());
                video.play().catch(console.warn);
            });
        };

        const playWithPreroll = () => {
            if (!adsLoader) initializeAdSystem();
            
            // If ad blockers block IMA completely, just play video
            if (typeof google === 'undefined' || !google.ima) {
                video.play().catch(console.warn);
                return;
            }

            // Create request
            const adsRequest = new google.ima.AdsRequest();
            adsRequest.adTagUrl = vastAdUrl;
            adsRequest.linearAdSlotWidth = video.clientWidth;
            adsRequest.linearAdSlotHeight = video.clientHeight;
            adsRequest.nonLinearAdSlotWidth = video.clientWidth;
            adsRequest.nonLinearAdSlotHeight = video.clientHeight;

            // This ensures a user gesture initializes the ad container, required for mobile
            if (adDisplayContainer) adDisplayContainer.initialize();
            
            try {
                adsLoader.requestAds(adsRequest);
            } catch (e) {
                video.play().catch(console.warn);
            }
        };

        // Window resize handler for VAST scaling
        window.addEventListener('resize', () => {
            if (adsManager) {
                adsManager.resize(video.clientWidth, video.clientHeight, google.ima.ViewMode.NORMAL);
            }
        });

        // Initialize HLS Engine
        tracks.forEach((track, index) => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track'); trackEl.kind = track.kind; trackEl.label = track.label || `Track ${index+1}`; trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en'; trackEl.src = customProxyUrl + encodeURIComponent(track.file) + '&referer=' + encodeURIComponent(targetReferer); 
                if (track.default) trackEl.default = true; video.appendChild(trackEl);
            }
        });

        let isFirstPlay = true;

        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 }); 
            hlsInstance.loadSource(proxiedStreamUrl); 
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, async function() {
                // ... (Keep your existing settings/progress fetch logic here) ...
                
                // Replace video.play() inside MANIFEST_PARSED with:
                // We don't auto-trigger the ad immediately here to avoid gesture-blocking issues. 
                // We wait for the user to press the center play button for the first time.
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl; 
            video.addEventListener('loadedmetadata', () => { 
                // Wait for interaction
            });
        }

        // Adjust your togglePlay to handle the first interaction VAST preroll
        const togglePlay = () => { 
            if (isFirstPlay) {
                isFirstPlay = false;
                playWithPreroll();
            } else {
                if (video.paused) video.play(); else video.pause(); 
            }
        };

        // ... (Keep the rest of your UI bindings, formatTime, gesture controls, menus, and skip buttons exactly as they were) ...

    } catch (error) { setBootStatus(error.message, true); }

    window.app.components.player.destroy = () => {
        clearTimeout(hideTimer); clearTimeout(tapTimeout); clearTimeout(pressTimer);
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        if (adsManager) { adsManager.destroy(); }
        if (adsLoader) { adsLoader.contentComplete(); }
        const vid = document.getElementById('main-video-player'); if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
        playerRoot.replaceWith(playerRoot.cloneNode(true));
        console.log("Player teardown complete.");
    };
};
