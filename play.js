// play.js

window.app.components.play = async () => {
    const workspace = document.getElementById('player-workspace');
    if (!workspace) return;

    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const episodeId = urlParams.get('id'); 
    const animeId = urlParams.get('anime'); 
    const currentEpNum = urlParams.get('ep') || '1';
    
    let currentAudioType = urlParams.get('type');
    let currentServer = urlParams.get('server') || 'hd-1';

    if (!episodeId || !animeId) {
        workspace.innerHTML = `
            <div class="w-full text-center py-20 mt-10">
                <i class="fas fa-video-slash text-5xl text-gray-600 mb-4"></i>
                <h2 class="text-white font-black text-xl tracking-wider uppercase mb-2">Stream Offline</h2>
                <p class="text-gray-400 text-xs">Invalid streaming parameters provided.</p>
                <button onclick="window.location.href='index.html'" class="mt-6 text-xs text-white bg-white/10 px-6 py-2 rounded hover:bg-[#F47521]">Go Home</button>
            </div>
        `;
        return;
    }

    const profile = window.app.state?.activeProfile || null;

    // 2. Cloud-Synced Preferences Check
    let autoSkipIntro = localStorage.getItem('blazex_autoskip_intro') === 'true';
    let autoSkipOutro = localStorage.getItem('blazex_autoskip_outro') === 'true';

    // Override with DB preferences if logged in
    if (profile && profile.preferences) {
        if (profile.preferences.skipIntro !== undefined) autoSkipIntro = profile.preferences.skipIntro;
        if (profile.preferences.skipOutro !== undefined) autoSkipOutro = profile.preferences.skipOutro;
        if (!currentAudioType && profile.preferences.audioType) currentAudioType = profile.preferences.audioType;
    }
    
    if (!currentAudioType) currentAudioType = 'sub';

    // 3. Initialize Core State
    window.app.state.epSearchValue = '';
    window.app.state.epRangeFilter = null;
    window.app.state.activeLanguageType = currentAudioType;
    window.app.state.currentPlayingEpNum = parseInt(currentEpNum);

    // Watch History DB & Local Sync
    if (profile && profile.uid) {
        let mockProgressHistory = { 
            lastWatchedEp: currentEpNum, 
            lastSlug: episodeId, 
            finishedEp: false, 
            watchedHistoryList: [parseInt(currentEpNum)] 
        };
        const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
        if (stored) {
            try {
                let parsed = JSON.parse(stored);
                parsed.lastWatchedEp = currentEpNum;
                parsed.lastSlug = episodeId;
                if(!parsed.watchedHistoryList) parsed.watchedHistoryList = [];
                if(!parsed.watchedHistoryList.includes(parseInt(currentEpNum))) {
                    parsed.watchedHistoryList.push(parseInt(currentEpNum));
                }
                mockProgressHistory = parsed;
            } catch(e){}
        }
        localStorage.setItem(`blazex_progress_${profile.uid}_${animeId}`, JSON.stringify(mockProgressHistory));
    }

    // 4. DYNAMIC UI SKELETON GENERATION
    workspace.innerHTML = `
        <div class="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in opacity-0 transition-opacity duration-500" id="play-content-wrapper">
            
            <div id="blazex-player-root" class="w-full aspect-video md:aspect-[21/9] bg-black rounded-xl shadow-lg border border-white/5 overflow-hidden flex flex-col items-center justify-center relative group">
                <div class="tk-loader scale-125 z-0">
                    <div class="tk-dot tk-dot-1"></div>
                    <div class="tk-dot tk-dot-2"></div>
                </div>
                <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-6">Loading Player Engine...</p>
            </div>

            <div class="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0a0a0a] p-3 rounded-lg border border-white/5 shadow-md">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-black px-2 py-1 rounded border border-white/5">Audio</span>
                        <div class="flex bg-[#111] p-1 border border-white/10 rounded-md text-[10px] font-black select-none tracking-wider uppercase">
                            <button onclick="window.app.changePlayerConfig('type', 'sub')" class="px-3 py-1 rounded transition-all ${currentAudioType === 'sub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Sub</button>
                            <button onclick="window.app.changePlayerConfig('type', 'dub')" class="px-3 py-1 rounded transition-all ${currentAudioType === 'dub' ? 'bg-[#F47521] text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Dub</button>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-black px-2 py-1 rounded border border-white/5">Server</span>
                        <div class="flex bg-[#111] p-1 border border-white/10 rounded-md text-[10px] font-black select-none tracking-wider uppercase">
                            <button onclick="window.app.changePlayerConfig('server', 'hd-1')" class="px-3 py-1 rounded transition-all ${currentServer === 'hd-1' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}">HD-1</button>
                            <button onclick="window.app.changePlayerConfig('server', 'hd-2')" class="px-3 py-1 rounded transition-all ${currentServer === 'hd-2' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}">HD-2</button>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" id="toggle-skip-intro" class="hidden" onchange="window.app.toggleAutoSkip('intro')" ${autoSkipIntro ? 'checked' : ''}>
                        <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg">
                            <div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div>
                        </div>
                        Skip Intro
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        <input type="checkbox" id="toggle-skip-outro" class="hidden" onchange="window.app.toggleAutoSkip('outro')" ${autoSkipOutro ? 'checked' : ''}>
                        <div class="w-8 h-4 bg-[#111] border border-white/20 rounded-full relative transition-colors toggle-bg">
                            <div class="w-3 h-3 bg-gray-400 rounded-full absolute top-[1px] left-[2px] transition-transform toggle-dot"></div>
                        </div>
                        Skip Outro
                    </label>
                </div>
            </div>

            <div class="flex flex-col md:flex-row items-start md:items-start justify-between gap-6 py-2 pb-6 relative">
                
                <div class="flex-1 flex gap-4 w-full">
                    <div class="w-20 md:w-28 flex-shrink-0 rounded-lg overflow-hidden shadow-md border border-white/10 hidden sm:block bg-[#111]">
                        <img id="play-anime-poster" src="https://via.placeholder.com/200x300/111/fff?text=..." class="w-full h-full object-cover aspect-[2/3] animate-pulse">
                    </div>
                    <div class="flex-1 flex flex-col min-w-0">
                        <p id="current-anime-title" class="text-[10px] md:text-xs text-[#F47521] font-bold uppercase tracking-widest mb-1 truncate">Loading Anime Data...</p>
                        <h1 id="current-ep-title" class="text-lg md:text-2xl font-black text-white tracking-tight leading-tight truncate w-full">Episode ${currentEpNum}</h1>
                        
                        <div class="relative mt-2">
                            <p id="current-anime-desc" class="text-xs text-gray-400 line-clamp-2 leading-relaxed max-w-2xl transition-all duration-300"></p>
                            <button id="desc-load-more-btn" onclick="window.app.togglePlayDesc()" class="text-[#F47521] text-[10px] font-bold uppercase tracking-widest mt-2 hover:text-white transition-colors hidden">See More <i class="fas fa-chevron-down ml-1"></i></button>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-row md:flex-col lg:flex-row items-center justify-start md:justify-end gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <div class="flex items-center gap-2">
                        <button onclick="window.app.handleReaction('like')" id="btn-like" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-[#F47521] px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-400 group relative">
                            <i class="fas fa-thumbs-up group-hover:-translate-y-0.5 transition-transform"></i> 
                            <span id="like-count-display" class="font-mono">0</span>
                        </button>
                        <button onclick="window.app.handleReaction('dislike')" id="btn-dislike" class="flex items-center gap-2 bg-[#111] border border-white/5 hover:border-white/40 px-4 py-2 rounded-lg transition-colors text-xs font-bold text-gray-400 group relative">
                            <i class="fas fa-thumbs-down group-hover:translate-y-0.5 transition-transform"></i>
                            <span id="dislike-count-display" class="font-mono">0</span>
                        </button>
                    </div>
                    <button onclick="if(window.app.components.comment) window.app.components.comment()" class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-[#F47521] hover:text-black border border-white/10 px-5 py-2 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm group">
                        <i class="fas fa-comment-alt group-hover:scale-110 transition-transform"></i> 
                        <span id="comment-count-display">Discuss</span>
                    </button>
                </div>
            </div>

            <div id="play-schedule-container" class="hidden w-full bg-[#111] border border-white/10 p-3 md:p-4 rounded-xl flex-col sm:flex-row items-center justify-between gap-3 mt-2 shadow-inner transition-all">
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 shrink-0">
                        <i class="fas fa-calendar-alt text-xs"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Upcoming Release</p>
                        <p id="countdown-ep-label" class="text-xs md:text-sm font-bold text-gray-300 truncate">Episode Scheduling...</p>
                    </div>
                </div>
                <div class="w-full sm:w-auto px-4 py-2 rounded-lg text-center shrink-0 bg-black/60 border border-white/5">
                    <p id="countdown-timer-display" class="text-sm md:text-base font-mono font-bold text-gray-400 tracking-widest">00d : 00h : 00m : 00s</p>
                </div>
            </div>

            <div class="w-full flex flex-col gap-4 mt-2 bg-[#0a0a0a] p-4 md:p-5 rounded-xl border border-white/5 shadow-md">
                <h3 class="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-2"><i class="fas fa-list text-[#F47521]"></i> Episodes Vault</h3>
                <div id="episodes-grid-mount-point"></div>
            </div>

        </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `
        input:checked + .toggle-bg { background-color: #F47521; border-color: #F47521; }
        input:checked + .toggle-bg .toggle-dot { transform: translateX(14px); background-color: black; }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        const wrapper = document.getElementById('play-content-wrapper');
        if (wrapper) wrapper.classList.remove('opacity-0');
    }, 50);

    // 5. FETCH ANIME DATA, SCHEDULE & EPISODES
    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        let episodesList = [];
        let baseAnime = {};
        let aniData = {};

        try {
            const infoResponse = await fetch(`${baseUrl}/api/info?id=${animeId}`);
            const infoJson = await infoResponse.json();
            if (infoJson && infoJson.success && infoJson.data) baseAnime = infoJson.data;
        } catch(e) {}

        try {
            const hasValidAniId = baseAnime.anilistId && !isNaN(baseAnime.anilistId);
            const query = `query ($id: Int, $search: String) { 
                Media (id: $id, search: $search, type: ANIME) { 
                    id title { romaji english native } description coverImage { extraLarge }
                    nextAiringEpisode { airingAt timeUntilAiring episode }
                } 
            }`;
            const variables = hasValidAniId ? { id: parseInt(baseAnime.anilistId) } : { search: (baseAnime.title || animeId).replace(/\(Dub\)|\(Sub\)/gi, '').trim() };
            const aniRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables })
            });
            const json = await aniRes.json();
            aniData = json?.data?.Media || {};
        } catch (e) {}

        try {
            const epsResponse = await fetch(`${baseUrl}/api/episodes/${animeId}`);
            const epsJson = await epsResponse.json();
            if (epsJson && epsJson.success && Array.isArray(epsJson.data)) {
                episodesList = epsJson.data;
            } else if (epsJson && epsJson.success && epsJson.results && Array.isArray(epsJson.results.episodes)) {
                episodesList = epsJson.results.episodes;
            }
        } catch(e) {}

        const finalTitle = baseAnime.title || aniData.title?.english || aniData.title?.romaji || animeId.replace(/-/g, ' ').toUpperCase();
        const finalDesc = (baseAnime.description || aniData.description || 'No description available.').replace(/<[^>]*>?/gm, '');
        const finalPoster = aniData.coverImage?.extraLarge || baseAnime.poster || 'https://via.placeholder.com/800x1200/111/fff?text=Poster';

        document.getElementById('current-anime-title').innerText = finalTitle;
        document.getElementById('current-anime-desc').innerText = finalDesc;
        
        if (finalDesc.length > 150) {
            document.getElementById('desc-load-more-btn').classList.remove('hidden');
        }
        
        const posterImg = document.getElementById('play-anime-poster');
        if(posterImg) {
            posterImg.src = finalPoster;
            posterImg.classList.remove('animate-pulse');
        }

        if (aniData.nextAiringEpisode) {
            const targetTime = aniData.nextAiringEpisode.airingAt * 1000;
            document.getElementById('countdown-ep-label').innerText = `Episode ${aniData.nextAiringEpisode.episode}`;
            
            const schedContainer = document.getElementById('play-schedule-container');
            schedContainer.classList.remove('hidden');
            schedContainer.classList.add('flex');

            if (window.app.state.scheduleInterval) clearInterval(window.app.state.scheduleInterval);

            window.app.state.scheduleInterval = setInterval(() => {
                const now = new Date().getTime();
                const distance = targetTime - now;

                if (distance < 0) {
                    clearInterval(window.app.state.scheduleInterval);
                    document.getElementById('countdown-timer-display').innerText = "AIRING NOW";
                    return;
                }

                const d = Math.floor(distance / (1000 * 60 * 60 * 24));
                const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((distance % (1000 * 60)) / 1000);

                document.getElementById('countdown-timer-display').innerText = 
                    `${d.toString().padStart(2, '0')}d : ${h.toString().padStart(2, '0')}h : ${m.toString().padStart(2, '0')}m : ${s.toString().padStart(2, '0')}s`;
            }, 1000);
        }

        if (episodesList && episodesList.length > 0) {
            const currentEpObj = episodesList.find(e => (e.num || e.episode_no) == currentEpNum);
            const epTitleEl = document.getElementById('current-ep-title');
            if (currentEpObj && epTitleEl) {
                const titleStr = currentEpObj.title ? currentEpObj.title : `Episode ${currentEpNum}`;
                epTitleEl.innerText = `E${currentEpNum}: ${titleStr}`;
            }
        }

        if (profile && profile.likedAnime && profile.likedAnime.includes(animeId)) {
            window.app.handleReactionUI('like');
        } else if (profile && profile.dislikedAnime && profile.dislikedAnime.includes(animeId)) {
            window.app.handleReactionUI('dislike');
        }

        // Fetch Stats & Attach Live Listener
        window.app.fetchCommunityStats(animeId);

        window.app.state.currentEpisodesListProcessed = episodesList;
        window.app.state.currentAnimePage = { id: animeId };

        window.app.renderPlayEpisodesUI();

        if (window.app.components.player) window.app.components.player(); 

    } catch (err) {
        console.error("Failed to compile player environment:", err);
    }
};

