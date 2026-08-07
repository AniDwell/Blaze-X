// news_slider.js - Bigger Card View for Live Anime News & Announcements

window.app = window.app || {};
window.app.components = window.app.components || {};

window.app.components.newsSlider = async () => {
    // Hooks into the <div id="news-container"> in your index.html
    const container = document.getElementById('news-container');
    if (!container) return;

    // 1. SHOW SKELETON (Wider 16:9 Cards for News)
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
        // 2. FETCH REAL NEWS FROM ANIME NEWS NETWORK (Via free RSS2JSON API)
        const rssUrl = encodeURIComponent('https://www.animenewsnetwork.com/news/rss.xml');
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        const json = await res.json();
        
        let newsItems = json.items || [];

        if (newsItems.length === 0) {
            container.innerHTML = ''; 
            return;
        }

        // Limit to 12 latest news items
        newsItems = newsItems.slice(0, 12);

        // 3. RENDER BIGGER CARDS
        let cardsHtml = newsItems.map(item => {
            // Extract image from RSS description if thumbnail is missing
            let imgSrc = item.thumbnail;
            if (!imgSrc || imgSrc === '') {
                const imgMatch = item.description.match(/src=["'](.*?)["']/);
                imgSrc = imgMatch ? imgMatch[1] : 'https://via.placeholder.com/800x450/111/F47521?text=Anime+Announcement';
            }
            
            // Format publication date safely
            const pubDate = new Date(item.pubDate.replace(/-/g, '/')); 
            const dateStr = !isNaN(pubDate) ? pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';

            // Escape quotes for safety
            const safeLink = item.link.replace(/'/g, "\\'");

            return `
            <div class="snap-start shrink-0 w-[280px] md:w-[400px] bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.4)] group cursor-pointer transition-transform duration-300 hover:-translate-y-1 hover:border-[#F47521]/50"
                 onclick="window.open('${safeLink}', '_blank')">
                
                <!-- Top 16:9 Image Area -->
                <div class="w-full aspect-[16/9] relative overflow-hidden bg-black">
                    <img src="${imgSrc}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    
                    <!-- Inner Gradient -->
                    <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent"></div>
                    
                    <!-- Category Badge -->
                    <div class="absolute top-3 left-3 bg-[#F47521] text-black text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded shadow-md tracking-wider">
                        Announcement
                    </div>
                </div>
                
                <!-- Bottom Text Area -->
                <div class="p-4 md:p-5 flex flex-col h-[110px] md:h-[130px] justify-between relative z-10 -mt-2 bg-[#111]">
                    
                    <div class="flex flex-col gap-1.5">
                        <!-- Date -->
                        <span class="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <i class="far fa-clock text-[#F47521]"></i> ${dateStr}
                        </span>
                        
                        <!-- Headline -->
                        <h3 class="text-white font-black text-sm md:text-base line-clamp-2 leading-tight group-hover:text-[#F47521] transition-colors drop-shadow-sm">
                            ${item.title}
                        </h3>
                    </div>

                    <!-- Call to Action -->
                    <p class="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest group-hover:text-white transition-colors flex items-center gap-1 mt-2">
                        Read Article <i class="fas fa-arrow-right text-[#F47521] transform group-hover:translate-x-1 transition-transform"></i>
                    </p>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="px-4 md:px-8 py-6 relative">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl md:text-2xl font-black text-white border-l-4 border-[#F47521] pl-3 uppercase tracking-wider drop-shadow-md">
                        Top Anime News
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

        // 5. ATTACH SCROLL LOGIC
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

    } catch (error) {
        console.error("News Slider Render Error:", error);
        container.innerHTML = ''; 
    }
};
