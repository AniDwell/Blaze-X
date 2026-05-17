// info.js

window.app.components.info = async () => {
    const container = document.getElementById('info-container');
    if (!container) return;

    // 1. Get Anime ID from the URL (e.g., info.html?id=8630)
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id');

    if (!animeId) {
        container.innerHTML = `
            <div class="mt-32 text-center text-gray-400 font-bold tracking-widest uppercase flex flex-col items-center">
                <i class="fas fa-search text-4xl mb-4 text-[#F47521]"></i>
                No Anime Selected
                <button onclick="window.location.href='index.html'" class="mt-6 text-xs text-white bg-white/10 px-6 py-2 rounded hover:bg-[#F47521] transition-colors">Go Home</button>
            </div>`;
        return;
    }

    // Show initial loader
    container.innerHTML = `
        <div class="w-full h-screen flex items-center justify-center -mt-10">
            <div class="tk-loader scale-75"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div>
        </div>
    `;

    try {
        // 2. Safely Fetch data using standard JS (Bypasses missing app.api functions)
        const baseUrl = (window.app && window.app.config && window.app.config.anikotoBase) 
            ? window.app.config.anikotoBase 
            : 'https://snowy-bonus-9c22.prashant-yash69.workers.dev';
            
        const rawResponse = await fetch(`${baseUrl}/series/${animeId}`);
        const response = await rawResponse.json();
        
        // --- NEW JSON PARSER FIX ---
        // Safely extract the nested "anime" and "episodes" objects based on your API structure
        const payload = response.data || response; 
        const anime = payload.anime || payload; // The details object
        const episodesList = payload.episodes || anime.episodes || []; // The episodes array

        if (!anime || (!anime.title && !anime.name)) {
            throw new Error("Invalid anime data received: Title missing.");
        }

        // 3. Fetch high-res assets & Trailer from AniList
        let trailerId = null;
        let bannerImage = anime.background_image || anime.poster || anime.image || anime.cover || 'https://via.placeholder.com/1280x720/111/fff?text=No+Background';
        const rawTitle = anime.title || anime.name || 'Unknown Title';
        const cleanTitle = rawTitle.replace(/\(Dub\)|\(Sub\)/gi, '').trim();

        try {
            const query = `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { bannerImage trailer { id site } } }`;
            const aniRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables: { search: cleanTitle } })
            });
            const aniData = await aniRes.json();
            if (aniData?.data?.Media) {
                if (aniData.data.Media.bannerImage) bannerImage = aniData.data.Media.bannerImage;
                if (aniData.data.Media.trailer?.site === "youtube") trailerId = aniData.data.Media.trailer.id;
            }
        } catch (e) { 
            console.log("AniList fetch failed for trailer/banner."); 
        }

        // 4. Smart Play Button Logic (Check User History)
        const profile = window.app.state && window.app.state.activeProfile ? window.app.state.activeProfile : null;
        let playBtnText = "Play E01";
        let targetEpisodeId = episodesList.length > 0 ? episodesList[0].id : '';
        
        if (profile && profile.history) {
            const historyItem = profile.history.find(h => h.animeId === animeId);
            if (historyItem) {
                playBtnText = `Resume E${historyItem.episodeNumber || '?'}`;
                targetEpisodeId = historyItem.episodeId || targetEpisodeId;
            }
        }

        // 5. Render Hero Section
        const desc = anime.description || anime.synopsis || 'No description available for this series.';
        const displayPoster = anime.poster || anime.image || anime.cover || 'https://via.placeholder.com/800x1200/111/fff?text=No+Poster';
        
        let html = `
            <div class="relative w-full h-[60vh] md:h-[75vh] bg-black overflow-hidden mt-[60px] md:mt-0 border-b border-white/5">
                
                <div id="info-hero-bg" class="absolute inset-0 z-0 transition-opacity duration-1000">
                    <img src="${bannerImage}" class="w-full h-full object-cover opacity-50">
                </div>
                
                <div id="info-trailer-container" class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-0 transition-opacity duration-1000 bg-black"></div>
                
                <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent z-10"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent hidden md:block w-[70%] z-10"></div>

                <div class="absolute inset-0 z-20 flex flex-col md:flex-row items-end md:items-center px-4 pb-8 md:px-12 gap-6 md:gap-10">
                    
                    <div class="w-1/3 md:w-1/4 max-w-[200px] md:max-w-[280px] h-[50%] flex-shrink-0 rounded-lg overflow-hidden shadow-2xl border border-white/10 hidden md:block">
                        <img src="${displayPoster}" class="w-full h-full object-cover">
                    </div>

                    <div class="flex-1 w-full max-w-3xl">
                        <h1 class="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-2 md:mb-4 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] leading-tight tracking-tight">${rawTitle}</h1>
                        
                        <div class="relative mb-6">
                            <p id="info-desc" class="text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed drop-shadow-md pr-4">${desc}</p>
                            ${desc.length > 150 ? `<button onclick="window.app.toggleDesc()" id="read-more-btn" class="text-[#F47521] text-xs font-bold uppercase tracking-wider mt-2 hover:text-white transition-colors">See More <i class="fas fa-chevron-down ml-1"></i></button>` : ''}
                        </div>

                        <div class="flex flex-wrap gap-3">
                            <button onclick="if('${targetEpisodeId}' !== '') { window.location.href='play.html?id=${targetEpisodeId}&anime=${animeId}' } else { alert('No episodes available yet!') }" class="bg-[#F47521] text-black px-8 py-3 rounded shadow-[0_0_15px_rgba(244,117,33,0.3)] font-black text-xs md:text-sm uppercase tracking-wider hover:bg-white transition-all flex items-center gap-2">
                                <i class="fas fa-play"></i> ${playBtnText}
                            </button>
                            
                            <button onclick="window.app.addToLibrary('${animeId}', '${rawTitle.replace(/'/g, "\\'")}', '${displayPoster}')" class="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10 flex items-center gap-2">
                                <i class="fas fa-plus"></i> Library
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="max-w-7xl mx-auto px-4 md:px-12 py-8">
                <div class="flex justify-between items-end mb-6 border-b border-white/10 pb-4">
                    <h2 class="text-xl md:text-2xl font-black tracking-tight text-white">Episodes <span class="text-gray-500 text-sm md:text-base font-medium ml-2">(${episodesList.length})</span></h2>
                    
                    <div class="relative">
                        <select class="appearance-none bg-[#111] border border-white/10 text-white text-xs md:text-sm font-bold py-2 pl-4 pr-10 rounded cursor-pointer outline-none hover:border-white/30 transition-colors focus:border-[#F47521]">
                            <option>All Episodes</option>
                        </select>
                        <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                    </div>
                </div>

                <div class="flex flex-col gap-3">
        `;

        // 6. Render Episodes List
        if (episodesList.length > 0) {
            episodesList.forEach((ep, index) => {
                const epNum = ep.number || (index + 1);
                const epTitle = ep.title || `Episode ${epNum}`;
                const epThumb = bannerImage; 
                
                html += `
                    <div onclick="window.location.href='play.html?id=${ep.id}&anime=${animeId}'" class="group flex items-center gap-4 p-2 md:p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5">
                        
                        <div class="relative w-28 md:w-44 aspect-video rounded-md overflow-hidden flex-shrink-0 bg-black shadow-md border border-white/5 group-hover:border-[#F47521]/50 transition-colors">
                            <img src="${epThumb}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy">
                            <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-play text-white text-xl md:text-2xl drop-shadow-lg"></i>
                            </div>
                            <div class="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm">
                                E${epNum}
                            </div>
                        </div>

                        <div class="flex-1 min-w-0">
                            <h3 class="text-sm md:text-base font-bold text-white mb-1 truncate group-hover:text-[#F47521] transition-colors">${epTitle}</h3>
                            <p class="text-xs text-gray-400 line-clamp-2 md:line-clamp-3 leading-relaxed">Follow the events of ${rawTitle} in episode ${epNum}.</p>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-lg bg-white/5">
                    <i class="fas fa-video-slash text-3xl text-gray-500 mb-3"></i>
                    <p class="text-gray-400 text-sm font-medium">No episodes available for this series yet.</p>
                </div>`;
        }

        html += `</div></div>`;
        container.innerHTML = html;

        // 7. Trigger Trailer after 3 seconds
        if (trailerId) {
            setTimeout(() => {
                const trailerContainer = document.getElementById('info-trailer-container');
                const heroBg = document.getElementById('info-hero-bg');
                
                if (trailerContainer && heroBg) {
                    trailerContainer.innerHTML = `
                        <iframe class="absolute top-1/2 left-1/2 w-[150vw] h-[150vh] md:w-[150%] md:h-[150%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
                                src="https://www.youtube.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&playlist=${trailerId}&loop=1" 
                                frameborder="0" allow="autoplay; encrypted-media"></iframe>
                    `;
                    
                    setTimeout(() => {
                        trailerContainer.classList.remove('opacity-0');
                        heroBg.classList.add('opacity-0');
                    }, 1000); 
                }
            }, 3000);
        }

    } catch (error) {
        console.error("Info Page Error:", error);
        container.innerHTML = `
            <div class="w-full h-screen flex flex-col items-center justify-center mt-[-60px]">
                <i class="fas fa-exclamation-triangle text-5xl text-[#F47521] mb-4 drop-shadow-lg"></i>
                <h2 class="text-2xl font-black text-white mb-2">Oops! Something went wrong.</h2>
                <p class="text-gray-400 text-sm text-center max-w-md px-4 mb-6">${error.message}</p>
                <button onclick="window.location.reload()" class="bg-white/10 hover:bg-[#F47521] text-white px-6 py-2 rounded transition-colors font-bold text-sm tracking-wide uppercase">Try Again</button>
            </div>
        `;
    }
};

