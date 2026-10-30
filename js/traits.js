/* ==========================================================
   Card Battle Infinity — Traits (Trait Shop in the game)
   · data/traits.json: 13 traits in 8 tiers (Common … Secret), chance per roll, pity, effects. 1 roll = 5 Shards.
   · In the game every copy of a card has the same trait, so the user picks ONE trait per card:
     localStorage "cbi:traits" = { "<card id>": "<trait id>" } (saved on every change, never crashes if storage is blocked).
     The Details sheet, the graded case label (js/grade.js) and the Deck page (one trait per slot = that card's trait)
     all read and write it through here. Every change fires the "cbi:trait" event ({ id, trait }).
   · Traits never change Overall / Tier (same as grades). The team score uses power() (PROGRESS.md §10.5).
   · Traits tab (#traits, W5): search + card grid (like the Grade page) -> tap a card = its Trait Shop
     (the card · its trait + final ATK / HP with your grades · the + button opens the 13 traits in a window, tap = set it · Recommended).
     Phone: the grid or the shop, never both (Back = the grid again, owner 2026-10-29).
   CBI.traits = { init, list(), byId(id), of(cardId), set(cardId, traitId|null), map(), power(id), mult(id), effects(t),
                  apply(card, rarity, grades, traitId), pillHTML(id), chipsHTML(selected), panelHTML(card), mountPanel(root, card),
                  pickDialog(cardId), colorStyle(t), iconHTML(t, cls) }
   Needs js/fx.js and js/app.js loaded first (C.grade, C.dialog are only used when something is tapped).
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const KEY = "cbi:traits";
  const STEP = 0.025;                         // grade bonus per grade (same as js/grade.js)
  const ROLL = () => (data().rollShards > 0 ? data().rollShards : 5);
  const TIERS = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Divine", "Secret"];
  const FIRST_HIT_SPREAD = 5;                 // power(): the first-hit bonus counts as spread over ~5 hits of a fight

  /* ---------- data (data/traits.json, read once) ---------- */
  let D = null;
  function data() {
    if (D && D.src === state.traits) return D;
    const raw = state.traits && typeof state.traits === "object" ? state.traits : {};
    const n = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
    const list = (Array.isArray(raw.traits) ? raw.traits : []).filter((t) => t && typeof t.id === "string" && t.id && t.name).map((t) => ({
      id: t.id, name: String(t.name), tier: TIERS.includes(t.tier) ? t.tier : "Common",
      chance: n(t.chance), pity: n(t.pity),
      dmg: n(t.dmg, 1) || 1, hp: n(t.hp, 1) || 1,
      crit: t.crit && n(t.crit.chance) > 0 && n(t.crit.mult) > 1 ? { chance: Math.min(100, n(t.crit.chance)), mult: n(t.crit.mult) } : null,
      dodge: Math.min(90, n(t.dodge)), reduce: Math.min(90, n(t.reduce)), lifesteal: n(t.lifesteal), shield: n(t.shield),
      revive: Math.min(100, n(t.revive)), firstHit: n(t.firstHit),
    }));
    const byId = new Map(list.map((t) => [t.id, t]));
    list.forEach((t) => { t.mult = multOf(t); });
    const top = Math.max(1.0001, ...list.map((t) => t.mult));
    list.forEach((t) => { t.power = Math.max(0, Math.log(t.mult) / Math.log(top)); });
    D = { src: state.traits, list, byId, rollShards: n(raw.rollShards, 5) };
    return D;
  }
  // how much a trait raises a card in a 1-on-1, as one stat multiplier: √(effective damage × effective HP)
  // (a fight is won on damage × HP, so the square root keeps it on the same scale as ×1.25 ATK and HP)
  function multOf(t) {
    const effDmg = t.dmg * (t.crit ? 1 + (t.crit.chance / 100) * (t.crit.mult - 1) : 1) * (1 + t.firstHit / 100 / FIRST_HIT_SPREAD);
    const effHp = (t.hp * (1 + t.shield / 100 + t.revive / 100) * (1 + t.lifesteal / 100)) / ((1 - t.dodge / 100) * (1 - t.reduce / 100));
    return Math.sqrt(effDmg * effHp);
  }
  const byId = (id) => (id ? data().byId.get(id) || null : null);
  const tierVar = (tier) => `--tr-${String(tier || "none").toLowerCase()}`;
  const colorStyle = (t) => `--tc:var(${tierVar(t && t.tier)});--tc2:var(${tierVar(t && t.tier)}-2)`;

  /* ---------- the user's trait per card ---------- */
  let saved = null;
  function load() {
    if (saved) return saved;
    let raw = {};
    try { raw = JSON.parse(C.store.get(KEY) || "{}") || {}; } catch { raw = {}; }
    saved = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      Object.keys(raw).slice(0, 5000).forEach((id) => { if (typeof raw[id] === "string" && byId(raw[id])) saved[String(id).slice(0, 80)] = raw[id]; });
    }
    return saved;
  }
  const of = (cardId) => { const s = load(); return cardId && s[cardId] && byId(s[cardId]) ? s[cardId] : null; };
  const map = () => ({ ...load() });
  function set(cardId, traitId) {
    if (!cardId) return;
    const s = load();
    const next = byId(traitId) ? traitId : null;
    if ((s[cardId] || null) === next) return;
    if (next) s[cardId] = next; else delete s[cardId];
    C.store.set(KEY, JSON.stringify(s));
    document.dispatchEvent(new CustomEvent("cbi:trait", { detail: { id: cardId, trait: next } }));
  }

  /* ---------- maths ---------- */
  const power = (id) => { const t = byId(id); return t ? t.power : 0; };
  const mult = (id) => { const t = byId(id); return t ? t.mult : 1; };
  const gradedAt = (card, k, r, g) => Math.round(C.statAt(card, k, r) * (1 + (g || 0) * STEP));
  // final ATK / HP: rarity value -> grade (+2.5% per grade, rounded like the Grade page) -> trait multiplier
  function apply(card, rarity, grades, traitId) {
    const t = byId(traitId), g = Array.isArray(grades) ? grades : [0, 0, 0, 0];
    const baseAtk = C.statAt(card, "atk", rarity), baseHp = C.statAt(card, "hp", rarity);
    const gAtk = gradedAt(card, "atk", rarity, g[0]), gHp = gradedAt(card, "hp", rarity, g[3]);
    const atk = Math.round(gAtk * (t ? t.dmg : 1)), hp = Math.round(gHp * (t ? t.hp : 1));
    const avgHit = t && t.crit ? Math.round(atk * (1 + (t.crit.chance / 100) * (t.crit.mult - 1))) : atk;
    const def = t ? (1 + t.shield / 100 + t.revive / 100) / ((1 - t.dodge / 100) * (1 - t.reduce / 100)) : 1;
    return { baseAtk, baseHp, gAtk, gHp, atk, hp, avgHit, effHp: Math.round(hp * def), trait: t };
  }
  const xN = (v) => "×" + Number(v.toFixed(2));
  function effects(t, { special = false } = {}) {
    if (!t) return [];
    const out = [];
    if (!special && t.dmg !== 1) out.push(`${xN(t.dmg)} damage`);
    if (!special && t.hp !== 1) out.push(`${xN(t.hp)} HP`);
    if (t.crit) out.push(`${t.crit.chance}% chance to crit for ${xN(t.crit.mult)} damage`);
    if (t.dodge) out.push(`Dodges ${t.dodge}% of attacks`);
    if (t.reduce) out.push(`Takes ${t.reduce}% less damage`);
    if (t.lifesteal) out.push(`Heals ${t.lifesteal}% of the damage it deals`);
    if (t.shield) out.push(`Starts each fight with a shield of ${t.shield}% max HP`);
    if (t.revive) out.push(`Revives once with ${t.revive}% HP`);
    if (t.firstHit) out.push(`First hit deals +${t.firstHit}% damage`);
    return out;
  }
  const shortFx = (t) => [t.dmg !== 1 ? `${xN(t.dmg)} DMG` : "", t.hp !== 1 ? `${xN(t.hp)} HP` : "", ...effects(t, { special: true }).map(shorten)].filter(Boolean).join(" · ");
  function shorten(s) {
    return s.replace(/^(\d+)% chance to crit for (×[\d.]+) damage$/, "$1% crit $2").replace(/^Dodges (\d+)% of attacks$/, "$1% dodge")
      .replace(/^Takes (\d+)% less damage$/, "−$1% damage taken").replace(/^Heals (\d+)% of the damage it deals$/, "heal $1% of damage")
      .replace(/^Starts each fight with a shield of (\d+)% max HP$/, "$1% HP shield").replace(/^Revives once with (\d+)% HP$/, "revive $1% HP")
      .replace(/^First hit deals \+(\d+)% damage$/, "+$1% first hit");
  }
  const fmtPct = (n) => (n >= 1 ? Number(n.toFixed(1)) : Number(n.toFixed(2))) + "%";
  const oneIn = (t) => (t.chance > 0 ? Math.round(100 / t.chance).toLocaleString("en-US") : "–");

  /* ---------- small shared bits ---------- */
  // W5: every trait has its own icon (index.html sprite #tri-<id>, drawn for this site) · a trait added later without one = the gem
  const ICONS = new Set(["ascendant", "limitless", "sage-mode", "awakened", "undying", "prodigy", "keen-eye", "bloodlust", "iron-body", "spirited", "nimble", "sharp", "tough"]);
  const iconHTML = (t, cls = "tr-gem") => `<svg class="${cls}" aria-hidden="true"><use href="#${t && ICONS.has(t.id) ? "tri-" + t.id : "i-gem"}"/></svg>`;
  function pillHTML(id, { none = "No trait" } = {}) {
    const t = byId(id);
    return `<span class="trp${t ? "" : " trp--none"}" style="${colorStyle(t)}">${iconHTML(t)}<span class="trp__name">${esc(t ? t.name : none)}</span>${t ? `<span class="trp__tier">${esc(t.tier)}</span>` : ""}</span>`;
  }
  // chip row: "None" + every trait, rarest first · data-trait="" = none
  function chipsHTML(selected) {
    const one = (t) => `<button type="button" class="chip glass fx-press trchip" data-trait="${t ? esc(t.id) : ""}" aria-pressed="${(t ? t.id : null) === (selected || null)}" style="${colorStyle(t)};--sw:var(--tc)"><span class="chip__swatch"></span>${t ? esc(t.name) : "None"}</button>`;
    return one(null) + data().list.map(one).join("");
  }
  function pressChips(row, id) {
    row.querySelectorAll("[data-trait]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.trait || null) === (id || null))));
  }
  const tierOrder = (t) => TIERS.indexOf(t.tier);

  /* ==========================================================
     Details sheet panel (js/detail.js puts panelHTML in, then calls mountPanel)
     ========================================================== */
  const panels = new Set();                   // { root, card }
  function recHTML(card) {
    const rec = byId(card.bestTrait), note = String(card.bestTraitNote || "").trim();
    if (!rec) return `<p class="trrec trrec--none"><span class="trrec__k">Recommended</span><span class="muted">Not analyzed yet</span></p>`;
    return `<div class="trrec">
        <span class="trrec__k">Recommended</span>
        <button type="button" class="trrec__pick fx-press" data-trait-use="${esc(rec.id)}" aria-label="Recommended trait ${esc(rec.name)}. Tap to pick it">${pillHTML(rec.id)}</button>
        ${note ? `<p class="trrec__note">${esc(note)}</p>` : ""}
        <p class="trrec__more">Rarer traits (Awakened and up) are stronger on every card. This is the best fit below them.</p>
      </div>`;
  }
  function panelHTML(card) {
    if (!data().list.length) return "";
    return `
      <section class="dpanel trpanel" aria-labelledby="d-t-trait" data-trait-panel="${esc(card.id)}">
        <h3 class="dpanel__title" id="d-t-trait">Trait</h3>
        <p class="dpanel__sub">Every copy of a card shares one trait. Pick yours to see the stats. Saved on this device; it doesn't change the tier.</p>
        ${recHTML(card)}
        <div class="trpick" role="group" aria-label="Your trait for ${esc(card.name)}">${chipsHTML(of(card.id))}</div>
        <div class="trres" data-trres aria-live="polite"></div>
      </section>`;
  }
  function paintPanel(p, { animate = false } = {}) {
    const { root, card } = p;
    const id = of(card.id), g = C.grade.get ? C.grade.get(card.id) : null, res = apply(card, state.rarity, g, id);
    pressChips($(".trpick", root), id);
    const box = $("[data-trres]", root);
    const t = res.trait;
    const line = (k, label, from, to) => `<div class="trres__row trres__row--${k}"><span class="trres__k">${label}</span><b class="trres__v" data-trv="${k}" data-value="${to}">${C.fmtKey(k)(to)}</b><small>${to !== from ? `${C.fmtKey(k)(from)} ${t ? xN(k === "atk" ? t.dmg : t.hp) : ""}` : t ? "no change" : state.rarity}</small></div>`;
    const was = (k) => { const n = $(`[data-trv="${k}"]`, box); return n ? Number(n.dataset.value) || 0 : 0; };
    const prev = { atk: was("atk"), hp: was("hp") };
    box.innerHTML = `
      <div class="trres__nums">${line("atk", "ATK", res.gAtk, res.atk)}${line("hp", "HP", res.gHp, res.hp)}</div>
      <p class="trres__cap">${esc(state.rarity)}${g && (g[0] || g[3]) ? " · with your grades" : ""}${t ? ` · ${esc(t.name)}` : " · no trait"}</p>
      ${t && effects(t, { special: true }).length ? `<ul class="trres__fx">${effects(t, { special: true }).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}`;
    if (animate && !FX.reduced) ["atk", "hp"].forEach((k) => { const n = $(`[data-trv="${k}"]`, box); if (prev[k]) { const to = Number(n.dataset.value); n.dataset.value = prev[k]; n.textContent = C.fmtKey(k)(prev[k]); FX.countTo(n, to, { format: C.fmtKey(k), duration: 450 }); } });
  }
  function mountPanel(root, card) {
    panels.forEach((p) => { if (!p.root.isConnected) panels.delete(p); });
    const el = root.querySelector(`[data-trait-panel="${CSS.escape(card.id)}"]`);
    if (!el) return;
    const p = { root: el, card };
    panels.add(p);
    paintPanel(p);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-trait], [data-trait-use]");
      if (!b) return;
      set(card.id, b.dataset.traitUse || b.dataset.trait || null);
    });
  }
  function repaintPanels(cardId) {
    panels.forEach((p) => {
      if (!p.root.isConnected) { panels.delete(p); return; }
      if (!cardId || p.card.id === cardId) paintPanel(p, { animate: true });
    });
  }

  /* ==========================================================
     Pick a trait in a dialog (Deck slots) -> Promise<trait id | "" (none) | null (cancelled)>
     ========================================================== */
  async function pickDialog(cardId) {
    const card = state.cards.find((c) => c.id === cardId);
    if (!C.dialog || !card) return null;
    const cur = of(cardId), rec = byId(card.bestTrait);
    const row = (t) => `<button type="button" class="trdlg__opt fx-press" data-pick-trait="${t ? esc(t.id) : ""}" aria-pressed="${(t ? t.id : null) === cur}" style="${colorStyle(t)}">
        ${iconHTML(t)}<span class="trdlg__name">${t ? esc(t.name) : "No trait"}${t && rec && rec.id === t.id ? ` <em>Recommended</em>` : ""}</span>
        <span class="trdlg__tier">${t ? esc(t.tier) : ""}</span>
        <span class="trdlg__fx">${t ? esc(shortFx(t)) : "Base stats"}</span></button>`;
    const res = await C.dialog({
      title: `Trait · ${card.name}`,
      html: `<p class="tm-dlg__text">Every copy of this card shares one trait, so this changes it everywhere on this device.</p>
        <div class="trdlg" role="group" aria-label="Traits">${row(null)}${data().list.map(row).join("")}</div>`,
      actions: [{ label: "Cancel", value: "cancel" }],
      onMount(d, finish) {
        d.querySelector(".trdlg").addEventListener("click", (e) => {
          const b = e.target.closest("[data-pick-trait]");
          if (b) { e.preventDefault(); finish({ action: "pick", id: b.dataset.pickTrait }); }
        });
        const on = d.querySelector('.trdlg__opt[aria-pressed="true"]');
        if (on) on.focus({ preventScroll: true });
      },
    });
    if (!res || res.action !== "pick") return null;
    set(cardId, res.id || null);
    return res.id || "";
  }

  /* ==========================================================
     Traits tab (W5): search + card grid like the Grade page | the chosen card's Trait Shop
     (the card · its trait + final ATK / HP · the + button = the 13 traits in a window, tap = set it · Recommended = bestTrait)
     Phone: the grid, tap a card = the shop in its place (.trw.is-shop) with a Back button · ≥ 900px: grid on the left
     (scrolls on its own), shop on the right.
     ========================================================== */
  const ui = {};
  let built = false;
  let items = [];                             // cards in grid order
  let sel = null, hero = null;                // chosen card id · its card in the shop
  let listScroll = 0;                         // phone: where the grid was when the shop opened
  const tiles = new Map();                    // id -> mini card in the grid (made the first time its page shows)
  let shown = [], onPage = [], page = 0;      // filtered ids · ids in the grid now · the grid's page (0-based, 30 a page like Cards)
  const filter = { q: "", mine: false };
  const wide = window.matchMedia("(min-width: 900px)");
  const $$ = (s, r) => [...r.querySelectorAll(s)];
  const cardOf = (id) => items.find((c) => c.id === id) || null;
  const hay = new Map();                      // id -> "name series" in lower case (search)

  // same order as the Grade picker: ranked first (best Overall first), then by name
  function compare(a, b) {
    const ra = C.isRanked(a), rb = C.isRanked(b);
    if (ra !== rb) return ra ? -1 : 1;
    if (ra && a.scores.overall !== b.scores.overall) return b.scores.overall - a.scores.overall;
    return a.name.localeCompare(b.name);
  }
  const matches = (c, words) => !words.length || words.every((w) => hay.get(c.id).includes(w));
  const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);

  /* ---------- the grid ---------- */
  // the card's trait as a round badge (left side, under the name in the picture, like the grade badge on the Grade page)
  function tileBadge(el, id) {
    const t = byId(of(id)), card = cardOf(id);
    let b = $(".card__trait", el);
    el.setAttribute("aria-label", `${card ? card.name : id}${t ? `, trait ${t.name}` : ", no trait"}. Open its Trait Shop`);
    if (!t) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("span"); b.className = "card__trait tri"; b.setAttribute("aria-hidden", "true"); el.appendChild(b); }
    b.style.cssText = colorStyle(t);
    b.innerHTML = iconHTML(t, "tri__ico");
  }
  function paintCounts() {
    const n = items.filter((c) => of(c.id)).length;
    $("[data-n]", ui.mine).textContent = n;
    return n;
  }
  // one page of `shown` in the grid · a tile is made the first time it is needed (picked / trait badge set then)
  function elOf(id) {
    let el = tiles.get(id);
    if (!el) {
      el = C.renderCard(cardOf(id), state.rarity, { mini: true });
      tileBadge(el, id);
      tiles.set(id, el);
    }
    el.classList.toggle("is-picked", id === sel);
    if (id === sel) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current");
    return el;
  }
  function paintPage({ animate = false } = {}) {
    const pages = Math.max(1, Math.ceil(shown.length / C.PAGE_SIZE));
    page = Math.max(0, Math.min(page, pages - 1));
    const ids = shown.slice(page * C.PAGE_SIZE, (page + 1) * C.PAGE_SIZE);
    if (ids.length !== onPage.length || ids.some((id, i) => id !== onPage[i])) {
      const frag = document.createDocumentFragment();
      ids.forEach((id) => frag.appendChild(elOf(id)));
      ui.grid.replaceChildren(frag);
      onPage = ids;
      if (animate) FX.stagger(ui.grid, 24, { cls: "fx-grid-in", max: 12, limit: 18, cleanup: true });
    }
    C.pager(ui.pager, page, shown.length ? pages : 0);
  }
  // ‹ › or a typed page: the new page's cards come in one by one, back up to the grid (wide: the grid's own scroll)
  function goPage(i) {
    if (i === page || i < 0 || i * C.PAGE_SIZE >= shown.length) return;
    page = i;
    paintPage({ animate: true });
    if (wide.matches) ui.pick.scrollTo({ top: 0, behavior: FX.reduced ? "auto" : "smooth" });
    else C.pageTop(ui.grid);
  }
  // the screen changed size (rows × columns per page): keep the first card in view on the new page
  document.addEventListener("cbi:pagesize", () => { if (!built) return; page = C.pageKeep(shown, onPage, page); paintPage(); });
  // the grid shows the page with this card on it (Change card, Back on a phone)
  function pageOf(id) {
    const k = shown.indexOf(id);
    if (k < 0 || Math.floor(k / C.PAGE_SIZE) === page) return;
    page = Math.floor(k / C.PAGE_SIZE);
    paintPage();
  }
  function applyList({ animate = false } = {}) {
    if (!built) return;
    const w = words(filter.q);
    const out = items.filter((c) => (!filter.mine || of(c.id)) && matches(c, w));
    const ids = out.map((c) => c.id);
    if (ids.length !== shown.length || ids.some((id, i) => id !== shown[i])) { shown = ids; page = 0; }
    paintPage({ animate });
    const n = paintCounts();
    ui.mine.setAttribute("aria-pressed", String(filter.mine));
    ui.count.textContent = out.length === items.length ? `${items.length} ${items.length === 1 ? "card" : "cards"}` : `${out.length} of ${items.length} cards`;
    ui.reset.hidden = !(w.length || filter.mine);
    ui.none.hidden = out.length > 0;
    ui.noneText.textContent = filter.mine && !n ? "You haven't set a trait on any card yet. Tap a card to start." : "Try a different search or clear the filters.";
  }
  // the detail's swipe walks the whole filtered list (every page), like the Cards page
  const shownIds = () => (shown.length ? shown.slice() : items.map((c) => c.id));

  /* ---------- the Trait Shop window (the + button): the 13 traits, rarest first ---------- */
  function rowHTML(t) {
    return `<button type="button" class="trrow fx-press" data-tr="${esc(t.id)}" data-tier="${esc(t.tier)}" style="${colorStyle(t)}" aria-pressed="false">
        <span class="tri tri--md">${iconHTML(t, "tri__ico")}</span>
        <span class="trrow__main">
          <span class="trrow__head"><span class="trrow__name">${esc(t.name)}</span><span class="trrow__tag trrow__tag--rec" data-rec hidden>Recommended</span><span class="trrow__tag trrow__tag--on" data-on hidden>Equipped</span></span>
          <span class="trrow__tier">${esc(t.tier)}</span>
          <span class="trrow__fx">${esc(shortFx(t))}</span>
          <span class="trrow__note" data-note hidden></span>
        </span>
        <span class="trrow__odds"><b>${fmtPct(t.chance)}</b><small>1 in ${oneIn(t)}</small><small>${t.pity ? `Pity ${t.pity.toLocaleString("en-US")}` : "No pity"}</small></span>
      </button>`;
  }
  function rowLabel(t, { on, rec }) {
    const pity = t.pity ? `pity at ${t.pity.toLocaleString("en-US")} rolls (${(t.pity * ROLL()).toLocaleString("en-US")} Shards)` : "no pity";
    return `${t.name}, ${t.tier}, ${fmtPct(t.chance)} per roll, ${pity}. ${effects(t).join(", ")}.${on ? " Equipped." : ""}${rec ? " Recommended for this card." : ""}${sel ? (on ? "" : " Tap to set it as this card's trait.") : " Choose a card first."}`;
  }
  function paintRows(box) {
    const card = sel && cardOf(sel), mine = card ? of(card.id) : null, rec = card ? byId(card.bestTrait) : null;
    const note = card ? String(card.bestTraitNote || "").trim() : "";
    $$(".trrow", box).forEach((b) => {
      const t = byId(b.dataset.tr), on = !!card && t.id === mine, isRec = !!rec && t.id === rec.id;
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("is-rec", isRec);
      $("[data-on]", b).hidden = !on;
      $("[data-rec]", b).hidden = !isRec;
      const n = $("[data-note]", b);
      n.hidden = !(isRec && note);
      n.textContent = isRec ? note : "";
      b.setAttribute("aria-label", rowLabel(t, { on, rec: isRec }));
    });
  }
  const shopList = () => data().list.slice().sort((a, b) => tierOrder(b) - tierOrder(a) || a.chance - b.chance);
  async function shopDialog() {
    const card = cardOf(sel);
    if (!C.dialog || !card) return;
    const res = await C.dialog({
      title: `Trait Shop · ${card.name}`,
      html: `<p class="trs__listsub">Rarest first · chance per roll · 1 roll = ${ROLL()} Shards · tap one to set it</p>
        <div class="trs__list trs__list--dlg" role="group" aria-label="Traits">${shopList().map(rowHTML).join("")}</div>`,
      actions: [{ label: "Cancel", value: "cancel" }],
      onMount(d, finish) {
        $(".tm-dlg__sheet", d).classList.add("trs-dlg-sheet");
        const box = $(".trs__list", d);
        paintRows(box);
        FX.stagger(box, 26, { cls: "fx-up", max: 13, limit: 13, cleanup: true });
        box.addEventListener("click", (e) => {
          const b = e.target.closest(".trrow");
          if (b) { e.preventDefault(); finish({ action: "pick", id: b.dataset.tr }); }
        });
        const on = $('.trrow[aria-pressed="true"]', box);
        if (on) on.scrollIntoView({ block: "nearest" });
        if (window.matchMedia("(pointer: fine)").matches) (on || $(".trrow", box)).focus({ preventScroll: true });
        else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      },
    });
    if (res && res.action === "pick" && sel === card.id) equip(res.id);
  }

  /* ---------- the shop: the chosen card ---------- */
  const CHANGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/></svg>`;
  function headEmptyHTML() {
    const none = !items.length;
    return `<div class="trs__top trs__top--empty">
        <div class="trs__slot" aria-hidden="true"><svg><use href="#i-fan"/></svg></div>
        <div class="trs__info">
          <p class="trs__k">Trait Shop</p>
          <h2 class="trs__name">${none ? "No cards yet" : "No card chosen"}</h2>
          <p class="trs__hint">${none ? "Once cards are added you can set their traits here." : "Tap a card to see its trait, its final ATK and HP, and the trait that suits it best."}</p>
          ${none ? "" : `<button type="button" class="tm-btn tm-btn--primary fx-press trs__btn" data-act="change">${CHANGE_ICON}Choose a card</button>`}
        </div>
      </div>`;
  }
  function headHTML(card) {
    return `<div class="trs__top">
        <div class="trs__hero" data-no-detail></div>
        <div class="trs__info">
          <p class="trs__k">${esc(card.series || "Trait Shop")}</p>
          <h2 class="trs__name" tabindex="-1">${esc(card.name)}</h2>
          <div class="trs__nums">
            <div class="trs__num trs__num--atk"><span class="trs__nk">Final ATK</span><b data-cv="atk" data-value="0">0</b><small data-cs="atk"></small></div>
            <div class="trs__num trs__num--hp"><span class="trs__nk">Final HP</span><b data-cv="hp" data-value="0">0</b><small data-cs="hp"></small></div>
          </div>
        </div>
        <div class="trs__equip" data-equip></div>
      </div>
      <div class="trs__bar">
        <button type="button" class="tm-btn fx-press trs__btn" data-act="change">${CHANGE_ICON}Change card</button>
        <button type="button" class="tm-btn fx-press trs__btn" data-act="details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>Card details</button>
      </div>
      <div class="rarity-picker trs__rarity" role="group" aria-label="Rarity">${C.rarityChipsHTML()}</div>
      <p class="trs__cap" data-cap></p>
      <ul class="trs__extra" data-extra hidden></ul>
      <div class="trs__fxbox"><h3 class="trs__fxtitle" data-fxt></h3><ul class="trs__fx" data-fx></ul></div>
      <p class="trs__note">Saved on this device: every copy of a card shares one trait. Average hit and effective HP are estimates from the trait's numbers.</p>`;
  }
  // the box is a button: + (no trait yet) or the trait's badge -> the Trait Shop window
  const PLUS = `<svg class="tri__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
  function equipHTML(t) {
    return t
      ? `<button type="button" class="trs__eqbtn fx-press" data-act="pick" aria-label="Your trait: ${esc(t.name)}, ${esc(t.tier)}. Open the Trait Shop to change it">
           <span class="tri tri--lg" style="${colorStyle(t)}">${iconHTML(t, "tri__ico")}</span>
           <span class="trs__eqtext"><span class="trs__nk">Your trait</span><b style="${colorStyle(t)}">${esc(t.name)}</b><span class="trs__eqtier" style="${colorStyle(t)}">${esc(t.tier)}</span></span>
           <svg class="trs__eqgo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
         </button>
         <button type="button" class="chip glass fx-press trs__clear" data-act="clear" aria-label="Remove ${esc(t.name)} from this card">Remove</button>`
      : `<button type="button" class="trs__eqbtn fx-press" data-act="pick" aria-label="No trait yet. Open the Trait Shop to choose one">
           <span class="tri tri--lg tri--add">${PLUS}</span>
           <span class="trs__eqtext"><span class="trs__nk">Your trait</span><b>None yet</b><span class="trs__eqtier">Tap + to choose</span></span>
         </button>`;
  }

  function paint({ animate = false } = {}) {
    if (!sel) return;
    const card = cardOf(sel), id = of(sel), g = C.grade.get ? C.grade.get(sel) : null;
    const res = apply(card, state.rarity, g, id), t = res.trait;
    const eq = $("[data-equip]", ui.head);
    const was = eq.dataset.trait || "";
    eq.innerHTML = equipHTML(t);
    eq.style.cssText = t ? colorStyle(t) : "";
    eq.dataset.trait = id || "";
    if (animate && was !== (id || "") && !FX.reduced) { const b = $(".tri", eq); b.classList.remove("is-pop"); void b.offsetWidth; b.classList.add("is-pop"); }
    const num = (k, v) => { const n = $(`[data-cv="${k}"]`, ui.head); if (animate) FX.countTo(n, v, { format: C.fmtKey(k), duration: 450 }); else { n.dataset.value = v; n.textContent = C.fmtKey(k)(v); } };
    num("atk", res.atk); num("hp", res.hp);
    const gp = (i) => (g && g[i] ? ` · +${Number((g[i] * STEP * 100).toFixed(1))}% grade` : "");
    $('[data-cs="atk"]', ui.head).textContent = `${C.fmtStat(res.baseAtk)}${gp(0)}${t && t.dmg !== 1 ? ` · ${xN(t.dmg)} trait` : ""}`;
    $('[data-cs="hp"]', ui.head).textContent = `${C.fmtHp(res.baseHp)}${gp(3)}${t && t.hp !== 1 ? ` · ${xN(t.hp)} trait` : ""}`;
    $("[data-cap]", ui.head).textContent = `${state.rarity}${g && (g[0] || g[3]) ? ` · with your grades (ATK ${g[0] || "–"} · HP ${g[3] || "–"})` : " · no grades"}${t ? ` · ${t.name}` : " · no trait"}`;
    const extra = [];
    if (t && t.crit) extra.push(`<li><span>Average hit with crits</span><b>${C.fmtStat(res.avgHit)}</b></li>`);
    if (res.effHp !== res.hp) extra.push(`<li><span>Effective HP (dodge, damage cut, shield, revive)</span><b>${C.fmtHp(res.effHp)}</b></li>`);
    const ex = $("[data-extra]", ui.head);
    ex.innerHTML = extra.join("");
    ex.hidden = !extra.length;
    const fx = effects(t, { special: true });
    const ft = $("[data-fxt]", ui.head);
    ft.textContent = t ? `${t.name} · ${t.tier}` : "No trait";
    ft.style.cssText = colorStyle(t);
    $("[data-fx]", ui.head).innerHTML = t ? (fx.length ? fx.map((e) => `<li>${esc(e)}</li>`).join("") : `<li class="muted">No special effect: stats only.</li>`) : `<li class="muted">No trait: base stats. Tap + to set the one you rolled.</li>`;
    $(".trs__fxbox", ui.head).style.cssText = colorStyle(t);
    C.setCardNums(hero, { atk: res.atk, hp: res.hp }, { animate: animate && hero.classList.contains("is-live") });
  }

  const heroLabel = () => hero.setAttribute("aria-label", `${cardOf(sel).name}, ${state.rarity}. Open card details`);
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  // origin: the grid tile that was tapped (the card flies from it on a wide screen; a phone swaps the grid for the shop)
  function select(id, origin = null) {
    const card = cardOf(id);
    if (!card) return;
    sel = id;
    tiles.forEach((el, k) => { const on = k === id; el.classList.toggle("is-picked", on); if (on) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current"); });
    ui.head.innerHTML = headHTML(card);
    hero = C.renderCard(card, state.rarity);
    heroLabel();
    $(".trs__hero", ui.head).appendChild(hero);
    paint();
    const r = origin && origin.isConnected ? origin.getBoundingClientRect() : null;
    if (!wide.matches) {
      // phone: the shop takes the grid's place (Back brings the grid back where it was)
      if (!ui.wrap.classList.contains("is-shop")) listScroll = window.scrollY;
      ui.wrap.classList.add("is-shop");
      const top = ui.shop.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 58) - 8;
      window.scrollTo(0, Math.max(0, top));
      ui.shop.classList.remove("fx-page-in"); void ui.shop.offsetWidth; ui.shop.classList.add("fx-page-in");
      requestAnimationFrame(() => C.revealChip(ui.head));
      if (origin) ui.back.focus({ preventScroll: true });
    } else {
      // wide: the grid stays in view while the page scrolls; if the shop's top is above the screen, bring it back
      const top = ui.head.getBoundingClientRect().top, bar = $(".topbar"), off = (bar && bar.offsetHeight) || 0;
      if (wide.matches && top < off) {
        window.scrollTo({ top: Math.max(0, window.scrollY + top - off - 16), behavior: FX.reduced ? "auto" : "smooth" });
        FX.flash(ui.head);
      } else if (!(r && rectVisible(r) && FX.flip($(".trs__hero", ui.head), r))) {
        FX.fade(hero, 1, { duration: 300 });
        FX.flash(ui.head);
      }
    }
  }

  // tap a trait = it's this card's trait now (saved at once, toast with Undo) · the "cbi:trait" listener repaints
  function equip(tid) {
    const card = cardOf(sel);
    if (!card) return;
    const prev = of(card.id), next = byId(tid) ? tid : null;
    if (prev === next) { if (next) FX.flash($(".trs__equip", ui.head)); return; }
    set(card.id, next);
    if (hero.classList.contains("is-live")) C.flashCard(hero);
    const undo = { label: "Undo", fn: () => set(card.id, prev) };
    FX.toast(next ? `${byId(next).name} set as ${card.name}'s trait` : `Trait removed from ${card.name}`, { action: undo });
  }

  // phone: Back = the grid again, scrolled to where it was, the shop's card flashes in its tile
  function back() {
    if (!ui.wrap.classList.contains("is-shop")) return;
    ui.wrap.classList.remove("is-shop");
    ui.pick.classList.remove("fx-page-in"); void ui.pick.offsetWidth; ui.pick.classList.add("fx-page-in");
    if (sel) pageOf(sel);
    window.scrollTo(0, listScroll);
    const t = sel && tiles.get(sel);
    if (t && t.isConnected) {
      if (!rectVisible(t.getBoundingClientRect())) t.scrollIntoView({ block: "center" });
      t.focus({ preventScroll: true });
      FX.flash(t);
    }
  }

  /* ---------- Change card: a search window like the Grade picker (C.dialog, js/tiermaker.js) ---------- */
  const CHUNK = 40;
  async function changeDialog() {
    if (!C.dialog || !items.length) return;
    const res = await C.dialog({
      title: sel ? "Change card" : "Choose a card",
      html: `<div class="dk-pick">
          <div class="dk-pick__head">
            <label class="field field--search"><span class="sr-only">Search cards</span><svg class="field__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="search" data-q autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Search name or series"></label>
          </div>
          <div class="dk-pick__scroll" data-scroll>
            <div class="dk-pick__grid" data-grid role="list"></div>
            <div data-more class="dk-pick__more" aria-hidden="true"></div>
            <p class="dk-pick__empty" data-empty hidden>Nothing matches. Try another search.</p>
          </div>
          <p class="tm-field__note" data-count></p>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(d, finish) {
        $(".tm-dlg__sheet", d).classList.add("dk-pick-sheet");
        const q = $("[data-q]", d), grid = $("[data-grid]", d), more = $("[data-more]", d), scroller = $("[data-scroll]", d);
        const empty = $("[data-empty]", d), count = $("[data-count]", d);
        let rows = [], n = 0, io = null;
        const tile = (c) => {
          const el = document.createElement("div");
          el.className = "dk-tile";
          el.tabIndex = 0;
          el.setAttribute("role", "listitem");
          el.dataset.id = c.id;
          const art = C.renderCard(c, state.rarity, { mini: true, tilt: false });
          art.tabIndex = -1; art.removeAttribute("role"); art.setAttribute("aria-hidden", "true");
          tileBadge(art, c.id);
          el.appendChild(art);
          const t = byId(of(c.id));
          if (c.id === sel) { el.classList.add("is-here"); el.insertAdjacentHTML("beforeend", `<span class="dk-tile__tag dk-tile__tag--here">Here</span>`); }
          el.setAttribute("aria-label", `${c.name}${t ? `, trait ${t.name}` : ""}${c.id === sel ? ", open now" : ""}`);
          return el;
        };
        const chunk = () => {
          if (n >= rows.length) return;
          const frag = document.createDocumentFragment();
          rows.slice(n, n + CHUNK).forEach((c) => frag.appendChild(tile(c)));
          n = Math.min(rows.length, n + CHUNK);
          grid.appendChild(frag);
        };
        const run = () => {
          const w = words(q.value);
          rows = items.filter((c) => matches(c, w));
          grid.replaceChildren(); n = 0; scroller.scrollTop = 0;
          chunk();
          empty.hidden = rows.length > 0;
          count.textContent = `${rows.length} ${rows.length === 1 ? "card" : "cards"}${rows.length < items.length ? ` of ${items.length}` : ""}`;
        };
        if ("IntersectionObserver" in window) {
          io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) chunk(); }, { root: scroller, rootMargin: "240px 0px" });
          io.observe(more);
        } else scroller.addEventListener("scroll", () => { if (scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 300) chunk(); }, { passive: true });
        q.addEventListener("input", run);
        q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); q.blur(); } });
        const choose = (el) => { if (el) finish({ action: "pick", id: el.dataset.id }); };
        grid.addEventListener("click", (e) => choose(e.target.closest(".dk-tile")));
        grid.addEventListener("keydown", (e) => { const el = e.target.closest(".dk-tile"); if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(el); } });
        d.addEventListener("close", () => { if (io) io.disconnect(); }, { once: true });
        run();
        if (window.matchMedia("(pointer: fine)").matches) q.focus({ preventScroll: true });
        else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // no keyboard popping up on a phone
      },
    });
    if (!res || res.action !== "pick") return;
    if (res.id === sel) return;
    select(res.id);
    pageOf(res.id);
    const tile = tiles.get(res.id);
    if (wide.matches && tile && tile.isConnected && !rectVisible(tile.getBoundingClientRect())) tile.scrollIntoView({ block: "nearest", behavior: FX.reduced ? "auto" : "smooth" });
  }

  function build() {
    const list = data().list;
    ui.wrap.hidden = !list.length;
    ui.empty.hidden = list.length > 0;
    built = true;
    if (!list.length) return;
    ui.tools.hidden = !items.length;
    ui.gridEmpty.hidden = items.length > 0;
    if (!items.length) ui.grid.replaceChildren();
    ui.head.innerHTML = headEmptyHTML();
    applyList({ animate: true });
  }

  function bind() {
    ui.search.addEventListener("input", () => { filter.q = ui.search.value; applyList(); });
    ui.search.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.search.blur(); });
    ui.mine.addEventListener("click", () => { filter.mine = !filter.mine; applyList({ animate: true }); });
    const reset = () => { filter.q = ""; filter.mine = false; ui.search.value = ""; applyList({ animate: true }); };
    ui.reset.addEventListener("click", reset);
    ui.noneReset.addEventListener("click", reset);
    ui.grid.addEventListener("click", (e) => { const el = e.target.closest(".card[data-id]"); if (el) select(el.dataset.id, el); });
    ui.grid.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card[data-id]")) { e.preventDefault(); select(e.target.dataset.id, e.target); }
    });
    C.bindPager(ui.pager, goPage);
    ui.back.addEventListener("click", back);
    ui.head.addEventListener("click", (e) => {
      const a = e.target.closest("[data-act]");
      if (a) {
        if (a.dataset.act === "change") changeDialog();
        else if (a.dataset.act === "pick") shopDialog();
        else if (a.dataset.act === "clear") equip(null);
        else if (a.dataset.act === "details" && hero) C.openCard(sel, hero, { list: shownIds() });
        return;
      }
      // the shop's card opens the card details like every card on the site; swiping walks the grid's order
      const c = e.target.closest(".trs__hero .card");
      if (c) C.openCard(sel, c, { list: shownIds() });
    });
    ui.head.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".trs__hero .card")) { e.preventDefault(); C.openCard(sel, e.target, { list: shownIds() }); }
    });
    document.addEventListener("cbi:rarity", (e) => {
      if (!built) return;
      tiles.forEach((el, id) => { C.setCardRarity(el, cardOf(id), e.detail, { animate: false }); tileBadge(el, id); });
      if (!sel || !hero) return;
      // keep the trait numbers on screen while the rarity swaps underneath, then count to the new ones
      const keep = ["atk", "hp"].map((k) => { const n = $(`[data-k="${k}"]`, hero); return [n.dataset.value, n.textContent]; });
      C.setCardRarity(hero, cardOf(sel), e.detail, { animate: false });
      heroLabel();
      ["atk", "hp"].forEach((k, j) => { const n = $(`[data-k="${k}"]`, hero); n.dataset.value = keep[j][0]; n.textContent = keep[j][1]; });
      if (hero.classList.contains("is-live")) C.flashCard(hero);
      paint({ animate: true });
    });
  }

  /* ---------- Boot ---------- */
  function init() {
    Object.assign(ui, {
      wrap: $("#trw"), empty: $("#tr-empty"), tools: $("#trw-tools"), search: $("#trw-search"), mine: $("#trw-mine"),
      count: $("#trw-count"), reset: $("#trw-reset"), grid: $("#trw-grid"), pager: $("#trw-pager"), none: $("#trw-none"), noneText: $("#trw-none-text"),
      noneReset: $("#trw-none-reset"), gridEmpty: $("#trw-empty"), pick: $(".trw__pick"), shop: $("#trw-shop"), head: $("#trs-head"), back: $("#trs-back"),
    });
    load();
    if (!ui.grid) return;
    items = state.cards.filter((c) => c && c.id && c.base).slice().sort(compare);
    items.forEach((c) => hay.set(c.id, (c.name + " " + (c.series || "")).toLowerCase()));
    bind();
    C.lazy("traits", build);
    // a trait changed somewhere (Details sheet, a deck slot, this page): keep every view in step
    document.addEventListener("cbi:trait", (e) => {
      const id = e.detail && e.detail.id;
      repaintPanels(id);
      if (!built) return;
      const el = tiles.get(id);
      if (el) tileBadge(el, id);
      paintCounts();
      if (id === sel) paint({ animate: true });
    });
    document.addEventListener("cbi:rarity", () => repaintPanels(null));
  }

  C.traits = { init, list: () => data().list, byId, of, set, map, power, mult, effects, apply, pillHTML, chipsHTML, panelHTML, mountPanel, pickDialog, colorStyle, iconHTML, TIERS };
})();
