/* ==========================================================
   Card Battle Infinity — card detail: the "Black Sun" scene (step 12)
   Built from mockup/black-sun-intro.html (v2, §13.1) and fed with the real data/cards.json.
   · Opens over any page (#card/<id>), Back = the same page in the same state (nothing underneath changes)
   · Painting: drawn ONCE per screen width (canvas → <img>), level ring drawn once per level, moved only by
     paused Web Animations (finger / mouse). The sun's running light, sparks and fog are CSS (GPU).
   · Card: tap = one 360° turn (900 ms, owner's exception to the 400 ms rule) · drag = turn (angle limited, never
     edge-on) · flick = spins and slows down · double tap = zoom · leans toward the mouse on a PC (phone tilt moves
     nothing: removed 2026-10-25). Flat 2D when it is straight,
     real 3D (thickness, two faces) only while it moves or leans. The holo sheen always shows (static at rest).
   · Labels: Tier (+ tierNote) / Passive / Skill / Strongest / Weakness · always visible, the dot on the card follows
     the card as it turns (paused Web Animations) · phone = above / below the card, tap = full text ·
     ≥ 768px = left / right of the card with the full text
   · Swipe left / right (outside the card), ‹ › or the arrow keys = the next card of the list it was opened from
     (that list rides in history.state.cl, see CBI.openCard). The next and previous cards are built ahead.
   · Details = a sheet with every panel the old detail page had (stats, Overall, Grade, abilities, matchups, team)
   · Intro (dust gathering into the card) plays every time a card opens · a little faster when swiping to the next.
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
  let LY = { L: 0, T: 0, cw: 0, ch: 0, fw: 0, fh: 0 };

  /* ==========================================================
     1. The painting (from the mockup; drawn once per width)
     ========================================================== */
  let G = null, sceneP = null, sceneW = 0;
  function sideW() { return innerWidth >= 1100 ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--side-w")) || 252) : 0; }
  // the sky is 26px bigger than the scene on every side (parallax room)
  function skySize() {
    if (!el.root.hidden && el.sky.clientWidth) return [el.sky.clientWidth, el.sky.clientHeight];
    return [innerWidth - sideW() + 52, innerHeight + 52];
  }
  function sunOf(W, H) {
    const portrait = H >= W;
    const sy = portrait ? clamp(H * 0.108, 84, 150) : clamp(H * 0.135, 84, 170);
    const R = clamp(Math.min(W, H * 0.55) * (portrait ? 0.118 : 0.15), 34, 84);
    return { sy, R, portrait };
  }
  function geometry(W, H) {
    const { sy, R, portrait } = sunOf(W, H), sx = W / 2, lite = FX.lite;
    const r = rng(20261024);
    const wings = [], roots = [], trunk = [];
    const nW = lite ? 340 : 560, reach = Math.max(W * 0.62, R * 5.2);
    for (let i = 0; i < nW; i++) {
      const sd = i % 2 ? 1 : -1;
      const d0 = -0.5 + Math.pow(r(), 0.8) * 1.85;
      const a0 = sd > 0 ? -d0 : Math.PI + d0;
      const rad = R * (0.92 + Math.pow(r(), 2) * 0.7);
      const px = sx + Math.cos(a0) * rad, py = sy + Math.sin(a0) * rad;
      const len = (0.3 + Math.pow(r(), 0.7) * 0.8) * reach * (1 - Math.max(0, d0 - 0.6) * 0.45);
      const d1 = d0 * (0.55 + r() * 0.25) + (r() - 0.5) * 0.15;
      let ang = sd > 0 ? -d1 : Math.PI + d1;
      const curl = (0.4 + r() * 1.1) * (portrait ? 0.0085 : 0.0055) * sd;
      const wav = (r() - 0.5) * 0.05;
      const pts = [[px, py]]; let x = px, y = py; const steps = Math.max(10, len / 9 | 0);
      for (let s = 0; s < steps; s++) {
        ang += curl * (s / steps) * 10 + wav * Math.sin(s * 0.5) + (r() - 0.5) * 0.06;
        x += Math.cos(ang) * len / steps; y += Math.sin(ang) * len / steps; pts.push([x, y]);
      }
      wings.push({ pts, w: 0.35 + Math.pow(r(), 1.5) * 2.4, a: 0.18 + r() * 0.55, c: r(), d0 });
    }
    const branch = (x, y, ang, len, w, depth) => {
      const pts = [[x, y]]; const steps = Math.max(6, len / 9 | 0);
      for (let s = 0; s < steps; s++) {
        ang += (r() - 0.5) * 0.28 + (Math.PI / 2 - ang) * 0.012;
        x += Math.cos(ang) * len / steps; y += Math.sin(ang) * len / steps; pts.push([x, y]);
        if (depth > 0 && s > 2 && r() < 0.085) branch(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.6), len * (0.35 + r() * 0.3), w * 0.62, depth - 1);
      }
      roots.push({ pts, w, a: 0.25 + r() * 0.5, c: r() });
    };
    const nR = lite ? 10 : 15;
    for (let i = 0; i < nR; i++) {
      const a = Math.PI * (0.08 + 0.84 * (i + r() * 0.6) / nR);
      const out = (a - Math.PI / 2) * 1.5;
      branch(sx + Math.cos(a) * R, sy + Math.sin(a) * R, a + out * 0.35, (0.35 + r() * 0.45) * H * 0.75, 1.1 + r() * 1.6, lite ? 2 : 3);
    }
    const nT = lite ? 30 : 46, tyEnd = H * (0.5 + r() * 0.04);
    for (let i = 0; i < nT; i++) {
      const a = Math.PI * (0.32 + 0.36 * r());
      const x0 = sx + Math.cos(a) * R * 0.95, y0 = sy + Math.sin(a) * R * 0.95;
      const x1 = sx + (r() - 0.5) * R * 0.6, y1 = tyEnd + (r() - 0.5) * H * 0.12;
      const pts = []; for (let s = 0; s <= 14; s++) { const t = s / 14; const pinch = Math.sin(t * Math.PI) * 0.75; pts.push([lerp(x0, x1, t) + (sx - lerp(x0, x1, t)) * pinch * 0.6 + (r() - 0.5) * 1.5, lerp(y0, y1, t)]); }
      trunk.push({ pts, w: 0.4 + r() * 1.8, a: 0.3 + r() * 0.6, c: r() });
    }
    return { W, H, sx, sy, R, CH: Math.ceil(sy + R * 1.9), wings, roots, trunk };
  }
  function strokePoly(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); ctx.stroke();
  }
  function taper(ctx, line, color, scale) {
    const n = line.pts.length;
    ctx.strokeStyle = color;
    ctx.globalAlpha = line.a * 0.55; ctx.lineWidth = line.w * scale; strokePoly(ctx, line.pts);
    ctx.globalAlpha = line.a * 0.8; ctx.lineWidth = line.w * scale * 1.5; strokePoly(ctx, line.pts.slice(0, Math.max(2, n * 0.55 | 0)));
    ctx.globalAlpha = line.a; ctx.lineWidth = line.w * scale * 2.1; strokePoly(ctx, line.pts.slice(0, Math.max(2, n * 0.22 | 0)));
  }
  const SILVER = ["#ffffff", "#e8ecff", "#cdd6ff", "#b7c6ff", "#9fb4ff"];
  const pick = (a, t) => a[Math.min(a.length - 1, (t * a.length) | 0)];
  // a static <img> costs nothing per frame; a big <canvas> layer is re-sent every frame something moves (mockup: drag 32 → 60 fps)
  function bake(cv, type, q) { return new Promise((res) => cv.toBlob((b) => { cv.width = cv.height = 1; res(b ? URL.createObjectURL(b) : ""); }, type, q)); }
  function setImg(img, url) { img.src = url; return img.decode ? img.decode().catch(() => {}) : Promise.resolve(); }
  function sizeCanvas(cv, w, h, dpr) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); return c; }
  // big screens: cap the pixel count (a 1920px PC at DPR 2 would be 9 MP)
  const dprFor = (W, H) => Math.max(0.75, Math.min(devicePixelRatio || 1, FX.lite ? 1.25 : 2, Math.sqrt(4.2e6 / (W * H))));

  /* The painting is drawn in small slices (a generator that yields) run in idle gaps, so it never blocks a tap:
     measured as one 1.5 s task on a 6× slowed phone before slicing. */
  function sliced(gen) {
    return new Promise((res) => {
      const next = (f) => (el.root.hidden && window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 0));
      const step = (dl) => {
        const t0 = performance.now(), open = !el.root.hidden;
        const more = () => (dl && dl.timeRemaining && !open ? dl.timeRemaining() > 3 : performance.now() - t0 < (open ? 24 : 10));
        let r;
        do { r = gen.next(); } while (!r.done && more());
        if (r.done) res(r.value); else next(step);
      };
      next(step);
    });
  }
  function paint() {
    return sliced(paintGen()).then((cv) => {
      const img = el.bg, old = img.src;
      return bake(cv, "image/jpeg", 0.92).then((url) => setImg(img, url)).then(() => { if (old.startsWith("blob:")) URL.revokeObjectURL(old); img.classList.add("is-on"); });
    });
  }
  function* paintGen() {
    const { W, H, sx, sy, R } = G;
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, W, H, dprFor(W, H));
    const r = rng(7), lite = FX.lite;
    let g = ctx.createRadialGradient(sx, sy + H * 0.18, 10, sx, sy + H * 0.2, Math.max(W, H) * 0.85);
    g.addColorStop(0, "#2449d6"); g.addColorStop(0.35, "#1533a8"); g.addColorStop(0.7, "#0b1f78"); g.addColorStop(1, "#060f45");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const daub = ["#2d5cf0", "#1a3cc0", "#0f2a96", "#4a72ff", "#0a1d74", "#6a8cff", "#1c2a8a", "#3a2f9e"];
    const nD = Math.round((lite ? 420 : 760) * Math.max(1, (W * H) / (442 * 948) * 0.6));
    for (let i = 0; i < nD; i++) {
      ctx.globalAlpha = 0.035 + r() * 0.09; ctx.fillStyle = pick(daub, r());
      ctx.beginPath(); ctx.ellipse(r() * W, r() * H, 14 + r() * 70, 3 + r() * 12, (r() - 0.5) * 1.2, 0, Math.PI * 2); ctx.fill();
      if (i % 120 === 119) yield;
    }
    yield;
    ctx.lineWidth = 1.4; ctx.strokeStyle = "#7d9bff";
    for (let i = 0; i < 9; i++) {
      const cx = r() * W, cy = H * (0.2 + r() * 0.55), rr = 10 + r() * 22; ctx.globalAlpha = 0.07 + r() * 0.08;
      ctx.beginPath(); for (let t = 0; t < 14; t += 0.2) { const rad = rr * t / 14; ctx.lineTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad); } ctx.stroke();
    }
    for (let i = 0; i < (lite ? 40 : 70); i++) {
      const s0 = r() < 0.5 ? r() * W * 0.32 : W - r() * W * 0.32, y = H * (0.18 + r() * 0.6), s = 5 + r() * 18;
      ctx.globalAlpha = 0.06 + r() * 0.14;
      if (r() < 0.5) { ctx.fillStyle = r() < 0.5 ? "#5f86ff" : "#2a4bd0"; ctx.fillRect(s0, y, s, s); }
      else { ctx.strokeStyle = "#8fb0ff"; ctx.lineWidth = 1.2; ctx.strokeRect(s0, y, s, s); }
    }
    g = ctx.createLinearGradient(0, H * 0.6, 0, H); g.addColorStop(0, "rgba(20,24,90,0)"); g.addColorStop(0.55, "rgba(14,16,60,.55)"); g.addColorStop(1, "rgba(8,10,40,.85)");
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const l of G.roots) { const c = pick(["#6f8cff", "#86a2ff", "#a9bcff", "#5ea8ff"], l.c); ctx.globalAlpha = l.a * 0.22; ctx.strokeStyle = c; ctx.lineWidth = l.w * 3.2; strokePoly(ctx, l.pts); }
    yield;
    let k = 0;
    for (const l of G.roots) { taper(ctx, l, pick(["#9fb4ff", "#c4d0ff", "#e3e8ff", "#8fd0ff"], l.c), 0.7); if (++k % 40 === 0) yield; }
    yield;
    for (const l of G.trunk) taper(ctx, l, pick(SILVER, l.c * 0.6), 0.9);
    yield;
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.translate(sx + sd * R * 1.9, sy - R * 0.25); ctx.rotate(sd * -0.22); ctx.scale(1, 0.42);
      const gm = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.4); gm.addColorStop(0, "rgba(240,240,255,.42)"); gm.addColorStop(0.55, "rgba(225,222,255,.18)"); gm.addColorStop(1, "rgba(220,220,255,0)");
      ctx.globalAlpha = 1; ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(0, 0, R * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (let i = 0; i < (lite ? 50 : 90); i++) {
      const l = G.wings[(r() * G.wings.length) | 0], k = (Math.pow(r(), 1.5) * l.pts.length * 0.7) | 0, p = l.pts[k], q = l.pts[Math.min(l.pts.length - 1, k + 3)];
      const rx = R * (0.6 + r() * 1.5), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang); ctx.scale(1, 0.26 + r() * 0.2);
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); gg.addColorStop(0, r() < 0.5 ? "rgba(238,238,255,.3)" : "rgba(212,202,255,.26)"); gg.addColorStop(1, "rgba(220,220,255,0)");
      ctx.globalAlpha = 1; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (i % 30 === 29) yield;
    }
    yield;
    const WING = ["#ffffff", "#f1f2ff", "#e2e3ff", "#d6d0ff", "#c4cdff", "#b9b0f0", "#a9bdff"];
    for (const l of G.wings) {
      const col = pick(WING, l.c);
      taper(ctx, l, col, 1);
      if (l.c < 0.4) for (const o of [-1.8, 1.8]) { ctx.save(); ctx.translate(0, o); const a = l.a; l.a = a * 0.45; taper(ctx, l, col, 0.8); l.a = a; ctx.restore(); }
      if (++k % 40 === 0) yield;
    }
    yield;
    ctx.globalAlpha = 0.5; g = ctx.createRadialGradient(sx, sy, R * 0.9, sx, sy, R * 3.2); g.addColorStop(0, "rgba(235,240,255,.55)"); g.addColorStop(1, "rgba(235,240,255,0)");
    ctx.fillStyle = g; ctx.fillRect(sx - R * 3.4, sy - R * 3.4, R * 6.8, R * 6.8);
    ctx.globalAlpha = 1; g = ctx.createRadialGradient(sx - R * 0.2, sy - R * 0.25, R * 0.1, sx, sy, R);
    g.addColorStop(0, "#191a24"); g.addColorStop(0.7, "#07070d"); g.addColorStop(1, "#020205");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, R * 0.98, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 46; i++) {
      const rad = R * (0.15 + r() * 0.8), a0 = r() * Math.PI * 2;
      ctx.globalAlpha = 0.18 + r() * 0.3; ctx.strokeStyle = r() < 0.5 ? "#2c2d3c" : "#3a3b4e"; ctx.lineWidth = 0.6 + r() * 1.6;
      ctx.beginPath(); ctx.arc(sx + (r() - 0.5) * R * 0.2, sy + (r() - 0.5) * R * 0.2, rad, a0, a0 + 0.6 + r() * 1.6); ctx.stroke();
    }
    ctx.restore();
    g = ctx.createLinearGradient(0, H * 0.72, 0, H); g.addColorStop(0, "rgba(150,145,215,0)"); g.addColorStop(1, "rgba(170,165,225,.42)");
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.8);
    g.addColorStop(0, "rgba(0,0,20,0)"); g.addColorStop(1, "rgba(0,0,20,.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { ctx.globalAlpha = 0.25 + r() * 0.4; ctx.fillStyle = "#e8c46a"; ctx.beginPath(); ctx.arc(r() * W, H * (0.15 + r() * 0.55), 0.8 + r() * 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    return cv;
  }

  // tendril mask for the running light (half resolution, drawn once)
  let maskURL = null;
  function makeMask() {
    const pulse = el.pulse;
    const ok = CSS.supports("mask-image", "url(a.png)") || CSS.supports("-webkit-mask-image", "url(a.png)");
    if (!ok) { pulse.hidden = true; return Promise.resolve(); }
    const { W, H, sx, sy, R } = G;
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, W, H, 0.5);
    ctx.lineCap = "round";
    return sliced((function* () {
      let k = 0;
      for (const l of G.roots) { taper(ctx, l, "#fff", 1.6); if (++k % 60 === 0) yield; }
      for (const l of G.trunk) taper(ctx, l, "#fff", 1.4);
      yield;
      for (const l of G.wings) { taper(ctx, l, "#fff", 1.5); if (++k % 80 === 0) yield; }
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
    const upper = G.wings.filter((l) => l.d0 > -0.15);
    for (let i = 0; i < n; i++) {
      const l = upper[(r() * upper.length) | 0];
      const t = Math.pow(r(), 2.3) * 0.6;
      const k = Math.min(l.pts.length - 2, (t * l.pts.length) | 0);
      const p = l.pts[k], q = l.pts[k + 1];
      if (p[1] > sy + R * 0.35) continue;
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const len = r() < 0.4 ? 0.6 : 1.5 + r() * 4.5, x = p[0] + (r() - 0.5) * 6, y = p[1] + (r() - 0.5) * 6;
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
    const { W, H } = G, box = el.sparks, r = rng(5);
    box.textContent = "";
    const n = FX.lite ? 8 : 16, frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      const l = G.wings[(r() * G.wings.length) | 0], p = l.pts[(Math.pow(r(), 1.4) * l.pts.length * 0.8) | 0];
      const near = i < n * 0.65;
      const x = near ? p[0] : r() * W, y = near ? p[1] : H * (0.25 + r() * 0.45);
      if (r() < 0.45) s.className = "sm";
      s.style.left = (x + 26) + "px"; s.style.top = (y + 26) + "px";
      s.style.animationDelay = (-r() * 3.4).toFixed(2) + "s"; s.style.animationDuration = (2.6 + r() * 2.2).toFixed(2) + "s";
      frag.appendChild(s);
    }
    box.appendChild(frag);
  }
  function buildFog() {
    const fog = el.fog;
    const w = G.W + 28, h = Math.round((G.H - 52) * 0.4);
    const cv = document.createElement("canvas");
    const ctx = sizeCanvas(cv, w, h, FX.lite ? 0.5 : 0.75);   // fog is blurry anyway
    const r = rng(11);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = h * (0.35 + r() * 0.7), rx = 60 + r() * 150, ry = 18 + r() * 40;
      for (const dx of [-w, 0, w]) {
        const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        g.addColorStop(0, `rgba(${185 + r() * 30 | 0},${180 + r() * 25 | 0},235,${0.16 + r() * 0.16})`); g.addColorStop(1, "rgba(180,175,230,0)");
        ctx.fillStyle = g; ctx.save(); ctx.translate(x + dx, y); ctx.scale(1, ry / rx); ctx.translate(-(x + dx), -y);
        ctx.beginPath(); ctx.arc(x + dx, y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    return bake(cv, "image/png").then((url) => {
      const old = fog.dataset.url; if (old) URL.revokeObjectURL(old);
      fog.dataset.url = url; fog.textContent = "";
      for (let k = 0; k < 2; k++) { const im = new Image(); im.alt = ""; im.src = url; fog.appendChild(im); }
    });
  }

  // build (or rebuild for a new width) the whole painting · one long task per piece, spread over idle time
  function buildScene() {
    const [W, H] = skySize();
    sceneW = W;
    clearCoronaCache(); prebaked = false;
    G = geometry(W, H);
    const steps = [() => paint(), () => showCorona(state.rarity, true), () => makeMask(), () => { buildSparks(); return buildFog(); }];
    sceneP = steps.reduce((p, f) => p.then(() => new Promise((res) => idle(() => Promise.resolve(f()).then(res, res), 400))), Promise.resolve());
    return sceneP;
  }
  function ensureScene() {
    const [W] = skySize();
    if (!G || Math.abs(W - sceneW) > 40) return buildScene();
    return sceneP || Promise.resolve();
  }
  // paint ahead while idle so the first open is instant · lite devices (≤ 4 GB / ≤ 4 cores / slow probe) paint on
  // the first open instead (a stand-in sky shows meanwhile), so no long painting task lands while they scroll
  function prewarm() { if (!G && state.cards.length && !FX.lite) idle(() => { if (!G && !FX.lite) buildScene(); }, 3000); }

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
  const INTERACTIVE = "button, a, input, select, .bs-wrap, .bs-sheet, .bs-scrim, .bs-co, .bs-pop, .bs-dock, .bs-top";
  // no phone-tilt motion (owner, 2026-10-25): tilting the phone moves nothing · finger / mouse only
  function setupParallax() {
    addPar(el.skyX, "x", 16); addPar(el.skyY, "y", 12);
    addPar(el.sparkX, "x", 26); addPar(el.sparkY, "y", 18);
    addPar(el.fogX, "x", 36);
    addPar(el.foreX, "x", -9); addPar(el.foreY, "y", -7);
    const fromPoint = (e) => { const r = el.root.getBoundingClientRect(); setTarget(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2); };
    // PC: the card faces the mouse (lean), the scene follows it (parallax)
    const mouseLean = (e) => {
      const r = el.fore.getBoundingClientRect();
      const mx = clamp((e.clientX - (r.left + LY.L + LY.cw / 2)) / Math.max(200, r.width / 2), -1, 1);
      const my = clamp((e.clientY - (r.top + LY.T + LY.ch / 2)) / Math.max(200, r.height / 2), -1, 1);
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
    const h = document.createElement("span"); h.className = "bs-holo"; h.innerHTML = "<b><i></i></b>";   // the clip box never moves (it used to slide off the card)
    c.appendChild(h);
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
    el.wrap.setAttribute("aria-label", `${card.name}, ${C.isRanked(card) ? "tier " + card.tier : "unranked"}, ${state.rarity}. Tap to spin`);
  }

  /* ==========================================================
     4. Labels (Tier / Passive / Skill / Strongest / Weakness) from the real data
     ========================================================== */
  const CO_DEF = [
    { key: "tier", k: "Tier", pos: "tl", cls: "bs-co--tier" },
    { key: "ability", k: "Passive / Skill", pos: "tr" },
    { key: "strong", k: "Strongest", pos: "bl", cls: "bs-co--good" },
    { key: "weak", k: "Weakness", pos: "br", cls: "bs-co--bad" },
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
  // returns { empty, n, d (short, HTML), full (HTML), pop (HTML) }
  function coData(card, key) {
    if (key === "tier") {
      const ranked = C.isRanked(card), note = String(card.tierNote || "").trim();
      const ov = ranked ? `Overall ${f1(pct(card.scores.overall))} / 100` : "";
      if (!ranked) return { n: "Unranked", d: esc(note || "Not scored yet"), full: `<p>${esc(note || "This card hasn't been scored yet.")}</p>`, pop: `<h4>Unranked</h4><p>${esc(note || "This card hasn't been scored yet.")}</p>` };
      const n = `Tier ${card.tier}`;
      return { n, d: esc(note || ov), full: (note ? `<p>${esc(note)}</p>` : "") + `<p class="meta">${esc(ov)}</p>`, pop: `<h4>${esc(n)}</h4>${note ? `<p>${esc(note)}</p>` : ""}<p class="meta">${esc(ov)}</p>` };
    }
    if (key === "ability") {
      const ab = abilities(card);
      if (!ab.length) return { empty: true, n: "No passive / skill", d: "", full: "", pop: `<h4>Passive / Skill</h4><p>This card has no passive or skill${C.isRanked(card) ? "" : " listed yet"}.</p>` };
      const first = ab[0], n = first.n || first.kind, many = ab.length > 1;
      const block = (a, h) => `${many ? `<p class="meta">${a.kind}</p>` : ""}${a.n ? `<${h}>${esc(a.n)}</${h}>` : ""}${a.d ? `<p>${esc(a.d)}</p>` : ""}`;
      return {
        n, d: esc(first.d || (ab[1] ? ab[1].n || ab[1].d : "")),
        full: (first.d ? `<p>${esc(first.d)}</p>` : "") + ab.slice(1).map((a) => block(a, "b")).join(""),
        pop: many ? ab.map((a) => block(a, "h4")).join("") : `<h4>${esc(n)}</h4>${first.d ? `<p>${esc(first.d)}</p>` : ""}`,
      };
    }
    const good = key === "strong";
    const pts = arr(good ? card.strengths : card.weaknesses).map(String);
    const vs = names(card, good ? card.beats : card.losesTo);
    const tags = good ? [] : arr(card.weakTo).map(String);
    const modes = bestModes(card, good);
    if (!pts.length && !vs.length && !tags.length) {
      return { empty: true, n: "Not analyzed yet", d: "", full: "", pop: `<h4>${good ? "Strongest" : "Weakness"}</h4><p>This card hasn't been analyzed yet.</p>` };
    }
    const n = pts[0] || (vs.length ? `${good ? "Beats" : "Loses to"} ${vs.length} card${vs.length > 1 ? "s" : ""}` : `Weak to ${tags[0]}`);
    const rest = pts.slice(1);
    const vsLine = vs.length ? `<b>${good ? "Beats" : "Loses to"}</b> ${esc(joinShort(vs, 2))}` : "";
    const d = vsLine || (rest[0] ? esc(rest[0]) : tags.length ? `<b>Weak to</b> ${esc(joinShort(tags, 2))}` : "");
    const meta = [
      vs.length ? `${good ? "Beats" : "Loses to"}: ${vs.join(", ")}` : "",
      tags.length ? `Weak to: ${tags.join(", ")}` : "",
      modes.length ? `${good ? "Best" : "Weakest"} mode: ${modes[0]}` : "",
    ].filter(Boolean).map((t) => `<p class="meta">${esc(t)}</p>`).join("");
    const ul = rest.length ? `<ul>${rest.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
    return { n, d, full: ul + meta, pop: `<h4>${esc(n)}</h4>${ul}${meta}` };
  }
  let popEl = null;
  function buildCallouts() {
    CO_DEF.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bs-co " + (d.cls || "") + (d.pos[1] === "r" ? " is-r is-right" : " is-left");
      b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "bs-pop");
      b.innerHTML = `<span class="bs-co__k">${d.k}</span><span class="bs-co__n"></span><span class="bs-co__d"></span><span class="bs-co__full"></span>`;
      // each part = outer (follows the card's pitch) > b (follows its turn) > i (what you see, grows in on show)
      const mk = (cls) => { const n = document.createElement("div"); n.className = cls; n.innerHTML = "<b><i></i></b>"; return n; };
      const line = mk("bs-line"), dot = mk("bs-dot"), end = mk("bs-dot bs-dot--end");
      el.callouts.append(line, dot, end, b);
      const o = { d, el: b, line, dot, end, lineV: line.querySelector("i"), dotV: dot.querySelector("i"), endV: end.querySelector("i"), poses: null, data: null, y: 0, x: 0, w: 0, lh: 0 };
      b.addEventListener("click", () => { if (!side) togglePop(o); });
      coEls.push(o);
    });
    popEl = document.createElement("div");
    popEl.className = "bs-pop"; popEl.id = "bs-pop"; popEl.hidden = true; popEl.setAttribute("role", "region");
    el.foreY.appendChild(popEl);
  }
  function fillCallouts(card) {
    for (const o of coEls) {
      const x = coData(card, o.d.key); o.data = x;
      o.el.classList.toggle("is-empty", !!x.empty);
      o.el.classList.toggle("is-longn", x.n.length > 56);   // a long sentence as the title reads better in the body font
      o.el.querySelector(".bs-co__n").textContent = x.n;
      o.el.querySelector(".bs-co__d").innerHTML = x.d;      // escaped above (esc) + our own <b>
      o.el.querySelector(".bs-co__full").innerHTML = x.full;
      o.el.setAttribute("aria-label", `${o.d.k}: ${x.n}${side ? "" : ". Show full text"}`);
      if (o.d.key === "tier") { if (C.isRanked(card)) o.el.style.setProperty("--tc", `var(${C.TIER_COLOR[card.tier] || "--t-d"})`); else o.el.style.removeProperty("--tc"); }
    }
  }
  /* A label's line runs from its own label (fixed) to a dot ON the card. The dot follows the card as it turns / leans:
     the card's 3D pose is projected ahead (once per layout) into paused Web Animations — yaw 0–360° (37 steps, same
     timing as the card's rotor) and pitch −30…30° (13 steps, same as its tilt) — and apply3D() only sets currentTime.
     No style writes per frame (§4.1). Yaw and pitch are combined additively (close enough at the limited lean angles). */
  const PERSP = 1100;   // = .bs-wrap.is-3d .bs-zoom perspective in detail.css
  let poseYT = 0, posePT = 500;
  function placeCo(o, ax, ay, ex, ey) {
    o.dot.style.left = ax + "px"; o.dot.style.top = ay + "px";
    o.end.style.left = ex + "px"; o.end.style.top = ey + "px";
    o.line.style.left = ex + "px"; o.line.style.top = ey + "px";
    if (o.poses) o.poses.forEach((a) => a.cancel());
    const cx = LY.L + LY.cw / 2, cy = LY.T + LY.ch / 2, px = ax - cx, py = ay - cy;
    const yDot = [], yLine = [], pDot = [], pLine = [];
    let prev = null;
    for (let k = 0; k <= 36; k++) {
      const th = k * Math.PI / 18, sc = PERSP / (PERSP + px * Math.sin(th));
      const x = px * Math.cos(th) * sc, y = py * sc;
      yDot.push({ transform: `translate(${f2(x - px)}px,${f2(y - py)}px)` });
      const vx = cx + x - ex, vy = cy + y - ey;
      let ang = Math.atan2(vy, vx) * 180 / Math.PI;
      if (prev !== null) { while (ang - prev > 180) ang -= 360; while (ang - prev < -180) ang += 360; }
      prev = ang;
      yLine.push({ transform: `rotate(${f2(ang)}deg) scaleX(${(Math.hypot(vx, vy) / 100).toFixed(4)})` });
    }
    const v0x = ax - ex, v0y = ay - ey, v2 = Math.max(1, v0x * v0x + v0y * v0y);
    for (let k = 0; k <= 12; k++) {
      const ph = (k * 5 - 30) * Math.PI / 180, sc = PERSP / (PERSP - py * Math.sin(ph));
      const dy = py * Math.cos(ph) * sc - py;
      pDot.push({ transform: `translate(0px,${f2(dy)}px)` });
      // shear that moves only the line's far end (on the card) by dy, the label end stays put
      pLine.push({ transform: `matrix(1,${(dy * v0x / v2).toFixed(5)},0,${(1 + dy * v0y / v2).toFixed(5)},0,0)` });
    }
    const mk = (n, kf, d) => { const a = n.animate(kf, { duration: d, fill: "both", easing: "linear" }); a.pause(); return a; };
    o.poses = [mk(o.dot.firstChild, yDot, 3600), mk(o.dot, pDot, 1000), mk(o.line.firstChild, yLine, 3600), mk(o.line, pLine, 1000)];
    o.poses[0].currentTime = o.poses[2].currentTime = poseYT;
    o.poses[1].currentTime = o.poses[3].currentTime = posePT;
  }
  function poseCallouts(yt, pt) {
    if (yt === poseYT && pt === posePT) return;
    poseYT = yt; posePT = pt;
    for (const o of coEls) if (o.poses) { o.poses[0].currentTime = o.poses[2].currentTime = yt; o.poses[1].currentTime = o.poses[3].currentTime = pt; }
  }

  /* ==========================================================
     5. Layout: phone (labels above / below) · side (≥ 768: labels left / right, full text, bigger card)
     ========================================================== */
  function moveHud(on) {
    if (on === hud && el.ovr.parentElement !== null && (on ? el.ovr.parentElement === el.dockL : el.ovr.parentElement === el.foreY)) return;
    hud = on;
    if (on) { el.dockL.appendChild(el.ovr); el.dockR.appendChild(el.dbtn); ["left", "top"].forEach((p) => { el.ovr.style[p] = ""; el.dbtn.style[p] = ""; }); }
    else { el.foreY.appendChild(el.ovr); el.foreY.appendChild(el.dbtn); }
  }
  function layout() {
    if (el.root.hidden) return;
    const rw = el.root.clientWidth, rh = el.root.clientHeight;
    side = rw >= 768 || (rw >= 600 && rw > rh * 1.15);
    el.root.classList.toggle("is-side", side);
    const fw = el.fore.clientWidth, fh = el.fore.clientHeight;
    const topH = el.fore.offsetTop;
    const [W, H] = skySize(), sun = sunOf(W, H);
    const sunB = sun.sy + sun.R - 26 - topH + 12;   // bottom of the black sun in foreground coordinates
    let cw, useHud = false, top = 0;
    if (!side) cw = clamp(Math.min(fw * 0.58, (fh - 214) * 0.714), 130, 260);
    else {
      const cap = Math.min(440, fw * 0.42, fw - 2 * (170 + 56));
      top = fh < 520 ? 8 : Math.min(sunB, fh * 0.2);
      const under = Math.min(cap, (fh - top - 128) * 0.714);
      const inBar = Math.min(cap, (fh - top - 14) * 0.714);
      useHud = under < inBar * 0.85;
      cw = Math.max(120, useHud ? inBar : under);
    }
    cw = Math.round(cw);
    const ch = Math.round(cw * 1.4);
    el.root.style.setProperty("--cw", cw + "px");
    moveHud(side && useHud);
    const below = hud ? 0 : 18 + 60 + 8 + 40;   // a clear gap between the card and the Overall ring
    const L = Math.round((fw - cw) / 2);
    let T;
    if (!side) T = 76 + Math.max(0, (fh - 76 - below - ch) * 0.5);
    else { T = Math.max(8, (fh - below - ch) / 2); T = Math.max(T, Math.min(top, fh - below - ch - 4)); }
    T = Math.round(T);
    const B = T + ch;
    LY = { L, T, cw, ch, fw, fh, B };
    el.wrap.style.left = L + "px"; el.wrap.style.top = T + "px";
    if (!hud) {
      el.ovr.style.left = (fw / 2 - 30) + "px"; el.ovr.style.top = (B + 18) + "px";
      el.dbtn.style.left = Math.round(fw / 2 - el.dbtn.offsetWidth / 2) + "px"; el.dbtn.style.top = (B + 86) + "px";
    }
    const zs = Math.min(1.7, (fh - 16) / ch, (fw - 24) / cw);
    el.zoom.style.setProperty("--zs", zs.toFixed(3)); el.zoom.style.setProperty("--zy", Math.round(fh / 2 - (T + ch / 2)) + "px");

    if (side) {
      // full text left / right of the card; each label at most half the height (it scrolls inside beyond that)
      const gap = 44, maxW = fw >= 1200 ? 380 : 320;
      const w = Math.max(120, Math.min(maxW, L - gap - 14));
      el.root.style.setProperty("--co-max", Math.floor((fh - 22) / 2) + "px");
      const col = { l: [], r: [] };
      for (const o of coEls) {
        const right = o.d.pos[1] === "r";
        o.el.style.width = w + "px";
        o.el.style.left = (right ? L + cw + gap : L - gap - w) + "px";
        col[right ? "r" : "l"].push(o);
      }
      for (const k of ["l", "r"]) {
        const [a, b] = col[k];                    // a = top label, b = bottom label
        const ha = a.el.offsetHeight, hb = b.el.offsetHeight;
        let ya = T + ch * 0.26 - ha / 2, yb = T + ch * 0.74 - hb / 2;
        ya = Math.max(4, ya);
        if (yb < ya + ha + 14) yb = ya + ha + 14;
        if (yb + hb > fh - 4) { const s = yb + hb - (fh - 4); yb -= s; ya = Math.max(4, ya - s); }
        [[a, ya, ha], [b, yb, hb]].forEach(([o, y, h]) => {
          y = Math.round(y);
          o.el.classList.toggle("is-scroll", o.el.scrollHeight > o.el.clientHeight + 2);   // more text inside: fade the bottom edge
          const right = k === "r", x = parseFloat(o.el.style.left);
          o.el.style.top = y + "px";
          const ey = y + Math.min(h / 2, 24), ex = right ? x - 3 : x + w + 3;
          const ax = right ? L + cw : L, ay = clamp(ey, T + 14, B - 14);
          Object.assign(o, { x, y, w, lh: h, bottom: o.d.pos[0] === "b", right });
          placeCo(o, ax, ay, ex, ey);
        });
      }
      closePop(true);
    } else {
      el.root.style.removeProperty("--co-max");
      coEls.forEach((o) => o.el.classList.remove("is-scroll"));
      const dbw = el.dbtn.offsetWidth || 100;
      for (const o of coEls) {
        const right = o.d.pos[1] === "r", bottom = o.d.pos[0] === "b";
        let x, w;
        if (!bottom) { w = Math.floor(fw / 2 - 20); x = right ? Math.ceil(fw / 2 + 6) : 14; }
        else { w = Math.floor(Math.min(170, (fw - dbw) / 2 - 22)); x = right ? fw - 14 - w : 14; }
        o.el.style.left = x + "px"; o.el.style.width = w + "px";
        const lh = o.el.offsetHeight;
        let y, ax, ay, ex, ey;
        if (!bottom) { y = Math.max(2, T - 22 - lh); ex = right ? x + 18 : x + w - 18; ey = y + lh + 3; ax = right ? L + cw * 0.76 : L + cw * 0.24; ay = T; }
        else { y = Math.min(B + 22, fh - lh - 2); ex = right ? x + 18 : x + w - 18; ey = y - 3; ax = right ? L + cw * 0.78 : L + cw * 0.22; ay = B; }
        o.el.style.top = y + "px";
        Object.assign(o, { x, y, w, lh, bottom, right });
        placeCo(o, ax, ay, ex, ey);
      }
      if (openCo) placePop(openCo);
    }
    el.pager.textContent = list.length > 1 ? `${idx + 1} / ${list.length}${side ? "" : " · swipe ← →"}` : "";
  }

  /* ---------- labels show / hide ---------- */
  let coAnims = [];
  function hideCallouts() {
    coAnims.forEach((a) => a.cancel()); coAnims = [];
    for (const o of coEls) for (const x of [o.el, o.lineV, o.dotV, o.endV]) { x.style.opacity = ""; x.style.transform = ""; }
    closePop(true);
  }
  // a finished animation still keeps its element as its own layer; commit the end state as plain styles instead (§13.1 lesson 6)
  function keep(an) { an.onfinish = () => { try { an.commitStyles(); } catch (e) {} an.cancel(); const i = coAnims.indexOf(an); if (i >= 0) coAnims.splice(i, 1); }; return an; }
  function showCallouts() {
    hideCallouts();
    const on = { fill: "forwards" };
    const push = (...xs) => xs.forEach((x) => coAnims.push(keep(x)));
    coEls.forEach((o, i) => {
      const d = i * 140;
      if (rm()) {
        push(o.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: d, ...on }),
          o.lineV.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(1)" }], { duration: 1, ...on }),
          o.dotV.animate([{ transform: "scale(1)" }, { transform: "scale(1)" }], { duration: 1, ...on }),
          o.endV.animate([{ transform: "scale(1)" }, { transform: "scale(1)" }], { duration: 1, ...on }));
        return;
      }
      push(
        o.dotV.animate([{ transform: "scale(0)" }, { transform: "scale(1.5)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 260, delay: d, easing: E, ...on }),
        o.lineV.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 260, delay: d + 120, easing: E, ...on }),
        o.endV.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: 160, delay: d + 360, easing: E, ...on }),
        o.el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: d + 380, easing: E, ...on }),
      );
    });
  }

  /* ---------- tap a label (phone) = full explanation ---------- */
  let openCo = null;
  function togglePop(o) {
    if (openCo === o) { closePop(); return; }
    closePop(true);
    popEl.classList.toggle("is-bad", o.d.key === "weak");
    popEl.innerHTML = o.data ? o.data.pop : "";
    popEl.setAttribute("aria-label", o.d.k);
    popEl.hidden = false; openCo = o; o.el.setAttribute("aria-expanded", "true");
    placePop(o);
    void popEl.offsetWidth; popEl.classList.add("is-on");
  }
  function placePop(o) {
    const pw = Math.min(300, LY.fw - 28);
    popEl.style.width = pw + "px";
    popEl.style.maxHeight = Math.max(120, LY.fh - 8) + "px";
    const ph = popEl.offsetHeight;
    const left = clamp(o.right ? o.x + o.w - pw : o.x, 14, LY.fw - pw - 14);
    const below = !o.bottom;
    const top = clamp(below ? o.y + o.lh + 6 : o.y - 6 - ph, 2, Math.max(2, LY.fh - ph - 2));
    popEl.style.left = left + "px"; popEl.style.top = top + "px";
    popEl.style.setProperty("--py", below ? "-6px" : "6px");
  }
  function closePop(instant) {
    if (!openCo) return;
    openCo.el.setAttribute("aria-expanded", "false"); openCo = null;
    popEl.classList.remove("is-on");
    if (instant || rm()) popEl.hidden = true;
    else setTimeout(() => { if (!openCo) popEl.hidden = true; }, 210);
  }

  /* ---------- Overall ring ---------- */
  let ovrVal = 0, ovrRaf = 0;
  function setOverall(card, anim) {
    const ranked = C.isRanked(card), v = ranked ? Math.round(pct(card.scores.overall)) : 0;
    el.ovr.classList.toggle("is-unranked", !ranked);
    el.ovrLbl.textContent = ranked ? "OVERALL" : "UNRANKED";
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
  function motesPlay(on) { moteAnims().forEach((x) => (on ? x.play() : x.pause())); }
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
  const HOLO_KF = Array.from({ length: 9 }, (_, k) => ({ transform: `translateX(${f2(Math.sin(k * Math.PI / 4) * 34)}%)` }));
  let A3 = null;
  const mod360 = (a) => ((a % 360) + 360) % 360;
  const leaning = () => Math.abs(R3.tly) > 0.01 || Math.abs(R3.tlx) > 0.01 || Math.abs(R3.ly) > 0.05 || Math.abs(R3.lx) > 0.05;
  function enter3D() {
    if (A3) return;
    el.wrap.classList.add("is-3d");
    const lin = { duration: 3600, fill: "both", easing: "linear" };
    const y = el.rotor.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }], lin);
    const x = el.tiltEl.animate([{ transform: "rotateX(-30deg)" }, { transform: "rotateX(30deg)" }], { duration: 1000, fill: "both" });
    const holos = [...el.rotor.querySelectorAll(".bs-holo i")].map((h) => h.animate(HOLO_KF, lin));
    const holoY = [...el.rotor.querySelectorAll(".bs-holo b")].map((h) => h.animate([{ transform: "translateY(22%)" }, { transform: "translateY(-22%)" }], { duration: 1000, fill: "both" }));
    A3 = { y, x, holos, holoY, all: [y, x, ...holos, ...holoY] };
    A3.all.forEach((a) => a.pause());
    apply3D();
  }
  // back to flat 2D (card straight): the holo keeps its last place (#7: a still sheen, no looping animation)
  function exit3D() {
    if (!A3) return;
    for (const a of A3.holos.concat(A3.holoY)) { try { a.commitStyles(); } catch (e) {} }
    A3.all.forEach((a) => a.cancel()); A3 = null;
    el.wrap.classList.remove("is-3d"); busy(false);
    poseCallouts(0, 500);
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
    A3.y.currentTime = t; for (const a of A3.holos) a.currentTime = t;
    const xt = (clamp(pitch, -30, 30) + 30) / 60 * 1000;
    A3.x.currentTime = xt; for (const a of A3.holoY) a.currentTime = xt;
    poseCallouts(t, xt);
  }
  // the mouse (PC) sets where the card leans to (eased in tick)
  function setLean(y, x) {
    if (!isOpen || rm() || el.root.hidden) return;
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
    closePop(); hideHint(); enter3D(); busy(true);
    const a0 = R3.ang, a1 = (Math.round(a0 / 360) + 1) * 360;   // one more full turn, always ends on the front
    R3.mode = "tween"; R3.spin = true; R3.tw = { a0, a1, t0: performance.now(), dur: 900 }; R3.release = false;
    kick();
  }
  function toggleZoom(force) {
    const on = typeof force === "boolean" ? force : !el.fore.classList.contains("is-zoom");
    el.fore.classList.toggle("is-zoom", on); closePop(true); if (on) hideHint();
  }
  let P = null, tapTimer = 0, lastTap = 0;
  const dpp = () => 200 / Math.max(120, el.wrap.offsetWidth);   // degrees per pixel of finger movement
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
        P.drag = true; clearTimeout(tapTimer); tapTimer = 0; closePop(); hideHint();
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
      if (openCo && !e.target.closest(".bs-co, .bs-pop")) closePop();
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
    if (list.length < 2 || switching || R3.mode !== "rest" || el.fore.classList.contains("is-zoom") || !(ready || introRaf) || sheetOpen) return;
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
    switching = true; stopIntro(); closePop(true); hideHint(); stopCard(); toggleZoom(false);
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
     8. Details sheet: every panel of the old detail page
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
  function subStat(card, key, r) {
    if (card.exact && card.exact[r] && card.exact[r][key]) return "Game value";
    if (r === "Normal") return "Base value";
    return `Normal ${C.fmtStat(card.base[key])} × ${C.rarityOf(r).stat}`;
  }
  function sheetHTML(card) {
    const ranked = C.isRanked(card);
    const s = card.scores || {}, team = card.team || {};
    const strengths = arr(card.strengths), weaknesses = arr(card.weaknesses);
    const ab = abilities(card);
    const abHTML = ab.length ? ab.map((a) => `${ab.length > 1 ? `<span class="ability__kind">${a.kind}</span>` : ""}${a.n ? `<b class="ability__name">${esc(a.n)}</b>` : ""}${a.d ? `<p class="ability__desc">${esc(a.d)}</p>` : ""}`).join("") : `<p class="muted">None</p>`;
    const note = String(card.tierNote || "").trim();
    const bullets = (a, cls) => a.length ? `<ul class="pc pc--${cls}">${a.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">Not analyzed yet</p>`;
    const supports = arr(team.bestSupport).map((id) => { const f = state.support.find((x) => x.id === id); return f && f.name ? f.name : pretty(id); });
    const slot = fmtSlot(team.position);
    const resolve = (ids) => arr(ids).map((id) => byId.get(id)).filter((c) => c && c.id !== card.id);
    const beats = resolve(card.beats), loses = resolve(card.losesTo), withs = resolve(team.bestWith);
    const row = (id, a) => a.length ? `<div class="mini-row" id="${id}"></div>` : `<p class="muted">Not analyzed yet</p>`;
    const overall = ranked ? `
      <div class="overall">
        <div class="overall__score"><span class="overall__num" data-d="overall" data-value="0">0</span><span class="overall__max">/ 100</span></div>
        <div class="overall__tier"><span class="badge badge--tier">${esc(card.tier)}</span><small>Tier</small></div>
      </div>
      <div class="scores">${SCORE_ROWS.map(([k, label, w], i) => `
        <div class="score" style="--v:${pct(scoreOf(s, k)) / 100};--d:${150 + i * 60}ms">
          <span class="score__name">${label}</span><span class="score__weight">${w}%</span>
          <span class="score__num" data-d="s-${k}" data-value="0">0</span>
          <span class="score__track"><i></i></span>
        </div>`).join("")}</div>`
      : `<div class="unranked"><span class="badge badge--muted">Unranked</span><span>This card hasn't been scored yet. Its Overall score and tier will show up here once it is.</span></div>`;
    return `
        <div class="detail__badges">
          ${ranked ? `<span class="badge badge--tier">Tier ${esc(card.tier)}</span>` : `<span class="badge badge--muted">Unranked</span>`}
          ${card.role && !/\|/.test(card.role) ? `<span class="badge">${esc(card.role)}</span>` : ""}
        </div>
        <div class="rarity-picker" role="group" aria-label="Rarity">${C.rarityChipsHTML()}</div>
        <div class="dstats${EXTRA_STATS.some(([k]) => hasBase(card, k)) ? " dstats--more" : ""}">
          <div class="dstat dstat--atk"><div class="dstat__label">ATK</div><div class="dstat__value" data-d="atk" data-value="0">0</div><div class="dstat__sub" data-d="atk-sub"></div></div>
          <div class="dstat dstat--hp"><div class="dstat__label">HP</div><div class="dstat__value" data-d="hp" data-value="0">0</div><div class="dstat__sub" data-d="hp-sub"></div></div>
          ${EXTRA_STATS.filter(([k]) => hasBase(card, k)).map(([k, label]) => `<div class="dstat dstat--${k}"><div class="dstat__label">${label}</div><div class="dstat__value" data-d="${k}" data-value="0">0</div><div class="dstat__sub" data-d="${k}-sub"></div></div>`).join("")}
          <div class="dstat dstat--odds"><div class="dstat__label">Pull odds</div><div class="dstat__value" data-d="odds"></div><div class="dstat__sub" data-d="odds-sub"></div></div>
        </div>
        <section class="dpanel" aria-labelledby="d-t-overall">
          <h3 class="dpanel__title" id="d-t-overall">Overall score</h3>
          ${ranked ? `<p class="dpanel__sub">Weighted sum of five scores, each out of 100.</p>` : ""}
          ${note ? `<p class="dpanel__note">${esc(note)}</p>` : ""}
          ${overall}
        </section>
        ${C.grade.panelHTML(card)}
        <section class="dpanel" aria-labelledby="d-t-abilities">
          <h3 class="dpanel__title" id="d-t-abilities">Passive / Skill</h3>
          <div class="ability">${abHTML}</div>
        </section>
        <section class="dpanel" aria-labelledby="d-t-pc">
          <h3 class="dpanel__title" id="d-t-pc">Strengths &amp; weaknesses</h3>
          <div class="proscons">
            <div><h4 class="pc__title pc__title--good">Strengths</h4>${bullets(strengths, "good")}</div>
            <div><h4 class="pc__title pc__title--bad">Weaknesses</h4>${bullets(weaknesses, "bad")}</div>
          </div>
        </section>
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
        </section>
        <footer class="detail__foot">
          ${card.notes ? `<p>${esc(card.notes)}</p>` : ""}
          ${card.updated ? `<p>Updated ${esc(card.updated)}</p>` : ""}
        </footer>`;
  }
  const q = (k) => el.sheetBody.querySelector(`[data-d="${k}"]`);
  const setNum = (n, v, fmt, anim) => { if (!n) return; if (anim) FX.countTo(n, v, { format: fmt }); else { n.dataset.value = v; n.textContent = fmt(v); } };
  function fillStats(card, anim) {
    const r = state.rarity, info = C.rarityOf(r);
    setNum(q("atk"), C.statAt(card, "atk", r), C.fmtStat, anim);
    setNum(q("hp"), C.statAt(card, "hp", r), C.fmtStat, anim);
    q("odds").textContent = C.fmtOdds(C.oddsAt(card, r));
    q("atk-sub").textContent = subStat(card, "atk", r);
    q("hp-sub").textContent = subStat(card, "hp", r);
    EXTRA_STATS.forEach(([k]) => { if (!q(k)) return; setNum(q(k), C.statAt(card, k, r), C.fmtStat, anim); q(k + "-sub").textContent = subStat(card, k, r); });
    q("odds-sub").textContent = r === "Normal" ? "Base odds" : `Normal ${C.fmtOdds(card.base.odds)} · ${Number(info.odds.toPrecision(4)).toLocaleString("en-US")}× rarer`;
  }
  function fillScores(card, anim) {
    if (!C.isRanked(card)) return;
    const s = card.scores, fmt = (n) => String(Math.round(n));
    setNum(q("overall"), pct(s.overall), fmt, anim);
    SCORE_ROWS.forEach(([k]) => setNum(q("s-" + k), scoreOf(s, k), fmt, anim));
  }
  function sheetSub(card) {
    return `${C.isRanked(card) ? `Tier ${card.tier}` : "Unranked"} · ${state.rarity}${card.series ? " · " + card.series : ""}`;
  }
  const el2 = {};
  let sheetOpen = false, shAnims = [], SD = null, sheetKey = "";
  function prefillSheet() { setTimeout(() => idle(() => { if (isOpen && !sheetOpen) fillSheet(); }), 0); }
  function fillSheet() {
    const card = cur;
    if (!card || sheetKey === card.id) return;
    sheetKey = card.id;
    el.shTitle.textContent = card.name;
    el.shSub.textContent = sheetSub(card);
    el.shThumb.innerHTML = card.image ? C.artImg(card.image, true) : C.placeholderArt(card);
    if (card.image) C.bindArt(el.shThumb, card);
    el.sheetBody.style.setProperty("--tc", `var(${C.TIER_COLOR[card.tier] || "--t-d"})`);   // tier badge colour
    el.sheetBody.innerHTML = sheetHTML(card);
    C.grade.mountSlabs(el.sheetBody);   // step 13: the graded case in the Grade panel (only when this card has grades)
    [["#d-beats", card.beats], ["#d-loses", card.losesTo], ["#d-with", card.team && card.team.bestWith]].forEach(([sel, ids]) => {
      const rowEl = $(sel, el.sheetBody);
      if (!rowEl) return;
      arr(ids).map((id) => byId.get(id)).filter((c) => c && c.id !== card.id)
        .forEach((c) => rowEl.appendChild(C.renderCard(c, state.rarity, { mini: true })));
    });
    fillStats(card, false); fillScores(card, false);
    el.sheet.classList.add("is-ready-paint");
    el.sheetBody.scrollTop = 0;
  }
  function moveSheet(f0, f1v, dur, easing, done) {
    shAnims.forEach((a) => a.cancel());
    const o = { duration: Math.max(90, dur * Math.max(0.35, Math.abs(f1v - f0))), easing, fill: "forwards" };
    shAnims = rm()
      ? [el.sheet.animate([{ opacity: 1 - f0 }, { opacity: 1 - f1v }], o), el.scrim.animate([{ opacity: 1 - f0 }, { opacity: 1 - f1v }], o)]
      : [el.sheet.animate([{ transform: `translateY(${f2(f0 * 100)}%)` }, { transform: `translateY(${f2(f1v * 100)}%)` }], o), el.scrim.animate([{ opacity: 1 - f0 }, { opacity: 1 - f1v }], o)];
    if (done) shAnims[0].onfinish = done;
  }
  function openSheet() {
    if (sheetOpen || !ready || !cur) return;
    fillSheet(); el.sheetBody.scrollTop = 0; closePop(true); hideHint(); stopCard(); toggleZoom(false);
    el.sheet.inert = false; el.sheet.classList.add("is-open"); el.scrim.hidden = false; sheetOpen = true;
    moveSheet(1, 0, 320, E);
    // §4: numbers count up · score bars grow · panels come up one after another
    el.sheetBody.querySelectorAll("[data-value]").forEach((n) => { if (n.dataset.d && n.dataset.d !== "odds") { n.dataset.value = 0; n.textContent = "0"; } });
    fillStats(cur, true); fillScores(cur, true);
    el.sheetBody.classList.remove("is-replay"); void el.sheetBody.offsetWidth; el.sheetBody.classList.add("is-replay");
    FX.stagger(el.sheetBody, 50, { cls: "fx-up", max: 8, cleanup: true });
    el.sheetX.focus({ preventScroll: true });
  }
  function closeSheet(from, instant) {
    if (!sheetOpen) return;
    sheetOpen = false;
    const done = () => { shAnims.forEach((a) => a.cancel()); shAnims = []; el.sheet.classList.remove("is-open"); el.sheet.inert = true; el.scrim.hidden = true; if (!instant && isOpen) el.dbtn.focus({ preventScroll: true }); };
    if (instant) { done(); return; }
    moveSheet(from || 0, 1, 260, "cubic-bezier(.4,0,1,1)", done);
  }
  function setupSheet() {
    el.dbtn.addEventListener("click", () => openSheet());
    el.sheetX.addEventListener("click", () => closeSheet(0));
    el.scrim.addEventListener("click", () => closeSheet(0));
    const head = el.sheetHead;
    head.addEventListener("pointerdown", (e) => {
      if (!sheetOpen || e.target.closest("button")) return;
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
      SD = { id: e.pointerId, y0: e.clientY, h: el.sheet.offsetHeight, s: [[e.clientY, performance.now()]], f: 0, anim: null };
    });
    head.addEventListener("pointermove", (e) => {
      if (!SD || e.pointerId !== SD.id) return;
      const f = clamp((e.clientY - SD.y0) / SD.h, 0, 1);
      if (!SD.anim && f > 0.004) {   // the finger drives a paused animation (no style writes per frame)
        shAnims.forEach((a) => a.cancel()); shAnims = [];
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
     9. Level dots (the site-wide rarity)
     ========================================================== */
  function buildDock() {
    const box = el.lv;
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
  function paintDock(instant) {
    const i = Math.max(0, state.meta.rarities.findIndex((r) => r.name === state.rarity));
    el.lv.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
    if (instant) el.lvInd.style.transition = "none";
    el.lvInd.style.transform = `translateX(${i * 40}px)`;
    if (instant) { void el.lvInd.offsetWidth; el.lvInd.style.transition = ""; }
    el.lvName.textContent = state.rarity;
    if (!instant && !rm()) el.lvName.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: E });
    [el.fore, el.dock, el.sheet, el.wrap, el.hint].forEach((x) => { x.dataset.lvl = state.rarity; });
  }
  // the rarity changed anywhere (dots here, chips in the sheet): update the scene
  function onRarity() {
    for (const [id, fc] of faceCache) {
      const card = byId.get(id); if (!card) continue;
      const live = isOpen && fc.f.isConnected;
      C.setCardRarity(fc.f, card, state.rarity, { animate: live });
      C.setCardRarity(fc.b, card, state.rarity, { animate: false });
    }
    if (!isOpen) return;
    paintDock(false);
    moteColors();
    showCorona(state.rarity, false);
    if (cur) {
      el.wrap.setAttribute("aria-label", `${cur.name}, ${C.isRanked(cur) ? "tier " + cur.tier : "unranked"}, ${state.rarity}. Tap to spin`);
      el.shSub.textContent = sheetSub(cur);
      if (sheetKey === cur.id) {
        fillStats(cur, sheetOpen);
        el.sheetBody.querySelectorAll(".card[data-id]").forEach((c) => { const d = byId.get(c.dataset.id); if (d) C.setCardRarity(c, d, state.rarity, { animate: sheetOpen }); });
      }
    }
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
    introTimers.push(setTimeout(() => { showCallouts(); introTimers.push(setTimeout(showHint, 1100)); }, 380));
    afterShow();
    setTimeout(prebakeCoronas, 3400);
  }
  // every open plays it (owner, 2026-10-25) · fast = swiping to the next card: the same intro at 0.75× the time
  function runIntro(fast) {
    stopIntro(); stopCard(); toggleZoom(false); closeSheet(0, true); hideCallouts();
    el.fore.classList.remove("is-ready"); el.wrap.classList.remove("is-in"); motesPlay(false); ready = false;
    if (rm()) { reveal(); return; }
    const sr = el.stage.getBoundingClientRect(), wr = el.wrap.getBoundingClientRect();
    const W = sr.width, H = sr.height, cw = LY.cw, ch = LY.ch, L = wr.left - sr.left, T = wr.top - sr.top;
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
    if (!l || !l.length) l = C.cards.order();
    if (!l.includes(id)) l = [id, ...l];
    return l;
  }
  function returnTarget(id) {
    if (scopeEl && scopeEl.isConnected) { const t = scopeEl.querySelector(cardSel(id)); if (t && t.getClientRects().length) return t; }
    if (originEl && originEl.isConnected && (originEl.dataset.id === id || originEl.dataset.openCard === id)) return originEl;
    const page = $("#page-" + (state.page || "cards"));
    const t = page ? page.querySelector(`.card[data-id="${CSS.escape(id)}"]`) : null;
    return t && t.getClientRects().length ? t : null;
  }
  function setBackground(on) {
    document.documentElement.classList.toggle("is-detail", on);
    [".topbar", ".nav", ".main"].forEach((sel) => { const n = $(sel); if (!n) return; if (on) n.setAttribute("inert", ""); else n.removeAttribute("inert"); });
  }
  // fade with the scene (the labels, ring and Details button follow .is-ready on the foreground through CSS)
  const chrome = () => [el.stage, el.top, el.dock];
  let settleTimer = 0, fades = [];
  function open(id) {
    const card = byId.get(id);
    if (!card) { C.closeCard(); return; }        // unknown id in the link -> back to the page
    if (isOpen) {
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
    Promise.race([sceneP || Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(() => { if (mine === token && isOpen) runIntro(); });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (mine === token && isOpen) settled(true); }, 520);
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
    const id = cur && cur.id;
    const mine = ++token;
    clearTimeout(settleTimer);
    settled(false);
    stopIntro(); stopCard(); closeSheet(0, true); closePop(true); toggleZoom(false); hideHint();
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
    Promise.all(runs.map(settle)).then(() => { if (mine === token) finish(target); });
  }
  function finish(target) {
    fades.forEach((a) => a.cancel()); fades = [];
    el.wrap.getAnimations().forEach((a) => a.cancel());
    el.wrap.style.transformOrigin = "";
    el.root.hidden = true;
    el.wrap.classList.remove("is-in"); el.fore.classList.remove("is-ready");
    hideCallouts(); motesPlay(false);
    setBackground(false);
    document.title = baseTitle;
    if (hiddenEl) { hiddenEl.style.visibility = ""; hiddenEl = null; }
    const f = (target && target.isConnected && target) || prevFocus;
    if (f && f.focus) f.focus({ preventScroll: true });
    prevFocus = null; originEl = null; scopeEl = null; cur = null;
    faceCache.clear(); el.faceF.textContent = ""; el.faceB.textContent = "";
    el.sheetBody.textContent = ""; sheetKey = "";
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
    const g = (id) => document.getElementById(id);
    Object.assign(el, {
      root: g("detail"), stage: g("bs-stage"), sky: g("bs-sky"), bg: g("bs-bg"), pulse: g("bs-pulse"), sparks: g("bs-sparks"), fog: g("bs-fog"), dust: g("bs-dust"),
      skyX: g("bs-skyX"), skyY: g("bs-skyY"), sparkX: g("bs-sparkX"), sparkY: g("bs-sparkY"), fogX: g("bs-fogX"), foreX: g("bs-foreX"), foreY: g("bs-foreY"),
      top: $("#detail .bs-top"), close: g("detail-close"), name: g("bs-name"), pager: g("bs-pager"),
      fore: g("bs-fore"), callouts: g("bs-callouts"), wrap: g("bs-wrap"), zoom: g("bs-zoom"), swirl: g("bs-swirl"), mat: g("bs-mat"),
      tiltEl: g("bs-tiltEl"), rotor: g("bs-rotor"), faceF: g("bs-faceF"), faceB: g("bs-faceB"),
      ovr: g("bs-ovr"), ovrArc: g("bs-ovrArc"), ovrNum: g("bs-ovrNum"), ovrLbl: g("bs-ovrLbl"), dbtn: g("bs-details"),
      hint: g("bs-hint"), dock: g("bs-dock"), dockL: g("bs-dockL"), dockR: g("bs-dockR"), lv: g("bs-lv"), lvInd: g("bs-lvInd"), lvName: g("bs-lvName"),
      prev: g("bs-prev"), next: g("bs-next"),
      scrim: g("bs-scrim"), sheet: g("bs-sheet"), sheetHead: g("bs-sheetHead"), shThumb: g("bs-shThumb"), shTitle: g("bs-shTitle"), shSub: g("bs-shSub"), sheetX: g("bs-sheetX"), sheetBody: g("bs-sheetBody"),
    });
    coronaFront = g("bs-coronaA"); coronaBack = g("bs-coronaB");

    // any card on the site opens the detail (moved here from js/cards.js)
    document.addEventListener("click", (e) => { const n = e.target.closest(".card[data-id]"); if (n) activate(n); });
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".card[role=button]")) { e.preventDefault(); activate(e.target); return; }
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (sheetOpen) closeSheet(0); else if (openCo) closePop(); else if (el.fore.classList.contains("is-zoom")) toggleZoom(false); else C.closeCard();
      } else if (!sheetOpen && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !(e.target.closest && e.target.closest("input, select, textarea"))) {
        e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1);
      }
    });
    el.close.addEventListener("click", () => C.closeCard());
    document.addEventListener("cbi:rarity", onRarity);
    if (!state.cards.length) return;

    buildDock(); buildCallouts();
    setupCard(); setupSwipe(); setupSheet(); setupParallax();
    let rt = 0;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!isOpen) return;
        layout();
        if (Math.abs(LY.cw - motesCW) > 2) { buildMotes(); targetCache = null; }
        const [W] = skySize();
        if (Math.abs(W - sceneW) > 40) buildScene();
      }, 160);
    });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { if (isOpen) layout(); });
  }

  C.detail = { init, open, close, prewarm, listFor };
})();

