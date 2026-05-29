// search.js

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const idleView = document.getElementById('idle-view');
    const typingView = document.getElementById('typing-view');
    const resultsView = document.getElementById('results-view');
    
    // Filter Modal Elements
    const filterModal = document.getElementById('filter-modal');
    const openFilterBtn = document.getElementById('open-filter-btn');
    const closeFilterBtn = document.getElementById('close-filter-btn');
    const filterForm = document.getElementById('filter-form');
    const resetFilterBtn = document.getElementById('reset-filter-btn');
    
    // Containers
    const historyContainer = document.getElementById('history-container');
    const trendingContainer = document.getElementById('trending-container');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const topResultCard = document.getElementById('top-result-card');
    const resultsListContainer = document.getElementById('results-list-container');
    
    // API
    const API_BASE = 'https://anikoto-api-xi.vercel.app';
    const ANILIST_URL = 'https://graphql.anilist.co';
    let typingTimer;
    let currentFilters = {};

    // --- 1. INITIALIZATION ---
    const initSearchPage = async () => {
        renderHistory();
        await loadTrending();
    };

    const loadTrending = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/filter?sort=default`); 
            const json = await res.json();
            if (json.success && json.results.data) {
                const trendingData = json.results.data.slice(0, 10);
                trendingContainer.innerHTML = trendingData.map(anime => `
                    <div onclick="window.location.href='info.html?id=${anime.id}'" class="min-w-[120px] max-w-[120px] cursor-pointer snap-start group">
                        <div class="relative w-full h-[180px] rounded-lg overflow-hidden mb-2 shadow-lg">
                            <img src="${anime.poster}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            ${anime.tvInfo?.showType ? `<span class="absolute bottom-2 left-2 text-[8px] font-black uppercase bg-[#F47521] text-white px-1.5 py-0.5 rounded">${anime.tvInfo.showType}</span>` : ''}
                        </div>
                        <h3 class="text-[11px] font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${anime.title}</h3>
                    </div>
                `).join('');
            }
        } catch (e) {
            trendingContainer.innerHTML = `<p class="text-xs text-gray-500">Could not load trending.</p>`;
        }
    };

    // --- 2. FILTER MODAL LOGIC ---
    openFilterBtn.addEventListener('click', () => {
        filterModal.classList.remove('hidden');
        filterModal.classList.add('flex');
    });
    
    const closeFilter = () => {
        filterModal.classList.add('hidden');
        filterModal.classList.remove('flex');
    };
    closeFilterBtn.addEventListener('click', closeFilter);
    filterModal.addEventListener('click', (e) => { if(e.target === filterModal) closeFilter(); });

    resetFilterBtn.addEventListener('click', () => {
        filterForm.reset();
        currentFilters = {};
    });

    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(filterForm);
        currentFilters = {};
        for (let [key, value] of formData.entries()) {
            if (value.trim() !== '') currentFilters[key] = value.trim();
        }
        closeFilter();
        if (searchInput.value.trim() !== '' || Object.keys(currentFilters).length > 0) {
            handleSearchSubmit(searchInput.value.trim());
        }
    });

    // --- 3. SEARCH HISTORY ---
    const getHistory = () => JSON.parse(localStorage.getItem('blazex_search_history')) || [];
    const saveHistory = (term) => {
        if (!term) return;
        let history = getHistory().filter(t => t.toLowerCase() !== term.toLowerCase()); 
        history.unshift(term);
        if (history.length > 10) history.pop();
        localStorage.setItem('blazex_search_history', JSON.stringify(history));
        renderHistory();
    };
    const deleteHistoryItem = (term) => {
        let history = getHistory().filter(t => t !== term);
        localStorage.setItem('blazex_search_history', JSON.stringify(history));
        renderHistory();
    };

    const renderHistory = () => {
        const history = getHistory();
        document.getElementById('clear-all-history').classList.toggle('hidden', history.length === 0);
        document.getElementById('history-hint').classList.toggle('hidden', history.length === 0);
        
        historyContainer.innerHTML = history.map(term => `
            <div class="history-item relative flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1.5 cursor-pointer hover:bg-white/10 transition select-none" data-term="${term}">
                <i class="fas fa-history text-gray-500 mr-2 text-[10px]"></i>
                <span class="text-[11px] font-bold text-gray-300">${term}</span>
            </div>
        `).join('');

        document.querySelectorAll('.history-item').forEach(item => {
            let pressTimer;
            const term = item.getAttribute('data-term');
            const startPress = () => { pressTimer = setTimeout(() => { deleteHistoryItem(term); navigator.vibrate?.(50); }, 600); };
            const cancelPress = () => clearTimeout(pressTimer);
            const executeClick = () => { cancelPress(); searchInput.value = term; handleSearchSubmit(term); };

            item.addEventListener('mousedown', startPress);
            item.addEventListener('touchstart', startPress, {passive: true});
            item.addEventListener('mouseup', cancelPress);
            item.addEventListener('mouseleave', cancelPress);
            item.addEventListener('touchend', cancelPress);
            item.addEventListener('click', executeClick); 
        });
    };

    document.getElementById('clear-all-history').addEventListener('click', () => {
        localStorage.removeItem('blazex_search_history');
        renderHistory();
    });

    // --- 4. VIEW SWITCHING & INPUT ---
    const switchView = (view) => {
        idleView.classList.add('hidden');
        typingView.classList.add('hidden');
        resultsView.classList.add('hidden');
        if (view === 'idle') idleView.classList.remove('hidden');
        if (view === 'typing') typingView.classList.remove('hidden');
        if (view === 'results') resultsView.classList.remove('hidden');
    };

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        clearBtn.classList.toggle('hidden', val.length === 0);
        
        clearTimeout(typingTimer);
        if (val.trim().length === 0) { switchView('idle'); return; }

        switchView('typing');
        suggestionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[#F47521]"><i class="fas fa-circle-notch fa-spin"></i> Searching...</div>`;
        typingTimer = setTimeout(() => fetchSuggestions(val.trim()), 300); 
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        switchView('idle');
        searchInput.focus();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearchSubmit(searchInput.value.trim());
    });

    // --- TEXT HIGHLIGHTER ---
    const highlightMatch = (text, query) => {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="text-[#F47521]">$1</span>');
    };

    // --- 5. SUGGESTIONS (Text Only + Highlight) ---
    const fetchSuggestions = async (term) => {
        const query = `
            query ($search: String) {
                Page(page: 1, perPage: 6) {
                    media(type: ANIME, search: $search, sort: SEARCH_MATCH) { title { english romaji } }
                }
            }
        `;
        try {
            const res = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { search: term } })
            });
            const json = await res.json();
            const media = json.data?.Page?.media || [];

            if (media.length === 0) {
                suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500 text-center">No matches found.</div>`;
                return;
            }

            window.handleSuggestionClick = (title) => {
                searchInput.value = title;
                handleSearchSubmit(title);
            };

            suggestionsContainer.innerHTML = media.map(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                const highlighted = highlightMatch(title, term);
                return `
                <div onclick="handleSuggestionClick('${safeTitle}')" class="flex items-center p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition">
                    <i class="fas fa-search text-gray-600 text-[10px] mr-3"></i>
                    <span class="text-sm font-semibold text-gray-200 truncate">${highlighted}</span>
                </div>
            `}).join('');
        } catch (err) {
            suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-red-500 text-center">Connection error.</div>`;
        }
    };

    // --- FETCH ANILIST BANNER HELPER ---
    const fetchAniListBanner = async (title) => {
        const query = `query($search: String){ Media(search: $search, type: ANIME){ bannerImage } }`;
        try {
            const res = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query, variables: {search: title}})
            });
            const json = await res.json();
            return json.data?.Media?.bannerImage || null;
        } catch(e) { return null; }
    };

    // --- 6. FULL SEARCH SUBMIT ---
    const handleSearchSubmit = async (term) => {
        searchInput.blur();
        if(term) saveHistory(term);
        switchView('results');
        
        topResultCard.innerHTML = `<div class="animate-pulse w-full h-56 bg-white/5 rounded-2xl"></div>`;
        resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-[#F47521]"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

        try {
            // Build Query string with Filters
            const params = new URLSearchParams(currentFilters);
            if (term) params.append('keyword', term);
            
            // Using /api/filter because it returns rich data (descriptions)
            const res = await fetch(`${API_BASE}/api/filter?${params.toString()}`);
            const json = await res.json();
            
            if (!json.success || !json.results.data || json.results.data.length === 0) {
                topResultCard.innerHTML = '';
                resultsListContainer.innerHTML = `<div class="text-center p-10"><i class="fas fa-ghost text-4xl text-gray-800 mb-3"></i><p class="text-xs text-gray-500">No results found.</p></div>`;
                return;
            }

            const results = json.results.data;
            const topAnime = results[0];
            const restAnime = results.slice(1);

            // Fetch High-Quality Banner for Top Result
            const bannerUrl = await fetchAniListBanner(topAnime.title);
            const bgImage = bannerUrl ? bannerUrl : topAnime.poster;

            const topSub = topAnime.tvInfo?.sub || '?';
            const topDub = topAnime.tvInfo?.dub || 0;
            const topShowType = topAnime.tvInfo?.showType || 'Anime';
            const desc = topAnime.description || 'No description available for this series.';

            // --- CINEMATIC TOP CARD ---
            topResultCard.innerHTML = `
                <div class="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                    <div class="absolute inset-0 w-full h-full">
                        <img src="${bgImage}" class="w-full h-full object-cover opacity-40 blur-[2px] group-hover:scale-105 transition-transform duration-700">
                    </div>
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
                    
                    <div class="relative z-10 p-4 md:p-6 flex flex-col h-full">
                        <div class="flex gap-4">
                            <img src="${topAnime.poster}" class="w-24 h-36 object-cover rounded-lg shadow-lg border border-white/10">
                            <div class="flex flex-col flex-1">
                                <span class="text-[9px] font-black uppercase tracking-widest text-[#F47521] mb-1">Top Result</span>
                                <h3 class="text-lg font-black leading-tight text-white mb-1 line-clamp-2">${topAnime.title}</h3>
                                <p class="text-[10px] text-gray-300 line-clamp-3 mb-2 leading-relaxed">${desc}</p>
                                
                                <div class="flex items-center gap-2 text-[9px] font-bold mt-auto pb-1">
                                    <span class="bg-white/10 text-gray-300 px-1.5 py-0.5 rounded uppercase">${topShowType}</span>
                                    <span class="bg-[#F47521]/20 text-[#F47521] px-1.5 py-0.5 rounded border border-[#F47521]/30"><i class="fas fa-closed-captioning"></i> ${topSub}</span>
                                    ${topDub > 0 ? `<span class="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30"><i class="fas fa-microphone"></i> ${topDub}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex gap-3 mt-4 pt-4 border-t border-white/10">
                            <button onclick="window.location.href='info.html?id=${topAnime.id}'" class="flex-1 bg-white text-black font-black uppercase tracking-widest text-[10px] py-2.5 rounded-lg hover:bg-[#F47521] hover:text-white transition shadow-lg">
                                <i class="fas fa-play mr-1"></i> Watch Now
                            </button>
                            <button onclick="alert('Added to Library!')" class="bg-white/10 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-white/20 transition border border-white/10">
                                <i class="fas fa-bookmark"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // --- LIST VIEW ---
            resultsListContainer.innerHTML = restAnime.map(anime => {
                const aSub = anime.tvInfo?.sub || '?';
                const aDub = anime.tvInfo?.dub || 0;
                const aType = anime.tvInfo?.showType || 'TV';

                return `
                <div onclick="window.location.href='info.html?id=${anime.id}'" class="flex gap-3 items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition border border-transparent hover:border-white/10">
                    <img src="${anime.poster}" class="w-12 h-16 object-cover rounded shadow">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-bold text-gray-200 truncate">${anime.title}</h4>
                        <div class="flex gap-2 mt-1.5 items-center text-[9px] font-black uppercase tracking-wider">
                            <span class="text-gray-500 border border-gray-700 px-1 py-0.5 rounded">${aType}</span>
                            <div class="flex gap-1 ml-auto">
                                <span class="text-gray-400 px-1 rounded flex items-center gap-1"><i class="fas fa-closed-captioning"></i> ${aSub}</span>
                                ${aDub > 0 ? `<span class="text-gray-400 px-1 rounded flex items-center gap-1"><i class="fas fa-microphone"></i> ${aDub}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

        } catch (err) {
            topResultCard.innerHTML = '';
            resultsListContainer.innerHTML = `<div class="text-center p-4 text-xs text-red-500">Could not retrieve search results.</div>`;
        }
    };

    initSearchPage();
});
