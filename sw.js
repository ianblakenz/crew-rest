const CACHE_NAME = 'inflight-rest-cache-v33'; // Version bumped to v21
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://media.faaa.com.au/logo/faaa_logo.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap'
  // Font files (like .woff2) will be cached on-the-fly by the fetch listener
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll - if any request fails, the promise rejects.
        return cache.addAll(urlsToCache)
          .catch(error => {
            console.warn('Failed to cache some resources during install. App may not work fully offline.', error);
          });
      })
      .then(() => {
        console.log('Core resources cached.');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
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

// Stale-while-revalidate for Google Fonts, Cache-first for everything else
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Stale-While-Revalidate for Google Fonts
  if (requestUrl.hostname === 'fonts.googleapis.com' || requestUrl.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const networkFetch = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse); // Fallback to cache on network error
          
          return cachedResponse || networkFetch; // Return from cache first, or wait for network
        });
      })
    );
    return; // Don't run the cache-first logic below
  }

  // Cache-First for all other app requests
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch from network, then cache it
        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              console.log('Fetch failed or invalid response for:', event.request.url, networkResponse);
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        ).catch(error => {
            console.error('Fetch failed, and not in cache:', error, event.request.url);
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});