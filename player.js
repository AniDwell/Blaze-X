// player.js

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

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

    if (typeof window.Hls === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    try {
        let streamData = null;
        let isFallback = false;

        const fetchStream = async (endpoint) => {
            const targetUrl = `${baseUrl}${endpoint}?id=${animeId}&ep=${currentEpNum}&server=${targetServer}&type=${audioType}`;
            try {
                const res = await fetch(targetUrl);
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) return null;

                const json = await res.json();
                if (json.success && json.data && json.data.m3u8) return json.data;
            } catch (err) { console.error(`[Player] Network error:`, err); }
            return null;
        };

        streamData = await fetchStream('/api/stream');
        
        if (!streamData) {
            streamData = await fetchStream('/api/stream/fallback');
            isFallback = true;
        }

        if (!streamData) throw new Error("API returned no playable video source. Server might be down.");

        const streamUrl = streamData.m3u8; 
        const tracks = streamData.subtitles || []; 
        
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        playerRoot.innerHTML = `
            <video id="main-video-player" controls crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black outline-none shadow-2xl"></video>
            
            <button id="skip-intro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Outro / Next Ep <i class="fas fa-step-forward ml-1"></i>
            </button>
            
            ${isFallback ? '<div class="absolute top-4 left-4 bg-red-500/80 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md pointer-events-none z-50">Fallback Node Active</div>' : ''}
            
            <div id="player-error-overlay" class="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 hidden z-[100]">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-3"></i>
                <h3 class="text-white font-black text-sm uppercase tracking-widest mb-1">Playback Failed</h3>
                <p id="player-error-text" class="text-gray-400 text-[10px] text-center max-w-md font-mono"></p>
                <button onclick="window.location.reload()" class="mt-4 border border-white/20 px-4 py-2 rounded text-[10px] font-bold uppercase text-white hover:bg-white hover:text-black transition-colors">Reload Player</button>
            </div>
        `;

        const video = document.getElementById('main-video-player');
        const errorOverlay = document.getElementById('player-error-overlay');
        const errorText = document.getElementById('player-error-text');

        // Show Error Function
        const triggerFatalError = (msg) => {
            errorText.innerText = msg;
            errorOverlay.classList.remove('hidden');
        };

        tracks.forEach(track => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track');
                trackEl.kind = track.kind;
                trackEl.label = track.label || 'English';
                trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                trackEl.src = track.file; // Direct file URL
                if (track.default) trackEl.default = true;
                video.appendChild(trackEl);
            }
        });

        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                // PROXY REMOVED: Relying on <meta name="referrer" content="no-referrer"> to bypass Cloudflare natively
            });
            
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log("Autoplay prevented by browser interactions logic."));
            });

            // HLS Error Handling (Logs directly to video screen now)
            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("HLS Network Error:", data.details);
                            if(data.details === "manifestLoadError") {
                                triggerFatalError(`NETWORK BLOCKED: The streaming server refused connection. (CORS/Cloudflare block on manifest).`);
                            } else if (data.details === "fragLoadError") {
                                triggerFatalError(`FRAG BLOCKED: Manifest loaded, but video chunks (.ts files) are blocked by the host.`);
                            } else {
                                hls.startLoad();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            triggerFatalError(`CRITICAL ERROR: ${data.details}`);
                            hls.destroy();
                            break;
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay prevented."));
            });
            video.addEventListener('error', function(e) {
                triggerFatalError("Native playback failed to load stream.");
            });
        }

        // Auto-Skip Logic
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
        playerRoot.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#0a0a0a]">
                <i class="fas fa-video-slash text-4xl text-red-500 mb-3"></i>
                <p class="text-white font-black text-sm uppercase tracking-wider">Stream Unavailable</p>
                <p class="text-gray-400 text-[10px] mt-2 max-w-sm leading-relaxed">${error.message}</p>
                <button onclick="window.location.reload()" class="mt-6 border border-white/20 bg-white/5 px-6 py-2 rounded-lg text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:border-[#F47521] hover:text-black transition-colors shadow-lg">Retry Connection</button>
            </div>
        `;
    }
};
