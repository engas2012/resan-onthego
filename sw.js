// RESAN On the go — service worker: installable app, offline shell, push notifications.
const CACHE = 'resan-v71', SHELL = ['./', './index.html', './app.js', './styles.css', './config.js', './study.js', './logo-dark.png', './logo-light.png', './icon-192.png', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// network-first for our own files (always fresh when online), cache fallback when offline; never touch API calls
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'ريسان', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ريسان', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', dir: 'rtl', lang: 'ar', tag: d.tag || 'resan', renotify: true, data: { url: d.url || '#alerts' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const target = new URL('./' + (e.notification.data?.url || '#alerts'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.navigate(target); return c.focus(); } return self.clients.openWindow(target); }));
});
