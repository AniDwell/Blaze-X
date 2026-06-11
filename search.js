// search.js - Cinematic Search & Filter Engine (List View & Vertical Text Edition)

window.app = window.app || {};

document.addEventListener('DOMContentLoaded', () => {
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

    // --- CUSTOM CSS DROPDOWN LOGIC ---
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const selectBtn = wrapper.querySelector('.custom-select');
        const textSpan = wrapper.querySelector('.selected-text');
        const options = wrapper.querySelectorAll('.custom-options div');

        if(selectBtn) {
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                    if (w !== wrapper) w.classList.remove('dropdown-open');
                });
                wrapper.classList.toggle('dropdown-open');
            });
        }

        options.forEach(opt => {
            opt.addEventListener('click', () => {
                selectBtn.setAttribute('data-value', opt.getAttribute('data-value'));
                textSpan.innerText = opt.innerText;
                wrapper.classList.remove('dropdown-open');
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('dropdown-open'));
    });

    // --- 1. INITIALIZATION ---
    const initSearchPage = async () => {
        renderHistory();
        initTypewriterPlaceholder();
        await loadTop10Popular();
    };

    const initTypewriterPlaceholder = async () => {
        if(!searchInput) return;
        let trendingTitles = ["anime, genres..."];
        try {
            const query = `query { Page(page: 1, perPage: 3) { media(type: ANIME, sort: TRENDING_DESC) { title { english romaji } } } }`;
            const res = await fetch(ANILIST_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
            });
            const json = await res.json();
            if (json.data && json.data.Page.media) {
                trendingTitles = json.data.Page.media.map(a => a.title.english || a.title.romaji);
            }
        } catch (e) {}

        let titleIndex = 0; let charIndex = 0; let isDeleting = false;
        
        const type = () => {
            if (document.activeElement === searchInput && searchInput.value.trim() !== '') return; 
            const currentTitle = trendingTitles[titleIndex];
            
            if (isDeleting) {
                searchInput.setAttribute('placeholder', `Search "${currentTitle.substring(0, charIndex - 1)}"`);
                charIndex--;
            } else {
                searchInput.setAttribute('placeholder', `Search "${currentTitle.substring(0, charIndex + 1)}"`);
                charIndex++;
            }

            let typeSpeed = isDeleting ? 50 : 100;
            if (!isDeleting && charIndex === currentTitle.length) { typeSpeed = 2000; isDeleting = true; } 
            else if (isDeleting && charIndex === 0) { isDeleting = false; titleIndex = (titleIndex + 1) % trendingTitles.length; typeSpeed = 500; }
            setTimeout(type, typeSpeed);
        };
        type();
    };

    // --- ANILIST TO DB MAPPING (TOP 10 w/ VERTICAL TEXT) ---
    const loadTop10Popular = async () => {
        if(!trendingContainer) return;
        trendingContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-500 w-full col-span-full"><i class="fas fa-circle-notch fa-spin text-[#F47521] text-xl mb-3 block"></i> Fetching Live Trending...</div>`;
        
        try {
            const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { title { romaji english } coverImage { extraLarge } format } } }`;
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const json = await res.json();
            const animeList = json.data.Page.media;

            trendingContainer.innerHTML = '';
            trendingContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6 pb-6 w-full"; 

            let count = 1;
            animeList.forEach(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                const imgUrl = anime.coverImage.extraLarge;
                const format = anime.format || 'TV';

                trendingContainer.innerHTML += `
                <div onclick="window.app.openFromAnilist('${safeTitle}')" class="relative group cursor-pointer overflow-hidden rounded-xl shadow-[0_5px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_30px_rgba(244,117,33,0.2)] bg-[#111] border border-white/5 hover:border-[#F47521]/50 flex h-36 lg:h-44 transition-all duration-300 transform hover:-translate-y-1">
                    
                    <!-- Vertical Rank Bar -->
                    <div class="w-10 md:w-12 bg-gradient-to-b from-[#F47521] to-[#ff9852] flex flex-col items-center justify-center z-20 shadow-lg">
                        <span class="text-black font-black text-sm lg:text-base tracking-[0.2em] uppercase" style="writing-mode: vertical-rl; transform: rotate(180deg);">TOP ${count}</span>
                    </div>

                    <!-- Cover Image Background -->
                    <div class="absolute inset-0 ml-10 md:ml-12">
                        <img src="${imgUrl}" class="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700">
                        <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
                    </div>
                    
                    <!-- Details Foreground -->
                    <div class="relative flex-1 p-4 flex flex-col justify-center ml-2 z-10">
                        <h4 class="text-sm lg:text-base font-bold text-white line-clamp-2 leading-tight drop-shadow-md">${title}</h4>
                        <div class="flex items-center mt-3 gap-2">
                            <span class="text-[9px] font-black uppercase text-black bg-white px-2 py-0.5 rounded shadow-sm">${format}</span>
                            <i class="fas fa-play text-[#F47521] text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-auto drop-shadow-lg"></i>
                        </div>
                    </div>
                </div>`;
                count++;
            });
        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-xs text-red-500 col-span-full">Could not load popular titles.</p>`;
        }
    };

    // ON CLICK API FETCH
    window.app.openFromAnilist = async (title) => {
        document.body.style.cursor = 'wait';
        try {
            const searchRes = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(title)}`);
            const searchJson = await searchRes.json();
            
            if (searchJson.success && searchJson.results?.length > 0) {
                window.location.href = `info.html?id=${searchJson.results[0].id}`;
            } else if (searchJson.success && searchJson.data?.length > 0) {
                window.location.href = `info.html?id=${searchJson.data[0].id}`;
            } else {
                if (window.app.showCustomAlert) window.app.showCustomAlert("Title not found in our database yet.", "error");
            }
        } catch (e) {
            if (window.app.showCustomAlert) window.app.showCustomAlert("Error connecting to database.", "error");
        } finally {
            document.body.style.cursor = 'default';
        }
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
        const clearAllBtn = document.getElementById('clear-all-history');
        const historyHint = document.getElementById('history-hint');
        
        if(clearAllBtn) clearAllBtn.classList.toggle('hidden', history.length === 0);
        if(historyHint) historyHint.classList.toggle('hidden', history.length === 0);
        
        historyContainer.innerHTML = history.map(term => `
            <div class="history-item relative flex items-center bg-[#111] border border-white/5 rounded-full px-4 py-2 cursor-pointer hover:border-[#F47521] transition select-none" data-term="${term}">
                <i class="fas fa-history text-gray-500 mr-2 text-xs"></i>
                <span class="text-xs font-semibold">${term}</span>
            </div>
        `).join('');

        document.querySelectorAll('.history-item').forEach(item => {
            let pressTimer;
            const term = item.getAttribute('data-term');
            const startPress = () => { pressTimer = setTimeout(() => { deleteHistoryItem(term); navigator.vibrate?.(50); }, 600); };
            const cancelPress = () => clearTimeout(pressTimer);
            item.addEventListener('mousedown', startPress); item.addEventListener('touchstart', startPress, {passive: true});
            item.addEventListener('mouseup', cancelPress); item.addEventListener('mouseleave', cancelPress); item.addEventListener('touchend', cancelPress);
            item.addEventListener('click', () => { cancelPress(); searchInput.value = term; handleSearchSubmit(term); });
        });
    };

    const clearAllBtn = document.getElementById('clear-all-history');
    if(clearAllBtn) clearAllBtn.addEventListener('click', () => { localStorage.removeItem('blazex_search_history'); renderHistory(); });

    // --- 3. FILTER LOGIC ---
    const filterBtn = document.getElementById('filter-btn');
    const closeFilterBtn = document.getElementById('close-filter-btn');
    const resetFilterBtn = document.getElementById('reset-filter-btn');
    const applyFilterBtn = document.getElementById('apply-filter-btn');

    if(filterBtn) filterBtn.addEventListener('click', () => { filterModal.classList.remove('hidden'); filterModal.classList.add('flex'); });
    if(closeFilterBtn) closeFilterBtn.addEventListener('click', () => { filterModal.classList.add('hidden'); filterModal.classList.remove('flex'); });
    
    if(resetFilterBtn) resetFilterBtn.addEventListener('click', () => {
        ['genres', 'sy', 'sm', 'sd', 'ey', 'em', 'ed'].forEach(id => { const el = document.getElementById(`f-${id}`); if(el) el.value = ''; });
        const setSelect = (id, val, text) => {
            const select = document.querySelector(`#wrap-${id} .custom-select`);
            const span = document.querySelector(`#wrap-${id} .selected-text`);
            if(select && span) { select.setAttribute('data-value', val); span.innerText = text; }
        };
        setSelect('type', '', 'ALL'); setSelect('status', '', 'ALL'); setSelect('lang', '', 'ALL'); setSelect('sort', 'default', 'Default');
        activeFilters = {};
    });

    if(applyFilterBtn) applyFilterBtn.addEventListener('click', () => {
        const getVal = (id) => document.querySelector(`#wrap-${id} .custom-select`)?.getAttribute('data-value');
        const getInput = (id) => document.getElementById(`f-${id}`)?.value;

        activeFilters = {
            type: getVal('type'), status: getVal('status'), language: getVal('lang'), sort: getVal('sort'),
            genres: getInput('genres'), sy: getInput('sy'), sm: getInput('sm'), sd: getInput('sd'), ey: getInput('ey'), em: getInput('em'), ed: getInput('ed'),
        };
        filterModal.classList.add('hidden');
        if (searchInput.value.trim()) handleSearchSubmit(searchInput.value.trim());
    });

    // --- 4. VIEW SWITCHING ---
    const switchView = (view) => {
        if(idleView) idleView.classList.add('hidden');
        if(typingView) typingView.classList.add('hidden');
        if(resultsView) resultsView.classList.add('hidden');
        
        if (view === 'idle' && idleView) idleView.classList.remove('hidden');
        if (view === 'typing' && typingView) typingView.classList.remove('hidden');
        if (view === 'results' && resultsView) resultsView.classList.remove('hidden');
    };

    const highlightText = (text, query) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="text-[#F47521]">$1</span>');
    };

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if(clearBtn) clearBtn.classList.toggle('hidden', val.length === 0);
            
            clearTimeout(typingTimer);
            if (val.length === 0) { switchView('idle'); return; }

            switchView('typing');
            if(suggestionsContainer) suggestionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">Loading...</div>`;
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

    // --- 5. SUGGESTIONS (AniList) ---
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
                const safeTitle = title.replace(/'/g, "\\'");
                const highlighted = highlightText(title, term);
                return `
                <div onclick="handleSuggestionClick('${safeTitle}')" class="flex items-center gap-3 p-3 hover:bg-[#111] rounded-lg cursor-pointer transition border-b border-white/5 last:border-0">
                    <i class="fas fa-search text-gray-600 text-sm"></i><span class="text-sm text-gray-300 truncate">${highlighted}</span>
                </div>`;
            }).join('');
        } catch (err) { suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">Network error.</div>`; }
    };

    // --- 6. SUBMIT SEARCH (CINEMATIC CARD & LIST VIEW) ---
    const render404State = (message = "Nothing matched your search.") => {
        if(topResultCard) topResultCard.innerHTML = '';
        if(resultsListContainer) resultsListContainer.innerHTML = ''; 
        if(window.BlazeX && window.BlazeX.show404) {
            window.BlazeX.show404('results-list-container', message);
        } else if(resultsListContainer) {
            resultsListContainer.innerHTML = `<div class="text-center p-10 col-span-full"><p class="text-gray-500 text-sm">${message}</p></div>`;
        }
    };

    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        if(topResultCard) topResultCard.innerHTML = `<div class="animate-pulse w-full h-64 lg:h-96 bg-[#111] rounded-xl border border-white/5"></div>`;
        if(resultsListContainer) resultsListContainer.innerHTML = `<div class="p-10 text-center text-sm font-bold text-[#F47521] col-span-full"><i class="fas fa-circle-notch fa-spin text-2xl block mb-3"></i> Connecting...</div>`;

        try {
            let queryParams = new URLSearchParams();
            queryParams.append('keyword', term);
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key] && activeFilters[key] !== 'default') queryParams.append(key, activeFilters[key]);
            });

            const endpoint = Array.from(queryParams.keys()).length > 1 ? '/api/filter' : '/api/search';
            const res = await fetch(`${API_BASE}${endpoint}?${queryParams.toString()}`);
            const json = await res.json();
            
            let results = [];
            if (endpoint === '/api/filter' && json.success && json.results?.data) results = json.results.data;
            else if (endpoint === '/api/search' && json.success && json.data) results = json.data;
            else if (endpoint === '/api/search' && json.success && json.results) results = json.results;

            if (!results || results.length === 0) { render404State("We couldn't find any anime matching your query or filters."); return; }

            const topAnime = results[0];
            const restAnime = results.slice(1);

            // Fetch Top Result Meta
            let backdrop = topAnime.image || topAnime.poster;
            let description = topAnime.description || 'No description available for this title.';
            try {
                const mRes = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query { Media(type: ANIME, search: "${topAnime.title}") { bannerImage description(asHtml: false) } }` }) });
                const mJson = await mRes.json();
                if(mJson.data?.Media) {
                    backdrop = mJson.data.Media.bannerImage || backdrop;
                    description = mJson.data.Media.description || description;
                }
            } catch(e) {}

            const topSubEps = topAnime.tvInfo?.sub || topAnime.sub || '?';
            const topDubEps = topAnime.tvInfo?.dub || topAnime.dub || 0;
            const topImg = topAnime.image || topAnime.poster;
            const safeTitleTop = topAnime.title.replace(/'/g, "\\'");

            // Dynamic Save/Library Button Check
            const profile = window.app.state?.activeProfile || null;
            let isAdded = false;
            if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
                isAdded = profile.library.some(item => item.id === topAnime.id);
            }

            const libraryBtnHtml = isAdded 
                ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${safeTitleTop}', '${topImg}')" class="bg-[#F47521] text-black px-5 py-3 lg:px-8 lg:py-3.5 rounded font-black text-[10px] lg:text-xs uppercase tracking-widest hover:bg-white transition flex items-center justify-center gap-2 shadow-lg"><i class="fas fa-bookmark"></i> Saved</button>`
                : `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${safeTitleTop}', '${topImg}')" class="bg-black/50 backdrop-blur-md text-white px-5 py-3 lg:px-8 lg:py-3.5 rounded font-black text-[10px] lg:text-xs uppercase tracking-widest hover:border-[#F47521] transition border border-white/20 flex items-center justify-center gap-2"><i class="far fa-bookmark"></i> Save</button>`;

            // --- RENDER TOP CARD: Info on LEFT, Image on RIGHT ---
            if(topResultCard) {
                topResultCard.innerHTML = `
                <div class="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.8)] bg-[#050505] group">
                    
                    <!-- Blurred Cinematic Backdrop -->
                    <div class="absolute inset-0 z-0">
                        <img src="${backdrop}" class="w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform duration-[1.5s] ease-in-out blur-md">
                        <div class="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/95 to-[#050505]/40"></div>
                        <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
                    </div>
                    
                    <div class="relative flex flex-col-reverse md:flex-row items-center md:items-stretch gap-6 lg:gap-12 p-6 lg:p-12 z-10 w-full h-full">
                        
                        <!-- DETAILS (LEFT SIDE) -->
                        <div class="flex flex-col flex-1 justify-center w-full">
                            <div class="flex flex-wrap items-center gap-3 mb-4">
                                <span class="bg-gradient-to-r from-[#F47521] to-[#ff9852] text-black px-3 py-1 rounded font-black text-[9px] lg:text-[11px] uppercase tracking-widest shadow-[0_0_15px_rgba(244,117,33,0.3)]"><i class="fas fa-fire-alt mr-1"></i> Top Match</span>
                                <span class="bg-white/10 backdrop-blur-sm text-white px-3 py-1 rounded font-bold text-[10px] lg:text-xs border border-white/10 shadow-sm">${topAnime.type || 'TV'}</span>
                                <div class="flex gap-1.5 ml-auto md:ml-0 md:mr-auto">
                                    <span class="bg-[#F47521]/10 border border-[#F47521]/30 text-[#F47521] px-2 py-1 rounded font-black text-[10px] shadow-sm uppercase">SUB ${topSubEps}</span>
                                    ${topDubEps > 0 ? `<span class="bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-1 rounded font-black text-[10px] shadow-sm uppercase">DUB ${topDubEps}</span>` : ''}
                                </div>
                            </div>
                            
                            <h3 class="text-3xl md:text-4xl lg:text-6xl font-black leading-[1.1] text-white mb-4 cursor-pointer hover:text-[#F47521] transition-colors drop-shadow-lg" onclick="window.location.href='info.html?id=${topAnime.id}'">${topAnime.title}</h3>
                            
                            <p class="text-[11px] lg:text-sm text-gray-300 line-clamp-3 lg:line-clamp-4 mb-8 leading-relaxed max-w-2xl font-medium drop-shadow-md">${description}</p>
                            
                            <div class="flex flex-wrap items-center gap-3 lg:gap-4 mt-auto">
                                <button onclick="window.location.href='info.html?id=${topAnime.id}'" class="bg-white text-black px-6 py-3 lg:px-8 lg:py-3.5 rounded font-black text-[10px] lg:text-xs uppercase tracking-widest hover:bg-[#F47521] hover:text-white transition shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"><i class="fas fa-play text-sm"></i> Watch Now</button>
                                ${libraryBtnHtml}
                                <button onclick="window.app.shareItem('${topAnime.id}', '${safeTitleTop}')" class="bg-black/40 backdrop-blur-md text-gray-300 w-11 h-11 lg:w-12 lg:h-12 rounded-full font-black text-sm uppercase hover:bg-white/20 hover:text-white transition border border-white/10 flex items-center justify-center" title="Share"><i class="fas fa-share-alt"></i></button>
                            </div>
                        </div>

                        <!-- COVER IMAGE (RIGHT SIDE / MEDIUM) -->
                        <div class="relative flex-shrink-0 cursor-pointer group/poster w-40 md:w-56 lg:w-64" onclick="window.location.href='info.html?id=${topAnime.id}'">
                            <img src="${topImg}" class="w-full h-auto aspect-[2/3] object-cover rounded-xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] border border-white/10 group-hover/poster:border-[#F47521]/60 transition-all duration-500 transform group-hover/poster:-translate-y-2 group-hover/poster:shadow-[0_25px_50px_-10px_rgba(244,117,33,0.3)]">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300 rounded-xl flex items-end justify-center pb-8">
                                <i class="fas fa-play text-[#F47521] text-5xl drop-shadow-[0_0_15px_rgba(244,117,33,0.6)] hover:scale-110 transition-transform"></i>
                            </div>
                        </div>

                    </div>
                </div>`;
            }

            // --- RENDER REST RESULTS: LIST VIEW ---
            if(resultsListContainer) {
                // Changed from grid to flex column (List view)
                resultsListContainer.className = "flex flex-col gap-3 lg:gap-4 mt-8 w-full";
                
                resultsListContainer.innerHTML = restAnime.map(anime => {
                    const aSub = anime.tvInfo?.sub || anime.sub || '?';
                    const aDub = anime.tvInfo?.dub || anime.dub || 0;
                    const safeTitle = anime.title.replace(/'/g, "\\'");
                    
                    let cardIsSaved = false;
                    if (profile && profile.library) {
                        cardIsSaved = profile.library.some(item => item.id === anime.id);
                    }

                    return `
                    <div class="flex flex-row items-center gap-4 lg:gap-6 group relative bg-[#111] border border-white/5 rounded-xl p-3 pr-4 hover:border-[#F47521]/40 hover:bg-[#141414] hover:shadow-[0_5px_15px_rgba(244,117,33,0.08)] transition-all duration-300 w-full overflow-hidden">
                        
                        <!-- List Item Image (Medium/Small) -->
                        <div class="relative w-16 md:w-24 lg:w-28 aspect-[2/3] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-md border border-white/5" onclick="window.location.href='info.html?id=${anime.id}'">
                            <img src="${anime.image || anime.poster}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[1px]">
                                <i class="fas fa-play text-white text-xl drop-shadow-md"></i>
                            </div>
                        </div>
                        
                        <!-- List Item Details -->
                        <div class="flex flex-col flex-1 min-w-0 py-2">
                            <h4 class="text-sm md:text-base lg:text-lg font-bold text-white truncate cursor-pointer hover:text-[#F47521] transition-colors mb-1.5" onclick="window.location.href='info.html?id=${anime.id}'">${anime.title}</h4>
                            <p class="text-[10px] md:text-xs text-gray-500 truncate mb-3 italic">${anime.japanese_title || ''}</p>
                            
                            <div class="flex items-center gap-2 mt-auto">
                                <span class="text-[9px] md:text-[10px] font-bold text-gray-300 bg-white/10 border border-white/5 px-2 py-0.5 rounded uppercase tracking-wider">${anime.type || 'TV'}</span>
                                <span class="text-[9px] md:text-[10px] font-black text-[#F47521] bg-[#F47521]/10 px-2 py-0.5 rounded uppercase">SUB ${aSub}</span>
                                ${aDub > 0 ? `<span class="text-[9px] md:text-[10px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded uppercase">DUB ${aDub}</span>` : ''}
                            </div>
                        </div>
                        
                        <!-- List Item Hover Actions -->
                        <div class="flex items-center gap-3 lg:gap-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                            <button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${anime.image || anime.poster}')" class="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/40 hover:bg-[#F47521]/20 text-gray-400 hover:text-[#F47521] flex items-center justify-center transition-colors border border-white/5 shadow-sm" title="Save">
                                <i class="${cardIsSaved ? 'fas text-[#F47521]' : 'far'} fa-bookmark text-lg"></i>
                            </button>
                            <button onclick="window.app.shareItem('${anime.id}', '${safeTitle}')" class="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/40 hover:bg-white/20 text-gray-400 hover:text-white flex items-center justify-center transition-colors border border-white/5 shadow-sm" title="Share">
                                <i class="fas fa-share-alt text-lg"></i>
                            </button>
                        </div>

                    </div>`;
                }).join('');
            }
        } catch (err) {
            render404State("Network error occurred while communicating with the database.");
        }
    };

    // --- SHARE LOGIC ---
    window.app.shareItem = (id, title) => {
        const shareData = { id, title, url: `${window.location.origin}/info.html?id=${id}` };
        
        if (typeof window.openShareModal === 'function') {
            window.openShareModal(shareData);
        } else {
            document.dispatchEvent(new CustomEvent('openShareApp', { detail: shareData }));
            if (navigator.share) {
                navigator.share({
                    title: `Watch ${title}`,
                    text: `Check out ${title} on our platform!`,
                    url: shareData.url
                }).catch(console.error);
            }
        }
    };

    // --- SAVE / LIBRARY BUTTON ACTION ---
    window.app.toggleSearchLibraryClick = async (event, id, title, img) => {
        event.stopPropagation(); 
        const profile = window.app.state?.activeProfile || null;
        if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Log in to save to your Library!", "error");
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
                    if (btn.innerText.includes('SAVED')) {
                        btn.className = "bg-black/50 backdrop-blur-md text-white px-5 py-3 lg:px-8 lg:py-3.5 rounded font-black text-[10px] lg:text-xs uppercase tracking-widest hover:border-[#F47521] transition border border-white/20 flex items-center justify-center gap-2";
                        btn.innerHTML = `<i class="far fa-bookmark"></i> Save`;
                    } else {
                        btn.innerHTML = `<i class="far fa-bookmark text-lg"></i>`;
                        btn.classList.remove('text-[#F47521]');
                    }
                }
                await firestore.updateDoc(userRef, { library: firestore.arrayRemove(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Saved", "success");
            } else {
                profile.library.unshift(formattedAnime);
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                if (btn) {
                    if (btn.innerText.includes('SAVE')) {
                        btn.className = "bg-[#F47521] text-black px-5 py-3 lg:px-8 lg:py-3.5 rounded font-black text-[10px] lg:text-xs uppercase tracking-widest hover:bg-white transition flex items-center justify-center gap-2 shadow-lg";
                        btn.innerHTML = `<i class="fas fa-bookmark"></i> Saved`;
                    } else {
                        btn.innerHTML = `<i class="fas fa-bookmark text-lg"></i>`;
                        btn.classList.add('text-[#F47521]');
                    }
                }
                await firestore.updateDoc(userRef, { library: firestore.arrayUnion(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Saved successfully!", "success");
            }
        } catch (error) { 
            if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
        }
    };

    initSearchPage();
});
