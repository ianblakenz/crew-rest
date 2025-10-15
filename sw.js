const CACHE_NAME = 'inflight-rest-cache-v10'; // Version bumped to v9
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://media.faaa.com.au/logo/faaa_logo.png'
];

// Install the service worker and cache the static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// This 'activate' event is crucial for deleting old caches
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
    })
  );
});

// --- FETCH STRATEGY CHANGED TO NETWORK-FIRST ---
// This will always try to fetch from the network first.
// If the network fails (offline), it will fall back to the cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(networkResponse => {
      // If the fetch is successful, we update the cache with the new version
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, networkResponse.clone());
        // And return the fresh response from the network
        return networkResponse;
      });
    }).catch(() => {
      // If the fetch fails (e.g., the user is offline),
      // we then try to serve the file from the cache.
      return caches.match(event.request);
    })
  );
});


// This listener waits for the "skipWaiting" message from the UI
// and forces the new service worker to take control.
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

