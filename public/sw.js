const STATIC_CACHE = "hawaplan-static-v2";
const FORECAST_CACHE = "hawaplan-forecast-v2";
const STATIC_FILES = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => ![STATIC_CACHE, FORECAST_CACHE].includes(key))
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api/forecast") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            event.waitUntil(
              caches
                .open(FORECAST_CACHE)
                .then((cache) => cache.put(request, response.clone())),
            );
          return response;
        })
        .catch(
          async () =>
            (await caches.open(FORECAST_CACHE)).match(request) ??
            Response.error(),
        ),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            event.waitUntil(
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put("/", response.clone())),
            );
          return response;
        })
        .catch(
          async () =>
            (await caches.open(STATIC_CACHE)).match("/") ?? Response.error(),
        ),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok)
            event.waitUntil(
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, response.clone())),
            );
          return response;
        }),
    ),
  );
});
