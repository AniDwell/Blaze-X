// search.js - High-Performance Search Engine

window.app = window.app || {};

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const trendingContainer = document.getElementById('trending-container');
    const resultsListContainer = document.getElementById('results-list-container');
    const API_BASE = 'https://anikoto-api-xi.vercel.app';
    const ANILIST_URL = 'https://graphql.anilist.co';

    // 1. Fetch AniList Trending & Map to Database IDs
    const loadTop10Popular = async () => {
        try {
            const query = `query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { title { romaji english } coverImage { extraLarge } } } }`;
            const res = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const json = await res.json();
            const animeList = json.data.Page.media;

            trendingContainer.innerHTML = ''; // Clear fallback

            for (const anime of animeList) {
                const title = anime.title.english || anime.title.romaji;
                // Search in DB to get the correct internal ID
                const searchRes = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(title)}`);
                const searchJson = await searchRes.json();
                
                if (searchJson.success && searchJson.results?.length > 0) {
                    const match = searchJson.results[0];
                    renderResultItem(match, trendingContainer, true);
                }
            }
        } catch (e) {
            console.error("Top 10 load failed", e);
        }
    };

    // 2. Render Helper (Reusable for Trending & Search)
    const renderResultItem = (anime, container, isTrending = false) => {
        const div = document.createElement('div');
        div.className = "flex gap-4 items-center bg-[#111] p-3 rounded-xl cursor-pointer hover:border-[#F47521] border border-transparent transition-all group";
        div.onclick = () => window.location.href = `info.html?id=${anime.id}`;
        div.innerHTML = `
            <img src="${anime.image || anime.poster}" class="w-16 h-20 object-cover rounded-lg">
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-white truncate">${anime.title}</h4>
                <p class="text-[10px] text-gray-500 uppercase tracking-widest mt-1">${anime.type || 'TV'}</p>
            </div>
        `;
        container.appendChild(div);
    };

    // 3. Search Logic
    const handleSearch = async (term) => {
        if (!term) return;
        resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-500">Searching...</div>`;
        
        try {
            const res = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(term)}`);
            const json = await res.json();
            
            resultsListContainer.innerHTML = '';
            if (json.success && json.results?.length > 0) {
                json.results.forEach(item => renderResultItem(item, resultsListContainer));
            } else {
                resultsListContainer.innerHTML = `<div class="p-4 text-center text-xs text-gray-500">No results found.</div>`;
            }
        } catch (e) {
            resultsListContainer.innerHTML = `<div class="p-4 text-center text-red-500 text-xs">Error fetching results.</div>`;
        }
    };

    // Listeners
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(searchInput.value);
    });

    // Init
    loadTop10Popular();
});
