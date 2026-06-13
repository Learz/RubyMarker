const CACHE_NAME = 'rubymarker-cache-v1';

// Dynamically compute the base directory path based on the Service Worker location
const baseDir = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const ASSETS_TO_CACHE_RELATIVE = [
  '',
  'index.html',
  'favicon.svg',
  'icons.svg',
  'js/kuromoji.js',
  // Dictionary files
  'dict/base.dat.gzip',
  'dict/cc.dat.gzip',
  'dict/check.dat.gzip',
  'dict/tid.dat.gzip',
  'dict/tid_map.dat.gzip',
  'dict/tid_pos.dat.gzip',
  'dict/unk.dat.gzip',
  'dict/unk_char.dat.gzip',
  'dict/unk_compat.dat.gzip',
  'dict/unk_invoke.dat.gzip',
  'dict/unk_map.dat.gzip',
  'dict/unk_pos.dat.gzip'
];

const ASSETS_TO_CACHE = ASSETS_TO_CACHE_RELATIVE.map(asset => baseDir + asset);

// During install, cache static assets and dictionaries
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Pre-caching assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate service worker and clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch handler: intercepts requests for cached files and loads them instantly offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (url.origin === self.location.origin || isGoogleFont) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache, but update it in the background
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {/* Ignore network errors offline */});
          
          return cachedResponse;
        }

        // Cache miss: fetch from network and cache
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // If offline and request fails
          return new Response('Offline content not available', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
  }
});
