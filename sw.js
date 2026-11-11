/* ==========================================================
   Card Battle Infinity — service worker (PROGRESS ▶️ แผนปรับปรุงเว็บ รอบ 5 · §3.3 "Service worker")
   Second visit opens fast, and the site still opens with no connection — without ever getting stuck on old files:
   · css / js   = the files of ONE ?v= (js/app.js registers this file as sw.js?v=<its own ?v=>, so a new ?v= in
                  index.html = a new worker that keeps that version's files and drops the old ones). Every file
                  in CORE is kept on install, including the page code that loads later (MODS in js/app.js),
                  so Deck / Battle / the card detail open offline too.
   · the page   = network first (index.html and the card pages c/<id>/); the kept copy only with no connection
   · data/*.json = network first, the kept copy only with no connection
   · images     = from the kept copy at once, checked with the server in the background (a new picture shows
                  from the next view on) · at most MAX_MEDIA pictures kept (oldest go first)
   · Google Fonts = kept (font files never change at the same address)
   "No connection" = the request fails, or the server says nothing for NET_WAIT ms (a frozen connection · after one
   such wait the next requests wait only SLOW_WAIT ms for SLOW_FOR ms, so the page + its data don't each wait 6 s).
   A new css/js file → add it to CORE · a new data file the site loads → add it to DATA
   (tools/build_site.py and tools/bump_version.py --check fail when these lists don't match the repo).
   Emergency: /?sw=off removes the worker and its caches on that device (js/app.js) · to remove it for
   everyone, replace this whole file with: self.addEventListener("install", () => self.skipWaiting());
   self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.map((n) =>
   caches.delete(n)))).then(() => self.registration.unregister())));
   ========================================================== */
const VER = new URL(self.location.href).searchParams.get("v") || "";
const SCOPE = self.registration.scope;                  // https://card-battle-infinity.pages.dev/
const STATIC = "cbi-static";   // css/js of this ?v= · key = the full address with ?v=
const PAGES = "cbi-pages";     // the site page (key = SCOPE) + card pages c/<id>/ last opened
const DATA = "cbi-data";       // data/*.json last loaded
const MEDIA = "cbi-media";     // images/ + site.webmanifest
const FONTS = "cbi-fonts";     // fonts.googleapis.com css + fonts.gstatic.com files
const KNOWN = [STATIC, PAGES, DATA, MEDIA, FONTS];
const NET_WAIT = 6000, SLOW_WAIT = 1500, SLOW_FOR = 20000;
let slowUntil = 0;   // a frozen connection was seen: wait less until then
const MAX_MEDIA = 600, MAX_PAGES = 60, MAX_FONTS = 60;

const CORE = [
  "css/tokens.css", "css/base.css", "css/fx.css", "css/cards.css", "css/tier.css", "css/deck.css",
  "css/support.css", "css/tiermaker.css", "css/detail.css", "css/home.css", "css/battle.css", "css/cardpage.css",
  "js/fx.js", "js/app.js", "js/cards.js", "js/support.js", "js/home.js",                    // index.html
  "js/share.js", "js/tier.js", "js/tiermaker.js", "js/deckbuff.js", "js/teamscore.js",      // MODS (load later)
  "js/deck.js", "js/battle.js", "js/detail.js",
  "js/cardpage.js",                                                                          // card pages c/<id>/
];
const DATA_FILES = [
  "data/meta.json", "data/cards.json", "data/support.json", "data/teams.json", "data/buffs.json",
  "data/traits.json", "data/news.json", "data/battle.json", "data/pending/support.json",
];

