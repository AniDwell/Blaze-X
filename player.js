// player.js

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // --- BOOT SEQUENCE LOGGER (Diagnostic HUD) ---
    const setBootStatus = (msg, isError = false) => {
        if (isError) {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#050505] border border-red-500/20 rounded-xl">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-500 mb-2 animate-pulse"></i>
                    <h3 class="text-white font-black text-sm uppercase tracking-widest">Playback Halted</h3>
                    <p class="text-red-400 font-mono text-[10px] mt-2 bg-red-500/10 px-3 py-1 rounded border border-red-500/20 max-w-md">${msg}</p>
                    <button onclick="window.location.reload()" class="mt-5 border border-white/10 bg-white/5 px-6 py-2 rounded-lg text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:text-black transition-colors">Reboot Stream</button>
                </div>
            `;
        } else {
            playerRoot.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-black">
                    <div class="tk-loader scale-125 z-0 mb-6">
                        <div class="tk-dot tk-dot-1"></div>
                        <div class="tk-dot tk-dot-2"></div>
                    </div>
                    <p class="text-[#F47521] font-mono font-bold uppercase tracking-widest text-[9px] md:text-[10px] bg-[#F47521]/10 border border-[#F47521]/20 px-4 py-1.5 rounded shadow-lg animate-pulse">${msg}</p>
                </div>
            `;
        }
    };

    setBootStatus("STEP 1/4: Analyzing URL Parameters...");

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); 
    const currentEpNum = urlParams.get('ep') || '1'; 
    const audioType = urlParams.get('type') || 'sub';
    const targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) {
        setBootStatus("Missing URL Parameters (Anime ID or Episode).", true);
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    // TUMHARA NAYA BULLETPROOF CLOUDFLARE PROXY
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/?url='; 

    setBootStatus("STEP 2/4: Injecting HLS Decoding Engine...");
    
    // SAFE SCRIPT LOADING WITH TIMEOUT
    if (typeof window.Hls === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                script.onload = resolve;
                script.onerror = () => reject(new Error("Network blocked script injection."));
                document.head.appendChild(script);
                setTimeout(() => reject(new Error("Timeout while loading HLS engine.")), 5000);
            });
        } catch (e) {
            setBootStatus(`Engine Failure: ${e.message}`, true);
            return;
        }
    }

    try {
        setBootStatus("STEP 3/4: Negotiating with Streaming API...");
        
        let streamData = null;
        let isFallback = false;

        const fetchStream = async (endpoint) => {
            const targetUrl = `${baseUrl}${endpoint}?id=${animeId}&ep=${currentEpNum}&server=${targetServer}&type=${audioType}`;
            try {
                const res = await fetch(targetUrl);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("API Route crashed (HTML Error received).");
                }
                const json = await res.json();
                if (json.success && json.data && json.data.m3u8) return json.data;
            } catch (err) { 
                console.warn(`[API] ${endpoint} Failed:`, err.message); 
                return err.message; 
            }
            return null;
        };

        const primaryResult = await fetchStream('/api/stream');
        
        if (typeof primaryResult === 'string' || !primaryResult) {
            setBootStatus("Primary Node Offline. Rerouting to Fallback...", false);
            const fallbackResult = await fetchStream('/api/stream/fallback');
            
            if (typeof fallbackResult === 'string') {
                throw new Error(`API completely unresponsive. Trace: ${fallbackResult}`);
            } else if (!fallbackResult) {
                throw new Error("API connected but data is empty. Episode may not exist.");
            } else {
                streamData = fallbackResult;
                isFallback = true;
            }
        } else {
            streamData = primaryResult;
        }

        setBootStatus("STEP 4/4: Constructing Media Pipeline...");

        const streamUrl = streamData.m3u8; 
        const targetReferer = streamData.referer || "https://vidwish.live/";
        const tracks = streamData.subtitles || []; 
        const introStart = streamData.intro?.start || 0;
        const introEnd = streamData.intro?.end || 0;
        const outroStart = streamData.outro?.start || 0;
        const outroEnd = streamData.outro?.end || 0;

        // PLAYER HTML ARCHITECTURE
        playerRoot.innerHTML = `
            <video id="main-video-player" controls crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black outline-none shadow-2xl animate-fade-in"></video>
            
            <button id="skip-intro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Outro / Next Ep <i class="fas fa-step-forward ml-1"></i>
            </button>
            
            ${isFallback ? '<div class="absolute top-4 left-4 bg-red-500/80 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md pointer-events-none z-50">Fallback Node Active</div>' : ''}
        `;

        const video = document.getElementById('main-video-player');

        // SUBTITLES VIA PROXY
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

        // 🚀 THE ULTIMATE FIX: PROXIED HLS.JS ENGINE
        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                // Passing every request through your V2 Cloudflare worker with the secret Referer header
                xhrSetup: function (xhr, url) {
                    xhr.open('GET', customProxyUrl + encodeURIComponent(url), true);
                    xhr.setRequestHeader('x-proxy-referer', targetReferer);
                }
            });
            
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log("Autoplay blocked by standard browser policies."));
            });

            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        setBootStatus(`Cloudflare/Host Block: Proxy failed to bypass anti-hotlinking. Details: ${data.details}`, true);
                        hls.destroy();
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        setBootStatus(`HLS Crash: ${data.details}`, true);
                        hls.destroy();
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari Fallback
            video.src = customProxyUrl + encodeURIComponent(streamUrl);
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay blocked."));
            });
            video.addEventListener('error', function(e) {
                setBootStatus("Native playback rejected proxy stream.", true);
            });
        }

        // AUTO-SKIP EVENT LISTENERS
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
        setBootStatus(error.message, true);
    }
};