// ==========================================
// --- CLOUD-SYNCED PLAYER ACTIONS ---
// ==========================================

window.app.togglePlayDesc = () => {
    const desc = document.getElementById('current-anime-desc');
    const btn = document.getElementById('desc-load-more-btn');
    if (desc.classList.contains('line-clamp-2')) {
        desc.classList.remove('line-clamp-2');
        btn.innerHTML = 'Show Less <i class="fas fa-chevron-up ml-1"></i>';
    } else {
        desc.classList.add('line-clamp-2');
        btn.innerHTML = 'See More <i class="fas fa-chevron-down ml-1"></i>';
    }
};

window.app.changePlayerConfig = (param, value) => {
    if (param === 'type') {
        localStorage.setItem('blazex_audio', value);
        window.app.syncPreferencesToDB({ audioType: value });
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get(param) === value) return;
    urlParams.set(param, value);
    window.location.search = urlParams.toString();
};

window.app.syncPreferencesToDB = async (updatesObject) => {
    const profile = window.app.state?.activeProfile || null;
    if (!profile || !profile.uid || profile.uid.startsWith('anon_')) return;

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        
        if(!profile.preferences) profile.preferences = {};
        Object.assign(profile.preferences, updatesObject);
        localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

        await firestore.setDoc(userRef, { preferences: updatesObject }, { merge: true });
    } catch (error) {}
};

