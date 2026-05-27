// episodestab.js

window.app.components.episodestab = () => {
    const contentArea = document.getElementById('dynamic-tab-content-area');
    if (!contentArea) return;

    const data = window.app.state.currentAnimePage;
    const ani = data.aniList;
    const raw = data.rawPayload;

    // Detect if the series is upcoming or hasn't released broadcast files yet
    const isUpcoming = (raw?.status && raw.status.toString().toLowerCase().includes('upcoming')) || 
                       (ani?.status && ani.status.toString().toLowerCase().includes('not_yet_released'));

    if (isUpcoming) {
        const expectedDate = raw?.aired || raw?.premiered || "TBA 2026";
        const liveCountdown = data.scheduleCountdown ? `<p class="text-sm font-black text-[#F47521] bg-[#F47521]/10 px-4 py-2 border border-[#F47521]/20 rounded-md tracking-wider max-w-sm mx-auto uppercase"><i class="fas fa-satellite-dish mr-1.5"></i> Next Ep Live: ${data.scheduleCountdown}</p>` : '';

        contentArea.innerHTML = `
            <div class="w-full text-center py-16 bg-[#0a0a0a] rounded-xl border border-white/5 p-6 flex flex-col gap-4 max-w-2xl mx-auto shadow-xl animate-fade-in">
                <i class="fas fa-hourglass-start text-4xl text-[#F47521] animate-bounce"></i>
                <h3 class="text-xl font-black text-white tracking-tight uppercase">Upcoming Transmission</h3>
                <p class="text-gray-400 text-xs max-w-md mx-auto leading-relaxed">This series has been successfully indexed on Blaze-X but hasn't broadcasted episodes yet.</p>
                <div class="my-2">
                    <span class="text-gray-600 uppercase font-black text-[10px] tracking-widest block mb-1">Expected Timeline</span>
                    <p class="text-white text-sm font-bold capitalize">${expectedDate}</p>
                </div>
                ${liveCountdown}
            </div>
        `;
        return;
    }

    // FIXED: Directly reading the totalEpisodes index safely from your verified schema results
    const totalEps = data.episodes ? data.episodes.length : 0;
    let dropdownHtml = '';
    let currentLabel = 'N/A';

    if (totalEps > 0) {
        for (let i = 0; i < totalEps; i += 100) {
            const startNum = i + 1;
            const endNum = Math.min(i + 100, totalEps);
            const val = `${startNum}-${endNum}`;
            const label = `Episodes ${startNum} - ${endNum}`;
            if (!window.app.state.epRangeFilter && i === 0) window.app.state.epRangeFilter = val;
            if (window.app.state.epRangeFilter === val) currentLabel = label;
            dropdownHtml += `<button onclick="window.app.selectDropdownOption('${label}', '${val}')" class="w-full text-left px-4 py-3 text-xs md:text-sm font-bold text-white hover:bg-[#F47521] hover:text-black transition-colors border-b border-white/5 last:border-0">${label}</button>`;
        }
    } else {
        currentLabel = 'No Episodes';
        dropdownHtml = `<div class="px-4 py-3 text-xs text-gray-500">N/A</div>`;
    }

    contentArea.innerHTML = `
        <div class="animate-fade-in">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#0a0a0a] p-3 md:p-4 rounded-xl border border-white/5 shadow-md">
                <div class="relative w-full sm:w-64" id="custom-dropdown-container">
                    <button id="custom-dropdown-btn" onclick="window.app.toggleDropdown()" class="flex items-center justify-between w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm font-bold py-3 pl-4 pr-4 rounded-lg outline-none hover:border-white/30 focus:border-[#F47521] transition-all">
                        <span id="custom-dropdown-selected">${currentLabel}</span>
                        <i id="custom-dropdown-icon" class="fas fa-chevron-down text-gray-400 text-xs transition-transform duration-300"></i>
                    </button>
                    <div id="custom-dropdown-menu" class="absolute left-0 mt-2 w-full bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 hidden overflow-hidden flex flex-col max-h-60 overflow-y-auto hide-scrollbar">
                        ${dropdownHtml}
                    </div>
                </div>
                <div class="relative w-full sm:w-auto flex-1 max-w-sm">
                    <input type="number" id="episode-search-box" value="${window.app.state.epSearchValue}" onkeyup="window.app.runEpisodeSearch(this.value)" placeholder="Search episode #..." class="w-full bg-[#111] border border-white/10 text-white text-xs md:text-sm py-3 pl-10 pr-4 rounded-lg outline-none focus:border-[#F47521] placeholder-gray-600 transition-colors">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                </div>
            </div>
            <div id="numeric-episodes-grid" class="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-14 lg:grid-cols-20 gap-2"></div>
        </div>
    `;
    
    window.app.renderNumericEpisodeGrid();
};

