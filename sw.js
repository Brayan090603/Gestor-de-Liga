const CACHE_NAME = 'femfutpal-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './panel.html',
  './css/style.css',
  './js/app.js',
  './js/bienvenida.js',
  './js/db.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