window.app.toggleAutoSkip = (type) => {
    const isChecked = document.getElementById(`toggle-skip-${type}`).checked;
    localStorage.setItem(`blazex_autoskip_${type}`, isChecked ? 'true' : 'false');
    
    const prefKey = type === 'intro' ? 'skipIntro' : 'skipOutro';
    window.app.syncPreferencesToDB({ [prefKey]: isChecked });
};

// ==========================================
// --- COMMUNITY LIVE LIKES/COMMENTS SYNC ---
// ==========================================

window.app.fetchCommunityStats = async (animeId) => {
    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const { getCountFromServer, collection, query, where, onSnapshot } = firestore;
        
        // 1. Initial Static Fetch for Likes/Dislikes (Better for Firebase Billing)
        const usersRef = collection(window.app.db, "users");
        const likesSnap = await getCountFromServer(query(usersRef, where("likedAnime", "array-contains", animeId)));
        const dislikesSnap = await getCountFromServer(query(usersRef, where("dislikedAnime", "array-contains", animeId)));
        
        const likeEl = document.getElementById('like-count-display');
        const dislikeEl = document.getElementById('dislike-count-display');
        
        if(likeEl) likeEl.innerText = likesSnap.data().count || 0;
        if(dislikeEl) dislikeEl.innerText = dislikesSnap.data().count || 0;

        // 2. LIVE REAL-TIME LISTENER FOR COMMENTS
        const commentsRef = collection(window.app.db, "comments");
        const commentsQuery = query(commentsRef, where("animeId", "==", animeId));
        
        // Unsubscribe from previous listener if navigating
        if (window.app.unsubCommentsListener) window.app.unsubCommentsListener();
        
        window.app.unsubCommentsListener = onSnapshot(commentsQuery, (snapshot) => {
            const commentEl = document.getElementById('comment-count-display');
            if (commentEl) {
                if (snapshot.empty) {
                    commentEl.innerText = "Discuss";
                } else {
                    commentEl.innerText = `${snapshot.size} Comments`;
                }
            }
        }, (error) => {
            console.warn("Live comment sync denied. Check rules.");
        });

    } catch(e) {
        console.log("Stats fetch skipped: Uninitialized Rules or Index empty.");
    }
};

