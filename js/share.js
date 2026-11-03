/* ==========================================================
   Card Battle Infinity — Share (step 9) · shared by the Tier Maker now and the Deck builder in step 10
   · Save as image  — the list is redrawn with the Canvas API (not a screenshot of the page), so it is sharp and
                      looks the same on every device · rarity frames, watermark, wide lists wrap to several lines
   · Share link     — the list is packed into the URL hash (deflate-raw through CompressionStream, then base64url).
                      Nothing is uploaded. #tier/s/<data> opens a view-only copy with a "Save a copy" button
   · Backup         — Export / Import everything as one .json file (tier lists, grades, decks)
   Loaded after app.js and before the page scripts. The dialogs use C.dialog (made in js/tiermaker.js).

   API (window.CBI.share)
     imageDialog(spec, { flashEl })     preview + save a tier list board as PNG (JPEG with captions)    (spec: see tierImage)
     deckImageDialog(spec, { flashEl }) same for a deck (step 10)                   (spec: see deckImage)
     previewDialog({ title, render, flashEl })   same dialog for any renderer returning { blob, width, height, filename }
     makeLink(route, payload)           -> Promise<url>        route = "tier" | "deck"  (url hash: #<route>/s/<data>)
     readLink(data)                     -> Promise<{ payload } | { error: "browser" } | null>
     linkDialog({ url, title, flashEl, what })   what = "list" (default) | "deck"
     backupDialog()                     Export / Import dialog
     provide(id, provider)              a page registers what goes into the backup file:
                                        { label, kind: "array"|"object", get(), count(data), noun(n), apply(data, "merge"|"replace") -> changed }
     icons                              small SVG strings (download, upload, link, image, share, check, archive)
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const APP = "card-battle-infinity";
  const BACKUP_VERSION = 1;
  const LINK_MAX = 24000;            // longest hash we will try to open
  const JSON_MAX = 200000;           // largest unpacked link payload
  const FILE_MAX = 5 * 1024 * 1024;  // largest backup file we will read
  const MAX_PIXELS = 16000000;       // phones refuse bigger canvases (iOS Safari: ~16.7M pixels)
  const MAX_SIDE = 16000;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const slug = (s, fallback = "tier-list") => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const siteUrl = () => { const c = document.querySelector('link[rel="canonical"]'); return (c && c.href) || location.origin + location.pathname; };
  const siteLabel = () => siteUrl().replace(/^https?:\/\//, "").replace(/\/$/, "");

  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    image: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    archive: svg('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
  };

  /* ==========================================================
     Small tools: copy, download, share sheet
     ========================================================== */
  async function copyText(text, inputEl) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch {}
    try {                                                    // older browsers / http: select + execCommand
      const el = inputEl || Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
      if (!inputEl) { el.style.cssText = "position:fixed;opacity:0;left:-9999px;top:0"; document.body.appendChild(el); }
      el.focus(); el.select();
      if (el.setSelectionRange) el.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      if (!inputEl) el.remove();
      return ok;
    } catch { return false; }
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* Phones and tablets get the share sheet (Save Image, Messages, LINE...); computers just download */
  async function deliver(blob, filename, title) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (!fine.matches && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title }); return "shared"; }
        catch (e) { if (e && e.name === "AbortError") return "cancelled"; }   // anything else: fall back to a download
      }
    } catch {}
    download(blob, filename);
    return "downloaded";
  }

  /* ==========================================================
     Share link: JSON -> deflate-raw -> base64url  ("z" + data), or plain base64url ("p" + data) without CompressionStream
     ========================================================== */
  const b64u = {
    enc(bytes) {
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    dec(str) {
      const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    },
  };
  const canZip = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

  // run bytes through a (De)CompressionStream; `limit` stops a link that unpacks to something huge
  async function pipe(bytes, stream, limit) {
    const w = stream.writable.getWriter();
    w.write(bytes).catch(() => {});
    w.close().catch(() => {});
    const r = stream.readable.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      total += value.length;
      if (limit && total > limit) { r.cancel().catch(() => {}); throw new Error("too big"); }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let o = 0;
    chunks.forEach((c) => { out.set(c, o); o += c.length; });
    return out;
  }

  async function pack(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (canZip()) {
      try { return "z" + b64u.enc(await pipe(bytes, new CompressionStream("deflate-raw"))); } catch {}
    }
    return "p" + b64u.enc(bytes);
  }

  async function makeLink(route, payload) {
    const data = await pack(payload);
    return `${location.origin}${location.pathname}#${route}/s/${data}`;
  }

  async function readLink(data) {
    if (typeof data !== "string" || data.length < 2 || data.length > LINK_MAX || !/^[zp][A-Za-z0-9_-]+$/.test(data)) return null;
    try {
      let bytes = b64u.dec(data.slice(1));
      if (data[0] === "z") {
        if (!canZip()) return { error: "browser" };
        bytes = await pipe(bytes, new DecompressionStream("deflate-raw"), JSON_MAX);
      } else if (bytes.length > JSON_MAX) return null;
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      return obj && typeof obj === "object" && !Array.isArray(obj) ? { payload: obj } : null;
    } catch { return null; }
  }

  /* ==========================================================
     Image: the tier list board, drawn with Canvas
     spec = { id, title, type: "card"|"support", rarity: name, rows: [{ label, color: "--t-ss", items: [id, ...] }], captions }
     captions: true = the Global Tier List's picture (plan 2026-10-30 item 3): narrower (1080), 5 bigger cards a line, the full
     name written under each card (wrapped, never cut) so it reads on a phone, and ▲▼ where the tier moved (C.tierMove)
     ========================================================== */
  const BOARD = {
    W: 1200, PAD: 28, LABEL: 132, GAP: 10, ROW_PAD: 12, ROW_GAP: 10, R: 16,
    CARD_W: 114, CARD_H: 160, HEAD: 150, FOOT: 96, MIN_ROW: 100,
  };
  // captions (Global): W 1080 · 5 a line · names 26px (2 lines; 3 at 22px for a long one) under the card
  const CAPS = { W: 1080, LABEL: 112, GAP: 14, PER_LINE: 5, CAP_GAP: 8, CAP: 26, CAP_MIN: 22, CAP_LINES: 3 };

  // Rarity colours for the parts around the cards (rarity ribbon of the image).
  // Game cards themselves (support too since 2026-10-30) are drawn by drawGameCard() from gcSpec() (step 13). Tokens are read from tokens.css.
  const stopsOf = (token) => cssVar(token).match(/#[0-9a-f]{3,8}/gi) || [];
  function frameSpec(rarity) {
    return { ...rarityFrame(rarity), kind: "card", rarity: rarity || "Normal" };
  }
  function rarityFrame(rarity) {
    const t = cssVar;
    const metal = (a, b) => [[0, a], [0.3, b], [0.5, a], [0.7, b], [1, a]];   // linear-gradient(135deg, a, b 30%, a 50%, b 70%, a)
    switch (rarity) {
      case "Shiny": return { stops: metal(t("--r-shiny"), t("--r-shiny-2")), glow: "rgba(236, 199, 104, .38)", orn: t("--r-shiny"), line: t("--r-shiny") };
      case "Rainbow": return { conic: stopsOf("--r-rainbow"), glow: "rgba(200, 140, 220, .4)", orn: "#fff1e0", line: "#f0b6d0" };
      case "Secret": return { stops: [[0, "#e0485e"], [0.35, "#120206"], [0.5, "#4a0c17"], [0.65, "#120206"], [1, "#e0485e"]], glow: "rgba(201, 52, 75, .55)", body: "#14040a", orn: "#e0485e", line: t("--r-secret") };
      case "Divine": return { stops: [[0, "#fffdf4"], [0.5, "#e2bd6c"], [1, "#fffdf4"]], glow: "rgba(255, 226, 160, .55)", orn: "#f2d488", line: t("--r-divine") };
      case "Cosmic": return { conic: [t("--r-cosmic"), t("--r-cosmic-2"), "#14184a", t("--r-cosmic")], glow: "rgba(120, 100, 255, .45)", orn: "#c9c0ff", line: "#a796ff" };
      case "Ascended": return { conic: stopsOf("--r-ascended"), glow: "rgba(220, 210, 255, .55)", orn: "#fffaf0", line: "#f4ecff" };
      case "Godlike": return { stops: metal(t("--r-godlike"), t("--r-godlike-2")), glow: "rgba(255, 228, 150, .6)", orn: t("--r-godlike"), line: t("--r-godlike") };
      case "Godly": return { stops: [[0, t("--r-godly-2")], [0.5, t("--r-godly")], [1, t("--r-godly-2")]], glow: "rgba(240, 120, 150, .5)", orn: t("--r-godly-2"), line: t("--r-godly") };
      default: return { stops: metal(t("--r-normal"), t("--r-normal-2")), glow: null, orn: t("--r-normal"), line: t("--r-normal") };
    }
  }
  const evenStops = (cols) => cols.map((c, i) => [i / (cols.length - 1), c]);
  const specColors = (s) => (s.conic ? s.conic : s.stops.map((x) => x[1]));

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  }

  // CSS "linear-gradient(135deg, ...)" on a w x h box
  function lin135(ctx, x, y, w, h, stops) {
    const k = Math.SQRT1_2, len = (w + h) * k;
    const cx = x + w / 2, cy = y + h / 2, dx = k * len / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dx, cx + dx, cy + dx);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  // CSS color-mix(in srgb, a t, b) for two hex colours (tier plates)
  function mix(a, b, t) {
    const rgb = (c) => {
      let h = String(c || "").trim().replace("#", "");
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h.slice(0, 6), 16);
      return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [140, 143, 165];
    };
    const A = rgb(a), B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(", ")})`;
  }
  // a flat gradient across a pill / bar for specs that are conic in the card frame
  function flatFill(ctx, x, y, w, spec) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    evenStops(specColors(spec)).forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s.trimEnd() + "…";
  }
  // word wrap; a word wider than the line is broken by characters
  function wrapText(ctx, text, maxW) {
    const lines = [];
    let line = "";
    const push = (s) => { if (s) lines.push(s); };
    String(text).split(/\s+/).filter(Boolean).forEach((word) => {
      const tryLine = line ? line + " " + word : word;
      if (ctx.measureText(tryLine).width <= maxW) { line = tryLine; return; }
      push(line); line = "";
      if (ctx.measureText(word).width <= maxW) { line = word; return; }
      let part = "";
      for (const ch of word) {
        if (ctx.measureText(part + ch).width > maxW && part) { push(part); part = ""; }
        part += ch;
      }
      line = part;
    });
    push(line);
    return lines;
  }

  function loadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      try { if (new URL(src, location.href).origin !== location.origin) img.crossOrigin = "anonymous"; } catch {}
      const t = setTimeout(() => resolve(null), 10000);
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = src;
    });
  }
  async function fontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    const wait = new Promise((r) => setTimeout(r, 2500));
    try {
      await Promise.race([Promise.all([
        document.fonts.load('700 20px "Cinzel"'), document.fonts.load('600 14px "Cinzel"'),
        document.fonts.load('500 14px Inter'), document.fonts.load('700 20px "Oswald"'), document.fonts.load('600 20px "Oswald"'), document.fonts.load('20px "Bangers"'),
        document.fonts.load('20px "Anton"'), document.fonts.load('italic 800 20px "Barlow Condensed"'), document.fonts.ready,   // redrawn cards: numbers / pills / ability name + the card name
      ]), wait]);
    } catch {}
  }
  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  /* Same generated art as the page shows for a card without an image (see C.placeholderArt in app.js):
     jewel-tone gradient + gothic arch window + initials (step 9.6b) */
  const ART_HUES = [222, 260, 330, 350, 200, 160, 30];
  function drawPlaceholder(ctx, x, y, w, h, item, fonts) {
    const hue = ART_HUES[C.hash(item.id) % ART_HUES.length], hue2 = (hue + 40) % 360;
    const sx = w / 100, sy = h / 140;
    const P = (px, py) => [x + px * sx, y + py * sy];
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `hsl(${hue}, 45%, 24%)`); g.addColorStop(1, `hsl(${hue2}, 40%, 8%)`);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const rg = ctx.createRadialGradient(...P(50, 56), 0, ...P(50, 56), 44 * sx);
    rg.addColorStop(0, "hsla(42, 90%, 75%, .45)"); rg.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
    // arch window: M28 104 V52 a22 22 0 0 1 44 0 V104 z
    const arch = (l, r, top) => {
      const rad = ((r - l) / 2) * sx, [cx, cy] = P((l + r) / 2, top);
      ctx.beginPath(); ctx.moveTo(...P(l, 104)); ctx.lineTo(...P(l, top));
      ctx.ellipse(cx, cy, rad, rad * (sy / sx), 0, Math.PI, 0); ctx.lineTo(...P(r, 104)); ctx.closePath();
    };
    arch(28, 72, 52);
    ctx.fillStyle = `hsla(${hue}, 40%, 12%, .55)`; ctx.fill();
    ctx.strokeStyle = "hsla(42, 70%, 70%, .55)"; ctx.lineWidth = sx; ctx.stroke();
    arch(33, 67, 54);
    ctx.strokeStyle = "hsla(42, 70%, 70%, .25)"; ctx.lineWidth = 0.7 * sx; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...P(50, 37)); ctx.lineTo(...P(50, 104)); ctx.moveTo(...P(33, 72)); ctx.lineTo(...P(67, 72)); ctx.stroke();
    const initials = String(item.name).split(/\s+/).map((s) => s[0] || "").join("").slice(0, 2).toUpperCase();
    ctx.fillStyle = "hsla(42, 80%, 88%, .92)";
    ctx.font = `700 ${17 * sx}px ${fonts.display}`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(initials, ...P(50, 76));
    ctx.textAlign = "left";
  }
  /* Victorian corner ornament (same path as --orn-* in tokens.css), drawn in a size × size box at a corner */
  const ORN = typeof Path2D === "function" ? [new Path2D("M2 31V13Q2 2 13 2H31"), new Path2D("M7 31V17Q7 7 17 7H31"), new Path2D("M12.5 12.5c3.6-2.4 7.4.2 6 3.6-1.1 2.7-5.3 2.2-4.6-.9")] : null;
  function drawOrnaments(ctx, x, y, w, h, size, color) {
    if (!ORN) return;
    const k = size / 32;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([ox, oy, fx, fy]) => {
      ctx.save();
      ctx.translate(ox, oy); ctx.scale(fx * k, fy * k);
      ctx.strokeStyle = color; ctx.lineCap = "round";
      ctx.lineWidth = 1.7; ctx.stroke(ORN[0]);
      ctx.lineWidth = 0.9; ctx.stroke(ORN[1]);
      ctx.lineWidth = 1.7; ctx.stroke(ORN[2]);
      ctx.beginPath(); ctx.arc(4.6, 4.6, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.restore();
    });
  }
  function drawCoverImage(ctx, img, x, y, w, h) {
    const ir = img.naturalWidth / img.naturalHeight, br = w / h;
    let sw, sh, sx, sy;
    if (ir > br) { sh = img.naturalHeight; sw = sh * br; sx = (img.naturalWidth - sw) / 2; sy = 0; }
    else { sw = img.naturalWidth; sh = sw / br; sx = 0; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  /* Support (2026-10-28): the level values where the picture's numbers were erased (same spots as js/app.js supNumsHTML ·
     effect.pos in % of the picture width) · white Oswald (--gc-sv, like the game's text) with a dark outline, squeezed to the old number's room */
  function drawSupNums(ctx, item, img, x, y, w, h, rarity) {
    const pos = item && item.effect && Array.isArray(item.effect.pos) ? item.effect.pos : [];
    if (!pos.length || !C.supVals) return;
    const ir = img.naturalWidth / img.naturalHeight, br = w / h;
    const pw = ir > br ? h * ir : w, ox = x - (pw - w) / 2, oy = y - (pw / ir - h) / 2, u = pw / 100;   // the cover crop
    const font = getComputedStyle(document.documentElement).getPropertyValue("--gc-font-text").trim() || "sans-serif";
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
    pos.forEach((p) => {
      const b = C.supVals(item)[p.i]; if (b == null) return;
      const t = C.supValAt(item, p.i, rarity) + "%", fs = (p.h / 0.78) * u;
      ctx.font = `600 ${fs}px ${font}`;
      const room = (p.w + 0.6 * Math.min(p.gl || 0, p.gr || 0)) * u, tw = ctx.measureText(t).width, sx = tw > room ? room / tw : 1;
      ctx.save();
      ctx.translate(ox + (p.x + p.w / 2) * u, oy + (p.y + p.h) * u); ctx.scale(sx, 1);
      ctx.lineWidth = fs * 0.15; ctx.strokeStyle = cssVar("--gc-sv-line") || "#050505"; ctx.strokeText(t, 0, 0);
      ctx.fillStyle = cssVar("--gc-sv") || "#f0f0f2"; ctx.fillText(t, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  /* Card text drawn by the web (owner 2026-10-30 · cleanArt · same layout as js/app.js fitText / .gc__ab in css/fx.css):
     a light fade, the ability name + text at the bottom, numbers gold · the card name is in the picture (owner 2026-10-31) */
  function drawCardText(ctx, x, y, w, h, item, rarity, u) {
    const sup = C.isSupport(item), cs = (n) => cssVar(n);
    const pop = cs("--gc-font-pop") || "sans-serif", txt = cs("--gc-font-text") || "sans-serif";
    ctx.save();
    roundRect(ctx, x, y, w, h, 3.7 * u); ctx.clip();
    const scrim = cs("--gc-scrim") || "rgba(5, 4, 10, .6)", clear = "rgba(0, 0, 0, 0)";
    const bh = 71.7 * u, by = y + h - bh, lg = ctx.createLinearGradient(0, by, 0, y + h);
    [[0, clear], [0.24, scrim], [sup ? 0.5 : 0.62, scrim], [sup ? 0.76 : 0.94, clear]].forEach(([o, c]) => lg.addColorStop(o, c));
    ctx.fillStyle = lg; ctx.fillRect(x, by, w, bh);
    // one line: squeeze to 82%, then smaller (fitLine in js/app.js)
    const line = (text, size, room, tx, ty, paint) => {
      ctx.font = `400 ${size * u}px ${pop}`;
      const need = ctx.measureText(text).width; let sx = 1;
      if (need > room * u) { sx = Math.max(0.82, room * u / need); if (need * sx > room * u) { size = size * room * u / (need * sx) * 0.98; ctx.font = `400 ${size * u}px ${pop}`; } }
      ctx.save(); ctx.translate(tx, ty); ctx.scale(sx, 1); paint(text, size); ctx.restore();
      return size;
    };
    ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.lineJoin = "round";
    const ab = sup ? item.effect || {} : (item.passive && item.passive.name ? item.passive : item.skill) || {};
    const top = y + 78 * u;
    let used = 0;
    if (ab.name) {
      const s = line(ab.name, 7.3, 90, x + 5 * u, top, (t, s) => {
        ctx.fillStyle = cs("--gc-text-shade") || "#000"; ctx.fillText(t, 0, 0.5 * u);
        const g = ctx.createLinearGradient(0, 0, 0, s * u); g.addColorStop(0, "#f6d3ff"); g.addColorStop(1, "#c06bff");
        ctx.fillStyle = g; ctx.fillText(t, 0, 0);
      });
      used = s * 1.05 + 1.6;
    }
    // ability text: words (numbers bold gold) wrapped in 90u, font from 5u down until it fits
    const words = [];
    I18N.desc(sup && C.mutText ? C.mutText(item, ab.desc, rarity) : String(ab.desc || "")).split(/(\{\d\}%?|[+-]?\d+(?:[.,]\d+)*(?:%|x)?(?![\dA-Za-z]))/).forEach((part, i) => {
      if (i % 2) { const m = /^\{(\d)\}(%?)$/.exec(part); words.push([m && sup ? C.supValAt(item, +m[1], rarity) + m[2] : part, true, true]); return; }
      part.split(/(\s+)/).forEach((p) => { if (/^\s+$/.test(p)) words.push([" ", false, false]); else if (p) words.push([p, false, true]); });
    });
    const room = (sup ? 37 : 42.3) - used;
    const layout = (fs) => {
      const rows = [[]]; let xw = 0;
      const sp = (ctx.font = `500 ${fs * u}px ${txt}`, ctx.measureText(" ").width);
      // glue: a number right after a word with no space stays on that word's line
      let pend = 0;
      words.forEach(([t, bold, solid]) => {
        if (!solid) { pend = sp; return; }
        ctx.font = `${bold ? 700 : 500} ${fs * u}px ${txt}`;
        const tw = ctx.measureText(t).width;
        if (xw > 0 && pend && xw + pend + tw > 90 * 0.98 * u) { rows.push([]); xw = 0; pend = 0; }
        rows[rows.length - 1].push([t, bold, xw + (xw > 0 ? pend : 0)]); xw += (xw > 0 ? pend : 0) + tw; pend = 0;
      });
      return rows;
    };
    let fs = 5, rows = layout(fs);
    while (fs > 2.2 && rows.length * fs * 1.32 > room) { fs = Math.round((fs - 0.1) * 100) / 100; rows = layout(fs); }
    rows.forEach((row, ri) => row.forEach(([t, bold, ox]) => {
      ctx.font = `${bold ? 700 : 500} ${fs * u}px ${txt}`;
      const ty = top + (used + ri * fs * 1.32 + fs * 0.16) * u;
      ctx.fillStyle = cs("--gc-text-shade") || "#000"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 0.9 * u; ctx.fillText(t, x + 5 * u + ox, ty + 0.17 * u); ctx.shadowBlur = 0;
      ctx.fillStyle = bold ? cs("--gc-text-num") || "#eee" : cs("--gc-text") || "#eee"; ctx.fillText(t, x + 5 * u + ox, ty);
    }));
    ctx.restore();
  }

  /* ==========================================================
     Game card (step 13, §3.5): same look as .gc in css/fx.css. The picture fills the card; HP, the 1 IN X pill,
     the rarity pill and ATK are drawn on top at the game's spots (u = 1% of the card width, like cqw).
     Colours come from the --gc-* tokens. If a frame changes in css/fx.css, change gcSpec() too.
     ========================================================== */
  // "linear-gradient(135deg, #a, #b 30%, #c)" -> [[0, "#a"], [0.3, "#b"], [1, "#c"]] (stops without a % are spread evenly)
  function gradStops(str) {
    const m = [...String(str).matchAll(/(#[0-9a-f]{3,8})(?:\s+([\d.]+)%)?/gi)].map((x) => [x[2] != null ? Number(x[2]) / 100 : null, x[1]]);
    if (!m.length) return [[0, "#888"], [1, "#888"]];
    if (m[0][0] == null) m[0][0] = 0;
    if (m[m.length - 1][0] == null) m[m.length - 1][0] = 1;
    for (let i = 1; i < m.length - 1; i++) if (m[i][0] == null) {
      let j = i; while (m[j][0] == null) j++;
      const a = m[i - 1][0], b = m[j][0];
      for (let q = i; q < j; q++) m[q][0] = a + (b - a) * (q - i + 1) / (j - i + 1);
    }
    return m;
  }
  function gcSpec(rarity) {
    const r = String(rarity || "Normal").toLowerCase(), g = (n) => cssVar(n);
    const S = {
      shiny: { ring: 2.2, fill: "--gc-ring-shiny" }, rainbow: { ring: 2.4, conic: "--r-rainbow" }, secret: { ring: 2.4, fill: "--gc-ring-secret", ink: "--gc-rar-secret-ink" },
      divine: { ring: 2.4, fill: "--gc-ring-divine" }, cosmic: { ring: 2.4, conic: "--gc-ring-cosmic" }, ascended: { ring: 2.6, conic: "--r-ascended" },
      godlike: { ring: 2.4, fill: "--gc-ring-godlike", ink: "--gc-rar-godlike-ink", flat: true }, godly: { ring: 2.6, fill: "--gc-ring-godly", ink: "--gc-rar-godly-ink", flat: true },
    }[r];
    if (!S) return { normal: true };
    return { ...S, glow: g("--gc-glow-" + r), pill: g("--gc-rar-" + r), line: g("--gc-rar-" + r + "-line") || "#111", ink: S.ink ? g(S.ink) : "#fff" };
  }
  // a number / pill text shrunk to fit its room (same rule as fitNum in js/app.js)
  function fitFont(ctx, text, size, room, font) {
    ctx.font = `${font.replace("{s}", size)}`;
    const wv = ctx.measureText(text).width;
    if (wv > room) { size = size * room / wv * 0.97; ctx.font = `${font.replace("{s}", size)}`; }
    return size;
  }
  /* ==========================================================
     Redrawn card (owner 2026-11-02 · "redraw": true · same look as css/fx.css .gc--rd): the erased picture inside a
     1.7u frame in the rarity's sampled colours, then every text the web writes · sizes come from C.redrawEl (the page's own
     fit, read off an offscreen copy) so the image matches the card on screen · f = 1% of the face width (like the face's cqw)
     ========================================================== */
  // CSS linear-gradient(<deg>, …) over a box
  function linDeg(ctx, x, y, w, h, deg, stops) {
    const a = deg * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), len = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = x + w / 2, cy = y + h / 2, g = ctx.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  const degOf = (str, def = 180) => { const m = /(-?[\d.]+)deg/.exec(String(str)); return m ? Number(m[1]) : def; };
  const gradOn = (ctx, token, x, y, w, h) => { const v = cssVar(token); return /gradient/.test(v) ? linDeg(ctx, x, y, w, h, degOf(v), gradStops(v)) : v || "#fff"; };
  function drawRedraw(ctx, x, y, w, h, item, rarity, art, k, nums) {
    const u = w / 100, R = 3.7 * u, r = String(rarity || "Normal").toLowerCase(), sup = C.isSupport(item);
    const fx = x + 1.7 * u, fy = y + 1.7 * u, fw = w - 3.4 * u, fh = h - 3.4 * u, f = fw / 100, FH = fh / f;
    const el = C.redrawEl(item, rarity, nums || {}), q = (s) => el.querySelector(s);
    const fsOf = (n, d) => (n && parseFloat(n.style.fontSize)) || d;
    const A = cssVar("--rd-font") || "sans-serif", T = cssVar("--rd-font-text") || "sans-serif", N = cssVar("--rd-font-name") || T, stroke = cssVar("--rd-stroke") || "#07050a";
    const LS = "letterSpacing" in ctx, K = k || 1;   // the text shows at every size, like the page · shadows are in device px (× k)
    // glow + frame + picture
    ctx.save();
    roundRect(ctx, x, y, w, h, R);
    ctx.shadowColor = cssVar("--rd-glow-" + r) || "rgba(0, 0, 0, .5)"; ctx.shadowBlur = 10 * u * K;
    ctx.fillStyle = gradOn(ctx, "--rd-ring-" + r, x, y, w, h); ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, fx, fy, fw, fh, 3.2 * f); ctx.clip();
    ctx.fillStyle = cssVar("--gc-under") || "#0d0a14"; ctx.fillRect(fx, fy, fw, fh);
    if (art) drawCoverImage(ctx, art, fx - fw * 0.006, fy - fh * 0.006, fw * 1.012, fh * 1.012);
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, R); ctx.lineWidth = 0.35 * u; ctx.strokeStyle = "rgba(0, 0, 0, .6)"; ctx.stroke();
    roundRect(ctx, fx, fy, fw, fh, 3.2 * f); ctx.lineWidth = 0.4 * u; ctx.strokeStyle = "rgba(0, 0, 0, .55)"; ctx.stroke();
    ctx.restore();

    ctx.save();
    roundRect(ctx, fx, fy, fw, fh, 3.2 * f); ctx.clip();
    ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
    const X = (v) => fx + v * f, Y = (v) => fy + v * f;
    // one outlined word / line: black edge + soft shadow under it, then the fill (a colour or a gradient over its box)
    const edge = (t, tx, ty) => {
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.5 * f;
      ctx.shadowColor = "rgba(0, 0, 0, .85)"; ctx.shadowBlur = 1.6 * f * K; ctx.strokeText(t, tx, ty);
      ctx.shadowColor = "rgba(0, 0, 0, .45)"; ctx.shadowBlur = 3.2 * f * K; ctx.strokeText(t, tx, ty);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    };
    const out = (t, tx, ty, fill, font, ls = 0, align = "left") => {
      ctx.font = font; ctx.textAlign = align;
      if (LS) ctx.letterSpacing = ls ? ls + "px" : "0px";
      edge(t, tx, ty); ctx.fillStyle = fill; ctx.fillText(t, tx, ty);
    };
    const tw = (t, font, ls = 0) => { ctx.font = font; if (LS) ctx.letterSpacing = ls ? ls + "px" : "0px"; return ctx.measureText(t).width; };
    // greedy word wrap at `room` px (a support's text) · balance = the narrowest width with the same line count (a card's text)
    const wrap = (words, font, room, balance) => {
      const lay = (rw) => {
        const rows = [[]]; let xw = 0; ctx.font = font; if (LS) ctx.letterSpacing = "0px";
        const sp = ctx.measureText(" ").width;
        words.forEach((wd) => { const ww = ctx.measureText(wd.t).width; if (xw > 0 && xw + sp + ww > rw) { rows.push([]); xw = 0; } rows[rows.length - 1].push(wd); xw += (xw > 0 ? sp : 0) + ww; });
        return rows;
      };
      let rows = lay(room);
      if (balance && rows.length > 1) {
        let lo = room / rows.length, hi = room;
        for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (lay(m).length > rows.length) lo = m; else hi = m; }
        rows = lay(hi);
      }
      return rows;
    };
    // words of a text node list: [{ t, gold }] (gold = inside <b>)
    // a gold number written right against a word ("(5%") stays one word with it
    const wordsIn = (node) => {
      const list = [];
      let space = true;
      node.childNodes.forEach((n) => String(n.textContent).split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { space = true; return; }
        const part = { t, gold: n.nodeType === 1 };
        if (!space && list.length) { const last = list[list.length - 1]; last.parts.push(part); last.t += t; }
        else list.push({ t, parts: [part] });
        space = false;
      }));
      return list;
    };
    const drawRows = (rows, font, fs, lh, base, cx, ink) => {
      ctx.font = font; if (LS) ctx.letterSpacing = "0px";
      const sp = ctx.measureText(" ").width;
      rows.forEach((row, ri) => {
        const ws = row.map((wd) => ctx.measureText(wd.t).width), total = ws.reduce((a, b) => a + b, 0) + sp * (row.length - 1);
        let px = cx - total / 2;
        const py = base + ri * lh * fs * f;
        row.forEach((wd, wi) => {
          wd.parts.forEach((p) => { ctx.textAlign = "left"; edge(p.t, px, py); ctx.fillStyle = p.gold ? cssVar("--rd-num") || "#ffcf5a" : ink; ctx.fillText(p.t, px, py); px += ctx.measureText(p.t).width; });
          px += wi < row.length - 1 ? sp : 0;
        });
      });
    };
    const ink = cssVar("--rd-ink") || "#f4f1f6";
    const nameFill = (bx, by, bw, bh) => linDeg(ctx, bx, by, bw, bh, degOf(cssVar("--rd-name-" + r), 90), gradStops(cssVar("--rd-name-" + r)));

    // name (left half · 1 or 2 lines)
    const nm = q(".rd__nm"), nfs = fsOf(nm, 10), two = nm.classList.contains("is-two"), up = nm.textContent.toUpperCase();
    const nfont = `italic 800 ${nfs * f}px ${N}`, nls = 0.02 * nfs * f;
    const nrows = two ? wrap(up.split(/\s+/).filter(Boolean).map((t) => ({ t, parts: [{ t }] })), nfont, 43.7 * f, false).map((row) => row.map((x) => x.t).join(" ")) : [up];
    const nlh = two ? (sup ? 1.02 : 0.98) : 1;
    let nTop;
    if (sup) nTop = parseFloat(q(".rd__top").style.top) || 6;
    else nTop = 3 + 6.25 - (nrows.length * nlh * nfs + 0.6) / 2 + 0.4;
    const nBase0 = nTop + ((nlh - 1.2) / 2 + 1) * nfs;   // Barlow Condensed: ascent 1 + descent .2 in a line box nlh tall
    const nW = Math.max(...nrows.map((t) => tw(t, nfont, nls)));
    nrows.forEach((t, i) => out(t, X(3.6 + 0.6), Y(nBase0 + i * nlh * nfs), nameFill(X(3.6), Y(nTop), nW + 1.2 * f, nrows.length * nlh * nfs * f), nfont, nls));

    // pills (odds + rarity) at the top right
    let pTop = 17;
    el.querySelectorAll(".rd__pill").forEach((p) => {
      const rar = p.classList.contains("rd__pill--rar");
      if (rar && r === "normal") return;
      const pfs = fsOf(p, 5.6), font = `400 ${pfs * f}px ${A}`, ls = 0.03 * pfs * f, t = p.textContent.toUpperCase();
      const pw = tw(t, font, ls) + 5.2 * f, ph = 7.4 * f, px = X(96.4) - pw, py = Y(pTop);
      ctx.save();
      roundRect(ctx, px, py, pw, ph, ph / 2);
      ctx.shadowColor = "rgba(0, 0, 0, .45)"; ctx.shadowBlur = 2 * f * K; ctx.shadowOffsetY = 0.6 * f * K;
      ctx.fillStyle = rar ? gradOn(ctx, "--rd-pill-" + r, px, py, pw, ph) : cssVar("--rd-pill") || "#fff"; ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 1.1 * f; ctx.strokeStyle = cssVar("--rd-pill-line") || "#0b0b0d"; ctx.stroke();
      roundRect(ctx, px + (rar ? 0.45 : 0.55) * f, py + (rar ? 0.45 : 0.55) * f, pw - (rar ? 0.9 : 1.1) * f, ph - (rar ? 0.9 : 1.1) * f, ph / 2);
      ctx.lineWidth = (rar ? 0.45 : 0.55) * f; ctx.strokeStyle = rar ? "rgba(255, 255, 255, .35)" : cssVar("--rd-pill-inner") || "#c9c9cf"; ctx.stroke();
      ctx.font = font; if (LS) ctx.letterSpacing = ls + "px"; ctx.textAlign = "center";
      ctx.fillStyle = rar ? cssVar("--rd-pill-ink-" + r) || "#111" : cssVar("--rd-pill-ink") || "#111";
      ctx.fillText(t, px + pw / 2 + ls / 2, py + ((7.4 - pfs) / 2 + 0.925 * pfs) * f);
      ctx.restore();
      pTop += 7.4 + 1.6;
    });

    // ability name + text
    const abn = q(".rd__abn"), afs = fsOf(abn, sup ? 7.5 : 7.2), afont = `400 ${afs * f}px ${A}`, als = 0.02 * afs * f;
    const abd = q(".rd__abd"), dfs = fsOf(abd, sup ? 4.57 : 5), dfont = `500 ${dfs * f}px ${T}`;
    const dwords = abd ? wordsIn(abd) : [];
    if (!sup) {
      const rows = wrap(dwords, dfont, 91.6 * f, true);
      const blockH = (abn ? afs + 0.6 + 1.2 : 0) + rows.length * dfs * 1.16, top = FH - 17.5 - blockH;
      if (abn) { const t = abn.textContent.toUpperCase(); out(t, X(4.2 + 0.5), Y(top + 0.3 + 0.925 * afs), linDeg(ctx, X(4.2), Y(top), tw(t, afont, als) + f, (afs + 0.6) * f, 180, gradStops(cssVar("--rd-ab"))), afont, als); }
      drawRows(rows, dfont, dfs, 1.16, Y(top + (abn ? afs + 0.6 + 1.2 : 0) + 1.03 * dfs), X(50), ink);
      // HP + heart (top right) · swords + ATK (bottom)
      const hp = q('[data-k="hp"]'), hfs = fsOf(hp, 10), hfont = `400 ${hfs * f}px ${A}`, ht = hp.textContent;
      const hy = 3 + 6.25 - (hfs + 0.6) / 2, hw = tw(ht, hfont);
      out(ht, X(96.4 - 9.6 - 1.2 - 0.3) - hw, Y(hy + 0.3 + 0.925 * hfs), linDeg(ctx, X(96.4 - 10.8) - hw, Y(hy), hw, (hfs + 0.6) * f, 180, gradStops(cssVar("--rd-hp"))), hfont);
      drawHeart(ctx, X(96.4 - 9.6), Y(9.25 - 4.8), 9.6 * f, K);
      const at = q('[data-k="atk"]'), tfs = fsOf(at, 12.5), tfont = `400 ${tfs * f}px ${A}`, tt = at.textContent, ty = FH - 3 - 6.25 - (tfs + 0.6) / 2, aw = tw(tt, tfont);
      out(tt, X(50), Y(ty + 0.3 + 0.925 * tfs), linDeg(ctx, X(50) - aw / 2, Y(ty), aw, (tfs + 0.6) * f, 180, gradStops(cssVar("--rd-atk"))), tfont, 0, "center");
      drawSwords(ctx, X(3.6 + 0.25), Y(FH - 3 - 6.25 - 6), 12 * f);
    } else {
      if (abn) { const t = abn.textContent.toUpperCase(), top = parseFloat(abn.style.top) || 79; out(t, X(3.6 + 0.5), Y(top + 0.925 * afs), linDeg(ctx, X(3.6), Y(top), tw(t, afont, als) + f, afs * f, 180, gradStops(cssVar("--rd-ab"))), afont, als); }
      {
        const top = parseFloat(q(".rd__txt").style.top) || 88, room = 92.3 * f;
        const rows = wrap(dwords, dfont, room, false), mut = q(".rd__mut");
        const mrows = mut && !mut.hidden ? wrap(wordsIn(mut), dfont, room, false) : [];
        drawRows(rows.concat(mrows), dfont, dfs, 1.385, Y(top + 1.1425 * dfs), X(50), ink);
      }
      const wfs = 10.3, wfont = `700 ${wfs * f}px ${T}`, wt = parseFloat(q(".rd__sup").style.top) || 124.5, ww = tw("SUPPORT", wfont);
      out("SUPPORT", X(50), Y(wt + 0.95 * wfs), linDeg(ctx, X(50) - ww / 2, Y(wt), ww, wfs * f, 180, gradStops(cssVar("--rd-sup"))), wfont, 0, "center");
    }
    if (LS) ctx.letterSpacing = "0px";
    ctx.restore();
  }
  // the heart / crossed swords of index.html's #rd-heart / #rd-sword (same paths, drawn into a s × s box)
  function drawHeart(ctx, x, y, s, K = 1) {
    ctx.save(); ctx.translate(x, y + s * 0.04); ctx.scale(s / 100, s / 100);   // viewBox 100 × 92 in an s × s box
    ctx.shadowColor = "rgba(0, 0, 0, .6)"; ctx.shadowBlur = s * 0.083 * K; ctx.shadowOffsetY = s * 0.052 * K;
    const p = new Path2D("M50 88 C20 66 4 50 4 29 C4 14 16 4 29 4 C39 4 46 9 50 17 C54 9 61 4 71 4 C84 4 96 14 96 29 C96 50 80 66 50 88 Z");
    const g = ctx.createLinearGradient(0, 0, 0, 92); g.addColorStop(0, "#ff6b6b"); g.addColorStop(0.55, "#e3222c"); g.addColorStop(1, "#a50f1a");
    ctx.fillStyle = g; ctx.fill(p); ctx.shadowColor = "transparent";
    ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a0306"; ctx.stroke(p);
    ctx.save(); ctx.translate(29, 24); ctx.rotate(-Math.PI / 6); ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(255, 255, 255, .75)"; ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function drawSwords(ctx, x, y, s) {
    const lin = (x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const blade = lin(45, 0, 55, 0, [[0, "#ffffff"], [0.5, "#dfe5ee"], [0.51, "#9aa6b8"], [1, "#c3ccd8"]]);
    const gold = lin(0, 63, 0, 96, [[0, "#ffe9a0"], [1, "#c08a2a"]]), grip = lin(45.5, 0, 54.5, 0, [[0, "#e2453f"], [1, "#8e1414"]]);
    [-135, 135].forEach((deg) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
      ctx.translate(50, 50); ctx.rotate(deg * Math.PI / 180); ctx.translate(-50, -50);
      ctx.lineWidth = 2.6; ctx.lineJoin = "round"; ctx.strokeStyle = "#14161c";
      const shape = (p, fill) => { ctx.fillStyle = fill; ctx.fill(p); ctx.stroke(p); };
      shape(new Path2D("M50 4 L55 13 L55 64 L45 64 L45 13 Z"), blade);
      const rr = (a, b, c, d, e) => { const p = new Path2D(); if (p.roundRect) p.roundRect(a, b, c, d, e); else p.rect(a, b, c, d); return p; };
      shape(rr(34, 63, 32, 7, 3.5), gold); shape(rr(45.5, 70, 9, 17, 2), grip);
      const c = new Path2D(); c.arc(50, 91, 5, 0, Math.PI * 2); shape(c, gold);
      ctx.restore();
    });
  }

  // nums (deck image, 2026-11-02) = { atk, hp }: the numbers to show instead of the rarity's (game colours, owner 2026-11-02)
  function drawGameCard(ctx, x, y, w, h, item, rarity, art, k, pal, nums) {
    if (art && C.isRedraw && C.isRedraw(item) && !item.missing) { drawRedraw(ctx, x, y, w, h, item, rarity, art, k, nums); return; }
    const u = w / 100, R = 3.7 * u, sp = gcSpec(rarity);
    const num = cssVar("--gc-font-num"), pop = cssVar("--gc-font-pop");
    // shadow (+ the rarity glow)
    ctx.save();
    roundRect(ctx, x, y, w, h, R);
    ctx.shadowColor = sp.glow || "rgba(0, 0, 0, .5)"; ctx.shadowBlur = (sp.glow ? 16 : 10) * k; ctx.shadowOffsetY = sp.glow ? 0 : 5 * k;
    ctx.fillStyle = cssVar("--gc-under") || "#0d0a14"; ctx.fill();
    ctx.restore();
    // picture (or the generated art + the name, which is normally in the picture)
    ctx.save();
    roundRect(ctx, x, y, w, h, R); ctx.clip();
    if (art) drawCoverImage(ctx, art, x - w * 0.006, y - h * 0.006, w * 1.012, h * 1.012);
    else {
      drawPlaceholder(ctx, x, y, w, h, item, pal);
      ctx.font = `italic 400 ${6.4 * u}px ${pop}`; ctx.textBaseline = "top"; ctx.textAlign = "center"; ctx.lineJoin = "round";
      const nm = fitText(ctx, String(item.name || "").toUpperCase(), 90 * u);
      ctx.lineWidth = 0.9 * u; ctx.strokeStyle = cssVar("--gc-pill-line"); ctx.strokeText(nm, x + w / 2, y + 108.4 * u);
      ctx.fillStyle = "#fff"; ctx.fillText(nm, x + w / 2, y + 108.4 * u); ctx.textAlign = "left";
    }
    // frame ring over the picture's edge (a stroke on the clipped edge: the inner half shows)
    if (!sp.normal) {
      const t = sp.ring * u;
      if (sp.conic && ctx.createConicGradient) {
        const cg = ctx.createConicGradient(-Math.PI / 2, x + w / 2, y + h / 2);
        evenStops(stopsOf(sp.conic)).forEach(([o, c]) => cg.addColorStop(o, c));
        ctx.strokeStyle = cg;
      } else if (!sp.conic && /180deg/.test(cssVar(sp.fill))) {   // top → bottom (Godly) over the ring's 180%-tall box, like css/fx.css
        const vg = ctx.createLinearGradient(0, y - 0.4 * h, 0, y + 1.4 * h);
        gradStops(cssVar(sp.fill)).forEach(([o, c]) => vg.addColorStop(o, c));
        ctx.strokeStyle = vg;
      } else ctx.strokeStyle = lin135(ctx, x, y, w, h, sp.conic ? evenStops(stopsOf(sp.conic)) : gradStops(cssVar(sp.fill)));
      ctx.lineWidth = t * 2; roundRect(ctx, x, y, w, h, R); ctx.stroke();
      ctx.strokeStyle = "rgba(0, 0, 0, .6)"; ctx.lineWidth = 0.4 * u; roundRect(ctx, x + t, y + t, w - 2 * t, h - 2 * t, Math.max(0, R - t)); ctx.stroke();
    }
    ctx.strokeStyle = sp.normal ? "rgba(255, 255, 255, .14)" : "rgba(0, 0, 0, .55)"; ctx.lineWidth = sp.normal ? 1 : 0.7 * u;
    roundRect(ctx, x, y, w, h, R); ctx.stroke();
    ctx.restore();

    // support (2026-10-28): its level values on the picture + the 1 IN X (× the rarity's odds multiplier) and rarity pills · no HP / ATK
    const sup = C.isSupport && C.isSupport(item);
    if (item.missing || (!item.base && !sup)) return;
    const r = rarity || "Normal";
    if (art && item.cleanArt) drawCardText(ctx, x, y, w, h, item, r, u);
    else if (sup && art) drawSupNums(ctx, item, art, x - w * 0.006, y - h * 0.006, w * 1.012, h * 1.012, r);
    ctx.save();
    ctx.lineJoin = "round"; ctx.textBaseline = "middle";
    const numText = (text, cx, cy, align, size, room, fill, line, sw, drop, dropColor) => {
      const s = fitFont(ctx, text, size * u, room * u, `700 {s}px ${num}`);
      ctx.textAlign = align;
      ctx.lineWidth = sw * u; ctx.strokeStyle = dropColor; ctx.fillStyle = dropColor;
      ctx.strokeText(text, cx, cy + drop * u); ctx.fillText(text, cx, cy + drop * u);
      ctx.strokeStyle = line; ctx.strokeText(text, cx, cy);
      ctx.fillStyle = fill; ctx.fillText(text, cx, cy);
      return s;
    };
    // HP: right-aligned, left of the heart · ATK: centred between the swords
    // the game's colours always (owner 2026-11-02: HP green, ATK red, also when the deck raised them)
    const n = nums || {};
    if (!sup) numText(C.fmtHp(n.hp != null ? n.hp : C.statAt(item, "hp", r)), x + 83.2 * u, y + 10.6 * u, "right", 12.4, 43.2,
      cssVar("--gc-hp"), cssVar("--gc-hp-line"), 1.5, 0.5, cssVar("--gc-hp-line"));
    if (!sup) numText(C.fmtStat(n.atk != null ? n.atk : C.statAt(item, "atk", r)), x + 50.25 * u, y + 130.6 * u, "center", 14.2, 57.5,
      cssVar("--gc-atk"), cssVar("--gc-atk-line"), 0.9, 0.35, "rgba(0, 0, 0, .55)");
    // pills (right edge 1.2u in from the card's right side)
    const pill = (text, top, hgt, size, min, bg, line, ink, inner, flat) => {
      const fs = fitFont(ctx, text, size * u, 36.8 * u, `italic 400 {s}px ${pop}`);
      const pw = Math.min(42 * u, Math.max(min * u, ctx.measureText(text).width + 5.2 * u));
      const px = x + w - (1.4 + (sp.normal ? 0 : sp.ring)) * u - pw, py = y + top * u;   // inside the frame, like css/fx.css
      roundRect(ctx, px, py, pw, hgt * u, hgt * u / 2);
      ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = 1.1 * u; ctx.strokeStyle = line; ctx.stroke();
      if (inner) { roundRect(ctx, px + 0.55 * u, py + 0.55 * u, pw - 1.1 * u, hgt * u - 1.1 * u, (hgt * u - 1.1 * u) / 2); ctx.lineWidth = 0.55 * u; ctx.strokeStyle = inner; ctx.stroke(); }
      ctx.textAlign = "center";
      if (!inner && !flat) { ctx.lineWidth = 0.7 * u; ctx.strokeStyle = line; ctx.strokeText(text, px + pw / 2, py + hgt * u / 2 + 0.2 * u); }
      ctx.fillStyle = ink; ctx.fillText(text, px + pw / 2, py + hgt * u / 2 + 0.2 * u);
      return fs;
    };
    const odds = sup ? (Number(item.odds) > 0 ? C.fmtOdds(C.oddsAt(item, r)) : "") : C.fmtOdds(C.oddsAt(item, r));
    if (odds) pill(odds.toUpperCase(), 19.1, 9, 5.8, 23, cssVar("--gc-pill"), cssVar("--gc-pill-line"), cssVar("--gc-pill-ink"), cssVar("--gc-pill-inner"));
    if (!sp.normal) {
      const st = gradStops(sp.pill), across = /90deg/.test(sp.pill);
      const top = y + 30.4 * u, gr = across ? ctx.createLinearGradient(x + 58 * u, 0, x + 99 * u, 0) : ctx.createLinearGradient(0, top, 0, top + 7 * u);
      st.forEach(([o, c]) => gr.addColorStop(o, c));
      pill(r.toUpperCase(), 30.4, 7, 4.9, 17, gr, sp.line, sp.ink, null, sp.flat);
    }
    ctx.restore();
  }

  /* One mini card: the game card (drawGameCard · support too, 2026-10-30), or a dashed slot when it's not in the library.
     item = card / support object, or { missing: true, id } */
  function drawCard(ctx, x, y, w, h, item, spec, art, k, pal, nums) {
    if (!item.missing) { drawGameCard(ctx, x, y, w, h, item, spec.rarity, art, k, pal, nums); return; }
    const R = 8;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, R);
    ctx.fillStyle = pal.glass; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = pal.faint; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = pal.dim; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = `600 12px ${pal.body}`;
    const lines = wrapText(ctx, pretty(item.id), w - 18).slice(0, 3);
    const top = y + h / 2 - (lines.length * 15) / 2;
    lines.forEach((l, i) => ctx.fillText(fitText(ctx, l, w - 18), x + w / 2, top + 11 + i * 15));
    ctx.font = `500 10px ${pal.body}`; ctx.fillStyle = pal.faint;
    ctx.fillText("Not in the library", x + w / 2, y + h - 12);
    ctx.textAlign = "left";
  }

  function libFor(type) {
    const list = type === "support" ? (Array.isArray(state.support) ? state.support : []) : state.cards;
    const map = new Map();
    list.forEach((x) => { if (x && x.id) map.set(x.id, type === "support" ? { ...x, name: x.name || pretty(x.id) } : x); });
    return map;
  }

  /* Parts shared by the tier list image and the deck image (kept as they were, so tier images come out identical) */
  const setSpacing = (ctx, px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; };
  function paintBackdrop(ctx, W, H, pal, seedKey) {
    // background: void gradient + a few stars (same picture for the same list)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, pal.void); bg.addColorStop(1, cssVar("--void-2"));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W * 0.7);
    glow.addColorStop(0, "rgba(255, 230, 180, .10)"); glow.addColorStop(1, "rgba(255, 230, 180, 0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const haze = ctx.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 1.1, Math.max(W, H) * 0.7);
    haze.addColorStop(0, cssVar("--haze") || "#2a1528"); haze.addColorStop(1, "rgba(42, 21, 40, 0)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);
    const rand = rng(C.hash(seedKey));
    const tints = ["255, 255, 255", "243, 230, 200", "255, 212, 138"];
    for (let i = 0, n = Math.round((W * H) / 9000); i < n; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.5;
      ctx.fillStyle = `rgb(${tints[(rand() * tints.length) | 0]})`;
      ctx.beginPath(); ctx.arc(rand() * W, rand() * H, 0.4 + rand() * 1.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // gilded border around the whole picture: gold line + corner ornaments
    ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
    ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
    ctx.globalAlpha = 0.6; drawOrnaments(ctx, 12, 12, W - 24, H - 24, 20, pal.rift); ctx.globalAlpha = 1;
  }
  // rarity tag, top right (like the tag on a card)
  function paintRibbon(ctx, text, pillW, W, PAD, frame, pal) {
      const label = text;
      ctx.font = `700 15px ${pal.display}`; setSpacing(ctx, 1.5);
      const tw = Math.min(pillW, ctx.measureText(label).width + 36);
      const px = W - PAD - tw, py = 32;
      ctx.beginPath();   // ribbon, like the rarity tag on a card
      ctx.moveTo(px, py); ctx.lineTo(px + tw, py); ctx.lineTo(px + tw - 10, py + 17); ctx.lineTo(px + tw, py + 34); ctx.lineTo(px, py + 34); ctx.closePath();
      ctx.fillStyle = flatFill(ctx, px, py, tw, frame); ctx.fill();
      ctx.fillStyle = "#1a1408"; ctx.textAlign = "center";
      ctx.fillText(label, px + tw / 2 - 4, py + 23);
      ctx.textAlign = "left"; setSpacing(ctx, 0);
  }
  function paintFooter(ctx, W, H, FOOT, PAD, pal, title) {
    // footer / watermark: site, link, list name, date
    const fy = H - FOOT + 14;
    ctx.fillStyle = pal.line; ctx.fillRect(PAD, fy, W - PAD * 2, 1);
    ctx.fillStyle = pal.rift; ctx.font = `700 18px ${pal.display}`; setSpacing(ctx, 2);
    ctx.fillText("CARD BATTLE INFINITY", PAD, fy + 38);
    setSpacing(ctx, 0);
    ctx.fillStyle = pal.dim; ctx.font = `500 15px ${pal.body}`;
    ctx.fillText(siteLabel(), PAD, fy + 62);
    ctx.textAlign = "right";
    ctx.font = `600 16px ${pal.display}`; ctx.fillStyle = pal.ink;
    ctx.fillText(fitText(ctx, title, 560), W - PAD, fy + 38);
    ctx.font = `500 15px ${pal.body}`; ctx.fillStyle = pal.dim;
    ctx.fillText(today(), W - PAD, fy + 62);
    ctx.textAlign = "left";
  }

  // a name under its card · owner 2026-11-02: every name in one picture the same size (was smaller for long names):
  // capSize() picks the biggest size at which every name fits (no word split, at most CAP_LINES lines), captionOf() wraps at it
  const CAP_SIZES = [CAPS.CAP, CAPS.CAP - 2, CAPS.CAP_MIN, CAPS.CAP_MIN - 2, CAPS.CAP_MIN - 4];
  function capFits(ctx, name, maxW, size, font) {
    ctx.font = `600 ${size}px ${font}`;
    return wrapText(ctx, name, maxW).length <= CAPS.CAP_LINES && String(name).split(/\s+/).filter(Boolean).every((w) => ctx.measureText(w).width <= maxW);
  }
  function capSize(ctx, names, maxW, font) {
    return CAP_SIZES.find((sz) => names.every((n) => capFits(ctx, n, maxW, sz, font))) || CAP_SIZES[CAP_SIZES.length - 1];
  }
  function captionOf(ctx, name, maxW, font, size) {
    ctx.font = `600 ${size}px ${font}`;
    const lines = wrapText(ctx, name, maxW);
    const out = lines.slice(0, CAPS.CAP_LINES);
    if (lines.length > CAPS.CAP_LINES) out[CAPS.CAP_LINES - 1] = fitText(ctx, lines.slice(CAPS.CAP_LINES - 1).join(" "), maxW);   // never seen: a 4-line name
    return { size, lines: out, h: out.length * Math.round(size * 1.18) };
  }
  // ▲▼ badge on a card's top-left corner (like css/cards.css .tmove)
  function drawMove(ctx, x, y, d, pal) {
    const r = 15, cx = x + 6, cy = y + 6, col = d > 0 ? cssVar("--good") : cssVar("--bad");
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.shadowColor = "rgba(0, 0, 0, .5)"; ctx.shadowBlur = 6; ctx.fillStyle = pal.void2; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath();
    if (d > 0) { ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 7.5, cy + 5.5); ctx.lineTo(cx - 7.5, cy + 5.5); }
    else { ctx.moveTo(cx, cy + 7); ctx.lineTo(cx + 7.5, cy - 5.5); ctx.lineTo(cx - 7.5, cy - 5.5); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }

  async function tierImage(spec, { scale } = {}) {
    const caps = !!spec.captions;
    const want = scale || (caps ? 1.5 : 2);   // captions: 1620 px wide is sharp on any phone, and keeps the file small
    const B = caps ? { ...BOARD, W: CAPS.W, LABEL: CAPS.LABEL, GAP: CAPS.GAP } : BOARD;
    await fontsReady();
    const lib = libFor(spec.type);
    const kind = spec.type === "support" ? "support" : "card";
    const frame = frameSpec(spec.rarity || "Normal");   // support too (2026-10-30): game cards at the list's rarity
    const rows = spec.rows.map((r) => ({ label: String(r.label || ""), color: r.color, items: r.items.map((id) => lib.get(id) || { missing: true, id }) }));
    const total = rows.reduce((s, r) => s + r.items.length, 0);

    // layout (logical pixels)
    const innerW = B.W - B.PAD * 2 - B.LABEL - B.ROW_PAD * 2;
    const perLine = caps ? CAPS.PER_LINE : Math.max(1, Math.floor((innerW + B.GAP) / (B.CARD_W + B.GAP)));
    const cw = caps ? Math.floor((innerW - (perLine - 1) * B.GAP) / perLine) : B.CARD_W;   // captions: the cards fill the line
    const ch = caps ? Math.round(cw * B.CARD_H / B.CARD_W) : B.CARD_H;
    const mctx = caps ? document.createElement("canvas").getContext("2d") : null;            // measures the names before the real canvas exists
    const bodyFont = cssVar("--font-body");
    const capName = (it) => (it.missing ? pretty(it.id) : String(it.name || pretty(it.id)));
    const capPx = caps ? capSize(mctx, rows.flatMap((r) => r.items.map(capName)), cw - 6, bodyFont) : 0;   // one size for every name (a gap between neighbours)
    rows.forEach((r) => {
      const lines = Math.ceil(r.items.length / perLine);
      r.lines = lines;
      // each line of cards is as tall as its card + its longest name
      if (caps) r.items.forEach((it) => { it._cap = captionOf(mctx, capName(it), cw - 6, bodyFont, capPx); });
      r.lineH = Array.from({ length: lines }, (_, l) => ch + (caps ? CAPS.CAP_GAP + Math.max(...r.items.slice(l * perLine, (l + 1) * perLine).map((it) => it._cap.h)) : 0));
      r.h = lines ? B.ROW_PAD * 2 + r.lineH.reduce((s, h) => s + h, 0) + (lines - 1) * B.GAP : B.MIN_ROW;
    });
    const H = B.HEAD + rows.reduce((s, r) => s + r.h, 0) + Math.max(0, rows.length - 1) * B.ROW_GAP + 20 + B.FOOT;
    let k = Math.min(want, Math.sqrt(MAX_PIXELS / (B.W * H)), MAX_SIDE / H, MAX_SIDE / B.W);
    k = Math.floor(k * 100) / 100;
    if (k < 0.5) throw new Error("This list is too big for one image");

    // art: load every distinct image once
    const arts = new Map();
    const srcs = new Set();
    rows.forEach((r) => r.items.forEach((it) => { if (!it.missing && it.image) srcs.add(it.image); }));
    await Promise.all([...srcs].map(async (s) => arts.set(s, await loadImg(s))));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(B.W * k); canvas.height = Math.round(H * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.scale(k, k);
    const pal = {
      display: cssVar("--font-display"), body: cssVar("--font-body"),
      ink: cssVar("--ink"), dim: cssVar("--ink-dim"), faint: cssVar("--ink-faint"), void: cssVar("--void"),
      rift: cssVar("--rift"), glass: cssVar("--glass"), line: cssVar("--glass-line"), void2: cssVar("--void-2"),
    };
    const spacing = (px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; };

    paintBackdrop(ctx, B.W, H, pal, String(spec.id || spec.title || "x"));

    // header
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = pal.rift; ctx.font = `600 14px ${pal.display}`; spacing(3);
    ctx.fillText("CARD BATTLE INFINITY", B.PAD, 46);
    spacing(0);
    ctx.fillStyle = pal.ink; ctx.font = `700 46px ${pal.display}`;
    const pillW = 150;
    ctx.fillText(fitText(ctx, spec.title || "Tier list", B.W - B.PAD * 2 - pillW - 20), B.PAD, 98);
    ctx.fillStyle = pal.dim; ctx.font = `500 18px ${pal.body}`;
    const sub = [kind === "card" ? "Cards" : "Support", spec.rarity || "Normal", plural(rows.length, "row", "rows"), plural(total, kind === "card" ? "card" : "support card", kind === "card" ? "cards" : "support cards")].filter(Boolean).join("  ·  ");
    ctx.fillText(fitText(ctx, sub, B.W - B.PAD * 2), B.PAD, 128);
    paintRibbon(ctx, String(spec.rarity || "Normal").toUpperCase(), pillW, B.W, B.PAD, frame, pal);   // rarity tag, top right (like the tag on a card)

    // rows
    let y = B.HEAD;
    rows.forEach((r) => {
      const x = B.PAD, w = B.W - B.PAD * 2;
      const color = cssVar(r.color) || cssVar("--t-d");
      ctx.save();
      roundRect(ctx, x, y, w, r.h, B.R); ctx.clip();
      ctx.fillStyle = "rgba(15, 20, 37, .93)"; ctx.fillRect(x, y, w, r.h);
      ctx.fillStyle = pal.glass; ctx.fillRect(x, y, w, r.h);
      const lg = ctx.createLinearGradient(0, y, 0, y + r.h);
      lg.addColorStop(0, mix(color, "#10142a", 0.34)); lg.addColorStop(1, mix(color, "#0c1022", 0.12));
      ctx.fillStyle = lg; ctx.fillRect(x, y, B.LABEL, r.h);
      ctx.fillStyle = color; ctx.fillRect(x, y, 4, r.h);
      ctx.fillStyle = pal.line; ctx.fillRect(x + B.LABEL - 1, y, 1, r.h);
      ctx.restore();
      roundRect(ctx, x + 0.5, y + 0.5, w - 1, r.h - 1, B.R);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.stroke();

      // label: as big as fits (short labels huge, long ones wrap and shrink)
      const text = r.label.trim();
      const maxW = B.LABEL - 24, maxH = r.h - 20;
      let size = text.length <= 2 ? 52 : text.length <= 5 ? 34 : 24, lines = [];
      for (; size >= 12; size -= 2) {
        ctx.font = `700 ${size}px ${pal.display}`;
        lines = wrapText(ctx, text, maxW);
        const whole = text.split(/\s+/).every((w) => ctx.measureText(w).width <= maxW);   // shrink before splitting a word (META, not MET A)
        if (whole && lines.length * size * 1.12 <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
      }
      ctx.fillStyle = mix(color, "#fff6e0", 0.55); ctx.textAlign = "center";
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      const lh = size * 1.12, top = y + r.h / 2 - (lines.length * lh) / 2;
      lines.forEach((l, i) => ctx.fillText(l, x + B.LABEL / 2, top + lh * (i + 0.8)));
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
      ctx.textAlign = "left";

      r.items.forEach((it, i) => {
        const col = i % perLine, line = Math.floor(i / perLine);
        const cx = x + B.LABEL + B.ROW_PAD + col * (cw + B.GAP);
        const cy = y + B.ROW_PAD + r.lineH.slice(0, line).reduce((s, h) => s + h + B.GAP, 0);
        drawCard(ctx, cx, cy, cw, ch, it, frame, it.image ? arts.get(it.image) : null, k, pal);
        if (!caps) return;
        const d = it.missing ? 0 : C.tierMove(it);
        if (d) drawMove(ctx, cx, cy, d, pal);
        const cap = it._cap, lh = Math.round(cap.size * 1.18);
        ctx.font = `600 ${cap.size}px ${bodyFont}`; ctx.fillStyle = pal.ink; ctx.textAlign = "center"; ctx.textBaseline = "top";
        cap.lines.forEach((l, j) => ctx.fillText(l, cx + cw / 2, cy + ch + CAPS.CAP_GAP + j * lh));
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      });
      y += r.h + B.ROW_GAP;
    });

    paintFooter(ctx, B.W, H, B.FOOT, B.PAD, pal, spec.title || "Tier list");

    // captions: JPEG (a 100-card picture is ~20 MB as PNG, too big to share from a phone) · the Tier Maker's lists stay PNG
    const type = caps ? "image/jpeg" : "image/png";
    const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't encode the image"))), type, 0.9));
    return { blob, width: canvas.width, height: canvas.height, filename: `${slug(spec.title)}.${caps ? "jpg" : "png"}` };
  }

  /* ==========================================================
     Image: a deck (step 10). Four card slots over four support slots (the game's decks since 2026-10-30, was five),
     drawn with the same card / frame / backdrop code.
     Owner 2026-11-02: only the deck's name as words (no "CARD BATTLE INFINITY", no "Deck · mode · rarity · 4/4 …" line,
     no footer, no "4 / 4" counts) · SLOT 1–4 and the CARDS / SUPPORT headings stay · each card's trait under it ·
     ATK / HP with the deck's buffs + trait + grades (js/deckbuff.js · the game's HP green / ATK red, owner 2026-11-02). The tier list image is unchanged.
     Owner 2026-11-02 "rarity per slot": every card and support is drawn at its own slot's rarity (its rarity pill on the card,
     like the cards on the site) · the one rarity ribbon top right (paintRibbon) is gone from the deck image.
     Owner 2026-11-02: spec.note (the user's own words, e.g. farming time) = a gold-edged box, wrapped · at the bottom of the
     image (owner 2026-11-02 round 2, was under the name).
     Owner 2026-11-02 round 2: each card's / support's name over it (one size for every slot, wrapped, was SLOT 1–4) and its
     rarity pill under it (the card's own rarity pill colours · above the trait), in both panels.
     spec = { id, title, note?, mode, rarity: name (fallback), cards: [id|null x4], support: [id|null x4],
              cardRarity: [name x4], supRarity: [name x4], traits: [trait id|null x4], nums: [{ atk, hp }|null x4] }
     ========================================================== */
  const DECK_SLOTS = 4;
  const NOTE = { FS: 30, LH: 40, PAD: 18, BAR: 8, GAP: 18, LINES: 6 };
  // the deck's note in lines: the user's line breaks kept, long lines wrapped, at most NOTE.LINES lines
  function deckNoteLines(note, maxW) {
    const text = String(note || "").trim();
    if (!text) return [];
    const mc = document.createElement("canvas").getContext("2d");
    if (!mc) return [];
    mc.font = `600 ${NOTE.FS}px ${cssVar("--font-body")}`;
    const out = text.split(/\n/).flatMap((p) => (p.trim() ? wrapText(mc, p.trim(), maxW) : [""]));
    while (out.length && !out[out.length - 1]) out.pop();
    if (out.length > NOTE.LINES) { out.length = NOTE.LINES; out[NOTE.LINES - 1] = fitText(mc, out[NOTE.LINES - 1] + " …", maxW); }
    return out;
  }
  const DECKIMG = { W: 1200, PAD: 28, HEAD: 100, FOOT: 28, GAP: 24, CW: 190, CH: 266, PANEL_GAP: 14, R: 16, TRAIT: 34, TRAIT_GAP: 10,
    NAME_FS: 17, NAME_LH: 21, NAME_LINES: 2, NAME_GAP: 8, RAR: 26, RAR_GAP: 10 };
  // a slot's name over its card: one size for every slot, wrapped to NAME_LINES (the last line squeezed if it is longer)
  function slotName(ctx, name, maxW, font) {
    ctx.font = `600 ${DECKIMG.NAME_FS}px ${font}`;
    const lines = wrapText(ctx, String(name || ""), maxW);
    if (lines.length > DECKIMG.NAME_LINES) lines.splice(DECKIMG.NAME_LINES - 1, lines.length, fitText(ctx, lines.slice(DECKIMG.NAME_LINES - 1).join(" "), maxW));
    return lines.map((l) => fitText(ctx, l, maxW));
  }
  // the rarity pill under a card: the card's own rarity pill (gcSpec · Normal = a plain dark pill)
  function drawRarityPill(ctx, cx, y, h, rarity, pal) {
    const sp = gcSpec(rarity), text = String(rarity || "Normal").toUpperCase(), pop = cssVar("--gc-font-pop") || pal.display;
    ctx.save();
    ctx.font = `italic 400 ${h * 0.68}px ${pop}`; if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
    const w = Math.max(96, ctx.measureText(text).width + 30), x = cx - w / 2;
    roundRect(ctx, x, y, w, h, h / 2);
    if (sp.normal) { ctx.fillStyle = pal.void; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = pal.faint; ctx.stroke(); }
    else {
      const st = gradStops(sp.pill), across = /90deg/.test(sp.pill);
      const g = across ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
      st.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = st.length ? g : pal.rift; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = sp.line; ctx.stroke();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    if (!sp.normal && !sp.flat) { ctx.lineWidth = 2.5; ctx.strokeStyle = sp.line; ctx.strokeText(text, cx, y + h / 2 + 1); }
    ctx.fillStyle = sp.normal ? pal.dim : sp.ink; ctx.fillText(text, cx, y + h / 2 + 1);
    ctx.restore();
  }

  function drawEmptySlot(ctx, x, y, w, h, pal) {
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 8);
    ctx.fillStyle = "rgba(255, 255, 255, .02)"; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = pal.faint; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = pal.faint; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = `600 13px ${pal.body}`;
    ctx.fillText("Empty", x + w / 2, y + h / 2 + 4);
    ctx.textAlign = "left";
  }

  // a trait's icon (the <symbol> in index.html, as the Deck page's .dk-trait shows it) as a picture in its tier colour
  function traitIcon(t, color) {
    const sym = document.getElementById("tri-" + t.id) || document.getElementById("i-gem");
    if (!sym) return Promise.resolve(null);
    const inner = sym.innerHTML.replace(/var\(--ink\)/g, cssVar("--ink") || "#fff");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.getAttribute("viewBox") || "0 0 24 24"}" width="96" height="96" color="${color}" style="color:${color}">${inner}</svg>`;
    return loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  }
  // the trait pill under a card: same look as .dk-trait in css/traits.css (tier colour edge, dark tier fill, icon + name)
  function drawTrait(ctx, cx, y, w, h, t, icon, pal) {
    const tier = String(t.tier || "none").toLowerCase();
    const tc = cssVar("--tr-" + tier) || pal.rift, tc2 = cssVar("--tr-" + tier + "-2") || pal.void;
    const x = cx - w / 2;
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mix(tc2, pal.void, 0.7)); g.addColorStop(1, pal.void);
    ctx.fillStyle = g; ctx.fill();
    ctx.globalAlpha = 0.75; ctx.lineWidth = 1.5; ctx.strokeStyle = tc; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.font = `600 15px ${pal.body}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    const is = 18, gap = 7, name = fitText(ctx, t.name, w - 24 - (icon ? is + gap : 0));
    const tw = ctx.measureText(name).width, all = tw + (icon ? is + gap : 0);
    let tx = cx - all / 2;
    if (icon) { ctx.drawImage(icon, tx, y + (h - is) / 2, is, is); tx += is + gap; }
    ctx.fillStyle = pal.ink; ctx.fillText(name, tx, y + h / 2 + 1);
    ctx.restore();
  }

  async function deckImage(spec, { scale: want = 2 } = {}) {
    const B = DECKIMG;
    await fontsReady();
    const cardLib = libFor("card"), supLib = libFor("support");
    const cards = (spec.cards || []).slice(0, DECK_SLOTS).map((id) => (id ? cardLib.get(id) || { missing: true, id } : null));
    const sups = (spec.support || []).slice(0, DECK_SLOTS).map((id) => (id ? supLib.get(id) || { missing: true, id } : null));
    while (cards.length < DECK_SLOTS) cards.push(null);
    while (sups.length < DECK_SLOTS) sups.push(null);
    const rarity = spec.rarity || "Normal";
    // each slot's own rarity (support too: the game card, as big as the cards) · missing = the deck's
    const rOf = (a, i) => (Array.isArray(a) && typeof a[i] === "string" && a[i] ? a[i] : rarity);
    const frameAt = (a, i) => frameSpec(rOf(a, i));
    const traitBy = (C.traits && C.traits.byId) || (() => null);
    const traits = cards.map((it, i) => (it && !it.missing && Array.isArray(spec.traits) ? traitBy(spec.traits[i]) : null));
    const nums = cards.map((it, i) => (it && !it.missing && Array.isArray(spec.nums) && spec.nums[i] ? spec.nums[i] : null));
    const anyTrait = traits.some(Boolean);

    const TR = anyTrait ? B.TRAIT_GAP + B.TRAIT : 0;
    // over each card: its name (NAME_LINES lines tall in every slot) · under it: its rarity pill, then the trait (cards)
    const NM = B.NAME_LINES * B.NAME_LH + B.NAME_GAP, RR = B.RAR_GAP + B.RAR;
    const P1 = 14 + 22 + NM + B.CH + RR + TR + 18, P2 = 14 + 22 + NM + B.CH + RR + 18;
    // the deck's note (owner 2026-11-02: farming time …, written by the user): a clear box under the name, wrapped
    const noteLines = deckNoteLines(spec.note, B.W - B.PAD * 2 - NOTE.PAD * 2 - NOTE.BAR);
    const NH = noteLines.length ? noteLines.length * NOTE.LH + NOTE.PAD * 2 + NOTE.GAP : 0;
    const H = B.HEAD + P1 + B.PANEL_GAP + P2 + (NH ? B.PANEL_GAP + NH - NOTE.GAP : 0) + B.FOOT;
    let k = Math.min(want, Math.sqrt(MAX_PIXELS / (B.W * H)), MAX_SIDE / H, MAX_SIDE / B.W);
    k = Math.floor(k * 100) / 100;
    if (k < 0.5) throw new Error("This deck is too big for one image");

    const pal = {
      display: cssVar("--font-display"), body: cssVar("--font-body"),
      ink: cssVar("--ink"), dim: cssVar("--ink-dim"), faint: cssVar("--ink-faint"), void: cssVar("--void"),
      rift: cssVar("--rift"), glass: cssVar("--glass"), line: cssVar("--glass-line"),
    };
    const arts = new Map();
    const srcs = new Set();
    [...cards, ...sups].forEach((it) => { if (it && !it.missing && it.image) srcs.add(it.image); });
    const icons = new Map();
    await Promise.all([
      ...[...srcs].map(async (s) => arts.set(s, await loadImg(s))),
      ...[...new Set(traits.filter(Boolean))].map(async (t) => icons.set(t.id, await traitIcon(t, cssVar("--tr-" + String(t.tier || "none").toLowerCase()) || pal.rift))),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(B.W * k); canvas.height = Math.round(H * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.scale(k, k);
    paintBackdrop(ctx, B.W, H, pal, "deck:" + String(spec.id || spec.title || "x"));

    // header: the deck's name, nothing else (each card shows its own rarity)
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = pal.ink; ctx.font = `700 46px ${pal.display}`;
    ctx.fillText(fitText(ctx, spec.title || "Deck", B.W - B.PAD * 2), B.PAD, 66);
    const drawNote = (ny) => {
      const nh = NH - NOTE.GAP, nw = B.W - B.PAD * 2, gold = cssVar("--gold") || "#d8b45a";
      ctx.save();
      roundRect(ctx, B.PAD, ny, nw, nh, 14); ctx.clip();
      ctx.fillStyle = mix(gold, "#0f1425", 0.14); ctx.fillRect(B.PAD, ny, nw, nh);   // dark panel with a gold tint
      ctx.fillStyle = gold; ctx.fillRect(B.PAD, ny, NOTE.BAR, nh);
      ctx.restore();
      roundRect(ctx, B.PAD + 1, ny + 1, nw - 2, nh - 2, 14);
      ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = pal.ink; ctx.font = `600 ${NOTE.FS}px ${pal.body}`; ctx.textBaseline = "alphabetic";
      noteLines.forEach((l, i) => ctx.fillText(l, B.PAD + NOTE.BAR + NOTE.PAD, ny + NOTE.PAD + NOTE.FS + i * NOTE.LH - 4));
    };

    // one panel per kind. Columns line up, so the support under a card sits in the same column.
    const pw = B.W - B.PAD * 2;
    const colW = (pw - 2 * 24) / DECK_SLOTS;
    const colX = (i) => B.PAD + 24 + i * colW + colW / 2;
    const panel = (y, h, label) => {
      ctx.save();
      roundRect(ctx, B.PAD, y, pw, h, B.R); ctx.clip();
      ctx.fillStyle = "rgba(15, 20, 37, .93)"; ctx.fillRect(B.PAD, y, pw, h);
      ctx.fillStyle = pal.glass; ctx.fillRect(B.PAD, y, pw, h);
      ctx.restore();
      roundRect(ctx, B.PAD + 0.5, y + 0.5, pw - 1, h - 1, B.R);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = pal.rift; ctx.font = `700 13px ${pal.display}`; setSpacing(ctx, 2.5);
      ctx.fillText(label.toUpperCase(), B.PAD + 22, y + 14 + 14);
      setSpacing(ctx, 0);
    };
    // the name over a slot (bottom line just above the card) + its rarity pill under it · empty slot = neither
    const label = (it, i, cy, r) => {
      if (!it) return;
      const lines = slotName(ctx, it.missing ? pretty(it.id) : it.name || pretty(it.id), colW - 14, pal.body);
      ctx.fillStyle = pal.ink; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      const base = cy - B.NAME_GAP - 4 - (lines.length - 1) * B.NAME_LH;
      lines.forEach((l, j) => ctx.fillText(l, colX(i), base + j * B.NAME_LH));
      ctx.textAlign = "left";
      if (!it.missing) drawRarityPill(ctx, colX(i), cy + B.CH + B.RAR_GAP, B.RAR, r, pal);
    };
    let y = B.HEAD;
    panel(y, P1, "Cards");
    cards.forEach((it, i) => {
      const x = colX(i) - B.CW / 2, cy = y + 14 + 22 + NM;
      if (it) drawCard(ctx, x, cy, B.CW, B.CH, it, frameAt(spec.cardRarity, i), it.image ? arts.get(it.image) : null, k, pal, nums[i]);
      else drawEmptySlot(ctx, x, cy, B.CW, B.CH, pal);
      label(it, i, cy, rOf(spec.cardRarity, i));
      if (traits[i]) drawTrait(ctx, colX(i), cy + B.CH + RR + B.TRAIT_GAP, B.CW, B.TRAIT, traits[i], icons.get(traits[i].id), pal);
    });
    y += P1 + B.PANEL_GAP;
    panel(y, P2, "Support");
    sups.forEach((it, i) => {
      const x = colX(i) - B.CW / 2, cy = y + 14 + 22 + NM;
      if (it) drawCard(ctx, x, cy, B.CW, B.CH, it, frameAt(spec.supRarity, i), it.image ? arts.get(it.image) : null, k, pal);
      else drawEmptySlot(ctx, x, cy, B.CW, B.CH, pal);
      label(it, i, cy, rOf(spec.supRarity, i));
    });
    // the note last, under the support panel (owner 2026-11-02 round 2)
    if (noteLines.length) drawNote(y + P2 + B.PANEL_GAP);

    const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't encode the image"))), "image/png"));
    return { blob, width: canvas.width, height: canvas.height, filename: `${slug(spec.title, "deck")}.png` };
  }

  /* ==========================================================
     Dialogs (use the Tier Maker's in-page dialog; never alert / confirm)
     ========================================================== */
  async function previewDialog({ title, render, flashEl }) {
    let out = null, dead = false, objUrl = "";
    const res = await C.dialog({
      title,
      html: `<div class="tm-prev" data-prev aria-live="polite"><span class="fx-loader" aria-hidden="true"></span><span class="tm-prev__msg">Making your image…</span></div>
        <p class="tm-dlg__text" data-info hidden></p>
        <button type="button" class="tm-btn tm-btn--primary fx-press" data-save disabled>${ICON.download}Save image</button>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(d, finish) {
        const prev = $("[data-prev]", d), info = $("[data-info]", d), save = $("[data-save]", d);
        render().then((o) => {
          if (dead) return;
          out = o;
          objUrl = URL.createObjectURL(o.blob);
          const img = new Image();
          img.className = "tm-prev__img"; img.alt = "Preview of the image you are saving"; img.src = objUrl;
          prev.replaceChildren(img);
          prev.classList.add("is-ready");
          FX.fade(img, 1, { duration: 300 });
          info.hidden = false;
          info.textContent = `${o.width} × ${o.height} px · ${o.blob.type === "image/jpeg" ? "JPEG" : "PNG"} · ${(o.blob.size / 1048576).toFixed(1)} MB`;
          save.disabled = false;
        }).catch((err) => {
          if (dead) return;
          console.error(err);
          prev.classList.add("is-ready");
          prev.innerHTML = `<span class="tm-prev__msg">Couldn’t make the image${err && err.message ? ": " + esc(err.message) : ""}. Try again, or share a link instead.</span>`;
        });
        save.addEventListener("click", async () => {
          if (!out) return;
          save.disabled = true;
          const r = await deliver(out.blob, out.filename, title);
          save.disabled = false;
          if (r !== "cancelled") finish({ action: r });
        });
      },
    });
    dead = true;
    if (objUrl) URL.revokeObjectURL(objUrl);
    if (res && (res.action === "shared" || res.action === "downloaded")) {
      FX.flash(flashEl);
      FX.toast(res.action === "shared" ? "Image shared" : "Image saved");
    }
  }
  const imageDialog = (spec, { flashEl } = {}) => previewDialog({ title: "Save as image", render: () => tierImage(spec), flashEl });
  const deckImageDialog = (spec, { flashEl } = {}) => previewDialog({ title: "Save as image", render: () => deckImage(spec), flashEl });

  async function linkDialog({ url, title, flashEl, what = "list" }) {
    const deck = what === "deck";
    const canShare = !!navigator.share;
    const long = url.length > 6000;
    const res = await C.dialog({
      title: "Share link",
      html: `<p class="tm-dlg__text">Anyone with this link opens a view-only copy of “${esc(title)}” and can save it to their own ${deck ? "decks" : "lists"}. Nothing is uploaded: the ${deck ? "deck" : "list"} is inside the link. Yours isn’t changed.</p>
        <label class="tm-field"><span class="tm-field__label">Link</span>
          <input class="tm-input" data-url readonly value="${esc(url)}" spellcheck="false" autocomplete="off" aria-label="Share link"></label>
        <p class="tm-field__note" data-note>${long ? "This is a long link and some chat apps may cut it off. For big lists, saving an image is safer." : ""}</p>
        <div class="tm-dlg__pair${canShare ? "" : " tm-dlg__pair--one"}">
          <button type="button" class="tm-btn tm-btn--primary fx-press" data-copy>${ICON.link}Copy link</button>
          ${canShare ? `<button type="button" class="tm-btn fx-press" data-share>${ICON.share}Share…</button>` : ""}
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(d, finish) {
        const input = $("[data-url]", d), note = $("[data-note]", d);
        input.addEventListener("focus", () => input.select());
        $("[data-copy]", d).addEventListener("click", async () => {
          if (await copyText(url, input)) finish({ action: "copied" });
          else { note.textContent = "Couldn’t copy automatically. Press and hold the link to copy it by hand."; input.focus(); input.select(); }
        });
        const sh = $("[data-share]", d);
        if (sh) sh.addEventListener("click", async () => {
          try { await navigator.share({ title, text: `${title} — ${deck ? "a deck" : "a tier list"} on Card Battle Infinity`, url }); finish({ action: "shared" }); }
          catch (e) { if (!e || e.name !== "AbortError") { note.textContent = "Couldn’t open the share sheet. Use Copy link instead."; } }
        });
      },
    });
    if (res && res.action === "copied") { FX.flash(flashEl); FX.toast("Link copied"); }
    else if (res && res.action === "shared") { FX.flash(flashEl); FX.toast("Link shared"); }
  }

  /* ==========================================================
     Backup: Export / Import one .json file
     ========================================================== */
  const providers = new Map();
  function provide(id, p) { providers.set(id, p); }
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const copyDeep = (v) => JSON.parse(JSON.stringify(v));

  function snapshot() {
    const out = [];
    providers.forEach((p, id) => { const data = p.get(); out.push({ id, p, data, n: p.count(data) }); });
    return out;
  }

  function exportBackup() {
    const data = {};
    snapshot().forEach((s) => { if (s.n > 0) data[s.id] = s.data; });
    const file = { app: APP, type: "backup", version: BACKUP_VERSION, exported: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(file, null, 1)], { type: "application/json" });
    download(blob, `card-battle-infinity-backup-${new Date().toLocaleDateString("en-CA")}.json`);
    FX.toast("Backup saved");
  }

  // read + check a picked file; returns { exported, sections: [{ id, p, data, n }] } or a message string
  async function readBackup(file) {
    if (file.size > FILE_MAX) return "That file is too big to be a backup.";
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { return "That file couldn’t be read. Pick a backup made with Export."; }
    if (!isObj(obj) || obj.app !== APP || obj.type !== "backup" || !isObj(obj.data)) return "That isn’t a Card Battle Infinity backup.";
    if (!Number.isInteger(obj.version) || obj.version > BACKUP_VERSION) return "This backup was made by a newer version of the site. Reload the page and try again.";
    const sections = [];
    providers.forEach((p, id) => {
      const data = obj.data[id];
      const ok = p.kind === "array" ? Array.isArray(data) && data.length <= 500 : isObj(data) && Object.keys(data).length <= 5000;
      if (ok) { const n = p.count(data); if (n > 0) sections.push({ id, p, data, n }); }
    });
    if (!sections.length) return "There’s nothing to restore in that file.";
    return { exported: typeof obj.exported === "string" ? obj.exported : "", sections };
  }

  async function restoreDialog(backup) {
    const lines = backup.sections.map((s) => s.p.noun(s.n)).join(" · ");
    const when = backup.exported && !isNaN(new Date(backup.exported)) ? new Date(backup.exported).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    const res = await C.dialog({
      title: "Restore from backup",
      html: `<p class="tm-dlg__text">This backup has ${esc(lines)}${when ? ` (saved ${esc(when)})` : ""}.</p>
        <p class="tm-dlg__text"><b>Merge</b> keeps what you have and adds the rest. If the same tier list or deck is in both, the one edited last wins. <b>Replace</b> swaps what’s on this device for the backup.</p>`,
      actions: [
        { label: "Cancel", value: "cancel" },
        { label: "Replace", value: "replace", cls: "tm-btn--danger" },
        { label: "Merge", value: "merge", submit: true, cls: "tm-btn--primary" },
      ],
    });
    if (!res || (res.action !== "merge" && res.action !== "replace")) return;
    const how = res.action;
    const before = backup.sections.map((s) => ({ s, was: copyDeep(s.p.get()) }));
    let changed = [];
    try { changed = backup.sections.map((s) => ({ s, n: s.p.apply(copyDeep(s.data), how) || 0 })); }
    catch (err) { console.error(err); FX.toast("Something went wrong while restoring"); before.forEach(({ s, was }) => { try { s.p.apply(was, "replace"); } catch {} }); return; }
    const parts = changed.filter((c) => c.n > 0).map((c) => c.s.p.noun(c.n));
    FX.toast(parts.length ? `Restored ${parts.join(", ")}` : "Nothing new to add", {
      duration: 7000,
      action: parts.length ? { label: "Undo", fn: () => { before.forEach(({ s, was }) => { try { s.p.apply(was, "replace"); } catch {} }); FX.toast("Restore undone"); } } : null,
    });
  }

  async function backupDialog() {
    const snap = snapshot();
    const have = snap.filter((s) => s.n > 0);
    const res = await C.dialog({
      title: "Backup & restore",
      html: `<p class="tm-dlg__text">Save your tier lists, grades and decks to a file you keep, or restore them from one. Nothing is uploaded; it all stays on your device.</p>
        <p class="tm-dlg__sum">${have.length ? "On this device: " + esc(have.map((s) => s.p.noun(s.n)).join(" · ")) : "Nothing saved on this device yet."}</p>
        <div class="tm-dlg__pair">
          <button type="button" class="tm-btn tm-btn--primary fx-press" data-dlg="export"${have.length ? "" : " disabled"}>${ICON.download}Export</button>
          <label class="tm-btn fx-press tm-file">${ICON.upload}Import<input type="file" class="sr-only" accept=".json,application/json" data-file></label>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(d, finish) {
        $("[data-file]", d).addEventListener("change", (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) finish({ action: "file", file: f });
        });
      },
    });
    if (!res) return;
    if (res.action === "export") exportBackup();
    else if (res.action === "file") {
      const b = await readBackup(res.file);
      if (typeof b === "string") FX.toast(b);
      else restoreDialog(b);
    }
  }

  C.share = { imageDialog, deckImageDialog, previewDialog, tierImage, deckImage, makeLink, readLink, linkDialog, backupDialog, provide, copyText, icons: ICON };
})();
