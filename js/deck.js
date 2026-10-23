/* ==========================================================
   Card Battle Infinity — Deck page (step 7)
   · Meta Decks: 5-card teams from data/teams.json with slot numbers and recommended support
     (moved here from the Tier List page; the deck builder with My Decks arrives in step 10)
   · Cards show at the shared rarity (same 7 levels as the Cards page, see js/cards.js)
   Needs js/fx.js, js/app.js and js/cards.js loaded first.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const ui = {};
  const tiles = new Map();      // card id -> card elements on this page
  let cardById = new Map();

  const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  function track(card, el) {
    if (!tiles.has(card.id)) tiles.set(card.id, []);
    tiles.get(card.id).push(el);
  }

  function supportName(id) {
    const s = Array.isArray(state.support) ? state.support.find((x) => x && x.id === id) : null;
    return (s && s.name) || pretty(id);
  }

  /* ---------- Meta decks ---------- */
  function slotEl(slot, n) {
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
    if (slot && slot.support) wrap.insertAdjacentHTML("beforeend", `<span class="deck__sup">+ ${esc(supportName(slot.support))}</span>`);
    return wrap;
  }

  function deckEl(team) {
    const el = document.createElement("article");
    el.className = "deck glass";
    const name = team.name || pretty(team.id || "Deck");
    el.setAttribute("aria-label", `Deck: ${name}`);
    const sup = Array.isArray(team.support) ? team.support : team.support ? [team.support] : [];
    el.innerHTML = `
      <div class="deck__head">
        <h3 class="deck__name">${esc(name)}</h3>
        ${team.mock ? `<span class="badge badge--muted" title="Example data, not a real recommendation">Sample</span>` : ""}
      </div>
      <div class="deck__slots"></div>
      ${list(sup).length ? `<div class="deck__support"><span class="deck__label">Support</span>${list(sup).map((id) => `<span class="supchip">${esc(supportName(id))}</span>`).join("")}</div>` : ""}
      ${team.notes ? `<p class="deck__notes">${esc(team.notes)}</p>` : ""}`;
    const row = $(".deck__slots", el);
    list(team.slots).slice(0, 5).forEach((s, i) => row.appendChild(slotEl(s, i + 1)));
    return el;
  }

  function renderDecks() {
    const teams = (Array.isArray(state.teams) ? state.teams : []).filter((t) => t && list(t.slots).length);
    ui.list.hidden = !teams.length;
    ui.none.hidden = teams.length > 0;
    ui.rarity.hidden = !teams.length;       // nothing to restyle when there are no decks
    const frag = document.createDocumentFragment();
    teams.forEach((t) => frag.appendChild(deckEl(t)));
    ui.list.replaceChildren(frag);
  }

  /* ---------- Rarity change (from the chips here or anywhere else) ---------- */
  function recolor(name) {
    const all = [];
    tiles.forEach((els, id) => els.forEach((el) => all.push([el, cardById.get(id)])));
    // read every position first, then write: mixing them forces a re-layout per card
    const seen = all.map(([el]) => el.isConnected && rectVisible(el.getBoundingClientRect()));
    all.forEach(([el, card], i) => card && C.setCardRarity(el, card, name, { animate: seen[i] }));
  }

  function enter() {
    FX.stagger(ui.list, 70);
  }

  function init() {
    Object.assign(ui, { rarity: $("#deck-rarity"), list: $("#deck-list"), none: $("#decks-none") });
    cardById = new Map(state.cards.map((c) => [c.id, c]));
    ui.rarity.innerHTML = C.rarityChipsHTML();
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
    renderDecks();
    enter();
  }

  C.deck = { init, enter };
})();
