// search.js

document.addEventListener('DOMContentLoaded', () => {
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

    // --- 1. INITIALIZATION & TRENDING ---
    const initSearchPage = async () => {
        renderHistory();
        await loadTrending();
    };

    const loadTrending = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/search?keyword=action`); 
            const json = await res.json();
            
            if (json.success && json.data) {
                trendingContainer.innerHTML = json.data.slice(0, 10).map(anime => `
                    <div onclick="window.location.href='info.html?id=${anime.id}'" class="min-w-[120px] max-w-[120px] cursor-pointer snap-start group">
                        <div class="relative w-full h-[180px] rounded-lg overflow-hidden mb-2 shadow-lg">
                            <img src="${anime.image}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            ${anime.type ? `<span class="absolute bottom-2 left-2 text-[8px] font-black uppercase bg-[#F47521] text-white px-1.5 py-0.5 rounded">${anime.type}</span>` : ''}
                        </div>
                        <h3 class="text-xs font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${anime.title}</h3>
                    </div>
                `).join('');
            }
        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-xs text-gray-500">Could not load trending.</p>`;
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
        const history = getHistory();
        document.getElementById('clear-all-history').classList.toggle('hidden', history.length === 0);
        document.getElementById('history-hint').classList.toggle('hidden', history.length === 0);
        
        historyContainer.innerHTML = history.map(term => `
            <div class="history-item relative flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 cursor-pointer hover:bg-white/10 transition select-none" data-term="${term}">
                <i class="fas fa-history text-gray-500 mr-2 text-xs"></i>
                <span class="text-xs font-semibold">${term}</span>
            </div>
        `).join('');

        document.querySelectorAll('.history-item').forEach(item => {
            let pressTimer;
            const term = item.getAttribute('data-term');
            const startPress = () => { pressTimer = setTimeout(() => { deleteHistoryItem(term); navigator.vibrate?.(50); }, 600); };
            const cancelPress = () => clearTimeout(pressTimer);
            
            item.addEventListener('mousedown', startPress);
            item.addEventListener('touchstart', startPress, {passive: true});
            item.addEventListener('mouseup', cancelPress);
            item.addEventListener('mouseleave', cancelPress);
            item.addEventListener('touchend', cancelPress);
            item.addEventListener('click', () => { cancelPress(); searchInput.value = term; handleSearchSubmit(term); });
        });
    };

    document.getElementById('clear-all-history').addEventListener('click', () => {
        localStorage.removeItem('blazex_search_history');
        renderHistory();
    });

    // --- 3. FILTER LOGIC ---
    document.getElementById('filter-btn').addEventListener('click', () => { filterModal.classList.remove('hidden'); filterModal.classList.add('flex'); });
    document.getElementById('close-filter-btn').addEventListener('click', () => { filterModal.classList.add('hidden'); filterModal.classList.remove('flex'); });
    
    document.getElementById('reset-filter-btn').addEventListener('click', () => {
        ['type', 'status', 'lang', 'genres', 'sy', 'sm', 'sd', 'ey', 'em', 'ed'].forEach(id => document.getElementById(`f-${id}`).value = '');
        document.getElementById('f-sort').value = 'default';
        activeFilters = {};
    });

    document.getElementById('apply-filter-btn').addEventListener('click', () => {
        activeFilters = {
            type: document.getElementById('f-type').value,
            status: document.getElementById('f-status').value,
            language: document.getElementById('f-lang').value,
            sort: document.getElementById('f-sort').value,
            genres: document.getElementById('f-genres').value,
            sy: document.getElementById('f-sy').value,
            sm: document.getElementById('f-sm').value,
            sd: document.getElementById('f-sd').value,
            ey: document.getElementById('f-ey').value,
            em: document.getElementById('f-em').value,
            ed: document.getElementById('f-ed').value,
        };
        filterModal.classList.add('hidden');
        if (searchInput.value.trim()) handleSearchSubmit(searchInput.value.trim());
    });

    // --- 4. INPUT HANDLING ---
    const switchView = (view) => {
        idleView.classList.add('hidden');
        typingView.classList.add('hidden');
        resultsView.classList.add('hidden');
        if (view === 'idle') idleView.classList.remove('hidden');
        if (view === 'typing') typingView.classList.remove('hidden');
        if (view === 'results') resultsView.classList.remove('hidden');
    };

    const highlightText = (text, query) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="text-[#F47521]">$1</span>');
    };

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearBtn.classList.toggle('hidden', val.length === 0);
        
        clearTimeout(typingTimer);
        if (val.length === 0) { switchView('idle'); return; }

        switchView('typing');
        suggestionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">Loading...</div>`;
        typingTimer = setTimeout(() => fetchSuggestions(val), 300); 
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        switchView('idle');
        searchInput.focus();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) handleSearchSubmit(searchInput.value.trim());
    });

    // --- 5. SUGGESTIONS (Text Only) ---
    const fetchSuggestions = async (term) => {
        const query = `query ($search: String) { Page(page: 1, perPage: 8) { media(type: ANIME, search: $search, sort: SEARCH_MATCH) { title { romaji english } } } }`;
        try {
            const res = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { search: term } })
            });
            const json = await res.json();
            const media = json.data?.Page?.media || [];

            if (media.length === 0) {
                suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">No suggestions.</div>`;
                return;
            }

            // Global click handler for suggestions
            window.handleSuggestionClick = (title) => {
                searchInput.value = title;
                handleSearchSubmit(title);
            };

            suggestionsContainer.innerHTML = media.map(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                const highlighted = highlightText(title, term);
                
                return `
                <div onclick="handleSuggestionClick('${safeTitle}')" class="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer transition border-b border-white/5 last:border-0">
                    <i class="fas fa-search text-gray-600 text-sm"></i>
                    <span class="text-sm text-gray-300 truncate">${highlighted}</span>
                </div>
            `}).join('');
        } catch (err) {
            suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">Network error.</div>`;
        }
    };

    // --- 6. ANILIST METADATA FETCHER FOR TOP CARD ---
    const getAniListMetadata = async (title) => {
        const query = `query ($search: String) { Media(type: ANIME, search: $search) { bannerImage description(asHtml: false) } }`;
        try {
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { search: title } }) });
            const json = await res.json();
            return json.data?.Media || null;
        } catch (e) { return null; }
    };

    // --- 7. FULL SEARCH & RESULTS RENDERING ---
    const handleSearchSubmit = async (term) => {
        searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        topResultCard.innerHTML = `<div class="animate-pulse w-full h-56 bg-white/5 rounded-xl"></div>`;
        resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">Loading...</div>`;

        try {
            // Build Filter Parameters
            let queryParams = new URLSearchParams();
            queryParams.append('keyword', term);
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key] && activeFilters[key] !== 'default') {
                    queryParams.append(key, activeFilters[key]);
                }
            });

            // If filters are active, use /api/filter, else use /api/search
            const endpoint = Array.from(queryParams.keys()).length > 1 ? '/api/filter' : '/api/search';
            const res = await fetch(`${API_BASE}${endpoint}?${queryParams.toString()}`);
            const json = await res.json();
            
            // Extract data array depending on the endpoint structure
            let results = [];
            if (endpoint === '/api/filter' && json.success && json.results?.data) results = json.results.data;
            else if (endpoint === '/api/search' && json.success && json.data) results = json.data;

            if (results.length === 0) {
                topResultCard.innerHTML = '';
                resultsListContainer.innerHTML = `<div class="text-center p-10"><i class="fas fa-ghost text-4xl text-gray-600 mb-3"></i><p class="text-sm text-gray-500">No matching anime found.</p></div>`;
                return;
            }

            const topAnime = results[0];
            const restAnime = results.slice(1);

            // Fetch extra metadata for the Top Card (Banner & Desc)
            const meta = await getAniListMetadata(topAnime.title);
            const backdrop = meta?.bannerImage || topAnime.image;
            const description = meta?.description || topAnime.description || 'No description available for this title.';

            const topSubEps = topAnime.tvInfo?.sub || topAnime.sub || '?';
            const topDubEps = topAnime.tvInfo?.dub || topAnime.dub || 0;
            const topShowType = topAnime.tvInfo?.showType || topAnime.type || 'TV';

            // Top Result Render with Backdrop, Play, and Save
            window.toggleSaveAnime = (id, event) => {
                event.stopPropagation();
                // Visual toggle logic (Add your actual DB save logic here)
                const icon = event.currentTarget.querySelector('i');
                if (icon.classList.contains('fa-bookmark')) {
                    icon.classList.replace('far', 'fas');
                    icon.classList.add('text-[#F47521]');
                } else {
                    icon.classList.replace('fas', 'far');
                    icon.classList.remove('text-[#F47521]');
                }
            };

            topResultCard.innerHTML = `
                <div onclick="window.location.href='info.html?id=${topAnime.id}'" class="relative overflow-hidden rounded-xl border border-white/10 cursor-pointer hover:border-[#F47521]/50 transition group shadow-2xl bg-black">
                    <div class="absolute inset-0">
                        <img src="${backdrop}" class="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700 blur-[2px]">
                        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
                    </div>
                    
                    <div class="relative flex flex-col md:flex-row gap-4 p-4 z-10">
                        <img src="${topAnime.image}" class="w-28 md:w-36 h-40 md:h-52 object-cover rounded-lg shadow-2xl">
                        
                        <div class="flex flex-col flex-1">
                            <span class="text-[9px] font-black uppercase tracking-widest text-[#F47521] mb-1"><i class="fas fa-star mr-1"></i> Top Result</span>
                            <h3 class="text-base md:text-xl font-black leading-tight text-white mb-2">${topAnime.title}</h3>
                            <p class="text-[10px] text-gray-300 line-clamp-4 mb-4 leading-relaxed">${description}</p>
                            
                            <div class="flex items-center gap-2 mt-auto">
                                <button onclick="event.stopPropagation(); window.location.href='info.html?id=${topAnime.id}'" class="bg-white text-black px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest hover:bg-[#F47521] hover:text-white transition">
                                    <i class="fas fa-play mr-1"></i> Play
                                </button>
                                <button onclick="toggleSaveAnime('${topAnime.id}', event)" class="bg-white/10 text-white px-3 py-2 rounded font-black text-[10px] uppercase hover:bg-white/20 transition">
                                    <i class="far fa-bookmark text-sm"></i>
                                </button>
                                <div class="flex gap-1 ml-auto text-[9px] font-bold">
                                    <span class="bg-white/10 text-white px-1.5 py-0.5 rounded border border-white/10">${topShowType}</span>
                                    <span class="bg-[#F47521]/20 text-[#F47521] px-1.5 py-0.5 rounded"><i class="fas fa-closed-captioning"></i> ${topSubEps}</span>
                                    ${topDubEps > 0 ? `<span class="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded"><i class="fas fa-microphone"></i> ${topDubEps}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Standard List View Render
            resultsListContainer.innerHTML = restAnime.map(anime => {
                const aSub = anime.tvInfo?.sub || anime.sub || '?';
                const aDub = anime.tvInfo?.dub || anime.dub || 0;
                const aType = anime.tvInfo?.showType || anime.type || 'TV';

                return `
                <div onclick="window.location.href='info.html?id=${anime.id}'" class="flex gap-3 items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition border border-transparent hover:border-white/10">
                    <img src="${anime.image}" class="w-14 h-20 object-cover rounded shadow">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-bold text-white truncate">${anime.title}</h4>
                        <div class="flex gap-2 mt-2 items-center text-[9px] font-black uppercase tracking-wider">
                            <span class="text-gray-400 border border-gray-600 px-1 py-0.5 rounded">${aType}</span>
                            <div class="flex gap-1 ml-auto">
                                <span class="bg-gray-800 text-gray-300 px-1 rounded flex items-center gap-1">SUB <span class="text-white">${aSub}</span></span>
                                ${aDub > 0 ? `<span class="bg-gray-800 text-gray-300 px-1 rounded flex items-center gap-1">DUB <span class="text-white">${aDub}</span></span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

        } catch (err) {
            topResultCard.innerHTML = '';
            resultsListContainer.innerHTML = `<div class="text-center p-4 text-xs text-gray-500">Something went wrong.</div>`;
        }
    };

    initSearchPage();
});
