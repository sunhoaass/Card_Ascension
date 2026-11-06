/* ==========================================================
   Card Battle Infinity — Battle (PROGRESS ▶️ "⚔️ ระบบต่อสู้" + §14 · step ② · from mockup/battle 2026-11-04)
   Menu "Battle" (4th) · 2 tabs: Guild Boss | Custom (route stays #battle/arena) · routes (js/app.js PAGES "battle"):
     #battle = Guild Boss · #battle/arena · #battle/fight (the fight, over the site) · #battle/result
   Teams are built like a deck: the Deck page's parts (C.deckParts in js/deck.js: pills, Trait / Grade badges, the
   slot sheet's Grade + Trait) + battle-only Custom HP / ATK · numbers = js/deckbuff.js (deck buffs + trait + grade).
   Supports: the live list + data/pending/support.json (the engine needs all 100 · §14) · read only here, never added
   to C.state.support (the Cards page still shows only the finished ones).
   Skills: data/battle.json (cards / support / traits / groups / the clip's numbers) · a card not in it fights with
   ATK / HP only ("Skill not simulated yet").
   Saved on this device: cbi:battle { v: 2, teams { boss, a, b }, stage (= the start stage), fights [{ dmg, stage, at }] } · cbi:battleMute
   CBI.battle = { init, show, Battle (engine, also for tests), teams }
   ========================================================== */
