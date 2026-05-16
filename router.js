// router.js

window.app.router = {
    init: () => {
        // Listen to hash changes across the application window
        window.addEventListener('hashchange', window.app.router.handleRoute);
        window.addEventListener('DOMContentLoaded', window.app.router.handleRoute);
    },

    handleRoute: async () => {
        const hash = window.location.hash.substring(1) || 'home';
        
        // Target container mounts
        const homeView = document.getElementById('home-view');
        const dynamicView = document.getElementById('dynamic-view');
        
        // Reset scrolling position to top on page switches
        document.getElementById('main-content').scrollTop = 0;

        // Route: Home
        if (hash === 'home') {
            window.app.state.currentView = 'home';
            dynamicView.classList.add('hidden');
            homeView.classList.remove('hidden');
            if (window.app.renderHome) window.app.renderHome();
        } 
        
        // Route: Details Page (e.g., #details/8701)
        else if (hash.startsWith('details/')) {
            window.app.state.currentView = 'details';
            homeView.classList.add('hidden');
            dynamicView.classList.remove('hidden');
            
            const animeId = hash.replace('details/', '');
            window.app.router.renderDetailsPage(animeId);
        } 
        
        // Route: Watch Page / Locked Player (e.g., #watch/136197/1/sub)
        else if (hash.startsWith('watch/')) {
            window.app.state.currentView = 'watch';
            homeView.classList.add('hidden');
            dynamicView.classList.remove('hidden');
            
            // Syntax template: embedId/episodeNumber/language
            const [embedId, epNum, lang] = hash.replace('watch/', '').split('/');
            window.app.router.renderPlayerPage(embedId, epNum, lang || 'sub');
        }
    },

    // View Handler: Details Card Generation
    renderDetailsPage: async (id) => {
        const target = document.getElementById('dynamic-view');
        target.innerHTML = '<div class="h-[60vh] flex items-center justify-center"><div class="tk-loader"><div class="tk-dot tk-dot-1"></div><div class="tk-dot tk-dot-2"></div></div></div>';
        
        const details = await window.app.api.fetch(`/series/${id}`);
        if (!details || !details.data) {
            target.innerHTML = `<p class="text-center py-20 text-gray-500 text-sm">Failed to fetch data details.</p>`;
            return;
        }

        const anime = details.data;
        const episodes = anime.episodes_list || anime.episodes || [];

        target.innerHTML = `
            <div class="animate-fade-in pb-24">
                <div class="h-[40vh] relative overflow-hidden">
                    <img src="${anime.background_image || anime.poster}" class="blur-backdrop absolute w-full h-full object-cover opacity-40">
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                </div>
                <div class="px-4 -mt-24 relative z-10">
                    <h1 class="text-2xl font-black text-white mb-4 drop-shadow-md">${anime.title}</h1>
                    <p class="text-gray-400 text-xs leading-relaxed mb-6">${anime.description || 'No description available.'}</p>
                    
                    <h3 class="text-sm font-bold text-gray-300 border-l-4 border-[#F47521] pl-2 mb-4">EPISODE DIRECTORY</h3>
                    <div class="grid grid-cols-1 gap-2">
                        ${episodes.map((ep, idx) => {
                            const num = ep.number || (idx + 1);
                            // Fallback strings reading custom keys safely
                            const embedId = ep.episode_embed_id || ep.id;
                            return `
                                <div onclick="window.location.hash = 'watch/${embedId}/${num}/sub'" class="flex items-center gap-3 p-3 bg-[#111] rounded-lg border border-white/5 active:border-[#F47521] cursor-pointer">
                                    <i class="fas fa-play-circle text-[#F47521] text-lg"></i>
                                    <span class="text-sm text-gray-200 font-bold">Episode ${num}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // View Handler: Hiding & Masking Proxy Player 
    renderPlayerPage: (embedId, epNum, lang) => {
        const target = document.getElementById('dynamic-view');
        
        // STRICTLY ENFORCED HIDDEN URL ROUTE VIA PROXIED PATHS
        const cleanInternalURL = `/stream/s-2/${embedId}/${lang}`;

        target.innerHTML = `
            <div class="w-full h-full flex flex-col bg-black animate-fade-in pb-20">
                <!-- Secured Proxied Frame Structure -->
                <div class="w-full aspect-video bg-black flex-none border-b border-white/10">
                    <iframe id="secure-player" src="${cleanInternalURL}" class="w-full h-full border-none" allowfullscreen></iframe>
                </div>
                
                <div class="p-4 flex-1">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-lg font-bold text-white">Streaming: Episode ${epNum}</h2>
                        <button onclick="window.history.back()" class="text-xs text-gray-400 border border-gray-800 px-3 py-1.5 rounded-md"><i class="fas fa-arrow-left mr-1"></i> Back</button>
                    </div>

                    <!-- Core Sub/Dub Interface -->
                    <h3 class="text-xs font-bold text-gray-500 mb-2 uppercase">Audio Options</h3>
                    <div class="flex gap-2 bg-[#141414] p-1 rounded-md border border-white/5 w-max">
                        <button onclick="window.location.hash = 'watch/${embedId}/${epNum}/sub'" class="px-5 py-1.5 rounded font-bold text-xs ${lang === 'sub' ? 'bg-[#F47521] text-black' : 'text-gray-400'}">SUB</button>
                        <button onclick="window.location.hash = 'watch/${embedId}/${epNum}/dub'" class="px-5 py-1.5 rounded font-bold text-xs ${lang === 'dub' ? 'bg-[#F47521] text-black' : 'text-gray-400'}">DUB</button>
                    </div>
                </div>
            </div>
        `;
    }
};
