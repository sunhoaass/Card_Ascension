/* ==========================================================
   Card Battle Infinity — Tier List + Meta Decks (step 3)
   · Tier rows SS–D, cards sorted by Overall, rarity picker (same 7 levels as the Cards page)
   · Meta Decks: 5-card teams from data/teams.json with slot numbers and recommended support
   Needs js/fx.js, js/app.js and js/cards.js loaded first.
   The rarity chips here are handled by js/cards.js (one shared rarity for the whole site);
   it announces every change with the "cbi:rarity" event, which this file listens to.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const ui = {};
  const tiles = new Map();      // card id -> card elements on this page (tier rows + decks)
  let cardById = new Map();

  const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const byOverall = (a, b) => b.scores.overall - a.scores.overall || a.name.localeCompare(b.name);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function track(card, el) {
    if (!tiles.has(card.id)) tiles.set(card.id, []);
    tiles.get(card.id).push(el);
  }

  function supportName(id) {
    const s = Array.isArray(state.support) ? state.support.find((x) => x && x.id === id) : null;
    return (s && s.name) || pretty(id);
  }

  /* ---------- Rarity chips ---------- */
  function rarityChips() {
    ui.rarity.hidden = !state.cards.length;
    ui.rarity.innerHTML = state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-rarity="${esc(r.name)}" aria-pressed="${r.name === state.rarity}" style="--sw:${C.RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");
  }

  /* ---------- Tier rows ---------- */
  function renderRows() {
    const ranked = state.cards.filter(C.isRanked);       // Unranked cards never appear in a row
    const unranked = state.cards.length - ranked.length;

    ui.none.hidden = ranked.length > 0;
    ui.list.hidden = ranked.length === 0;
    if (!ranked.length) {
      $("#tier-none-title").textContent = state.cards.length ? "Rankings coming soon" : "No cards yet";
      $("#tier-none-text").textContent = state.cards.length
        ? "The cards are in, but none of them have been scored yet. Tiers will show up here once they are."
        : "The card library is being filled in. Check back soon.";
    }
    ui.note.hidden = !(ranked.length && unranked);
    ui.note.textContent = unranked
      ? `${plural(unranked, "card is", "cards are")} not ranked yet. ${unranked === 1 ? "It" : "They"} will join the list once scored.`
      : "";

    const frag = document.createDocumentFragment();
    state.meta.tiers.forEach((t) => {
      const cards = ranked.filter((c) => c.tier === t.name).sort(byOverall);
      const row = document.createElement("section");
      row.className = "tier-row glass";
      row.style.setProperty("--tc", `var(${C.TIER_COLOR[t.name] || "--t-d"})`);
      row.setAttribute("aria-label", `Tier ${t.name}, ${plural(cards.length, "card", "cards")}`);
      row.innerHTML = `<div class="tier-row__label"><span>${esc(t.name)}</span><small class="tier-row__count">${cards.length}</small></div><div class="tier-row__cards"></div>`;
      const wrap = $(".tier-row__cards", row);
      if (cards.length) {
        cards.forEach((c) => {
          const el = C.renderCard(c, state.rarity, { mini: true });
          track(c, el);
          wrap.appendChild(el);
        });
      } else {
        wrap.innerHTML = `<p class="tier-row__empty">No cards in this tier yet</p>`;
      }
      frag.appendChild(row);
    });
    ui.list.replaceChildren(frag);
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
    ui.decks.hidden = !teams.length;
    ui.decksNone.hidden = teams.length > 0;
    ui.jump.hidden = !teams.length;
    const frag = document.createDocumentFragment();
    teams.forEach((t) => frag.appendChild(deckEl(t)));
    ui.decks.replaceChildren(frag);
  }

  /* ---------- Rarity change (from the chips here or on the Cards page) ---------- */
  function recolor(name) {
    const all = [];
    tiles.forEach((els, id) => els.forEach((el) => all.push([el, cardById.get(id)])));
    // read every position first, then write: mixing them forces a re-layout per card
    const seen = all.map(([el]) => el.isConnected && rectVisible(el.getBoundingClientRect()));
    all.forEach(([el, card], i) => card && C.setCardRarity(el, card, name, { animate: seen[i] }));
  }

  function enter() {
    FX.stagger(ui.list);
    FX.stagger(ui.decks, 70);
  }

  function init() {
    Object.assign(ui, {
      rarity: $("#tier-rarity"), list: $("#tier-list"), none: $("#tier-none"), note: $("#tier-note"),
      decks: $("#deck-list"), decksNone: $("#decks-none"), jump: $("#tier-jump"), meta: $("#meta-decks"),
    });
    cardById = new Map(state.cards.map((c) => [c.id, c]));
    ui.jump.addEventListener("click", () => ui.meta.scrollIntoView({ behavior: FX.reduced ? "auto" : "smooth", block: "start" }));
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
    rarityChips();
    renderRows();
    renderDecks();
    enter();
  }

  C.tier = { init, enter };
})();
