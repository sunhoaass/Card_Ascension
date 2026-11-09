/* ==========================================================
   Card Battle Infinity — Deck page
   · Step 7:  Meta Decks (data/teams.json), moved here from the Tier List
   · Step 10: the deck builder. Tabs  My Decks | Meta Decks
       #deck              = My Decks (all of the user's decks)
       #deck/meta         = Meta Decks (each has "Copy to My Decks")
       #deck/my/<id>      = the editor for one deck (each open adds a history entry, so phone Back returns to the list)
       #deck/s/<data>     = a deck someone shared (packed in the link by js/share.js), view only, with "Save a copy"
   · 1 deck = 4 card slots (Slot 1–4) + 4 support slots (the support under a card sits in the same column) since the game
     update of 2026-10-30 (was 5). The same card or support may fill several slots (owner 2026-11-02: every copy of a card
     buffs the others in full · the same support twice doesn't stack on one card).
     A deck saved or shared with 5: a 5th card / support moves into an empty slot of its row; one that doesn't fit is kept in
     deck.extra (never shown or scored, so nothing is thrown away). Mode: PvP · Tower Infinity · Overall (plan 2026-10-30 #6 · Story / Boss are hidden:
     a deck saved or shared in one of them keeps it, and shows / scores as Overall until another mode is picked).
   · Decks live in localStorage "cbi:decks" (PROGRESS.md §10.4) and save on every change. No Save button.
   · Putting cards in: tap an empty slot -> picker (search + filters). Moving: drag (mouse moves right away, touch = hold
     ~0.26s), or tap a card -> its slot sheet -> "Move to another slot", then tap the slot it should go to (swaps when that
     slot has a card). × clears a slot.
   · Owner 2026-11-02 "rarity per slot": every card slot and support slot has its own rarity (deck.cardRarity /
     deck.supRarity). Tap a card / support = slotSheet(): rarity + Details / Change / Move / Remove. A new card or support
     starts at the rarity used last (cbi:deckRarity, first time Godly). The editor has no mode buttons, deck rarity buttons,
     meta line or score ring any more (deck.mode is still saved and used by the analysis). Decks saved before: every slot =
     the deck's old rarity. Links carry cr / sr (older links: the deck's rarity).
   · Grade (4 per card slot: Basic Attack, Defense, Status Damage, HP · +2.5% a point on its own stat · all 4 at 10 = +5%
     more on every stat = +30%) + Trait per card slot
     (owner 2026-11-04): set in the slot sheet, shown on the card only when set, in the numbers (js/deckbuff.js) · links g / t.
   · Undo / Redo: 50 steps per deck (buttons + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), kept while the page is open.
   · Step 9 tools (js/share.js) are reused: Save as image (C.share.deckImageDialog), Share link (#deck/s/<data>),
     backup file (registers "decks"). Dialogs are the Tier Maker's C.dialog.
   · Step 11: team score (js/teamscore.js does the maths, this file paints it). refresh() runs after every commit() / step() /
     setMode() and paints: "Score breakdown" (5 parts), "Strengths & weaknesses" (Strong vs / Weak vs / Fits modes),
     "Fill the gaps" (3 best cards / support for the empty slots, tap = add) and the score pill on each row of My Decks
     (the editor's score ring went 2026-11-02 · the shared view and Compare still have one). "Compare" = a dialog with two decks side by side (stacked on a phone).
   · ATK / HP on the cards of the editor, the shared view and the image include the deck's buffs (js/deckbuff.js) · the buff
     pill under a card (.dk-buff) opens where its buffs come from.
   Needs js/fx.js, js/app.js, js/teamscore.js, js/share.js, js/cards.js loaded first (C.dialog is made by later
   scripts and only used when something is tapped).
   ========================================================== */
