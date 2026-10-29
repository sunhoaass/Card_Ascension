/* ==========================================================
   Card Battle Infinity — app core
   Router (5 tabs + card detail hash) · data loading · shared card renderer
   The Cards page (search / filters / sort) lives in js/cards.js · the card detail ("Black Sun" scene) in js/detail.js
   The Tier List page (Global cards / support + My Lists) lives in js/tier.js
   The Deck page (Meta Decks, later the deck builder) lives in js/deck.js
   Support cards (owner 2026-10-28): a Cards | Support switch on the Cards page (#cards / #support) · the Support grid lives in
   js/support.js · a support opens the same card detail as a card (#card/<id>) · renderCard() draws both kinds
   The Grade page (card picker + #grade/<id>/<grades> grader) lives in js/grade.js
   The Traits page (13 traits + calculator, the user's trait per card) lives in js/traits.js
   Save image / share link / backup (shared by Tier Maker and Deck) live in js/share.js
   ========================================================== */
(function () {
  const PAGES = ["tier", "cards", "deck", "grade", "traits"];   // #support = the Cards page, Support side (no menu button since 2026-10-28)
  const PAGE_TITLES = {
    tier: "Card Battle Infinity — Tier List & Card Database",
    cards: "Cards — Card Battle Infinity",
    support: "Support — Card Battle Infinity",
    deck: "Deck — Card Battle Infinity",
    grade: "Card Grader — Card Battle Infinity",
    traits: "Traits — Card Battle Infinity",
  };
  const STORE_KEY = "cbi:lastPage";
  const RARITY_KEY = "cbi:rarity";
  const TIER_COLOR = { Meta: "--t-meta", SS: "--t-ss", S: "--t-s", A: "--t-a", B: "--t-b" };   // Meta = was GOD (owner 2026-10-28) · C / D dropped
  const RARITY_SWATCH = {
    Normal: "var(--r-normal)", Shiny: "var(--r-shiny)",
    Rainbow: "linear-gradient(135deg,#e8607a,#e9a75a,#7fd39a,#69b9e0,#8a7be0)",
    Secret: "var(--r-secret)", Divine: "var(--r-divine-2)",
    Cosmic: "linear-gradient(135deg,var(--r-cosmic),var(--r-cosmic-2))",
    Ascended: "linear-gradient(135deg,#a9eef5,#c5a8f5,#f5b4dc,#f8e7a8)",
    Godlike: "linear-gradient(135deg,#fffdf4,#f6e2a8)", Godly: "linear-gradient(135deg,#ff7aa8,#f7a35c,#ffd36a)",
  };

  // page: current tab · loaded: data ready · origin: element a card detail should grow from
  // kind: the Cards page's side ("cards" | "support", #cards / #support)
  const state = { meta: null, cards: [], support: [], teams: [], traits: null, rarity: "Normal", page: null, kind: "cards", loaded: false, origin: null };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Storage (never crash if blocked) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ---------- Data ---------- */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path + " " + res.status);
    return res.json();
  }

  /* Only the best meta.rankTop of a list keep their tier (routine B ranks at most that many · this guards the rest) */
  const rankTop = () => (state.meta && Number(state.meta.rankTop) > 0 ? Math.floor(state.meta.rankTop) : 50);
  function topOnly(list, val) {
    if (!Array.isArray(list)) return;
    const top = rankTop();
    list.filter((x) => x && x.tier && val(x) > 0).sort((a, b) => val(b) - val(a)).slice(top).forEach((x) => { x.tier = ""; });
  }

  /* ---------- Number helpers ---------- */
  function rarityOf(name) { return state.meta.rarities.find((r) => r.name === name) || state.meta.rarities[0]; }
  function statAt(card, key, rarity) {
    const exact = card.exact && card.exact[rarity] && card.exact[rarity][key];
    if (exact) return exact;
    return Math.round(card.base[key] * rarityOf(rarity).stat);
  }
  function oddsAt(card, rarity) { return card.base.odds * rarityOf(rarity).odds; }
  /* Game style (owner's answer §3.5.4 item 3, step 13 · checked on the game's Bald Cadet 2026-10-28):
     under 10,000 = the whole number with commas · K = whole number · M B T Qa Qi = one decimal (100 and up = whole)
     (1 in 59 · 1 in 1,195 · 1 in 30K · 1 in 148K · 1 in 14.8M · 1 in 9.5B · 1 in 140T) */
  const SHORT = [[1e18, "Qi"], [1e15, "Qa"], [1e12, "T"], [1e9, "B"], [1e6, "M"]];
  function shortNum(n) {
    if (Math.round(n) < 1e4) return Math.round(n).toLocaleString("en-US");
    if (Math.round(n / 1e3) < 1000) return Math.round(n / 1e3) + "K";
    for (const [v, s] of SHORT) if (n >= v || v === 1e6) { const x = n / v; return (x >= 100 ? Math.round(x) : Number(x.toFixed(1))) + s; }
  }
  const fmtOdds = (n) => "1 in " + shortNum(n);
  const fmtStat = (n) => Math.round(n).toLocaleString("en-US");
  /* HP like the game (owner 2026-10-29 · HP only, ATK stays whole): up to 999,999,999 = the whole number with commas ·
     1B and up = B T Qa Qi with one decimal (100 and up = whole · .0 dropped) (999,500,000 · 1B · 1.5B · 12.3B · 250B · 1.2T) */
  function fmtHp(n) {
    n = Math.round(n);
    if (n < 1e9) return n.toLocaleString("en-US");
    const units = [[1e9, "B"], [1e12, "T"], [1e15, "Qa"], [1e18, "Qi"]];
    for (let i = 0; i < units.length; i++) {
      const [v, s] = units[i], x = n / v, r = x >= 100 ? Math.round(x) : Number(x.toFixed(1));
      if (r < 1000 || i === units.length - 1) return r + s;   // 999.96B -> 1T, not 1000B
    }
  }
  const fmtKey = (k) => (k === "hp" ? fmtHp : fmtStat);

  /* Support values by level (owner 2026-10-28 · PROGRESS §5.4): Normal value × (1 + 0.25 × level), level = the rarity's
     place (Normal 0 … Godly 8). The game rounds to 1 decimal and an exact …5 goes to the even digit (6.25 → 6.2, 8.75 → 8.8).
     effect = { name, desc: "… gets {0}% more max HP.", vals: [5], type: "max-hp" } · {0} {1} … = vals at the picked level */
  function levelOf(rarity) { const i = state.meta ? state.meta.rarities.findIndex((r) => r.name === rarity) : -1; return i < 0 ? 0 : i; }
  const supLevelMult = (rarity) => 1 + 0.25 * levelOf(rarity);
  function supAt(base, rarity) {
    const b = Math.round(Number(base) * 1000);                   // thousandths: whole numbers, no float drift
    if (!Number.isFinite(b) || b <= 0) return 0;
    const n = b * (4 + levelOf(rarity));                          // value × 4000 (× (1 + 0.25 L) = × (4 + L) / 4)
    const q = Math.floor(n / 400), r = n - q * 400;               // tenths + what's left (half a tenth = 200)
    return (r > 200 || (r === 200 && q % 2) ? q + 1 : q) / 10;
  }
  const supVals = (s) => (s && s.effect && typeof s.effect === "object" && Array.isArray(s.effect.vals) ? s.effect.vals : []);
  /* A chance tops out at 100% (owner 2026-10-29): {n} followed by "% chance" or "% of (the) hits" (dodges, counters) */
  const supCapped = (s, i) => new RegExp(`\\{${i}\\}% (chance|of (the )?hits)`).test((s && s.effect && s.effect.desc) || "");
  const supValAt = (s, i, rarity) => { const v = supAt(supVals(s)[i], rarity); return supCapped(s, i) ? Math.min(100, v) : v; };
  const supValue = (s, rarity) => supValAt(s, 0, rarity);  // the main value (vals[0]) at a rarity · 0 = none
  const supText = (s, text, rarity) => String(text || "").replace(/\{(\d)\}/g, (m, i) => (supVals(s)[+i] == null ? m : String(supValAt(s, +i, rarity))));
  const isSupport = (x) => !!(x && x.kind === "support");   // support objects get kind "support" when the data loads (boot)

  /* A card is "ranked" once it has been analysed (scores.overall > 0 and a tier).
     Only the strongest meta.rankTop (50) cards and 50 support are ranked (owner 2026-10-28): the rest stay unranked for good
     (in the library, searchable, usable in decks, never in the Tier List). New cards from routine A are unranked too. */
  const isRanked = (card) => !!(card.scores && (isSupport(card) ? card.scores.value : card.scores.overall) > 0 && card.tier);
  const cardLabel = (card, rarity) => `${card.name}${isSupport(card) ? ", support" : ""}, ${rarity}${isRanked(card) ? ", tier " + card.tier : ", unranked"}`;

  /* ---------- Placeholder art (until real images exist) ----------
     Step 9.6b: jewel-tone gradient + a gothic arch window + the initials in Cinzel.
     js/share.js drawPlaceholder() draws the same picture into saved images (keep the two in step). */
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  const ART_HUES = [222, 260, 330, 350, 200, 160, 30];
  let artSeq = 0;
  function placeholderArt(card) {
    const uid = card.id.replace(/[^a-z0-9]/gi, "") + "-" + (artSeq++);
    const h = ART_HUES[hash(card.id) % ART_HUES.length], h2 = (h + 40) % 360;
    const initials = esc(card.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase());
    return `<svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="hsl(${h} 45% 24%)"/><stop offset="1" stop-color="hsl(${h2} 40% 8%)"/>
        </linearGradient>
        <radialGradient id="r${uid}" cx=".5" cy=".42" r=".5">
          <stop offset="0" stop-color="hsl(42 90% 75% / .45)"/><stop offset="1" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#g${uid})"/>
      <circle cx="50" cy="56" r="44" fill="url(#r${uid})"/>
      <path d="M28 104V52a22 22 0 0 1 44 0v52z" fill="hsl(${h} 40% 12% / .55)" stroke="hsl(42 70% 70% / .55)" stroke-width="1"/>
      <path d="M33 104V54a17 17 0 0 1 34 0v50M50 37v67M33 72h34" fill="none" stroke="hsl(42 70% 70% / .25)" stroke-width=".7"/>
      <text x="50" y="76" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="17" fill="hsl(42 80% 88% / .92)">${initials}</text>
    </svg>`;
  }

  /* ---------- Card art <img> (step 9.5) ----------
     lazy + async decode + width/height (no layout jump). Small cards (mini: tier rows, Tier Maker pool, decks, Grade picker)
     ask for the 300×420 thumbnail images/cards/thumb/<id>.webp first; if it isn't there they fall back to the big
     image, and if that is missing too, to the generated art. Routine A makes both files (§7).
     defer (W4, cards from renderCard): no src yet, only data-src — the card's own on-screen watcher below loads it and the
     cards next to it. loading="lazy" made Chrome keep checking every picture not seen yet on every scroll frame. */
  const thumbOf = (src) => { const i = src.lastIndexOf("/"); return src.slice(0, i + 1) + "thumb/" + src.slice(i + 1); };
  function artImg(src, small = false, defer = false) {
    const [w, h] = small ? [300, 420] : [600, 840];
    const url = esc(small ? thumbOf(src) : src);
    return `<img ${defer ? "data-src" : "src"}="${url}"${small ? ` data-full="${esc(src)}"` : ""} alt="" width="${w}" height="${h}"${defer ? "" : ` loading="lazy"`} decoding="async">`;
  }
  function bindArt(root, item) {
    const img = $("img", root);
    if (!img) return;
    img.addEventListener("error", function onError() {
      if (img.dataset.full) { const full = img.dataset.full; delete img.dataset.full; img.src = full; return; }   // no thumbnail -> big image
      img.removeEventListener("error", onError);
      const gc = img.closest(".gc");
      if (gc) gc.classList.add("gc--noart");                                                                       // game card: draw the name (it was in the picture)
      img.parentElement.innerHTML = placeholderArt(item);                                                         // no image -> generated art
    });
  }

  /* ---------- Auras only move on screen (step 9.5) ----------
     Every card from renderCard() is watched; on-screen cards get .is-live and css/fx.css only animates those.
     A card in a hidden tab, scrolled away or detached has no running animation at all.
     W4: the same watcher loads the card's picture (and the pictures of the next / previous NEAR cards in its row or
     grid, so they are there before they scroll in). Every watched card costs the main thread on every scroll frame,
     so a card whose look never loops (Normal big cards, every mini card unless it has a turning grade-10 badge)
     is let go once its picture is loading. setCardRarity() / the grade badge watch it again when that changes. */
  const NEAR = 12;
  const liveIO = "IntersectionObserver" in window
    ? new IntersectionObserver((list) => list.forEach((e) => {
      const el = e.target;
      el.classList.toggle("is-live", e.isIntersecting);
      if (e.isIntersecting) loadNear(el);
      if (!loops(el) && !pending(el)) liveIO.unobserve(el);
    }), { rootMargin: "24px 0px" })
    : null;
  const pending = (el) => !!$(".gc__art img[data-src]", el);
  const loops = (el) => !el.classList.contains("gc") || !!el.querySelector('.gorb[data-band="rainbow"]') ||
    (!el.classList.contains("gc--mini") && el.dataset.rarity !== "Normal");
  // start loading a deferred card picture (artImg defer) · safe to call on any card, any number of times
  function loadArt(el) {
    const img = el && $(".gc__art img[data-src]", el);
    if (!img) return;
    img.src = img.dataset.src;
    delete img.dataset.src;
  }
  function loadNear(el) {
    loadArt(el);
    let node = el;   // a card alone in a wrapper (deck slot, Tier Maker item): its neighbours are the wrapper's
    for (let i = 0; i < 2 && node.parentElement && node.parentElement.childElementCount === 1; i++) node = node.parentElement;
    const near = (sib) => {
      const c = sib.classList.contains("card") ? sib : sib.querySelector(".card");
      if (!c || !pending(c)) return;
      loadArt(c);
      if (!loops(c)) liveIO.unobserve(c);
    };
    for (let i = 0, s = node.nextElementSibling; s && i < NEAR; i++, s = s.nextElementSibling) near(s);
    for (let i = 0, s = node.previousElementSibling; s && i < NEAR; i++, s = s.previousElementSibling) near(s);
  }
  // every watched card, weakly held (a card the page dropped can still be garbage-collected)
  const watched = new Set();
  const seen = new WeakSet();
  let livePaused = false;
  // also "watch again" (W4): calling it twice on one element is fine
  function watchLive(el) {
    if (!liveIO) { el.classList.add("is-live"); loadArt(el); return; }
    if (window.WeakRef && !seen.has(el)) { seen.add(el); watched.add(new WeakRef(el)); }
    if (!livePaused || !el.isConnected || el.closest("#detail")) liveIO.observe(el);
  }
  /* Step 12: while the card detail covers the whole screen, the page underneath is hidden — stop checking its cards
     every frame (the detail's own cards made from now on are still watched). resume = watch them all again. */
  function livePause(on) {
    if (!liveIO || !window.WeakRef || on === livePaused) return;
    livePaused = on;
    if (on) { liveIO.disconnect(); return; }
    for (const ref of watched) { const el = ref.deref(); if (el) liveIO.observe(el); else watched.delete(ref); }
  }

  /* ---------- Lazy tabs (step 9.5) ----------
     lazy(page, fn): run fn the first time that tab is showing (right now if it already is).
     Pages build their cards in it, so no cards are made for a tab nobody has opened. */
  const lazyQ = {};
  function lazy(page, fn) {
    if (state.loaded && state.page === page) fn();
    else (lazyQ[page] = lazyQ[page] || []).push(fn);
  }
  function runLazy(page) {
    const q = lazyQ[page];
    if (!q || !state.loaded) return;
    delete lazyQ[page];
    q.forEach((fn) => fn());
  }

  /* ---------- Game card numbers fit their spot (step 13, §3.5.1) ----------
     A long number shrinks until it fits. Widths are measured on a canvas (no page layout needed, so a card can be
     fitted before it is on the page) and font sizes are in cqw, so the fit holds at every card size.
     [font size cqw, room cqw, font] · room = the box width (pills: max width minus padding). */
  const FIT = { hp: [12.4, 43.2, "num"], atk: [14.2, 57.5, "num"], odds: [5.8, 36.8, "pop"], rar: [4.9, 36.8, "pop"] };
  const fitCache = new Map();
  let fitCtx = null, fitFonts = null;
  function textW(kind, text) {                     // width of the text at font-size 1 (em)
    const key = kind + "|" + text;
    let w = fitCache.get(key);
    if (w !== undefined) return w;
    if (!fitCtx) { const cv = document.createElement("canvas"); fitCtx = cv.getContext && cv.getContext("2d"); }
    if (!fitCtx) return 0;
    if (!fitFonts) { const cs = getComputedStyle(document.documentElement); fitFonts = { num: cs.getPropertyValue("--gc-font-num").trim() || "sans-serif", pop: cs.getPropertyValue("--gc-font-pop").trim() || "sans-serif" }; }
    if (kind === "num") { fitCtx.font = `700 100px ${fitFonts.num}`; w = fitCtx.measureText(text).width / 100 - 0.01 * text.length; }
    else { const t = text.toUpperCase(); fitCtx.font = `italic 400 100px ${fitFonts.pop}`; w = fitCtx.measureText(t).width / 100 + 0.02 * t.length; }
    if (fitCache.size > 4000) fitCache.clear();
    fitCache.set(key, w);
    return w;
  }
  // sample = the text to make room for (while a number counts, the longer of the old and the new value)
  function fitNum(span, key, sample) {
    if (!span) return;
    const [base, room, kind] = FIT[key];
    const need = textW(kind, sample || span.textContent) * base;
    const size = need > room ? Math.floor(base * room / need * 0.97 * 100) / 100 : 0;
    span.style.fontSize = size ? size + "cqw" : "";
  }
  function fitCard(el, samples = {}) {
    ["hp", "atk", "odds", "rar"].forEach((k) => fitNum($(`[data-k="${k}"]`, el), k, samples[k]));
  }
  // the web fonts (Oswald, Bangers) arrive after the first cards: measure again with the real ones
  const supById = (id) => (Array.isArray(state.support) ? state.support.find((x) => x && x.id === id) : null);
  function refitAll() {
    fitCache.clear();
    svFont = "";
    for (const ref of watched) {
      const el = ref.deref(); if (!el) continue;
      fitCard(el);
      if (el.dataset.kind === "support") { const s = supById(el.dataset.id); if (s) fitSupport(el, s); }
    }
  }
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", refitAll);

  /* ---------- Shared card renderer (used by every page) ----------
     The game's own card (§3.5): cleaned picture + HP / 1 IN X / rarity / ATK drawn on top.
     .card = tap / tilt / keyboard · .gc = the look (see css/fx.css). tilt:false = no finger tilt (the detail scene turns its card by itself) */
  function renderCard(card, rarity, { mini = false, tilt = true } = {}) {
    if (isSupport(card)) return renderSupport(card, rarity, { mini, tilt });
    const el = document.createElement("article");
    el.className = "card gc" + (mini ? " card--mini gc--mini" : "") + (card.image ? "" : " gc--noart");
    el.dataset.rarity = rarity;
    el.dataset.id = card.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", cardLabel(card, rarity));
    const atk = statAt(card, "atk", rarity), hp = statAt(card, "hp", rarity);
    el.innerHTML = `
      <span class="gc__glow"></span>
      <div class="gc__art">${card.image ? artImg(card.image, mini, true) : placeholderArt(card)}</div>
      <span class="gc__name">${esc(card.name)}</span>
      <span class="gc__ring"><i></i></span>
      <span class="gc__sweep"></span>
      <span class="gc__hp"><span class="gc__num" data-k="hp" data-value="${hp}">${fmtHp(hp)}</span></span>
      <span class="gc__odds"><span class="gc__pop" data-k="odds">${fmtOdds(oddsAt(card, rarity))}</span></span>
      <span class="gc__rar"><span class="gc__pop" data-k="rar">${esc(rarity)}</span></span>
      <span class="gc__atk"><span class="gc__num" data-k="atk" data-value="${atk}">${fmtStat(atk)}</span></span>
      ${card.mock ? `<span class="gc__mock">mock</span>` : ""}
      <span class="gc__sheen"><span class="card__glare"></span></span>
      <span class="gc__flash"></span>`;
    fitCard(el);
    // missing thumbnail -> big image · missing image file -> the generated art instead of an empty card
    bindArt(el, card);
    if (tilt) FX.tilt(el);
    watchLive(el);
    return el;
  }

  /* ATK / HP shown on a card (the Grade page shows graded values) · animate = count to them (650 ms, §3.5.1) */
  function setCardNums(el, { atk, hp }, { animate = true } = {}) {
    const atkEl = $('[data-k="atk"]', el), hpEl = $('[data-k="hp"]', el);
    const longer = (span, v, f) => { const a = f(v), b = span.textContent; return a.length >= b.length ? a : b; };
    clearTimeout(el._fitT);
    if (animate && !FX.reduced) {
      fitNum(hpEl, "hp", longer(hpEl, hp, fmtHp)); fitNum(atkEl, "atk", longer(atkEl, atk, fmtStat));   // counting never spills out
      FX.countTo(atkEl, atk, { format: fmtStat, duration: 650 });
      FX.countTo(hpEl, hp, { format: fmtHp, duration: 650 });
      el._fitT = setTimeout(() => { fitNum(hpEl, "hp"); fitNum(atkEl, "atk"); }, 700);
    } else {
      atkEl.dataset.value = atk; atkEl.textContent = fmtStat(atk);
      hpEl.dataset.value = hp; hpEl.textContent = fmtHp(hp);
      fitNum(hpEl, "hp"); fitNum(atkEl, "atk");
    }
  }
  const flashCard = (el) => { const f = $(".gc__flash", el); if (f && !FX.reduced) f.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.35 }, { opacity: 0 }], { duration: 400, easing: "cubic-bezier(.2,.8,.2,1)" }); };

  /* Change rarity on an existing card: flash + count numbers to new values.
     animate:false (cards off-screen or not in the page) just swaps the values. */
  function setCardRarity(el, card, rarity, { animate = true } = {}) {
    if (el.dataset.rarity === rarity) return;
    if (isSupport(card)) { setSupportRarity(el, card, rarity, { animate }); return; }
    el.dataset.rarity = rarity;
    el.setAttribute("aria-label", cardLabel(card, rarity));
    const odds = $('[data-k="odds"]', el), rar = $('[data-k="rar"]', el);
    odds.textContent = fmtOdds(oddsAt(card, rarity)); fitNum(odds, "odds");
    rar.textContent = rarity; fitNum(rar, "rar");
    if (animate) flashCard(el);
    setCardNums(el, { atk: statAt(card, "atk", rarity), hp: statAt(card, "hp", rarity) }, { animate });
    // W4: a card let go by the on-screen watcher may loop now · one that stopped looping can be let go
    if (loops(el)) watchLive(el);
    else if (liveIO && !pending(el)) liveIO.unobserve(el);
  }

  /* ---------- Support cards in the game's look (owner 2026-10-28) ----------
     The picture keeps the ability text, but its level-scaling numbers ({0}% {1}% … in effect.desc) are erased by
     tools/support_nums.py, which saves where each one was (effect.pos, cqw: % of the card width · x y w h of the digits,
     gl / gr = the free space left / right of them). The web writes the value for the chosen rarity in the same spot,
     in the same font (Oswald), colour and size; a longer number is squeezed sideways to fit its line (never reflowed).
     The card has the 1 IN X + rarity pills and the rarity frame like a card · no HP / ATK. Odds = the Normal odds. */
  const SV = { cap: 0.82, top: 0.10, w: 600 };   // Oswald: digit height ÷ font size · digits' top under a line-height 1 box · weight
  const supPos = (s) => (s && s.effect && Array.isArray(s.effect.pos) ? s.effect.pos.filter((p) => p && p.h > 0 && supVals(s)[p.i] != null) : []);
  const fmtSv = (v) => v + "%";
  let svCtx = null, svFont = "";
  function svW(text) {                              // text width at font-size 1 (em)
    const key = "sv|" + text;
    let w = fitCache.get(key);
    if (w !== undefined) return w;
    if (!svCtx) { const cv = document.createElement("canvas"); svCtx = cv.getContext && cv.getContext("2d"); }
    if (!svCtx) return 0;
    if (!svFont) svFont = getComputedStyle(document.documentElement).getPropertyValue("--gc-font-text").trim() || "sans-serif";
    svCtx.font = `${SV.w} 100px ${svFont}`;
    w = svCtx.measureText(text).width / 100;
    fitCache.set(key, w);
    return w;
  }
  // squeeze: the Normal value is as wide as the number that was in the picture · a longer one also fits its gaps (70 %)
  function fitSv(span, s, p, sample) {
    const fs = p.h / SV.cap, room = p.w + 1.4 * Math.min(p.gl || 0, p.gr || 0);
    const base = svW(fmtSv(supAt(supVals(s)[p.i], "Normal"))) * fs;
    const k = base > 0 ? Math.max(0.82, Math.min(1.12, p.w / base)) : 1;
    const need = svW(sample || span.textContent) * fs * k;
    const sx = need > room ? k * room / need : k;
    span.style.setProperty("--sx", sx.toFixed(3));
  }
  function supNumsHTML(s, rarity) {
    return supPos(s).map((p) => {
      const fs = p.h / SV.cap, v = supValAt(s, p.i, rarity);
      return `<span class="gc__sv" style="left:${(p.x + p.w / 2).toFixed(2)}cqw;top:${(p.y - SV.top * fs).toFixed(2)}cqw;font-size:${fs.toFixed(2)}cqw"><span class="gc__svn" data-sv="${p.i}" data-value="${v}">${fmtSv(v)}</span></span>`;
    }).join("");
  }
  function fitSupport(el, s, samples = {}) {
    const pos = supPos(s);
    el.querySelectorAll(".gc__svn").forEach((n) => { const p = pos.find((x) => x.i === +n.dataset.sv); if (p) fitSv(n, s, p, samples[p.i]); });
  }
  function renderSupport(s, rarity, { mini = false, tilt = true } = {}) {
    const el = document.createElement("article");
    el.className = "card gc gc--sup" + (mini ? " card--mini gc--mini" : "") + (s.image ? "" : " gc--noart");
    el.dataset.rarity = rarity;
    el.dataset.id = s.id;
    el.dataset.kind = "support";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", cardLabel(s, rarity));
    const odds = Number(s.odds) > 0 ? Number(s.odds) : 0;
    el.innerHTML = `
      <span class="gc__glow"></span>
      <div class="gc__art">${s.image ? artImg(s.image, mini, true) : placeholderArt(s)}</div>
      <span class="gc__name">${esc(s.name)}</span>
      <span class="gc__ring"><i></i></span>
      <span class="gc__sweep"></span>
      ${odds ? `<span class="gc__odds"><span class="gc__pop" data-k="odds">${fmtOdds(odds)}</span></span>` : ""}
      <span class="gc__rar"><span class="gc__pop" data-k="rar">${esc(rarity)}</span></span>
      ${s.image ? supNumsHTML(s, rarity) : ""}
      ${s.mock ? `<span class="gc__mock">mock</span>` : ""}
      <span class="gc__sheen"><span class="card__glare"></span></span>
      <span class="gc__flash"></span>`;
    fitCard(el);
    fitSupport(el, s);
    bindArt(el, s);
    if (tilt) FX.tilt(el);
    watchLive(el);
    return el;
  }
  /* support values at a rarity · animate = count to them (650 ms, like ATK / HP) */
  function setSupportNums(el, s, rarity, { animate = true } = {}) {
    const pos = supPos(s);
    el.querySelectorAll(".gc__svn").forEach((n) => {
      const p = pos.find((x) => x.i === +n.dataset.sv); if (!p) return;
      const v = supValAt(s, p.i, rarity), a = fmtSv(v), b = n.textContent;
      const dec = String(v).includes(".") || b.includes(".");
      if (animate && !FX.reduced) {
        fitSv(n, s, p, a.length >= b.length ? a : b);
        FX.countTo(n, v, { duration: 650, format: (x) => (x === v ? a : fmtSv(dec ? x.toFixed(1) : Math.round(x))) });
        clearTimeout(n._fitT); n._fitT = setTimeout(() => { n.textContent = a; fitSv(n, s, p); }, 700);
      } else { n.dataset.value = v; n.textContent = a; fitSv(n, s, p); }
    });
  }
  function setSupportRarity(el, s, rarity, { animate = true } = {}) {
    el.dataset.rarity = rarity;
    el.setAttribute("aria-label", cardLabel(s, rarity));
    const rar = $('[data-k="rar"]', el);
    if (rar) { rar.textContent = rarity; fitNum(rar, "rar"); }
    if (animate) flashCard(el);
    setSupportNums(el, s, rarity, { animate });
    if (loops(el)) watchLive(el);
    else if (liveIO && !pending(el)) liveIO.unobserve(el);
  }

  /* Rarity chip buttons (the click is handled once for the whole site in js/cards.js) */
  function rarityChipsHTML() {
    return state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-rarity="${esc(r.name)}" aria-pressed="${r.name === state.rarity}" style="--sw:${RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");
  }

  /* 9 rarities don't fit a phone: the chip rows scroll sideways · keep the picked chip in view (owner 2026-10-28) */
  function revealChip(root = document) {
    root.querySelectorAll(".rarity-picker").forEach((row) => {
      const b = row.querySelector('[aria-pressed="true"]');
      if (!b || !row.clientWidth || row.scrollWidth <= row.clientWidth) return;
      const rr = row.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (br.left < rr.left + 16 || br.right > rr.right - 16) row.scrollLeft += br.left - rr.left - (rr.width - br.width) / 2;
    });
  }

  /* ---------- Pages of a card grid (owner 2026-10-28: 30 cards a page, page numbers under the grid) ----------
     pager(box, page, pages): ‹ 1 … 4 5 6 … 14 › into box (hidden with one page) · the click is the page's own
     (data-page = the page to go to, 0-based) · pageTop(grid): scroll back up to the grid's tools after a page change */
  const PAGE_SIZE = 30;
  function pager(box, page, pages) {
    if (!box) return;
    box.hidden = pages < 2;
    if (pages < 2) { box.innerHTML = ""; return; }
    const set = new Set([0, pages - 1, page - 1, page, page + 1].filter((i) => i >= 0 && i < pages));
    const nums = [...set].sort((a, b) => a - b);
    const btn = (i, label, aria, cls = "") => `<button type="button" class="pager__btn fx-press ${cls}" data-page="${i}" aria-label="${aria}"${i === page && !cls ? ' aria-current="page"' : ""}${(cls && (i < 0 || i >= pages)) ? " disabled" : ""}>${label}</button>`;
    let html = btn(page - 1, "‹", "Previous page", "pager__btn--step");
    nums.forEach((i, k) => {
      if (k && i - nums[k - 1] > 1) html += `<span class="pager__gap" aria-hidden="true">…</span>`;
      html += btn(i, String(i + 1), `Page ${i + 1} of ${pages}`);
    });
    html += btn(page + 1, "›", "Next page", "pager__btn--step");
    box.innerHTML = html;
  }
  function pageTop(el) {
    const bar = $(".topbar"), top = bar && bar.getBoundingClientRect().height && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
    const y = el.getBoundingClientRect().top / FX.zoom() + scrollY - top - 12;
    if (y < scrollY) window.scrollTo({ top: Math.max(0, y), behavior: FX.reduced ? "auto" : "smooth" });
  }

  function showSkeletons() {
    $("#card-grid").innerHTML = '<div class="skeleton"></div>'.repeat(4);
  }

  /* ---------- Router ----------
     #tier #cards #deck #grade #traits -> tabs · #support = the Cards tab, Support side
     #card/<id>                    -> card (or support) detail, laid over whichever tab is underneath
     #support/<id> (old links)     -> the Support side + that support's detail
     #grade/<id>/<grades>          -> the grader inside the Grade tab */
  function showPage(page, { scroll = false } = {}) {
    if (!PAGES.includes(page)) page = "tier";
    const changed = state.page !== page;
    // Back from a support detail opened on the Tier List or a deck: put that page back where it was (js/tier.js, js/deck.js saved the position)
    const keep = !scroll && (page === "tier" || page === "deck") && !!(history.state && typeof history.state.tierY === "number");
    const kindChanged = page === "cards" && CBI.cards.kind && CBI.cards.kind() !== state.kind;
    state.page = page;
    document.querySelectorAll(".page").forEach((p) => {
      const on = p.id === "page-" + page;
      if (on && p.hidden) {
        p.hidden = false;
        p.classList.remove("fx-page-in"); void p.offsetWidth; p.classList.add("fx-page-in");
      } else if (!on) p.hidden = true;
    });
    document.querySelectorAll(".nav__btn").forEach((b) => {
      if (b.dataset.page === page) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $(".nav__list").style.setProperty("--i", PAGES.indexOf(page));
    const side = page === "cards" && state.kind === "support" ? "support" : page;
    document.title = PAGE_TITLES[side];   // tab / history / share title follows the page
    store.set(STORE_KEY, side);           // "support" = the Cards tab, Support side (reopens there)
    runLazy(page);   // first visit to this tab: build its cards now (step 9.5)
    if (page === "cards" && state.loaded) CBI.cards.view(state.kind, { animate: kindChanged && !changed });
    if (changed && state.loaded) {
      if (page === "tier") CBI.tier.enter({ restore: keep });
      else if (page === "deck") CBI.deck.enter({ restore: keep });
    }
    if ((changed || scroll) && !keep) window.scrollTo({ top: 0 });
    requestAnimationFrame(() => revealChip());
  }

  const pageFromHash = () => {
    const seg = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (seg === "support") return "cards";
    return PAGES.includes(seg) ? seg : null;
  };
  // the Cards page's side from the hash (#cards / #support) · null = keep the one shown last
  const kindFromHash = () => { const seg = location.hash.replace(/^#\/?/, "").split("/")[0]; return seg === "support" ? "support" : seg === "cards" ? "cards" : null; };

  // #deck = My Decks (list) · #deck/meta = Meta Decks · #deck/my/<id> = one deck's editor · #deck/s/<data> = a shared deck (view only)
  // #tier = Global · #tier/my = My Lists · #tier/s/<data> = a shared list (shown inside My Lists, view only)
  const tierViewFromHash = () => (/^#\/?tier\/(?:my|s)(?:[/?#]|$)/.test(location.hash) ? "my" : "global");

  function route() {
    const m = location.hash.match(/^#\/?card\/([^/?#]+)/);
    if (m) {
      showPage(state.page || "cards");
      if (state.loaded) CBI.detail.open(decodeURIComponent(m[1]));
      return;
    }
    // an old #support/<id> link (the support detail used to live in the Support tab): the Support side + the card detail
    const sm = location.hash.match(/^#\/?support\/([^/?#]+)/);
    if (sm && state.loaded) {
      try { history.replaceState(null, "", "#support"); } catch {}
      route();
      if ((state.support || []).some((x) => x && x.id === decodeURIComponent(sm[1]))) openCard(decodeURIComponent(sm[1]), null, { list: CBI.support.order() });
      return;
    }
    if (state.loaded) CBI.detail.close();
    let first = state.page === null ? store.get(STORE_KEY) || "tier" : "tier";
    if (first === "support") { first = "cards"; if (!location.hash) { try { history.replaceState(null, "", "#support"); } catch {} } }   // reopened on the Support side
    const k = kindFromHash();
    if (k) state.kind = k;
    showPage(pageFromHash() || first);
    if (state.loaded) CBI.tier.show(tierViewFromHash());
    if (state.loaded) CBI.deck.show();   // #deck = My Decks · #deck/meta · #deck/my/<id> = the editor · #deck/s/<data> = a shared deck
    // #grade/<id>[/<atk>-<def>-<status>-<hp>] = grader inside the Grade tab · any other hash = back to the card picker
    const gm = location.hash.match(/^#\/?grade\/([^/?#]+)(?:\/([0-9-]+))?/);
    if (state.loaded) CBI.grade.show(gm ? decodeURIComponent(gm[1]) : null, gm ? gm[2] : null);
  }

  // Tab buttons: no history entries, same as before · tapping a tab always lands on its list (Tier List = Global)
  // W6: on a PC the left menu stays usable over the card detail → a tab there closes the card (its history entry becomes the tab)
  // W8: the card sits on top of its wheel entry → step back to the first card entry, then it becomes the tab (popstate below)
  let leaveTo = null;
  function go(page) {
    const fromCard = /^#\/?card\//.test(location.hash);
    const depth = (fromCard && history.state && history.state.depth) || 0;
    const h = page === "cards" && state.kind === "support" ? "support" : page;   // the Cards tab reopens on the side shown last
    showPage(page, { scroll: true });
    if (depth > 1) { leaveTo = h; history.go(1 - depth); }
    else if (location.hash !== "#" + h) history.replaceState(null, "", "#" + h);
    if (fromCard && state.loaded) CBI.detail.close();
    if (state.loaded) { CBI.grade.show(null, null, { restore: false }); CBI.tier.show("global"); CBI.deck.show(); }
  }

  /* Card detail: each open pushes history entries so the phone's Back button walks out of it.
     W8: two entries with the same #card/<id>: {v:"wheel"} under {v:"card"} → Back = the card wheel, Back again = the page.
     wd = the wheel entry's depth (depth = entries above the page). A card opened from inside the detail (a card in the
     Details) adds one more {v:"card"} over the same wheel.
     The entries also keep the list of cards it was opened from (cl), so swiping left / right in the detail walks
     that list (Cards grid order, a tier row board, a Tier Maker list, a deck…). opts.list overrides it. */
  function openCard(id, originEl, opts = {}) {
    state.origin = originEl || null;
    const auto = CBI.detail.listFor ? CBI.detail.listFor(originEl, id) : null;   // also remembers where to fly back to
    const list = opts.list || auto;
    const prev = history.state || {}, url = "#card/" + encodeURIComponent(id);
    let depth = (prev.depth || 0) + 1, wd = prev.wd;
    const cl = list && list.length > 1 && list.length <= 3000 ? { cl: list } : {};
    if (!(/^#\/?card\//.test(location.hash) && prev.v && wd > 0)) {
      wd = depth;
      history.pushState({ depth, wd, v: "wheel", ...cl }, "", url);
      depth++;
    }
    history.pushState({ depth, wd, v: "card", ...cl }, "", url);
    route();
  }
  // Swipe in the detail: same history entry, new card (Back still closes the detail in one step)
  function swapCard(id) {
    try { history.replaceState({ ...(history.state || {}) }, "", "#card/" + encodeURIComponent(id)); } catch {}
  }
  function closeCard() {
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) history.go(-depth);
    else { history.replaceState(null, "", "#" + (state.page === "cards" && state.kind === "support" ? "support" : state.page || "cards")); route(); }
  }

  /* ---------- Boot ---------- */
  async function boot() {
    FX.press(document);
    FX.backdrop($("#backdrop"));   // step 9.6b: the night city (was FX.starfield)

    document.querySelector(".nav").addEventListener("click", (e) => {
      const b = e.target.closest(".nav__btn");
      if (b) go(b.dataset.page);
    });
    window.addEventListener("hashchange", route);
    // W8: go() stepped back out of a card → that entry becomes the tab (the same hash = no hashchange, so do it here)
    window.addEventListener("popstate", () => {
      if (!leaveTo) return;
      const p = leaveTo; leaveTo = null;
      history.replaceState(null, "", "#" + p);
      route();
    });

    showSkeletons();
    route();

    try {
      const [meta, cards, support, teams, traits] = await Promise.all([
        loadJSON("data/meta.json"),
        loadJSON("data/cards.json"),
        loadJSON("data/support.json").catch(() => []),   // support cards (step 4); the page copes without it
        loadJSON("data/teams.json").catch(() => []),     // Meta Decks; the page copes without it
        loadJSON("data/traits.json").catch(() => null),  // Trait Shop (js/traits.js); the site copes without it
      ]);
      state.meta = meta; state.cards = cards; state.support = support; state.teams = teams; state.traits = traits;
      if (Array.isArray(support)) support.forEach((x) => { if (x && x.id) { x.kind = "support"; if (!x.name) x.name = x.id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); } });
      topOnly(cards, (c) => c.scores && c.scores.overall);
      topOnly(support, (s) => s.scores && s.scores.value);
    } catch (err) {
      console.error(err);
      $("#card-grid").innerHTML = "";
      $("#data-error").hidden = false;
      hideBoot();
      return;
    }
    const savedRarity = store.get(RARITY_KEY);
    if (state.meta.rarities.some((r) => r.name === savedRarity)) state.rarity = savedRarity;

    const d = new Date(state.meta.updated + "T00:00:00");
    const when = "Updated " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    document.querySelectorAll("[data-updated]").forEach((el) => {   // top bar + PC menu rail
      el.textContent = when;
      el.setAttribute("title", "Data last updated " + state.meta.updated);
    });

    state.loaded = true;
    CBI.traits.init();   // first: the deck list's team scores read the user's traits
    CBI.tier.init();
    CBI.deck.init();
    CBI.cards.init();
    CBI.detail.init();
    CBI.support.init();
    CBI.grade.init();
    route();   // opens a #card/<id>, #support/<id> or #grade/<id> deep link now that the data is here
    hideBoot();
    setTimeout(FX.probe, 800);   // lite mode check: 2 s of frames once the first page has settled (step 9.5)
    setTimeout(() => CBI.detail.prewarm(), 3600);   // paint the detail scene while idle, after the probe (step 12)
  }

  /* Boot screen (crest + pocket watch, step 9.6b): fades out once the data is in and the fonts are ready
     (at most 1.2 s wait for fonts). base.css also hides it by itself after 8 s, so it can never get stuck. */
  function hideBoot() {
    const el = $("#boot");
    if (!el || el.classList.contains("is-out")) return;
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 1200))]).then(() => {
      el.classList.add("is-out");
      el.setAttribute("aria-hidden", "true");
      setTimeout(() => el.remove(), 600);
    });
  }

  const CBI = window.CBI = {
    state, $, esc, store, TIER_COLOR, RARITY_SWATCH, RARITY_KEY,
    renderCard, setCardRarity, setCardNums, flashCard, fitCard, statAt, oddsAt, fmtOdds, fmtStat, fmtHp, fmtKey, isRanked, rankTop, supValue, supText, supLevelMult, rarityOf, placeholderArt, rarityChipsHTML, revealChip, hash,
    isSupport, supAt, supValAt, supVals, supNumsHTML, fitSupport, setSupportNums,   // support cards in the game's look (2026-10-28)
    openCard, closeCard, swapCard, route,
    lazy, artImg, bindArt, watchLive, livePause, loadArt,   // step 9.5 · livePause step 12 · loadArt W4
    PAGE_SIZE, pager, pageTop,   // pages of the Cards / Support grids (2026-10-28)
    cards: { init() {}, setRarity() {}, order() { return []; }, view() {}, kind() { return "cards"; } },   // replaced by js/cards.js
    detail: { init() {}, open() {}, close() {}, prewarm() {} },     // replaced by js/detail.js
    tier: { init() {}, enter() {}, show() {} },      // replaced by js/tier.js
    deck: { init() {}, enter() {}, show() {} },        // replaced by js/deck.js
    support: { init() {}, order() { return []; }, open() {} },   // replaced by js/support.js
    grade: { init() {}, show() {}, panelHTML() { return ""; }, supPanelHTML() { return ""; }, mountSlabs() {} },   // replaced by js/grade.js
    traits: { init() {}, of() { return null; }, map() { return {}; }, power() { return 0; }, panelHTML() { return ""; }, mountPanel() {} },   // replaced by js/traits.js
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
