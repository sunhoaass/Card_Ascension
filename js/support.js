/* ==========================================================
   Card Battle Infinity — Support cards (step 4 · reworked 2026-10-28, owner: "like the cards")
   · The Support side of the Cards page (#support): a grid of game-style support cards (C.renderCard draws them,
     js/app.js) with search, the rarity chips (the numbers on the cards grow with the level), tier filter and sort
     (rarest first by default, the Sort menu changes it) · 30 a page like the Cards side (C.pager)
   · Tapping one opens the same card detail as a card (js/detail.js, #card/<id>); there is no support detail view any more
   · The Tier List, Deck and Tier Maker show the same game card (2026-10-30, owner: support looks like the battle cards ·
     the gilded support tile is gone)
   Needs js/fx.js, js/app.js and js/cards.js loaded first.
   Data: data/support.json (PROGRESS.md §5.4). No ATK / HP. Effect values = Normal × (1 + 0.25 × level) (C.supText, js/app.js).
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const filters = { q: "", tier: "", sort: "odds", dir: "desc" };   // rarest first (owner 2026-10-28)
  const ui = {};
  const byId = new Map();        // support id -> support
  const cardEls = new Map();     // support id -> game card (made the first time its page shows, kept after)
  const searchText = new Map();  // support id -> lowercase text used by the search box
  const rankOf = new Map();      // support id -> rank by Value (ties share a rank)
  let items = [];
  let shown = [];                // ids that pass the filters, in order (every page)
  let onPage = [], page = 0;     // ids in the grid now · the page
  let rankedCount = 0;
  let built = false;             // grid cards exist (made the first time the Support side shows)

  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const isRanked = (s) => !!(s.scores && s.scores.value > 0 && s.tier);
  const tierVar = (t) => `var(${C.TIER_COLOR[t] || "--t-d"})`;
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  // effect at a rarity ({0} {1} … in desc = effect.vals at that level)
  function effect(s, rarity = state.rarity) {
    const e = s && s.effect;
    if (e && typeof e === "object") return { name: e.name ? String(e.name) : "", desc: e.desc ? C.supText(s, e.desc, rarity) : "" };
    return { name: "", desc: e ? String(e) : "" };
  }
  const effectLine = (s, rarity) => { const e = effect(s, rarity); return e.name && e.desc ? `${e.name}: ${e.desc}` : e.name || e.desc; };
  // the values at a rarity, as written on the card ("6.2%" …)
  const values = (s, rarity = state.rarity) => C.supVals(s).map((v, i) => C.supValAt(s, i, rarity) + "%");

  function computeRanks() {
    const ranked = items.filter(isRanked).sort((a, b) => b.scores.value - a.scores.value);
    rankedCount = ranked.length;
    let r = 0, prev = null;
    ranked.forEach((s, i) => { if (s.scores.value !== prev) { r = i + 1; prev = s.scores.value; } rankOf.set(s.id, r); });
  }

  /* ==========================================================
     Grid (the Support side of the Cards page)
     ========================================================== */
  function buildFilters() {
    ui.rarity.innerHTML = C.rarityChipsHTML();
    ui.filters.innerHTML = state.meta.tiers.filter((t) => !t.cardsOnly).map((t) =>
      `<button type="button" class="chip glass fx-press" data-f="tier" data-v="${esc(t.name)}" aria-pressed="false" style="--sw:${tierVar(t.name)};--sw-line:${tierVar(t.name)}"><span class="chip__swatch"></span>${esc(t.name)}</button>`
    ).join("");
  }

  function compare(a, b) {
    const dir = filters.dir === "asc" ? 1 : -1;
    if (filters.sort === "odds") {
      const oa = num(a.odds), ob = num(b.odds);
      if (!oa !== !ob) return oa ? -1 : 1;                      // no odds listed: always last
      if (oa !== ob) return (oa - ob) * dir;
    } else if (filters.sort === "effect") {
      const va = C.supValue(a, state.rarity), vb = C.supValue(b, state.rarity);
      if (!va !== !vb) return va ? -1 : 1;
      if (va !== vb) return (va - vb) * dir;
    } else {
      const ra = isRanked(a), rb = isRanked(b);
      if (ra !== rb) return ra ? -1 : 1;                        // unranked always last
      if (ra && a.scores.value !== b.scores.value) return (a.scores.value - b.scores.value) * dir;
    }
    return a.name.localeCompare(b.name);
  }

  function apply({ animate = false, keepPage = false } = {}) {
    if (!built) return;   // the Support side hasn't been opened yet: its cards don't exist yet
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = items.filter((s) => {
      if (filters.tier && !(isRanked(s) && s.tier === filters.tier)) return false;
      if (words.length) { const hay = searchText.get(s.id); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    }).sort(compare);

    const ids = out.map((s) => s.id);
    if (ids.length !== shown.length || ids.some((id, i) => id !== shown[i])) { shown = ids; if (!keepPage) page = 0; }
    paint({ animate });

    ui.filters.querySelectorAll(".chip[data-f]").forEach((b) => b.setAttribute("aria-pressed", String(filters[b.dataset.f] === b.dataset.v)));
    const total = items.length;
    ui.reset.hidden = !(words.length || filters.tier);
    ui.none.hidden = out.length > 0;
    const unranked = total - rankedCount;
    ui.note.hidden = !(unranked && rankedCount);
    ui.note.textContent = unranked ? `Only the top ${C.rankTopSupport()} support cards get a rank. The other ${unranked} still work in any deck.` : "";
  }

  // one page of `shown` in the grid · a card is made the first time it is needed
  const elOf = (id) => { let el = cardEls.get(id); if (!el) { el = C.renderCard(byId.get(id), state.rarity); cardEls.set(id, el); } return el; };
  function paint({ animate = false } = {}) {
    const pages = Math.max(1, Math.ceil(shown.length / C.PAGE_SIZE));
    page = Math.max(0, Math.min(page, pages - 1));
    const ids = shown.slice(page * C.PAGE_SIZE, (page + 1) * C.PAGE_SIZE);
    if (ids.length !== onPage.length || ids.some((id, i) => id !== onPage[i])) {
      const frag = document.createDocumentFragment();
      ids.forEach((id) => frag.appendChild(elOf(id)));
      ui.grid.replaceChildren(frag);
      onPage = ids;
      if (animate) FX.stagger(ui.grid, 28, { cls: "fx-grid-in", max: 10, limit: 16, cleanup: true });
    }
    C.pager(ui.pager, page, shown.length ? pages : 0);
    const total = items.length, n = shown.length, word = (k) => (k === 1 ? "support card" : "support cards");
    ui.count.textContent = (n === total ? `${total} ${word(total)}` : `${n} of ${total} ${word(total)}`);
  }
  function goPage(i) {
    if (i === page || i < 0 || i * C.PAGE_SIZE >= shown.length) return;
    page = i;
    paint({ animate: true });
    C.pageTop(ui.grid);
  }
  // the screen changed size (rows × columns per page): keep the first card in view on the new page
  document.addEventListener("cbi:pagesize", () => { if (!built) return; page = C.pageKeep(shown, onPage, page); paint(); });

  function bindGrid() {
    ui.search.addEventListener("input", () => { filters.q = ui.search.value; apply(); });
    ui.search.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.search.blur(); });   // closes the phone keyboard
    ui.sort.addEventListener("change", () => { filters.sort = ui.sort.value; apply({ animate: true }); });
    ui.dir.addEventListener("click", () => {
      filters.dir = filters.dir === "desc" ? "asc" : "desc";
      ui.dir.dataset.dir = filters.dir;
      ui.dir.setAttribute("aria-label", `Sort order: ${filters.dir === "desc" ? "high to low" : "low to high"}. Tap to reverse.`);
      apply({ animate: true });
    });
    ui.filters.addEventListener("click", (e) => {
      const b = e.target.closest(".chip[data-f]");
      if (!b) return;
      filters.tier = filters.tier === b.dataset.v ? "" : b.dataset.v;   // tap again to clear
      apply({ animate: true });
    });
    const reset = () => { filters.q = filters.tier = ""; ui.search.value = ""; apply({ animate: true }); };
    ui.reset.addEventListener("click", reset);
    $("#support-none-reset").addEventListener("click", reset);
    C.bindPager(ui.pager, goPage);
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
  }

  function build() {
    if (built || !items.length) return;
    built = true;
    apply({ animate: true });
  }

  /* Rarity changed (chips here or anywhere · js/cards.js): the grid's numbers count to the new values */
  function recolor(name) {
    if (!built) return;
    const seen = new Map();
    cardEls.forEach((el, id) => seen.set(id, el.isConnected && rectVisible(el.getBoundingClientRect())));
    cardEls.forEach((el, id) => C.setCardRarity(el, byId.get(id), name, { animate: seen.get(id) }));
    if (filters.sort === "effect") apply({ keepPage: true });
  }

  /* The Support side's order (filters + sort) · the detail swipes / its wheel walk it */
  function order() {
    if (built) return shown.slice();
    return items.slice().sort(compare).map((s) => s.id);
  }

  /* ---------- Boot ---------- */
  function init() {
    Object.assign(ui, {
      tools: $("#support-tools"), grid: $("#support-grid"), pager: $("#support-pager"), none: $("#support-none"), empty: $("#support-empty"), note: $("#support-note"),
      search: $("#support-search"), rarity: $("#support-rarity"), sort: $("#support-sort"), dir: $("#support-dir"), filters: $("#support-filters"),
      count: $("#support-count"), reset: $("#support-reset"),
    });
    items = (Array.isArray(state.support) ? state.support : []).filter((s) => s && s.id);
    items.forEach((s) => {
      byId.set(s.id, s);
      searchText.set(s.id, [s.name, effectLine(s, "Normal"), s.obtain].filter(Boolean).join(" ").toLowerCase());
    });

    ui.grid.innerHTML = "";
    ui.tools.hidden = !items.length;
    ui.empty.hidden = items.length > 0;
    if (!items.length) return;
    computeRanks();
    buildFilters();
    bindGrid();
  }

  // build(): the grid (js/cards.js, first time the side shows) · effect / values / rank: the detail's Support parts (js/detail.js)
  C.support = { init, build, order, effect, values, rank: (id) => rankOf.get(id) || 0, rankedCount: () => rankedCount };
})();
