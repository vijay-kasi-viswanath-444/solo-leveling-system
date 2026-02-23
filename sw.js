const CACHE_NAME = "solo-leveling-system-v4";
const APP_SHELL = [
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "New system alert." };
  }

  const title =
    payload?.notification?.title ||
    payload?.title ||
    payload?.data?.title ||
    "Solo Leveling System";
  const body =
    payload?.notification?.body ||
    payload?.body ||
    payload?.data?.body ||
    "You have a new update.";
  const icon =
    payload?.notification?.icon ||
    payload?.icon ||
    "./assets/icons/icon-192.png";
  const badge = payload?.badge || "./assets/icons/icon-192.png";
  const url = payload?.data?.url || "/index.html#quests";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      vibrate: [120, 50, 120],
      renotify: true,
      tag: `sls-push-${Date.now()}`,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/index.html#quests";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const isDocumentOrConfig =
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/config/firebase.public.js") ||
    url.pathname.endsWith("/config/firebase.runtime.js");

  // Always fetch live HTML/config to avoid stale app code.
  if (isDocumentOrConfig) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() =>
          caches.match(event.request).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
