// search.js - Premium TV-Ready Search & Filter Engine

window.app = window.app || {};

document.addEventListener('DOMContentLoaded', () => {
    // --- INJECT CUSTOM CSS FOR MARQUEE & VERTICAL TEXT ---
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            display: inline-block;
            white-space: nowrap;
            padding-left: 100%;
            animation: marquee 12s linear infinite;
        }
        .vertical-text {
            writing-mode: vertical-lr;
            text-orientation: mixed;
            transform: rotate(180deg);
        }
        .stroke-text {
            -webkit-text-stroke: 2px white;
            color: transparent;
        }
        .group:hover .stroke-text {
            -webkit-text-stroke: 2px #FFA500; /* Pure Orange */
            color: #FFA500;
            text-shadow: 0 0 15px rgba(255, 165, 0, 0.5);
        }
        /* Custom Scrollbar for TV right-panel */
        .tv-scroll::-webkit-scrollbar { width: 6px; }
        .tv-scroll::-webkit-scrollbar-thumb { background: rgba(255,165,0,0.5); border-radius: 10px; }
    `;
    document.head.appendChild(style);

    // --- DOM ELEMENTS ---
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const idleView = document.getElementById('idle-view');
    const typingView = document.getElementById('typing-view');
    const resultsView = document.getElementById('results-view');
    
    const historyContainer = document.getElementById('history-container');
    const trendingContainer = document.getElementById('trending-container');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const topResultCard = document.getElementById('top-result-card');
    const resultsListContainer = document.getElementById('results-list-container');
    const filterModal = document.getElementById('filter-modal');
    
    const API_BASE = 'https://anikoto-api-xi.vercel.app';
    const ANILIST_URL = 'https://graphql.anilist.co';
    let typingTimer;
    let activeFilters = {};

    // --- TV LAYOUT DOM RESTRUCTURING ---
    // Automatically creates the Left (Search/History) / Right (Top 10) layout for Large Screens
    const setupTVLayout = () => {
        if (idleView) {
            idleView.className = "flex flex-col lg:flex-row w-full gap-8 lg:h-[75vh]";
            
            // Assume the history container's parent should act as the Left Panel
            const historyWrapper = historyContainer ? historyContainer.parentElement : null;
            if (historyWrapper) {
                historyWrapper.className = "lg:w-1/3 flex flex-col gap-6 lg:border-r lg:border-white/10 lg:pr-6";
                // Move the search bar into the left panel on big screens if it isn't already
                if (searchInput && searchInput.parentElement && searchInput.parentElement.parentElement !== historyWrapper) {
                    historyWrapper.insertBefore(searchInput.parentElement, historyWrapper.firstChild);
                }
            }

            // Make the Top 10 panel scrollable on the right for TV
            const trendingWrapper = trendingContainer ? trendingContainer.parentElement : null;
            if (trendingWrapper) {
                trendingWrapper.className = "lg:w-2/3 flex flex-col h-full overflow-y-auto tv-scroll pr-2 pb-20";
            }
        }
    };

    // --- TITLE MARQUEE HELPER ---
    const getMovingTitleHtml = (title, classes = "text-white font-bold") => {
        if (title.length > 25) {
            return `<div class="overflow-hidden whitespace-nowrap w-full relative"><span class="${classes} animate-marquee">${title}</span></div>`;
        }
        return `<h4 class="${classes} truncate">${title}</h4>`;
    };

    // --- 1. INITIALIZATION ---
    const initSearchPage = async () => {
        setupTVLayout();
        renderHistory();
        initTypewriterPlaceholder();
        await loadTop10Popular();
    };

    const initTypewriterPlaceholder = async () => {
        if(!searchInput) return;
        let trendingTitles = ["anime, genres..."];
        try {
            const query = `query { Page(page: 1, perPage: 3) { media(type: ANIME, sort: TRENDING_DESC) { title { english romaji } } } }`;
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const json = await res.json();
            if (json.data && json.data.Page.media) trendingTitles = json.data.Page.media.map(a => a.title.english || a.title.romaji);
        } catch (e) {}

        let titleIndex = 0; let charIndex = 0; let isDeleting = false;
        const type = () => {
            if (document.activeElement === searchInput && searchInput.value.trim() !== '') return; 
            const currentTitle = trendingTitles[titleIndex];
            
            if (isDeleting) { searchInput.setAttribute('placeholder', `Search "${currentTitle.substring(0, charIndex - 1)}"`); charIndex--; } 
            else { searchInput.setAttribute('placeholder', `Search "${currentTitle.substring(0, charIndex + 1)}"`); charIndex++; }

            let typeSpeed = isDeleting ? 50 : 100;
            if (!isDeleting && charIndex === currentTitle.length) { typeSpeed = 2000; isDeleting = true; } 
            else if (isDeleting && charIndex === 0) { isDeleting = false; titleIndex = (titleIndex + 1) % trendingTitles.length; typeSpeed = 500; }
            setTimeout(type, typeSpeed);
        };
        type();
    };

    // --- ANILIST TO DB MAPPING (TOP 10 VERTICAL UI) ---
    const loadTop10Popular = async () => {
        if(!trendingContainer) return;
        trendingContainer.innerHTML = `<div class="p-10 text-center text-sm font-bold text-[#FFA500] w-full"><i class="fas fa-circle-notch fa-spin text-3xl mb-4 block"></i> Loading Trending...</div>`;
        
        try {
            const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { title { romaji english } coverImage { extraLarge } format genres description(asHtml: false) } } }`;
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const json = await res.json();
            const animeList = json.data.Page.media;

            trendingContainer.innerHTML = '';
            // Stacked vertical list for the right panel
            trendingContainer.className = "flex flex-col gap-4 w-full"; 

            let count = 1;
            animeList.forEach(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                const imgUrl = anime.coverImage.extraLarge;
                const format = anime.format || 'TV';
                const genresHtml = (anime.genres || []).slice(0, 3).map(g => `<span class="bg-white/10 text-gray-300 px-2 py-0.5 rounded text-[9px] uppercase">${g}</span>`).join('');
                
                // Pure Orange & Thick White Vertical Layout
                trendingContainer.innerHTML += `
                <div onclick="window.app.openFromAnilist('${safeTitle}')" class="flex flex-row group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-[#FFA500]/20 bg-[#0a0a0a] border border-white/5 hover:border-[#FFA500]/50 transition-all duration-500 h-36 md:h-44">
                    
                    <!-- LARGE VERTICAL TEXT (PURE ORANGE ON HOVER / BOLD THICK WHITE) -->
                    <div class="flex items-center justify-center w-16 md:w-24 bg-[#050505] border-r border-white/5 relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#FFA500]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <span class="vertical-text stroke-text text-5xl md:text-7xl font-black uppercase tracking-widest transition-all duration-500 z-10">
                            ${count}
                        </span>
                        <span class="absolute top-2 right-2 text-[10px] font-black text-gray-600 group-hover:text-[#FFA500] uppercase rotate-90 origin-top-right transition-colors">TOP</span>
                    </div>

                    <!-- IMAGE -->
                    <div class="relative w-24 md:w-32 flex-shrink-0">
                        <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                            <i class="fas fa-play text-white text-2xl drop-shadow-lg"></i>
                        </div>
                    </div>
                    
                    <!-- INFO & MARQUEE TITLE -->
                    <div class="p-4 flex-1 flex flex-col min-w-0 justify-center relative overflow-hidden">
                        ${getMovingTitleHtml(title, "text-sm md:text-lg font-black text-white mb-2 leading-tight")}
                        <p class="text-[10px] md:text-xs text-gray-400 line-clamp-2 leading-relaxed mb-auto">${anime.description || 'Trending globally right now.'}</p>
                        
                        <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                            <div class="flex gap-1">
                                ${genresHtml}
                            </div>
                            <span class="text-[#FFA500] text-[10px] font-bold tracking-wider group-hover:pr-2 transition-all">PLAY <i class="fas fa-chevron-right text-[8px]"></i></span>
                        </div>
                    </div>
                </div>`;
                count++;
            });
        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-xs text-red-500 col-span-full">Could not load popular titles.</p>`;
        }
    };

    window.app.openFromAnilist = async (title) => {
        document.body.style.cursor = 'wait';
        try {
            const searchRes = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(title)}`);
            const searchJson = await searchRes.json();
            if (searchJson.success && searchJson.results?.length > 0) window.location.href = `info.html?id=${searchJson.results[0].id}`;
            else if (searchJson.success && searchJson.data?.length > 0) window.location.href = `info.html?id=${searchJson.data[0].id}`;
            else {
                if (window.app.showCustomAlert) window.app.showCustomAlert("Title not found in DB.", "error");
                else alert("Title not found in our database yet.");
            }
        } catch (e) { console.error(e); } finally { document.body.style.cursor = 'default'; }
    };

    // --- 2. HISTORY LOGIC ---
    const getHistory = () => JSON.parse(localStorage.getItem('blazex_search_history')) || [];
    const saveHistory = (term) => {
        let history = getHistory().filter(t => t.toLowerCase() !== term.toLowerCase()); 
        history.unshift(term);
        if (history.length > 10) history.pop();
        localStorage.setItem('blazex_search_history', JSON.stringify(history));
        renderHistory();
    };
    const deleteHistoryItem = (term) => {
        localStorage.setItem('blazex_search_history', JSON.stringify(getHistory().filter(t => t !== term)));
        renderHistory();
    };

    const renderHistory = () => {
        if(!historyContainer) return;
        const history = getHistory();
        historyContainer.innerHTML = history.map(term => `
            <div class="history-item flex items-center bg-[#111] border border-white/5 rounded-full px-4 py-3 cursor-pointer hover:border-[#FFA500] hover:text-[#FFA500] transition select-none" data-term="${term}">
                <i class="fas fa-history mr-3 text-xs opacity-50"></i>
                <span class="text-sm font-semibold flex-1">${term}</span>
                <i class="fas fa-arrow-right text-[10px] opacity-0 hover-opacity-100"></i>
            </div>
        `).join('');

        document.querySelectorAll('.history-item').forEach(item => {
            let pressTimer; const term = item.getAttribute('data-term');
            const startPress = () => { pressTimer = setTimeout(() => { deleteHistoryItem(term); }, 600); };
            const cancelPress = () => clearTimeout(pressTimer);
            item.addEventListener('mousedown', startPress); item.addEventListener('mouseup', cancelPress); item.addEventListener('mouseleave', cancelPress);
            item.addEventListener('click', () => { cancelPress(); searchInput.value = term; handleSearchSubmit(term); });
        });
    };

    // --- 4. VIEW SWITCHING ---
    const switchView = (view) => {
        if(idleView) idleView.classList.add('hidden');
        if(typingView) typingView.classList.add('hidden');
        if(resultsView) resultsView.classList.add('hidden');
        
        if (view === 'idle' && idleView) idleView.classList.remove('hidden');
        if (view === 'typing' && typingView) typingView.classList.remove('hidden');
        if (view === 'results' && resultsView) resultsView.classList.remove('hidden');
    };

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if(clearBtn) clearBtn.classList.toggle('hidden', val.length === 0);
            clearTimeout(typingTimer);
            if (val.length === 0) { switchView('idle'); return; }
            switchView('typing');
            typingTimer = setTimeout(() => fetchSuggestions(val), 300); 
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) handleSearchSubmit(searchInput.value.trim());
        });
    }

    if(clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = ''; clearBtn.classList.add('hidden'); switchView('idle'); searchInput.focus();
        });
    }

    // --- 5. SUGGESTIONS ---
    const fetchSuggestions = async (term) => {
        if(!suggestionsContainer) return;
        const query = `query ($search: String) { Page(page: 1, perPage: 8) { media(type: ANIME, search: $search, sort: SEARCH_MATCH) { title { romaji english } } } }`;
        try {
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { search: term } }) });
            const json = await res.json();
            const media = json.data?.Page?.media || [];
            if (media.length === 0) { suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">No suggestions.</div>`; return; }
            window.handleSuggestionClick = (title) => { searchInput.value = title; handleSearchSubmit(title); };
            suggestionsContainer.innerHTML = media.map(anime => {
                const title = anime.title.english || anime.title.romaji;
                return `
                <div onclick="handleSuggestionClick('${title.replace(/'/g, "\\'")}')" class="flex items-center gap-3 p-4 hover:bg-[#111] hover:text-[#FFA500] rounded-xl cursor-pointer transition border-b border-white/5 last:border-0 group">
                    <i class="fas fa-search text-gray-600 group-hover:text-[#FFA500] transition"></i>
                    <span class="text-sm font-bold truncate">${title}</span>
                </div>`;
            }).join('');
        } catch (err) { suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">Network error.</div>`; }
    };

    // --- 6. SUBMIT SEARCH & PREMIUM LIST VIEW ---
    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        if(resultsListContainer) resultsListContainer.innerHTML = `<div class="p-16 text-center text-xl font-black text-[#FFA500] col-span-full"><i class="fas fa-circle-notch fa-spin text-4xl block mb-6"></i> Hunting Database...</div>`;

        try {
            const res = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(term)}`);
            const json = await res.json();
            const results = json.success ? (json.data || json.results || []) : [];

            if (!results || results.length === 0) {
                resultsListContainer.innerHTML = `<div class="text-center p-16 w-full"><p class="text-gray-500 text-lg">Nothing matched "${term}".</p></div>`;
                return; 
            }

            // LIST VIEW LAYOUT (Stack results vertically with descriptions, save, share, sub/dub)
            resultsListContainer.className = "flex flex-col gap-5 mt-6 w-full pb-20";
            
            const profile = window.app.state?.activeProfile || null;

            resultsListContainer.innerHTML = await Promise.all(results.map(async (anime) => {
                const aSub = anime.tvInfo?.sub || anime.sub || '?';
                const aDub = anime.tvInfo?.dub || anime.dub || 0;
                const safeTitle = anime.title.replace(/'/g, "\\'");
                
                let cardIsSaved = false;
                if (profile && profile.library) cardIsSaved = profile.library.some(item => item.id === anime.id);

                // Try to get AniList meta for description and genres if not in DB
                let desc = anime.description || 'Description not provided. Click Watch Now to explore.';
                let genresHtml = `<span class="bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded text-[10px] uppercase">${anime.type || 'TV'}</span>`;
                
                try {
                    const mRes = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query { Media(type: ANIME, search: "${safeTitle}") { description(asHtml: false) genres } }` }) });
                    const mJson = await mRes.json();
                    if(mJson.data?.Media) {
                        desc = mJson.data.Media.description || desc;
                        if(mJson.data.Media.genres) {
                            genresHtml = mJson.data.Media.genres.slice(0,4).map(g => `<span class="bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded text-[10px] uppercase hover:bg-white/10 transition">${g}</span>`).join('');
                        }
                    }
                } catch(e) {}

                return `
                <div class="flex flex-col md:flex-row bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden hover:border-[#FFA500]/50 hover:shadow-[0_0_20px_rgba(255,165,0,0.1)] transition-all duration-300 group">
                    
                    <!-- Image Area -->
                    <div class="relative w-full md:w-48 lg:w-56 h-48 md:h-auto flex-shrink-0 cursor-pointer overflow-hidden" onclick="window.location.href='info.html?id=${anime.id}'">
                        <img src="${anime.image || anime.poster}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                        <div class="absolute bottom-3 left-3 flex flex-wrap gap-2 z-10">
                            <span class="bg-[#FFA500] text-black font-black text-[10px] px-2 py-1 rounded shadow-md">SUB ${aSub}</span>
                            ${aDub > 0 ? `<span class="bg-white text-black font-black text-[10px] px-2 py-1 rounded shadow-md">DUB ${aDub}</span>` : ''}
                        </div>
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center backdrop-blur-sm">
                            <i class="fas fa-play text-white text-4xl shadow-lg hover:scale-110 transition-transform"></i>
                        </div>
                    </div>
                    
                    <!-- Info & Actions Area -->
                    <div class="p-5 flex flex-col flex-1 min-w-0 bg-gradient-to-r from-transparent to-[#111]/30">
                        <!-- Title (Marquee) -->
                        <div class="mb-2 cursor-pointer" onclick="window.location.href='info.html?id=${anime.id}'">
                            ${getMovingTitleHtml(anime.title, "text-xl md:text-2xl font-black text-white hover:text-[#FFA500] transition-colors")}
                        </div>
                        
                        <!-- Genres -->
                        <div class="flex flex-wrap gap-2 mb-3">
                            ${genresHtml}
                        </div>

                        <!-- Description -->
                        <p class="text-xs md:text-sm text-gray-400 line-clamp-2 md:line-clamp-3 leading-relaxed mb-6">${desc}</p>
                        
                        <!-- Buttons -->
                        <div class="flex flex-wrap items-center gap-3 mt-auto pt-4 border-t border-white/5">
                            <button onclick="window.location.href='info.html?id=${anime.id}'" class="bg-[#FFA500] text-black px-5 py-2 md:py-2.5 rounded font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-white transition flex items-center gap-2 flex-1 md:flex-none justify-center"><i class="fas fa-play"></i> Watch</button>
                            
                            <button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${anime.image || anime.poster}')" class="bg-[#111] text-white px-4 py-2 md:py-2.5 rounded font-bold text-[10px] md:text-xs uppercase tracking-widest hover:border-[#FFA500] ${cardIsSaved ? 'border-[#FFA500] text-[#FFA500]' : 'border-white/10'} transition border flex items-center gap-2 flex-1 md:flex-none justify-center">
                                <i class="${cardIsSaved ? 'fas text-[#FFA500]' : 'far'} fa-bookmark"></i> ${cardIsSaved ? 'Saved' : 'Save'}
                            </button>
                            
                            <button onclick="window.app.shareItem('${anime.id}', '${safeTitle}')" class="bg-[#111] text-white px-4 py-2 md:py-2.5 rounded font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-white/10 transition border border-white/10 flex items-center gap-2 flex-1 md:flex-none justify-center">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                    </div>
                </div>`;
            })).then(htmlArray => htmlArray.join(''));

        } catch (err) {
            resultsListContainer.innerHTML = `<div class="text-center p-16 w-full"><p class="text-red-500 text-sm">Error connecting to DB.</p></div>`;
        }
    };

    // --- SHARE LOGIC ---
    window.app.shareItem = (id, title) => {
        const shareData = { id, title, url: `${window.location.origin}/info.html?id=${id}` };
        if (typeof window.openShareModal === 'function') { window.openShareModal(shareData); } 
        else {
            document.dispatchEvent(new CustomEvent('openShareApp', { detail: shareData }));
            if (navigator.share) navigator.share({ title: `Watch ${title}`, text: `Check out ${title}!`, url: shareData.url }).catch(console.error);
        }
    };

    // --- SAVE / LIBRARY BUTTON ACTION ---
    window.app.toggleSearchLibraryClick = async (event, id, title, img) => {
        event.stopPropagation(); 
        const profile = window.app.state?.activeProfile || null;
        if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Log in to save!", "error");
            return;
        }

        if(!profile.library) profile.library = [];
        const formattedAnime = { id, title, img };
        const existingItemIndex = profile.library.findIndex(item => item.id === id);
        const isCurrentlyAdded = existingItemIndex !== -1;
        const btn = event.currentTarget;

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userRef = firestore.doc(window.app.db, "users", profile.uid);

            if (isCurrentlyAdded) {
                profile.library.splice(existingItemIndex, 1); 
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                if (btn) {
                    btn.innerHTML = `<i class="far fa-bookmark"></i> Save`;
                    btn.className = "bg-[#111] text-white px-4 py-2 md:py-2.5 rounded font-bold text-[10px] md:text-xs uppercase tracking-widest hover:border-[#FFA500] transition border border-white/10 flex items-center gap-2 flex-1 md:flex-none justify-center";
                }
                await firestore.updateDoc(userRef, { library: firestore.arrayRemove(formattedAnime) });
            } else {
                profile.library.unshift(formattedAnime);
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                if (btn) {
                    btn.innerHTML = `<i class="fas text-[#FFA500] fa-bookmark"></i> Saved`;
                    btn.className = "bg-[#111] text-[#FFA500] border-[#FFA500] px-4 py-2 md:py-2.5 rounded font-bold text-[10px] md:text-xs uppercase tracking-widest hover:border-[#FFA500] transition border flex items-center gap-2 flex-1 md:flex-none justify-center";
                }
                await firestore.updateDoc(userRef, { library: firestore.arrayUnion(formattedAnime) });
            }
        } catch (error) { 
            if (window.app.showCustomAlert) window.app.showCustomAlert("Sync failed.", "error");
        }
    };

    initSearchPage();
});
