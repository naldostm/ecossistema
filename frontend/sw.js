// Service Worker Kill Switch
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) => {
      for (let name of names) caches.delete(name);
    }).then(() => self.clients.claim())
  );
});