window.app.toggleDesc = () => {
    const desc = document.getElementById('info-desc');
    const btn = document.getElementById('read-more-btn');
    if (desc.classList.contains('line-clamp-3')) {
        desc.classList.remove('line-clamp-3');
        btn.innerHTML = `Show Less <i class="fas fa-chevron-up ml-1"></i>`;
    } else {
        desc.classList.add('line-clamp-3');
        btn.innerHTML = `See More <i class="fas fa-chevron-down ml-1"></i>`;
    }
};

window.app.addToLibrary = async (id, title, img) => {
    const profile = window.app.state && window.app.state.activeProfile ? window.app.state.activeProfile : null;
    
    if (!profile || !profile.uid) {
        if (window.app.components && window.app.components.auth) window.app.components.auth();
        else alert("Please log in or create an account to save to your Library!");
        return;
    }

    const formattedAnime = { id, title, img };

    if (profile.watchlist && profile.watchlist.some(item => item.id == formattedAnime.id)) {
        return alert("This series is already in your Library!");
    }

    if(!profile.watchlist) profile.watchlist = [];
    profile.watchlist.unshift(formattedAnime);
    
    const btn = event.currentTarget;
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check text-green-400"></i> Added`;
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    }

    try {
        const firestore = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js');
        const userRef = firestore.doc(window.app.db, "users", profile.uid);
        await firestore.updateDoc(userRef, { watchlist: firestore.arrayUnion(formattedAnime) });
    } catch (error) {
        console.error("Firebase update failed:", error);
        alert("Failed to sync to database, but added locally!");
    }
};