window.app.toggleDropdown = () => {
    const menu = document.getElementById('custom-dropdown-menu');
    const icon = document.getElementById('custom-dropdown-icon');
    if (!menu) return;
    if(menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
};

window.app.selectDropdownOption = (label, val) => {
    window.app.state.epRangeFilter = val;
    document.getElementById('custom-dropdown-selected').innerText = label;
    window.app.toggleDropdown();
    document.getElementById('episode-search-box').value = ''; 
    window.app.state.epSearchValue = '';
    window.app.renderNumericEpisodeGrid();
};

window.app.runEpisodeSearch = (val) => {
    window.app.state.epSearchValue = val;
    window.app.renderNumericEpisodeGrid();
};

window.app.renderNumericEpisodeGrid = () => {
    const gridDiv = document.getElementById('numeric-episodes-grid');
    if (!gridDiv || !window.app.state.currentAnimePage.episodes) return;

    const data = window.app.state.currentAnimePage;
    const searchVal = window.app.state.epSearchValue;
    const rangeArray = window.app.state.epRangeFilter ? window.app.state.epRangeFilter.split('-') : [];
    
    let episodesToRender = data.episodes || [];

    if (searchVal !== '') {
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.episode_no;
            return epNumber && epNumber.toString().includes(searchVal);
        });
    } else if (rangeArray.length === 2) {
        const startEpNum = parseInt(rangeArray[0]);
        const endEpNum = parseInt(rangeArray[1]);
        episodesToRender = episodesToRender.filter((ep) => {
            const epNumber = ep.episode_no;
            return epNumber && epNumber >= startEpNum && epNumber <= endEpNum;
        });
    }

    if (episodesToRender.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-sm">No episodes listed yet.</div>`;
        return;
    }

    let gridHtml = '';
    episodesToRender.forEach((ep) => {
        const epNumber = ep.episode_no;
        
        // FIXED: Using ep.id directly as specified by your endpoint documentation schema parameters
        const targetEpisodeId = ep.id; 
        
        const epTitleLower = (ep.title || '').toLowerCase();
        const isActuallyFiller = epTitleLower.includes('filler') || epTitleLower.includes('recap'); 
        
        const fillerIconDot = isActuallyFiller ? `<div class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></div>` : '';
        const hoverClasses = isActuallyFiller ? 'border-red-500/30 text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-sm' : 'border-white/5 text-gray-300 hover:bg-[#F47521] hover:text-black hover:border-[#F47521] shadow-sm';

        gridHtml += `
            <button onclick="window.app.resolveEpisodeStreamAndRoute('${targetEpisodeId}', ${epNumber}, '${data.id}')" class="relative w-full aspect-square flex items-center justify-center rounded border transition-all duration-200 group bg-white/5 ${hoverClasses}">
                <span class="font-bold text-xs md:text-sm">${epNumber}</span>
                ${fillerIconDot}
            </button>
        `;
    });
    gridDiv.innerHTML = gridHtml;
};

// --- RESOLVE EPISODE STREAM & ROUTE TO PLAYER ---
window.app.resolveEpisodeStreamAndRoute = async (episodeId, episodeNumber, animeId) => {
    try {
        const baseUrl = 'https://anikoto-api-xi.vercel.app';
        
        const targetServer = 'hd-1';
        const targetType = 'sub';

        // Fetch streaming parameters directly using the verified schema layout rules
        const streamUrl = `${baseUrl}/api/stream?id=${encodeURIComponent(episodeId)}&server=${targetServer}&type=${targetType}`;
        const response = await fetch(streamUrl);
        const json = await response.json();

        let verifiedStreamData = null;
        if (json && json.success && json.results?.streamingLink) {
            verifiedStreamData = json.results;
        } else {
            console.log("Primary stream window empty. Initializing secondary fallback request thread...");
            const fallbackUrl = `${baseUrl}/api/stream/fallback?id=${encodeURIComponent(episodeId)}&server=${targetServer}&type=${targetType}`;
            const fbResponse = await fetch(fallbackUrl);
            const fbJson = await fbResponse.json();
            if (fbJson && fbJson.success && fbJson.results?.streamingLink) {
                verifiedStreamData = fbJson.results;
            }
        }

        if (!verifiedStreamData) {
            alert("Sources are currently caching on the host mirrors. Try another server or try again in a few minutes!");
            return;
        }

        // Cache streaming object keys securely inside global application data trees
        window.app.state.resolvedStreamManifest = verifiedStreamData;

        // Verify or create anonymous profile state tokens
        if (!window.app.state.activeProfile || !window.app.state.activeProfile.uid) {
            const randomNum = Math.floor(Math.random() * 90000) + 10000;
            const guestProfile = {
                uid: 'anon_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
                name: `Guest-${randomNum}`,
                email: "Guest Account",
                pfp: `pfp${Math.floor(Math.random() * 10) + 1}.jpeg`,
                history: [],
                watchlist: [],
                createdAt: new Date().toISOString()
            };
            window.app.state.activeProfile = guestProfile;
            localStorage.setItem('blazex_user_profile', JSON.stringify(guestProfile));
        }

        window.location.href = `play.html?id=${encodeURIComponent(episodeId)}&anime=${animeId}&ep=${episodeNumber}`;

    } catch (error) {
        console.error("Source stream compilation exception encountered:", error);
        window.location.href = `play.html?id=${encodeURIComponent(episodeId)}&anime=${animeId}&ep=${episodeNumber}`;
    }
};
