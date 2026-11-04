/* ==========================================================
   Card Battle Infinity — Cards page (step 2 · redesigned 2026-11-03)
   · top to bottom (2026-11-04): ONE search box for names and pull odds (100 · 2.5B · 100Qa, no "1 IN" · the old
     "1 IN …" box is gone) with the ↑↓ pull-odds order button in it, rarity bar (sticks under the top bar, wraps),
     series / role selects (only when the data has 2+), card count (one grid: 3 a row on phones · 5 on computers · 50 a page,
     the grid 2 / grid 3 / list switch was removed 2026-11-04),
     chips of the filters in use (× each) + Reset all
   · cards always sort by pull odds (the Rarest / Overall / ATK / HP switch was removed in round 2)
   · every card sits in a cell (C.cardCell · no tier badge under it since round 2)
   · setRarity(): the one place that changes the rarity for the whole site (fires "cbi:rarity")
   · the card detail lives in js/detail.js (step 12)
   · Cards | Support switch at the top (owner 2026-10-28 · #cards / #support, state.kind): the Support side is js/support.js
   · paged (C.pager): a card is made the first time its page shows · search / filters / sort = page 1 · the detail's swipe
     and wheel still walk the whole filtered list (order())
   Needs js/fx.js and js/app.js (window.FX, window.CBI) loaded first.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  /* ==========================================================
     Pull-odds units (2026-11-03)
     GAME_MAX_UNIT = the biggest odds unit the game has right now. When the game adds a new unit (say Qi), change ONLY
     this line: the parser and the "Not in the game" message follow it.
     UNITS must already list that unit (it lists the ones after Qa so typing them can say "Not in the game").
     ========================================================== */
  const GAME_MAX_UNIT = "Qa";
  const UNITS = [["", 1], ["K", 1e3], ["M", 1e6], ["B", 1e9], ["T", 1e12], ["Qa", 1e15], ["Qi", 1e18], ["Sx", 1e21], ["Sp", 1e24], ["Oc", 1e27], ["No", 1e30], ["Dc", 1e33]];
  const UNIT_ALIAS = { qd: "Qa" };    // the cards write a thousand trillion "Qd" like the game (app.js shortNum) → same unit
  const MAX_UNIT_I = UNITS.findIndex((u) => u[0] === GAME_MAX_UNIT);
  const unitByKey = new Map(UNITS.filter((u) => u[0]).map((u, i) => [u[0].toLowerCase(), i + 1]));
  Object.entries(UNIT_ALIAS).forEach(([k, v]) => unitByKey.set(k, UNITS.findIndex((u) => u[0] === v)));

  // the unit a number falls in (index into UNITS): 179,000,000,000 -> B
  function unitIndex(v) {
    let i = 0;
    for (let k = 1; k < UNITS.length; k++) if (v >= UNITS[k][1] * 0.9995) i = k;   // 999,960,000 counts as 1B (like the cards)
    return i;
  }
  // a number written short: 1500000000 -> "1.5B" · 300e15 -> "300Qa" · 1234 -> "1.23K" · 2 decimals at most
  function shortOdds(v) {
    let i = unitIndex(v);
    let x = Math.round((v / UNITS[i][1]) * 100) / 100;
    if (x >= 1000 && i < UNITS.length - 1) { i++; x = Math.round((v / UNITS[i][1]) * 100) / 100; }
    return (i === 0 ? Math.round(v).toLocaleString("en-US") : String(x)) + UNITS[i][0];
  }
  /* What was typed → { value, unit (index), text (short form) } or { error } · "1 in 300 qa", "300Qa", "2.5b", "1,000,000" */
  function parseOdds(raw) {
    let s = String(raw || "").trim().toLowerCase().replace(/^1\s*in\s*/, "").replace(/[,\s_]/g, "");
    if (!s) return null;
    const m = s.match(/^(\d+(?:\.\d+)?|\.\d+)([a-z]*)$/);
    if (!m) return { error: "Type a number like 300Qa, 2.5B or 1,000,000." };
    let mult = 1;
    if (m[2]) {
      const ui = unitByKey.get(m[2]);
      if (ui == null) return { error: `"${m[2]}" isn't a unit. Use K, M, B, T or ${GAME_MAX_UNIT}.` };
      mult = UNITS[ui][1];
    }
    const value = parseFloat(m[1]) * mult;
    if (!(value >= 1) || !Number.isFinite(value)) return { error: "Odds start at 1 in 1." };
    const text = shortOdds(value);
    return { value, unit: unitIndex(value), text };
  }

  const ROLE_ORDER = ["DPS", "Tank", "Support", "Hybrid"];
  const filters = { q: "", role: "", series: "", odds: null, dir: "desc" };   // rarest first (owner 2026-10-28) · always by pull odds (round 2)
  const cardById = new Map();     // id -> card data
  const cardEls = new Map();      // id -> card element (made the first time its page shows, kept after)
  const cellEls = new Map();      // id -> the grid cell (card + list details)
  const searchText = new Map();   // id -> lowercase text used by the search box
  const ui = {};
  let shown = [];                 // ids that pass the filters, in order (every page)
  let onPage = [];                // ids in the grid now (this page)
  let page = 0;
  let built = false;              // grid cards exist (made on the first visit to the Cards side, step 9.5)
  let shownKind = null;           // the side on screen: "cards" | "support"
  let oddsState = "";             // "" | "ok" | "none" (no card in that unit) | "game" (unit the game doesn't have) · told by the empty state
  const HEAD = {
    cards: { eyebrow: "The Archive", title: "Cards", lead: "Pick a rarity to see each card's ATK, HP and pull odds at that level. Tap a card for the full breakdown." },
    support: { eyebrow: "The Apothecary", title: "Support", lead: "Pick a rarity to see each support's effect at that level: the numbers on the card grow with it. Tap one for the full breakdown." },
  };

  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  /* ---------- A card in a grid cell ----------
     Used by the Cards and Support grids · no tier badge under the card (owner, round 2 2026-11-03) */
  function cardCell(el, item) {
    const cell = document.createElement("div");
    cell.className = "cg-cell";
    cell.dataset.cell = item.id;
    cell.append(el);
    return cell;
  }

  /* ==========================================================
     Cards page
     ========================================================== */
  function init() {
    Object.assign(ui, {
      kind: $("#cards-kind"), cardsView: $("#cards-view"), supView: $("#support-view"),
      eyebrow: $("#cards-eyebrow"), title: $("#cards-title"), lead: $("#cards-lead"),
      tools: $("#cards-tools"), pager: $("#cards-pager"), grid: $("#card-grid"), none: $("#cards-none"), empty: $("#cards-empty"),
      noneTitle: $("#cards-none .empty__title"), noneText: $("#cards-none .empty__text"),
      rarity: $("#rarity-picker"), search: $("#card-search"),
      dir: $("#card-dir"), series: $("#card-series"), seriesField: $("#series-field"),
      role: $("#card-role"), roleField: $("#role-field"), selects: $("#card-selects"),
      searchBox: $("#cards-search"),
      count: $("#card-count"), active: $("#card-active"),
    });

    state.cards.forEach((c) => {
      cardById.set(c.id, c);
      const p = c.passive || {}, s = c.skill || {};
      searchText.set(c.id, [c.name, c.series, c.role, p.name, p.desc, s.name, s.desc].filter(Boolean).join(" ").toLowerCase());
    });

    bindKind();
    ui.grid.innerHTML = "";
    ui.tools.hidden = !state.cards.length;
    $("#rarity-bar").hidden = !state.cards.length;
    ui.searchBox.hidden = !state.cards.length;
    ui.empty.hidden = state.cards.length > 0;
    if (!state.cards.length) return;

    // Rarity chips anywhere on the site (page + detail sheet share one state)
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".chip[data-rarity]");
      if (b) setRarity(b.dataset.rarity);
    });
    rarityChips(ui.rarity);
    stickyBars();
    buildFilters();
    bindTools();
    // step 9.5: the grid's cards are made the first time the Cards tab shows (not while you're on another tab)
    // the Support side opened first: the card grid waits until the Cards side shows (view())
    C.lazy("cards", () => { if (state.kind !== "support") build(); });
  }
  function build() {
    if (built || !state.cards.length) return;
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
  function showSide(kind, { animate = false } = {}) {
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
  }

  function rarityChips(container) {
    container.innerHTML = state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-rarity="${esc(r.name)}" aria-pressed="${r.name === state.rarity}" style="--sw:${C.RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");
  }

  /* The rarity bars stick under the top bar while the page scrolls · .is-stuck (solid fill + shadow) only while stuck */
  function stickyBars() {
    if (!("IntersectionObserver" in window)) return;
    document.querySelectorAll(".rarity-bar").forEach((bar) => {
      const mark = document.createElement("span");
      mark.className = "rarity-bar__mark"; mark.setAttribute("aria-hidden", "true");
      bar.before(mark);
      let io = null;
      const watch = () => {
        if (io) io.disconnect();
        const top = parseFloat(getComputedStyle(bar).top) || 0;
        io = new IntersectionObserver(([en]) => bar.classList.toggle("is-stuck", !en.isIntersecting && en.boundingClientRect.top < top + 1),
          { rootMargin: `-${Math.round(top) + 1}px 0px 0px 0px` });
        io.observe(mark);
      };
      watch();
      let t = 0;
      addEventListener("resize", () => { clearTimeout(t); t = setTimeout(watch, 200); });
    });
  }

  function buildFilters() {
    const roles = [...new Set(state.cards.map((c) => c.role).filter(Boolean))]
      .sort((a, b) => ((ROLE_ORDER.indexOf(a) + 1) || 99) - ((ROLE_ORDER.indexOf(b) + 1) || 99) || a.localeCompare(b));
    ui.role.innerHTML = `<option value="">All roles</option>` + roles.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
    ui.roleField.hidden = roles.length < 2;
    const series = [...new Set(state.cards.map((c) => c.series).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    ui.series.innerHTML = `<option value="">All series</option>` + series.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    ui.seriesField.hidden = series.length < 2;
    ui.selects.hidden = ui.roleField.hidden && ui.seriesField.hidden;
  }

  function bindTools() {
    ui.search.addEventListener("input", () => { readSearch(); apply(); });
    ui.search.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.search.blur(); });   // closes the phone keyboard
    ui.series.addEventListener("change", () => { filters.series = ui.series.value; apply({ animate: true }); });
    ui.role.addEventListener("change", () => { filters.role = ui.role.value; apply({ animate: true }); });
    ui.dir.addEventListener("click", () => {
      filters.dir = filters.dir === "desc" ? "asc" : "desc";
      apply({ animate: true });
    });

    // chips of the filters in use: × clears that one · Reset all clears them all
    ui.active.addEventListener("click", (e) => {
      const b = e.target.closest("[data-clear]");
      if (!b) return;
      const k = b.dataset.clear;
      if (k === "all") { reset(); return; }
      if (k === "q" || k === "odds") { filters.q = ""; filters.odds = null; ui.search.value = ""; }   // one box holds both
      if (k === "series") { filters.series = ""; ui.series.value = ""; }
      if (k === "role") { filters.role = ""; ui.role.value = ""; }
      apply({ animate: true });
    });
    $("#cards-none-reset").addEventListener("click", reset);
    C.bindPager(ui.pager, goPage);
  }
  function reset() {
    filters.q = filters.role = filters.series = "";
    filters.odds = null; oddsState = "";
    ui.search.value = ""; ui.series.value = ""; ui.role.value = "";
    apply({ animate: true });
  }

  /* ---------- The one search box: a name / series / ability, or pull odds (2026-11-04) ----------
     What is typed reads as odds when it is a number with an optional unit: 100 · 2.5B · 100Qa · 1,000,000 ("1 in 100Qa"
     works too) → only cards whose odds (at the picked rarity) are in that unit or rarer, the closest to the value first
     (unit above GAME_MAX_UNIT → "Not in the game" · none in that unit = an empty grid that says so).
     Anything else (or a number with a word that isn't a unit) is a text search like before. */
  function readSearch() {
    const raw = ui.search.value;
    const p = /\d/.test(raw) ? parseOdds(raw) : null;
    if (p && !p.error) { filters.odds = p; filters.q = ""; }
    else { filters.odds = null; filters.q = raw; }
  }

  // always by pull odds at the picked rarity · desc (default) = rarest first · odds typed = closest to them first
  function compare(a, b) {
    const dir = filters.dir === "asc" ? 1 : -1;
    const oa = C.oddsAt(a, state.rarity), ob = C.oddsAt(b, state.rarity);
    if (filters.odds) {                                         // closest to the typed odds first (log distance)
      const t = Math.log(filters.odds.value);
      const da = Math.abs(Math.log(oa) - t), db = Math.abs(Math.log(ob) - t);
      if (da !== db) return (da - db) * -dir;                  // desc (default) = closest first
      if (oa !== ob) return ob - oa;
    } else if (oa !== ob) return (oa - ob) * dir;
    return a.name.localeCompare(b.name);
  }

  // keepPage: the same list in a new order (a rarity change with exact values) stays on its page
  function apply({ animate = false, keepPage = false } = {}) {
    syncTools();
    if (!built) return;   // the Cards side hasn't been opened yet: its cards don't exist yet
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    const r = state.rarity, o = filters.odds;
    oddsState = !o ? "" : o.unit > MAX_UNIT_I ? "game" : "ok";
    let out = oddsState === "game" ? [] : state.cards.filter((c) => {
      if (filters.role && c.role !== filters.role) return false;
      if (filters.series && c.series !== filters.series) return false;
      if (o && unitIndex(C.oddsAt(c, r)) < o.unit) return false;   // never a unit below the typed one
      if (words.length) { const hay = searchText.get(c.id); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    });
    if (oddsState === "ok" && !state.cards.some((c) => unitIndex(C.oddsAt(c, r)) >= o.unit)) oddsState = "none";
    out = out.sort(compare);

    const ids = out.map((c) => c.id);
    if (ids.length !== shown.length || ids.some((id, i) => id !== shown[i])) { shown = ids; if (!keepPage) page = 0; }
    paint({ animate });
    activeChips(words.length);

    ui.none.hidden = out.length > 0;
    if (!out.length) {
      const [t, x] = oddsState === "game" ? ["Not in the game", `No card has odds in that unit yet. The rarest unit right now is ${GAME_MAX_UNIT}.`]
        : oddsState === "none" ? [`No ${UNITS[o.unit][0]} cards at ${r}`, "Odds grow with the rarity: pick a higher one in the bar above."]
        : ["No cards match", "Try a different search or clear the filters."];
      ui.noneTitle.textContent = t; ui.noneText.textContent = x;
    }
  }
  // the switches show what is picked (works before the grid exists too)
  function syncTools() {
    ui.dir.dataset.dir = filters.dir;
    ui.dir.setAttribute("aria-label", filters.odds
      ? `Order: ${filters.dir === "desc" ? "closest to 1 in " + filters.odds.text + " first" : "farthest first"}. Tap to reverse.`
      : `Pull odds: ${filters.dir === "desc" ? "rarest first" : "most common first"}. Tap to reverse.`);
  }
  function activeChips(hasWords) {
    const chip = (k, label) => `<span class="actchip"><span class="actchip__t">${label}</span><button type="button" class="actchip__x fx-press" data-clear="${k}" aria-label="Remove filter: ${esc(label.replace(/<[^>]+>/g, ""))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button></span>`;
    const list = [];
    if (hasWords) list.push(chip("q", `“${esc(filters.q.trim())}”`));
    if (filters.odds) list.push(chip("odds", `1 in ${esc(filters.odds.text)}`));
    if (filters.series) list.push(chip("series", esc(filters.series)));
    if (filters.role) list.push(chip("role", esc(filters.role)));
    ui.active.hidden = !list.length;
    ui.active.innerHTML = list.length ? list.join("") + `<button type="button" class="actchips__reset fx-press" data-clear="all">Reset all</button>` : "";
  }

  // cards a page: C.PAGE_SIZE (50 on every screen · app.js)
  const pageSize = () => C.PAGE_SIZE;

  // the grid shows one page of `shown` · a card is made the first time it is needed
  const elOf = (id) => {
    let cell = cellEls.get(id);
    if (!cell) {
      const el = C.renderCard(cardById.get(id), state.rarity);
      cardEls.set(id, el);
      cell = cardCell(el, cardById.get(id));
      cellEls.set(id, cell);
    }
    return cell;
  };
  function paint({ animate = false } = {}) {
    const size = pageSize();
    const pages = Math.max(1, Math.ceil(shown.length / size));
    page = Math.max(0, Math.min(page, pages - 1));
    const ids = shown.slice(page * size, (page + 1) * size);
    if (ids.length !== onPage.length || ids.some((id, i) => id !== onPage[i])) {
      const frag = document.createDocumentFragment();
      ids.forEach((id) => frag.appendChild(elOf(id)));
      ui.grid.replaceChildren(frag);
      onPage = ids;
      if (animate) FX.stagger(ui.grid, 28, { cls: "fx-grid-in", max: 10, limit: 16, cleanup: true });
    }
    C.pager(ui.pager, page, shown.length ? pages : 0);
    const total = state.cards.length, n = shown.length;
    ui.count.textContent = (n === total ? `${total} ${total === 1 ? "card" : "cards"}` : `${n} of ${total} cards`);
  }
  // a page button: the new page's cards come in one by one, the screen goes back up to the grid
  function goPage(i) {
    if (i === page || i < 0 || i * pageSize() >= shown.length) return;
    page = i;
    paint({ animate: true });
    C.pageTop(ui.grid);
  }
  // the screen changed size (rows × columns per page): keep the first card in view on the new page
  document.addEventListener("cbi:pagesize", () => {
    if (!built) return;
    const k = onPage.length ? shown.indexOf(onPage[0]) : -1;
    if (k >= 0) page = Math.floor(k / pageSize());
    onPage = [];
    paint();
  });

  /* Change rarity everywhere (page chips, grid cards; the open detail listens to "cbi:rarity") */
  function setRarity(name) {
    if (name === state.rarity || !state.meta.rarities.some((r) => r.name === name)) return;
    state.rarity = name;
    C.store.set(C.RARITY_KEY, name);
    document.querySelectorAll(".chip[data-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rarity === name)));
    // read every position first, then write — mixing them forces a re-layout per card
    // C.covered: the card detail covers the page (speed 2026-11-03) → no measuring, no flash, one card per idle moment (C.later)
    const onScreen = new Map();
    cardEls.forEach((el, id) => onScreen.set(id, !C.covered && el.isConnected && rectVisible(el.getBoundingClientRect())));
    const jobs = [...cardEls].map(([id, el]) => () => C.setCardRarity(el, cardById.get(id), name, { animate: onScreen.get(id) }));
    // exact game values can change the order, and typed odds depend on the rarity · no-op when nothing changes
    jobs.push(() => apply({ keepPage: !filters.odds }));
    C.later("cards", jobs);
    document.dispatchEvent(new CustomEvent("cbi:rarity", { detail: name }));   // js/tier.js, js/detail.js … listen
  }

  /* Cards in the order the Cards page shows them (filters + sort). Used by the detail when it was opened
     without a list (a direct #card/<id> link): swiping walks this order. */
  function order() {
    if (built) return shown.slice();
    return state.cards.slice().sort(compare).map((c) => c.id);
  }

  C.cards = { init, setRarity, order, view: showSide, kind: () => shownKind };
  C.cardCell = cardCell;
  C.ODDS = { GAME_MAX_UNIT, UNITS, parseOdds, shortOdds, unitIndex };   // for tests / other pages
})();
