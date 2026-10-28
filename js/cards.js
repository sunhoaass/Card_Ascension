/* ==========================================================
   Card Battle Infinity — Cards page (step 2)
   · rarity picker, search, sort, tier / role / series filters
   · setRarity(): the one place that changes the rarity for the whole site (fires "cbi:rarity")
   · the card detail lives in js/detail.js (step 12)
   · Cards | Support switch at the top (owner 2026-10-28 · #cards / #support, state.kind): the Support side is js/support.js
   · both sides start sorted rarest first (pull odds, high to low) · the Sort menu still changes it
   Needs js/fx.js and js/app.js (window.FX, window.CBI) loaded first.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const ROLE_ORDER = ["DPS", "Tank", "Support", "Hybrid"];
  const filters = { q: "", tier: "", role: "", series: "", sort: "odds", dir: "desc" };   // rarest first (owner 2026-10-28)
  const cardById = new Map();     // id -> card data
  const cardEls = new Map();      // id -> card element in the grid (kept even while filtered out)
  const searchText = new Map();   // id -> lowercase text used by the search box
  const ui = {};
  let shown = [];                 // ids currently in the grid, in order
  let built = false;              // grid cards exist (made on the first visit to the Cards side, step 9.5)
  let shownKind = null;           // the side on screen: "cards" | "support"
  const HEAD = {
    cards: { eyebrow: "The Archive", title: "Cards", lead: "Pick a rarity to see each card's ATK, HP and pull odds at that level. Tap a card for the full breakdown." },
    support: { eyebrow: "The Apothecary", title: "Support", lead: "Pick a rarity to see each support's effect at that level: the numbers on the card grow with it. Tap one for the full breakdown." },
  };

  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  /* ==========================================================
     Cards page
     ========================================================== */
  function init() {
    Object.assign(ui, {
      kind: $("#cards-kind"), cardsView: $("#cards-view"), supView: $("#support-view"),
      eyebrow: $("#cards-eyebrow"), title: $("#cards-title"), lead: $("#cards-lead"),
      tools: $("#cards-tools"), grid: $("#card-grid"), none: $("#cards-none"), empty: $("#cards-empty"),
      rarity: $("#rarity-picker"), filters: $("#card-filters"), search: $("#card-search"),
      sort: $("#card-sort"), dir: $("#card-dir"), series: $("#card-series"), seriesField: $("#series-field"),
      count: $("#card-count"), reset: $("#card-reset"),
    });

    state.cards.forEach((c) => {
      cardById.set(c.id, c);
      const p = c.passive || {}, s = c.skill || {};
      searchText.set(c.id, [c.name, c.series, c.role, p.name, p.desc, s.name, s.desc].filter(Boolean).join(" ").toLowerCase());
    });

    bindKind();
    ui.grid.innerHTML = "";
    ui.tools.hidden = !state.cards.length;
    ui.empty.hidden = state.cards.length > 0;
    if (!state.cards.length) return;

    // Rarity chips anywhere on the site (page + detail sheet share one state)
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".chip[data-rarity]");
      if (b) setRarity(b.dataset.rarity);
    });
    rarityChips(ui.rarity);
    buildFilters();
    bindTools();
    // step 9.5: the grid's cards are made the first time the Cards tab shows (not while you're on another tab)
    // the Support side opened first: the card grid waits until the Cards side shows (view())
    C.lazy("cards", () => { if (state.kind !== "support") build(); });
  }
  function build() {
    if (built || !state.cards.length) return;
    state.cards.forEach((c) => cardEls.set(c.id, C.renderCard(c, state.rarity)));
    built = true;
    apply({ animate: true });
  }

  /* ---------- Cards | Support switch (#cards / #support · no history entry, like the Tier List's Cards | Support) ---------- */
  function bindKind() {
    const pick = (k) => {
      if (k === state.kind) return;
      state.kind = k;
      try { history.replaceState(history.state, "", "#" + k); } catch {}
      C.route();   // app.js: showPage → view(kind, animate) + title + the remembered page
    };
    ui.kind.addEventListener("click", (e) => { const b = e.target.closest(".seg__btn[data-kind]"); if (b) pick(b.dataset.kind); });
    ui.kind.addEventListener("keydown", (e) => {
      const k = { ArrowRight: "support", ArrowLeft: "cards", Home: "cards", End: "support" }[e.key];
      if (!k) return;
      e.preventDefault(); pick(k);
      ui.kind.querySelector(`[data-kind="${k}"]`).focus();
    });
  }
  // show one side · animate = the switch's plate slides + the new side fades in, its first cards come in one by one (§4)
  function view(kind, { animate = false } = {}) {
    kind = kind === "support" ? "support" : "cards";
    state.kind = kind;
    const changed = kind !== shownKind;
    shownKind = kind;
    ui.kind.style.setProperty("--i", kind === "support" ? 1 : 0);
    ui.kind.querySelectorAll(".seg__btn").forEach((b) => { const on = b.dataset.kind === kind; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    ui.cardsView.hidden = kind !== "cards";
    ui.supView.hidden = kind !== "support";
    const h = HEAD[kind];
    ui.eyebrow.textContent = h.eyebrow; ui.title.textContent = h.title; ui.lead.textContent = h.lead;
    if (kind === "cards") build(); else C.support.build();
    if (!changed || !animate) return;
    const box = kind === "cards" ? ui.cardsView : ui.supView;
    box.classList.remove("fx-page-in"); void box.offsetWidth; box.classList.add("fx-page-in");
    const grid = kind === "cards" ? ui.grid : $("#support-grid");
    FX.stagger(grid, 28, { cls: "fx-grid-in", max: 10, limit: 16, cleanup: true });
    requestAnimationFrame(() => C.revealChip(box));
  }

  function rarityChips(container) {
    container.innerHTML = state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-rarity="${esc(r.name)}" aria-pressed="${r.name === state.rarity}" style="--sw:${C.RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");
  }

  function buildFilters() {
    const tiers = state.meta.tiers.map((t) => t.name);
    const roles = [...new Set(state.cards.map((c) => c.role).filter(Boolean))]
      .sort((a, b) => ((ROLE_ORDER.indexOf(a) + 1) || 99) - ((ROLE_ORDER.indexOf(b) + 1) || 99) || a.localeCompare(b));
    ui.filters.innerHTML =
      tiers.map((t) => `<button type="button" class="chip glass fx-press" data-f="tier" data-v="${esc(t)}" aria-pressed="false" style="--sw:var(${C.TIER_COLOR[t] || "--t-d"});--sw-line:var(${C.TIER_COLOR[t] || "--t-d"})"><span class="chip__swatch"></span>${esc(t)}</button>`).join("") +
      (roles.length ? `<span class="chip-sep" aria-hidden="true"></span>` : "") +
      roles.map((r) => `<button type="button" class="chip glass fx-press" data-f="role" data-v="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join("");

    const series = [...new Set(state.cards.map((c) => c.series).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    ui.series.innerHTML = `<option value="">All series</option>` + series.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    ui.seriesField.hidden = series.length < 2;
  }

  function bindTools() {
    ui.search.addEventListener("input", () => { filters.q = ui.search.value; apply(); });
    ui.search.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.search.blur(); });   // closes the phone keyboard
    ui.sort.addEventListener("change", () => { filters.sort = ui.sort.value; apply({ animate: true }); });
    ui.series.addEventListener("change", () => { filters.series = ui.series.value; apply({ animate: true }); });
    ui.dir.addEventListener("click", () => {
      filters.dir = filters.dir === "desc" ? "asc" : "desc";
      ui.dir.dataset.dir = filters.dir;
      ui.dir.setAttribute("aria-label", `Sort order: ${filters.dir === "desc" ? "high to low" : "low to high"}. Tap to reverse.`);
      apply({ animate: true });
    });
    ui.filters.addEventListener("click", (e) => {
      const b = e.target.closest(".chip[data-f]");
      if (!b) return;
      const k = b.dataset.f;
      filters[k] = filters[k] === b.dataset.v ? "" : b.dataset.v;   // tap again to clear
      apply({ animate: true });
    });
    const reset = () => {
      filters.q = filters.tier = filters.role = filters.series = "";
      ui.search.value = ""; ui.series.value = "";
      apply({ animate: true });
    };
    ui.reset.addEventListener("click", reset);
    $("#cards-none-reset").addEventListener("click", reset);

  }

  function sortValue(c) {
    const r = state.rarity;
    if (filters.sort === "atk") return C.statAt(c, "atk", r);
    if (filters.sort === "hp") return C.statAt(c, "hp", r);
    return C.oddsAt(c, r);
  }
  function compare(a, b) {
    const dir = filters.dir === "asc" ? 1 : -1;
    if (filters.sort === "overall") {
      const ra = C.isRanked(a), rb = C.isRanked(b);
      if (ra !== rb) return ra ? -1 : 1;                       // unranked cards always last
      if (ra && a.scores.overall !== b.scores.overall) return (a.scores.overall - b.scores.overall) * dir;
    } else {
      const va = sortValue(a), vb = sortValue(b);
      if (va !== vb) return (va - vb) * dir;
    }
    return a.name.localeCompare(b.name);
  }

  function apply({ animate = false } = {}) {
    if (!built) return;   // the Cards tab hasn't been opened yet: its cards don't exist yet
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = state.cards.filter((c) => {
      if (filters.tier && !(C.isRanked(c) && c.tier === filters.tier)) return false;
      if (filters.role && c.role !== filters.role) return false;
      if (filters.series && c.series !== filters.series) return false;
      if (words.length) { const hay = searchText.get(c.id); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    }).sort(compare);

    const ids = out.map((c) => c.id);
    if (ids.length !== shown.length || ids.some((id, i) => id !== shown[i])) {
      const frag = document.createDocumentFragment();
      ids.forEach((id) => frag.appendChild(cardEls.get(id)));
      ui.grid.replaceChildren(frag);
      shown = ids;
      if (animate) FX.stagger(ui.grid, 28, { cls: "fx-grid-in", max: 10, limit: 16, cleanup: true });
    }

    ui.filters.querySelectorAll(".chip[data-f]").forEach((b) => b.setAttribute("aria-pressed", String(filters[b.dataset.f] === b.dataset.v)));
    const total = state.cards.length;
    ui.count.textContent = out.length === total ? `${total} ${total === 1 ? "card" : "cards"}` : `${out.length} of ${total} cards`;
    ui.reset.hidden = !(words.length || filters.tier || filters.role || filters.series);
    ui.none.hidden = out.length > 0;
  }

  /* Change rarity everywhere (page chips, grid cards; the open detail listens to "cbi:rarity") */
  function setRarity(name) {
    if (name === state.rarity || !state.meta.rarities.some((r) => r.name === name)) return;
    state.rarity = name;
    C.store.set(C.RARITY_KEY, name);
    document.querySelectorAll(".chip[data-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rarity === name)));
    // read every position first, then write — mixing them forces a re-layout per card
    const onScreen = new Map();
    cardEls.forEach((el, id) => onScreen.set(id, el.isConnected && rectVisible(el.getBoundingClientRect())));
    cardEls.forEach((el, id) => C.setCardRarity(el, cardById.get(id), name, { animate: onScreen.get(id) }));
    document.dispatchEvent(new CustomEvent("cbi:rarity", { detail: name }));   // js/tier.js, js/detail.js … listen
    if (filters.sort !== "overall") apply();   // exact game values can change the order; no-op when it doesn't
  }

  /* Cards in the order the Cards page shows them (filters + sort). Used by the detail when it was opened
     without a list (a direct #card/<id> link): swiping walks this order. */
  function order() {
    if (built) return shown.slice();
    return state.cards.slice().sort(compare).map((c) => c.id);
  }

  C.cards = { init, setRarity, order, view, kind: () => shownKind };
})();
