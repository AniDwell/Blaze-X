// player.js

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    const controlsContainer = document.getElementById('player-controls-container');
    if (!playerRoot || !controlsContainer) return;

    // Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id');
    const animeId = urlParams.get('anime');
    const audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!episodeId) return;

    // Base API URL
    const baseUrl = 'https://anikoto-api-xi.vercel.app';

    // 1. DYNAMICALLY LOAD HLS.JS (If not already loaded)
    if (typeof window.Hls === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    try {
        // 2. FETCH STREAM DATA (Primary -> Fallback)
        let streamData = null;
        let isFallback = false;

        const fetchStream = async (endpoint) => {
            const res = await fetch(`${baseUrl}${endpoint}?id=${encodeURIComponent(episodeId)}&server=${targetServer}&type=${audioType}`);
            const json = await res.json();
            if (json.success && json.results && json.results.streamingLink && json.results.streamingLink.length > 0) {
                return json.results;
            }
            return null;
        };

        // Try Primary
        streamData = await fetchStream('/api/stream');
        
        // Try Fallback if Primary fails
        if (!streamData) {
            console.log("Primary stream failed, attempting fallback...");
            streamData = await fetchStream('/api/stream/fallback');
            isFallback = true;
        }

        if (!streamData) {
            throw new Error("No streaming sources available for this episode.");
        }

        const streamInfo = streamData.streamingLink[0];
        const streamUrl = streamInfo.link.file;
        const tracks = streamInfo.tracks || [];
        const servers = streamData.servers || [];
        
        // Timestamps (defaults to 0 if not present)
        const introStart = streamInfo.intro?.start || 0;
        const introEnd = streamInfo.intro?.end || 0;
        const outroStart = streamInfo.outro?.start || 0;
        const outroEnd = streamInfo.outro?.end || 0;

        // 3. BUILD PLAYER UI
        playerRoot.innerHTML = `
            <video id="main-video-player" controls crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black outline-none">
                </video>
            
            <button id="skip-intro-btn" class="absolute bottom-16 right-4 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-16 right-4 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Outro / Next Ep <i class="fas fa-step-forward ml-1"></i>
            </button>
        `;

        const video = document.getElementById('main-video-player');

        // Inject Subtitle Tracks natively into HTML5 Video
        tracks.forEach(track => {
            if (track.kind === 'captions' || track.kind === 'subtitles') {
                const trackEl = document.createElement('track');
                trackEl.kind = track.kind;
                trackEl.label = track.label || 'Subtitle';
                trackEl.srclang = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                trackEl.src = track.file;
                if (track.default) trackEl.default = true;
                video.appendChild(trackEl);
            }
        });

        // 4. INITIALIZE HLS STREAM
        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30, // Optimized buffering for smoother streaming
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                // Auto-play attempt (muted if browsers block unmuted autoplay)
                video.play().catch(e => console.log("Autoplay prevented by browser policies."));
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS support
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay prevented."));
            });
        }

        // 5. AUTO-SKIP & OVERLAY BUTTON LOGIC
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');

        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

            // Intro Logic
            if (introEnd > 0 && t >= introStart && t < introEnd) {
                if (autoSkipIntro) {
                    video.currentTime = introEnd;
                } else {
                    skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
                }
            } else {
                skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0');
            }

            // Outro Logic
            if (outroEnd > 0 && t >= outroStart && t < outroEnd) {
                if (autoSkipOutro) {
                    // Logic to jump to next episode (Mark as watched threshold passed)
                    window.app.triggerNextEpisode();
                } else {
                    skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
                }
            } else {
                skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0');
            }
        });

        // Button Clicks
        skipIntroBtn.addEventListener('click', () => { video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', () => { window.app.triggerNextEpisode(); });


        // 6. RENDER SERVERS UI IN CONTROLS CONTAINER
        let serversHtml = '';
        if (servers.length > 0) {
            servers.forEach(srv => {
                const isActive = targetServer === srv.serverName || targetServer === srv.server_name;
                const activeClasses = isActive 
                    ? 'bg-[#F47521] text-black border-[#F47521] shadow-md font-black' 
                    : 'bg-[#111] text-gray-400 border-white/10 hover:bg-white/10 hover:text-white';
                
                serversHtml += `
                    <button onclick="window.app.changeStreamServer('${srv.serverName || srv.server_name}')" class="px-4 py-2.5 rounded-lg border text-[10px] md:text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${activeClasses}">
                        <i class="fas fa-server"></i> ${srv.serverName || srv.server_name}
                    </button>
                `;
            });
        } else {
            serversHtml = `<span class="text-gray-500 text-xs">No alternative servers available.</span>`;
        }

        controlsContainer.innerHTML = `
            <div class="lg:col-span-3 w-full bg-[#0a0a0a] rounded-xl border border-white/5 p-4 flex flex-col gap-3 shadow-md animate-fade-in">
                <h4 class="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-1 text-gray-400">
                    <i class="fas fa-network-wired text-[#F47521]"></i> Available Servers ${isFallback ? '<span class="text-red-500 ml-2">(Fallback Mode)</span>' : ''}
                </h4>
                <div class="flex flex-wrap gap-2.5 w-full">
                    ${serversHtml}
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Player Instantiation Failed:", error);
        playerRoot.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-6">
                <i class="fas fa-video-slash text-4xl text-red-500 mb-3"></i>
                <p class="text-white font-black text-sm uppercase tracking-wider">Stream Unavailable</p>
                <p class="text-gray-400 text-xs mt-1 max-w-xs leading-relaxed">${error.message}</p>
                <button onclick="window.location.reload()" class="mt-4 border border-white/20 px-4 py-2 rounded text-[10px] font-bold uppercase text-white hover:bg-white hover:text-black transition-colors">Retry Connection</button>
            </div>
        `;
        controlsContainer.innerHTML = '';
    }
};

// --- GLOBAL UTILITIES FOR PLAYER ---

// Change server without full page reload (updates URL and re-runs player component)
window.app.changeStreamServer = (newServer) => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('server') === newServer) return;
    
    urlParams.set('server', newServer);
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    
    // Show loader and Re-run player logic
    document.getElementById('blazex-player-root').innerHTML = `<div class="tk-loader scale-125 z-0"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>`;
    window.app.components.player();
};

// Trigger next episode logic
window.app.triggerNextEpisode = () => {
    const episodesList = window.app.state.currentEpisodesListProcessed || [];
    const currentEpNum = window.app.state.currentPlayingEpNum;
    
    if (episodesList.length > 0 && currentEpNum) {
        const nextEpObj = episodesList.find(e => (e.num || e.episode_no) == (currentEpNum + 1));
        if (nextEpObj) {
            const nextSlug = nextEpObj.slug || nextEpObj.id;
            const animeId = window.app.state.currentAnimePage.id;
            const currentLang = window.app.state.activeLanguageType || 'sub';
            window.location.href = `play.html?id=${encodeURIComponent(nextSlug)}&anime=${animeId}&ep=${currentEpNum + 1}&type=${currentLang}`;
            return;
        }
    }
    // If no next episode found or user reached the end
    if(window.app.showCustomAlert) {
        window.app.showCustomAlert("You have reached the latest episode!", "success");
    } else {
        alert("You have reached the latest episode!");
    }
};
