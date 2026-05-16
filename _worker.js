// _worker.js

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Intercept and Proxy the Anikoto API
    if (url.pathname.startsWith('/api/anikoto/')) {
      const remainingPath = url.pathname.replace('/api/anikoto', '');
      const targetUrl = `https://anikotoapi.site${remainingPath}${url.search}`;
      
      console.log(`Proxying API to: ${targetUrl}`);
      
      return fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Blaze-X Browser Engine',
          'Accept': 'application/json'
        }
      });
    }

    // 2. Intercept and Proxy the MegaPlay Video Iframe Layout
    if (url.pathname.startsWith('/stream/')) {
      const remainingPath = url.pathname.replace('/stream', '');
      const targetUrl = `https://megaplay.buzz/stream${remainingPath}${url.search}`;
      
      console.log(`Proxying Video Frame to: ${targetUrl}`);

      return fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
        }
      });
    }

    // 3. Fallback: If it's not an API or Video request, serve index.html normally
    return env.ASSETS.fetch(request);
  }
};
