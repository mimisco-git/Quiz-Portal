const CACHE = "quizportal-v3";
const NOTES_CACHE = "quizportal-notes-v1";
const PRECACHE = ["/", "/index.html"];
// API paths to cache for offline note reading (network-first, fall back to cache)
const OFFLINE_API = ["/api/notes", "/api/courses"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE && k !== NOTES_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Cache-first for Vite-built assets (JS/CSS/images with hash filenames) — fast offline load
  if (url.pathname.startsWith("/assets/") || url.pathname.match(/\.(js|css|woff2?|ttf|otf)$/)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetch(e.request);
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch {
          return cached || new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // Network-first for note/course APIs — cache successful responses for offline fallback
  if (OFFLINE_API.some(p => url.pathname.startsWith(p))) {
    e.respondWith(
      fetch(e.request.clone())
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(NOTES_CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request, { cacheName: NOTES_CACHE }))
    );
    return;
  }

  // Skip other API calls (auth, grading, etc.)
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for app shell
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
  );
});

self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || "Quiz Portal", {
      body: data.body || "You have a new notification",
      icon: "/logo.png",
      badge: "/logo.png",
      tag: data.tag || "quizportal",
      data: { url: data.url || "/" },
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
