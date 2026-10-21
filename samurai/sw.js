const CACHE_NAME = 'samurai-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'src/Runtime.js',
  'resources/samurai.cch'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // ignora falhas individuais (ex: arquivo que não existe)
      return Promise.all(
        ASSETS.map(function (url) {
          return cache.add(url).catch(function () { /* ignora */ });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});