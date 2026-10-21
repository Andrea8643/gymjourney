/* GymJourney · Percorso Mosaico · static app shell only. */
var CACHE = 'gymjourney-mosaico-20261021-9';
var FILES = ["./","index.html","manifest.webmanifest","brand-icon.svg","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png","favicon-32.png","favicon-16.png","favicon.ico"];
var SCOPE = self.registration.scope;
var STATIC_PATHS = FILES.map(function (p) { return new URL(p, SCOPE).pathname; });
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FILES.map(function (p) { return new Request(new URL(p, SCOPE).href, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key !== CACHE && (key === 'gymjourney-v1' || key.indexOf('gymjourney-mosaico-') === 0);
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.href.indexOf(SCOPE) !== 0) return;
  var navigation = req.mode === 'navigate';
  if (!navigation && STATIC_PATHS.indexOf(url.pathname) < 0) return;
  event.respondWith(fetch(req, { cache: 'no-cache' }).then(function (response) {
    if (response.ok && response.type !== 'opaque') {
      var copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.put(req, copy); }).catch(function () {}));
    }
    return response;
  }).catch(function () {
    return caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        if (navigation) return cache.match(new URL('index.html', SCOPE).href).then(function (shell) { return shell || Response.error(); });
        return Response.error();
      });
    });
  }));
});
