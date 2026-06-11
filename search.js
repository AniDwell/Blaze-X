// search.js - Premium Android TV & Desktop Split-Screen Engine

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

    // --- ANDROID TV FOCUS MANAGEMENT ---
    // Maps Enter/Select button on TV remotes to click events for focused elements
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const focusedElement = document.activeElement;
            if (focusedElement && focusedElement.classList.contains('tv-focusable')) {
                e.preventDefault();
                focusedElement.click();
            }
        }
    });

    const tvFocusClasses = "tv-focusable outline-none focus:ring-4 focus:ring-[#FF5500] focus:scale-[1.02] focus:z-50 transition-all duration-300";

    // --- LAYOUT INITIALIZATION (Left/Right Splits) ---
    // Assuming idleView and resultsView wrap the content, we force the split layout here
    if(idleView) idleView.className = "flex flex-col lg:flex-row gap-8 w-full";
    if(resultsView) resultsView.className = "flex flex-col lg:flex-row gap-8 w-full";

    // --- 1. INITIALIZATION ---
    const initSearchPage = async () => {
        renderHistory();
        initTypewriterPlaceholder();
        await loadTop10Popular();
    };

    const initTypewriterPlaceholder = async () => {
        if(!searchInput) return;
        searchInput.classList.add('tv-focusable', 'focus:ring-4', 'focus:ring-[#FF5500]');
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

    // --- ANILIST TO DB MAPPING (TOP 10 - RIGHT PANEL LIST VIEW) ---
    const loadTop10Popular = async () => {
        if(!trendingContainer) return;
        trendingContainer.innerHTML = `<div class="p-10 text-center font-bold text-[#FF5500] w-full flex items-center justify-center gap-3"><i class="fas fa-circle-notch fa-spin text-2xl"></i> Loading Top 10...</div>`;
        
        try {
            const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { title { romaji english } coverImage { extraLarge } format description(asHtml: false) genres } } }`;
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const json = await res.json();
            const animeList = json.data.Page.media;

            trendingContainer.innerHTML = '';
            // Render as a vertical list for the right panel
            trendingContainer.className = "flex flex-col gap-6 w-full lg:w-2/3 ml-auto pb-10"; 

            let count = 1;
            animeList.forEach(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                const imgUrl = anime.coverImage.extraLarge;
                const format = anime.format || 'TV';
                const desc = anime.description ? anime.description.replace(/<[^>]*>?/gm, '') : 'No description available.';
                const genres = anime.genres ? anime.genres.slice(0, 3).join(', ') : 'Anime';

                trendingContainer.innerHTML += `
                <div tabindex="0" onclick="window.app.openFromAnilist('${safeTitle}')" class="${tvFocusClasses} relative group cursor-pointer rounded-2xl shadow-xl bg-[#0a0a0a] border border-white/10 hover:border-[#FF5500]/80 flex overflow-hidden w-full h-48 lg:h-56">
                    
                    <div class="flex items-center justify-center w-20 lg:w-28 bg-black border-r border-white/5 relative overflow-hidden">
                        <span style="writing-mode: vertical-rl; text-orientation: upright;" class="text-5xl lg:text-7xl font-black text-[#FF5500] [-webkit-text-stroke:2px_white] tracking-tighter drop-shadow-[0_0_15px_rgba(255,85,0,0.6)]">
                            TOP ${count}
                        </span>
                        <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-50"></div>
                    </div>

                    <div class="relative w-32 lg:w-40 h-full flex-shrink-0 overflow-hidden">
                        <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a0a]"></div>
                    </div>
                    
                    <div class="p-4 lg:p-5 flex-1 flex flex-col justify-center relative z-10 min-w-0">
                        <h4 class="text-xl lg:text-2xl font-black text-white truncate mb-1 group-hover:text-[#FF5500] transition-colors">${title}</h4>
                        <p class="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">${desc}</p>
                        
                        <div class="flex flex-wrap items-center gap-3 mt-auto">
                            <span class="bg-white/10 text-white px-2 py-0.5 rounded font-bold text-[10px] uppercase border border-white/10">${format}</span>
                            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-l border-gray-700 pl-3">${genres}</span>
                            
                            <div class="flex gap-2 ml-auto">
                                <button tabindex="0" onclick="event.stopPropagation(); window.app.shareItem('', '${safeTitle}')" class="${tvFocusClasses} bg-white/5 hover:bg-white/20 text-white w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center transition border border-white/10" title="Share">
                                    <i class="fas fa-share-alt"></i>
                                </button>
                                <button tabindex="0" onclick="event.stopPropagation(); window.app.toggleSearchLibraryClick(event, 'anilist_${count}', '${safeTitle}', '${imgUrl}')" class="${tvFocusClasses} bg-[#FF5500]/10 hover:bg-[#FF5500] text-[#FF5500] hover:text-black w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center transition border border-[#FF5500]/30" title="Save">
                                    <i class="far fa-bookmark"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
                count++;
            });
        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-xs text-red-500 w-full text-center">Could not load popular titles.</p>`;
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
                if (window.app.showCustomAlert) window.app.showCustomAlert("Title not found.", "error");
            }
        } catch (e) {
            if (window.app.showCustomAlert) window.app.showCustomAlert("Connection error.", "error");
        } finally {
            document.body.style.cursor = 'default';
        }
    };

    // --- 2. HISTORY LOGIC (LEFT PANEL) ---
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
        
        if(clearAllBtn) {
            clearAllBtn.classList.toggle('hidden', history.length === 0);
            clearAllBtn.classList.add('tv-focusable');
            clearAllBtn.tabIndex = 0;
        }
        
        // Wrap search/history block into w-1/3 for left side
        const leftPanelWrapper = document.getElementById('left-panel-wrapper') || historyContainer.parentElement;
        if(leftPanelWrapper) leftPanelWrapper.className = "w-full lg:w-1/3 flex flex-col gap-4";

        historyContainer.innerHTML = history.map(term => `
            <div tabindex="0" class="${tvFocusClasses} history-item flex items-center justify-between bg-[#111] border border-white/5 rounded-xl px-4 py-3 cursor-pointer hover:border-[#FF5500] hover:bg-[#FF5500]/5 transition select-none" data-term="${term}">
                <div class="flex items-center gap-3">
                    <i class="fas fa-history text-gray-500 text-sm"></i>
                    <span class="text-sm font-semibold text-gray-300">${term}</span>
                </div>
                <i class="fas fa-times text-gray-600 hover:text-red-500 transition px-2 py-1 z-10" onclick="event.stopPropagation(); window.app.deleteHistory('${term}')"></i>
            </div>
        `).join('');

        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => { 
                if(e.target.tagName === 'I' && e.target.classList.contains('fa-times')) return;
                const term = item.getAttribute('data-term');
                searchInput.value = term; handleSearchSubmit(term); 
            });
        });
    };
    
    window.app.deleteHistory = (term) => { deleteHistoryItem(term); };
    const clearAllBtn = document.getElementById('clear-all-history');
    if(clearAllBtn) clearAllBtn.addEventListener('click', () => { localStorage.removeItem('blazex_search_history'); renderHistory(); });

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
            if(suggestionsContainer) suggestionsContainer.innerHTML = `<div class="p-10 text-center font-bold text-[#FF5500]"><i class="fas fa-circle-notch fa-spin text-xl"></i></div>`;
            typingTimer = setTimeout(() => fetchSuggestions(val), 300); 
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) handleSearchSubmit(searchInput.value.trim());
        });
    }

    if(clearBtn) {
        clearBtn.tabIndex = 0;
        clearBtn.classList.add('tv-focusable');
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

            if (media.length === 0) { suggestionsContainer.innerHTML = `<div class="p-4 text-sm text-gray-500">No suggestions.</div>`; return; }

            window.handleSuggestionClick = (title) => { searchInput.value = title; handleSearchSubmit(title); };

            suggestionsContainer.innerHTML = media.map(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                return `
                <div tabindex="0" onclick="handleSuggestionClick('${safeTitle}')" class="${tvFocusClasses} flex items-center gap-4 p-4 hover:bg-[#111] rounded-xl cursor-pointer transition border border-transparent hover:border-white/10">
                    <i class="fas fa-search text-gray-600"></i><span class="text-base text-gray-200 font-bold">${title}</span>
                </div>`;
            }).join('');
        } catch (err) { suggestionsContainer.innerHTML = `<div class="p-4 text-sm text-gray-500">Network error.</div>`; }
    };

    // --- 6. SUBMIT SEARCH (TV SPLIT LAYOUT) ---
    const render404State = (message = "Nothing matched your search.") => {
        if(topResultCard) topResultCard.innerHTML = '';
        if(resultsListContainer) resultsListContainer.innerHTML = `<div class="text-center p-20 w-full col-span-full"><p class="text-gray-400 text-lg">${message}</p></div>`;
    };

    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        // Setup structural classes for Left (Top Match) / Right (Others)
        if(topResultCard) topResultCard.className = "w-full lg:w-2/5 flex-shrink-0 sticky top-24 h-fit";
        if(resultsListContainer) resultsListContainer.className = "w-full lg:w-3/5 flex flex-col gap-4";

        if(topResultCard) topResultCard.innerHTML = `<div class="animate-pulse w-full h-[60vh] bg-[#111] rounded-2xl"></div>`;
        if(resultsListContainer) resultsListContainer.innerHTML = `<div class="p-10 text-center text-xl font-black text-[#FF5500] w-full"><i class="fas fa-circle-notch fa-spin text-3xl block mb-4"></i> Parsing Database...</div>`;

        try {
            let queryParams = new URLSearchParams();
            queryParams.append('keyword', term);

            const res = await fetch(`${API_BASE}/api/search?${queryParams.toString()}`);
            const json = await res.json();
            
            let results = [];
            if (json.success && json.data) results = json.data;
            else if (json.success && json.results) results = json.results;

            if (!results || results.length === 0) { render404State("We couldn't find any anime matching your query."); return; }

            const topAnime = results[0];
            const restAnime = results.slice(1);

            // Fetch Top Result Meta
            let backdrop = topAnime.image || topAnime.poster;
            let description = topAnime.description || 'No description available for this title.';
            let genresText = 'Anime';
            try {
                const mRes = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query { Media(type: ANIME, search: "${topAnime.title}") { bannerImage description(asHtml: false) genres } }` }) });
                const mJson = await mRes.json();
                if(mJson.data?.Media) {
                    backdrop = mJson.data.Media.bannerImage || backdrop;
                    description = mJson.data.Media.description ? mJson.data.Media.description.replace(/<[^>]*>?/gm, '') : description;
                    if(mJson.data.Media.genres) genresText = mJson.data.Media.genres.slice(0,3).join(', ');
                }
            } catch(e) {}

            const topSubEps = topAnime.tvInfo?.sub || topAnime.sub || '?';
            const topDubEps = topAnime.tvInfo?.dub || topAnime.dub || 0;
            const topImg = topAnime.image || topAnime.poster;
            const safeTitleTop = topAnime.title.replace(/'/g, "\\'");

            // Top Match (LEFT PANEL) - Large Vertical Poster style
            if(topResultCard) {
                topResultCard.innerHTML = `
                <div tabindex="0" onclick="window.location.href='info.html?id=${topAnime.id}'" class="${tvFocusClasses} relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-[#050505] group flex flex-col h-[65vh] cursor-pointer">
                    <div class="absolute inset-0 z-0">
                        <img src="${topImg}" class="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000 blur-sm">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>
                    </div>
                    
                    <div class="relative p-8 flex flex-col h-full z-10 justify-end">
                        <div class="mb-auto self-start">
                            <span class="bg-[#FF5500] text-black px-3 py-1 rounded font-black text-[11px] uppercase tracking-widest shadow-[0_0_15px_rgba(255,85,0,0.6)]"><i class="fas fa-crown mr-1"></i> Top Match</span>
                        </div>
                        
                        <img src="${topAnime.image || topAnime.poster}" class="w-40 h-56 object-cover rounded-xl shadow-2xl border border-white/10 mb-6 hidden lg:block self-center group-hover:-translate-y-2 transition-transform duration-500">
                        
                        <h3 class="text-3xl lg:text-4xl font-black leading-tight text-white mb-3 group-hover:text-[#FF5500] transition-colors">${topAnime.title}</h3>
                        
                        <div class="flex gap-2 mb-4 text-[10px] font-black tracking-wide">
                            <span class="bg-white/10 px-2 py-1 rounded border border-white/20">${topAnime.type || 'TV'}</span>
                            <span class="bg-[#FF5500]/20 text-[#FF5500] px-2 py-1 rounded">SUB ${topSubEps}</span>
                            ${topDubEps > 0 ? `<span class="bg-purple-500/20 text-purple-400 px-2 py-1 rounded">DUB ${topDubEps}</span>` : ''}
                        </div>
                        
                        <p class="text-sm text-gray-300 line-clamp-4 mb-6 leading-relaxed">${description}</p>
                        
                        <div class="flex items-center gap-3">
                            <button tabindex="0" onclick="event.stopPropagation(); window.location.href='info.html?id=${topAnime.id}'" class="${tvFocusClasses} flex-1 bg-white text-black py-3 rounded-lg font-black text-sm uppercase tracking-widest hover:bg-[#FF5500] hover:text-white transition shadow-lg flex justify-center items-center gap-2"><i class="fas fa-play"></i> Watch Now</button>
                            <button tabindex="0" onclick="event.stopPropagation(); window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${safeTitleTop}', '${topImg}')" class="${tvFocusClasses} bg-[#111] text-white w-12 h-12 rounded-lg font-black text-lg hover:border-[#FF5500] transition border border-white/20 flex justify-center items-center"><i class="far fa-bookmark"></i></button>
                        </div>
                    </div>
                </div>`;
            }

            // Rest Results (RIGHT PANEL) - List View
            if(resultsListContainer) {
                resultsListContainer.innerHTML = restAnime.map((anime, index) => {
                    const aSub = anime.tvInfo?.sub || anime.sub || '?';
                    const aDub = anime.tvInfo?.dub || anime.dub || 0;
                    const safeTitle = anime.title.replace(/'/g, "\\'");
                    
                    return `
                    <div tabindex="0" onclick="window.location.href='info.html?id=${anime.id}'" class="${tvFocusClasses} flex items-center bg-[#111] border border-white/5 rounded-xl overflow-hidden hover:border-[#FF5500]/50 hover:bg-[#1a1a1a] transition-all duration-300 cursor-pointer h-32 group">
                        
                        <div class="relative w-24 h-full flex-shrink-0">
                            <img src="${anime.image || anime.poster}" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <i class="fas fa-play text-white text-xl"></i>
                            </div>
                        </div>
                        
                        <div class="p-4 flex flex-col flex-1 min-w-0">
                            <h4 class="text-base lg:text-lg font-bold text-white truncate group-hover:text-[#FF5500] transition-colors mb-1">${anime.title}</h4>
                            <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-auto">${anime.type || 'TV'}</p>
                            
                            <div class="flex items-center justify-between mt-2">
                                <div class="flex gap-2 text-[9px] font-black">
                                    <span class="bg-[#FF5500]/20 text-[#FF5500] px-1.5 py-0.5 rounded">SUB ${aSub}</span>
                                    ${aDub > 0 ? `<span class="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">DUB ${aDub}</span>` : ''}
                                </div>
                                
                                <div class="flex gap-2">
                                    <button tabindex="0" onclick="event.stopPropagation(); window.app.shareItem('${anime.id}', '${safeTitle}')" class="${tvFocusClasses} text-gray-400 hover:text-white px-2 py-1"><i class="fas fa-share-alt"></i></button>
                                    <button tabindex="0" onclick="event.stopPropagation(); window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${anime.image || anime.poster}')" class="${tvFocusClasses} text-gray-400 hover:text-[#FF5500] px-2 py-1"><i class="far fa-bookmark"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        } catch (err) {
            render404State("Network error occurred.");
        }
    };

    // --- SHARE & LIBRARY LOGIC ---
    window.app.shareItem = (id, title) => {
        const url = id ? `${window.location.origin}/info.html?id=${id}` : window.location.href;
        if (typeof window.openShareModal === 'function') window.openShareModal({ id, title, url });
        else document.dispatchEvent(new CustomEvent('openShareApp', { detail: { id, title, url } }));
    };

    window.app.toggleSearchLibraryClick = async (event, id, title, img) => {
        event.stopPropagation(); 
        const btn = event.currentTarget;
        const icon = btn.querySelector('i');
        
        // Visual toggle simulation for Save button
        if (icon.classList.contains('far')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            btn.classList.add('text-[#FF5500]', 'border-[#FF5500]');
            if (window.app.showCustomAlert) window.app.showCustomAlert("Saved successfully!", "success");
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            btn.classList.remove('text-[#FF5500]', 'border-[#FF5500]');
            if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Saved", "success");
        }
    };

    initSearchPage();
});
