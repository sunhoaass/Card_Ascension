/* ==========================================================
   Card Battle Infinity — Cards page + card detail (step 2)
   · Cards page: rarity picker, search, sort, tier / role / series filters
   · Card detail: full-screen sheet opened with a shared-element move (§4)
   Needs js/fx.js and js/app.js (window.FX, window.CBI) loaded first.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const SCORE_ROWS = [["atk", "ATK", 12.5], ["hp", "HP", 12.5], ["passive", "Passive", 15], ["skill", "Skill", 15], ["matchup", "Matchup", 25], ["team", "Team", 20]];
  const ROLE_ORDER = ["DPS", "Tank", "Support", "Hybrid"];

  const filters = { q: "", tier: "", role: "", series: "", sort: "overall", dir: "desc" };
  const cardById = new Map();     // id -> card data
  const cardEls = new Map();      // id -> card element in the grid (kept even while filtered out)
  const searchText = new Map();   // id -> lowercase text used by the search box
  const ui = {};
  let shown = [];                 // ids currently in the grid, in order
  let cur = null, isOpen = false, hiddenEl = null, prevFocus = null, token = 0, baseTitle = "";

  const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const settle = (a) => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());

  /* ==========================================================
     Cards page
     ========================================================== */
  function init() {
    Object.assign(ui, {
      tools: $("#cards-tools"), grid: $("#card-grid"), none: $("#cards-none"), empty: $("#cards-empty"),
      rarity: $("#rarity-picker"), filters: $("#card-filters"), search: $("#card-search"),
      sort: $("#card-sort"), dir: $("#card-dir"), series: $("#card-series"), seriesField: $("#series-field"),
      count: $("#card-count"), reset: $("#card-reset"),
      detail: $("#detail"), scrim: $("#detail .detail__scrim"), content: $("#detail-content"), close: $("#detail-close"),
    });
    baseTitle = document.title;
    bindDetail();

    state.cards.forEach((c) => {
      cardById.set(c.id, c);
      const p = c.passive || {}, s = c.skill || {};
      searchText.set(c.id, [c.name, c.series, c.role, p.name, p.desc, s.name, s.desc].filter(Boolean).join(" ").toLowerCase());
    });

    ui.grid.innerHTML = "";
    ui.tools.hidden = !state.cards.length;
    ui.empty.hidden = state.cards.length > 0;
    if (!state.cards.length) return;

    rarityChips(ui.rarity);
    buildFilters();
    state.cards.forEach((c) => cardEls.set(c.id, C.renderCard(c, state.rarity)));
    bindTools();
    apply({ animate: true });
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

    // Rarity chips (page + detail share one state)
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".chip[data-rarity]");
      if (b) setRarity(b.dataset.rarity);
    });
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

  /* Change rarity everywhere (page chips, grid cards, open detail) */
  function setRarity(name) {
    if (name === state.rarity || !state.meta.rarities.some((r) => r.name === name)) return;
    state.rarity = name;
    C.store.set(C.RARITY_KEY, name);
    document.querySelectorAll(".chip[data-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rarity === name)));
    // read every position first, then write — mixing them forces a re-layout per card
    const onScreen = new Map();
    cardEls.forEach((el, id) => onScreen.set(id, el.isConnected && rectVisible(el.getBoundingClientRect())));
    cardEls.forEach((el, id) => C.setCardRarity(el, cardById.get(id), name, { animate: onScreen.get(id) }));
    document.querySelectorAll("#detail .card").forEach((el) => {
      const card = cardById.get(el.dataset.id);
      if (card) C.setCardRarity(el, card, name, { animate: true });
    });
    if (isOpen) fillStats(cardById.get(cur));
    if (filters.sort !== "overall") apply();   // exact game values can change the order; no-op when it doesn't
  }

  /* ==========================================================
     Card detail
     ========================================================== */
  function bindDetail() {
    ui.close.addEventListener("click", () => C.closeCard());
    ui.detail.addEventListener("click", (e) => { if (e.target === ui.detail || e.target === ui.scrim) C.closeCard(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) { C.closeCard(); return; }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".card[role=button]")) {
        e.preventDefault();
        activate(e.target);
      }
    });
    document.addEventListener("click", (e) => {
      const el = e.target.closest(".card[data-id]");
      if (el) activate(el);
    });
  }

  function activate(el) {
    if (el.closest(".detail__hero") || !el.closest(".main, #detail")) return;
    if (isOpen && cur === el.dataset.id) return;
    C.openCard(el.dataset.id, el);
  }

  const q = (k) => ui.content.querySelector(`[data-d="${k}"]`);

  const fmtSlot = (p) => {
    const t = String(p ?? "").trim();
    if (!t) return "";
    if (/^\d+$/.test(t)) return "Slot " + t;
    if (/^\d+\s*[-–]\s*\d+$/.test(t)) return "Slots " + t.replace(/\s*[-–]\s*/, "–");
    return t;
  };

  function subStat(card, key, r) {
    if (card.exact && card.exact[r] && card.exact[r][key]) return "Game value";
    if (r === "Normal") return "Base value";
    return `Normal ${C.fmtStat(card.base[key])} × ${C.rarityOf(r).stat}`;
  }

  function detailHTML(card) {
    const ranked = C.isRanked(card);
    const s = card.scores || {}, team = card.team || {};
    const strengths = list(card.strengths), weaknesses = list(card.weaknesses);
    const asText = (a) => (a && (a.name || a.desc)) ? `${a.name ? `<b class="ability__name">${esc(a.name)}</b>` : ""}${a.desc ? `<p class="ability__desc">${esc(a.desc)}</p>` : ""}` : `<p class="muted">None</p>`;
    const bullets = (arr, cls) => arr.length ? `<ul class="pc pc--${cls}">${arr.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">Not analyzed yet</p>`;
    const supports = list(team.bestSupport).map((id) => { const f = state.support.find((x) => x.id === id); return f && f.name ? f.name : pretty(id); });
    const slot = fmtSlot(team.position);
    const resolve = (ids) => list(ids).map((id) => cardById.get(id)).filter((c) => c && c.id !== card.id);
    const beats = resolve(card.beats), loses = resolve(card.losesTo), withs = resolve(team.bestWith);
    const row = (id, arr) => arr.length ? `<div class="mini-row" id="${id}"></div>` : `<p class="muted">Not analyzed yet</p>`;

    const overall = ranked ? `
      <div class="overall">
        <div class="overall__score"><span class="overall__num" data-d="overall" data-value="0">0</span><span class="overall__max">/ 100</span></div>
        <div class="overall__tier"><span class="badge badge--tier">${esc(card.tier)}</span><small>Tier</small></div>
      </div>
      <div class="scores">${SCORE_ROWS.map(([k, label, w], i) => `
        <div class="score" style="--v:${clamp(s[k]) / 100};--d:${150 + i * 60}ms">
          <span class="score__name">${label}</span><span class="score__weight">${w}%</span>
          <span class="score__num" data-d="s-${k}" data-value="0">0</span>
          <span class="score__track"><i></i></span>
        </div>`).join("")}</div>`
      : `<div class="unranked"><span class="badge badge--muted">Unranked</span><span>This card hasn't been scored yet. Its Overall score and tier will show up here once it is.</span></div>`;

    return `
      <div class="detail__hero" id="d-hero"></div>
      <div class="detail__main" id="d-main">
        <header>
          <p class="detail__series">${esc(card.series)}</p>
          <h2 class="detail__name" id="detail-name">${esc(card.name)}</h2>
          <div class="detail__badges">
            ${ranked ? `<span class="badge badge--tier">Tier ${esc(card.tier)}</span>` : `<span class="badge badge--muted">Unranked</span>`}
            ${card.role ? `<span class="badge">${esc(card.role)}</span>` : ""}
          </div>
        </header>

        <div id="d-rarity" class="rarity-picker" role="group" aria-label="Rarity"></div>

        <div class="dstats">
          <div class="dstat dstat--atk"><div class="dstat__label">ATK</div><div class="dstat__value" data-d="atk" data-value="0">0</div><div class="dstat__sub" data-d="atk-sub"></div></div>
          <div class="dstat dstat--hp"><div class="dstat__label">HP</div><div class="dstat__value" data-d="hp" data-value="0">0</div><div class="dstat__sub" data-d="hp-sub"></div></div>
          <div class="dstat dstat--odds"><div class="dstat__label">Pull odds</div><div class="dstat__value" data-d="odds"></div><div class="dstat__sub" data-d="odds-sub"></div></div>
        </div>

        <section class="dpanel" aria-labelledby="d-t-overall">
          <h3 class="dpanel__title" id="d-t-overall">Overall score</h3>
          ${ranked ? `<p class="dpanel__sub">Weighted sum of six scores, each out of 100.</p>` : ""}
          ${overall}
        </section>

        <section class="dpanel" aria-labelledby="d-t-abilities">
          <h3 class="dpanel__title" id="d-t-abilities">Abilities</h3>
          <div class="ability"><span class="ability__kind">Passive</span>${asText(card.passive)}</div>
          <div class="ability"><span class="ability__kind">Skill</span>${asText(card.skill)}</div>
        </section>

        <section class="dpanel" aria-labelledby="d-t-pc">
          <h3 class="dpanel__title" id="d-t-pc">Strengths &amp; weaknesses</h3>
          <div class="proscons">
            <div><h4 class="pc__title pc__title--good">Strengths</h4>${bullets(strengths, "good")}</div>
            <div><h4 class="pc__title pc__title--bad">Weaknesses</h4>${bullets(weaknesses, "bad")}</div>
          </div>
        </section>

        <section class="dpanel" aria-labelledby="d-t-match">
          <h3 class="dpanel__title" id="d-t-match">Matchups</h3>
          <div class="group"><h4 class="group__title group__title--good">Beats <span class="group__count">${beats.length || ""}</span></h4>${row("d-beats", beats)}</div>
          <div class="group"><h4 class="group__title group__title--bad">Loses to <span class="group__count">${loses.length || ""}</span></h4>${row("d-loses", loses)}</div>
        </section>

        <section class="dpanel" aria-labelledby="d-t-team">
          <h3 class="dpanel__title" id="d-t-team">Team</h3>
          <div class="group"><h4 class="group__title">Best slot</h4><div class="chips">${slot ? `<span class="badge">${esc(slot)}</span>` : `<span class="muted">Not analyzed yet</span>`}</div></div>
          <div class="group"><h4 class="group__title">Works well with</h4>${row("d-with", withs)}</div>
          <div class="group"><h4 class="group__title">Recommended support</h4>${supports.length ? `<div class="chips">${supports.map((n) => `<span class="supchip">${esc(n)}</span>`).join("")}</div>` : `<p class="muted">Not analyzed yet</p>`}</div>
        </section>

        <footer class="detail__foot">
          ${card.notes ? `<p>${esc(card.notes)}</p>` : ""}
          ${card.updated ? `<p>Updated ${esc(card.updated)}</p>` : ""}
        </footer>
      </div>`;
  }

  /* ATK / HP / odds tiles for the current rarity (numbers count to the new value) */
  function fillStats(card) {
    const r = state.rarity, info = C.rarityOf(r);
    FX.countTo(q("atk"), C.statAt(card, "atk", r), { format: C.fmtStat });
    FX.countTo(q("hp"), C.statAt(card, "hp", r), { format: C.fmtStat });
    q("odds").textContent = C.fmtOdds(C.oddsAt(card, r));
    q("atk-sub").textContent = subStat(card, "atk", r);
    q("hp-sub").textContent = subStat(card, "hp", r);
    q("odds-sub").textContent = r === "Normal" ? "Base odds" : `Normal ${C.fmtOdds(card.base.odds)} · ${info.odds}× rarer`;
  }

  function render(card) {
    ui.content.innerHTML = detailHTML(card);
    ui.content.style.setProperty("--tc", `var(${C.TIER_COLOR[card.tier] || "--t-d"})`);
    ui.hero = C.renderCard(card, state.rarity);
    $("#d-hero", ui.content).appendChild(ui.hero);
    ui.main = $("#d-main", ui.content);
    rarityChips($("#d-rarity", ui.content));

    const s = card.scores || {};
    [["#d-beats", card.beats], ["#d-loses", card.losesTo], ["#d-with", card.team && card.team.bestWith]].forEach(([sel, ids]) => {
      const rowEl = $(sel, ui.content);
      if (!rowEl) return;
      list(ids).map((id) => cardById.get(id)).filter((c) => c && c.id !== card.id)
        .forEach((c) => rowEl.appendChild(C.renderCard(c, state.rarity, { mini: true })));
    });

    fillStats(card);
    if (C.isRanked(card)) {
      FX.countTo(q("overall"), s.overall, { format: (n) => String(Math.round(n)) });
      SCORE_ROWS.forEach(([k]) => FX.countTo(q("s-" + k), clamp(s[k]), { format: (n) => String(Math.round(n)) }));
    }
  }

  /* The element a card grows from / returns to: the clicked card, else the card on the page underneath */
  function returnTarget(id) {
    const page = $("#page-" + (state.page || "cards"));
    return page ? page.querySelector(`.card[data-id="${CSS.escape(id)}"]`) : null;
  }
  function takeOrigin(id) {
    const o = state.origin; state.origin = null;
    if (o && o.isConnected && o.dataset.id === id) return o;
    return returnTarget(id);
  }
  function restoreHidden() { if (hiddenEl) { hiddenEl.style.visibility = ""; hiddenEl = null; } }
  function cancelAnims() {
    [ui.scrim, ui.main, ui.hero].forEach((el) => el && el.getAnimations && el.getAnimations().forEach((a) => a.cancel()));
  }
  function setBackground(on) {
    document.documentElement.classList.toggle("is-detail", on);
    [".topbar", ".nav", ".main"].forEach((sel) => { const el = $(sel); if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
  }

  function open(id) {
    const card = cardById.get(id);
    if (!card) { C.closeCard(); return; }          // unknown id in the link -> back to the page
    if (isOpen && cur === id) return;

    const wasOpen = !ui.detail.hidden;
    token++; cancelAnims();
    const origin = takeOrigin(id);
    const fromRect = origin ? origin.getBoundingClientRect() : null;
    restoreHidden();
    render(card);

    if (!wasOpen) {
      prevFocus = document.activeElement;
      ui.detail.hidden = false;
      setBackground(true);
      FX.fade(ui.scrim, 1);
      ui.close.focus({ preventScroll: true });
    }
    ui.detail.scrollTop = 0;
    ui.detail.setAttribute("aria-label", `${card.name} details`);
    document.title = `${card.name} — ${baseTitle}`;
    const t = returnTarget(id);
    if (t) { t.style.visibility = "hidden"; hiddenEl = t; }

    const flight = fromRect && rectVisible(fromRect) ? FX.flip(ui.hero, fromRect) : null;
    if (!flight) FX.fade(ui.hero, 1, { duration: 300 });
    FX.stagger(ui.main, 60, { cls: "fx-up", max: 8, cleanup: true });
    cur = id; isOpen = true;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    const id = cur; cur = null;
    const mine = ++token;

    let toRect = null;
    const target = returnTarget(id);
    if (target) {
      let r = target.getBoundingClientRect();
      if (r.width && !rectVisible(r)) { target.scrollIntoView({ block: "center", behavior: "instant" }); r = target.getBoundingClientRect(); }
      if (r.width) toRect = r;
    }
    const runs = [FX.fade(ui.scrim, 0), FX.fade(ui.main, 0, { duration: 160 })];
    runs.push((toRect && FX.flip(ui.hero, toRect, { reverse: true, duration: 320 })) || FX.fade(ui.hero, 0, { duration: 200 }));
    Promise.all(runs.map(settle)).then(() => { if (mine === token) finish(); });
  }

  function finish() {
    ui.detail.hidden = true;
    cancelAnims();
    ui.content.innerHTML = "";
    setBackground(false);
    document.title = baseTitle;
    const back = hiddenEl;
    restoreHidden();
    const f = back || prevFocus;
    if (f && f.focus) f.focus({ preventScroll: true });
    prevFocus = null;
  }

  C.cards = { init, open, close };
})();
