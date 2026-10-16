// Matinyo POS — keeps the app opening when the internet is down.
// Sales themselves are stored offline by Firebase; this file only caches the app's own files.
const CACHE = 'matinyo-pos-v24';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Never cache Firebase traffic — Firebase handles its own offline storage.
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com')) return;

    // The app page: try the network first so updates arrive, fall back to the saved copy.
    if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
        e.respondWith(fetch(req)
            .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
            .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
        return;
    }

    // Libraries, fonts and icons: use the saved copy, refresh it in the background.
    e.respondWith(caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return res;
        }).catch(() => cached);
        return cached || fresh;
    }));
});
