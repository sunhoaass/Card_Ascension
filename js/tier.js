/* ==========================================================
   Card Battle Infinity — Tier List (step 3, reshaped in step 7)
   · Global | My Lists tabs (#tier = Global, #tier/my = My Lists, #tier/my/<id> = one list in the Tier Maker,
     #tier/s/<data> = a list someone shared, view only, shown inside My Lists)
   · My Lists (the Tier Maker, step 8) lives in js/tiermaker.js: this file calls C.tm.init() once and
     C.tm.show(listId|null, sharedData|null) every time My Lists is showing
   · Global is view-only and has a Cards | Support switch (they never share a list)
     - Cards: rows Meta–D by Overall (only the top meta.rankTop cards are ranked) + the Utility row (by utilGain), rarity picker shared with the Cards page
     - Support: rows Meta–B by Value (data/support.json · ranked at Godly), no rarity
   Meta Decks moved to the Deck page (js/deck.js).
   Needs js/fx.js, js/app.js, js/cards.js loaded first (support.js is only needed when a support tile is tapped).
   The rarity chips here are handled by js/cards.js (one shared rarity for the whole site);
   it announces every change with the "cbi:rarity" event, which this file listens to.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const KIND_KEY = "cbi:tierKind";      // "cards" | "support" (last Global view)
  const TITLES = { global: null, my: "My Tier Lists — Card Battle Infinity" };   // null = the page's normal title
  const LEADS = {
    cards: "The strongest cards by Overall score, from Meta at the top to B at the bottom. Meta and SS are the Meta cards. Pick a rarity to see its stats. Tap a card for the full breakdown.",
    support: "The strongest support cards by Value at Godly, from Meta at the top to B at the bottom. Tap one for the full breakdown.",
    my: "Your own tier lists, saved on this device.",
    shared: "A tier list someone shared with you. It's view only: tap Save a copy to keep your own.",
  };

  const ui = {};
  const tiles = new Map();      // card id -> card elements on this page
  let cardById = new Map();
  let supportItems = [];
  let view = null;              // "global" | "my" (null until the router calls show())
  let kind = "cards";           // which Global list is showing
  let globalBuilt = false;      // Global rows exist (made the first time Global is on screen, step 9.5)

  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const byOverall = (a, b) => b.scores.overall - a.scores.overall || a.name.localeCompare(b.name);
  const byGain = (a, b) => (b.utilGain || 0) - (a.utilGain || 0) || byOverall(a, b);   // Utility row: biggest deck boost first
  const byValue = (a, b) => b.scores.value - a.scores.value || a.name.localeCompare(b.name);
  const isRankedSupport = (s) => !!(s.scores && s.scores.value > 0 && s.tier);
  const fmtScore = (n) => String(Number(Number(n).toFixed(1)));
  const tierVar = (t) => `var(${C.TIER_COLOR[t] || "--t-d"})`;
  const topN = C.rankTop, topS = C.rankTopSupport;   // data/meta.json rankTop (48) · rankTopSupport (100)

  function track(card, el) {
    if (!tiles.has(card.id)) tiles.set(card.id, []);
    tiles.get(card.id).push(el);
  }

  /* ---------- One row per tier (shared by Cards and Support) ---------- */
  // cards: true = also the cardsOnly rows (Utility, last)
  function buildRows(items, order, makeTile, noun, cards = false) {
    const frag = document.createDocumentFragment();
    state.meta.tiers.filter((t) => cards || !t.cardsOnly).forEach((t) => {
      const group = items.filter((x) => x.tier === t.name).sort(t.cardsOnly ? byGain : order);
      const row = document.createElement("section");
      row.className = "tier-row glass";
      row.style.setProperty("--tc", tierVar(t.name));
      row.setAttribute("aria-label", `${t.cardsOnly ? t.name + " row" : "Tier " + t.name}, ${plural(group.length, noun[0], noun[1])}`);
      const long = t.name.length > 4 ? ' class="tier-row__name--xl"' : t.name.length > 2 ? ' class="tier-row__name--long"' : "";
      row.innerHTML = `<div class="tier-row__label"><span${long}>${esc(t.name)}</span><small class="tier-row__count">${group.length}</small></div><div class="tier-row__cards"></div>`;
      const wrap = $(".tier-row__cards", row);
      if (group.length) group.forEach((x) => wrap.appendChild(makeTile(x)));
      else wrap.innerHTML = `<p class="tier-row__empty">No ${esc(noun[1])} in this tier yet</p>`;
      frag.appendChild(row);
    });
    return frag;
  }

  /* ---------- Global: Cards ---------- */
  function renderCards() {
    const ranked = state.cards.filter(C.isRanked);       // Unranked cards never appear in a row
    const unranked = state.cards.length - ranked.length;

    ui.none.hidden = ranked.length > 0;
    ui.list.hidden = ranked.length === 0;
    if (!ranked.length) {
      $("#tier-none-title").textContent = state.cards.length ? "Rankings coming soon" : "No cards yet";
      $("#tier-none-text").textContent = state.cards.length
        ? `The cards are in, but none of them have been scored yet. The top ${topN()} will show up here once they are.`
        : "The card library is being filled in. Check back soon.";
    }
    const extra = C.extraTiers(), util = ranked.filter((c) => extra.has(c.tier)).length;
    ui.note.hidden = !(ranked.length && unranked);
    ui.note.textContent = unranked
      ? `Only the top ${topN()} cards are ranked${util ? `, plus ${plural(util, "Utility card", "Utility cards")} that boost the whole deck` : ""}. The other ${plural(unranked, "card is", "cards are")} still in Cards and can go in any deck.`
      : "";

    ui.list.replaceChildren(buildRows(ranked, byOverall, (c) => {
      const el = C.renderCard(c, state.rarity, { mini: true });
      track(c, el);
      return el;
    }, ["card", "cards"], true));
  }

  /* ---------- Global: Support ---------- */
  function supportTile(s) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stile";
    b.dataset.sid = s.id;
    b.setAttribute("aria-label", `${s.name}, support card, tier ${s.tier}, value ${fmtScore(s.scores.value)}`);
    const art = C.support.card(s);
    $(".scard__info", art).insertAdjacentHTML("beforeend", `<span class="stile__val">${esc(fmtScore(s.scores.value))}</span>`);
    FX.tilt(art);
    b.appendChild(art);
    return b;
  }

  function renderSupport() {
    const ranked = supportItems.filter(isRankedSupport);
    const unranked = supportItems.length - ranked.length;

    ui.snone.hidden = ranked.length > 0;
    ui.slist.hidden = ranked.length === 0;
    if (!ranked.length) {
      $("#tier-snone-title").textContent = supportItems.length ? "Rankings coming soon" : "No support cards yet";
      $("#tier-snone-text").textContent = supportItems.length
        ? `The support cards are in, but none of them have been scored yet. The top ${topS()} will show up here once they are.`
        : "Support rankings will show here once the first support cards are added.";
    }
    ui.snote.hidden = !(ranked.length && unranked);
    ui.snote.textContent = unranked
      ? `Only the top ${topS()} support cards are ranked. The other ${plural(unranked, "support card is", "support cards are")} still in Support and can go in any deck.`
      : "";

    ui.slist.replaceChildren(buildRows(ranked, byValue, supportTile, ["support card", "support cards"]));
  }

  /* step 9.5: Global's rows (cards + support tiles) are made the first time Global is actually on screen,
     not while another tab or My Lists is showing */
  function buildGlobal() {
    if (globalBuilt) return;
    globalBuilt = true;
    renderCards();
    renderSupport();
    FX.stagger(kind === "support" ? ui.slist : ui.list);
  }

  /* ---------- Switches ---------- */
  function pageTitle() {
    if (state.page === "tier") document.title = TITLES[view] || "Card Battle Infinity — Tier List & Card Database";
  }

  function setLead() {
    const shared = view === "my" && C.tm && C.tm.mode && C.tm.mode() === "shared";
    ui.lead.textContent = shared ? LEADS.shared : view === "my" ? LEADS.my : LEADS[kind];
  }

  function animateIn(el) {
    el.classList.remove("fx-page-in"); void el.offsetWidth; el.classList.add("fx-page-in");
  }

  // #tier/my/<id> -> the list id (null = all lists)
  const listFromHash = () => { const m = location.hash.match(/^#\/?tier\/my\/([^/?#]+)/); return m ? decodeURIComponent(m[1]) : null; };
  // #tier/s/<data> -> a list somebody shared (packed in the link by js/share.js), or null
  const sharedFromHash = () => { const m = location.hash.match(/^#\/?tier\/s\/([^/?#]+)/); return m ? m[1] : null; };

  /* Global | My Lists. Called by the router on every hash change and tab tap. */
  function show(name) {
    if (!ui.root) return;
    const next = name === "my" ? "my" : "global";
    const first = view === null;
    const changed = next !== view;
    view = next;
    if (next === "global" && state.page === "tier") buildGlobal();
    pageTitle();                                  // showPage() resets the title on every route, so set it every time
    if (next === "my" && C.tm) C.tm.show(listFromHash(), sharedFromHash());   // all lists, the list in the link, or a shared list (also sets the title)
    setLead();
    if (!changed) return;

    ui.tabs.style.setProperty("--i", next === "my" ? 1 : 0);
    ui.tabBtns.forEach((b) => {
      const on = b.dataset.tab === next;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    ui.global.hidden = next !== "global";
    ui.my.hidden = next !== "my";
    setLead();
    if (!first) animateIn(next === "my" ? ui.my : ui.global);
  }

  function setKind(k, { animate = true } = {}) {
    kind = k === "support" ? "support" : "cards";
    C.store.set(KIND_KEY, kind);
    ui.kind.style.setProperty("--i", kind === "support" ? 1 : 0);
    ui.kindBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === kind)));
    ui.cardsView.hidden = kind !== "cards";
    ui.supView.hidden = kind !== "support";
    setLead();
    if (animate) FX.stagger(kind === "support" ? ui.slist : ui.list);
  }

  function bind() {
    // Global | My Lists: tab-like, so no history entries (same as the bottom tabs)
    ui.tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".seg__btn[data-tab]");
      if (!b || b.dataset.tab === view) return;
      history.replaceState(null, "", b.dataset.tab === "my" ? "#tier/my" : "#tier");
      C.route();
    });
    ui.tabs.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const to = $(`.seg__btn[data-tab="${view === "my" ? "global" : "my"}"]`, ui.tabs);
      if (to) { to.focus(); to.click(); }
    });
    ui.kind.addEventListener("click", (e) => {
      const b = e.target.closest(".seg__btn[data-kind]");
      if (b && b.dataset.kind !== kind) setKind(b.dataset.kind);
    });

    // A support tile opens the Support detail. The Tier List keeps its scroll position in this history entry,
    // so Back (phone button or the page's Back) returns here exactly where you were (app.js reads tierY).
    ui.slist.addEventListener("click", (e) => {
      const b = e.target.closest(".stile[data-sid]");
      if (!b) return;
      try { history.replaceState({ ...(history.state || {}), tierY: window.scrollY }, ""); } catch {}
      C.support.open(b.dataset.sid, $(".scard", b));
    });
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
  }

  /* ---------- Rarity change (from the chips here or anywhere else) ---------- */
  function recolor(name) {
    const all = [];
    tiles.forEach((els, id) => els.forEach((el) => all.push([el, cardById.get(id)])));
    // read every position first, then write: mixing them forces a re-layout per card
    const seen = all.map(([el]) => el.isConnected && rectVisible(el.getBoundingClientRect()));
    all.forEach(([el, card], i) => card && C.setCardRarity(el, card, name, { animate: seen[i] }));
  }

  /* Called by the router when the Tier List tab becomes the current page.
     restore: coming Back from a support detail, so keep the old scroll position and skip the entrance animation. */
  function enter({ restore = false } = {}) {
    if (restore) {
      const y = history.state.tierY;
      try {
        const { tierY, ...rest } = history.state;
        history.replaceState(Object.keys(rest).length ? rest : null, "");
      } catch {}
      window.scrollTo(0, y);
      return;
    }
    if (view === "my") return;
    if (!globalBuilt) { buildGlobal(); return; }   // first visit: buildGlobal plays the entrance itself
    FX.stagger(kind === "support" ? ui.slist : ui.list);
  }

  function init() {
    Object.assign(ui, {
      root: $("#page-tier"), lead: $("#tier-lead"),
      tabs: $("#tier-tabs"), tabBtns: [...document.querySelectorAll("#tier-tabs .seg__btn")],
      global: $("#tier-global"), my: $("#tier-my"),
      kind: $("#tier-kind"), kindBtns: [...document.querySelectorAll("#tier-kind .seg__btn")],
      cardsView: $("#tier-cards-view"), supView: $("#tier-support-view"),
      rarity: $("#tier-rarity"), list: $("#tier-list"), none: $("#tier-none"), note: $("#tier-note"),
      slist: $("#tier-slist"), snone: $("#tier-snone"), snote: $("#tier-snote"),
    });
    cardById = new Map(state.cards.map((c) => [c.id, c]));
    supportItems = (Array.isArray(state.support) ? state.support : [])
      .filter((s) => s && s.id)
      .map((s) => ({ ...s, name: s.name || pretty(s.id) }));

    ui.rarity.hidden = !state.cards.length;
    ui.rarity.innerHTML = C.rarityChipsHTML();
    bind();
    setKind(C.store.get(KIND_KEY), { animate: false });   // rows are built later by buildGlobal()
    if (C.tm) C.tm.init();
  }

  C.tier = { init, enter, show };
})();