(function () {
  "use strict";
  const C = window.CBI, { state, $, esc } = C;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const P = () => C.deckParts;        // js/deck.js (loaded before this file)
  const SLOTS = 4, KINDS = ["cards", "support"], RKEY = { cards: "cardRarity", support: "supRarity" }, GRADE_MAX = 10;
  const SAVE_KEY = "cbi:battle", MUTE_KEY = "cbi:battleMute", MUSIC_VOL = 0.3;
  const reduced = () => !!(window.FX && FX.reduced);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    sound: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
    mute: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>'),
  };
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const BIG = [[1e24, "Sp"], [1e21, "Sx"], [1e18, "Qi"], [1e15, "Qa"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];   // stage 1000+ needs Qi and up
  const fmtS = (n) => { const a = Math.abs(n); for (const [v, u] of BIG) if (a >= v) return (n / v).toFixed(a / v >= 100 ? 0 : a / v >= 10 ? 1 : 2) + u; return String(Math.round(n)); };
  const fmtG = (n) => { for (const [v, u] of BIG) if (n >= v) return (n / v).toFixed(1) + u; return String(Math.round(n)); };   // the game's "next at 642.5B"
  const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const raw = (n) => String(Math.round(n));   // floating numbers like the game's clip: +567664559 (no commas)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dialog = (o) => C.dialog(o);

  /* ==========================================================
     Data
     ========================================================== */
  let BD = { clip: {}, boss: {}, cards: {}, support: {}, traits: {}, groups: {} };   // data/battle.json
  let SUP = [];                                                                       // live + pending supports
  let ready = false, loading = null;
  const lookup = (kind, id) => (kind === "cards" ? state.cards : SUP).find((x) => x && x.id === id) || null;
  const isLive = (kind, id) => (kind === "cards" ? state.cards : state.support || []).some((x) => x && x.id === id);
  const rarityOf = (d, kind, i) => C.deckBuff.rarityOf(d, kind, i);
  const rarities = () => state.meta.rarities.map((r) => r.name);
  const thumbOf = (kind, x) => (!x ? "" : kind === "cards" ? String(x.image || "").replace("/art/", "/art/thumb/") : String(x.image || "").replace("images/support/", "images/support/thumb/"));
  const traitById = (id) => P().traitById(id);
  const inGroup = (id, g) => { const a = BD.groups && BD.groups[g]; return Array.isArray(a) && a.includes(id); };
  const clip = () => BD.clip || {};
  const ROLL = () => Number(clip().roll) || 0.12;
  const DEF_K = () => Number(clip().defK) || 0.2;
  const statusOk = () => !!clip().statusConfirmed;

  /* ==========================================================
     Teams (deck-shaped so js/deckbuff.js reads them) · custom[i] = { atk?, hp? } replaces the number before Trait + Grade (battle only)
     ========================================================== */
  const emptyTeam = () => ({ name: "", rarity: "Godly", cards: [null, null, null, null], support: [null, null, null, null],
    cardRarity: [null, null, null, null], supRarity: [null, null, null, null], trait: [null, null, null, null], grades: [null, null, null, null], custom: [null, null, null, null], from: "" });
  const T = { boss: emptyTeam(), a: emptyTeam(), b: emptyTeam() };
  let START = 0, STAGE = 0, FIGHTS = [];   // START = the stage you start from (typed) · STAGE = the stage now (start + your damage)
  const four = (a, f) => { const o = []; for (let i = 0; i < SLOTS; i++) o.push(f(Array.isArray(a) ? a[i] : null)); return o; };
  const idOr = (v) => (typeof v === "string" && /^[a-z0-9-]{1,80}$/.test(v) ? v : null);
  const rarOr = (v) => (typeof v === "string" && rarities().includes(v) ? v : null);
  const gradeOr = (g) => (Array.isArray(g) && g.length >= 4 ? (() => { const n = g.slice(0, 4).map((x) => Math.max(0, Math.min(GRADE_MAX, Math.round(Number(x) || 0)))); return n.some((x) => x > 0) ? n : null; })() : null);
  const cusOr = (c) => { if (!c || typeof c !== "object") return null; const o = {}; ["atk", "hp"].forEach((k) => { const v = Math.round(Number(c[k])); if (v >= 1 && Number.isFinite(v)) o[k] = v; }); return Object.keys(o).length ? o : null; };
  function cleanTeam(t) {
    const d = emptyTeam();
    if (!t || typeof t !== "object") return d;
    d.cards = four(t.cards, idOr); d.support = four(t.support, idOr);
    d.cardRarity = four(t.cardRarity, rarOr); d.supRarity = four(t.supRarity, rarOr);
    d.trait = four(t.trait, idOr); d.grades = four(t.grades, gradeOr); d.custom = four(t.custom, cusOr);
    d.from = typeof t.from === "string" ? t.from.slice(0, 120) : "";
    return d;
  }
  function save() {
    const ok = store.set(SAVE_KEY, JSON.stringify({ v: 2, teams: T, stage: START, fights: FIGHTS.slice(-200) }));
    if (!ok && !save.warned) { save.warned = true; FX.toast("Can't save on this device (private mode?) · teams last until you close the page"); }
  }
  function myDecks() { try { const a = JSON.parse(localStorage.getItem("cbi:decks") || "[]"); return Array.isArray(a) ? a.filter((d) => d && Array.isArray(d.cards)) : []; } catch (e) { return []; } }
  function copyDeck(src, d) {
    for (let i = 0; i < SLOTS; i++) {
      d.cards[i] = idOr(src.cards[i]); d.support[i] = idOr((src.support || [])[i]);
      d.cardRarity[i] = C.deckBuff.rarityOf(src, "cards", i); d.supRarity[i] = C.deckBuff.rarityOf(src, "support", i);
      d.trait[i] = Array.isArray(src.trait) ? idOr(src.trait[i]) : null;
      d.grades[i] = Array.isArray(src.grades) ? gradeOr(src.grades[i]) : null;
      d.custom[i] = null;
    }
    d.from = "From My Decks: " + (src.name || "Deck");
  }
  function loadSaved() {
    let s = null;
    try { s = JSON.parse(store.get(SAVE_KEY) || "null"); } catch (e) { s = null; }
    if (s && s.teams) {
      ["boss", "a", "b"].forEach((k) => { T[k] = cleanTeam(s.teams[k]); });
      const st = Math.round(Number(s.stage)); if (s.v >= 2 && st >= 0 && st <= SMAX) START = st;   // v1 saved the boss's stage (448 by default), not a start
      FIGHTS = Array.isArray(s.fights) ? s.fights.filter((f) => f && Number(f.dmg) > 0).map((f) => ({ dmg: Number(f.dmg), stage: Math.round(Number(f.stage)) || 0, at: Number(f.at) || 0 })) : [];
      restage();
      return;
    }
    // first visit: the first saved deck in both of your teams (a copy) · none = empty teams
    START = 0; restage();
    const d0 = myDecks()[0];
    if (d0) { copyDeck(d0, T.boss); copyDeck(d0, T.a); }
  }

  /* final numbers of a team: deck buffs + trait + grade (js/deckbuff.js) · custom (owner 2026-11-05) = the number before
     Trait + Grade (it stands in for card × rarity × supports × card buffs) · Trait and Grade still multiply it
     real = without custom · pre = real before Trait + Grade (the custom boxes' placeholder) · tg = the Trait × Grade multiplier */
  function stats(key) {
    const d = T[key], res = C.deckBuff.compute(d, { support: SUP });
    return res.map((r, i) => {
      if (!r) return null;
      const t = r.from.find((x) => x.kind === "trait"), g = r.grade || {};
      const tg = { atk: (t ? t.mA : 1) * (1 + (Number(g.atk) || 0) / 100), hp: (t ? t.mH : 1) * (1 + (Number(g.hp) || 0) / 100) };
      const c = d.custom[i] || {}, pre = { atk: Math.round(r.atk / tg.atk), hp: Math.round(r.hp / tg.hp) };
      return { ...r, real: { atk: r.atk, hp: r.hp }, pre, tg,
        atk: c.atk != null ? Math.round(c.atk * tg.atk) : r.atk, hp: c.hp != null ? Math.round(c.hp * tg.hp) : r.hp };
    });
  }
  /* custom boxes (owner 2026-11-05): type short numbers too · 1k 10K 1.5M 100m 2B 1T 1Qd 1Qi (case doesn't matter) · commas ok */
  const UNITS = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qd: 1e15, qi: 1e18 };
  function parseNum(txt) {
    const m = /^(\d+(?:\.\d+)?|\.\d+)(k|m|b|t|qa|qd|qi)?$/i.exec(String(txt).replace(/[,\s_]/g, ""));
    if (!m) return NaN;
    return Math.round(Number(m[1]) * (m[2] ? UNITS[m[2].toLowerCase()] : 1));
  }
  // a custom number back in its box: short when it is exactly short (1,000,000,000 -> 1B · 2.5T) · else the full number
  function cusText(v) {
    for (const [u, n] of [["Qi", 1e18], ["Qd", 1e15], ["T", 1e12], ["B", 1e9], ["M", 1e6], ["K", 1e3]]) {
      if (v < n) continue;
      const q = v / n, r = Math.round(q * 1000) / 1000;
      return Math.abs(q - r) * n < 0.5 ? Number(r.toFixed(3)) + u : fmt(v);   // only the biggest unit that fits
    }
    return fmt(v);
  }
  // boss ATK at a stage: the 2 clips (stage 0 = 128,080,338 · stage 448 = 460,425,250) · in between = a guess (the same % every stage)
  const bossAtk = (st) => (Number(BD.boss.atk) || 128080338) * Math.pow(1 + (Number(BD.boss.perStage) || 0.002860093), st - (Number(BD.boss.stage) || 0));
  /* Stages (data/battle.json boss.stages): the guild damage a stage needs · stage 1 = 10K · from stage early + 1 on, each stage
     needs ×rate the one before (the clips: 625.4B = 414 · next at 642.5B · 1.726T = 448 · next at 1.8T · 2.45T = 460 → ×1.03) ·
     stages 1 … early + 1 = the same % every stage from 10K up to that line (a guess until we have a low stage from the game) */
  const SMAX = 1500;
  function need(n) {
    const g = BD.boss.stages || {}, first = Number(g.first) || 1e4, E = Number(g.early) || 100, at = Number(g.at) || 415, atD = Number(g.atDmg) || 642.5e9, r = Number(g.rate) || 1.03;
    if (n <= 0) return 0;
    if (n > E) return atD * Math.pow(r, n - at);
    return first * Math.pow(atD * Math.pow(r, E + 1 - at) / first, (n - 1) / E);
  }
  const stageOf = (d) => { let lo = 0, hi = SMAX; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (need(m) <= d * (1 + 1e-12)) lo = m; else hi = m - 1; } return lo; };
  const mine = () => FIGHTS.reduce((x, f) => x + f.dmg, 0);
  const guildDmg = () => need(START) + mine();   // the start stage's line + everything you dealt since
  function restage() { STAGE = stageOf(guildDmg()); }

  /* ---------- Card scaler: the card is laid out 300px wide and scaled to its box, so small type never hits a phone's
     minimum font size (the owner's phone, mockup round 2: the card text spilled out of the small team cards) ---------- */
  const DESIGN_W = 300;
  const scaleRO = typeof ResizeObserver === "function" ? new ResizeObserver((es) => es.forEach((e) => fitScale(e.target))) : null;
  function fitScale(sc) {
    const inn = sc.firstElementChild; if (!inn) return;
    const k = sc.clientWidth / DESIGN_W; if (!k) return;
    sc.style.setProperty("--k", k.toFixed(4));
    sc.style.height = inn.offsetHeight * k + "px";
  }
  function scaled(card) {
    const sc = document.createElement("div"); sc.className = "bt-sc";
    const inn = document.createElement("div"); inn.className = "bt-sc__in"; inn.appendChild(card); sc.appendChild(inn);
    if (scaleRO) scaleRO.observe(sc);
    requestAnimationFrame(() => fitScale(sc));
    return sc;
  }
  function cardEl(kind, x, rarity) {
    const art = C.renderCard(x, rarity, { mini: true, tilt: false });
    art.tabIndex = -1; art.removeAttribute("role"); art.setAttribute("aria-hidden", "true");
    return art;
  }

  /* ==========================================================
     Board (same DOM + classes as the Deck editor's .dk-board)
     ========================================================== */
  let sel = null;   // { key, kind, i } while moving a card
  function paintBoard(key, { flash = null } = {}) {
    const root = $(`[data-board="${key}"]`); if (!root) return;
    const d = T[key], st = stats(key);
    root.innerHTML = KINDS.map((kind) => `<section class="dk-group" aria-label="${kind === "cards" ? "Cards" : "Support cards"}">
        <div class="dk-group__head"><h3 class="dk-group__title">${kind === "cards" ? "Cards" : "Support"}</h3><span class="dk-group__count">${d[kind].filter(Boolean).length} / ${SLOTS}</span></div>
        <div class="dk-row" data-kind="${kind}"></div></section>`).join("");
    KINDS.forEach((kind) => {
      const row = $(`.dk-row[data-kind="${kind}"]`, root);
      for (let i = 0; i < SLOTS; i++) row.appendChild(slotEl(key, kind, i, st));
    });
    requestAnimationFrame(() => root.querySelectorAll(".dk-nm span").forEach(P().fitName));
    const fromEl = $(`[data-team-from="${key}"]`); if (fromEl) fromEl.textContent = d.from.replace(/^From My Decks:\s*/, "");   // saved as "From My Decks: <name>" · shown as the deck name
    if (flash) { const el = $(`.dk-slot[data-kind="${flash.kind}"][data-i="${flash.i}"]`, root); if (el && !reduced()) FX.flash(el); }
    if (key === "a" || key === "b") clearSim();
    save();
  }
  function slotEl(key, kind, i, st) {
    const d = T[key], id = d[kind][i], x = id ? lookup(kind, id) : null, r = rarityOf(d, kind, i);
    const slot = document.createElement("div");
    slot.className = "dk-slot" + (id ? "" : " is-empty");
    slot.dataset.kind = kind; slot.dataset.i = i; slot.dataset.team = key;
    const nm = id ? (x ? x.name : id) : kind === "cards" ? `Slot ${i + 1}` : "";
    const cus = kind === "cards" && d.custom[i] ? `<span class="dk-pill bt-pill--cus" title="Custom ${[d.custom[i].atk != null ? "ATK" : "", d.custom[i].hp != null ? "HP" : ""].filter(Boolean).join(" + ")}"><span>Custom</span></span>` : "";
    slot.innerHTML = `<div class="dk-nm${id ? " is-name" : ""}"><span>${esc(nm)}</span></div><div class="dk-slot__box"></div><div class="dk-info"${id ? "" : " hidden"}>${id && x ? P().pillsHTML(kind, d, i, id, x) + cus : ""}</div>`;
    const box = $(".dk-slot__box", slot);
    if (id && x) {
      const item = document.createElement("div");
      item.className = "dk-item" + (sel && sel.key === key && sel.kind === kind && sel.i === i ? " is-selected" : "");
      item.tabIndex = 0; item.setAttribute("role", "button"); item.dataset.id = id;
      item.setAttribute("aria-label", `${x.name}, ${kind === "cards" ? "slot" : "support"} ${i + 1}. Tap to set it up`);
      const card = cardEl(kind, x, r);
      if (kind === "cards") {
        P().paintTG(card, d.trait[i], P().overallOf(d.grades[i]), false);
        if (st[i]) C.setCardNums(card, { atk: st[i].atk, hp: st[i].hp }, { animate: false });
      }
      item.appendChild(scaled(card));
      box.appendChild(item);
      const xb = document.createElement("button");
      xb.type = "button"; xb.className = "dk-x fx-press"; xb.dataset.bt = "clear"; xb.setAttribute("aria-label", `Remove ${x.name}`);
      xb.innerHTML = `<span class="dk-x__dot">${P().ICON.x}</span>`;
      slot.appendChild(xb);
      if (kind === "cards" && st[i] && (st[i].atkPct || st[i].hpPct)) {
        const f = document.createElement("button");
        f.type = "button"; f.className = "dk-buff fx-press"; f.dataset.bt = "buff";
        const line = (lab, v) => (v ? `<span class="dk-buff__l"><i>${lab}</i> ${esc("+" + Number(v.toFixed(1)) + "%")}</span>` : "");
        f.innerHTML = `<svg class="dk-buff__ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 9h-4.5v7h-5v-7H5z" fill="currentColor"/></svg>${line("ATK", st[i].atkPct)}${line("HP", st[i].hpPct)}`;
        f.setAttribute("aria-label", `${x.name}: buffs ${P().buffText(st[i])}. Tap to see where they come from`);
        slot.appendChild(f);
      }
    } else if (id) {
      box.innerHTML = `<div class="dk-item dk-item--missing"><span class="tm-missing"><span>${esc(id)}</span><small>Not in the library</small></span></div>`;
      const xb = document.createElement("button");
      xb.type = "button"; xb.className = "dk-x fx-press"; xb.dataset.bt = "clear"; xb.setAttribute("aria-label", "Remove");
      xb.innerHTML = `<span class="dk-x__dot">${P().ICON.x}</span>`;
      slot.appendChild(xb);
    } else {
      box.innerHTML = `<button type="button" class="dk-add fx-press" data-bt="add" aria-label="Add ${kind === "cards" ? "a card" : "a support card"} to slot ${i + 1}">${P().ICON.plus}<span>Add</span></button>`;
    }
    return slot;
  }
  function place(key, kind, i, id) {
    const d = T[key];
    d[kind][i] = id;
    d[RKEY[kind]][i] = P().lastRarity();   // like the Deck: a new pick starts at the rarity used last (cbi:deckRarity)
    if (kind === "cards") { d.trait[i] = null; d.grades[i] = null; d.custom[i] = null; }
  }
  function swap(key, kind, a, b) {
    const d = T[key], sw = (arr) => { [arr[a], arr[b]] = [arr[b], arr[a]]; };
    sw(d[kind]); sw(d[RKEY[kind]]);
    if (kind === "cards") { sw(d.trait); sw(d.grades); sw(d.custom); }
  }
  function clearSlot(key, kind, i) {
    const d = T[key], was = JSON.stringify(d);
    d[kind][i] = null;
    if (kind === "cards") { d.trait[i] = null; d.grades[i] = null; d.custom[i] = null; }
    paintBoard(key);
    FX.toast("Removed", { action: { label: "Undo", fn: () => { T[key] = cleanTeam(JSON.parse(was)); paintBoard(key, { flash: { kind, i } }); } } });
  }

  /* ---------- Buff list (like js/deck.js buffDialog) + the custom numbers ---------- */
  function buffDialog(key, i) {
    const r = stats(key)[i], card = r && lookup("cards", r.id);
    if (!card) return;
    const kindName = { card: "Card", support: "Support", trait: "Trait", grade: "Grade" };
    const pc = (n) => "+" + Number(n.toFixed(1)) + "%";
    const val = (x) => (x.kind === "trait"
      ? (x.mA === x.mH ? `×${x.mA} ATK·HP` : [x.mA !== 1 ? `×${x.mA} ATK` : "", x.mH !== 1 ? `×${x.mH} HP` : ""].filter(Boolean).join(" · "))
      : x.kind === "grade" && x.atk === x.hp ? `${pc(x.atk)} ATK·HP`
      : [x.atk ? `${pc(x.atk)} ATK` : "", x.hp ? `${pc(x.hp)} HP` : ""].filter(Boolean).join(" · "));
    const rows = r.from.map((x) => `<li class="dk-bf__row" data-kind="${x.kind}"><span class="dk-bf__src">${esc(x.name)}${x.n > 1 ? ` <b>×${x.n}</b>` : ""}</span><span class="dk-bf__kind">${kindName[x.kind]}</span><span class="dk-bf__val">${esc(val(x))}</span></li>`).join("");
    const stat = (label, base, v) => `<div class="dk-bf__stat"><span class="dk-bf__lab">${label}</span>
        <span class="dk-bf__nums"><span>${label === "HP" ? C.fmtHp(base) : C.fmtStat(base)}</span><span aria-hidden="true">→</span><b${v !== base ? ' class="is-up"' : ""}>${label === "HP" ? C.fmtHp(v) : C.fmtStat(v)}</b></span>
        <small>${v !== base ? "×" + Number((v / base).toFixed(2)) + " in total" : "No buff"}</small></div>`;
    const cus = T[key].custom[i];
    dialog({
      title: `${card.name} · Buffs`,
      html: `<div class="dk-bf"><div class="dk-bf__sum">${stat("ATK", r.base.atk, r.real.atk)}${stat("HP", r.base.hp, r.real.hp)}</div>
          <ul class="dk-bf__list">${rows}</ul>
          ${cus ? `<p class="tm-field__note bt-note--cus">Custom for battle: ${cus.atk != null ? "ATK " + C.fmtHp(cus.atk) + " → " + C.fmtHp(r.atk) : ""}${cus.atk != null && cus.hp != null ? " · " : ""}${cus.hp != null ? "HP " + C.fmtHp(cus.hp) + " → " + C.fmtHp(r.hp) : ""} (in place of the cards and supports · Trait and Grade still multiply).</p>` : ""}</div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(dlg) { FX.stagger($(".dk-bf__list", dlg), 40, { cls: "fx-up", max: 8, cleanup: true }); },
    });
  }

  /* ==========================================================
     Slot sheet = the Deck page's (Rarity · Grade 4 · Trait · C.deckParts) + Custom HP / ATK (battle only)
     ========================================================== */
  function sheetHTML(key, kind, i) {
    const d = T[key], isCard = kind === "cards", id = d[kind][i], r = rarityOf(d, kind, i), I = P().ICON;
    const chips = rarities().map((q) => `<button type="button" class="chip glass fx-press" data-ss-rarity="${esc(q)}" aria-pressed="${q === r}" style="--sw:${C.RARITY_SWATCH[q] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(q)}</button>`).join("");
    const btn = (act, icon, label, cls = "") => `<button type="button" class="tm-btn fx-press ${cls}" data-dlg="${act}">${icon}${label}</button>`;
    return `<div class="dk-ss" data-kind="${kind}">
        <div class="dk-ss__top"><div class="dk-ss__card" data-ss-card></div>
          <div class="dk-ss__sum"><p class="dk-ss__where">${isCard ? `Slot ${i + 1}` : `Support ${i + 1}`}</p>
            ${isCard ? `<p class="dk-ss__stat dk-ss__stat--atk"><span>ATK</span><b data-ss-atk></b></p><p class="dk-ss__stat dk-ss__stat--hp"><span>HP</span><b data-ss-hp></b></p><p class="dk-ss__buff" data-ss-buff></p>` : `<p class="dk-ss__fx" data-ss-fx></p>`}
          </div></div>
        <section class="dk-ss__sec" aria-label="Rarity"><h3 class="tm-field__label">Rarity</h3><div class="rarity-picker dk-ss__rar" role="group">${chips}</div></section>
        ${isCard ? P().tgSheetHTML() + cusHTML() : ""}
        <div class="dk-ss__acts">${isLive(kind, id) ? btn("details", I.info, "Details") : ""}${btn("replace", I.swap, isCard ? "Change card" : "Change support")}${btn("move", I.move, "Move")}${btn("remove", I.trash, "Remove", "tm-btn--danger")}</div>
      </div>`;
  }
  // battle only: type the HP / ATK yourself, any size · empty = the real number with the deck's buffs
  function cusHTML() {
    return `<section class="dk-ss__sec bt-cus" aria-label="Custom HP and ATK">
        <div class="dk-ss__h"><h3 class="tm-field__label bt-cus__t"><span>Custom HP / ATK</span> <span class="bt-new">Battle only</span></h3><button type="button" class="dk-ss__rm fx-press" data-ss-cusrm hidden>${ICON.reset}Real value</button></div>
        <div class="bt-cus__row">
          <label class="tm-field"><span class="tm-field__label">ATK</span><input class="tm-input bt-cus__in bt-cus__in--atk" id="bt-cus-atk" data-ss-cus="atk" inputmode="text" autocapitalize="characters" spellcheck="false" autocomplete="off" enterkeyhint="done"></label>
          <label class="tm-field"><span class="tm-field__label">HP</span><input class="tm-input bt-cus__in bt-cus__in--hp" id="bt-cus-hp" data-ss-cus="hp" inputmode="text" autocapitalize="characters" spellcheck="false" autocomplete="off" enterkeyhint="done"></label>
        </div><p class="bt-cus__err" data-ss-cuserr hidden>Type a number above 0, e.g. 2,661,922,940 · 500M · 1.5B · 1T.</p></section>`;
  }
  let sheetOpen = false;
  async function slotSheet(key, kind, i) {
    const d = T[key], id = d[kind][i], x = lookup(kind, id), isCard = kind === "cards";
    if (!x || sheetOpen) return;
    sheetOpen = true;
    const res = await dialog({
      title: x.name, html: sheetHTML(key, kind, i), actions: [{ label: "Done", value: "cancel", cls: "tm-btn--primary" }],
      onMount(dlg) {
        $(".tm-dlg__sheet", dlg).classList.add("dk-ss-sheet");
        const root = $(".dk-ss", dlg), art = cardEl(kind, x, rarityOf(d, kind, i));
        art._r = rarityOf(d, kind, i);
        $("[data-ss-card]", root).appendChild(art);
        if (isCard) {
          // Grade in a fight: Status Damage isn't confirmed by a clip yet · the line under the 4 grades says what Defense / Status do
          if (!statusOk()) { const nm = $$(".dk-g4__name", root)[2]; if (nm) nm.insertAdjacentHTML("beforeend", ` <span class="bt-new bt-new--warn">Unconfirmed</span>`); }
          const g4box = $(".dk-g4", root); if (g4box) g4box.insertAdjacentHTML("afterend", `<p class="tm-field__note bt-gfx" data-ss-gbt hidden></p>`);
        }
        const paint = (animate) => {
          const r = rarityOf(d, kind, i);
          root.querySelectorAll("[data-ss-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ssRarity === r)));
          if (art._r !== r) { C.setCardRarity(art, x, r, { animate }); art._r = r; }
          if (!isCard) { const fx = $("[data-ss-fx]", root); if (fx) fx.textContent = x.effect && x.effect.desc ? C.supText(x, x.effect.desc, r) : ""; return; }
          const tId = d.trait[i], g4 = d.grades[i] || [0, 0, 0, 0];
          P().paintTG(art, tId, P().overallOf(g4), animate);
          P().paintTGSheet(root, g4, tId);
          const gp = C.deckBuff.gradePct(g4), gbt = $("[data-ss-gbt]", root);
          if (gbt) {
            gbt.textContent = gp.def || gp.status ? `In battle: ${[gp.def ? `${Number((gp.def * DEF_K()).toFixed(1))}% less damage taken (Defense × ${DEF_K()})` : "", gp.status ? `+${Number(gp.status.toFixed(1))}% burn / poison / bleed damage${statusOk() ? "" : " (unconfirmed)"}` : ""].filter(Boolean).join(" · ")}.` : "";
            gbt.hidden = !gbt.textContent;
          }
          const s = stats(key)[i], cus = d.custom[i];
          if (s) {
            C.setCardNums(art, { atk: s.atk, hp: s.hp }, { animate });
            const sa = $("[data-ss-atk]", root), sh = $("[data-ss-hp]", root);
            sa.textContent = C.fmtHp(s.atk); sh.textContent = C.fmtHp(s.hp);   // short from 100M, like HP (owner 2026-11-05 · the card keeps the full ATK)
            $("[data-ss-buff]", root).innerHTML = (s.atkPct || s.hpPct ? `<span>Buffs</span> <b>${esc(P().buffText(s))}</b>` : "") + (cus ? ` <span class="bt-cus__tag">Custom</span>` : "");
            if (animate && !reduced()) { FX.flash(sa.parentNode); FX.flash(sh.parentNode); }
            [["atk", s.pre.atk], ["hp", s.pre.hp]].forEach(([k, realV]) => {
              const inp = $(`[data-ss-cus="${k}"]`, root); if (document.activeElement === inp) return;
              const v = cus && cus[k] != null ? cus[k] : null;
              inp.value = v != null ? cusText(v) : ""; inp.placeholder = C.fmtHp(realV); inp.classList.toggle("is-custom", v != null);
            });
            $("[data-ss-cusrm]", root).hidden = !cus;
          }
        };
        paint(false);
        { const on = $('.dk-tl [aria-pressed="true"]', root); if (on) on.parentNode.scrollTop = on.offsetTop - on.parentNode.firstElementChild.offsetTop; }
        requestAnimationFrame(() => root.querySelectorAll(".rarity-picker").forEach((p) => C.revealChip(p.parentNode)));
        const commit = (fn) => { fn(d); paintBoard(key, { flash: { kind, i } }); paint(true); };
        root.addEventListener("click", (e) => {
          const rb = e.target.closest("[data-ss-rarity]");
          if (rb) { const r = rb.dataset.ssRarity; P().rememberRarity(r); if (r !== rarityOf(d, kind, i)) commit((dd) => { dd[RKEY[kind]][i] = r; }); return; }   // like the Deck: the next pick starts here
          if (!isCard) return;
          const gb = e.target.closest("[data-ss-grade]"), tb = e.target.closest("[data-ss-trait]"), rm = e.target.closest("[data-ss-rm]"), al = e.target.closest("[data-ss-all]"), cr = e.target.closest("[data-ss-cusrm]");
          if (al) commit((dd) => { dd.grades[i] = [GRADE_MAX, GRADE_MAX, GRADE_MAX, GRADE_MAX]; });
          else if (gb || (rm && rm.dataset.ssRm === "grade")) commit((dd) => { dd.grades[i] = gb ? P().gradeTap(dd.grades[i], Number(gb.dataset.ssGk), Number(gb.dataset.ssGrade)) : null; });
          else if (tb || (rm && rm.dataset.ssRm === "trait")) { const t = tb ? tb.dataset.ssTrait : null; commit((dd) => { dd.trait[i] = dd.trait[i] === t ? null : t; }); }
          else if (cr) { commit((dd) => { dd.custom[i] = null; }); FX.toast("Back to the real value"); }
        });
        // grade boxes take a typed 0–10 (same as the Deck · C.deckParts.gradeInputs)
        if (isCard) P().gradeInputs(root, (k, v) => commit((dd) => { dd.grades[i] = P().gradeSet(dd.grades[i], k, v); }), () => paint(false));
        // custom HP / ATK: on change (Enter / leaving the box) · empty = real value
        root.addEventListener("change", (e) => {
          const inp = e.target.closest("[data-ss-cus]"); if (!inp) return;
          const k = inp.dataset.ssCus, txt = String(inp.value).replace(/[,\s_]/g, ""), err = $("[data-ss-cuserr]", root);
          if (txt === "") { commit((dd) => { const c = { ...(dd.custom[i] || {}) }; delete c[k]; dd.custom[i] = Object.keys(c).length ? c : null; }); err.hidden = true; return; }
          const v = parseNum(txt);
          if (!Number.isFinite(v) || v < 1 || v > 1e30) { err.hidden = false; if (!reduced()) FX.flash(inp.parentNode); return; }
          err.hidden = true;
          commit((dd) => { dd.custom[i] = { ...(dd.custom[i] || {}), [k]: v }; });
          inp.blur();
        });
        root.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.closest("[data-ss-cus]")) { e.preventDefault(); e.target.dispatchEvent(new Event("change", { bubbles: true })); } });
      },
    });
    sheetOpen = false;
    if (!res) return;
    if (res.action === "details") { const el = $(`.dk-slot[data-team="${key}"][data-kind="${kind}"][data-i="${i}"] .card`); C.openCard(id, el || null, { list: T[key][kind].filter((v) => v && isLive(kind, v)) }); }
    else if (res.action === "replace") openPicker(key, kind, i);
    else if (res.action === "move") { sel = { key, kind, i }; paintBoard(key); FX.toast("Tap the slot to move it to"); }
    else if (res.action === "remove") clearSlot(key, kind, i);
  }

  /* ---------- Picker = the Deck page's own (C.deckParts.pickDialog · owner 2026-11-04: "the same as the Deck 100%"):
     search + filters + game cards at the rarity a new pick gets · cards: the live list · support: live + pending ---------- */
  async function openPicker(key, kind, i) {
    const d = T[key], here = d[kind][i], usedAt = new Map();
    if (kind === "cards") d.cards.forEach((id, k) => { if (id) usedAt.set(id, k); });
    const all = P().orderList(kind, kind === "cards" ? state.cards : SUP);
    const id = await P().pickDialog({ kind, slot: i, all, here, usedAt, rarity: P().lastRarity() });
    if (!id || id === here) return;
    place(key, kind, i, id);
    paintBoard(key, { flash: { kind, i } });
  }

  /* ---------- Load from My Decks (copies a deck from the Deck page · the deck doesn't change) ---------- */
  async function loadDeck(key) {
    const decks = myDecks();
    const rows = decks.map((d, n) => `<button type="button" class="bt-dl__row fx-press" data-deck="${n}">
        <span class="bt-dl__imgs">${[0, 1, 2, 3].map((i) => { const x = d.cards[i] && lookup("cards", d.cards[i]); return x ? `<img src="${esc(thumbOf("cards", x))}" alt="">` : `<i></i>`; }).join("")}</span>
        <span class="bt-dl__txt"><b>${esc(d.name || "Deck")}</b><small>${d.cards.filter(Boolean).length} cards · ${(d.support || []).filter(Boolean).length} support</small></span></button>`).join("");
    const res = await dialog({
      title: "Load Deck",
      html: decks.length ? `<div class="bt-dl">${rows}</div>`
        : `<div class="empty"><p class="empty__title">No decks yet</p><p class="empty__text">Make a team on the Deck page first, then load it here.</p></div>`,
      actions: decks.length ? [{ label: "Cancel", value: "cancel" }] : [{ label: "Open Deck", value: "deck", cls: "tm-btn--primary" }, { label: "Close", value: "cancel" }],
      onMount(dlg, finish) { dlg.addEventListener("click", (e) => { const b = e.target.closest("[data-deck]"); if (b) finish({ action: "load", n: Number(b.dataset.deck) }); }); },
    });
    if (!res) return;
    if (res.action === "deck") { $('.nav__btn[data-page="deck"]').click(); return; }
    const src = decks[res.n]; if (!src) return;
    copyDeck(src, T[key]);
    paintBoard(key);
    if (!reduced()) FX.flash($(`[data-board="${key}"]`));
    FX.toast(`Loaded “${src.name || "Deck"}”`);
  }

  /* ==========================================================
     ENGINE — §14 rules: we hit first · 30 rounds · tie-break cards alive → team HP → front HP
     Start numbers = stats() (deck buffs + trait + grade, or custom). Skills: data/battle.json.
     From the owner's Guild Boss clip (12 fights · 2026-11-04): every hit rolls ±12% (clip.roll) · Grade Defense cuts damage
     taken by Defense% × 0.2 (clip.defK) · Grade Status Damage = status damage × (1 + %) (not confirmed yet) · Spirit Wave
     Master hits again for 189.34% at the clip's rarity (clip.echo) · "starts with 7.4% less damage" = ATK × 0.93.
     Supports: only what needs a hit / a turn (the buffs with no condition are already in deckbuff's numbers).
     ========================================================== */
  /* a support in data/battle.json: "echo" (one support effect, its 1st value) · or { field: … } = fields like a card's
     (merged into the supported card's skill: numbers add, the rest only when the card has none) · "$n" = the support's
     n-th value at the slot's rarity ÷ 100 ("1+$n" = 1 + that) · "todo": [the parts not simulated] (2026-11-05) */
  function supFx(d, i) {
    const id = d.support[i], s = id && lookup("support", id), spec = id && BD.support[id];
    if (!s || !spec) return null;
    const sr = rarityOf(d, "support", i), ec = clip().echo, val = (j) => Number(C.supValAt(s, j, sr)) / 100;
    const base = { name: s.name, eff: (s.effect && s.effect.name) || s.name, x: s };
    if (typeof spec === "string") {
      let v = val(0);
      if (spec === "echo" && ec && sr === ec.rarity) v = Number(ec.v) / 100;   // measured in the clip
      return { ...base, b: { [spec]: v } };
    }
    const res = (x) => (typeof x === "string" && /^(1\+)?\$\d$/.test(x) ? (x[0] === "1" ? 1 : 0) + val(+x[x.length - 1]) : Array.isArray(x) ? x.map(res) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, res(v)])) : x);
    const k = {}; for (const [n, v] of Object.entries(spec)) if (n !== "todo" && n !== "b") k[n] = res(v);
    return { ...base, b: spec.b ? res(spec.b) : {}, k, part: Array.isArray(spec.todo) && spec.todo.length ? spec.todo : null };
  }
  // the card's skill + its support's fields (numbers add · the rest only when the card has none)
  function mergeK(base, add) { const k = { ...base }; for (const [n, v] of Object.entries(add || {})) { if (typeof v === "number" && typeof k[n] === "number") k[n] += v; else if (k[n] == null) k[n] = v; } return k; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mkTeamUnits(key, side) {
    const d = T[key], st = stats(key), out = [];
    d.cards.forEach((id, i) => {
      const x = id && lookup("cards", id); if (!x || !st[i]) return;
      const b = BD.cards[id], t = d.trait[i] ? traitById(d.trait[i]) : null, tfx = t ? BD.traits[t.id] || {} : {};
      out.push(mkUnit({ id, x, side, idx: out.length, slot: i, rar: rarityOf(d, "cards", i), trait: t ? { ...t, fx: tfx } : null, grade: P().overallOf(d.grades[i]),
        sup: supFx(d, i), b, atk: st[i].atk, hp: st[i].hp,
        // Grade in battle (js/deckbuff.js gradePct): Defense% × 0.2 less damage taken · Status Damage% more status damage
        gdef: (st[i].grade.def / 100) * DEF_K(), gstatus: 1 + st[i].grade.status / 100 }));
    });
    return out;
  }
  function mkUnit(o) {
    const own = o.b ? { ...o.b } : {}, supK = (o.sup && o.sup.k) || null; delete own.todo;
    const k = mergeK(own, supK);
    return { ...o, name: o.x.name, skill: o.x.passive ? o.x.passive.name : "", sim: !!o.b, inf: !!o.inf, kBase: own, supK, k,
      part: (o.b && Array.isArray(o.b.todo) && o.b.todo.length ? o.b.todo : []).concat((o.sup && o.sup.part) || []),
      block: k.block || 0, sealT: 0, kSeal: null, wk: new Map(),
      gdef: o.gdef || 0, gstatus: o.gstatus || 1, dots: {}, cc: null,
      atk0: o.atk, atk: o.atk, max: o.hp, hp: o.hp, zone: 0, alive: true, used: {}, seen: new Set(), firstOn: new Set(), adaptMap: new Map(), hitsTaken: 0, turns: 0,
      shield: (o.trait && o.trait.fx.shield ? o.hp * o.trait.fx.shield : 0) + (k.shieldStart && isFinite(o.hp) ? o.hp * k.shieldStart : 0), marked: 0, copied: null,
      st: { dmg: 0, hits: 0, crit: 0, heal: 0, taken: 0, sup: 0, kills: 0, died: 0, procs: {} } };
  }
  function bossUnit() {
    const id = BD.boss.id || "quirk-thief-overlord", x = lookup("cards", id);
    if (!x) return null;
    return mkUnit({ id, x, side: "b", idx: 0, slot: 0, rar: "Normal", trait: null, grade: 0, sup: null, b: BD.cards[id], atk: bossAtk(STAGE), hp: Infinity, inf: true });
  }
  class Battle {
    constructor(aKey, bKey, opt = {}) {
      this.R = rng(opt.seed || 1); this.E = opt.log || null; this.boss = !!opt.boss;
      this.a = mkTeamUnits(aKey, "a");
      const bu = this.boss ? bossUnit() : null;
      this.b = this.boss ? (bu ? [bu] : []) : mkTeamUnits(bKey, "b");
      this.round = 1; this.turn = "a"; this.done = false; this.why = "";
      // Spirit Medium Granny in any support slot: that side takes no splash / card-behind / bench damage (guard persists even if the supported card falls)
      this.guard = { a: this.a.some((u) => u.supK && u.supK.guard), b: this.b.some((u) => u.supK && u.supK.guard) };
      this.wkUsed = { a: 0, b: 0 }; this.wkM = { a: 1, b: 1 };   // "starts with X% less damage": used once per side · the ATK × on each side
    }
    ev(t, u, v, o) { if (this.E) this.E({ t, u, v, o }); }
    // a support works: counted every time · its banner (picture + name + skill) only the 1st time for this card (owner 2026-11-05)
    supOn(u) { u.st.sup++; if (!u.used.supShown) { u.used.supShown = 1; this.ev("sup", u); } }
    front(side) { return this[side].find((u) => u.alive) || null; }
    alive(side) { return this[side].filter((u) => u.alive).length; }
    proc(u, name, ok, p) { const r = u.st.procs[name] || (u.st.procs[name] = { n: 0, exp: 0 }); if (ok) r.n++; r.exp += p; }
    start() {
      // a skill that says it works for the WHOLE team (weakenAll · card or support): from any slot, at the start
      for (const side of ["a", "b"]) for (const u of this[side]) if (u.k.weakenAll) this.weakenTeam(side === "a" ? "b" : "a", u.k.weakenAll);
      // the ATK each card starts the fight with (the fight card's "DMG +x%" chip counts from it · display only)
      for (const side of ["a", "b"]) for (const u of this[side]) u.atkS = u.atk;
      for (const side of ["a", "b"]) { const f = this.front(side); if (f) this.onEnter(f); }
      this.ev("nums", this.front("a")); this.ev("nums", this.front("b"));
    }
    // a card comes in: "when it comes in" effects (stun the card in front · hit it for x% of its max HP)
    onEnter(u) {
      const d = this.front(u.side === "a" ? "b" : "a"); if (!d || !u.alive) return;
      // "every enemy card starts with X% less damage" (owner 2026-11-05): only when the card comes in, once per fight per
      // side (the 1st one in counts · a later card's weaken does nothing) · every enemy card, for the whole fight, can't be removed
      if (u.k.weaken && !this.wkUsed[u.side]) { this.wkUsed[u.side] = 1; this.weakenTeam(d.side, u.k.weaken); }
      const es = typeof u.k.entryStun === "object" ? u.k.entryStun : u.k.entryStun ? { p: 1, turns: u.k.entryStun } : null;
      if (es && !this.immune(d, "cc")) { const ok = es.p >= 1 || this.R() < es.p; if (es.p < 1) this.proc(u, "Bind", ok, es.p); if (ok) { d.cc = { kind: "Stun", turns: es.turns, lose: 1 }; this.ev("shout", d, "STUN!", { k: "debuff" }); } }
      if (u.k.entryHit && !d.inf) { const v = Math.max(1, Math.round(d.max * u.k.entryHit)); u.st.dmg += v; this.take(d, v, u); this.ev("dmg", d, v, { pct: true }); }
    }
    enter(side) { const f = this.front(side); if (f) { this.ev("enter", f); this.onEnter(f); } }
    // the whole team's ATK × w (the clip: × 0.93) · the cards on the bench and any card that joins later too (wkM)
    weakenTeam(side, w) {
      this.wkM[side] *= w;
      for (const f of this[side]) { f.atk *= w; f.atk0 *= w; if (f.atkS) f.atkS *= w; f.weakM = (f.weakM || 1) * w; }
      const fr = this.front(side); if (fr) this.ev("shout", fr, "-" + ((1 - w) * 100).toFixed(1) + "% DMG", { k: "debuff" });
    }
    // can't be stunned / frozen / paralyzed (noCC) · can't be confused, sealed or weakened either (noDebuff) · statuses (noDot: true | ["burn"])
    immune(u, what, kind) {
      if (what === "cc") return !!(u.k.noCC || u.k.noDebuff);
      if (what === "debuff") return !!u.k.noDebuff;
      if (what === "dot") { const n = u.k.noDot; return n === true || n === 1 || (Array.isArray(n) && n.includes(kind)); }
      return false;
    }
    heal(u, v, src) { if (u.inf || !u.alive || v <= 0) return 0; const h = Math.min(Math.round(v), u.max - u.hp); if (h <= 0) return 0; u.hp += h; u.st.heal += h; this.ev("heal", u, h, { src }); return h; }
    // damage that isn't an attack (bench splash, echo, status): shield first (unless the attacker ignores it)
    take(u, v, a) { u.st.taken += v; if (u.inf) return; let left = v; if (u.shield > 0 && !(a && a.k.ignore)) { const s = Math.min(u.shield, left); u.shield -= s; left -= s; } u.hp -= left; }
    startTurn(u) {
      u.turns++;
      if (u.sealT > 0 && --u.sealT <= 0 && u.kSeal) { u.k = u.kSeal; u.kSeal = null; }   // the seal wears off: the skill is back
      if (u.k.regen) this.heal(u, u.max * u.k.regen, "skill");
      if (u.k.regenChance) { const rc = u.k.regenChance, ok = this.R() < rc.p; this.proc(u, "Heal", ok, rc.p); if (ok) this.heal(u, u.max * rc.v, "sup"); }
      if (u.k.teamRegen) for (const x of this[u.side]) if (x.alive && x !== u) this.heal(x, x.max * u.k.teamRegen, "sup");
      if (u.k.lowHeal && !u.used.lowHeal && !u.inf && u.hp / u.max < u.k.lowHeal.under) { u.used.lowHeal = 1; this.heal(u, u.max * u.k.lowHeal.v, "skill"); }
      if (u.k.perTurn && u.turns <= u.k.perTurn.n) { const g = u.atk0 * u.k.perTurn.v; u.atk += g; this.ev("buff", u, g); }
      if (u.sup && u.sup.b.teamHeal) {
        let any = false;
        for (const x of this[u.side]) if (x.alive && !x.inf && x.hp < x.max) { const h = Math.min(Math.round(x.max * u.sup.b.teamHeal), x.max - x.hp); x.hp += h; u.st.heal += h; if (x === u) this.ev("heal", u, h, { src: "sup" }); any = true; }
        if (any) this.supOn(u);
      }
      // statuses tick at the start of the card's turn (burn / poison / bleed: % of its max HP per stack × the giver's
      // Grade Status Damage · an infinite-HP boss: not known yet, nothing)
      for (const [kind, s] of Object.entries(u.dots)) {
        if (!u.inf) { const v = Math.max(1, Math.round(u.max * s.pct * s.stacks * s.mult)); u.hp -= v; u.st.taken += v; if (s.src) s.src.st.dmg += v; this.ev("dmg", u, v, { status: kind }); }
        if (--s.left <= 0) delete u.dots[kind];
      }
    }
    // a status from a skill (field dot: { kind, add, pct, max, turns }) · stacks up to max, every new stack resets the turns
    addDot(a, d, dot) {
      if (Array.isArray(dot)) { for (const x of dot) this.addDot(a, d, x); return; }
      if (dot.all && !dot._one) { for (const x of this[d.side]) if (x.alive && !x.inf) this.addDot(a, x, { ...dot, _one: 1 }); return; }
      if (this.immune(d, "dot", dot.kind)) return;
      const s = d.dots[dot.kind] || (d.dots[dot.kind] = { stacks: 0, pct: dot.pct, left: 0, mult: 1, src: a, name: dot.name || dot.kind });
      s.stacks = Math.min(dot.max, s.stacks + (dot.add || 1)); s.left = dot.turns; s.mult = a.gstatus; s.src = a;
      this.ev("shout", d, dot.kind.toUpperCase() + " x" + s.stacks, { k: "debuff", y: "70%" });
      this.ev("dot", d, dot.kind, { stacks: s.stacks });   // display only: the status lands (its burst + sound)
    }
    // Spirit Wave Master (support · echo): the supported card's every 2nd attack hits again for v × the 1st hit
    echo(a, d, first) {
      if (!(first > 0) || !d.alive) return;
      const v = Math.max(1, Math.round(first * a.sup.b.echo));
      a.st.dmg += v; this.supOn(a); this.take(d, v, a);
      this.ev("dmg", d, v, { extra: true, sup: true });   // shown added to the hit's number (mergeEvs)
    }
    hit(a, d, m0, extra, o = {}) {
      const R = this.R;
      if (!a.k.ignore && !a.k.sure) {
        const ds = [];
        if (d.k.dodge) ds.push([(d.copied || d.skill) + " dodge", d.k.dodge, "k"]);
        if (d.trait && d.trait.fx.dodge) ds.push([d.trait.name + " dodge", d.trait.fx.dodge, "t"]);
        if (d.sup && d.sup.b.dodge) ds.push([d.sup.eff, d.sup.b.dodge, "s"]);
        for (const [nm, p, src] of ds) { const ok = R() < p; this.proc(d, nm, ok, p); if (ok) { if (src === "s") this.supOn(d); this.ev("dodge", d); this.ev("shout", d, "DODGE!", { k: "dodge" }); return 0; } }
      }
      // blocks the first N hits completely (not through "ignores shields, dodges and barriers")
      if (d.block > 0 && !a.k.ignore) { d.block--; this.ev("dodge", d); this.ev("shout", d, "BLOCKED!", { k: "dodge" }); this.ev("nums", d); return 0; }
      let m = m0, crit = false, heavy = false;
      if (!extra) a.atks = (a.atks || 0) + 1;
      if (a.k.everyN && !extra && a.atks % a.k.everyN.n === 0) { m *= a.k.everyN.m; heavy = true; }
      if (a.k.lowHp && !a.inf && a.hp / a.max < a.k.lowHp.under) m *= 1 + a.k.lowHp.dmg;
      if (a.k.firstFight && !extra && !a.used.firstFight) { a.used.firstFight = 1; m *= a.k.firstFight; heavy = true; }
      if (a.k.dmgFrom && a.atks >= a.k.dmgFrom.n) m *= 1 + a.k.dmgFrom.v;
      if (d.cc && d.cc.kind === "Freeze") { m *= 1.25; if (a.k.vsFrozen) m *= a.k.vsFrozen; }
      const bf = a.k.bf;
      if (bf) {
        const p = a.zone >= bf.max ? 1 : Math.min(1, bf.p + bf.per * a.zone), ok = R() < p;
        this.proc(a, a.copied || a.skill, ok, p);
        if (ok) { m *= bf.m; crit = heavy = true; this.ev("shout", a, (a.copied || a.skill).toUpperCase() + "!", { k: "skill" });
          if (a.zone < bf.max) { a.zone++; this.ev("zone", a, a.zone); if (a.zone === bf.max) this.ev("shout", a, "ZONE!", { k: "zone", y: "30%" }); } }
      }
      for (const [c, nm] of [[a.k.crit, (a.copied || a.skill) + " crit"], [a.trait && a.trait.fx.crit, a.trait && a.trait.name + " crit"]]) {
        if (!c) continue;
        const ok = R() < c[0]; this.proc(a, nm, ok, c[0]);
        if (ok) { m *= c[1]; crit = true; this.ev("shout", a, "CRIT!", { k: "crit", y: "30%" }); break; }
      }
      if (a.k.first && !a.firstOn.has(d)) { a.firstOn.add(d); m *= a.k.first; heavy = true; this.ev("shout", a, a.skill.toUpperCase() + "!", { k: "skill" }); }
      if (a.trait && a.trait.fx.firstAll && !a.used.firstAll) { a.used.firstAll = 1; m *= 1 + a.trait.fx.firstAll; }
      if (a.k.dmg) m *= 1 + a.k.dmg;
      if (a.k.vs && inGroup(d.id, a.k.vs.group)) m *= a.k.vs.m;
      if (d.k.weakTo && inGroup(a.id, d.k.weakTo.group)) m *= d.k.weakTo.m;
      // every hit rolls ±12% around ATK (the clip: 0.88–1.11, mean 1.00)
      let dmg = (a.atk + (a.k.addFoeAtk && isFinite(d.atk) ? d.atk * a.k.addFoeAtk : 0)) * m * (1 + d.marked) * (1 - ROLL() + R() * 2 * ROLL());
      // damage cut: skill + trait + Grade Defense (Defense% × 0.2) · they add up
      let dr = (d.k.dr || 0) + ((d.trait && d.trait.fx.dr) || 0) + d.gdef;
      if (d.k.early && d.hitsTaken < d.k.early.n) dr += d.k.early.dr;
      if (d.k.adapt) { const ad = typeof d.k.adapt === "object" ? d.k.adapt : { v: d.k.adapt, n: 3 }, seen = d.adaptMap.get(a) || 0; dr += Math.min(ad.n, seen) * ad.v; d.adaptMap.set(a, seen + 1); }
      dmg = Math.max(1, Math.round(dmg * Math.max(0, 1 - dr)));
      if (a.sup && a.sup.b.mark && !d.marked) { d.marked = a.sup.b.mark; this.supOn(a); }
      a.st.dmg += dmg; a.st.hits++; if (crit) a.st.crit++;
      const pierce = !!(a.k.ignore && d.shield > 0);   // through a shield = the blue number
      d.hitsTaken++; this.take(d, dmg, a);
      this.ev("dmg", d, dmg, { crit, heavy: heavy || (!d.inf && dmg > d.max * .25), extra, pierce });
      // x% of the enemy's max HP on every hit (not bosses: their HP has no end) = the white number
      if (a.k.maxHp && !d.inf && d.hp > 0) { const v = Math.max(1, Math.round(d.max * a.k.maxHp)); a.st.dmg += v; this.take(d, v, a); this.ev("dmg", d, v, { pct: true }); }
      // on-hit chances: weaken (ATK down for the fight, stacks up to n) · mark · seal the skill · confuse
      const wh = a.k.weakenHit;
      if (wh && d.hp > 0 && !this.immune(d, "debuff") && (d.wk.get(a) || 0) < (wh.n || 1)) { const ok = (wh.p == null || wh.p >= 1) ? true : this.R() < wh.p; if (wh.p < 1) this.proc(a, "Weaken", ok, wh.p);
        if (ok) { d.wk.set(a, (d.wk.get(a) || 0) + 1); d.atk *= 1 - wh.v; d.weakM = (d.weakM || 1) * (1 - wh.v); this.ev("shout", d, "WEAKENED!", { k: "debuff" }); } }
      if (a.k.markHit && d.hp > 0 && !d.marked) { const ok = this.R() < a.k.markHit.p; this.proc(a, "Mark", ok, a.k.markHit.p); if (ok) { d.marked = a.k.markHit.v; this.ev("shout", d, "MARKED!", { k: "debuff" }); } }
      const sl = a.k.sealFirst && !a.firstOn.has("seal:" + d.idx + d.side) ? { p: 1, turns: a.k.sealFirst, first: 1 } : a.k.seal;
      if (sl && d.hp > 0 && !d.inf && !d.kSeal && !this.immune(d, "debuff")) { if (sl.first) a.firstOn.add("seal:" + d.idx + d.side); const ok = sl.p >= 1 || this.R() < sl.p; if (sl.p < 1) this.proc(a, "Seal", ok, sl.p);
        if (ok) { d.kSeal = d.k; d.k = mergeK({}, d.supK); d.sealT = sl.turns + 1; this.ev("shout", d, "SEALED!", { k: "debuff" }); } }
      if (a.k.confuse && d.hp > 0 && !d.cc && !this.immune(d, "debuff")) { const ok = this.R() < a.k.confuse.p; this.proc(a, "Confuse", ok, a.k.confuse.p); if (ok) { d.cc = { kind: "Confuse", turns: 1, lose: 1, self: a.k.confuse.self || .5 }; this.ev("shout", d, "CONFUSED!", { k: "debuff" }); } }
      // Hakai: a chance to finish an enemy under X% HP (not a boss)
      if (a.k.execute && !d.inf && d.hp > 0 && d.hp / d.max < a.k.execute.under) { const ok = R() < a.k.execute.p; this.proc(a, (a.copied || a.skill) + " finish", ok, a.k.execute.p); if (ok) { d.hp = 0; this.ev("shout", a, (a.copied || a.skill).toUpperCase() + "!", { k: "skill" }); } }
      // stun / paralyze (can't be stunned = noCC)
      if (a.k.stun && d.hp > 0 && !this.immune(d, "cc")) { const ok = R() < a.k.stun.p; this.proc(a, a.k.stun.kind, ok, a.k.stun.p); if (ok) { d.cc = { ...a.k.stun }; this.ev("shout", d, a.k.stun.kind.toUpperCase() + "!", { k: "debuff", y: "70%" }); } }
      // the defender reacts before a copy (the clip: the boss copies after the 1st hit, so it grows 29 times)
      if (d.k.onHitAtk) { const g = d.atk0 * d.k.onHitAtk; d.atk += g; this.ev("buff", d, g); }
      if (d.sup && d.sup.b.onHitAtk) { const g = d.atk0 * d.sup.b.onHitAtk; d.atk += g; this.supOn(d); if (!d.k.onHitAtk) this.ev("buff", d, g); }
      if (d.sup && d.sup.b.hitHeal && !d.inf && d.hp > 0) { this.supOn(d); this.heal(d, dmg * d.sup.b.hitHeal, "sup"); }
      if (a.k.dot && !d.inf) this.addDot(a, d, a.k.dot);
      if (d.k.thorns && !a.inf && d !== a) this.addDot(d, a, d.k.thorns);   // whoever hits it gets the status
      if (d.k.copy && a.sim && !d.seen.has(a.id)) {
        d.seen.add(a.id); const keep = { copy: 1, killGain: d.kBase.killGain, weaken: d.kBase.weaken };
        d.k = mergeK({ ...a.kBase, ...keep }, d.supK); d.copied = a.skill; if (d.kSeal) { d.kSeal = d.k; d.k = mergeK({}, d.supK); } d.zone = 0; this.ev("shout", d, "COPIED " + a.skill.toUpperCase() + "!", { k: "copy", y: "24%" }); this.ev("copy", d);
      }
      if (d.k.reflect && !a.inf) { const r = Math.round(dmg * d.k.reflect); a.hp -= r; a.st.taken += r; this.ev("dmg", a, r, { reflect: 1 }); }
      const ls = (a.k.lifesteal || 0) + ((a.trait && a.trait.fx.lifesteal) || 0) + ((a.sup && a.sup.b.lifesteal) || 0);
      if (ls && !a.inf && a.hp > 0) { if (a.sup && a.sup.b.lifesteal) this.supOn(a); this.heal(a, dmg * ls, "ls"); }
      const spl = (a.k.splash || 0) + (a.k.splashFirst && !a.used.splashFirst && !extra ? (a.used.splashFirst = 1, a.k.splashFirst) : 0);
      if (spl && !this.guard[d.side]) { const base = dmg / m; for (const x of this[d.side]) if (x.alive && x !== d && !x.inf) { const s = Math.round(base * spl); this.take(x, s, a); a.st.dmg += s; this.ev("splash", x, s); this.checkDeath(x, a, true); } this.ev("bench", d); }
      // counter-attack when hit (a counter never starts another counter)
      if (d.k.counter && !o.counter && d.hp > 0 && a.hp > 0) { const cp = typeof d.k.counter === "object" ? d.k.counter.p : d.k.counter, cm = typeof d.k.counter === "object" ? d.k.counter.m || 1 : 1;
        const ok = R() < cp; this.proc(d, (d.copied || d.skill) + " counter", ok, cp); if (ok) { this.ev("shout", d, "COUNTER!", { k: "skill" }); this.ev("atk", d); this.hit(d, a, cm, true, { counter: 1 }); } }
      if (d.k.onHitHp && !d.inf) { const g = Math.round(d.max * d.k.onHitHp); d.max += g; d.hp += g; }
      // it loses x% of its max HP every attack
      if (a.k.selfDmg && !extra && !a.inf) { const v = Math.max(1, Math.round(a.max * a.k.selfDmg)); a.hp -= v; a.st.taken += v; this.ev("dmg", a, v, {}); }
      return dmg;
    }
    // the card behind the one fighting (every 2nd attack: % of a normal hit, no crits or bonuses)
    behind(a, d) {
      if (this.guard[d.side]) return;
      const t = this[d.side], i = t.indexOf(d), x = t.slice(i + 1).find((u) => u.alive && !u.inf); if (!x) return;
      const v = Math.max(1, Math.round(a.atk * a.k.behind.m)); a.st.dmg += v; this.take(x, v, a);
      this.ev("shout", a, "EXTRA HIT", { k: "extra", y: "26%" }); this.ev("splash", x, v); this.ev("bench", d); this.checkDeath(x, a, true);
    }
    checkDeath(u, killer, bench) {
      if (u.inf || !u.alive || u.hp > 0) return false;
      if (u.k.survive && !u.used.survive) { u.used.survive = 1; u.hp = 1; this.ev("shout", u, "SURVIVED!", { k: "skill" }); this.ev("nums", u); return false; }
      if (u.sup && u.sup.b.lucky && !u.used.lucky) { u.used.lucky = 1; const ok = this.R() < u.sup.b.lucky; this.proc(u, u.sup.eff, ok, u.sup.b.lucky); if (ok) { u.hp = 1; this.supOn(u); this.ev("shout", u, "HOLD ON!", { k: "heal" }); this.ev("nums", u); return false; } }
      const rv = u.k.revive || (u.trait && u.trait.fx.revive);
      if (rv && !u.used.revive) { u.used.revive = 1; u.hp = Math.round(u.max * rv); this.ev("shout", u, "REVIVED!", { k: "heal" }); this.ev("heal", u, u.hp, { src: "revive" }); return false; }
      const rc = u.k.reviveChance;   // a support: x% chance to come back with y% HP (once)
      if (rc && !u.used.reviveChance) { u.used.reviveChance = 1; const ok = this.R() < rc.p; this.proc(u, "Revive", ok, rc.p); if (ok) { u.hp = Math.round(u.max * rc.v); u.st.sup++; this.ev("shout", u, "REVIVED!", { k: "heal" }); this.ev("heal", u, u.hp, { src: "revive" }); return false; } }
      u.alive = false; u.hp = 0; u.st.died = 1;
      // knocked out: it explodes on the enemy in front
      if (u.k.explode && isFinite(u.max)) { const f = this.front(u.side === "a" ? "b" : "a"); if (f && !f.inf) { const v = Math.max(1, Math.round(u.max * u.k.explode)); this.take(f, v, u); u.st.dmg += v; this.ev("shout", u, "BOOM!", { k: "crit" }); this.ev("dmg", f, v, { pct: true }); this.checkDeath(f, null); } }
      if (killer && killer.alive) {
        killer.st.kills++;
        if (killer.k.killHeal) this.heal(killer, killer.max * killer.k.killHeal, "skill");
        if (killer.k.killGain) { const g = u.atk0 * killer.k.killGain, h = isFinite(u.max) ? Math.round(u.max * killer.k.killGain) : 0;
          killer.atk += g; killer.atk0 += g; if (!killer.inf) { killer.max += h; killer.hp += h; } this.ev("buff", killer, g); this.ev("shout", killer, "+" + Math.round(killer.k.killGain * 100) + "% STOLEN", { k: "skill", y: "86%" }); }
        // Arise: once, the defeated enemy comes back on the killer's team as its shadow (X% of its damage and HP, no skill)
        if (killer.k.arise && !killer.used.arise && !u.shadow) {
          killer.used.arise = 1;
          const t = this[killer.side], sh = mkUnit({ id: u.id, x: u.x, side: killer.side, idx: t.length, slot: -1, rar: u.rar, trait: null, grade: 0, sup: null, b: null, atk: u.atk0 * killer.k.arise, hp: u.max * killer.k.arise });
          const wm = this.wkM[killer.side]; if (wm < 1) { sh.atk *= wm; sh.atk0 *= wm; sh.weakM = wm; }
          sh.shadow = true; sh.name = u.name + " (shadow)"; sh.atkS = sh.atk; t.push(sh);
          this.ev("shout", killer, "ARISE!", { k: "skill", y: "40%" }); this.ev("bench", killer);
        }
      }
      this.ev(bench ? "benchdie" : "die", u); return true;
    }
    nextTurn(side, foe) {
      if (!this.front("a") || !this.front("b")) return this.finish();
      if (side === "b") { this.round++; if (this.round > 30) { this.round = 30; return this.finish(); } this.ev("round", null, this.round); }
      this.turn = foe; return false;
    }
    step() {
      if (this.done) return true;
      const side = this.turn, foe = side === "a" ? "b" : "a", a = this.front(side), d = this.front(foe);
      if (a && d) {
        this.startTurn(a);
        // a status can finish the attacker before it swings: the next card comes in, the turn passes
        if (this.checkDeath(a, (Object.values(a.dots)[0] || {}).src || d)) { this.enter(side); return this.nextTurn(side, foe); }
        // stunned / paralyzed: loses this turn (paralyze: a chance each turn)
        if (a.cc) {
          const c = a.cc, lose = c.lose >= 1 || this.R() < c.lose;
          if (--c.turns <= 0) a.cc = null;
          if (c.kind === "Confuse") { const v = Math.max(1, Math.round(a.atk * (c.self || .5))); this.take(a, v, null); this.ev("shout", a, "CONFUSED!", { k: "debuff" }); this.ev("dmg", a, v, {});
            if (this.checkDeath(a, d)) this.enter(side); return this.nextTurn(side, foe); }
          if (lose) { this.ev("shout", a, ({ Stun: "STUNNED", Freeze: "FROZEN", Paralyze: "PARALYZED" }[c.kind] || c.kind.toUpperCase()) + "!", { k: "debuff" }); return this.nextTurn(side, foe); }
        }
        this.ev("atk", a);
        const first = this.hit(a, d, 1, false);
        if (a.sup && a.sup.b.echo && a.turns % 2 === 0) this.echo(a, d, first);
        if (a.k.behind && a.turns % a.k.behind.every === 0 && a.alive) this.behind(a, d);
        let dDead = this.checkDeath(d, a), aDead = this.checkDeath(a, d);
        const dbl = a.k.double;
        if (dbl && a.alive && d.alive && a.hp > 0) { const ok = this.R() < dbl.p; this.proc(a, (a.copied || a.skill) + " extra hit", ok, dbl.p);
          if (ok) { this.ev("shout", a, "EXTRA HIT", { k: "extra", y: "26%" }); this.ev("atk", a); this.hit(a, d, dbl.m, true); dDead = this.checkDeath(d, a) || dDead; aDead = this.checkDeath(a, d) || aDead; } }
        if (dDead) this.enter(foe);
        if (aDead) this.enter(side);
      }
      return this.nextTurn(side, foe);
    }
    // stop = the End button (owner 2026-11-05): the fight ends where it is · Guild Boss keeps the damage so far · Arena = a loss
    // (owner's pick 2026-11-05: you gave up)
    finish(stop = false) {
      this.done = true; this.stopped = !!stop;
      // only Guild Boss shows rounds · Custom and later modes don't show the round count (owner 2026-11-05)
      const A = this.alive("a"), B = this.alive("b"), at = stop ? "Ended in round " + this.round : this.boss ? "30 rounds" : "No team wiped";
      if (this.boss) { this.win = A ? "end" : "lose"; this.why = A ? (stop ? at : "30 rounds done") : "Your team was wiped in round " + this.round; return true; }
      if (stop) { this.win = "lose"; this.why = "You ended the battle"; return true; }
      if (!A && !B) { this.win = "draw"; this.why = "Both teams fell"; return true; }
      if (!B) { this.win = "win"; this.why = "Enemy team wiped"; return true; }
      if (!A) { this.win = "lose"; this.why = "Your team was wiped"; return true; }
      const thp = (s) => { const t = this[s]; return t.reduce((x, u) => x + Math.max(0, u.hp), 0) / t.reduce((x, u) => x + u.max, 0); };
      const fhp = (s) => { const f = this.front(s); return f ? f.hp / f.max : 0; };
      if (A !== B) { this.win = A > B ? "win" : "lose"; this.why = at + " · cards alive " + A + " vs " + B; }
      else if (Math.abs(thp("a") - thp("b")) > 1e-9) { this.win = thp("a") > thp("b") ? "win" : "lose"; this.why = at + " · same cards alive · team HP " + pct(thp("a")) + " vs " + pct(thp("b")); }
      else if (Math.abs(fhp("a") - fhp("b")) > 1e-9) { this.win = fhp("a") > fhp("b") ? "win" : "lose"; this.why = at + " · front card HP " + pct(fhp("a")) + " vs " + pct(fhp("b")); }
      else { this.win = "draw"; this.why = at + " · all equal"; }
      return true;
    }
    run() { this.start(); while (!this.step()); return this; }
  }

  /* ==========================================================
     SOUND (Web Audio, made in code · no game sounds · starts after FIGHT · mute kept in cbi:battleMute)
     owner 2026-11-05: "action" sounds, one per kind of damage (normal · crit · through a shield · splash · poison · burn · % HP
     · support · debuff) · 2 channels: effects 100% · music 30% that dips while an effect plays (for the scene music to come;
     then 2 buttons: music / effects)
     ========================================================== */
  const SND = {
    ctx: null, muted: store.get(MUTE_KEY) === "1", last: 0, fx: null, music: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
      try {
        const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)(), comp = c.createDynamicsCompressor();
        comp.connect(c.destination); this.fx = c.createGain(); this.fx.gain.value = 1; this.fx.connect(comp);
        this.music = c.createGain(); this.music.gain.value = MUSIC_VOL; this.music.connect(comp);
      } catch (e) { this.ctx = null; }
    },
    duck() { const m = this.music; if (!m) return; const t = this.ctx.currentTime; m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(m.gain.value, t); m.gain.linearRampToValueAtTime(MUSIC_VOL / 3, t + .04); m.gain.linearRampToValueAtTime(MUSIC_VOL, t + .5); },
    tone(f1, f2, dur, type, vol, delay = 0) {
      const c = this.ctx; if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.fx || c.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, freq, type = "lowpass", delay = 0, freq2 = 0) {
      const c = this.ctx; if (!c) return; const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay; s.buffer = buf; f.type = type; g.gain.value = vol;
      f.frequency.setValueAtTime(freq, t); if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);   // a sweep (whoosh / ignition)
      s.connect(f).connect(g).connect(this.fx || c.destination); s.start(c.currentTime + delay);
    },
    play(kind) {
      if (this.muted || !this.ctx) return; const now = performance.now(); if (now - this.last < 45 && kind !== "win" && kind !== "aoe" && !kind.endsWith("On")) return; this.last = now;
      this.duck();
      if (kind === "hit") { this.noise(.09, .35, 1800); this.tone(150, 50, .14, "sine", .5); }
      else if (kind === "crit") { this.noise(.16, .5, 4000); this.tone(220, 40, .25, "sawtooth", .25); this.tone(880, 1320, .12, "square", .08, .02); }
      else if (kind === "pierce") { this.tone(130, 45, .14, "sine", .45); this.noise(.22, .4, 6000, "highpass", .02); this.tone(2400, 900, .18, "sawtooth", .12, .02); }
      else if (kind === "aoe") { [0, .07].forEach((t, i) => this.tone(220 - i * 40, 60, .14, "sine", .32, t)); this.noise(.26, .22, 900, "bandpass"); }
      else if (kind === "poison") { [0, .09, .18].forEach((t, i) => this.tone(520 - i * 90, 300 - i * 60, .1, "sine", .22, t)); this.tone(110, 70, .2, "sine", .25); }
      else if (kind === "burn") { this.noise(.35, .4, 1400, "bandpass"); [0, .06, .13, .21].forEach((t) => this.noise(.03, .3, 3500, "highpass", t)); }   // flame + crackles
      else if (kind === "bleed") { [0, .12].forEach((t, i) => this.tone(900 - i * 150, 480, .12, "sine", .2, t)); }
      else if (kind === "poisonOn") { [0, .08, .16, .24].forEach((t, i) => this.tone(320 - i * 40, 160, .09, "sine", .26, t)); this.noise(.35, .1, 5000, "highpass"); }   // glug + hiss
      else if (kind === "burnOn") { this.noise(.45, .55, 300, "lowpass", 0, 4500); this.tone(90, 45, .3, "sine", .4); }   // ignition
      else if (kind === "bleedOn") { this.noise(.12, .4, 3000, "highpass"); this.tone(1400, 300, .18, "sawtooth", .12); }
      else if (kind === "pct") { this.tone(880, 220, .3, "sawtooth", .16); this.tone(110, 45, .2, "sine", .4); }
      else if (kind === "sup") { this.noise(.25, .22, 1600, "bandpass"); this.tone(988, 1318, .35, "sine", .22, .05); this.tone(130, 45, .15, "sine", .4); }
      else if (kind === "debuff") { [659, 523, 392].forEach((f, i) => this.tone(f, f * .98, .14, "triangle", .14, i * .06)); }
      else if (kind === "heal") { this.tone(660, 700, .12, "sine", .18); this.tone(990, 1040, .16, "sine", .14, .07); }
      else if (kind === "buff") { this.tone(400, 900, .16, "triangle", .14); }
      else if (kind === "shout") { this.tone(520, 780, .1, "triangle", .14); }
      else if (kind === "dodge") { this.noise(.26, .55, 500, "bandpass", 0, 3800); this.tone(1800, 2700, .09, "sine", .07, .05); }   // whoosh (owner: its own sound)
      else if (kind === "die") { this.tone(320, 50, .5, "sawtooth", .2); }
      else if (kind === "enter") { this.noise(.18, .12, 900); this.tone(200, 320, .16, "triangle", .1); }
      else if (kind === "win") { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, .22, "triangle", .2, i * .11)); }
      else if (kind === "lose") { [392, 330, 262].forEach((f, i) => this.tone(f, f * .98, .3, "sine", .2, i * .16)); }
    },
  };

  /* ==========================================================
     FIGHT = the Battle Stage (owner 2026-11-05 · "Battle UI Lab" look 1 Neon Arcade · one stage for every mode, only the top
     line changes: STAGE / ARENA / later FLOOR) · full screen over the site · phone portrait, phone landscape and desktop
     placements in css/battle.css · the fight card is drawn here (not the site card): no rarity pill (the frame = the rarity),
     upright type only, nothing on top of anything: name + HP · buffs top right (one chip each, the number changes in place,
     4 shown, the rest "+n") · Trait + Grade (C.deckParts) · ability name · text (smaller when long) · HP bar · swords + ATK
     where the site card has them · debuffs above the card (icon + name + stacks + turns, own colour) · damage numbers in the
     picture: normal red · crit gold · through a shield blue · splash orange (on the front card once per bench card hit, and
     on that card's picture in the team box) · poison purple · burn orange-red · % HP white · heal green · support = banner
     ========================================================== */
  const F = { b: null, token: 0, k: 1, mode: "boss", seed: (Date.now() % 2147483647) || 7, paused: false, started: false, shown: { a: null, b: null } };
  const fightRoot = () => $("#bt-fight");
  const fmtD = fmtS;   // damage numbers: short, the owner's pick (2.48B)
  const pctS = (x) => String(Math.round(x * 1000) / 10) + "%";
  const DB_ICON = {
    poison: '<path fill="currentColor" d="M12 2s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Zm-2 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>',
    burn: '<path fill="currentColor" d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9Z"/>',
    bleed: '<path fill="currentColor" d="M12 3s-5 6-5 10a5 5 0 0 0 10 0c0-4-5-10-5-10Z"/>',
    stun: '<path fill="currentColor" d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.4z"/>',
    paralyze: '<path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    weak: '<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M12 4v15M6 13l6 6 6-6"/>',
    freeze: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    seal: '<path fill="currentColor" d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1Zm3 0h6V8a3 3 0 1 0-6 0v2Z"/>',
    confuse: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M12 12c0-3 4-3 4 0s-5 5-8 2-1-9 4-9 8 5 6 10"/>',
    mark: '<path fill="none" stroke="currentColor" stroke-width="2.6" d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  };
  const dbIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${DB_ICON[k] || DB_ICON.poison}</svg>`;
  // the card's own text from the site card (same words, the numbers that change with the rarity in colour)
  function cardText(u) {
    let el = null; try { el = C.redrawEl ? C.redrawEl(u.x, u.rar || "Normal") : null; } catch (e) { el = null; }
    const ab = u.x.passive && u.x.passive.name ? u.x.passive : u.x.skill || {}, abn = el && $(".rd__abn", el), abd = el && $(".rd__abd", el);
    return { sk: (abn && abn.textContent) || ab.name || "", ds: abd ? abd.innerHTML : esc(ab.desc || "") };
  }
  function fightCard(u) {
    const t = cardText(u), lr = String(u.rar || "Normal").toLowerCase();
    const card = document.createElement("article");
    card.className = "btc"; card.setAttribute("aria-hidden", "true"); card.dataset.r = u.rar || "Normal";
    card.style.setProperty("--frame", `var(--gc-rar-${lr}, var(--bt-frame-plain))`);
    card.innerHTML = `<div class="btc__art"><img src="${esc(u.x.image || "")}" alt="" decoding="async"></div>
      <span class="btc__nm">${esc(u.name)}</span><span class="btc__hp"><b data-hp></b><svg class="btc__heart" viewBox="0 0 100 92" aria-hidden="true"><use href="#rd-heart"/></svg></span>
      <span class="btc__bf" data-buffs></span>
      <span class="btc__sk">${esc(t.sk)}</span><p class="btc__ds"><span>${t.ds}</span></p>
      <span class="btc__bar"><i></i><b>HP</b></span><svg class="btc__sw" viewBox="0 0 100 100" aria-hidden="true"><use href="#rd-swords"/></svg><b class="btc__atk" data-atk></b>
      ${!u.sim && !u.shadow ? `<span class="btc__warn">Skill not simulated yet</span>` : ""}`;
    P().paintTG(card, u.trait && u.trait.id, u.grade, false);
    return card;
  }
  // fits (the card is laid out 300px wide: 1cqw = 3px): name ≤ 46 (left half) · HP ≤ 33 + heart (right half, like the site card) ·
  // ability name ≤ 90 · ATK ≤ 64 (never under the swords) · text in its box
  function fitW(n, max, room) { if (!n) return max; let f = max; n.style.fontSize = f + "cqw"; for (let i = 0; i < 40 && n.scrollWidth > room * 3; i++) { f *= .96; n.style.fontSize = f + "cqw"; } return f; }
  function fitAtk(card) { const a = $(".btc__atk", card); if (!a) return; const f = fitW(a, 11.4, 64); a.style.top = (125.1 - .495 * f) + "cqw"; }   // capitals centred on the site card's ATK line (120.2–130)
  function fitText(card) {
    fitW($(".btc__nm", card), 6.6, 46); fitW($(".btc__sk", card), 6.2, 90); fitAtk(card); fitW($("[data-hp]", card), 8.8, 33);
    const ds = $(".btc__ds", card), sp = ds && ds.firstElementChild; if (!sp) return;
    let f = 4.1; ds.style.fontSize = f + "cqw";
    for (let i = 0; i < 60 && sp.offsetHeight > ds.clientHeight; i++) { f *= .97; ds.style.fontSize = f + "cqw"; }
  }
  // buffs on the card (top right): one chip each · DMG = all the ATK it gained this fight (owner: one chip, the total)
  function chipsOf(u) {
    const out = [], g = u.atkS ? Math.round((u.atk / u.atkS - 1) * 100) : 0, tr = u.trait && u.trait.fx;
    if (g) out.push({ k: "dmg", h: `DMG <b>${g > 0 ? "+" : "−"}${Math.abs(g)}%</b>`, c: g > 0 ? "up" : "down" });
    if (u.k.bf) out.push({ k: "zone", h: `ZONE <span class="btc__zn">${[0, 1, 2].map((i) => `<i class="${i < u.zone ? "on" : ""}"></i>`).join("")}</span>`, c: "zone" });
    if (u.copied) out.push({ k: "copy", h: `COPIED: <b>${esc(u.copied.toUpperCase())}</b>`, c: "copy" });
    if (u.shadow) out.push({ k: "shadow", h: "SHADOW", c: "copy" });
    if (u.shield > 0) out.push({ k: "shield", h: `SHIELD <b>${C.fmtHp(u.shield)}</b>`, c: "shield" });
    if (u.block > 0) out.push({ k: "block", h: `BLOCK <b>${u.block}</b>`, c: "shield" });
    const dr = (u.k.dr || 0) + ((tr && tr.dr) || 0) + (u.gdef || 0);
    if (dr > 0) out.push({ k: "dr", h: `DMG TAKEN <b>−${pctS(dr)}</b>`, c: "shield" });
    if (u.k.survive && !u.used.survive) out.push({ k: "surv", h: "SURVIVE <b>1×</b>", c: "gold" });
    const rv = u.k.revive || (tr && tr.revive);
    if (rv && !u.used.revive) out.push({ k: "rev", h: `REVIVE <b>${pctS(rv)}</b>`, c: "gold" });
    return out;
  }
  function paintChips(u, card) {
    const box = $("[data-buffs]", card); if (!box) return;
    const list = chipsOf(u), was = card._chips || {}, now = {};
    const chip = (c) => { now[c.k] = c.h; const cls = !(c.k in was) ? " in" : was[c.k] !== c.h ? " pop" : ""; return `<span class="btc__chip btc__chip--${c.c}${cls}">${c.h}</span>`; };
    const shown = list.length > 4 ? list.slice(0, 3) : list, more = list.length - shown.length;
    // owner's pick: 4 rows at most · more than 4 = the 4th row is "+n" (the rest)
    box.innerHTML = shown.map(chip).join("") + (more ? `<span class="btc__chip btc__chip--more">+${more}</span>` : "");
    card._chips = now;
    $$(".btc__chip", box).forEach((c) => { if (c.scrollWidth > 64 * 3) c.style.fontSize = Math.max(2.4, 3.9 * (64 * 3) / c.scrollWidth) + "cqw"; });
  }
  // debuffs above the card (outside it): icon + name + stacks + turns (∞ = the whole fight)
  function dbsOf(u) {
    const out = [];
    if (u.weakM && u.weakM < 1) out.push({ k: "weak", n: `ATK −${pctS(1 - u.weakM)}`, t: "∞" });
    for (const [kind, s] of Object.entries(u.dots)) out.push({ k: kind, n: `${String(s.name || kind).toUpperCase()} ×${s.stacks}`, t: s.left > 99 ? "∞" : s.left + "T" });
    if (u.cc) out.push({ k: u.cc.kind.toLowerCase(), n: u.cc.kind.toUpperCase(), t: u.cc.turns + "T" });
    if (u.kSeal) out.push({ k: "seal", n: "SEALED", t: Math.max(1, u.sealT - 1) + "T" });
    if (u.marked && !(u.sup && u.sup.b.mark)) out.push({ k: "mark", n: `MARKED +${pctS(u.marked)}`, t: "∞" });
    return out;
  }
  function paintDbs(u, s) {
    const box = $(".bt-dbs", s.slot); if (!box) return;
    const list = dbsOf(u), was = s.dbs || {}, now = {};
    box.innerHTML = list.map((d) => { const key = d.n + d.t; now[d.k] = key; const cls = !(d.k in was) ? " in" : was[d.k] !== key ? " tick" : "";
      return `<span class="bt-db bt-db--${esc(d.k)}${cls}">${dbIcon(d.k)}<span>${esc(d.n)}</span><u>${esc(d.t)}</u></span>`; }).join("");
    s.dbs = now;
  }
  function drawSlot(u, enter) {
    const el = $(u.side === "a" ? "#bt-slot-a" : "#bt-slot-b");
    el.innerHTML = `<div class="bt-dbs" aria-hidden="true"></div><div class="bt-fwrap${enter ? " enter" : ""}"><i class="bt-flash"></i><i class="bt-tint"></i><div class="bt-fxl"></div></div>`;
    const wrap = $(".bt-fwrap", el), card = fightCard(u);
    wrap.insertBefore(scaled(card), wrap.firstChild);
    el.dataset.uid = u.side + u.idx; F.shown[u.side] = { u, card, wrap, slot: el, dbs: null };
    setNums(u); requestAnimationFrame(() => fitText(card));
  }
  function setNums(u) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    const hp = $("[data-hp]", s.card), at = $("[data-atk]", s.card), a = fmt(u.atk);
    const ht = u.inf ? "∞" : C.fmtHp(Math.max(0, u.hp));
    if (hp.textContent !== ht) { hp.textContent = ht; fitW(hp, 8.8, 33); }
    if (at.textContent !== a) { at.textContent = a; fitAtk(s.card); }
    const bar = $(".btc__bar > i", s.card), p = u.inf ? 1 : Math.max(0, u.hp) / u.max;   // the boss's bar = ours, full (HP ∞)
    bar.style.setProperty("--p", p.toFixed(4)); bar.className = p > .5 ? "" : p > .25 ? "mid" : "lo";
    s.wrap.classList.toggle("is-low", !u.inf && p <= .25 && u.alive);
    const st = ["burn", "poison", "bleed"].find((k) => u.dots[k]); s.wrap.dataset.st = st || "";
    paintChips(u, s.card); paintDbs(u, s);
  }
  const refresh = () => { for (const side of ["a", "b"]) { const s = F.shown[side]; if (s) setNums(s.u); } };
  // team boxes: as wide as the team (1 card = a small box) · front glows · KO on the fallen
  function drawBench() {
    for (const side of ["a", "b"]) {
      const t = F.b[side], f = F.b.front(side);
      $("#bt-left-" + side).textContent = F.b.alive(side) + "/" + t.length + " left";
      $("#bt-left-" + side).closest(".bt-team").classList.toggle("is-solo", t.length === 1);   // 1 card: the words beside it, no empty slots
      $("#bt-bench-" + side).innerHTML = t.map((u, i) => `<i class="bt-th${!u.alive ? " dead" : u === f ? " front" : ""}" data-i="${i}"><img src="${esc(thumbOf("cards", u.x))}" alt=""><span>${u.inf ? "∞" : C.fmtHp(u.atk)}</span></i>`).join("");
    }
  }
  const retrig = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function spawn(u, html, cls, style) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    const l = $(".bt-fxl", s.wrap); while (l.children.length > 11) l.firstChild.remove();
    const n = document.createElement("span"); n.className = cls; n.innerHTML = html; if (style) n.setAttribute("style", style); l.appendChild(n);
    n.addEventListener("animationend", () => n.remove(), { once: true }); setTimeout(() => n.remove(), 2600);
  }
  let numN = 0;
  // numbers float in the picture (18–34% of the card: above the Trait / Grade band, never on the text)
  const numAt = (i) => `--x:${32 + (i % 3) * 6}%;--y:${22 + (i % 2) * 8}%`;   // the buff chips are on the right: numbers stay left of centre
  function number(u, v, kind, tag) { numN++; spawn(u, (kind === "heal" ? "+" : "-") + fmtD(v) + (tag ? `<small>${tag}</small>` : ""), "bt-num bt-num--" + kind, numAt(numN)); }
  function sparks(u) { if (reduced()) return; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.random() * .4, r = 50 + Math.random() * 40; spawn(u, "", "bt-spark", `--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`); } }
  function arrows(u) { if (reduced()) return; for (let i = 0; i < 3; i++) spawn(u, "", "bt-arrow", `--x:${30 + i * 20}%;--d:${i * 90}ms`); }
  // dodge (owner 2026-11-05: its own move + sound): a dash away from the attacker, an afterimage where it stood, wind lines
  function dodgeFx(u) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    retrig(s.wrap, "dodge"); if (reduced()) return;
    const g = document.createElement("i"); g.className = "bt-ghost"; s.slot.appendChild(g);
    g.addEventListener("animationend", () => g.remove(), { once: true }); setTimeout(() => g.remove(), 1200);
    for (let i = 0; i < 3; i++) spawn(u, "", "bt-streak", `--y:${28 + i * 15}%;--d:${i * 45}ms`);
  }
  // statuses on the card (owner 2026-11-05): poison = purple bubbles · burn = flames + embers · bleed = red drops ·
  // the card flashes its colour · landing (big) = more of them + the status icon pops
  const ST_N = { poison: 7, burn: 9, bleed: 5 };
  function statusFx(u, kind, big) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    const t = $(".bt-tint", s.wrap); if (t) { t.dataset.k = kind; retrig(t, "go"); }
    if (big) spawn(u, dbIcon(kind), "bt-stpop bt-stpop--" + kind);
    if (reduced()) return;
    const n = (ST_N[kind] || 6) + (big ? 4 : 0);
    for (let i = 0; i < n; i++) spawn(u, "", "bt-pt bt-pt--" + (ST_N[kind] ? kind : "poison"),
      `--x:${10 + Math.random() * 78}%;--d:${Math.round(Math.random() * 260)}ms;--s:${(big ? 7 : 5) + Math.random() * 6}%;--dx:${Math.round((Math.random() - .5) * 30)}px;--t:${800 + Math.round(Math.random() * 500)}ms`);
  }
  const SHOUT_Y = { skill: "13%", copy: "16%", zone: "24%", crit: "24%", extra: "20%", dodge: "22%", heal: "28%", debuff: "30%" };   // all in the picture
  // the splash hit on a bench card: an orange number on the front card (once per card hit) + its picture in the team box jumps
  function splash(x, v) {
    const s = F.shown[x.side]; if (s) { numN++; spawn(s.u, "-" + fmtD(v), "bt-num bt-num--aoe", `--x:${26 + (numN % 3) * 8}%;--y:${18 + (numN % 4) * 6}%;animation-delay:${(numN % 4) * 70}ms`); }
    const th = $(`#bt-bench-${x.side} .bt-th[data-i="${F.b[x.side].indexOf(x)}"]`);
    if (th) { retrig(th, "hit"); const n = document.createElement("span"); n.className = "bt-thn"; n.textContent = "-" + fmtD(v); th.appendChild(n); setTimeout(() => n.remove(), 1100); }
    SND.play("aoe");
  }
  // the support banner: its picture + name + ability (owner 2026-11-05: no number · once per card · what it adds goes in the card's own numbers)
  function supBanner(a) {
    const s = F.shown[a.side]; if (!s || !a.sup) return;
    const arena = $("#bt-arena"), b = document.createElement("div");
    b.className = "bt-sp bt-sp--" + a.side;
    b.innerHTML = `<img src="${esc(thumbOf("support", a.sup.x))}" alt=""><div><small>${esc(a.sup.name)}</small><strong>${esc(a.sup.eff.toUpperCase())}</strong></div>`;
    const im = $("img", b); im.addEventListener("error", () => im.remove(), { once: true });
    arena.appendChild(b); b.addEventListener("animationend", () => b.remove(), { once: true }); setTimeout(() => b.remove(), 2400);
    SND.play("sup");
  }
  function showEv(ev) {
    const u = ev.u; if (!u && ev.t !== "round") return;
    const s = u && F.shown[u.side] && F.shown[u.side].u === u ? F.shown[u.side] : null, wrap = s && s.wrap, o = ev.o || {};
    switch (ev.t) {
      case "atk": retrig(wrap, "lunge"); break;
      case "dmg": {
        const big = o.crit || o.heavy;
        {
          const kind = o.status ? (["poison", "burn", "bleed"].includes(o.status) ? o.status : "poison") : o.pct ? "pct" : o.pierce ? "pierce" : o.crit ? "crit" : "normal";
          number(u, ev.v, kind, o.status ? esc(String(o.status).toUpperCase()) : kind === "crit" ? "CRIT!" : kind === "pierce" ? "PIERCE" : o.reflect ? "REFLECT" : "");
          if (o.status) statusFx(u, kind, false);
          SND.play(o.status ? kind : kind === "pierce" ? "pierce" : big ? "crit" : "hit");
        }
        if (wrap) { retrig(wrap, big ? "shake-big" : "shake"); if (big) { retrig($(".bt-flash", wrap), "go"); sparks(u); } }
        setNums(u); break; }
      case "splash": splash(u, ev.v); break;
      case "sup": supBanner(u); break;
      case "heal": number(u, ev.v, "heal", o.src === "revive" ? "REVIVE" : ""); setNums(u); SND.play("heal"); break;
      case "buff": arrows(u); setNums(u); SND.play("buff"); break;
      case "shout": { const k = o.k || "skill"; if (!s) break; spawn(u, esc(ev.v), "bt-shout " + k, `--y:${SHOUT_Y[k] || "16%"}`); if (k === "debuff") { SND.play("debuff"); setNums(u); } else if (k !== "heal") SND.play("shout"); break; }
      case "dodge": dodgeFx(u); SND.play("dodge"); break;
      case "dot": { const k = ST_N[ev.v] ? ev.v : "poison"; statusFx(u, k, true); SND.play(k + "On"); setNums(u); break; }
      case "zone": case "copy": case "nums": setNums(u); break;
      case "round": { if (!F.b || !F.b.boss) break; const r = $("#bt-round"); r.innerHTML = ev.v + "<em> / 30</em>"; retrig(r, "pop"); break; }
      case "bench": case "benchdie": drawBench(); break;
    }
  }
  async function playDie(u) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    s.wrap.classList.add("die"); s.wrap.classList.remove("is-low"); $(".bt-dbs", s.slot).innerHTML = "";
    const sk = document.createElement("div"); sk.className = "bt-skull"; sk.innerHTML = `<svg viewBox="0 0 64 64"><path fill="currentColor" d="M32 4C17 4 7 14.5 7 28c0 8 3.6 13.4 8 16.6V54a4 4 0 0 0 4 4h4v-6h4v6h10v-6h4v6h4a4 4 0 0 0 4-4v-9.4c4.4-3.2 8-8.6 8-16.6C57 14.5 47 4 32 4Zm-11 34a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm22 0a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm-11 9-4-7h8z"/></svg>`;
    s.wrap.parentNode.appendChild(sk);
    SND.play("die"); drawBench(); await wait(620 * F.k);
  }
  // one step's events: a support's extra damage joins the hit it follows (5B + echo 5B = one "10B") · heals on the same card
  // in the same step = one number (owner 2026-11-05 "แสดงค่ารวม")
  function mergeEvs(evs) {
    const out = [];
    for (const e of evs) {
      const o = e.o || {};
      if (e.t === "dmg" && o.sup) { const j = findLast(out, (x) => x.t === "dmg" && x.u === e.u && !(x.o || {}).status); if (j) { j.v += e.v; continue; } }
      if (e.t === "heal" && o.src !== "revive") { const j = findLast(out, (x) => x.t === "heal" && x.u === e.u && (x.o || {}).src !== "revive"); if (j) { j.v += e.v; continue; } }
      out.push(e);
    }
    return out;
  }
  function findLast(a, f) { for (let i = a.length - 1; i >= 0; i--) if (f(a[i])) return a[i]; return null; }
  // a wait that stops while the End dialog is open
  async function wait(ms) { await sleep(ms); while (F.paused) await sleep(120); }
  async function startFight(mode) {
    if (!ready) return;
    F.seed = (F.seed * 1103515245 + 12345) % 2147483647;
    const queue = [];
    const b = new Battle(mode === "boss" ? "boss" : "a", "b", { seed: F.seed, boss: mode === "boss", log: (e) => queue.push(e) });
    if (!b.a.length) { FX.toast("Add at least one card to your team"); return; }
    if (!b.b.length) { FX.toast(mode === "boss" ? "The boss card isn't in the library" : "Add at least one card to the enemy team"); return; }
    F.token++; const my = F.token; F.mode = mode; F.paused = false;
    F.b = b; F.started = false; openFight();
    $("#bt-mode").textContent = mode === "boss" ? "Stage " + fmt(STAGE) : "Custom";
    $("#bt-round").innerHTML = "1<em> / 30</em>";
    $("#bt-fight").classList.toggle("bt-fight--noround", mode !== "boss");   // only Guild Boss shows the round count
    $("#bt-team-b").textContent = mode === "boss" ? "Boss" : "Enemy team";
    drawBench(); drawSlot(b.front("a"), true); drawSlot(b.front("b"), true); SND.play("enter");
    await wait(500 * F.k); if (my !== F.token) return;
    b.start(); F.started = true; for (const e of mergeEvs(queue.splice(0))) showEv(e);
    refresh(); drawBench();
    await wait(450 * F.k);
    while (my === F.token) {
      const done = b.step(), evs = mergeEvs(queue.splice(0)), t0 = performance.now();
      for (const ev of evs) {
        if (my !== F.token) return;
        if (ev.t === "atk") { showEv(ev); await wait(190 * F.k); continue; }
        if (ev.t === "die") { await wait(120 * F.k); await playDie(ev.u); continue; }
        if (ev.t === "enter") { drawSlot(ev.u, true); drawBench(); SND.play("enter"); await wait(430 * F.k); continue; }
        showEv(ev);
        if (ev.t === "shout" || ev.t === "sup") await wait(70 * F.k);
      }
      refresh();
      const need = 900 * F.k - (performance.now() - t0);
      if (need > 0) await wait(need);
      if (my !== F.token) return;
      if (done) break;
    }
    if (my !== F.token) return;
    const lose = b.win === "lose", txt = b.boss ? (lose ? "DEFEATED" : "TIME UP!") : b.win === "win" ? "VICTORY!" : lose ? "DEFEAT" : "DRAW";
    const el = document.createElement("div"); el.className = "bt-banner" + (lose ? " lose" : ""); el.innerHTML = `<span>${txt}</span>`;
    fightRoot().appendChild(el); setTimeout(() => el.remove(), 1500); SND.play(lose ? "lose" : "win");
    await sleep(1300); if (my !== F.token) return;
    showResult(b);
  }
  function openFight() {
    const f = fightRoot(); f.hidden = false; document.documentElement.classList.add("bt-fighting");
    if (location.hash !== "#battle/fight") history.pushState({ bt: 1 }, "", "#battle/fight");
    const sp = $('[data-spd][aria-pressed="true"]', f); if (sp) sp.focus({ preventScroll: true });
  }
  function closeFight() {
    F.token++; F.paused = false; const f = fightRoot(); if (f) f.hidden = true; document.documentElement.classList.remove("bt-fighting"); $$(".bt-banner").forEach((x) => x.remove());
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }
  // Skip = play the rest at once (the same result as watching) · End = stop here (b.finish(true)) after a yes:
  // Guild Boss keeps the damage so far · Arena = a loss (owner's picks 2026-11-05)
  function skipFight() { if (!F.b || F.paused) return; F.token++; const b = F.b; b.E = null; if (!F.started) { b.start(); F.started = true; } while (!b.step()); showResult(b); }
  async function endFight() {
    if (!F.b || F.paused || fightRoot().hidden) return;
    const b = F.b; F.paused = true;
    const res = await dialog({
      title: "End the battle here?",
      html: `<p class="tm-dlg__text">${b.boss ? "Your damage so far counts, and the stage moves up from it." : "Ending a Custom battle counts as a loss."}</p>`,
      actions: [{ label: "Keep fighting", value: "cancel" }, { label: "End battle", value: "ok", submit: true, cls: "tm-btn--danger" }],
    });
    F.paused = false;
    if (!res || res.action !== "ok" || F.b !== b || fightRoot().hidden) return;
    F.token++; b.E = null; if (!b.done) b.finish(true); showResult(b);
  }
  function toggleFull() {
    const f = fightRoot();
    try { if (document.fullscreenElement) document.exitFullscreen(); else if (f.requestFullscreen) f.requestFullscreen().catch(() => FX.toast("Full screen isn't available here")); } catch (e) {}
  }

  /* ==========================================================
     RESULT (+ a Guild Boss fight is saved: best fights, your damage, the stage it pushed to)
     ========================================================== */
  let lastResult = null;
  const teamDmg = (b) => b.a.reduce((x, u) => x + u.st.dmg, 0);
  function showResult(b) {
    lastResult = b; closeFight();
    const total = teamDmg(b);
    if (b.boss && !b.saved) { b.saved = true; b.st0 = STAGE; FIGHTS.push({ dmg: total, stage: STAGE, at: Date.now() }); restage(); b.st1 = STAGE; save(); paintBossStats(); paintStage(); }
    if (location.hash !== "#battle/result") history.replaceState(null, "", "#battle/result");
    view = "result"; showView();
    const team = b.a, mvp = team.reduce((m, u) => (u.st.dmg > m.st.dmg ? u : m), team[0]);
    const hero = b.boss
      ? `<p class="bt-res__eyebrow">DAMAGE DEALT</p><p class="bt-res__big" id="bt-res-num">0</p><p class="bt-res__why">${esc(b.why)}${b.win === "lose" ? "" : " · " + b.alive("a") + "/" + team.length + " cards still standing"}</p>
        <div class="bt-res__kv"><div><span>Your total</span><b>${fmtS(mine())}</b></div><div><span>Stage</span><b class="up">${b.st0} → ${b.st1}</b></div><div><span>Next at</span><b>${b.st1 >= SMAX ? "Max" : fmtG(need(b.st1 + 1))}</b></div></div>`
      : `<p class="bt-res__eyebrow">CUSTOM</p><p class="bt-res__big ${b.win}">${b.win === "win" ? "VICTORY" : b.win === "lose" ? "DEFEAT" : "DRAW"}</p><p class="bt-res__why">${esc(b.why)}</p>
        <div class="bt-res__kv"><div><span>Damage dealt</span><b>${fmtS(total)}</b></div><div><span>Cards left</span><b>${b.alive("a")} vs ${b.alive("b")}</b></div></div>`;
    const procs = (u) => Object.entries(u.st.procs).filter(([, r]) => r.exp > 0).map(([n, r]) => `<span class="chip glass">${esc(n)} ${r.n}<em>/ ${r.exp.toFixed(1)} expected</em></span>`).join("");
    const rows = team.map((u) => `<div class="bt-pc${u === mvp && u.st.dmg > 0 ? " mvp" : ""}"><img src="${esc(thumbOf("cards", u.x))}" alt=""><div>
        <p class="bt-pc__name"><span>${esc(u.name)}</span>${u === mvp && u.st.dmg > 0 ? `<span class="chip glass bt-mvp">MVP · ${pct(u.st.dmg / Math.max(1, total))}</span>` : u.st.died ? `<span class="chip glass">Fell</span>` : u.st.hits ? "" : `<span class="chip glass">Didn't fight</span>`}</p>
        <div class="bt-pc__grid"><span>Damage<b class="d">${fmtS(u.st.dmg)}</b></span><span>Hits<b>${u.st.hits}</b></span><span>CRIT<b>${u.st.crit}</b></span>
          <span>Healed<b class="h">${fmtS(u.st.heal)}</b></span><span>Taken<b>${fmtS(u.st.taken)}</b></span><span>Support<b>${u.st.sup}×</b></span></div>
        <div class="bt-pc__procs">${u.sim ? procs(u) || `<span class="chip glass">No chance skill</span>` : u.shadow ? `<span class="chip glass">Shadow</span>` : `<span class="dk-pill bt-pill--warn"><span>Skill not simulated yet</span></span>`}${u.part && u.part.length ? `<span class="dk-pill bt-pill--warn" title="${esc(u.part.join(" "))}"><span>Partly simulated</span></span>` : ""}</div></div></div>`).join("");
    $("#bt-result").innerHTML = `<section class="panel bt-res__hero">${hero}</section>
      <section class="panel bt-res__cards"><div class="bt-h"><h2>Each card</h2><small>This fight</small></div><div class="bt-pcs">${rows}</div>
        <div class="bt-res__btns"><button type="button" class="tm-btn tm-btn--primary fx-press" data-bt="save">Save as image</button><button type="button" class="tm-btn fx-press" data-bt="fight" data-mode="${b.boss ? "boss" : "arena"}">Fight again</button><button type="button" class="tm-btn fx-press" data-bt="go" data-to="${b.boss ? "boss" : "arena"}">Continue</button></div></section>`;
    FX.stagger($("#bt-result"), 80, { cls: "fx-up", max: 3, cleanup: true });
    if (b.boss) { const el = $("#bt-res-num"); if (reduced()) el.textContent = fmt(total); else FX.countTo(el, total, { format: fmt, duration: 1100 }); }
  }
  // Save as image: drawn on a canvas in the site's colours (tokens), saved / shared like the Deck's (C.share.previewDialog)
  function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const im = new Image(); im.decoding = "async"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  async function resultImage(b) {
    const cs = getComputedStyle(document.documentElement), tok = (n, f) => (cs.getPropertyValue(n).trim() || f);
    const ink = tok("--ink", "white"), dim = tok("--ink-dim", "silver"), gold = tok("--gold-hi", "gold"), bg1 = tok("--void", "navy"), dmgC = tok("--bt-dmg", "red");
    const W = 1080, rowH = 150, head = 300, team = b.a, H = head + team.length * rowH + 110, S = 1;
    const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
    const ctx = cv.getContext("2d"); ctx.scale(S, S);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg1); g.addColorStop(1, tok("--bt-copy-line", bg1)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const disp = tok("--font-display", "serif"), body = tok("--font-body", "sans-serif"), num = tok("--gc-font-num", "sans-serif");
    const total = teamDmg(b);
    ctx.textAlign = "center"; ctx.fillStyle = gold; ctx.font = `400 34px ${disp}`;
    ctx.fillText(b.boss ? `GUILD BOSS · STAGE ${b.st0 != null ? b.st0 + " → " + b.st1 : STAGE}` : "CUSTOM BATTLE", W / 2, 80);
    ctx.fillStyle = b.boss ? dmgC : b.win === "win" ? tok("--bt-win", "lime") : b.win === "lose" ? tok("--bt-lose", "red") : dim;
    ctx.font = `700 92px ${num}`;
    ctx.fillText(b.boss ? fmt(total) : b.win === "win" ? "VICTORY" : b.win === "lose" ? "DEFEAT" : "DRAW", W / 2, 185);
    ctx.fillStyle = dim; ctx.font = `400 28px ${body}`; ctx.fillText(b.boss ? "damage dealt · " + b.why : b.why, W / 2, 240);
    const imgs = await Promise.all(team.map((u) => loadImg(thumbOf("cards", u.x))));
    team.forEach((u, k) => {
      const y = head + k * rowH;
      ctx.fillStyle = tok("--bt-wash-03", "rgba(255,255,255,.03)"); ctx.fillRect(60, y, W - 120, rowH - 18);
      if (imgs[k]) ctx.drawImage(imgs[k], 76, y + 10, 84, 112);
      ctx.textAlign = "left"; ctx.fillStyle = ink; ctx.font = `700 34px ${body}`; ctx.fillText(u.name, 190, y + 52);
      ctx.fillStyle = dim; ctx.font = `400 24px ${body}`;
      ctx.fillText(`${u.st.hits} hits · ${u.st.crit} crit · healed ${fmtS(u.st.heal)} · taken ${fmtS(u.st.taken)}`, 190, y + 96);
      ctx.textAlign = "right"; ctx.fillStyle = dmgC; ctx.font = `700 44px ${num}`; ctx.fillText(fmtS(u.st.dmg), W - 80, y + 70);
    });
    ctx.textAlign = "center"; ctx.fillStyle = dim; ctx.font = `400 22px ${body}`; ctx.fillText("CARD BATTLE INFINITY · BATTLE", W / 2, H - 44);
    const blob = await new Promise((res, rej) => cv.toBlob((x) => (x ? res(x) : rej(new Error("Couldn't encode the image"))), "image/png"));
    return { blob, width: cv.width, height: cv.height, filename: `battle-${b.boss ? "guild-boss" : "custom"}-${new Date().toLocaleDateString("en-CA")}.png` };
  }
  function saveImage(btn) { const b = lastResult; if (!b || !C.share) return; C.share.previewDialog({ title: "Save as image", render: () => resultImage(b), flashEl: btn }); }

  /* ==========================================================
     ARENA: many fights → win %, who carries, luck, a better order
     ========================================================== */
  let simN = 500;
  function clearSim() { const o = $("#bt-sim-out"); if (o && o.dataset.has) { o.dataset.has = ""; o.innerHTML = `<div class="empty bt-sim__empty"><p class="empty__text">Teams changed. Tap Simulate again.</p></div>`; } }
  function many(aKey, n, seed0, mutate) {
    const out = { w: 0, d: 0, l: 0, n, dmg: [0, 0, 0, 0], kills: [0, 0, 0, 0], died: [0, 0, 0, 0], fights: [] };
    const saved = mutate ? mutate() : null;
    try {
      for (let i = 0; i < n; i++) {
        const b = new Battle(aKey, "b", { seed: seed0 + i * 7919 }).run();
        out[b.win === "win" ? "w" : b.win === "lose" ? "l" : "d"]++;
        b.a.forEach((u, k) => { if (k >= SLOTS) return; out.dmg[k] += u.st.dmg; out.kills[k] += u.st.kills; out.died[k] += u.st.died; });
        out.fights.push({ win: b.win, luck: b.a.slice(0, SLOTS).map((u) => { const r = Object.values(u.st.procs)[0]; return r && r.exp > 0 ? r.n - r.exp : null; }), procs: b.a.map((u) => u.st.procs) });
      }
    } finally { if (saved) saved(); }
    out.units = new Battle(aKey, "b", { seed: 1 }).a.map((u) => u);
    return out;
  }
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  // try an order on team "a" without keeping it: returns an undo
  function reorder(kind, p) {
    const d = T.a, keys = kind === "cards" ? ["cards", "cardRarity", "trait", "grades", "custom", "support", "supRarity"] : ["support", "supRarity"];
    const old = keys.map((k) => d[k].slice());
    keys.forEach((k, n) => { d[k] = p.map((j) => old[n][j]); });
    return () => keys.forEach((k, n) => { d[k] = old[n]; });
  }
  let simming = false;
  async function runSim(btn) {
    if (simming) return;
    if (!T.a.cards.some((id) => id && lookup("cards", id))) { FX.toast("Add at least one card to your team"); return; }
    if (!T.b.cards.some((id) => id && lookup("cards", id))) { FX.toast("Add at least one card to the enemy team"); return; }
    simming = true; btn.disabled = true;
    const out = $("#bt-sim-out"); out.dataset.has = "1";
    out.innerHTML = `<div class="empty bt-sim__empty"><span class="fx-loader" aria-hidden="true"></span><p class="empty__text" id="bt-sim-prog" aria-live="polite">Fighting ${simN} times…</p></div>`;
    try {
      await sleep(60);
      const r = many("a", simN, 1001);
      const tries = []; let done = 0;
      for (const kind of ["cards", "sups"]) for (const p of perms([0, 1, 2, 3])) {
        if (p.join("") === "0123") continue;
        const m = many("a", simN, 1001, () => reorder(kind === "cards" ? "cards" : "support", p));
        const undo = reorder(kind === "cards" ? "cards" : "support", p); const snap = { cards: T.a.cards.slice(), support: T.a.support.slice() }; undo();
        tries.push({ kind, p, win: m.w / simN, snap });
        if (++done % 3 === 0) { const pg = $("#bt-sim-prog"); if (pg) pg.textContent = `Trying other orders… ${done} / 46`; await sleep(0); }
      }
      tries.sort((x, y) => y.win - x.win);
      drawSim(r, tries.filter((t) => t.win > r.w / simN + .005).slice(0, 3));
    } finally { simming = false; btn.disabled = false; }
  }
  function drawSim(r, tips) {
    const n = r.n, W = r.w / n, D = r.d / n, L = r.l / n, U = r.units.slice(0, SLOTS), tot = r.dmg.reduce((x, y) => x + y, 0) || 1;
    const carryIdx = r.dmg.indexOf(Math.max(...r.dmg));
    const carry = U.map((u, k) => `<div class="bt-carry__row"><img src="${esc(thumbOf("cards", u.x))}" alt=""><div>
        <p class="bt-carry__top"><span>${esc(u.name)}${k === carryIdx ? `<span class="bt-crown">♛ carries</span>` : ""}</span><span>${pct(r.dmg[k] / tot)}</span></p>
        <span class="bt-bar"><i style="--p:${(r.dmg[k] / tot).toFixed(3)}"></i></span>
        <p class="bt-carry__meta">${(r.kills[k] / n).toFixed(2)} kills / fight · falls in ${pct(r.died[k] / n)} of fights${u.sim ? "" : " · skill not simulated"}</p></div></div>`).join("");
    const luck = U.map((u, k) => {
      const fs = r.fights.filter((f) => f.luck[k] != null); if (fs.length < 20) return "";
      const nm = Object.keys(fs[0].procs[k])[0];
      const avgN = fs.reduce((x, f) => x + (f.procs[k][nm] ? f.procs[k][nm].n : 0), 0) / fs.length, avgE = fs.reduce((x, f) => x + (f.procs[k][nm] ? f.procs[k][nm].exp : 0), 0) / fs.length;
      const hi = fs.filter((f) => f.luck[k] > 0), lo = fs.filter((f) => f.luck[k] < 0), wr = (a) => (a.length ? a.filter((f) => f.win === "win").length / a.length : 0);
      if (hi.length < 10 || lo.length < 10) return "";
      const sw = Math.abs(wr(hi) - wr(lo));
      return `<div class="bt-luck__row"><p><b>${esc(u.name)}</b> · ${esc(nm)}</p><p class="bt-luck__sub">Triggers ${avgN.toFixed(1)} times a fight (expected ${avgE.toFixed(1)}) · ${sw < .05 ? "luck barely changes the result" : "luck swings it by " + Math.round(sw * 100) + " points"}</p>
        <div class="bt-luck__split"><div class="hi"><strong>${pct(wr(hi))}</strong>win when it triggers more than expected (${pct(hi.length / fs.length)} of fights)</div><div class="lo"><strong>${pct(wr(lo))}</strong>win when it triggers less (${pct(lo.length / fs.length)} of fights)</div></div></div>`;
    }).join("");
    const tipsH = tips.length ? tips.map((t, i) => `<div class="bt-tip"><div>${t.kind === "cards" ? "Card order" : "Support order"} <strong>${pct(t.win)}</strong> <span class="bt-faint">(now ${pct(W)} · same ${n} fights)</span>
        <span class="bt-tip__order">${(t.kind === "cards" ? t.snap.cards : t.snap.support).map((id) => { const x = id && lookup(t.kind === "cards" ? "cards" : "support", id); return x ? `<img src="${esc(thumbOf(t.kind === "cards" ? "cards" : "support", x))}" alt="">` : `<i></i>`; }).join("")}</span></div>
        <button type="button" class="tm-btn tm-btn--primary fx-press" data-bt="apply" data-tip="${i}">Use</button></div>`).join("")
      : `<p class="bt-faint">This order already wins the most of the 46 orders tried.</p>`;
    $("#bt-sim-out").innerHTML = `<div class="bt-sim__grid">
      <div><h3 class="bt-sub">${n} fights</h3><p class="bt-big"><span>${pct(W)}</span><small>win chance</small></p>
        <div class="bt-wdl"><i class="w" style="flex:${W || .0001}">${W >= .08 ? pct(W) : ""}</i><i class="d" style="flex:${D || .0001}">${D >= .08 ? pct(D) : ""}</i><i class="l" style="flex:${L || .0001}">${L >= .08 ? pct(L) : ""}</i></div>
        <p class="bt-wdl__legend"><span class="w">Win ${pct(W, 1)}</span><span class="d">Draw ${pct(D, 1)}</span><span class="l">Lose ${pct(L, 1)}</span></p></div>
      <div><h3 class="bt-sub">Who carries</h3><div class="bt-carry">${carry}</div></div>
      <div><h3 class="bt-sub">Chance skills (luck)</h3><div class="bt-luck">${luck || `<p class="bt-faint">No chance skills on your team.</p>`}</div></div>
      <div><h3 class="bt-sub">Try this</h3><div class="bt-tips">${tipsH}</div></div></div>`;
    FX.stagger($(".bt-sim__grid"), 70, { cls: "fx-up", max: 4, cleanup: true });
    $("#bt-sim-out")._tips = tips;
  }
  function applyTip(i) {
    const t = ($("#bt-sim-out")._tips || [])[i]; if (!t) return;
    reorder(t.kind === "cards" ? "cards" : "support", t.p);
    paintBoard("a"); if (!reduced()) FX.flash($('[data-board="a"]')); FX.toast("Order changed · simulate again");
  }

  /* ==========================================================
     PAGE · #battle (Guild Boss) · #battle/arena · #battle/result · #battle/fight (js/app.js shows the page, show() the view)
     ========================================================== */
  const VIEWS = ["boss", "arena", "result"];
  let view = "boss", bound = false;
  const viewFromHash = () => { const m = location.hash.match(/^#\/?battle(?:\/(\w+))?/); return m ? (m[1] || "boss") : null; };
  function go(v) {   // the tabs (Guild Boss | Arena) and Continue: no new history entry, like the Cards | Support tabs
    const h = v === "boss" ? "#battle" : "#battle/" + v;
    if (location.hash !== h) history.replaceState(null, "", h);
    show();
    window.scrollTo({ top: 0 });
  }
  function showView() {
    $$("[data-bt-view]").forEach((s) => { s.hidden = s.dataset.btView !== view; });
    const seg = $("#bt-tabs"); seg.hidden = !(view === "boss" || view === "arena");
    seg.style.setProperty("--i", view === "arena" ? 1 : 0);
    $$("#bt-tabs .seg__btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.btTab === view)));
  }
  function show() {
    let v = viewFromHash(); if (!v || !$("#page-battle")) return;
    if (!ready) { init(); return; }   // show() runs again once the data is in
    if (v === "fight") { if (!F.b || fightRoot().hidden) { history.replaceState(null, "", "#battle"); v = "boss"; } else return; }
    else closeFight();
    if (v === "result" && !lastResult) { history.replaceState(null, "", "#battle"); v = "boss"; }
    if (!VIEWS.includes(v)) v = "boss";
    view = v; showView();
  }
  function paintBossStats() {
    const best = FIGHTS.slice().sort((x, y) => y.dmg - x.dmg).slice(0, 3);
    const when = (t) => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d + " days ago"; };
    $("#bt-best").innerHTML = best.length ? best.map((f, i) => `<li><span class="bt-rk">${i + 1}</span><span>${when(f.at)} <span class="bt-faint">· Stage ${f.stage}</span></span><b>${fmtS(f.dmg)}</b></li>`).join("")
      : `<li class="bt-list__empty"><span class="empty__text">No fights yet.</span></li>`;
    $("#bt-mine").textContent = fmtS(mine());
    $("#bt-reached").textContent = fmt(STAGE);
  }
  function paintBoss() {
    const x = lookup("cards", BD.boss.id || "quirk-thief-overlord"), box = $("#bt-boss-card");
    if (x) {
      const card = cardEl("cards", x, "Normal");
      box.innerHTML = ""; box.appendChild(scaled(card));
      const h = $('[data-k="hp"]', card); if (h) { h.textContent = "∞"; h.dataset.t = "∞"; }
      $("#bt-boss-name").textContent = x.name;
    }
    $("#bt-boss-card-atk").textContent = fmt(Number(BD.boss.cardAtk) || 0);
    paintStage();
    paintBossStats();
  }
  function paintStage() {
    $("#bt-stage").value = START;
    $("#bt-boss-atk").textContent = fmt(bossAtk(STAGE));
    // the bar = how far into this stage (like the game's bar) · next at = the damage the next stage needs
    const lo = need(STAGE), hi = STAGE >= SMAX ? lo : need(STAGE + 1), g = guildDmg();
    $("#bt-stage-bar").style.setProperty("--p", (STAGE >= SMAX ? 1 : Math.max(0, Math.min(1, (g - lo) / Math.max(1, hi - lo)))).toFixed(3));
    $("#bt-next").textContent = STAGE >= SMAX ? "Max stage" : "Next at " + fmtG(hi);
  }
  // Refresh = a new week: your damage + best fights go, the stage goes back to the start stage
  async function refreshWeek() {
    const res = await dialog({
      title: "Start a new week?",
      html: `<p class="tm-dlg__text">Your damage and best fights are cleared, and the stage goes back to ${esc(fmt(START))}. This can’t be undone.</p>`,
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Refresh", value: "ok", submit: true, cls: "tm-btn--danger" }],
    });
    if (!res || res.action !== "ok") return;
    FIGHTS = []; restage(); save(); paintStage(); paintBossStats();
    const p = $("#bt-stage-bar").closest(".panel"); if (p && !reduced()) FX.flash(p);
    FX.toast("New week · stage " + fmt(STAGE));
  }
  function drawSound() { const b = $("#bt-sound"); b.innerHTML = SND.muted ? ICON.mute : ICON.sound; b.setAttribute("aria-label", SND.muted ? "Sound off" : "Sound on"); b.setAttribute("aria-pressed", String(!SND.muted)); }
  function moveTo(slot) {
    const s = sel; sel = null;
    if (!s || slot.dataset.team !== s.key || slot.dataset.kind !== s.kind) { paintBoard(s.key); FX.toast("Pick a slot in the same row"); return; }
    const j = Number(slot.dataset.i); if (j !== s.i) swap(s.key, s.kind, s.i, j);
    paintBoard(s.key, { flash: { kind: s.kind, i: j } });
  }
  function bind() {
    if (bound) return; bound = true;
    const page = $("#page-battle");
    page.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-bt-tab]"); if (tab) { go(tab.dataset.btTab); return; }
      const t = e.target.closest("[data-bt]");
      const slot = e.target.closest(".dk-slot[data-team]");
      if (t) {
        const act = t.dataset.bt;
        if (act === "clear" && slot) { clearSlot(slot.dataset.team, slot.dataset.kind, Number(slot.dataset.i)); return; }
        if (act === "buff" && slot) { buffDialog(slot.dataset.team, Number(slot.dataset.i)); return; }
        if (act === "add" && slot) { if (sel) { moveTo(slot); return; } openPicker(slot.dataset.team, slot.dataset.kind, Number(slot.dataset.i)); return; }
        if (act === "load") { loadDeck(t.dataset.team); return; }
        if (act === "fight") { SND.unlock(); startFight(t.dataset.mode); return; }
        if (act === "sim") { runSim(t); return; }
        if (act === "simn") { simN = Number(t.dataset.n); const seg = t.parentNode; seg.style.setProperty("--i", [...seg.querySelectorAll(".seg__btn")].indexOf(t)); seg.querySelectorAll(".seg__btn").forEach((x) => x.setAttribute("aria-pressed", String(x === t))); return; }
        if (act === "apply") { applyTip(Number(t.dataset.tip)); return; }
        if (act === "save") { saveImage(t); return; }
        if (act === "refresh") { refreshWeek(); return; }
        if (act === "go") { go(t.dataset.to); return; }
      }
      const item = e.target.closest(".dk-item[data-id]");
      if (item && slot) { if (sel) { moveTo(slot); return; } slotSheet(slot.dataset.team, slot.dataset.kind, Number(slot.dataset.i)); return; }
      if (sel && slot) moveTo(slot);
    });
    page.addEventListener("keydown", (e) => { const item = e.target.closest(".dk-item[data-id]"); if (item && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); item.click(); } });
    $("#bt-stage").addEventListener("change", (e) => {
      let v = Math.round(Number(e.target.value)); if (!(v >= 0)) v = 0; if (v > SMAX) v = SMAX; START = v; restage(); save();
      paintStage(); paintBossStats(); if (!reduced()) FX.flash($("#bt-boss-atk").closest(".panel"));
    });
    // fight controls
    const f = fightRoot();
    f.addEventListener("click", (e) => {
      const sp = e.target.closest("[data-spd]");
      if (sp) { const v = Number(sp.dataset.spd); F.k = v === 1 ? 1 : v === 2 ? .5 : 1 / 3; f.style.setProperty("--bt-k", F.k.toFixed(3)); $$("[data-spd]", f).forEach((x) => x.setAttribute("aria-pressed", String(x === sp))); return; }
      if (e.target.closest("#bt-full")) { toggleFull(); return; }
      if (e.target.closest("#bt-skip")) { skipFight(); return; }
      if (e.target.closest("#bt-end")) { endFight(); return; }
      if (e.target.closest("#bt-sound")) { SND.unlock(); SND.muted = !SND.muted; store.set(MUTE_KEY, SND.muted ? "1" : "0"); drawSound(); FX.toast(SND.muted ? "Sound off" : "Sound on"); }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !fightRoot().hidden && !F.paused) setTimeout(endFight, 0); });   // Esc = End (asks first · opened after this key, or the same Esc closes the dialog)
    const fb = $("#bt-full", f); if (fb) fb.hidden = !(f.requestFullscreen && document.fullscreenEnabled !== false);
  }

  /* ---------- Load once (the first time the Battle page opens): data/battle.json + the pending supports ---------- */
  function init() {
    if (ready || loading || !state.loaded || !$("#page-battle")) return loading;
    $("#bt-loading").hidden = false;
    loading = Promise.all([
      C.loadJSON("data/battle.json").catch((e) => { console.warn("data/battle.json not loaded: skills off", e); return null; }),
      C.loadJSON("data/pending/support.json").catch(() => []),
    ]).then(([bd, pend]) => {
      if (bd && typeof bd === "object") BD = { clip: {}, boss: {}, cards: {}, support: {}, traits: {}, groups: {}, ...bd };
      const live = Array.isArray(state.support) ? state.support : [], have = new Set(live.map((s) => s.id));
      SUP = live.concat((Array.isArray(pend) ? pend : []).filter((s) => s && s.id && s.effect && !have.has(s.id)).map((s) => ({ ...s, kind: "support", name: s.name || s.id })));
      loadSaved();
      ready = true;
      $("#bt-loading").hidden = true;
      bind(); drawSound(); paintBoss(); paintBoard("boss"); paintBoard("a"); paintBoard("b");
      show();
    }).catch((e) => { console.error(e); $("#bt-loading").innerHTML = `<p class="empty__title">Couldn't load the battle data</p><p class="empty__text">Check your connection and open Battle again.</p>`; loading = null; });
    return loading;
  }

  C.battle = { init, show, Battle, teams: T, stats, data: () => BD };
})();
