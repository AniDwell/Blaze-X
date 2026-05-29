// player.js

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // 1. Read URL Parameters matching the working API structure
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); // Maps to the API's ?id=
    const currentEpNum = urlParams.get('ep') || '1'; // Maps to the API's &ep=
    const audioType = urlParams.get('type') || 'sub';
    const targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) {
        playerRoot.innerHTML = `<p class="text-red-500 font-bold uppercase tracking-widest text-xs">Error: Missing Anime ID or Episode Number</p>`;
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';

    // 2. Dynamically Load HLS.js for .m3u8 playback
    if (typeof window.Hls === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    try {
        // 3. FETCH STREAM DATA (Using the Exact Working Endpoint Structure)
        let streamData = null;
        let isFallback = false;

        const fetchStream = async (endpoint) => {
            // Generating the exact URL that you just confirmed is working:
            // e.g., /api/stream?id=Dorohedoro-season-2-bqfe6&ep=1&server=hd-1&type=sub
            const targetUrl = `${baseUrl}${endpoint}?id=${animeId}&ep=${currentEpNum}&server=${targetServer}&type=${audioType}`;
            console.log(`[Player] Initiating connection to: ${targetUrl}`);

            try {
                const res = await fetch(targetUrl);
                
                // HTML Error Page Fallback Check
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    console.warn(`[Player] Endpoint returned HTML instead of JSON. Fallback required.`);
                    return null;
                }

                const json = await res.json();
                
                // Parsing the exact JSON schema provided by the Vercel API
                if (json.success && json.data && json.data.m3u8) {
                    return json.data;
                }
            } catch (err) {
                console.error(`[Player] Network error:`, err);
            }
            return null;
        };

        // Try Primary Stream First
        streamData = await fetchStream('/api/stream');
        
        // Try Fallback if Primary Fails
        if (!streamData) {
            console.log("[Player] Primary failed, switching to fallback node...");
            streamData = await fetchStream('/api/stream/fallback');
            isFallback = true;
        }

        if (!streamData) throw new Error("API returned no playable video source. Check server status.");

        // 4. MAP EXTRACTED DATA
        const streamUrl = streamData.m3u8; 
        const tracks = streamData.subtitles || []; 
        
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        // 5. BUILD VIDEO PLAYER UI
        playerRoot.innerHTML = `
            <video id="main-video-player" controls crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black outline-none shadow-2xl">
                </video>
            
            <button id="skip-intro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Outro / Next Ep <i class="fas fa-step-forward ml-1"></i>
            </button>
            
            ${isFallback ? '<div class="absolute top-4 left-4 bg-red-500/80 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md pointer-events-none">Fallback Node Active</div>' : ''}
        `;

        const video = document.getElementById('main-video-player');

        // 6. INJECT SUBTITLE TRACKS NATIVELY
        tracks.forEach(track => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track');
                trackEl.kind = track.kind;
                trackEl.label = track.label || 'English';
                trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                trackEl.src = track.file;
                if (track.default) trackEl.default = true;
                video.appendChild(trackEl);
            }
        });

        // 7. INITIALIZE HLS STREAM ENGINE
        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log("Autoplay prevented by browser interactions logic."));
            });

            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("fatal network error encountered, try to recover");
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari Native Playback
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay prevented."));
            });
        }

        // 8. AUTO-SKIP LOGIC OVERLAYS
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');

        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            
            const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

            // Intro Skip UI/Logic
            if (introEnd > 0 && t >= introStart && t < introEnd) {
                if (autoSkipIntro) {
                    video.currentTime = introEnd; 
                } else {
                    skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); 
                }
            } else {
                skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0'); 
            }

            // Outro Skip UI/Logic
            if (outroEnd > 0 && t >= outroStart && t < outroEnd) {
                if (autoSkipOutro) {
                    window.app.triggerNextEpisode(); 
                } else {
                    skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); 
                }
            } else {
                skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0'); 
            }
        });

        skipIntroBtn.addEventListener('click', () => { video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', () => { window.app.triggerNextEpisode(); });

    } catch (error) {
        console.error("Player Instantiation Failed:", error);
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

// Global routing for next episode is handled in play.js
