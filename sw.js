const CACHE_NAME = 'inflight-rest-cache-v14'; // Version bumped to v14
const urlsToCache = [
  './', // Cache the root (usually redirects to index.html)
  './index.html',
  './manifest.json',
  'https://media.faaa.com.au/logo/faaa_logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll - if any request fails, the promise rejects.
        return cache.addAll(urlsToCache)
          .catch(error => {
            console.error('Failed to cache resources during install:', error);
            // Optional: You could try caching individually here if addAll fails
            // but for core app files, failure usually means something is wrong.
          });
      })
      .then(() => {
        console.log('All resources cached successfully.');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        // If caching fails critically, the SW won't install correctly.
        console.error('Service worker installation failed:', error);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Old caches deleted.');
        return self.clients.claim(); // Take control immediately
    })
  );
});

// Cache-first strategy - Reliably serve from cache when offline
self.addEventListener('fetch', event => {
  // Only handle GET requests and requests within the app's origin
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin) && !urlsToCache.includes(event.request.url) ) {
     // Let the browser handle non-GET or external requests normally
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Cache hit - return response
          // console.log('Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        // console.log('Fetching from network:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              console.log('Fetch failed or invalid response for:', event.request.url, networkResponse);
              return networkResponse; // Return the error response
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log('Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.error('Fetch failed, and not in cache:', error);
            // Optional: Return a custom offline fallback page/response here
            // For now, just let the browser show its offline error
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

