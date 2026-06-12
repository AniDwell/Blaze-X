// search.js - Full Featured Search & Filter Engine (Premium & Responsive Edition)

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

    // --- ANILIST TO DB MAPPING (TOP 10 PREMIUM UI) ---
    const loadTop10Popular = async () => {
        if(!trendingContainer) return;
        trendingContainer.innerHTML = `<div class="p-8 text-center text-xs text-gray-500 w-full"><i class="fas fa-circle-notch fa-spin text-[#F47521] text-2xl mb-3 block"></i> Fetching Live Rankings...</div>`;
        
        try {
            const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { title { romaji english } coverImage { extraLarge } } } }`;
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const json = await res.json();
            const animeList = json.data.Page.media;

            trendingContainer.innerHTML = '';
            // PREMIUM NATIVE APP FEEL: Horizontal scroll on mobile (snap), Grid on Desktop
            trendingContainer.className = "flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-6 md:grid md:grid-cols-2 lg:grid-cols-5 md:overflow-visible md:snap-none"; 

            let count = 1;
            for (const anime of animeList) {
                const title = anime.title.english || anime.title.romaji;
                try {
                    const searchRes = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(title)}`);
                    const searchJson = await searchRes.json();
                    
                    if (searchJson.success && searchJson.results?.length > 0) {
                        const match = searchJson.results[0];
                        const imgUrl = match.image || match.poster || anime.coverImage.extraLarge;
                        const aSub = match.tvInfo?.sub || match.sub || '?';
                        const aDub = match.tvInfo?.dub || match.dub || 0;

                        // Premium Top 10 Card UI
                        trendingContainer.innerHTML += `
                        <div onclick="window.location.href='info.html?id=${match.id}'" class="snap-start min-w-[260px] md:min-w-0 flex md:flex-col gap-4 items-center md:items-start bg-gradient-to-br from-[#111] to-[#0a0a0a] p-3 md:p-4 rounded-2xl cursor-pointer hover:border-[#F47521] border border-white/5 transition-all duration-300 relative overflow-hidden group shadow-lg hover:shadow-[#F47521]/20 transform hover:-translate-y-1">
                            <div class="absolute top-0 left-0 bg-[#F47521] text-black font-black text-[11px] px-3 py-1 rounded-br-2xl z-10 shadow-md">#${count}</div>
                            <div class="relative w-20 h-28 md:w-full md:h-56 shrink-0">
                                <img src="${imgUrl}" class="w-full h-full object-cover rounded-xl shadow-inner group-hover:scale-105 transition-transform duration-500">
                                <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition duration-300 rounded-xl"></div>
                            </div>
                            <div class="flex flex-col flex-1 min-w-0 py-1 w-full">
                                <h4 class="text-sm md:text-base font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${match.title}</h4>
                                <p class="text-[10px] md:text-xs text-gray-500 mt-0.5 truncate italic">${match.japanese_title || 'N/A'}</p>
                                <div class="flex gap-2 mt-2 md:mt-3 items-center text-[9px] md:text-[10px] font-black uppercase tracking-wider">
                                    <span class="text-gray-400 border border-gray-600 px-1.5 py-0.5 rounded bg-black/50">${match.type || 'TV'}</span>
                                    <div class="flex gap-1 ml-auto">
                                        <span class="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">SUB <span class="text-white">${aSub}</span></span>
                                        ${aDub > 0 ? `<span class="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">DUB <span class="text-white">${aDub}</span></span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>`;
                        count++;
                    }
                } catch(e) {}
            }
            if(trendingContainer.innerHTML === '') trendingContainer.innerHTML = `<div class="p-8 text-center text-sm text-gray-500 w-full">Failed to map trending titles. Database might be updating.</div>`;
        } catch (error) {
            trendingContainer.innerHTML = `<p class="text-sm text-red-500 w-full text-center py-6">Could not load popular titles at this moment.</p>`;
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
            <div class="history-item relative flex items-center bg-[#111] border border-white/5 rounded-full px-4 py-2 cursor-pointer hover:border-[#F47521] transition select-none shadow-sm" data-term="${term}">
                <i class="fas fa-history text-gray-500 mr-2 text-xs"></i>
                <span class="text-xs font-semibold text-gray-300">${term}</span>
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

    // --- 3. FILTER LOGIC & VIEW SWITCHING (Kept untouched mostly) ---
    // ... [Filter logic remains exactly the same] ...
    
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
        return text.replace(regex, '<span class="text-[#F47521] font-bold">$1</span>');
    };

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if(clearBtn) clearBtn.classList.toggle('hidden', val.length === 0);
            
            clearTimeout(typingTimer);
            if (val.length === 0) { switchView('idle'); return; }

            switchView('typing');
            if(suggestionsContainer) suggestionsContainer.innerHTML = `<div class="p-8 text-center text-sm text-gray-400"><i class="fas fa-spinner fa-spin text-[#F47521] mr-2"></i> Fetching suggestions...</div>`;
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

    const fetchSuggestions = async (term) => {
        // ... [Suggestions fetching logic remains the same] ...
    };

    // --- 6. SUBMIT SEARCH (WITH PREMIUM DESKTOP SCALING & LIST DESCRIPTIONS/BUTTONS) ---
    const render404State = (message = "Nothing matched your search.") => {
        if(topResultCard) topResultCard.innerHTML = '';
        if(resultsListContainer) resultsListContainer.innerHTML = ''; 
        if(window.BlazeX && window.BlazeX.show404) {
            window.BlazeX.show404('results-list-container', message);
        } else if(resultsListContainer) {
            resultsListContainer.innerHTML = `<div class="text-center p-16"><i class="fas fa-ghost text-4xl text-gray-700 mb-4"></i><p class="text-gray-400 text-sm md:text-base">${message}</p></div>`;
        }
    };

    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        saveHistory(term);
        switchView('results');
        
        if(topResultCard) topResultCard.innerHTML = `<div class="animate-pulse w-full h-64 md:h-80 bg-[#111] rounded-2xl"></div>`;
        if(resultsListContainer) resultsListContainer.innerHTML = `<div class="p-8 text-center text-sm text-[#F47521]"><i class="fas fa-circle-notch fa-spin text-2xl mb-2 block"></i> Parsing Database...</div>`;

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

            // --- LIBRARY CHECK HELPER ---
            const checkLibraryStatus = (animeId) => {
                const profile = window.app.state?.activeProfile || null;
                if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
                    return profile.library.some(item => item.id === animeId);
                }
                return false;
            };

            const isTopAdded = checkLibraryStatus(topAnime.id);
            const topSafeTitle = topAnime.title.replace(/'/g, "\\'");

            const libraryBtnHtml = isTopAdded 
                ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}')" class="bg-[#F47521] text-black px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:bg-white transition border border-[#F47521] flex items-center gap-2 shadow-lg shadow-[#F47521]/20"><i class="fas fa-check"></i> Added</button>`
                : `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}')" class="bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:border-[#F47521] hover:bg-black transition border border-white/10 flex items-center gap-2"><i class="fas fa-plus"></i> Save</button>`;

            // Top Result Render (Scaled for Desktop)
            if(topResultCard) {
                topResultCard.innerHTML = `
                <div onclick="window.location.href='info.html?id=${topAnime.id}'" class="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer hover:border-[#F47521] transition-all duration-300 group shadow-2xl bg-[#0a0a0a] min-h-[280px] md:min-h-[350px] flex items-end">
                    <div class="absolute inset-0">
                        <img src="${backdrop}" class="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700 blur-sm">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 md:via-[#050505]/60 to-transparent"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent hidden md:block"></div>
                    </div>
                    <div class="relative flex flex-col md:flex-row gap-5 md:gap-8 p-5 md:p-8 w-full z-10 items-start md:items-end">
                        <img src="${topImg}" class="w-28 md:w-48 h-40 md:h-64 object-cover rounded-xl shadow-2xl border border-white/10 shrink-0 transform group-hover:-translate-y-2 transition-transform duration-500">
                        <div class="flex flex-col flex-1 w-full">
                            <span class="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#F47521] mb-1.5 md:mb-2 flex items-center gap-2">
                                <i class="fas fa-fire"></i> Top Match
                            </span>
                            <h3 class="text-xl md:text-4xl font-black leading-tight text-white mb-2 md:mb-3 drop-shadow-lg">${topAnime.title}</h3>
                            <p class="text-xs md:text-sm text-gray-300 line-clamp-3 md:line-clamp-4 mb-4 md:mb-6 leading-relaxed max-w-3xl">${description}</p>
                            
                            <div class="flex flex-wrap items-center gap-3 mt-auto">
                                <button onclick="event.stopPropagation(); window.location.href='info.html?id=${topAnime.id}'" class="bg-white text-black px-5 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase tracking-widest hover:bg-[#F47521] hover:text-white transition shadow-lg"><i class="fas fa-play mr-2"></i> Watch Now</button>
                                ${libraryBtnHtml}
                                <button onclick="event.stopPropagation(); window.app.shareAnime('${topAnime.id}', '${topSafeTitle}')" class="bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:text-blue-400 hover:border-blue-400 transition border border-white/10 flex items-center gap-2">
                                    <i class="fas fa-share-nodes"></i> Share
                                </button>
                                
                                <div class="flex gap-2 ml-auto text-[10px] md:text-xs font-bold mt-2 md:mt-0 w-full md:w-auto justify-end">
                                    <span class="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded border border-white/10">${topAnime.type || 'TV'}</span>
                                    <span class="bg-[#F47521]/20 border border-[#F47521]/40 text-[#F47521] px-2 py-1 rounded">SUB ${topSubEps}</span>
                                    ${topDubEps > 0 ? `<span class="bg-purple-500/20 border border-purple-500/40 text-purple-400 px-2 py-1 rounded">DUB ${topDubEps}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }

            // Results List View (With Description, Grid on Desktop, and Buttons)
            if(resultsListContainer) {
                resultsListContainer.className = "flex flex-col gap-4 mt-6 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3";
                
                resultsListContainer.innerHTML = restAnime.map(anime => {
                    const aSub = anime.tvInfo?.sub || anime.sub || '?';
                    const aDub = anime.tvInfo?.dub || anime.dub || 0;
                    const isAdded = checkLibraryStatus(anime.id);
                    const safeTitle = anime.title.replace(/'/g, "\\'");
                    const img = anime.image || anime.poster;
                    const descFallback = anime.description || "Dive into this exciting series. Click to view more details and start watching.";

                    const listSaveBtn = isAdded 
                        ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${img}')" class="text-[#F47521] bg-[#F47521]/10 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-[#F47521] hover:text-black transition flex items-center gap-1.5"><i class="fas fa-check"></i> Saved</button>`
                        : `<button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${img}')" class="text-gray-400 bg-white/5 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-white hover:text-black transition flex items-center gap-1.5"><i class="fas fa-bookmark"></i> Save</button>`;

                    return `
                    <div onclick="window.location.href='info.html?id=${anime.id}'" class="flex gap-4 items-stretch bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3 rounded-xl cursor-pointer hover:border-[#F47521]/50 border border-white/5 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 group h-full">
                        <div class="relative w-24 md:w-28 shrink-0">
                            <img src="${img}" class="w-full h-full object-cover rounded-lg shadow-md group-hover:brightness-110 transition">
                            <div class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition rounded-lg"></div>
                        </div>
                        <div class="flex flex-col flex-1 min-w-0 justify-between py-1">
                            <div>
                                <h4 class="text-sm md:text-base font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${anime.title}</h4>
                                <p class="text-[10px] md:text-xs text-gray-400 line-clamp-2 md:line-clamp-3 mt-1.5 leading-relaxed">${descFallback}</p>
                            </div>
                            
                            <div class="flex flex-col gap-2 mt-3">
                                <div class="flex gap-2 items-center text-[9px] md:text-[10px] font-black uppercase tracking-wider">
                                    <span class="text-gray-300 bg-black border border-white/10 px-1.5 py-0.5 rounded shadow-sm">${anime.type || 'TV'}</span>
                                    <span class="text-gray-300">SUB <span class="text-[#F47521]">${aSub}</span></span>
                                    ${aDub > 0 ? `<span class="text-gray-300 border-l border-white/10 pl-2">DUB <span class="text-purple-400">${aDub}</span></span>` : ''}
                                </div>
                                <div class="flex items-center gap-2 mt-1 border-t border-white/5 pt-2">
                                    ${listSaveBtn}
                                    <button onclick="event.stopPropagation(); window.app.shareAnime('${anime.id}', '${safeTitle}')" class="text-gray-400 bg-white/5 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-blue-500 hover:text-white transition flex items-center gap-1.5">
                                        <i class="fas fa-share"></i> Share
                                    </button>
                                </div>
                            </div>
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

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const userRef = firestore.doc(window.app.db, "users", profile.uid);

            if (isCurrentlyAdded) {
                profile.library.splice(existingItemIndex, 1); 
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                
                // Update UI based on which button was clicked (Top Result vs List Result)
                if (btn) {
                    if (btn.innerText.includes("ADDED") || btn.innerText.includes("Added")) {
                        // Top match button reset
                        if(btn.classList.contains('px-4')) {
                            btn.className = "bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:border-[#F47521] hover:bg-black transition border border-white/10 flex items-center gap-2";
                            btn.innerHTML = `<i class="fas fa-plus"></i> Save`;
                        } else {
                            // List view button reset
                            btn.className = "text-gray-400 bg-white/5 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-white hover:text-black transition flex items-center gap-1.5";
                            btn.innerHTML = `<i class="fas fa-bookmark"></i> Save`;
                        }
                    }
                }
                
                await firestore.updateDoc(userRef, { library: firestore.arrayRemove(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Removed from Library", "success");
            } else {
                profile.library.unshift(formattedAnime);
                localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
                
                // Update UI
                if (btn) {
                    if(btn.classList.contains('px-4')) { // Top match button
                        btn.className = "bg-[#F47521] text-black px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:bg-white transition border border-[#F47521] flex items-center gap-2 shadow-lg shadow-[#F47521]/20";
                        btn.innerHTML = `<i class="fas fa-check"></i> Added`;
                    } else { // List view button
                        btn.className = "text-[#F47521] bg-[#F47521]/10 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-[#F47521] hover:text-black transition flex items-center gap-1.5";
                        btn.innerHTML = `<i class="fas fa-check"></i> Saved`;
                    }
                }
                
                await firestore.updateDoc(userRef, { library: firestore.arrayUnion(formattedAnime) });
                if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
            }
        } catch (error) { 
            if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
        }
    };

    // --- SHARE LOGIC BRIDGE ---
    window.app.shareAnime = (id, title) => {
        // This triggers the logic expected in share.js
        if(window.openShareModal) {
            window.openShareModal(id, title);
        } else {
            // Fallback native share if share.js isn't ready
            if (navigator.share) {
                navigator.share({
                    title: `Watch ${title}`,
                    text: `Check out ${title} on AniKoto!`,
                    url: `${window.location.origin}/info.html?id=${id}`
                }).catch(console.error);
            } else {
                // Quick clipboard fallback
                navigator.clipboard.writeText(`${window.location.origin}/info.html?id=${id}`);
                if(window.app.showCustomAlert) window.app.showCustomAlert("Link copied to clipboard!", "success");
            }
        }
    };

    initSearchPage();
});