(function () {
  const C = window.CBI;
  const { state, $, esc } = C;

  const KEY = "cbi:decks";
  const NOTE_MAX = 200, NOTE_LINES = 6;            // the deck's note for its image (owner 2026-11-02: farming time …)
  const SLOTS = 4, OLD_SLOTS = 5, NAME_MAX = 40, DECK_MAX = 200, HISTORY_MAX = 50, CHUNK = 40;
  const HOLD_MS = 260;                             // touch: hold this long before a card lifts
  const SLOP = 10;                                 // touch: moving further than this before the lift = scrolling
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  const KINDS = ["cards", "support"];
  // Modes. data/meta.json -> modes: [{ id, name, short, enabled, hidden }] (step 11 · plan 2026-10-30 #6); these are the fallback
  const MODES = [
    { id: "pvp", name: "PvP", short: "PvP", enabled: true },
    { id: "tower", name: "Tower Infinity", short: "Tower", enabled: true },
    { id: "overall", name: "Overall", short: "Overall", enabled: true },
    { id: "story", name: "Story", short: "Story", enabled: false, hidden: true },
    { id: "boss", name: "Boss", short: "Boss", enabled: false, hidden: true },
  ];
  const DEFAULT_MODE = "overall";                  // new decks, copies of a Meta Deck without a mode, decks in a hidden mode
  const MODE_LEADS = {
    pvp: "Against other players' teams. Picked from simulated fights against strong player decks.",
    tower: "Floor after floor of stronger enemies, with no healing in between. Built to last.",
    overall: "Good in both PvP and Tower Infinity. The safe pick if you play everything.",
  };
  const KIND_LABEL = { best: "Best", second: "Runner-up", easy: "Easy to get" };
  const KIND_TITLE = {
    best: "The strongest team found for this mode",
    second: "The best team that shares at most 2 cards with the Best team",
    easy: "Only cards and support that are easier to pull",
  };
  const LEADS = {
    my: "Four cards, a support under each. Saved on this device.",
    meta: "Meta decks: four-card teams for PvP, Tower Infinity and both, with the support under each card. Picked from simulated battles. Pick a rarity to see the stats. Tap a card for the full breakdown, or copy a deck to My Decks to make it yours.",
    shared: "A deck someone shared with you. It's view only: tap Save a copy to keep your own.",
  };

  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    copy: svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
    pencil: svg('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    max: svg('<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>'),   // All 10 (grades)
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    swap: svg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
    move: svg('<path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    filter: svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>'),
    ...((C.share && C.share.icons) || {}),         // image, link, download, upload, archive, check
  };

  const ui = {};
  const TS = () => null;                           // team score off (owner 2026-11-04: no score in the Deck · js/teamscore.js stays, was C.teamScore)
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  let cardById = new Map(), supById = new Map();
  let libs = { cards: [], support: [] };      // the whole library per kind, best first (picker order)
  let decks = [];                              // every saved deck, in the order shown
  let canSave = true;
  let built = false, metaBuilt = false;
  let view = null;                             // "my" | "meta" (null until the first show)
  let mode = null;                             // inside My Decks: "index" | "editor" | "shared"
  let cur = null;                              // the deck open in the editor
  let shared = null, shData = null, shToken = 0;   // a deck from a #deck/s/<data> link: { data, deck, copyId }
  const shCopies = new Map();                  // link data -> id of the copy saved from it (Save a copy never makes a second one)
  let sel = null;                              // { kind, i }: the card picked up by a tap
  let indexY = 0;
  let metaTeams = [];
  const hist = new Map();                      // deck id -> { undo: [], redo: [] } (JSON snapshots of cards / support / mode)
  const metaTiles = new Map();                 // card id -> elements in the Meta Decks list (rarity changes)
  const ed = { root: null, slots: { cards: [], support: [] }, shown: { cards: [], support: [] } };   // editor board
  const sh = { root: null, slots: { cards: [], support: [] }, shown: { cards: [], support: [] } };   // shared board

  /* ---------- Small helpers ---------- */
  const now = () => new Date().toISOString();
  let seq = 0;
  const newId = (p) => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  const str = (v) => (typeof v === "string" ? v : "");
  const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const pretty = (id) => String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const rectVisible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const isRankedSup = (s) => !!(s && s.scores && s.scores.value > 0 && s.tier);
  const isRankedOf = (kind, x) => !!x && (kind === "cards" ? C.isRanked(x) : isRankedSup(x));
  // a library best first: ranked by score, then the rest by name (the picker's order · also js/battle.js)
  const orderList = (kind, list) => {
    const score = (x) => Number(kind === "cards" ? x.scores && x.scores.overall : x.scores && x.scores.value) || 0;
    return list.slice().sort((a, b) => {
      const ra = isRankedOf(kind, a), rb = isRankedOf(kind, b);
      if (ra !== rb) return ra ? -1 : 1;
      if (ra && score(a) !== score(b)) return score(b) - score(a);
      return String(a.name).localeCompare(String(b.name));
    });
  };
  const lookup = (kind, id) => (kind === "cards" ? cardById : supById).get(id);
  const countOf = (arr) => arr.filter(Boolean).length;
  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const same = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-US", same ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  };
  const allModes = () => MODES.map((d) => {
    const m = state.meta && Array.isArray(state.meta.modes) ? state.meta.modes.find((x) => x && x.id === d.id) : null;
    return m ? { ...d, name: str(m.name) || d.name, short: str(m.short) || d.short, enabled: typeof m.enabled === "boolean" ? m.enabled : d.enabled,
      hidden: typeof m.hidden === "boolean" ? m.hidden : !!d.hidden } : d;
  });
  const modes = () => allModes().filter((m) => !m.hidden);   // the ones on the buttons
  // a deck's mode as shown and scored: hidden (Story / Boss) or unknown = Overall
  const modeOf = (id) => { const all = modes(); return all.find((m) => m.id === id && m.enabled) || all.find((m) => m.id === DEFAULT_MODE) || all[0]; };
  // the image of a deck · rarity = the deck's own per slot
  const deckSpec = (d) => {
    const res = C.deckBuff ? C.deckBuff.compute(d) : [];
    return {
      id: d.id, title: d.name, note: d.note || "", mode: modeOf(d.mode).name, rarity: d.rarity, cards: d.cards.slice(), support: d.support.slice(),
      cardRarity: d.cards.map((x, i) => rarityAt(d, "cards", i)), supRarity: d.support.map((x, i) => rarityAt(d, "support", i)),
      nums: d.cards.map((id, i) => { const r = res[i]; return r ? { atk: r.atk, hp: r.hp } : null; }),
      // under each card, like the Deck page (owner 2026-11-04): grade (the badge number) · trait · support: mutation %
      grade: d.cards.map((id, i) => (id ? overallOf(d.grades && d.grades[i]) : 0)),
      traits: d.cards.map((id, i) => { const t = id && d.trait && d.trait[i] ? traitById(d.trait[i]) : null;
        return t ? { id: t.id, name: t.name, color: t.color || "", icon: `images/traits/${t.id}.webp` } : null; }),
      mut: d.support.map((id, i) => { const s = id ? supById.get(id) : null; return s && C.mutAt ? C.mutAt(s, rarityAt(d, "support", i)) : 0; }),
    };
  };
  /* ---------- Rarity per slot (owner 2026-11-02) ----------
     deck.cardRarity / deck.supRarity = [rarity name × 4] · deck.grades = [[atk, def, status, hp] | null × 4] (0–10 each, like the
     game: Basic Attack, Defense, Status Damage, HP · owner 2026-11-04 rule 2: +2.5% a point on its own stat, all 4 at 10 = +5%
     more on every stat (+30% · game 2026-11-05) · Basic Attack -> ATK, HP -> HP · js/deckbuff.js gradePct) */
  const LAST_KEY = "cbi:deckRarity", FIRST_RARITY = "Godly", GRADE_MAX = 10;
  const RKEY = { cards: "cardRarity", support: "supRarity" };
  const isRarity = (r) => typeof r === "string" && state.meta.rarities.some((x) => x.name === r);
  // the rarity a new card / support starts at: the one picked last in a slot sheet (first time = Godly)
  function lastRarity() {
    let r = null;
    try { r = localStorage.getItem(LAST_KEY); } catch {}
    return isRarity(r) ? r : isRarity(FIRST_RARITY) ? FIRST_RARITY : state.meta.rarities[state.meta.rarities.length - 1].name;
  }
  function rememberRarity(r) { try { localStorage.setItem(LAST_KEY, r); } catch {} }
  const rarityAt = (d, kind, i) => C.deckBuff.rarityOf(d, kind, i);
  const raritiesOf = (a, fallback) => { const o = []; for (let i = 0; i < SLOTS; i++) o.push(Array.isArray(a) && isRarity(a[i]) ? a[i] : fallback); return o; };
  // one slot's old grades (kept as they were): 4 whole numbers 0–10 · nothing set = null
  function gradeOf(a) {
    if (!Array.isArray(a) || a.length < 4) return null;
    const g = a.slice(0, 4).map((n) => Math.max(0, Math.min(GRADE_MAX, Math.round(Number(n) || 0))));
    return g.some((n) => n > 0) ? g : null;
  }
  const gradesOf = (a) => { const o = []; for (let i = 0; i < SLOTS; i++) o.push(gradeOf(Array.isArray(a) ? a[i] : null)); return o; };
  /* Trait + Grade per card slot (owner 2026-11-04 · set in the slot sheet, shown on the card only when set):
     deck.trait = [trait id | null × 4] (data/traits.json) · deck.grades (above: 4 grades per slot) · move with the card,
     cleared when the card leaves or a new card goes in · ATK / HP: js/deckbuff.js */
  const traitList = () => (Array.isArray(state.traits) ? state.traits : []);
  const traitById = (id) => traitList().find((t) => t.id === id) || null;
  const traitsOf = (a) => { const o = []; for (let i = 0; i < SLOTS; i++) { const v = Array.isArray(a) ? a[i] : null; o.push(typeof v === "string" && /^[a-z0-9-]{1,40}$/.test(v) ? v : null); } return o; };
  const gradeNumsOf = (a) => { const o = []; for (let i = 0; i < SLOTS; i++) { const n = Math.round(Number(Array.isArray(a) ? a[i] : 0) || 0); o.push(Math.max(0, Math.min(GRADE_MAX, n))); } return o; };
  const resetTG = (d, i) => { if (!Array.isArray(d.trait)) d.trait = traitsOf(null); if (!Array.isArray(d.grades)) d.grades = gradesOf(null); d.trait[i] = null; d.grades[i] = null; };
  // the card's grade on its badge = the 4 grades' average, .5 up (the old rule · 10 only when all 4 are 10) · 0 = none
  const overallOf = (g) => (Array.isArray(g) && g.some((n) => n > 0) ? Math.floor(g.reduce((a, n) => a + n, 0) / 4 + 0.5) : 0);
  const fullOf = (g) => Array.isArray(g) && g.length >= 4 && g.slice(0, 4).every((n) => n >= GRADE_MAX);
  const GSTATS = ["Basic Attack", "Defense", "Status Damage", "HP"];
  // the Card Grader's line (owner 2026-11-04 rule 2 · js/deckbuff.js gradePct)
  const GSUM = "Each point gives +2.5% to its own stat. A 10 MINT (all four at 10) adds +5% more to every stat.";
  const GSUM_FULL = "10 MINT: +25% + 5% = +30% to every stat.";
  // a grade's colour in the Card Grader rows (the game: 1–2 grey · 5 green · 7 purple · guessed in between) · 10 = rainbow
  const gradeTone = (v) => (v >= 10 ? "mint" : v >= 9 ? "gold" : v >= 6 ? "purple" : v >= 3 ? "green" : v >= 1 ? "grey" : "none");
  // a card / support put in a slot: the last rarity (a deck's old grades for that slot are cleared)
  function place(d, kind, i, id) {
    d[kind][i] = id;
    d[RKEY[kind]][i] = lastRarity();
    if (kind === "cards") { if (Array.isArray(d.grades)) d.grades[i] = null; resetTG(d, i); }
  }
  // move / swap two slots of a row: the rarity (and a deck's old grades) go with the card
  function swapSlots(d, kind, a, b) {
    const sw = (arr) => { if (Array.isArray(arr)) [arr[a], arr[b]] = [arr[b], arr[a]]; };
    sw(d[kind]); sw(d[RKEY[kind]]);
    if (kind === "cards") { sw(d.grades); sw(d.trait); }
  }
  // "Godly" when every filled slot has the same rarity, else "Mixed rarity" (deck list, shared deck)
  function rarityLabel(d) {
    const set = new Set();
    KINDS.forEach((k) => d[k].forEach((id, i) => { if (id) set.add(rarityAt(d, k, i)); }));
    return set.size > 1 ? "Mixed rarity" : set.size ? [...set][0] : rarityAt(d, "cards", 0);
  }
  const anyCards = (d) => countOf(d.cards) + countOf(d.support) > 0;
  // the user's own deck as the team score sees it (traits were added here until 2026-11-03)
  const mine = (d) => d;
  // ...and for "Fill the gaps": an empty slot is at the rarity a new pick would get
  const mineToFill = (d) => {
    const lr = lastRarity();
    return { ...mine(d), cardRarity: d.cardRarity.map((r, i) => (d.cards[i] ? r : lr)), supRarity: d.supRarity.map((r, i) => (d.support[i] ? r : lr)) };
  };

  /* ==========================================================
     Saving (localStorage, never crashes when blocked)
     ========================================================== */
  const idOf = (v) => (typeof v === "string" && v && v.length <= 80 ? v : null);
  function slotsOf(arr) {
    const out = [];
    for (let i = 0; i < SLOTS; i++) out.push(idOf(Array.isArray(arr) ? arr[i] : null));
    return out;
  }
  // 5-slot decks (before 2026-10-30): what sat past slot 4 goes into an empty slot of the same row, else into extra
  function fitOld(d) {
    const cards = slotsOf(d.cards), support = slotsOf(d.support);
    const ex = d.extra && typeof d.extra === "object" ? d.extra : {};
    const extra = { cards: (Array.isArray(ex.cards) ? ex.cards : []).map(idOf).filter(Boolean), support: (Array.isArray(ex.support) ? ex.support : []).map(idOf).filter(Boolean) };
    for (let i = SLOTS; i < OLD_SLOTS; i++) {
      const c = idOf(Array.isArray(d.cards) ? d.cards[i] : null), s = idOf(Array.isArray(d.support) ? d.support[i] : null);
      const at = c ? cards.indexOf(null) : -1;
      if (c && at >= 0) {                                     // the card and its support stay together when its column is free
        cards[at] = c;
        if (s && !support[at]) { support[at] = s; continue; }
      } else if (c) extra.cards.push(c);
      if (s) { const j = support.indexOf(null); if (j >= 0) support[j] = s; else extra.support.push(s); }
    }
    return { cards, support, extra: extra.cards.length || extra.support.length ? extra : null };
  }
  // Anything odd in storage (old format, hand edits, a backup or a link made by someone else) is repaired, not thrown away
  // the deck's note: plain text, at most NOTE_MAX characters and NOTE_LINES lines (owner 2026-11-02 · shown on the image)
  const noteOf = (v) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").split("\n").slice(0, NOTE_LINES).map((l) => l.trimEnd()).join("\n").trim().slice(0, NOTE_MAX) : "");
  // rarity per slot: unknown / missing = the deck's rarity (decks from before 2026-11-02 keep what they showed) ·
  // grades: kept only when the deck has them (left from the removed Grade system)
  function clean(d) {
    if (!d || typeof d !== "object") return null;
    const rarity = isRarity(d.rarity) ? d.rarity : "Normal";
    const f = fitOld(d);
    const out = {
      id: str(d.id).slice(0, 60) || newId("dk_"),
      name: str(d.name).trim().slice(0, NAME_MAX) || "Untitled deck",
      mode: MODES.some((m) => m.id === d.mode) ? d.mode : DEFAULT_MODE,
      rarity,
      cards: f.cards, support: f.support,
      cardRarity: raritiesOf(d.cardRarity, rarity), supRarity: raritiesOf(d.supRarity, rarity),
    };
    out.grades = gradesOf(d.grades);
    // the first round (2026-11-04) kept one grade per slot (deck.grade / link gr): that number on all 4
    const one = gradeNumsOf(d.grade);
    out.grades.forEach((g, i) => { if (!g && one[i] > 0) out.grades[i] = [one[i], one[i], one[i], one[i]]; });
    out.trait = traitsOf(d.trait);
    const note = noteOf(d.note);
    if (note) out.note = note;
    if (f.extra) out.extra = f.extra;
    out.created = str(d.created) || now();
    out.updated = str(d.updated) || now();
    return out;
  }
  function load() {
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { raw = []; }
    const seen = new Set();
    decks = (Array.isArray(raw) ? raw : []).slice(0, DECK_MAX).map(clean).filter((d) => d && !seen.has(d.id) && seen.add(d.id));
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(decks)); canSave = true; } catch { canSave = false; }
    if (ui.warn) ui.warn.hidden = canSave;
  }
  function touch() { if (cur) cur.updated = now(); save(); }
  const histOf = (id) => { if (!hist.has(id)) hist.set(id, { undo: [], redo: [] }); return hist.get(id); };
  const snap = () => JSON.stringify({ c: cur.cards, s: cur.support, m: cur.mode, cr: cur.cardRarity, sr: cur.supRarity, g: cur.grades || null, t: cur.trait });

  /* ==========================================================
     Motion helpers (transform / opacity only, §4)
     ========================================================== */
  function anim(el, frames, opts) {
    if (!el.animate) return null;
    if (el._dkAnim) el._dkAnim.cancel();
    const a = el.animate(frames, { easing: EASE, ...opts });
    el._dkAnim = a;
    a.onfinish = () => { if (el._dkAnim === a) el._dkAnim = null; };
    return a;
  }
  const stop = (el) => { if (el._dkAnim) { el._dkAnim.cancel(); el._dkAnim = null; } };
  // dx, dy are screen px (from rects): FX.zoom() turns them into page px
  const slide = (el, dx, dy, duration = 260) => (FX.reduced ? null : anim(el, [{ transform: `translate(${dx / FX.zoom()}px, ${dy / FX.zoom()}px)` }, { transform: "none" }], { duration }));
  function popIn(el) {
    if (FX.reduced) return anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    return anim(el, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 260 });
  }
  // a copy of a removed element shrinks and fades where it was (the real one is already gone)
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
  // a dropped card flies from where the finger let go into its slot, then settles with a small bounce
  function landAt(el, from) {
    if (!from) { popIn(el); return; }
    if (FX.reduced) return;
    const to = el.getBoundingClientRect();
    if (!to.width) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    anim(el, [
      { transform: `translate(${dx / FX.zoom()}px, ${dy / FX.zoom()}px) scale(${from.width / to.width})` },
      { transform: "scale(.95)", offset: 0.72 },
      { transform: "none" },
    ], { duration: 280 });
  }
  const animateIn = (el) => { el.classList.remove("fx-page-in"); void el.offsetWidth; el.classList.add("fx-page-in"); };

  /* ==========================================================
     Dialogs: the Tier Maker's in-page dialogs (C.dialog), never alert / confirm
     ========================================================== */
  const dialog = (o) => (C.dialog ? C.dialog(o) : Promise.resolve(null));
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
  const dialogOpen = () => !!document.querySelector("dialog.tm-dlg[open]");

  function suggestName() {
    const names = new Set(decks.map((d) => d.name));
    if (!names.has("My deck")) return "My deck";
    let i = 2;
    while (names.has(`My deck ${i}`)) i++;
    return `My deck ${i}`;
  }
  function copyName(name) {
    const names = new Set(decks.map((d) => d.name));
    const base = name.replace(/ \(copy(?: \d+)?\)$/, "");
    let n = `${base} (copy)`, i = 2;
    while (names.has(n)) n = `${base} (copy ${i++})`;
    return n.slice(0, NAME_MAX);
  }

  /* ==========================================================
     The board: 5 card slots over 5 support slots (used by the editor and the shared view)
     ========================================================== */
  function buildBoard(b, root, editable) {
    b.root = root;
    b.editable = editable;
    root.innerHTML = KINDS.map((kind) => `
      <section class="dk-group" aria-label="${kind === "cards" ? "Cards" : "Support cards"}">
        <div class="dk-group__head"><h3 class="dk-group__title">${kind === "cards" ? "Cards" : "Support"}</h3><span class="dk-group__count" data-count="${kind}"></span></div>
        <div class="dk-row" data-kind="${kind}"></div>
      </section>`).join("");
    KINDS.forEach((kind) => {
      const row = $(`.dk-row[data-kind="${kind}"]`, root);
      b.slots[kind] = [];
      b.shown[kind] = new Array(SLOTS).fill(null);
      for (let i = 0; i < SLOTS; i++) {
        const slot = document.createElement("div");
        slot.className = "dk-slot is-empty";
        slot.dataset.kind = kind;
        slot.dataset.i = i;
        // like the saved image (owner 2026-11-04): the full name on top (2 lines, then smaller type · fitName) · under the card a pill
        // per line: rarity · grade · trait (support: rarity · mutation %) · "No grade" / "No trait" keep every slot the same height
        const pills = kind === "cards" ? ["rar", "gr", "tr"] : ["rar", "mut"];
        slot.innerHTML = `<div class="dk-nm"><span></span></div><div class="dk-slot__box"></div>`
          + `<div class="dk-info" hidden>${pills.map((p) => `<span class="dk-pill dk-pill--${p}" data-pill="${p}"></span>`).join("")}</div>`;
        const box = $(".dk-slot__box", slot);
        slot._pos = $(".dk-nm span", slot);               // "Slot 1" (cards) until a card is in, then the card's name (owner 2026-11-04)
        slot._info = $(".dk-info", slot);
        if (editable) {
          const add = document.createElement("button");
          add.type = "button";
          add.className = "dk-add fx-press";
          add.setAttribute("aria-label", `Add ${kind === "cards" ? "a card" : "a support card"} to slot ${i + 1}`);
          add.innerHTML = `${ICON.plus}<span>Add</span>`;
          slot._empty = add;
          const x = document.createElement("button");
          x.type = "button";
          x.className = "dk-x fx-press";
          x.dataset.act = "clear";
          x.hidden = true;
          x.innerHTML = `<span class="dk-x__dot">${ICON.x}</span>`;
          slot._x = x;
          slot.appendChild(x);
          box.appendChild(add);
        } else {
          const e = document.createElement("div");
          e.className = "dk-none";
          e.textContent = "Empty";
          slot._empty = e;
          box.appendChild(e);
        }
        if (kind === "cards") {                            // the deck's buffs on this card (js/deckbuff.js): tap = where they come from
          const f = document.createElement("button");
          f.type = "button";
          f.className = "dk-buff fx-press";
          f.dataset.act = "buff";
          f.hidden = true;
          slot._buff = f;
          slot.appendChild(f);
        }
        row.appendChild(slot);
        b.slots[kind].push(slot);
      }
      if (nameFit) nameFit.observe(row);
    });
  }

  // one card (or support card) in a slot. Same look as the Tier Maker's pool items.
  function makeItem(kind, id, rarity) {
    const el = document.createElement("div");
    el.className = "dk-item";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.dataset.id = id;
    el._r = rarity;                                     // the slot's rarity it shows (paintKind recolours it when that changes)
    const x = lookup(kind, id);
    if (!x) {                                           // not in the library (yet): keep it, show a dashed slot
      el.classList.add("dk-item--missing");
      el.dataset.name = pretty(id);
      el.innerHTML = `<span class="tm-missing"><span>${esc(pretty(id))}</span><small>Not in the library</small></span>`;
      return el;
    }
    el.dataset.name = x.name;
    // support too (2026-10-28, owner): the game card, as big as the cards, its values at its slot's rarity
    const art = C.renderCard(x, rarity, { mini: true });
    art.tabIndex = -1;
    art.removeAttribute("role");
    art.setAttribute("aria-hidden", "true");
    el.appendChild(art);
    return el;
  }

  // Put the deck on a board. Elements are reused when the same card is still on the board (so cards keep their aura and
  // focus) and FLIP-animated when they moved; new ones pop in; removed ones shrink away.
  function paintKind(b, kind, d, { animate = false, land = null } = {}) {
    const old = b.shown[kind];
    const rects = animate ? old.map((o) => (o && o.el.isConnected ? o.el.getBoundingClientRect() : null)) : [];
    const used = new Set(), recolor = [];
    const next = d[kind].map((id, i) => {
      if (!id) return null;
      const r = rarityAt(d, kind, i);
      let j = old[i] && old[i].id === id && !used.has(i) ? i : old.findIndex((o, k) => o && o.id === id && !used.has(k));
      if (j >= 0) { used.add(j); if (old[j].el._r !== r) recolor.push([old[j].el, id, r]); return { ...old[j], from: j }; }
      return { id, el: makeItem(kind, id, r), from: -1 };
    });
    const gone = old.map((o, k) => (o && !used.has(k) ? [o, k] : null)).filter(Boolean);
    if (animate) old.forEach((o) => { if (o) stop(o.el); });
    next.forEach((n, i) => {
      const slot = b.slots[kind][i];
      const box = $(".dk-slot__box", slot);
      const want = n ? n.el : slot._empty;
      if (box.firstElementChild !== want || box.childElementCount !== 1) box.replaceChildren(want);
      slot.classList.toggle("is-empty", !n);
      if (n) {
        n.el.dataset.i = i;
        n.el.classList.remove("is-pressing", "is-source", "is-selected");
        n.el.setAttribute("aria-label", `${n.el.dataset.name}, ${kind === "cards" ? "slot" : "support"} ${i + 1}`);
      }
      if (slot._x) {
        slot._x.hidden = !n;
        if (n) slot._x.setAttribute("aria-label", `Remove ${n.el.dataset.name} from ${kind === "cards" ? "slot" : "support slot"} ${i + 1}`);
      }
      paintInfo(slot, kind, d, i, n && !n.el.classList.contains("dk-item--missing") ? n.id : null, animate);
      if (slot._pos) {
        const nm = n ? n.el.dataset.name : kind === "cards" ? `Slot ${i + 1}` : "";
        slot._pos.parentNode.classList.toggle("is-name", !!n);
        if (slot._pos.textContent !== nm) { slot._pos.textContent = nm; fitName(slot._pos); }
      }
      if (kind === "cards" && n) paintTG($(".card", n.el), d.trait && d.trait[i], overallOf(d.grades && d.grades[i]), animate);
      if (slot._empty && b.editable) slot._empty.setAttribute("aria-label", `Add ${kind === "cards" ? "a card" : "a support card"} to slot ${i + 1}`);
    });
    b.shown[kind] = next.map((n) => (n ? { id: n.id, el: n.el } : null));
    if (animate) {
      gone.forEach(([o, k]) => { const r = rects[k]; if (r && rectVisible(r)) ghostOut(o.el, r); });
      next.forEach((n, i) => {
        if (!n) return;
        if (land && land.kind === kind && land.i === i && land.id === n.id) { landAt(n.el, land.rect); return; }
        if (n.from < 0) { popIn(n.el); return; }
        const a = rects[n.from], r = n.el.getBoundingClientRect();
        if (a && (Math.abs(a.left - r.left) > 0.5 || Math.abs(a.top - r.top) > 0.5) && (rectVisible(a) || rectVisible(r))) slide(n.el, a.left - r.left, a.top - r.top);
      });
    }
    // a slot's rarity changed (slot sheet, undo): flash + numbers count, like the rarity buttons elsewhere (§4)
    if (recolor.length) {
      const seen = recolor.map(([el]) => animate && el.isConnected && rectVisible(el.getBoundingClientRect()));   // read all, then write
      recolor.forEach(([el, id, r], n) => {
        el._r = r;
        const x = lookup(kind, id), card = $(".card", el);
        if (!x || !card) return;
        const nums = kind === "cards" ? [$('[data-k="atk"]', card), $('[data-k="hp"]', card)].filter(Boolean) : [], was = nums.map((e) => e.dataset.value);
        C.setCardRarity(card, x, r, { animate: seen[n] });
        nums.forEach((e, q) => { e.dataset.value = was[q]; });   // the deck's buffs (paintBuffs) count on from what was shown
      });
    }
    const cnt = $(`[data-count="${kind}"]`, b.root);
    if (cnt) cnt.textContent = `${countOf(d[kind])} / ${SLOTS}`;
  }
  const paintBoard = (b, d, opts) => KINDS.forEach((k) => paintKind(b, k, d, opts));

  // under the card, like the saved image (owner 2026-11-04): rarity pill (the game card's own) · GRADE n (bronze / silver / gold / rainbow)
  // · trait (icon + name in its colour) · support: rarity · Mutation +x% (C.mutAt) · a changed pill flashes (§4)
  // the pills of one slot: [{ p, key, html, attrs, label }] · used by the editor (paintInfo) and the deck list (deckRow)
  function pillSpecs(kind, d, i, id, item) {   // item = the card / support (js/battle.js passes its own: pending supports)
    const x = item || lookup(kind, id), r = rarityAt(d, kind, i), lr = String(r).toLowerCase();
    const out = [{ p: "rar", key: r, html: `<span>${esc(r)}</span>`, label: `Rarity: ${r}`,
      attrs: { "data-r": r, style: r === "Normal" ? null : `--rar-bg:var(--gc-rar-${lr});--rar-line:var(--gc-rar-${lr}-line);--rar-ink:var(--gc-rar-${lr}-ink,#fff)` } }];
    if (kind === "cards") {
      const g = overallOf(d.grades && d.grades[i]), t = d.trait && d.trait[i] ? traitById(d.trait[i]) : null;
      out.push({ p: "gr", key: String(g), html: g ? `<span>Grade</span><b>${g}</b>` : `<span>No grade</span>`, label: g ? `Grade ${g}` : "No grade",
        attrs: { "data-band": gradeBand(g), "data-off": g ? null : "" } });
      out.push({ p: "tr", key: t ? t.id : "", html: t ? `${traitIcon(t, "dk-pill__ic")}<span>${esc(t.name)}</span>` : `<span>No trait</span>`, label: t ? `Trait: ${t.name}` : "No trait",
        attrs: { "data-c": t ? (t.color === "rainbow" ? "rainbow" : "solid") : null, "data-off": t ? null : "", style: t ? traitColor(t) || null : null } });
    } else {
      const m = x && C.mutAt ? C.mutAt(x, r) : 0;
      // the % never gets cut (owner 2026-11-04: "Mutation +1…" hid it) · owner 2026-11-05: the full "Mutation bonus +x%", smaller type
      // to fit (css .dk-pill--mut) · the deck list's small pills keep MUT
      out.push({ p: "mut", key: String(m), html: m ? `<span><i class="dk-pill__long">Mutation bonus</i><i class="dk-pill__short">Mut</i></span><b>+${m}%</b>` : `<span>No mutation</span>`, label: m ? `Mutation bonus +${m}% damage and HP` : "No mutation",
        attrs: { "data-off": m ? null : "" } });
    }
    return out;
  }
  const pillAttrs = (attrs) => Object.entries(attrs).filter(([, v]) => v != null).map(([a, v]) => ` ${a}="${esc(v)}"`).join("");
  const pillsHTML = (kind, d, i, id, item) => pillSpecs(kind, d, i, id, item).map((q) => `<span class="dk-pill dk-pill--${q.p}"${pillAttrs(q.attrs)}>${q.html}</span>`).join("");
  function paintInfo(slot, kind, d, i, id, animate) {
    const box = slot._info;
    if (!box) return;
    box.hidden = !id;
    if (!id) return;
    pillSpecs(kind, d, i, id).forEach((q) => {
      const el = $(`[data-pill="${q.p}"]`, box);
      if (!el || el.dataset.key === q.key) return;
      const was = el.dataset.key;
      el.dataset.key = q.key;
      Object.entries(q.attrs).forEach(([a, v]) => { if (v == null) el.removeAttribute(a); else el.setAttribute(a, v); });
      el.innerHTML = q.html;
      el.setAttribute("aria-label", q.label);
      if (animate && was && !FX.reduced) FX.flash(el);
    });
  }
  // a slot's name: 2 lines at the slot's size, then smaller type (to 8px) until it fits · refit when the slots change width
  function fitName(el) {
    const box = el.parentNode;
    el.style.fontSize = "";
    box.classList.remove("is-clamp");
    if (!el.textContent || !box.clientHeight) return;
    let f = parseFloat(getComputedStyle(el).fontSize) || 11;
    while (el.offsetHeight > box.clientHeight + 0.5 && f > 8) { f -= 0.5; el.style.fontSize = f + "px"; }
    if (el.offsetHeight > box.clientHeight + 0.5) box.classList.add("is-clamp");
  }
  const nameFit = typeof ResizeObserver === "function" ? new ResizeObserver((es) => es.forEach((e) => e.target.querySelectorAll(".dk-nm span").forEach(fitName))) : null;
  /* ---------- Trait + Grade on the card (owner 2026-11-04 · like the game card: trait icon + name on the left,
     grade number in a ring + "GRADE" on the right, above the skill name) · only when set · css/deck.css .tg ---------- */
  const gradeBand = (g) => (g >= 10 ? "rainbow" : g >= 7 ? "gold" : g >= 4 ? "silver" : g >= 1 ? "bronze" : "none");
  const traitColor = (t) => (t && t.color && t.color !== "rainbow" ? `--tc:${esc(t.color)}` : "");
  const traitIcon = (t, cls) => `<img class="${cls}" src="images/traits/${esc(t.id)}.webp" alt="" width="96" height="96" decoding="async" draggable="false">`;
  function tgHTML(t, g) {
    return `${t ? `<span class="tg__tr" data-c="${t.color === "rainbow" ? "rainbow" : "solid"}" style="${traitColor(t)}">${traitIcon(t, "tg__ic")}<span class="tg__lab">${esc(t.name)}</span></span>` : ""}`
      + `${g > 0 ? `<span class="tg__gr" data-band="${gradeBand(g)}"><span class="tg__ring"><b data-n="${g}">${g}</b></span><span class="tg__lab">Grade</span></span>` : ""}`;
  }
  function paintTG(card, traitId, grade, animate) {
    if (!card) return;
    const t = traitId ? traitById(traitId) : null, g = grade > 0 ? grade : 0;
    const key = `${t ? t.id : ""}|${g}`;
    if (card._tg === key) return;
    const was = card._tg || "|0";
    card._tg = key;
    let el = $(".tg", card);
    if (!t && !g) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("span"); el.className = "tg"; el.setAttribute("aria-hidden", "true"); card.appendChild(el); }
    el.innerHTML = tgHTML(t, g);
    if (!animate || FX.reduced) return;
    const [wt, wg] = was.split("|");
    const pop = (x) => x && x.animate([{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: .6 }, { transform: "none" }], { duration: 380, easing: EASE });
    if ((t ? t.id : "") !== wt) pop($(".tg__tr", el));
    if (String(g) !== wg) pop($(".tg__gr", el));
  }

  /* ---------- Deck buffs on the cards (owner 2026-11-02 · js/deckbuff.js) ----------
     ATK / HP = base × (1 + deck buffs %) × trait × grade · the pill = all of it (r.atkPct / r.hpPct) · in the game's colours (owner 2026-11-02: no green-gold) · count 650 ms when on screen ·
     the pill under the card (+45% ATK …) opens the list of where they come from */
  const pct = (n) => "+" + Number(n.toFixed(1)) + "%";
  function buffText(r) {
    if (r.atkPct && r.hpPct) return r.atkPct === r.hpPct ? `${pct(r.atkPct)} ATK·HP` : `${pct(r.atkPct)} · ${pct(r.hpPct)}`;
    return r.atkPct ? `${pct(r.atkPct)} ATK` : `${pct(r.hpPct)} HP`;
  }
  function paintBuffs(b, d, { animate = false } = {}) {
    if (!C.deckBuff || !b.root) return;
    const res = C.deckBuff.compute(d);
    b.buffs = res;
    const cards = b.slots.cards.map((slot, i) => { const o = b.shown.cards[i]; return o && res[i] && o.id === res[i].id ? $(".card", o.el) : null; });
    const seen = cards.map((el) => !!(animate && el && el.isConnected && rectVisible(el.getBoundingClientRect())));   // read all, then write
    b.slots.cards.forEach((slot, i) => {
      const r = res[i], card = cards[i];
      if (card) {
        const a = $('[data-k="atk"]', card), h = $('[data-k="hp"]', card);
        if (Number(a.dataset.value) !== r.atk || Number(h.dataset.value) !== r.hp) C.setCardNums(card, { atk: r.atk, hp: r.hp }, { animate: seen[i] });
      }
      const f = slot._buff;
      if (!f) return;
      const on = !!(card && (r.atkPct || r.hpPct));
      f.hidden = !on;
      if (!on) { f.dataset.text = ""; return; }
      const text = buffText(r);
      if (f.dataset.text !== text) {
        f.dataset.text = text;
        const line = (lab, v) => (v ? `<span class="dk-buff__l"><i>${lab}</i> ${esc(pct(v))}</span>` : "");
        f.innerHTML = `<svg class="dk-buff__ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 9h-4.5v7h-5v-7H5z" fill="currentColor"/></svg>${line("ATK", r.atkPct)}${line("HP", r.hpPct)}`;
      }
      f.setAttribute("aria-label", `${lookup("cards", r.id).name}: deck buffs ${buffText(r)}. Tap to see where they come from`);
    });
  }
  function buffDialog(btn) {
    const slot = btn.closest(".dk-slot");
    const b = slot && sh.root && sh.root.contains(slot) ? sh : ed;
    const r = slot && b.buffs ? b.buffs[Number(slot.dataset.i)] : null;
    const card = r && lookup("cards", r.id);
    if (!card) return;
    clearSel();
    const kindName = { card: "Card", support: "Support", trait: "Trait", grade: "Grade" };
    // trait = ×N · grade = +x% (Basic Attack -> ATK, HP -> HP · js/deckbuff.js gradePct) · the rest = +x%
    const val = (x) => (x.kind === "trait"
      ? (x.mA === x.mH ? `×${x.mA} ATK·HP` : [x.mA !== 1 ? `×${x.mA} ATK` : "", x.mH !== 1 ? `×${x.mH} HP` : ""].filter(Boolean).join(" · "))
      : x.kind === "grade" && x.atk === x.hp ? `${pct(x.atk)} ATK·HP`
      : [x.atk ? `${pct(x.atk)} ATK` : "", x.hp ? `${pct(x.hp)} HP` : ""].filter(Boolean).join(" · "));
    const rows = r.from.map((x) => `<li class="dk-bf__row" data-kind="${x.kind}">
        <span class="dk-bf__src">${esc(x.name)}${x.n > 1 ? ` <b>×${x.n}</b>` : ""}</span>
        <span class="dk-bf__kind">${kindName[x.kind]}</span>
        <span class="dk-bf__val">${esc(val(x))}</span></li>`).join("");
    const stat = (label, base, v, p) => `<div class="dk-bf__stat"><span class="dk-bf__lab">${label}</span>
        <span class="dk-bf__nums"><span>${label === "HP" ? C.fmtHp(base) : C.fmtStat(base)}</span><span aria-hidden="true">→</span><b${v !== base ? ' class="is-up"' : ""}>${label === "HP" ? C.fmtHp(v) : C.fmtStat(v)}</b></span>
        <small>${v !== base ? "×" + Number((v / base).toFixed(2)) + " in total" : "No buff"}</small></div>`;
    dialog({
      title: `${card.name} · Buffs`,
      html: `<div class="dk-bf">
          <div class="dk-bf__sum">${stat("ATK", r.base.atk, r.atk, r.atkPct)}${stat("HP", r.base.hp, r.hp, r.hpPct)}</div>
          <ul class="dk-bf__list">${rows}</ul>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(dlg) { FX.stagger($(".dk-bf__list", dlg), 40, { cls: "fx-up", max: 8, cleanup: true }); },
    });
  }

  /* ==========================================================
     Team score ring (step 11). paintScore(el, { score, band, label }, { animate, note })
     band: "bad" 1–49 · "mid" 50–79 · "good" 80–99 · "perfect" 100 · "none" (no cards yet). Colours: css/deck.css [data-band].
     Motion (§4): the number counts to the new value · the arc cross-fades to the new length and colour (two arcs, opacity
     only) · 100 = rainbow ring that turns while on screen (.is-live) + one burst of sparks.
     ========================================================== */
  const EMPTY_NOTE = "Add cards and support to see how strong this team is.";
  function scoreHTML() {
    const arc = (k) => `<circle class="dk-score__val" data-arc="${k}" cx="40" cy="40" r="34" pathLength="100" stroke-dasharray="0 100"${k ? ' style="opacity:0"' : ""}/>`;
    return `<div class="dk-score" data-band="none">
      <span class="dk-score__ring"><span class="dk-score__halo" aria-hidden="true"></span><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="dk-score__track" cx="40" cy="40" r="34"/>${arc(0)}${arc(1)}</svg><span class="dk-score__num" data-score-num>—</span></span>
      <span class="dk-score__text"><b>Team score</b><span class="dk-score__label" data-score-label></span><small data-score-note>${EMPTY_NOTE}</small></span>
    </div>`;
  }
  function paintScore(el, s, { animate = false, note } = {}) {
    if (!el) return;
    const has = !!s && Number.isFinite(s.score);
    const band = has ? s.band || "none" : "none";
    const was = el.dataset.band || "none";
    el.dataset.band = band;
    const num = $("[data-score-num]", el);
    if (has && animate && num.textContent !== "—") FX.countTo(num, s.score, { duration: 450 });
    else { num.textContent = has ? String(s.score) : "—"; num.dataset.value = has ? s.score : 0; }
    // arc: paint the hidden one with the new value, then cross-fade
    const key = has ? `${s.score}|${band}` : "none";
    if (el._arcKey !== key) {
      el._arcKey = key;
      const arcs = el.querySelectorAll(".dk-score__val"), a = el._arc || 0, b = 1 - a;
      arcs[b].setAttribute("stroke-dasharray", has ? `${Math.max(0, Math.min(100, s.score))} 100` : "0 100");
      arcs[b].dataset.band = band;
      arcs[b].style.opacity = "1";
      arcs[a].style.opacity = "0";
      el._arc = b;
      if (animate && arcs[b].animate) {
        arcs[b].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: EASE });
        arcs[a].animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: EASE });
      }
    }
    const ring = $(".dk-score__ring", el);
    if (animate && band !== was && !FX.reduced) anim(ring, [{ transform: "scale(1)" }, { transform: "scale(1.08)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 300 });
    if (animate && band === "perfect" && was !== "perfect") sparkle(ring);
    $("[data-score-label]", el).textContent = has ? s.label || "" : "";
    $("[data-score-note]", el).textContent = note != null ? note : has ? "" : EMPTY_NOTE;
    (el.closest("[role=img]") || el).setAttribute("aria-label", has ? `Team score ${s.score} out of 100${s.label ? ", " + s.label : ""}` : "Team score: add cards to see it");
  }
  // one burst of sparks when the team reaches 100 (transform / opacity only, removed when done)
  function sparkle(ring) {
    if (FX.reduced || !ring.animate) return;
    for (let k = 0; k < 10; k++) {
      const s = document.createElement("i");
      s.className = "dk-spark";
      ring.appendChild(s);
      const ang = (k / 10) * Math.PI * 2, d = 34 + (k % 3) * 6;
      const a = s.animate([
        { transform: "translate(-50%, -50%) scale(.4)", opacity: 0 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * d * 0.6}px), calc(-50% + ${Math.sin(ang) * d * 0.6}px)) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d}px)) scale(.3)`, opacity: 0 },
      ], { duration: 760, delay: (k % 2) * 60, easing: EASE, fill: "both" });
      a.onfinish = a.oncancel = () => s.remove();
    }
  }

  /* ==========================================================
     Team analysis (step 11): breakdown · strengths & weaknesses · fits modes · fill the gaps
     The same panel is used by the editor (editable) and the shared view (read only); the compare dialog reuses the parts.
     ========================================================== */
  const fmtPts = (n) => { const r = Math.floor(n * 10 + 1e-6) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const LIMIT = 4;
  function partsHTML(cls = "") {
    return `<ul class="dk-parts ${cls}">${TS().PARTS.map((p) => `
      <li class="dk-part" data-part="${p.key}">
        <span class="dk-part__name">${esc(p.name)}<span class="dk-part__flag" data-flag hidden></span></span>
        <span class="dk-part__pts" data-pts></span>
        <span class="dk-part__track" aria-hidden="true"><i></i></span>
        <span class="dk-part__note" data-note></span>
      </li>`).join("")}</ul>`;
  }
  function paintParts(ul, r, other) {
    r.parts.forEach((p, k) => {
      const li = $(`[data-part="${p.key}"]`, ul);
      if (!li) return;
      $("[data-pts]", li).innerHTML = `${fmtPts(p.pts)}<small> / ${fmtPts(p.max)}</small>`;
      $(".dk-part__track i", li).style.setProperty("--v", Math.max(0, Math.min(1, p.v)).toFixed(4));
      const flag = $("[data-flag]", li);
      flag.hidden = !(p.noData || p.partial);
      flag.textContent = p.noData ? "Not enough data yet" : p.partial ? "Partly estimated" : "";
      $("[data-note]", li).textContent = p.note;
      li.classList.toggle("is-full", p.v >= 1 - 1e-9);
      if (other) {                                       // compare: mark the deck that is ahead in this part
        const o = other.parts[k];
        li.classList.toggle("is-ahead", p.pts > o.pts + 0.05);
        li.classList.toggle("is-behind", p.pts + 0.05 < o.pts);
      }
      li.setAttribute("aria-label", `${p.name}: ${fmtPts(p.pts)} of ${fmtPts(p.max)}. ${p.note}${p.noData ? ". Not enough data yet" : ""}`);
    });
  }
  function chip(text, { id, tier, count, interactive } = {}) {
    const t = tier ? `<b class="dk-chip__tier" style="--tc:var(${C.TIER_COLOR[tier] || "--t-d"})">${esc(tier)}</b>` : "";
    const n = count ? `<small>×${count}</small>` : "";
    if (id && interactive) return `<button type="button" class="dk-chip dk-chip--card fx-press" data-open-card="${esc(id)}" data-id="${esc(id)}" aria-label="${esc(text)}${tier ? ", tier " + esc(tier) : ""}. Open details">${esc(text)}${t}</button>`;
    return `<span class="dk-chip${id ? " dk-chip--card" : ""}">${esc(text)}${t}${n}</span>`;
  }
  const more = (n) => (n > 0 ? `<span class="dk-chip dk-chip--more">+${n} more</span>` : "");
  function swHTML(a, r, interactive) {
    const none = (t) => `<p class="dk-sw__none">${esc(t)}</p>`;
    const sc = a.strong.cards, st = a.strong.tags, tm = a.strong.teams;
    let strong = "";
    if (!a.members) strong = none("Add cards to see what this team beats.");
    else if (!a.data.beats) strong = none("Not enough data yet");
    else if (!sc.length && !st.length && !tm.length) strong = none("Nothing stands out yet. Pick cards that beat the same targets.");
    else strong = st.slice(0, LIMIT).map((t) => chip(t.name, { count: t.count })).join("")
      + sc.slice(0, LIMIT).map((c) => chip(c.name, { id: c.id, tier: c.tier, interactive })).join("") + more(sc.length - LIMIT)
      + tm.slice(0, 3).map((t) => `<span class="dk-chip dk-chip--team">Deck: ${esc(t.name)}</span>`).join("");
    const wt = a.weak.tags, wc = a.weak.cards;
    let weak = "";
    if (!a.members) weak = none("Add cards to see what this team struggles with.");
    else if (!a.data.beats && !a.data.weakTo) weak = none("Not enough data yet");
    else if (!wt.length && !wc.length) weak = none("No clear weakness found.");
    else weak = wt.map((t) => chip(t.name, { count: t.count })).join("")
      + wc.slice(0, LIMIT).map((c) => chip(c.name, { id: c.id, tier: c.tier, interactive })).join("") + more(wc.length - LIMIT);
    return { strong, weak, note: wc.length ? `${wc.length} Meta ${wc.length === 1 ? "card has" : "cards have"} no answer in this team.` : "" };
  }
  function fitsHTML(a, deck, editable) {
    if (!a.modes.length) return "";
    return a.modes.map((m, k) => {
      const on = m.id === deck.mode;
      const inner = `<span class="dk-fit__rank">${k + 1}</span><span class="dk-fit__name">${esc(m.name)}</span>${on ? '<span class="dk-fit__now">Current</span>' : ""}<span class="dk-pill" data-band="${m.band}">${m.score == null ? "—" : m.score}</span>`;
      return `<li class="dk-fit${on ? " is-on" : ""}">${editable && !on
        ? `<button type="button" class="dk-fit__btn fx-press" data-dk-mode="${esc(m.id)}" aria-label="${esc(m.name)}: ${m.score == null ? "no score" : m.score}. Switch this deck to ${esc(m.name)}">${inner}</button>`
        : `<span class="dk-fit__btn" aria-label="${esc(m.name)}: ${m.score == null ? "no score" : m.score}${on ? ", current mode" : ""}">${inner}</span>`}</li>`;
    }).join("");
  }
  function anaHTML(editable) {
    return `<div class="dk-ana">
      <section class="panel glass dk-box" data-box="parts" aria-label="Score breakdown">
        <div class="dk-box__head"><h3 class="dk-box__title">Score breakdown</h3><span class="dk-box__sub" data-ana-mode></span></div>
        ${partsHTML()}
        <ul class="dk-notes" data-notes hidden></ul>
      </section>
      <section class="panel glass dk-box" data-box="sw" aria-label="Strengths and weaknesses">
        <div class="dk-box__head"><h3 class="dk-box__title">Strengths &amp; weaknesses</h3></div>
        <div class="dk-sw"><h4 class="dk-sw__h dk-sw__h--good">Strong vs</h4><div class="dk-chips" data-strong></div></div>
        <div class="dk-sw"><h4 class="dk-sw__h dk-sw__h--bad">Weak vs</h4><div class="dk-chips" data-weak></div><p class="dk-sw__note" data-weak-note hidden></p></div>
        <div class="dk-sw"><h4 class="dk-sw__h">Fits modes</h4><ol class="dk-fits" data-fits></ol></div>
      </section>
      ${editable ? `<section class="panel glass dk-box dk-box--wide" data-box="sug" aria-label="Fill the gaps">
        <div class="dk-box__head"><h3 class="dk-box__title">Fill the gaps</h3></div>
        <p class="dk-box__lead" data-sug-lead></p>
        ${KINDS.map((k) => `<div class="dk-sug" data-sug-kind="${k}" hidden><h4 class="dk-sw__h">${k === "cards" ? "Cards" : "Support"}</h4><div class="dk-sug__row" data-sug-row></div></div>`).join("")}
      </section>
      <div class="dk-box--wide dk-ana__foot"><button type="button" class="tm-btn fx-press" data-act="compare">${ICON.swap}Compare with another deck</button></div>` : ""}
    </div>`;
  }
  // swap html only when it changed, with a short fade (opacity only) so updates are noticed but never jump
  function setHTML(el, html, animate) {
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
    if (animate && el.animate) el.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 220, easing: EASE });
  }
  function paintAnalysis(root, deck, r, { animate = false, editable = false } = {}) {
    if (!root || !TS()) return;
    const a = TS().analyze(deck);
    $("[data-ana-mode]", root).textContent = `${modeOf(deck.mode).name} weights`;
    paintParts($(".dk-parts", root), r);
    const notes = $("[data-notes]", root);
    notes.hidden = !r.notes.length;
    setHTML(notes, r.notes.map((n) => `<li>${esc(n)}</li>`).join(""), animate);
    const sw = swHTML(a, r, true);
    setHTML($("[data-strong]", root), sw.strong, animate);
    setHTML($("[data-weak]", root), sw.weak, animate);
    const wn = $("[data-weak-note]", root);
    wn.hidden = !sw.note;
    wn.textContent = sw.note;
    setHTML($("[data-fits]", root), fitsHTML(a, deck, editable), animate);
  }

  /* Fill the gaps: the 3 cards and 3 support that raise the score the most, tried in every empty slot (js/teamscore.js).
     Worked out just after the board is painted, so a tap never waits for it. Tiles are reused by id. */
  let sugTimer = 0;
  const sugCache = new Map();                    // "cards:<id>" -> tile
  function scheduleSuggest() {
    clearTimeout(sugTimer);
    sugTimer = setTimeout(paintSuggest, 90);
  }
  function sugTile(kind, s) {
    const k = `${kind}:${s.id}`;
    let el = sugCache.get(k);
    const x = lookup(kind, s.id);
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.className = "dk-sug__item fx-press";
      el.dataset.sugKind = kind;
      el.dataset.id = s.id;
      const lr = lastRarity();                     // the rarity it would get in the slot
      const art = C.renderCard(x, lr, { mini: true });
      art.tabIndex = -1;
      art.removeAttribute("role");
      art.setAttribute("aria-hidden", "true");
      el._rarity = lr;
      el.appendChild(art);
      el.insertAdjacentHTML("beforeend", `<span class="dk-sug__gain"></span><span class="dk-sug__slot"></span>`);
      if (sugCache.size > 60) sugCache.clear();
      sugCache.set(k, el);
    }
    const lr = lastRarity();
    if (el._rarity !== lr) { const card = $(".card", el); if (card) C.setCardRarity(card, x, lr, { animate: false }); el._rarity = lr; }
    const d = (s.after || 0) - (s.before || 0);
    const gain = d >= 1 ? `+${d}` : "+<1";
    el.dataset.slot = s.slot;
    $(".dk-sug__gain", el).textContent = gain;
    $(".dk-sug__slot", el).textContent = `${kind === "cards" ? "Slot" : "Support"} ${s.slot + 1}`;
    el.setAttribute("aria-label", `Add ${x.name} to ${kind === "cards" ? "slot" : "support slot"} ${s.slot + 1}. Team score ${gain}`);
    return el;
  }
  function paintSuggest() {
    sugTimer = 0;
    if (mode !== "editor" || !cur || !ui.ana || !TS()) return;
    const box = $('[data-box="sug"]', ui.ana);
    let any = false, anyEmpty = false;
    KINDS.forEach((kind) => {
      const wrap = $(`[data-sug-kind="${kind}"]`, box), row = $("[data-sug-row]", wrap);
      const empty = cur[kind].some((x) => !x);
      if (empty) anyEmpty = true;
      const picks = empty && libs[kind].length ? TS().suggest(mineToFill(cur), kind, 3) : [];
      wrap.hidden = !picks.length;
      if (picks.length) any = true;
      const before = new Set(row.children);
      const els = picks.map((s) => sugTile(kind, s));
      if (els.length !== row.children.length || els.some((el, i) => row.children[i] !== el)) row.replaceChildren(...els);
      els.forEach((el) => { if (!before.has(el) && !FX.reduced) anim(el, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 220 }); });
    });
    $("[data-sug-lead]", box).textContent = !anyEmpty ? "Every slot is filled. Remove a card to see what would fit best."
      : !libs.cards.length && !libs.support.length ? "No cards in the library yet."
      : any ? "The picks that raise the team score the most. Tap one to add it." : "Nothing in the library would raise the score right now.";
  }
  function addSuggested(kind, id, slot) {
    if (!cur || mode !== "editor" || !lookup(kind, id)) return;
    let i = Number(slot);
    if (!(i >= 0 && i < SLOTS) || cur[kind][i]) i = cur[kind].indexOf(null);
    if (i < 0) return;
    const name = lookup(kind, id).name;
    if (commit((d) => { place(d, kind, i, id); })) undoToast(`Added ${name} to ${kind === "cards" ? "slot" : "support"} ${i + 1}`);
  }

  // buffs + analysis of the deck in the editor; called after every change (the score ring left the editor 2026-11-02:
  // the breakdown below still adds up to the score)
  function refresh({ animate = true } = {}) {
    if (!cur) return;
    paintBuffs(ed, cur, { animate });                // the deck's buffs on the cards (js/deckbuff.js)
    if (!TS()) return;
    const d = mine(cur), r = TS().score(d);
    paintAnalysis(ui.ana, d, r, { animate, editable: true });
    scheduleSuggest();
  }

  /* ==========================================================
     Compare two decks (a dialog: two columns side by side on a computer, stacked on a phone)
     ========================================================== */
  function cmpDeckHTML(tag) {
    return `<article class="dk-cmp__deck" data-cmp-deck="${tag}">
      <header class="dk-cmp__head"><span class="dk-cmp__tag">${tag.toUpperCase()}</span><span class="dk-cmp__name" data-cmp-name></span><span class="dk-cmp__meta" data-cmp-meta></span></header>
      <div class="dk-scorebox" role="img">${scoreHTML()}</div>
      ${partsHTML("dk-parts--cmp")}
      <div class="dk-sw"><h4 class="dk-sw__h dk-sw__h--good">Strong vs</h4><div class="dk-chips" data-strong></div></div>
      <div class="dk-sw"><h4 class="dk-sw__h dk-sw__h--bad">Weak vs</h4><div class="dk-chips" data-weak></div></div>
      <div class="dk-sw"><h4 class="dk-sw__h">Fits modes</h4><ol class="dk-fits" data-fits></ol></div>
    </article>`;
  }
  async function compareDialog(firstId) {
    if (decks.length < 2) { FX.toast("Make a second deck to compare"); return; }
    let a = decks.some((d) => d.id === firstId) ? firstId : decks[0].id;
    let b = (decks.find((d) => d.id !== a) || decks[0]).id;
    const options = (pick) => decks.map((d) => `<option value="${esc(d.id)}"${d.id === pick ? " selected" : ""}>${esc(d.name)}</option>`).join("");
    await dialog({
      title: "Compare decks",
      html: `<div class="dk-cmp">
          <div class="dk-cmp__pick">
            <label class="field"><span class="tm-field__label">Deck A</span><select data-cmp="a">${options(a)}</select></label>
            <label class="field"><span class="tm-field__label">Deck B</span><select data-cmp="b">${options(b)}</select></label>
          </div>
          <p class="dk-cmp__verdict" data-verdict aria-live="polite"></p>
          <div class="dk-cmp__cols">${cmpDeckHTML("a")}${cmpDeckHTML("b")}</div>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(d) {
        $(".tm-dlg__sheet", d).classList.add("dk-cmp-sheet");
        const cols = $(".dk-cmp__cols", d);
        const paint = (animate) => {
          const da = decks.find((x) => x.id === a), db = decks.find((x) => x.id === b);
          if (!da || !db) return;
          const ra = TS().score(mine(da)), rb = TS().score(mine(db));
          [[da, ra, rb, "a"], [db, rb, ra, "b"]].forEach(([dk, r, o, tag]) => {
            const art = $(`[data-cmp-deck="${tag}"]`, d);
            $("[data-cmp-name]", art).textContent = dk.name;
            $("[data-cmp-meta]", art).textContent = `${modeOf(dk.mode).name} · ${countOf(dk.cards)}/${SLOTS} cards · ${countOf(dk.support)}/${SLOTS} support`;
            paintScore($(".dk-score", art), r, { animate, note: r.empty ? null : "" });
            paintParts($(".dk-parts", art), r, o);
            const an = TS().analyze(mine(dk));
            const sw = swHTML(an, r, false);
            setHTML($("[data-strong]", art), sw.strong, false);
            setHTML($("[data-weak]", art), sw.weak, false);
            setHTML($("[data-fits]", art), fitsHTML(an, dk, false), false);
          });
          const sa = ra.score || 0, sb = rb.score || 0;
          $("[data-verdict]", d).textContent = a === b ? "Same deck on both sides. Pick another one to compare."
            : sa === sb ? `Even: both score ${sa || "—"}.` : `${sa > sb ? decks.find((x) => x.id === a).name : decks.find((x) => x.id === b).name} is ahead by ${Math.abs(sa - sb)}.`;
          if (animate) animateIn(cols);
        };
        d.addEventListener("change", (e) => {
          const s = e.target.closest("select[data-cmp]");
          if (!s) return;
          if (s.dataset.cmp === "a") a = s.value; else b = s.value;
          paint(true);
        });
        paint(false);
      },
    });
  }

  /* ==========================================================
     Editor header, counts, mode, rarity
     ========================================================== */
  function chrome() {
    if (!cur) return;
    const h = histOf(cur.id);
    ui.undo.disabled = !h.undo.length;
    ui.redo.disabled = !h.redo.length;
    ui.nameText.textContent = cur.name;
    ui.name.setAttribute("aria-label", `Deck name: ${cur.name}. Tap to rename.`);
    paintNote(ui.note, cur.note, true);
    if (ui.hint) ui.hint.textContent = fine.matches ? "Click a card: rarity, grade, trait. Drag to move." : "Tap a card: rarity, grade, trait. Hold to move.";
  }
  function setMode(id) {
    if (!cur || mode !== "editor" || modeOf(cur.mode).id === id || !modes().some((m) => m.id === id && m.enabled)) return;
    commit((d) => { d.mode = id; }, { animate: false });
  }

  /* ==========================================================
     Edits: every change goes through commit() so it can be undone and is saved straight away
     ========================================================== */
  function commit(fn, { animate = true, land = null } = {}) {
    clearSel();
    const before = snap();
    fn(cur);
    cur.cards = slotsOf(cur.cards, true);
    cur.support = slotsOf(cur.support, false);
    cur.cardRarity = raritiesOf(cur.cardRarity, cur.rarity);
    cur.supRarity = raritiesOf(cur.supRarity, cur.rarity);
    cur.grades = gradesOf(cur.grades);
    cur.trait = traitsOf(cur.trait);
    cur.cards.forEach((id, i) => { if (!id) { cur.trait[i] = null; cur.grades[i] = null; } });
    const changed = snap() !== before;
    if (changed) {
      const h = histOf(cur.id);
      h.undo.push(before);
      if (h.undo.length > HISTORY_MAX) h.undo.shift();
      h.redo.length = 0;
      touch();
    }
    paintBoard(ed, cur, { animate, land });
    chrome();
    refresh();
    return changed;
  }
  function step(dir) {
    if (!cur || mode !== "editor") return;
    const h = histOf(cur.id);
    const from = dir < 0 ? h.undo : h.redo, to = dir < 0 ? h.redo : h.undo;
    if (!from.length) return;
    to.push(snap());
    const s = JSON.parse(from.pop());
    cur.cards = slotsOf(s.c, true); cur.support = slotsOf(s.s, false);
    cur.cardRarity = raritiesOf(s.cr, cur.rarity); cur.supRarity = raritiesOf(s.sr, cur.rarity); cur.grades = gradesOf(s.g);
    cur.trait = traitsOf(s.t);
    if (MODES.some((m) => m.id === s.m)) cur.mode = s.m;
    clearSel();
    touch();
    paintBoard(ed, cur, { animate: true });
    chrome();
    refresh();
  }
  // toast with Undo that only undoes this exact change (not something done after it)
  function undoToast(text) {
    const id = cur.id, n = histOf(id).undo.length;
    FX.toast(text, { action: { label: "Undo", fn: () => { if (cur && cur.id === id && mode === "editor" && histOf(id).undo.length === n) step(-1); } }, duration: 4500 });
  }

  /* ==========================================================
     Moving by tap: "Move to another slot" in the slot sheet picks the card up (select), then a tap on a slot of the same
     row puts it there (swaps with the card there) · the dock at the bottom says so and has Cancel
     ========================================================== */
  function select(kind, i) {
    const o = ed.shown[kind][i];
    if (!o) return;
    if (sel && sel.kind === kind && sel.i === i) { clearSel(); return; }
    clearSel();
    sel = { kind, i };
    o.el.classList.add("is-selected");
    o.el.setAttribute("aria-pressed", "true");
    ui.editor.classList.add("is-targeting");
    ui.editor.dataset.target = kind;
    ui.actName.textContent = o.el.dataset.name;
    ui.actHint.textContent = `Tap another ${kind === "cards" ? "card" : "support"} slot to move it there`;
    ui.act.classList.add("is-on");
    // keep the picked card above the command bar (the dock's margin has just made room to scroll)
    const r = o.el.getBoundingClientRect(), limit = innerHeight - (70 + 168) * FX.zoom();
    if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit + 12, behavior: FX.reduced ? "auto" : "smooth" });
  }
  function clearSel() {
    if (!sel) return;
    const o = ed.shown[sel.kind][sel.i];
    if (o) { o.el.classList.remove("is-selected"); o.el.removeAttribute("aria-pressed"); }
    sel = null;
    ui.editor.classList.remove("is-targeting");
    delete ui.editor.dataset.target;
    ui.act.classList.remove("is-on");
  }
  function slotTap(kind, i) {
    const here = ed.shown[kind][i];
    if (sel) {
      if (sel.kind === kind) {
        if (sel.i === i) { clearSel(); return; }
        const from = sel.i;
        commit((d) => { swapSlots(d, kind, from, i); });    // empty target = move, a card there = swap (rarity + grades go along)
        return;
      }
      clearSel();                                           // the other row: stop moving, then this slot as usual
    }
    if (here) slotSheet(kind, i);
    else openPicker(kind, i);
  }
  function clearSlot(kind, i) {
    const o = ed.shown[kind][i];
    if (!o) return;
    const name = o.el.dataset.name;
    if (commit((d) => { d[kind][i] = null; if (kind === "cards") { if (Array.isArray(d.grades)) d.grades[i] = null; resetTG(d, i); } })) undoToast(`Removed ${name}`);
  }
  function details(el, kind) {
    const id = el.dataset.id;
    if (!lookup(kind, id)) return;
    C.openCard(id, $(".card", el));   // a support opens the same card detail (2026-10-28)
  }


  /* ==========================================================
     Slot sheet (owner 2026-11-02): tap a card or support in a slot = one dialog for that slot
       card:    the card (its numbers with the deck's buffs) · Rarity (Normal … Godly) ·
                Details / Change card / Move to another slot / Remove (Grade bars + Trait chips removed 2026-11-03)
       support: the support card · Rarity · Details / Change / Move / Remove
     Every change goes through commit() (Undo works) and paints the board behind and the card in the sheet at once
     (flash + numbers count · §4). A new rarity is remembered for the next card (cbi:deckRarity).
     ========================================================== */
  let sheet = null;                                // { kind, i, id, root, paint(animate) } while a slot sheet is open
  function sheetHTML(kind, i) {
    const isCard = kind === "cards", id = cur[kind][i], x = lookup(kind, id), r = rarityAt(cur, kind, i);
    const chips = state.meta.rarities.map((q) => `<button type="button" class="chip glass fx-press" data-ss-rarity="${esc(q.name)}" aria-pressed="${q.name === r}" style="--sw:${C.RARITY_SWATCH[q.name] || "var(--r-normal)"}"><span class="chip__swatch"></span>${esc(q.name)}</button>`).join("");
    const btn = (act, icon, label, cls = "", aria = "") => `<button type="button" class="tm-btn fx-press ${cls}" data-dlg="${act}"${aria ? ` aria-label="${aria}"` : ""}>${icon}${label}</button>`;
    return `<div class="dk-ss" data-kind="${kind}">
        <div class="dk-ss__top">
          <div class="dk-ss__card" data-ss-card></div>
          <div class="dk-ss__sum">
            <p class="dk-ss__where">${isCard ? `Slot ${i + 1}` : `Support ${i + 1}`}</p>
            ${isCard && x ? `<p class="dk-ss__stat dk-ss__stat--atk"><span>ATK</span><b data-ss-atk></b></p>
            <p class="dk-ss__stat dk-ss__stat--hp"><span>HP</span><b data-ss-hp></b></p>
            <p class="dk-ss__buff" data-ss-buff></p>` : ""}
            ${!isCard && x ? `<p class="dk-ss__fx" data-ss-fx></p>` : ""}
            ${x ? "" : `<p class="dk-ss__fx">Not in the library yet.</p>`}
          </div>
        </div>
        ${x ? `<section class="dk-ss__sec" aria-label="Rarity">
          <h3 class="tm-field__label">Rarity</h3>
          <div class="rarity-picker dk-ss__rar" role="group" aria-label="Rarity of this ${isCard ? "card" : "support"}">${chips}</div>
        </section>` : ""}
        ${isCard && x ? tgSheetHTML() : ""}
        <div class="dk-ss__acts">
          ${x ? btn("details", ICON.info, "Details") : ""}
          ${btn("replace", ICON.swap, isCard ? "Change card" : "Change support")}
          ${btn("move", ICON.move, "Move", "", "Move to another slot")}
          ${btn("remove", ICON.trash, "Remove", "tm-btn--danger")}
        </div>
      </div>`;
  }
  // the slot sheet's Grade (1–10) and Trait (13) pickers · tap the one that's on, or Remove, to take it off
  function tgSheetHTML() {
    // 4 grades like the game (Basic Attack, Defense, Status Damage, HP), each 1–10 grouped by colour (owner 2026-11-04):
    // bronze 1–3 | silver 4–6 | gold 7–9 | rainbow 10 · upright numbers · "All 10" sets the four at once
    const gb = (k, g) => `<button type="button" class="dk-gp__b fx-press" data-ss-gk="${k}" data-ss-grade="${g}" data-band="${gradeBand(g)}" aria-pressed="false" aria-label="${GSTATS[k]} grade ${g}">${g}</button>`;
    // like the game's Card Grader (owner 2026-11-04): a panel per stat · NAME + "+x%" (2.5% a grade, the game's label) ·
    // a 10-step bar (tap a step = that grade, the same step again = 0) · the grade in a box on the right
    const seg = (k, g) => `<button type="button" class="dk-g4__seg" style="--i:${g - 1}" data-ss-gk="${k}" data-ss-grade="${g}" aria-pressed="false" aria-label="${GSTATS[k]} grade ${g}"></button>`;
    const grades = GSTATS.map((name, k) => `<div class="dk-g4__row" data-ss-grow="${k}">
        <p class="dk-g4__name">${name}</p>
        <span class="dk-g4__pct" data-ss-gp="${k}"></span>
        <div class="dk-g4__bar" role="group" aria-label="${name} grade">${Array.from({ length: GRADE_MAX }, (_, j) => seg(k, j + 1)).join("")}</div>
        <input class="dk-g4__box" data-ss-gv="${k}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" enterkeyhint="done" spellcheck="false" placeholder="–" aria-label="${name} grade, 0 to ${GRADE_MAX}">
      </div>`).join("");
    // Trait: one scrolling box, 3 rows show (owner 2026-11-04: saves room) · the chosen one's full text under the box · a row per trait like the game's Trait Shop: icon · name · what it does · tier
    const traits = traitList().map((t) => `<button type="button" class="dk-tl__row" data-ss-trait="${esc(t.id)}" data-c="${t.color === "rainbow" ? "rainbow" : "solid"}" style="${traitColor(t)}" aria-pressed="false">
        ${traitIcon(t, "dk-tl__ic")}<span class="dk-tl__txt"><b class="dk-tl__n">${esc(t.name)}</b><small>${traitFx(t).map(esc).join(" · ")}</small></span><span class="dk-tl__tier">${esc(t.tier)}</span></button>`).join("");
    const rm = (what) => `<button type="button" class="dk-ss__rm fx-press" data-ss-rm="${what}" hidden>${ICON.x}Remove</button>`;
    return `<section class="dk-ss__sec" aria-label="Grade">
        <div class="dk-ss__h"><h3 class="tm-field__label">Grade</h3><b class="dk-g4__total" data-ss-gt></b></div>
        <p class="dk-g4__sum" data-ss-gsum>${GSUM}</p>
        <div class="dk-g4">${grades}</div>
        <div class="dk-g4__acts"><button type="button" class="tm-btn fx-press dk-g4__btn" data-ss-all>${ICON.max}All ${GRADE_MAX}</button><button type="button" class="tm-btn fx-press dk-g4__btn" data-ss-rm="grade">${ICON.x}Remove</button></div>
      </section>
      ${traitList().length ? `<section class="dk-ss__sec" aria-label="Trait">
        <div class="dk-ss__h"><h3 class="tm-field__label">Trait</h3>${rm("trait")}</div>
        <div class="dk-tl" role="group" aria-label="Trait">${traits}</div>
        <p class="dk-tl__fx" data-ss-tfx hidden></p>
      </section>` : ""}`;
  }
  const traitFx = (t) => [t.dmg ? `x${t.dmg} Damage` : "", t.hp ? `x${t.hp} Health` : "", ...(Array.isArray(t.lines) ? t.lines : [])].filter(Boolean);
  // paint the sheet's Grade + Trait part from a slot's 4 grades + trait id (also js/battle.js · C.deckParts)
  function paintTGSheet(root, g4, tId) {
    const g = overallOf(g4), full = fullOf(g4);
    root.querySelectorAll("[data-ss-grade]").forEach((b) => {
      const v = g4[Number(b.dataset.ssGk)], n = Number(b.dataset.ssGrade);
      b.setAttribute("aria-pressed", String(n === v));
      b.classList.toggle("is-on", n <= v);
    });
    root.querySelectorAll("[data-ss-grow]").forEach((row) => { row.dataset.tone = gradeTone(g4[Number(row.dataset.ssGrow)]); });
    root.querySelectorAll("[data-ss-gv]").forEach((e) => { const v = g4[Number(e.dataset.ssGv)]; e.value = v ? String(v) : ""; });
    // "+x%" = what the card really gets (js/deckbuff.js gradePct: 2.5% a point · +5% more when all 4 are 10 = +30%)
    const gp = C.deckBuff.gradePct(g4), gpv = [gp.atk, gp.def, gp.status, gp.hp];
    root.querySelectorAll("[data-ss-gp]").forEach((e) => { const v = gpv[Number(e.dataset.ssGp)]; e.textContent = v ? `+${Number(v.toFixed(1))}%` : ""; });
    const gt = $("[data-ss-gt]", root), gsum = $("[data-ss-gsum]", root), all = $("[data-ss-all]", root);
    if (gt) { gt.textContent = g ? `GRADE ${g}` : "NO GRADE"; gt.dataset.tone = full ? "mint" : gradeTone(g); }
    if (gsum) { gsum.textContent = full ? GSUM_FULL : GSUM; gsum.classList.toggle("is-full", full); }
    if (all) all.disabled = full;
    root.querySelectorAll("[data-ss-trait]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ssTrait === tId)));
    const rmG = $('[data-ss-rm="grade"]', root), rmT = $('[data-ss-rm="trait"]', root), tfx = $("[data-ss-tfx]", root);
    if (rmG) rmG.disabled = !g;
    if (rmT) rmT.hidden = !tId;
    const t = tId ? traitById(tId) : null;
    if (tfx) { tfx.hidden = !t; tfx.innerHTML = t ? `<b>${esc(t.name)}</b> <span>${esc(t.tier)}</span> · ${traitFx(t).map(esc).join(" · ")}` : ""; }
  }
  // the grade boxes take a typed number (owner 2026-11-04): 1–10 · empty / 0 = no grade · over 10 = 10 · anything else = put back
  // set(k, v) commits stat k = v · repaint() paints the sheet again (puts a bad entry back) · Enter closes the keyboard
  function gradeInputs(root, set, repaint) {
    root.addEventListener("focusin", (e) => { const inp = e.target.closest("[data-ss-gv]"); if (inp) requestAnimationFrame(() => inp.select()); });
    root.addEventListener("keydown", (e) => { const inp = e.target.closest("[data-ss-gv]"); if (inp && e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    root.addEventListener("change", (e) => {
      const inp = e.target.closest("[data-ss-gv]"); if (!inp) return;
      const txt = String(inp.value).trim();
      if (txt !== "" && !/^\d+$/.test(txt)) { repaint(); if (!FX.reduced) FX.flash(inp); return; }
      set(Number(inp.dataset.ssGv), Math.min(GRADE_MAX, Number(txt || 0)));
    });
  }
  // stat k set to v (0 = off): the 4 grades after it (all 0 = null)
  function gradeSet(g4, k, v) {
    const n = (g4 || [0, 0, 0, 0]).slice();
    n[k] = v;
    return n.some((x) => x > 0) ? n : null;
  }
  // a tap on grade step g of stat k: the 4 grades after it (the grade that's on again = off · all 0 = null)
  function gradeTap(g4, k, g) {
    const n = (g4 || [0, 0, 0, 0]).slice();
    n[k] = n[k] === g ? 0 : g;
    return n.some((v) => v > 0) ? n : null;
  }

  async function slotSheet(kind, i) {
    if (!cur || mode !== "editor" || !cur[kind][i] || sheet || dialogOpen()) return;
    clearSel();
    const id = cur[kind][i], x = lookup(kind, id), isCard = kind === "cards";
    const res = await dialog({
      title: `${x ? x.name : pretty(id)}`,
      html: sheetHTML(kind, i),
      actions: [{ label: "Done", value: "cancel", cls: "tm-btn--primary" }],
      onMount(dlg) {
        $(".tm-dlg__sheet", dlg).classList.add("dk-ss-sheet");
        const root = $(".dk-ss", dlg), box = $("[data-ss-card]", root);
        let art = null;
        if (x) {
          art = C.renderCard(x, rarityAt(cur, kind, i), { mini: true, tilt: false });
          art.tabIndex = -1; art.removeAttribute("role"); art.setAttribute("aria-hidden", "true");
          art._r = rarityAt(cur, kind, i);
          box.appendChild(art);
        } else box.innerHTML = `<span class="tm-missing"><span>${esc(pretty(id))}</span><small>Not in the library</small></span>`;
        const alive = () => sheet && sheet.root === root && cur && cur[kind][i] === id;
        // paint the sheet from the deck as it is now (after a commit)
        const paint = (animate) => {
          if (!alive() || !x) return;
          const r = rarityAt(cur, kind, i);
          root.querySelectorAll("[data-ss-rarity]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ssRarity === r)));
          if (art._r !== r) {
            const nums = isCard ? [$('[data-k="atk"]', art), $('[data-k="hp"]', art)].filter(Boolean) : [], was = nums.map((e) => e.dataset.value);
            C.setCardRarity(art, x, r, { animate });
            nums.forEach((e, q) => { e.dataset.value = was[q]; });
            art._r = r;
          }
          if (isCard) {
            const tId = cur.trait[i], g4 = cur.grades[i] || [0, 0, 0, 0], g = overallOf(g4), full = fullOf(g4);
            paintTG(art, tId, g, animate);
            paintTGSheet(root, g4, tId);
            const b = ed.buffs && ed.buffs[i];
            if (b && b.id === id) {
              C.setCardNums(art, { atk: b.atk, hp: b.hp }, { animate });
              const sa = $("[data-ss-atk]", root), sh2 = $("[data-ss-hp]", root);
              sa.textContent = C.fmtHp(b.atk); sh2.textContent = C.fmtHp(b.hp);   // short from 100M, like HP (owner 2026-11-05 · the card keeps the full ATK)
              $("[data-ss-buff]", root).innerHTML = b.atkPct || b.hpPct ? `<span>Buffs</span> <b>${esc(buffText(b))}</b>` : "";
              if (animate) { FX.flash(sa.parentNode); FX.flash(sh2.parentNode); }
            }
          } else {
            const fx = $("[data-ss-fx]", root);
            if (fx) fx.textContent = x.effect && x.effect.desc ? C.supText(x, x.effect.desc, r) : "";   // its values at this rarity
          }
        };
        sheet = { kind, i, id, root, paint };
        paint(false);
        { const on = $('.dk-tl [aria-pressed="true"]', root); if (on) on.parentNode.scrollTop = on.offsetTop - on.parentNode.firstElementChild.offsetTop; }   // the chosen trait shows in its box
        requestAnimationFrame(() => root.querySelectorAll(".rarity-picker").forEach((p) => C.revealChip(p.parentNode)));
        if (isCard) gradeInputs(root, (k, v) => { if (!alive()) return; commit((d) => { d.grades[i] = gradeSet(d.grades[i], k, v); }); paint(true); }, () => { if (alive()) paintTGSheet(root, cur.grades[i] || [0, 0, 0, 0], cur.trait[i]); });
        root.addEventListener("click", (e) => {
          if (!alive()) return;
          const rb = e.target.closest("[data-ss-rarity]");
          if (rb) {
            const r = rb.dataset.ssRarity;
            if (!isRarity(r)) return;
            rememberRarity(r);                             // the next card / support starts here
            if (r !== rarityAt(cur, kind, i)) commit((d) => { d[RKEY[kind]][i] = r; });
            paint(true);
            return;
          }
          if (!isCard) return;
          const gb = e.target.closest("[data-ss-grade]"), tb = e.target.closest("[data-ss-trait]"), rm = e.target.closest("[data-ss-rm]");
          const al = e.target.closest("[data-ss-all]");
          if (al) {
            commit((d) => { d.grades[i] = [GRADE_MAX, GRADE_MAX, GRADE_MAX, GRADE_MAX]; });
            paint(true);
          } else if (gb || (rm && rm.dataset.ssRm === "grade")) {
            commit((d) => { d.grades[i] = gb ? gradeTap(d.grades[i], Number(gb.dataset.ssGk), Number(gb.dataset.ssGrade)) : null; });
            paint(true);
          } else if (tb || (rm && rm.dataset.ssRm === "trait")) {
            const t = tb ? tb.dataset.ssTrait : null;
            if (t && !traitById(t)) return;
            commit((d) => { d.trait[i] = d.trait[i] === t ? null : t; });
            paint(true);
          }
        });
      },
    });
    sheet = null;
    if (!res || !cur || mode !== "editor" || cur[kind][i] !== id) return;
    if (res.action === "details") { const o = ed.shown[kind][i]; if (o) details(o.el, kind); }
    else if (res.action === "replace") openPicker(kind, i);
    else if (res.action === "move") select(kind, i);
    else if (res.action === "remove") clearSlot(kind, i);
  }

  /* ==========================================================
     Card picker (a dialog: search + filters + the whole library, made in chunks as you scroll)
     ========================================================== */
  function chipHTML(key, value, label, style = "") {
    return `<button type="button" class="chip glass fx-press" data-pk="${key}" data-v="${esc(value)}" aria-pressed="false"${style ? ` style="${style}"` : ""}>${style ? '<span class="chip__swatch"></span>' : ""}${esc(label)}</button>`;
  }
  async function openPicker(kind, i) {
    if (!cur || mode !== "editor") return;
    const here = cur[kind][i];
    const usedAt = new Map();
    if (kind === "cards") cur.cards.forEach((id, k) => { if (id) usedAt.set(id, k); });
    const id = await pickDialog({ kind, slot: i, all: libs[kind], here, usedAt, rarity: lastRarity() });
    if (!id || !cur || mode !== "editor" || id === here) return;
    commit((d) => { place(d, kind, i, id); });
  }
  /* The picker dialog itself (also the Battle page's · C.deckParts.pickDialog · owner 2026-11-04: "the same as the Deck 100%"):
     { kind, slot, all (the list, best first), here (id in the slot now), usedAt (Map id -> slot), rarity } -> the picked id | null */
  async function pickDialog({ kind, slot: i, all, here = null, usedAt = new Map(), rarity }) {
    const isCard = kind === "cards";
    const f = { q: "", tier: "", role: "", series: "" };
    const text = new Map(all.map((x) => [x.id, [x.name, x.series, x.role].filter(Boolean).join(" ").toLowerCase()]));
    const noun = isCard ? "cards" : "support cards";
    const tierNames = state.meta.tiers.filter((t) => isCard || !t.cardsOnly).map((t) => t.name);   // Utility = cards only
    let filters = `<div class="tm-chips" role="group" aria-label="Filter by tier">${tierNames.map((t) => chipHTML("tier", t, t, `--sw:var(${C.TIER_COLOR[t] || "--t-d"});--sw-line:var(${C.TIER_COLOR[t] || "--t-d"})`)).join("")}${chipHTML("tier", "-", "Unranked")}</div>`;
    if (isCard) {
      const roles = C.fieldValues(state.cards, "role").sort();   // [] until ~every card has one (audit 2026-11-09)
      if (roles.length) filters += `<div class="tm-chips" role="group" aria-label="Filter by role">${roles.map((r) => chipHTML("role", r, r)).join("")}</div>`;
      const series = C.fieldValues(state.cards, "series").sort((a, b) => a.localeCompare(b));
      if (series.length > 1) filters += `<label class="field"><span class="sr-only">Series</span><select data-pk-select="series"><option value="">All series</option>${series.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></label>`;
    }
    const res = await dialog({
      title: `${isCard ? "Choose a card" : "Choose a support card"} · ${isCard ? "Slot" : "Support"} ${i + 1}`,
      html: `<div class="dk-pick">
          <div class="dk-pick__head">
            <label class="field field--search"><span class="sr-only">Search ${noun}</span>${ICON.search.replace("<svg ", '<svg class="field__icon" ')}<input type="search" data-q autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Search ${noun}"></label>
            <button type="button" class="iconbtn glass fx-press dk-pick__filter" data-pick-filter aria-expanded="false" aria-label="Filters" title="Filters">${ICON.filter}<span class="tm-dot" data-dot hidden></span></button>
          </div>
          <div class="dk-pick__filters" data-filters hidden>${filters}</div>
          <div class="dk-pick__scroll" data-scroll>
            <div class="dk-pick__grid" data-grid role="list"></div>
            <div data-more class="dk-pick__more" aria-hidden="true"></div>
            <p class="dk-pick__empty" data-empty hidden></p>
          </div>
          <p class="tm-field__note" data-count></p>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
      onMount(d, finish) {
        $(".tm-dlg__sheet", d).classList.add("dk-pick-sheet");
        const q = $("[data-q]", d), grid = $("[data-grid]", d), more = $("[data-more]", d), scroller = $("[data-scroll]", d);
        const empty = $("[data-empty]", d), count = $("[data-count]", d), fbox = $("[data-filters]", d), fbtn = $("[data-pick-filter]", d), dot = $("[data-dot]", d);
        let rows = [], n = 0, io = null;
        const tile = (x) => {
          const el = document.createElement("div");
          el.className = "dk-tile";
          el.tabIndex = 0;
          el.setAttribute("role", "listitem");
          el.dataset.id = x.id;
          const art = C.renderCard(x, rarity, { mini: true });
          art.tabIndex = -1; art.removeAttribute("role");
          art.setAttribute("aria-hidden", "true");
          el.appendChild(art);
          const at = usedAt.get(x.id);
          let label = x.name;
          if (isCard && at != null && x.id !== here) {   // can still be picked: a card may fill several slots (2026-10-30)
            el.classList.add("is-in");
            el.insertAdjacentHTML("beforeend", `<span class="dk-tile__tag">Slot ${at + 1}</span>`);
            label += `, also in slot ${at + 1}`;
          } else if (x.id === here) {
            el.classList.add("is-here");
            el.insertAdjacentHTML("beforeend", `<span class="dk-tile__tag dk-tile__tag--here">Here</span>`);
            label += ", in this slot now";
          }
          el.setAttribute("aria-label", label);
          return el;
        };
        const chunk = () => {
          if (n >= rows.length) return;
          const frag = document.createDocumentFragment();
          rows.slice(n, n + CHUNK).forEach((x) => frag.appendChild(tile(x)));
          n = Math.min(rows.length, n + CHUNK);
          grid.appendChild(frag);
        };
        const apply = () => {
          const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
          rows = all.filter((x) => {
            const rk = isRankedOf(kind, x);
            if (f.tier && !(f.tier === "-" ? !rk : rk && x.tier === f.tier)) return false;
            if (f.role && x.role !== f.role) return false;
            if (f.series && x.series !== f.series) return false;
            return !words.length || words.every((w) => text.get(x.id).includes(w));
          });
          grid.replaceChildren();
          n = 0;
          scroller.scrollTop = 0;
          chunk();
          empty.hidden = rows.length > 0;
          if (!rows.length) empty.textContent = !all.length ? `No ${noun} in the library yet.` : "Nothing matches. Try another search or filter.";
          count.textContent = all.length ? `${plural(rows.length, isCard ? "card" : "support card", noun)}${rows.length < all.length ? ` of ${all.length}` : ""}` : "";
          const any = !!(f.tier || f.role || f.series);
          dot.hidden = !any;
          fbox.querySelectorAll(".chip[data-pk]").forEach((b) => b.setAttribute("aria-pressed", String(f[b.dataset.pk] === b.dataset.v)));
        };
        if ("IntersectionObserver" in window) {
          io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) chunk(); }, { root: scroller, rootMargin: "240px 0px" });
          io.observe(more);
        } else {
          scroller.addEventListener("scroll", () => { if (scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 300) chunk(); }, { passive: true });
        }
        q.addEventListener("input", () => { f.q = q.value; apply(); });
        q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); q.blur(); } });
        fbtn.addEventListener("click", () => {
          const open = fbox.hidden;
          fbox.hidden = !open;
          fbtn.setAttribute("aria-expanded", String(open));
          if (open) animateIn(fbox);
        });
        fbox.addEventListener("click", (e) => {
          const b = e.target.closest(".chip[data-pk]");
          if (!b) return;
          f[b.dataset.pk] = f[b.dataset.pk] === b.dataset.v ? "" : b.dataset.v;
          apply();
        });
        fbox.addEventListener("change", (e) => { const s = e.target.closest("select[data-pk-select]"); if (s) { f[s.dataset.pkSelect] = s.value; apply(); } });
        const choose = (el) => {
          if (!el || el.classList.contains("is-used")) return;
          finish({ action: "pick", id: el.dataset.id });
        };
        grid.addEventListener("click", (e) => choose(e.target.closest(".dk-tile")));
        grid.addEventListener("keydown", (e) => {
          const el = e.target.closest(".dk-tile");
          if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(el); }
        });
        d.addEventListener("close", () => { if (io) io.disconnect(); }, { once: true });
        apply();
        if (!fine.matches && document.activeElement && document.activeElement.blur) document.activeElement.blur();   // no keyboard popping up on a phone
      },
    });
    return res && res.action === "pick" ? res.id : null;
  }

  /* ==========================================================
     Drag (Pointer Events, works with fingers and the mouse; no HTML5 drag API)
     ========================================================== */
  const drag = { p: null, on: false };
  let lastX = 0, lastY = 0, blockClick = false;
  const GHOST_R = 20000;   // px range of the ghost's position animations (−R … +R)

  function onDown(e) {
    if (drag.on || drag.p || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0) || mode !== "editor") return;
    const el = e.target.closest(".dk-item");
    if (!el || !ed.root.contains(el) || el.classList.contains("dk-item--missing") && false) return;
    const slot = el.closest(".dk-slot");
    if (!slot) return;
    lastX = e.clientX; lastY = e.clientY;
    const p = drag.p = { el, kind: slot.dataset.kind, i: Number(slot.dataset.i), pid: e.pointerId, touch: e.pointerType !== "mouse", x0: e.clientX, y0: e.clientY, timer: 0 };
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
  // FX.tilt never sees the pointerup once the root has the pointer, so put the card flat again by hand
  function untilt(el) {
    el.querySelectorAll(".is-tilting").forEach((c) => {
      c.classList.remove("is-tilting");
      ["--rx", "--ry", "--gx", "--gy"].forEach((p) => c.style.removeProperty(p));
    });
  }
  // step 9.5 rule: the ghost follows the finger with two paused animations whose currentTime is the position in px
  function ghostAxis(el, axis) {
    if (!el.animate) return null;
    const a = el.animate([{ transform: `translate${axis}(${-GHOST_R}px)` }, { transform: `translate${axis}(${GHOST_R}px)` }], { duration: 2 * GHOST_R, fill: "both" });
    a.pause();
    return a;
  }
  function moveGhost() {
    if (!drag.ghost) return;
    drag.gx = lastX - drag.offX; drag.gy = lastY - drag.offY;
    if (drag.ax && drag.ay) { drag.ax.currentTime = drag.gx + GHOST_R; drag.ay.currentTime = drag.gy + GHOST_R; }
    else drag.ghost.style.transform = `translate(${drag.gx}px, ${drag.gy}px)`;
  }
  function settleGhost(g) {
    if (drag.ax) { drag.ax.cancel(); drag.ax = null; }
    if (drag.ay) { drag.ay.cancel(); drag.ay = null; }
    g.style.transform = `translate(${drag.gx}px, ${drag.gy}px)`;
  }
  function queue() { if (drag.on && !drag.raf) drag.raf = requestAnimationFrame(track); }

  function start() {
    const p = drag.p;
    drag.p = null;
    clearTimeout(p.timer);
    const el = p.el;
    el.classList.remove("is-pressing");
    if (!el.isConnected || mode !== "editor") return;
    clearSel();
    const r = el.getBoundingClientRect();
    Object.assign(drag, { on: true, el, pid: p.pid, touch: p.touch, kind: p.kind, i: p.i, id: el.dataset.id, offX: lastX - r.left, offY: lastY - r.top, over: null, overEl: null, raf: 0 });
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
    const gy = document.createElement("div");
    gy.className = "tm-ghost__y";
    gy.appendChild(inner);
    g.appendChild(gy);
    ui.layer.appendChild(g);
    drag.ghost = g;
    drag.ax = ghostAxis(g, "X");
    drag.ay = ghostAxis(gy, "Y");
    moveGhost();
    el.classList.add("is-source");
    ui.editor.classList.add("is-dragging");
    ui.editor.dataset.target = drag.kind;
    document.documentElement.classList.add("tm-grabbing");
    try { ui.root.setPointerCapture(drag.pid); } catch {}
    if (p.touch && navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
    blockClick = true;
    track();
  }
  // the slot (same kind) under the finger
  function slotAt(x, y) {
    const under = document.elementFromPoint(x, y);
    const slot = under && under.closest(`.dk-slot[data-kind="${drag.kind}"]`);
    return slot && ed.root.contains(slot) ? slot : null;
  }
  function track() {
    drag.raf = 0;
    if (!drag.on) return;
    setOver(slotAt(lastX, lastY));
  }
  function setOver(slot) {
    if (drag.overEl === slot) return;
    if (drag.overEl) drag.overEl.classList.remove("is-over");
    if (slot && Number(slot.dataset.i) !== drag.i) slot.classList.add("is-over");
    drag.overEl = slot;
  }
  function ghostAway(g) {
    const a = g.animate(FX.reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: g.style.transform }, { opacity: 0, transform: g.style.transform + " scale(.5)" }], { duration: FX.reduced ? 120 : 200, easing: EASE, fill: "forwards" });
    a.onfinish = a.oncancel = () => g.remove();
  }
  function finishDrag(ok) {
    if (!drag.on) return;
    cancelAnimationFrame(drag.raf);
    drag.raf = 0;
    const target = ok ? slotAt(lastX, lastY) : null;
    const g = drag.ghost, gr = g.firstElementChild.getBoundingClientRect();
    settleGhost(g);
    const { kind, i, el, id } = drag;
    drag.on = false;
    drag.ghost = null;
    try { ui.root.releasePointerCapture(drag.pid); } catch {}
    ui.editor.classList.remove("is-dragging");
    if (!sel) delete ui.editor.dataset.target;
    document.documentElement.classList.remove("tm-grabbing");
    setOver(null);
    el.classList.remove("is-source");
    untilt(el);
    setTimeout(() => { blockClick = false; }, 0);
    const j = target ? Number(target.dataset.i) : -1;
    if (target && j !== i) {                                // dropped on another slot: it moves there (or swaps with the card there)
      g.remove();
      commit((d) => { swapSlots(d, kind, i, j); }, { animate: true, land: { kind, i: j, id, rect: gr } });
      return;
    }
    const to = el.getBoundingClientRect();                  // anywhere else: it goes back where it came from
    if (FX.reduced || !rectVisible(to)) ghostAway(g);
    else {
      const a = g.animate([{ transform: g.style.transform }, { transform: `translate(${to.left}px, ${to.top}px)` }], { duration: 220, easing: EASE, fill: "forwards" });
      a.onfinish = a.oncancel = () => g.remove();
    }
  }

  /* ==========================================================
     Decks: create / open / rename / duplicate / delete
     ========================================================== */
  async function newDeck() {
    const auto = suggestName();
    const all = modes(), def = Math.max(0, all.findIndex((m) => m.id === DEFAULT_MODE));
    const res = await dialog({
      title: "New deck",
      html: `${nameInput(auto)}
        <div class="tm-field"><span class="tm-field__label" id="dk-l-mode">Mode</span>
          <div class="seg glass tm-pick dk-seg" data-pick="mode" role="group" aria-labelledby="dk-l-mode" style="--n:${all.length};--i:${def}"><span class="seg__ind" aria-hidden="true"></span>
            ${all.map((m, k) => `<button type="button" class="seg__btn fx-press" data-v="${esc(m.id)}" aria-pressed="${k === def}"${m.enabled ? "" : ' disabled title="Coming soon"'} aria-label="${esc(m.name)}${m.enabled ? "" : ", coming soon"}">${esc(m.short)}${m.enabled ? "" : "<small>Soon</small>"}</button>`).join("")}</div></div>`,
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Create", value: "ok", submit: true, cls: "tm-btn--primary" }],
      onMount(d) {
        bindPick(d);
        if (fine.matches) { const i = $("input[name=name]", d); i.focus(); i.select(); }
      },
    });
    if (!res || res.action !== "ok") return;
    const name = res.form.elements.name.value.trim().slice(0, NAME_MAX) || suggestName();
    const t = now();
    const d = clean({ id: newId("dk_"), name, mode: pickOf(res.form, "mode") || DEFAULT_MODE, rarity: lastRarity(), cards: [], support: [], created: t, updated: t });
    decks.unshift(d);
    save();
    openDeck(d.id);
  }

  function openDeck(id) {
    const url = "#deck/my/" + encodeURIComponent(id);
    if (mode === "editor") history.replaceState({ dkl: 1 }, "", url);   // switching decks from a toast: Back still goes to the list
    else history.pushState({ dkl: 1 }, "", url);
    C.route();
  }
  function back() {
    if (history.state && history.state.dkl) history.back();
    else { history.replaceState(null, "", "#deck"); C.route(); }          // opened from a direct link
  }

  /* ---------- The deck's note (owner 2026-11-02): the user's own words on the image (farming time …) ----------
     Editor: a box under the name (empty = "+ Add a note for the image") · tap = editNote() · shared view: read only */
  function paintNote(el, note, editable) {
    if (!el) return;
    const t = note || "";
    if (el.dataset.note === t && el.dataset.ready) return;
    el.dataset.note = t; el.dataset.ready = "1";
    el.classList.toggle("is-empty", !t);
    if (editable) {
      el.innerHTML = t ? `<span class="dk-note__text">${esc(t)}</span>${ICON.pencil}` : `${ICON.plus}<span>Add a note</span>`;
      el.setAttribute("aria-label", t ? `Note on the image: ${t}. Tap to edit` : "Add a note for the deck image");
    } else {
      el.hidden = !t;
      el.innerHTML = t ? `<span class="dk-note__text">${esc(t)}</span>` : "";
    }
  }
  async function editNote() {
    if (!cur || mode !== "editor") return;
    clearSel();
    const res = await dialog({
      title: "Note on the image",
      html: `<label class="tm-field"><span class="tm-field__label">Note</span>
          <textarea class="tm-input dk-note__input" name="note" maxlength="${NOTE_MAX}" rows="4" spellcheck="false" placeholder="Farming time, floor, what this deck is for …">${esc(cur.note || "")}</textarea></label>
        <p class="tm-field__note">Shown in a box under the deck's name when you save the image or share the deck. Up to ${NOTE_LINES} lines.</p>`,
      actions: [...(cur.note ? [{ label: "Remove", value: "clear", cls: "tm-btn--danger" }] : []), { label: "Cancel", value: "cancel" }, { label: "Save", value: "ok", submit: true, cls: "tm-btn--primary" }],
      onMount(d) { const t = $("textarea", d); if (fine.matches) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } },
    });
    if (!res || !cur || (res.action !== "ok" && res.action !== "clear")) return;
    const v = res.action === "clear" ? "" : noteOf(res.form.elements.note.value);
    if (v === (cur.note || "")) return;
    if (v) cur.note = v; else delete cur.note;
    touch();
    chrome();
    if (!FX.reduced) FX.flash(ui.note); else FX.fade(ui.note, 1, { duration: 150 });
  }

  async function renameDeck() {
    const res = await dialog({
      title: "Rename deck",
      html: nameInput(cur.name),
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Save", value: "ok", submit: true, cls: "tm-btn--primary" }],
      onMount(d) { const i = $("input", d); i.focus(); i.select(); },
    });
    if (!res || res.action !== "ok" || !cur) return;
    const v = res.form.elements.name.value.trim().slice(0, NAME_MAX);
    if (!v || v === cur.name) return;
    cur.name = v;
    touch();
    chrome();
    setTitle();
    FX.fade(ui.nameText, 1, { duration: 250 });
  }

  function addCopy(src, name, t = now()) {
    const copy = clean({ ...JSON.parse(JSON.stringify(src)), id: newId("dk_"), name, created: t, updated: t });
    return copy;
  }
  function duplicateDeck(id) {
    const d = decks.find((x) => x.id === id);
    if (!d) return;
    const copy = addCopy(d, copyName(d.name));
    decks.splice(decks.indexOf(d) + 1, 0, copy);
    save();
    if (mode === "index") flipIndex(() => renderIndex(false));
    FX.toast(`Made a copy: “${copy.name}”`, { action: { label: "Open", fn: () => openDeck(copy.id) } });
  }

  async function deleteDeck(id) {
    const d = decks.find((x) => x.id === id);
    if (!d) return;
    const res = await dialog({
      title: "Delete this deck?",
      html: `<p class="tm-dlg__text">“${esc(d.name)}” will be removed from this device. This can’t be undone.</p>`,
      actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete deck", value: "ok", submit: true, cls: "tm-btn--danger" }],
    });
    if (!res || res.action !== "ok") return;
    const i = decks.indexOf(d);
    if (i < 0) return;
    decks.splice(i, 1);
    hist.delete(id);
    save();
    if (mode === "editor" && cur && cur.id === id) back();
    else flipIndex(() => renderIndex(false));
    FX.toast(`Deleted “${d.name}”`);
  }

  async function deckMenu() {
    const empty = !anyCards(cur);
    const res = await dialog({
      title: cur.name,
      html: `<div class="tm-menu">
          <button type="button" class="tm-btn fx-press" data-dlg="image"${empty ? " disabled" : ""}>${ICON.image || ""}Save as image</button>
          <button type="button" class="tm-btn fx-press" data-dlg="link"${empty ? " disabled" : ""}>${ICON.link || ""}Share link</button>
          ${empty ? `<p class="tm-field__note">Add a card to share this deck.</p>` : ""}
          <button type="button" class="tm-btn fx-press" data-dlg="rename">${ICON.pencil}Rename</button>
          <button type="button" class="tm-btn fx-press" data-dlg="dup">${ICON.copy}Duplicate</button>
          <button type="button" class="tm-btn tm-btn--danger fx-press" data-dlg="del">${ICON.trash}Delete deck</button>
        </div>`,
      actions: [{ label: "Close", value: "cancel" }],
    });
    if (!res || !cur) return;
    if (res.action === "image") saveImage(cur, ed.root);
    else if (res.action === "link") shareLink(cur, ed.root);
    else if (res.action === "compare") compareDialog(cur.id);
    else if (res.action === "rename") renameDeck();
    else if (res.action === "dup") duplicateDeck(cur.id);
    else if (res.action === "del") deleteDeck(cur.id);
  }

  /* ==========================================================
     Share (step 9 tools): save as image · share link · open a shared deck · backup
     ========================================================== */
  // a deck packed for a link: ids by slot ("" = empty) · mode and rarity by name
  // cr / sr = the rarity of each card / support slot ("" = empty) · g (grades) / t (traits) are no longer written (removed 2026-11-03)
  // (owner 2026-11-02 · r stays: the deck's old rarity, what a link without cr / sr uses)
  function toPayload(d) {
    const p = { v: 1, n: d.name, m: d.mode, r: d.rarity, c: d.cards.map((x) => x || ""), s: d.support.map((x) => x || "") };
    p.cr = d.cards.map((x, i) => (x ? rarityAt(d, "cards", i) : ""));
    p.sr = d.support.map((x, i) => (x ? rarityAt(d, "support", i) : ""));
    if (d.note) p.o = d.note;                        // the note for the image (owner 2026-11-02 · older links: none)
    if (d.trait && d.trait.some(Boolean)) p.t = d.trait.map((x, i) => (x && d.cards[i] ? x : ""));   // trait per card slot (2026-11-04)
    if (d.grades && d.grades.some((g, i) => g && d.cards[i])) p.g = d.grades.map((g, i) => (g && d.cards[i] ? g : 0));   // 4 grades per card slot (same as links before 2026-11-03)
    return p;
  }
  // ...and back, checking everything (a link is typed by strangers). Returns a clean deck or null.
  function fromPayload(p) {
    if (!p || p.v !== 1 || typeof p.n !== "string" || !Array.isArray(p.c) || !Array.isArray(p.s) || p.c.length > OLD_SLOTS || p.s.length > OLD_SLOTS) return null;   // 5-slot links still open
    const ids = (a) => a.map((x) => (typeof x === "string" && x && x.length <= 80 ? x : null));
    const arr = (a) => (Array.isArray(a) && a.length <= OLD_SLOTS ? a : null);   // anything odd = as if it wasn't there
    // t = trait id per card slot · g = [atk, def, status, hp] | 0 per card slot (both as the links from before 2026-11-03) · gr = one grade per slot (first round 2026-11-04)
    return clean({ id: newId("dk_"), name: p.n, mode: p.m, rarity: p.r, cards: ids(p.c), support: ids(p.s),
      cardRarity: arr(p.cr), supRarity: arr(p.sr), trait: arr(p.t), grades: arr(p.g), grade: arr(p.gr), note: typeof p.o === "string" ? p.o : "", created: now(), updated: now() });
  }

  async function saveImage(d, flashEl) {
    if (!C.share || !C.share.deckImageDialog) return;
    await C.share.deckImageDialog(deckSpec(d), { flashEl });
  }
  async function shareLink(d, flashEl) {
    if (!C.share) return;
    let url;
    try { url = await C.share.makeLink("deck", toPayload(d)); } catch { FX.toast("Couldn’t make the link"); return; }
    await C.share.linkDialog({ url, title: d.name, flashEl, what: "deck" });
  }

  function showBad(browser) {
    ui.shBadTitle.textContent = browser ? "Your browser can’t open this link" : "This link can’t be opened";
    ui.shBadText.textContent = browser
      ? "It uses a feature your browser doesn’t have yet. Update the browser, or try another one."
      : "The link may be cut off or mistyped. Ask for it again, and make sure you copy all of it.";
    ui.shBad.hidden = false;
    FX.fade(ui.shBad, 1, { duration: 300 });
  }
  function paintSharedMeta() {
    const d = shared.deck, m = modeOf(d.mode);
    ui.shName.textContent = d.name;
    ui.shMeta.textContent = `${m.name} · ${rarityLabel(d)} · ${countOf(d.cards)}/${SLOTS} cards · ${countOf(d.support)}/${SLOTS} support`;
    paintNote(ui.shNoteText, d.note, false);
    const mine = shared.copyId && decks.some((x) => x.id === shared.copyId);
    ui.shCopyText.textContent = mine ? "Open my copy" : "Save a copy";
    let missing = 0;
    KINDS.forEach((k) => d[k].forEach((id) => { if (id && !lookup(k, id)) missing++; }));
    ui.shNote.hidden = !missing;
    ui.shNote.textContent = missing ? `${plural(missing, "card here isn’t", "cards here aren’t")} in the library yet, so ${missing === 1 ? "it shows" : "they show"} as a dashed slot.` : "";
  }

  async function openShared(data) {
    if (mode === "shared" && shData === data) return;       // same link again (Back from a card's details): leave it exactly as it is
    const token = ++shToken;
    clearSel();
    if (drag.on) finishDrag(false);
    mode = "shared"; shData = data; cur = null; shared = null;
    ui.index.hidden = true; ui.editor.hidden = true; ui.shared.hidden = true; ui.shBad.hidden = true; ui.shLoad.hidden = false;
    window.scrollTo({ top: 0 });
    setTitle(); setLead();
    const res = C.share ? await C.share.readLink(data) : null;
    if (token !== shToken || mode !== "shared") return;      // the person already went somewhere else
    ui.shLoad.hidden = true;
    const deck = res && res.payload ? fromPayload(res.payload) : null;
    if (!deck) { showBad(!!(res && res.error === "browser")); setTitle(); return; }
    shared = { data, deck, copyId: shCopies.get(data) || null };
    paintSharedMeta();
    paintBoard(sh, deck, { animate: false });
    paintBuffs(sh, deck);
    if (TS()) {
      const r = TS().score(deck);
      paintScore(ui.shScore, r, { note: r.empty ? null : modeOf(deck.mode).name });
      paintAnalysis(ui.shAna, deck, r, { editable: false });
    }
    sh.root.querySelectorAll(".dk-item").forEach((it) => it.setAttribute("aria-label", `${it.dataset.name}, ${it.closest(".dk-slot").dataset.kind === "cards" ? "slot" : "support"} ${Number(it.closest(".dk-slot").dataset.i) + 1}`));
    ui.shared.hidden = false;
    animateIn(ui.shared);
    FX.stagger($(".dk-row", sh.root), 45, { cls: "fx-up", max: 8, cleanup: true });
    setTitle();
  }
  function saveCopy() {
    if (mode !== "shared" || !shared) return;
    const had = shared.copyId && decks.find((x) => x.id === shared.copyId);
    if (had) { openDeck(had.id); return; }                  // already saved once: open that copy, never a second one
    const src = shared.deck;
    const taken = new Set(decks.map((x) => x.name));
    const d = addCopy(src, taken.has(src.name) ? copyName(src.name) : src.name);
    decks.unshift(d);
    save();
    shared.copyId = d.id;
    shCopies.set(shared.data, d.id);
    paintSharedMeta();
    FX.flash(sh.root);
    FX.toast(canSave ? `Saved “${d.name}” to My Decks` : `Copied “${d.name}” for this visit only`, { action: { label: "Open", fn: () => openDeck(d.id) } });
  }

  /* ---------- Backup file: the decks, in and out (js/share.js asks for these) ---------- */
  // merge: add decks you don't have; the same deck in both keeps the one edited last · replace: the backup is all there is
  function importDecks(data, how) {
    const incoming = (Array.isArray(data) ? data : []).slice(0, DECK_MAX).map(clean).filter(Boolean);
    let changed = 0;
    if (how === "replace") {
      const seen = new Set();
      decks = incoming.filter((d) => !seen.has(d.id) && seen.add(d.id));
      changed = decks.length;
      hist.clear();
    } else {
      const added = [];
      incoming.forEach((n) => {
        const i = decks.findIndex((d) => d.id === n.id);
        if (i < 0) { if (!added.some((a) => a.id === n.id)) { added.push(n); changed++; } }
        else if (String(n.updated) > String(decks[i].updated)) { decks[i] = n; hist.delete(n.id); changed++; }
      });
      decks = [...added, ...decks].slice(0, DECK_MAX);
    }
    save();
    if (built) {
      if (mode === "editor" && cur) {
        const again = decks.find((d) => d.id === cur.id);
        if (!again) back();
        else if (again !== cur) { cur = again; clearSel(); paintBoard(ed, cur, { animate: false }); chrome(); refresh({ animate: false }); }
      } else if (mode === "index") flipIndex(() => renderIndex(false));
    }
    return changed;
  }

  /* ==========================================================
     Views: all decks (index) / one deck (editor)
     ========================================================== */
  // the deck list (owner 2026-11-04: show what was set inside): each card as the small game card (name · skill · its text ·
  // the deck's ATK / HP · Grade / Trait badges) + its rarity · grade · trait pills, like the editor, small · empty = a dashed slot ·
  // supports in a smaller row under their cards (rarity · mutation pills) · no support at all = no row
  function stripCol(d, kind, i, buffs) {
    const col = document.createElement("span");
    col.className = "dkl__col";
    const id = d[kind][i], x = id ? lookup(kind, id) : null;
    const cell = document.createElement("span");
    cell.className = "dkl__c";
    if (x) {
      const r = rarityAt(d, kind, i), card = C.renderCard(x, r, { mini: true, tilt: false });
      card.tabIndex = -1; card.removeAttribute("role"); card.setAttribute("aria-hidden", "true");
      if (kind === "cards") {
        const b = buffs && buffs[i];
        if (b && b.id === id) C.setCardNums(card, { atk: b.atk, hp: b.hp }, { animate: false });
        paintTG(card, d.trait && d.trait[i], overallOf(d.grades && d.grades[i]), false);
      }
      cell.appendChild(card);
      col.appendChild(cell);
      const info = document.createElement("span");
      info.className = "dk-info dkl__info";
      info.innerHTML = pillsHTML(kind, d, i, id);
      col.appendChild(info);
    } else {
      cell.classList.add(id ? "is-missing" : "is-empty");
      if (id) cell.innerHTML = `<span class="dkl__miss">${esc(pretty(id))}</span>`;
      col.appendChild(cell);
    }
    return col;
  }
  function deckRow(d) {
    const li = document.createElement("li");
    li.className = "tml dkl glass";
    li.dataset.deck = d.id;
    const nc = countOf(d.cards), ns = countOf(d.support);
    li.innerHTML = `
      <button type="button" class="tml__open dkl__open fx-press" data-act="open" aria-label="Open ${esc(d.name)}, ${nc} of ${SLOTS} cards, ${ns} of ${SLOTS} support">
        <span class="tml__text">
          <span class="tml__name">${esc(d.name)}</span>
          <span class="tml__meta">${nc}/${SLOTS} cards · ${ns}/${SLOTS} support</span>
          <span class="dkl__strip" aria-hidden="true"></span>
          ${ns ? `<span class="dkl__sh" aria-hidden="true">Support</span><span class="dkl__strip dkl__strip--sup" aria-hidden="true"></span>` : ""}
          <span class="tml__date">Edited ${esc(fmtDate(d.updated))}</span>
        </span>
      </button>
      <button type="button" class="iconbtn fx-press dkl__dup" data-act="dup" aria-label="Duplicate ${esc(d.name)}">${ICON.copy}</button>
      <button type="button" class="iconbtn fx-press dkl__del" data-act="del" aria-label="Delete ${esc(d.name)}">${ICON.trash}</button>`;
    const strip = $(".dkl__strip", li), sup = $(".dkl__strip--sup", li), buffs = C.deckBuff ? C.deckBuff.compute(d) : [];
    d.cards.forEach((id, i) => strip.appendChild(stripCol(d, "cards", i, buffs)));
    if (sup) d.support.forEach((id, i) => sup.appendChild(stripCol(d, "support", i)));
    return li;
  }
  function renderIndex(animate) {
    ui.count.textContent = plural(decks.length, "deck", "decks");
    if (ui.cmpBtn) { ui.cmpBtn.disabled = decks.length < 2; ui.cmpBtn.title = decks.length < 2 ? "Make a second deck to compare" : ""; }
    ui.indexHead.hidden = !decks.length;
    ui.empty.hidden = !!decks.length;
    ui.lists.replaceChildren(...decks.map(deckRow));
    if (!animate) return;
    if (decks.length) FX.stagger(ui.lists, 50, { cls: "fx-up", max: 8, cleanup: true });
    else FX.fade(ui.empty, 1, { duration: 300 });
  }
  function flipIndex(mutate) {
    const before = new Map([...ui.lists.children].map((li) => [li.dataset.deck, { el: li, r: li.getBoundingClientRect() }]));
    const wasEmpty = !decks.length;
    mutate();
    const live = new Set();
    [...ui.lists.children].forEach((li) => {
      live.add(li.dataset.deck);
      const b = before.get(li.dataset.deck);
      if (!b) { popIn(li); return; }
      const r = li.getBoundingClientRect();
      slide(li, b.r.left - r.left, b.r.top - r.top);
    });
    before.forEach((b, id) => { if (!live.has(id) && rectVisible(b.r)) ghostOut(b.el, b.r); });
    if (!decks.length && !wasEmpty) FX.fade(ui.empty, 1, { duration: 300 });
  }

  function openEditor(id) {
    const d = decks.find((x) => x.id === id);
    if (!d) return;
    if (mode === "index") indexY = window.scrollY;
    clearSel();
    if (drag.on) finishDrag(false);
    cur = d;
    mode = "editor";
    shToken++; shData = null; shared = null;
    ui.index.hidden = true;
    ui.shared.hidden = ui.shBad.hidden = ui.shLoad.hidden = true;
    ui.editor.hidden = false;
    KINDS.forEach((k) => { ed.shown[k].forEach((o) => o && o.el.remove()); ed.shown[k] = new Array(SLOTS).fill(null); });
    paintBoard(ed, cur, { animate: false });
    chrome();
    refresh({ animate: false });
    animateIn(ui.editor);
    FX.stagger($(".dk-row", ed.root), 45, { cls: "fx-up", max: 8, cleanup: true });
    window.scrollTo({ top: 0 });
  }
  function showIndex() {
    const fromEditor = mode === "editor";
    const fromShared = mode === "shared";
    clearSel();
    if (drag.on) finishDrag(false);
    shToken++; shData = null; shared = null;
    mode = "index";
    cur = null;
    ui.editor.hidden = true;
    ui.shared.hidden = ui.shBad.hidden = ui.shLoad.hidden = true;
    ui.index.hidden = false;
    renderIndex(true);
    if (fromEditor || fromShared) {
      animateIn(ui.index);
      window.scrollTo({ top: indexY });
    }
  }

  /* ==========================================================
     Meta Decks (from teams.json) + Copy to My Decks
     ========================================================== */
  function track2(card, el) {
    if (!metaTiles.has(card.id)) metaTiles.set(card.id, []);
    metaTiles.get(card.id).push(el);
  }
  function supportName(id) {
    const s = supById.get(id);
    return (s && s.name) || pretty(id);
  }
  function slotEl(slot, n) {
    const id = typeof slot === "string" ? slot : slot && slot.card;
    const card = id ? cardById.get(id) : null;
    const wrap = document.createElement("div");
    wrap.className = "deck__slot";
    wrap.innerHTML = `<span class="deck__pos">Slot ${n}</span>`;
    if (card) {
      const el = C.renderCard(card, state.rarity, { mini: true });
      track2(card, el);
      wrap.appendChild(el);
    } else {
      // card id not in cards.json (yet): keep the slot so the deck still reads as 4 cards
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
  function metaEl(team, index) {
    const el = document.createElement("article");
    el.className = "deck glass";
    const name = team.name || pretty(team.id || "Deck");
    el.setAttribute("aria-label", `Deck: ${name}`);
    el.dataset.ti = index;
    const sup = Array.isArray(team.support) ? team.support : team.support ? [team.support] : [];
    const kind = KIND_LABEL[team.kind] ? team.kind : "";
    el.innerHTML = `
      <div class="deck__head">
        <h4 class="deck__name">${esc(name)}</h4>
        ${kind ? `<span class="deck__kind deck__kind--${kind}" title="${esc(KIND_TITLE[kind])}">${esc(KIND_LABEL[kind])}</span>` : ""}
        ${team.mock ? `<span class="badge badge--muted" title="Example data, not a real recommendation">Sample</span>` : ""}
        <button type="button" class="tm-btn fx-press deck__copy" data-copy aria-label="Copy ${esc(name)} to My Decks">${ICON.copy}Copy to My Decks</button>
      </div>
      <div class="deck__slots"></div>
      ${list(sup).length ? `<div class="deck__support"><span class="deck__label">Support</span>${list(sup).map((id) => `<span class="supchip">${esc(supportName(id))}</span>`).join("")}</div>` : ""}
      ${team.notes ? `<p class="deck__notes">${esc(team.notes)}</p>` : ""}`;
    const row = $(".deck__slots", el);
    list(team.slots).slice(0, SLOTS).forEach((s, i) => row.appendChild(slotEl(s, i + 1)));
    return el;
  }
  // plan 2026-10-30 #6: one group per mode (PvP · Tower Infinity · Overall, 3 teams each: Best · Runner-up · Easy to get);
  // a team without a mode (or in a hidden one) goes in a last group with no heading
  function renderMeta() {
    metaTeams = (Array.isArray(state.teams) ? state.teams : []).filter((t) => t && list(t.slots).length);
    ui.metaList.hidden = !metaTeams.length;
    ui.metaNone.hidden = metaTeams.length > 0;
    ui.metaRarity.hidden = !metaTeams.length;       // nothing to restyle when there are no decks
    metaTiles.clear();
    const live = modes().filter((m) => m.enabled);
    const groups = live.map((m) => ({ m, items: [] })), rest = { m: null, items: [] };
    metaTeams.forEach((t, i) => ((groups.find((g) => g.m.id === t.mode) || rest).items.push([t, i])));
    const frag = document.createDocumentFragment();
    [...groups, rest].filter((g) => g.items.length).forEach((g) => {
      const sec = document.createElement("section");
      sec.className = "deck-mode";
      if (g.m) {
        const hid = `deck-mode-${g.m.id}`;
        sec.setAttribute("aria-labelledby", hid);
        sec.innerHTML = `<div class="deck-mode__head"><h3 class="deck-mode__title" id="${esc(hid)}">${esc(g.m.name)}</h3>${MODE_LEADS[g.m.id] ? `<p class="deck-mode__lead">${esc(MODE_LEADS[g.m.id])}</p>` : ""}</div>`;
      }
      const box = document.createElement("div");
      box.className = "deck-list";
      g.items.forEach(([t, i]) => box.appendChild(metaEl(t, i)));
      sec.appendChild(box);
      frag.appendChild(sec);
    });
    ui.metaList.replaceChildren(frag);
  }
  // a meta deck as a deck of your own: the card in each slot, with that slot's support first, then the team's other support
  function teamToDeck(team) {
    const slots = list(team.slots).slice(0, SLOTS);
    const cards = slots.map((s) => (typeof s === "string" ? s : s && s.card) || null);
    const support = slots.map((s) => (s && typeof s === "object" && s.support) || null);
    const spare = list(Array.isArray(team.support) ? team.support : team.support ? [team.support] : []).filter((id) => !support.includes(id));
    for (let i = 0; i < SLOTS && spare.length; i++) if (!support[i]) support[i] = spare.shift();
    const taken = new Set(decks.map((x) => x.name));
    const base = (team.name || pretty(team.id || "Deck")).slice(0, NAME_MAX);
    const t = now();
    // owner 2026-11-02: every slot at the rarity picked on Meta Decks
    return clean({ id: newId("dk_"), name: taken.has(base) ? copyName(base) : base, mode: modeOf(team.mode).id, rarity: state.rarity, cards, support,
      created: t, updated: t });
  }
  function copyMeta(btn) {
    const art = btn.closest(".deck");
    const team = art && metaTeams[Number(art.dataset.ti)];
    if (!team) return;
    const d = teamToDeck(team);
    decks.unshift(d);
    save();
    FX.flash(art);
    FX.toast(canSave ? `Copied “${d.name}” to My Decks` : `Copied “${d.name}” for this visit only`, { action: { label: "Open", fn: () => openDeck(d.id) } });
  }
  function recolor(name) {
    const all = [];
    metaTiles.forEach((els, id) => els.forEach((el) => all.push([el, cardById.get(id)])));
    // read every position first, then write: mixing them forces a re-layout per card
    const seen = all.map(([el]) => !C.covered && el.isConnected && rectVisible(el.getBoundingClientRect()));   // C.covered: the card detail covers the page (speed 2026-11-03: no measuring, no flash)
    C.later("deck", all.map(([el, card], i) => () => card && C.setCardRarity(el, card, name, { animate: seen[i] })));
  }

  /* ==========================================================
     Routing: My Decks | Meta Decks, and which deck
     ========================================================== */
  const META_OFF = true;   // owner 2026-11-04: Meta Decks tab hidden (index.html #deck-tabs hidden) until the battle system is redone
  const isDeckHash = () => /^#\/?deck(?:[/?#]|$)/.test(location.hash);
  function parse() {
    const h = location.hash;
    if (/^#\/?deck\/meta(?:[/?#]|$)/.test(h)) {
      if (!META_OFF) return { view: "meta" };
      try { history.replaceState(null, "", "#deck"); } catch {}   // Meta Decks off: an old #deck/meta link = My Decks
    }
    let m = h.match(/^#\/?deck\/my\/([^/?#]+)/);
    if (m) { try { return { view: "my", id: decodeURIComponent(m[1]) }; } catch { return { view: "my", id: "" }; } }
    m = h.match(/^#\/?deck\/s\/([^/?#]+)/);
    if (m) return { view: "my", data: m[1] };
    return { view: "my" };
  }
  function setTitle() {
    if (state.page !== "deck" || !view) return;
    document.title = view === "meta" ? "Meta Decks — Card Battle Infinity"
      : mode === "editor" && cur ? `${cur.name} — My Decks — Card Battle Infinity`
      : mode === "shared" ? `${shared ? shared.deck.name + " — " : ""}Shared Deck — Card Battle Infinity`
      : "My Decks — Card Battle Infinity";
  }
  function setLead() {
    if (ui.lead) ui.lead.textContent = view === "meta" ? LEADS.meta : mode === "shared" ? LEADS.shared : LEADS.my;
  }
  function apply(t) {
    const next = t.view === "meta" ? "meta" : "my";
    const first = view === null;
    const changed = next !== view;
    if (changed && view === "my") { clearSel(); if (drag.on) finishDrag(false); }
    view = next;
    if (next === "meta" && !metaBuilt) { metaBuilt = true; renderMeta(); }
    if (next === "my") {
      if (t.data) openShared(t.data);                         // #deck/s/<data> (openShared sets the title itself)
      else if (t.id && decks.some((d) => d.id === t.id)) { if (mode !== "editor" || !cur || cur.id !== t.id) openEditor(t.id); }
      else {
        if (t.id !== undefined) { try { history.replaceState(null, "", "#deck"); } catch {} }   // unknown or deleted deck in the link -> all decks
        if (mode !== "index") showIndex();
      }
    }
    setTitle();
    setLead();
    if (!changed) return;
    ui.tabs.style.setProperty("--i", next === "meta" ? 1 : 0);
    ui.tabBtns.forEach((b) => {
      const on = b.dataset.tab === next;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    ui.my.hidden = next !== "my";
    ui.meta.hidden = next !== "meta";
    if (!first) {
      animateIn(next === "meta" ? ui.meta : ui.my);
      if (next === "meta") FX.stagger(ui.metaList, 70);
    }
  }
  // called by the router on every hash change and tab tap
  function show() {
    if (!built || !isDeckHash()) return;
    apply(parse());
  }
  /* The Deck tab became the current page. restore: coming Back from a support detail, so keep the old scroll position. */
  function enter({ restore = false } = {}) {
    if (restore) {
      const y = history.state.tierY;
      try {
        const { tierY, ...rest } = history.state;
        history.replaceState(Object.keys(rest).length ? rest : null, "");
      } catch {}
      window.scrollTo(0, y);
      return;
    }
    if (!built) return;
    if (view === "meta") FX.stagger(ui.metaList, 70);
    else if (mode === "index") FX.stagger(ui.lists, 50, { cls: "fx-up", max: 8, cleanup: true });
  }

  /* ==========================================================
     Events
     ========================================================== */
  function act(name, btn) {
    const li = btn.closest(".dkl");
    switch (name) {
      case "new": newDeck(); break;
      case "open": if (li) openDeck(li.dataset.deck); break;
      case "dup": if (li) duplicateDeck(li.dataset.deck); break;
      case "del": if (li) deleteDeck(li.dataset.deck); break;
      case "back": back(); break;
      case "rename": if (cur) renameDeck(); break;
      case "note": if (cur) editNote(); break;
      case "menu": if (cur) deckMenu(); break;
      case "backup": if (C.share) C.share.backupDialog(); break;
      case "compare": compareDialog(cur ? cur.id : null); break;
      case "sh-copy": saveCopy(); break;
      case "sh-image": if (shared) saveImage(shared.deck, sh.root); break;
      case "buff": buffDialog(btn); break;
      case "undo": step(-1); break;
      case "redo": step(1); break;
      case "clear": { const slot = btn.closest(".dk-slot"); if (slot && mode === "editor") clearSlot(slot.dataset.kind, Number(slot.dataset.i)); break; }
      case "sel-cancel": clearSel(); break;
    }
  }

  function onClick(e) {
    if (blockClick) { e.preventDefault(); e.stopPropagation(); return; }
    const oc = e.target.closest("[data-open-card]");
    if (oc && ui.root.contains(oc)) { if (cardById.has(oc.dataset.openCard)) C.openCard(oc.dataset.openCard, oc); return; }   // the card grows from the chip and returns to it
    const sg = e.target.closest(".dk-sug__item");
    if (sg && ui.root.contains(sg)) { addSuggested(sg.dataset.sugKind, sg.dataset.id, sg.dataset.slot); return; }
    const mb = e.target.closest("[data-dk-mode]");
    if (mb && ui.root.contains(mb)) { if (!mb.disabled) setMode(mb.dataset.dkMode); return; }
    const b = e.target.closest("[data-act]");
    if (b && ui.root.contains(b)) { act(b.dataset.act, b); return; }
    if (mode === "shared") {                                    // view only: a tap on a card = its details
      const it = e.target.closest(".dk-item");
      if (it && shared && sh.root.contains(it)) details(it, it.closest(".dk-slot").dataset.kind);
      return;
    }
    if (mode !== "editor") return;
    const slot = e.target.closest(".dk-slot");
    if (slot && ed.root.contains(slot)) { slotTap(slot.dataset.kind, Number(slot.dataset.i)); return; }
    if (sel && !e.target.closest(".dk-dock")) clearSel();       // tap on empty space = cancel
  }
  function onKey(e) {
    const t = e.target;
    const inField = t.matches && t.matches("input, textarea, select");
    const item = t.closest && t.closest(".dk-item");
    if (item && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      const slot = item.closest(".dk-slot");
      if (!slot) return;
      if (mode === "shared") { if (shared && sh.root.contains(item)) details(item, slot.dataset.kind); }
      else if (mode === "editor") slotTap(slot.dataset.kind, Number(slot.dataset.i));
      return;
    }
    if (e.key === "Escape" && sel) { e.preventDefault(); clearSel(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel && !inField) {
      e.preventDefault();
      const s = sel, f = ed.shown[s.kind][s.i];
      clearSlot(s.kind, s.i);
      const slot = ed.slots[s.kind][s.i];
      if (slot && f) { const nx = slot._empty; if (nx && nx.isConnected) nx.focus(); }
    }
  }
  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y while the editor is on screen
  function onGlobalKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || mode !== "editor" || view !== "my") return;
    if (state.page !== "deck" || ui.editor.hidden || dialogOpen() || drag.on) return;
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
    // once a card is lifted, the finger must drag it instead of scrolling the page · speed 2026-11-03: on this page's root
    // only (a drag always starts on a card in it, and a touch's moves go to where it started) — on document it made every
    // touch scroll of every page wait for the main thread (the Cards page with 60 cards scrolled behind the finger)
    ui.root.addEventListener("touchmove", (e) => { if (drag.on && e.cancelable) e.preventDefault(); }, { passive: false });
    ui.root.addEventListener("contextmenu", (e) => { if (drag.on || drag.p || e.target.closest(".dk-item")) e.preventDefault(); });
    ui.root.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(".dk-item")) e.preventDefault(); });   // images: no native drag
    document.addEventListener("keydown", onGlobalKey);
    window.addEventListener("blur", () => { if (drag.on) finishDrag(false); else cancelPress(); });
    // My Decks | Meta Decks: tab-like, so no history entries (same as the bottom tabs)
    ui.tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".seg__btn[data-tab]");
      if (!b || b.dataset.tab === view) return;
      history.replaceState(null, "", b.dataset.tab === "meta" ? "#deck/meta" : "#deck");
      C.route();
    });
    ui.tabs.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const to = $(`.seg__btn[data-tab="${view === "meta" ? "my" : "meta"}"]`, ui.tabs);
      if (to) { to.focus(); to.click(); }
    });
    ui.metaList.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b) copyMeta(b); });
    document.addEventListener("cbi:rarity", (e) => recolor(e.detail));
  }

  /* The first time the Deck tab shows (step 9.5: nothing is built for a tab nobody opens) */
  function build() {
    if (built) return;
    built = true;
    buildBoard(ed, $("#dk-board"), true);
    buildBoard(sh, $("#dk-sh-board"), false);
    ui.shScore.innerHTML = scoreHTML();
    ui.shScore = $(".dk-score", ui.shScore);
    C.watchLive(ui.shScore);
    if (TS()) {
      ui.ana.innerHTML = anaHTML(true);
      ui.shAna.innerHTML = anaHTML(false);
    } else { ui.ana.hidden = true; ui.shAna.hidden = true; }
    ui.loading.remove();
    ui.warn.hidden = canSave;
    apply(parse());
  }

  function init() {
    Object.assign(ui, {
      root: $("#dk"), lead: $("#deck-lead"), tabs: $("#deck-tabs"), tabBtns: [...document.querySelectorAll("#deck-tabs .seg__btn")],
      my: $("#deck-my"), meta: $("#deck-meta"),
      warn: $("#dk-warn"), loading: $("#dk-loading"),
      index: $("#dk-index"), indexHead: $("#dk-index-head"), count: $("#dk-count"), lists: $("#dk-lists"), empty: $("#dk-empty"),
      editor: $("#dk-editor"), name: $("#dk-name"), nameText: $("#dk-name-text"), undo: $("#dk-undo"), redo: $("#dk-redo"),
      hint: $("#dk-hint"), note: $("#dk-note"), shNoteText: $("#dk-sh-note-text"),
      act: $("#dk-act"), actName: $("#dk-act-name"), actHint: $("#dk-act-hint"),
      shLoad: $("#dk-sh-load"), shBad: $("#dk-sh-bad"), shBadTitle: $("#dk-sh-bad-title"), shBadText: $("#dk-sh-bad-text"),
      shared: $("#dk-shared"), shName: $("#dk-sh-name"), shMeta: $("#dk-sh-meta"), shCopyText: $("#dk-sh-copy-text"), shNote: $("#dk-sh-note"),
      metaList: $("#deck-list"), metaNone: $("#decks-none"), metaRarity: $("#deck-rarity"),
      ana: $("#dk-analysis"), shAna: $("#dk-sh-analysis"), shScore: $("#dk-sh-score"), cmpBtn: $("#dk-compare"),
    });
    if (!ui.root) return;
    cardById = new Map(state.cards.map((c) => [c.id, c]));
    const sup = (Array.isArray(state.support) ? state.support : []).filter((s) => s && s.id).map((s) => ({ ...s, name: s.name || pretty(s.id) }));
    supById = new Map(sup.map((s) => [s.id, s]));
    libs = { cards: orderList("cards", state.cards), support: orderList("support", [...supById.values()]) };

    // layer for the dragged card and fading copies (outside the page so nothing clips it)
    ui.layer = document.createElement("div");
    ui.layer.className = "tm-layer";
    ui.layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(ui.layer);

    // storage test: private browsing / blocked storage still works, it just can't keep anything
    try { localStorage.setItem("cbi:test", "1"); localStorage.removeItem("cbi:test"); } catch { canSave = false; }
    load();
    if (C.share) C.share.provide("decks", {
      label: "Decks", kind: "array",
      get: () => JSON.parse(JSON.stringify(decks)),
      count: (v) => v.length,
      noun: (n) => plural(n, "deck", "decks"),
      apply: importDecks,
    });
    ui.metaRarity.innerHTML = C.rarityChipsHTML();
    bind();
    C.lazy("deck", build);
  }

  C.deck = { init, enter, show, paintScore };
  /* Parts the Battle page builds its team boards + slot sheet from (js/battle.js · PROGRESS §3.3): same classes, css/deck.css */
  C.deckParts = { gradeInputs, gradeSet, pickDialog, lastRarity, rememberRarity, orderList, pillsHTML, fitName, tgHTML, paintTG, tgSheetHTML, paintTGSheet, gradeTap, buffText, overallOf, fullOf, gradeBand, gradeTone, traitById, traitIcon, traitColor, traitFx, GSTATS, GRADE_MAX, ICON };
})();
