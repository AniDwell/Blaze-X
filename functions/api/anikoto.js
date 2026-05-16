// functions/api/anikoto.js

export async function onRequest(context) {
    // 1. Get the URL the user is trying to reach (e.g., /recent-anime?page=1)
    const requestUrl = new URL(context.request.url);
    
    // We pass whatever query parameters the frontend sent (like ?page=1)
    const targetUrl = `https://anikotoapi.site${requestUrl.search}`;

    // 2. Set up Cloudflare caching to prevent rate-limit bans
    const cache = caches.default;
    const cacheKey = new Request(targetUrl, context.request);
    
    // Check if we already fetched this exact page in the last 60 seconds
    let response = await cache.match(cacheKey);

    if (!response) {
        // If not in cache, fetch it from Anikoto securely
        try {
            console.log(`Fetching fresh data from: ${targetUrl}`);
            const apiResponse = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Blaze-X Server (Cloudflare Pages)',
                    'Accept': 'application/json'
                }
            });

            // If Anikoto blocks us, return the error safely to the frontend
            if (!apiResponse.ok) {
                return new Response(JSON.stringify({ error: `Anikoto API returned ${apiResponse.status}` }), {
                    status: apiResponse.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const data = await apiResponse.json();

            // 3. Create a fresh response and tell Cloudflare to cache it for 60 seconds
            response = new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 's-maxage=60' // Cache for 60 seconds
                }
            });

            // Store it in the cache for the next user
            context.waitUntil(cache.put(cacheKey, response.clone()));

        } catch (error) {
            return new Response(JSON.stringify({ error: "Backend fetch failed." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return response;
}
