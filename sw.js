// 更新がすぐ届くよう、ページ本体はネット優先（約4秒で切り上げ）→ だめならキャッシュ。
// アイコンなどはキャッシュ優先。
const VERSION = "v3-2026-10-08";
const CACHE = `diet-log-${VERSION}`;
const FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = (p, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), ms);
  p.then((v) => { clearTimeout(t); res(v); }, (err) => { clearTimeout(t); rej(err); });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // ページとアプリ本体はネット優先
  const fresh = req.mode === "navigate" || /app\.js|index\.html|\/$/.test(new URL(req.url).pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (fresh) {
      try {
        const res = await timeout(fetch(req), 4000);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        return cache.match("./index.html");
      }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  })());
});
