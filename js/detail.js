/* ==========================================================
   Card Battle Infinity — card detail: the "Black Sun" scene (step 12)
   Built from mockup/black-sun-intro.html (v2, §13.1) and fed with the real data/cards.json.
   · Opens over any page (#card/<id>), Back = the same page in the same state (nothing underneath changes)
   · Painting: drawn ONCE per screen width (canvas → <img>), level ring drawn once per level, moved only by
     paused Web Animations (finger / mouse). The sun's running light, sparks and fog are CSS (GPU).
   · Card: tap = one 360° turn (900 ms, owner's exception to the 400 ms rule) · drag = turn (angle limited, never
     edge-on) · flick = spins and slows down · double tap = zoom · leans toward the mouse on a PC (phone tilt moves
     nothing: removed 2026-10-25). Flat 2D when it is straight,
     real 3D (thickness, two faces) only while it moves or leans. The card looks exactly like on the Cards page
     (W6: no extra sheen).
   · Labels (W6): dark glass boxes · Tier (top left) / Passive / Skill (top right) / Weakness (bottom left) /
     Strongest (bottom right) · icon + title + the card's "short" line (+ obtain under Tier) · no pointer lines ·
     fade up once after the intro · tap = that tab of the Details · phone = one strip under the card (W7) · side = left / right
   · Level change (W6): sun ring + running light + a faint tint of the scene take the level's colour, a light wave
     runs from the sun down to the card and the card glows softly
   · Graphics Low / High (W6, cbi:gfx · Low by default with ≤ 4 GB RAM): Low = no running light, still sparks /
     fog / motes, no parallax
   · Swipe left / right (outside the card), ‹ › or the arrow keys = the next card of the list it was opened from
     (that list rides in history.state.cl, see CBI.openCard). The next and previous cards are built ahead.
   · Details (W6) = phone: full screen · ≥ 768px: a full-height panel on the right (card + scene stay on the left)
     · sticky head (picture, name, tier, level, obtain + level dots) · tabs Overview / Score / Team / My card
   · Intro (dust gathering into the card) plays every time a card opens · a little faster when swiping to the next.
   · W7 scene (round 2, after the owner's clip of the game's opening): the owner's cut frames (images/silver) — sky with
     the black sun + silver wings + blue roots + light fall, gold flecks, the dark city ⇄ the crystal palace + its dust,
     fog — with the sun's top + ring, the level ring, the running light and sparkles in code · a 13.5 s cycle (gold lights
     up → dust rises where the light fall lands, the city becomes the palace → stays → dissolves) · loops stop while the
     Details are open / the tab is hidden · Low = one still picture
   · W9 (owner's picks): a big card in the middle of the room under the sun (PC ≈ 55 % of the screen height, phones ≈ 72 %
     of the width) · big PC label boxes that add items while there is room · bigger level dots on a PC · tall portrait
     screens use the owner's portrait frames (images/silver/*-p.webp) stacked: sky on top, the city / palace below
   · Support cards (owner 2026-10-28) open here too, same scene / labels / Details / case / swipe: the card shows its
     ability values (they grow with the level) instead of ATK / HP · labels Tier / Effect / Avoid / Best with ·
     ring = Value · Details: Overview (effect + values) / Score (Value) / Team (cards, decks) / My card (the case)
   Rules (PROGRESS §4.1, §11): rAF only while something moves (intro ~2.6 s, card physics, parallax) ·
   per-frame changes = paused Web Animations, never style.transform · auras only on screen (.is-live).
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;
  const rm = () => FX.reduced;

  /* ---------- small helpers ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f1 = (n) => n.toFixed(1), f2 = (n) => n.toFixed(2);
  const arr = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const pct = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const isSup = (x) => C.isSupport(x);
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const idle = (f, t = 1200) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: t }) : setTimeout(f, 120));
  const settle = (a) => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());
  const E = "cubic-bezier(.2,.8,.2,1)";
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- level palettes for the painting (canvas art: the sun ring + flecks + motes) ---------- */
  const LEVELS = {
    Normal:   { pal: ["#eef1f8", "#c9cfdb", "#9aa3b8", "#ffffff"] },
    Shiny:    { pal: ["#fff0b0", "#ecc768", "#d9a63e", "#fff8dc"] },
    Rainbow:  { pal: ["#e8607a", "#e9a75a", "#e8dc78", "#7fd39a", "#69b9e0", "#8a7be0", "#d36cc0"], byAngle: true },
    Secret:   { pal: ["#ff6a80", "#c9344b", "#8e1a2c", "#ffb0bb"] },
    Divine:   { pal: ["#ffffff", "#fff4d8", "#f2d488", "#fffbe9"] },
    Cosmic:   { pal: ["#b3a6ff", "#8f7dff", "#5ac8ff", "#dcd4ff"] },
    Ascended: { pal: ["#fffaf0", "#a9eef5", "#c5a8f5", "#f5b4dc", "#f8e7a8", "#b4f0d2"], byAngle: true },
    Godlike:  { pal: ["#ffffff", "#fffaf0", "#f6e2a8", "#e9c877"] },
    Godly:    { pal: ["#ff7aa8", "#f06a92", "#f7a35c", "#ffd36a", "#ffe2a0"], byAngle: true },
  };
  const lvOf = (name) => LEVELS[name] || LEVELS.Normal;

  /* ---------- state ---------- */
  const el = {};
  const byId = new Map();
  let cur = null;            // card shown
  let list = [], idx = 0;    // the list it was opened from + position
  let isOpen = false, ready = false, token = 0;
  let scopeEl = null, pendingScope = null, originEl = null, hiddenEl = null, prevFocus = null, baseTitle = "";
  let side = false, hud = false;
  let gfx = "high";          // graphics quality (W6): "high" | "low" · cbi:gfx
  let LY = { L: 0, T: 0, cw: 0, ch: 0, fw: 0, fh: 0 };

  /* ==========================================================
     1. The scene (W7 round 2: the layers of the owner's clip of the game's opening · placed once per width)
     ========================================================== */
  let G = null, sceneP = null, sceneW = 0, sceneH = 0;
  function sideW() { return innerWidth >= 1100 ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--side-w")) || 252) : 0; }
  // the sky is 26px bigger than the scene on every side (parallax room)
  function skySize() {
    if (!el.root.hidden && el.sky.clientWidth) return [el.sky.clientWidth, el.sky.clientHeight];
    return [innerWidth - sideW() + 52, innerHeight + 52];
  }
  const TOP_H = 44;   // = .bs --bs-top-h · W6 fix: the top bar never covers the black sun
  /* W7 round 2 pictures (images/silver, cut by the owner from the clip · owner's decision, PROGRESS rule 10):
     sky = sun + wings + blue roots + light fall, 1369 × 898 (the frame's top extended by 130 px), the black sun at
     (698, 216) r 80, the light fall ends ≈ row 790 · gold = flecks + ring at (322, 0) · city (dark) and palace (crystal)
     = the ground frames, their files start at row 61 / 219 · dust = palace dots in 2 layers · fog = a strip that wraps */
  const SKY = { src: "images/silver/sky.webp", w: 1369, h: 898, cx: 698, cy: 216, r: 80, fallEnd: 790 };
  const GOLD = { src: "images/silver/gold.webp", x: 322, y: 0, w: 752, h: 352 };
  const CITY = { src: "images/silver/city.webp", w: 1369, h: 768, top: 61, mass: 470, spire: 150 };   // rows: the castle's spire · the roofs start
  const PAL = { src: "images/silver/palace.webp", w: 1349, h: 784, top: 219 };
  const DUSTS = ["images/silver/dust0.webp", "images/silver/dust1.webp"];
  const FOG = "images/silver/fog.webp";
  /* W9 · tall portrait screens (phones, portrait tablets, a phone's "desktop site"): the owner's portrait frames, 768 wide ·
     sky-p = sky.jpg with 160 rows added on top (blurred wing colours, the sun touched the frame's top edge) and its bottom
     fading into the night, the black sun at (399, 264) r 102 · city-p / palace-p = full frames 768 × 1376 whose files start
     at row 250 (their sky fades out down to row 560, so the sky picture shows above them) · spire / clock = rows of the
     castle · gold-p = flecks + ring made from sky-p, box (22, 141) · dust-p = dots from the palace's white */
  const PORT = {
    tall: true,
    sky: { src: "images/silver/sky-p.webp", w: 768, h: 1536, cx: 399, cy: 264, r: 102 },
    gold: { src: "images/silver/gold-p.webp", x: 22, y: 141, w: 746, h: 309 },
    city: { src: "images/silver/city-p.webp", w: 768, h: 1376, top: 250, spire: 385, clock: 545 },
    pal: { src: "images/silver/palace-p.webp", w: 768, h: 1376, top: 250 },
    dusts: ["images/silver/dust-p0.webp", "images/silver/dust-p1.webp"],
  };
  const LAND = { tall: false, sky: SKY, gold: GOLD, city: CITY, pal: PAL, dusts: DUSTS };
  const setOf = (W, H) => (H >= W * 1.2 ? PORT : LAND);   // a near-square window keeps the landscape frames (the tall city would not fit)
  function sunOf(W, H) {
    const portrait = H >= W, P = setOf(W, H);
    // short phones (iPhone SE…): a smaller sun leaves the card more height · W7 round 2: the wings always reach both
    // screen edges (a big PC gets a bigger sun · W9: the portrait sky is exactly as wide as the screen at the least)
    const R = Math.max(clamp(Math.min(W, H * 0.55) * (portrait ? (H < 780 ? 0.09 : 0.118) : 0.15), 34, 84), P.sky.r * W / P.sky.w);
    // sky coordinates start 26px above the screen: the sun's top edge stays 10px under the top bar
    const sy = Math.max(portrait ? clamp(H * 0.108, 84, 150) : clamp(H * 0.135, 84, 170), 26 + TOP_H + 10 + R);
    return { sy, R, portrait, P };
  }
  const picCache = new Map();
  function loadPic(src) {
    if (!picCache.has(src)) picCache.set(src, new Promise((res) => {
      const im = new Image(); im.decoding = "async";
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im));
      im.onerror = () => { picCache.delete(src); res(null); };
      im.src = src;
    }));
    return picCache.get(src);
  }
  // Hv = the screen's height in sky coordinates (the sky box is 100lvh: taller than the screen while the page is zoomed > 1920)
  function geometry(W, H, Hv = H) {
    const { sy, R, portrait, P } = sunOf(W, H), sx = W / 2, s = R / P.sky.r;
    const sky = { x: sx - P.sky.cx * s, y: sy - P.sky.cy * s, w: P.sky.w * s, h: P.sky.h * s };
    const gold = { x: sky.x + P.gold.x * s, y: sky.y + P.gold.y * s, w: P.gold.w * s, h: P.gold.h * s };
    const fall0 = sy + R * 1.6;
    if (P.tall) {
      /* W9 portrait frames: the city / palace frame as wide as the screen, standing on its bottom edge, but never higher
         than the castle's spire just under the sun (a portrait tablet cuts the frame's bottom instead) · the light fall
         ends on the castle's clock (like the landscape clip) and the palace dust rises from there */
      const C2 = P.city, k = W / C2.w, gh = C2.h * k;
      const y0 = Math.max(H - gh, sy + R * 1.3 - C2.spire * k);
      const city = { x: 0, y: y0 + C2.top * k, w: W, h: (C2.h - C2.top) * k };
      const pal = { x: 0, y: y0 + P.pal.top * k, w: W, h: (P.pal.h - P.pal.top) * k };
      return { W, H, HL: H, sx, sy, R, s, P, CH: Math.ceil(sy + R * 1.9), sky, gold, city, pal, fall0, fall1: Math.max(fall0 + 40, y0 + C2.clock * k), portrait };
    }
    // the ground (dark city ⇄ crystal palace): at the bottom, wider than a phone (castle + gate stay centred), grown up
    // until it overlaps the sky picture (no empty dark band between them)
    // W7 round 3 · landscape (PC) = big like the clip: the whole ground stands on the screen's bottom edge (12px under it:
    // room for the parallax · the stained-glass gate in view), its roofs ≈ the lower third of the screen, never narrower
    // than the screen (a 4:3 screen crops its sides, the castle + gate stay centred) · but the castle's spire stays under
    // the black sun (an ultrawide screen gets a ground narrower than the screen: its sides fade into the roots + fog)
    const skyB = sky.y + sky.h;
    const HL = portrait ? H : Math.min(H, Hv);   // phones keep the 100lvh box (browser bars)
    const gb = HL - (portrait ? 0 : 12), need = gb - skyB + 70;
    const third = portrait ? 0 : CITY.w * (HL - 52) / 3 / (CITY.h - CITY.mass);
    const spire = portrait ? Infinity : CITY.w * (gb - sy - R * 1.25) / (CITY.h - CITY.spire);
    const GW = Math.max(Math.min(Math.max(W * (portrait ? 1.9 : 1.02), third), spire), CITY.w * need / (CITY.h - CITY.top));
    const k = GW / CITY.w, gh = CITY.h * k;
    const city = { x: (W - GW) / 2, y: gb - gh + CITY.top * k, w: GW, h: (CITY.h - CITY.top) * k };
    const k2 = GW / PAL.w;
    const pal = { x: (W - GW) / 2, y: gb - (PAL.h - PAL.top) * k2, w: GW, h: (PAL.h - PAL.top) * k2 };
    const fall1 = Math.max(fall0 + 40, sky.y + SKY.fallEnd * s);
    return { W, H, HL, sx, sy, R, s, P, CH: Math.ceil(sy + R * 1.9), sky, gold, city, pal, fall0, fall1, portrait };
  }
  // a static <img> costs nothing per frame; a big <canvas> layer is re-sent every frame something moves (mockup: drag 32 → 60 fps)
  function bake(cv, type, q) { return new Promise((res) => cv.toBlob((b) => { cv.width = cv.height = 1; res(b ? URL.createObjectURL(b) : ""); }, type, q)); }
  function setImg(img, url) { img.src = url; return img.decode ? img.decode().catch(() => {}) : Promise.resolve(); }
  function sizeCanvas(cv, w, h, dpr) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); return c; }
  // big screens: cap the pixel count (a 1920px PC at DPR 2 would be 9 MP)
  const dprFor = (W, H) => Math.max(0.75, Math.min(devicePixelRatio || 1, FX.lite ? 1.25 : 2, Math.sqrt(4.2e6 / (W * H))));
  const pick = (a, t) => a[Math.min(a.length - 1, (t * a.length) | 0)];
  /* The painting is drawn in small slices (a generator that yields) run in idle gaps, so it never blocks a tap:
     measured as one 1.5 s task on a 6× slowed phone before slicing. */
  // W4: painting ahead (prewarm, the detail still closed) waits while the page underneath scrolls and only starts a
  // slice with real idle time left — a slice that ran into a scroll frame was the slowest frame of the Cards page
  let lastScroll = -1e9;
  addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true, capture: true });
  // the same for each long piece of the painting: run f when idle and, while the detail is closed, not scrolling
  function calm(f, t) { idle(function go() { if (el.root.hidden && performance.now() - lastScroll < 400) idle(go, t); else f(); }, t); }
  function sliced(gen) {
    return new Promise((res) => {
      const next = (f) => (el.root.hidden && window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 0));
      const step = (dl) => {
        const t0 = performance.now(), open = !el.root.hidden;
        if (!open && (t0 - lastScroll < 400 || (dl && dl.timeRemaining && !dl.didTimeout && dl.timeRemaining() < 8))) { next(step); return; }
        const more = () => (dl && dl.timeRemaining && !open ? dl.timeRemaining() > 3 : performance.now() - t0 < (open ? 24 : 10));
        let r;
        do { r = gen.next(); } while (!r.done && more());
        if (r.done) res(r.value); else next(step);
      };
      next(step);
    });
  }
  // W7: canvas drawing is only recorded until something reads the pixels, so the whole painting used to be rasterized in
  // one long task when it was saved (625 ms on the 6× slowed phone, while the Cards page scrolled): reading one pixel at
  // each pause point rasterizes it slice by slice instead
  const flush = (c) => { try { c.getImageData(0, 0, 1, 1); } catch (e) {} };
  function paint() {
    return sliced(paintGen()).then((cv) => {
      const img = el.bg, old = img.src;
      return bake(cv, "image/jpeg", 0.92).then((url) => setImg(img, url)).then(() => { if (old.startsWith("blob:")) URL.revokeObjectURL(old); img.classList.add("is-on"); });
    });
  }
  // the night + the sky picture placed on the sun, and the sun's top + white ring the frame cut off (drawn once per width)
  function* paintGen() {
    const { W, H, sx, sy, R, sky } = G;
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, W, H, dprFor(W, H));
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#161a3e"); g.addColorStop(0.7, "#110a28"); g.addColorStop(1, "#110a28");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (G.skyImg) ctx.drawImage(G.skyImg, sky.x, sky.y, sky.w, sky.h);
    flush(ctx); yield;
    ctx.save(); ctx.translate(sx, sy);
    g = ctx.createLinearGradient(0, -R, 0, 0);
    g.addColorStop(0, "rgba(10,10,18,1)"); g.addColorStop(0.55, "rgba(10,10,18,.85)"); g.addColorStop(1, "rgba(10,10,18,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.005, 0, Math.PI * 2); ctx.fill();
    for (const [w, a] of [[R * 0.42, 0.18], [R * 0.16, 0.55], [R * 0.06, 0.9]]) {   // strongest on top, gone by the sides
      g = ctx.createLinearGradient(0, -R * 1.3, 0, -R * 0.1);
      g.addColorStop(0, `rgba(240,242,255,${a})`); g.addColorStop(0.7, `rgba(240,242,255,${a * 0.4})`); g.addColorStop(1, "rgba(240,242,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, R * 1.08, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    ctx.restore();
    return cv;
  }

  // mask for the running light (level colour): the bright strands of the sky picture (half resolution, made once)
  let maskURL = null;
  function makeMask() {
    const pulse = el.pulse;
    const ok = CSS.supports("mask-image", "url(a.png)") || CSS.supports("-webkit-mask-image", "url(a.png)");
    if (!ok || !G.skyImg) { pulse.hidden = true; return Promise.resolve(); }
    const { W, H, sx, sy, R, sky } = G;
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, W, H, 0.5);
    ctx.drawImage(G.skyImg, sky.x, sky.y, sky.w, sky.h);
    return sliced((function* () {
      let img; try { img = ctx.getImageData(0, 0, cv.width, cv.height); } catch (e) { return; }
      const d = img.data, w = cv.width;
      for (let i = 0, y = 0; i < d.length; i += 4) {
        const a = clamp(((d[i] + d[i + 1] + d[i + 2]) / 765 - 0.42) / 0.38, 0, 1);
        d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255;
        if ((i / 4) % w === w - 1 && ++y % 60 === 0) yield;
      }
      ctx.putImageData(img, 0, 0);
      ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.98, 0, Math.PI * 2); ctx.fill();
    })()).then(() => new Promise((res) => cv.toBlob((b) => {
      cv.width = cv.height = 1;
      if (!b) { res(); return; }
      if (maskURL) URL.revokeObjectURL(maskURL);
      maskURL = URL.createObjectURL(b);
      pulse.style.webkitMaskImage = pulse.style.maskImage = `url(${maskURL})`;
      pulse.style.setProperty("--sx", sx + "px"); pulse.style.setProperty("--sy", sy + "px");
      pulse.style.setProperty("--pr", Math.round(Math.hypot(Math.max(sx, W - sx), H - sy) * 2.1) + "px");
      pulse.classList.add("is-on");
      res();
    })));
  }

  // sun ring + flecks: only the top strip of the sky, once per level, kept as an image
  let coronaFront = null, coronaBack = null, coronaTok = 0;
  const coronaCache = new Map();
  function getCorona(name) { if (!coronaCache.has(name)) coronaCache.set(name, drawCorona(lvOf(name))); return coronaCache.get(name); }
  function clearCoronaCache() { for (const p of coronaCache.values()) p.then((u) => u && URL.revokeObjectURL(u)); coronaCache.clear(); }
  function drawCorona(lv) {
    const { W, sx, sy, R, CH } = G;
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, W, CH, dprFor(W, CH * 2));
    const r = rng(99);
    const col = (ang, t) => lv.byAngle ? lv.pal[Math.floor(((ang / (Math.PI * 2)) % 1 + 1) % 1 * lv.pal.length)] : pick(lv.pal, t);
    ctx.lineCap = "round";
    const main = lv.byAngle ? "#ffffff" : lv.pal[1];
    let g = ctx.createRadialGradient(sx, sy, R * 0.92, sx, sy, R * 1.75);
    g.addColorStop(0, main); g.addColorStop(0.2, main + "88"); g.addColorStop(1, main + "00");
    ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R * 1.75, 0, Math.PI * 2); ctx.arc(sx, sy, R * 0.95, 0, Math.PI * 2, true); ctx.fill();
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, len = 0.15 + r() * 0.5, rad = R * (1.0 + r() * 0.17);
      ctx.globalAlpha = 0.35 + r() * 0.65; ctx.strokeStyle = col(a, r()); ctx.lineWidth = 0.8 + r() * 3.4;
      ctx.beginPath(); ctx.arc(sx, sy, rad, a, a + len); ctx.stroke();
    }
    ctx.globalAlpha = 0.9; ctx.strokeStyle = lv.byAngle ? "#fff" : lv.pal[0]; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
    const n = FX.lite ? 240 : 420;
    // flecks of the level's colour on the inner wings (W7 round 2: round the ring, sweeping outward like the wings)
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 1.1 + r() * Math.PI * 1.2, rad = R * (1.04 + Math.pow(r(), 2) * 1.3);
      const x = sx + Math.cos(a) * rad * 1.25, y = sy + Math.sin(a) * rad;
      if (y > sy + R * 0.35) continue;
      const ang = a + (Math.cos(a) > 0 ? 1 : -1) * (Math.PI / 2 - 0.45) + (r() - 0.5) * 0.4;
      const len = r() < 0.4 ? 0.6 : 1.5 + r() * 4.5;
      ctx.globalAlpha = 0.45 + r() * 0.55; ctx.strokeStyle = col(Math.atan2(y - sy, x - sx), r()); ctx.lineWidth = 0.8 + r() * 1.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return bake(cv, "image/png");
  }
  function showCorona(name, instant) {
    if (!G) return Promise.resolve();
    const tok = ++coronaTok;
    return getCorona(name).then((url) => {
      if (tok !== coronaTok) return;
      const img = coronaBack; img.style.height = G.CH + "px";
      return setImg(img, url).then(() => {
        if (tok !== coronaTok) return;
        const old = coronaFront; coronaFront = img; coronaBack = old;
        if (instant) img.style.transition = "none";
        img.classList.add("is-on"); old.classList.remove("is-on");
        if (instant) { void img.offsetWidth; img.style.transition = ""; }
      });
    });
  }
  // after the first open: bake the other ring colours one by one while the phone is idle → level dots swap instantly
  let prebaked = false;
  function prebakeCoronas() {
    if (prebaked || !G) return; prebaked = true;
    const todo = Object.keys(LEVELS).filter((n) => !coronaCache.has(n));
    const next = () => { const n = todo.shift(); if (!n || !G) return; getCorona(n).then(() => idle(next, 1500)); };
    idle(next, 1500);
  }

  function buildSparks() {
    const { W, H, sx, sy, R } = G, box = el.sparks, r = rng(5);
    box.textContent = "";
    const n = FX.lite ? 8 : 16, frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      const near = i < n * 0.65, sd = r() < 0.5 ? -1 : 1;
      // near = among the wings beside the sun · the rest float over the roots below
      const x = near ? sx + sd * R * (1.5 + r() * 5) : r() * W, y = near ? sy - R * 0.6 + r() * R * 2.2 : H * (0.3 + r() * 0.4);
      s.className = (r() < 0.45 ? "sm" : "") + (r() < 0.35 ? " sv" : "");   // sv = a silver mote among the gold ones
      s.style.left = (x + 26) + "px"; s.style.top = (y + 26) + "px";
      s.style.animationDelay = (-r() * 3.4).toFixed(2) + "s"; s.style.animationDuration = (2.6 + r() * 2.4).toFixed(2) + "s";
      frag.appendChild(s);
    }
    box.appendChild(frag);
  }
  // the clip's lavender fog: one strip (wraps left-right) moving slowly
  function buildFog() {
    if (el.fog.childElementCount) return;
    for (let k = 0; k < 2; k++) { const im = new Image(); im.alt = ""; im.decoding = "async"; im.src = FOG; el.fog.appendChild(im); }
  }

  /* ---------- W7 round 2: gold flecks · the ground (dark city ⇄ crystal palace + its dust) · light running down the fall ---------- */
  const place = (n, b) => Object.assign(n.style, { left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px" });
  function buildGround() {
    palaceStop();
    const { gold, city, pal, sx, fall0, fall1, P } = G;
    if (G.goldImg) { place(el.gold, gold); el.gold.src = P.gold.src; }
    el.gold.hidden = !G.goldImg;
    if (G.cityImg) { place(el.city, city); el.city.src = P.city.src; }
    el.city.hidden = !G.cityImg;
    const ok = !!(G.palImg && G.cityImg);
    if (G.palImg) {
      place(el.palace, pal); el.palaceImg.src = P.pal.src;
      // the dust shoots up from where the light fall lands
      el.pdust.forEach((d, i) => { d.src = P.dusts[i]; d.style.transformOrigin = `50% ${Math.round(((fall1 - pal.y) / pal.h) * 100)}%`; });
    }
    el.palace.hidden = !G.palImg;
    Object.assign(el.fall.style, { left: sx + "px", top: fall0 + "px", height: Math.round(fall1 - fall0) + "px" });
    el.fall.hidden = false;
    G.ground = ok;
    if (isOpen && cycling) palaceStart();
  }
  /* the cycle (like the clip, 13.5 s): calm → gold flecks light up on the wings → dust rises where the light fall lands and
     the dark city turns into the crystal palace → it stays → it breaks into dust, the dark city comes back, the gold fades.
     Starts with each card open · one-shot Web Animations per phase (transform / opacity), so nothing animates while it
     stays (an endless animation with a still stretch still repaints every frame: −8 fps on the 6× slowed test phone) ·
     paused while the Details are open or the tab is hidden · Low / reduced motion = the palace + gold standing still */
  const PHASES = [["calm", 1500], ["gold", 3000], ["form", 3500], ["stay", 3000], ["fade", 1800], ["gap", 700]];
  let palAnims = [], cycling = false, hushed = false;
  const PC = { i: 0, t0: 0, left: 0, timer: 0 };
  const palParts = () => [el.gold, el.city, el.palaceImg, ...el.pdust];
  function palaceStop() {
    clearTimeout(PC.timer); PC.timer = 0; PC.t0 = 0;
    palAnims.forEach((a) => a.cancel()); palAnims = [];
    palParts().forEach((n) => { n.style.opacity = ""; n.style.transform = ""; });
  }
  function palacePhase(i) {
    palAnims.forEach((a) => { try { a.commitStyles(); } catch (e) {} a.cancel(); }); palAnims = [];
    const [name, dur] = PHASES[i];
    Object.assign(PC, { i, t0: performance.now(), left: dur });
    const E2 = "cubic-bezier(.2,.7,.2,1)";
    const run = (n, kf, d, easing) => palAnims.push(n.animate(kf, { duration: d || dur, fill: "forwards", easing: easing || "linear" }));
    const [d0, d1] = el.pdust;
    if (name === "calm") palParts().forEach((n) => { n.style.opacity = ""; n.style.transform = ""; });   // a clean start every cycle
    else if (name === "gold") run(el.gold, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.7, offset: 0.45 }, { opacity: 1 }], 1400, "ease-out");
    else if (name === "form") {
      [[d0, "-4%"], [d1, "5%"]].forEach(([d, x], j) => run(d, [
        { opacity: 0, transform: `translate(${x}, 6%) scale(.12, .3)` }, { opacity: 1, offset: 0.12 },
        { opacity: 1, transform: "none", offset: 0.62 + j * 0.04 }, { opacity: 0, transform: "none" }], 0, E2));
      run(el.palaceImg, [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1, offset: 0.85 }, { opacity: 1 }], 0, "ease-in-out");
      run(el.city, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.85 }, { opacity: 0 }], 0, "ease-in-out");
    } else if (name === "fade") {
      [[d0, "-5%", "-12%"], [d1, "6%", "-17%"]].forEach(([d, x, y]) => run(d, [
        { opacity: 0, transform: "none" }, { opacity: 1, offset: 0.18 }, { opacity: 0, transform: `translate(${x}, ${y}) scale(1.08)` }], 0, "ease-in"));
      run(el.palaceImg, [{ opacity: 1 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], 0, "ease-in");
      run(el.city, [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], 0, "ease-out");
      run(el.gold, [{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], 0, "ease-in");
    }
    if (hushed) palAnims.forEach((a) => a.pause());
    else PC.timer = setTimeout(() => palacePhase((i + 1) % PHASES.length), dur);
  }
  function palaceStart() {
    palaceStop(); cycling = true;
    if (!G || !G.ground || gfx === "low" || rm()) return;
    palacePhase(0);
  }
  // pause / resume the cycle where it is (the phase timer + the phase's animations)
  function palaceHold(on) {
    if (!cycling || !PC.t0) return;
    if (on) {
      if (!PC.timer) return;
      clearTimeout(PC.timer); PC.timer = 0; PC.left = Math.max(0, PC.left - (performance.now() - PC.t0));
      palAnims.forEach((a) => a.pause());
    } else if (!PC.timer) {
      PC.t0 = performance.now(); palAnims.forEach((a) => a.play());
      const i = PC.i; PC.timer = setTimeout(() => palacePhase((i + 1) % PHASES.length), PC.left);
    }
  }
  // stop the scene's own loops (Details open, tab hidden) and start them again where they were
  function hush(on) {
    hushed = !!on;
    el.root.classList.toggle("is-hush", hushed);
    palaceHold(hushed);
    motesPlay(ready);
  }

  /* Low graphics = one still picture: the painting + gold + crystal palace + fog flattened into a single image */
  let stillFor = null;
  function swapUrl(img, url) { const old = img.src; return setImg(img, url).then(() => { if (old.startsWith("blob:")) URL.revokeObjectURL(old); img.hidden = !url; }); }
  function bakeStill() {
    if (!G || stillFor === G || !el.bg.classList.contains("is-on")) return Promise.resolve();
    const g0 = G, { W, H, HL, gold, pal } = G;
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, W, H, dprFor(W, H));
    ctx.drawImage(el.bg, 0, 0, W, H);
    if (G.goldImg) ctx.drawImage(G.goldImg, gold.x, gold.y, gold.w, gold.h);
    if (G.palImg) ctx.drawImage(G.palImg, pal.x, pal.y, pal.w, pal.h);
    else if (G.cityImg) ctx.drawImage(G.cityImg, G.city.x, G.city.y, G.city.w, G.city.h);
    const f = el.fog.querySelector("img");   // the fog strip at rest: .bs-fogwrap = 40px wider each side, 10px under the screen
    if (f && f.complete && f.naturalWidth) { const fh = (HL - 52) * 0.34; ctx.drawImage(f, -14, HL - 26 - 10 - fh, W + 28, fh); }
    return bake(cv, "image/jpeg", 0.9).then((url) => {
      if (G !== g0) { URL.revokeObjectURL(url); return; }
      stillFor = g0;
      return swapUrl(el.still, url).then(() => { el.root.classList.add("has-still"); });
    });
  }

  // build (or rebuild for a new width) the whole scene · one long task per piece, spread over idle time
  function buildScene() {
    const [W, H] = skySize();
    sceneW = W; sceneH = H;
    clearCoronaCache(); prebaked = false; stillFor = null; el.root.classList.remove("has-still");
    const g0 = G = geometry(W, H, innerHeight / FX.zoom() + 52);
    const P = g0.P, pics = () => Promise.all([P.sky.src, P.gold.src, P.city.src, P.pal.src, ...P.dusts].map(loadPic))
      .then(([s, g, c, p]) => Object.assign(g0, { skyImg: s, goldImg: g, cityImg: c, palImg: p }));
    const steps = [pics, () => paint(), () => showCorona(state.rarity, true), () => makeMask(), () => { buildSparks(); buildFog(); }, () => buildGround(), () => (gfx === "low" ? bakeStill() : null)];
    sceneP = steps.reduce((p, f) => p.then(() => new Promise((res) => calm(() => (G === g0 ? Promise.resolve(f()) : Promise.resolve()).then(res, res), 400))), Promise.resolve());
    return sceneP;
  }

  // a new width = a new scene · W7 round 3: a landscape screen also for a new height (the ground is sized on it) ·
  // portrait phones never for the height (their browser bars grow / shrink it)
  function stale() {
    const [W, H] = skySize();
    return !G || Math.abs(W - sceneW) > 40 || (W > H && Math.abs(H - sceneH) > 40);
  }
  function ensureScene() {
    if (stale()) return buildScene();
    return sceneP || Promise.resolve();
  }
  // paint ahead while idle so the first open is instant · lite devices (≤ 4 GB / ≤ 4 cores / slow probe) paint on
  // the first open instead (a stand-in sky shows meanwhile), so no long painting task lands while they scroll
  function prewarm() { if (!G && byId.size && !FX.lite) calm(() => { if (!G && !FX.lite) buildScene(); }, 3000); }

  /* ==========================================================
     2. Parallax: paused Web Animations driven by finger / mouse
     ========================================================== */
  const PAR = [];
  function addPar(node, axis, px) {
    const kf = axis === "x" ? [{ transform: `translate3d(${-px}px,0,0)` }, { transform: `translate3d(${px}px,0,0)` }]
                            : [{ transform: `translate3d(0,${-px}px,0)` }, { transform: `translate3d(0,${px}px,0)` }];
    const a = node.animate(kf, { duration: 1000, fill: "both", easing: "linear" });
    a.pause(); a.currentTime = 500; PAR.push({ a, axis });
  }
  let tx = 0, ty = 0, pcx = 0, pcy = 0, parRaf = 0, lastT = 0, touching = false;
  function setTarget(x, y) {
    if (gfx === "low") return;   // Low graphics: the scene stays still
    tx = clamp(x, -1, 1); ty = clamp(y, -1, 1);
    if (!parRaf && !rm() && isOpen) { lastT = performance.now(); parRaf = requestAnimationFrame(parStep); }
  }
  function parStep(now) {
    const dt = Math.min(64, now - lastT); lastT = now;
    const k = 1 - Math.exp(-dt / 110);
    pcx += (tx - pcx) * k; pcy += (ty - pcy) * k;
    const done = Math.abs(tx - pcx) < 0.002 && Math.abs(ty - pcy) < 0.002;
    if (done) { pcx = tx; pcy = ty; }
    for (const p of PAR) p.a.currentTime = 500 + (p.axis === "x" ? pcx : pcy) * 500;
    parRaf = done || !isOpen ? 0 : requestAnimationFrame(parStep);
  }
  function resetParallax() { cancelAnimationFrame(parRaf); parRaf = 0; tx = ty = pcx = pcy = 0; for (const p of PAR) p.a.currentTime = 500; }
  const INTERACTIVE = "button, a, input, select, .bs-wrap, .bs-sheet, .bs-scrim, .bs-co, .is-strip, .bs-dock, .bs-top, .bs-cw, .bs-cwtools, .bs-cwempty";
  // no phone-tilt motion (owner, 2026-10-25): tilting the phone moves nothing · finger / mouse only
  function setupParallax() {
    addPar(el.skyX, "x", 16); addPar(el.skyY, "y", 12);
    addPar(el.sparkX, "x", 26); addPar(el.sparkY, "y", 18);
    addPar(el.fogX, "x", 36);
    addPar(el.foreX, "x", -9); addPar(el.foreY, "y", -7);
    const fromPoint = (e) => { const r = el.root.getBoundingClientRect(); setTarget(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2); };
    // PC: the card faces the mouse (lean), the scene follows it (parallax)
    const mouseLean = (e) => {
      const r = el.fore.getBoundingClientRect(), z = FX.zoom();
      const mx = clamp((e.clientX - (r.left + (LY.L + LY.cw / 2) * z)) / Math.max(200, r.width / 2), -1, 1);
      const my = clamp((e.clientY - (r.top + (LY.T + LY.ch / 2) * z)) / Math.max(200, r.height / 2), -1, 1);
      setLean(mx * LEAN.y, -my * LEAN.x);
    };
    el.root.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" && !P) { fromPoint(e); mouseLean(e); }
      else if (touching) fromPoint(e);
    }, { passive: true });
    el.root.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" && !e.target.closest(INTERACTIVE)) { touching = true; fromPoint(e); } }, { passive: true });
    const up = () => { if (touching) { touching = false; setTarget(0, 0); } };
    el.root.addEventListener("pointerup", up); el.root.addEventListener("pointercancel", up);
    el.root.addEventListener("mouseleave", () => { setTarget(0, 0); if (!P) setLean(0, 0); });
  }

  /* ==========================================================
     3. The card faces (the site's own card, both sides) · next / previous built ahead
     ========================================================== */
  const faceCache = new Map();   // id -> { f, b }
  function makeFace(card) {
    const c = C.renderCard(card, state.rarity, { tilt: false });
    c.removeAttribute("role"); c.tabIndex = -1; c.setAttribute("aria-hidden", "true");
    C.loadArt(c);   // W4: card pictures wait to be on screen · the intro reads this one before it is shown
    return c;
  }
  function faces(card) {
    let fc = faceCache.get(card.id);
    if (!fc) { fc = { f: makeFace(card), b: makeFace(card) }; faceCache.set(card.id, fc); }
    [fc.f, fc.b].forEach((x) => { if (x.dataset.rarity !== state.rarity) C.setCardRarity(x, card, state.rarity, { animate: false }); });
    return fc;
  }
  // keep only the shown card and its two neighbours (the rest is rebuilt on demand)
  function trimCache() {
    const keep = new Set([cur && cur.id, list[(idx + 1) % list.length], list[(idx - 1 + list.length) % list.length]]);
    for (const id of faceCache.keys()) if (!keep.has(id)) faceCache.delete(id);
  }
  // answer (3) of §13.1: draw the next / previous cards ahead while the phone is idle, and fetch their pictures
  function prepNeighbours() {
    if (list.length < 2) return;
    const ids = [list[(idx + 1) % list.length], list[(idx - 1 + list.length) % list.length]];
    idle(() => {
      if (!isOpen) return;
      ids.forEach((id) => {
        const c = byId.get(id); if (!c) return;
        faces(c);
        if (c.image) { const im = new Image(); im.decoding = "async"; im.src = c.image; if (im.decode) im.decode().catch(() => {}); }
      });
      trimCache();
    });
  }
  function mountFaces(card) {
    const fc = faces(card);
    el.faceF.replaceChildren(fc.f);
    el.faceB.replaceChildren(fc.b);
    el.wrap.setAttribute("aria-label", wrapLabel(card));
  }
  const wrapLabel = (card) => `${card.name}${isSup(card) ? ", support" : ""}, ${C.isRanked(card) ? "tier " + card.tier : "unranked"}, ${state.rarity}. Tap to spin`;

  /* ==========================================================
     4. Labels (Tier / Passive / Skill / Strongest / Weakness) from the real data
     ========================================================== */
  const CO_DEF = [
    { key: "tier", k: "Tier", pos: "tl", icon: "i-crown", tab: "score", cls: "bs-co--tier" },
    { key: "ability", k: "Passive / Skill", pos: "tr", icon: "i-star", tab: "overview", to: "#d-t-abilities" },
    { key: "weak", k: "Weakness", pos: "bl", icon: "i-shield-broken", tab: "overview", to: "#d-t-pc", cls: "bs-co--bad" },
    { key: "strong", k: "Strongest", pos: "br", icon: "i-sword", tab: "overview", to: "#d-t-pc", cls: "bs-co--good" },
  ];
  const coEls = [];
  const names = (card, ids) => arr(ids).map((i) => byId.get(i)).filter((c) => c && c.id !== card.id).map((c) => c.name);
  const joinShort = (a, n) => a.slice(0, n).join(", ") + (a.length > n ? ` +${a.length - n}` : "");
  const modeName = (id) => { const m = arr(state.meta && state.meta.modes).find((x) => x.id === id); return m ? m.name : pretty(id); };
  function bestModes(card, top) {
    if (!card.modes || typeof card.modes !== "object") return [];
    const ent = Object.entries(card.modes).filter(([, v]) => Number.isFinite(Number(v)));
    ent.sort((a, b) => (top ? b[1] - a[1] : a[1] - b[1]));
    return ent.length > 1 ? [modeName(ent[0][0])] : [];
  }
  // a card has ONE ability slot in the game (PROGRESS §7 B.3): passive and skill are shown together as "Passive / Skill"
  function abilities(card) {
    return [["Passive", card.passive], ["Skill", card.skill]].map(([kind, a]) => {
      a = a || {};
      const n = String(a.name || "").trim(), d = String(a.desc || "").trim();
      return n || d ? { kind, n, d } : null;
    }).filter(Boolean);
  }
  const abilityScore = (s) => {
    // = the two 15 % rows as one 30 % row (Overall is unchanged) · a missing number = use the other one
    const v = [s && s.passive, s && s.skill].filter((x) => x !== "" && x != null).map(Number).filter(Number.isFinite);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const obtainOf = (card) => String(card.obtain || "").trim();
  // W6 fix: the line under each title = the card's "short" text for that label (cards.json · ≤ 30 characters, written in
  // task B) · a card without it shows the title only (never a cut sentence)
  const shortOf = (card, key) => String((card.short && card.short[key]) || "").trim();
  // support labels (2026-10-28): Tier (Value) / Effect (the values at this level) / Avoid / Best with
  const SUP_T = { ability: "Effect", strong: "Best with", weak: "Avoid with" };
  const supShort = (s, key) => {
    if (key === "tier") return C.isRanked(s) ? `Value ${f1(pct(s.scores.value))}` : "";
    if (key === "ability") { const v = C.support.values(s); return v.length ? v.join(" · ") : ""; }
    const ids = key === "strong" ? s.bestWith : s.avoidWith;
    return joinShort(names(s, ids), 2);
  };
  function coData(card, key) {
    if (isSup(card)) {
      const d = supShort(card, key);
      if (key === "tier") return { t: C.isRanked(card) ? `Tier <span class="bs-co__tier">${esc(card.tier)}</span>` : "Unranked", d, o: obtainOf(card) };
      return { t: SUP_T[key], d: d || (key === "ability" ? "" : "Not analyzed yet") };
    }
    const d = shortOf(card, key);
    if (key === "tier") {
      const ranked = C.isRanked(card);
      return { t: ranked ? `Tier <span class="bs-co__tier">${esc(card.tier)}</span>` : "Unranked", d, o: obtainOf(card) };
    }
    return { t: { ability: "Passive / Skill", strong: "Strongest", weak: "Weakness" }[key], d };
  }
  /* W6 round 2 (back in W9, owner's pick "big like the picture") · PC: the boxes add whole items while there is room (grow()
     in layout: never a cut sentence, ≤ 4 items, a box never taller than half the card) · phones stay title + short line */
  function extrasOf(card, key) {
    const li = (t, cls = "") => `<span class="bs-co__li ${cls}">${t}</span>`;
    if (isSup(card)) {
      if (key === "tier") return [card.notes ? li(esc(String(card.notes))) : "", C.isRanked(card) ? li(`Rank #${C.support.rank(card.id)} of ${C.support.rankedCount()}`, "is-meta") : ""].filter(Boolean);
      if (key === "ability") { const e = C.support.effect(card); return [e.name ? li(`<b>${esc(e.name)}</b>`, e.desc ? "is-name" : "") : "", e.desc ? li(esc(e.desc)) : ""].filter(Boolean); }
      if (key === "strong") {
        const decks = arr(card.bestDeck).map((id) => arr(state.teams).find((t) => t && t.id === id)).filter(Boolean).map((t) => t.name || pretty(t.id));
        return decks.length ? [li(`Best decks: ${esc(decks.join(", "))}`, "is-meta")] : [];
      }
      return [];
    }
    if (key === "tier") {
      const note = String(card.tierNote || "").trim(), out = [];
      if (note) out.push(li(esc(note)));
      if (C.isRanked(card)) out.push(li(`Overall ${f1(pct(card.scores.overall))} / 100`, "is-meta"));
      return out;
    }
    if (key === "ability") return abilities(card).flatMap((a) => [a.n ? li(`<b>${esc(a.n)}</b>`, a.d ? "is-name" : "") : "", a.d ? li(esc(a.d)) : ""]).filter(Boolean);
    const good = key === "strong";
    // the short line already sums up the first point: the box goes on from the 2nd one
    const pts = arr(good ? card.strengths : card.weaknesses).map(String).slice(shortOf(card, key) ? 1 : 0, 4);
    const vs = names(card, good ? card.beats : card.losesTo);
    return [...pts.map((t) => li(esc(t), good ? "is-good" : "is-bad")), vs.length ? li(`${good ? "Beats" : "Loses to"}: ${esc(vs.join(", "))}`, "is-meta") : ""].filter(Boolean);
  }
  function grow(o, budget) {
    o.x.textContent = ""; o.x.hidden = false;   // measured while shown (a hidden box would let everything "fit")
    if (o.el.offsetHeight > budget) { o.x.hidden = true; return; }
    for (const h of (o.extras || []).slice(0, 4)) {
      o.x.insertAdjacentHTML("beforeend", h);
      if (o.el.offsetHeight > budget) { o.x.lastElementChild.remove(); break; }
    }
    const last = o.x.lastElementChild;
    if (last && last.classList.contains("is-name")) last.remove();   // an ability's name without its description: leave both out
    o.x.hidden = !o.x.childElementCount;
  }
  function buildCallouts() {
    CO_DEF.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bs-co fx-press " + (d.cls || "");
      b.setAttribute("aria-haspopup", "dialog");
      b.innerHTML = `<svg class="bs-co__i" aria-hidden="true"><use href="#${d.icon}"/></svg><span class="bs-co__n"></span><span class="bs-co__d"></span><span class="bs-co__o"></span><span class="bs-co__x" hidden></span>`;
      el.callouts.append(b);
      const o = { d, el: b, x: b.querySelector(".bs-co__x"), extras: [], data: null };
      b.addEventListener("click", () => { if (ready) openSheet(d.tab, d.to); });
      coEls.push(o);
    });
  }
  function fillCallouts(card) {
    for (const o of coEls) {
      const x = coData(card, o.d.key); o.data = x; o.extras = extrasOf(card, o.d.key);
      o.el.querySelector(".bs-co__n").innerHTML = x.t;      // our own markup, the tier letter escaped (esc) above
      const sd = o.el.querySelector(".bs-co__d"); sd.textContent = x.d; sd.hidden = !x.d;
      const ob = o.el.querySelector(".bs-co__o"); ob.textContent = x.o || ""; ob.hidden = !x.o;
      const title = o.el.querySelector(".bs-co__n").textContent;
      o.el.setAttribute("aria-label", `${title}${x.d ? ": " + x.d : ""}${x.o ? ". " + x.o : ""}. Open details`);
      if (o.d.key === "tier") { if (C.isRanked(card)) o.el.style.setProperty("--tc", `var(${C.TIER_COLOR[card.tier] || "--t-d"})`); else o.el.style.removeProperty("--tc"); }
    }
  }
  /* ==========================================================
     5. Layout (W9): a big card in the middle of the room under the sun · phone: a label strip under it · side (≥ 768):
        big label boxes left / right
     ========================================================== */
  function moveHud(on) {
    if (on === hud && el.ovr.parentElement !== null && (on ? el.ovr.parentElement === el.dockL : el.ovr.parentElement === el.foreY)) return;
    hud = on;
    if (on) { el.dockL.appendChild(el.ovr); el.dockR.appendChild(el.dbtn); ["left", "top"].forEach((p) => { el.ovr.style[p] = ""; el.dbtn.style[p] = ""; }); }
    else { el.foreY.appendChild(el.ovr); el.foreY.appendChild(el.dbtn); }
  }
  // W6 fix: label text is never cut ("…"): a line that doesn't fit shrinks in 0.5px steps (down to MIN_FS) until it does
  // a line that still doesn't fit at MIN_FS (a 30-character line on a 360px phone) wraps to a 2nd line rather than being cut
  const MIN_FS = 10.5;
  function fitLine(n, min = MIN_FS) {
    n.style.fontSize = ""; n.classList.remove("is-wrap");
    if (n.hidden) return;
    let fs = parseFloat(getComputedStyle(n).fontSize);
    while (n.scrollWidth > n.clientWidth + 0.5 && fs > min) { fs -= 0.5; n.style.fontSize = fs + "px"; }
    if (n.scrollWidth > n.clientWidth + 0.5) n.classList.add("is-wrap");
  }
  function fitLines(o) { o.el.querySelectorAll(".bs-co__n, .bs-co__d, .bs-co__o").forEach((n) => fitLine(n)); }
  // all four short lines end up the same size (the smallest one any box needed), so the boxes read evenly
  function evenShorts() {
    const ds = coEls.map((o) => o.el.querySelector(".bs-co__d")).filter((n) => !n.hidden && !n.classList.contains("is-wrap"));
    if (!ds.length) return;
    const fs = Math.min(...ds.map((n) => parseFloat(getComputedStyle(n).fontSize)));
    ds.forEach((n) => { n.style.fontSize = fs + "px"; });
  }
  function layout() {
    if (el.root.hidden) return;
    const rw = el.root.clientWidth, rh = el.root.clientHeight;
    if (!rw || !rh) return;
    // side = labels left / right (landscape, ≥ 768) · otherwise stacked: a label strip under the card (phones, portrait tablets)
    side = (rw >= 768 && rw >= rh * 0.95) || (rw >= 600 && rw > rh * 1.15);
    el.root.classList.toggle("is-side", side);
    const fw = el.fore.clientWidth, fh = el.fore.clientHeight;
    const topH = el.fore.offsetTop;
    const [W, H] = skySize(), sun = sunOf(W, H);
    const sunB = Math.round(sun.sy + sun.R - 26 - topH + 12);   // just under the black sun, in foreground coordinates
    /* W9 (owner's picks): the card stands in the middle of the room between the sun (+ a stretch of the light fall under
       it, so a level change shows on the sun and the fall) and the bottom row · that stretch is gapMin…gapMax (the card gets
       smaller rather than hide it) · the card never covers the sun (a very short screen shrinks it, down to min) */
    const stand = (top, bot, want, gapMin, gapMax, min) => {
      const room = bot - top, h = Math.round(Math.max(min, Math.min(want, room - gapMin)));
      const g = Math.max(0, Math.min(gapMax, room - h));
      return { h, T: Math.round(top + g + Math.max(0, room - g - h) / 2) };
    };
    const co = {}; coEls.forEach((o) => { co[o.d.key] = o; o.el.style.height = ""; });
    let cw, T, L, ch, B;

    el.callouts.classList.toggle("is-strip", !side);
    if (!side) {
      /* W9: the card ≈ 72 % of the width (a short phone: what the height leaves) · under it ONE short strip of the 4 labels
         (W7 round 2 · swipe sideways) · Overall ring + Details · hint */
      coEls.forEach((o) => {
        ["left", "top", "width"].forEach((p) => { o.el.style[p] = ""; }); o.x.textContent = ""; o.x.hidden = true;
        o.el.querySelectorAll(".bs-co__n, .bs-co__d, .bs-co__o").forEach((n) => { n.style.fontSize = ""; n.classList.remove("is-wrap"); });   // chips size to their text
      });
      // W9: the first-time hint always floats over the bottom bar (it took a 38px row under the ring: the card gets it)
      el.root.classList.add("is-short");
      const STRIP = 56, rowY0 = fh - 6 - 60, stripY0 = rowY0 - 10 - STRIP, cb = stripY0 - 12;
      const pl = stand(Math.max(8, sunB), cb, Math.min(fw * 0.72, 720) * 1.4, clamp(rh * 0.04, 20, 60), clamp(rh * 0.06, 24, 120), 154);
      cw = Math.round(pl.h / 1.4); ch = Math.round(cw * 1.4);
      moveHud(false);
      L = Math.round((fw - cw) / 2);
      T = pl.T;
      B = T + ch;
      LY = { L, T, cw, ch, fw, fh, B, rw, rh };
      el.root.style.setProperty("--cw", cw + "px");
      el.wrap.style.left = L + "px"; el.wrap.style.top = T + "px";
      const stripY = B + 12, ry = stripY + STRIP + 10;
      el.callouts.style.top = stripY + "px";
      const dbw = el.dbtn.offsetWidth || 120, rowW = 60 + 14 + dbw, rx = Math.round((fw - rowW) / 2);
      el.ovr.style.left = rx + "px"; el.ovr.style.top = ry + "px";
      el.dbtn.style.left = (rx + 74) + "px"; el.dbtn.style.top = (ry + 6) + "px";
      el.root.style.removeProperty("--hint-w");
    } else {
      el.root.classList.remove("is-short");
      el.callouts.style.top = "";
      /* W9 (owner's picks, like images/silver/portrait-src/ref-pc-old-layout.jpg): the card ≈ 55 % of the whole screen
         height (Overall ring + Details in the bottom bar) · big boxes left / right of it (W6 round 2): as wide as the room
         beside the card allows (190–380px), adding whole items while there is room */
      const big = matchMedia("(min-height: 560px)").matches;   // = the CSS big boxes (a phone on its side keeps small ones, W7 round 3)
      const gap = big ? 32 : 28, wMin = big ? 190 : 150, wMax = big ? 380 : 260;
      const cap = Math.min(560, fw * 0.42, fw - 2 * (wMin + gap + 14));
      const pl = stand(Math.max(8, sunB), fh - 14, Math.min(cap * 1.4, rh * 0.55), 24, clamp(rh * 0.11, 24, 150), 140);
      cw = Math.round(pl.h / 1.4); ch = Math.round(cw * 1.4);
      el.root.style.setProperty("--cw", cw + "px");
      moveHud(true);
      L = Math.round((fw - cw) / 2);
      T = pl.T;
      B = T + ch;
      LY = { L, T, cw, ch, fw, fh, B, rw, rh };
      el.wrap.style.left = L + "px"; el.wrap.style.top = T + "px";
      const w = Math.round(clamp(L - gap - 16, wMin, wMax));   // the boxes use the room beside the card
      coEls.forEach((o) => { o.el.style.width = w + "px"; o.x.textContent = ""; fitLines(o); }); evenShorts();
      const budget = Math.floor((ch * 0.88 - 16) / 2);          // each box: at most half the card (upper + lower never meet)
      coEls.forEach((o) => (big ? grow(o, budget) : (o.x.hidden = true)));
      for (const [a, b, right] of [[co.tier, co.weak, false], [co.ability, co.strong, true]]) {
        const x = right ? L + cw + gap : L - gap - w;
        const ha = a.el.offsetHeight, hb = b.el.offsetHeight;
        // upper box from the card's top part down, lower box from its bottom part up
        let ya = T + ch * 0.06, yb = B - ch * 0.06 - hb;
        if (yb < ya + ha + 16) yb = ya + ha + 16;
        if (yb + hb > fh - 4) { const s = yb + hb - (fh - 4); yb -= s; ya = Math.max(4, ya - s); }
        [[a, ya], [b, yb]].forEach(([o, y]) => { o.el.style.left = x + "px"; o.el.style.top = Math.round(y) + "px"; });
      }
      el.root.style.setProperty("--hint-w", Math.max(160, Math.round(fw / 2 - sun.R - 28)) + "px");   // the hint stays left of the sun
    }
    const zs = Math.min(1.7, (fh - 16) / ch, (fw - 24) / cw);
    el.zoom.style.setProperty("--zs", zs.toFixed(3)); el.zoom.style.setProperty("--zy", Math.round(fh / 2 - (T + ch / 2)) + "px");
    el.pager.textContent = list.length > 1 ? `${idx + 1} / ${list.length}${side ? "" : " · swipe ← →"}` : "";
    // the card's name in the top bar: smaller before it would be cut (only a very long name still ends in "…")
    fitLine(el.name, 10.5);   // too long even then: 2 lines (CSS .is-wrap)
    placeInd(el.lv, true);    // W9: the dots' size follows the layout (side = bigger)
    if (sheetOpen) sheetSide();
    if (wheelOn) layoutWheel();
  }
  // W6 fix: re-check the size after the scene is up (phone browser bars grow / shrink, fonts arrive): an old size used to
  // leave the scene small with an empty strip at the bottom
  function relayoutIfResized() {
    if (!isOpen || el.root.hidden) return;
    if (el.root.clientWidth !== LY.rw || el.root.clientHeight !== LY.rh) { layout(); if (Math.abs(LY.cw - motesCW) > 2) { buildMotes(); targetCache = null; } }
  }

  /* ---------- labels: once the intro is over the boxes fade up one after another (once per card) ---------- */
  let coAnims = [];
  function hideCallouts() {
    coAnims.forEach((a) => a.cancel()); coAnims = [];
    for (const o of coEls) { o.el.style.opacity = ""; o.el.style.transform = ""; }
  }
  // a finished animation still keeps its element as its own layer; commit the end state as plain styles instead (§13.1 lesson 6)
  function keep(an) { an.onfinish = () => { try { an.commitStyles(); } catch (e) {} an.cancel(); const i = coAnims.indexOf(an); if (i >= 0) coAnims.splice(i, 1); }; return an; }
  function showCallouts() {
    hideCallouts();
    const on = { fill: "forwards" };
    const push = (...xs) => xs.forEach((x) => coAnims.push(keep(x)));
    coEls.forEach((o, i) => {
      push(o.el.animate(rm() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
        { duration: 280, delay: i * 90, easing: E, ...on }));
    });
  }

  /* ---------- Overall ring ---------- */
  let ovrVal = 0, ovrRaf = 0;
  function setOverall(card, anim) {
    const ranked = C.isRanked(card), v = ranked ? Math.round(pct(isSup(card) ? card.scores.value : card.scores.overall)) : 0;
    el.ovr.classList.toggle("is-unranked", !ranked);
    el.ovrLbl.textContent = ranked ? (isSup(card) ? "VALUE" : "OVERALL") : "UNRANKED";
    cancelAnimationFrame(ovrRaf); ovrRaf = 0;
    if (!ranked) { el.ovrArc.setAttribute("stroke-dasharray", "0 100"); el.ovrNum.textContent = "—"; ovrVal = 0; return; }
    if (!anim || rm()) { el.ovrArc.setAttribute("stroke-dasharray", `${v} 100`); el.ovrNum.textContent = v; ovrVal = v; return; }
    el.ovrArc.style.opacity = 0;
    setTimeout(() => { el.ovrArc.setAttribute("stroke-dasharray", `${v} 100`); el.ovrArc.style.opacity = 1; }, 170);
    const from = ovrVal, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 520);
      el.ovrNum.textContent = Math.round(from + (v - from) * (1 - Math.pow(1 - k, 3)));
      ovrRaf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    ovrRaf = requestAnimationFrame(step); ovrVal = v;
    el.ovr.classList.remove("is-bump"); void el.ovr.offsetWidth; el.ovr.classList.add("is-bump");
  }

  /* ---------- light motes around the card ---------- */
  let motesCW = 0;
  function buildMotes() {
    const box = el.swirl;
    box.querySelectorAll(".bs-mote").forEach((m) => m.getAnimations().forEach((x) => x.cancel()));
    box.textContent = "";
    const n = FX.lite ? 7 : 14, r = rng(31), cw = LY.cw, ch = LY.ch;
    motesCW = cw;
    const d = () => f1((r() - 0.5) * 30);
    for (let i = 0; i < n; i++) {
      const m = document.createElement("i"); m.className = "bs-mote" + (r() < 0.4 ? " sm" : "");
      const a = (i / n) * Math.PI * 2 + r() * 0.4, rx = cw * (0.55 + r() * 0.17), ry = ch * (0.52 + r() * 0.14);
      m.style.left = f1(cw / 2 + Math.cos(a) * rx) + "px"; m.style.top = f1(ch / 2 + Math.sin(a) * ry) + "px";
      box.appendChild(m);
      if (rm()) { m.style.opacity = ".6"; continue; }
      m.animate([
        { transform: "translate(0,0) scale(.5)", opacity: 0 },
        { transform: `translate(${d()}px,${d()}px) scale(1)`, opacity: 0.95, offset: 0.25 },
        { transform: `translate(${d()}px,${d()}px) scale(.8)`, opacity: 0.5, offset: 0.5 },
        { transform: `translate(${d()}px,${d()}px) scale(1)`, opacity: 0.9, offset: 0.75 },
        { transform: "translate(0,0) scale(.5)", opacity: 0 },
      ], { duration: 5200 + r() * 3800, iterations: Infinity, delay: -r() * 6000, easing: "ease-in-out" });
    }
    moteColors();
  }
  const moteAnims = () => [...el.swirl.querySelectorAll(".bs-mote")].flatMap((m) => m.getAnimations());
  function motesPlay(on) { on = on && gfx !== "low" && !hushed; moteAnims().forEach((x) => (on ? x.play() : x.pause())); }
  function moteColors() {
    const lv = lvOf(state.rarity), ms = el.swirl.children;
    for (let i = 0; i < ms.length; i++) ms[i].style.setProperty("--c", lv.byAngle ? lv.pal[i % lv.pal.length] : lv.pal[i % 2 ? 0 : 1]);
  }

  /* ==========================================================
     6. 3D card: tap = one 360° turn · drag = turn · flick = spins · release = spring back
     ========================================================== */
  /* R3.ang / R3.tx = the turn (yaw) and up-down tilt (pitch) from the finger · ly / lx = the lean from the mouse (PC)
     or the mouse (eased toward tly / tlx). Shown: yaw = ang + ly, pitch = tx + lx. Outside a spin (tap 360° / flick)
     both are soft-limited so the card never turns edge-on (owner, 2026-10-25). */
  const R3 = { ang: 0, vel: 0, tx: 0, vtx: 0, mode: "rest", target: 0, raf: 0, last: 0, release: false, tw: null, spin: false, base: 0, ly: 0, lx: 0, tly: 0, tlx: 0 };
  const SK = 90, SC = 2 * Math.sqrt(SK) * 0.62, KX = 140, CX = 2 * Math.sqrt(KX) * 0.75;
  const MAX_YAW = 42, MAX_PITCH = 24, DRAG_YAW = 36, DRAG_PITCH = 18;
  const LEAN = { y: 16, x: 12 };   // degrees with the mouse at the edge (PC only)
  const soft = (v, m) => m * Math.tanh(v / m);   // rubber-band limit: grows slower and slower toward ±m
  let A3 = null;
  const mod360 = (a) => ((a % 360) + 360) % 360;
  const leaning = () => Math.abs(R3.tly) > 0.01 || Math.abs(R3.tlx) > 0.01 || Math.abs(R3.ly) > 0.05 || Math.abs(R3.lx) > 0.05;
  function enter3D() {
    if (A3) return;
    el.wrap.classList.add("is-3d");
    const lin = { duration: 3600, fill: "both", easing: "linear" };
    const y = el.rotor.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }], lin);
    const x = el.tiltEl.animate([{ transform: "rotateX(-30deg)" }, { transform: "rotateX(30deg)" }], { duration: 1000, fill: "both" });
    A3 = { y, x, all: [y, x] };
    A3.all.forEach((a) => a.pause());
    apply3D();
  }
  // back to flat 2D (card straight)
  function exit3D() {
    if (!A3) return;
    A3.all.forEach((a) => a.cancel()); A3 = null;
    el.wrap.classList.remove("is-3d"); busy(false);
  }
  function busy(on) { el.fore.classList.toggle("is-busy", on); }   // motes swirl: only while it really turns, not for a lean
  function shown() {
    let yaw = R3.ang + R3.ly, pitch = R3.tx + R3.lx;
    if (!R3.spin) yaw = R3.base + soft(yaw - R3.base, MAX_YAW);
    return [yaw, soft(pitch, MAX_PITCH)];
  }
  function apply3D() {
    if (!A3) return;
    const [yaw, pitch] = shown();
    const t = mod360(yaw) * 10;
    A3.y.currentTime = t;
    const xt = (clamp(pitch, -30, 30) + 30) / 60 * 1000;
    A3.x.currentTime = xt;
  }
  // the mouse (PC) sets where the card leans to (eased in tick)
  function setLean(y, x) {
    if (!isOpen || rm() || el.root.hidden || wheelOn) return;
    const ny = Math.abs(y) < 0.6 ? 0 : y, nx = Math.abs(x) < 0.6 ? 0 : x;   // tiny = straight (flat 2D again)
    if (Math.abs(ny - R3.tly) < 0.15 && Math.abs(nx - R3.tlx) < 0.15 && (ny || nx || !A3)) return;
    R3.tly = ny; R3.tlx = nx;
    if (!ready) return;          // during the intro the card isn't there yet; it picks the lean up on reveal
    if (leaning()) enter3D();
    kick();
  }
  function kick() { if (!R3.raf) { R3.last = performance.now(); R3.raf = requestAnimationFrame(tick); } }
  function tick(now) {
    const dt = Math.min(0.034, (now - R3.last) / 1000); R3.last = now;
    const m = R3.mode;
    if (m === "free") {
      R3.vel *= Math.exp(-0.85 * dt); R3.ang += R3.vel * dt; el.fore.classList.toggle("is-ccw", R3.vel < 0);
      if (Math.abs(R3.vel) < 240) { R3.mode = "spring"; R3.target = (R3.vel > 0 ? Math.ceil(R3.ang / 360) : Math.floor(R3.ang / 360)) * 360; }
    } else if (m === "spring") {
      R3.vel += (-SK * (R3.ang - R3.target) - SC * R3.vel) * dt; R3.ang += R3.vel * dt;
    } else if (m === "tween") {
      const k = Math.min(1, (now - R3.tw.t0) / R3.tw.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      R3.ang = R3.tw.a0 + (R3.tw.a1 - R3.tw.a0) * e;
      if (k >= 1) { R3.mode = "spring"; R3.target = R3.tw.a1; R3.vel = 0; }
    }
    if (m !== "drag") { R3.vtx += (-KX * R3.tx - CX * R3.vtx) * dt; R3.tx += R3.vtx * dt; }
    const kl = 1 - Math.exp(-dt / 0.12);
    R3.ly += (R3.tly - R3.ly) * kl; R3.lx += (R3.tlx - R3.lx) * kl;
    const leanDone = Math.abs(R3.tly - R3.ly) < 0.05 && Math.abs(R3.tlx - R3.lx) < 0.05;
    if (leanDone) { R3.ly = R3.tly; R3.lx = R3.tlx; }
    if (R3.mode === "spring" && Math.abs(R3.ang - R3.target) < 0.25 && Math.abs(R3.vel) < 6 && Math.abs(R3.tx) < 0.3 && Math.abs(R3.vtx) < 6) {
      R3.ang = 0; R3.tx = 0; R3.vel = 0; R3.vtx = 0; R3.mode = "rest"; R3.spin = false; R3.base = 0; busy(false);
      if (R3.release) { R3.release = false; buzz(); }
    }
    apply3D();
    if (R3.mode === "rest" && leanDone) {
      R3.raf = 0;
      if (!leaning()) exit3D();    // straight again → back to a flat 2D card · still leaning → stays 3D, no rAF
      return;
    }
    R3.raf = requestAnimationFrame(tick);
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {} }
  // stop the finger / spin part; the lean (mouse) carries on
  function stopCard() {
    cancelAnimationFrame(R3.raf); R3.raf = 0;
    Object.assign(R3, { mode: "rest", ang: 0, tx: 0, vel: 0, vtx: 0, spin: false, base: 0 });
    busy(false); apply3D();
    if (leaning() && ready) kick(); else { R3.ly = R3.lx = 0; exit3D(); }
    clearTimeout(tapTimer); tapTimer = 0; P = null; el.wrap.classList.remove("is-grab");
  }
  function resetLean() { R3.tly = R3.tlx = R3.ly = R3.lx = 0; }
  function spinOnce() {
    if (R3.mode === "drag" || !el.wrap.classList.contains("is-in")) return;
    if (rm()) { el.faceF.querySelectorAll(".gc__flash").forEach((f) => f.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: 300 })); return; }
    if (R3.mode === "rest") R3.ang = 0;
    hideHint(); enter3D(); busy(true);
    const a0 = R3.ang, a1 = (Math.round(a0 / 360) + 1) * 360;   // one more full turn, always ends on the front
    R3.mode = "tween"; R3.spin = true; R3.tw = { a0, a1, t0: performance.now(), dur: 900 }; R3.release = false;
    kick();
  }
  function toggleZoom(force) {
    const on = typeof force === "boolean" ? force : !el.fore.classList.contains("is-zoom");
    el.fore.classList.toggle("is-zoom", on); if (on) hideHint();
  }
  let P = null, tapTimer = 0, lastTap = 0;
  const dpp = () => 200 / Math.max(120, el.wrap.offsetWidth * FX.zoom());   // degrees per pixel of finger movement
  function setupCard() {
    const w = el.wrap;
    w.addEventListener("pointerdown", (e) => {
      if (P || !w.classList.contains("is-in") || (e.pointerType === "mouse" && e.button !== 0)) return;
      try { w.setPointerCapture(e.pointerId); } catch (err) {}
      P = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), drag: false, a0: 0, s: [] };
    });
    w.addEventListener("pointermove", (e) => {
      if (!P || e.pointerId !== P.id || rm()) return;
      const dx = e.clientX - P.x0, dy = e.clientY - P.y0, now = performance.now();
      if (!P.drag && Math.hypot(dx, dy) > 7) {
        P.drag = true; clearTimeout(tapTimer); tapTimer = 0; hideHint();
        if (R3.mode === "rest") R3.ang = 0;
        R3.base = Math.round(R3.ang / 360) * 360;          // the front it springs back to (a grab mid-spin stays a spin)
        P.a0 = R3.ang - dx * dpp(); R3.mode = "drag"; R3.vel = 0; R3.vtx = 0;
        enter3D(); busy(true); kick(); w.classList.add("is-grab");
      }
      if (P.drag) {
        const a = P.a0 + dx * dpp();
        R3.ang = R3.spin ? a : R3.base + soft(a - R3.base, DRAG_YAW);   // limited: never edge-on (only a flick spins)
        R3.tx = soft(-dy * 0.16, DRAG_PITCH);
        P.s.push([e.clientX, now]); while (P.s.length > 2 && now - P.s[0][1] > 90) P.s.shift();
      }
    });
    const end = (e) => {
      if (!P || e.pointerId !== P.id) return;
      const p = P; P = null; w.classList.remove("is-grab");
      if (p.drag) {
        let v = 0;
        if (p.s.length > 1) { const a = p.s[0], b = p.s[p.s.length - 1]; v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]) * 1000 * dpp(); }
        if (performance.now() - (p.s.length ? p.s[p.s.length - 1][1] : 0) > 80) v = 0;   // finger stopped before lifting
        R3.vel = clamp(v, -3400, 3400); R3.release = true;
        if (Math.abs(R3.vel) > 650 && e.type !== "pointercancel") { R3.mode = "free"; R3.spin = true; }   // flick → several turns, ends on the front
        else { R3.mode = "spring"; R3.target = R3.spin ? Math.round(R3.ang / 360) * 360 : R3.base; }      // gentle release → springs back
        kick();
      } else if (e.type === "pointerup" && performance.now() - p.t0 < 380) {
        const now = performance.now();
        if (tapTimer && now - lastTap < 300) { clearTimeout(tapTimer); tapTimer = 0; toggleZoom(); return; }   // double tap = zoom
        lastTap = now;
        tapTimer = setTimeout(() => { tapTimer = 0; spinOnce(); }, 260);
      }
    };
    w.addEventListener("pointerup", end); w.addEventListener("pointercancel", end);
    w.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); spinOnce(); }
      else if (e.key === "z" || e.key === "Z") toggleZoom();
    });
    w.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ==========================================================
     7. Next / previous card (swipe outside the card, ‹ ›, arrow keys)
     ========================================================== */
  let SW = null, switching = false;
  function setupSwipe() {
    el.root.addEventListener("pointerdown", (e) => {
      if (e.target.closest(INTERACTIVE)) { SW = null; return; }
      SW = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    el.root.addEventListener("pointerup", (e) => {
      if (!SW || e.pointerId !== SW.id) return;
      const dx = e.clientX - SW.x, dy = e.clientY - SW.y, dt = performance.now() - SW.t; SW = null;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 700) step(dx < 0 ? 1 : -1);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && el.fore.classList.contains("is-zoom")) toggleZoom(false);
    });
    el.prev.addEventListener("click", () => step(-1));
    el.next.addEventListener("click", () => step(1));
  }
  function step(dir) {
    // during the intro (introRaf) the next swipe is allowed too: §4, the user can go on while it plays
    if (wheelOn || list.length < 2 || switching || R3.mode !== "rest" || el.fore.classList.contains("is-zoom") || !(ready || introRaf) || sheetOpen) return;
    const id = list[(idx + dir + list.length) % list.length];
    if (!byId.has(id)) return;
    C.swapCard(id);                // same history entry (Back still closes the detail in one step)
    switchTo(id, dir);
  }
  // swipe → the card slides out (170 ms), then the intro plays for the next card, a little faster (owner, 2026-10-25)
  function switchTo(id, dir) {
    const card = byId.get(id);
    if (!card) return;
    const i = list.indexOf(id);
    if (i >= 0) idx = i;
    const visible = el.wrap.classList.contains("is-in");
    switching = true; stopIntro(); hideHint(); stopCard(); toggleZoom(false);
    introTimers.forEach(clearTimeout); introTimers = [];
    hideCallouts();
    const mine = token;
    const next = () => {
      if (mine !== token) return;
      el.wrap.getAnimations().forEach((a) => a.cancel());
      show(card);
      switching = false;
      runIntro(true);
    };
    if (!visible) { next(); return; }
    const out = el.wrap.animate(rm() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: "none", opacity: 1 }, { transform: `translateX(${-dir * 48}px) scale(.94)`, opacity: 0 }],
      { duration: 170, easing: "ease-in", fill: "forwards" });
    out.onfinish = next;
    out.oncancel = () => { switching = false; };
  }
  // put a card in the scene (faces, texts, layout) without any animation
  function show(card) {
    cur = card;
    mountFaces(card);
    fillCallouts(card);
    el.name.textContent = card.name;
    document.title = `${card.name} — ${baseTitle}`;
    el.root.setAttribute("aria-label", `${card.name} details`);
    sheetKey = "";
    layout();
    if (Math.abs(LY.cw - motesCW) > 2) buildMotes();
  }
  function afterShow() { prefillSheet(); prepNeighbours(); }

  /* ==========================================================
     8. Details (W6): phone = full screen · ≥ 768 = a full-height panel on the right (the card + scene stay on the left)
        sticky head (picture, name, tier, level, obtain + level dots) · tabs Overview / Score / Team / My card
     ========================================================== */
  // Passive + Skill (15 % + 15 %) = one "Passive / Skill" row of 30 % (the card has one ability slot) · Overall unchanged
  const SCORE_ROWS = [["atk", "ATK", 12.5], ["hp", "HP", 12.5], ["ability", "Passive / Skill", 30], ["matchup", "Matchup", 25], ["team", "Team", 20]];
  const scoreOf = (s, k) => (k === "ability" ? abilityScore(s) : pct(s[k]));
  const EXTRA_STATS = [["def", "DEF"], ["status", "Status DMG"]];
  const hasBase = (card, k) => !!(card.base && Number(card.base[k]) > 0);
  const fmtSlot = (p) => {
    const t = String(p ?? "").trim();
    if (!t) return "";
    if (/^\d+$/.test(t)) return "Slot " + t;
    if (/^\d+\s*[-–]\s*\d+$/.test(t)) return "Slots " + t.replace(/\s*[-–]\s*/, "–");
    return t;
  };
  const TABS = ["overview", "score", "team", "mine"];
  const modesOf = (card) => (card.modes && typeof card.modes === "object" ? Object.entries(card.modes) : [])
    .map(([id, v]) => [id, Number(v)]).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
  const bar = (label, v, i, extra = "") => `
        <div class="score" style="--v:${pct(v) / 100};--d:${150 + i * 60}ms">
          <span class="score__name">${label}</span>${extra}
          <span class="score__num" data-value="${Math.round(pct(v))}">${Math.round(pct(v))}</span>
          <span class="score__track"><i></i></span>
        </div>`;
  // support (2026-10-28): the same four tabs · Overview = effect + its values at this level · Score = Value · Team = cards / decks
  const SUP_ROWS = [["effect", "Effect power", 40], ["reliability", "Reliability", 20], ["flexibility", "Flexibility", 20], ["synergy", "Peak synergy", 20]];
  function supSheetHTML(sp) {
    const ranked = C.isRanked(sp), sc = sp.scores || {}, e = C.support.effect(sp);
    const pane = (id, html) => `<div class="bs-pane" id="bs-pane-${id}" role="tabpanel" aria-labelledby="bs-tab-${id}" tabindex="-1" data-pane="${id}" hidden>${html}</div>`;
    const row = (id, ids) => arr(ids).some((x) => byId.has(x)) ? `<div class="mini-row" id="${id}" data-card-list></div>` : `<p class="muted">Not analyzed yet</p>`;
    const vals = C.supVals(sp);
    const decks = arr(sp.bestDeck).map((id) => arr(state.teams).find((t) => t && t.id === id)).filter(Boolean);
    const modes = modesOf(sp);
    const overview = `
        <section class="dpanel" aria-labelledby="d-t-stats">
          <h3 class="dpanel__title" id="d-t-stats">Values <span class="bs-stats__lv" data-d="lv">${esc(state.rarity)}</span></h3>
          <dl class="bs-stats">
            ${vals.map((v, i) => `<div class="bs-stat bs-stat--sv"><dt>${vals.length > 1 ? "Effect " + (i + 1) : "Effect"}</dt><dd data-d="sv${i}" data-value="0">0</dd></div>`).join("")}
            <div class="bs-stat bs-stat--odds"><dt>Pull odds</dt><dd data-d="odds"></dd></div>
          </dl>
          ${vals.length ? `<p class="dpanel__sub">Every rarity adds 25% of the Normal value (Godly = 3×).</p>` : ""}
        </section>
        <section class="dpanel" aria-labelledby="d-t-abilities">
          <h3 class="dpanel__title" id="d-t-abilities">Effect</h3>
          ${e.name || e.desc ? `<div class="ability">${e.name ? `<b class="ability__name">${esc(e.name)}</b>` : ""}${e.desc ? `<p class="ability__desc" data-d="eff">${esc(e.desc)}</p>` : ""}</div>` : `<p class="muted">None</p>`}
        </section>
        <section class="dpanel" aria-labelledby="d-t-pc">
          <h3 class="dpanel__title" id="d-t-pc">Where to run it</h3>
          <div class="group"><h4 class="group__title group__title--good">Best on these cards</h4>${row("d-with", sp.bestWith)}</div>
          <div class="group"><h4 class="group__title group__title--bad">Don't pair with</h4>${row("d-avoid", sp.avoidWith)}</div>
        </section>
        ${sp.updated ? `<p class="detail__foot">Updated ${esc(sp.updated)}</p>` : ""}`;
    const score = ranked ? `
        <section class="dpanel" aria-labelledby="d-t-overall">
          <h3 class="dpanel__title" id="d-t-overall">Value score</h3>
          <div class="overall">
            <div class="overall__score"><span class="overall__num" data-d="overall" data-value="0">0</span><span class="overall__max">/ 100</span></div>
            <div class="overall__tier"><span class="badge badge--tier">${esc(sp.tier)}</span><small>Tier</small></div>
          </div>
          <p class="dpanel__sub">Rank #${C.support.rank(sp.id)} of ${C.support.rankedCount()} · weighted sum of four scores, each out of 100, judged at Godly.</p>
          <div class="scores">${SUP_ROWS.map(([k, label, w], i) => bar(label, pct(sc[k]), i, `<span class="score__weight">${w}%</span>`).replace('class="score__num"', `class="score__num" data-d="s-${k}"`)).join("")}</div>
        </section>`
      : `<section class="dpanel" aria-labelledby="d-t-overall">
          <h3 class="dpanel__title" id="d-t-overall">Value score</h3>
          <div class="unranked"><span class="badge badge--muted">Unranked</span><span>Only the top ${C.rankTop()} support cards get a Value score and a tier. Decks still count this one, from its effect at the deck's rarity.</span></div>
        </section>`;
    const teamHTML = `
        <section class="dpanel" aria-labelledby="d-t-team">
          <h3 class="dpanel__title" id="d-t-team">Decks</h3>
          <div class="group"><h4 class="group__title">Best decks</h4>${decks.length ? `<div class="chips">${decks.map((t) => `<span class="supchip">${esc(t.name || pretty(t.id))}</span>`).join("")}</div>` : `<p class="muted">Not analyzed yet</p>`}</div>
          ${sp.notes ? `<div class="group"><h4 class="group__title">Notes</h4><p class="dpanel__note">${esc(sp.notes)}</p></div>` : ""}
        </section>
        <section class="dpanel" aria-labelledby="d-t-modes">
          <h3 class="dpanel__title" id="d-t-modes">Modes</h3>
          ${modes.length ? `<div class="scores">${modes.map(([id, v], i) => bar(esc(modeName(id)), v, i)).join("")}</div>` : `<p class="muted">Not analyzed yet</p>`}
        </section>`;
    return pane("overview", overview) + pane("score", score) + pane("team", teamHTML) + pane("mine", C.grade.supPanelHTML(sp));
  }
  function sheetHTML(card) {
    if (isSup(card)) return supSheetHTML(card);
    const ranked = C.isRanked(card);
    const s = card.scores || {}, team = card.team || {};
    const strengths = arr(card.strengths), weaknesses = arr(card.weaknesses);
    const ab = abilities(card);
    const abHTML = ab.length ? ab.map((a) => `<div class="ability">${ab.length > 1 ? `<span class="ability__kind">${a.kind}</span>` : ""}${a.n ? `<b class="ability__name">${esc(a.n)}</b>` : ""}${a.d ? `<p class="ability__desc">${esc(a.d)}</p>` : ""}</div>`).join("") : `<p class="muted">None</p>`;
    const note = String(card.tierNote || "").trim();
    const bullets = (a, cls) => a.length ? `<ul class="pc pc--${cls}">${a.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">Not analyzed yet</p>`;
    const supports = arr(team.bestSupport).map((id) => { const f = state.support.find((x) => x.id === id); return f && f.name ? f.name : pretty(id); });
    const slot = fmtSlot(team.position);
    const resolve = (ids) => arr(ids).map((id) => byId.get(id)).filter((c) => c && c.id !== card.id);
    const beats = resolve(card.beats), loses = resolve(card.losesTo), withs = resolve(team.bestWith);
    const row = (id, a) => a.length ? `<div class="mini-row" id="${id}" data-card-list></div>` : `<p class="muted">Not analyzed yet</p>`;
    const modes = modesOf(card);
    const stat = (k, label) => `<div class="bs-stat bs-stat--${k}"><dt>${label}</dt><dd data-d="${k}" data-value="0">0</dd></div>`;
    const pane = (id, html) => `<div class="bs-pane" id="bs-pane-${id}" role="tabpanel" aria-labelledby="bs-tab-${id}" tabindex="-1" data-pane="${id}" hidden>${html}</div>`;
    const overview = `
        <section class="dpanel" aria-labelledby="d-t-stats">
          <h3 class="dpanel__title" id="d-t-stats">Stats <span class="bs-stats__lv" data-d="lv">${esc(state.rarity)}</span></h3>
          <dl class="bs-stats">
            ${stat("atk", "ATK")}${stat("hp", "HP")}
            ${EXTRA_STATS.filter(([k]) => hasBase(card, k)).map(([k, label]) => stat(k, label)).join("")}
            <div class="bs-stat bs-stat--odds"><dt>Pull odds</dt><dd data-d="odds"></dd></div>
          </dl>
        </section>
        <section class="dpanel" aria-labelledby="d-t-abilities">
          <h3 class="dpanel__title" id="d-t-abilities">Passive / Skill</h3>
          ${abHTML}
        </section>
        <section class="dpanel" aria-labelledby="d-t-pc">
          <h3 class="dpanel__title" id="d-t-pc">Strengths &amp; weaknesses</h3>
          <div class="proscons">
            <div><h4 class="pc__title pc__title--good">Strengths</h4>${bullets(strengths, "good")}</div>
            <div><h4 class="pc__title pc__title--bad">Weaknesses</h4>${bullets(weaknesses, "bad")}</div>
          </div>
        </section>
        ${card.updated ? `<p class="detail__foot">Updated ${esc(card.updated)}</p>` : ""}`;
    const score = ranked ? `
        <section class="dpanel" aria-labelledby="d-t-overall">
          <h3 class="dpanel__title" id="d-t-overall">Overall score</h3>
          <div class="overall">
            <div class="overall__score"><span class="overall__num" data-d="overall" data-value="0">0</span><span class="overall__max">/ 100</span></div>
            <div class="overall__tier"><span class="badge badge--tier">${esc(card.tier)}</span><small>Tier</small></div>
          </div>
          ${note ? `<h4 class="bs-sub">Why tier ${esc(card.tier)}</h4><p class="dpanel__note">${esc(note)}</p>` : ""}
          <h4 class="bs-sub">Score breakdown</h4>
          <p class="dpanel__sub">Weighted sum of five scores, each out of 100.</p>
          <div class="scores">${SCORE_ROWS.map(([k, label, w], i) => bar(label, scoreOf(s, k), i, `<span class="score__weight">${w}%</span>`).replace('class="score__num"', `class="score__num" data-d="s-${k}"`)).join("")}</div>
        </section>`
      : `<section class="dpanel" aria-labelledby="d-t-overall">
          <h3 class="dpanel__title" id="d-t-overall">Overall score</h3>
          <div class="unranked"><span class="badge badge--muted">Unranked</span><span>Only the top ${C.rankTop()} cards get an Overall score and a tier. Decks still count this one, from its ATK and HP.</span></div>
          ${note ? `<p class="dpanel__note">${esc(note)}</p>` : ""}
        </section>`;
    const teamHTML = `
        <section class="dpanel" aria-labelledby="d-t-match">
          <h3 class="dpanel__title" id="d-t-match">Matchups</h3>
          <div class="group"><h4 class="group__title group__title--good">Beats <span class="group__count">${beats.length || ""}</span></h4>${row("d-beats", beats)}</div>
          <div class="group"><h4 class="group__title group__title--bad">Loses to <span class="group__count">${loses.length || ""}</span></h4>${row("d-loses", loses)}</div>
        </section>
        <section class="dpanel" aria-labelledby="d-t-team">
          <h3 class="dpanel__title" id="d-t-team">Team</h3>
          <div class="group"><h4 class="group__title">Best slot</h4><div class="chips">${slot ? `<span class="badge">${esc(slot)}</span>` : `<span class="muted">Not analyzed yet</span>`}</div></div>
          <div class="group"><h4 class="group__title">Works well with</h4>${row("d-with", withs)}</div>
          <div class="group"><h4 class="group__title">Recommended support</h4>${supports.length ? `<div class="chips">${supports.map((n) => `<span class="supchip">${esc(n)}</span>`).join("")}</div>` : `<p class="muted">Not analyzed yet</p>`}</div>
          ${card.notes ? `<div class="group"><h4 class="group__title">Notes</h4><p class="dpanel__note">${esc(card.notes)}</p></div>` : ""}
        </section>
        <section class="dpanel" aria-labelledby="d-t-modes">
          <h3 class="dpanel__title" id="d-t-modes">Modes</h3>
          ${modes.length ? `<div class="scores">${modes.map(([id, v], i) => bar(esc(modeName(id)), v, i)).join("")}</div>` : `<p class="muted">Not analyzed yet</p>`}
        </section>`;
    return pane("overview", overview) + pane("score", score) + pane("team", teamHTML) +
      pane("mine", C.traits.panelHTML(card) + C.grade.panelHTML(card));
  }
  const q = (k) => el.sheetBody.querySelector(`[data-d="${k}"]`);
  const setNum = (n, v, fmt, anim) => { if (!n) return; if (anim) FX.countTo(n, v, { format: fmt }); else { n.dataset.value = v; n.textContent = fmt(v); } };
  // W6: no "Normal … × 93" / "… × rarer" lines any more · just the numbers at the chosen level
  function fillStats(card, anim) {
    const r = state.rarity;
    if (isSup(card)) {
      const dec = (v) => (x) => (x === v ? v + "%" : (String(v).includes(".") ? x.toFixed(1) : Math.round(x)) + "%");
      C.supVals(card).forEach((b, i) => { const v = C.supValAt(card, i, r); setNum(q("sv" + i), v, dec(v), anim); });
      q("odds").textContent = Number(card.odds) > 0 ? C.fmtOdds(C.oddsAt(card, r)) : "–";
      q("lv").textContent = r;
      const d = q("eff"); if (d) { const t = C.support.effect(card, r).desc; if (d.textContent !== t) { d.textContent = t; if (anim) FX.fade(d, 1, { duration: 250 }); } }
      return;
    }
    setNum(q("atk"), C.statAt(card, "atk", r), C.fmtStat, anim);
    setNum(q("hp"), C.statAt(card, "hp", r), C.fmtHp, anim);
    q("odds").textContent = C.fmtOdds(C.oddsAt(card, r));
    q("lv").textContent = r;
    EXTRA_STATS.forEach(([k]) => { if (q(k)) setNum(q(k), C.statAt(card, k, r), C.fmtStat, anim); });
  }
  function fillScores(card, anim) {
    if (!C.isRanked(card)) return;
    const s = card.scores, fmt = (n) => String(Math.round(n));
    if (isSup(card)) { setNum(q("overall"), pct(s.value), (n) => f1(n).replace(/\.0$/, ""), anim); SUP_ROWS.forEach(([k]) => setNum(q("s-" + k), pct(s[k]), fmt, anim)); return; }
    setNum(q("overall"), pct(s.overall), fmt, anim);
    SCORE_ROWS.forEach(([k]) => setNum(q("s-" + k), scoreOf(s, k), fmt, anim));
  }
  function sheetSub(card) {
    const ranked = C.isRanked(card), ob = obtainOf(card);
    return `${ranked ? `<span class="badge badge--tier">Tier ${esc(card.tier)}</span>` : `<span class="badge badge--muted">Unranked</span>`}` +
      `<span class="bs-sheet__meta">${esc(state.rarity)}${isSup(card) ? " · Support" : card.series ? " · " + esc(card.series) : ""}</span>` +
      (ob ? `<span class="bs-sheet__obtain">${esc(ob)}</span>` : "");
  }
  let sheetOpen = false, shAnims = [], SD = null, sheetKey = "", tab = "overview";
  function prefillSheet() { setTimeout(() => idle(() => { if (isOpen && !sheetOpen) fillSheet(); }), 0); }
  function fillSheet() {
    const card = cur;
    if (!card || sheetKey === card.id) return;
    sheetKey = card.id;
    el.shTitle.textContent = card.name;
    el.sheet.style.setProperty("--tc", `var(${C.TIER_COLOR[card.tier] || "--t-d"})`);   // tier badge colour (head + Score tab)
    el.shSub.innerHTML = sheetSub(card);
    el.shThumb.innerHTML = card.image ? C.artImg(card.image, true) : C.placeholderArt(card);
    if (card.image) C.bindArt(el.shThumb, card);
    el.sheetBody.innerHTML = sheetHTML(card);
    C.grade.mountSlabs(el.sheetBody);   // step 13: the graded case in the Grade panel (only when this card has grades)
    C.traits.mountPanel(el.sheetBody, card);   // Trait panel: recommended trait + the user's trait + boosted stats
    const rows = isSup(card) ? [["#d-with", card.bestWith], ["#d-avoid", card.avoidWith]] : [["#d-beats", card.beats], ["#d-loses", card.losesTo], ["#d-with", card.team && card.team.bestWith]];
    rows.forEach(([sel, ids]) => {
      const rowEl = $(sel, el.sheetBody);
      if (!rowEl) return;
      arr(ids).map((id) => byId.get(id)).filter((c) => c && c.id !== card.id)
        .forEach((c) => rowEl.appendChild(C.renderCard(c, state.rarity, { mini: true })));
    });
    fillStats(card, false); fillScores(card, false);
    setTab(tab);
    el.sheet.classList.add("is-ready-paint");
  }
  const paneOf = (name) => el.sheetBody.querySelector(`[data-pane="${name}"]`);
  // switch tab · animate = the pane fades in, its numbers count and its bars grow (§4) · to = a panel to bring into view
  function setTab(name, { animate = false, to = null } = {}) {
    if (!TABS.includes(name)) name = "overview";
    tab = name;
    el.tabs.style.setProperty("--i", TABS.indexOf(name));
    el.tabs.querySelectorAll("[role=tab]").forEach((b) => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    el.sheetBody.querySelectorAll(".bs-pane").forEach((p) => { p.hidden = p.dataset.pane !== name; });
    el.sheetBody.scrollTop = 0;
    const pane = paneOf(name);
    if (!pane) return;
    if (animate) {
      if (!rm()) { pane.classList.remove("fx-page-in"); void pane.offsetWidth; pane.classList.add("fx-page-in"); }
      paneCount(name);
    }
    if (to) {
      const t = pane.querySelector(to), sec = t && t.closest("section");
      if (sec && sec !== pane.firstElementChild) {
        const z = FX.zoom();
        el.sheetBody.scrollTop += (sec.getBoundingClientRect().top - el.sheetBody.getBoundingClientRect().top) / z - 12;
      }
      if (sec) setTimeout(() => FX.flash(sec), animate ? 120 : 340);
    }
  }
  // numbers count up from 0 · score bars grow (the shown tab only)
  function paneCount(name) {
    const pane = paneOf(name);
    if (!pane || !cur) return;
    pane.querySelectorAll("[data-d][data-value]").forEach((n) => { n.dataset.value = 0; n.textContent = "0"; });
    if (name === "overview") fillStats(cur, true);
    if (name === "score") fillScores(cur, true);
    pane.classList.remove("is-replay"); void pane.offsetWidth; pane.classList.add("is-replay");
  }
  // side panel: the scene moves left by half the panel so the card stays in view (CSS, transform only)
  function sheetSide() {
    const on = sheetOpen && side;
    el.root.classList.toggle("is-sheet", sheetOpen);
    el.root.classList.toggle("is-sheet-side", on);
    if (on) el.root.style.setProperty("--shw", Math.round(el.sheet.offsetWidth) + "px");
    el.sheet.setAttribute("aria-modal", String(!side));
    el.scrim.hidden = !sheetOpen || side;
  }
  function moveSheet(f0, f1v, dur, easing, done) {
    shAnims.forEach((a) => a.cancel());
    const o = { duration: Math.max(90, dur * Math.max(0.35, Math.abs(f1v - f0))), easing, fill: "forwards" };
    const tr = (f) => ({ transform: side ? `translateX(${f2(f * 100)}%)` : `translateY(${f2(f * 100)}%)` });
    shAnims = rm()
      ? [el.sheet.animate([{ opacity: 1 - f0 }, { opacity: 1 - f1v }], o)]
      : [el.sheet.animate([tr(f0), tr(f1v)], o)];
    if (!side) shAnims.push(el.scrim.animate([{ opacity: 1 - f0 }, { opacity: 1 - f1v }], o));
    if (done) shAnims[0].onfinish = done;
  }
  function openSheet(name, to) {
    if (!ready || !cur || wheelOn) return;
    if (sheetOpen) { setTab(name || tab, { animate: true, to }); return; }
    fillSheet(); hideHint(); stopCard(); toggleZoom(false);
    setTab(name || "overview", { to });
    el.sheet.inert = false; el.sheet.classList.add("is-open"); sheetOpen = true;
    sheetSide(); hush(true);   // W7: the scene's loops stop while the Details are open
    moveSheet(1, 0, 320, E);
    // §4: numbers count up · score bars grow · panels come up one after another
    paneCount(tab);
    FX.stagger(paneOf(tab), 50, { cls: "fx-up", max: 8, cleanup: true });
    el.sheetX.focus({ preventScroll: true });
  }
  function closeSheet(from, instant) {
    if (!sheetOpen) return;
    sheetOpen = false;
    el.root.classList.remove("is-sheet", "is-sheet-side");
    if (isOpen) hush(document.hidden);
    const done = () => { shAnims.forEach((a) => a.cancel()); shAnims = []; el.sheet.classList.remove("is-open"); el.sheet.inert = true; el.scrim.hidden = true; if (!instant && isOpen) el.dbtn.focus({ preventScroll: true }); };
    if (instant) { done(); return; }
    moveSheet(from || 0, 1, 260, "cubic-bezier(.4,0,1,1)", done);
  }
  function setupSheet() {
    el.dbtn.addEventListener("click", () => openSheet());
    el.sheetX.addEventListener("click", () => closeSheet(0));
    el.scrim.addEventListener("click", () => closeSheet(0));
    el.tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b && b.dataset.tab !== tab) setTab(b.dataset.tab, { animate: true }); });
    el.tabs.addEventListener("keydown", (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1, Home: -9, End: 9 }[e.key];
      if (!k) return;
      e.preventDefault(); e.stopPropagation();
      const i = clamp(Math.abs(k) === 9 ? (k > 0 ? 3 : 0) : TABS.indexOf(tab) + k, 0, 3);
      setTab(TABS[i], { animate: true });
      el.tabs.querySelector(`[data-tab="${TABS[i]}"]`).focus();
    });
    const head = el.sheetHead;
    head.addEventListener("pointerdown", (e) => {
      if (!sheetOpen || side || e.target.closest("button")) return;   // pull down to close: phone only
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
      SD = { id: e.pointerId, y0: e.clientY, h: el.sheet.offsetHeight * FX.zoom(), s: [[e.clientY, performance.now()]], f: 0, anim: null };
    });
    head.addEventListener("pointermove", (e) => {
      if (!SD || e.pointerId !== SD.id) return;
      const f = clamp((e.clientY - SD.y0) / SD.h, 0, 1);
      if (!SD.anim && f > 0.004) {   // the finger drives a paused animation (no style writes per frame)
        shAnims.forEach((a) => a.cancel()); shAnims = [];
        el.scrim.hidden = false;
        SD.anim = [el.sheet.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: 1000, fill: "both" }),
                   el.scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, fill: "both" })];
        SD.anim.forEach((a) => a.pause());
      }
      if (SD.anim) SD.anim.forEach((a) => { a.currentTime = f * 1000; });
      SD.f = f; const now = performance.now(); SD.s.push([e.clientY, now]); while (SD.s.length > 2 && now - SD.s[0][1] > 90) SD.s.shift();
    });
    const end = (e) => {
      if (!SD || e.pointerId !== SD.id) return;
      const d = SD; SD = null; if (!d.anim) return;
      const a = d.s[0], b = d.s[d.s.length - 1], v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]);
      d.anim.forEach((x) => x.cancel());
      if (d.f > 0.28 || v > 0.55) closeSheet(d.f);
      else moveSheet(d.f, 0, 260, E);
    };
    head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
  }

  /* ---------- first-time hint (the first 2 opens on this device) ---------- */
  let hintDone = true;
  function showHint() {
    let n = 0; try { n = Number(localStorage.getItem("cbi:bsHint")) || 0; } catch (e) {}
    if (n >= 2) return;
    try { localStorage.setItem("cbi:bsHint", String(n + 1)); } catch (e) {}
    hintDone = false; el.hint.classList.add("is-on");
    setTimeout(hideHint, 5200);
  }
  function hideHint() { if (hintDone) return; hintDone = true; el.hint.classList.remove("is-on"); }

  /* ==========================================================
     9. Level dots (the site-wide rarity): bottom bar + the Details head · a level change = a light wave (W6)
     ========================================================== */
  function buildLv(box) {
    state.meta.rarities.forEach((r, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.i = i; b.dataset.name = r.name;
      b.setAttribute("aria-label", r.name); b.setAttribute("aria-pressed", "false");
      const sw = C.RARITY_SWATCH[r.name] || "var(--r-normal)";
      b.innerHTML = `<i style="--sw:${sw};--sg:${/gradient/.test(sw) ? "rgba(255,255,255,.55)" : `color-mix(in srgb, ${sw} 60%, transparent)`}"></i>`;
      box.appendChild(b);
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.name !== state.rarity) C.cards.setRarity(b.dataset.name);
    });
  }
  const lvIndex = () => Math.max(0, state.meta.rarities.findIndex((r) => r.name === state.rarity));
  // the gold ring moves by the real button size (W9: the bottom bar's dots are bigger on a PC, the Details head keeps 40px)
  function placeInd(box, instant) {
    const ind = box.querySelector(".bs-lv__ind"), b = box.querySelector("button");
    if (instant) ind.style.transition = "none";
    ind.style.transform = `translateX(${lvIndex() * ((b && b.offsetWidth) || 40)}px)`;
    if (instant) { void ind.offsetWidth; ind.style.transition = ""; }
  }
  function paintDock(instant) {
    const i = lvIndex();
    [[el.lv, el.lvName], [el.shLv, el.shLvName]].forEach(([box, name]) => {
      box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
      placeInd(box, instant);
      name.textContent = state.rarity;
      if (!instant && !rm()) name.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: E });
    });
    [el.stage, el.fore, el.dock, el.sheet, el.wrap, el.hint].forEach((x) => { x.dataset.lvl = state.rarity; });
  }
  /* the light wave: a ring of the level's colour runs from the black sun down to the card (one-shot, transform /
     opacity only), then the card glows softly · never a white full-screen flash */
  const WAVE_HIT = 380;
  function wave() {
    if (!G || el.root.hidden) return;
    const w = el.wave, z = FX.zoom();
    const fr = el.fore.getBoundingClientRect(), sr = el.stage.getBoundingClientRect();
    // the sky starts 26px outside the stage (parallax room): the card's bottom in sky coordinates
    const cx = (fr.left - sr.left) / z + LY.L + LY.cw / 2 + 26, cy = (fr.top - sr.top) / z + LY.B + 26;
    const r = Math.round(Math.max(120, Math.hypot(cx - G.sx, cy - G.sy)));
    Object.assign(w.style, { left: G.sx + "px", top: G.sy + "px", width: 2 * r + "px", height: 2 * r + "px", margin: `${-r}px 0 0 ${-r}px` });
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ transform: "scale(.06)", opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.9, offset: 0.62 }, { transform: "scale(1)", opacity: 0 }],
      { duration: 700, easing: "cubic-bezier(.35,.55,.45,1)" });
    el.glow.getAnimations().forEach((a) => a.cancel());
    el.glow.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 0.85, transform: "scale(1.02)", offset: 0.35 }, { opacity: 0, transform: "scale(1.08)" }],
      { duration: 640, delay: WAVE_HIT - 80, easing: "ease-out" });
  }
  // the rarity changed anywhere (dots here, the Traits page, the Cards page…): update the scene
  let faceTimer = 0;
  function onRarity() {
    const hit = isOpen && ready && !rm() && !el.root.hidden;
    const apply = () => {
      for (const [id, fc] of faceCache) {
        const card = byId.get(id); if (!card) continue;
        if (fc.f.dataset.rarity !== state.rarity) C.setCardRarity(fc.f, card, state.rarity, { animate: isOpen && fc.f.isConnected });
        if (fc.b.dataset.rarity !== state.rarity) C.setCardRarity(fc.b, card, state.rarity, { animate: false });
      }
    };
    clearTimeout(faceTimer);
    if (hit) faceTimer = setTimeout(apply, WAVE_HIT); else apply();   // the card changes when the wave reaches it
    if (!isOpen) return;
    wRarity();   // W8: the wheel's cards
    paintDock(false);
    moteColors();
    showCorona(state.rarity, false);
    if (hit) wave();
    if (cur) {
      el.wrap.setAttribute("aria-label", wrapLabel(cur));
      if (isSup(cur)) { fillCallouts(cur); if (!wheelOn) { layout(); if (ready) for (const o of coEls) o.el.style.opacity = 1; } }   // its Effect line shows the new values
      if (sheetKey === cur.id) {
        el.shSub.innerHTML = sheetSub(cur);
        fillStats(cur, sheetOpen);
        el.sheetBody.querySelectorAll(".card[data-id]").forEach((c) => { const d = byId.get(c.dataset.id); if (d) C.setCardRarity(c, d, state.rarity, { animate: sheetOpen }); });
      }
    }
  }

  /* ---------- graphics quality Low / High (W6) · Low = no running light, still sparks / fog / motes, no parallax ---------- */
  const GFX_KEY = "cbi:gfx";
  function setGfx(v, save) {
    gfx = v === "low" ? "low" : "high";
    el.root.classList.toggle("is-low", gfx === "low");
    el.gfx.style.setProperty("--i", gfx === "low" ? 0 : 1);
    el.gfx.querySelectorAll("[data-gfx]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gfx === gfx)));
    if (save) { try { localStorage.setItem(GFX_KEY, gfx); } catch (e) {} }
    if (gfx === "low") resetParallax();
    if (isOpen && ready) motesPlay(true);
    // W7: Low = one still picture (cycle off) · High = the cycle again
    if (G && sceneP) sceneP.then(() => {
      if (gfx === "low") { palaceStop(); return bakeStill(); }
      if (isOpen && cycling) palaceStart();
    });
  }
  function setupGfx() {
    let v = null;
    try { v = localStorage.getItem(GFX_KEY); } catch (e) {}
    if (v !== "low" && v !== "high") v = navigator.deviceMemory && navigator.deviceMemory <= 4 ? "low" : "high";   // ≤ 4 GB RAM starts at Low
    setGfx(v, false);
    el.gfx.addEventListener("click", (e) => { const b = e.target.closest("[data-gfx]"); if (b && b.dataset.gfx !== gfx) setGfx(b.dataset.gfx, true); });
  }

  /* ==========================================================
     10. Intro: dust sweeps up and gathers into the card (rAF only during the ~2.6 s intro)
     ========================================================== */
  let introRaf = 0, introTimers = [], targetCache = null;
  function sampleTargets(card, cw, ch, want) {
    const s = 2, w = Math.ceil(cw / s), h = Math.ceil(ch / s);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.save(); ctx.scale(cw / 200 / s, ch / 280 / s);
    ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff";
    ctx.lineWidth = 9; ctx.strokeRect(4.5, 4.5, 191, 271);
    ctx.globalAlpha = 0.55; ctx.fillRect(10, 236, 180, 32);         // ATK row
    ctx.globalAlpha = 0.22; ctx.fillRect(10, 10, 180, 212);
    if (!card.image) { ctx.globalAlpha = 0.9; ctx.scale(2, 2); ctx.fill(new Path2D("M28 104V52a22 22 0 0 1 44 0v52z")); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(50, 56, 30, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    const base = ctx.getImageData(0, 0, w, h).data;
    // the real picture: brighter pixels get more dust (same-origin image, so the canvas stays readable)
    let lum = null;
    const img = el.faceF.querySelector(".gc__art img");
    if (card.image && img && img.complete && img.naturalWidth) {
      try {
        const t = document.createElement("canvas"); t.width = w; t.height = h;
        const tc = t.getContext("2d"); tc.drawImage(img, 0, 0, w, h);   // the game card's picture fills the whole card
        lum = tc.getImageData(0, 0, w, h).data;
      } catch (e) { lum = null; }
    }
    const pts = [], r = rng(77);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      let a = base[k + 3] / 255;
      if (lum) { const L = (0.3 * lum[k] + 0.59 * lum[k + 1] + 0.11 * lum[k + 2]) / 255; a = Math.max(a, Math.pow(L, 1.4) * 0.95); }
      if (a > 0 && r() < a) pts.push([(x + r()) * s, (y + r()) * s]);
    }
    for (let i = pts.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
    return pts.slice(0, want);
  }
  function stopIntro() {
    cancelAnimationFrame(introRaf); introRaf = 0; introTimers.forEach(clearTimeout); introTimers = [];
    el.dust.hidden = true; el.dust.width = el.dust.height = 1; el.dust.classList.remove("is-out");
  }
  function reveal() {
    el.wrap.classList.add("is-in"); el.fore.classList.add("is-ready"); motesPlay(true); ready = true;
    if (leaning()) { enter3D(); kick(); }   // the mouse is already off-centre
    setOverall(cur, true);
    // W6: once the dust has settled (intro end) the lines draw out and the boxes fade in, once per card
    introTimers.push(setTimeout(() => { showCallouts(); introTimers.push(setTimeout(showHint, 1100)); }, rm() ? 0 : 600));
    afterShow();
    setTimeout(prebakeCoronas, 3400);
  }
  // every open plays it (owner, 2026-10-25) · fast = swiping to the next card: the same intro at 0.75× the time
  // keep = the palace cycle goes on (swiping · W8: a card picked in the wheel, the scene stays as it is)
  function runIntro(fast, keep = fast) {
    stopIntro(); stopCard(); toggleZoom(false); closeSheet(0, true); hideCallouts();
    el.fore.classList.remove("is-ready"); el.wrap.classList.remove("is-in"); motesPlay(false); ready = false;
    if (!keep || !cycling) palaceStart();   // W7: the palace forms from dust with the card (swiping keeps its cycle going)
    if (rm()) { reveal(); return; }
    const sr = el.stage.getBoundingClientRect(), wr = el.wrap.getBoundingClientRect();
    const z = FX.zoom(), W = sr.width / z, H = sr.height / z, cw = LY.cw, ch = LY.ch, L = (wr.left - sr.left) / z, T = (wr.top - sr.top) / z;
    const ctx = sizeCanvas(el.dust, W, H, 1);   // 1× on purpose: the dust looks the same, the layer is 7× smaller
    el.dust.hidden = false; el.dust.classList.remove("is-out");
    const nT = FX.lite ? 520 : 900, nS = FX.lite ? 140 : 240;    // answer (2) of §13.1: full dust, no cut
    const key = cur.id + cw + "x" + ch + "x" + nT;
    if (!targetCache || targetCache.key !== key) targetCache = { key, pts: sampleTargets(cur, cw, ch, nT) };
    const targets = targetCache.pts;
    const r = rng((Math.random() * 1e9) | 0), SP = fast ? 0.75 : 1;
    const COLS = ["#ffffff", "#e9e6ff", "#c9c6f2", "#b7c3ff"];
    const buckets = COLS.map(() => []);
    const mk = (tx0, ty0, stray) => {
      const sx = -W * 0.35 + r() * W * 0.45, sy = H * (0.86 + r() * 0.3);
      const nxp = stray ? 0.5 : (tx0 - L) / cw, nyp = stray ? 0.5 : (ty0 - T) / ch;
      const delay = ((nxp * 0.55 + (1 - nyp) * 0.45) * 820 + r() * 260 + (stray ? r() * 500 : 0)) * SP;
      const dur = (950 + r() * 520) * SP;
      const mx = lerp(sx, tx0, 0.55) + W * (0.1 + r() * 0.35), my = lerp(sy, ty0, 0.5) + (r() - 0.3) * H * 0.18;
      return { sx, sy, mx, my, tx: tx0, ty: ty0, delay, dur, stray, size: 1.3 + r() * (stray ? 1.4 : 1.9), ph: r() * 6.28 };
    };
    targets.forEach((p) => buckets[(r() * 4) | 0].push(mk(L + p[0], T + p[1], false)));
    for (let i = 0; i < nS; i++) buckets[(r() * 4) | 0].push(mk(W * (0.7 + r() * 0.6), -H * (0.05 + r() * 0.3), true));
    const QA = [0.35, 0.68, 1], MAXN = Math.max(...buckets.map((b) => b.length));
    const PX = new Float32Array(MAXN), PY = new Float32Array(MAXN), PS = new Float32Array(MAXN), PQ = new Int8Array(MAXN);
    const t0 = performance.now(); let shown = false;
    const frame = (now) => {
      if (!isOpen) { stopIntro(); return; }
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      for (let b = 0; b < 4; b++) {
        const a0 = buckets[b];
        for (let i = 0; i < a0.length; i++) {
          const p = a0[i], k = (t - p.delay) / p.dur;
          PQ[i] = -1;
          if (k <= 0 || (k >= 1 && p.stray)) continue;
          let x, y, a;
          if (k >= 1) { x = p.tx; y = p.ty; a = 0.65 + 0.35 * Math.sin(t * 0.012 + p.ph); }
          else {
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, u = 1 - e;
            x = u * u * p.sx + 2 * u * e * p.mx + e * e * p.tx; y = u * u * p.sy + 2 * u * e * p.my + e * e * p.ty;
            a = p.stray ? Math.sin(k * Math.PI) * 0.8 : Math.min(1, k * 3);
          }
          if (a < 0.12) continue;
          PX[i] = x; PY[i] = y; PS[i] = p.size * (k < 1 ? 1.2 : 1); PQ[i] = a < 0.5 ? 0 : a < 0.84 ? 1 : 2;
        }
        ctx.fillStyle = COLS[b];
        for (let qq = 0; qq < 3; qq++) {
          ctx.globalAlpha = QA[qq]; ctx.beginPath();
          for (let i = 0; i < a0.length; i++) if (PQ[i] === qq) { const s = PS[i]; ctx.rect(PX[i] - s / 2, PY[i] - s / 2, s, s); }
          ctx.fill();
        }
      }
      if (!shown && t > 1950 * SP) {
        shown = true;
        el.mat.animate([{ opacity: 0, transform: "scale(.92)" }, { opacity: 0.9, offset: 0.25 }, { opacity: 0, transform: "scale(1.08)" }], { duration: 560, easing: "ease-out" });
        el.dust.classList.add("is-out");
        reveal();
      }
      if (t < 2650 * SP) introRaf = requestAnimationFrame(frame);
      else { introRaf = 0; ctx.clearRect(0, 0, W, H); el.dust.hidden = true; el.dust.width = el.dust.height = 1; }
    };
    introRaf = requestAnimationFrame(frame);
  }

  /* ==========================================================
     12. Card wheel (W8, from mockup/card-wheel.html): Back on the card view → every card on a cylinder over the same
         scene (it keeps playing, the palace cycle does not restart) · tap a side card = it turns to the middle · tap the
         middle one / Enter = its dust intro · Back at the wheel = the page it was opened from.
         History: #card/<id> twice — {v:"wheel"} under {v:"card"} (CBI.openCard) · no new route, no new localStorage key.
         The cylinder turns on the Y axis: the card at offset d (cards from the middle) is turned d × STEP degrees ·
         wpos = the (fractional) index of the middle card · each visible card sits in a slot whose look is ONE paused Web
         Animation over the offsets −DEND…+DEND (transform + opacity): per frame only currentTime is set · 11 slots, the
         cards that turn out are reused · rAF only while it moves (drag, fling, snap).
     ========================================================== */
  const WPOOL = 11;
  let wheelOn = false, wBusy = false, wTok = 0, WK = {};
  let wl = [], wpos = 0, wN = 0, wwrap = true, wQ = "";
  const wslots = [];                     // { el, inner, a (look), e (edge fade), idx, cardId, z, sel }
  const wcache = new Map();              // id → mini card (LRU 24)
  let wRaf = 0, wSpin = null, wDrag = null, wCenter = -1, wFiltT = 0;
  const viewOf = () => { const s = history.state; return s && (s.v === "wheel" || s.v === "card") ? s.v : null; };
  const wUrl = (id) => "#card/" + encodeURIComponent(id);
  // a #card/<id> entry without a view (direct link, typed hash, an entry from before W8) → wheel + card entries
  function wheelEntries(id) {
    const st = history.state || {}, d = st.depth || 0, cl = Array.isArray(st.cl) ? { cl: st.cl } : {};
    try {
      if (d > 0) history.replaceState({ depth: d, wd: d, v: "wheel", ...cl }, "", wUrl(id));
      else { history.replaceState(null, "", "#" + (state.page || "cards")); history.pushState({ depth: 1, wd: 1, v: "wheel" }, "", wUrl(id)); }
      const w = history.state.depth;
      history.pushState({ depth: w + 1, wd: w, v: "card", ...cl }, "", wUrl(id));
    } catch (e) {}
  }
  // Back on the card view (button / Esc): one step down to the wheel entry under this card
  function toWheel() {
    const st = history.state || {};
    if (st.v === "card" && st.wd > 0 && st.depth > st.wd) history.go(st.wd - st.depth);
    else C.closeCard();
  }
  // the whole library in the Cards page order (cards its filters hide come after)
  // a support's wheel = every support (the Support side's order) · cards never mix with supports on one wheel
  function wOrder() {
    const sup = isSup(cur), all = sup ? state.support : state.cards;
    const o = (sup ? C.support.order() : C.cards.order()).filter((id) => byId.has(id)), seen = new Set(o);
    all.forEach((c) => { if (c && c.id && !seen.has(c.id)) o.push(c.id); });
    return o;
  }
  const wMatch = (c) => { const q = wQ.trim().toLowerCase(); return !q || String(c.name || "").toLowerCase().includes(q) || String(c.series || "").toLowerCase().includes(q) || (isSup(c) && String((c.effect && c.effect.name) || "").toLowerCase().includes(q)); };

  function wheelGeom() {
    const rw = el.root.clientWidth, rh = el.root.clientHeight, z = FX.zoom();
    const [W, H] = skySize(), sun = sunOf(W, H), sunB = sun.sy + sun.R - 26;   // in .bs coordinates (the sky starts 26px out)
    const vv = window.visualViewport, kb = vv ? (vv.offsetTop + vv.height) / z : rh;   // the phone keyboard: stay above it
    const foreB = el.fore.offsetTop + el.fore.clientHeight;                              // above the bottom bar (level dots)
    // a very short screen (a phone on its side): the wheel takes the level dots' room too (they hide), so it stays under the sun
    const low = kb >= foreB - 24 && foreB - 8 - 94 - (sunB + 10) < 110;
    el.root.classList.toggle("is-wheel-low", low);
    const toolsY = (kb < foreB - 24 ? kb - 12 : low ? rh - 8 : foreB - 8) - 44, nameY = toolsY - 10 - 40;
    // owner 2026-10-26: PC 25.5 % of the height · phones 30.6 % of the width · always under the black sun
    let ch = side ? clamp(rh * 0.255, 128, 323) : clamp(rw * 0.306, 82, 162) * 1.4;
    ch = Math.round(Math.max(110, Math.min(ch, nameY - 10 - (TOP_H + 8), nameY - 10 - (sunB + 10))));
    const cw = Math.round(ch / 1.4);
    const step = rm() ? 0 : (side ? 20 : 25);            // degrees per card (reduced motion: a flat row)
    const vis = side ? (rw >= 1200 ? 3 : 2.6) : 2;       // cards each side that still show (PC 5–7 · phones 3–5)
    const gap = cw * (side ? 0.92 : 0.82);               // middle-to-next distance on screen
    const R = step ? gap / Math.sin(step * Math.PI / 180) : 0;
    return { rw, cw, ch, cx: rw / 2, cy: nameY - 10 - ch / 2, step, vis, dend: vis + 0.7, gap, R, P: Math.max(900, R * 2.4), nameY, toolsY };
  }
  // the look at each offset, sampled every 1/8 card (linear between samples)
  function wFrames() {
    const out = [], n = Math.round(WK.dend * 8);
    for (let i = 0; i <= n; i++) {
      const d = -WK.dend + (2 * WK.dend * i) / n, ad = Math.abs(d);
      // owner 2026-10-26: see-through so the scene shows · middle 75 % → 25 % at the last card that shows → gone just after it
      const op = ad <= WK.vis ? 0.75 - 0.5 * (ad / WK.vis) : Math.max(0, 0.25 * (1 - (ad - WK.vis) / (WK.dend - WK.vis)));
      const sc = 1 - 0.07 * Math.min(ad, WK.dend);
      const transform = WK.step
        ? `perspective(${WK.P}px) translateZ(${-WK.R}px) rotateY(${d * WK.step}deg) translateZ(${WK.R}px) scale(${sc})`
        : `perspective(${WK.P}px) translateZ(0px) rotateY(0deg) translateX(${d * WK.gap * 1.1}px) scale(${sc})`;
      out.push({ transform, opacity: op, offset: i / n });
    }
    return out;
  }
  function wMakeSlots() {
    wslots.forEach((s) => { s.a.cancel(); s.e.cancel(); s.el.remove(); });
    wslots.length = 0;
    const frames = wFrames();
    for (let i = 0; i < WPOOL; i++) {
      const sl = document.createElement("div"); sl.className = "bs-cwslot"; sl.hidden = true; sl.setAttribute("role", "option");
      const inner = document.createElement("div"); inner.className = "bs-cwin"; sl.appendChild(inner);
      Object.assign(sl.style, { width: WK.cw + "px", height: WK.ch + "px", left: (WK.cx - WK.cw / 2) + "px", top: "30px" });
      el.cw.appendChild(sl);
      const a = sl.animate(frames, { duration: 1000, fill: "both" }); a.pause();
      const e = inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, fill: "both" }); e.pause();
      wslots.push({ el: sl, inner, a, e, idx: -1, cardId: null, z: -1, sel: null });
    }
  }
  function layoutWheel() {
    if (!wheelOn) return;
    WK = wheelGeom();
    place(el.cw, { x: 0, y: WK.cy - WK.ch / 2 - 30, w: WK.rw, h: WK.ch + 60 });   // the touch band: the row + 30px above / below
    el.cwName.style.top = WK.nameY + "px"; el.cwTools.style.top = WK.toolsY + "px";
    el.cwEmpty.style.top = (WK.cy - 60) + "px";
    wMakeSlots();
    wDraw(true);
  }
  const wWrapD = (d) => (wwrap ? ((((d + wN / 2) % wN) + wN) % wN) - wN / 2 : d);
  const wCenterIdx = () => (wN ? ((Math.round(wpos) % wN) + wN) % wN : -1);
  const wMid = () => wslots.find((s) => s.idx >= 0 && Math.abs(wWrapD(s.idx - wpos)) < 0.5);
  // the site's game card, small picture (thumb) · no finger tilt · the wheel takes the taps (pointer-events: none in CSS)
  function wCard(id) {
    let c = wcache.get(id);
    const card = byId.get(id);
    if (c) { wcache.delete(id); wcache.set(id, c); }
    else {
      c = C.renderCard(card, state.rarity, { mini: true, tilt: false });
      c.removeAttribute("role"); c.tabIndex = -1; c.setAttribute("aria-hidden", "true");
      C.loadArt(c);
      wcache.set(id, c);
      if (wcache.size > 24) wcache.delete(wcache.keys().next().value);
    }
    if (c.dataset.rarity !== state.rarity) C.setCardRarity(c, card, state.rarity, { animate: false });
    return c;
  }
  // per frame: which cards show, which slot each one uses, and where it is on the cylinder
  function wDraw(force) {
    if (!wN || force) wslots.forEach((s) => { s.el.hidden = true; s.idx = -1; });
    if (wN) {
      const want = new Map();
      for (let i = 0; i < wN; i++) { const d = wWrapD(i - wpos); if (Math.abs(d) < WK.dend) want.set(i, d); }
      wslots.forEach((s) => { if (s.idx >= 0 && !want.has(s.idx)) { s.idx = -1; s.el.hidden = true; } });
      for (const [i, d] of want) {
        let s = wslots.find((x) => x.idx === i);
        if (!s) {
          s = wslots.find((x) => x.idx < 0); if (!s) continue;
          s.idx = i;
          const id = wl[i];
          if (s.cardId !== id || force) { s.inner.replaceChildren(wCard(id)); s.cardId = id; s.sel = null; s.el.setAttribute("aria-label", (byId.get(id) || {}).name || id); }
          s.el.hidden = false;
        }
        s.a.currentTime = clamp((d + WK.dend) / (2 * WK.dend), 0, 1) * 1000;
        // small libraries: a card that crosses the back of the wheel (wrap) fades out first
        s.e.currentTime = wwrap ? clamp((wN / 2 - Math.abs(d)) / 0.5, 0, 1) * 1000 : 1000;
        const zi = 20 - Math.round(Math.abs(d) * 2);
        if (zi !== s.z) { s.z = zi; s.el.style.zIndex = zi; }
        const sel = Math.abs(d) < 0.5;
        if (sel !== s.sel) { s.sel = sel; s.el.setAttribute("aria-selected", String(sel)); }
      }
    }
    const c = wCenterIdx();
    if (c !== wCenter) { wCenter = c; wShowName(true); }
  }
  function wShowName(animate) {
    const card = wN ? byId.get(wl[wCenterIdx()]) : null;
    const b = el.cwName.firstElementChild, sp = el.cwName.lastElementChild;
    b.textContent = card ? card.name : "";
    sp.textContent = card ? [C.isRanked(card) ? "Tier " + card.tier : "Unranked", isSup(card) ? "Support" : card.series || ""].filter(Boolean).join(" · ") : "";
    if (animate && card && !rm()) el.cwName.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 150, easing: E });
  }

  /* ---------- motion: drag, fling + snap, taps, mouse wheel, keys (rAF only while it moves) ---------- */
  function wTick(t) {
    wRaf = 0;
    if (wSpin) {
      const k = clamp((t - wSpin.t0) / wSpin.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);   // ease-out cubic: slows down onto a card
      wpos = wSpin.from + (wSpin.to - wSpin.from) * e;
      if (k >= 1) { wpos = wSpin.to; wSpin = null; wDraw(); return; }
    }
    wDraw();
    if (wSpin || wDrag) wRaf = requestAnimationFrame(wTick);
  }
  const wKick = () => { if (!wRaf) wRaf = requestAnimationFrame(wTick); };
  function wStop() { cancelAnimationFrame(wRaf); wRaf = 0; wSpin = null; wDrag = null; if (el.cw) el.cw.classList.remove("is-drag"); }
  function wSpinTo(target, dur) {
    if (!wN) return;
    if (!wwrap) target = clamp(target, 0, wN - 1);
    const dist = Math.abs(target - wpos);
    if (dist < 0.001) { wpos = target; wDraw(); return; }
    wSpin = { from: wpos, to: target, t0: performance.now(), dur: rm() ? 1 : dur || clamp(220 + dist * 90, 260, 1100) };
    wKick();
  }
  const wNorm = () => { if (wwrap && wN) { const n = Math.round(wpos / wN) * wN; wpos -= n; if (wSpin) { wSpin.from -= n; wSpin.to -= n; } } };
  // the card under the finger (cards overlap at the edges: the one nearer the middle wins, it is drawn on top)
  function wSlotAt(x, y) {
    let best = null, bd = Infinity;
    wslots.forEach((s) => {
      if (s.idx < 0) return;
      const r = s.el.getBoundingClientRect(), d = Math.abs(wWrapD(s.idx - wpos));
      if (x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 20 && d < bd) { bd = d; best = s; }
    });
    return best;
  }
  function wKey(e) {
    if (wBusy) return;
    const inField = e.target === el.cwQ;
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inField) {
      e.preventDefault();
      wSpinTo((wSpin ? wSpin.to : Math.round(wpos)) + (e.key === "ArrowRight" ? 1 : -1), 300);
    } else if (e.key === "Enter" && wN) {
      if (inField) { e.preventDefault(); el.cwQ.blur(); }                       // in the search: Enter closes the keyboard
      else if (!(e.target.closest && e.target.closest("button, a, input, select"))) { e.preventDefault(); wOpen(wCenterIdx()); }
    }
  }
  function setupWheel() {
    const cw = el.cw;
    cw.addEventListener("pointerdown", (e) => {
      if (!wheelOn || wBusy || !wN || e.button > 0) return;
      wSpin = null; wNorm();
      wDrag = { id: e.pointerId, x0: e.clientX, p0: wpos, moved: false, hist: [[e.timeStamp, e.clientX]] };
      try { cw.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cw.addEventListener("pointermove", (e) => {
      if (!wDrag || e.pointerId !== wDrag.id) return;
      const dx = (e.clientX - wDrag.x0) / FX.zoom();
      if (!wDrag.moved && Math.abs(dx) < 7) return;
      if (!wDrag.moved) { wDrag.moved = true; cw.classList.add("is-drag"); }
      let p = wDrag.p0 - dx / WK.gap;
      if (!wwrap) { const hi = wN - 1; if (p < 0) p *= 0.3; if (p > hi) p = hi + (p - hi) * 0.3; }   // rubber band at the ends
      wpos = p;
      wDrag.hist.push([e.timeStamp, e.clientX]); if (wDrag.hist.length > 6) wDrag.hist.shift();
      wKick();
    });
    const end = (e) => {
      if (!wDrag || e.pointerId !== wDrag.id) return;
      const d = wDrag; wDrag = null; cw.classList.remove("is-drag");
      if (!d.moved) {   // a tap: side card → it turns to the middle · middle card → open it
        if (e.type === "pointercancel") return;
        const hit = wSlotAt(e.clientX, e.clientY);
        if (!hit) return;
        const off = wWrapD(hit.idx - wpos);
        if (Math.abs(off) < 0.5) wOpen(hit.idx); else wSpinTo(wpos + Math.round(off), 320);
        return;
      }
      // fling: keep going with the finger's speed, slow down, stop exactly on a card
      const h = d.hist, a = h[0], b = h[h.length - 1];
      const v = b[0] - a[0] > 0 && e.timeStamp - b[0] < 90 ? -(b[1] - a[1]) / FX.zoom() / (b[0] - a[0]) / WK.gap : 0;   // cards per ms
      const target = Math.round(wpos + clamp(v * 260, -14, 14));
      wSpinTo(target, clamp(240 + Math.abs(target - wpos) * 85, 260, 1300));
    };
    cw.addEventListener("pointerup", end); cw.addEventListener("pointercancel", end);
    let acc = 0, accT = 0;
    cw.addEventListener("wheel", (e) => {
      if (!wN || wBusy) return;
      e.preventDefault();
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      clearTimeout(accT); accT = setTimeout(() => { acc = 0; }, 160);
      if (Math.abs(acc) >= 50) { const n = Math.sign(acc); acc = 0; wSpinTo((wSpin ? wSpin.to : Math.round(wpos)) + n, 300); }
    }, { passive: false });
    el.cwQ.addEventListener("input", () => { wQ = el.cwQ.value; wFilter(); });
    el.cwClear.addEventListener("click", () => { wClear(); el.cwQ.focus(); });
    el.cwClear2.addEventListener("click", () => wClear());
  }

  /* ---------- search: name / series · the cards that no longer match fade out, the wheel lines up on the first match ---------- */
  function wSetList(ids, centerId, animate) {
    wl = ids; wN = ids.length; wwrap = wN >= 3;   // ≥ 3 cards: round (each card once) · 1–2: no wrap
    const i = Math.max(0, ids.indexOf(centerId));
    el.cwEmpty.hidden = wN > 0; el.cwName.style.visibility = wN ? "" : "hidden";
    wCenter = -1;
    if (!wN) { wpos = 0; wDraw(true); wShowName(false); return; }
    if (animate && !rm()) {
      wpos = i - 0.9; wDraw(true);
      wslots.forEach((s) => { const c = s.idx >= 0 && s.inner.firstElementChild; if (c) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: E }); });
      wSpinTo(i, 380);
    } else { wpos = i; wDraw(true); }
  }
  function wFilter() {
    const ids = wOrder().filter((id) => wMatch(byId.get(id)));
    el.cwClear.hidden = !wQ;
    const keep = wN ? wl[wCenterIdx()] : null;
    const first = ids.includes(keep) && !wQ ? keep : ids[0];
    clearTimeout(wFiltT);
    if (rm() || !wN) { wSetList(ids, first, false); return; }
    const gone = wslots.filter((s) => s.idx >= 0 && !ids.includes(wl[s.idx])).map((s) => s.inner.firstElementChild).filter(Boolean);
    const outs = gone.map((c) => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards", easing: E }));
    wFiltT = setTimeout(() => { outs.forEach((a) => a.cancel()); if (wheelOn) wSetList(ids, first, true); }, outs.length ? 160 : 0);
  }
  function wClear() { wQ = ""; el.cwQ.value = ""; wFilter(); }

  /* ---------- card view ⇄ wheel ---------- */
  // card view → the wheel (Back): the card shrinks into the wheel's middle slot, the others turn in + fade in (400 ms)
  function showWheel(animate) {
    if (wheelOn || !cur) return;
    wheelOn = true;
    const mine = ++wTok, id = cur.id;
    el.wrap.getAnimations().forEach((a) => a.cancel());   // a swipe's slide-out stops here (its next card never comes)
    stopIntro(); introTimers.forEach(clearTimeout); introTimers = []; switching = false;
    stopCard(); resetLean(); closeSheet(0, true); hideHint(); hideCallouts();
    const zoomed = el.fore.classList.contains("is-zoom"); toggleZoom(false);
    ready = false; el.fore.classList.remove("is-ready"); motesPlay(false);
    el.root.classList.add("is-wheel");
    el.name.textContent = "Choose a card"; fitLine(el.name, 10.5);
    el.root.setAttribute("aria-label", "Card wheel");
    el.close.setAttribute("aria-label", "Close the card wheel");
    document.title = `Choose a card — ${baseTitle}`;
    try { history.replaceState({ ...(history.state || {}) }, "", wUrl(id)); } catch (e) {}   // the card last looked at
    el.wheel.hidden = false;
    layoutWheel();
    let ids = wOrder().filter((x) => wMatch(byId.get(x)));
    if (!ids.includes(id)) { wQ = ""; el.cwQ.value = ""; ids = wOrder(); }
    el.cwClear.hidden = !wQ;
    wSetList(ids, id, false);
    const big = el.wrap.classList.contains("is-in");
    const done = () => {
      if (mine !== wTok) return;
      wBusy = false;
      el.wrap.getAnimations().forEach((a) => a.cancel()); el.wrap.classList.remove("is-in");
      el.root.classList.add("is-wheel-in");   // the hidden big card stops drawing (an Ascended one kept its ring turning)
      wslots.forEach((s) => { s.inner.style.visibility = ""; });
      if (matchMedia("(pointer: fine)").matches) el.cw.focus({ preventScroll: true });
    };
    if (!animate || rm() || !big || zoomed) {
      el.wrap.classList.remove("is-in");
      if (animate && !rm()) el.wheel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: E });
      done(); return;
    }
    wBusy = true;
    const mid = wMid(), z = FX.zoom();
    const a = el.wrap.getBoundingClientRect(), b = mid ? mid.el.getBoundingClientRect() : a;
    const k = b.width / a.width, dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / z, dy = (b.top + b.height / 2 - (a.top + a.height / 2)) / z;
    if (mid) mid.inner.style.visibility = "hidden";
    el.wrap.animate([{ transform: "none" }, { transform: `translate(${f1(dx)}px, ${f1(dy)}px) scale(${f2(k)})` }], { duration: 400, easing: E, fill: "forwards" });
    el.wheel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: E });
    const i = wpos; wpos = i - 0.8; wDraw(); wSpinTo(i, 400);
    setTimeout(done, 400);
  }
  // the wheel → a card: the chosen card lifts in the middle, the wheel fades away, then the dust intro of that card
  function leaveWheel(id) {
    const card = byId.get(id);
    if (!wheelOn || !card) return;
    const mine = ++wTok;
    wStop(); wBusy = true; el.cwQ.blur();
    const mid = wMid(), lift = [];
    if (!rm()) {
      if (mid && mid.cardId === id) lift.push(mid.inner.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-22px) scale(1.06)", opacity: 0 }], { duration: 380, easing: E, fill: "forwards" }));
      lift.push(el.wheel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: E, fill: "forwards" }));
    }
    setTimeout(() => {
      if (mine !== wTok) return;
      lift.forEach((a) => a.cancel());
      wBusy = false;
      if (viewOf() === "wheel") return;   // Back again while it lifted: stay on the wheel
      wheelOn = false; wStop();
      el.wheel.hidden = true; el.root.classList.remove("is-wheel", "is-wheel-low", "is-wheel-in");
      el.close.setAttribute("aria-label", "Back to the card wheel");
      list = listFromHistory(id); idx = Math.max(0, list.indexOf(id));
      el.root.classList.toggle("is-single", list.length < 2);
      show(card); resetLean();
      el.close.focus({ preventScroll: true });
      runIntro(false, true);   // the same intro as an open · the scene and its palace cycle go on
    }, rm() ? 0 : 240);
  }
  // tap the middle card / Enter: the wheel entry now names that card, its card entry goes on top
  function wOpen(i) {
    if (wBusy || i < 0 || !wN) return;
    const id = wl[i], st = history.state || {}, d = st.depth || 0;
    const cl = Array.isArray(st.cl) && st.cl.includes(id) ? { cl: st.cl } : {};
    try {
      history.replaceState({ ...st, v: "wheel" }, "", wUrl(id));
      history.pushState({ depth: d + 1, wd: d, v: "card", ...cl }, "", wUrl(id));
    } catch (e) {}
    leaveWheel(id);
  }
  // the level changed while the wheel shows: its cards follow (flash + numbers count on the ones in view)
  function wRarity() {
    for (const [id, c] of wcache) { const card = byId.get(id); if (card && c.dataset.rarity !== state.rarity) C.setCardRarity(c, card, state.rarity, { animate: wheelOn && c.isConnected && !rm() }); }
  }
  function wReset() {
    wStop(); wTok++; wheelOn = false; wBusy = false; clearTimeout(wFiltT);
    if (!el.wheel) return;
    el.wheel.getAnimations().forEach((a) => a.cancel());
    el.wheel.hidden = true; el.root.classList.remove("is-wheel", "is-wheel-low", "is-wheel-in");
    el.close.setAttribute("aria-label", "Back to the card wheel");
    wQ = ""; el.cwQ.value = ""; el.cwClear.hidden = true;
    wslots.forEach((s) => { s.a.cancel(); s.e.cancel(); s.el.remove(); }); wslots.length = 0;
    wcache.clear(); wl = []; wN = 0; wCenter = -1;
  }

  /* ==========================================================
     11. Open / close (shared element from / back to the tile it was opened from)
     ========================================================== */
  const LIST_SCOPE = "[data-card-list], #card-grid, #tier-list, #tm-rows, #tm-sh-rows, #tm-pool, .dk-row, .deck, .mini-row";
  const cardSel = (id) => `.card[data-id="${CSS.escape(id)}"], [data-open-card="${CSS.escape(id)}"]`;
  // the cards around the tapped one, in screen order (only ones that are actually shown)
  function listFor(origin, id) {
    pendingScope = null;
    if (!origin || !origin.isConnected) return null;
    let scope = origin.closest(LIST_SCOPE);
    if (!scope && origin.matches("[data-open-card]")) scope = origin.parentElement;
    if (!scope) return null;
    pendingScope = scope;
    // a paged grid (Cards / Support, 30 a page): swipe the whole filtered list, not only this page
    const whole = scope.dataset.cardList === "cards" ? C.cards.order() : scope.dataset.cardList === "support" ? C.support.order() : null;
    if (whole && whole.length) return whole.includes(id) ? whole : [id, ...whole];
    const ids = [], seen = new Set();
    scope.querySelectorAll(".card[data-id], [data-open-card]").forEach((n) => {
      const cid = n.dataset.openCard || n.dataset.id;
      if (!cid || seen.has(cid) || !byId.has(cid) || !n.getClientRects().length) return;
      seen.add(cid); ids.push(cid);
    });
    if (!ids.includes(id)) ids.unshift(id);
    return ids;
  }
  function listFromHistory(id) {
    const st = history.state;
    let l = st && Array.isArray(st.cl) ? st.cl.filter((x) => typeof x === "string" && byId.has(x)) : null;
    if (!l || !l.length) l = isSup(byId.get(id)) ? C.support.order() : C.cards.order();
    if (!l.includes(id)) l = [id, ...l];
    return l;
  }
  function returnTarget(id) {
    if (scopeEl && scopeEl.isConnected) { const t = scopeEl.querySelector(cardSel(id)); if (t && t.getClientRects().length) return t; }
    if (originEl && originEl.isConnected && (originEl.dataset.id === id || originEl.dataset.openCard === id || originEl.dataset.sid === id)) return originEl;
    const page = $("#page-" + (state.page || "cards"));
    const t = page ? page.querySelector(`.card[data-id="${CSS.escape(id)}"]`) : null;
    return t && t.getClientRects().length ? t : null;
  }
  // the page underneath can't be reached while the scene is up · ≥ 1100px the left menu stays usable (W6: a tab closes the card)
  const wideNav = () => matchMedia("(min-width: 1100px)").matches;
  function setBackground(on) {
    document.documentElement.classList.toggle("is-detail", on);
    [".topbar", ".nav", ".main"].forEach((sel) => {
      const n = $(sel); if (!n) return;
      if (on && !(sel === ".nav" && wideNav())) n.setAttribute("inert", ""); else n.removeAttribute("inert");
    });
  }
  // fade with the scene (the labels, ring and Details button follow .is-ready on the foreground through CSS)
  const chrome = () => [el.stage, el.top, el.dock, el.wheel];
  let settleTimer = 0, fades = [], pagerTimer = 0;
  function open(id) {
    const card = byId.get(id);
    if (!card) { C.closeCard(); return; }        // unknown id in the link -> back to the page
    if (isOpen) {
      // W8: the same #card/<id> holds two views (popstate and hashchange can both land here: each step is idempotent)
      const v = viewOf();
      if (v === "wheel") { if (!wheelOn) showWheel(true); return; }   // Back on the card view
      if (wheelOn) { leaveWheel(id); return; }                         // Forward from the wheel to its card
      if (cur && cur.id === id) return;
      // another card while open (a card in the sheet, or the phone's Back to the previous card)
      const prevId = cur && cur.id;
      if (pendingScope) { scopeEl = pendingScope; pendingScope = null; }
      list = listFromHistory(id);
      const a = list.indexOf(prevId), b = list.indexOf(id);
      closeSheet(0, true);
      switchTo(id, a >= 0 && b < a ? -1 : 1);
      return;
    }
    // W8: a direct #card/<id> link (or an old entry) gets its wheel entry: Back → the wheel → Back → the page
    if (!viewOf()) wheelEntries(id);
    wReset();
    token++;
    const mine = token;
    isOpen = true; ready = false;
    baseTitle = document.title.replace(/^.* — (?=Card Battle Infinity)/, "") || "Card Battle Infinity";
    scopeEl = pendingScope; pendingScope = null;
    originEl = state.origin && state.origin.isConnected ? state.origin : null; state.origin = null;
    list = listFromHistory(id); idx = Math.max(0, list.indexOf(id));
    el.root.classList.toggle("is-single", list.length < 2);
    prevFocus = document.activeElement;

    el.root.hidden = false;
    setBackground(true);
    fades.forEach((a) => a.cancel()); fades = [];
    ensureScene();
    paintDock(true);
    if (coronaFront && G) showCorona(state.rarity, true);
    show(card);
    idx = Math.max(0, list.indexOf(id));
    layout();
    resetLean();
    el.close.focus({ preventScroll: true });

    // every open = the scene fades in and the dust gathers into the card (owner, 2026-10-25 · was: fly from the tile)
    // wait for the painting at most 1.2 s (a lite phone paints on its first open; the stand-in sky shows meanwhile)
    fades = chrome().map((n) => FX.fade(n, 1, { duration: 300 }));
    hideCallouts(); el.fore.classList.remove("is-ready"); el.wrap.classList.remove("is-in");
    // W8: an open straight into the wheel (Forward from the page, a reload on the wheel) shows the wheel right away
    if (viewOf() === "wheel") { palaceStart(); showWheel(false); }
    else Promise.race([sceneP || Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(() => { if (mine === token && isOpen && !wheelOn) runIntro(); });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (mine === token && isOpen) settled(true); }, 520);
    // W6 fix: the size can still change right after opening (phone browser bar, fonts) → measure again
    requestAnimationFrame(() => requestAnimationFrame(relayoutIfResized));
    setTimeout(relayoutIfResized, 600);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (mine === token && isOpen) layout(); });
    // "1 / 4 · swipe" shows only on this device's very first card (then fades away for good)
    let seen = 2; try { seen = Number(localStorage.getItem("cbi:bsHint")) || 0; } catch (e) {}
    clearTimeout(pagerTimer);
    el.pager.classList.toggle("is-on", seen === 0 && list.length > 1);
    if (seen === 0) pagerTimer = setTimeout(() => el.pager.classList.remove("is-on"), 6500);
  }

  // the scene fully covers the page: stop drawing / checking what is underneath (it comes back before the card flies home)
  function settled(on) {
    if (window.__bsNoOpt) on = false;   // test switch for before/after measurements
    document.documentElement.classList.toggle("is-detail-settled", on);
    C.livePause(on);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; ready = false;
    const id = cur && cur.id, inWheel = wheelOn;
    const mine = ++token;
    wStop(); wTok++;
    clearTimeout(settleTimer);
    settled(false);
    stopIntro(); stopCard(); closeSheet(0, true); toggleZoom(false); hideHint();
    palaceStop(); cycling = false;
    el.fore.classList.remove("is-ready");
    cancelAnimationFrame(ovrRaf); resetParallax(); resetLean();
    coAnims.forEach((a) => a.cancel()); coAnims = [];
    const target = id ? returnTarget(id) : null;
    let toRect = null;
    if (target) { const r = target.getBoundingClientRect(); if (rectVisible(r)) toRect = r; }   // off screen: no scrolling, the page stays exactly as it was
    fades.forEach((a) => a.cancel());
    fades = chrome().map((n) => FX.fade(n, 0, { duration: 250 }));
    const flight = toRect && el.wrap.classList.contains("is-in") ? FX.flip(el.wrap, toRect, { reverse: true, duration: 320 }) : null;
    if (target && flight) { target.style.visibility = "hidden"; hiddenEl = target; }
    const runs = fades.concat(flight || FX.fade(el.wrap, 0, { duration: 200 }));
    // W8: Back at the wheel = the page it was opened from · the tile of the card last looked at lights up again
    if (inWheel && toRect && !rm()) target.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 400, delay: 150, easing: E });
    Promise.all(runs.map(settle)).then(() => { if (mine === token) finish(target); });
  }
  function finish(target) {
    fades.forEach((a) => a.cancel()); fades = [];
    el.wrap.getAnimations().forEach((a) => a.cancel());
    el.wrap.style.transformOrigin = "";
    el.root.hidden = true;
    el.wrap.classList.remove("is-in"); el.fore.classList.remove("is-ready");
    hushed = false; el.root.classList.remove("is-hush");
    hideCallouts(); motesPlay(false);
    setBackground(false);
    document.title = baseTitle;
    if (hiddenEl) { hiddenEl.style.visibility = ""; hiddenEl = null; }
    const f = (target && target.isConnected && target) || prevFocus;
    if (f && f.focus) f.focus({ preventScroll: true });
    prevFocus = null; originEl = null; scopeEl = null; cur = null;
    faceCache.clear(); el.faceF.textContent = ""; el.faceB.textContent = "";
    el.sheetBody.textContent = ""; sheetKey = "";
    wReset();
  }

  /* ---------- tapping any card on the site opens this ---------- */
  function activate(n) {
    // [data-no-detail]: places that use cards for something else (Grade picker + grader hero, Tier Maker, deck editor)
    if (n.closest(".bs-wrap, [data-no-detail]") || !n.closest(".main, #detail")) return;
    if (isOpen && cur && cur.id === n.dataset.id) return;
    C.openCard(n.dataset.id, n);
  }

  /* ---------- init ---------- */
  function init() {
    state.cards.forEach((c) => byId.set(c.id, c));
    (Array.isArray(state.support) ? state.support : []).forEach((x) => { if (x && x.id && !byId.has(x.id)) byId.set(x.id, x); });   // support cards open here too
    const g = (id) => document.getElementById(id);
    Object.assign(el, {
      root: g("detail"), stage: g("bs-stage"), sky: g("bs-sky"), bg: g("bs-bg"), pulse: g("bs-pulse"), sparks: g("bs-sparks"), fog: g("bs-fog"), dust: g("bs-dust"),
      skyX: g("bs-skyX"), skyY: g("bs-skyY"), sparkX: g("bs-sparkX"), sparkY: g("bs-sparkY"), fogX: g("bs-fogX"), foreX: g("bs-foreX"), foreY: g("bs-foreY"),
      top: $("#detail .bs-top"), close: g("detail-close"), name: g("bs-name"), pager: g("bs-pager"),
      fore: g("bs-fore"), callouts: g("bs-callouts"), wrap: g("bs-wrap"), zoom: g("bs-zoom"), swirl: g("bs-swirl"), mat: g("bs-mat"),
      tiltEl: g("bs-tiltEl"), rotor: g("bs-rotor"), faceF: g("bs-faceF"), faceB: g("bs-faceB"),
      ovr: g("bs-ovr"), ovrArc: g("bs-ovrArc"), ovrNum: g("bs-ovrNum"), ovrLbl: g("bs-ovrLbl"), dbtn: g("bs-details"),
      hint: g("bs-hint"), dock: g("bs-dock"), dockL: g("bs-dockL"), dockR: g("bs-dockR"), lv: g("bs-lv"), lvName: g("bs-lvName"),
      prev: g("bs-prev"), next: g("bs-next"), gfx: g("bs-gfx"), tint: g("bs-tint"), wave: g("bs-wave"), glow: g("bs-glow"),
      wheel: g("bs-wheel"), cw: g("bs-cw"), cwName: g("bs-cwName"), cwTools: g("bs-cwTools"), cwQ: g("bs-cwQ"), cwClear: g("bs-cwClear"), cwEmpty: g("bs-cwEmpty"), cwClear2: g("bs-cwClear2"),
      palace: g("bs-palace"), palaceImg: g("bs-palaceImg"), pdust: [g("bs-pdust0"), g("bs-pdust1")], gold: g("bs-gold"), city: g("bs-city"), still: g("bs-still"), fall: g("bs-fall"),
      scrim: g("bs-scrim"), sheet: g("bs-sheet"), sheetHead: g("bs-sheetHead"), shThumb: g("bs-shThumb"), shTitle: g("bs-shTitle"), shSub: g("bs-shSub"), sheetX: g("bs-sheetX"), sheetBody: g("bs-sheetBody"),
      shLv: g("bs-shLv"), shLvName: g("bs-shLvName"), tabs: g("bs-tabs"),
    });
    coronaFront = g("bs-coronaA"); coronaBack = g("bs-coronaB");

    // any card on the site opens the detail (moved here from js/cards.js)
    document.addEventListener("click", (e) => { const n = e.target.closest(".card[data-id]"); if (n) activate(n); });
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".card[role=button]")) { e.preventDefault(); activate(e.target); return; }
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        // W8: card view → the wheel · the wheel → the page (a search with text is cleared first)
        if (wheelOn) { if (document.activeElement === el.cwQ && el.cwQ.value) wClear(); else if (!wBusy) C.closeCard(); }
        else if (sheetOpen) closeSheet(0); else if (el.fore.classList.contains("is-zoom")) toggleZoom(false); else toWheel();
      } else if (wheelOn) wKey(e);
      else if (!sheetOpen && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !(e.target.closest && e.target.closest("input, select, textarea"))) {
        e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1);
      }
    });
    el.close.addEventListener("click", () => { if (wheelOn) { if (!wBusy) C.closeCard(); } else toWheel(); });
    // W8: card ⇄ wheel share one URL (#card/<id>): history steps between them fire popstate only, no hashchange
    addEventListener("popstate", () => { const m = location.hash.match(/^#\/?card\/([^/?#]+)/); if (isOpen && m) open(decodeURIComponent(m[1])); });
    document.addEventListener("cbi:rarity", onRarity);
    document.addEventListener("visibilitychange", () => { if (isOpen) hush(document.hidden || sheetOpen); });   // W7: tab hidden = loops stop
    if (!byId.size) return;

    buildLv(el.lv); buildLv(el.shLv); buildCallouts();
    setupCard(); setupSwipe(); setupSheet(); setupParallax(); setupGfx(); setupWheel();
    let rt = 0, rt2 = 0;
    // phone browser bars show / hide without always firing window resize: watch the visual viewport too
    if (window.visualViewport) visualViewport.addEventListener("resize", () => { clearTimeout(rt2); rt2 = setTimeout(relayoutIfResized, 200); });
    // W8: the phone keyboard (search) only shrinks the visual viewport: the wheel and its search move above it
    let rt3 = 0;
    if (window.visualViewport) visualViewport.addEventListener("resize", () => { if (!wheelOn) return; clearTimeout(rt3); rt3 = setTimeout(() => { if (wheelOn) layoutWheel(); }, 60); });
    addEventListener("orientationchange", () => setTimeout(relayoutIfResized, 350));
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!isOpen) return;
        clearTimeout(rt2);
        setBackground(true);   // the left menu: usable ≥ 1100px only
        layout();
        if (Math.abs(LY.cw - motesCW) > 2) { buildMotes(); targetCache = null; }
        if (stale()) buildScene();
      }, 160);
    });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { if (isOpen) layout(); });
  }

  C.detail = { init, open, close, prewarm, listFor };
})();

