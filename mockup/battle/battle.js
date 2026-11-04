/* ==========================================================
   Battle mockup (PROGRESS ▶️ "⚔️ ระบบต่อสู้" · step ① round 3 · owner 2026-11-04)
   Runs ON the real site (mockup/battle.html = index.html + <base href="../"> + a 4th menu button "Battle"):
   cards are C.renderCard (the real game card) · Trait / Grade badges + pills + the slot sheet are copies of js/deck.js
   (same classes, css/deck.css) · deck buffs = the real js/deckbuff.js (C.deckBuff.compute) · plus, for battle only:
   Custom HP / ATK in the slot sheet · Load from My Decks (cbi:decks) · the fight engine (§14) · fight / result / win %.
   Routes: #battle (Guild Boss) · #battle/arena · #battle/fight · #battle/result · #battle/ask (questions for the owner).
   Nothing here changes a file of the real site; step ② moves the parts into js/battle.js + shared deck parts.
   ========================================================== */
(function () {
  "use strict";
  // mockup/battle.html has <base href="../">: a "#hash" given to pushState / replaceState (here and in app.js) would point at
  // the site's index.html · keep it on this page
  if (document.baseURI !== location.href.split("#")[0]) ["pushState", "replaceState"].forEach((k) => {
    const o = history[k].bind(history);
    history[k] = (st, t, url) => o(st, t, typeof url === "string" && url.startsWith("#") ? location.pathname + location.search + url : url);
  });
  const C = window.CBI, { state, $, esc } = C;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SLOTS = 4, KINDS = ["cards", "support"], RKEY = { cards: "cardRarity", support: "supRarity" }, GRADE_MAX = 10;
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  const reduced = () => !!(window.FX && FX.reduced);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {   // same paths as js/deck.js ICON
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    swap: svg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
    move: svg('<path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
    book: svg('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    sound: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
    mute: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    dice: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>'),
    copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  };
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const fmtS = (n) => { const a = Math.abs(n); for (const [v, u] of [[1e15, "Qa"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]) if (a >= v) return (n / v).toFixed(a / v >= 100 ? 0 : a / v >= 10 ? 1 : 2) + u; return String(Math.round(n)); };
  const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const raw = (n) => String(Math.round(n));   // floating numbers like the clip: +567664559 (no commas)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dialog = (o) => C.dialog(o);

  /* ==========================================================
     Data · live cards (data/cards.json) · supports from data/pending/support.json (the live list is still empty)
     ========================================================== */
  const lookup = (kind, id) => (kind === "cards" ? state.cards : state.support || []).find((x) => x && x.id === id) || null;
  const traitList = () => (Array.isArray(state.traits) ? state.traits : []);
  const traitById = (id) => traitList().find((t) => t.id === id) || null;
  const rarityOf = (d, kind, i) => C.deckBuff.rarityOf(d, kind, i);
  const rarities = () => state.meta.rarities.map((r) => r.name);
  const thumbOf = (kind, x) => (!x ? "" : kind === "cards" ? String(x.image || "").replace("/art/", "/art/thumb/") : String(x.image || "").replace("images/support/", "images/support/thumb/"));

  /* ---------- Grade + Trait helpers (copies of js/deck.js) ---------- */
  const GSTATS = ["Basic Attack", "Defense", "Status Damage", "HP"];
  const GSUM = "Each point gives +2.5% to its own stat. A 10 MINT (all four at 10) adds +30% more to every stat.";
  const GSUM_FULL = "10 MINT: +25% + 30% = +55% to every stat.";
  const overallOf = (g) => (Array.isArray(g) && g.some((n) => n > 0) ? Math.floor(g.reduce((a, n) => a + n, 0) / 4 + 0.5) : 0);
  const fullOf = (g) => Array.isArray(g) && g.length >= 4 && g.slice(0, 4).every((n) => n >= GRADE_MAX);
  const gradeTone = (v) => (v >= 10 ? "mint" : v >= 9 ? "gold" : v >= 6 ? "purple" : v >= 3 ? "green" : v >= 1 ? "grey" : "none");
  const gradeBand = (g) => (g >= 10 ? "rainbow" : g >= 7 ? "gold" : g >= 4 ? "silver" : g >= 1 ? "bronze" : "none");
  const traitColor = (t) => (t && t.color && t.color !== "rainbow" ? `--tc:${esc(t.color)}` : "");
  const traitIcon = (t, cls) => `<img class="${cls}" src="images/traits/${esc(t.id)}.webp" alt="" width="96" height="96" decoding="async" draggable="false">`;
  const traitFx = (t) => [t.dmg ? `x${t.dmg} Damage` : "", t.hp ? `x${t.hp} Health` : "", ...(Array.isArray(t.lines) ? t.lines : [])].filter(Boolean);
  function tgHTML(t, g) {
    return `${t ? `<span class="tg__tr" data-c="${t.color === "rainbow" ? "rainbow" : "solid"}" style="${traitColor(t)}">${traitIcon(t, "tg__ic")}<span class="tg__lab">${esc(t.name)}</span></span>` : ""}`
      + `${g > 0 ? `<span class="tg__gr" data-band="${gradeBand(g)}"><span class="tg__ring"><b data-n="${g}">${g}</b></span><span class="tg__lab">Grade</span></span>` : ""}`;
  }
  function paintTG(card, traitId, grade) {
    if (!card) return;
    const t = traitId ? traitById(traitId) : null, g = grade > 0 ? grade : 0;
    let el = $(".tg", card);
    if (!t && !g) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("span"); el.className = "tg"; el.setAttribute("aria-hidden", "true"); card.appendChild(el); }
    el.innerHTML = tgHTML(t, g);
  }
  // pills under a card (copy of js/deck.js pillSpecs) + "Custom" (battle only)
  function pillsHTML(kind, d, i, id) {
    const x = lookup(kind, id), r = rarityOf(d, kind, i), lr = String(r).toLowerCase();
    const one = (p, html, attrs) => `<span class="dk-pill dk-pill--${p}"${Object.entries(attrs).filter(([, v]) => v != null).map(([a, v]) => ` ${a}="${esc(v)}"`).join("")}>${html}</span>`;
    let h = one("rar", `<span>${esc(r)}</span>`, { "data-r": r, style: r === "Normal" ? null : `--rar-bg:var(--gc-rar-${lr});--rar-line:var(--gc-rar-${lr}-line);--rar-ink:var(--gc-rar-${lr}-ink,#fff)` });
    if (kind === "cards") {
      const g = overallOf(d.grades[i]), t = d.trait[i] ? traitById(d.trait[i]) : null;
      h += one("gr", g ? `<span>Grade</span><b>${g}</b>` : `<span>No grade</span>`, { "data-band": gradeBand(g), "data-off": g ? null : "" });
      h += one("tr", t ? `${traitIcon(t, "dk-pill__ic")}<span>${esc(t.name)}</span>` : `<span>No trait</span>`, { "data-c": t ? (t.color === "rainbow" ? "rainbow" : "solid") : null, "data-off": t ? null : "", style: t ? traitColor(t) || null : null });
      if (d.custom[i]) h += `<span class="dk-pill bt-pill--cus" title="Custom ${[d.custom[i].atk != null ? "ATK" : "", d.custom[i].hp != null ? "HP" : ""].filter(Boolean).join(" + ")}"><span>Custom</span></span>`;
    } else {
      const m = x && C.mutAt ? C.mutAt(x, r) : 0;
      h += one("mut", m ? `<span>Mutation +${m}%</span>` : `<span>No mutation</span>`, { "data-off": m ? null : "" });
    }
    return h;
  }
  function fitName(el) {   // copy of js/deck.js fitName
    const box = el.parentNode;
    el.style.fontSize = ""; box.classList.remove("is-clamp");
    if (!el.textContent || !box.clientHeight) return;
    let f = parseFloat(getComputedStyle(el).fontSize) || 11;
    while (el.offsetHeight > box.clientHeight + 0.5 && f > 8) { f -= 0.5; el.style.fontSize = f + "px"; }
    if (el.offsetHeight > box.clientHeight + 0.5) box.classList.add("is-clamp");
  }
  const pctTxt = (n) => "+" + Number(n.toFixed(1)) + "%";
  function buffText(r) {
    if (r.atkPct && r.hpPct) return r.atkPct === r.hpPct ? `${pctTxt(r.atkPct)} ATK·HP` : `${pctTxt(r.atkPct)} · ${pctTxt(r.hpPct)}`;
    return r.atkPct ? `${pctTxt(r.atkPct)} ATK` : `${pctTxt(r.hpPct)} HP`;
  }

  /* ---------- Card scaler: the card is laid out 300px wide and scaled to its box, so small type never hits a phone's
     minimum font size (the owner's phone, round 2: the card text spilled out of the small team cards) ---------- */
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
     Teams (deck-shaped so js/deckbuff.js reads them) · custom[i] = { atk?, hp? } replaces the final number (battle only)
     ========================================================== */
  const team = (cards, support, cr, sr, trait, grades, custom) => ({ name: "", rarity: cr[0], cards, support, cardRarity: cr, supRarity: sr, trait, grades, custom: custom || [null, null, null, null], from: "" });
  const G10 = [10, 10, 10, 10];
  const T = {
    boss: team(["divergent-fist-vessel", "sword-saint", "octopus-teacher", "shadow-monarch"], ["gate-healer", "cafe-owner-owl", "plant-healer", "spirit-sidekick"],
      ["Godlike", "Ascended", "Godlike", "Godlike"], ["Godly", "Divine", "Cosmic", "Ascended"], ["limitless", "awakened", "sage-mode", "undying"], [G10, G10, [7, 6, 8, 7], G10],
      [{ atk: 2661922940, hp: 9461075983 }, null, null, null]),   // DFV: the owner's in-game card (2026-11-04 · ATK × 0.93 = the clip's 2,475,588,334)
    a: team(["divergent-fist-vessel", "sword-saint", "octopus-teacher", "shadow-monarch"], ["gate-healer", "cafe-owner-owl", "plant-healer", "spirit-sidekick"],
      ["Godlike", "Ascended", "Godlike", "Godlike"], ["Godly", "Divine", "Cosmic", "Ascended"], ["limitless", "awakened", "sage-mode", "undying"], [G10, G10, [7, 6, 8, 7], G10]),
    b: team(["founding-titan", "ant-king", "slime-demon-lord", "golden-wind-boss"], ["portal-playboy", "crow-banker", "navigation-pixie", "pig-captain"],
      ["Ascended", "Godlike", "Ascended", "Godlike"], ["Divine", "Godly", "Cosmic", "Divine"], ["ascendant", "limitless", "awakened", "sage-mode"], [G10, [8, 8, 8, 8], G10, G10]),
  };
  T.boss.from = "Guild Boss team"; T.a.from = "Arena team"; T.b.from = "Rival team";
  let STAGE = 448;
  const BOSS_ID = "quirk-thief-overlord", BOSS_ATK_448 = 460425250;
  const bossAtk = (st) => BOSS_ATK_448 * Math.pow(1.006, st - 448);   // placeholder until the owner sends 2–3 stages
  // final numbers of a team: deck buffs + trait + grade (js/deckbuff.js) · then custom
  function stats(key) {
    const d = T[key], res = C.deckBuff.compute(d);
    return res.map((r, i) => (r ? { ...r, real: { atk: r.atk, hp: r.hp }, atk: d.custom[i] && d.custom[i].atk != null ? d.custom[i].atk : r.atk, hp: d.custom[i] && d.custom[i].hp != null ? d.custom[i].hp : r.hp } : null));
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
    requestAnimationFrame(() => root.querySelectorAll(".dk-nm span").forEach(fitName));
    const fromEl = $(`[data-team-from="${key}"]`); if (fromEl) fromEl.textContent = d.from;
    if (flash) { const el = $(`.dk-slot[data-kind="${flash.kind}"][data-i="${flash.i}"]`, root); if (el && !reduced()) FX.flash(el); }
    if (key === "a" || key === "b") clearSim();
  }
  function slotEl(key, kind, i, st) {
    const d = T[key], id = d[kind][i], x = id ? lookup(kind, id) : null, r = rarityOf(d, kind, i);
    const slot = document.createElement("div");
    slot.className = "dk-slot" + (id ? "" : " is-empty");
    slot.dataset.kind = kind; slot.dataset.i = i; slot.dataset.team = key;
    const nm = id ? (x ? x.name : id) : kind === "cards" ? `Slot ${i + 1}` : "";
    slot.innerHTML = `<div class="dk-nm${id ? " is-name" : ""}"><span>${esc(nm)}</span></div><div class="dk-slot__box"></div><div class="dk-info"${id ? "" : " hidden"}>${id ? pillsHTML(kind, d, i, id) : ""}</div>`;
    const box = $(".dk-slot__box", slot);
    if (id && x) {
      const item = document.createElement("div");
      item.className = "dk-item" + (sel && sel.key === key && sel.kind === kind && sel.i === i ? " is-selected" : "");
      item.tabIndex = 0; item.setAttribute("role", "button"); item.dataset.id = id;
      item.setAttribute("aria-label", `${x.name}, ${kind === "cards" ? "slot" : "support"} ${i + 1}`);
      const card = cardEl(kind, x, r);
      if (kind === "cards") {
        paintTG(card, d.trait[i], overallOf(d.grades[i]));
        if (st[i]) C.setCardNums(card, { atk: st[i].atk, hp: st[i].hp }, { animate: false });
      }
      item.appendChild(scaled(card));
      box.appendChild(item);
      const xb = document.createElement("button");
      xb.type = "button"; xb.className = "dk-x fx-press"; xb.dataset.bt = "clear"; xb.setAttribute("aria-label", `Remove ${x.name}`);
      xb.innerHTML = `<span class="dk-x__dot">${ICON.x}</span>`;
      slot.appendChild(xb);
      if (kind === "cards" && st[i] && (st[i].atkPct || st[i].hpPct)) {
        const f = document.createElement("button");
        f.type = "button"; f.className = "dk-buff fx-press"; f.dataset.bt = "buff";
        const line = (lab, v) => (v ? `<span class="dk-buff__l"><i>${lab}</i> ${esc(pctTxt(v))}</span>` : "");
        f.innerHTML = `<svg class="dk-buff__ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 9h-4.5v7h-5v-7H5z" fill="currentColor"/></svg>${line("ATK", st[i].atkPct)}${line("HP", st[i].hpPct)}`;
        f.setAttribute("aria-label", `${x.name}: deck buffs ${buffText(st[i])}. Tap to see where they come from`);
        slot.appendChild(f);
      }
    } else if (id) {
      box.innerHTML = `<div class="dk-item dk-item--missing"><span class="tm-missing"><span>${esc(id)}</span><small>Not in the library</small></span></div>`;
    } else {
      box.innerHTML = `<button type="button" class="dk-add fx-press" data-bt="add" aria-label="Add ${kind === "cards" ? "a card" : "a support card"} to slot ${i + 1}">${ICON.plus}<span>Add</span></button>`;
    }
    return slot;
  }
  function place(key, kind, i, id) {
    const d = T[key];
    d[kind][i] = id;
    if (!d[RKEY[kind]][i]) d[RKEY[kind]][i] = "Godly";
    if (kind === "cards") { d.trait[i] = null; d.grades[i] = null; d.custom[i] = null; }
  }
  function swap(key, kind, a, b) {
    const d = T[key], sw = (arr) => { [arr[a], arr[b]] = [arr[b], arr[a]]; };
    sw(d[kind]); sw(d[RKEY[kind]]);
    if (kind === "cards") { sw(d.trait); sw(d.grades); sw(d.custom); }
  }
  function clearSlot(key, kind, i) {
    const d = T[key]; d[kind][i] = null;
    if (kind === "cards") { d.trait[i] = null; d.grades[i] = null; d.custom[i] = null; }
    paintBoard(key); FX.toast("Removed");
  }

  /* ---------- Buff list (copy of js/deck.js buffDialog) ---------- */
  function buffDialog(key, i) {
    const r = stats(key)[i], card = r && lookup("cards", r.id);
    if (!card) return;
    const kindName = { card: "Card", support: "Support", trait: "Trait", grade: "Grade" };
    const val = (x) => (x.kind === "trait"
      ? (x.mA === x.mH ? `×${x.mA} ATK·HP` : [x.mA !== 1 ? `×${x.mA} ATK` : "", x.mH !== 1 ? `×${x.mH} HP` : ""].filter(Boolean).join(" · "))
      : x.kind === "grade" && x.atk === x.hp ? `${pctTxt(x.atk)} ATK·HP`
      : [x.atk ? `${pctTxt(x.atk)} ATK` : "", x.hp ? `${pctTxt(x.hp)} HP` : ""].filter(Boolean).join(" · "));
    const rows = r.from.map((x) => `<li class="dk-bf__row" data-kind="${x.kind}"><span class="dk-bf__src">${esc(x.name)}${x.n > 1 ? ` <b>×${x.n}</b>` : ""}</span><span class="dk-bf__kind">${kindName[x.kind]}</span><span class="dk-bf__val">${esc(val(x))}</span></li>`).join("");
    const stat = (label, base, v) => `<div class="dk-bf__stat"><span class="dk-bf__lab">${label}</span>
        <span class="dk-bf__nums"><span>${label === "HP" ? C.fmtHp(base) : C.fmtStat(base)}</span><span aria-hidden="true">→</span><b${v !== base ? ' class="is-up"' : ""}>${label === "HP" ? C.fmtHp(v) : C.fmtStat(v)}</b></span>
        <small>${v !== base ? "×" + Number((v / base).toFixed(2)) + " in total" : "No buff"}</small></div>`;
    const cus = T[key].custom[i];
    dialog({
      title: `${card.name} · Buffs`,
      html: `<div class="dk-bf"><div class="dk-bf__sum">${stat("ATK", r.base.atk, r.real.atk)}${stat("HP", r.base.hp, r.real.hp)}</div>
          <ul class="dk-bf__list">${rows}</ul>
          ${cus ? `<p class="tm-field__note bt-note--cus">Custom for battle: ${cus.atk != null ? "ATK " + C.fmtStat(cus.atk) : ""}${cus.atk != null && cus.hp != null ? " · " : ""}${cus.hp != null ? "HP " + C.fmtHp(cus.hp) : ""} (used instead of the numbers above).</p>` : ""}
          <p class="tm-field__note">Every buff multiplies. Buffs that need a hit, a turn or low HP aren't counted.</p></div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(dlg) { FX.stagger($(".dk-bf__list", dlg), 40, { cls: "fx-up", max: 8, cleanup: true }); },
    });
  }

  /* ==========================================================
     Slot sheet = js/deck.js slotSheet (Rarity · Grade 4 · Trait) + Custom HP / ATK (battle only)
     ========================================================== */
  function sheetHTML(key, kind, i) {
    const d = T[key], isCard = kind === "cards", id = d[kind][i], x = lookup(kind, id), r = rarityOf(d, kind, i);
    const chips = rarities().map((q) => `<button type="button" class="chip glass fx-press" data-ss-rarity="${esc(q)}" aria-pressed="${q === r}" style="--sw:${C.RARITY_SWATCH[q] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(q)}</button>`).join("");
    const btn = (act, icon, label, cls = "") => `<button type="button" class="tm-btn fx-press ${cls}" data-dlg="${act}">${icon}${label}</button>`;
    return `<div class="dk-ss" data-kind="${kind}">
        <div class="dk-ss__top"><div class="dk-ss__card" data-ss-card></div>
          <div class="dk-ss__sum"><p class="dk-ss__where">${isCard ? `Slot ${i + 1}` : `Support ${i + 1}`}</p>
            ${isCard ? `<p class="dk-ss__stat dk-ss__stat--atk"><span>ATK</span><b data-ss-atk></b></p><p class="dk-ss__stat dk-ss__stat--hp"><span>HP</span><b data-ss-hp></b></p><p class="dk-ss__buff" data-ss-buff></p>` : `<p class="dk-ss__fx" data-ss-fx></p>`}
          </div></div>
        <section class="dk-ss__sec" aria-label="Rarity"><h3 class="tm-field__label">Rarity</h3><div class="rarity-picker dk-ss__rar" role="group">${chips}</div></section>
        ${isCard ? tgSheetHTML() + cusHTML() : ""}
        <div class="dk-ss__acts">${btn("details", ICON.info, "Details")}${btn("replace", ICON.swap, isCard ? "Change card" : "Change support")}${btn("move", ICON.move, "Move")}${btn("remove", ICON.trash, "Remove", "tm-btn--danger")}</div>
      </div>`;
  }
  function tgSheetHTML() {
    const seg = (k, g) => `<button type="button" class="dk-g4__seg" style="--i:${g - 1}" data-ss-gk="${k}" data-ss-grade="${g}" aria-pressed="false" aria-label="${GSTATS[k]} grade ${g}"></button>`;
    // Status Damage isn't confirmed by a clip yet (owner 2026-11-04) · tag on its row
    const unconf = (k) => (k === 2 && !STATUS_OK ? ` <span class="bt-new bt-new--warn">Unconfirmed</span>` : "");
    const grades = GSTATS.map((name, k) => `<div class="dk-g4__row" data-ss-grow="${k}"><p class="dk-g4__name">${name}${unconf(k)}</p><span class="dk-g4__pct" data-ss-gp="${k}"></span>
        <div class="dk-g4__bar" role="group" aria-label="${name} grade">${Array.from({ length: GRADE_MAX }, (_, j) => seg(k, j + 1)).join("")}</div><b class="dk-g4__box" data-ss-gv="${k}"></b></div>`).join("");
    const traits = traitList().map((t) => `<button type="button" class="dk-tl__row" data-ss-trait="${esc(t.id)}" data-c="${t.color === "rainbow" ? "rainbow" : "solid"}" style="${traitColor(t)}" aria-pressed="false">
        ${traitIcon(t, "dk-tl__ic")}<span class="dk-tl__txt"><b class="dk-tl__n">${esc(t.name)}</b><small>${traitFx(t).map(esc).join(" · ")}</small></span><span class="dk-tl__tier">${esc(t.tier)}</span></button>`).join("");
    const rm = (what) => `<button type="button" class="dk-ss__rm fx-press" data-ss-rm="${what}" hidden>${ICON.x}Remove</button>`;
    return `<section class="dk-ss__sec" aria-label="Grade"><div class="dk-ss__h"><h3 class="tm-field__label">Grade</h3><b class="dk-g4__total" data-ss-gt></b></div>
        <p class="dk-g4__sum" data-ss-gsum>${GSUM}</p><div class="dk-g4">${grades}</div>
        <p class="tm-field__note bt-gfx" data-ss-gbt></p>
        <div class="dk-g4__acts"><button type="button" class="dk-ss__rm dk-ss__all fx-press" data-ss-all>All 10</button>${rm("grade")}</div></section>
      <section class="dk-ss__sec" aria-label="Trait"><div class="dk-ss__h"><h3 class="tm-field__label">Trait</h3>${rm("trait")}</div>
        <div class="dk-tl" role="group" aria-label="Trait">${traits}</div><p class="dk-tl__fx" data-ss-tfx hidden></p></section>`;
  }
  // NEW (battle only): type the HP / ATK yourself, any size · empty = the real number with the deck's buffs
  function cusHTML() {
    return `<section class="dk-ss__sec bt-cus" aria-label="Custom HP and ATK">
        <div class="dk-ss__h"><h3 class="tm-field__label">Custom HP / ATK <span class="bt-new">Battle only</span></h3><button type="button" class="dk-ss__rm fx-press" data-ss-cusrm hidden>${ICON.reset}Real value</button></div>
        <p class="tm-field__note">Any number, no limit. Leave empty to use the real number with the deck's buffs.</p>
        <div class="bt-cus__row">
          <label class="tm-field"><span class="tm-field__label">ATK</span><input class="tm-input bt-cus__in bt-cus__in--atk" id="bt-cus-atk" data-ss-cus="atk" inputmode="numeric" autocomplete="off" enterkeyhint="done"></label>
          <label class="tm-field"><span class="tm-field__label">HP</span><input class="tm-input bt-cus__in bt-cus__in--hp" id="bt-cus-hp" data-ss-cus="hp" inputmode="numeric" autocomplete="off" enterkeyhint="done"></label>
        </div><p class="bt-cus__err" data-ss-cuserr hidden>Type a whole number above 0, e.g. 2,673,635,400.</p></section>`;
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
        const paint = (animate) => {
          const r = rarityOf(d, kind, i);
          root.querySelectorAll("[data-ss-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ssRarity === r)));
          if (art._r !== r) { C.setCardRarity(art, x, r, { animate }); art._r = r; }
          if (!isCard) { const fx = $("[data-ss-fx]", root); if (fx) fx.textContent = x.effect && x.effect.desc ? C.supText(x, x.effect.desc, r) : ""; return; }
          const tId = d.trait[i], g4 = d.grades[i] || [0, 0, 0, 0], g = overallOf(g4), full = fullOf(g4);
          paintTG(art, tId, g);
          root.querySelectorAll("[data-ss-grade]").forEach((b) => { const v = g4[Number(b.dataset.ssGk)], n = Number(b.dataset.ssGrade); b.setAttribute("aria-pressed", String(n === v)); b.classList.toggle("is-on", n <= v); });
          root.querySelectorAll("[data-ss-grow]").forEach((row) => { row.dataset.tone = gradeTone(g4[Number(row.dataset.ssGrow)]); });
          root.querySelectorAll("[data-ss-gv]").forEach((e) => { const v = g4[Number(e.dataset.ssGv)]; e.textContent = v ? String(v) : "–"; });
          // "+x%" = what the card really gets (js/deckbuff.js gradePct) · the line under = what Defense / Status Damage do in a fight
          const gp = C.deckBuff.gradePct(g4), gpv = [gp.atk, gp.def, gp.status, gp.hp];
          root.querySelectorAll("[data-ss-gp]").forEach((e) => { const v = gpv[Number(e.dataset.ssGp)]; e.textContent = v ? `+${Number(v.toFixed(1))}%` : ""; });
          const gbt = $("[data-ss-gbt]", root);
          gbt.textContent = gp.def || gp.status ? `In battle: ${[gp.def ? `${Number((gp.def * DEF_K).toFixed(1))}% less damage taken (Defense × 0.2)` : "", gp.status ? `+${Number(gp.status.toFixed(1))}% burn / poison / bleed damage${STATUS_OK ? "" : " (unconfirmed)"}` : ""].filter(Boolean).join(" · ")}.` : "";
          gbt.hidden = !gbt.textContent;
          const gt = $("[data-ss-gt]", root), gsum = $("[data-ss-gsum]", root), all = $("[data-ss-all]", root);
          gt.textContent = g ? `GRADE ${g}` : "NO GRADE"; gt.dataset.tone = full ? "mint" : gradeTone(g);
          gsum.textContent = full ? GSUM_FULL : GSUM; gsum.classList.toggle("is-full", full);
          all.hidden = full;
          root.querySelectorAll("[data-ss-trait]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ssTrait === tId)));
          $('[data-ss-rm="grade"]', root).hidden = !g; $('[data-ss-rm="trait"]', root).hidden = !tId;
          const t = tId ? traitById(tId) : null, tfx = $("[data-ss-tfx]", root);
          tfx.hidden = !t; tfx.innerHTML = t ? `<b>${esc(t.name)}</b> <span>${esc(t.tier)}</span> · ${traitFx(t).map(esc).join(" · ")}` : "";
          const s = stats(key)[i], cus = d.custom[i];
          if (s) {
            C.setCardNums(art, { atk: s.atk, hp: s.hp }, { animate });
            const sa = $("[data-ss-atk]", root), sh = $("[data-ss-hp]", root);
            sa.textContent = C.fmtStat(s.atk); sh.textContent = C.fmtHp(s.hp);
            $("[data-ss-buff]", root).innerHTML = (s.atkPct || s.hpPct ? `<span>Buffs</span> <b>${esc(buffText(s))}</b>` : "") + (cus ? ` <span class="bt-cus__tag">Custom</span>` : "");
            if (animate && !reduced()) { FX.flash(sa.parentNode); FX.flash(sh.parentNode); }
            [["atk", s.real.atk], ["hp", s.real.hp]].forEach(([k, realV]) => {
              const inp = $(`[data-ss-cus="${k}"]`, root); if (document.activeElement === inp) return;
              const v = cus && cus[k] != null ? cus[k] : null;
              inp.value = v != null ? fmt(v) : ""; inp.placeholder = fmt(realV); inp.classList.toggle("is-custom", v != null);
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
          if (rb) { const r = rb.dataset.ssRarity; if (r !== rarityOf(d, kind, i)) commit((dd) => { dd[RKEY[kind]][i] = r; }); return; }
          if (!isCard) return;
          const gb = e.target.closest("[data-ss-grade]"), tb = e.target.closest("[data-ss-trait]"), rm = e.target.closest("[data-ss-rm]"), al = e.target.closest("[data-ss-all]"), cr = e.target.closest("[data-ss-cusrm]");
          if (al) commit((dd) => { dd.grades[i] = [10, 10, 10, 10]; });
          else if (gb || (rm && rm.dataset.ssRm === "grade")) commit((dd) => {
            if (!gb) { dd.grades[i] = null; return; }
            const k = Number(gb.dataset.ssGk), g = Number(gb.dataset.ssGrade), g4 = (dd.grades[i] || [0, 0, 0, 0]).slice();
            g4[k] = g4[k] === g ? 0 : g; dd.grades[i] = g4.some((n) => n > 0) ? g4 : null;
          });
          else if (tb || (rm && rm.dataset.ssRm === "trait")) { const t = tb ? tb.dataset.ssTrait : null; commit((dd) => { dd.trait[i] = dd.trait[i] === t ? null : t; }); }
          else if (cr) { commit((dd) => { dd.custom[i] = null; }); FX.toast("Back to the real value"); }
        });
        // custom HP / ATK: on change (Enter / leaving the box) · empty = real value
        root.addEventListener("change", (e) => {
          const inp = e.target.closest("[data-ss-cus]"); if (!inp) return;
          const k = inp.dataset.ssCus, txt = String(inp.value).replace(/[,\s_]/g, ""), err = $("[data-ss-cuserr]", root);
          if (txt === "") { commit((dd) => { const c = { ...(dd.custom[i] || {}) }; delete c[k]; dd.custom[i] = Object.keys(c).length ? c : null; }); err.hidden = true; return; }
          const v = Number(txt);
          if (!Number.isFinite(v) || v < 1 || !/^\d+(\.\d+)?$/.test(txt)) { err.hidden = false; if (!reduced()) FX.flash(inp.parentNode); return; }
          err.hidden = true;
          commit((dd) => { dd.custom[i] = { ...(dd.custom[i] || {}), [k]: Math.round(v) }; });
          inp.blur();
        });
        root.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.closest("[data-ss-cus]")) { e.preventDefault(); e.target.dispatchEvent(new Event("change", { bubbles: true })); } });
      },
    });
    sheetOpen = false;
    if (!res) return;
    if (res.action === "details") C.openCard(id, null);
    else if (res.action === "replace") openPicker(key, kind, i);
    else if (res.action === "move") { sel = { key, kind, i }; paintBoard(key); FX.toast("Tap the slot to move it to"); }
    else if (res.action === "remove") clearSlot(key, kind, i);
  }

  /* ---------- Picker (cards: the live list · support: data/pending/support.json) ---------- */
  async function openPicker(key, kind, i) {
    const list = kind === "cards" ? state.cards : state.support;
    const tiles = list.map((x) => `<button type="button" class="bt-pk__t fx-press" data-pick="${esc(x.id)}" data-q="${esc(x.name.toLowerCase())}"><img src="${esc(thumbOf(kind, x))}" alt="" loading="lazy" decoding="async"><span>${esc(x.name)}</span></button>`).join("");
    const res = await dialog({
      title: kind === "cards" ? "Pick a card" : "Pick a support",
      html: `<label class="tm-field"><span class="tm-field__label">Search</span><input class="tm-input" id="bt-pk-q" data-pk-q placeholder="Name" autocomplete="off"></label><div class="bt-pk" data-pk-grid>${tiles}</div>`,
      actions: [{ label: "Cancel", value: "cancel" }],
      onMount(dlg, finish) {
        $("[data-pk-q]", dlg).addEventListener("input", (e) => { const q = e.target.value.trim().toLowerCase(); $$("[data-pick]", dlg).forEach((b) => { b.hidden = q && !b.dataset.q.includes(q); }); });
        $("[data-pk-grid]", dlg).addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) finish({ action: "pick", id: b.dataset.pick }); });
      },
    });
    if (!res || res.action !== "pick") return;
    place(key, kind, i, res.id);
    paintBoard(key, { flash: { kind, i } });
  }

  /* ---------- Load from My Decks (the owner, round 3: use a team made on the Deck page) ---------- */
  function myDecks() { try { const a = JSON.parse(localStorage.getItem("cbi:decks") || "[]"); return Array.isArray(a) ? a.filter((d) => d && Array.isArray(d.cards)) : []; } catch (e) { return []; } }
  async function loadDeck(key) {
    const decks = myDecks();
    const rows = decks.map((d, n) => `<button type="button" class="bt-dl__row fx-press" data-deck="${n}">
        <span class="bt-dl__imgs">${[0, 1, 2, 3].map((i) => { const x = d.cards[i] && lookup("cards", d.cards[i]); return x ? `<img src="${esc(thumbOf("cards", x))}" alt="">` : `<i></i>`; }).join("")}</span>
        <span class="bt-dl__txt"><b>${esc(d.name || "Deck")}</b><small>${d.cards.filter(Boolean).length} cards · ${(d.support || []).filter(Boolean).length} support</small></span></button>`).join("");
    const res = await dialog({
      title: "Load from My Decks",
      html: decks.length ? `<p class="tm-field__note">Copies the deck's cards, support, rarity, grade and trait. Your saved deck doesn't change.</p><div class="bt-dl">${rows}</div>`
        : `<div class="empty"><p class="empty__title">No decks yet</p><p class="empty__text">Make a team on the Deck page first, then load it here.</p></div>`,
      actions: decks.length ? [{ label: "Cancel", value: "cancel" }] : [{ label: "Open Deck", value: "deck", cls: "tm-btn--primary" }, { label: "Close", value: "cancel" }],
      onMount(dlg, finish) { dlg.addEventListener("click", (e) => { const b = e.target.closest("[data-deck]"); if (b) finish({ action: "load", n: Number(b.dataset.deck) }); }); },
    });
    if (!res) return;
    if (res.action === "deck") { location.hash = "deck"; return; }
    const src = decks[res.n]; if (!src) return;
    const d = T[key];
    for (let i = 0; i < SLOTS; i++) {
      d.cards[i] = src.cards[i] || null; d.support[i] = (src.support || [])[i] || null;
      d.cardRarity[i] = C.deckBuff.rarityOf(src, "cards", i); d.supRarity[i] = C.deckBuff.rarityOf(src, "support", i);
      d.trait[i] = Array.isArray(src.trait) ? src.trait[i] || null : null;
      const g = Array.isArray(src.grades) ? src.grades[i] : null; d.grades[i] = Array.isArray(g) && g.some((n) => n > 0) ? g.slice(0, 4) : null;
      d.custom[i] = null;
    }
    d.from = "From My Decks: " + (src.name || "Deck");
    paintBoard(key);
    if (!reduced()) FX.flash($(`[data-board="${key}"]`));
    FX.toast(`Loaded “${src.name || "Deck"}”`);
  }

  /* ==========================================================
     ENGINE (demo of step ② js/battle.js) — §14 rules: we hit first · 30 rounds · tie-break cards alive → team HP → front HP
     Start numbers = stats() (real deck buffs + trait + grade, or custom). Skills: demo data for 8 cards + the boss.
     Supports: only effects that need a hit / a turn (the ones without a condition are already in deckbuff's numbers).
     ========================================================== */
  const SKILL = {
    "divergent-fist-vessel": { bf: { p: .15, per: .10, max: 3, m: 2.5 }, ignore: 1, survive: 1, onHitAtk: .08 },
    "sword-saint": { revive: .53, ignore: 1, first: 1.8 },
    "octopus-teacher": { dodge: .38, double: { p: .69, m: .8 }, regen: .069, survive: 1 },
    "founding-titan": { splash: .2, weaken: 1 - .077, dr: .091 },
    "ant-king": { killGain: .25, adapt: .12, regen: .041, perTurn: { v: .049, n: 10 } },
    "slime-demon-lord": { copy: 1, killGain: .11, dodge: .14 },
    "golden-wind-boss": { reflect: .31, early: { dr: .44, n: 3 }, lifesteal: .19, killGain: .12 },
    // "7.4% less damage" on the card = ATK × 0.93 in the clip (owner 2026-11-04: DFV 2,661,922,940 → 2,475,588,334 · the old
    // "÷ 1.08" was wrong: 2,673,635,400 is the clip's number AFTER the 1st hit, 2,475,588,334 + 8%)
    "quirk-thief-overlord": { copy: 1, killGain: .11, weaken: .93 },
  };
  /* Measured on the owner's Guild Boss clip (12 fights · owner 2026-11-04):
     · every hit rolls ±12% around ATK (seen 0.88–1.11 · mean 1.00) -> ROLL
     · Grade Defense cuts damage taken by Defense% × 0.2 (Defense 10 + all four = 55% -> 11% less · DFV Limitless + Defense took
       0.80 of the boss's ATK on average) -> DEF_K
     · Grade Status Damage = more damage from statuses (burn / poison / bleed) by its % · NOT confirmed by a clip yet
     · Spirit Wave Master: every 2nd attack hits again for 189.34% of the 1st hit (the clip's rarity, assumed Godly: ask q9) ·
       other rarities = the value on the card (C.supValAt) */
  const ROLL = .12, DEF_K = .2, ECHO_CLIP = { rarity: "Godly", v: 189.34 };
  const STATUS_OK = false;   // Status Damage not confirmed by a clip yet (the slot sheet says "Unconfirmed")
  const TRAITFX = { ascendant: { crit: [.2, 2.5], revive: .5 }, limitless: { dodge: .12, dr: .10 }, "sage-mode": { lifesteal: .12, shield: .15 }, awakened: { crit: [.15, 2] },
    undying: { revive: .3 }, prodigy: { firstAll: .3 }, "keen-eye": { crit: [.12, 2] }, bloodlust: { lifesteal: .08 }, "iron-body": { dr: .06 }, nimble: { dodge: .05 } };
  // support effects that need a hit / a turn: value = the support's own value at its slot's rarity (C.supValAt)
  const SUPFX = { "gate-healer": "teamHeal", "cafe-owner-owl": "lifesteal", "plant-healer": "hitHeal", "spirit-sidekick": "onHitAtk", "portal-playboy": "dodge", "crow-banker": "mark", "pig-captain": "lucky",
    "spirit-wave-master": "echo" };
  function supFx(d, i) {
    const id = d.support[i], s = id && lookup("support", id), k = id && SUPFX[id];
    if (!s || !k) return null;
    const sr = rarityOf(d, "support", i);
    let v = Number(C.supValAt(s, 0, sr)) / 100;
    if (id === "gate-healer" && d.custom.some(Boolean)) v = .06;   // mockup: the clip's heal +567,664,559 ≈ 6% of DFV's 9.5B (source still unknown)
    if (k === "echo" && sr === ECHO_CLIP.rarity) v = ECHO_CLIP.v / 100;   // measured in the clip (189.34% of the 1st hit)
    return { name: s.name, eff: s.effect.name, b: { [k]: v } };
  }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mkTeamUnits(key, side) {
    const d = T[key], st = stats(key), out = [];
    d.cards.forEach((id, i) => {
      const x = id && lookup("cards", id); if (!x || !st[i]) return;
      const b = SKILL[id], t = d.trait[i] ? traitById(d.trait[i]) : null, tfx = t ? TRAITFX[t.id] || {} : {};
      out.push(mkUnit({ id, x, side, idx: out.length, slot: i, rar: rarityOf(d, "cards", i), trait: t ? { ...t, fx: tfx } : null, grade: overallOf(d.grades[i]),
        sup: supFx(d, i), b, atk: st[i].atk, hp: st[i].hp,
        // Grade in battle (js/deckbuff.js gradePct): Defense% × 0.2 less damage taken · Status Damage% more status damage
        gdef: (st[i].grade.def / 100) * DEF_K, gstatus: 1 + st[i].grade.status / 100 }));
    });
    return out;
  }
  function mkUnit(o) {
    return { ...o, name: o.x.name, skill: o.x.passive ? o.x.passive.name : "", sim: !!o.b, inf: !!o.inf, kBase: o.b ? { ...o.b } : {}, k: o.b ? { ...o.b } : {},
      gdef: o.gdef || 0, gstatus: o.gstatus || 1, dots: {},
      atk0: o.atk, atk: o.atk, max: o.hp, hp: o.hp, zone: 0, alive: true, used: {}, seen: new Set(), firstOn: new Set(), adaptMap: new Map(), hitsTaken: 0, turns: 0,
      shield: o.trait && o.trait.fx.shield ? o.hp * o.trait.fx.shield : 0, marked: 0, copied: null,
      st: { dmg: 0, hits: 0, crit: 0, heal: 0, taken: 0, sup: 0, kills: 0, died: 0, procs: {} } };
  }
  function bossUnit() {
    const x = lookup("cards", BOSS_ID);
    return mkUnit({ id: BOSS_ID, x, side: "b", idx: 0, slot: 0, rar: "Normal", trait: null, grade: 0, sup: null, b: SKILL[BOSS_ID], atk: bossAtk(STAGE), hp: Infinity, inf: true });
  }
  class Battle {
    constructor(aKey, bKey, opt = {}) {
      this.R = rng(opt.seed || 1); this.E = opt.log || null; this.boss = !!opt.boss;
      this.a = mkTeamUnits(aKey, "a");
      this.b = this.boss ? [bossUnit()] : mkTeamUnits(bKey, "b");
      this.round = 1; this.turn = "a"; this.done = false; this.why = "";
    }
    ev(t, u, v, o) { if (this.E) this.E({ t, u, v, o }); }
    front(side) { return this[side].find((u) => u.alive) || null; }
    alive(side) { return this[side].filter((u) => u.alive).length; }
    proc(u, name, ok, p) { const r = u.st.procs[name] || (u.st.procs[name] = { n: 0, exp: 0 }); if (ok) r.n++; r.exp += p; }
    start() {
      for (const side of ["a", "b"]) {
        const foe = side === "a" ? "b" : "a";
        // "starts with X% less damage": the enemy team's ATK × weaken (the clip: × 0.93)
        for (const u of this[side]) if (u.k.weaken) { for (const f of this[foe]) { f.atk *= u.k.weaken; f.atk0 = f.atk; } this.ev("shout", this.front(foe), "-" + ((1 - u.k.weaken) * 100).toFixed(1) + "% DMG", { k: "debuff" }); }
      }
      this.ev("nums", this.front("a")); this.ev("nums", this.front("b"));
    }
    heal(u, v, src) { if (u.inf || !u.alive || v <= 0) return 0; const h = Math.min(Math.round(v), u.max - u.hp); if (h <= 0) return 0; u.hp += h; u.st.heal += h; this.ev("heal", u, h, { src }); return h; }
    startTurn(u) {
      u.turns++;
      if (u.k.regen) this.heal(u, u.max * u.k.regen, "skill");
      if (u.k.perTurn && u.turns <= u.k.perTurn.n) { const g = u.atk0 * u.k.perTurn.v; u.atk += g; this.ev("buff", u, g); }
      if (u.sup && u.sup.b.teamHeal) {
        u.st.sup++; let any = false;
        for (const x of this[u.side]) if (x.alive && !x.inf && x.hp < x.max) { const h = Math.min(Math.round(x.max * u.sup.b.teamHeal), x.max - x.hp); x.hp += h; u.st.heal += h; if (x === u) this.ev("heal", u, h, { src: "sup" }); any = true; }
        if (any) this.ev("shout", u, u.sup.eff.toUpperCase(), { k: "heal", y: "88%" });
      }
      // statuses on this card tick at the start of its turn (burn / poison / bleed: % of its max HP per stack × the giver's
      // Grade Status Damage · an infinite-HP boss: not known yet, nothing)
      for (const [kind, s] of Object.entries(u.dots)) {
        if (!u.inf) { const v = Math.max(1, Math.round(u.max * s.pct * s.stacks * s.mult)); u.hp -= v; u.st.taken += v; if (s.src) s.src.st.dmg += v; this.ev("dmg", u, v, { status: kind }); }
        if (--s.left <= 0) delete u.dots[kind];
      }
    }
    // a status from a skill (field dot: { kind, add, pct, max, turns }) · stacks up to max, every new stack resets the turns
    addDot(a, d, dot) {
      const s = d.dots[dot.kind] || (d.dots[dot.kind] = { stacks: 0, pct: dot.pct, left: 0, mult: 1, src: a });
      s.stacks = Math.min(dot.max, s.stacks + (dot.add || 1)); s.left = dot.turns; s.mult = a.gstatus; s.src = a;
      this.ev("shout", d, dot.kind.toUpperCase() + " x" + s.stacks, { k: "debuff", y: "70%" });
    }
    // Spirit Wave Master (support · echo): the supported card's every 2nd attack hits again for v × the 1st hit
    echo(a, d, first) {
      if (!(first > 0) || !d.alive) return;
      const v = Math.max(1, Math.round(first * a.sup.b.echo));
      a.st.dmg += v; a.st.sup++; d.st.taken += v;
      if (!d.inf) { let left = v; if (d.shield > 0) { const s = Math.min(d.shield, left); d.shield -= s; left -= s; } d.hp -= left; }
      this.ev("shout", a, a.sup.eff.toUpperCase() + "!", { k: "extra", y: "26%" });
      this.ev("dmg", d, v, { extra: true });
    }
    hit(a, d, m0, extra) {
      const R = this.R;
      if (!a.k.ignore) {
        const ds = [];
        if (d.k.dodge) ds.push([(d.copied || d.skill) + " dodge", d.k.dodge, "k"]);
        if (d.trait && d.trait.fx.dodge) ds.push([d.trait.name + " dodge", d.trait.fx.dodge, "t"]);
        if (d.sup && d.sup.b.dodge) ds.push([d.sup.eff, d.sup.b.dodge, "s"]);
        for (const [nm, p, src] of ds) { const ok = R() < p; this.proc(d, nm, ok, p); if (ok) { if (src === "s") d.st.sup++; this.ev("dodge", d); this.ev("shout", d, "DODGE!", { k: "dodge" }); return 0; } }
      }
      let m = m0, crit = false, heavy = false;
      const bf = a.k.bf;
      if (bf) {
        const p = a.zone >= bf.max ? 1 : Math.min(1, bf.p + bf.per * a.zone), ok = R() < p;
        this.proc(a, a.copied || a.skill, ok, p);
        if (ok) { m *= bf.m; crit = heavy = true; this.ev("shout", a, (a.copied || a.skill).toUpperCase() + "!", { k: "skill" });
          if (a.zone < bf.max) { a.zone++; this.ev("zone", a, a.zone); if (a.zone === bf.max) this.ev("shout", a, "ZONE!", { k: "zone", y: "30%" }); } }
      }
      const tc = a.trait && a.trait.fx.crit;
      if (tc) { const ok = R() < tc[0]; this.proc(a, a.trait.name + " crit", ok, tc[0]); if (ok) { m *= tc[1]; crit = true; this.ev("shout", a, "CRIT!", { k: "crit", y: "30%" }); } }
      if (a.k.first && !a.firstOn.has(d)) { a.firstOn.add(d); m *= a.k.first; heavy = true; this.ev("shout", a, a.skill.toUpperCase() + "!", { k: "skill" }); }
      if (a.trait && a.trait.fx.firstAll && !a.used.firstAll) { a.used.firstAll = 1; m *= 1 + a.trait.fx.firstAll; }
      // every hit rolls ±12% around ATK (the clip: 0.88–1.11, mean 1.00)
      let dmg = a.atk * m * (1 + d.marked) * (1 - ROLL + R() * 2 * ROLL);
      // damage cut: skill + trait + Grade Defense (Defense% × 0.2) · they add up
      let dr = (d.k.dr || 0) + ((d.trait && d.trait.fx.dr) || 0) + d.gdef;
      if (d.k.early && d.hitsTaken < d.k.early.n) dr += d.k.early.dr;
      if (d.k.adapt) { const seen = d.adaptMap.get(a) || 0; dr += Math.min(3, seen) * d.k.adapt; d.adaptMap.set(a, seen + 1); }
      dmg = Math.max(1, Math.round(dmg * Math.max(0, 1 - dr)));
      if (a.sup && a.sup.b.mark && !d.marked) { d.marked = a.sup.b.mark; a.st.sup++; }
      a.st.dmg += dmg; a.st.hits++; if (crit) a.st.crit++;
      d.hitsTaken++; d.st.taken += dmg;
      if (!d.inf) { let left = dmg; if (d.shield > 0) { const s = Math.min(d.shield, left); d.shield -= s; left -= s; } d.hp -= left; }
      this.ev("dmg", d, dmg, { crit, heavy: heavy || (!d.inf && dmg > d.max * .25), extra });
      // the defender reacts before a copy (the clip: the boss copies after the 1st hit, so it grows 29 times)
      if (d.k.onHitAtk) { const g = d.atk0 * d.k.onHitAtk; d.atk += g; this.ev("buff", d, g); }
      if (d.sup && d.sup.b.onHitAtk) { const g = d.atk0 * d.sup.b.onHitAtk; d.atk += g; d.st.sup++; if (!d.k.onHitAtk) this.ev("buff", d, g); }
      if (d.sup && d.sup.b.hitHeal && !d.inf && d.hp > 0) { d.st.sup++; this.heal(d, dmg * d.sup.b.hitHeal, "sup"); }
      if (a.k.dot && !d.inf) this.addDot(a, d, a.k.dot);
      if (d.k.copy && a.sim && !d.seen.has(a.id)) {
        d.seen.add(a.id); const keep = { copy: 1, killGain: d.kBase.killGain, weaken: d.kBase.weaken };
        d.k = { ...a.kBase, ...keep }; d.copied = a.skill; d.zone = 0; this.ev("shout", d, "COPIED " + a.skill.toUpperCase() + "!", { k: "copy", y: "24%" }); this.ev("copy", d);
      }
      if (d.k.reflect && !a.inf) { const r = Math.round(dmg * d.k.reflect); a.hp -= r; a.st.taken += r; this.ev("dmg", a, r, { reflect: 1 }); }
      const ls = (a.k.lifesteal || 0) + ((a.trait && a.trait.fx.lifesteal) || 0) + ((a.sup && a.sup.b.lifesteal) || 0);
      if (ls && !a.inf && a.hp > 0) { if (a.sup && a.sup.b.lifesteal) a.st.sup++; this.heal(a, dmg * ls, "ls"); }
      if (a.k.splash) { const base = dmg / m; for (const x of this[d.side]) if (x.alive && x !== d && !x.inf) { const s = Math.round(base * a.k.splash); x.hp -= s; x.st.taken += s; a.st.dmg += s; this.checkDeath(x, a, true); } this.ev("bench", d); }
      return dmg;
    }
    checkDeath(u, killer, bench) {
      if (u.inf || !u.alive || u.hp > 0) return false;
      if (u.k.survive && !u.used.survive) { u.used.survive = 1; u.hp = 1; this.ev("shout", u, "SURVIVED!", { k: "skill" }); this.ev("nums", u); return false; }
      if (u.sup && u.sup.b.lucky && !u.used.lucky) { u.used.lucky = 1; const ok = this.R() < u.sup.b.lucky; this.proc(u, u.sup.eff, ok, u.sup.b.lucky); if (ok) { u.hp = 1; u.st.sup++; this.ev("shout", u, "HOLD ON!", { k: "heal" }); this.ev("nums", u); return false; } }
      const rv = u.k.revive || (u.trait && u.trait.fx.revive);
      if (rv && !u.used.revive) { u.used.revive = 1; u.hp = Math.round(u.max * rv); this.ev("shout", u, "REVIVED!", { k: "heal" }); this.ev("heal", u, u.hp, { src: "revive" }); return false; }
      u.alive = false; u.hp = 0; u.st.died = 1;
      if (killer && killer.alive) {
        killer.st.kills++;
        if (killer.k.killGain) { const g = u.atk0 * killer.k.killGain, h = isFinite(u.max) ? Math.round(u.max * killer.k.killGain) : 0;
          killer.atk += g; killer.atk0 += g; if (!killer.inf) { killer.max += h; killer.hp += h; } this.ev("buff", killer, g); this.ev("shout", killer, "+" + Math.round(killer.k.killGain * 100) + "% STOLEN", { k: "skill", y: "86%" }); }
      }
      this.ev(bench ? "benchdie" : "die", u); return true;
    }
    step() {
      if (this.done) return true;
      const side = this.turn, foe = side === "a" ? "b" : "a", a = this.front(side), d = this.front(foe);
      if (a && d) {
        this.startTurn(a);
        // a status can finish the attacker before it swings: the next card comes in, the turn passes
        if (this.checkDeath(a, (Object.values(a.dots)[0] || {}).src || d)) {
          if (this.front(side)) this.ev("enter", this.front(side));
          if (!this.front(side)) return this.finish();
          if (side === "b") { this.round++; if (this.round > 30) { this.round = 30; return this.finish(); } this.ev("round", null, this.round); }
          this.turn = foe; return false;
        }
        this.ev("atk", a);
        const first = this.hit(a, d, 1, false);
        if (a.sup && a.sup.b.echo && a.turns % 2 === 0) this.echo(a, d, first);
        let dDead = this.checkDeath(d, a), aDead = this.checkDeath(a, d);
        const dbl = a.k.double;
        if (dbl && a.alive && d.alive) { const ok = this.R() < dbl.p; this.proc(a, (a.copied || a.skill) + " extra hit", ok, dbl.p);
          if (ok) { this.ev("shout", a, "EXTRA HIT", { k: "extra", y: "26%" }); this.ev("atk", a); this.hit(a, d, dbl.m, true); dDead = this.checkDeath(d, a) || dDead; aDead = this.checkDeath(a, d) || aDead; } }
        if (dDead && this.front(foe)) this.ev("enter", this.front(foe));
        if (aDead && this.front(side)) this.ev("enter", this.front(side));
      }
      if (!this.front("a") || !this.front("b")) return this.finish();
      if (side === "b") { this.round++; if (this.round > 30) { this.round = 30; return this.finish(); } this.ev("round", null, this.round); }
      this.turn = foe; return false;
    }
    finish() {
      this.done = true;
      const A = this.alive("a"), B = this.alive("b");
      if (this.boss) { this.win = A ? "end" : "lose"; this.why = A ? "30 rounds done" : "Your team was wiped"; return true; }
      if (!A && !B) { this.win = "draw"; this.why = "Both teams fell"; return true; }
      if (!B) { this.win = "win"; this.why = "Enemy team wiped in round " + this.round; return true; }
      if (!A) { this.win = "lose"; this.why = "Your team was wiped in round " + this.round; return true; }
      const thp = (s) => { const t = this[s]; return t.reduce((x, u) => x + Math.max(0, u.hp), 0) / t.reduce((x, u) => x + u.max, 0); };
      const fhp = (s) => { const f = this.front(s); return f ? f.hp / f.max : 0; };
      if (A !== B) { this.win = A > B ? "win" : "lose"; this.why = "30 rounds · cards alive " + A + " vs " + B; }
      else if (Math.abs(thp("a") - thp("b")) > 1e-9) { this.win = thp("a") > thp("b") ? "win" : "lose"; this.why = "30 rounds · same cards alive · team HP " + pct(thp("a")) + " vs " + pct(thp("b")); }
      else if (Math.abs(fhp("a") - fhp("b")) > 1e-9) { this.win = fhp("a") > fhp("b") ? "win" : "lose"; this.why = "30 rounds · front card HP " + pct(fhp("a")) + " vs " + pct(fhp("b")); }
      else { this.win = "draw"; this.why = "30 rounds · all equal"; }
      return true;
    }
    run() { this.start(); while (!this.step()); return this; }
  }

  /* ==========================================================
     SOUND (Web Audio, made in code · starts after FIGHT · mute kept in cbi:battleMute)
     ========================================================== */
  const SND = {
    ctx: null, muted: store.get("cbi:battleMute") === "1", last: 0,
    unlock() { if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; } try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } },
    tone(f1, f2, dur, type, vol, delay = 0) {
      const c = this.ctx; if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, freq) {
      const c = this.ctx; if (!c) return; const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f).connect(g).connect(c.destination); s.start();
    },
    play(kind) {
      if (this.muted || !this.ctx) return; const now = performance.now(); if (now - this.last < 45 && kind !== "win") return; this.last = now;
      if (kind === "hit") { this.noise(.09, .35, 1800); this.tone(150, 50, .14, "sine", .5); }
      else if (kind === "crit") { this.noise(.16, .5, 4000); this.tone(220, 40, .25, "sawtooth", .25); this.tone(880, 1320, .12, "square", .08, .02); }
      else if (kind === "heal") { this.tone(660, 700, .12, "sine", .18); this.tone(990, 1040, .16, "sine", .14, .07); }
      else if (kind === "buff") { this.tone(400, 900, .16, "triangle", .14); }
      else if (kind === "shout") { this.tone(520, 780, .1, "triangle", .14); }
      else if (kind === "dodge") { this.noise(.12, .18, 6000); }
      else if (kind === "die") { this.tone(320, 50, .5, "sawtooth", .2); }
      else if (kind === "enter") { this.noise(.18, .12, 900); this.tone(200, 320, .16, "triangle", .1); }
      else if (kind === "win") { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, .22, "triangle", .2, i * .11)); }
      else if (kind === "lose") { [392, 330, 262].forEach((f, i) => this.tone(f, f * .98, .3, "sine", .2, i * .16)); }
    },
  };

  /* ==========================================================
     FIGHT (full screen over the site · the real card + an HP bar inside it, like the game's fight card)
     ========================================================== */
  const F = { b: null, token: 0, k: 1, mode: "boss", seed: 7, hud: true, shown: { a: null, b: null } };
  const fightRoot = () => $("#bt-fight");
  function fightCard(u) {
    const card = C.renderCard(u.x, u.rar, { mini: false, tilt: false });
    card.removeAttribute("role"); card.tabIndex = -1; card.setAttribute("aria-hidden", "true");
    card.classList.add("bt-fc");
    paintTG(card, u.trait && u.trait.id, u.grade);
    const bar = document.createElement("span"); bar.className = "bt-hpbar" + (u.inf ? " is-inf" : ""); bar.innerHTML = `<i></i><b>HP</b>`;
    card.appendChild(bar);
    if (!u.sim) { const w = document.createElement("span"); w.className = "bt-warn"; w.textContent = "Skill not simulated yet"; card.appendChild(w); }
    const zone = (u.k.bf) ? `<span class="bt-zone">ZONE<i></i><i></i><i></i></span>` : "";
    if (zone) card.insertAdjacentHTML("beforeend", zone);
    return card;
  }
  function drawSlot(u, enter) {
    const el = $(u.side === "a" ? "#bt-slot-a" : "#bt-slot-b");
    el.innerHTML = `<div class="bt-fwrap${enter ? " enter" : ""}"><i class="bt-flash"></i><div class="bt-fxl"></div></div>`;
    const wrap = $(".bt-fwrap", el), card = fightCard(u);
    wrap.insertBefore(scaled(card), wrap.firstChild);
    el.dataset.uid = u.side + u.idx; F.shown[u.side] = { u, card, wrap };
    setNums(u);
  }
  function setNums(u) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    C.setCardNums(s.card, { atk: u.atk, hp: u.inf ? 1 : Math.max(0, u.hp) }, { animate: false });
    if (u.inf) { const h = $('[data-k="hp"]', s.card); h.textContent = "∞"; h.dataset.t = "∞"; }
    const bar = $(".bt-hpbar > i", s.card);
    if (!u.inf) { const p = Math.max(0, u.hp) / u.max; bar.style.setProperty("--p", p.toFixed(4)); bar.className = p > .5 ? "" : p > .25 ? "mid" : "lo"; s.wrap.classList.toggle("is-low", p <= .25 && u.alive); }
  }
  function drawBench() {
    for (const side of ["a", "b"]) {
      const t = F.b[side], f = F.b.front(side);
      $("#bt-left-" + side).textContent = F.b.alive(side) + "/" + t.length;
      $("#bt-bench-" + side).innerHTML = t.map((u) => `<i class="${!u.alive ? "dead" : u === f ? "front" : ""}"><img src="${esc(thumbOf("cards", u.x))}" alt=""></i>`).join("");
    }
  }
  const retrig = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function spawn(u, html, cls, style) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    const l = $(".bt-fxl", s.wrap); while (l.children.length > 9) l.firstChild.remove();
    const n = document.createElement("span"); n.className = cls; n.innerHTML = html; if (style) n.setAttribute("style", style); l.appendChild(n);
    n.addEventListener("animationend", () => n.remove(), { once: true }); setTimeout(() => n.remove(), 2600);
  }
  let numN = 0;
  function sparks(u) { if (reduced()) return; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.random() * .4, r = 50 + Math.random() * 40; spawn(u, "", "bt-spark", `--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`); } }
  function arrows(u) { if (reduced()) return; for (let i = 0; i < 3; i++) spawn(u, "", "bt-arrow", `--x:${30 + i * 20}%;--d:${i * 90}ms`); }
  function showEv(ev) {
    const u = ev.u; if (!u && ev.t !== "round") return;
    const s = u && F.shown[u.side] && F.shown[u.side].u === u ? F.shown[u.side] : null, wrap = s && s.wrap;
    switch (ev.t) {
      case "atk": retrig(wrap, "lunge"); break;
      case "dmg": { const big = ev.o && (ev.o.crit || ev.o.heavy); numN++;
        spawn(u, "-" + raw(ev.v), "bt-num" + (big ? " crit" : ""), `--x:${38 + (numN % 3) * 12}%;--y:${36 + (numN % 2) * 10}%`);
        if (wrap) { retrig(wrap, big ? "shake-big" : "shake"); if (big) { retrig($(".bt-flash", wrap), "go"); sparks(u); } }
        setNums(u); SND.play(big ? "crit" : "hit"); break; }
      case "heal": spawn(u, "+" + raw(ev.v), "bt-num heal", "--x:60%;--y:58%"); setNums(u); SND.play("heal"); break;
      case "buff": spawn(u, "+" + raw(ev.v), "bt-num buff", "--x:50%;--y:80%;--sz:16px"); arrows(u); setNums(u); SND.play("buff"); break;
      case "shout": { const k = (ev.o && ev.o.k) || "skill"; spawn(u, esc(ev.v), "bt-shout " + k, `--y:${(ev.o && ev.o.y) || "14%"};--r:${u.side === "a" ? -6 : 6}deg`); if (k !== "heal") SND.play("shout"); break; }
      case "dodge": retrig(wrap, "dodge"); SND.play("dodge"); break;
      case "zone": { const z = s && $(".bt-zone", s.card); if (z) { z.querySelectorAll("i").forEach((i, n) => i.classList.toggle("on", n < ev.v)); retrig(z, "pop"); } break; }
      case "copy": if (s) { $(".bt-copy", s.card)?.remove(); s.card.insertAdjacentHTML("beforeend", `<span class="bt-copy">COPIED: ${esc(u.copied.toUpperCase())}</span>` + (u.k.bf && !$(".bt-zone", s.card) ? `<span class="bt-zone">ZONE<i></i><i></i><i></i></span>` : "")); } break;
      case "nums": setNums(u); break;
      case "round": { const r = $("#bt-round"); r.innerHTML = ev.v + "<em> / 30</em>"; retrig(r, "pop"); break; }
      case "bench": case "benchdie": drawBench(); break;
    }
  }
  async function playDie(u) {
    const s = F.shown[u.side]; if (!s || s.u !== u) return;
    s.wrap.classList.add("die"); s.wrap.classList.remove("is-low");
    const sk = document.createElement("div"); sk.className = "bt-skull"; sk.innerHTML = `<svg viewBox="0 0 64 64"><path fill="currentColor" d="M32 4C17 4 7 14.5 7 28c0 8 3.6 13.4 8 16.6V54a4 4 0 0 0 4 4h4v-6h4v6h10v-6h4v6h4a4 4 0 0 0 4-4v-9.4c4.4-3.2 8-8.6 8-16.6C57 14.5 47 4 32 4Zm-11 34a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm22 0a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm-11 9-4-7h8z"/></svg>`;
    s.wrap.parentNode.appendChild(sk);
    SND.play("die"); drawBench(); await sleep(620 * F.k);
  }
  async function startFight(mode) {
    F.token++; const my = F.token; F.mode = mode; F.seed = (F.seed * 1103515245 + 12345) % 2147483647;
    const queue = [];
    const b = new Battle(mode === "boss" ? "boss" : "a", "b", { seed: F.seed, boss: mode === "boss", log: (e) => queue.push(e) });
    if (!b.a.length || !b.b.length) { FX.toast("Put at least one card in each team"); return; }
    F.b = b; openFight();
    $("#bt-mode").textContent = mode === "boss" ? "Stage " + STAGE : "Arena";
    $("#bt-round").innerHTML = "1<em> / 30</em>";
    drawSlot(b.front("a"), true); drawSlot(b.front("b"), true); drawBench(); SND.play("enter");
    await sleep(500 * F.k); if (my !== F.token) return;
    b.start(); for (const e of queue.splice(0)) showEv(e);
    await sleep(450 * F.k);
    while (my === F.token) {
      const done = b.step(), evs = queue.splice(0), t0 = performance.now();
      for (const ev of evs) {
        if (my !== F.token) return;
        if (ev.t === "atk") { showEv(ev); await sleep(190 * F.k); continue; }
        if (ev.t === "die") { await sleep(120 * F.k); await playDie(ev.u); continue; }
        if (ev.t === "enter") { drawSlot(ev.u, true); drawBench(); SND.play("enter"); await sleep(430 * F.k); continue; }
        showEv(ev);
        if (ev.t === "shout") await sleep(70 * F.k);
      }
      const need = 900 * F.k - (performance.now() - t0);
      if (need > 0) await sleep(need);
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
  }
  function closeFight() { F.token++; const f = fightRoot(); if (f) f.hidden = true; document.documentElement.classList.remove("bt-fighting"); }

  /* ==========================================================
     RESULT
     ========================================================== */
  let lastResult = null;
  const stageGain = (d) => Math.max(0, Math.floor(d / 60.5e9));   // placeholder: the clip moved 448 → 460 with 725.5B
  function showResult(b) {
    lastResult = b; closeFight();
    go("result", { replace: true });
    const team = b.a, total = team.reduce((x, u) => x + u.st.dmg, 0), mvp = team.reduce((m, u) => (u.st.dmg > m.st.dmg ? u : m), team[0]);
    const hero = b.boss
      ? `<p class="bt-res__eyebrow">DAMAGE DEALT</p><p class="bt-res__big" id="bt-res-num">0</p><p class="bt-res__why">${esc(b.why)}${b.win === "lose" ? "" : " · " + b.alive("a") + "/" + team.length + " cards still standing"}</p>
        <div class="bt-res__kv"><div><span>Your total</span><b>${fmtS(2.91e12 + total)}</b></div><div><span>Guild total</span><b>${fmtS(18.42e12 + total)}</b></div><div><span>Stage</span><b class="up">${STAGE} → ~${STAGE + stageGain(total)}</b></div></div>`
      : `<p class="bt-res__eyebrow">ARENA</p><p class="bt-res__big ${b.win}">${b.win === "win" ? "VICTORY" : b.win === "lose" ? "DEFEAT" : "DRAW"}</p><p class="bt-res__why">${esc(b.why)}</p>
        <div class="bt-res__kv"><div><span>Damage dealt</span><b>${fmtS(total)}</b></div><div><span>Cards left</span><b>${b.alive("a")} vs ${b.alive("b")}</b></div><div><span>Rounds</span><b>${b.round}</b></div></div>`;
    const procs = (u) => Object.entries(u.st.procs).filter(([, r]) => r.exp > 0).map(([n, r]) => `<span class="chip glass">${esc(n)} ${r.n}<em>/ ${r.exp.toFixed(1)} expected</em></span>`).join("");
    const rows = team.map((u) => `<div class="bt-pc${u === mvp && u.st.dmg > 0 ? " mvp" : ""}"><img src="${esc(thumbOf("cards", u.x))}" alt=""><div>
        <p class="bt-pc__name"><span>${esc(u.name)}</span>${u === mvp && u.st.dmg > 0 ? `<span class="chip glass bt-mvp">MVP · ${pct(u.st.dmg / Math.max(1, total))}</span>` : u.st.died ? `<span class="chip glass">Fell</span>` : u.st.hits ? "" : `<span class="chip glass">Didn't fight</span>`}</p>
        <div class="bt-pc__grid"><span>Damage<b class="d">${fmtS(u.st.dmg)}</b></span><span>Hits<b>${u.st.hits}</b></span><span>CRIT<b>${u.st.crit}</b></span>
          <span>Healed<b class="h">${fmtS(u.st.heal)}</b></span><span>Taken<b>${fmtS(u.st.taken)}</b></span><span>Support<b>${u.st.sup}×</b></span></div>
        <div class="bt-pc__procs">${u.sim ? procs(u) || `<span class="chip glass">No chance skill</span>` : `<span class="dk-pill bt-pill--warn"><span>Skill not simulated yet</span></span>`}</div></div></div>`).join("");
    $("#bt-result").innerHTML = `<section class="panel bt-res__hero">${hero}</section>
      <section class="panel bt-res__cards"><div class="bt-h"><h2>Each card</h2><small>This fight</small></div><div class="bt-pcs">${rows}</div>
        <div class="bt-res__btns"><button class="tm-btn tm-btn--primary fx-press" data-bt="save">Save as image</button><button class="tm-btn fx-press" data-bt="fight" data-mode="${b.boss ? "boss" : "arena"}">Fight again</button><button class="tm-btn fx-press" data-bt="go" data-to="${b.boss ? "boss" : "arena"}">Continue</button></div></section>`;
    FX.stagger($("#bt-result"), 80, { cls: "fx-up", max: 3, cleanup: true });
    if (b.boss) { const el = $("#bt-res-num"); if (reduced()) el.textContent = fmt(total); else FX.countTo(el, total, { format: fmt, duration: 1100 }); }
  }
  async function saveImage() {
    const b = lastResult; if (!b) return;
    const total = b.a.reduce((x, u) => x + u.st.dmg, 0);
    const res = await dialog({
      title: "Save as image",
      html: `<div class="bt-shot" id="bt-shot"><p class="bt-shot__h">${b.boss ? "GUILD BOSS · " + fmt(total) : String(b.win).toUpperCase() + " · ARENA"}</p>
        <div class="bt-shot__mini">${b.a.map((u) => `<div><img src="${esc(thumbOf("cards", u.x))}" alt="">${fmtS(u.st.dmg)}</div>`).join("")}</div><p class="bt-shot__wm">CARD BATTLE INFINITY · BATTLE SIM</p></div>
        <p class="tm-field__note">Mockup: step ② draws this with js/share.js like the Deck's Save as image.</p>`,
      actions: [{ label: "Close", value: "cancel" }, { label: "Save", value: "save", cls: "tm-btn--primary" }],
    });
    if (res && res.action === "save") FX.toast("Saved battle-result.png (mockup)");
  }

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
        b.a.forEach((u, k) => { out.dmg[k] += u.st.dmg; out.kills[k] += u.st.kills; out.died[k] += u.st.died; });
        out.fights.push({ win: b.win, luck: b.a.map((u) => { const r = Object.values(u.st.procs)[0]; return r && r.exp > 0 ? r.n - r.exp : null; }), procs: b.a.map((u) => u.st.procs) });
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
  async function runSim() {
    const out = $("#bt-sim-out"); out.dataset.has = "1";
    out.innerHTML = `<div class="empty bt-sim__empty"><span class="fx-loader" aria-hidden="true"></span><p class="empty__text" id="bt-sim-prog">Fighting ${simN} times…</p></div>`;
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
  }
  function drawSim(r, tips) {
    const n = r.n, W = r.w / n, D = r.d / n, L = r.l / n, U = r.units, tot = r.dmg.reduce((x, y) => x + y, 0) || 1;
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
        <button class="tm-btn tm-btn--primary fx-press" data-bt="apply" data-tip="${i}">Use</button></div>`).join("")
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
     QUESTIONS (the owner, round 3: "wondering or suggesting something? make a lab to tap")
     ========================================================== */
  const ASK = [
    { id: "q1", q: "หน้า Guild Boss ในเกมมี Top Hitters / Top Guilds แต่เว็บไม่มีข้อมูลกิลด์ จะแสดงอะไรแทน", o: [["Best fights ไฟต์ที่ดีที่สุดในเครื่อง", 1], ["ไม่ต้องมี", 0], ["ให้พิมพ์ชื่อ + ดาเมจเอง", 0]] },
    { id: "q2", q: "Guild damage / Your damage ในหน้า Guild Boss เอามาจากไหน", o: [["รวมจากไฟต์ที่เล่นในเว็บ (จำในเครื่อง)", 1], ["ให้พิมพ์เอง", 0], ["ไม่ต้องแสดง", 0]] },
    { id: "q3", q: "ทีมในหน้า Battle กับ deck ในหน้า Deck", o: [["แยกกัน · Load from My Decks = คัดลอกมา (แก้ในนี้ไม่เปลี่ยน deck)", 1], ["ผูกกัน · แก้ในนี้ = แก้ deck ด้วย", 0], ["มีปุ่ม Save as deck เพิ่มให้เซฟทีมกลับเป็น deck", 0]] },
    { id: "q4", q: "Custom HP / ATK ที่พิมพ์เอง ใช้แทนตัวเลขไหน", o: [["แทนตัวเลขสุดท้าย (หลังบัฟ Deck + Trait + Grade)", 1], ["แทนค่าฐาน แล้วยังคูณบัฟต่อ", 0]] },
    { id: "q5", q: "ในคลิป DFV (HP 9.5B) รอดครบ 30 รอบ แต่ engine ให้ตายรอบ ~12–21 (บอสตีแรงเกิน)", o: [["เดี๋ยวส่งเฟรมเลขดาเมจบอสให้ (Claude แก้สูตรตามนั้น)", 1], ["ปรับให้ DFV รอด 30 รอบไปก่อน", 0], ["ปล่อยไว้ก่อน", 0]] },
    { id: "q6", q: "ตัวเลขเด้งตอนสู้", o: [["เลขเต็มไม่มีจุลภาค แบบคลิป (+567664559)", 1], ["มีจุลภาค (+567,664,559)", 0], ["แบบย่อ (+567.7M)", 0]] },
    { id: "q7", q: "การ์ดตอนสู้: ป้าย 1 IN X (โอกาส) ซ่อนไหม", o: [["ซ่อน แบบในเกม", 1], ["แสดง", 0]] },
    { id: "q8", q: "ทีมศัตรูในหน้า Arena", o: [["จัดเองแบบหน้า Deck (+ Load from My Decks)", 1], ["เลือกจาก Meta Decks ด้วย (ตอนเปิดแท็บ Meta กลับมา)", 0]] },
    { id: "q9", q: "Spirit Wave Master ในคลิป (ตีซ้ำ 189.34%) ตั้งระดับไหน · ตอนนี้เดาว่า Godly (ระดับอื่นใช้ค่าบนการ์ด เช่น Godly บนการ์ด = 135%)", o: [["Godly", 1], ["ต่ำกว่า Godly (บอกระดับในแชท)", 0], ["ไม่แน่ใจ เดี๋ยวแคปให้", 0]] },
  ];
  const askState = {};
  function paintAsk() {
    $("#bt-ask-list").innerHTML = ASK.map((a, n) => `<section class="panel bt-q"><p class="bt-q__n">ข้อ ${n + 1}</p><p class="bt-q__q">${esc(a.q)}</p>
        <div class="bt-q__opts">${a.o.map(([t, rec], k) => `<button type="button" class="chip glass fx-press bt-q__o" data-ask="${a.id}" data-k="${k}" aria-pressed="${askState[a.id] === k}">${esc(t)}${rec ? `<span class="bt-rec">Claude แนะนำ</span>` : ""}</button>`).join("")}</div></section>`).join("");
    const nDone = Object.keys(askState).length; $("#bt-ask-count").textContent = `${nDone} / ${ASK.length}`;
  }
  async function copyAnswers(btn) {
    const lines = ASK.map((a, n) => `${n + 1}. ${askState[a.id] == null ? "(ยังไม่เลือก)" : a.o[askState[a.id]][0]}`);
    const text = "คำตอบ Battle mockup:\n" + lines.join("\n");
    try { await navigator.clipboard.writeText(text); FX.toast("Copied · paste it in the chat"); }
    catch (e) { const ta = $("#bt-ask-text"); ta.hidden = false; ta.value = text; ta.select(); FX.toast("Select all and copy the text"); }
    if (!reduced()) FX.flash(btn);
  }

  /* ==========================================================
     PAGE · routes #battle[/arena|/fight|/result|/ask] · mounted into the real site's menu (app.js stays as it is)
     ========================================================== */
  const VIEWS = ["boss", "arena", "result", "ask"];
  const NOTES = {
    boss: "<b>Guild Boss</b> · ทีมจัดแบบหน้า Deck ทุกอย่าง (การ์ดจริง · ป้าย Grade/Trait · ป้ายใต้การ์ด · บัฟ Deck จาก deckbuff.js) · แตะการ์ด = แผ่นตั้งค่าแบบหน้า Deck + ส่วนใหม่ <b>Custom HP / ATK</b> · <b>Load from My Decks</b> = ดึงทีมจากหน้า Deck · DFV ใส่ ATK/HP จากรูปเจ้าของ (ป้าย Custom) · สูตร ATK บอสตาม Stage ยังรอรูป (+0.6%/Stage แทน)",
    arena: "<b>Arena</b> · ทีมเรา + ทีมศัตรู จัดแบบหน้า Deck (Load from My Decks ได้ทั้งคู่) · Simulate = สู้จริง 100/500/1000 ไฟต์ → ชนะ % · ใครแบก · ดวงสกิลโอกาส · ลองลำดับ 46 แบบ (Use) · Shadow Monarch = ตัวอย่าง “Skill not simulated yet”",
    result: "<b>ผลลัพธ์</b> · Guild Boss = DAMAGE DEALT + Stage ที่น่าจะดันได้ (ประมาณ) · Arena = VICTORY/DEFEAT/DRAW + เหตุผล · ทุกใบ: ดาเมจ ตี CRIT ฮีล ดาเมจที่โดน Support สกิลโอกาสเทียบที่ควรติด",
    ask: "<b>คำถามถึงเจ้าของ</b> · แตะเลือกคำตอบทีละข้อ แล้วกด <b>Copy answers</b> ส่งในแชท (ป้าย “Claude แนะนำ” = ตัวเลือกที่ Claude คิดว่าดีสุด)",
  };
  let view = "boss";
  function go(v, { replace = false } = {}) {
    const h = v === "boss" ? "#battle" : "#battle/" + v;
    if (location.hash !== h) { if (replace) history.replaceState(null, "", h); else history.pushState(null, "", h); }
    showBattle();
  }
  function viewFromHash() { const m = location.hash.match(/^#battle(?:\/(\w+))?/); return m ? (m[1] || "boss") : null; }
  function showBattle() {
    let v = viewFromHash(); if (!v) return;
    if (v === "fight") { if (!F.b || fightRoot().hidden) { go("boss", { replace: true }); return; } v = view; }
    else closeFight();
    if (v === "result" && !lastResult) { const b = new Battle("boss", "b", { seed: 7, boss: true }).run(); showResult(b); return; }
    if (!VIEWS.includes(v)) v = "boss";
    view = v;
    const page = $("#page-battle");
    $$(".page").forEach((p) => { if (p !== page) p.hidden = true; });
    if (page.hidden) { page.hidden = false; page.classList.remove("fx-page-in"); void page.offsetWidth; page.classList.add("fx-page-in"); }
    $$(".nav__btn").forEach((b) => { if (b.dataset.page === "battle") b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $(".nav__list").style.setProperty("--i", 3);
    document.title = "Battle — Card Battle Infinity";
    $$("[data-bt-view]").forEach((s) => { s.hidden = s.dataset.btView !== v; });
    $$("[data-bt-lab]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.btLab === v)));
    const seg = $("#bt-tabs"); seg.hidden = !(v === "boss" || v === "arena");
    seg.style.setProperty("--i", v === "arena" ? 1 : 0);
    $$("#bt-tabs .seg__btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.btLab === v)));
    $("#bt-note").innerHTML = NOTES[v];
    window.scrollTo({ top: 0 });
  }
  function bind() {
    // the Battle menu button: handled here before app.js (its PAGES has no "battle")
    $(".nav").addEventListener("click", (e) => { const b = e.target.closest('.nav__btn[data-page="battle"]'); if (b) { e.stopPropagation(); go(view === "result" ? "result" : view); } }, true);
    window.addEventListener("hashchange", (e) => { if (viewFromHash()) { e.stopImmediatePropagation(); showBattle(); } }, true);
    window.addEventListener("popstate", (e) => { if (viewFromHash()) { e.stopImmediatePropagation(); showBattle(); } }, true);
    const page = $("#page-battle");
    page.addEventListener("click", (e) => {
      const lab = e.target.closest("[data-bt-lab]"); if (lab) { go(lab.dataset.btLab); return; }
      const t = e.target.closest("[data-bt]");
      const slot = e.target.closest(".dk-slot[data-team]");
      if (t) {
        const act = t.dataset.bt;
        if (act === "clear" && slot) { clearSlot(slot.dataset.team, slot.dataset.kind, Number(slot.dataset.i)); return; }
        if (act === "buff" && slot) { buffDialog(slot.dataset.team, Number(slot.dataset.i)); return; }
        if (act === "add" && slot) { if (sel) { moveTo(slot); return; } openPicker(slot.dataset.team, slot.dataset.kind, Number(slot.dataset.i)); return; }
        if (act === "load") { loadDeck(t.dataset.team); return; }
        if (act === "fight") { SND.unlock(); startFight(t.dataset.mode); return; }
        if (act === "sim") { runSim(); return; }
        if (act === "simn") { simN = Number(t.dataset.n); const seg = t.parentNode; seg.style.setProperty("--i", [...seg.querySelectorAll(".seg__btn")].indexOf(t)); seg.querySelectorAll(".seg__btn").forEach((x) => x.setAttribute("aria-pressed", String(x === t))); return; }
        if (act === "apply") { applyTip(Number(t.dataset.tip)); return; }
        if (act === "save") { saveImage(); return; }
        if (act === "go") { go(t.dataset.to); return; }
        if (act === "copyask") { copyAnswers(t); return; }
        if (act === "resetask") { Object.keys(askState).forEach((k) => delete askState[k]); paintAsk(); return; }
      }
      const ask = e.target.closest("[data-ask]");
      if (ask) { askState[ask.dataset.ask] = Number(ask.dataset.k); paintAsk(); return; }
      const item = e.target.closest(".dk-item[data-id]");
      if (item && slot) { if (sel) { moveTo(slot); return; } slotSheet(slot.dataset.team, slot.dataset.kind, Number(slot.dataset.i)); }
    });
    page.addEventListener("keydown", (e) => { const item = e.target.closest(".dk-item[data-id]"); if (item && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); item.click(); } });
    $("#bt-stage").addEventListener("change", (e) => {
      let v = Math.round(Number(e.target.value)); if (!v || v < 1) v = 1; if (v > 1500) v = 1500; e.target.value = v; STAGE = v;
      $("#bt-stage-n").textContent = v; $("#bt-boss-atk").textContent = fmt(bossAtk(v)); if (!reduced()) FX.flash($("#bt-boss-atk").closest(".panel"));
    });
    // fight controls
    const f = fightRoot();
    f.addEventListener("click", (e) => {
      const sp = e.target.closest("[data-spd]");
      if (sp) { const v = Number(sp.dataset.spd); F.k = v === 1 ? 1 : v === 2 ? .5 : 1 / 3; f.style.setProperty("--bt-k", F.k.toFixed(3)); $$("[data-spd]", f).forEach((x) => x.setAttribute("aria-pressed", String(x === sp))); return; }
      if (e.target.closest("#bt-hide")) { F.hud = !F.hud; f.classList.toggle("hud-off", !F.hud); $("#bt-hide span").textContent = F.hud ? "Hide" : "Show"; return; }
      if (e.target.closest("#bt-end")) { if (!F.b) return; F.token++; const b = F.b; b.E = null; while (!b.step()); showResult(b); return; }
      if (e.target.closest("#bt-sound")) { SND.unlock(); SND.muted = !SND.muted; store.set("cbi:battleMute", SND.muted ? "1" : "0"); drawSound(); FX.toast(SND.muted ? "Sound off" : "Sound on"); }
    });
  }
  function drawSound() { const b = $("#bt-sound"); b.innerHTML = SND.muted ? ICON.mute : ICON.sound; b.setAttribute("aria-label", SND.muted ? "Sound off" : "Sound on"); }
  function moveTo(slot) {
    const s = sel; sel = null;
    if (!s || slot.dataset.team !== s.key || slot.dataset.kind !== s.kind) { paintBoard(s.key); FX.toast("Pick a slot in the same row"); return; }
    const j = Number(slot.dataset.i); if (j !== s.i) swap(s.key, s.kind, s.i, j);
    paintBoard(s.key, { flash: { kind: s.kind, i: j } });
  }
  let countdownEnd = Date.now() + (2 * 86400 + 14 * 3600 + 32 * 60 + 8) * 1000;
  function tick() {
    const s = Math.max(0, Math.floor((countdownEnd - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const el = $("#bt-timer"); if (el) el.textContent = `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
  }
  function paintBoss() {
    const x = lookup("cards", BOSS_ID), box = $("#bt-boss-card");
    const card = cardEl("cards", x, "Normal");
    box.innerHTML = ""; box.appendChild(scaled(card));
    const h = $('[data-k="hp"]', card); if (h) { h.textContent = "∞"; h.dataset.t = "∞"; }
    $("#bt-boss-atk").textContent = fmt(bossAtk(STAGE));
    $("#bt-best").innerHTML = [[725551288028, "448 → 460", "Today"], [688204511930, "436 → 447", "Yesterday"], [612993004117, "425 → 435", "2 days ago"]]
      .map(([dmg, st, w], i) => `<li><span class="bt-rk">${i + 1}</span><span>${w} <span class="bt-faint">· Stage ${st}</span></span><b>${fmtS(dmg)}</b></li>`).join("");
  }

  async function start() {
    // supports for the mockup: data/pending/support.json (the live data/support.json is still empty)
    try {
      const pend = await C.loadJSON("data/pending/support.json");
      const have = new Set((state.support || []).map((s) => s.id));
      (Array.isArray(pend) ? pend : []).forEach((s) => { if (s && s.id && !have.has(s.id)) { s.kind = "support"; if (!s.name) s.name = s.id; state.support.push(s); } });
    } catch (e) { console.warn("pending supports not loaded", e); }
    bind(); drawSound(); paintBoss(); paintBoard("boss"); paintBoard("a"); paintBoard("b"); paintAsk();
    tick(); setInterval(tick, 1000);
    if (!viewFromHash()) history.replaceState(null, "", "#battle");
    showBattle();
  }
  // for checks in the browser console / tests (mockup only)
  C.battleMock = { Battle, T, SKILL, stats, ROLL, DEF_K, ECHO_CLIP };
  const wait = setInterval(() => { if (state.loaded && C.dialog && C.deckBuff) { clearInterval(wait); start(); } }, 50);
})();
