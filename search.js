// search.js - Premium Search Engine with Cloud-Synced Click History

window.app = window.app || {};

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const searchInput = document.getElementById('search-input');
    const idleView = document.getElementById('idle-view');
    const typingView = document.getElementById('typing-view');
    const resultsView = document.getElementById('results-view');
    
    // We are repurposing the trending/history containers for the Rich History view
    const historyContainer = document.getElementById('trending-container'); 
    const textHistoryContainer = document.getElementById('history-container'); // Original text pills
    const suggestionsContainer = document.getElementById('suggestions-container');
    const topResultCard = document.getElementById('top-result-card');
    const resultsListContainer = document.getElementById('results-list-container');
    
    const filterModal = document.getElementById('filter-modal');
    
    const API_BASE = 'https://anikoto-api-xi.vercel.app';
    const ANILIST_URL = 'https://graphql.anilist.co';
    let typingTimer;
    let activeFilters = {};

    // --- 1. SEARCH BAR UI INJECTION (BACK & CLEAR BUTTONS) ---
    // Assuming searchInput is wrapped in a relative div, we inject the icons dynamically
    if (searchInput) {
        const parent = searchInput.parentElement;
        parent.classList.add('flex', 'items-center', 'relative');
        
        // Add Back Button (<-)
        const backBtn = document.createElement('button');
        backBtn.className = "absolute left-3 text-white hover:text-[#F47521] transition hidden z-10";
        backBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>`;
        parent.insertBefore(backBtn, searchInput);
        
        // Add Clear Button (X)
        const clearBtn = document.createElement('button');
        clearBtn.className = "absolute right-3 text-gray-400 hover:text-[#F47521] transition hidden z-10 bg-[#111] rounded-full p-1";
        clearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;
        parent.appendChild(clearBtn);

        // Adjust input padding to fit icons
        searchInput.classList.add('pl-10', 'pr-10');

        // Search Input Events
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            clearBtn.classList.toggle('hidden', val.length === 0);
            backBtn.classList.toggle('hidden', val.length === 0);
            
            clearTimeout(typingTimer);
            if (val.length === 0) { switchView('idle'); return; }

            switchView('typing');
            if(suggestionsContainer) suggestionsContainer.innerHTML = `<div class="p-8 text-center text-sm text-gray-400"><i class="fas fa-spinner fa-spin text-[#F47521] mr-2"></i> Fetching suggestions...</div>`;
            typingTimer = setTimeout(() => fetchSuggestions(val), 300); 
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) handleSearchSubmit(searchInput.value.trim());
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('hidden');
            searchInput.focus();
            if (resultsView.classList.contains('hidden')) switchView('idle');
        });

        backBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('hidden');
            backBtn.classList.hidden = true;
            switchView('idle');
            loadRichHistory(); // Refresh history view
        });
    }

    // --- 2. INITIALIZATION ---
    const initSearchPage = () => {
        initTypewriterPlaceholder();
        loadRichHistory();
    };

    const initTypewriterPlaceholder = () => {
        if(!searchInput) return;
        const trendingTitles = ["Naruto", "Jujutsu Kaisen", "One Piece", "Bleach", "Solo Leveling", "Demon Slayer"];
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

    // --- 3. RICH HISTORY LOGIC (CLOUD SYNCED) ---
    const loadRichHistory = () => {
        if(!historyContainer) return;
        
        const profile = window.app.state?.activeProfile || {};
        // Fallback to local storage if user is not logged in or data hasn't synced
        const history = profile.searchHistory || JSON.parse(localStorage.getItem('blazex_rich_history')) || [];

        if (history.length === 0) {
            historyContainer.innerHTML = `<div class="p-8 text-center text-sm text-gray-500 w-full col-span-full bg-[#111] rounded-xl border border-white/5"><i class="fas fa-history text-2xl mb-3 block text-[#F47521]/50"></i> Your recently clicked anime will appear here.</div>`;
            historyContainer.className = "flex flex-col w-full";
            return;
        }

        historyContainer.className = "flex flex-col gap-4 mt-2 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"; 
        
        historyContainer.innerHTML = history.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            return `
            <div class="relative flex gap-4 items-stretch bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3 rounded-xl hover:border-[#F47521]/50 border border-white/5 transition-all duration-300 shadow-md group h-full cursor-pointer" onclick="window.location.href='info.html?id=${anime.id}'">
                
                <button onclick="window.app.removeFromHistory(event, '${anime.id}')" class="absolute top-2 right-2 z-20 bg-black/80 hover:bg-[#F47521] text-gray-400 hover:text-white p-1.5 rounded-md transition backdrop-blur-sm border border-white/10 hover:border-[#F47521]">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div class="relative w-20 md:w-24 shrink-0">
                    <img src="${anime.img}" class="w-full h-full object-cover rounded-lg shadow-md group-hover:brightness-110 transition">
                    <div class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition rounded-lg"></div>
                </div>
                
                <div class="flex flex-col flex-1 min-w-0 py-1 pr-6 justify-center">
                    <h4 class="text-sm md:text-base font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${anime.title}</h4>
                    
                    <div class="flex gap-2 items-center text-[9px] md:text-[10px] font-black uppercase tracking-wider mt-3">
                        <span class="text-gray-300 bg-black border border-white/10 px-1.5 py-0.5 rounded shadow-sm">${anime.type || 'TV'}</span>
                        <span class="text-gray-300">SUB <span class="text-[#F47521]">${anime.sub || '?'}</span></span>
                        ${anime.dub > 0 ? `<span class="text-gray-300 border-l border-white/10 pl-2">DUB <span class="text-purple-400">${anime.dub}</span></span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    };

    window.app.saveResultClick = async (event, id, title, img, sub, dub, type) => {
        event.preventDefault(); // Stop immediate navigation to process save
        
        const animeObj = { id, title, img, sub, dub, type };
        const profile = window.app.state?.activeProfile || null;
        
        // 1. Local Storage Update
        let history = JSON.parse(localStorage.getItem('blazex_rich_history')) || [];
        history = history.filter(item => item.id !== id); // Remove duplicates
        history.unshift(animeObj); // Add to front
        if (history.length > 20) history.pop(); // Keep max 20 items
        localStorage.setItem('blazex_rich_history', JSON.stringify(history));

        // 2. State & Database Update
        if (profile && profile.uid && !profile.uid.startsWith('anon_')) {
            profile.searchHistory = history;
            localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
            
            try {
                const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                const userRef = firestore.doc(window.app.db, "users", profile.uid);
                // Fire and forget, don't await so user navigation is instant
                firestore.updateDoc(userRef, { searchHistory: history }).catch(console.error);
            } catch (error) { console.error("Firebase history sync failed."); }
        }

        // Navigate
        window.location.href = `info.html?id=${id}`;
    };

    window.app.removeFromHistory = async (event, id) => {
        event.stopPropagation(); // Prevent triggering the card click (navigation)
        
        const profile = window.app.state?.activeProfile || null;
        
        let history = JSON.parse(localStorage.getItem('blazex_rich_history')) || [];
        history = history.filter(item => item.id !== id);
        localStorage.setItem('blazex_rich_history', JSON.stringify(history));

        if (profile && profile.uid && !profile.uid.startsWith('anon_')) {
            profile.searchHistory = history;
            localStorage.setItem('blazex_user_profile', JSON.stringify(profile));
            
            try {
                const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                const userRef = firestore.doc(window.app.db, "users", profile.uid);
                await firestore.updateDoc(userRef, { searchHistory: history });
            } catch (error) {}
        }
        
        // Visually remove element with animation
        const card = event.currentTarget.closest('.relative.flex');
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => { loadRichHistory(); }, 200);
    };

    // --- 4. VIEW SWITCHING & SUGGESTIONS ---
    const switchView = (view) => {
        if(idleView) idleView.classList.add('hidden');
        if(typingView) typingView.classList.add('hidden');
        if(resultsView) resultsView.classList.add('hidden');
        
        if (view === 'idle' && idleView) idleView.classList.remove('hidden');
        if (view === 'typing' && typingView) typingView.classList.remove('hidden');
        if (view === 'results' && resultsView) resultsView.classList.remove('hidden');
    };

    const fetchSuggestions = async (term) => {
        // ... [Suggestions logic remains the same] ...
        if(!suggestionsContainer) return;
        const query = `query ($search: String) { Page(page: 1, perPage: 8) { media(type: ANIME, search: $search, sort: SEARCH_MATCH) { title { romaji english } } } }`;
        try {
            const res = await fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { search: term } }) });
            const json = await res.json();
            const media = json.data?.Page?.media || [];

            if (media.length === 0) { suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">No suggestions.</div>`; return; }

            window.handleSuggestionClick = (title) => { searchInput.value = title; handleSearchSubmit(title); };

            const highlightText = (text, q) => text.replace(new RegExp(`(${q})`, 'gi'), '<span class="text-[#F47521] font-bold">$1</span>');

            suggestionsContainer.innerHTML = media.map(anime => {
                const title = anime.title.english || anime.title.romaji;
                const safeTitle = title.replace(/'/g, "\\'");
                return `
                <div onclick="handleSuggestionClick('${safeTitle}')" class="flex items-center gap-3 p-3 hover:bg-[#111] rounded-lg cursor-pointer transition border-b border-white/5 last:border-0">
                    <i class="fas fa-search text-gray-600 text-sm"></i><span class="text-sm text-gray-300 truncate">${highlightText(title, term)}</span>
                </div>`;
            }).join('');
        } catch (err) { suggestionsContainer.innerHTML = `<div class="p-4 text-xs text-gray-500">Network error.</div>`; }
    };

    // --- 5. SUBMIT SEARCH & RENDER RESULTS (WITH DB SAVE INJECTION) ---
    const render404State = (message = "Nothing matched your search.") => {
        if(topResultCard) topResultCard.innerHTML = '';
        if(resultsListContainer) resultsListContainer.innerHTML = ''; 
        if(resultsListContainer) {
            resultsListContainer.innerHTML = `<div class="text-center p-16 col-span-full"><i class="fas fa-ghost text-4xl text-gray-700 mb-4 block"></i><p class="text-gray-400 text-sm md:text-base">${message}</p></div>`;
        }
    };

    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        // saveHistory(term); // Removed plain text history in favor of Click History
        switchView('results');
        
        // Show Back Button explicitly when looking at results
        const backBtn = searchInput.parentElement.querySelector('button.left-3');
        if(backBtn) backBtn.classList.remove('hidden');
        
        if(topResultCard) topResultCard.innerHTML = `<div class="animate-pulse w-full h-64 md:h-80 bg-[#111] rounded-2xl"></div>`;
        if(resultsListContainer) {
            resultsListContainer.className = "flex flex-col gap-4 mt-6"; 
            resultsListContainer.innerHTML = `<div class="p-8 text-center text-sm text-[#F47521] w-full"><i class="fas fa-circle-notch fa-spin text-2xl mb-3 block"></i> Scanning Anime...</div>`;
        }

        try {
            let queryParams = new URLSearchParams();
            queryParams.append('keyword', term);
            
            let hasFilters = false;
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key] && activeFilters[key] !== 'default' && activeFilters[key] !== '') {
                    queryParams.append(key, activeFilters[key]);
                    hasFilters = true;
                }
            });

            const endpoint = hasFilters ? '/api/filter' : '/api/search';
            const res = await fetch(`${API_BASE}${endpoint}?${queryParams.toString()}`);
            const json = await res.json();
            
            let results = [];
            if (endpoint === '/api/filter' && json.success && json.results?.data) results = json.results.data;
            else if (endpoint === '/api/search' && json.success && json.data) results = json.data;
            else if (json.results && Array.isArray(json.results)) results = json.results;

            if (!results || results.length === 0) { render404State("We couldn't find any anime matching your query or filters."); return; }

            const topAnime = results[0];
            const restAnime = results.slice(1);

            let backdrop = topAnime.image || topAnime.poster;
            let description = topAnime.description || 'No description available for this title.';
            
            fetch(ANILIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query { Media(type: ANIME, search: "${topAnime.title}") { bannerImage description(asHtml: false) } }` }) })
            .then(r => r.json())
            .then(mJson => {
                if(mJson.data?.Media) {
                    const dynamicBackdrop = document.getElementById('top-result-backdrop');
                    const dynamicDesc = document.getElementById('top-result-desc');
                    if(dynamicBackdrop && mJson.data.Media.bannerImage) dynamicBackdrop.src = mJson.data.Media.bannerImage;
                    if(dynamicDesc && mJson.data.Media.description) dynamicDesc.innerHTML = mJson.data.Media.description;
                }
            }).catch(() => {}); 

            const topSubEps = topAnime.tvInfo?.sub || topAnime.sub || '?';
            const topDubEps = topAnime.tvInfo?.dub || topAnime.dub || 0;
            const topType = topAnime.type || 'TV';
            const topImg = topAnime.image || topAnime.poster;

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

            // Top Result Render (Injected saveResultClick)
            if(topResultCard) {
                topResultCard.innerHTML = `
                <div onclick="window.app.saveResultClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}', '${topSubEps}', '${topDubEps}', '${topType}')" class="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer hover:border-[#F47521] transition-all duration-300 group shadow-2xl bg-[#0a0a0a] min-h-[280px] md:min-h-[350px] flex items-end">
                    <div class="absolute inset-0">
                        <img id="top-result-backdrop" src="${backdrop}" class="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700 blur-sm">
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
                            <p id="top-result-desc" class="text-xs md:text-sm text-gray-300 line-clamp-3 md:line-clamp-4 mb-4 md:mb-6 leading-relaxed max-w-3xl">${description}</p>
                            
                            <div class="flex flex-wrap items-center gap-3 mt-auto">
                                <button onclick="window.app.saveResultClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}', '${topSubEps}', '${topDubEps}', '${topType}')" class="bg-white text-black px-5 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase tracking-widest hover:bg-[#F47521] hover:text-white transition shadow-lg"><i class="fas fa-play mr-2"></i> Watch Now</button>
                                ${libraryBtnHtml}
                                <button onclick="event.stopPropagation(); window.app.shareAnime('${topAnime.id}', '${topSafeTitle}')" class="bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:text-[#F47521] hover:border-[#F47521] transition border border-white/10 flex items-center gap-2">
                                    <i class="fas fa-share-nodes"></i> Share
                                </button>
                                
                                <div class="flex gap-2 ml-auto text-[10px] md:text-xs font-bold mt-2 md:mt-0 w-full md:w-auto justify-end">
                                    <span class="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded border border-white/10">${topType}</span>
                                    <span class="bg-[#F47521]/20 border border-[#F47521]/40 text-[#F47521] px-2 py-1 rounded">SUB ${topSubEps}</span>
                                    ${topDubEps > 0 ? `<span class="bg-white/10 border border-white/20 text-white px-2 py-1 rounded">DUB ${topDubEps}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }

            // Results List View (Injected saveResultClick)
            if(resultsListContainer && restAnime.length > 0) {
                resultsListContainer.className = "flex flex-col gap-4 mt-6 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3";
                
                resultsListContainer.innerHTML = restAnime.map(anime => {
                    const aSub = anime.tvInfo?.sub || anime.sub || '?';
                    const aDub = anime.tvInfo?.dub || anime.dub || 0;
                    const aType = anime.type || 'TV';
                    const isAdded = checkLibraryStatus(anime.id);
                    const safeTitle = anime.title.replace(/'/g, "\\'");
                    const img = anime.image || anime.poster;
                    const descFallback = anime.description || "Dive into this exciting series. Click to view more details and start watching.";

                    const listSaveBtn = isAdded 
                        ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${img}')" class="text-[#F47521] bg-[#F47521]/10 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-[#F47521] hover:text-black transition flex items-center gap-1.5"><i class="fas fa-check"></i> Saved</button>`
                        : `<button onclick="window.app.toggleSearchLibraryClick(event, '${anime.id}', '${safeTitle}', '${img}')" class="text-gray-400 bg-white/5 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-white hover:text-black transition flex items-center gap-1.5"><i class="fas fa-bookmark"></i> Save</button>`;

                    return `
                    <div onclick="window.app.saveResultClick(event, '${anime.id}', '${safeTitle}', '${img}', '${aSub}', '${aDub}', '${aType}')" class="flex gap-4 items-stretch bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3 rounded-xl cursor-pointer hover:border-[#F47521]/50 border border-white/5 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 group h-full">
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
                                    <span class="text-gray-300 bg-black border border-white/10 px-1.5 py-0.5 rounded shadow-sm">${aType}</span>
                                    <span class="text-gray-300">SUB <span class="text-[#F47521]">${aSub}</span></span>
                                    ${aDub > 0 ? `<span class="text-gray-300 border-l border-white/10 pl-2">DUB <span class="text-white">${aDub}</span></span>` : ''}
                                </div>
                                <div class="flex items-center gap-2 mt-1 border-t border-white/5 pt-2">
                                    ${listSaveBtn}
                                    <button onclick="event.stopPropagation(); window.app.shareAnime('${anime.id}', '${safeTitle}')" class="text-gray-400 bg-white/5 px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-[#F47521] hover:text-white transition flex items-center gap-1.5">
                                        <i class="fas fa-share"></i> Share
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            } else if(resultsListContainer) {
                resultsListContainer.innerHTML = ''; 
            }
        } catch (err) {
            render404State("Network error occurred while communicating with the database.");
        }
    };

    // --- LIBRARY BUTTON ACTION (Reused logic from carousel) ---
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
                    if (btn.innerText.includes("ADDED") || btn.innerText.includes("Added") || btn.innerText.includes("Saved")) {
                        if(btn.classList.contains('px-4')) {
                            btn.className = "bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:border-[#F47521] hover:bg-black transition border border-white/10 flex items-center gap-2";
                            btn.innerHTML = `<i class="fas fa-plus"></i> Save`;
                        } else {
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
                
                if (btn) {
                    if(btn.classList.contains('px-4')) {
                        btn.className = "bg-[#F47521] text-black px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:bg-white transition border border-[#F47521] flex items-center gap-2 shadow-lg shadow-[#F47521]/20";
                        btn.innerHTML = `<i class="fas fa-check"></i> Added`;
                    } else {
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
        if(window.openShareModal) {
            window.openShareModal(id, title);
        } else {
            if (navigator.share) {
                navigator.share({
                    title: `Watch ${title}`,
                    text: `Check out ${title} on AniKoto!`,
                    url: `${window.location.origin}/info.html?id=${id}`
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(`${window.location.origin}/info.html?id=${id}`);
                if(window.app.showCustomAlert) window.app.showCustomAlert("Link copied to clipboard!", "success");
            }
        }
    };

    // Initialize 
    initSearchPage();
});
