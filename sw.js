// Bump SHELL_CACHE whenever shell files change. Same-origin requests are
// network-first so a deploy (e.g. corrected tow schedules) reaches phones on
// the next open; the cache is only a fallback for when there is no signal.
const SHELL_CACHE = "curbwise-shell-v10";
const SHELL_FILES = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icons/curbwise.svg", "./icons/curbwise-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))));
});

// Tow alerts sent by /api/deliver (see lib/alerts-core.js).
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Curbwise tow alert", {
    body: data.body || "Check your car's tow window.",
    tag: data.tag || "curbwise",
    renotify: true,
    requireInteraction: true,
    icon: "./icons/curbwise-192.png",
    badge: "./icons/curbwise-192.png",
    data: { url: data.url || "./" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => client.url.startsWith(self.location.origin));
    return open ? open.focus() : self.clients.openWindow(target);
  }));
});
