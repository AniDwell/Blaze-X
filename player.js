// player.js - Custom Cinematic Video Engine

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    let hideTimer;
    let tapTimeout;
    let pressTimer;
    let hlsInstance = null;

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

    setBootStatus("Analyzing URL Parameters...");

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('anime'); 
    const currentEpNum = parseInt(urlParams.get('ep') || '1'); 
    const audioType = urlParams.get('type') || 'sub';
    let targetServer = urlParams.get('server') || 'hd-1';

    if (!animeId || !currentEpNum) {
        setBootStatus("Missing URL Parameters (Anime ID or Episode).", true);
        return;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    // Inject Player & Expanded Subtitle CSS
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
            }
            ::cue {
                color: var(--sub-color);
                background-color: var(--sub-bg);
                font-family: var(--sub-font);
                font-size: var(--sub-size);
                text-shadow: var(--sub-shadow);
                font-weight: 800;
            }
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
            
            /* Buffer Spinner */
            .loader-ring { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-left-color: #F47521; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
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
        } catch (e) {
            setBootStatus(`Engine Failure: ${e.message}`, true);
            return;
        }
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

        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black group flex items-center justify-center overflow-hidden">
                <video id="main-video-player" crossorigin="anonymous" playsinline class="w-full h-full object-contain pointer-events-none"></video>
                
                <div id="buffer-overlay" class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 hidden">
                    <div class="loader-ring"></div>
                </div>

                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>
                
                <div id="speed-indicator" class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-opacity duration-200 opacity-0 z-40 flex items-center gap-2 border border-white/10">
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

                <div id="ui-layer" class="player-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none">
                    
                    <div class="w-full flex items-start justify-between p-4 pointer-events-auto">
                        <div class="flex flex-col pr-4">
                            <h2 class="text-white text-xs md:text-sm font-bold tracking-wide truncate">Episode ${currentEpNum}</h2>
                            <p id="ep-desc" class="text-gray-400 text-[11px] line-clamp-3 max-w-2xl mt-2 leading-relaxed">Loading metadata...</p>
                        </div>
                        ${targetServer === 'hd-2' ? '<span class="bg-[#F47521] text-black px-2 py-0.5 rounded text-[8px] font-black uppercase border border-black mt-1">HD-2</span>' : ''}
                    </div>
                    
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="w-16 h-16 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full text-white flex items-center justify-center hover:bg-[#F47521]/90 hover:border-[#F47521] hover:scale-110 transition-all">
                            <i id="center-play-icon" class="fas fa-play text-2xl ml-1"></i>
                        </button>
                    </div>

                    <div class="w-full flex flex-col px-4 pb-3 pt-4 pointer-events-auto">
                        
                        <div class="w-full flex items-center gap-3 mb-2">
                            <span id="time-current" class="text-white text-[10px] font-mono w-10 text-right">00:00</span>
                            <input type="range" id="progress-bar" class="blazex-slider flex-1" value="0" min="0" step="0.1">
                            <span id="time-duration" class="text-gray-400 text-[10px] font-mono w-10">00:00</span>
                        </div>

                        <div class="w-full flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <button id="bottom-play-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="bottom-play-icon" class="fas fa-play text-lg"></i></button>
                            </div>
                            
                            <div class="flex items-center gap-4 relative">
                                
                                <button id="speed-btn" class="text-white hover:text-[#F47521] transition-colors font-black text-[12px] w-8 text-center">1x</button>
                                
                                <div class="relative hidden group audio-container">
                                    <button id="audio-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-headphones text-lg"></i></button>
                                    <div id="audio-menu" class="hidden absolute bottom-full right-0 mb-4 w-40 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded-xl p-2 flex flex-col gap-1 z-50">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Audio Track</div>
                                        <div id="audio-list" class="flex flex-col gap-1 max-h-32 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <div class="relative group subs-container">
                                    <button id="subs-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-closed-captioning text-lg"></i></button>
                                    <div id="subs-menu" class="hidden absolute bottom-full right-[-50px] md:right-0 mb-4 w-56 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-2 z-50 max-h-[60vh] overflow-y-auto hide-scrollbar shadow-2xl">
                                        
                                        <div>
                                            <div class="text-[9px] font-black uppercase text-gray-500 px-1 pb-1">Track</div>
                                            <div id="subs-list" class="flex flex-col gap-1"></div>
                                        </div>

                                        <div class="border-t border-white/10 pt-2">
                                            <div class="text-[9px] font-black uppercase text-gray-500 px-1 pb-1">Color</div>
                                            <div class="flex flex-wrap gap-2 px-1">
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-white" data-color="#FFFFFF"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-[#F47521]" data-color="#F47521"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-yellow-400" data-color="#FACC15"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-green-400" data-color="#4ADE80"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-blue-400" data-color="#60A5FA"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-pink-400" data-color="#F472B6"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-red-500" data-color="#EF4444"></button>
                                                <button class="sub-color-btn w-5 h-5 rounded-full border border-white/20 bg-purple-400" data-color="#A78BFA"></button>
                                            </div>
                                        </div>

                                        <div class="border-t border-white/10 pt-2">
                                            <div class="text-[9px] font-black uppercase text-gray-500 px-1 pb-1">Font Family</div>
                                            <div class="grid grid-cols-2 gap-1 px-1">
                                                <button class="sub-font-btn text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black font-sans" data-font="sans-serif">Sans</button>
                                                <button class="sub-font-btn text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black font-serif" data-font="serif">Serif</button>
                                                <button class="sub-font-btn text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black font-mono" data-font="monospace">Mono</button>
                                                <button class="sub-font-btn text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black" style="font-family: 'Comic Sans MS', cursive;" data-font="'Comic Sans MS', cursive, sans-serif">Comic</button>
                                            </div>
                                        </div>

                                        <div class="border-t border-white/10 pt-2">
                                            <div class="text-[9px] font-black uppercase text-gray-500 px-1 pb-1">Size</div>
                                            <div class="flex gap-1 px-1">
                                                <button class="sub-size-btn flex-1 text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black" data-size="75%">S</button>
                                                <button class="sub-size-btn flex-1 text-[10px] py-1 bg-[#F47521] text-black font-bold rounded" data-size="100%">M</button>
                                                <button class="sub-size-btn flex-1 text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black" data-size="150%">L</button>
                                                <button class="sub-size-btn flex-1 text-[10px] py-1 bg-white/5 rounded hover:bg-[#F47521] hover:text-black" data-size="200%">XL</button>
                                            </div>
                                        </div>

                                        <div class="border-t border-white/10 pt-2 pb-1">
                                            <div class="flex items-center justify-between px-1">
                                                <span class="text-[9px] font-black uppercase text-gray-500">Text Border</span>
                                                <button id="sub-border-toggle" class="text-[10px] px-3 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors" data-active="true">ON</button>
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                <button id="ar-btn" class="text-white hover:text-[#F47521] transition-colors"><i id="ar-icon" class="fas fa-tv text-md"></i></button>

                                <div class="relative group quality-container">
                                    <button id="quality-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-cog text-lg"></i></button>
                                    <div id="quality-menu" class="hidden absolute bottom-full right-0 mb-4 w-40 bg-[#111]/95 backdrop-blur-md border border-white/10 rounded-xl p-2 flex flex-col gap-1 z-50">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Quality</div>
                                        <div id="quality-list" class="flex flex-col gap-1 max-h-32 overflow-y-auto hide-scrollbar"></div>
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
        const bufferOverlay = document.getElementById('buffer-overlay');
        
        // Settings Elements
        const audioBtn = document.getElementById('audio-btn'), audioMenu = document.getElementById('audio-menu');
        const subsBtn = document.getElementById('subs-btn'), subsMenu = document.getElementById('subs-menu');
        const qualityBtn = document.getElementById('quality-btn'), qualityMenu = document.getElementById('quality-menu');
        const speedBtn = document.getElementById('speed-btn');
        const arBtn = document.getElementById('ar-btn');
        const arIcon = document.getElementById('ar-icon');

        // Buffer Events
        video.addEventListener('waiting', () => bufferOverlay.classList.remove('hidden'));
        video.addEventListener('playing', () => bufferOverlay.classList.add('hidden'));
        video.addEventListener('canplay', () => bufferOverlay.classList.add('hidden'));

        // Fetch AniList / Metadata
        const fetchEpisodeMetadata = async () => {
            try {
                const epDescEl = document.getElementById('ep-desc');
                const cleanSearch = animeId.replace(/-/g, ' ').replace(/[0-9a-z]{5}$/i, '').trim();
                
                const query = `
                query ($search: String) {
                    Media(search: $search, type: ANIME) {
                        id
                        title { romaji english }
                        description(asHtml: false)
                    }
                }`;
                
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: cleanSearch } })
                });
                const data = await res.json();
                
                if (data.data?.Media) {
                    epDescEl.innerText = data.data.Media.description 
                        ? data.data.Media.description.replace(/<[^>]*>?/gm, '')
                        : `${data.data.Media.title.english || data.data.Media.title.romaji} - Episode ${currentEpNum}`;
                }
            } catch (err) {
                console.warn("Failed to fetch AniList metadata.");
            }
        };
        fetchEpisodeMetadata();

        const closeAllMenus = () => {
            audioMenu.classList.add('hidden');
            subsMenu.classList.add('hidden');
            qualityMenu.classList.add('hidden');
        };

        // Aspect Ratio Logic with Dynamic SVGs
        const arModes = [
            { fit: 'contain', icon: 'fas fa-tv' },
            { fit: 'cover', icon: 'fas fa-crop' },
            { fit: 'fill', icon: 'fas fa-arrows-alt' }
        ];
        let arIndex = 0;
        arBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            arIndex = (arIndex + 1) % arModes.length;
            video.style.objectFit = arModes[arIndex].fit;
            arIcon.className = `${arModes[arIndex].icon} text-md`;
        });

        // Speed Logic
        const speeds = [0.5, 1, 1.25, 1.5, 2];
        let speedIdx = 1; // Default to 1x
        speedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            speedIdx = (speedIdx + 1) % speeds.length;
            video.playbackRate = speeds[speedIdx];
            speedBtn.innerText = speeds[speedIdx] + 'x';
        });

        // --- SUBTITLE CONTROLS & FIREBASE SYNC ---
        const db = window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
        const userUid = window.app.state?.activeProfile?.uid;

        async function saveSettingsToFirebase(settingsObj) {
            if (!db || !userUid || userUid === 'guest') return;
            try {
                await db.collection('users').doc(userUid).collection('episodes').doc(`${animeId}_${currentEpNum}`).set({
                    settings: settingsObj
                }, { merge: true });
            } catch(e) { console.warn("Firebase settings sync failed", e); }
        }

        let currentSubSettings = { color: '#FFFFFF', font: 'sans-serif', size: '100%', shadow: true };

        const updateSubCSSVars = () => {
            document.documentElement.style.setProperty('--sub-color', currentSubSettings.color);
            document.documentElement.style.setProperty('--sub-font', currentSubSettings.font);
            document.documentElement.style.setProperty('--sub-size', currentSubSettings.size);
            document.documentElement.style.setProperty('--sub-shadow', currentSubSettings.shadow ? '1px 1px 3px rgba(0,0,0,0.8), 0px 0px 5px rgba(0,0,0,0.8)' : 'none');
            document.documentElement.style.setProperty('--sub-bg', currentSubSettings.shadow ? 'transparent' : 'rgba(0,0,0,0.5)'); // fallback background if no border
        };

        // Color Listeners
        document.querySelectorAll('.sub-color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSubSettings.color = btn.getAttribute('data-color');
                updateSubCSSVars();
                saveSettingsToFirebase(currentSubSettings);
            });
        });

        // Font Listeners
        document.querySelectorAll('.sub-font-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.sub-font-btn').forEach(b => { b.classList.remove('bg-[#F47521]', 'text-black'); b.classList.add('bg-white/5'); });
                btn.classList.add('bg-[#F47521]', 'text-black');
                btn.classList.remove('bg-white/5');
                currentSubSettings.font = btn.getAttribute('data-font');
                updateSubCSSVars();
                saveSettingsToFirebase(currentSubSettings);
            });
        });

        // Size Listeners
        document.querySelectorAll('.sub-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.sub-size-btn').forEach(b => { b.classList.remove('bg-[#F47521]', 'text-black', 'font-bold'); b.classList.add('bg-white/5'); });
                btn.classList.add('bg-[#F47521]', 'text-black', 'font-bold');
                btn.classList.remove('bg-white/5');
                currentSubSettings.size = btn.getAttribute('data-size');
                updateSubCSSVars();
                saveSettingsToFirebase(currentSubSettings);
            });
        });

        // Border Toggle
        const borderToggle = document.getElementById('sub-border-toggle');
        borderToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = borderToggle.getAttribute('data-active') === 'true';
            currentSubSettings.shadow = !isActive;
            borderToggle.setAttribute('data-active', !isActive);
            borderToggle.innerText = !isActive ? 'ON' : 'OFF';
            borderToggle.className = !isActive 
                ? 'text-[10px] px-3 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors' 
                : 'text-[10px] px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors';
            updateSubCSSVars();
            saveSettingsToFirebase(currentSubSettings);
        });

        // Inject Native Subtitles
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

        // Initialize HLS
        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, async function() {
                buildSettingsMenus(hlsInstance, video);
                
                let storedTime = localStorage.getItem(`blazex_time_${userUid}_${animeId}_${currentEpNum}`);
                if (db && userUid && userUid !== 'guest') {
                    try {
                        const docRef = await db.collection('users').doc(userUid).collection('episodes').doc(`${animeId}_${currentEpNum}`).get();
                        if (docRef.exists) {
                            const data = docRef.data();
                            if (data.progress) storedTime = data.progress;
                            if (data.settings) {
                                currentSubSettings = { ...currentSubSettings, ...data.settings };
                                updateSubCSSVars();
                                
                                // Update UI to reflect loaded settings
                                if(currentSubSettings.shadow === false) {
                                    borderToggle.setAttribute('data-active', 'false');
                                    borderToggle.innerText = 'OFF';
                                    borderToggle.className = 'text-[10px] px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors';
                                }
                                document.querySelectorAll('.sub-size-btn').forEach(b => {
                                    if(b.getAttribute('data-size') === currentSubSettings.size) {
                                        b.classList.add('bg-[#F47521]', 'text-black', 'font-bold'); b.classList.remove('bg-white/5');
                                    } else {
                                        b.classList.remove('bg-[#F47521]', 'text-black', 'font-bold'); b.classList.add('bg-white/5');
                                    }
                                });
                            }
                        }
                    } catch(e) { console.warn("Could not fetch remote progress."); }
                }

                if (storedTime && !isNaN(storedTime)) video.currentTime = parseFloat(storedTime);
                video.play().catch(e => console.log("Autoplay blocked."));
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
                    else { setBootStatus(`Stream Data Corrupted. Details: ${data.details}`, true); hlsInstance.destroy(); }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e=>e);
                buildSettingsMenus(null, video);
            });
        }

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
        uiLayer.addEventListener('click', closeAllMenus); 

        const togglePlay = () => { if (video.paused) video.play(); else video.pause(); };

        video.addEventListener('play', () => {
            playIconBottom.className = 'fas fa-pause text-lg';
            playIconCenter.className = 'fas fa-pause text-2xl ml-0';
            playBtnCenter.classList.add('opacity-0', 'scale-150'); 
            setTimeout(() => playBtnCenter.classList.add('hidden'), 300);
            resetHideTimer();
        });

        video.addEventListener('pause', () => {
            playIconBottom.className = 'fas fa-play text-lg';
            playIconCenter.className = 'fas fa-play text-2xl ml-1';
            playBtnCenter.classList.remove('hidden');
            setTimeout(() => playBtnCenter.classList.remove('opacity-0', 'scale-150'), 10);
            uiLayer.classList.remove('idle');
            clearTimeout(hideTimer);
        });

        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
        playBtnCenter.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

        const formatTime = (sec) => {
            if (isNaN(sec) || !isFinite(sec)) return "00:00";
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.floor(sec % 60);
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
            if (Math.floor(video.currentTime) % 5 === 0) saveProgress(video.currentTime, video.duration);
        });

        progressBar.addEventListener('input', (e) => {
            video.currentTime = e.target.value;
            const pct = (e.target.value / video.duration) * 100;
            e.target.style.background = `linear-gradient(to right, #F47521 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`;
        });

        let lastTapTime = 0;
        let isLongPressing = false;
        const handleDoubleTap = (e) => {
            const rect = overlay.getBoundingClientRect();
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            if ((clientX - rect.left) > rect.width / 2) {
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
                video.playbackRate = 2.0;
                document.getElementById('speed-indicator').classList.remove('opacity-0');
            }, 600);
        });

        overlay.addEventListener('pointerup', (e) => {
            clearTimeout(pressTimer);
            if (isLongPressing) {
                video.playbackRate = speeds[speedIdx]; 
                document.getElementById('speed-indicator').classList.add('opacity-0');
                isLongPressing = false;
                return;
            }

            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            if (tapLength < 300 && tapLength > 0) {
                clearTimeout(tapTimeout);
                handleDoubleTap(e);
            } else {
                tapTimeout = setTimeout(() => { togglePlay(); resetHideTimer(); }, 300);
            }
            lastTapTime = currentTime;
        });

        fsBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                else if (playerRoot.webkitRequestFullscreen) playerRoot.webkitRequestFullscreen();
                fsIcon.className = 'fas fa-compress text-lg';
                if (screen.orientation && screen.orientation.lock) { try { await screen.orientation.lock('landscape'); } catch (err) { } }
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                fsIcon.className = 'fas fa-expand text-lg';
                if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            }
        });

        audioBtn.addEventListener('click', (e) => { e.stopPropagation(); const isH = audioMenu.classList.contains('hidden'); closeAllMenus(); if(isH) audioMenu.classList.remove('hidden'); resetHideTimer(); });
        subsBtn.addEventListener('click', (e) => { e.stopPropagation(); const isH = subsMenu.classList.contains('hidden'); closeAllMenus(); if(isH) subsMenu.classList.remove('hidden'); resetHideTimer(); });
        qualityBtn.addEventListener('click', (e) => { e.stopPropagation(); const isH = qualityMenu.classList.contains('hidden'); closeAllMenus(); if(isH) qualityMenu.classList.remove('hidden'); resetHideTimer(); });

        function buildSettingsMenus(hls, vid) {
            const qList = document.getElementById('quality-list');
            const cList = document.getElementById('subs-list');
            const aList = document.getElementById('audio-list');
            
            // Note on Quality: We can only display 144p if the M3U8 stream manifest actually provides it.
            // If the provider doesn't encode a 144p layer, it will not appear here.
            if (hls && hls.levels) {
                qList.innerHTML = `<button class="text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn" data-level="-1">Auto</button>`;
                
                // Sort levels ascending to ensure neat display
                const sortedLevels = hls.levels.map((l, i) => ({...l, index: i})).sort((a,b) => a.height - b.height);
                
                sortedLevels.forEach((l) => { 
                    qList.innerHTML += `<button class="text-left text-[10px] px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors q-btn" data-level="${l.index}">${l.height}p</button>`; 
                });
                
                qList.onclick = (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('.q-btn'); if (!btn) return;
                    const levelIndex = parseInt(btn.getAttribute('data-level'));
                    hls.currentLevel = levelIndex;
                    document.querySelectorAll('.q-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-level')) === levelIndex) b.className = 'text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 q-btn';
                        else b.className = 'text-left text-[10px] px-3 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors mb-1 q-btn';
                    });
                    closeAllMenus();
                };
            } else { qList.innerHTML = `<span class="text-[10px] text-gray-500 px-2">Auto (Native)</span>`; }

            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button class="text-left text-[10px] px-3 py-2 rounded bg-white/10 text-white hover:bg-white/20 mb-1 c-btn" data-idx="-1">Off</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    const tk = vid.textTracks[i];
                    cList.innerHTML += `<button class="text-left text-[10px] px-3 py-2 rounded ${tk.mode==='showing' ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 c-btn" data-idx="${i}">${tk.label || 'Lang '+i}</button>`;
                }

                cList.onclick = (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('.c-btn'); if (!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    for (let i=0; i<vid.textTracks.length; i++) { vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden'; }
                    document.querySelectorAll('.c-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 c-btn';
                        else b.className = 'text-left text-[10px] px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 c-btn';
                    });
                };
            } else { cList.innerHTML = `<span class="text-[10px] text-gray-500 px-2">No Subtitles</span>`; }

            if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
                document.querySelector('.audio-container').classList.remove('hidden');
                aList.innerHTML = '';
                hls.audioTracks.forEach((t, i) => { aList.innerHTML += `<button class="text-left text-[10px] px-3 py-2 rounded ${hls.audioTrack === i ? 'bg-[#F47521] text-black font-bold' : 'text-gray-300 hover:bg-white/10'} mb-1 a-btn" data-idx="${i}">${t.name || 'Audio '+i}</button>`; });
                
                aList.onclick = (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('.a-btn'); if(!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    hls.audioTrack = idx;
                    document.querySelectorAll('.a-btn').forEach(b => {
                        if (parseInt(b.getAttribute('data-idx')) === idx) b.className = 'text-left text-[10px] px-3 py-2 rounded bg-[#F47521] text-black font-bold mb-1 a-btn';
                        else b.className = 'text-left text-[10px] px-3 py-2 rounded text-gray-300 hover:bg-white/10 mb-1 a-btn';
                    });
                    closeAllMenus();
                };
            }
        }

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
                if (autoSkipOutro) { if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); } 
                else { 
                    skipOutroBtn.innerHTML = `Skip Outro <i class="fas fa-forward ml-1"></i>`;
                    skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0'); 
                }
            } else if ((!outroStart || outroStart === 0) && video.duration > 0 && t >= video.duration - 10) {
                if (hasNextEp) {
                    skipOutroBtn.innerHTML = `Next Episode <i class="fas fa-step-forward ml-1"></i>`;
                    skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
                }
            } else { 
                skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0'); 
            }
        });

        skipIntroBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(hasNextEp && window.app?.resolveEpisodeStreamAndRoute) { window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); } 
            else { video.currentTime = video.duration; }
        });

        function saveProgress(time, duration) {
            if (!userUid || userUid === 'guest') {
                localStorage.setItem(`blazex_time_guest_${animeId}_${currentEpNum}`, time);
                return;
            }
            const isCompleted = duration && time > (duration * 0.85);
            if (db) {
                db.collection('users').doc(userUid).collection('episodes').doc(`${animeId}_${currentEpNum}`).set({
                    progress: time,
                    duration: duration,
                    completed: isCompleted,
                    lastUpdated: typeof firebase !== 'undefined' ? firebase.firestore.FieldValue.serverTimestamp() : new Date(),
                }, { merge: true }).catch(err => console.warn("Firebase progress sync failed", err));
            }
            localStorage.setItem(`blazex_time_${userUid}_${animeId}_${currentEpNum}`, time);
            const seriesKey = `blazex_series_${userUid}_${animeId}`;
            let seriesData = JSON.parse(localStorage.getItem(seriesKey)) || { watchedEps: [], lastWatchedEp: currentEpNum };
            seriesData.lastWatchedEp = currentEpNum;
            if (isCompleted && !seriesData.watchedEps.includes(currentEpNum)) { seriesData.watchedEps.push(currentEpNum); }
            localStorage.setItem(seriesKey, JSON.stringify(seriesData));
        }

    } catch (error) { setBootStatus(error.message, true); }

    window.app.components.player.destroy = () => {
        clearTimeout(hideTimer); clearTimeout(tapTimeout); clearTimeout(pressTimer);
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        const vid = document.getElementById('main-video-player');
        if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
        playerRoot.replaceWith(playerRoot.cloneNode(true));
        console.log("Player teardown complete. Ready for next route.");
    };
};
