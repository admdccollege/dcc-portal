/*
 * DCC Portal service worker — offline support.
 *
 * - App pages: network first. Every page opened while online is saved on the
 *   device; when offline the saved copy is shown (read-only snapshot).
 * - Build assets (/_next/static, icons, fonts): cache first (they are versioned).
 * - API, exports, PDFs, auth and server actions: always network (never cached).
 * - Saved pages are wiped on sign-out and whenever the sign-in page is shown,
 *   so one user's data never stays on a shared device for the next user.
 */
const VERSION = "v1";
const STATIC_CACHE = `dcc-static-${VERSION}`;
const PAGES_CACHE = `dcc-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_PAGES = 80;
let clearedAt = 0; // pages fetched before the last clear are never stored

function clearPages() {
  clearedAt = Date.now();
  return caches.delete(PAGES_CACHE);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("dcc-") && k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear-pages") {
    event.waitUntil(clearPages());
  }
  // The app sends this after in-app (client-side) navigations, which the
  // service worker would otherwise never see as page loads.
  if (data.type === "save-page" && typeof data.url === "string") {
    const url = new URL(data.url, self.location.origin);
    if (url.origin === self.location.origin && !NEVER_CACHE.some((re) => re.test(url.pathname))) {
      event.waitUntil(pageNetworkFirst(new Request(url.pathname + url.search, { credentials: "same-origin" })).catch(() => undefined));
    }
  }
});

const NEVER_CACHE = [/^\/api\//, /^\/auth\//, /^\/login/, /^\/forgot-password/, /^\/verify/];

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|png|svg|ico|jpg|jpeg|webp)$/.test(url.pathname);
}

async function trimPages() {
  const cache = await caches.open(PAGES_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

async function pageNetworkFirst(request) {
  const url = new URL(request.url);
  const startedAt = Date.now();
  try {
    const response = await fetch(request);
    const landedOnLogin = response.redirected && new URL(response.url).pathname.startsWith("/login");
    if (landedOnLogin) {
      await clearPages(); // signed out elsewhere: forget saved pages
    } else if (startedAt >= clearedAt && response.ok && response.type === "basic" && !NEVER_CACHE.some((re) => re.test(url.pathname))) {
      const copy = response.clone();
      const headers = new Headers(copy.headers);
      headers.set("x-dcc-saved-at", new Date().toISOString());
      const body = await copy.blob();
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(url.pathname + url.search, new Response(body, { status: 200, statusText: "OK", headers }));
      trimPages();
    }
    return response;
  } catch (err) {
    const cache = await caches.open(PAGES_CACHE);
    const saved = (await cache.match(url.pathname + url.search)) || (await cache.match(url.pathname));
    if (saved) return saved;
    return (await caches.match(OFFLINE_URL)) || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function staticCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // server actions, uploads: network only
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (NEVER_CACHE.some((re) => re.test(url.pathname))) {
      if (url.pathname.startsWith("/login")) event.waitUntil(clearPages());
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
      return;
    }
    event.respondWith(pageNetworkFirst(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(staticCacheFirst(request));
  }
  // Everything else (RSC payloads, API, exports) goes straight to the network.
  // When an in-app navigation fails offline, Next.js falls back to a full page
  // load, which is answered above from the saved pages.
});
