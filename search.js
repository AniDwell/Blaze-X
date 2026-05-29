// search.js

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const idleView = document.getElementById('idle-view');
    const typingView = document.getElementById('typing-view');
    const resultsView = document.getElementById('results-view');
    
    // Containers
    const historyContainer = document.getElementById('history-container');
    const trendingContainer = document.getElementById('trending-container');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const topResultCard = document.getElementById('top-result-card');
    const resultsListContainer = document.getElementById('results-list-container');
    
    // API Configuration
    const API_BASE = 'https://anikoto-api-xi.vercel.app';
    let typingTimer;

    // --- 1. INITIALIZATION & TRENDING ---
    const initSearchPage = async () => {
        renderHistory();
        await loadTrending();
    };

    // We use /api/filter for the home screen trending list
    const loadTrending = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/filter`);
            const json = await res.json();
            
            if (json.success && json.results.data) {
                const trendingData = json.results.data.slice(0, 10); // Take top 10
                
                trendingContainer.innerHTML = trendingData.map(anime => `
                    <div onclick="window.location.href='play.html?anime=${anime.id}'" class="min-w-[120px] max-w-[120px] cursor-pointer snap-start group">
                        <div class="relative w-full h-[180px] rounded-lg overflow-hidden mb-2 shadow-lg">
                            <img src="${anime.poster}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${anime.title}">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            ${anime.tvInfo?.showType ? `<span class="absolute bottom-2 left-2 text-[8px] font-black uppercase bg-[#F47521] text-white px-1.5 py-0.5 rounded">${anime.tvInfo.showType}</span>` : ''}
                        </div>
                        <h3 class="text-xs font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${anime.title}</h3>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error("Trending Fetch Error:", error);
            trendingContainer.innerHTML = `<p class="text-xs text-gray-500">Failed to load trending data.</p>`;
        }
    };

    // --- 2. SEARCH HISTORY & LONG PRESS LOGIC ---
    const getHistory = () => JSON.parse(localStorage.getItem('blazex_search_history')) || [];
    const saveHistory = (term) => {
        let history = getHistory();
        history = history.filter(t => t.toLowerCase() !== term.toLowerCase()); 
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
            <div class="history-item relative flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 cursor-pointer hover:bg-white/10 transition select-none" data-term="${term}">
                <i class="fas fa-history text-gray-500 mr-2 text-xs"></i>
                <span class="text-xs font-semibold">${term}</span>
                <i class="fas fa-location-arrow ml-3 text-gray-500 text-[10px] transform rotate-45"></i>
            </div>
        `).join('');

        // Long Press Logic
        document.querySelectorAll('.history-item').forEach(item => {
            let pressTimer;
            const term = item.getAttribute('data-term');

            const startPress = () => { pressTimer = setTimeout(() => { deleteHistoryItem(term); navigator.vibrate?.(50); }, 600); };
            const cancelPress = () => clearTimeout(pressTimer);
            const executeClick = () => {
                cancelPress();
                searchInput.value = term;
                handleSearchSubmit(term);
            };

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

    // --- 3. INPUT HANDLING & VIEW SWITCHING ---
    const switchView = (view) => {
        idleView.classList.add('hidden');
        typingView.classList.add('hidden');
        resultsView.classList.add('hidden');
        if (view === 'idle') idleView.classList.remove('hidden');
        if (view === 'typing') typingView.classList.remove('hidden');
        if (view === 'results') resultsView.classList.remove('hidden');
    };

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearBtn.classList.toggle('hidden', val.length === 0);
        
        clearTimeout(typingTimer);
        if (val.length === 0) {
            switchView('idle');
            return;
        }

        switchView('typing');
        suggestionsContainer.innerHTML = `<div class="p-4 text-center text-xs text-[#F47521]"><i class="fas fa-circle-notch fa-spin"></i> Finding matches...</div>`;
        
        typingTimer = setTimeout(() => fetchSuggestions(val), 400); 
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        switchView('idle');
        searchInput.focus();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const val = searchInput.value.trim();
            if (val) handleSearchSubmit(val);
        }
    });

    // --- 4. FETCH SUGGESTIONS (Uses /api/search/suggest) ---
    const fetchSuggestions = async (term) => {
        try {
            const res = await fetch(`${API_BASE}/api/search/suggest?keyword=${encodeURIComponent(term)}`);
            const json = await res.json();
            
            if (!json.success || !json.results || json.results.length === 0) {
                suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">No suggestions found.</div>`;
                return;
            }

            // Render top 6 suggestions
            suggestionsContainer.innerHTML = json.results.slice(0, 6).map(anime => `
                <div onclick="document.getElementById('search-input').value='${anime.title.replace(/'/g, "\\'")}'; handleSearchSubmit('${anime.title.replace(/'/g, "\\'")}')" 
                     class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition">
                    <img src="${anime.poster}" class="w-8 h-10 object-cover rounded shadow">
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold truncate text-white">${anime.title}</span>
                        <span class="text-[9px] text-gray-500 font-black uppercase tracking-widest">${anime.showType || 'Anime'} • ${anime.releaseDate || 'N/A'}</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-red-500">Network Error.</div>`;
        }
    };

    // --- 5. FULL SEARCH SUBMIT (Uses /api/filter for rich data) ---
    const handleSearchSubmit = async (term) => {
        searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        topResultCard.innerHTML = `<div class="animate-pulse w-full h-48 bg-white/5 rounded-xl"></div>`;
        resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-[#F47521]"><i class="fas fa-circle-notch fa-spin"></i> Extracting full database...</div>`;

        try {
            // Using /api/filter?keyword=... because it returns the description object for the Top Card
            const res = await fetch(`${API_BASE}/api/filter?keyword=${encodeURIComponent(term)}`);
            const json = await res.json();
            
            if (!json.success || !json.results.data || json.results.data.length === 0) {
                topResultCard.innerHTML = '';
                resultsListContainer.innerHTML = `<div class="text-center p-10"><i class="fas fa-ghost text-4xl text-gray-600 mb-3"></i><p class="text-sm text-gray-500">No anime found matching "${term}".</p></div>`;
                return;
            }

            const results = json.results.data;
            const topAnime = results[0];
            const restAnime = results.slice(1);

            // Featured Card Extraction
            const subEps = topAnime.tvInfo?.sub || '?';
            const dubEps = topAnime.tvInfo?.dub || 0;
            const showType = topAnime.tvInfo?.showType || 'TV';

            // Top Result Render
            topResultCard.innerHTML = `
                <div onclick="window.location.href='play.html?anime=${topAnime.id}'" class="flex flex-col md:flex-row gap-4 bg-gradient-to-br from-[#121212] to-black p-3 rounded-xl border border-white/10 cursor-pointer hover:border-[#F47521]/50 transition group shadow-2xl">
                    <img src="${topAnime.poster}" class="w-28 md:w-36 h-40 md:h-48 object-cover rounded-lg shadow-lg group-hover:scale-105 transition-transform duration-300">
                    <div class="flex flex-col justify-center flex-1">
                        <span class="text-[9px] font-black uppercase tracking-widest text-[#F47521] mb-1"><i class="fas fa-fire mr-1"></i> Top Match</span>
                        <h3 class="text-base md:text-lg font-black leading-tight text-white mb-1">${topAnime.title}</h3>
                        <p class="text-[10px] text-gray-500 mb-2 italic">${topAnime.japanese_title || ''}</p>
                        <p class="text-[10px] text-gray-300 line-clamp-3 mb-3 leading-relaxed">${topAnime.description || 'Action packed anime series.'}</p>
                        
                        <div class="flex items-center gap-3 text-[10px] font-bold mt-auto">
                            <span class="border border-white/20 text-gray-300 px-1.5 py-0.5 rounded uppercase">${showType}</span>
                            <div class="flex gap-1 ml-auto">
                                <span class="bg-[#F47521]/20 text-[#F47521] px-1.5 py-0.5 rounded border border-[#F47521]/30"><i class="fas fa-closed-captioning"></i> ${subEps}</span>
                                ${dubEps > 0 ? `<span class="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30"><i class="fas fa-microphone"></i> ${dubEps}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // List View Render
            resultsListContainer.innerHTML = restAnime.map(anime => {
                const aSub = anime.tvInfo?.sub || '?';
                const aDub = anime.tvInfo?.dub || 0;
                const aType = anime.tvInfo?.showType || 'TV';

                return `
                <div onclick="window.location.href='play.html?anime=${anime.id}'" class="flex gap-3 items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition border border-transparent hover:border-white/10">
                    <img src="${anime.poster}" class="w-14 h-20 object-cover rounded shadow">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-bold text-white truncate">${anime.title}</h4>
                        <p class="text-[10px] text-gray-500 mt-0.5 truncate">${anime.japanese_title || ''}</p>
                        
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
            console.error(err);
            topResultCard.innerHTML = '';
            resultsListContainer.innerHTML = `<div class="text-center p-4 text-xs text-red-500">Failed to fetch search results from server.</div>`;
        }
    };

    // Boot
    initSearchPage();
});
