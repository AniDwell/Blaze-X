// search.js

window.app = window.app || {};

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

    // --- CUSTOM CSS DROPDOWN LOGIC ---
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const selectBtn = wrapper.querySelector('.custom-select');
        const optionsDiv = wrapper.querySelector('.custom-options');
        const textSpan = wrapper.querySelector('.selected-text');
        const options = wrapper.querySelectorAll('.custom-options div');

        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                if (w !== wrapper) w.classList.remove('dropdown-open');
            });
            wrapper.classList.toggle('dropdown-open');
        });

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

    // --- 1. INITIALIZATION, TYPEWRITER & TOP 10 ---
    const initSearchPage = async () => {
        renderHistory();
        initTypewriterPlaceholder();
        await loadTop10Popular();
    };

    const initTypewriterPlaceholder = async () => {
        let trendingTitles = ["anime, genres..."];
        try {
            const query = `query { Page(page: 1, perPage: 3) { media(type: ANIME, sort: TRENDING_DESC) { title { english romaji } } } }`;
            const res = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const json = await res.json();
            if (json.data && json.data.Page.media) {
                trendingTitles = json.data.Page.media.map(a => a.title.english || a.title.romaji);
            }
        } catch (e) { console.warn("Could not fetch typing suggestions."); }

        let titleIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        
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

            if (!isDeleting && charIndex === currentTitle.length) {
                typeSpeed = 2000;
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                titleIndex = (titleIndex + 1) % trendingTitles.length;
                typeSpeed = 500;
            }

            setTimeout(type, typeSpeed);
        };
        type();
    };

    const loadTop10Popular = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/filter?sort=score`); 
            const json = await res.json();
            
            let dataArray = [];
            if (json.success && json.results?.data) dataArray = json.results.data;
            else if (json.success && json.data) dataArray = json.data;

            if (dataArray.length > 0) {
                const top10 = dataArray.slice(0, 10);
                trendingContainer.className = "flex flex-col gap-3 pb-4"; 
                
                trendingContainer.innerHTML = top10.map((anime, index) => {
                    const aSub = anime.tvInfo?.sub || anime.sub || '?';
                    const aDub = anime.tvInfo?.dub || anime.dub || 0;
                    const aType = anime.tvInfo?.showType || anime.type || 'TV';
                    const imgUrl = anime.poster || anime.image;

                    return `
                    <div onclick="window.location.href='info.html?id=${anime.id}'" class="flex gap-4 items-center bg-white/5 p-2 rounded-xl cursor-pointer hover:bg-white/10 transition relative overflow-hidden border border-transparent hover:border-white/10 group">
                        <div class="absolute top-0 left-0 bg-[#F47521] text-black font-black text-[10px] px-2.5 py-1 rounded-br-xl z-10 shadow-lg group-hover:bg-white transition-colors">
                            TOP ${index + 1}
                        </div>
                        
                        <img src="${imgUrl}" class="w-16 h-24 object-cover rounded-lg shadow-lg">
                        
                        <div class="flex flex-col flex-1 min-w-0 py-1 pr-2">
                            <h4 class="text-sm font-bold text-white truncate">${anime.title}</h4>
                            <p class="text-[10px] text-gray-500 mt-0.5 truncate italic">${anime.japanese_title || ''}</p>
                            
                            <div class="flex gap-2 mt-auto items-center text-[9px] font-black uppercase tracking-wider">
                                <span class="text-gray-400 border border-gray-600 px-1 py-0.5 rounded bg-black/50">${aType}</span>
                                <div class="flex gap-1 ml-auto">
                                    <span class="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-inner">SUB <span class="text-white">${aSub}</span></span>
                                    ${aDub > 0 ? `<span class="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-inner">DUB <span class="text-white">${aDub}</span></span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-xs text-gray-500">Could not load popular titles.</p>`;
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
        ['genres', 'sy', 'sm', 'sd', 'ey', 'em', 'ed'].forEach(id => document.getElementById(`f-${id}`).value = '');
        
        const setSelect = (id, val, text) => {
            const select = document.querySelector(`#wrap-${id} .custom-select`);
            const span = document.querySelector(`#wrap-${id} .selected-text`);
            if(select && span) { select.setAttribute('data-value', val); span.innerText = text; }
        };
        
        setSelect('type', '', 'ALL');
        setSelect('status', '', 'ALL');
        setSelect('lang', '', 'ALL');
        setSelect('sort', 'default', 'Default');
        activeFilters = {};
    });

    document.getElementById('apply-filter-btn').addEventListener('click', () => {
        activeFilters = {
            type: document.querySelector('#wrap-type .custom-select').getAttribute('data-value'),
            status: document.querySelector('#wrap-status .custom-select').getAttribute('data-value'),
            language: document.querySelector('#wrap-lang .custom-select').getAttribute('data-value'),
            sort: document.querySelector('#wrap-sort .custom-select').getAttribute('data-value'),
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

    // --- 4. INPUT HANDLING & VIEW SWITCHING ---
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

    // --- 5. SUGGESTIONS (AniList) ---
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

    // --- 6. ANILIST METADATA FETCHER ---
    const getAniListMetadata = async (title) => {
        const query = `query ($search: String) { Media(type: ANIME, search: $search) { bannerImage description(asHtml: false) } }`;
        try {
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { search: title } }) });
            const json = await res.json();
            return json.data?.Media || null;
        } catch (e) { return null; }
    };

    const render404State = (message = "Nothing matched your search.") => {
        topResultCard.innerHTML = '';
        resultsListContainer.innerHTML = ''; 
        if(window.BlazeX && window.BlazeX.show404) {
            window.BlazeX.show404('results-list-container', message);
        } else {
            resultsListContainer.innerHTML = `<div class="text-center p-10"><p class="text-gray-500 text-sm">${message}</p></div>`;
        }
    };

    // --- 7. DYNAMIC LIBRARY TOGGLE LOGIC ---
    window.app.toggleSearchLibraryClick = async (event, id, title, img) => {
        event.stopPropagation(); 
        const profile = window.app.state?.activeProfile || null;
        
        // Auth Check
        if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Please log in to save to your Library!", "error");
            return;
        }

        if(!profile.library) profile.library = [];
        
        const formattedAnime = { id, title, img };
        const existingItemIndex = profile.library.findIndex(item => item.id === id);
        const isCurrentlyAdded = existingItemIndex !== -1;
        const btn = event.currentTarget || event.target.closest('button');

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userRef = firestore.doc(window.app.db, "users", profile.uid);

            if (isCurrentlyAdded) {
                // REMOVE
                const itemToRemove = profile.library[existingItemIndex];
                profile.library.splice(existingItemIndex, 1); 
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

                // UI Update
                if (btn) {
                    btn.className = "bg-white/10 text-white px-3 py-2 rounded font-black text-[10px] uppercase hover:bg-white/20 transition border border-white/10 flex items-center gap-2";
                    btn.innerHTML = `<i class="fas fa-plus"></i> Library`;
                }

                await firestore.updateDoc(userRef, { library: firestore.arrayRemove(itemToRemove) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");

            } else {
                // ADD
                profile.library.unshift(formattedAnime);
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

                // UI Update
                if (btn) {
                    btn.className = "bg-white text-black px-3 py-2 rounded font-black text-[10px] uppercase hover:bg-gray-200 transition border border-white flex items-center gap-2";
                    btn.innerHTML = `<i class="fas fa-check text-green-500"></i> Added`;
                }

                await firestore.updateDoc(userRef, { library: firestore.arrayUnion(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
            }
        } catch (error) { 
            console.error("Firebase update failed:", error); 
            if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
        }
    };

    // --- 8. FULL SEARCH SUBMISSION ---
    const handleSearchSubmit = async (term) => {
        searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        topResultCard.innerHTML = `<div class="animate-pulse w-full h-56 bg-white/5 rounded-xl"></div>`;
        resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">Loading...</div>`;

        try {
            let queryParams = new URLSearchParams();
            queryParams.append('keyword', term);
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key] && activeFilters[key] !== 'default') {
                    queryParams.append(key, activeFilters[key]);
                }
            });

            const endpoint = Array.from(queryParams.keys()).length > 1 ? '/api/filter' : '/api/search';
            const res = await fetch(`${API_BASE}${endpoint}?${queryParams.toString()}`);
            const json = await res.json();
            
            let results = [];
            if (endpoint === '/api/filter' && json.success && json.results?.data) results = json.results.data;
            else if (endpoint === '/api/search' && json.success && json.data) results = json.data;

            if (results.length === 0) {
                render404State("We couldn't find any anime matching your query or filters.");
                return;
            }

            const topAnime = results[0];
            const restAnime = results.slice(1);

            const meta = await getAniListMetadata(topAnime.title);
            const backdrop = meta?.bannerImage || topAnime.image || topAnime.poster;
            const description = meta?.description || topAnime.description || 'No description available for this title.';

            const topSubEps = topAnime.tvInfo?.sub || topAnime.sub || '?';
            const topDubEps = topAnime.tvInfo?.dub || topAnime.dub || 0;
            const topShowType = topAnime.tvInfo?.showType || topAnime.type || 'TV';
            const topImg = topAnime.image || topAnime.poster;

            // Check if top result is already in library
            const profile = window.app.state?.activeProfile || null;
            let isAdded = false;
            if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
                isAdded = profile.library.some(item => item.id === topAnime.id);
            }

            const libraryBtnHtml = isAdded 
                ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topAnime.title.replace(/'/g, "\\'")}', '${topImg}')" class="bg-white text-black px-3 py-2 rounded font-black text-[10px] uppercase hover:bg-gray-200 transition border border-white flex items-center gap-2">
                       <i class="fas fa-check text-green-500"></i> Added
                   </button>`
                : `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topAnime.title.replace(/'/g, "\\'")}', '${topImg}')" class="bg-white/10 text-white px-3 py-2 rounded font-black text-[10px] uppercase hover:bg-white/20 transition border border-white/10 flex items-center gap-2">
                       <i class="fas fa-plus"></i> Library
                   </button>`;

            topResultCard.innerHTML = `
                <div onclick="window.location.href='info.html?id=${topAnime.id}'" class="relative overflow-hidden rounded-xl border border-white/10 cursor-pointer hover:border-[#F47521]/50 transition group shadow-2xl bg-black">
                    <div class="absolute inset-0">
                        <img src="${backdrop}" class="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700 blur-[2px]">
                        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
                    </div>
                    
                    <div class="relative flex flex-col md:flex-row gap-4 p-4 z-10">
                        <img src="${topImg}" class="w-28 md:w-36 h-40 md:h-52 object-cover rounded-lg shadow-2xl border border-white/5">
                        
                        <div class="flex flex-col flex-1">
                            <span class="text-[9px] font-black uppercase tracking-widest text-[#F47521] mb-1"><i class="fas fa-star mr-1"></i> Top Result</span>
                            <h3 class="text-base md:text-xl font-black leading-tight text-white mb-2">${topAnime.title}</h3>
                            <p class="text-[10px] text-gray-300 line-clamp-4 mb-4 leading-relaxed">${description}</p>
                            
                            <div class="flex items-center gap-2
