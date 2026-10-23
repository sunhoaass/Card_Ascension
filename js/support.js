/* ==========================================================
   Card Battle Infinity — Support page (step 4)
   · List: support cards ranked by Value (search, tier filter, sort)
   · Detail: lives inside the Support page (#support/<id>), not an overlay, so tapping a
     card in it opens the normal card detail on top and Back returns here
   Needs js/fx.js, js/app.js and js/cards.js loaded first.
   Data: data/support.json (see PROGRESS.md §5.4). No rarity levels: support has no ATK / HP.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  // [score key, label, weight %] — same weights as PROGRESS.md §5.4
  const SCORE_ROWS = [["effect", "Effect power", 40], ["reliability", "Reliability", 20], ["flexibility", "Flexibility", 20], ["synergy", "Peak synergy", 20]];

  const filters = { q: "", tier: "", sort: "value", dir: "desc" };
  const ui = {};
  const byId = new Map();        // support id -> support
  const rowEls = new Map();      // support id -> <li> in the list (kept while filtered out)
  const searchText = new Map();  // support id -> lowercase text used by the search box
  const rankOf = new Map();      // support id -> rank by Value (ties share a rank)
  const tiles = new Map();       // card id -> mini cards currently inside the detail view
  let items = [];
  let cardById = new Map();
  let shown = [];                // ids currently in the list, in order
  let rankedCount = 0;
  let current = null;            // support id whose detail is open, null = list
  let listScroll = 0, lastId = null, pendingOrigin = null;

  const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const arr = (a) => (Array.isArray(a) ? a.filter(Boolean) : a ? [a] : []);
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const fmtScore = (n) => String(Number(Number(n).toFixed(1)));      // 82 or 82.5, never a rounded-up number that disagrees with the tier
  const isRanked = (s) => !!(s.scores && s.scores.value > 0 && s.tier);
  const tierVar = (t) => `var(${C.TIER_COLOR[t] || "--t-d"})`;

  function effectParts(s) {
    const e = s.effect;
    if (e && typeof e === "object") return { name: e.name ? String(e.name) : "", desc: e.desc ? String(e.desc) : "" };
    return { name: "", desc: e ? String(e) : "" };
  }
  const effectLine = (s) => { const e = effectParts(s); return e.name && e.desc ? `${e.name}: ${e.desc}` : e.name || e.desc; };

  function computeRanks() {
    const ranked = items.filter(isRanked).sort((a, b) => b.scores.value - a.scores.value);
    rankedCount = ranked.length;
    let r = 0, prev = null;
    ranked.forEach((s, i) => { if (s.scores.value !== prev) { r = i + 1; prev = s.scores.value; } rankOf.set(s.id, r); });
  }

  /* ---------- Support card art (thumbnail in the list, big one in the detail) ---------- */
  function supportCard(s, { thumb = false } = {}) {
    const el = document.createElement("span");
    el.className = "scard" + (thumb ? " scard--thumb" : "");
    if (thumb) el.setAttribute("aria-hidden", "true");
    else { el.setAttribute("role", "img"); el.setAttribute("aria-label", `${s.name}, support card`); }
    if (isRanked(s)) el.style.setProperty("--tc", tierVar(s.tier));
    el.innerHTML = `
      <span class="scard__frame"><span class="scard__body">
        <span class="scard__art">${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy" decoding="async">` : C.placeholderArt(s)}</span>
        ${thumb ? "" : `<span class="scard__tag">Support</span>${isRanked(s) ? `<span class="scard__tier">${esc(s.tier)}</span>` : ""}
        <span class="scard__info"><span class="scard__name">${esc(s.name)}</span></span>
        <span class="scard__glare"></span>`}
      </span></span>`;
    const img = $("img", el);
    if (img) img.addEventListener("error", () => { img.parentElement.innerHTML = C.placeholderArt(s); }, { once: true });
    return el;
  }

  /* ==========================================================
     List
     ========================================================== */
  function rowEl(s) {
    const ranked = isRanked(s);
    const v = ranked ? s.scores.value : 0;
    const odds = num(s.odds);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "srow fx-press";
    btn.dataset.sid = s.id;
    btn.setAttribute("aria-label", ranked
      ? `${s.name}, rank ${rankOf.get(s.id)}, tier ${s.tier}, value ${fmtScore(v)}`
      : `${s.name}, not ranked yet`);
    if (ranked) btn.style.setProperty("--tc", tierVar(s.tier));
    const line = effectLine(s);
    btn.innerHTML = `
      <span class="srow__rank" aria-hidden="true">${ranked ? "#" + rankOf.get(s.id) : "–"}</span>
      <span class="srow__thumb"></span>
      <span class="srow__main">
        <span class="srow__nameline"><span class="srow__name">${esc(s.name)}</span>${s.mock ? `<span class="badge badge--muted srow__sample" title="Example data">Sample</span>` : ""}</span>
        ${line ? `<span class="srow__effect">${esc(line)}</span>` : ""}
        ${odds ? `<span class="srow__odds">Pull odds ${esc(C.fmtOdds(odds))}</span>` : ""}
        ${ranked ? `<span class="srow__bar" aria-hidden="true"><i style="--v:${clamp(v) / 100}"></i></span>` : ""}
      </span>
      <span class="srow__score">${ranked
        ? `<span class="badge badge--tier">${esc(s.tier)}</span><b class="srow__value">${fmtScore(v)}</b><small>Value</small>`
        : `<span class="badge badge--muted">Unranked</span>`}</span>`;
    $(".srow__thumb", btn).appendChild(supportCard(s, { thumb: true }));
    li.appendChild(btn);
    return li;
  }

  function buildFilters() {
    ui.filters.innerHTML = state.meta.tiers.map((t) =>
      `<button type="button" class="chip glass fx-press" data-f="tier" data-v="${esc(t.name)}" aria-pressed="false" style="--sw:${tierVar(t.name)};--sw-line:${tierVar(t.name)}"><span class="chip__swatch"></span>${esc(t.name)}</button>`
    ).join("");
  }

  function compare(a, b) {
    const dir = filters.dir === "asc" ? 1 : -1;
    if (filters.sort === "odds") {
      const oa = num(a.odds), ob = num(b.odds);
      if (!oa !== !ob) return oa ? -1 : 1;                      // no odds listed: always last
      if (oa !== ob) return (oa - ob) * dir;
    } else {
      const ra = isRanked(a), rb = isRanked(b);
      if (ra !== rb) return ra ? -1 : 1;                        // unranked always last
      if (ra && a.scores.value !== b.scores.value) return (a.scores.value - b.scores.value) * dir;
    }
    return a.name.localeCompare(b.name);
  }

  function apply({ animate = false } = {}) {
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = items.filter((s) => {
      if (filters.tier && !(isRanked(s) && s.tier === filters.tier)) return false;
      if (words.length) { const hay = searchText.get(s.id); if (!words.every((w) => hay.includes(w))) return false; }
      return true;
    }).sort(compare);

    const ids = out.map((s) => s.id);
    if (ids.length !== shown.length || ids.some((id, i) => id !== shown[i])) {
      const frag = document.createDocumentFragment();
      ids.forEach((id) => frag.appendChild(rowEls.get(id)));
      ui.list.replaceChildren(frag);
      shown = ids;
      if (animate) FX.stagger(ui.list, 28, { cls: "fx-grid-in", max: 10, limit: 16, cleanup: true });
    }

    ui.filters.querySelectorAll(".chip[data-f]").forEach((b) => b.setAttribute("aria-pressed", String(filters[b.dataset.f] === b.dataset.v)));
    const total = items.length;
    const word = (n) => (n === 1 ? "support card" : "support cards");
    ui.count.textContent = out.length === total ? `${total} ${word(total)}` : `${out.length} of ${total} ${word(total)}`;
    ui.reset.hidden = !(words.length || filters.tier);
    ui.none.hidden = out.length > 0;
    const unranked = total - rankedCount;
    ui.note.hidden = !(unranked && rankedCount);
    ui.note.textContent = unranked ? `${unranked} ${unranked === 1 ? "support card is" : "support cards are"} not ranked yet. ${unranked === 1 ? "It" : "They"} will get a rank once scored.` : "";
  }

  function bindList() {
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

    ui.list.addEventListener("click", (e) => {
      const b = e.target.closest(".srow[data-sid]");
      if (b) openSupport(b.dataset.sid, $(".scard", b));
    });
    ui.detail.addEventListener("click", (e) => { if (e.target.closest(".sdetail__back")) back(); });
    document.addEventListener("keydown", (e) => {
      // Esc: back to the list, unless a card detail is open on top (cards.js handles that one)
      if (e.key === "Escape" && current && !document.documentElement.classList.contains("is-detail")) back();
    });
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
  }

  /* ==========================================================
     Detail
     ========================================================== */
  function resolveCards(ids) {
    return [...new Set(arr(ids))].map((id) => cardById.get(id)).filter(Boolean);
  }

  function track(card, el) {
    if (!tiles.has(card.id)) tiles.set(card.id, []);
    tiles.get(card.id).push(el);
  }

  function miniRow(cards) {
    const row = document.createElement("div");
    row.className = "mini-row";
    cards.forEach((c) => { const el = C.renderCard(c, state.rarity, { mini: true }); track(c, el); row.appendChild(el); });
    return row;
  }

  function slotEl(slot, n, sid) {
    const id = typeof slot === "string" ? slot : slot && slot.card;
    const card = id ? cardById.get(id) : null;
    const wrap = document.createElement("div");
    wrap.className = "deck__slot";
    wrap.innerHTML = `<span class="deck__pos">Slot ${n}</span>`;
    if (card) {
      const el = C.renderCard(card, state.rarity, { mini: true });
      track(card, el);
      wrap.appendChild(el);
    } else {
      // card id not in cards.json (yet): keep the slot so the deck still reads as 5 cards
      const ghost = document.createElement("div");
      ghost.className = "deck__ghost";
      ghost.setAttribute("role", "img");
      ghost.setAttribute("aria-label", `${id ? pretty(id) : "Empty slot"}, not added yet`);
      ghost.innerHTML = `<span>${esc(id ? pretty(id) : "Empty")}</span><small>Not added yet</small>`;
      wrap.appendChild(ghost);
    }
    if (slot && slot.support === sid) wrap.insertAdjacentHTML("beforeend", `<span class="deck__sup deck__sup--here">+ This support</span>`);
    return wrap;
  }

  function deckEl(team, sid) {
    const el = document.createElement("article");
    el.className = "deck glass";
    const name = team.name || pretty(team.id || "Deck");
    el.setAttribute("aria-label", `Deck: ${name}`);
    el.innerHTML = `
      <div class="deck__head">
        <h4 class="deck__name">${esc(name)}</h4>
        ${team.mock ? `<span class="badge badge--muted" title="Example data, not a real recommendation">Sample</span>` : ""}
      </div>
      <div class="deck__slots"></div>`;
    const row = $(".deck__slots", el);
    arr(team.slots).slice(0, 5).forEach((s, i) => row.appendChild(slotEl(s, i + 1, sid)));
    return el;
  }

  function detailHTML(s) {
    const ranked = isRanked(s);
    const sc = s.scores || {};
    const e = effectParts(s);
    const odds = num(s.odds);
    const rank = rankOf.get(s.id);

    const effect = e.name || e.desc
      ? `${e.name ? `<b class="ability__name">${esc(e.name)}</b>` : ""}${e.desc ? `<p class="ability__desc">${esc(e.desc)}</p>` : ""}`
      : `<p class="muted">Not added yet</p>`;

    const value = ranked ? `
      <div class="overall">
        <div class="overall__score"><span class="overall__num" data-d="value" data-value="0">0</span><span class="overall__max">/ 100</span></div>
        <div class="overall__tier"><span class="badge badge--tier">${esc(s.tier)}</span><small>Tier</small></div>
      </div>
      <div class="scores">${SCORE_ROWS.map(([k, label, w], i) => `
        <div class="score" style="--v:${clamp(sc[k]) / 100};--d:${150 + i * 60}ms">
          <span class="score__name">${label}</span><span class="score__weight">${w}%</span>
          <span class="score__num" data-d="s-${k}" data-value="0">0</span>
          <span class="score__track"><i></i></span>
        </div>`).join("")}</div>`
      : `<div class="unranked"><span class="badge badge--muted">Unranked</span><span>This support card hasn't been scored yet. Its Value score and tier will show up here once it is.</span></div>`;

    return `
      <div class="sdetail__bar">
        <button class="detail__back sdetail__back fx-press" type="button" aria-label="Back to the support list">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          <span>All support</span>
        </button>
      </div>
      <div class="detail__content">
        <div class="detail__hero" id="sd-hero"></div>
        <div class="detail__main" id="sd-main">
          <header>
            <p class="detail__series">Support card</p>
            <h2 class="detail__name" id="sd-name" tabindex="-1">${esc(s.name)}</h2>
            <div class="detail__badges">
              ${ranked ? `<span class="badge badge--tier">Tier ${esc(s.tier)}</span>` : `<span class="badge badge--muted">Unranked</span>`}
              ${s.mock ? `<span class="badge badge--muted" title="Example data">Sample</span>` : ""}
            </div>
          </header>

          <div class="dstats">
            <div class="dstat dstat--hp"><div class="dstat__label">Value</div><div class="dstat__value">${ranked ? fmtScore(sc.value) : "–"}</div><div class="dstat__sub">${ranked ? "Out of 100" : "Not ranked yet"}</div></div>
            <div class="dstat"><div class="dstat__label">Rank</div><div class="dstat__value">${ranked ? "#" + rank : "–"}</div><div class="dstat__sub">${ranked ? `of ${rankedCount} ranked` : "Not ranked yet"}</div></div>
            <div class="dstat dstat--odds"><div class="dstat__label">Pull odds</div><div class="dstat__value">${odds ? esc(C.fmtOdds(odds)) : "–"}</div>${odds ? "" : `<div class="dstat__sub">Not listed</div>`}</div>
          </div>

          <section class="dpanel" aria-labelledby="sd-t-effect">
            <h3 class="dpanel__title" id="sd-t-effect">Effect</h3>
            <div class="ability">${effect}</div>
          </section>

          <section class="dpanel" aria-labelledby="sd-t-value">
            <h3 class="dpanel__title" id="sd-t-value">Value score</h3>
            ${ranked ? `<p class="dpanel__sub">Weighted sum of four scores, each out of 100.</p>` : ""}
            ${value}
          </section>

          <section class="dpanel" aria-labelledby="sd-t-pair">
            <h3 class="dpanel__title" id="sd-t-pair">Where to run it</h3>
            <div class="group"><h4 class="group__title group__title--good">Best on these cards <span class="group__count" id="sd-with-n"></span></h4><div id="sd-with"></div></div>
            <div class="group"><h4 class="group__title">Best decks <span class="group__count" id="sd-decks-n"></span></h4><div id="sd-decks" class="deck-list"></div></div>
            <div class="group"><h4 class="group__title group__title--bad">Don't pair with <span class="group__count" id="sd-avoid-n"></span></h4><div id="sd-avoid"></div></div>
          </section>

          <footer class="detail__foot">
            ${s.notes ? `<p>${esc(s.notes)}</p>` : ""}
            ${s.updated ? `<p>Updated ${esc(s.updated)}</p>` : ""}
          </footer>
        </div>
      </div>`;
  }

  function fillPairings(s) {
    const none = () => { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Not analyzed yet"; return p; };
    // count = how many cards / decks the heading counts (a card row is one node but many cards)
    const fill = (sel, nSel, nodes, count) => {
      const box = $(sel, ui.detail), n = $(nSel, ui.detail);
      if (nodes.length) { nodes.forEach((x) => box.appendChild(x)); n.textContent = count; }
      else box.appendChild(none());
    };
    const withs = resolveCards(s.bestWith), avoid = resolveCards(s.avoidWith);
    const decks = [...new Set(arr(s.bestDeck))]
      .map((id) => (Array.isArray(state.teams) ? state.teams.find((t) => t && t.id === id) : null))
      .filter((t) => t && arr(t.slots).length);
    fill("#sd-with", "#sd-with-n", withs.length ? [miniRow(withs)] : [], withs.length);
    fill("#sd-decks", "#sd-decks-n", decks.map((t) => deckEl(t, s.id)), decks.length);
    fill("#sd-avoid", "#sd-avoid-n", avoid.length ? [miniRow(avoid)] : [], avoid.length);
  }

  function openDetail(s) {
    if (current === null) listScroll = window.scrollY;
    const from = pendingOrigin; pendingOrigin = null;
    const fromRect = from && from.isConnected ? from.getBoundingClientRect() : null;   // measured before the list hides

    tiles.clear();
    ui.detail.innerHTML = detailHTML(s);
    ui.detail.style.setProperty("--tc", tierVar(s.tier));
    const hero = supportCard(s);
    FX.tilt(hero);
    $("#sd-hero", ui.detail).appendChild(hero);
    fillPairings(s);

    ui.listView.hidden = true;
    ui.detail.hidden = false;
    window.scrollTo(0, 0);
    current = s.id; lastId = s.id;

    const flight = fromRect && rectVisible(fromRect) ? FX.flip(hero, fromRect) : null;
    if (!flight) FX.fade(hero, 1, { duration: 300 });
    FX.stagger($("#sd-main", ui.detail), 60, { cls: "fx-up", max: 8, cleanup: true });

    const sc = s.scores || {};
    const fmt = (n) => fmtScore(n);
    if (isRanked(s)) {
      FX.countTo($('[data-d="value"]', ui.detail), sc.value, { format: fmt });
      SCORE_ROWS.forEach(([k]) => FX.countTo($(`[data-d="s-${k}"]`, ui.detail), clamp(sc[k]), { format: fmt }));
    }
    const backBtn = $(".sdetail__back", ui.detail);
    if (backBtn) backBtn.focus({ preventScroll: true });
  }

  function closeDetail(restore) {
    current = null;
    tiles.clear();
    ui.detail.hidden = true;
    ui.detail.innerHTML = "";
    ui.listView.hidden = false;
    ui.listView.classList.remove("fx-page-in"); void ui.listView.offsetWidth; ui.listView.classList.add("fx-page-in");
    if (restore && state.page === "support") {
      window.scrollTo(0, listScroll);
      const row = rowEls.get(lastId);
      const btn = row && $(".srow", row);
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  /* Called by the router (js/app.js) on every hash change and tab tap */
  function show(id, { restore = true } = {}) {
    if (!ui.root) return;
    if (id && !byId.has(id)) { history.replaceState(null, "", "#support"); id = null; }   // unknown id -> the list
    if (id === current) return;
    if (id) openDetail(byId.get(id));
    else closeDetail(restore);
  }

  // Each open adds a history entry, so the phone's Back button returns to the list
  function openSupport(id, originEl) {
    pendingOrigin = originEl || null;
    history.pushState({ sup: 1 }, "", "#support/" + encodeURIComponent(id));
    C.route();
  }
  function back() {
    if (history.state && history.state.sup) history.back();
    else { history.replaceState(null, "", "#support"); C.route(); }   // opened from a direct link: no entry to go back to
  }

  /* Rarity changed somewhere else (cards.js): keep the mini cards here in step */
  function recolor(name) {
    const all = [];
    tiles.forEach((els, id) => els.forEach((el) => all.push([el, cardById.get(id)])));
    const seen = all.map(([el]) => el.isConnected && rectVisible(el.getBoundingClientRect()));
    all.forEach(([el, card], i) => card && C.setCardRarity(el, card, name, { animate: seen[i] }));
  }

  /* ---------- Boot ---------- */
  function init() {
    Object.assign(ui, {
      root: $("#page-support"), listView: $("#support-list-view"), detail: $("#support-detail-view"),
      tools: $("#support-tools"), list: $("#support-list"), none: $("#support-none"), empty: $("#support-empty"), note: $("#support-note"),
      search: $("#support-search"), sort: $("#support-sort"), dir: $("#support-dir"), filters: $("#support-filters"),
      count: $("#support-count"), reset: $("#support-reset"),
    });
    cardById = new Map(state.cards.map((c) => [c.id, c]));
    items = (Array.isArray(state.support) ? state.support : [])
      .filter((s) => s && s.id)
      .map((s) => ({ ...s, name: s.name || pretty(s.id) }));
    items.forEach((s) => {
      byId.set(s.id, s);
      searchText.set(s.id, [s.name, effectLine(s)].filter(Boolean).join(" ").toLowerCase());
    });

    ui.list.innerHTML = "";
    ui.tools.hidden = !items.length;
    ui.empty.hidden = items.length > 0;
    bindList();
    if (!items.length) return;

    computeRanks();
    buildFilters();
    items.forEach((s) => rowEls.set(s.id, rowEl(s)));
    apply({ animate: true });
  }

  // card(s): the support card art (js/tier.js draws the Global support tier list with it) · open(id, originEl): open #support/<id>
  C.support = { init, show, card: supportCard, open: openSupport };
})();