const abs = (path) => new URL(path, SCOPE).href;
const rel = (url) => (url.href.startsWith(SCOPE) ? url.href.slice(SCOPE.length).split(/[?#]/)[0] : null);
const etag = (res) => res.headers.get("etag") || "";

/* ---------- install: keep every css/js file of this version (+ the data, best effort) ---------- */
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(precache());
});

async function precache() {
  if (!VER) return;
  const cache = await caches.open(STATIC);
  const before = new Map((await cache.keys()).map((req) => [new URL(req.url).pathname, req]));
  // all or nothing: a file that doesn't come = install fails, the worker before stays (tried again next visit)
  await Promise.all(CORE.map(async (path) => {
    const url = abs(path) + "?v=" + VER;
    if (await cache.match(url)) return;
    await cache.put(url, await fresh(url, before.get(new URL(url).pathname), cache));
  }));
  const data = await caches.open(DATA);
  await Promise.all(DATA_FILES.map((path) => fetch(abs(path), { cache: "no-cache" })
    .then((res) => (res.ok ? data.put(abs(path), res) : null)).catch(() => {})));
  // the site page: the first visit's page came before this worker, so keep it now (only when it is this version's)
  const pages = await caches.open(PAGES);
  if (!(await pages.match(SCOPE))) {
    let res = null;
    try { res = await fetch(SCOPE, { cache: "only-if-cached", mode: "same-origin" }); } catch {}
    if (!res || res.status !== 200) res = await fetch(SCOPE, { cache: "no-cache" }).catch(() => null);
    if (res && res.status === 200 && !res.redirected && (await res.clone().text()).includes("js/app.js?v=" + VER)) await pages.put(SCOPE, res);
  }
}

/* 1. the page itself just loaded it (index.html's files) = the browser's cache has exactly those bytes, no download
   2. the server ignores ?v=, so js/deck.js?v=128 is the same file as js/deck.js?v=127 when it didn't change:
      ask with the kept copy's ETag (or Last-Modified) → 304 = keep those bytes under the new address
   → a new ?v= downloads only the files that really changed */
async function fresh(url, prevReq, cache) {
  try {
    const res = await fetch(url, { cache: "only-if-cached", mode: "same-origin" });
    if (res.status === 200) return res;
  } catch {}
  const prev = prevReq && (await cache.match(prevReq));
  const tag = prev && etag(prev), mod = prev && prev.headers.get("last-modified");
  if (tag || mod) {
    const res = await fetch(url, { cache: "no-store", headers: tag ? { "If-None-Match": tag } : { "If-Modified-Since": mod } });
    if (res.status === 304) return prev;
    if (res.ok) return res;
    throw new Error(url + " " + res.status);
  }
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(url + " " + res.status);
  return res;
}

/* ---------- activate: drop other versions' css/js, take over open tabs ---------- */
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try { if (self.registration.navigationPreload) await self.registration.navigationPreload.enable(); } catch {}
    const cache = await caches.open(STATIC);
    await Promise.all((await cache.keys()).filter((req) => new URL(req.url).searchParams.get("v") !== VER).map((req) => cache.delete(req)));
    await Promise.all((await caches.keys()).filter((n) => n.startsWith("cbi-") && !KNOWN.includes(n)).map((n) => caches.delete(n)));
    await trim(MEDIA, MAX_MEDIA);
    await self.clients.claim();
  })());
});

/* ---------- requests ---------- */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const path = rel(url);
    if (req.mode === "navigate") return page(e, path);
    if (path === null) return;
    if (/^(css|js)\/[^/]+\.(css|js)$/.test(path) && url.searchParams.has("v")) return e.respondWith(code(e, url));
    if (/^data\/.+\.json$/.test(path)) return e.respondWith(networkFirst(e, DATA, abs(path), fetch(req)));
    if (/^images\//.test(path) || path === "site.webmanifest") return e.respondWith(media(e, req));
    return;                                             // anything else: the browser as usual
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(font(e, req, url));
});

// css / js: the kept file of this version · another version (a tab still open from before) = network, not kept
async function code(e, url) {
  if (url.searchParams.get("v") !== VER) return fetch(e.request);
  const cache = await caches.open(STATIC);
  const hit = await cache.match(url.href);
  if (hit) return hit;
  const res = await fetch(e.request);
  if (res.status === 200 && res.type === "basic") e.waitUntil(cache.put(url.href, res.clone()));
  return res;
}

// the site page / card pages: network first · offline card page never opened = the same card in the site
function page(e, path) {
  const net = Promise.resolve(e.preloadResponse).then((res) => res || fetch(e.request));
  const card = path !== null && path.match(/^c\/(?:([^/]+)\/)?(?:index\.html)?$/);
  let key = null;
  if (path === "" || path === "index.html") key = SCOPE;   // ?fbclid=… and the like = the same page
  else if (card) key = abs(path.replace(/index\.html$/, ""));
  if (!key) return e.respondWith(net);                     // sitemap.xml opened by hand etc.: network only
  e.respondWith(networkFirst(e, PAGES, key, net).catch(async (err) => {
    const app = await caches.match(SCOPE, { cacheName: PAGES });
    if (card && app) return Response.redirect(SCOPE + (card[1] ? "#card/" + card[1] : "#cards"), 302);
    throw err;
  }));
}

