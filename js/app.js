/* ==========================================================
   Card Battle Infinity — app core
   Router (5 tabs + card detail hash) · data loading · shared card renderer
   The Cards page (search / filters / sort) lives in js/cards.js · the card detail ("Black Sun" scene) in js/detail.js
   The Tier List page (Global cards / support + My Lists) lives in js/tier.js
   The Deck page (Meta Decks, later the deck builder) lives in js/deck.js
   The Support page (list + #support/<id> detail) lives in js/support.js
   The Grade page (card picker + #grade/<id>/<grades> grader) lives in js/grade.js
   Save image / share link / backup (shared by Tier Maker and Deck) live in js/share.js
   ========================================================== */
(function () {
  const PAGES = ["tier", "cards", "support", "deck", "grade"];
  const PAGE_TITLES = {
    tier: "Card Battle Infinity — Tier List & Card Database",
    cards: "Cards — Card Battle Infinity",
    support: "Support — Card Battle Infinity",
    deck: "Deck — Card Battle Infinity",
    grade: "Card Grader — Card Battle Infinity",
  };
  const STORE_KEY = "cbi:lastPage";
  const RARITY_KEY = "cbi:rarity";
  const TIER_COLOR = { GOD: "--t-god", SS: "--t-ss", S: "--t-s", A: "--t-a", B: "--t-b", C: "--t-c", D: "--t-d" };
  const RARITY_SWATCH = {
    Normal: "var(--r-normal)", Shiny: "var(--r-shiny)",
    Rainbow: "linear-gradient(135deg,#e8607a,#e9a75a,#7fd39a,#69b9e0,#8a7be0)",
    Secret: "var(--r-secret)", Divine: "var(--r-divine-2)",
    Cosmic: "linear-gradient(135deg,var(--r-cosmic),var(--r-cosmic-2))",
    Ascended: "linear-gradient(135deg,#a9eef5,#c5a8f5,#f5b4dc,#f8e7a8)",
  };

  // page: current tab · loaded: data ready · origin: element a card detail should grow from
  const state = { meta: null, cards: [], support: [], teams: [], rarity: "Normal", page: null, loaded: false, origin: null };
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

  /* ---------- Number helpers ---------- */
  function rarityOf(name) { return state.meta.rarities.find((r) => r.name === name) || state.meta.rarities[0]; }
  function statAt(card, key, rarity) {
    const exact = card.exact && card.exact[rarity] && card.exact[rarity][key];
    if (exact) return exact;
    return Math.round(card.base[key] * rarityOf(rarity).stat);
  }
  function oddsAt(card, rarity) { return card.base.odds * rarityOf(rarity).odds; }
  function shortNum(n) {
    const fmt = (v, s) => Number(v.toFixed(2)) + s;
    if (n >= 1e9) return fmt(n / 1e9, "B");
    if (n >= 1e6) return fmt(n / 1e6, "M");
    if (n >= 1e3) return fmt(n / 1e3, "K");
    return String(n);
  }
  const fmtOdds = (n) => "1 in " + shortNum(n);
  const fmtStat = (n) => Math.round(n).toLocaleString("en-US");

  /* A card is "ranked" once it has been analysed (scores.overall > 0 and a tier).
     New cards added in routine A are unranked until routine B scores them. */
  const isRanked = (card) => !!(card.scores && card.scores.overall > 0 && card.tier);
  const cardLabel = (card, rarity) => `${card.name}, ${rarity}${isRanked(card) ? ", tier " + card.tier : ", not ranked yet"}`;

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
     image, and if that is missing too, to the generated art. Routine A makes both files (§7). */
  const thumbOf = (src) => { const i = src.lastIndexOf("/"); return src.slice(0, i + 1) + "thumb/" + src.slice(i + 1); };
  function artImg(src, small = false) {
    const [w, h] = small ? [300, 420] : [600, 840];
    return `<img src="${esc(small ? thumbOf(src) : src)}"${small ? ` data-full="${esc(src)}"` : ""} alt="" width="${w}" height="${h}" loading="lazy" decoding="async">`;
  }
  function bindArt(root, item) {
    const img = $("img", root);
    if (!img) return;
    img.addEventListener("error", function onError() {
      if (img.dataset.full) { const full = img.dataset.full; delete img.dataset.full; img.src = full; return; }   // no thumbnail -> big image
      img.removeEventListener("error", onError);
      img.parentElement.innerHTML = placeholderArt(item);                                                         // no image -> generated art
    });
  }

  /* ---------- Auras only move on screen (step 9.5) ----------
     Every card from renderCard() is watched; on-screen cards get .is-live and css/fx.css only animates those.
     A card in a hidden tab, scrolled away or detached has no running animation at all. */
  const liveIO = "IntersectionObserver" in window
    ? new IntersectionObserver((list) => list.forEach((e) => e.target.classList.toggle("is-live", e.isIntersecting)), { rootMargin: "24px 0px" })
    : null;
  // every watched card, weakly held (a card the page dropped can still be garbage-collected)
  const watched = new Set();
  let livePaused = false;
  function watchLive(el) {
    if (!liveIO) { el.classList.add("is-live"); return; }
    if (window.WeakRef) watched.add(new WeakRef(el));
    liveIO.observe(el);
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

  /* ---------- Shared card renderer (used by every page) ---------- */
  // tilt:false = no finger tilt (the detail scene turns its card by itself)
  function renderCard(card, rarity, { mini = false, tilt = true } = {}) {
    const el = document.createElement("article");
    el.className = "card" + (mini ? " card--mini" : "");
    el.dataset.rarity = rarity;
    el.dataset.id = card.id;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", cardLabel(card, rarity));
    const ranked = isRanked(card);
    if (ranked) el.style.setProperty("--tc", `var(${TIER_COLOR[card.tier] || "--t-d"})`);
    const atk = statAt(card, "atk", rarity), hp = statAt(card, "hp", rarity);
    el.innerHTML = `
      <span class="card__halo"></span>
      <div class="card__frame"><div class="card__body">
        <div class="card__art">${card.image ? artImg(card.image, mini) : placeholderArt(card)}</div>
        <span class="card__stars"></span>
        <span class="card__sweep"></span>
        <span class="card__tag">${esc(rarity)}</span>
        ${ranked ? (String(card.tier).length > 2 ? `<span class="card__tier card__tier--long"><span>${esc(card.tier)}</span></span>` : `<span class="card__tier">${esc(card.tier)}</span>`) : ""}
        <div class="card__info">
          <div class="card__name">${esc(card.name)}</div>
          <div class="card__series">${esc(card.series)}</div>
          <div class="card__stats">
            <span class="card__stat--atk"><b>ATK</b><span data-k="atk" data-value="${atk}">${fmtStat(atk)}</span></span>
            <span class="card__stat--hp"><b>HP</b><span data-k="hp" data-value="${hp}">${fmtStat(hp)}</span></span>
          </div>
          <div class="card__odds" data-k="odds">${fmtOdds(oddsAt(card, rarity))}</div>
        </div>
        ${card.mock ? `<span class="card__mock">mock</span>` : ""}
        <span class="card__glare"></span>
        <span class="card__flash"></span>
      </div><span class="card__orn"></span></div>
      <span class="card__particles"><i></i><i></i><i></i><i></i><i></i></span>`;
    // missing thumbnail -> big image · missing image file -> the generated art instead of an empty card
    bindArt(el, card);
    if (tilt) FX.tilt(el);
    watchLive(el);
    return el;
  }

  /* Change rarity on an existing card: flash + count numbers to new values.
     animate:false (cards off-screen or not in the page) just swaps the values. */
  function setCardRarity(el, card, rarity, { animate = true } = {}) {
    if (el.dataset.rarity === rarity) return;
    el.dataset.rarity = rarity;
    el.setAttribute("aria-label", cardLabel(card, rarity));
    $(".card__tag", el).textContent = rarity;
    const atkEl = $('[data-k="atk"]', el), hpEl = $('[data-k="hp"]', el);
    const atk = statAt(card, "atk", rarity), hp = statAt(card, "hp", rarity);
    if (animate) {
      if (!FX.reduced) $(".card__flash", el).animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.35 }, { opacity: 0 }], { duration: 400, easing: "cubic-bezier(.2,.8,.2,1)" });
      FX.countTo(atkEl, atk, { format: fmtStat });
      FX.countTo(hpEl, hp, { format: fmtStat });
    } else {
      atkEl.dataset.value = atk; atkEl.textContent = fmtStat(atk);
      hpEl.dataset.value = hp; hpEl.textContent = fmtStat(hp);
    }
    $('[data-k="odds"]', el).textContent = fmtOdds(oddsAt(card, rarity));
  }

  /* Rarity chip buttons (the click is handled once for the whole site in js/cards.js) */
  function rarityChipsHTML() {
    return state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-rarity="${esc(r.name)}" aria-pressed="${r.name === state.rarity}" style="--sw:${RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");
  }

  function showSkeletons() {
    $("#card-grid").innerHTML = '<div class="skeleton"></div>'.repeat(4);
  }

  /* ---------- Router ----------
     #tier #cards #support #deck #grade  -> tabs
     #card/<id>                    -> card detail, laid over whichever tab is underneath
     #support/<id> · #grade/<id>/<grades> -> detail views inside their own tab */
  function showPage(page, { scroll = false } = {}) {
    if (!PAGES.includes(page)) page = "tier";
    const changed = state.page !== page;
    // Back from a support detail opened on the Tier List or a deck: put that page back where it was (js/tier.js, js/deck.js saved the position)
    const keep = !scroll && (page === "tier" || page === "deck") && !!(history.state && typeof history.state.tierY === "number");
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
    document.title = PAGE_TITLES[page];   // tab / history / share title follows the page
    store.set(STORE_KEY, page);
    runLazy(page);   // first visit to this tab: build its cards now (step 9.5)
    if (changed && state.loaded) {
      if (page === "tier") CBI.tier.enter({ restore: keep });
      else if (page === "deck") CBI.deck.enter({ restore: keep });
    }
    if ((changed || scroll) && !keep) window.scrollTo({ top: 0 });
  }

  const pageFromHash = () => {
    const seg = location.hash.replace(/^#\/?/, "").split("/")[0];
    return PAGES.includes(seg) ? seg : null;
  };

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
    if (state.loaded) CBI.detail.close();
    showPage(pageFromHash() || (state.page === null ? store.get(STORE_KEY) || "tier" : "tier"));
    if (state.loaded) CBI.tier.show(tierViewFromHash());
    if (state.loaded) CBI.deck.show();   // #deck = My Decks · #deck/meta · #deck/my/<id> = the editor · #deck/s/<data> = a shared deck
    // #support/<id> = support detail inside the Support tab · any other hash = back to the support list
    const sm = location.hash.match(/^#\/?support\/([^/?#]+)/);
    if (state.loaded) CBI.support.show(sm ? decodeURIComponent(sm[1]) : null);
    // #grade/<id>[/<atk>-<def>-<status>-<hp>] = grader inside the Grade tab · any other hash = back to the card picker
    const gm = location.hash.match(/^#\/?grade\/([^/?#]+)(?:\/([0-9-]+))?/);
    if (state.loaded) CBI.grade.show(gm ? decodeURIComponent(gm[1]) : null, gm ? gm[2] : null);
  }

  // Tab buttons: no history entries, same as before · tapping a tab always lands on its list (Tier List = Global)
  function go(page) {
    showPage(page, { scroll: true });
    if (location.hash !== "#" + page) history.replaceState(null, "", "#" + page);
    if (state.loaded) { CBI.support.show(null, { restore: false }); CBI.grade.show(null, null, { restore: false }); CBI.tier.show("global"); CBI.deck.show(); }
  }

  /* Card detail: each open pushes a history entry so the phone's Back button closes it.
     The entry also keeps the list of cards it was opened from (cl), so swiping left / right in the detail walks
     that list (Cards grid order, a tier row board, a Tier Maker list, a deck…). opts.list overrides it. */
  function openCard(id, originEl, opts = {}) {
    state.origin = originEl || null;
    const auto = CBI.detail.listFor ? CBI.detail.listFor(originEl, id) : null;   // also remembers where to fly back to
    const list = opts.list || auto;
    const depth = ((history.state && history.state.depth) || 0) + 1;
    const st = { depth };
    if (list && list.length > 1 && list.length <= 3000) st.cl = list;
    history.pushState(st, "", "#card/" + encodeURIComponent(id));
    route();
  }
  // Swipe in the detail: same history entry, new card (Back still closes the detail in one step)
  function swapCard(id) {
    try { history.replaceState({ ...(history.state || {}) }, "", "#card/" + encodeURIComponent(id)); } catch {}
  }
  function closeCard() {
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) history.go(-depth);
    else { history.replaceState(null, "", "#" + (state.page || "cards")); route(); }
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

    showSkeletons();
    route();

    try {
      const [meta, cards, support, teams] = await Promise.all([
        loadJSON("data/meta.json"),
        loadJSON("data/cards.json"),
        loadJSON("data/support.json").catch(() => []),   // support cards (step 4); the page copes without it
        loadJSON("data/teams.json").catch(() => []),     // Meta Decks; the page copes without it
      ]);
      state.meta = meta; state.cards = cards; state.support = support; state.teams = teams;
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
    renderCard, setCardRarity, statAt, oddsAt, fmtOdds, fmtStat, isRanked, rarityOf, placeholderArt, rarityChipsHTML, hash,
    openCard, closeCard, swapCard, route,
    lazy, artImg, bindArt, watchLive, livePause,   // step 9.5 · livePause step 12
    cards: { init() {}, setRarity() {}, order() { return []; } },   // replaced by js/cards.js
    detail: { init() {}, open() {}, close() {}, prewarm() {} },     // replaced by js/detail.js
    tier: { init() {}, enter() {}, show() {} },      // replaced by js/tier.js
    deck: { init() {}, enter() {}, show() {} },        // replaced by js/deck.js
    support: { init() {}, show() {} },              // replaced by js/support.js
    grade: { init() {}, show() {}, panelHTML() { return ""; } },   // replaced by js/grade.js
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
