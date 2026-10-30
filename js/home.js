/* ==========================================================
   Card Battle Infinity — Home (plan 2026-10-30 item 5)
   · the first menu button and the first page on a first visit (#home)
   · Game updates (major / minor, newest first) · Latest codes (Copy) · New cards (the newest "added" date in
     data/pool.json, game cards, tap = #card/<id>) · New systems
   · news text comes from data/news.json ({ updates, codes, systems } · routine E "อัปเดตข่าว" fills it) · a missing or
     empty file = "nothing yet" lines, never an error
   · the NEW badge itself (cards added in the last 14 days) is drawn by C.renderCard (js/app.js C.isNew)
   Needs js/fx.js, js/app.js and js/share.js (copyText) loaded first. Built the first time Home shows (C.lazy).
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const UPDATES_SHOWN = 4;      // older updates wait behind "Show older updates"
  const ui = {};
  const cardEls = new Map();    // id -> card element in the New cards grids (rarity changes)
  let news = null;

  const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const byDate = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));   // newest first (ISO dates sort as text)
  const fmtDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const timeHTML = (iso, cls) => (fmtDate(iso) ? `<time class="${cls}" datetime="${esc(iso)}">${esc(fmtDate(iso))}</time>` : "");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const empty = (text) => `<p class="home__empty">${esc(text)}</p>`;
  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  // a batch of new items slides in one after another (FX.stagger runs on a box's children · display: contents keeps the grid)
  const batch = (cls = "") => Object.assign(document.createElement("div"), { className: "home__batch" + (cls ? " " + cls : "") });

  /* ---------- Game updates ---------- */
  function updateHTML(u) {
    const major = u.kind === "major";
    const rows = (Array.isArray(u.items) ? u.items : []).filter((t) => typeof t === "string" && t.trim());
    return `<article class="hnews panel" data-kind="${major ? "major" : "minor"}">
      <header class="hnews__head">
        <span class="hnews__kind">${major ? "Major update" : "Minor update"}</span>
        ${timeHTML(u.date, "hnews__date")}
      </header>
      ${u.title ? `<h3 class="hnews__title">${esc(u.title)}</h3>` : ""}
      ${rows.length ? `<ul class="hnews__items">${rows.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </article>`;
  }
  function paintUpdates() {
    const all = list(news && news.updates).sort(byDate);
    if (!all.length) { ui.updates.innerHTML = empty("No game updates yet."); ui.older.hidden = true; return; }
    ui.updates.innerHTML = all.slice(0, UPDATES_SHOWN).map(updateHTML).join("");
    const rest = all.length - UPDATES_SHOWN;
    ui.older.hidden = rest <= 0;
    if (rest > 0) ui.older.textContent = `Show older updates (${rest})`;
    ui.older.onclick = () => {
      const box = batch();
      box.innerHTML = all.slice(UPDATES_SHOWN).map(updateHTML).join("");
      ui.updates.appendChild(box);
      ui.older.hidden = true;
      FX.stagger(box, 60, { cls: "fx-up", max: 6, cleanup: true });
    };
  }

  /* ---------- Latest codes ---------- */
  function paintCodes() {
    const all = list(news && news.codes).filter((c) => typeof c.code === "string" && c.code.trim()).sort(byDate);
    if (!all.length) { ui.codes.innerHTML = empty("No codes right now. Check back after the next update."); return; }
    ui.codes.innerHTML = `<ul class="hcodes">${all.map((c) => `<li class="hcode">
        <div class="hcode__main">
          <code class="hcode__code">${esc(c.code.trim())}</code>
          ${c.reward ? `<span class="hcode__reward">${esc(c.reward)}</span>` : ""}
          ${timeHTML(c.date, "hcode__date")}
        </div>
        <button class="tm-btn hcode__copy fx-press" type="button" data-code="${esc(c.code.trim())}" aria-label="Copy code ${esc(c.code.trim())}">${COPY_ICON}<span>Copy</span></button>
      </li>`).join("")}</ul>`;
  }
  async function copyCode(btn) {
    const code = btn.dataset.code;
    const ok = C.share && C.share.copyText ? await C.share.copyText(code) : false;
    if (ok) {
      FX.flash(btn.closest(".hcode") || btn);
      FX.toast("Copied");
    } else FX.toast("Couldn't copy. Press and hold the code to copy it.");
  }

  /* ---------- New cards (newest "added" date in data/pool.json) ---------- */
  function newest() {
    const items = state.pool ? state.pool.items.filter((i) => i && i.id && i.added) : [];
    const last = items.reduce((m, i) => (i.added > m ? i.added : m), "");
    if (!last) return { date: "", cards: [], support: [] };
    const odds = new Map(items.filter((i) => i.added === last).map((i) => [i.id, Number(i.odds) || 0]));
    const pick = (arr) => (arr || []).filter((x) => x && odds.has(x.id)).sort((a, b) => odds.get(b.id) - odds.get(a.id) || a.name.localeCompare(b.name));   // rarest first, like the Cards page
    return { date: last, cards: pick(state.cards), support: pick(state.support) };
  }
  // one grid per kind (cards never mix with support when swiping in the detail) · two rows at first, then a page more per tap
  function fillGrid(box, more, items, noun) {
    const cols = () => Math.max(1, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--grid-cols"), 10) || 3);
    let shown = 0;
    const add = (n) => {
      const wrap = batch("home__batch--grid"), made = [];
      items.slice(shown, shown + n).forEach((x) => {
        const el = C.renderCard(x, state.rarity, { mini: true });
        cardEls.set(x.id, [el, x]);
        made.push(el); wrap.appendChild(el);
      });
      shown += made.length;
      box.appendChild(wrap);
      FX.stagger(wrap, 40, { cls: "fx-grid-in", max: 16, cleanup: true });
      const rest = items.length - shown;
      more.hidden = rest <= 0;
      if (rest > 0) more.textContent = `Show more ${noun[1]} (${rest})`;
      return made;
    };
    box.replaceChildren();
    add(cols() * 2);
    more.onclick = () => { const made = add(C.PAGE_SIZE); if (made[0]) made[0].focus({ preventScroll: true }); };
  }
  function paintNew() {
    const { date, cards, support } = newest();
    cardEls.clear();
    ui.newSub.textContent = date
      ? `Added ${fmtDate(date)} · ${[cards.length ? plural(cards.length, "card", "cards") : "", support.length ? `${support.length} support` : ""].filter(Boolean).join(" · ")}`
      : "";
    ui.newCardsWrap.hidden = !cards.length;
    ui.newSupWrap.hidden = !support.length;
    ui.newNone.hidden = !!(cards.length || support.length);
    if (cards.length) fillGrid(ui.newCards, ui.moreCards, cards, ["card", "cards"]);
    if (support.length) fillGrid(ui.newSup, ui.moreSup, support, ["support", "support"]);
  }
  function recolor(name) {
    const all = [...cardEls.values()].filter(([el]) => el.isConnected);
    const seen = all.map(([el]) => rectVisible(el.getBoundingClientRect()));   // read first, then write
    all.forEach(([el, x], i) => C.setCardRarity(el, x, name, { animate: seen[i] && state.page === "home" }));
  }

  /* ---------- New systems ---------- */
  function paintSystems() {
    const all = list(news && news.systems).filter((s) => s.title || s.desc).sort(byDate);
    ui.systems.innerHTML = all.length
      ? all.map((s) => `<article class="hsys panel">
          ${timeHTML(s.date, "hsys__date")}
          ${s.title ? `<h3 class="hsys__title">${esc(s.title)}</h3>` : ""}
          ${s.desc ? `<p class="hsys__desc">${esc(s.desc)}</p>` : ""}
        </article>`).join("")
      : empty("No new systems yet.");
  }

  /* ---------- Build (first time Home shows) ---------- */
  async function build() {
    paintNew();   // pool.json is already in (boot) · the news file comes next
    try { news = await C.loadJSON("data/news.json"); } catch { news = null; }   // missing file = empty news, not an error
    if (!news || typeof news !== "object") news = {};
    paintUpdates(); paintCodes(); paintSystems();
    [ui.updates, $(".hcodes", ui.codes), ui.systems].forEach((box) => { if (box) FX.stagger(box, 50, { cls: "fx-up", max: 8, cleanup: true }); });
  }

  function init() {
    Object.assign(ui, {
      updates: $("#home-updates"), older: $("#home-older"), codes: $("#home-codes"), systems: $("#home-systems"),
      newSub: $("#home-new-sub"), newNone: $("#home-new-none"),
      newCardsWrap: $("#home-new-cards-wrap"), newCards: $("#home-new-cards"), moreCards: $("#home-more-cards"),
      newSupWrap: $("#home-new-sup-wrap"), newSup: $("#home-new-sup"), moreSup: $("#home-more-sup"),
    });
    if (!ui.updates) return;
    ui.codes.addEventListener("click", (e) => { const b = e.target.closest(".hcode__copy"); if (b) copyCode(b); });
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
    C.lazy("home", build);
  }

  C.home = { init };
})();
