/* ==========================================================
   Card Battle Infinity — Card Grader (step 6, see PROGRESS §6.1)
   · Grade tab: pick a card -> set Basic Attack / Defense / Status Damage / HP grades by hand (1–10)
   · Each grade adds +2.5% to that stat · card grade = average of the 4, rounded (.5 goes up)
   · Grades are saved on this device (localStorage "cbi:grades") and can be shared as a link:
       #grade/<card id>/<atk>-<def>-<status>-<hp>   e.g. #grade/bald-cadet/6-4-3-2
   · Grades never change Overall scores or the Tier List
   · Card detail gets a "Grade" panel (panelHTML) with a button that opens the grader
   · Step 13 (§3.5.2): the grader's card and the detail panel show the card in a graded case (.slab, css/grade.css)
   · Traits: the case label shows the user's trait for the card (js/traits.js) · the stats on the case stay grade-only
   Needs js/fx.js, js/app.js and js/cards.js loaded first.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const STATS = [
    { k: "atk", name: "Basic Attack", short: "ATK" },
    { k: "def", name: "Defense", short: "DEF" },
    { k: "status", name: "Status Damage", short: "STS" },
    { k: "hp", name: "HP", short: "HP" },
  ];
  const KEY = "cbi:grades";
  const MAX = 10;
  const STEP = 0.025;                     // +2.5% per grade (checked against the in-game clip)
  const TITLE = "Card Grader — Card Battle Infinity";
  const ZERO = () => [0, 0, 0, 0];

  const ui = {};
  const byId = new Map();
  const tiles = new Map();                // id -> mini card in the picker
  let built = false;                      // picker cards exist (made on the first visit to the Grade tab, step 9.5)
  let saved = {};                         // id -> [atk, def, status, hp]
  let items = [];                         // cards in picker order
  let cur = null, grades = ZERO(), shared = false, hero = null, heroSlab = null;
  let listScroll = 0, lastId = null, pendingOrigin = null;
  const filter = { q: "", graded: false };

  /* ---------- Grade maths ---------- */
  const clampG = (n) => Math.max(0, Math.min(MAX, Math.round(Number(n) || 0)));
  const any = (a) => Array.isArray(a) && a.some((n) => n > 0);
  const same = (a, b) => a && b && a.every((n, i) => n === b[i]);
  const fmtG = (a) => a.join("-");
  function parse(str) {
    if (!/^\d{1,2}(-\d{1,2}){3}$/.test(String(str || ""))) return null;
    const a = str.split("-").map(Number);
    return a.every((n) => n >= 0 && n <= MAX) ? a : null;
  }
  // card grade: average of the 4 grades, rounded half up (6/4/3/2 -> 4 · 1/7/7/7 -> 6)
  function overall(a) {
    if (!any(a)) return 0;
    const sum = a.reduce((s, n) => s + n, 0);
    return Math.floor(sum / a.length + 0.5);
  }
  const band = (g) => (g >= 10 ? "rainbow" : g >= 7 ? "gold" : g >= 4 ? "silver" : g >= 1 ? "bronze" : "none");
  const pct = (g) => "+" + Number((g * STEP * 100).toFixed(1)) + "%";
  // the stat exists for this card at this rarity (Defense / Status Damage are new and may be missing)
  function hasStat(card, k, r) {
    const ex = card.exact && card.exact[r] && card.exact[r][k];
    return !!(ex || (card.base && Number(card.base[k]) > 0));
  }
  const graded = (card, k, r, g) => Math.round(C.statAt(card, k, r) * (1 + g * STEP));

  /* ---------- Saved grades (never crash if storage is blocked) ---------- */
  function load() {
    let raw = {};
    try { raw = JSON.parse(C.store.get(KEY) || "{}") || {}; } catch { raw = {}; }
    const out = {};
    Object.keys(raw).forEach((id) => {
      const a = Array.isArray(raw[id]) && raw[id].length === 4 ? raw[id].map(clampG) : null;
      if (a && any(a)) out[id] = a;
    });
    return out;
  }
  function save(id, a) {
    if (any(a)) saved[id] = a.slice(); else delete saved[id];
    C.store.set(KEY, JSON.stringify(saved));
  }
  const get = (id) => (saved[id] ? saved[id].slice() : null);

  /* ---------- Backup (js/share.js): everything graded goes in / comes out as one object { id: [4 grades] } ---------- */
  // merge: grades you already have stay, the backup fills in the cards you haven't graded · replace: the backup is all there is
  function importGrades(data, how) {
    const incoming = {};
    Object.keys(data && typeof data === "object" ? data : {}).slice(0, 5000).forEach((id) => {
      const a = data[id];
      if (!Array.isArray(a) || a.length !== 4) return;
      const g = a.map(clampG);
      if (any(g)) incoming[String(id).slice(0, 80)] = g;
    });
    const before = saved;
    saved = how === "replace" ? incoming : { ...incoming, ...before };
    C.store.set(KEY, JSON.stringify(saved));
    tiles.forEach((el, id) => cardBadge(el, saved[id] ? overall(saved[id]) : 0));
    if (items.length && ui.grid) applyList();                       // the "My graded cards" filter may have changed
    return how === "replace" ? Object.keys(incoming).length : Object.keys(saved).filter((id) => !before[id]).length;
  }
  function provideBackup() {
    if (!C.share) return;
    C.share.provide("grades", {
      label: "Card grades", kind: "object",
      get: () => JSON.parse(JSON.stringify(saved)),
      count: (v) => Object.keys(v).length,
      noun: (n) => `${n} graded ${n === 1 ? "card" : "cards"}`,
      apply: importGrades,
    });
  }

  /* ---------- Shared bits ---------- */
  function orbHTML(g, { size = "", label = "" } = {}) {
    const b = band(g);
    const aria = label || (g ? `Grade ${g}` : "Not graded");
    return `<span class="gorb${size ? " gorb--" + size : ""}" data-band="${b}" role="img" aria-label="${esc(aria)}"><b>${g || "–"}</b></span>`;
  }
  function setOrb(el, g, { pop = false } = {}) {
    if (!el) return;
    const changed = el.dataset.band !== band(g) || $("b", el).textContent !== String(g || "–");
    el.dataset.band = band(g);
    $("b", el).textContent = g || "–";
    el.setAttribute("aria-label", g ? `Grade ${g}` : "Not graded");
    if (pop && changed && !FX.reduced) { el.classList.remove("is-pop"); void el.offsetWidth; el.classList.add("is-pop"); }
  }
  // round grade badge on a card element (picker tiles + hero) · removed when the card has no grade
  function cardBadge(el, g, opts) {
    let b = $(".card__grade", el);
    if (!g) { if (b) b.remove(); return; }
    if (!b) {
      const wrap = document.createElement("span");
      wrap.innerHTML = orbHTML(g);
      b = wrap.firstElementChild;
      b.classList.add("card__grade");
      el.appendChild(b);
    } else setOrb(b, g, opts);
    if (el.classList.contains("card")) C.watchLive(el);   // W4: a grade-10 badge turns only while its card is watched
  }
  /* ==========================================================
     Graded case (.slab, step 13 · §3.5.2): a clear plastic case drawn in CSS, a paper label on top
     (series, name, rarity, tier, odds · grade word + card grade · graded ATK / HP · the 4 grades · barcode + cert no.)
     ========================================================== */
  const WORD = ["Ungraded", "Fair", "Good", "Very good", "Very good+", "Excellent", "Excellent+", "Near mint", "Near mint+", "Mint", "Gem mint"];
  // cert no. made from the card id (always the same for a card)
  const certOf = (id) => String(C.hash(String(id)) % 1e8).padStart(8, "0");
  function labelHTML(card, r, a) {
    const g = overall(a), cert = certOf(card.id), sub = (n) => n || "–";
    return `<div class="lab__l">
        <span class="lab__brand">CBI GRADED${card.series ? " · " + esc(card.series) : ""}</span>
        <span class="lab__name">${esc(card.name)}</span>
        <span class="lab__line"><b>${esc(r)}</b> · ${C.isRanked(card) ? "Tier " + esc(card.tier) : "Unranked"}</span>
        <span class="lab__line">${esc(C.fmtOdds(C.oddsAt(card, r)))}</span>
        ${traitLine(card)}
      </div>
      <div class="lab__r"><span class="lab__word">${WORD[g]}</span><span class="lab__grade">${g || "–"}</span></div>
      <div class="lab__row lab__row--stats"><span class="lab__stats"><span class="a">ATK ${C.fmtStat(graded(card, "atk", r, a[0]))}</span> · <span class="h">HP ${C.fmtStat(graded(card, "hp", r, a[3]))}</span></span></div>
      <div class="lab__row"><span class="lab__subs">ATK ${sub(a[0])} · DEF ${sub(a[1])} · STS ${sub(a[2])} · HP ${sub(a[3])}</span><span class="lab__code" aria-hidden="true"></span><span class="lab__cert">${cert.slice(0, 4)} ${cert.slice(4)}</span></div>`;
  }
  // the card's trait (js/traits.js, the user's pick) on the label · no trait = no line
  function traitLine(card) {
    const t = C.traits && C.traits.byId ? C.traits.byId(C.traits.of(card.id)) : null;
    return t ? `<span class="lab__line lab__trait" style="${C.traits.colorStyle(t)}">${C.traits.iconHTML(t)}<b>${esc(t.name)}</b></span>` : "";
  }
  // the glare runs once across the plastic the first time a case scrolls into view
  const sheenIO = "IntersectionObserver" in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-shown"); sheenIO.unobserve(e.target); } }), { threshold: 0.4 })
    : null;
  function sheen(s) {
    if (FX.reduced) return;
    s.classList.remove("is-shown"); void s.offsetWidth; s.classList.add("is-shown");
  }
  // make a case: the card inside shows the graded ATK / HP · still: the card is a picture only (no tap, no tilt)
  function makeSlab(card, r, a, { still = false } = {}) {
    const s = document.createElement("div");
    s.className = "slab";
    s.innerHTML = `<div class="slab__label"></div><div class="slab__well"></div><span class="slab__ridges" aria-hidden="true"></span><span class="slab__glare" aria-hidden="true"></span>`;
    const c = C.renderCard(card, r, { tilt: false });
    c.removeAttribute("role"); c.removeAttribute("tabindex");
    c.setAttribute("aria-hidden", "true");                           // the label says it all
    if (still) c.classList.remove("card");
    $(".slab__well", s).appendChild(c);
    paintSlab(s, card, r, a, { animate: false });
    if (sheenIO) sheenIO.observe(s); else s.classList.add("is-shown");
    return s;
  }
  function paintSlab(s, card, r, a, { animate = true, pop = false } = {}) {
    const g = overall(a), num = () => $(".lab__grade", s);
    const before = num() && num().textContent;
    s.dataset.band = band(g);
    s.setAttribute("aria-label", `${card.name} in a graded case, ${g ? "grade " + g + " " + WORD[g] : "not graded"}, ${r}`);
    $(".slab__label", s).innerHTML = labelHTML(card, r, a);
    const c = $(".gc", s);
    C.setCardNums(c, { atk: graded(card, "atk", r, a[0]), hp: graded(card, "hp", r, a[3]) }, { animate: animate && c.classList.contains("is-live") });
    if (pop && !FX.reduced && before !== num().textContent) num().classList.add("is-pop");
  }

  /* Support in a case (2026-10-28, owner: "the same PSA case"): supports aren't graded in the game, so the case shows the
     support as it is · the label has its ability values at the level (instead of ATK / HP) + its Value score */
  function supLabelHTML(sp, r) {
    const cert = certOf(sp.id), e = C.support.effect(sp, r), vals = C.support.values(sp, r);
    const ranked = C.isRanked(sp), odds = Number(sp.odds) > 0 ? C.fmtOdds(Number(sp.odds)) : "";
    const v = ranked ? String(Number(Number(sp.scores.value).toFixed(1))) : "–";
    return `<div class="lab__l">
        <span class="lab__brand">CBI GRADED · SUPPORT</span>
        <span class="lab__name">${esc(sp.name)}</span>
        <span class="lab__line"><b>${esc(r)}</b> · ${ranked ? "Tier " + esc(sp.tier) : "Unranked"}</span>
        ${odds ? `<span class="lab__line">${esc(odds)}</span>` : ""}
      </div>
      <div class="lab__r"><span class="lab__word">${ranked ? "Value" : "Support"}</span><span class="lab__grade${v.length > 2 ? " lab__grade--long" : ""}">${esc(v)}</span></div>
      <div class="lab__row lab__row--stats"><span class="lab__stats">${e.name ? `<span class="a">${esc(e.name)}</span>` : ""}${vals.length ? `${e.name ? " · " : ""}<span class="h">${esc(vals.join(" · "))}</span>` : ""}</span></div>
      <div class="lab__row"><span class="lab__subs">${esc(String((sp.effect && sp.effect.type) || "support").replace(/-/g, " ").toUpperCase())}</span><span class="lab__code" aria-hidden="true"></span><span class="lab__cert">${cert.slice(0, 4)} ${cert.slice(4)}</span></div>`;
  }
  function makeSupSlab(sp, r) {
    const s = document.createElement("div");
    s.className = "slab slab--sup";
    s.innerHTML = `<div class="slab__label"></div><div class="slab__well"></div><span class="slab__ridges" aria-hidden="true"></span><span class="slab__glare" aria-hidden="true"></span>`;
    const c = C.renderCard(sp, r, { tilt: false });
    c.removeAttribute("role"); c.removeAttribute("tabindex"); c.setAttribute("aria-hidden", "true");
    c.classList.remove("card");   // a picture only in the Details (no tap, no tilt)
    $(".slab__well", s).appendChild(c);
    paintSupSlab(s, sp, r);
    if (sheenIO) sheenIO.observe(s); else s.classList.add("is-shown");
    return s;
  }
  function paintSupSlab(s, sp, r) {
    s.dataset.band = C.isRanked(sp) ? "gold" : "none";
    s.setAttribute("aria-label", `${sp.name} in a case, support, ${r}`);
    $(".slab__label", s).innerHTML = supLabelHTML(sp, r);
  }
  function supPanelHTML(sp) {
    return `
      <section class="dpanel" aria-labelledby="d-t-grade">
        <h3 class="dpanel__title" id="d-t-grade">Case</h3>
        <p class="dpanel__sub">This support in a graded case, with its effect at the level you picked. Supports have no grades.</p>
        <div class="gsum__slab" data-sslab="${esc(sp.id)}"></div>
      </section>`;
  }

  // Details sheet of the card detail (js/detail.js puts panelHTML in, then calls this): fill the case placeholders
  const sheetSlabs = new Set();
  function mountSlabs(root) {
    sheetSlabs.forEach((x) => { if (!x.s.isConnected) sheetSlabs.delete(x); });
    root.querySelectorAll("[data-sslab]").forEach((box) => {
      const sp = (state.support || []).find((x) => x && x.id === box.dataset.sslab);
      if (!sp) return;
      const s = makeSupSlab(sp, state.rarity);
      box.replaceChildren(s);
      sheetSlabs.add({ s, card: sp, sup: true });
    });
    root.querySelectorAll("[data-slab]").forEach((box) => {
      const card = byId.get(box.dataset.slab), a = card && get(card.id);
      if (!card || !a) return;
      const s = makeSlab(card, state.rarity, a, { still: true });
      box.replaceChildren(s);
      sheetSlabs.add({ s, card });
    });
  }

  const gradeUrl = (id, a) => "#grade/" + encodeURIComponent(id) + (any(a) ? "/" + fmtG(a) : "");

  /* ==========================================================
     Card detail panel (cards.js calls this inside the detail sheet)
     ========================================================== */
  function panelHTML(card) {
    const a = get(card.id);
    const o = overall(a);
    const body = a ? `
      <div class="gsum__slab" data-slab="${esc(card.id)}"></div>
      <div class="gsum">
        <div class="gsum__overall">${orbHTML(o, { size: "lg", label: `Card grade ${o}` })}<small>Card grade</small></div>
        <ul class="gsum__list">${STATS.map((s, i) => `
          <li><span class="gsum__name">${s.name}</span>${orbHTML(a[i], { size: "sm", label: `${s.name} grade ${a[i] || "none"}` })}</li>`).join("")}
        </ul>
      </div>` : `<p class="muted">Not graded yet. Set the grades you rolled in game to see the boosted stats.</p>`;
    return `
      <section class="dpanel" aria-labelledby="d-t-grade">
        <h3 class="dpanel__title" id="d-t-grade">Grade</h3>
        <p class="dpanel__sub">Your grades for this card, saved on this device. They don't change its tier.</p>
        ${body}
        <button type="button" class="chip glass fx-press gsum__btn" data-grade-open="${esc(card.id)}">${a ? "Open in Card Grader" : "Grade this card"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </section>`;
  }

  /* Card detail -> grader: close the sheet first, then push the grader entry */
  function openFromDetail(id) {
    const depth = (history.state && history.state.depth) || 0;
    const go = () => openGrader(id, null);
    if (depth > 0) {
      window.addEventListener("popstate", () => setTimeout(go, 0), { once: true });
      C.closeCard();
    } else { C.closeCard(); go(); }
  }

  /* ==========================================================
     Picker (Grade tab list)
     ========================================================== */
  function compare(a, b) {
    const ra = C.isRanked(a), rb = C.isRanked(b);
    if (ra !== rb) return ra ? -1 : 1;
    if (ra && a.scores.overall !== b.scores.overall) return b.scores.overall - a.scores.overall;
    return a.name.localeCompare(b.name);
  }

  function applyList({ animate = false } = {}) {
    if (!built) return;   // the Grade tab hasn't been opened yet: the picker's cards don't exist yet
    const words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = items.filter((c) => {
      if (filter.graded && !saved[c.id]) return false;
      if (words.length) {
        const hay = (c.name + " " + (c.series || "")).toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const frag = document.createDocumentFragment();
    out.forEach((c) => frag.appendChild(tiles.get(c.id)));
    ui.grid.replaceChildren(frag);
    if (animate) FX.stagger(ui.grid, 24, { cls: "fx-grid-in", max: 12, limit: 18, cleanup: true });

    const n = Object.keys(saved).filter((id) => byId.has(id)).length;
    ui.gradedChip.setAttribute("aria-pressed", String(filter.graded));
    $("[data-n]", ui.gradedChip).textContent = n;
    ui.count.textContent = out.length === items.length ? `${items.length} ${items.length === 1 ? "card" : "cards"}` : `${out.length} of ${items.length} cards`;
    ui.reset.hidden = !(words.length || filter.graded);
    ui.none.hidden = out.length > 0;
    $("#grade-none-text").textContent = filter.graded && !n ? "You haven't graded any cards yet. Tap a card to start." : "Try a different search or clear the filters.";
  }

  function bindList() {
    ui.search.addEventListener("input", () => { filter.q = ui.search.value; applyList(); });
    ui.search.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.search.blur(); });
    ui.gradedChip.addEventListener("click", () => { filter.graded = !filter.graded; applyList({ animate: true }); });
    const reset = () => { filter.q = ""; filter.graded = false; ui.search.value = ""; applyList({ animate: true }); };
    ui.reset.addEventListener("click", reset);
    $("#grade-none-reset").addEventListener("click", reset);
    ui.grid.addEventListener("click", (e) => {
      const el = e.target.closest(".card[data-id]");
      if (el) openGrader(el.dataset.id, el);
    });
    ui.grid.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card[data-id]")) { e.preventDefault(); openGrader(e.target.dataset.id, e.target); }
    });
  }

  /* ==========================================================
     Grader
     ========================================================== */
  function rowHTML(s, i) {
    const segs = Array.from({ length: MAX }, (_, j) =>
      `<button type="button" class="gbar__seg" data-i="${i}" data-g="${j + 1}" style="--i:${j}" aria-label="${s.name} grade ${j + 1}" aria-pressed="false"></button>`).join("");
    return `
      <div class="gstat gstat--${s.k}" data-row="${i}" data-band="none">
        <div class="gstat__top">
          <span class="gstat__name">${s.name}</span>
          <span class="gstat__pct" data-p>+0%</span>
          ${orbHTML(0)}
        </div>
        <div class="gstat__val"><span class="gstat__num" data-v data-value="0">0</span><small data-b></small></div>
        <div class="gbar" role="group" aria-label="${s.name} grade, 1 to 10. Tap the current grade again to clear it.">${segs}</div>
      </div>`;
  }

  function detailHTML(card) {
    return `
      <div class="gdetail__bar">
        <button class="detail__back gdetail__back fx-press" type="button" aria-label="Back to all cards">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          <span>All cards</span>
        </button>
      </div>
      <div class="gdetail__grid">
        <div class="gdetail__hero" id="gd-hero" data-no-detail></div>
        <div class="gdetail__main" id="gd-main">
          <header>
            <p class="detail__series">${esc(card.series)}</p>
            <h1 class="detail__name" id="gd-name">${esc(card.name)}</h1>
          </header>

          <div id="gd-shared" class="gshare" hidden>
            <p class="gshare__text"><b>Shared grades.</b> You opened a link with someone's grades for this card.</p>
            <div class="gshare__btns">
              <button type="button" class="chip glass fx-press" data-act="keep">Keep these</button>
              <button type="button" class="chip glass fx-press" data-act="mine"></button>
            </div>
          </div>

          <div class="goverall">
            ${orbHTML(0, { size: "xl" })}
            <div class="goverall__text">
              <p class="goverall__label">Card grade</p>
              <p class="goverall__sub" data-o-sub>Set a grade on each stat below</p>
            </div>
          </div>

          <div id="gd-rarity" class="rarity-picker" role="group" aria-label="Rarity"></div>

          <div class="gstats">${STATS.map(rowHTML).join("")}</div>

          <div class="gactions">
            <button type="button" class="chip glass fx-press gactions__details" data-act="details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Card details</button>
            <button type="button" class="chip glass fx-press" data-act="reset">Reset</button>
            <button type="button" class="chip glass fx-press gactions__share" data-act="share">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Share link</button>
            <span class="gactions__status" data-status aria-live="polite"></span>
          </div>
          <p class="gnote">Each grade adds +2.5% to that stat (grade 10 = +25%). The card grade is the average of all four, rounded. Grades are saved on this device and don't change the Tier List.</p>
        </div>
      </div>`;
  }

  // bonus % + stat value for one row
  function paintRow(i, { animate = true, pop = false, from = 0 } = {}) {
    const card = byId.get(cur), s = STATS[i], g = grades[i], r = state.rarity;
    const row = ui.rows[i];
    row.dataset.band = band(g);
    $("[data-p]", row).textContent = pct(g);
    setOrb($(".gorb", row), g, { pop });
    const num = $("[data-v]", row), base = $("[data-b]", row);
    if (hasStat(card, s.k, r)) {
      row.classList.remove("is-missing");
      const v = graded(card, s.k, r, g);
      if (animate) FX.countTo(num, v, { format: C.fmtStat }); else { num.dataset.value = v; num.textContent = C.fmtStat(v); }
      base.textContent = g ? `Base ${C.fmtStat(C.statAt(card, s.k, r))}` : `${r} base value`;
    } else {
      row.classList.add("is-missing");
      num.dataset.value = 0; num.textContent = pct(g);
      base.textContent = "Stat not in the data yet, showing the bonus only";
    }
    $$(".gbar__seg", row).forEach((seg) => {
      const n = Number(seg.dataset.g), on = n <= g;
      seg.classList.toggle("is-on", on);
      seg.setAttribute("aria-pressed", String(n === g));
      if (pop && on && n > from && !FX.reduced) {
        seg.style.setProperty("--d", (n - from - 1) * 30 + "ms");
        seg.classList.remove("is-pop"); void seg.offsetWidth; seg.classList.add("is-pop");
      }
    });
  }
  const $$ = (s, r) => [...r.querySelectorAll(s)];

  function paintOverall({ pop = false } = {}) {
    const o = overall(grades);
    setOrb($(".goverall .gorb", ui.detail), o, { pop });
    $(".goverall", ui.detail).dataset.band = band(o);
    const sub = $("[data-o-sub]", ui.detail);
    if (!o) sub.textContent = "Set a grade on each stat below";
    else {
      const sum = grades.reduce((a, n) => a + n, 0);
      sub.textContent = `Average ${Number((sum / 4).toFixed(2))} of ${grades.join(" · ")}`;
    }
    const tile = tiles.get(cur);
    if (tile) cardBadge(tile, any(saved[cur]) ? overall(saved[cur]) : 0);
  }

  // the grader's card sits in a graded case and shows the graded ATK / HP (other cards on the site stay ungraded)
  // pop = the big grade number pops · sheen = the glare runs across the case once
  function paintHero({ animate = true, pop = false, glare = false } = {}) {
    if (!heroSlab) return;
    paintSlab(heroSlab, byId.get(cur), state.rarity, grades, { animate, pop });
    if (glare) sheen(heroSlab);
  }

  function paintShared() {
    const box = $("#gd-shared", ui.detail);
    box.hidden = !shared;
    if (shared) $('[data-act="mine"]', box).textContent = saved[cur] ? "Use my grades" : "Clear";
  }

  function syncHash() {
    const url = gradeUrl(cur, grades);
    if (location.hash !== url) history.replaceState(history.state, "", url);
  }

  function setGrade(i, g) {
    const from = grades[i];
    grades[i] = g;
    shared = false;                   // editing a shared link = making it yours
    save(cur, grades);
    paintRow(i, { pop: true, from: Math.min(from, g) });
    paintOverall({ pop: true });
    paintHero({ pop: true, glare: true });
    paintShared();
    syncHash();
    status("");
  }

  function setAll(a, { pop = true } = {}) {
    grades = a.slice();
    STATS.forEach((_, i) => paintRow(i, { pop, from: 0 }));
    paintOverall({ pop });
    paintHero({ pop, glare: pop });
    paintShared();
    syncHash();
  }

  let statusTimer = 0;
  function status(msg) {
    const el = ui.detail && $("[data-status]", ui.detail);
    if (!el) return;
    el.textContent = msg;
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(() => { el.textContent = ""; }, 2600);
  }

  async function share() {
    const card = byId.get(cur);
    const url = location.href;
    const o = overall(grades);
    const text = o ? `${card.name}: grade ${o} (${grades.join("/")})` : card.name;
    if (navigator.share) {
      try { await navigator.share({ title: `${card.name} grade — Card Battle Infinity`, text, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); status("Link copied"); }
    catch { status(url); }
  }

  function bindDetail() {
    ui.detail.addEventListener("click", (e) => {
      if (e.target.closest(".gdetail__back")) { back(); return; }
      const seg = e.target.closest(".gbar__seg");
      if (seg) {
        const i = Number(seg.dataset.i), g = Number(seg.dataset.g);
        setGrade(i, grades[i] === g ? 0 : g);   // tap the current grade again to clear it
        return;
      }
      const act = e.target.closest("[data-act]");
      if (!act) return;
      const a = act.dataset.act;
      if (a === "reset") { shared = false; save(cur, ZERO()); setAll(ZERO(), { pop: false }); status("Grades cleared"); }
      else if (a === "keep") { shared = false; save(cur, grades); paintShared(); paintOverall(); status("Saved to your grades"); }
      else if (a === "mine") { shared = false; setAll(get(cur) || ZERO()); }
      else if (a === "share") share();
      // step 12: the card detail scene grows from the grader's card; swiping walks the picker's order, Back lands here unchanged
      else if (a === "details" && hero) C.openCard(cur, hero, { list: items.map((c) => c.id) });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && cur && state.page === "grade" && !document.documentElement.classList.contains("is-detail")) back();
    });
    // card detail panel button (the sheet lives outside this page)
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-grade-open]");
      if (b) openFromDetail(b.dataset.gradeOpen);
    });
    // rarity changed anywhere (cards.js): keep the hero, the numbers and the picker in step
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
    // a trait changed (Details sheet, Deck, Traits page): the case labels show the new one
    document.addEventListener("cbi:trait", (e) => {
      const id = e.detail && e.detail.id;
      sheetSlabs.forEach((x) => { if (!x.s.isConnected) sheetSlabs.delete(x); else if (x.card.id === id) { paintSlab(x.s, x.card, state.rarity, get(id) || ZERO(), { animate: false }); sheen(x.s); } });
      if (cur === id && heroSlab) { paintHero({ animate: false, glare: true }); }
    });
  }

  // keep the graded numbers on screen while the rarity swaps underneath, then count to the new ones
  function swapRarity(c, card, name) {
    const keep = ["atk", "hp"].map((k) => { const n = $(`[data-k="${k}"]`, c); return [n.dataset.value, n.textContent]; });
    C.setCardRarity(c, card, name, { animate: false });
    ["atk", "hp"].forEach((k, j) => { const n = $(`[data-k="${k}"]`, c); n.dataset.value = keep[j][0]; n.textContent = keep[j][1]; });
    if (c.classList.contains("is-live")) C.flashCard(c);
  }
  function recolor(name) {
    tiles.forEach((el, id) => C.setCardRarity(el, byId.get(id), name, { animate: false }));
    sheetSlabs.forEach((x) => {
      if (!x.s.isConnected) { sheetSlabs.delete(x); return; }
      if (x.sup) {
        const c = $(".gc", x.s);
        C.setCardRarity(c, x.card, name, { animate: !!x.s.getBoundingClientRect().height });
        paintSupSlab(x.s, x.card, name);
        if (x.s.getBoundingClientRect().height) sheen(x.s);
        return;
      }
      swapRarity($(".gc", x.s), x.card, name);
      paintSlab(x.s, x.card, name, get(x.card.id) || ZERO());
      if (x.s.getBoundingClientRect().height) sheen(x.s);
    });
    if (!cur || !hero) return;
    swapRarity(hero, byId.get(cur), name);
    paintHero({ glare: true });
    STATS.forEach((_, i) => paintRow(i));
  }

  function rarityChips(container) {
    container.innerHTML = state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-rarity="${esc(r.name)}" aria-pressed="${r.name === state.rarity}" style="--sw:${C.RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");
  }

  function openDetail(card, linkGrades) {
    if (cur === null) listScroll = window.scrollY;
    const from = pendingOrigin; pendingOrigin = null;
    const fromRect = from && from.isConnected ? from.getBoundingClientRect() : null;

    const mine = get(card.id);
    shared = !!(linkGrades && any(linkGrades) && !same(linkGrades, mine));
    grades = shared ? linkGrades.slice() : (mine || ZERO());
    cur = card.id; lastId = card.id;

    ui.detail.innerHTML = detailHTML(card);
    ui.rows = $$(".gstat", ui.detail);
    heroSlab = makeSlab(card, state.rarity, grades);   // step 13: the grader's card in a graded case
    hero = $(".card", heroSlab);                          // not a link here (makeSlab took role / tabindex off)
    $("#gd-hero", ui.detail).appendChild(heroSlab);
    rarityChips($("#gd-rarity", ui.detail));
    requestAnimationFrame(() => C.revealChip(ui.detail));

    ui.listView.hidden = true;
    ui.detail.hidden = false;
    window.scrollTo(0, 0);
    document.title = `${card.name} grade — Card Battle Infinity`;

    STATS.forEach((_, i) => paintRow(i, { animate: false }));
    paintOverall();
    paintHero({ animate: false });
    paintShared();
    syncHash();

    const flight = fromRect && rectVisible(fromRect) ? FX.flip(heroSlab, fromRect) : null;
    if (!flight) FX.fade(heroSlab, 1, { duration: 300 });
    FX.stagger($("#gd-main", ui.detail), 60, { cls: "fx-up", max: 8, cleanup: true });
    $(".gdetail__back", ui.detail).focus({ preventScroll: true });
  }

  function closeDetail(restore) {
    cur = null; hero = null; heroSlab = null; shared = false;
    ui.detail.hidden = true;
    ui.detail.innerHTML = "";
    ui.listView.hidden = false;
    applyList();   // the "Graded" filter / badges may have changed
    ui.listView.classList.remove("fx-page-in"); void ui.listView.offsetWidth; ui.listView.classList.add("fx-page-in");
    if (state.page === "grade") document.title = TITLE;
    if (restore && state.page === "grade") {
      window.scrollTo(0, listScroll);
      const t = tiles.get(lastId);
      if (t && t.isConnected) t.focus({ preventScroll: true });
    }
  }

  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  /* Called by the router (js/app.js) on every hash change and tab tap */
  function show(id, gstr, { restore = true } = {}) {
    if (!ui.root || !items.length) return;
    if (id && !byId.has(id)) { history.replaceState(null, "", "#grade"); id = null; }   // unknown id -> the list
    if (!id) { if (cur !== null) closeDetail(restore); return; }
    const link = parse(gstr);
    if (id === cur) {
      if (link && !same(link, grades)) { shared = !same(link, saved[id]); setAll(link); }   // back / forward between links
      return;
    }
    openDetail(byId.get(id), link);
  }

  // Each open adds a history entry, so the phone's Back button returns to the list
  function openGrader(id, originEl) {
    pendingOrigin = originEl || null;
    history.pushState({ grd: 1 }, "", gradeUrl(id, saved[id]));
    C.route();
  }
  function back() {
    if (history.state && history.state.grd) history.back();
    else { history.replaceState(null, "", "#grade"); C.route(); }   // opened from a direct link: no entry to go back to
  }

  /* ---------- Boot ---------- */
  function init() {
    Object.assign(ui, {
      root: $("#page-grade"), listView: $("#grade-list-view"), detail: $("#grade-detail-view"),
      tools: $("#grade-tools"), grid: $("#grade-grid"), none: $("#grade-none"), empty: $("#grade-empty"),
      search: $("#grade-search"), gradedChip: $("#grade-graded"), count: $("#grade-count"), reset: $("#grade-reset"),
    });
    saved = load();
    provideBackup();
    items = state.cards.filter((c) => c && c.id && c.base).slice().sort(compare);
    items.forEach((c) => byId.set(c.id, c));
    bindDetail();

    ui.tools.hidden = !items.length;
    ui.empty.hidden = items.length > 0;
    if (!items.length) return;

    bindList();
    // step 9.5: the picker's cards are made the first time the Grade tab shows
    C.lazy("grade", () => {
      items.forEach((c) => {
        const el = C.renderCard(c, state.rarity, { mini: true });
        el.setAttribute("aria-label", `Grade ${c.name}`);
        if (saved[c.id]) cardBadge(el, overall(saved[c.id]));
        tiles.set(c.id, el);
      });
      built = true;
      applyList({ animate: true });
    });
  }

  C.grade = { init, show, panelHTML, supPanelHTML, mountSlabs, overall, band, get };
})();
