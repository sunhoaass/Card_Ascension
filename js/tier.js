/* ==========================================================
   Card Battle Infinity — Tier List (step 3, reshaped in step 7)
   · Global | My Lists tabs (#tier = Global, #tier/my = My Lists, #tier/my/<id> = one list in the Tier Maker,
     #tier/s/<data> = a list someone shared, view only, shown inside My Lists)
   · My Lists (the Tier Maker, step 8) lives in js/tiermaker.js: this file calls C.tm.init() once and
     C.tm.show(listId|null, sharedData|null) every time My Lists is showing
   · Global is view-only and has a Cards | Support switch (they never share a list)
     - Cards: rows Meta–D by Overall (only the top meta.rankTop cards are ranked) + the Utility row (by utilGain), rarity picker shared with the Cards page
     - Support: rows Meta–D by Value (data/support.json · ranked at Godly) · the same mini game cards as the Cards side
       (2026-10-30, owner: "support like the battle cards"), their values at the same site-wide rarity
     - rows wrap (never scroll sideways) · ▲▼ on a card whose tier moved since prevTier (C.tierMoveHTML) · NEW badge (C.newHTML)
     - Save image: the list on screen (Cards or Support) as one picture with every name written under its card (C.share.imageDialog)
   Meta Decks moved to the Deck page (js/deck.js).
   Needs js/fx.js, js/app.js, js/cards.js loaded first.
   The rarity chips here are handled by js/cards.js (one shared rarity for the whole site);
   it announces every change with the "cbi:rarity" event, which this file listens to.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const KIND_KEY = "cbi:tierKind";      // "cards" | "support" (last Global view)
  const TITLES = { global: null, my: "My Tier Lists — Card Battle Infinity" };   // null = the page's normal title
  const LEADS = {
    cards: "The strongest cards by Overall score, from Meta at the top to D, then the Utility row (cards that boost the whole deck). Meta and SS are the Meta cards. Pick a rarity to see its stats. Tap a card for the full breakdown.",
    support: "The strongest support cards by Value at Godly, from Meta at the top to D at the bottom. Tap one for the full breakdown.",
    my: "Your own tier lists, saved on this device.",
    shared: "A tier list someone shared with you. It's view only: tap Save a copy to keep your own.",
  };

  const ui = {};
  const tiles = [];             // [element, card or support] for every card on this page (they follow the rarity)
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
  const tierVar = (t) => `var(${C.TIER_COLOR[t] || "--t-d"})`;
  const topN = C.rankTop, topS = C.rankTopSupport;   // data/meta.json rankTop (48) · rankTopSupport (100)

  // a mini game card (support too) in a row, following the site-wide rarity, with ▲▼
  function tile(x) {
    const el = C.renderCard(x, state.rarity, { mini: true });
    tiles.push([el, x]);
    return addMove(el, x);
  }

  /* ---------- One row per tier (shared by Cards and Support, the page and the saved image) ---------- */
  // cards: true = also the cardsOnly rows (Utility, last)
  const groupsOf = (items, order, cards) => state.meta.tiers.filter((t) => cards || !t.cardsOnly)
    .map((t) => ({ t, group: items.filter((x) => x.tier === t.name).sort(t.cardsOnly ? byGain : order) }));
  const rankedCards = () => state.cards.filter(C.isRanked);       // Unranked cards never appear in a row
  const rankedSupport = () => supportItems.filter(isRankedSupport);

  // ▲▼ in the tile's top-left corner + the same words at the end of its label (the label wins over the text inside)
  function addMove(el, x) {
    const html = C.tierMoveHTML(x, "tmove--tile");
    if (!html) return el;
    el.insertAdjacentHTML("beforeend", html);
    labelMove(el, x);
    return el;
  }
  function labelMove(el, x) {
    const t = C.tierMoveText(x), l = el.getAttribute("aria-label") || "";
    if (t && !l.endsWith(t)) el.setAttribute("aria-label", `${l}, ${t}`);
  }

  function buildRows(items, order, makeTile, noun, cards = false) {
    const frag = document.createDocumentFragment();
    groupsOf(items, order, cards).forEach(({ t, group }) => {
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
    const ranked = rankedCards();
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

    ui.list.replaceChildren(buildRows(ranked, byOverall, tile, ["card", "cards"], true));
  }

  /* ---------- Global: Support ---------- */
  function renderSupport() {
    const ranked = rankedSupport();
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

    ui.slist.replaceChildren(buildRows(ranked, byValue, tile, ["support card", "support cards"]));
  }

  /* ---------- Save image (plan 2026-10-30 item 3): two pictures, never one · Cards (ranked + Utility) | Support ----------
     Drawn by js/share.js (tierImage with captions: bigger cards, the full name under each one, ▲▼ like the page) */
  function saveImage() {
    const sup = kind === "support";
    const rows = groupsOf(sup ? rankedSupport() : rankedCards(), sup ? byValue : byOverall, !sup)
      .map(({ t, group }) => ({ label: t.name, color: C.TIER_COLOR[t.name] || "--t-d", items: group.map((x) => x.id) }));
    C.share.imageDialog({
      id: "global-" + kind, title: sup ? "Support Tier List" : "Card Tier List",
      type: sup ? "support" : "card", rarity: state.rarity, rows, captions: true,
    }, { flashEl: sup ? ui.slist : ui.list });
  }
  function saveState() {
    const n = kind === "support" ? rankedSupport().length : rankedCards().length;
    ui.save.hidden = !globalBuilt || !n;
    ui.save.setAttribute("aria-label", `Save the ${kind === "support" ? "support" : "card"} tier list as an image`);
  }

  /* step 9.5: Global's rows (cards + support) are made the first time Global is actually on screen,
     not while another tab or My Lists is showing */
  function buildGlobal() {
    if (globalBuilt) return;
    globalBuilt = true;
    renderCards();
    renderSupport();
    saveState();
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
    saveState();
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
    ui.save.addEventListener("click", saveImage);

    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
  }

  /* ---------- Rarity change (from the chips here or anywhere else) ---------- */
  function recolor(name) {
    const all = tiles;
    // read every position first, then write: mixing them forces a re-layout per card
    const seen = all.map(([el]) => el.isConnected && rectVisible(el.getBoundingClientRect()));
    all.forEach(([el, card], i) => { if (card) { C.setCardRarity(el, card, name, { animate: seen[i] }); labelMove(el, card); } });   // setCardRarity rewrites the label
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
      save: $("#tier-save"),
    });
    ui.save.insertAdjacentHTML("afterbegin", C.share.icons.image);
    supportItems = (Array.isArray(state.support) ? state.support : [])
      .filter((s) => s && s.id)
      .map((s) => ({ ...s, name: s.name || pretty(s.id) }));

    ui.rarity.hidden = !state.cards.length && !supportItems.length;
    ui.rarity.innerHTML = C.rarityChipsHTML();
    bind();
    setKind(C.store.get(KIND_KEY), { animate: false });   // rows are built later by buildGlobal()
    if (C.tm) C.tm.init();
  }

  C.tier = { init, enter, show };
})();
