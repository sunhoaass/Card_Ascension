/* ==========================================================
   Card Battle Infinity — Home (plan 2026-10-30 item 5 · look round 1 2026-11-11: the top is mockup C "Lobby",
   mockup/home-v2/index.html #c)
   · the first menu button and the first page on a first visit (#home)
   · top (look round 1): the wall = the cards of the newest update (the newest "added" date of the cards on the site ·
     data/cards.json, the same set newest() always gave) drifting past in rows in a gold frame, rarest first · tap = #card/<id>
     (swipe = the wall's cards) · moves only while it is on screen · one strip of codes (tap = copy) · four big menu plates
     (Cards / Support / Deck / Battle = the menu buttons)
   · lower part (round 2 redoes it): Game updates (major / minor, newest first) · New systems · New support (grid)
   · news text comes from data/news.json ({ updates, codes, systems } · routine E "อัปเดตข่าว" fills it) · a missing or
     empty file = "nothing yet" lines, never an error
   · the NEW badge itself (cards added in the last 14 days) is drawn by C.renderCard (js/app.js C.isNew)
   Needs js/fx.js and js/app.js (C.copyText, C.go) loaded first. Built the first time Home shows (C.lazy).
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const UPDATES_SHOWN = 4;      // older updates wait behind "Show older updates"
  const ui = {};
  const supEls = new Map();     // id -> card element in the New support grid (rarity changes)
  let news = null;

  /* the wall (look round 1) · rows of mini cards (the 300×400 thumbnail + the numbers the site draws) · each row is one layer
     moved by a CSS animation (transform only · css/home.css .hwall) · no blur / mask on anything that moves (fps 35) */
  const WALL_ROWS = 3;
  const ROW_MIN = 12;           // a shorter row repeats itself, so a handful of new cards still fills the frame
  const TAIL = 12;              // copies of a row's first cards after its end: the loop has no seam up to a 1,100px frame
  const SPC = [4.2, 4.8, 3.9];  // seconds per card, row by row (the rows don't move in step)
  const LOAD_FIRST = [6, 8];    // pictures per row when the wall first shows: the frame, then the next ones (2 batches)
  const LOAD_MORE = 4;          // then 4 more a row every 12 s, in the order the drift brings them in (≤ 3.1 cards come in)
  const LOAD_EVERY = 12000;
  const wall = { ids: [], els: [], rows: [], on: false, hold: new Set(), timer: 0, rarity: "", jobs: [], idle: 0, io: null };
  // the pictures on the menu plates (the ones the owner saw in the mockup) · gone = a card of the newest update
  const PLATE_ART = { cards: "sword-saint", support: "eternal-wish-dragon", deck: "shadow-monarch", battle: "one-punch-caped-hero" };

  const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const byDate = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));   // newest first (ISO dates sort as text)
  const fmtDate = (iso, opt) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", opt || { month: "short", day: "numeric", year: "numeric" });
  };
  const timeHTML = (iso, cls) => (fmtDate(iso) ? `<time class="${cls}" datetime="${esc(iso)}">${esc(fmtDate(iso))}</time>` : "");
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const empty = (text) => `<p class="home__empty">${esc(text)}</p>`;
  const thumbOf = (src) => { const i = src.lastIndexOf("/"); return src.slice(0, i + 1) + "thumb/" + src.slice(i + 1); };
  const ric = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 120));
  // a batch of new items slides in one after another (FX.stagger runs on a box's children · display: contents keeps the grid)
  const batch = (cls = "") => Object.assign(document.createElement("div"), { className: "home__batch" + (cls ? " " + cls : "") });

  /* ---------- the newest update's cards / support (newest "added" date on the site · improvement round 3) ---------- */
  const oddsOf = (x) => Number(C.isSupport(x) ? x.odds : x.base && x.base.odds) || 0;
  function newest() {
    const all = [state.cards, state.support].map((arr) => (Array.isArray(arr) ? arr : []).filter((x) => x && x.id && typeof x.added === "string"));
    const last = all.flat().reduce((m, x) => (x.added > m ? x.added : m), "");
    if (!last) return { date: "", cards: [], support: [] };
    const pick = (arr) => arr.filter((x) => x.added === last).sort((a, b) => oddsOf(b) - oddsOf(a) || a.name.localeCompare(b.name));   // rarest first, like the Cards page
    return { date: last, cards: pick(all[0]), support: pick(all[1]) };
  }

  /* ---------- The wall (look round 1) ---------- */
  /* the wall's cards keep their picture in data-wsrc (not data-src): the site's on-screen watcher (js/app.js) lets them go at
     once and never loads them · a watched card in a moving row was measured on every frame (IntersectionObserver ≈ 50 ms a
     second on the 6× slowed test phone) */
  const BLANK = "data:image/gif;base64,R0lGODdhAwAEAIEAABghWgAAAAAAAAAAACwAAAAAAwAEAAAICAABCBxIUGBAADs=";   // painted from the start (see park)
  function park(el) {
    const img = el.querySelector(".gc__art img[data-src]");
    if (img) { img.dataset.wsrc = img.dataset.src; delete img.dataset.src; img.src = BLANK; }
    C.unwatch(el);   // still in the watched list: refit when the web fonts arrive (refitAll)
    return el;
  }
  function copyOf(el, card) {
    const cp = el.cloneNode(true);
    cp.setAttribute("aria-hidden", "true");
    cp.tabIndex = -1;
    cp.dataset.copy = "1";
    C.bindArt(cp, card);   // a missing picture falls back like the card it copies
    C.watchLive(cp);       // into the watched list (fonts) …
    C.unwatch(cp);         // … but not observed
    wall.els.push([cp, card]);
    return cp;
  }
  function buildWall(cards) {
    clearInterval(wall.timer); wall.timer = 0;
    wall.ids = cards.map((c) => c.id); wall.els = []; wall.rows = []; wall.rarity = state.rarity; wall.jobs = [];
    ui.wall.removeAttribute("aria-busy");
    if (!cards.length) { ui.wall.innerHTML = empty("No new cards yet."); return; }
    const n = Math.min(WALL_ROWS, Math.max(1, Math.ceil(cards.length / 6)));
    const deal = Array.from({ length: n }, () => []);
    cards.forEach((c, i) => deal[i % n].push(c));   // rarest cards spread over the rows, each row rarest first
    const rows = document.createElement("div");
    rows.className = "hwall__rows";
    deal.forEach((set, k) => {
      const row = document.createElement("div");
      row.className = "hwall__row";
      const made = set.map((c) => {
        const el = park(C.renderCard(c, state.rarity, { mini: true, tilt: false }));
        wall.els.push([el, c]);
        row.appendChild(el);
        return [el, c];
      });
      while (row.childElementCount < ROW_MIN) made.forEach(([el, c]) => row.appendChild(copyOf(el, c)));
      const cells = row.childElementCount;
      [...row.children].slice(0, TAIL).forEach((el) => row.appendChild(copyOf(el, made.find(([, c]) => c.id === el.dataset.id)[1])));
      rows.appendChild(row);
      // the row moves by its own first `cells` cards: cells ÷ (cells + TAIL) of its width (each card + its margin = one step)
      const anim = FX.reduced || !row.animate ? null : row.animate(
        [{ transform: "translate3d(0, 0, 0)" }, { transform: `translate3d(${(-100 * cells / (cells + TAIL)).toFixed(4)}%, 0, 0)` }],
        { duration: cells * SPC[k % SPC.length] * 1000, iterations: Infinity, direction: k % 2 ? "reverse" : "normal" });
      if (anim) anim.pause();
      // the order the drift shows them: a row going left brings in its next cards · one going right (every 2nd) starts on
      // its tail (= its first cards) and brings in its last cards first
      const ids = set.map((c) => c.id), head = Math.min(TAIL, ids.length);
      const order = k % 2 ? [...ids.slice(0, head), ...ids.slice(head).reverse()] : ids;
      wall.rows.push({ row, order, next: 0, anim });
    });
    ui.wall.replaceChildren(rows);
    if (wall.on) startLoad();
    move();
  }
  // the rows move while the wall is on screen, not under the mouse, no card in it focused
  function move() {
    const go = wall.on && !wall.hold.size;
    wall.rows.forEach((r) => { if (r.anim && (r.anim.playState === "running") !== go) { if (go) r.anim.play(); else r.anim.pause(); } });
  }
  function hold(why, on) { if (on) wall.hold.add(why); else wall.hold.delete(why); move(); }
  /* pictures: the wall loads them itself (the moving rows are moved off the main thread, where the on-screen watcher may not
     see them) · each one is downloaded and decoded off the page first (Image.decode), then put in its cards: a picture that
     arrived straight in a moving row cost a 33–83 ms frame on the 6× slowed test phone (decode + paint in the same frame) */
  function loadId(row, id) {
    const imgs = [...row.querySelectorAll(`.card[data-id="${CSS.escape(id)}"] .gc__art img[data-wsrc]`)];
    if (!imgs.length) return null;
    const src = imgs[0].dataset.wsrc, pre = new Image();
    pre.decoding = "async";
    pre.src = src;
    // a missing thumbnail fails in the cards too: their own fallback (bindArt: the big picture, then the drawn one) takes over
    const put = () => imgs.forEach((img) => { if (img.dataset.wsrc) { delete img.dataset.wsrc; img.src = src; } });
    return (pre.decode ? pre.decode() : Promise.resolve()).then(() => put, () => put);
  }
  /* n more per row, swapped in together in one frame: every picture that lands repaints the page's layers (≈ 40 ms on the 6×
     slowed test phone), so they land in a few batches, not one by one */
  function loadSome(n) {
    const jobs = [];
    wall.rows.forEach((r) => { for (let i = 0; i < n && r.next < r.order.length; i++) jobs.push(loadId(r.row, r.order[r.next++])); });
    const left = wall.rows.some((r) => r.next < r.order.length);
    if (!left) { clearInterval(wall.timer); wall.timer = 0; }
    if (jobs.length) Promise.all(jobs.filter(Boolean)).then((puts) => requestAnimationFrame(() => puts.forEach((f) => f())));
    return left;
  }
  // first look: the cards in the frame, then the next ones · then LOAD_MORE a row every LOAD_EVERY, ahead of the drift
  function startLoad() {
    if (wall.timer) return;
    let left = true;
    if (!wall.rows.some((r) => r.next)) { loadSome(LOAD_FIRST[0]); left = loadSome(LOAD_FIRST[1]); }
    if (left) wall.timer = setInterval(() => loadSome(LOAD_MORE), LOAD_EVERY);
  }
  function setOn(on) {
    wall.on = on;
    ui.wall.classList.toggle("is-on", on);
    move();
    if (on) {
      if (wall.jobs.length) runJobs();         // a level change made while Home was away: finish it before the wall shows
      startLoad();
    } else { clearInterval(wall.timer); wall.timer = 0; }
  }
  // a level change elsewhere (Cards page, card detail): the wall's cards follow it in idle time (not in that tap)
  function wallRarity(name) {
    if (!wall.els.length || wall.rarity === name) return;
    wall.rarity = name;
    wall.jobs = wall.els.map(([el, c]) => () => { if (el.isConnected) C.setCardRarity(el, c, name, { animate: false }); });
    if (wall.on && !C.covered) runJobs();
    else if (!wall.idle) wall.idle = ric(idleJobs);
  }
  function idleJobs(dl) {
    wall.idle = 0;
    while (wall.jobs.length && (!dl || !dl.timeRemaining || dl.didTimeout || dl.timeRemaining() > 4)) wall.jobs.shift()();
    if (wall.jobs.length) wall.idle = ric(idleJobs);
  }
  function runJobs() { while (wall.jobs.length) wall.jobs.shift()(); }
  function openWall(n) {
    if (!n) return;
    C.openCard(n.dataset.id, n, { list: wall.ids });   // swipe = the wall's cards, rarest first (not the rows' order on screen)
  }

  /* ---------- Menu plates (look round 1) ---------- */
  function paintPlates() {
    const cards = list(state.cards), sup = list(state.support), nw = newest();
    document.querySelectorAll("#page-home [data-n]").forEach((b) => {
      const n = b.dataset.n === "support" ? sup.length : cards.length;
      b.textContent = n ? n.toLocaleString("en-US") : "";
    });
    if (ui.allCards) ui.allCards.textContent = cards.length ? `All ${cards.length.toLocaleString("en-US")} cards` : "All cards";
    const spare = [...nw.cards, ...cards].filter((c) => c.image);
    const pick = { cards: 0, deck: 1, battle: 2 };
    document.querySelectorAll("#page-home .hplate[data-art]").forEach((p) => {
      const key = p.dataset.art, pool = key === "support" ? sup : cards;
      const x = pool.find((c) => c.id === PLATE_ART[key] && c.image) ||
        (key === "support" ? [...nw.support, ...sup].find((c) => c.image) : spare[pick[key] || 0]);
      if (!x || $(".hplate__art", p)) return;
      const img = Object.assign(new Image(300, 400), { className: "hplate__art", alt: "", decoding: "async", loading: "lazy", src: thumbOf(x.image) });
      img.addEventListener("error", () => img.remove(), { once: true });
      p.prepend(img);
    });
  }
  function goTo(dest) {
    if (dest === "cards" || dest === "support") { state.kind = dest; C.go("cards"); }   // the Cards tab, on that side
    else C.go(dest);
  }

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

  /* ---------- Codes: one strip, tap a code = copy it (look round 1) ---------- */
  function paintCodes() {
    const all = list(news && news.codes).filter((c) => typeof c.code === "string" && c.code.trim()).sort(byDate);
    ui.codesN.hidden = !all.length;
    ui.codesN.textContent = all.length;
    ui.codesRow.innerHTML = all.length
      ? all.map((c) => {
        const code = esc(c.code.trim()), reward = typeof c.reward === "string" && c.reward.trim() ? esc(c.reward.trim()) : "";
        return `<button class="hcode fx-press" type="button" data-code="${code}"${reward ? ` title="${reward}"` : ""} aria-label="Copy code ${code}${reward ? ` (${reward})` : ""}">
          <code class="hcode__code">${code}</code><svg class="hcode__ico" aria-hidden="true"><use href="#i-copy"/></svg></button>`;
      }).join("")
      : empty("No codes right now. Check back after the next update.");
  }
  async function copyCode(btn) {
    const ok = await C.copyText(btn.dataset.code);
    if (ok) {
      btn.classList.add("is-done");
      const u = $("use", btn); if (u) u.setAttribute("href", "#i-check");
      FX.flash(btn);
      FX.toast("Copied");
    } else FX.toast("Couldn't copy. Press and hold the code to copy it.");
  }

  /* ---------- New support (a grid until round 2) ---------- */
  function fillGrid(box, more, items, noun) {
    const cols = () => Math.max(1, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--grid-cols"), 10) || 3);
    let shown = 0;
    const add = (n) => {
      const wrap = batch("home__batch--grid"), made = [];
      items.slice(shown, shown + n).forEach((x) => {
        const el = C.renderCard(x, state.rarity, { mini: true, grid: true });   // thumbnail, or the big picture on big / sharp screens (improvement round 3)
        supEls.set(x.id, [el, x]);
        made.push(el); wrap.appendChild(el);
      });
      shown += made.length;
      box.appendChild(wrap);
      FX.stagger(wrap, 40, { cls: "fx-grid-in", max: 16, cleanup: true });
      const rest = items.length - shown;
      more.hidden = rest <= 0;
      if (rest > 0) more.textContent = `Show more ${noun} (${rest})`;
      return made;
    };
    box.replaceChildren();
    add(cols() * 2);
    more.onclick = () => { const made = add(C.PAGE_SIZE); if (made[0]) made[0].focus({ preventScroll: true }); };
  }
  function recolor(name) {
    const all = [...supEls.values()].filter(([el]) => el.isConnected);
    const seen = all.map(([el]) => !C.covered && rectVisible(el.getBoundingClientRect()));   // read first, then write · C.covered: the card detail covers the page (speed 2026-11-03)
    C.later("home", all.map(([el, x], i) => () => C.setCardRarity(el, x, name, { animate: seen[i] && state.page === "home" })));
    wallRarity(name);
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
  function paintNew() {
    const { date, cards, support } = newest();
    ui.wallSub.innerHTML = date && cards.length ? `Added ${esc(fmtDate(date, { month: "short", day: "numeric" }))} · <b>${cards.length}</b>` : "";
    ui.seeNew.hidden = !cards.length;
    buildWall(cards);
    supEls.clear();
    ui.supWrap.hidden = !support.length;
    if (support.length) fillGrid(ui.sup, ui.moreSup, support, "support");
  }
  async function build() {
    paintNew();     // the cards (and their "added" dates) are already in (boot) · the news file comes next
    paintPlates();
    FX.stagger(ui.lob, 70, { cls: "fx-up", max: 3, cleanup: true });
    if ("IntersectionObserver" in window) {
      wall.io = new IntersectionObserver((es) => setOn(es[es.length - 1].isIntersecting), { rootMargin: "80px 0px" });
      wall.io.observe(ui.wall);
    } else setOn(true);
    try { news = await C.loadJSON("data/news.json"); } catch { news = null; }   // missing file = empty news, not an error
    if (!news || typeof news !== "object") news = {};
    C.noteUpdated(news.updated);   // "Updated …" in the top bar follows the newest news too (audit 2026-11-09)
    paintUpdates(); paintCodes(); paintSystems();
    [ui.updates, ui.codesRow, ui.systems].forEach((box) => { if (box) FX.stagger(box, 50, { cls: "fx-up", max: 8, cleanup: true }); });
  }

  function init() {
    Object.assign(ui, {
      lob: $("#page-home .hlob"), wall: $("#home-wall"), wallSub: $("#home-wall-sub"), seeNew: $("#home-see-new"), allCards: $("#home-all-cards"),
      codesN: $("#home-codes-n"), codesRow: $("#home-codes-row"),
      updates: $("#home-updates"), older: $("#home-older"), systems: $("#home-systems"),
      supWrap: $("#home-new-sup-wrap"), sup: $("#home-new-sup"), moreSup: $("#home-more-sup"),
    });
    if (!ui.wall) return;
    const page = $("#page-home");
    ui.codesRow.addEventListener("click", (e) => { const b = e.target.closest(".hcode"); if (b) copyCode(b); });
    // the wall's cards open here ([data-no-detail] keeps the site-wide card tap out: it would swipe the rows' screen order)
    ui.wall.addEventListener("click", (e) => openWall(e.target.closest(".card[data-id]")));
    ui.wall.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card[data-id]")) { e.preventDefault(); openWall(e.target); }
    });
    if (matchMedia("(hover: hover)").matches) {
      ui.wall.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hold("hover", true); });
      ui.wall.addEventListener("pointerleave", () => hold("hover", false));
    }
    ui.wall.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) hold("focus", true); });   // keyboard only (a tap focuses the card too)
    ui.wall.addEventListener("focusout", (e) => { if (!ui.wall.contains(e.relatedTarget)) hold("focus", false); });
    ui.seeNew.addEventListener("click", () => { if (wall.ids.length) C.openCard(wall.ids[0], ui.seeNew, { list: wall.ids }); });
    page.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) goTo(b.dataset.go); });
    // a finger on Deck / Battle starts loading that page's code, like the menu buttons (improvement round 4)
    page.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("[data-go]"), mod = b && C.PAGE_MOD[b.dataset.go];
      if (mod && !C.has(mod)) C.need(mod).catch(() => {});
    }, { passive: true });
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
    C.lazy("home", build);
  }

  C.home = { init };
})();
