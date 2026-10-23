/* ==========================================================
   Card Battle Infinity — app shell
   Router (4 tabs) · data loading · shared card renderer
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

  const state = { meta: null, cards: [], rarity: "Normal" };
  const $ = (s, r = document) => r.querySelector(s);

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

  /* ---------- Placeholder art (until real images exist) ---------- */
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  let artSeq = 0;
  function placeholderArt(card) {
    const uid = card.id + "-" + (artSeq++);
    const h = hash(card.id) % 360, h2 = (h + 60) % 360;
    const initials = card.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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
    el.setAttribute("aria-label", `${card.name}, ${rarity}, tier ${card.tier}`);
    if (card.tier) el.style.setProperty("--tc", `var(${TIER_COLOR[card.tier] || "--t-d"})`);
    const atk = statAt(card, "atk", rarity), hp = statAt(card, "hp", rarity);
    el.innerHTML = `
      <span class="card__halo"></span>
      <div class="card__frame"><div class="card__body">
        <div class="card__art">${card.image ? `<img src="${card.image}" alt="" loading="lazy" decoding="async">` : placeholderArt(card)}</div>
        <span class="card__stars"></span>
        <span class="card__sweep"></span>
        <span class="card__tag">${rarity}</span>
        ${card.tier ? `<span class="card__tier">${card.tier}</span>` : ""}
        <div class="card__info">
          <div class="card__name">${card.name}</div>
          <div class="card__series">${card.series || ""}</div>
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
    FX.tilt(el);
    return el;
  }

  /* Change rarity on an existing card: flash + count numbers to new values */
  function setCardRarity(el, card, rarity) {
    if (el.dataset.rarity === rarity) return;
    el.dataset.rarity = rarity;
    el.setAttribute("aria-label", `${card.name}, ${rarity}, tier ${card.tier}`);
    $(".card__tag", el).textContent = rarity;
    el.classList.remove("is-shifting"); void el.offsetWidth; el.classList.add("is-shifting");
    FX.countTo($('[data-k="atk"]', el), statAt(card, "atk", rarity), { format: fmtStat });
    FX.countTo($('[data-k="hp"]', el), statAt(card, "hp", rarity), { format: fmtStat });
    $('[data-k="odds"]', el).textContent = fmtOdds(oddsAt(card, rarity));
  }

  /* ---------- Pages ---------- */
  function renderTier() {
    const list = $("#tier-list");
    list.innerHTML = "";
    state.meta.tiers.forEach((t) => {
      const row = document.createElement("section");
      row.className = "tier-row glass";
      row.style.setProperty("--tc", `var(${TIER_COLOR[t.name]})`);
      row.setAttribute("aria-label", `Tier ${t.name}`);
      const cards = state.cards.filter((c) => c.tier === t.name).sort((a, b) => b.scores.overall - a.scores.overall);
      row.innerHTML = `<div class="tier-row__label">${t.name}</div><div class="tier-row__cards"></div>`;
      const wrap = $(".tier-row__cards", row);
      if (cards.length) cards.forEach((c) => wrap.appendChild(renderCard(c, "Normal", { mini: true })));
      else wrap.innerHTML = `<p class="tier-row__empty">No cards in this tier yet</p>`;
      list.appendChild(row);
    });
    FX.stagger(list);
  }

  function renderRarityPicker() {
    const picker = $("#rarity-picker");
    picker.innerHTML = "";
    state.meta.rarities.forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip glass fx-press";
      b.dataset.rarity = r.name;
      b.setAttribute("aria-pressed", String(r.name === state.rarity));
      b.style.setProperty("--sw", RARITY_SWATCH[r.name]);
      b.innerHTML = `<span class="chip__swatch"></span>${r.name}`;
      picker.appendChild(b);
    });
    picker.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      state.rarity = b.dataset.rarity;
      store.set(RARITY_KEY, state.rarity);
      picker.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      document.querySelectorAll("#card-grid .card").forEach((el) => {
        const card = state.cards.find((c) => c.id === el.dataset.id);
        setCardRarity(el, card, state.rarity);
      });
    });
  }

  function renderCards() {
    const grid = $("#card-grid");
    grid.innerHTML = "";
    [...state.cards].sort((a, b) => b.scores.overall - a.scores.overall)
      .forEach((c) => grid.appendChild(renderCard(c, state.rarity)));
  }

  function showSkeletons() {
    $("#card-grid").innerHTML = '<div class="skeleton"></div>'.repeat(4);
  }

  /* ---------- Router ---------- */
  function go(page, { push = true } = {}) {
    if (!PAGES.includes(page)) page = "tier";
    const idx = PAGES.indexOf(page);
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
    $(".nav__list").style.setProperty("--i", idx);
    store.set(STORE_KEY, page);
    if (push && location.hash !== "#" + page) history.replaceState(null, "", "#" + page);
    if (page === "tier" && state.meta) FX.stagger($("#tier-list"));
    window.scrollTo({ top: 0 });
  }

  /* ---------- Boot ---------- */
  async function boot() {
    FX.press(document);
    FX.starfield($("#starfield"));

    document.querySelector(".nav").addEventListener("click", (e) => {
      const b = e.target.closest(".nav__btn");
      if (b) go(b.dataset.page);
    });
    window.addEventListener("hashchange", () => go(location.hash.slice(1), { push: false }));

    const first = location.hash.slice(1) || store.get(STORE_KEY) || "tier";
    showSkeletons();
    go(first, { push: false });

    try {
      const [meta, cards] = await Promise.all([loadJSON("data/meta.json"), loadJSON("data/cards.json")]);
      state.meta = meta; state.cards = cards;
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

    renderTier();
    renderRarityPicker();
    renderCards();
  }

  window.CBI = { renderCard, setCardRarity, statAt, oddsAt, fmtOdds, fmtStat, state };
  boot();
})();
