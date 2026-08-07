// news_slider.js - Crunchyroll RSS Feed + Custom Proxy + Bottom-Sheet Modal

window.app = window.app || {};
window.app.components = window.app.components || {};

// Cache for news items so the modal can access them
window.app.newsCache = [];

window.app.components.newsSlider = async () => {
    const container = document.getElementById('news-container');
    if (!container) return;

    // YOUR CUSTOM PROXY
    const customProxyUrl = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url=';

    // 1. SHOW SKELETON
    container.innerHTML = `
        <div class="px-4 md:px-8 py-6 relative">
            <h2 class="text-xl md:text-2xl font-black text-white mb-4 border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">Top Anime News</h2>
            <div class="flex gap-4 md:gap-5 overflow-hidden">
                ${[1, 2, 3, 4].map(() => `
                    <div class="min-w-[280px] md:min-w-[400px] h-[260px] bg-white/5 animate-pulse rounded-xl border border-white/5"></div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        // 2. FETCH CRUNCHYROLL RSS VIA YOUR CUSTOM PROXY
        const targetRss = 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss';
        const res = await fetch(customProxyUrl + encodeURIComponent(targetRss));
        const xmlText = await res.text();
        
        // Parse XML to DOM
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const items = Array.from(xmlDoc.querySelectorAll("item"));

        if (items.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // Map XML nodes into a usable JSON structure
        let newsItems = items.map(item => {
            const title = item.querySelector("title")?.textContent || "";
            const link = item.querySelector("link")?.textContent || "";
            const pubDate = item.querySelector("pubDate")?.textContent || "";
            
            // Handle content namespace for full articles
            const contentEncoded = item.getElementsByTagName("content:encoded");
            const description = item.querySelector("description")?.textContent || "";
            const content = contentEncoded.length > 0 ? contentEncoded[0].textContent : description;

            // Look for Crunchyroll's media namespaces for high-res thumbnails
            let mediaUrl = "";
            const mediaContent = item.getElementsByTagName("media:content")[0];
            const mediaThumb = item.getElementsByTagName("media:thumbnail")[0];
            if (mediaContent) mediaUrl = mediaContent.getAttribute("url") || "";
            if (!mediaUrl && mediaThumb) mediaUrl = mediaThumb.getAttribute("url") || "";

            return { title, link, pubDate, content, description, mediaUrl };
        }).slice(0, 12); // Limit to 12

        window.app.newsCache = newsItems;

        // Helper function to extract and PROXY image URLs
        const extractImageUrl = (item) => {
            let src = item.mediaUrl;
            
            // Fallback to searching the HTML body for an image
            if (!src) {
                const rawHtml = item.content || item.description || '';
                const imgMatch = rawHtml.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
                src = imgMatch ? imgMatch[1] : '';
            }
            
            if (!src) return 'https://via.placeholder.com/800x450/111/F47521?text=Crunchyroll+News';
            
            // Route through your Cloudflare worker proxy
            return customProxyUrl + encodeURIComponent(src);
        };

        // 3. RENDER CARDS
        let cardsHtml = window.app.newsCache.map((item, index) => {
            const imgSrc = extractImageUrl(item);
            
            const pubDate = new Date(item.pubDate ? item.pubDate.replace(/-/g, '/') : Date.now()); 
            const dateStr = !isNaN(pubDate) ? pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';

            return `
            <div class="snap-start shrink-0 w-[280px] md:w-[400px] bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.4)] group cursor-pointer transition-transform duration-300 hover:-translate-y-1 hover:border-[#F47521]/50"
                 onclick="window.app.openNewsModal(${index}, '${imgSrc}', '${dateStr}')">
                
                <!-- Top 16:9 Image Area -->
                <div class="w-full aspect-[16/9] relative overflow-hidden bg-black">
                    <img src="${imgSrc}" 
                         loading="lazy" 
                         crossorigin="anonymous"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/800x450/111/F47521?text=Anime+News';"
                         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent"></div>
                    
                    <div class="absolute top-3 left-3 bg-[#F47521] text-black text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded shadow-md tracking-wider">
                        Crunchyroll News
                    </div>
                </div>
                
                <!-- Bottom Text Area -->
                <div class="p-4 md:p-5 flex flex-col h-[110px] md:h-[130px] justify-between relative z-10 -mt-2 bg-[#111]">
                    <div class="flex flex-col gap-1.5">
                        <span class="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <i class="far fa-clock text-[#F47521]"></i> ${dateStr}
                        </span>
                        
                        <h3 class="text-white font-black text-sm md:text-base line-clamp-2 leading-tight group-hover:text-[#F47521] transition-colors drop-shadow-sm">
                            ${item.title}
                        </h3>
                    </div>

                    <p class="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest group-hover:text-white transition-colors flex items-center gap-1 mt-2">
                        Read Full Article <i class="fas fa-arrow-up text-[#F47521] transform group-hover:-translate-y-1 transition-transform"></i>
                    </p>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Latest Anime News
                    </h2>
                </div>
                
                <div class="relative group/slider">
                    <button id="news-slide-left-btn" class="hidden md:flex absolute -left-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-left text-lg"></i>
                    </button>
                    
                    <div id="news-slider-track" class="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-6 pt-2 -mx-4 px-4 md:mx-0 md:px-0 pr-8 md:pr-16">
                        ${cardsHtml}
                    </div>
                    
                    <button id="news-slide-right-btn" class="hidden md:flex absolute -right-5 top-[50%] -translate-y-1/2 z-20 w-12 h-12 bg-black/90 hover:bg-[#F47521] border border-white/10 rounded-full items-center justify-center text-white opacity-0 group-hover/slider:opacity-100 transition-all shadow-2xl disabled:opacity-0">
                        <i class="fas fa-chevron-right text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // 4. ATTACH SCROLL LOGIC
        const track = document.getElementById('news-slider-track');
        const leftBtn = document.getElementById('news-slide-left-btn');
        const rightBtn = document.getElementById('news-slide-right-btn');
        
        if (track && leftBtn && rightBtn) {
            const scrollAmount = window.innerWidth > 768 ? 800 : 300; 
            
            leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
            rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
            
            track.addEventListener('scroll', () => {
                leftBtn.disabled = track.scrollLeft <= 0;
                rightBtn.disabled = Math.ceil(track.scrollLeft) >= (track.scrollWidth - track.clientWidth - 10);
            });
            leftBtn.disabled = true; 
        }

        // 5. INJECT MODAL HTML
        setupNewsModal();

    } catch (error) {
        console.error("News Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};

// --- MODAL LOGIC & UI ---

function setupNewsModal() {
    if (document.getElementById('news-modal-overlay')) return;

    const modalHtml = `
        <div id="news-modal-overlay" class="fixed inset-0 z-[100] hidden items-end justify-center pointer-events-none">
            <div id="news-modal-backdrop" class="absolute inset-0 bg-black/85 backdrop-blur-md opacity-0 transition-opacity duration-400 pointer-events-auto cursor-pointer"></div>
            
            <div id="news-modal-content" class="w-full md:w-[850px] bg-[#0a0a0a] max-h-[92vh] h-[92vh] rounded-t-[2rem] transform translate-y-full transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) relative flex flex-col pointer-events-auto border-t border-x border-[#F47521]/30 shadow-[0_-10px_50px_rgba(244,117,33,0.2)]">
                
                <div class="flex items-center justify-between p-5 md:p-6 border-b border-white/10 bg-[#111] rounded-t-[2rem] sticky top-0 z-20">
                    <h3 class="text-white font-black text-sm md:text-lg truncate pr-4 text-[#F47521] uppercase tracking-widest flex items-center gap-2">
                        <i class="far fa-newspaper"></i> Full Article
                    </h3>
                    <button onclick="window.app.closeNewsModal()" class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[#F47521] hover:text-black border border-white/10 text-white transition-all transform hover:rotate-90">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar relative pb-28 md:pb-36">
                    
                    <div class="w-full h-[220px] md:h-[420px] relative rounded-2xl overflow-hidden mb-6 border border-white/10 bg-[#111]">
                        <img id="news-modal-img" 
                             class="w-full h-full object-cover" 
                             src="" 
                             alt="News Image"
                             crossorigin="anonymous"
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/800x450/111/F47521?text=Anime+News';">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
                    </div>
                    
                    <div class="flex items-center gap-3 mb-4">
                        <span class="bg-[#F47521]/20 text-[#F47521] border border-[#F47521]/50 text-[10px] md:text-xs font-black uppercase px-3 py-1.5 rounded-md shadow-sm">
                            Latest Announcement
                        </span>
                        <span id="news-modal-date" class="text-gray-400 text-xs md:text-sm font-bold flex items-center gap-1.5 uppercase tracking-wider"></span>
                    </div>
                    
                    <h1 id="news-modal-heading" class="text-xl md:text-3xl font-black text-white mb-6 leading-snug drop-shadow-md"></h1>
                    
                    <div id="news-modal-video-container" class="hidden mb-6"></div>

                    <div class="bg-[#111] p-5 md:p-8 rounded-2xl border border-white/5 shadow-inner mb-8">
                        <div id="news-modal-body" class="text-gray-300 text-sm md:text-base leading-relaxed space-y-4">
                            <!-- Injected dynamically -->
                        </div>
                    </div>
                    
                    <div class="pt-4 border-t border-white/10 flex justify-center pb-12">
                        <a id="news-modal-link" href="#" target="_blank" class="inline-flex items-center justify-center gap-3 bg-[#F47521] text-black font-black uppercase tracking-widest px-8 py-4 rounded-xl hover:bg-white hover:text-black hover:scale-105 transition-all shadow-[0_4px_15px_rgba(244,117,33,0.4)] w-full md:w-auto">
                            Read Original Source <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #F47521; }
            
            #news-modal-body img { border-radius: 12px; margin: 18px 0; max-width: 100%; border: 1px solid rgba(255,255,255,0.1); display: none; }
            #news-modal-body a { color: #F47521; font-weight: bold; text-decoration: underline; text-decoration-color: rgba(244,117,33,0.4); text-underline-offset: 4px; }
            #news-modal-body a:hover { text-decoration-color: #F47521; color: white; }
            #news-modal-body p { margin-bottom: 1.25rem; line-height: 1.7; }
            #news-modal-body iframe { max-width: 100%; border-radius: 12px; }
            #news-modal-body h1, #news-modal-body h2, #news-modal-body h3 { color: white; font-weight: 900; margin-top: 1.5rem; margin-bottom: 1rem; }
            #news-modal-body ul, #news-modal-body ol { margin-left: 1.5rem; margin-bottom: 1.25rem; }
            #news-modal-body li { margin-bottom: 0.5rem; }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('news-modal-backdrop').addEventListener('click', window.app.closeNewsModal);
}

window.app.openNewsModal = (index, imgSrc, dateStr) => {
    const item = window.app.newsCache[index];
    if (!item) return;

    document.getElementById('news-modal-img').src = imgSrc;
    document.getElementById('news-modal-date').innerHTML = `<i class="far fa-calendar-alt"></i> ${dateStr}`;
    document.getElementById('news-modal-heading').innerText = item.title;
    document.getElementById('news-modal-link').href = item.link;

    const rawContent = item.content || item.description || '';

    // --- YOUTUBE EXTRACTION ---
    const ytVideoContainer = document.getElementById('news-modal-video-container');
    ytVideoContainer.innerHTML = '';
    ytVideoContainer.classList.add('hidden');

    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
    const ytMatches = [...rawContent.matchAll(ytRegex)];

    if (ytMatches.length > 0) {
        const videoIds = [...new Set(ytMatches.map(m => m[1]))];
        
        let embedsHtml = videoIds.map(vId => `
            <div class="mb-4">
                <div class="flex items-center gap-2 mb-2 text-[#F47521] text-xs font-black uppercase tracking-wider">
                    <i class="fab fa-youtube text-base"></i> Official Trailer / PV
                </div>
                <div class="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                    <iframe class="w-full h-full" 
                            src="https://www.youtube.com/embed/${vId}" 
                            title="YouTube video player" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                    </iframe>
                </div>
            </div>
        `).join('');

        ytVideoContainer.innerHTML = embedsHtml;
        ytVideoContainer.classList.remove('hidden');
    }

    // Clean description content
    let cleanHTML = rawContent
        .replace(/<img[^>]*>/gi, '') 
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') 
        .replace(/<a [^>]*href=["'](https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"']*)["'][^>]*>.*?<\/a>/gi, ''); 

    document.getElementById('news-modal-body').innerHTML = cleanHTML || '<p>No description available for this announcement.</p>';

    // Execute Animations
    const modal = document.getElementById('news-modal-overlay');
    const backdrop = document.getElementById('news-modal-backdrop');
    const content = document.getElementById('news-modal-content');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        content.classList.remove('translate-y-full');
    });
};

window.app.closeNewsModal = () => {
    const modal = document.getElementById('news-modal-overlay');
    const backdrop = document.getElementById('news-modal-backdrop');
    const content = document.getElementById('news-modal-content');
    
    const videoContainer = document.getElementById('news-modal-video-container');
    if (videoContainer) videoContainer.innerHTML = '';

    backdrop.classList.add('opacity-0');
    content.classList.add('translate-y-full');
    document.body.style.overflow = '';

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 500);
};
