/* ==========================================================
   Card Battle Infinity — app core
   Router (5 tabs + card detail hash) · data loading · shared card renderer
   The Cards page (search / filters / sort) and the card detail view live in js/cards.js
   The Tier List page (Global cards / support + My Lists) lives in js/tier.js
   The Deck page (Meta Decks, later the deck builder) lives in js/deck.js
   The Support page (list + #support/<id> detail) lives in js/support.js
   The Grade page (card picker + #grade/<id>/<grades> grader) lives in js/grade.js
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
  const TIER_COLOR = { SS: "--t-ss", S: "--t-s", A: "--t-a", B: "--t-b", C: "--t-c", D: "--t-d" };
  const RARITY_SWATCH = {
    Normal: "var(--r-normal)", Shiny: "var(--r-shiny)",
    Rainbow: "linear-gradient(135deg,#ff4d6d,#ffb84d,#5dff9b,#4dd8ff,#b06bff)",
    Secret: "var(--r-secret)", Divine: "var(--r-divine-2)",
    Cosmic: "linear-gradient(135deg,var(--r-cosmic),var(--r-cosmic-2))",
    Ascended: "linear-gradient(135deg,#8ff7ff,#b98cff,#ff9de2,#fff2a8)",
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

  /* ---------- Placeholder art (until real images exist) ---------- */
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  let artSeq = 0;
  function placeholderArt(card) {
    const uid = card.id.replace(/[^a-z0-9]/gi, "") + "-" + (artSeq++);
    const h = hash(card.id) % 360, h2 = (h + 60) % 360;
    const initials = esc(card.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase());
    return `<svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${h} 70% 32%)"/><stop offset="1" stop-color="hsl(${h2} 65% 12%)"/>
        </linearGradient>
        <radialGradient id="r${uid}" cx=".5" cy=".38" r=".5">
          <stop offset="0" stop-color="hsl(${h} 90% 70% / .55)"/><stop offset="1" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#g${uid})"/>
      <circle cx="50" cy="52" r="46" fill="url(#r${uid})"/>
      <path d="M50 22 L74 52 L50 82 L26 52 Z" fill="none" stroke="hsl(${h} 90% 80% / .35)" stroke-width="1"/>
      <path d="M50 30 L66 52 L50 74 L34 52 Z" fill="hsl(${h} 90% 80% / .08)" stroke="hsl(${h} 90% 85% / .5)" stroke-width=".6"/>
      <text x="50" y="58" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-weight="700" font-size="17" fill="hsl(${h} 100% 92% / .9)">${initials}</text>
    </svg>`;
  }

  /* ---------- Shared card renderer (used by every page) ---------- */
  function renderCard(card, rarity, { mini = false } = {}) {
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
        <div class="card__art">${card.image ? `<img src="${esc(card.image)}" alt="" loading="lazy" decoding="async">` : placeholderArt(card)}</div>
        <span class="card__stars"></span>
        <span class="card__sweep"></span>
        <span class="card__tag">${esc(rarity)}</span>
        ${ranked ? `<span class="card__tier">${esc(card.tier)}</span>` : ""}
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
      </div></div>
      <span class="card__particles"><i></i><i></i><i></i><i></i><i></i></span>`;
    // missing image file -> fall back to the generated art instead of an empty card
    const img = $("img", el);
    if (img) img.addEventListener("error", () => { img.parentElement.innerHTML = placeholderArt(card); }, { once: true });
    FX.tilt(el);
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
     #tier #cards #support #grade  -> tabs
     #card/<id>                    -> card detail, laid over whichever tab is underneath
     #support/<id> · #grade/<id>/<grades> -> detail views inside their own tab */
  function showPage(page, { scroll = false } = {}) {
    if (!PAGES.includes(page)) page = "tier";
    const changed = state.page !== page;
    // Back from a support detail opened on the Tier List: put the Tier List back where it was (js/tier.js saved the position)
    const keep = !scroll && page === "tier" && !!(history.state && typeof history.state.tierY === "number");
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
    if (changed && state.loaded) {
      if (page === "tier") CBI.tier.enter({ restore: keep });
      else if (page === "deck") CBI.deck.enter();
    }
    if ((changed || scroll) && !keep) window.scrollTo({ top: 0 });
  }

  const pageFromHash = () => {
    const seg = location.hash.replace(/^#\/?/, "").split("/")[0];
    return PAGES.includes(seg) ? seg : null;
  };

  // #tier = Global · #tier/my = My Lists
  const tierViewFromHash = () => (/^#\/?tier\/my(?:[/?#]|$)/.test(location.hash) ? "my" : "global");

  function route() {
    const m = location.hash.match(/^#\/?card\/([^/?#]+)/);
    if (m) {
      showPage(state.page || "cards");
      if (state.loaded) CBI.cards.open(decodeURIComponent(m[1]));
      return;
    }
    if (state.loaded) CBI.cards.close();
    showPage(pageFromHash() || (state.page === null ? store.get(STORE_KEY) || "tier" : "tier"));
    if (state.loaded) CBI.tier.show(tierViewFromHash());
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
    if (state.loaded) { CBI.support.show(null, { restore: false }); CBI.grade.show(null, null, { restore: false }); CBI.tier.show("global"); }
  }

  // Card detail: each open pushes a history entry so the phone's Back button closes it
  function openCard(id, originEl) {
    state.origin = originEl || null;
    const depth = ((history.state && history.state.depth) || 0) + 1;
    history.pushState({ depth }, "", "#card/" + encodeURIComponent(id));
    route();
  }
  function closeCard() {
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) history.go(-depth);
    else { history.replaceState(null, "", "#" + (state.page || "cards")); route(); }
  }

  /* ---------- Boot ---------- */
  async function boot() {
    FX.press(document);
    FX.starfield($("#starfield"));

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
      return;
    }
    const savedRarity = store.get(RARITY_KEY);
    if (state.meta.rarities.some((r) => r.name === savedRarity)) state.rarity = savedRarity;

    const d = new Date(state.meta.updated + "T00:00:00");
    $("#updated").textContent = "Updated " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    $("#updated").parentElement.setAttribute("title", "Data last updated " + state.meta.updated);

    state.loaded = true;
    CBI.tier.init();
    CBI.deck.init();
    CBI.cards.init();
    CBI.support.init();
    CBI.grade.init();
    route();   // opens a #card/<id>, #support/<id> or #grade/<id> deep link now that the data is here
  }

  const CBI = window.CBI = {
    state, $, esc, store, TIER_COLOR, RARITY_SWATCH, RARITY_KEY,
    renderCard, setCardRarity, statAt, oddsAt, fmtOdds, fmtStat, isRanked, rarityOf, placeholderArt, rarityChipsHTML,
    openCard, closeCard, route,
    cards: { init() {}, open() {}, close() {} },   // replaced by js/cards.js
    tier: { init() {}, enter() {}, show() {} },      // replaced by js/tier.js
    deck: { init() {}, enter() {} },                 // replaced by js/deck.js
    support: { init() {}, show() {} },              // replaced by js/support.js
    grade: { init() {}, show() {}, panelHTML() { return ""; } },   // replaced by js/grade.js
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
