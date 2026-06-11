// search.js - Full Featured Search & Filter Engine

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

    // --- ANILIST TO DB MAPPING (TOP 10 DYNAMIC) ---
    const loadTop10Popular = async () => {
        if(!trendingContainer) return;
        trendingContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-500 w-full col-span-full"><i class="fas fa-circle-notch fa-spin text-[#F47521] text-lg mb-2 block"></i> Loading Trending...</div>`;
        
        try {
            // Load instantly from AniList
            const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { title { romaji english } coverImage { extraLarge } format episodes } } }`;
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const json = await res.json();
            const animeList = json.data.Page.media;

            // Premium Responsive Grid
            trendingContainer.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-4 w-full"; 
            trendingContainer.innerHTML = animeList.map((anime, index) => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                
                return `
                <div onclick="handleTrendingClick(event, '${safeTitle}')" class="relative group cursor-pointer rounded-xl overflow-hidden shadow-lg border border-white/5 hover:border-[#F47521] transition-all duration-300 transform md:hover:-translate-y-1 bg-[#111]">
                    <div class="absolute top-0 left-0 bg-[#F47521] text-black font-black text-[10px] px-2.5 py-1 rounded-br-xl z-10 shadow-md">TOP ${index + 1}</div>
                    <img src="${anime.coverImage.extraLarge}" class="w-full h-48 sm:h-56 md:h-64 object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-3 z-10">
                        <h4 class="text-xs sm:text-sm font-bold text-white line-clamp-2 group-hover:text-[#F47521] transition-colors">${title}</h4>
                        <div class="flex gap-2 mt-1 items-center text-[9px] font-black uppercase tracking-wider text-gray-300">
                            <span class="bg-black/50 px-1 rounded border border-white/10">${anime.format || 'TV'}</span>
                            ${anime.episodes ? `<span class="bg-white/10 px-1 rounded">${anime.episodes} EPS</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center opacity-0 pointer-events-none transition-opacity z-20" id="overlay-${index}">
                         <i class="fas fa-circle-notch fa-spin text-3xl text-[#F47521] mb-2"></i>
                         <span class="text-[10px] font-bold text-white status-text">Locating...</span>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-xs text-red-500 col-span-full">Could not load popular titles.</p>`;
        }
    };

    // Global Click Handler for Trending Cards
    window.handleTrendingClick = async (event, title) => {
        const card = event.currentTarget;
        const overlay = card.querySelector('div[id^="overlay-"]');
        const statusText = overlay.querySelector('.status-text');
        
        overlay.classList.remove('opacity-0', 'pointer-events-none'); // Show loading
        
        try {
            // Find match in your custom API
            const searchRes = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(title)}`);
            const searchJson = await searchRes.json();
            
            if (searchJson.success && searchJson.results?.length > 0) {
                window.location.href = `info.html?id=${searchJson.results[0].id}`;
            } else {
                statusText.innerText = "Not Found!";
                statusText.classList.replace('text-white', 'text-red-500');
                overlay.querySelector('i').className = "fas fa-times-circle text-3xl text-red-500 mb-2";
                setTimeout(() => { overlay.classList.add('opacity-0', 'pointer-events-none'); }, 1500);
            }
        } catch(e) {
            statusText.innerText = "Error!";
            setTimeout(() => { overlay.classList.add('opacity-0', 'pointer-events-none'); }, 1500);
        }
    };

    // Global Share Handler (Connects to share.js if available)
    window.handleShareClick = (event, id, title) => {
        event.stopPropagation();
        const url = `${window.location.origin}/info.html?id=${id}`;
        
        // If share.js has exposed a global open function, call it:
        if (typeof window.openShareModal === 'function') {
            window.openShareModal({ id, title, url });
        } 
        // Native Web Share Fallback
        else if (navigator.share) {
            navigator.share({ title: `Watch ${title}`, url: url }).catch(console.error);
        } else {
            // Basic Copy to clipboard Fallback
            navigator.clipboard.writeText(url);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Link copied to clipboard!", "success");
            else alert("Link copied to clipboard!");
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

    // --- 6. SUBMIT SEARCH ---
    const render404State = (message = "Nothing matched your search.") => {
        if(topResultCard) topResultCard.innerHTML = '';
        if(resultsListContainer) resultsListContainer.innerHTML = ''; 
        if(window.BlazeX && window.BlazeX.show404) {
            window.BlazeX.show404('results-list-container', message);
        } else if(resultsListContainer) {
            resultsListContainer.innerHTML = `<div class="text-center p-10"><p class="text-gray-500 text-sm">${message}</p></div>`;
        }
    };

    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        if(topResultCard) topResultCard.innerHTML = `<div class="animate-pulse w-full h-56 bg-[#111] rounded-xl"></div>`;
        if(resultsListContainer) {
            resultsListContainer.className = "flex justify-center items-center p-10 w-full";
            resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-[#F47521]"><i class="fas fa-circle-notch fa-spin text-lg block mb-2"></i> Parsing Database...</div>`;
        }

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

            if (results.length === 0) { render404State("We couldn't find any anime matching your query or filters."); return; }

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
            const topSafeTitle = topAnime.title.replace(/'/g, "\\'");

            // Library Button state
            const profile = window.app.state?.activeProfile || null;
            let isTopAdded = false;
            if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
                isTopAdded = profile.library.some(item => item.id === topAnime.id);
            }

            const libraryBtnHtml = isTopAdded 
                ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}')" class="bg-[#F47521] text-black px-3 py-2 rounded font-black text-[10px] md:text-xs uppercase hover:bg-white transition border border-[#F47521] flex items-center gap-2"><i class="fas fa-check"></i> Saved</button>`
                : `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}')" class="bg-[#111] text-white px-3 py-2 rounded font-black text-[10px] md:text-xs uppercase hover:border-[#F47521] transition border border-white/10 flex items-center gap-2"><i class="fas fa-plus"></i> Save</button>`;

            // PREMIUM TOP RESULT CARD
            if(topResultCard) {
                topResultCard.innerHTML = `
                <div onclick="window.location.href='info.html?id=${topAnime.id}'" class="relative overflow-hidden rounded-xl border border-white/10 cursor-pointer hover:border-[#F47521] transition-all group shadow-2xl bg-[#0a0a0a]">
                    <div class="absolute inset-0">
                        <img src="${backdrop}" class="w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700 blur-[2px]">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent"></div>
                    </div>
                    <div class="relative flex flex-col sm:flex-row gap-5 p-4 sm:p-6 z-10">
                        <img src="${topImg}" class="w-28 sm:w-40 md:w-48 h-40 sm:h-56 md:h-64 object-cover rounded-xl shadow-2xl border border-white/10 z-10 shrink-0">
                        <div class="flex flex-col flex-1 justify-center">
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#F47521] mb-1.5"><i class="fas fa-star mr-1"></i> Top Match</span>
                            <h3 class="text-lg sm:text-xl md:text-3xl font-black leading-tight text-white mb-2 md:mb-3 group-hover:text-[#F47521] transition-colors">${topAnime.title}</h3>
                            <p class="text-[11px] sm:text-xs text-gray-400 line-clamp-3 sm:line-clamp-4 mb-4 leading-relaxed max-w-3xl">${description}</p>
                            
                            <div class="flex flex-wrap items-center gap-2 md:gap-3 mt-auto">
                                <button onclick="event.stopPropagation(); window.location.href='info.html?id=${topAnime.id}'" class="bg-white text-black px-4 md:px-6 py-2 md:py-2.5 rounded font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-[#F47521] hover:text-white transition shadow-lg"><i class="fas fa-play mr-1.5"></i> Play</button>
                                ${libraryBtnHtml}
                                <button onclick="handleShareClick(event, '${topAnime.id}', '${topSafeTitle}')" class="bg-[#111]/80 text-gray-300 px-3 md:px-4 py-2 md:py-2.5 rounded font-black text-[10px] md:text-xs uppercase hover:text-white hover:bg-white/10 transition border border-white/10 flex items-center gap-2 backdrop-blur-sm"><i class="fas fa-share-alt"></i> Share</button>
                                
                                <div class="flex gap-1.5 ml-auto text-[9px] md:text-[10px] font-bold mt-2 sm:mt-0 w-full sm:w-auto justify-end">
                                    <span class="bg-[#111] text-white px-2 py-1 rounded border border-white/10">${topAnime.type || 'TV'}</span>
                                    <span class="bg-[#F47521]/10 border border-[#F47521]/30 text-[#F47521] px-2 py-1 rounded">SUB ${topSubEps}</span>
                                    ${topDubEps > 0 ? `<span class="bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-1 rounded">DUB ${topDubEps}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }

            // PREMIUM RESPONSIVE SEARCH RESULTS LIST
            if(resultsListContainer) {
                resultsListContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6 w-full";
                
                resultsListContainer.innerHTML = restAnime.map(anime => {
                    const aSub = anime.tvInfo?.sub || anime.sub || '?';
                    const aDub = anime.tvInfo?.dub || anime.dub || 0;
                    const safeTitle = anime.title.replace(/'/g, "\\'");
                    
                    let isAdded = false;
                    if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
                        isAdded = profile.library.some(item => item.id === anime.id);
                    }
                    
                    const saveIconClass = isAdded ? 'fas fa-check text-[#F47521]' : 'fas fa-plus text-gray-400 group-hover/btn:text-white';
                    const saveText = isAdded ? 'Saved' : 'Save';

                    return `
                    <div class="flex flex-col bg-[#111] rounded-xl border border-white/5 hover:border-[#F47521] transition-all shadow-md overflow-hidden group hover:-translate-y-1">
                        <div onclick="window.location.href='info.html?id=${anime.id}'" class="flex gap-3 p-3 flex-1 cursor-pointer">
                            <div class="relative w-20 sm:w-24 h-28 sm:h-36 shrink-0 overflow-hidden rounded-lg shadow-sm">
                                <img src="${anime.image || anime.poster}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                                <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                            </div>
                            <div class="flex flex-col flex-1 min-w-0 py-1">
                                <h4 class="text-sm sm:text-base font-bold text-white line-clamp-2 leading-tight group-hover:text-[#F47521] transition-colors">${anime.title}</h4>
                                <div class="flex flex-wrap gap-1.5 mt-2 items-center text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                                    <span class="text-gray-400 border border-gray-600 px-1.5 py-0.5 rounded bg-black/50">${anime.type || 'TV'}</span>
                                    <span class="text-gray-300 bg-black/50 border border-white/5 px-1.5 py-0.5 rounded shadow-sm">SUB <span class="text-white">${aSub}</span></span>
                                    ${aDub > 0 ? `<span class="text-gray-300 bg-black/50 border border-white/5 px-1.5 py-0.5 rounded shadow-sm">DUB <span class="text-white">${aDub}</span></span>` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-black/40 border-t border-white/5 flex divide-x divide-white/5">
                            <button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${anime.image || anime.poster}')" class="flex-1 py-2.5 text-[10px] sm:text-xs uppercase font-bold tracking-wider text-gray-400 hover:text-white hover:bg-white/5 transition group/btn flex items-center justify-center gap-2">
                                <i class="${saveIconClass} transition-colors"></i> <span class="btn-text">${saveText}</span>
                            </button>
                            <button onclick="handleShareClick(event, '${anime.id}', '${safeTitle}')" class="flex-1 py-2.5 text-[10px] sm:text-xs uppercase font-bold tracking-wider text-gray-400 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-2">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                    </div>`;
                }).join('');
            }
        } catch (err) {
            render404State("Network error occurred while communicating with the database.");
        }
    };

    // --- LIBRARY BUTTON ACTION ---
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
        const btnIcon = btn.querySelector('i');
        const btnText = btn.querySelector('.btn-text'); // For the small cards

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userRef = firestore.doc(window.app.db, "users", profile.uid);

            if (isCurrentlyAdded) {
                profile.library.splice(existingItemIndex, 1); 
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                
                // Update specific UI variants dynamically
                if (btn.classList.contains('flex-1')) { // It's a small grid card
                    btnIcon.className = 'fas fa-plus text-gray-400 group-hover/btn:text-white transition-colors';
                    if (btnText) btnText.innerText = 'Save';
                } else { // It's the Top Result card
                    btn.className = "bg-[#111] text-white px-3 py-2 rounded font-black text-[10px] md:text-xs uppercase hover:border-[#F47521] transition border border-white/10 flex items-center gap-2";
                    btn.innerHTML = `<i class="fas fa-plus"></i> Save`;
                }

                await firestore.updateDoc(userRef, { library: firestore.arrayRemove(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
            } else {
                profile.library.unshift(formattedAnime);
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                
                if (btn.classList.contains('flex-1')) { // It's a small grid card
                    btnIcon.className = 'fas fa-check text-[#F47521] transition-colors';
                    if (btnText) btnText.innerText = 'Saved';
                } else { // It's the Top Result card
                    btn.className = "bg-[#F47521] text-black px-3 py-2 rounded font-black text-[10px] md:text-xs uppercase hover:bg-white transition border border-[#F47521] flex items-center gap-2";
                    btn.innerHTML = `<i class="fas fa-check"></i> Saved`;
                }

                await firestore.updateDoc(userRef, { library: firestore.arrayUnion(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
            }
        } catch (error) { 
            if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
        }
    };

    initSearchPage();
});