window.app.handleReactionUI = (type) => {
    const likeBtn = document.getElementById('btn-like');
    const dislikeBtn = document.getElementById('btn-dislike');
    
    if (type === 'like') {
        likeBtn.classList.add('text-[#F47521]', 'border-[#F47521]');
        dislikeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    } else if (type === 'dislike') {
        dislikeBtn.classList.add('text-[#F47521]', 'border-[#F47521]');
        likeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    } else {
        likeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
        dislikeBtn.classList.remove('text-[#F47521]', 'border-[#F47521]');
    }
};

window.app.handleReaction = async (type) => {
    const profile = window.app.state?.activeProfile || null;
    if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
        if(window.app.components.auth) window.app.components.auth();
        return;
    }

    const animeId = window.app.state.currentAnimePage.id;
    if(!profile.likedAnime) profile.likedAnime = [];
    if(!profile.dislikedAnime) profile.dislikedAnime = [];

    const likeNumEl = document.getElementById('like-count-display');
    const dislikeNumEl = document.getElementById('dislike-count-display');
    let currLikes = parseInt(likeNumEl.innerText) || 0;
    let currDislikes = parseInt(dislikeNumEl.innerText) || 0;

    if (type === 'like') {
        if (profile.likedAnime.includes(animeId)) {
            profile.likedAnime = profile.likedAnime.filter(id => id !== animeId);
            window.app.handleReactionUI('none');
            likeNumEl.innerText = Math.max(0, currLikes - 1);
        } else {
            profile.likedAnime.push(animeId);
            if (profile.dislikedAnime.includes(animeId)) {
                profile.dislikedAnime = profile.dislikedAnime.filter(id => id !== animeId);
                dislikeNumEl.innerText = Math.max(0, currDislikes - 1);
            }
            window.app.handleReactionUI('like');
            likeNumEl.innerText = currLikes + 1;
        }
    } else if (type === 'dislike') {
        if (profile.dislikedAnime.includes(animeId)) {
            profile.dislikedAnime = profile.dislikedAnime.filter(id => id !== animeId);
            window.app.handleReactionUI('none');
            dislikeNumEl.innerText = Math.max(0, currDislikes - 1);
        } else {
            profile.dislikedAnime.push(animeId);
            if (profile.likedAnime.includes(animeId)) {
                profile.likedAnime = profile.likedAnime.filter(id => id !== animeId);
                likeNumEl.innerText = Math.max(0, currLikes - 1);
            }
            window.app.handleReactionUI('dislike');
            dislikeNumEl.innerText = currDislikes + 1;
        }
    }

    localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { 
            likedAnime: profile.likedAnime,
            dislikedAnime: profile.dislikedAnime 
        });
    } catch (e) { console.log("Reaction sync dropped."); }
};

