/* Service Worker — shell + guides + lexicon */
const CACHE = "guide-oral-v7";
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./app/config.js",
  "./app/parse-paste.js",
  "./app/user-guides.js",
  "./app/tts-queue.js",
  "./app/guide-loader.js",
  "./app/user-guide-ui.js",
  "./app/guide-backup.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/corpus.json",
  "./data/scenic_guides/index.json",
  "./data/phrase_patches.json",
  "./data/lexicon/guide-lexicon.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
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
          if (
            res.ok &&
            (req.url.includes("/audio/") ||
              req.url.includes("corpus.json") ||
              req.url.includes("scenic_guides") ||
              req.url.includes("phrase_patches") ||
              req.url.includes("lexicon/"))
          ) {
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

