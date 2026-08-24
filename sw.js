/* Service Worker — cache shell + corpus + seed audio for offline commute */
const CACHE = "guide-shadow-v2";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/corpus.json",
];

const SEED_AUDIO = [
  "./audio/scenic_qa/scenic_qa-q01-s01.mp3",
  "./audio/scenic_qa/scenic_qa-q01-s02.mp3",
  "./audio/scenic_qa/scenic_qa-q01-s03.mp3",
  "./audio/scenic_qa/scenic_qa-q02-s01.mp3",
  "./audio/scenic_qa/scenic_qa-q02-s02.mp3",
  "./audio/scenic_qa/scenic_qa-q03-s01.mp3",
  "./audio/scenic_qa/scenic_qa-q03-s02.mp3",
  "./audio/scenic_qa/scenic_qa-q03-s03.mp3",
  "./audio/service_norms/service_norms-welcome-s01.mp3",
  "./audio/service_norms/service_norms-welcome-s02.mp3",
  "./audio/service_norms/service_norms-welcome-s03.mp3",
  "./audio/service_norms/service_norms-welcome-s04.mp3",
  "./audio/service_norms/service_norms-welcome-s05.mp3",
  "./audio/service_norms/service_norms-welcome-s06.mp3",
  "./audio/service_norms/service_norms-welcome-s07.mp3",
  "./audio/service_norms/service_norms-welcome-s08.mp3",
  "./audio/service_norms/service_norms-welcome-s09.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE);
      await Promise.allSettled(SEED_AUDIO.map((u) => cache.add(u)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok && (req.url.includes("/audio/") || req.url.includes("corpus.json"))) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