// ==========================================
// --- REPLICATED EPISODES GRID ENGINE ---
// ==========================================

window.app.renderPlayEpisodesUI = () => {
    const mountPoint = document.getElementById('episodes-grid-mount-point');
    if (!mountPoint) return;

    const episodesList = window.app.state.currentEpisodesListProcessed || [];
    const totalEps = episodesList.length;

    let rangeDropdownHtml = '';
    let currentRangeLabel = 'N/A';

    if (totalEps > 0) {
        for (let i = 0; i < totalEps; i += 100) {
            const startNum = i + 1;
            const endNum = Math.min(i + 100, totalEps);
            const val = `${startNum}-${endNum}`;
            const label = `Episodes ${startNum} - ${endNum}`;
            if (!window.app.state.epRangeFilter && i === 0) window.app.state.epRangeFilter = val;
            if (window.app.state.epRangeFilter === val) currentRangeLabel = label;
            rangeDropdownHtml += `<button onclick="window.app.selectPlayDropdownOption('${label}', '${val}')" class="w-full text-left px-4 py-3 text-xs md:text-sm font-bold text-white hover:bg-[#F47521] hover:text-black transition-colors border-b border-white/5 last:border-0">${label}</button>`;
        }
    } else {
        currentRangeLabel = 'No Episodes Found';
        rangeDropdownHtml = `<div class="px-4 py-3 text-xs text-gray-500">N/A</div>`;
    }

    const currentLang = window.app.state.activeLanguageType || 'sub';

    mountPoint.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#111] p-2.5 rounded-xl border border-white/5">
                
                <div class="flex bg-black p-1 border border-white/10 rounded-lg max-w-xs md:w-44 text-[11px] font-black select-none tracking-wider uppercase h-10 shrink-0">
                    <button onclick="window.app.togglePlayGridAudio('sub')" id="play-lang-btn-sub" class="flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${currentLang === 'sub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}">Sub</button>
                    <button onclick="window.app.togglePlayGridAudio('dub')" id="play-lang-btn-dub" class="flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${currentLang === 'dub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}">Dub</button>
                </div>

                <div class="relative w-full sm:w-56 shrink-0" id="play-dropdown-container">
                    <button id="play-dropdown-btn" onclick="window.app.togglePlayDropdown()" class="flex items-center justify-between w-full bg-black border border-white/10 text-white text-xs font-bold h-10 px-4 rounded-lg outline-none hover:border-white/30 focus:border-[#F47521] transition-all">
                        <span id="play-dropdown-selected">${currentRangeLabel}</span>
                        <i id="play-dropdown-icon" class="fas fa-chevron-down text-gray-400 text-xs transition-transform duration-300"></i>
                    </button>
                    <div id="play-dropdown-menu" class="absolute left-0 mt-2 w-full bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 hidden overflow-hidden flex flex-col max-h-60 overflow-y-auto hide-scrollbar">
                        ${rangeDropdownHtml}
                    </div>
                </div>

                <div class="relative flex-1 max-w-md w-full">
                    <input type="number" id="play-episode-search-box" value="${window.app.state.epSearchValue || ''}" onkeyup="window.app.runPlayEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-black border border-white/10 text-white text-xs h-10 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600 transition-colors">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>

            <div id="play-numeric-episodes-grid" class="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-2 w-full max-h-[350px] overflow-y-auto hide-scrollbar pr-1 pb-2"></div>
        </div>
    `;

    window.app.renderPlayGridItems();
};

window.app.togglePlayDropdown = () => {
    const menu = document.getElementById('play-dropdown-menu');
    const icon = document.getElementById('play-dropdown-icon');
    if (!menu) return;
    if(menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
};

window.app.selectPlayDropdownOption = (label, val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('play-dropdown-selected').innerText = label;
    window.app.togglePlayDropdown();
    document.getElementById('play-episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    window.app.renderPlayGridItems();
};

window.app.runPlayEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    window.app.renderPlayGridItems();
};

window.app.togglePlayGridAudio = (langMode) => {
    if (window.app.state.activeLanguageType === langMode) return;
    window.app.state.activeLanguageType = langMode;
    document.getElementById('play-lang-btn-sub').className = `flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${langMode === 'sub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}`;
    document.getElementById('play-lang-btn-dub').className = `flex-1 rounded-md transition-all flex items-center justify-center gap-1 ${langMode === 'dub' ? 'bg-[#F47521] text-black shadow-md font-black' : 'text-gray-400 hover:text-white'}`;
    window.app.renderPlayGridItems();
};

window.app.renderPlayGridItems = () => {
    const gridDiv = document.getElementById('play-numeric-episodes-grid');
    if (!gridDiv) return;

    const animeId = window.app.state.currentAnimePage.id;
    const episodesToFilter = window.app.state.currentEpisodesListProcessed || [];
    const searchVal = window.app.state.epSearchValue || '';
    const rangeArray = window.app.state.epRangeFilter ? window.app.state.epRangeFilter.split('-') : [];
    const currentLangMode = window.app.state.activeLanguageType || 'sub';
    const currentlyPlayingEp = window.app.state.currentPlayingEpNum;
    const currentServer = new URLSearchParams(window.location.search).get('server') || 'hd-1';
    
    let episodesToRender = [...episodesToFilter];

    if (searchVal !== '') {
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.num || ep.episode_no;
            return epNumber && epNumber.toString().includes(searchVal);
        });
    } else if (rangeArray.length === 2) {
        const startEpNum = parseInt(rangeArray[0]);
        const endEpNum = parseInt(rangeArray[1]);
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.num || ep.episode_no;
            return epNumber && epNumber >= startEpNum && epNumber <= endEpNum;
        });
    }

    if (episodesToRender.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center py-6 text-gray-500 text-xs">No matching audio sources found.</div>`;
        return;
    }

    const profile = window.app.state?.activeProfile || null;
    let localHistoryMap = null;
    if (profile && profile.uid) {
        const stored = localStorage.getItem(`blazex_progress_${profile.uid}_${animeId}`);
        if (stored) { try { localHistoryMap = JSON.parse(stored); } catch(e){} }
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const epNumber = ep.num || ep.episode_no;
        const targetEpisodeSlugId = ep.slug || ep.id || String(epNumber); 
        
        const isFillerEpisode = ep.isFiller === true;
        const fillerIconDot = isFillerEpisode ? `<div class="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></div>` : '';
        const isSupportedByLang = (currentLangMode === 'sub' && ep.isSub !== false) || 
                                  (currentLangMode === 'dub' && ep.isDub === true);

        let
