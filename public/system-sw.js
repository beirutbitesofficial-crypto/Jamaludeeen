// Store System service worker: lets the browser install /system as a desktop app.
// It always goes to the network, so sales and stock are never served from a stale cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
