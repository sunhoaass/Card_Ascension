/* ==========================================================
   Card Battle Infinity — app core
   Router (4 tabs + card detail hash) · data loading · shared card renderer
   The Cards page (search / filters / sort) and the card detail view live in js/cards.js
   The Tier List page and Meta Decks live in js/tier.js
   ========================================================== */
(function () {
  const PAGES = ["tier", "cards", "support", "grade"];
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

  function showSkeletons() {
    $("#card-grid").innerHTML = '<div class="skeleton"></div>'.repeat(4);
  }

  /* ---------- Router ----------
     #tier #cards #support #grade  -> tabs
     #card/<id>                    -> card detail, laid over whichever tab is underneath */
  function showPage(page, { scroll = false } = {}) {
    if (!PAGES.includes(page)) page = "tier";
    const changed = state.page !== page;
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
    store.set(STORE_KEY, page);
    if (changed && page === "tier" && state.loaded) CBI.tier.enter();
    if (changed || scroll) window.scrollTo({ top: 0 });
  }

  const pageFromHash = () => {
    const seg = location.hash.replace(/^#\/?/, "").split("/")[0];
    return PAGES.includes(seg) ? seg : null;
  };

  function route() {
    const m = location.hash.match(/^#\/?card\/([^/?#]+)/);
    if (m) {
      showPage(state.page || "cards");
      if (state.loaded) CBI.cards.open(decodeURIComponent(m[1]));
      return;
    }
    if (state.loaded) CBI.cards.close();
    showPage(pageFromHash() || (state.page === null ? store.get(STORE_KEY) || "tier" : "tier"));
  }

  // Tab buttons: no history entries, same as before
  function go(page) {
    showPage(page, { scroll: true });
    if (location.hash !== "#" + page) history.replaceState(null, "", "#" + page);
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
        loadJSON("data/support.json").catch(() => []),   // added in step 4
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
    CBI.cards.init();
    route();   // opens a #card/<id> deep link now that the data is here
  }

  const CBI = window.CBI = {
    state, $, esc, store, TIER_COLOR, RARITY_SWATCH, RARITY_KEY,
    renderCard, setCardRarity, statAt, oddsAt, fmtOdds, fmtStat, isRanked, rarityOf,
    openCard, closeCard,
    cards: { init() {}, open() {}, close() {} },   // replaced by js/cards.js
    tier: { init() {}, enter() {} },                // replaced by js/tier.js
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
