// sw.js — Arcade Central PWA
const CACHE_NAME = 'arcade-central-v2'; // ← suba a versão ao alterar arquivos cacheados
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './thumbs-assets/icon-192.png',
  './thumbs-assets/icon-512.png',
  './thumbs-assets/logoamandapps.png'
  // NÃO coloque jogos-info.json aqui para não prender a lista de jogos
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só mexe em GET do mesmo origin
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // jogos-info.json → network-first (garante lista sempre atualizada)
  if (url.pathname.endsWith('/jogos-info.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // HTML e JS → network-first (pega atualizações, cai pro cache offline)
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req) || caches.match('./index.html'))
    );
    return;
  }

  // Imagens e outros assets → cache-first
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});