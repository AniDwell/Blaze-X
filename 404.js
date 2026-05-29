// 404.js - Universal Error & Empty State Component for Blaze-X

window.BlazeX = window.BlazeX || {};

window.BlazeX.show404 = (containerId, message = "404 Not Found") => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[404.js] Container with ID '${containerId}' not found.`);
        return;
    }

    // List of premium anime GIFs provided by you
    const gifList = [
        "https://media.tenor.com/VOoSARm1t7wAAAAm/anime-girl.webp",
        "https://media.tenor.com/kovNYGXQ0mEAAAAm/carnival-phantasm-anime.webp",
        "https://media.tenor.com/bDgdFlOwH0AAAAAm/fire-emblem-maid-fire-emblem.webp",
        "https://media.tenor.com/BOUOFs824-gAAAAm/anime-girl.webp",
        "https://media.tenor.com/lNXAtuPrOHwAAAAm/question-sigh.webp",
        "https://media.tenor.com/3kWkvhe3gYAAAAA1/no-noooo.webp"
    ];

    // Select a random GIF on every load
    const randomGif = gifList[Math.floor(Math.random() * gifList.length)];

    // Inject the Universal 404 UI
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 w-full h-full min-h-[60vh] animate-fade-in">
            
            <div class="w-64 max-w-full flex flex-col items-center">
                
                <img src="${randomGif}" alt="404 Error" class="w-full h-40 object-contain object-bottom select-none pointer-events-none drop-shadow-xl" loading="lazy">
                
                <div class="w-full bg-[#121212] border border-white/10 border-t-0 rounded-b-2xl p-5 text-center shadow-2xl relative">
                    <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#F47521]/50 to-transparent"></div>
                    
                    <h3 class="text-white font-black uppercase tracking-widest text-sm mb-1">
                        ${message.includes("404") ? "404 Error" : "No Results"}
                    </h3>
                    <p class="text-xs text-gray-500 font-medium">${message}</p>
                </div>

            </div>

            <div class="flex items-center gap-3 mt-8">
                <button onclick="window.location.reload()" class="bg-[#F47521] text-black px-5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-white hover:scale-105 transition-all flex items-center gap-2">
                    <i class="fas fa-sync-alt"></i> Reload
                </button>
                <button onclick="window.location.href='index.html'" class="bg-white/5 border border-white/10 text-white px-5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                    <i class="fas fa-home"></i> Home
                </button>
            </div>

        </div>
    `;
};
