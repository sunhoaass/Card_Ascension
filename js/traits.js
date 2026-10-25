/* ==========================================================
   Card Battle Infinity — Traits (Trait Shop in the game)
   · data/traits.json: 13 traits in 8 tiers (Common … Secret), chance per roll, pity, effects. 1 roll = 5 Shards.
   · In the game every copy of a card has the same trait, so the user picks ONE trait per card:
     localStorage "cbi:traits" = { "<card id>": "<trait id>" } (saved on every change, never crashes if storage is blocked).
     The Details sheet, the graded case label (js/grade.js) and the Deck page (one trait per slot = that card's trait)
     all read and write it through here. Every change fires the "cbi:trait" event ({ id, trait }).
   · Traits never change Overall / Tier (same as grades). The team score uses power() (PROGRESS.md §10.5).
   · Traits tab (#traits): the 13 traits as cards in their tier colour + a calculator
     (card + rarity + grades + trait -> final ATK / HP + the special effects in words).
   CBI.traits = { init, list(), byId(id), of(cardId), set(cardId, traitId|null), map(), power(id), mult(id), effects(t),
                  apply(card, rarity, grades, traitId), pillHTML(id), chipsHTML(selected), panelHTML(card), mountPanel(root, card),
                  pickDialog(cardId) }
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
  const GEM = `<svg class="tr-gem" aria-hidden="true"><use href="#i-gem"/></svg>`;
  function pillHTML(id, { none = "No trait" } = {}) {
    const t = byId(id);
    return `<span class="trp${t ? "" : " trp--none"}" style="${colorStyle(t)}">${GEM}<span class="trp__name">${esc(t ? t.name : none)}</span>${t ? `<span class="trp__tier">${esc(t.tier)}</span>` : ""}</span>`;
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
    const line = (k, label, from, to) => `<div class="trres__row trres__row--${k}"><span class="trres__k">${label}</span><b class="trres__v" data-trv="${k}" data-value="${to}">${C.fmtStat(to)}</b><small>${to !== from ? `${C.fmtStat(from)} ${t ? xN(k === "atk" ? t.dmg : t.hp) : ""}` : t ? "no change" : state.rarity}</small></div>`;
    const was = (k) => { const n = $(`[data-trv="${k}"]`, box); return n ? Number(n.dataset.value) || 0 : 0; };
    const prev = { atk: was("atk"), hp: was("hp") };
    box.innerHTML = `
      <div class="trres__nums">${line("atk", "ATK", res.gAtk, res.atk)}${line("hp", "HP", res.gHp, res.hp)}</div>
      <p class="trres__cap">${esc(state.rarity)}${g && (g[0] || g[3]) ? " · with your grades" : ""}${t ? ` · ${esc(t.name)}` : " · no trait"}</p>
      ${t && effects(t, { special: true }).length ? `<ul class="trres__fx">${effects(t, { special: true }).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}`;
    if (animate && !FX.reduced) ["atk", "hp"].forEach((k) => { const n = $(`[data-trv="${k}"]`, box); if (prev[k]) { const to = Number(n.dataset.value); n.dataset.value = prev[k]; n.textContent = C.fmtStat(prev[k]); FX.countTo(n, to, { format: C.fmtStat, duration: 450 }); } });
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
        ${GEM}<span class="trdlg__name">${t ? esc(t.name) : "No trait"}${t && rec && rec.id === t.id ? ` <em>Recommended</em>` : ""}</span>
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
     Traits tab: the 13 traits + the calculator
     ========================================================== */
  const ui = {};
  let built = false;
  const calc = { id: null, trait: null, g: [0, 0, 0, 0], card: null };
  const cardsSorted = () => state.cards.filter((c) => c && c.id && c.base).slice()
    .sort((a, b) => (C.isRanked(b) - C.isRanked(a)) || ((b.scores && b.scores.overall) || 0) - ((a.scores && a.scores.overall) || 0) || a.name.localeCompare(b.name));

  function traitCardHTML(t) {
    const fx = effects(t);
    return `<button type="button" class="trc fx-press" data-tier="${esc(t.tier)}" data-calc-trait="${esc(t.id)}" style="${colorStyle(t)}" aria-label="${esc(t.name)}, ${esc(t.tier)}, ${fmtPct(t.chance)} per roll. ${esc(fx.join(", "))}. Tap to try it in the calculator">
        <span class="trc__top">
          <svg class="trc__gem" aria-hidden="true"><use href="#i-gem"/></svg>
          <span class="trc__chance">${fmtPct(t.chance)}</span>
        </span>
        <span class="trc__title"><span class="trc__name">${esc(t.name)}</span><span class="trc__tier">${esc(t.tier)}</span></span>
        <span class="trc__fx">${fx.map((e) => `<span>${esc(e)}</span>`).join("")}</span>
        <span class="trc__foot"><span>1 in ${oneIn(t)} rolls</span><span>${t.pity ? `Pity ${t.pity.toLocaleString("en-US")} · ${(t.pity * ROLL()).toLocaleString("en-US")} Shards` : "No pity"}</span></span>
      </button>`;
  }

  function stepperHTML(i, label) {
    return `<div class="trstep" data-g="${i}">
        <span class="trstep__k">${label} grade</span>
        <button type="button" class="trstep__btn fx-press" data-gstep="-1" aria-label="Lower ${label} grade">−</button>
        <span class="trstep__v" data-gv aria-live="polite"></span>
        <button type="button" class="trstep__btn fx-press" data-gstep="1" aria-label="Raise ${label} grade">+</button>
      </div>`;
  }

  function build() {
    const list = data().list.slice().sort((a, b) => tierOrder(b) - tierOrder(a) || a.chance - b.chance);
    ui.grid.innerHTML = list.map(traitCardHTML).join("");
    ui.empty.hidden = list.length > 0;
    ui.tabs.hidden = !list.length;
    if (!list.length) { ui.list.hidden = false; ui.calcView.hidden = true; built = true; return; }
    FX.stagger(ui.grid, 30, { cls: "fx-grid-in", max: 10, limit: 14, cleanup: true });

    const cards = cardsSorted();
    ui.calcEmpty.hidden = cards.length > 0;
    ui.calcBody.hidden = !cards.length;
    if (cards.length) {
      ui.select.innerHTML = cards.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${C.isRanked(c) ? ` · Tier ${esc(c.tier)}` : ""}</option>`).join("");
      ui.rarity.innerHTML = C.rarityChipsHTML();
      ui.steps.innerHTML = stepperHTML(0, "ATK") + stepperHTML(3, "HP");
      ui.chips.innerHTML = chipsHTML(null);
      pickCard(cards[0].id, { animate: false });
    }
    built = true;
  }

  function pickCard(id, { animate = true } = {}) {
    const card = state.cards.find((c) => c.id === id);
    if (!card) return;
    calc.id = id;
    ui.select.value = id;
    const g = C.grade.get ? C.grade.get(id) : null;
    calc.g = g ? g.slice() : [0, 0, 0, 0];
    const mine = of(id);
    if (mine) calc.trait = mine;
    else if (!calc.touched) calc.trait = byId(card.bestTrait) ? card.bestTrait : null;
    // the preview card (tap = card details, like every card on the site)
    const el = C.renderCard(card, state.rarity);
    ui.hero.replaceChildren(el);
    calc.card = el;
    if (animate) FX.flash(ui.hero);
    paintCalc({ animate: false });
  }

  function paintCalc({ animate = true } = {}) {
    if (!calc.id) return;
    const card = state.cards.find((c) => c.id === calc.id);
    const res = apply(card, state.rarity, calc.g, calc.trait), t = res.trait;
    pressChips(ui.chips, calc.trait);
    // grades
    $$("[data-g]", ui.steps).forEach((s) => {
      const g = calc.g[Number(s.dataset.g)];
      $("[data-gv]", s).textContent = g ? `${g} · +${Number((g * STEP * 100).toFixed(1))}%` : "None";
      $('[data-gstep="-1"]', s).disabled = g <= 0;
      $('[data-gstep="1"]', s).disabled = g >= 10;
    });
    const saved = C.grade.get ? C.grade.get(calc.id) : null;
    ui.useGrades.disabled = !saved;
    ui.useGrades.textContent = saved ? `Use my grades (ATK ${saved[0] || "–"} · HP ${saved[3] || "–"})` : "No saved grades for this card";
    // your trait / recommended
    const mine = of(calc.id), rec = byId(card.bestTrait);
    ui.mine.innerHTML = `<span class="trcalc__k">Your trait</span>${pillHTML(mine)}${rec ? `<span class="trcalc__k">Recommended</span>${pillHTML(rec.id)}` : ""}`;
    ui.save.hidden = (calc.trait || null) === mine;
    ui.save.textContent = calc.trait ? `Save ${byId(calc.trait).name} as my trait` : "Clear my trait for this card";
    // numbers
    const num = (k, v) => { const n = $(`[data-cv="${k}"]`, ui.result); if (animate) FX.countTo(n, v, { format: C.fmtStat, duration: 450 }); else { n.dataset.value = v; n.textContent = C.fmtStat(v); } };
    num("atk", res.atk); num("hp", res.hp);
    const gp = (i) => (calc.g[i] ? ` · +${Number((calc.g[i] * STEP * 100).toFixed(1))}% grade` : "");
    $('[data-cs="atk"]', ui.result).textContent = `${state.rarity} ${C.fmtStat(res.baseAtk)}${gp(0)}${t && t.dmg !== 1 ? ` · ${xN(t.dmg)} trait` : ""}`;
    $('[data-cs="hp"]', ui.result).textContent = `${state.rarity} ${C.fmtStat(res.baseHp)}${gp(3)}${t && t.hp !== 1 ? ` · ${xN(t.hp)} trait` : ""}`;
    const extra = [];
    if (t && t.crit) extra.push(`<li><span>Average hit with crits</span><b>${C.fmtStat(res.avgHit)}</b></li>`);
    if (res.effHp !== res.hp) extra.push(`<li><span>Effective HP (dodge, damage cut, shield, revive)</span><b>${C.fmtStat(res.effHp)}</b></li>`);
    ui.extra.innerHTML = extra.join("");
    ui.extra.hidden = !extra.length;
    const fx = effects(t, { special: true });
    ui.fx.innerHTML = t ? (fx.length ? fx.map((e) => `<li>${esc(e)}</li>`).join("") : `<li class="muted">No special effect: stats only.</li>`) : `<li class="muted">No trait: base stats.</li>`;
    ui.fxTitle.textContent = t ? `${t.name} · ${t.tier}` : "No trait";
    ui.fxTitle.style.cssText = colorStyle(t);
    C.setCardNums(calc.card, { atk: res.atk, hp: res.hp }, { animate: animate && calc.card.classList.contains("is-live") });
  }
  const $$ = (s, r) => [...r.querySelectorAll(s)];

  function setTab(tab, { animate = true } = {}) {
    const on = tab === "calc";
    ui.tabs.style.setProperty("--i", on ? 1 : 0);
    $$(".seg__btn", ui.tabs).forEach((b) => { const sel = b.dataset.tab === tab; b.setAttribute("aria-selected", String(sel)); b.tabIndex = sel ? 0 : -1; });
    if (ui.list.hidden === on) return;
    ui.list.hidden = on; ui.calcView.hidden = !on;
    const show = on ? ui.calcView : ui.list;
    if (animate) { show.classList.remove("fx-page-in"); void show.offsetWidth; show.classList.add("fx-page-in"); }
  }

  function bind() {
    ui.tabs.addEventListener("click", (e) => { const b = e.target.closest(".seg__btn"); if (b) setTab(b.dataset.tab); });
    ui.grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-calc-trait]");
      if (!b) return;
      calc.trait = b.dataset.calcTrait; calc.touched = true;
      setTab("calc");
      paintCalc();
      window.scrollTo({ top: Math.max(0, ui.calcView.getBoundingClientRect().top + window.scrollY - 90), behavior: FX.reduced ? "auto" : "smooth" });
      FX.flash(ui.result);
    });
    ui.select.addEventListener("change", () => pickCard(ui.select.value));
    ui.chips.addEventListener("click", (e) => {
      const b = e.target.closest("[data-trait]");
      if (!b) return;
      calc.trait = b.dataset.trait || null; calc.touched = true;
      paintCalc();
      C.flashCard(calc.card);
    });
    ui.steps.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gstep]");
      if (!b || b.disabled) return;
      const i = Number(b.closest("[data-g]").dataset.g);
      calc.g[i] = Math.max(0, Math.min(10, calc.g[i] + Number(b.dataset.gstep)));
      paintCalc();
    });
    ui.useGrades.addEventListener("click", () => { const g = C.grade.get(calc.id); if (g) { calc.g = g.slice(); paintCalc(); } });
    ui.save.addEventListener("click", () => {
      set(calc.id, calc.trait);
      FX.toast(calc.trait ? `${byId(calc.trait).name} saved as your trait for ${state.cards.find((c) => c.id === calc.id).name}` : "Trait cleared");
    });
    document.addEventListener("cbi:rarity", (e) => {
      if (!built || !calc.card) return;
      const card = state.cards.find((c) => c.id === calc.id);
      // keep the trait numbers on screen while the rarity swaps underneath, then count to the new ones
      const keep = ["atk", "hp"].map((k) => { const n = $(`[data-k="${k}"]`, calc.card); return [n.dataset.value, n.textContent]; });
      C.setCardRarity(calc.card, card, e.detail, { animate: false });
      ["atk", "hp"].forEach((k, j) => { const n = $(`[data-k="${k}"]`, calc.card); n.dataset.value = keep[j][0]; n.textContent = keep[j][1]; });
      if (calc.card.classList.contains("is-live")) C.flashCard(calc.card);
      paintCalc();
    });
  }

  /* ---------- Boot ---------- */
  function init() {
    Object.assign(ui, {
      tabs: $("#tr-tabs"), list: $("#tr-list"), grid: $("#tr-grid"), empty: $("#tr-empty"),
      calcView: $("#tr-calc"), calcBody: $("#tc-body"), calcEmpty: $("#tc-empty"),
      select: $("#tc-card"), rarity: $("#tc-rarity"), steps: $("#tc-steps"), useGrades: $("#tc-use-grades"),
      chips: $("#tc-traits"), mine: $("#tc-mine"), save: $("#tc-save"), hero: $("#tc-hero"),
      result: $("#tc-result"), extra: $("#tc-extra"), fx: $("#tc-fx"), fxTitle: $("#tc-fx-title"),
    });
    load();
    if (!ui.grid) return;
    bind();
    C.lazy("traits", build);
    // a trait changed somewhere (Details sheet, a deck slot, this page): keep every view in step
    document.addEventListener("cbi:trait", (e) => {
      repaintPanels(e.detail && e.detail.id);
      if (built && calc.id && e.detail && e.detail.id === calc.id) paintCalc({ animate: false });
    });
    document.addEventListener("cbi:rarity", () => repaintPanels(null));
  }

  C.traits = { init, list: () => data().list, byId, of, set, map, power, mult, effects, apply, pillHTML, chipsHTML, panelHTML, mountPanel, pickDialog, colorStyle, TIERS };
})();
