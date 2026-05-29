// player.js

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); 
    const currentEpNum = urlParams.get('ep') || '1'; 
    const audioType = urlParams.get('type') || 'sub';
    const targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) {
        playerRoot.innerHTML = `<p class="text-red-500 font-bold uppercase tracking-widest text-xs">Error: Missing Anime ID or Episode Number</p>`;
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/?url='; 

    // 2. Dynamically Load HLS.js
    if (typeof window.Hls === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Advanced Error HUD Handler Function
    const triggerFatalPlayerError = (title, code, details) => {
        const overlay = document.getElementById('player-error-overlay');
        const errTitle = document.getElementById('player-error-title');
        const errCode = document.getElementById('player-error-code');
        const errDetails = document.getElementById('player-error-details');

        if (overlay && errTitle && errCode && errDetails) {
            errTitle.innerText = title;
            errCode.innerText = `ERROR CODE: ${code}`;
            errDetails.innerText = details;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        } else {
            // Fallback injection if the error occurs before innerHTML is fully mounted
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500/20 rounded-xl">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2 animate-pulse"></i>
                    <h3 class="text-white font-black text-sm uppercase tracking-widest">${title}</h3>
                    <p class="text-red-500 font-mono text-[10px] mt-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">${code}</p>
                    <p class="text-gray-400 text-[10px] mt-2 max-w-sm leading-relaxed font-mono">${details}</p>
                    <button onclick="window.location.reload()" class="mt-4 border border-white/10 bg-white/5 px-4 py-1.5 rounded text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:text-black transition-colors">Retry</button>
                </div>
            `;
        }
    };

    try {
        // 3. FETCH STREAM DATA FROM VERCEL API
        let streamData = null;
        let isFallback = false;

        const fetchStream = async (endpoint) => {
            const targetUrl = `${baseUrl}${endpoint}?id=${animeId}&ep=${currentEpNum}&server=${targetServer}&type=${audioType}`;
            try {
                const res = await fetch(targetUrl);
                
                if (!res.ok) {
                    console.warn(`[API HTTP Error] Status: ${res.status}`);
                    return null; 
                }

                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) return null;

                const json = await res.json();
                if (json.success && json.data && json.data.m3u8) return json.data;
            } catch (err) { 
                console.error(`[Player API Catch]`, err); 
            }
            return null;
        };

        streamData = await fetchStream('/api/stream');
        
        if (!streamData) {
            console.log("[Player] Primary node failed to return JSON, trying fallback route...");
            streamData = await fetchStream('/api/stream/fallback');
            isFallback = true;
        }

        if (!streamData) {
            triggerFatalPlayerError(
                "API Handshake Failed",
                "ERR_V_API_NULL_RESPONSE",
                `The Vercel API endpoint (${baseUrl}/api/stream) responded, but it failed to provide a valid JSON manifest object. Either the anime ID '${animeId}' is invalid, the episode isn't scraped yet, or the route threw a backend 500 exception.`
            );
            return;
        }

        const streamUrl = streamData.m3u8; 
        const tracks = streamData.subtitles || []; 
        
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        // 4. MOUNT PLAYER CORE AND REBUILT DIAGNOSTIC HUD LAYER
        playerRoot.innerHTML = `
            <video id="main-video-player" controls crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black outline-none shadow-2xl"></video>
            
            <button id="skip-intro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Outro / Next Ep <i class="fas fa-step-forward ml-1"></i>
            </button>
            
            ${isFallback ? '<div class="absolute top-4 left-4 bg-red-500/80 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md pointer-events-none z-50">Fallback Server Active</div>' : ''}
            
            <div id="player-error-overlay" class="absolute inset-0 bg-[#070707]/95 backdrop-blur-md flex-col items-center justify-center p-6 hidden z-[100] animate-fade-in transition-all border border-red-500/10 rounded-xl">
                <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 mb-4 shadow-inner">
                    <i class="fas fa-exclamation-triangle text-xl animate-pulse"></i>
                </div>
                <h3 id="player-error-title" class="text-white font-black text-sm md:text-base uppercase tracking-widest text-center">Playback Exception</h3>
                <span id="player-error-code" class="text-red-400 font-mono text-[9px] md:text-[10px] bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md mt-2 tracking-wider font-bold">ERROR_CODE</span>
                
                <div class="w-full max-w-md bg-black/60 border border-white/5 p-3.5 rounded-lg mt-4 shadow-md">
                    <p class="text-gray-500 text-[8px] font-black uppercase tracking-widest mb-1 select-none"><i class="fas fa-terminal text-[#F47521]"></i> Diagnostic Debug Stream Logs</p>
                    <p id="player-error-details" class="text-gray-300 text-[10px] md:text-xs font-mono leading-relaxed break-words max-h-32 overflow-y-auto hide-scrollbar"></p>
                </div>
                
                <div class="flex items-center gap-3 mt-5">
                    <button onclick="window.location.reload()" class="bg-[#F47521] text-black font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-lg hover:bg-white transition-colors shadow-lg">
                        <i class="fas fa-sync-alt mr-1"></i> Reboot Stream
                    </button>
                    <button onclick="document.getElementById('player-error-overlay').classList.add('hidden')" class="bg-white/5 border border-white/10 text-gray-400 font-bold uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg hover:text-white hover:bg-white/10 transition-all">
                        Ignore
                    </button>
                </div>
            </div>
        `;

        const video = document.getElementById('main-video-player');

        // 5. INJECT SUBTITLES VIA PROXY
        tracks.forEach(track => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track');
                trackEl.kind = track.kind;
                trackEl.label = track.label || 'English';
                trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                trackEl.src = customProxyUrl + encodeURIComponent(track.file); 
                if (track.default) trackEl.default = true;
                video.appendChild(trackEl);
            }
        });

        // 6. INITIALIZE PROXIED HLS ENGINE WITH DETAILED STREAM MONITORS
        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                xhrSetup: function (xhr, url) {
                    xhr.open('GET', customProxyUrl + encodeURIComponent(url), true);
                }
            });
            
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log("Autoplay blocked by standard browser policies."));
            });

            // Deep HLS Event Error Diagnostics Mapping
            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("HLS Network Fail Trace:", data);
                            
                            if (data.details === "manifestLoadError") {
                                let statusMsg = data.response?.status ? `[HTTP Status ${data.response.status}]` : '(Connection Timed Out/Refused)';
                                triggerFatalPlayerError(
                                    "Manifest Request Refused",
                                    "HLS_FATAL_MANIFEST_LOAD_ERROR",
                                    `Your Cloudflare worker successfully called the endpoint, but the source streaming host rejected the manifest request ${statusMsg}. Stream URL attempted: ${streamUrl}. This usually indicates a 403 Forbidden hotlinking prevention trigger.`
                                );
                            } else if (data.details === "fragLoadError") {
                                triggerFatalPlayerError(
                                    "Video Segment Blocked",
                                    "HLS_FATAL_FRAGMENT_LOAD_ERROR",
                                    `The index manifest (.m3u8) parsed successfully, but your Cloudflare proxy was blocked while trying to download the video segment chunk (.ts files). The host server's anti-bot threshold triggered on bandwidth utilization.`
                                );
                            } else {
                                // Attempt non-breaking recovery loop
                                hls.startLoad();
                            }
                            break;

                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.warn("HLS Media Parsing Error. Attempting internal pipeline recovery...", data.details);
                            hls.recoverMediaError();
                            break;

                        default:
                            triggerFatalPlayerError(
                                "Core Pipeline Crash",
                                `HLS_CRITICAL_${data.details.toUpperCase()}`,
                                `The internal Hls.js execution core crashed due to an unhandled stream exception. Details provided by runtime: ${data.reason || 'No crash trace logs available.'}`
                            );
                            hls.destroy();
                            break;
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Apple/Safari Native fallback routing diagnostics
            video.src = customProxyUrl + encodeURIComponent(streamUrl);
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay prevented."));
            });
            video.addEventListener('error', function(e) {
                triggerFatalPlayerError(
                    "Native Stream Error",
                    "SAFARI_NATIVE_HTML5_ERROR",
                    `The browser's native AVFoundation media layer refused to initialize or read the proxied stream asset source: ${streamUrl}. Code mapping trace index mismatch.`
                );
            });
        }

        // 7. AUTO-SKIP ACTION EVENT TRIGGERS
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
                if (autoSkipOutro) { window.app.triggerNextEpisode(); } 
                else { skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); }
            } else { skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0'); }
        });

        skipIntroBtn.addEventListener('click', () => { video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', () => { window.app.triggerNextEpisode(); });

    } catch (error) {
        triggerFatalPlayerError(
            "Frontend Engine Exception",
            "ERR_PLAYER_JS_CATCH_FATAL",
            `A runtime error occurred within player.js stack layer: ${error.message}. Review browser logs for line trace allocation metrics mapping context.`
        );
    }
};
