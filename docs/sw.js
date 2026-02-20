const CACHE_NAME = 'images-v1';
const IMAGE_EXTENSIONS = ['.gif', '.png', '.jpg', '.jpeg', '.webp', '.svg'];

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
      })
    )
  );
});
