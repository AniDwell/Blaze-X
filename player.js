// player.js

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id'); // e.g., frieren-beyond-journeys-end-18542?ep=107257
    const audioType = urlParams.get('type') || 'sub';
    const targetServer = urlParams.get('server') || 'hd-1';

    if (!episodeId) {
        playerRoot.innerHTML = `<p class="text-red-500 font-bold uppercase tracking-widest text-xs">Error: Missing Episode ID</p>`;
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';

    // 2. Dynamically Load HLS.js (Industry standard for playing .m3u8 anime streams)
    if (typeof window.Hls === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    try {
        // 3. FETCH STREAM DATA (Primary -> Fallback Routing)
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

        // Try Primary Server Endpoint
        streamData = await fetchStream('/api/stream');
        
        // Try Fallback Endpoint if Primary fails or returns empty
        if (!streamData) {
            console.log("Primary stream failed, attempting fallback...");
            streamData = await fetchStream('/api/stream/fallback');
            isFallback = true;
        }

        if (!streamData) throw new Error("No streaming sources available for this episode.");

        // Extract Data
        const streamInfo = streamData.streamingLink[0];
        const streamUrl = streamInfo.link.file;
        const tracks = streamInfo.tracks || [];
        
        // Extract Timestamps (Fallback to 0 if none provided)
        const introStart = streamInfo.intro?.start || 0;
        const introEnd = streamInfo.intro?.end || 0;
        const outroStart = streamInfo.outro?.start || 0;
        const outroEnd = streamInfo.outro?.end || 0;

        // 4. BUILD VIDEO PLAYER UI
        playerRoot.innerHTML = `
            <video id="main-video-player" controls crossorigin="anonymous" playsinline class="w-full h-full object-contain bg-black outline-none shadow-2xl">
                <!-- Subtitles injected dynamically -->
            </video>
            
            <!-- Custom Skip Buttons Overlay -->
            <button id="skip-intro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Intro <i class="fas fa-forward ml-1"></i>
            </button>
            <button id="skip-outro-btn" class="absolute bottom-20 right-6 bg-white text-black font-black uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 rounded shadow-lg transition-transform transform translate-x-[150%] opacity-0 hover:bg-[#F47521] hover:text-white z-50">
                Skip Outro / Next Ep <i class="fas fa-step-forward ml-1"></i>
            </button>
            
            ${isFallback ? '<div class="absolute top-4 left-4 bg-red-500/80 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">Fallback Server Active</div>' : ''}
        `;

        const video = document.getElementById('main-video-player');

        // 5. INJECT SUBTITLE TRACKS
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

        // 6. INITIALIZE HLS STREAM
        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30, // Optimized buffering
                maxMaxBufferLength: 60,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                // Attempt autoplay (might be blocked by browser policies until user interacts)
                video.play().catch(e => console.log("Autoplay prevented by browser policies. Waiting for user interaction."));
            });

            // Handle HLS Errors smoothly
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
            // Safari Native HLS Support
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log("Autoplay prevented by browser."));
            });
        }

        // 7. AUTO-SKIP & OVERLAY BUTTON LOGIC
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');

        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            
            // Re-check local storage in real-time in case user toggled it while watching
            const autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
            const autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

            // Intro Skip Logic
            if (introEnd > 0 && t >= introStart && t < introEnd) {
                if (autoSkipIntro) {
                    video.currentTime = introEnd; // Auto jump
                } else {
                    skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); // Show button
                }
            } else {
                skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0'); // Hide button
            }

            // Outro Skip Logic
            if (outroEnd > 0 && t >= outroStart && t < outroEnd) {
                if (autoSkipOutro) {
                    window.app.triggerNextEpisode(); // Auto jump to next episode
                } else {
                    skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); // Show button
                }
            } else {
                skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0'); // Hide button
            }
        });

        // Button Click Listeners
        skipIntroBtn.addEventListener('click', () => { video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', () => { window.app.triggerNextEpisode(); });


    } catch (error) {
        console.error("Player Instantiation Failed:", error);
        playerRoot.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-6 w-full h-full bg-[#0a0a0a]">
                <i class="fas fa-video-slash text-4xl text-red-500 mb-3"></i>
                <p class="text-white font-black text-sm uppercase tracking-wider">Stream Unavailable</p>
                <p class="text-gray-400 text-[10px] mt-1 max-w-xs leading-relaxed">${error.message}</p>
                <button onclick="window.location.reload()" class="mt-4 border border-white/20 bg-white/5 px-6 py-2 rounded-lg text-[10px] font-bold uppercase text-white hover:bg-[#F47521] hover:border-[#F47521] hover:text-black transition-colors shadow-lg">Retry Connection</button>
            </div>
        `;
    }
};

// --- HELPER FUNCTION: Trigger Next Episode ---
window.app.triggerNextEpisode = () => {
    const episodesList = window.app.state.currentEpisodesListProcessed || [];
    const currentEpNum = window.app.state.currentPlayingEpNum;
    
    if (episodesList.length > 0 && currentEpNum) {
        // Find the next episode object
        const nextEpObj = episodesList.find(e => (e.num || e.episode_no) == (currentEpNum + 1));
        
        if (nextEpObj) {
            const nextSlug = nextEpObj.slug || nextEpObj.id;
            const animeId = window.app.state.currentAnimePage.id;
            const currentLang = window.app.state.activeLanguageType || 'sub';
            const currentServer = new URLSearchParams(window.location.search).get('server') || 'hd-1';
            
            // Redirect to next episode
            window.location.href = `play.html?id=${encodeURIComponent(nextSlug)}&anime=${animeId}&ep=${currentEpNum + 1}&type=${currentLang}&server=${currentServer}`;
            return;
        }
    }
    
    // Fallback if no next episode exists
    if(window.app.showCustomAlert) {
        window.app.showCustomAlert("You have reached the latest episode!", "success");
    } else {
        alert("You have reached the latest episode!");
    }
};

// Global Execution
// The player component is invoked directly by play.js after the UI is built.
