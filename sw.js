/* GymJourney · Percorso Mosaico · app shell, Firebase SDK and fonts, so the app also opens without a connection. */
var CACHE = 'gymjourney-coerenza-20261030-a';
/* librerie con la versione nell'indirizzo: non cambiano mai, quindi restano in una cache a parte anche dopo un aggiornamento */
var LIB = 'gymjourney-lib-firebase-10.12.2';
var FONTS = 'gymjourney-fonts-1';
var KEEP = [CACHE, LIB, FONTS];
var FILES = ["./","index.html","manifest.webmanifest","brand-icon.svg","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png","favicon-32.png","favicon-16.png","favicon.ico"];
var SDK = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'].map(function (f) { return 'https://www.gstatic.com/firebasejs/10.12.2/' + f; });
var SCOPE = self.registration.scope;
var STATIC_PATHS = FILES.map(function (p) { return new URL(p, SCOPE).pathname; });
/* oltre questo tempo senza risposta dalla rete, la pagina si apre dalla copia salvata (e la rete aggiorna la copia per la volta dopo) */
var NET_WAIT = 3500;

function putLib(cache, url) {
  return fetch(new Request(url, { mode: 'no-cors', credentials: 'omit' })).then(function (r) {
    if (r && (r.ok || r.type === 'opaque')) return cache.put(url, r);
  });
}
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FILES.map(function (p) { return new Request(new URL(p, SCOPE).href, { cache: 'reload' }); }));
  }).then(function () {
    /* l'SDK si prova a salvare subito, ma senza rete l'installazione non deve fallire: lo salva poi il primo caricamento */
    return caches.open(LIB).then(function (lib) {
      return Promise.all(SDK.map(function (u) { return lib.match(u).then(function (hit) { return hit || putLib(lib, u); }).catch(function () {}); }));
    }).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return KEEP.indexOf(key) < 0 && key.indexOf('gymjourney-') === 0;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(name, req, navigation) {
  return caches.open(name).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (cached) {
      if (cached || !navigation) return cached;
      return cache.match(new URL('index.html', SCOPE).href);
    });
  });
}
/* rete prima, ma con un limite: con una connessione lentissima la pagina non resta bianca */
function networkFirst(event, req, navigation) {
  var net = fetch(req, { cache: 'no-cache' }).then(function (response) {
    if (response.ok && response.type !== 'opaque') {
      var copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.put(req, copy); }).catch(function () {}));
    }
    return response;
  });
  event.waitUntil(net.catch(function () {}));
  return new Promise(function (resolve) {
    var done = false, timer = setTimeout(function () {
      fromCache(CACHE, req, navigation).then(function (cached) { if (cached && !done) { done = true; resolve(cached); } }).catch(function () {});
    }, NET_WAIT);
    net.then(function (r) { if (!done) { done = true; clearTimeout(timer); resolve(r); } }).catch(function () {
      clearTimeout(timer);
      fromCache(CACHE, req, navigation).then(function (cached) { if (!done) { done = true; resolve(cached || Response.error()); } }).catch(function () { if (!done) { done = true; resolve(Response.error()); } });
    });
  });
}
/* file che non cambiano (SDK con versione, file dei caratteri): dalla copia se c'è, altrimenti dalla rete e poi in copia */
function cacheFirst(event, req, name) {
  return caches.open(name).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque')) { var copy = r.clone(); event.waitUntil(cache.put(req, copy).catch(function () {})); }
        return r;
      });
    });
  });
}
/* il foglio dei caratteri: la copia subito, e intanto la rete la rinnova */
function staleWhileRevalidate(event, req, name) {
  return caches.open(name).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque')) { var copy = r.clone(); return cache.put(req, copy).then(function () { return r; }, function () { return r; }); }
        return r;
      });
      if (hit) { event.waitUntil(net.catch(function () {})); return hit; }
      return net;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === 'https://www.gstatic.com' && url.pathname.indexOf('/firebasejs/10.12.2/') === 0) { event.respondWith(cacheFirst(event, req, LIB)); return; }
  if (url.origin === 'https://fonts.gstatic.com') { event.respondWith(cacheFirst(event, req, FONTS)); return; }
  if (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') { event.respondWith(staleWhileRevalidate(event, req, FONTS)); return; }
  if (url.origin !== self.location.origin || url.href.indexOf(SCOPE) !== 0) return;
  var navigation = req.mode === 'navigate';
  if (!navigation && STATIC_PATHS.indexOf(url.pathname) < 0) return;
  event.respondWith(networkFirst(event, req, navigation));
});
