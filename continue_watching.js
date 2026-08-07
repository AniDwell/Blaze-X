// continue_watching.js - Horizontal Continue Watching Slider with Progress Bar

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.continueWatching = async () => {
    // Hooks into the <div id="history-container"> already in your index.html
    const container = document.getElementById('history-container');
    if (!container) return;

    // 1. IDENTIFY USER AND SCAN LOCAL STORAGE
    const profile = window.app.state?.activeProfile || JSON.parse(localStorage.getItem('blazex_user_profile') || '{}');
    const uid = profile.uid || 'guest';
    const prefix = `blazex_progress_${uid}_`;
    
    let historyItems = [];

    // Scan localStorage for history keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            const animeId = key.replace(prefix, '');
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.lastWatchedEp) {
                    // Fetch the exact time progress saved by player.js
                    const timeKey = `blazex_time_${uid}_${animeId}_${data.lastWatchedEp}`;
                    const timeProgress = parseFloat(localStorage.getItem(timeKey)) || 0;
                    
                    // Only add if they actually started watching it (more than 10 seconds)
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

    // Limit to 10 most recent (localStorage doesn't store timestamps by default, so we take the last discovered)
    historyItems = historyItems.reverse().slice(0, 10);

    // 2. SHOW HORIZONTAL LOADING SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Continue Watching</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3].map(() => `
                    <div class="min-w-[240px] md:min-w-[320px] aspect-[16/9] bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 3. FETCH METADATA FOR WATCHED ANIME
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        const enrichedItems = [];

        for (const item of historyItems) {
            try {
                const res = await fetch(`${baseUrl}/api/info?id=${item.animeId}`);
                const json = await res.json();
                if (json && json.success && json.data) {
                    const title = json.data.title || 'Unknown Title';
                    // Prefer banner for 16:9 cards, fallback to poster
                    const image = json.data.banner || json.data.poster || 'https://via.placeholder.com/1280x720/111/fff';
                    enrichedItems.push({ ...item, title, image });
                }
            } catch(e) {}
        }

        if (enrichedItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // 4. RENDER HORIZONTAL CARDS WITH PROGRESS BARS
        let cardsHtml = enrichedItems.map(item => {
            const safeTitle = item.title.replace(/'/g, "\\'");
            
            // Standard anime episode duration is ~24 mins (1440 seconds). 
            // We calculate percentage based on this since local storage only has raw time.
            let progressPct = (item.time / 1440) * 100;
            if (progressPct > 100) progressPct = 100;
            if (progressPct < 2) progressPct = 2; // Show at least a tiny sliver of orange

            // Direct route to player.js
            const targetUrl = `play.html?id=${encodeURIComponent(item.slug)}&anime=${item.animeId}&ep=${item.epNum}&type=sub`;

            return `
            <div class="snap-start shrink-0 w-[240px] md:w-[320px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-10"
                 onclick="window.location.href='${targetUrl}'">
                
                <div class="relative w-full aspect-[16/9] rounded-lg overflow-hidden shadow-lg border border-white/10 group-hover:border-[#F47521]/70 transition-colors bg-[#111]">
                    
                    <!-- 16:9 Thumbnail -->
                    <img src="${item.image}" loading="lazy" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 object-center">
                    
                    <!-- Dark Overlay for text readability -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none"></div>

                    <!-- Center Play Button (Visible on Hover) -->
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                        <div class="w-12 h-12 md:w-14 md:h-14 bg-[#F47521] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,117,33,0.6)]">
                            <i class="fas fa-play text-white ml-1 text-lg"></i>
                        </div>
                    </div>

                    <!-- Text Data -->
                    <div class="absolute bottom-4 left-3 right-3 z-20 pointer-events-none">
                        <h3 class="text-sm md:text-base text-white font-black truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">${item.title}</h3>
                        <p class="text-[10px] md:text-xs text-gray-300 font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Episode ${item.epNum}</p>
                    </div>
                    
                    <!-- Orange Progress Bar -->
                    <div class="absolute bottom-0 left-0 w-full h-1.5 bg-white/20 z-30">
                        <div class="h-full bg-[#F47521] shadow-[0_0_10px_#F47521] transition-all duration-500 ease-out" style="width: ${progressPct}%"></div>
                    </div>

                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Continue Watching
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="cw-slide-left-btn" class="hidden md:flex absolute -left-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="cw-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
                        ${cardsHtml}
                    </div>
                    
                    <button id="cw-slide-right-btn" class="hidden md:flex absolute -right-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
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
        console.error("Continue Watching Slider Error:", error);
        container.innerHTML = ''; 
    }
};
