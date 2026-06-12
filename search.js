// search.js - Full Featured Search & History Engine (Clean Text Firestore IDs)

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

    // --- FIREBASE CLOUD SYNC LOGIC ---
    const syncWithCloud = async () => {
        const profile = window.app.state?.activeProfile || null;
        if (!profile || !profile.uid || profile.uid.startsWith('anon_')) return;

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            const { collection, getDocs, query, orderBy, limit } = firestore;

            // 1. Fetch Cloud Library
            const libraryRef = collection(window.app.db, "users", profile.uid, "library");
            const libSnapshot = await getDocs(libraryRef);
            profile.library = libSnapshot.docs.map(doc => doc.data());
            localStorage.setItem('blazex_user_profile', JSON.stringify(profile));

            // 2. Fetch Cloud History
            const historyRef = collection(window.app.db, "users", profile.uid, "history");
            const historyQuery = query(historyRef, orderBy("timestamp", "desc"), limit(30));
            const histSnapshot = await getDocs(historyQuery);
            
            let cloudClicked = [];
            let cloudSearches = [];

            histSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.historyType === 'anime') cloudClicked.push(data);
                else if (data.historyType === 'search') cloudSearches.push(data.term);
            });

            localStorage.setItem('blazex_clicked_anime', JSON.stringify(cloudClicked.slice(0, 15)));
            localStorage.setItem('blazex_search_history', JSON.stringify(cloudSearches.slice(0, 10)));

            renderClickedHistory();
            renderSearchTextHistory();
        } catch (error) {
            console.error("Cloud sync failed (Check Firebase Rules):", error);
        }
    };

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
        renderSearchTextHistory(); 
        renderClickedHistory();    
        initTypewriterPlaceholder();
        syncWithCloud();           
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

    // --- 2. RECENTLY VIEWED (CLICKED) HISTORY ---
    window.saveAndGo = async (id, title, image, type, sub, dub) => {
        let history = JSON.parse(localStorage.getItem('blazex_clicked_anime')) || [];
        history = history.filter(item => String(item.id) !== String(id));
        
        const docIdStr = String(id); // Handles string IDs like "dr-stone-science-future..."
        const animeData = { historyType: 'anime', id: docIdStr, title, image, type, sub, dub, timestamp: Date.now() };
        history.unshift(animeData);
        if (history.length > 15) history.pop(); 
        
        localStorage.setItem('blazex_clicked_anime', JSON.stringify(history));

        // Save to Cloud Subcollection
        const profile = window.app.state?.activeProfile || null;
        if (profile && profile.uid && !profile.uid.startsWith('anon_')) {
            try {
                const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                // Uses clean string ID: anime_dr-stone-science-future-part-3-6d6cc
                const docRef = firestore.doc(window.app.db, "users", profile.uid, "history", `anime_${docIdStr}`);
                await firestore.setDoc(docRef, animeData, { merge: true });
            } catch (e) { console.error("Firebase History Write Error:", e); }
        }

        window.location.href = `info.html?id=${id}`;
    };

    window.deleteClickedHistory = async (event, id) => {
        event.stopPropagation(); 
        let history = JSON.parse(localStorage.getItem('blazex_clicked_anime')) || [];
        history = history.filter(item => String(item.id) !== String(id));
        localStorage.setItem('blazex_clicked_anime', JSON.stringify(history));
        renderClickedHistory();

        // Delete from Cloud Subcollection
        const profile = window.app.state?.activeProfile || null;
        if (profile && profile.uid && !profile.uid.startsWith('anon_')) {
            try {
                const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                const docRef = firestore.doc(window.app.db, "users", profile.uid, "history", `anime_${id}`);
                await firestore.deleteDoc(docRef);
            } catch (e) { console.error("Firebase History Delete Error:", e); }
        }
    };

    const renderClickedHistory = () => {
        if(!trendingContainer) return;
        
        let history = JSON.parse(localStorage.getItem('blazex_clicked_anime')) || [];
        
        if (history.length === 0) {
            trendingContainer.innerHTML = `
                <div class="p-10 text-center w-full flex flex-col items-center justify-center opacity-60">
                    <i class="fas fa-history text-3xl text-gray-600 mb-3 block"></i>
                    <p class="text-sm text-gray-400">Your recently viewed anime will appear here.</p>
                </div>`;
            trendingContainer.className = "flex w-full"; 
            return;
        }

        trendingContainer.className = "flex flex-col gap-4 pb-6 md:grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 md:overflow-visible"; 

        trendingContainer.innerHTML = history.map(anime => {
            const safeTitle = anime.title.replace(/'/g, "\\'");
            return `
            <div onclick="window.saveAndGo('${anime.id}', '${safeTitle}', '${anime.image}', '${anime.type}', '${anime.sub}', '${anime.dub}')" class="relative flex gap-4 items-stretch bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3 rounded-xl cursor-pointer hover:border-[#F47521]/50 border border-white/5 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 group h-full">
                
                <button onclick="window.deleteClickedHistory(event, '${anime.id}')" class="absolute top-2 right-2 bg-black/60 hover:bg-[#F47521] text-white w-6 h-6 rounded-full flex items-center justify-center transition-colors z-10 border border-white/10 hover:border-white shadow-md group/btn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 group-hover/btn:scale-110 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>

                <div class="relative w-20 md:w-24 shrink-0">
                    <img src="${anime.image}" class="w-full h-full object-cover rounded-lg shadow-md group-hover:brightness-110 transition">
                </div>
                <div class="flex flex-col flex-1 min-w-0 justify-center py-1 pr-6">
                    <h4 class="text-sm md:text-base font-bold text-white truncate group-hover:text-[#F47521] transition-colors">${anime.title}</h4>
                    
                    <div class="flex gap-2 items-center text-[9px] md:text-[10px] font-black uppercase tracking-wider mt-2.5">
                        <span class="text-gray-300 bg-black border border-white/10 px-1.5 py-0.5 rounded shadow-sm">${anime.type || 'TV'}</span>
                        <span class="text-gray-300">SUB <span class="text-[#F47521]">${anime.sub}</span></span>
                        ${anime.dub > 0 ? `<span class="text-gray-300 border-l border-white/10 pl-2">DUB <span class="text-purple-400">${anime.dub}</span></span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    };

    // --- 3. SEARCH TEXT HISTORY LOGIC ---
    const getSearchHistory = () => JSON.parse(localStorage.getItem('blazex_search_history')) || [];
    
    const saveSearchHistory = async (term) => {
        let history = getSearchHistory().filter(t => t.toLowerCase() !== term.toLowerCase()); 
        history.unshift(term);
        if (history.length > 10) history.pop();
        localStorage.setItem('blazex_search_history', JSON.stringify(history));
        renderSearchTextHistory();

        // Save to Cloud Subcollection
        const profile = window.app.state?.activeProfile || null;
        if (profile && profile.uid && !profile.uid.startsWith('anon_')) {
            try {
                const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                // Clean the term so Firebase doesn't crash if they search for symbols like "/"
                const safeTerm = term.trim().replace(/[\/\\.#$\[\]]/g, '_');
                const docId = `search_${safeTerm}`; 
                const docRef = firestore.doc(window.app.db, "users", profile.uid, "history", docId);
                await firestore.setDoc(docRef, { historyType: 'search', term: term, timestamp: Date.now() }, { merge: true });
            } catch (e) { console.error("Firebase Search Term Save Error:", e); }
        }
    };

    const deleteSearchHistoryItem = async (term) => {
        localStorage.setItem('blazex_search_history', JSON.stringify(getSearchHistory().filter(t => t !== term)));
        renderSearchTextHistory();

        // Delete from Cloud Subcollection
        const profile = window.app.state?.activeProfile || null;
        if (profile && profile.uid && !profile.uid.startsWith('anon_')) {
            try {
                const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
                const safeTerm = term.trim().replace(/[\/\\.#$\[\]]/g, '_');
                const docId = `search_${safeTerm}`;
                const docRef = firestore.doc(window.app.db, "users", profile.uid, "history", docId);
                await firestore.deleteDoc(docRef);
            } catch (e) { console.error("Firebase Search Term Delete Error:", e); }
        }
    };

    const renderSearchTextHistory = () => {
        if(!historyContainer) return;
        const history = getSearchHistory();
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
            const startPress = () => { pressTimer = setTimeout(() => { deleteSearchHistoryItem(term); navigator.vibrate?.(50); }, 600); };
            const cancelPress = () => clearTimeout(pressTimer);
            item.addEventListener('mousedown', startPress); item.addEventListener('touchstart', startPress, {passive: true});
            item.addEventListener('mouseup', cancelPress); item.addEventListener('mouseleave', cancelPress); item.addEventListener('touchend', cancelPress);
            item.addEventListener('click', () => { cancelPress(); searchInput.value = term; handleSearchSubmit(term); });
        });
    };

    const clearAllBtn = document.getElementById('clear-all-history');
    if(clearAllBtn) clearAllBtn.addEventListener('click', () => { 
        localStorage.removeItem('blazex_search_history'); 
        renderSearchTextHistory(); 
    });

    // --- 4. FILTER LOGIC ---
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
        setSelect('type', '', 'ALL'); setSelect('status', '', 'ALL'); setSelect('lang', '', 'ALL'); setSelect('sort', '', 'Default');
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

    const switchView = (view) => {
        if(idleView) idleView.classList.add('hidden');
        if(typingView) typingView.classList.add('hidden');
        if(resultsView) resultsView.classList.add('hidden');
        
        if (view === 'idle' && idleView) { idleView.classList.remove('hidden'); renderClickedHistory(); }
        if (view === 'typing' && typingView) typingView.classList.remove('hidden');
        if (view === 'results' && resultsView) resultsView.classList.remove('hidden');
    };

    const highlightText = (text, query) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="text-[#F47521] font-bold">$1</span>');
    };

    if(clearBtn) {
        clearBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 hover:text-[#F47521] bg-[#111] hover:bg-white rounded-full p-0.5 transition-all duration-200" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>`;
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = ''; 
            clearBtn.classList.add('hidden'); 
            switchView('idle'); 
            searchInput.focus();
        });
    }

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

    // --- 5. SEARCH & RESULTS RENDERING ---
    const render404State = (message = "Nothing matched your search.") => {
        if(topResultCard) topResultCard.innerHTML = '';
        if(resultsListContainer) resultsListContainer.innerHTML = ''; 
        if(window.BlazeX && window.BlazeX.show404) {
            window.BlazeX.show404('results-list-container', message);
        } else if(resultsListContainer) {
            resultsListContainer.innerHTML = `<div class="text-center p-16 col-span-full"><i class="fas fa-ghost text-4xl text-gray-700 mb-4 block"></i><p class="text-gray-400 text-sm md:text-base">${message}</p></div>`;
        }
    };

    const handleSearchSubmit = async (term) => {
        if(searchInput) searchInput.blur();
        saveSearchHistory(term);
        switchView('results');
        
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
            const reqUrl = `${API_BASE}${endpoint}?${queryParams.toString()}`;
            
            const res = await fetch(reqUrl);
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
            const topImg = topAnime.image || topAnime.poster;
            const topType = topAnime.type || 'TV';

            const checkLibraryStatus = (animeId) => {
                const profile = window.app.state?.activeProfile || null;
                if (profile && profile.library && profile.uid && !profile.uid.startsWith('anon_')) {
                    return profile.library.some(item => String(item.id) === String(animeId));
                }
                return false;
            };

            const isTopAdded = checkLibraryStatus(topAnime.id);
            const topSafeTitle = topAnime.title.replace(/'/g, "\\'");

            const libraryBtnHtml = isTopAdded 
                ? `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}')" class="bg-[#F47521] text-black px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:bg-white transition border border-[#F47521] flex items-center gap-2 shadow-lg shadow-[#F47521]/20"><i class="fas fa-check"></i> Added</button>`
                : `<button onclick="window.app.toggleSearchLibraryClick(event, '${topAnime.id}', '${topSafeTitle}', '${topImg}')" class="bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:border-[#F47521] hover:bg-black transition border border-white/10 flex items-center gap-2"><i class="fas fa-plus"></i> Save</button>`;

            if(topResultCard) {
                topResultCard.innerHTML = `
                <div onclick="window.saveAndGo('${topAnime.id}', '${topSafeTitle}', '${topImg}', '${topType}', '${topSubEps}', '${topDubEps}')" class="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer hover:border-[#F47521] transition-all duration-300 group shadow-2xl bg-[#0a0a0a] min-h-[280px] md:min-h-[350px] flex items-end">
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
                                <button onclick="event.stopPropagation(); window.saveAndGo('${topAnime.id}', '${topSafeTitle}', '${topImg}', '${topType}', '${topSubEps}', '${topDubEps}')" class="bg-white text-black px-5 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase tracking-widest hover:bg-[#F47521] hover:text-white transition shadow-lg"><i class="fas fa-play mr-2"></i> Watch Now</button>
                                ${libraryBtnHtml}
                                <button onclick="event.stopPropagation(); window.app.shareAnime('${topAnime.id}', '${topSafeTitle}')" class="bg-[#111]/80 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg font-black text-[11px] md:text-xs uppercase hover:text-blue-400 hover:border-blue-400 transition border border-white/10 flex items-center gap-2">
                                    <i class="fas fa-share-nodes"></i> Share
                                </button>
                                
                                <div class="flex gap-2 ml-auto text-[10px] md:text-xs font-bold mt-2 md:mt-0 w-full md:w-auto justify-end">
                                    <span class="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded border border-white/10">${topType}</span>
                                    <span class="bg-[#F47521]/20 border border-[#F47521]/40 text-[#F47521] px-2 py-1 rounded">SUB ${topSubEps}</span>
                                    ${topDubEps > 0 ? `<span class="bg-purple-500/20 border border-purple-500/40 text-purple-400 px-2 py-1 rounded">DUB ${topDubEps}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }

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
                    <div onclick="window.saveAndGo('${anime.id}', '${safeTitle}', '${img}', '${aType}', '${aSub}', '${aDub}')" class="flex gap-4 items-stretch bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3 rounded-xl cursor-pointer hover:border-[#F47521]/50 border border-white/5 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 group h-full">
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
            } else if(resultsListContainer) {
                resultsListContainer.innerHTML = ''; 
            }
        } catch (err) {
            render404State("Network error occurred while communicating with the database.");
        }
    };

    // --- 6. SAVE TO SUBCOLLECTION LOGIC ---
    window.app.toggleSearchLibraryClick = async (event, id, title, img) => {
        event.stopPropagation(); 
        const profile = window.app.state?.activeProfile || null;
        if (!profile || !profile.uid || profile.uid.startsWith('anon_')) {
            if (window.app.components && window.app.components.auth) window.app.components.auth();
            else if (window.app.showCustomAlert) window.app.showCustomAlert("Log in to save to your Library!", "error");
            return;
        }

        if(!profile.library) profile.library = [];
        
        const docIdStr = String(id);
        const formattedAnime = { id: docIdStr, title, img, timestamp: Date.now() };
        
        const existingItemIndex = profile.library.findIndex(item => String(item.id) === docIdStr);
        const isCurrentlyAdded = existingItemIndex !== -1;
        const btn = event.currentTarget;

        try {
            const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
            // Clean ID string format applied perfectly for Firestore Library
            const libDocRef = firestore.doc(window.app.db, "users", profile.uid, "library", docIdStr);

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
                
                await firestore.deleteDoc(libDocRef);
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
                
                await firestore.setDoc(libDocRef, formattedAnime);
                if (window.app.showCustomAlert) window.app.showCustomAlert("Added to Library!", "success");
            }
        } catch (error) { 
            console.error("Firebase Library Sync Error:", error);
            if (window.app.showCustomAlert) window.app.showCustomAlert("Failed to sync with cloud.", "error");
        }
    };

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

    initSearchPage();
});