// network first: the network's answer (kept for later) · the kept copy when the request fails, the server
// errors (5xx), or nothing comes for NET_WAIT ms
async function networkFirst(e, cacheName, key, net) {
  const cache = await caches.open(cacheName);
  let keep = null;
  const got = net.then((res) => {
    if (res.status === 200 && res.type === "basic" && !res.redirected) keep = cache.put(key, res.clone());
    return res;
  });
  e.waitUntil(got.then(() => keep).then(() => (cacheName === PAGES ? trim(PAGES, MAX_PAGES, SCOPE) : null)).catch(() => {}));
  const hit = await cache.match(key);
  if (!hit) return got;
  let timer = 0;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => { slowUntil = Date.now() + SLOW_FOR; resolve(hit); }, Date.now() < slowUntil ? SLOW_WAIT : NET_WAIT);
  });
  const answer = got.then((res) => { slowUntil = 0; return res.status >= 500 ? hit : res; }, () => hit);
  return Promise.race([answer, late]).finally(() => clearTimeout(timer));
}

// images: the kept copy at once + a background check · kept again only when the server's copy changed
let mediaPuts = 0;
async function media(e, req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req.url);
  let keep = null;
  const got = fetch(req).then((res) => {
    if (res.status === 200 && res.type === "basic" && !(hit && etag(hit) && etag(hit) === etag(res))) {
      keep = cache.put(req.url, res.clone()).then(() => (++mediaPuts % 40 === 0 ? trim(MEDIA, MAX_MEDIA) : null));
    }
    return res;
  });
  e.waitUntil(got.then(() => keep).catch(() => {}));
  return hit || got;
}

// Google Fonts: font files from the kept copy · the css from the kept copy + a background check. The css is asked
// for in cors mode (Google allows it) so it can be kept as a normal response (an opaque one costs ~7 MB of quota)
async function font(e, req, url) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req.url);
  if (hit && url.hostname === "fonts.gstatic.com") return hit;
  const ask = url.hostname === "fonts.googleapis.com" ? fetch(req.url, { mode: "cors", credentials: "omit" }).catch(() => fetch(req)) : fetch(req);
  let keep = null;
  const got = ask.then((res) => {
    if (res.status === 200 && res.type === "cors") keep = cache.put(req.url, res.clone()).then(() => trim(FONTS, MAX_FONTS));
    return res;
  });
  e.waitUntil(got.then(() => keep).catch(() => {}));
  return hit || got;
}

/* ---------- the first visit: pictures + fonts the page loaded before this worker took over (js/app.js sends
   them once) are kept from the browser's own cache, so they show offline too ---------- */
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "warm" && Array.isArray(d.urls)) e.waitUntil(warm(d.urls.slice(0, 300)));
});

async function warm(urls) {
  const media = await caches.open(MEDIA), fonts = await caches.open(FONTS);
  for (const u of urls) {
    let url;
    try { url = new URL(u); } catch { continue; }
    const path = url.origin === self.location.origin ? rel(url) : null;
    const isFont = url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";
    const cache = isFont ? fonts : path !== null && /^images\//.test(path) ? media : null;
    if (!cache || (await cache.match(url.href))) continue;
    try {
      const res = await fetch(url.href, isFont ? { mode: "cors", credentials: "omit", cache: "force-cache" } : { cache: "force-cache" });
      if (res.status === 200 && (res.type === "basic" || res.type === "cors")) await cache.put(url.href, res);
    } catch {}
  }
  await trim(MEDIA, MAX_MEDIA);
}

// keep a cache to max entries: the oldest written go first (a re-kept file counts as new) · `spare` is never dropped
async function trim(name, max, spare) {
  const cache = await caches.open(name);
  const keys = (await cache.keys()).filter((req) => req.url !== spare);
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((req) => cache.delete(req)));
}
