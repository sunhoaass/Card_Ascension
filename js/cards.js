/* ==========================================================
   Card Battle Infinity — Cards page (step 2 · redesigned 2026-11-03)
   · rarity bar (sticks under the top bar, wraps: no sideways scroll), search, pull-odds finder ("1 IN …"),
     sort switch (Rarest / Overall / ATK / HP + ↑↓), series / role selects (only when the data has 2+),
     layout switch (grid 2 · grid 3 · list, remembered in cbi:cardView), chips of the filters in use (× each) + Reset all
   · every card sits in a cell with its tier badge under it (display only · the tier filter chips were removed 2026-11-03)
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
     this line: the shortcut buttons (1M … 1<max>), the parser and the "Not in the game" message all follow it.
     UNITS must already list that unit (it lists the ones after Qa so typing them can say "Not in the game").
     ========================================================== */
  const GAME_MAX_UNIT = "Qa";
  const UNITS = [["", 1], ["K", 1e3], ["M", 1e6], ["B", 1e9], ["T", 1e12], ["Qa", 1e15], ["Qi", 1e18], ["Sx", 1e21], ["Sp", 1e24], ["Oc", 1e27], ["No", 1e30], ["Dc", 1e33]];
  const UNIT_ALIAS = { qd: "Qa" };    // the cards write a thousand trillion "Qd" like the game (app.js shortNum) → same unit
  const MAX_UNIT_I = UNITS.findIndex((u) => u[0] === GAME_MAX_UNIT);
  const SHORTCUT_FROM = "M";          // shortcuts: 1M, 1B, 1T … 1<GAME_MAX_UNIT>
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
  const filters = { q: "", role: "", series: "", odds: null, sort: "odds", dir: "desc" };   // rarest first (owner 2026-10-28)
  const VIEW_KEY = "cbi:cardView";   // "2" | "3" | "list" (2026-11-03)
  const VIEWS = ["2", "3", "list"];
  let view = (() => { const v = C.store.get(VIEW_KEY); return VIEWS.includes(v) ? v : "3"; })();
  const cardById = new Map();     // id -> card data
  const cardEls = new Map();      // id -> card element (made the first time its page shows, kept after)
  const cellEls = new Map();      // id -> the grid cell (card + tier badge + list details)
  const searchText = new Map();   // id -> lowercase text used by the search box
  const ui = {};
  let shown = [];                 // ids that pass the filters, in order (every page)
  let onPage = [];                // ids in the grid now (this page)
  let page = 0;
  let built = false;              // grid cards exist (made on the first visit to the Cards side, step 9.5)
  let shownKind = null;           // the side on screen: "cards" | "support"
  let oddsState = "";             // "" | "ok" | "none" (no card in that unit) | "game" (unit the game doesn't have)
  const HEAD = {
    cards: { eyebrow: "The Archive", title: "Cards", lead: "Pick a rarity to see each card's ATK, HP and pull odds at that level. Tap a card for the full breakdown." },
    support: { eyebrow: "The Apothecary", title: "Support", lead: "Pick a rarity to see each support's effect at that level: the numbers on the card grow with it. Tap one for the full breakdown." },
  };
  const SORT_I = { odds: 0, overall: 1, atk: 2, hp: 3 };

  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  /* ---------- A card in a grid cell: the card + its tier badge (display only) + the list view's details ----------
     Used by the Cards and Support grids. The badge keeps the tier colours (C.TIER_COLOR). */
  function tierBadgeHTML(item) {
    if (!C.isRanked(item)) return `<span class="tbadge tbadge--none">Unranked</span>`;
    return `<span class="tbadge" style="--tc:var(${C.TIER_COLOR[item.tier] || "--t-d"})"><span class="tbadge__k">Tier</span><span class="tbadge__v">${esc(item.tier)}</span></span>`;
  }
  function cardCell(el, item) {
    const cell = document.createElement("div");
    cell.className = "cg-cell";
    cell.dataset.cell = item.id;
    const meta = document.createElement("div");
    meta.className = "cg-meta";
    meta.innerHTML = tierBadgeHTML(item) + `<div class="cg-info"></div>`;
    cell.append(el, meta);
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
      sort: $("#card-sort"), dir: $("#card-dir"), series: $("#card-series"), seriesField: $("#series-field"),
      role: $("#card-role"), roleField: $("#role-field"), selects: $("#card-selects"),
      oddsForm: $("#odds-form"), oddsInput: $("#odds-input"), oddsClear: $("#odds-clear"), oddsQuick: $("#odds-quick"), oddsMsg: $("#odds-msg"),
      count: $("#card-count"), viewSw: $("#card-view"), active: $("#card-active"),
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
    setView(view, { animate: false });
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
    // 1M · 1B · 1T · 1Qa (up to GAME_MAX_UNIT)
    const from = UNITS.findIndex((u) => u[0] === SHORTCUT_FROM);
    ui.oddsQuick.innerHTML = UNITS.slice(from, MAX_UNIT_I + 1).map((u) =>
      `<button type="button" class="oddsbox__q fx-press" data-odds="1${u[0]}" aria-pressed="false"><span>1 in</span> <b>1${u[0]}</b></button>`).join("");
  }

  function bindTools() {
    ui.search.addEventListener("input", () => { filters.q = ui.search.value; apply(); });
    ui.search.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.search.blur(); });   // closes the phone keyboard
    ui.series.addEventListener("change", () => { filters.series = ui.series.value; apply({ animate: true }); });
    ui.role.addEventListener("change", () => { filters.role = ui.role.value; apply({ animate: true }); });
    ui.sort.addEventListener("click", (e) => {
      const b = e.target.closest(".seg__btn[data-sort]");
      if (!b || b.dataset.sort === filters.sort) return;
      filters.sort = b.dataset.sort;
      apply({ animate: true });
    });
    ui.sort.addEventListener("keydown", (e) => {
      const keys = Object.keys(SORT_I), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      filters.sort = keys[(SORT_I[filters.sort] + d + keys.length) % keys.length];
      apply({ animate: true });
      ui.sort.querySelector(`[data-sort="${filters.sort}"]`).focus();
    });
    ui.dir.addEventListener("click", () => {
      filters.dir = filters.dir === "desc" ? "asc" : "desc";
      apply({ animate: true });
    });

    // pull odds: Enter / OK / a shortcut all go through setOdds (one rule)
    ui.oddsForm.addEventListener("submit", (e) => { e.preventDefault(); setOdds(ui.oddsInput.value); ui.oddsInput.blur(); });
    ui.oddsInput.addEventListener("input", () => { ui.oddsClear.hidden = !ui.oddsInput.value && !filters.odds; });
    ui.oddsQuick.addEventListener("click", (e) => { const b = e.target.closest("[data-odds]"); if (b) setOdds(b.dataset.odds); });
    ui.oddsClear.addEventListener("click", () => { setOdds(""); ui.oddsInput.focus({ preventScroll: true }); });

    ui.viewSw.addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view); });
    ui.viewSw.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      setView(VIEWS[(VIEWS.indexOf(view) + d + VIEWS.length) % VIEWS.length]);
      ui.viewSw.querySelector(`[data-view="${view}"]`).focus();
    });

    // chips of the filters in use: × clears that one · Reset all clears them all
    ui.active.addEventListener("click", (e) => {
      const b = e.target.closest("[data-clear]");
      if (!b) return;
      const k = b.dataset.clear;
      if (k === "all") { reset(); return; }
      if (k === "q") { filters.q = ""; ui.search.value = ""; }
      if (k === "series") { filters.series = ""; ui.series.value = ""; }
      if (k === "role") { filters.role = ""; ui.role.value = ""; }
      if (k === "odds") { setOdds(""); return; }
      apply({ animate: true });
    });
    $("#cards-none-reset").addEventListener("click", reset);
    C.bindPager(ui.pager, goPage);

    // list view: tapping a row's details opens the card like tapping the card (it flies from the card)
    ui.grid.addEventListener("click", (e) => {
      const m = e.target.closest(".cg-meta");
      if (!m) return;
      const cell = m.closest(".cg-cell"), card = cell && cell.querySelector(".card[data-id]");
      if (card) C.openCard(card.dataset.id, card);
    });
  }
  function reset() {
    filters.q = filters.role = filters.series = "";
    filters.odds = null; oddsState = "";
    ui.search.value = ""; ui.series.value = ""; ui.role.value = ""; ui.oddsInput.value = "";
    apply({ animate: true });
  }

  /* ---------- Pull odds ("1 IN …") ----------
     The typed value is rewritten short (1,000,000 → 1M · 1,500,000,000 → 1.5B).
     · unit above GAME_MAX_UNIT → "Not in the game", no cards
     · otherwise only cards whose odds (at the picked rarity) are in the typed unit or rarer, the closest to the value first
       (typed higher than every card = all the cards in that unit, rarest first · none in that unit = an empty grid) */
  function setOdds(raw) {
    const p = parseOdds(raw);
    if (p && p.error) {
      ui.oddsMsg.textContent = p.error; ui.oddsMsg.dataset.tone = "bad";
      FX.flash && FX.flash(ui.oddsForm);
      return;
    }
    filters.odds = p;
    ui.oddsInput.value = p ? p.text : "";
    apply({ animate: true });
  }
  function oddsMessage(maxV) {
    const o = filters.odds, msg = ui.oddsMsg;
    msg.dataset.tone = "";
    if (!o) { msg.textContent = `Type odds like 300Qa, 2.5B or 1,000,000, or tap a shortcut.`; return; }
    const u = UNITS[o.unit][0] || "", r = state.rarity;
    const qd = u === "Qa" ? " (Qa = “Qd” on the cards)" : "";
    if (oddsState === "game") { msg.textContent = `Not in the game: the rarest odds unit right now is ${GAME_MAX_UNIT}.`; msg.dataset.tone = "bad"; return; }
    if (oddsState === "none") { msg.textContent = `No ${u || "such"} cards at ${r}${qd}. The rarest is 1 in ${shortOdds(maxV)}: try a higher rarity.`; msg.dataset.tone = "warn"; return; }
    if (o.value > maxV) { msg.textContent = `Rarer than every card at ${r} (rarest: 1 in ${shortOdds(maxV)}). Showing every ${u} card${qd}.`; return; }
    msg.textContent = `Closest to 1 in ${o.text} first · ${u ? u + " and rarer" : "every card"} at ${r}${qd}.`;
  }

  function sortValue(c) {
    const r = state.rarity;
    if (filters.sort === "atk") return C.statAt(c, "atk", r);
    if (filters.sort === "hp") return C.statAt(c, "hp", r);
    return C.oddsAt(c, r);
  }
  function compare(a, b) {
    const dir = filters.dir === "asc" ? 1 : -1;
    if (filters.sort === "odds" && filters.odds) {             // closest to the typed odds first (log distance)
      const t = Math.log(filters.odds.value);
      const da = Math.abs(Math.log(C.oddsAt(a, state.rarity)) - t), db = Math.abs(Math.log(C.oddsAt(b, state.rarity)) - t);
      if (da !== db) return (da - db) * -dir;                  // desc (default) = closest first
      const oa = C.oddsAt(a, state.rarity), ob = C.oddsAt(b, state.rarity);
      if (oa !== ob) return ob - oa;
    } else if (filters.sort === "overall") {
      const ra = C.isRanked(a), rb = C.isRanked(b);
      if (ra !== rb) return ra ? -1 : 1;                       // unranked cards always last
      if (ra && a.scores.overall !== b.scores.overall) return (a.scores.overall - b.scores.overall) * dir;
    } else {
      const va = sortValue(a), vb = sortValue(b);
      if (va !== vb) return (va - vb) * dir;
    }
    return a.name.localeCompare(b.name);
  }

  // keepPage: the same list in a new order (a rarity change with exact values) stays on its page
  function apply({ animate = false, keepPage = false } = {}) {
    syncTools();
    if (!built) return;   // the Cards side hasn't been opened yet: its cards don't exist yet
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    const r = state.rarity, o = filters.odds;
    const maxV = state.cards.reduce((m, c) => Math.max(m, C.oddsAt(c, r)), 0);
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
    oddsMessage(maxV);

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
    const near = filters.sort === "odds" && filters.odds;
    ui.sort.style.setProperty("--i", SORT_I[filters.sort]);
    ui.sort.querySelectorAll("[data-sort]").forEach((b) => {
      const on = b.dataset.sort === filters.sort;
      b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1;
    });
    ui.sort.querySelector('[data-sort="odds"]').textContent = filters.odds ? "Closest" : "Rarest";
    ui.dir.dataset.dir = filters.dir;
    ui.dir.setAttribute("aria-label", near
      ? `Order: ${filters.dir === "desc" ? "closest first" : "farthest first"}. Tap to reverse.`
      : `Sort order: ${filters.dir === "desc" ? "high to low" : "low to high"}. Tap to reverse.`);
    ui.oddsClear.hidden = !ui.oddsInput.value && !filters.odds;
    ui.oddsQuick.querySelectorAll("[data-odds]").forEach((b) => b.setAttribute("aria-pressed", String(!!filters.odds && filters.odds.text === b.dataset.odds)));
    if (!built) oddsMessage(0);
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

  /* ---------- Layout: grid 2 · grid 3 · list (remembered on this device) ---------- */
  function setView(v, { animate = true } = {}) {
    if (!VIEWS.includes(v)) return;
    const changed = v !== view;
    view = v;
    C.store.set(VIEW_KEY, v);
    ui.grid.dataset.view = v;
    ui.viewSw.querySelectorAll("[data-view]").forEach((b) => { const on = b.dataset.view === v; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    ui.viewSw.style.setProperty("--i", VIEWS.indexOf(v));
    if (!built) return;
    const first = onPage[0];
    onPage = [];   // repaint (the page size may differ)
    if (first) { const k = shown.indexOf(first); if (k >= 0) page = Math.floor(k / pageSize()); }
    paint({ animate: animate && changed });
  }
  // cards a page: about C.PAGE_SIZE, always whole rows for the columns this layout shows
  function pageSize() {
    const cols = Math.max(1, parseInt(getComputedStyle(ui.grid).getPropertyValue("--grid-cols"), 10) || 1);
    return Math.ceil(C.PAGE_SIZE / cols) * cols;
  }

  // the list view's details next to the card (ATK / HP / odds at the picked rarity)
  function fillInfo(id) {
    const cell = cellEls.get(id), c = cardById.get(id), r = state.rarity;
    if (!cell || !c) return;
    const info = cell.querySelector(".cg-info");
    if (info._r === r) return;
    info._r = r;
    const sub = [c.series, c.role].filter(Boolean).map(esc).join(" · ");
    info.innerHTML = `<span class="cg-info__name">${esc(c.name)}</span>${sub ? `<span class="cg-info__sub">${sub}</span>` : ""}
      <span class="cg-info__stats">
        <span class="cg-stat cg-stat--odds"><b>Odds</b>${esc(C.fmtOdds(C.oddsAt(c, r)))}</span>
        <span class="cg-stat cg-stat--atk"><b>ATK</b>${esc(C.fmtStat(C.statAt(c, "atk", r)))}</span>
        <span class="cg-stat cg-stat--hp"><b>HP</b>${esc(C.fmtHp(C.statAt(c, "hp", r)))}</span>
      </span>`;
  }

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
    if (view === "list") onPage.forEach(fillInfo);
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
    if (filters.sort !== "overall" || filters.odds) jobs.push(() => apply({ keepPage: !filters.odds }));
    if (view === "list") jobs.push(() => onPage.forEach(fillInfo));
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
