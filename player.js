// player.js - Custom Cinematic Video Engine

window.app.components.player = async () => {
    const playerRoot = document.getElementById('blazex-player-root');
    if (!playerRoot) return;

    let hideTimer, tapTimeout, pressTimer;
    let hlsInstance = null;

    const profile = window.app.state?.activeProfile || { uid: 'guest' };
    
    // --- DATABASE: LOAD USER SETTINGS ---
    let userSettings = {
        speed: 1.0,
        fit: 'object-contain', 
        subSize: '20px',
        subColor: '#ffffff',
        subBg: 'rgba(0,0,0,0.7)',
        subOutline: '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000'
    };

    // Attempt to load settings from Firestore if logged in
    if (profile.uid !== 'guest' && window.db) {
        try {
            const userDoc = await window.db.collection('users').doc(profile.uid).get();
            if (userDoc.exists && userDoc.data().playerSettings) {
                userSettings = { ...userSettings, ...userDoc.data().playerSettings };
            }
        } catch (e) {
            console.warn("Failed to fetch settings from DB, using defaults.", e);
        }
    }

    // --- DATABASE: SAVE USER SETTINGS ---
    const saveUserSettings = async () => {
        if (profile.uid !== 'guest' && window.db) {
            try {
                await window.db.collection('users').doc(profile.uid).set({
                    playerSettings: userSettings
                }, { merge: true });
            } catch (e) { console.warn("Failed to save settings.", e); }
        } else {
            localStorage.setItem(`blazex_settings_${profile.uid}`, JSON.stringify(userSettings));
        }
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

    // --- ANILIST API FETCH ---
    // Clean up slug to create a searchable query (e.g., "re zero starting life...")
    const searchQuery = animeId.replace(/-[a-z0-9]{4,5}$/, '').replace(/-/g, ' ');
    let epMetaDesc = "Fetching episode data...";

    try {
        const aniQuery = `
        query ($search: String) {
          Media (search: $search, type: ANIME) {
            id
            title { romaji english }
            streamingEpisodes { title url site }
          }
        }`;
        
        const aniRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: aniQuery, variables: { search: searchQuery } })
        });
        
        const aniData = await aniRes.json();
        const media = aniData.data?.Media;
        
        // Anilist rarely provides full episode descriptions, so we fallback to local state if missing
        if (media) {
            const localEpData = window.app.state?.currentEpisodesListProcessed?.find(e => parseInt(e.num || e.episode_no) === currentEpNum);
            epMetaDesc = localEpData?.description || `Episode ${currentEpNum} of ${media.title.english || media.title.romaji}. Prepare for the next phase.`;
        } else {
            epMetaDesc = window.app.state?.animeDetails?.description?.substring(0, 120) + "..." || `Playing Episode ${currentEpNum}`;
        }
    } catch (e) {
        epMetaDesc = `Episode ${currentEpNum} loaded.`;
    }

    const baseUrl = 'https://anikoto-api-xi.vercel.app';
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url='; 

    // --- CUSTOM CSS MODULES & ::CUE STYLING ---
    if (!document.getElementById('blazex-player-css')) {
        const style = document.createElement('style');
        style.id = 'blazex-player-css';
        style.innerHTML = `
            :root {
                --bx-sub-size: ${userSettings.subSize};
                --bx-sub-color: ${userSettings.subColor};
                --bx-sub-bg: ${userSettings.subBg};
                --bx-sub-outline: ${userSettings.subOutline};
            }
            .blazex-slider { -webkit-appearance: none; width: 100%; background: transparent; cursor: pointer; height: 6px; outline: none; }
            .blazex-slider::-webkit-slider-runnable-track { background: rgba(255,255,255,0.2); height: 4px; border-radius: 4px; }
            .blazex-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #F47521; margin-top: -4px; transition: transform 0.1s; }
            .blazex-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }
            
            .blazex-popup { display: none; position: absolute; bottom: 100%; right: 0; margin-bottom: 1rem; background: rgba(10,10,10,0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 0.5rem; flex-direction: column; gap: 0.25rem; z-index: 50; }
            .blazex-popup.active { display: flex; }
            .blazex-menu-btn { text-align: left; font-size: 11px; padding: 0.5rem 0.75rem; border-radius: 0.25rem; color: #d1d5db; transition: background 0.2s; }
            .blazex-menu-btn:hover { background: rgba(255,255,255,0.1); }
            .blazex-menu-btn.active { background: #F47521; color: black; font-weight: 900; }
            
            /* Custom Color Input Module */
            .bx-color-picker { -webkit-appearance: none; border: none; width: 100%; height: 28px; border-radius: 4px; cursor: pointer; background: transparent; padding: 0; }
            .bx-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
            .bx-color-picker::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; }
            
            .blazex-ui-layer { transition: opacity 0.3s ease; opacity: 1; }
            .blazex-ui-layer.idle { opacity: 0; cursor: none; }
            
            ::cue {
                font-family: sans-serif;
                font-weight: bold;
                font-size: var(--bx-sub-size);
                background-color: var(--bx-sub-bg);
                color: var(--bx-sub-color);
                text-shadow: var(--bx-sub-outline);
            }
        `;
        document.head.appendChild(style);
    } else {
        document.documentElement.style.setProperty('--bx-sub-size', userSettings.subSize);
        document.documentElement.style.setProperty('--bx-sub-color', userSettings.subColor);
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

        playerRoot.innerHTML = `
            <div id="video-container" class="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
                
                <video id="main-video-player" crossorigin="anonymous" playsinline class="w-full h-full ${userSettings.fit} pointer-events-none"></video>
                
                <div id="buffer-spinner" class="absolute inset-0 z-20 flex items-center justify-center hidden pointer-events-none">
                    <div class="w-16 h-16 border-4 border-[#F47521] border-t-transparent rounded-full animate-spin"></div>
                </div>

                <div id="gesture-overlay" class="absolute inset-0 z-10"></div>
                
                <button id="skip-intro-btn" class="absolute bottom-24 right-6 bg-black/80 text-white font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] border border-white/20 z-40">
                    Skip Intro <i class="fas fa-forward ml-1"></i>
                </button>
                <button id="skip-outro-btn" class="absolute bottom-24 right-6 bg-black/80 text-white font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded transition-all transform translate-x-[150%] opacity-0 hover:bg-[#F47521] border border-white/20 z-40">
                    ${hasNextEp ? `Next Episode <i class="fas fa-step-forward ml-1"></i>` : `Skip Outro <i class="fas fa-forward ml-1"></i>`}
                </button>

                <div id="ui-layer" class="blazex-ui-layer absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/80 pointer-events-none">
                    
                    <div class="w-full flex flex-col p-6 pointer-events-auto">
                        <span class="bg-[#F47521] text-black px-2 py-0.5 rounded text-[10px] font-black uppercase w-max mb-2">Ep ${currentEpNum} ${targetServer === 'hd-2' ? ' • HD-2' : ''}</span>
                        <p class="text-gray-300 text-xs md:text-sm max-w-2xl mt-1 line-clamp-3 leading-relaxed drop-shadow-md">${epMetaDesc}</p>
                    </div>
                    
                    <div class="flex items-center justify-center pointer-events-auto">
                        <button id="center-play-btn" class="hidden w-20 h-20 bg-black/60 border border-white/20 rounded-full text-white flex items-center justify-center hover:bg-[#F47521] transition-colors">
                            <i id="center-play-icon" class="fas fa-play text-3xl ml-1"></i>
                        </button>
                    </div>

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
                                
                                <div class="relative group menu-container">
                                    <button id="speed-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-tachometer-alt text-lg"></i></button>
                                    <div id="speed-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Playback Speed</div>
                                        <div id="speed-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <div class="relative group menu-container">
                                    <button id="substyle-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-font text-lg"></i></button>
                                    <div id="substyle-menu" class="blazex-popup w-64 p-3">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-1 mb-2">Subtitle Appearance</div>
                                        <div class="flex flex-col gap-3 px-1">
                                            
                                            <div>
                                                <label class="text-[10px] text-gray-300 flex justify-between">Size <span id="size-val">${parseInt(userSettings.subSize)}px</span></label>
                                                <input type="range" id="sub-size-slider" class="blazex-slider mt-1" min="12" max="40" value="${parseInt(userSettings.subSize)}">
                                            </div>
                                            
                                            <div class="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label class="text-[10px] text-gray-300 block mb-1">Text Color</label>
                                                    <input type="color" id="sub-color-picker" class="bx-color-picker" value="${userSettings.subColor}">
                                                </div>
                                                <div>
                                                    <label class="text-[10px] text-gray-300 block mb-1">Background</label>
                                                    <select id="sub-bg-select" class="w-full bg-black text-white text-[10px] h-[28px] rounded outline-none border border-white/20 px-1">
                                                        <option value="transparent">None</option>
                                                        <option value="rgba(0,0,0,0.5)">Dark (Soft)</option>
                                                        <option value="rgba(0,0,0,0.9)">Dark (Solid)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label class="text-[10px] text-gray-300 block mb-1">Text Outline</label>
                                                <select id="sub-outline-select" class="w-full bg-black text-white text-[10px] p-1.5 rounded outline-none border border-white/20">
                                                    <option value="none">Off</option>
                                                    <option value="2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000">Black Border</option>
                                                    <option value="0px 0px 4px rgba(0,0,0,0.8)">Soft Shadow</option>
                                                </select>
                                            </div>

                                        </div>
                                    </div>
                                </div>

                                <div class="relative hidden menu-container audio-wrapper">
                                    <button id="audio-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-headphones text-lg"></i></button>
                                    <div id="audio-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Audio Track</div>
                                        <div id="audio-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <div class="relative menu-container subs-wrapper">
                                    <button id="subs-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-closed-captioning text-lg"></i></button>
                                    <div id="subs-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Subtitles</div>
                                        <div id="subs-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <div class="relative menu-container quality-wrapper">
                                    <button id="quality-btn" class="text-white hover:text-[#F47521] transition-colors"><i class="fas fa-video text-lg"></i></button>
                                    <div id="quality-menu" class="blazex-popup w-48">
                                        <div class="text-[9px] font-black uppercase text-gray-500 px-2 pt-1 pb-1">Quality</div>
                                        <div id="quality-list" class="flex flex-col max-h-40 overflow-y-auto hide-scrollbar"></div>
                                    </div>
                                </div>

                                <button id="fit-btn" class="text-white hover:text-[#F47521] transition-colors" title="Adjust Video Fit"><i class="fas fa-crop-alt text-lg"></i></button>

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
        const playBtnCenter = document.getElementById('center-play-btn');
        const bufferSpinner = document.getElementById('buffer-spinner');

        video.playbackRate = userSettings.speed;
        document.getElementById('sub-bg-select').value = userSettings.subBg;
        document.getElementById('sub-outline-select').value = userSettings.subOutline;

        // --- MENU LOGIC ---
        const menus = [
            { btn: document.getElementById('speed-btn'), pop: document.getElementById('speed-menu') },
            { btn: document.getElementById('substyle-btn'), pop: document.getElementById('substyle-menu') },
            { btn: document.getElementById('audio-btn'), pop: document.getElementById('audio-menu') },
            { btn: document.getElementById('subs-btn'), pop: document.getElementById('subs-menu') },
            { btn: document.getElementById('quality-btn'), pop: document.getElementById('quality-menu') }
        ];

        const closeAllMenus = () => menus.forEach(m => m.pop.classList.remove('active'));

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

        // --- SETTINGS BUTTONS ---
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

        document.getElementById('sub-size-slider').addEventListener('input', (e) => {
            const val = `${e.target.value}px`;
            document.getElementById('size-val').innerText = val;
            document.documentElement.style.setProperty('--bx-sub-size', val);
            userSettings.subSize = val;
            saveUserSettings();
        });
        document.getElementById('sub-color-picker').addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--bx-sub-color', e.target.value);
            userSettings.subColor = e.target.value;
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

        // --- HLS INIT & DB RESUME ---
        const initVideoPlayback = async () => {
            buildSettingsMenus(hlsInstance, video);
            
            let startTime = 0;
            if (profile.uid !== 'guest' && window.db) {
                try {
                    const epDoc = await window.db.collection('users').doc(profile.uid).collection('episodes').doc(`${animeId}_${currentEpNum}`).get();
                    if (epDoc.exists && epDoc.data().currentTime) {
                        startTime = parseFloat(epDoc.data().currentTime);
                    }
                } catch(e) {}
            } else {
                const storedTime = localStorage.getItem(`blazex_time_${profile.uid}_${animeId}_${currentEpNum}`);
                if (storedTime && !isNaN(storedTime)) startTime = parseFloat(storedTime);
            }

            if (startTime > 0) video.currentTime = startTime;
        };

        if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hlsInstance.loadSource(proxiedStreamUrl);
            hlsInstance.attachMedia(video);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, initVideoPlayback);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedStreamUrl;
            video.addEventListener('loadedmetadata', initVideoPlayback);
        }

        video.addEventListener('waiting', () => bufferSpinner.classList.remove('hidden'));
        video.addEventListener('playing', () => bufferSpinner.classList.add('hidden'));
        video.addEventListener('canplay', () => bufferSpinner.classList.add('hidden'));

        // Auto-Hide UI
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

        const togglePlay = () => video.paused ? video.play() : video.pause();
        
        video.addEventListener('play', () => {
            document.getElementById('bottom-play-icon').className = 'fas fa-pause text-xl';
            playBtnCenter.classList.add('hidden');
            resetHideTimer();
        });
        video.addEventListener('pause', () => {
            document.getElementById('bottom-play-icon').className = 'fas fa-play text-xl';
            playBtnCenter.classList.remove('hidden');
            uiLayer.classList.remove('idle');
            clearTimeout(hideTimer);
        });

        playBtnBottom.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
        playBtnCenter.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

        let lastTapTime = 0;
        overlay.addEventListener('pointerup', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            if (tapLength < 300 && tapLength > 0) {
                clearTimeout(tapTimeout);
                const rect = overlay.getBoundingClientRect();
                const x = (e.clientX || (e.changedTouches && e.changedTouches[0].clientX)) - rect.left;
                if (x > rect.width / 2) {
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    const icon = document.getElementById('dt-right'); icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 500);
                } else {
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    const icon = document.getElementById('dt-left'); icon.classList.remove('opacity-0'); setTimeout(()=>icon.classList.add('opacity-0'), 500);
                }
            } else {
                tapTimeout = setTimeout(() => { togglePlay(); resetHideTimer(); }, 300);
            }
            lastTapTime = currentTime;
        });

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

        document.getElementById('fs-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                if (playerRoot.requestFullscreen) playerRoot.requestFullscreen();
                document.getElementById('fs-icon').className = 'fas fa-compress text-lg';
                if (screen.orientation && screen.orientation.lock) try { await screen.orientation.lock('landscape'); } catch(err){}
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                document.getElementById('fs-icon').className = 'fas fa-expand text-lg';
                if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            }
        });

        function buildSettingsMenus(hls, vid) {
            const sList = document.getElementById('speed-list');
            const qList = document.getElementById('quality-list');
            const cList = document.getElementById('subs-list');
            const aList = document.getElementById('audio-list');

            const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
            sList.innerHTML = '';
            speeds.forEach(sp => {
                sList.innerHTML += `<button class="blazex-menu-btn s-btn ${userSettings.speed === sp ? 'active' : ''}" data-val="${sp}">${sp}x ${sp===1?'(Normal)':''}</button>`;
            });
            sList.onclick = (e) => {
                const btn = e.target.closest('.s-btn'); if(!btn) return;
                const sp = parseFloat(btn.getAttribute('data-val'));
                video.playbackRate = sp;
                userSettings.speed = sp;
                saveUserSettings();
                document.querySelectorAll('.s-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                closeAllMenus();
            };

            if (hls && hls.levels) {
                qList.innerHTML = `<button class="blazex-menu-btn q-btn active" data-level="-1">Auto</button>`;
                hls.levels.forEach((l, i) => { qList.innerHTML += `<button class="blazex-menu-btn q-btn" data-level="${i}">${l.height}p</button>`; });
                qList.onclick = (e) => {
                    const btn = e.target.closest('.q-btn'); if (!btn) return;
                    hls.currentLevel = parseInt(btn.getAttribute('data-level'));
                    document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
                    closeAllMenus();
                };
            }

            if (vid.textTracks.length > 0) {
                cList.innerHTML = `<button class="blazex-menu-btn c-btn active" data-idx="-1">Off</button>`;
                for (let i=0; i<vid.textTracks.length; i++) {
                    cList.innerHTML += `<button class="blazex-menu-btn c-btn ${vid.textTracks[i].mode==='showing'?'active':''}" data-idx="${i}">${vid.textTracks[i].label || 'Lang '+i}</button>`;
                }
                cList.onclick = (e) => {
                    const btn = e.target.closest('.c-btn'); if (!btn) return;
                    const idx = parseInt(btn.getAttribute('data-idx'));
                    for (let i=0; i<vid.textTracks.length; i++) vid.textTracks[i].mode = (i === idx) ? 'showing' : 'hidden';
                    document.querySelectorAll('.c-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
                    closeAllMenus();
                };
            }

            if (hls && hls.audioTracks && hls.audioTracks.length > 1) {
                document.querySelector('.audio-wrapper').classList.remove('hidden');
                aList.innerHTML = '';
                hls.audioTracks.forEach((t, i) => { aList.innerHTML += `<button class="blazex-menu-btn a-btn ${hls.audioTrack === i ? 'active':''}" data-idx="${i}">${t.name || 'Audio '+i}</button>`; });
                aList.onclick = (e) => {
                    const btn = e.target.closest('.a-btn'); if(!btn) return;
                    hls.audioTrack = parseInt(btn.getAttribute('data-idx'));
                    document.querySelectorAll('.a-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
                    closeAllMenus();
                };
            }
        }

        // --- OUTRO & AUTO SKIP LOGIC ---
        const skipIntroBtn = document.getElementById('skip-intro-btn');
        const skipOutroBtn = document.getElementById('skip-outro-btn');
        
        video.addEventListener('timeupdate', () => {
            const t = video.currentTime;
            
            // Intro Logic
            if (introEnd > 0 && t >= introStart && t < introEnd) skipIntroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
            else skipIntroBtn.classList.add('translate-x-[150%]', 'opacity-0');
            
            // Outro Logic: Check strict outro stamps, else fallback to 10 seconds before video ends
            const isNearEnd = video.duration > 0 && (t >= video.duration - 10);
            const isOutroActive = (outroEnd > 0 && t >= outroStart && t < outroEnd);
            
            if (isOutroActive || (!outroEnd && isNearEnd)) {
                skipOutroBtn.classList.remove('translate-x-[150%]', 'opacity-0');
            } else {
                skipOutroBtn.classList.add('translate-x-[150%]', 'opacity-0');
            }
        });

        skipIntroBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = introEnd; });
        skipOutroBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if(hasNextEp) window.app.resolveEpisodeStreamAndRoute(nextEpSlug, currentEpNum + 1, animeId); 
            else video.currentTime = video.duration; 
        });

        // --- DATABASE: SAVE PROGRESS ---
        const saveProgress = async (time) => {
            if (profile.uid !== 'guest' && window.db) {
                try {
                    const epRef = window.db.collection('users').doc(profile.uid).collection('episodes').doc(`${animeId}_${currentEpNum}`);
                    const payload = {
                        currentTime: time,
                        duration: video.duration,
                        watched: (video.duration && time > (video.duration * 0.85)) ? true : false,
                        updatedAt: new Date()
                    };
                    await epRef.set(payload, { merge: true });
                } catch(e) { console.warn("Failed saving progress to DB"); }
            } else {
                localStorage.setItem(`blazex_time_${profile.uid}_${animeId}_${currentEpNum}`, time);
            }
        };

    } catch (error) { setBootStatus(error.message, true); }

    window.app.components.player.destroy = () => {
        clearTimeout(hideTimer); clearTimeout(tapTimeout); clearTimeout(pressTimer);
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        const vid = document.getElementById('main-video-player');
        if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
        playerRoot.replaceWith(playerRoot.cloneNode(true));
    };
};
