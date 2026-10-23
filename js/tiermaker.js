/* ==========================================================
   Card Battle Infinity — Tier Maker (step 8) · the "My Lists" tab of the Tier List page
   · #tier/my        = all of the user's lists (create / open / duplicate / delete)
   · #tier/my/<id>   = the editor for one list (each open adds a history entry, so phone Back returns to the lists)
   · Lists live in localStorage "cbi:tierlists" (PROGRESS.md §10.2) and save on every change. No Save button.
   · Moving cards: drag (Pointer Events: mouse moves right away, touch = hold ~0.26s) or tap a card, then tap a row.
     The pool always holds the whole library: dragging out of it makes a copy, so a card can sit in a list more than once.
   · Undo / Redo: 50 steps per list (buttons + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), kept while the page is open.
   · Step 9 (js/share.js): list menu has Save as image / Share link · #tier/s/<data> opens a shared list view only
     (with "Save a copy") · Backup button (export / import everything) · registers its lists with the backup file
   Loaded after every other page script (needs C.renderCard from app.js and C.support.card from support.js).
   tier.js calls C.tm.init() once and C.tm.show(listId|null) whenever the My Lists tab is showing.
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const KEY = "cbi:tierlists";
  const PREF_KEY = "cbi:tmPrefs";                 // { compare, poolOpen, hidePlaced }
  const HISTORY_MAX = 50, ROW_MAX = 20, LABEL_MAX = 24, NAME_MAX = 40;
  const LIST_MAX = 200, ITEM_MAX = 600;            // most lists / cards we accept from a backup or a shared link
  const HOLD_MS = 260;                             // touch: hold this long before a card lifts
  const SLOP = 10;                                 // touch: moving further than this before the lift = scrolling
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  const COLORS = ["--t-ss", "--t-s", "--t-a", "--t-b", "--t-c", "--t-d", "--t-x-red", "--t-x-lime", "--t-x-teal", "--t-x-blue", "--t-x-violet", "--t-x-white"];
  const COLOR_NAMES = {
    "--t-ss": "Pink", "--t-s": "Orange", "--t-a": "Yellow", "--t-b": "Green", "--t-c": "Sky blue", "--t-d": "Grey",
    "--t-x-red": "Red", "--t-x-lime": "Lime", "--t-x-teal": "Teal", "--t-x-blue": "Blue", "--t-x-violet": "Violet", "--t-x-white": "White",
  };

  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    copy: svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
    up: svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
    down: svg('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
    eraser: svg('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
    pencil: svg('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),
    ...((C.share && C.share.icons) || {}),         // image, link, download, check... (js/share.js)
  };

  const ui = {};
  let ready = false, canSave = true;
  let lists = [];                 // every saved list, in the order shown
  let cur = null;                 // the list open in the editor
  let mode = null;                // "index" | "editor" | "shared"
  let shared = null;              // the list in a #tier/s/<data> link: { data, list, copyId } (view only)
  let shData = null;              // the link data being shown or loaded
  let shToken = 0;                // newest link load (an older one that finishes late is ignored)
  const shCopies = new Map();     // link data -> id of the copy saved from it (so Save a copy never makes a second one)
  let sel = null;                 // { el, uid } a placed card · { el, pool: id } a pool card
  let live = null;                // rows snapshot while the row dialog edits live (one undo step for the whole dialog)
  let indexY = 0;
  let cardById = new Map(), supById = new Map();
  let rankedCards = [], rankedSup = [];
  const hist = new Map();         // list id -> { undo: [], redo: [] } (rows snapshots as JSON)
  const itemEls = new Map();      // uid -> .tm-item in the rows
  const rowEls = new Map();       // row id -> .tm-row
  const poolEls = new Map();      // card / support id -> .tm-item in the pool
  let poolType = null, poolRarity = null;
  const prefs = { compare: false, poolOpen: true, hidePlaced: false };
  const pf = { q: "", tier: "", role: "", series: "" };
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ---------- Small helpers ---------- */
  const now = () => new Date().toISOString();
  let seq = 0;
  const newId = (p) => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  const str = (v) => (typeof v === "string" ? v : "");
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const tierNames = () => state.meta.tiers.map((t) => t.name);
  const isRankedSup = (s) => !!(s && s.scores && s.scores.value > 0 && s.tier);
  const isRankedOf = (type, x) => !!x && (type === "card" ? C.isRanked(x) : isRankedSup(x));
  const lookup = (type, id) => (type === "card" ? cardById : supById).get(id);
  const nounOf = (type, n) => (type === "card" ? plural(n, "card", "cards") : plural(n, "support card", "support cards"));
  const countItems = (l) => l.rows.reduce((s, r) => s + r.items.length, 0);
  const snap = () => JSON.stringify(cur.rows);
  const histOf = (id) => { if (!hist.has(id)) hist.set(id, { undo: [], redo: [] }); return hist.get(id); };
  const locate = (rows, uid) => {
    for (const row of rows) { const index = row.items.findIndex((x) => x.uid === uid); if (index >= 0) return { row, index }; }
    return null;
  };
  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const same = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-US", same ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  };

  /* ==========================================================
     Saving (localStorage, never crashes when blocked)
     ========================================================== */
  function loadPrefs() {
    try { const p = JSON.parse(localStorage.getItem(PREF_KEY)); if (p && typeof p === "object") Object.keys(prefs).forEach((k) => { if (typeof p[k] === "boolean") prefs[k] = p[k]; }); } catch {}
  }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }

  // Anything odd in storage (old format, hand edits) is repaired instead of thrown away
  function clean(l) {
    if (!l || typeof l !== "object") return null;
    const type = l.type === "support" ? "support" : "card";
    const uids = new Set(), rowIds = new Set();
    const rows = (Array.isArray(l.rows) ? l.rows : []).filter((r) => r && typeof r === "object").slice(0, ROW_MAX).map((r) => {
      let id = str(r.id);
      if (!id || rowIds.has(id)) id = newId("r");
      rowIds.add(id);
      const items = (Array.isArray(r.items) ? r.items : []).filter((it) => it && str(it.id)).map((it) => {
        let uid = str(it.uid);
        if (!uid || uids.has(uid)) uid = newId("i");
        uids.add(uid);
        return { uid, id: it.id };
      });
      return { id, label: str(r.label).slice(0, LABEL_MAX), color: COLORS.includes(r.color) ? r.color : "--t-d", items };
    });
    const rarity = state.meta.rarities.some((x) => x.name === l.rarity) ? l.rarity : "Normal";
    return { id: str(l.id) || newId("tl_"), name: str(l.name).trim().slice(0, NAME_MAX) || "Untitled list", type, rarity, rows, created: str(l.created) || now(), updated: str(l.updated) || now() };
  }
  function load() {
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { raw = []; }
    const seen = new Set();
    lists = (Array.isArray(raw) ? raw : []).map(clean).filter((l) => l && !seen.has(l.id) && seen.add(l.id));
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(lists)); canSave = true; } catch { canSave = false; }
    ui.warn.hidden = canSave;
  }
  function touch() { if (cur) cur.updated = now(); save(); }

  /* ==========================================================
     Motion helpers (transform / opacity only, §4)
     ========================================================== */
  function anim(el, frames, opts) {
    if (!el.animate) return null;
    if (el._tmAnim) el._tmAnim.cancel();
    const a = el.animate(frames, { easing: EASE, ...opts });
    el._tmAnim = a;
    a.onfinish = () => { if (el._tmAnim === a) el._tmAnim = null; };
    return a;
  }
  const stop = (el) => { if (el._tmAnim) { el._tmAnim.cancel(); el._tmAnim = null; } };
  const slide = (el, dx, dy, duration = 260) => (FX.reduced ? null : anim(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration }));
  function popIn(el) {
    if (FX.reduced) return anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    return anim(el, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 260 });
  }
  // a copy of a removed element shrinks and fades where it was (the real one is already gone, so nothing waits for it)
  function ghostOut(el, r) {
    const g = el.cloneNode(true);
    g.classList.add("tm-fx");
    g.removeAttribute("id");
    Object.assign(g.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    ui.layer.appendChild(g);
    const a = g.animate(
      FX.reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: "none", opacity: 1 }, { transform: "scale(.6)", opacity: 0 }],
      { duration: FX.reduced ? 150 : 220, easing: EASE, fill: "forwards" }
    );
    a.onfinish = a.oncancel = () => g.remove();
  }
  // the dropped card flies from where the finger let go into its slot, then settles with a small bounce
  function landAt(el, from) {
    if (!from) { popIn(el); return; }
    if (FX.reduced) return;
    const to = el.getBoundingClientRect();
    if (!to.width) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    anim(el, [
      { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` },
      { transform: "scale(.95)", offset: 0.72 },
      { transform: "none" },
    ], { duration: 280 });
  }

  /* Read positions of every row and card (and stop running moves so the "after" positions are clean) */
  function measure() {
    const m = new Map();
    rowEls.forEach((el, id) => { if (el.isConnected) m.set("r:" + id, el.getBoundingClientRect()); });
    itemEls.forEach((el, u) => { if (el.isConnected) m.set("i:" + u, el.getBoundingClientRect()); });
    rowEls.forEach(stop); itemEls.forEach(stop);
    return m;
  }
  /* FLIP: everything slides from where it was to where it is now. Cards inside a row that moved only play their own part. */
  function play(before, gone = [], land = null, duration = 260) {
    gone.forEach(([k, el]) => { const r = before.get(k); if (r && rectVisible(r)) ghostOut(el, r); });
    const shift = new Map();
    rowEls.forEach((el, id) => {
      const a = before.get("r:" + id), b = el.getBoundingClientRect();
      if (!a) { shift.set(id, null); if (rectVisible(b)) popIn(el); return; }
      const dx = a.left - b.left, dy = a.top - b.top;
      shift.set(id, [dx, dy]);
      if ((Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) && (rectVisible(a) || rectVisible(b))) slide(el, dx, dy, duration);
    });
    itemEls.forEach((el, u) => {
      if (land && land.uid === u) return;
      const row = el.closest(".tm-row");
      const s = row ? shift.get(row.dataset.row) : [0, 0];
      if (s === null) return;                           // the whole row is new and pops in
      const a = before.get("i:" + u), b = el.getBoundingClientRect();
      if (!a || !a.width) { if (rectVisible(b)) popIn(el); return; }
      const dx = a.left - b.left - (s ? s[0] : 0), dy = a.top - b.top - (s ? s[1] : 0);
      if ((Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) && (rectVisible(a) || rectVisible(b))) slide(el, dx, dy, duration);
    });
    if (land) { const el = itemEls.get(land.uid); if (el) landAt(el, land.rect); }
  }

  /* Put `kids` into `parent` in this order, reusing nodes (no re-render: cards keep their aura and focus) */
  function sync(parent, kids) {
    let ref = parent.firstChild;
    kids.forEach((k) => { if (k === ref) ref = ref.nextSibling; else parent.insertBefore(k, ref); });
    while (ref) { const n = ref.nextSibling; parent.removeChild(ref); ref = n; }
  }

  /* ==========================================================
     Cards (one .tm-item wraps a mini game card or a support card)
     ========================================================== */
  function makeItem(id, type, rarity) {
    const el = document.createElement("div");
    el.className = "tm-item";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.dataset.id = id;
    const x = lookup(type, id);
    if (!x) {                                           // not in the library any more: keep it, show a dashed slot
      el.classList.add("tm-item--missing");
      el.dataset.name = pretty(id);
      el.innerHTML = `<span class="tm-missing"><span>${esc(pretty(id))}</span><small>Not in the library</small></span>`;
      return el;
    }
    el.dataset.name = x.name;
    let art;
    if (type === "card") {
      art = C.renderCard(x, rarity, { mini: true });
      art.tabIndex = -1;
      art.removeAttribute("role");
    } else {
      art = C.support.card(x);
      FX.tilt(art);
    }
    art.setAttribute("aria-hidden", "true");
    el.appendChild(art);
    return el;
  }
  function itemEl(it) {
    let el = itemEls.get(it.uid);
    if (!el || el.dataset.id !== it.id) { el = makeItem(it.id, cur.type, cur.rarity); itemEls.set(it.uid, el); }
    el.dataset.uid = it.uid;
    el.classList.remove("tm-src", "is-pressing");
    return el;
  }

  /* ==========================================================
     Rows
     ========================================================== */
  function rowShell(r) {
    let el = rowEls.get(r.id);
    if (!el) {
      el = document.createElement("section");
      el.className = "tm-row glass";
      el.dataset.row = r.id;
      el.innerHTML = `<button type="button" class="tm-row__label fx-press"><span class="tm-row__text"></span></button><div class="tm-row__items"></div>`;
      el._empty = document.createElement("p");
      el._empty.className = "tm-row__empty";
      el._empty.textContent = "Drop cards here";
      rowEls.set(r.id, el);
    }
    el.style.setProperty("--tc", `var(${r.color})`);
    const text = r.label.trim();
    const lab = el.firstElementChild;
    lab.firstElementChild.textContent = text;
    lab.dataset.len = text.length <= 2 ? "s" : text.length <= 5 ? "m" : "l";
    el.setAttribute("aria-label", `Row ${text || "with no label"}, ${nounOf(cur.type, r.items.length)}`);
    return el;
  }
  function labelRowButtons() {
    if (!cur) return;
    cur.rows.forEach((r) => {
      const el = rowEls.get(r.id);
      if (!el) return;
      const t = r.label.trim() || "with no label";
      el.firstElementChild.setAttribute("aria-label", sel ? `Put ${sel.el.dataset.name} in row ${t}` : `Edit row ${t}`);
    });
  }

  /* Draw the open list from cur.rows. anim: FLIP everything that moved · land: { uid, rect } a dropped card */
  function renderRows({ anim: animate = false, land = null, duration = 260 } = {}) {
    const before = animate ? measure() : null;
    const liveRows = new Set(), liveItems = new Set();
    const rowNodes = cur.rows.map((r) => {
      liveRows.add(r.id);
      const el = rowShell(r);
      el.classList.remove("has-ph", "is-over");
      const kids = r.items.map((it) => { liveItems.add(it.uid); return itemEl(it); });
      sync(el.lastElementChild, kids.length ? kids : [el._empty]);
      return el;
    });
    const gone = [];
    rowEls.forEach((el, id) => { if (!liveRows.has(id)) { rowEls.delete(id); gone.push(["r:" + id, el]); } });
    itemEls.forEach((el, u) => {
      if (liveItems.has(u)) return;
      itemEls.delete(u);
      const row = el.closest(".tm-row");                 // cards inside a deleted row leave with the row
      if (!row || liveRows.has(row.dataset.row)) gone.push(["i:" + u, el]);
    });
    sync(ui.rows, rowNodes);
    decorate();
    chrome();
    if (before) play(before, gone, land, duration);
  }

  /* aria labels + "Compare with Global" badges */
  function decorate() {
    const cmp = prefs.compare && cur.type === "card";
    const names = tierNames();
    cur.rows.forEach((r, ri) => {
      // a row labelled like a Global tier is that tier; any other label counts by its position (row 1 = SS, row 2 = S, ...)
      const t = r.label.trim().toUpperCase();
      let level = names.findIndex((n) => n.toUpperCase() === t);
      if (level < 0) level = Math.min(ri, names.length - 1);
      const rowText = r.label.trim() || "with no label";
      r.items.forEach((it) => {
        const el = itemEls.get(it.uid);
        if (!el) return;
        const x = lookup(cur.type, it.id);
        let extra = "";
        if (cmp && x && C.isRanked(x)) {
          const d = names.indexOf(x.tier) - level;     // > 0: placed higher than Global
          const badge = d > 0 ? `↑${d}` : d < 0 ? `↓${-d}` : "=";
          extra = d > 0 ? `, ${plural(d, "tier", "tiers")} higher than Global ${x.tier}` : d < 0 ? `, ${plural(-d, "tier", "tiers")} lower than Global ${x.tier}` : `, same as Global ${x.tier}`;
          if (!el._cmp) { el._cmp = document.createElement("span"); el._cmp.className = "tm-cmp"; el._cmp.setAttribute("aria-hidden", "true"); }
          el._cmp.textContent = badge;
          el._cmp.dataset.d = d > 0 ? "up" : d < 0 ? "down" : "same";
          if (!el._cmp.isConnected) el.appendChild(el._cmp);
        } else if (el._cmp) el._cmp.remove();
        const missing = x ? "" : ", not in the library";
        el.setAttribute("aria-label", `${el.dataset.name}${missing}, row ${rowText}${extra}`);
      });
    });
    labelRowButtons();
  }

  /* Header line, undo / redo buttons, row limit, "hide placed" pool */
  function chrome() {
    const h = histOf(cur.id);
    ui.undo.disabled = !h.undo.length;
    ui.redo.disabled = !h.redo.length;
    ui.meta.textContent = `${plural(cur.rows.length, "row", "rows")} · ${nounOf(cur.type, countItems(cur))}`;
    const full = cur.rows.length >= ROW_MAX;
    ui.addRow.disabled = full;
    ui.addRowText.textContent = full ? `Row limit reached (${ROW_MAX})` : "Add row";
    if (prefs.hidePlaced) applyPool();
  }

  /* ==========================================================
     Edits: every change goes through commit() so it can be undone and is saved straight away
     ========================================================== */
  function commit(fn, opts = {}) {
    endLive();
    const before = snap();
    fn(cur.rows);
    const changed = snap() !== before;
    if (changed) {
      const h = histOf(cur.id);
      h.undo.push(before);
      if (h.undo.length > HISTORY_MAX) h.undo.shift();
      h.redo.length = 0;
      touch();
    }
    renderRows(opts);
    return changed;
  }
  function step(dir) {
    if (!cur || mode !== "editor") return;
    endLive();
    const h = histOf(cur.id);
    const from = dir < 0 ? h.undo : h.redo, to = dir < 0 ? h.redo : h.undo;
    if (!from.length) return;
    to.push(snap());
    cur.rows = JSON.parse(from.pop());
    clearSel();
    touch();
    renderRows({ anim: true });
  }
  // the row dialog changes label / colour / order as you go; the whole visit becomes one undo step
  function beginLive() { live = snap(); }
  function endLive() {
    if (live === null || !cur) { live = null; return; }
    const before = live;
    live = null;
    if (snap() === before) return;
    const h = histOf(cur.id);
    h.undo.push(before);
    if (h.undo.length > HISTORY_MAX) h.undo.shift();
    h.redo.length = 0;
    chrome();
  }
  function liveEdit(fn, animate = false) {
    fn(cur.rows);
    touch();
    renderRows({ anim: animate });
  }
  // toast with Undo that only undoes this exact change (not something done after it)
  function undoToast(text) {
    const id = cur.id, n = histOf(id).undo.length;
    toast(text, { label: "Undo", fn: () => { if (cur && cur.id === id && mode === "editor" && histOf(id).undo.length === n) step(-1); } });
  }
  function toast(text, action = null) {
    let bottom = null;
    if (mode === "editor" && !ui.editor.hidden) {
      const r = ui.dock.getBoundingClientRect();
      if (rectVisible(r)) bottom = Math.max(0, innerHeight - r.top) + 10;
    }
    FX.toast(text, { action, bottom });
  }

  function addRow() {
    if (cur.rows.length >= ROW_MAX) return;
    const used = new Set(cur.rows.map((r) => r.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[cur.rows.length % COLORS.length];
    const id = newId("r");
    commit((rows) => { rows.push({ id, label: "New", color, items: [] }); }, { anim: true });
    const el = rowEls.get(id);
    if (el) el.scrollIntoView({ block: "nearest", behavior: FX.reduced ? "auto" : "smooth" });
  }

  /* ==========================================================
     Selecting (tap) and placing (tap a row)
     ========================================================== */
  function select(el) {
    if (sel && sel.el === el) { clearSel(); return; }
    clearSel();
    const inPool = ui.pool.contains(el);
    sel = inPool ? { el, pool: el.dataset.id } : { el, uid: el.dataset.uid };
    el.classList.add("is-selected");
    el.setAttribute("aria-pressed", "true");
    ui.editor.classList.add("is-targeting");
    ui.actName.textContent = el.dataset.name;
    ui.actHint.textContent = inPool ? "Tap a row to add it" : "Tap another row to move it";
    ui.actDup.hidden = ui.actRemove.hidden = inPool;
    ui.actDetails.disabled = el.classList.contains("tm-item--missing");
    ui.act.classList.add("is-on");
    labelRowButtons();
  }
  function clearSel() {
    if (!sel) return;
    sel.el.classList.remove("is-selected");
    sel.el.removeAttribute("aria-pressed");
    sel = null;
    ui.editor.classList.remove("is-targeting");
    ui.act.classList.remove("is-on");
    labelRowButtons();
  }
  function placeTo(rowId) {
    const s = sel;
    if (!s || !cur.rows.some((r) => r.id === rowId)) return;
    clearSel();
    if (s.pool) {
      const from = s.el.getBoundingClientRect();
      const u = newId("i");
      commit((rows) => { rows.find((r) => r.id === rowId).items.push({ uid: u, id: s.pool }); }, { anim: true, land: { uid: u, rect: rectVisible(from) ? from : null } });
    } else {
      commit((rows) => {
        const f = locate(rows, s.uid);
        if (!f) return;
        const [it] = f.row.items.splice(f.index, 1);
        rows.find((r) => r.id === rowId).items.push(it);
      }, { anim: true });
    }
  }
  function duplicateSelected() {
    const s = sel;
    if (!s || !s.uid) return;
    clearSel();
    commit((rows) => { const f = locate(rows, s.uid); if (f) f.row.items.splice(f.index + 1, 0, { uid: newId("i"), id: f.row.items[f.index].id }); }, { anim: true });
  }
  function removeSelected() {
    const s = sel;
    if (!s || !s.uid) return;
    clearSel();
    if (commit((rows) => { const f = locate(rows, s.uid); if (f) f.row.items.splice(f.index, 1); }, { anim: true })) undoToast(`Removed ${s.el.dataset.name}`);
  }
  function details(el, type = cur.type) {
    const id = el.dataset.id;
    if (!lookup(type, id)) return;
    if (type === "card") { C.openCard(id, $(".card", el)); return; }
    // support detail lives in the Support tab; keep our scroll position so Back lands exactly here (app.js reads tierY)
    try { history.replaceState({ ...(history.state || {}), tierY: window.scrollY }, ""); } catch {}
    C.support.open(id, $(".scard", el));
  }

  /* ==========================================================
     Drag (Pointer Events, works with fingers and the mouse; no HTML5 drag API)
     ========================================================== */
  const drag = { p: null, on: false };
  let lastX = 0, lastY = 0, blockClick = false;

  function onDown(e) {
    if (drag.on || drag.p || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0) || mode !== "editor") return;
    const el = e.target.closest(".tm-item");
    if (!el || !(ui.rows.contains(el) || ui.pool.contains(el))) return;
    lastX = e.clientX; lastY = e.clientY;
    const p = drag.p = { el, pid: e.pointerId, touch: e.pointerType !== "mouse", x0: e.clientX, y0: e.clientY, timer: 0 };
    if (p.touch) {
      el.classList.add("is-pressing");
      p.timer = setTimeout(() => { if (drag.p === p) start(); }, HOLD_MS);
    }
  }
  function onMove(e) {
    if (drag.on) {
      if (e.pointerId !== drag.pid) return;
      lastX = e.clientX; lastY = e.clientY;
      moveGhost(); queue();
      return;
    }
    const p = drag.p;
    if (!p || e.pointerId !== p.pid) return;
    lastX = e.clientX; lastY = e.clientY;
    const d = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
    if (!p.touch) { if (d > 6) start(); }
    else if (d > SLOP) cancelPress();                      // the finger is scrolling, not picking up
  }
  function onUp(e) {
    if (drag.on) { if (e.pointerId === drag.pid) finishDrag(true); return; }
    if (drag.p && e.pointerId === drag.p.pid) cancelPress();  // a short tap: the click handler selects
  }
  function onCancel(e) {
    if (drag.on) { if (e.pointerId === drag.pid) finishDrag(false); }
    else if (drag.p && e.pointerId === drag.p.pid) cancelPress();
  }
  function cancelPress() {
    const p = drag.p;
    if (!p) return;
    clearTimeout(p.timer);
    p.el.classList.remove("is-pressing");
    drag.p = null;
  }

  function start() {
    const p = drag.p;
    drag.p = null;
    clearTimeout(p.timer);
    const el = p.el;
    el.classList.remove("is-pressing");
    if (!el.isConnected || mode !== "editor") return;
    clearSel();
    endLive();
    const r = el.getBoundingClientRect();
    const fromPool = ui.pool.contains(el);
    Object.assign(drag, {
      on: true, el, pid: p.pid, touch: p.touch, fromPool, id: el.dataset.id, uid: el.dataset.uid || null,
      offX: lastX - r.left, offY: lastY - r.top, over: null, overRow: null, raf: 0, scrollRaf: 0, lastMove: 0, retry: 0,
    });
    // the card you hold: a floating copy that follows the finger
    const g = document.createElement("div");
    g.className = "tm-ghost";
    g.style.width = r.width + "px";
    g.style.height = r.height + "px";
    const inner = el.cloneNode(true);
    untilt(inner);
    untilt(el);
    inner.classList.remove("is-selected", "is-pressing");
    inner.classList.add("tm-ghost__in");
    inner.removeAttribute("tabindex");
    inner.removeAttribute("role");
    inner.setAttribute("aria-hidden", "true");
    g.appendChild(inner);
    ui.layer.appendChild(g);
    drag.ghost = g;
    moveGhost();
    // the gap that shows where it will land
    const ph = document.createElement("div");
    ph.className = "tm-ph";
    ph.style.width = r.width + "px";
    ph.style.height = r.height + "px";
    drag.ph = ph;
    if (fromPool) el.classList.add("is-source");
    else {
      el.before(ph);
      el.classList.add("tm-src");
      el.closest(".tm-row").classList.add("has-ph");
    }
    ui.editor.classList.add("is-dragging", fromPool ? "drag-pool" : "drag-row");
    document.documentElement.classList.add("tm-grabbing");
    try { ui.root.setPointerCapture(drag.pid); } catch {}
    if (p.touch && navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
    blockClick = true;
    track();
    drag.scrollRaf = requestAnimationFrame(autoScroll);
  }

  // FX.tilt never sees the pointerup once the root has the pointer, so put the card flat again by hand
  function untilt(el) {
    el.querySelectorAll(".is-tilting").forEach((c) => {
      c.classList.remove("is-tilting");
      ["--rx", "--ry", "--gx", "--gy"].forEach((p) => c.style.removeProperty(p));
    });
  }

  function moveGhost() {
    if (drag.ghost) drag.ghost.style.transform = `translate(${lastX - drag.offX}px, ${lastY - drag.offY}px)`;
  }
  function queue() { if (drag.on && !drag.raf) drag.raf = requestAnimationFrame(track); }

  // what is under the finger: a row, the pool (= remove), or nothing
  function hit(x, y) {
    const under = document.elementFromPoint(x, y);
    if (under && under.closest(".tm-dock")) return { dock: true };
    const row = under && under.closest(".tm-row");
    if (row && ui.rows.contains(row)) return { row };
    if (under && under.closest(".topbar, .nav")) return null;
    const box = ui.rows.getBoundingClientRect();         // in the small gaps between rows: the nearest row
    if (x < box.left || x > box.right || y < box.top - 12 || y > box.bottom + 12) return null;
    let best = null, bd = Infinity;
    for (const el of ui.rows.children) {
      const r = el.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < bd) { bd = d; best = el; }
    }
    return best && bd < 24 ? { row: best } : null;
  }

  function track() {
    drag.raf = 0;
    if (!drag.on) return;
    const t = hit(lastX, lastY);
    if (t && t.row) placePh(t.row);
    else if (drag.ph.parentNode) movePh(null);
    setOver(t);
  }
  const visibleItems = (wrap) => [...wrap.children].filter((k) => k.classList.contains("tm-item") && !k.classList.contains("tm-src"));
  function placePh(row) {
    const wrap = row.lastElementChild;
    const kids = visibleItems(wrap);
    let i = kids.length;
    for (let k = 0; k < kids.length; k++) {
      const r = kids[k].getBoundingClientRect();
      if (lastY < r.top || (lastY <= r.bottom && lastX < r.left + r.width / 2)) { i = k; break; }
    }
    const ref = kids[i] || null;
    if (drag.ph.parentNode === wrap) {
      let n = drag.ph.nextElementSibling;
      while (n && !(n.classList.contains("tm-item") && !n.classList.contains("tm-src"))) n = n.nextElementSibling;
      if (n === ref) return;                              // already there
    }
    // small pause between moves so the gap doesn't flicker when cards re-wrap at a line end
    const wait = 70 - (performance.now() - drag.lastMove);
    if (wait > 0) { clearTimeout(drag.retry); drag.retry = setTimeout(queue, wait); return; }
    movePh({ wrap, ref });
  }
  function movePh(target) {
    const before = measure();
    const old = drag.ph.parentNode;
    if (old) { drag.ph.remove(); old.closest(".tm-row").classList.remove("has-ph"); }
    if (target) {
      target.wrap.insertBefore(drag.ph, target.ref);
      target.wrap.closest(".tm-row").classList.add("has-ph");
    }
    play(before, [], null, 180);
    drag.lastMove = performance.now();
  }
  function setOver(t) {
    const row = (t && t.row) || null;
    if (drag.overRow !== row) {
      if (drag.overRow) drag.overRow.classList.remove("is-over");
      if (row) row.classList.add("is-over");
      drag.overRow = row;
    }
    ui.dock.classList.toggle("is-over", !!(t && t.dock) && !drag.fromPool);
    drag.over = t;
  }

  // near the top (under the header) or just above the pool, the page scrolls on its own
  function autoScroll() {
    if (!drag.on) return;
    const top = ui.topbar.getBoundingClientRect().bottom;
    const dockTop = ui.dock.getBoundingClientRect().top;
    const bottom = Math.min(dockTop, innerHeight);
    const Z = 56, MAX = 14;
    let v = 0;
    if (lastY < top + Z) v = -MAX * Math.min(1, (top + Z - lastY) / Z);
    else if (lastY > bottom - Z && lastY < bottom + 6) v = MAX * Math.min(1, (lastY - (bottom - Z)) / Z);
    if (v) {
      const y0 = window.scrollY;
      window.scrollBy(0, v);
      if (window.scrollY !== y0) queue();
    }
    drag.scrollRaf = requestAnimationFrame(autoScroll);
  }

  function ghostAway(g) {
    const a = g.animate(FX.reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: g.style.transform }, { opacity: 0, transform: g.style.transform + " scale(.5)" }], { duration: FX.reduced ? 120 : 200, easing: EASE, fill: "forwards" });
    a.onfinish = a.oncancel = () => g.remove();
  }

  function finishDrag(ok) {
    if (!drag.on) return;
    cancelAnimationFrame(drag.raf); cancelAnimationFrame(drag.scrollRaf); clearTimeout(drag.retry);
    drag.raf = 0;
    if (ok) { const t = hit(lastX, lastY); if (t && t.row) { drag.lastMove = 0; placePh(t.row); } else if (drag.ph.parentNode) movePh(null); setOver(t); }
    const t = ok ? drag.over : null;
    const g = drag.ghost, gr = g.firstElementChild.getBoundingClientRect();
    const { fromPool, uid: u, id, el, ph } = drag;
    drag.on = false;
    drag.ghost = null;
    try { ui.root.releasePointerCapture(drag.pid); } catch {}
    ui.editor.classList.remove("is-dragging", "drag-pool", "drag-row");
    document.documentElement.classList.remove("tm-grabbing");
    ui.dock.classList.remove("is-over");
    if (drag.overRow) { drag.overRow.classList.remove("is-over"); drag.overRow = null; }
    el.classList.remove("is-source");
    untilt(el);
    setTimeout(() => { blockClick = false; }, 0);

    // dropped on a row: add the copy / move the card to the gap
    if (t && t.row && ph.parentNode) {
      const rowId = t.row.dataset.row;
      const idx = [...ph.parentNode.children].filter((k) => k === ph || (k.classList.contains("tm-item") && !k.classList.contains("tm-src"))).indexOf(ph);
      const target = fromPool ? newId("i") : u;
      g.remove();
      commit((rows) => {
        const row = rows.find((r) => r.id === rowId);
        if (!row) return;
        if (fromPool) row.items.splice(idx, 0, { uid: target, id });
        else {
          const f = locate(rows, u);
          if (!f) return;
          const [it] = f.row.items.splice(f.index, 1);
          row.items.splice(idx, 0, it);
        }
      }, { anim: true, land: { uid: target, rect: gr } });
      return;
    }
    // dropped on the pool: remove it from the list
    if (t && t.dock && !fromPool) {
      ghostAway(g);
      ph.remove();
      if (commit((rows) => { const f = locate(rows, u); if (f) f.row.items.splice(f.index, 1); }, { anim: true })) undoToast(`Removed ${el.dataset.name}`);
      return;
    }
    // dropped anywhere else: it goes back where it came from
    if (fromPool) {
      const to = el.getBoundingClientRect();
      if (FX.reduced || !rectVisible(to)) ghostAway(g);
      else {
        const a = g.animate([{ transform: g.style.transform }, { transform: `translate(${to.left}px, ${to.top}px)` }], { duration: 220, easing: EASE, fill: "forwards" });
        a.onfinish = a.oncancel = () => g.remove();
      }
      if (ph.parentNode) movePh(null);
      return;
    }
    const before = measure();
    ph.remove();
    el.classList.remove("tm-src");
    ui.rows.querySelectorAll(".has-ph").forEach((r) => r.classList.remove("has-ph"));
    g.remove();
    play(before, [], { uid: u, rect: gr });
  }

  /* ==========================================================
     Pool (the whole library, always; dragging out makes a copy)
     ========================================================== */
  function poolOrder(type) {
    const all = type === "card" ? state.cards.slice() : [...supById.values()];
    const score = (x) => (type === "card" ? x.scores.overall : x.scores.value);
    return all.sort((a, b) => {
      const ra = isRankedOf(type, a), rb = isRankedOf(type, b);
      if (ra !== rb) return ra ? -1 : 1;
      if (ra && score(a) !== score(b)) return score(b) - score(a);
      return a.name.localeCompare(b.name);
    });
  }
  function chipHTML(key, value, label, style = "") {
    return `<button type="button" class="chip glass fx-press" data-pf="${key}" data-v="${esc(value)}" aria-pressed="false"${style ? ` style="${style}"` : ""}>${style ? '<span class="chip__swatch"></span>' : ""}${esc(label)}</button>`;
  }
  function buildFilters() {
    let html = `<div class="tm-chips" role="group" aria-label="Filter by tier">${tierNames().map((t) => chipHTML("tier", t, t, `--sw:var(${C.TIER_COLOR[t] || "--t-d"});--sw-line:var(${C.TIER_COLOR[t] || "--t-d"})`)).join("")}${chipHTML("tier", "-", "Unranked")}</div>`;
    if (poolType === "card") {
      const roles = [...new Set(state.cards.map((c) => c.role).filter(Boolean))].sort();
      if (roles.length) html += `<div class="tm-chips" role="group" aria-label="Filter by role">${roles.map((r) => chipHTML("role", r, r)).join("")}</div>`;
      const series = [...new Set(state.cards.map((c) => c.series).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      if (series.length > 1) html += `<label class="field"><span class="sr-only">Series</span><select data-pf-select="series"><option value="">All series</option>${series.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></label>`;
    }
    ui.filters.innerHTML = html;
  }
  function buildPool() {
    const type = cur.type;
    if (poolType !== type) {
      poolType = type;
      poolEls.clear();
      pf.tier = pf.role = pf.series = "";
      const frag = document.createDocumentFragment();
      poolOrder(type).forEach((x) => {
        const el = makeItem(x.id, type, cur.rarity);
        el.setAttribute("aria-label", `${x.name}, in the pool`);
        el._q = [x.name, x.series, x.role].filter(Boolean).join(" ").toLowerCase();
        poolEls.set(x.id, el);
        frag.appendChild(el);
      });
      ui.pool.replaceChildren(frag);
      poolRarity = cur.rarity;
      buildFilters();
    } else if (type === "card" && poolRarity !== cur.rarity) {
      poolEls.forEach((el) => { const c = cardById.get(el.dataset.id), card = $(".card", el); if (c && card) C.setCardRarity(card, c, cur.rarity, { animate: false }); });
      poolRarity = cur.rarity;
    }
    ui.q.placeholder = `Search ${nounOf(type, poolEls.size)}`;
    ui.pool.setAttribute("aria-label", type === "card" ? "Card pool" : "Support card pool");
    applyPool();
  }
  function applyPool() {
    if (!poolType || !cur) return;
    const words = pf.q.toLowerCase().split(/\s+/).filter(Boolean);
    const placed = prefs.hidePlaced ? new Set(cur.rows.flatMap((r) => r.items.map((i) => i.id))) : null;
    let n = 0;
    poolEls.forEach((el, id) => {
      const x = lookup(poolType, id);
      const rk = isRankedOf(poolType, x);
      let ok = true;
      if (pf.tier) ok = pf.tier === "-" ? !rk : rk && x.tier === pf.tier;
      if (ok && pf.role) ok = x.role === pf.role;
      if (ok && pf.series) ok = x.series === pf.series;
      if (ok && words.length) ok = words.every((w) => el._q.includes(w));
      if (ok && placed) ok = !placed.has(id);
      el.hidden = !ok;
      if (ok) n++;
    });
    const anyFilter = !!(pf.tier || pf.role || pf.series);
    ui.poolEmpty.hidden = n > 0;
    if (!n) {
      ui.poolEmpty.textContent = !poolEls.size
        ? (poolType === "card" ? "No cards in the library yet. You can still set up your rows." : "No support cards in the library yet. You can still set up your rows.")
        : placed && !words.length && !anyFilter
          ? "Every card is placed. Turn off “Hide placed” to see them again."
          : "Nothing matches. Try another search or filter.";
    }
    ui.filterDot.hidden = !anyFilter;
    ui.filters.querySelectorAll(".chip[data-pf]").forEach((b) => b.setAttribute("aria-pressed", String(pf[b.dataset.pf] === b.dataset.v)));
    const s = ui.filters.querySelector("select[data-pf-select]");
    if (s) s.value = pf.series;
    if (sel && sel.pool && sel.el.hidden) clearSel();
  }
  function setPoolUI() {
    ui.dock.classList.toggle("is-closed", !prefs.poolOpen);
    ui.fold.setAttribute("aria-expanded", String(prefs.poolOpen));
    ui.fold.setAttribute("aria-label", prefs.poolOpen ? "Hide the card pool" : "Show the card pool");
    ui.hide.setAttribute("aria-pressed", String(prefs.hidePlaced));
  }

  /* ==========================================================
     Rarity (each card list has its own) + Compare with Global
     ========================================================== */
  function rarityChips() {
    return state.meta.rarities.map((r) =>
      `<button type="button" class="chip glass fx-press" data-tm-rarity="${esc(r.name)}" aria-pressed="false" style="--sw:${C.RARITY_SWATCH[r.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(r.name)}</button>`
    ).join("");   // data-tm-rarity, not data-rarity: these must not change the site-wide rarity (cards.js listens to data-rarity)
  }
  function markRarity() {
    ui.rarity.querySelectorAll("[data-tm-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tmRarity === cur.rarity)));
  }
  function setRarity(name) {
    if (!cur || cur.type !== "card" || cur.rarity === name || !state.meta.rarities.some((r) => r.name === name)) return;
    cur.rarity = name;
    touch();
    markRarity();
    const all = [...itemEls.values(), ...(poolType === "card" ? poolEls.values() : [])];
    const seen = all.map((el) => el.isConnected && !el.hidden && rectVisible(el.getBoundingClientRect()));   // read all, then write
    all.forEach((el, i) => { const c = cardById.get(el.dataset.id), card = $(".card", el); if (c && card) C.setCardRarity(card, c, name, { animate: seen[i] }); });
    if (poolType === "card") poolRarity = name;
  }
  function setCompare(on) {
    prefs.compare = on;
    savePrefs();
    ui.compare.setAttribute("aria-checked", String(on));
    decorate();
  }

  /* ==========================================================
     Dialogs (in the page, never alert / confirm)
     ========================================================== */
  let dlgOpen = false;
  function dialog({ title, html = "", actions, onMount }) {
    if (dlgOpen) return Promise.resolve(null);
    dlgOpen = true;
    return new Promise((resolve) => {
      const d = ui.dlg;
      d.innerHTML = `<div class="tm-dlg__scrim" data-dlg="cancel"></div>
        <form class="tm-dlg__sheet glass" method="dialog" novalidate>
          <h2 class="tm-dlg__title" id="tm-dlg-title">${esc(title)}</h2>
          ${html}
          <div class="tm-dlg__actions">${actions.map((a) => `<button type="${a.submit ? "submit" : "button"}" class="tm-btn fx-press ${a.cls || ""}" value="${esc(a.value)}"${a.submit ? "" : ` data-dlg="${esc(a.value)}"`}>${esc(a.label)}</button>`).join("")}</div>
        </form>`;
      const form = $("form", d);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        closeDialog().then(() => { dlgOpen = false; resolve(v); });
      };
      d.onclick = (e) => {
        const b = e.target.closest("[data-dlg]");
        if (!b) return;
        e.preventDefault();
        finish(b.dataset.dlg === "cancel" ? null : { action: b.dataset.dlg, form });
      };
      form.onsubmit = (e) => { e.preventDefault(); finish({ action: (e.submitter && e.submitter.value) || "ok", form }); };
      d.oncancel = (e) => { e.preventDefault(); finish(null); };
      d.showModal();
      if (onMount) onMount(d, finish);
    });
  }
  function closeDialog() {
    const d = ui.dlg;
    const sheet = $(".tm-dlg__sheet", d), scrim = $(".tm-dlg__scrim", d);
    const runs = [
      FX.fade(scrim, 0, { duration: 160 }),
      sheet.animate(FX.reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px) scale(.98)" }], { duration: 160, easing: EASE, fill: "forwards" }),
    ];
    return Promise.all(runs.map((a) => (a ? a.finished.catch(() => {}) : null))).then(() => { d.close(); d.innerHTML = ""; });
  }
  // a .seg inside a dialog used as a 2-way picker
  function bindPick(root, onChange) {
    root.querySelectorAll("[data-pick]").forEach((seg) => {
      seg.addEventListener("click", (e) => {
        const b = e.target.closest(".seg__btn");
        if (!b || b.disabled) return;
        const btns = [...seg.querySelectorAll(".seg__btn")];
        btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        seg.style.setProperty("--i", btns.indexOf(b));
        if (onChange) onChange(seg.dataset.pick, b.dataset.v);
      });
    });
  }
  const pickOf = (root, name) => { const b = root.querySelector(`[data-pick="${name}"] .seg__btn[aria-pressed="true"]`); return b ? b.dataset.v : null; };
  const nameInput = (value) => `<label class="tm-field"><span class="tm-field__label">Name</span><input class="tm-input" name="name" maxlength="${NAME_MAX}" value="${esc(value)}" autocomplete="off" enterkeyhint="done" spellcheck="false"></label>`;

  function suggestName(type) {
    const base = type === "card" ? "My tier list" : "My support list";
    const names = new Set(lists.map((l) => l.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }
  function copyName(name) {
    const names = new Set(lists.map((l) => l.name));
    const base = name.replace(/ \(copy(?: \d+)?\)$/, "");
    let n = `${base} (copy)`, i = 2;
    while (names.has(n)) n = `${base} (copy ${i++})`;
    return n.slice(0, NAME_MAX);
  }

  /* ==========================================================
     Lists: create / open / rename / duplicate / delete
     ========================================================== */
  function defaultRows() {
    return tierNames().map((t) => ({ id: newId("r"), label: t, color: C.TIER_COLOR[t] || "--t-d", items: [] }));
  }
  function globalRows(type) {
    const ranked = type === "card" ? rankedCards : rankedSup;
    const rows = defaultRows();
    rows.forEach((r) => { r.items = ranked.filter((x) => x.tier === r.label).map((x) => ({ uid: newId("i"), id: x.id })); });
    return rows;
  }

  async function newList() {
    let auto = suggestName("card");
    const res = await dialog({
      title: "New tier list",
      html: `${nameInput(auto)}
        <div class="tm-field"><span class="tm-field__label" id="tm-l-type">List of</span>
          <div class="seg glass tm-pick" data-pick="type" role="group" aria-labelledby="tm-l-type" style="--n:2;--i:0"><span class="seg__ind" aria-hidden="true"></span>
            <button type="button" class="seg__btn fx-press" data-v="card" aria-pressed="true">Cards</button>
            <button type="button" class="seg__btn fx-press" data-v="support" aria-pressed="false">Support</button></div></div>
        <div class="tm-field"><span class="tm-field__label" id="tm-l-start">Start with</span>
          <div class="seg glass tm-pick" data-pick="start" role="group" aria-labelledby="tm-l-start" style="--n:2;--i:0"><span class="seg__ind" aria-hidden="true"></span>
            <button type="button" class="seg__btn fx-press" data-v="blank" aria-pressed="true">Blank rows</button>
            <button type="button" class="seg__btn fx-press" data-v="global" aria-pressed="false">Global ranking</button></div>
          <p class="tm-field__note" data-note></p></div>`,
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Create", value: "ok", submit: true, cls: "tm-btn--primary" }],
      onMount(d) {
        const inp = $("input[name=name]", d), note = $("[data-note]", d);
        const update = () => {
          const type = pickOf(d, "type"), start = pickOf(d, "start");
          const n = (type === "card" ? rankedCards : rankedSup).length;
          note.textContent = start === "blank"
            ? "Rows SS to D, all empty. Fill them from the pool."
            : n ? `Copies the Global ${type === "card" ? "card" : "support"} ranking (${nounOf(type, n)}) so you can move things around.`
              : `Global has no ranked ${type === "card" ? "cards" : "support cards"} yet, so the rows will start empty.`;
        };
        bindPick(d, (k, v) => {
          if (k === "type" && inp.value.trim() === auto) { auto = suggestName(v); inp.value = auto; }
          update();
        });
        update();
        if (fine.matches) { inp.focus(); inp.select(); }
      },
    });
    if (!res || res.action !== "ok") return;
    const type = pickOf(res.form, "type") === "support" ? "support" : "card";
    const start = pickOf(res.form, "start");
    const name = res.form.elements.name.value.trim().slice(0, NAME_MAX) || suggestName(type);
    const t = now();
    const l = {
      id: newId("tl_"), name, type,
      rarity: state.meta.rarities.some((r) => r.name === state.rarity) ? state.rarity : "Normal",
      rows: start === "global" ? globalRows(type) : defaultRows(),
      created: t, updated: t,
    };
    lists.unshift(l);
    save();
    openList(l.id);
  }

  function openList(id) {
    const url = "#tier/my/" + encodeURIComponent(id);
    if (mode === "editor") history.replaceState({ tml: 1 }, "", url);   // switching lists from a toast: Back still goes to the lists
    else history.pushState({ tml: 1 }, "", url);
    C.route();
  }
  function back() {
    if (history.state && history.state.tml) history.back();
    else { history.replaceState(null, "", "#tier/my"); C.route(); }      // opened from a direct link
  }

  async function renameList() {
    const res = await dialog({
      title: "Rename list",
      html: nameInput(cur.name),
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Save", value: "ok", submit: true, cls: "tm-btn--primary" }],
      onMount(d) { const i = $("input", d); i.focus(); i.select(); },
    });
    if (!res || res.action !== "ok" || !cur) return;
    const v = res.form.elements.name.value.trim().slice(0, NAME_MAX);
    if (!v || v === cur.name) return;
    cur.name = v;
    touch();
    fillHeader();
    setTitle();
    FX.fade(ui.nameText, 1, { duration: 250 });
  }

  function duplicateList(id) {
    const l = lists.find((x) => x.id === id);
    if (!l) return;
    const copy = JSON.parse(JSON.stringify(l));
    copy.id = newId("tl_");
    copy.name = copyName(l.name);
    copy.created = copy.updated = now();
    copy.rows.forEach((r) => { r.id = newId("r"); r.items.forEach((it) => { it.uid = newId("i"); }); });
    lists.splice(lists.indexOf(l) + 1, 0, copy);
    save();
    if (mode === "index") flipIndex(() => renderIndex(false));
    toast(`Made a copy: “${copy.name}”`, { label: "Open", fn: () => openList(copy.id) });
  }

  async function deleteList(id) {
    const l = lists.find((x) => x.id === id);
    if (!l) return;
    const n = countItems(l);
    const res = await dialog({
      title: "Delete this list?",
      html: `<p class="tm-dlg__text">“${esc(l.name)}”${n ? ` and its ${nounOf(l.type, n)}` : ""} will be removed from this device. This can’t be undone.</p>`,
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete list", value: "ok", submit: true, cls: "tm-btn--danger" }],
    });
    if (!res || res.action !== "ok") return;
    const i = lists.indexOf(l);
    if (i < 0) return;
    lists.splice(i, 1);
    hist.delete(id);
    save();
    if (mode === "editor" && cur && cur.id === id) back();
    else flipIndex(() => renderIndex(false));
    FX.toast(`Deleted “${l.name}”`);
  }

  /* ==========================================================
     Share (step 9): save as image · share link · open a shared list · backup
     ========================================================== */
  // what the image needs to know about a list (js/share.js draws it)
  const boardSpec = (l) => ({ id: l.id, title: l.name, type: l.type, rarity: l.type === "card" ? l.rarity : null, rows: l.rows.map((r) => ({ label: r.label, color: r.color, items: r.items.map((it) => it.id) })) });

  // a list packed for a link: palette colours by position in COLORS (never reorder that list), ids as they are
  function toPayload(l) {
    const p = { v: 1, t: l.type, n: l.name, rows: l.rows.map((r) => [r.label, Math.max(0, COLORS.indexOf(r.color)), r.items.map((it) => it.id)]) };
    if (l.type === "card") p.r = l.rarity;
    return p;
  }
  // ...and back, checking everything (a link is typed by strangers). Returns a clean list or null.
  function fromPayload(p) {
    if (!p || p.v !== 1 || (p.t !== "card" && p.t !== "support") || typeof p.n !== "string" || !Array.isArray(p.rows) || !p.rows.length || p.rows.length > ROW_MAX) return null;
    let total = 0;
    const rows = [];
    for (const r of p.rows) {
      if (!Array.isArray(r) || typeof r[0] !== "string" || !Array.isArray(r[2])) return null;
      const items = r[2].filter((x) => typeof x === "string" && x && x.length <= 80);
      total += items.length;
      if (total > ITEM_MAX) return null;
      const color = Number.isInteger(r[1]) && r[1] >= 0 && r[1] < COLORS.length ? COLORS[r[1]] : "--t-d";
      rows.push({ id: newId("r"), label: r[0], color, items: items.map((id) => ({ uid: newId("i"), id })) });
    }
    return clean({ id: newId("tl_"), name: p.n, type: p.t, rarity: p.r, rows, created: now(), updated: now() });
  }

  async function saveImage(l, flashEl) {
    if (!C.share) return;
    await C.share.imageDialog(boardSpec(l), { flashEl });
  }
  async function shareLink(l, flashEl) {
    if (!C.share) return;
    let url;
    try { url = await C.share.makeLink("tier", toPayload(l)); } catch { FX.toast("Couldn’t make the link"); return; }
    await C.share.linkDialog({ url, title: l.name, flashEl });
  }

  async function listMenu() {
    const empty = !countItems(cur);
    const res = await dialog({
      title: cur.name,
      html: `<div class="tm-menu">
          <button type="button" class="tm-btn fx-press" data-dlg="image"${empty ? " disabled" : ""}>${ICON.image || ""}Save as image</button>
          <button type="button" class="tm-btn fx-press" data-dlg="link"${empty ? " disabled" : ""}>${ICON.link || ""}Share link</button>
          ${empty ? `<p class="tm-field__note">Add a card to share this list.</p>` : ""}
          <button type="button" class="tm-btn fx-press" data-dlg="rename">${ICON.pencil}Rename</button>
          <button type="button" class="tm-btn fx-press" data-dlg="dup">${ICON.copy}Duplicate</button>
          <button type="button" class="tm-btn tm-btn--danger fx-press" data-dlg="del">${ICON.trash}Delete list</button>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
    });
    if (!res || !cur) return;
    if (res.action === "image") saveImage(cur, ui.rows);
    else if (res.action === "link") shareLink(cur, ui.rows);
    else if (res.action === "rename") renameList();
    else if (res.action === "dup") duplicateList(cur.id);
    else if (res.action === "del") deleteList(cur.id);
  }

  /* ---------- A shared list (#tier/s/<data>): view only, "Save a copy" makes it yours ---------- */
  function showBad(browser) {
    ui.shBadTitle.textContent = browser ? "Your browser can’t open this link" : "This link can’t be opened";
    ui.shBadText.textContent = browser
      ? "It uses a feature your browser doesn’t have yet. Update the browser, or try another one."
      : "The link may be cut off or mistyped. Ask for it again, and make sure you copy all of it.";
    ui.shBad.hidden = false;
    FX.fade(ui.shBad, 1, { duration: 300 });
  }

  function paintSharedMeta() {
    const l = shared.list, card = l.type === "card";
    ui.shName.textContent = l.name;
    ui.shMeta.textContent = `${card ? "Cards" : "Support"}${card ? " · " + l.rarity : ""} · ${plural(l.rows.length, "row", "rows")} · ${nounOf(l.type, countItems(l))}`;
    const mine = shared.copyId && lists.some((x) => x.id === shared.copyId);
    ui.shCopyText.textContent = mine ? "Open my copy" : "Save a copy";
  }
  function paintSharedRows() {
    const l = shared.list;
    let missing = 0;
    const kids = l.rows.map((r) => {
      const el = document.createElement("section");
      el.className = "tm-row glass";
      el.style.setProperty("--tc", `var(${r.color})`);
      const text = r.label.trim();
      el.setAttribute("aria-label", `Row ${text || "with no label"}, ${nounOf(l.type, r.items.length)}`);
      el.innerHTML = `<div class="tm-row__label" data-len="${text.length <= 2 ? "s" : text.length <= 5 ? "m" : "l"}"><span class="tm-row__text"></span></div><div class="tm-row__items"></div>`;
      el.firstElementChild.firstElementChild.textContent = text;
      const wrap = el.lastElementChild;
      if (!r.items.length) {
        const p = document.createElement("p");
        p.className = "tm-row__empty";
        p.textContent = "Empty row";
        wrap.appendChild(p);
      }
      r.items.forEach((it) => {
        const item = makeItem(it.id, l.type, l.rarity);
        if (item.classList.contains("tm-item--missing")) missing++;
        item.setAttribute("aria-label", `${item.dataset.name}, row ${text || "with no label"}`);
        wrap.appendChild(item);
      });
      return el;
    });
    ui.shRows.replaceChildren(...kids);
    ui.shNote.hidden = !missing;
    ui.shNote.textContent = missing ? `${plural(missing, "card here isn’t", "cards here aren’t")} in the library yet, so ${missing === 1 ? "it shows" : "they show"} as a dashed slot.` : "";
  }

  async function openShared(data) {
    if (mode === "shared" && shData === data) return;       // same link again (Back from a card's details): leave it exactly as it is
    const token = ++shToken;
    endLive(); clearSel();
    if (drag.on) finishDrag(false);
    mode = "shared"; shData = data; cur = null; shared = null;
    ui.index.hidden = true; ui.editor.hidden = true; ui.shared.hidden = true; ui.shBad.hidden = true; ui.shLoad.hidden = false;
    window.scrollTo({ top: 0 });
    setTitle();
    const res = C.share ? await C.share.readLink(data) : null;
    if (token !== shToken || mode !== "shared") return;      // the person already went somewhere else
    ui.shLoad.hidden = true;
    const list = res && res.payload ? fromPayload(res.payload) : null;
    if (!list) { showBad(!!(res && res.error === "browser")); setTitle(); return; }
    shared = { data, list, copyId: shCopies.get(data) || null };
    paintSharedMeta();
    paintSharedRows();
    ui.shared.hidden = false;
    ui.shared.classList.remove("fx-page-in"); void ui.shared.offsetWidth; ui.shared.classList.add("fx-page-in");
    FX.stagger(ui.shRows, 45, { cls: "fx-up", max: 8, cleanup: true });
    setTitle();
  }

  function saveCopy() {
    if (mode !== "shared" || !shared) return;
    const had = shared.copyId && lists.find((x) => x.id === shared.copyId);
    if (had) { openList(had.id); return; }                  // already saved once: open that copy, never a second one
    const src = shared.list, t = now();
    const taken = new Set(lists.map((x) => x.name));
    const l = {
      id: newId("tl_"), name: taken.has(src.name) ? copyName(src.name) : src.name, type: src.type, rarity: src.rarity,
      rows: src.rows.map((r) => ({ id: newId("r"), label: r.label, color: r.color, items: r.items.map((it) => ({ uid: newId("i"), id: it.id })) })),
      created: t, updated: t,
    };
    lists.unshift(l);
    save();
    shared.copyId = l.id;
    shCopies.set(shared.data, l.id);
    paintSharedMeta();
    FX.flash(ui.shRows);
    FX.toast(canSave ? `Saved “${l.name}” to My Lists` : `Copied “${l.name}” for this visit only`, { action: { label: "Open", fn: () => openList(l.id) } });
  }

  /* ---------- Backup file: the lists, in and out (js/share.js asks for these) ---------- */
  // merge: add lists you don't have; the same list in both keeps the one edited last · replace: the backup is all there is
  function importLists(data, how) {
    const incoming = (Array.isArray(data) ? data : []).slice(0, LIST_MAX).map(clean).filter(Boolean);
    let changed = 0;
    if (how === "replace") {
      const seen = new Set();
      lists = incoming.filter((l) => !seen.has(l.id) && seen.add(l.id));
      changed = lists.length;
      hist.clear();
    } else {
      const added = [];
      incoming.forEach((n) => {
        const i = lists.findIndex((l) => l.id === n.id);
        if (i < 0) { if (!added.some((a) => a.id === n.id)) { added.push(n); changed++; } }
        else if (String(n.updated) > String(lists[i].updated)) { lists[i] = n; hist.delete(n.id); changed++; }
      });
      lists = [...added, ...lists].slice(0, LIST_MAX);
    }
    save();
    if (mode === "editor" && cur) {
      const again = lists.find((l) => l.id === cur.id);
      if (!again) back();
      else if (again !== cur) { cur = again; fillHeader(); renderRows(); }
    } else if (mode === "index") flipIndex(() => renderIndex(false));
    return changed;
  }

  /* Row settings: label, colour, order (applied as you go), clear / delete */
  async function rowDialog(rowId) {
    const r0 = cur.rows.find((r) => r.id === rowId);
    if (!r0) return;
    beginLive();
    const res = await dialog({
      title: "Edit row",
      html: `<label class="tm-field"><span class="tm-field__label">Label</span><input class="tm-input" name="label" maxlength="${LABEL_MAX}" value="${esc(r0.label)}" autocomplete="off" enterkeyhint="done" spellcheck="false"></label>
        <div class="tm-field"><span class="tm-field__label">Colour</span>
          <div class="tm-swatches" role="group" aria-label="Row colour">${COLORS.map((c) => `<button type="button" class="tm-sw fx-press" data-color="${c}" aria-pressed="${c === r0.color}" aria-label="${COLOR_NAMES[c]}" style="--c:var(${c})"></button>`).join("")}</div></div>
        <div class="tm-dlg__pair">
          <button type="button" class="tm-btn fx-press" data-move="-1">${ICON.up}Move up</button>
          <button type="button" class="tm-btn fx-press" data-move="1">${ICON.down}Move down</button>
        </div>
        <div class="tm-dlg__pair">
          <button type="button" class="tm-btn fx-press" data-dlg="clear">${ICON.eraser}Clear cards</button>
          <button type="button" class="tm-btn tm-btn--danger fx-press" data-dlg="delete">${ICON.trash}Delete row</button>
        </div>`,
      actions: [{ label: "Done", value: "done", submit: true, cls: "tm-btn--primary" }],
      onMount(d) {
        const form = $("form", d);                      // listeners go on the form: it is rebuilt for every dialog
        const inp = $("input[name=label]", d);
        const moves = () => {
          const i = cur.rows.findIndex((r) => r.id === rowId);
          d.querySelector('[data-move="-1"]').disabled = i <= 0;
          d.querySelector('[data-move="1"]').disabled = i >= cur.rows.length - 1;
          d.querySelector('[data-dlg="clear"]').disabled = !cur.rows[i].items.length;
          d.querySelector('[data-dlg="delete"]').disabled = cur.rows.length <= 1;
        };
        inp.addEventListener("input", () => liveEdit((rows) => { const r = rows.find((x) => x.id === rowId); if (r) r.label = inp.value.slice(0, LABEL_MAX); }));
        form.addEventListener("click", (e) => {
          const sw = e.target.closest(".tm-sw");
          if (sw) {
            d.querySelectorAll(".tm-sw").forEach((s) => s.setAttribute("aria-pressed", String(s === sw)));
            liveEdit((rows) => { const r = rows.find((x) => x.id === rowId); if (r) r.color = sw.dataset.color; });
            return;
          }
          const mv = e.target.closest("[data-move]");
          if (mv && !mv.disabled) {
            liveEdit((rows) => {
              const i = rows.findIndex((x) => x.id === rowId), j = i + Number(mv.dataset.move);
              if (i < 0 || j < 0 || j >= rows.length) return;
              [rows[i], rows[j]] = [rows[j], rows[i]];
            }, true);
            moves();
          }
        });
        moves();
      },
    });
    endLive();
    if (!res || !cur) return;
    const row = cur.rows.find((r) => r.id === rowId);
    if (!row) return;
    const name = row.label.trim() || "row";
    if (res.action === "clear") {
      if (commit((rows) => { rows.find((r) => r.id === rowId).items = []; }, { anim: true })) undoToast(`Cleared ${name}`);
    } else if (res.action === "delete" && cur.rows.length > 1) {
      if (commit((rows) => { rows.splice(rows.findIndex((r) => r.id === rowId), 1); }, { anim: true })) undoToast(`Deleted row ${name}`);
    }
  }

  /* ==========================================================
     Views: all lists (index) / one list (editor)
     ========================================================== */
  function listRow(l) {
    const li = document.createElement("li");
    li.className = "tml glass";
    li.dataset.list = l.id;
    const n = countItems(l);
    const stack = l.rows.slice(0, 6).map((r) => `<i style="--c:var(${r.color})"></i>`).join("");
    li.innerHTML = `
      <button type="button" class="tml__open fx-press" data-act="open" aria-label="Open ${esc(l.name)}, ${l.type === "support" ? "support list" : "card list"}, ${nounOf(l.type, n)}">
        <span class="tml__stack" aria-hidden="true">${stack}</span>
        <span class="tml__text">
          <span class="tml__name">${esc(l.name)}</span>
          <span class="tml__meta"><b>${l.type === "support" ? "Support" : "Cards"}</b>${l.type === "card" ? ` · ${esc(l.rarity)}` : ""} · ${plural(l.rows.length, "row", "rows")} · ${nounOf(l.type, n)}</span>
          <span class="tml__date">Edited ${esc(fmtDate(l.updated))}</span>
        </span>
      </button>
      <button type="button" class="iconbtn fx-press" data-act="dup" aria-label="Duplicate ${esc(l.name)}">${ICON.copy}</button>
      <button type="button" class="iconbtn fx-press" data-act="del" aria-label="Delete ${esc(l.name)}">${ICON.trash}</button>`;
    return li;
  }
  function renderIndex(animate) {
    ui.count.textContent = plural(lists.length, "list", "lists");
    ui.indexHead.hidden = !lists.length;
    ui.empty.hidden = !!lists.length;
    ui.lists.replaceChildren(...lists.map(listRow));
    if (!animate) return;
    if (lists.length) FX.stagger(ui.lists, 50, { cls: "fx-up", max: 8, cleanup: true });
    else FX.fade(ui.empty, 1, { duration: 300 });
  }
  function flipIndex(mutate) {
    const before = new Map([...ui.lists.children].map((li) => [li.dataset.list, { el: li, r: li.getBoundingClientRect() }]));
    const wasEmpty = !lists.length;
    mutate();
    const live = new Set();
    [...ui.lists.children].forEach((li) => {
      live.add(li.dataset.list);
      const b = before.get(li.dataset.list);
      if (!b) { popIn(li); return; }
      const r = li.getBoundingClientRect();
      slide(li, b.r.left - r.left, b.r.top - r.top);
    });
    before.forEach((b, id) => { if (!live.has(id) && rectVisible(b.r)) ghostOut(b.el, b.r); });
    if (!lists.length && !wasEmpty) FX.fade(ui.empty, 1, { duration: 300 });
  }

  function fillHeader() {
    ui.nameText.textContent = cur.name;
    ui.name.setAttribute("aria-label", `List name: ${cur.name}. Tap to rename.`);
    const card = cur.type === "card";
    ui.rarity.hidden = !card;
    ui.compare.hidden = !card;
    ui.compare.setAttribute("aria-checked", String(prefs.compare));
    if (card) markRarity();
    ui.hint.textContent = fine.matches
      ? "Drag cards into rows, or click a card then a row. Drag back to the pool to remove."
      : "Hold a card to drag it, or tap a card then a row. Drag back to the pool to remove.";
  }

  function openEditor(id) {
    const l = lists.find((x) => x.id === id);
    if (!l) return;
    if (mode === "index") indexY = window.scrollY;
    endLive();
    clearSel();
    cur = l;
    mode = "editor";
    ui.rows.replaceChildren();
    rowEls.clear();
    itemEls.clear();
    shToken++; shData = null; shared = null;
    ui.index.hidden = true;
    ui.shared.hidden = ui.shBad.hidden = ui.shLoad.hidden = true;
    ui.editor.hidden = false;
    fillHeader();
    buildPool();
    setPoolUI();
    renderRows();
    ui.editor.classList.remove("fx-page-in"); void ui.editor.offsetWidth; ui.editor.classList.add("fx-page-in");
    FX.stagger(ui.rows, 45, { cls: "fx-up", max: 8, cleanup: true });
    window.scrollTo({ top: 0 });
  }
  function showIndex() {
    const fromEditor = mode === "editor";
    endLive();
    clearSel();
    if (drag.on) finishDrag(false);
    const fromShared = mode === "shared";
    shToken++; shData = null; shared = null;
    mode = "index";
    cur = null;
    ui.editor.hidden = true;
    ui.shared.hidden = ui.shBad.hidden = ui.shLoad.hidden = true;
    ui.index.hidden = false;
    renderIndex(true);
    if (fromEditor || fromShared) {
      ui.index.classList.remove("fx-page-in"); void ui.index.offsetWidth; ui.index.classList.add("fx-page-in");
      window.scrollTo({ top: indexY });
    }
  }
  function setTitle() {
    if (state.page !== "tier" || !mode) return;
    document.title = mode === "editor" && cur ? `${cur.name} — My Tier Lists — Card Battle Infinity`
      : mode === "shared" ? `${shared ? shared.list.name + " — " : ""}Shared Tier List — Card Battle Infinity`
      : "My Tier Lists — Card Battle Infinity";
  }

  /* Called by tier.js every time My Lists is showing (id = the list in #tier/my/<id>, or null for all lists;
     sharedData = the packed list in #tier/s/<data>, or null) */
  function show(id, sharedData) {
    if (!ready) return;
    if (sharedData) { openShared(sharedData); return; }       // #tier/s/<data> (openShared sets the title itself)
    if (id && !lists.some((l) => l.id === id)) {            // unknown or deleted list in the link -> all lists
      try { history.replaceState(null, "", "#tier/my"); } catch {}
      id = null;
    }
    if (id) { if (mode !== "editor" || !cur || cur.id !== id) openEditor(id); }
    else if (mode !== "index") showIndex();
    setTitle();
  }

  /* ==========================================================
     Events
     ========================================================== */
  function act(name, btn) {
    const li = btn.closest(".tml");
    switch (name) {
      case "new": newList(); break;
      case "open": if (li) openList(li.dataset.list); break;
      case "dup": if (li) duplicateList(li.dataset.list); break;
      case "del": if (li) deleteList(li.dataset.list); break;
      case "back": back(); break;
      case "rename": renameList(); break;
      case "menu": listMenu(); break;
      case "backup": if (C.share) C.share.backupDialog(); break;
      case "sh-copy": saveCopy(); break;
      case "sh-image": if (shared) saveImage(shared.list, ui.shRows); break;
      case "undo": step(-1); break;
      case "redo": step(1); break;
      case "compare": setCompare(!prefs.compare); break;
      case "add-row": addRow(); break;
      case "pool-filter": {
        const open = ui.filters.hidden;
        ui.filters.hidden = !open;
        ui.filterBtn.setAttribute("aria-expanded", String(open));
        if (open) { ui.filters.classList.remove("fx-page-in"); void ui.filters.offsetWidth; ui.filters.classList.add("fx-page-in"); }
        if (open && !prefs.poolOpen) { prefs.poolOpen = true; savePrefs(); setPoolUI(); }
        break;
      }
      case "pool-hide": prefs.hidePlaced = !prefs.hidePlaced; savePrefs(); setPoolUI(); applyPool(); break;
      case "pool-fold": prefs.poolOpen = !prefs.poolOpen; savePrefs(); setPoolUI(); if (!prefs.poolOpen && sel && sel.pool) clearSel(); break;
      case "sel-details": if (sel) details(sel.el); break;
      case "sel-dup": duplicateSelected(); break;
      case "sel-remove": removeSelected(); break;
      case "sel-cancel": clearSel(); break;
    }
  }

  function onClick(e) {
    if (blockClick) { e.preventDefault(); e.stopPropagation(); return; }
    const rb = e.target.closest("[data-tm-rarity]");
    if (rb) { setRarity(rb.dataset.tmRarity); return; }
    const fb = e.target.closest(".chip[data-pf]");
    if (fb) { pf[fb.dataset.pf] = pf[fb.dataset.pf] === fb.dataset.v ? "" : fb.dataset.v; applyPool(); return; }
    const b = e.target.closest("[data-act]");
    if (b && ui.root.contains(b)) { act(b.dataset.act, b); return; }
    if (mode === "shared") {                                    // view only: a tap on a card = its details
      const it = e.target.closest(".tm-item");
      if (it && shared && ui.shRows.contains(it)) details(it, shared.list.type);
      return;
    }
    if (mode !== "editor") return;
    const item = e.target.closest(".tm-item");
    if (item && (ui.rows.contains(item) || ui.pool.contains(item))) { select(item); return; }
    const row = e.target.closest(".tm-row");
    if (row) {
      if (sel) placeTo(row.dataset.row);
      else if (e.target.closest(".tm-row__label")) rowDialog(row.dataset.row);
      return;
    }
    if (sel && !e.target.closest(".tm-dock")) clearSel();      // tap on empty space = cancel
  }

  function onKey(e) {
    const t = e.target;
    const inField = t.matches && t.matches("input, textarea, select");
    const item = t.closest && t.closest(".tm-item");
    if (item && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (mode === "shared") { if (shared && ui.shRows.contains(item)) details(item, shared.list.type); }
      else if (mode === "editor") select(item);
      return;
    }
    if (e.key === "Escape" && sel) { e.preventDefault(); clearSel(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel && sel.uid && !inField) { e.preventDefault(); const f = sel.el; removeSelected(); if (f.isConnected) f.focus(); }
  }
  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y while the editor is on screen
  function onGlobalKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || mode !== "editor") return;
    if (state.page !== "tier" || ui.my.hidden || ui.editor.hidden || dlgOpen || drag.on) return;
    if (document.documentElement.classList.contains("is-detail")) return;
    if (e.target.matches && e.target.matches("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); step(e.shiftKey ? 1 : -1); }
    else if (k === "y") { e.preventDefault(); step(1); }
  }

  function bind() {
    ui.root.addEventListener("click", onClick);
    ui.root.addEventListener("keydown", onKey);
    ui.root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    // once a card is lifted, the finger must drag it instead of scrolling the page
    document.addEventListener("touchmove", (e) => { if (drag.on && e.cancelable) e.preventDefault(); }, { passive: false });
    ui.root.addEventListener("contextmenu", (e) => { if (drag.on || drag.p || e.target.closest(".tm-item")) e.preventDefault(); });
    ui.root.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(".tm-item")) e.preventDefault(); });   // images: no native drag
    document.addEventListener("keydown", onGlobalKey);
    ui.q.addEventListener("input", () => { pf.q = ui.q.value; applyPool(); });
    // mouse wheel over the pool strip scrolls it sideways (touch and trackpads already can)
    ui.pool.addEventListener("wheel", (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || ui.pool.scrollWidth <= ui.pool.clientWidth) return;
      const max = ui.pool.scrollWidth - ui.pool.clientWidth, x = ui.pool.scrollLeft;
      if ((e.deltaY < 0 && x <= 0) || (e.deltaY > 0 && x >= max - 1)) return;   // at an end: let the page scroll
      e.preventDefault();
      ui.pool.scrollLeft = x + e.deltaY;
    }, { passive: false });
    ui.q.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.q.blur(); });
    ui.filters.addEventListener("change", (e) => { const s = e.target.closest("select[data-pf-select]"); if (s) { pf[s.dataset.pfSelect] = s.value; applyPool(); } });
    window.addEventListener("blur", () => { if (drag.on) finishDrag(false); else cancelPress(); });
  }

  function init() {
    Object.assign(ui, {
      root: $("#tm"), my: $("#tier-my"), warn: $("#tm-warn"), loading: $("#tm-loading"), topbar: $(".topbar"),
      index: $("#tm-index"), indexHead: $("#tm-index-head"), count: $("#tm-count"), lists: $("#tm-lists"), empty: $("#tm-empty"),
      editor: $("#tm-editor"), name: $("#tm-name"), nameText: $("#tm-name-text"), undo: $("#tm-undo"), redo: $("#tm-redo"),
      meta: $("#tm-meta"), compare: $("#tm-compare"), rarity: $("#tm-rarity"), hint: $("#tm-hint"), rows: $("#tm-rows"),
      addRow: $("#tm-addrow"), addRowText: $("#tm-addrow-text"),
      dock: $("#tm-dock"), act: $("#tm-act"), actName: $("#tm-act-name"), actHint: $("#tm-act-hint"),
      actDetails: $("#tm-act-details"), actDup: $("#tm-act-dup"), actRemove: $("#tm-act-remove"),
      q: $("#tm-q"), filterBtn: $("#tm-filter"), filterDot: $("#tm-filter-dot"), hide: $("#tm-hide"), fold: $("#tm-fold"),
      filters: $("#tm-filters"), pool: $("#tm-pool"), poolEmpty: $("#tm-pool-empty"),
      shared: $("#tm-shared"), shLoad: $("#tm-sh-load"), shBad: $("#tm-sh-bad"), shBadTitle: $("#tm-sh-bad-title"), shBadText: $("#tm-sh-bad-text"),
      shName: $("#tm-sh-name"), shMeta: $("#tm-sh-meta"), shCopyText: $("#tm-sh-copy-text"), shRows: $("#tm-sh-rows"), shNote: $("#tm-sh-note"),
    });
    if (!ui.root) return;
    cardById = new Map(state.cards.map((c) => [c.id, c]));
    const sup = (Array.isArray(state.support) ? state.support : []).filter((s) => s && s.id).map((s) => ({ ...s, name: s.name || pretty(s.id) }));
    supById = new Map(sup.map((s) => [s.id, s]));
    rankedCards = state.cards.filter(C.isRanked).sort((a, b) => b.scores.overall - a.scores.overall || a.name.localeCompare(b.name));
    rankedSup = sup.filter(isRankedSup).sort((a, b) => b.scores.value - a.scores.value || a.name.localeCompare(b.name));

    // layer for the dragged card and fading copies (outside the page so nothing clips it)
    ui.layer = document.createElement("div");
    ui.layer.className = "tm-layer";
    ui.layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(ui.layer);
    ui.dlg = document.createElement("dialog");
    ui.dlg.className = "tm-dlg";
    ui.dlg.setAttribute("aria-labelledby", "tm-dlg-title");
    document.body.appendChild(ui.dlg);

    // storage test: private browsing / blocked storage still works, it just can't keep anything
    try { localStorage.setItem("cbi:test", "1"); localStorage.removeItem("cbi:test"); } catch { canSave = false; }
    loadPrefs();
    load();
    ui.warn.hidden = canSave;
    C.dialog = dialog;                                    // js/share.js (and the Deck page later) use the same in-page dialogs
    if (C.share) C.share.provide("tierlists", {
      label: "Tier lists", kind: "array",
      get: () => JSON.parse(JSON.stringify(lists)),
      count: (v) => v.length,
      noun: (n) => plural(n, "tier list", "tier lists"),
      apply: importLists,
    });
    ui.rarity.innerHTML = rarityChips();
    bind();
    ui.loading.remove();
    ready = true;
  }

  C.tm = { init, show, mode: () => mode };
})();
