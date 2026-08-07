// continue_watching.js - Horizontal Continue Watching Slider with Deletion & Progress

window.app = window.app || {};
window.app.components = window.app.components || {};

// --- DELETION LOGIC ---
window.app.deleteContinueWatching = (event, animeId) => {
    event.stopPropagation(); 
    const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
    const uid = profile.uid || 'guest';
    
    // Scan and remove all history/time keys for this specific anime
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`blazex_progress_${uid}_${animeId}`) || key.startsWith(`blazex_time_${uid}_${animeId}`))) {
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
    
    // Re-render the slider instantly
    if (window.app.components.continueWatching) window.app.components.continueWatching();
};

window.app.clearAllContinueWatching = () => {
    if (!confirm("Are you sure you want to clear all your watch history?")) return;
    
    const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
    const uid = profile.uid || 'guest';
    
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`blazex_progress_${uid}_`) || key.startsWith(`blazex_time_${uid}_`))) {
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
    
    // Re-render the slider instantly
    if (window.app.components.continueWatching) window.app.components.continueWatching();
};


// --- SLIDER RENDERING ---
window.app.components.continueWatching = async () => {
    const container = document.getElementById('history-container');
    if (!container) return;

    // 1. IDENTIFY USER AND SCAN LOCAL STORAGE
    const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
    const uid = profile.uid || 'guest';
    const prefix = `blazex_progress_${uid}_`;
    
    let historyItems = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            const animeId = key.replace(prefix, '');
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.lastWatchedEp) {
                    const timeKey = `blazex_time_${uid}_${animeId}_${data.lastWatchedEp}`;
                    const timeProgress = parseFloat(localStorage.getItem(timeKey)) || 0;
                    
                    if (timeProgress > 10) {
                        historyItems.push({
                            animeId: animeId,
                            epNum: parseInt(data.lastWatchedEp),
                            slug: data.lastSlug || String(data.lastWatchedEp),
                            time: timeProgress
                        });
                    }
                }
            } catch(e) {}
        }
    }

    if (historyItems.length === 0) {
        container.innerHTML = ''; 
        return;
    }

    historyItems = historyItems.reverse().slice(0, 10);

    // 2. SHOW HORIZONTAL LOADING SKELETON (WITH PROPER SPACING)
    container.innerHTML = `
        <div class="py-6 relative overflow-visible">
            <div class="px-4 md:px-8 mb-4 flex items-center justify-between">
                <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Continue Watching</h2>
            </div>
            <div class="flex gap-4 md:gap-5 overflow-hidden pl-4 md:pl-8">
                ${[1, 2, 3].map(() => `
                    <div class="min-w-[240px] md:min-w-[320px] aspect-[16/9] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 3. FETCH METADATA
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const enrichedItems = [];

        for (const item of historyItems) {
            try {
                const res = await fetch(`${baseUrl}/api/info?id=${item.animeId}`);
                const json = await res.json();
                if (json && json.success && json.data) {
                    const title = json.data.title || 'Unknown Title';
                    const image = json.data.banner || json.data.poster || 'https://via.placeholder.com/1280x720/111/fff';
                    enrichedItems.push({ ...item, title, image });
                }
            } catch(e) {}
        }

        if (enrichedItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 4. RENDER HORIZONTAL CARDS WITH BUTTONS
        let cardsHtml = enrichedItems.map(item => {
            const targetUrl = `play.html?id=${encodeURIComponent(item.slug)}&anime=${item.animeId}&ep=${item.epNum}&type=sub`;
            let progressPct = (item.time / 1440) * 100;
            if (progressPct > 100) progressPct = 100;
            if (progressPct < 2) progressPct = 2; 

            return `
            <div class="snap-start shrink-0 w-[240px] md:w-[320px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-20"
                 onclick="window.location.href='${targetUrl}'">
                
                <div class="relative w-full aspect-[16/9] rounded-lg overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.35)] border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-[#111]">
                    
                    <img src="${item.image}" loading="lazy" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 object-center">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none"></div>

                    <!-- Individual Delete Button -->
                    <button onclick="window.app.deleteContinueWatching(event, '${item.animeId}')" 
                            class="absolute top-2 right-2 z-[40] w-7 h-7 bg-black/60 hover:bg-red-600 backdrop-blur-md rounded-full text-white flex items-center justify-center transition-colors border border-white/10 shadow-lg">
                        <i class="fas fa-times text-xs"></i>
                    </button>

                    <!-- Play Icon Overlay -->
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                        <div class="w-12 h-12 md:w-14 md:h-14 bg-[#F47521] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,117,33,0.6)]">
                            <i class="fas fa-play text-white ml-1 text-lg"></i>
                        </div>
                    </div>

                    <!-- Details -->
                    <div class="absolute bottom-4 left-3 right-3 z-20 pointer-events-none">
                        <h3 class="text-sm md:text-base text-white font-black truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">${item.title}</h3>
                        <p class="text-[10px] md:text-xs text-gray-300 font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Episode ${item.epNum}</p>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="absolute bottom-0 left-0 w-full h-1.5 bg-white/20 z-30">
                        <div class="h-full bg-[#F47521] shadow-[0_0_10px_#F47521] transition-all duration-500 ease-out" style="width: ${progressPct}%"></div>
                    </div>

                </div>
            </div>
            `;
        }).join('');

        // Adjusted structure so padding is handled like the Top 10 slider (away from the edge)
        container.innerHTML = `
            <div class="py-6 relative overflow-visible">
                <div class="px-4 md:px-8 flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Continue Watching
                    </h2>
                    
                    <!-- Clear All Button -->
                    <button onclick="window.app.clearAllContinueWatching()" class="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span class="hidden md:inline">Clear All</span>
                    </button>
                </div>
                
                <div class="relative group/slider">
                    <button id="cw-slide-left-btn" class="hidden md:flex absolute left-2 top-[50%] -translate-y-1/2 z-30 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <!-- Track padding set to match titles, keeping it off the exact left edge -->
                    <div id="cw-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-6 pt-2 pl-4 md:pl-8 pr-12">
                        ${cardsHtml}
                    </div>
                    
                    <button id="cw-slide-right-btn" class="hidden md:flex absolute right-2 top-[50%] -translate-y-1/2 z-30 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 5. ATTACH SCROLL LOGIC
        const track = document.getElementById('cw-slider-track');
        const leftBtn = document.getElementById('cw-slide-left-btn');
        const rightBtn = document.getElementById('cw-slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            const scrollAmount = window.innerWidth > 768 ? 600 : 300;
            leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
            rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

    } catch (error) {
        container.innerHTML = ''; 
    }
};
