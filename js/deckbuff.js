/* ==========================================================
   Card Battle Infinity — Deck buffs (owner 2026-11-02 · PROGRESS §3.3 `deckbuff.js`)
   The ATK / HP a card shows in a deck once the deck's buffs are in:
     ATK = base × Π(1 + %damage ÷ 100) · HP = base × Π(1 + %HP ÷ 100)
   base = C.statAt(card, key, the slot's rarity) · every buff MULTIPLIES (checked 2026-11-02 on the owner's battle screenshot:
   King of Conquerors Godly 10.89M → 20.3M / 26.3M / 21.6M only fits multiplying).
   Trait + Grade per card slot (owner 2026-11-04 · back in the Deck only): after the deck's buffs, ATK × the trait's dmg and
   HP × its hp (data/traits.json · deck.trait[i] = trait id | null) · Grade (deck.grades[i] = [atk, def, status, hp] 0–10,
   like the game · owner 2026-11-04 rule 2): each stat +2.5% a point on ITSELF only (10 = +25%) · all 4 at 10 = +30% more on
   every stat, added (25 + 30 = +55%) · 3 at 10 = +25% on those 3, no +30% · Basic Attack -> ATK × (1 + %), HP -> HP × (1 + %)
   · Defense / Status Damage don't change the card's numbers (the battle engine reads them: gradePct).
   The deck's buffs themselves are unchanged.
   Mutation bonus (game 2026-11-02): "Mutation bonus: +X% damage and max HP." in a support's text = the supported card
   (same column) gets +X% damage and max HP when the support is mutated (its slot's rarity above Normal) · X = the owner's
   table by the support's odds at the slot's rarity (C.mutAt · 2026-11-02) · every support has one (owner 2026-11-02).
   Rarity per slot (owner 2026-11-02): deck.cardRarity[i] / deck.supRarity[i] (a name · missing or unknown = deck.rarity,
   so decks and links from before still read the same) · the card's numbers use its slot's rarity, a support's value and
   its mutation bonus use the support slot's rarity.

   Where buffs come from (only the ones with no condition: a buff that starts on a hit / a turn / under X% HP doesn't change
   the starting numbers):
   ① Support (data/support.json effect.desc, value = C.supBuffAt at the support slot's rarity: effect.real when measured, else the shown value)
      "the supported card gets / deals {n}% more damage / max HP" -> the card in the same column (support i -> card i)
      "EVERY card in your deck …" -> every card · "every OTHER card in your deck …" -> every card but the one it supports
      A support for the whole deck (EVERY / every OTHER card · deckWide) counts once (owner 2026-11-02): the first copy
      (leftmost slot) gives its buff to the deck and its mutation bonus to its own column; a 2nd, 3rd … copy gives nothing
      at all (no buff, no mutation bonus · it used to give the card in its own column the buff again).
      A support for "the supported card" only still helps the card in its own column, every copy (mutation bonus too).
   ② Card abilities (data/cards.json passive / skill desc) · every copy of a card counts (owner 2026-11-02), never on itself
      "Every other card in your deck gets +X% damage[ and HP]" -> every other slot
      "With NAME in the deck, both get +X% …" -> itself and each NAME card (only when a NAME card is in another slot)
      "With NAME in the deck: +X% …" -> itself only · "With NAME in the deck, NAME gets +X% …" -> the NAME cards only
      "GROUP cards in your deck get +X% …" -> every card of the group (itself too)
   NAME / GROUP -> card ids: data/buffs.json (aliases / groups · null = not known yet: the buff is skipped, never an error)

   CBI.deckBuff = {
     compute(deck)
       -> [slot × 4: null | { id, rarity, base{atk,hp}, atkPct, hpPct (all in: deck × trait × grade · the buff pill),
            deckAtkPct, deckHpPct (deck buffs only), trait, fullGrade,
            grade: { atk, def, status, hp (% each), full } (gradePct), atk, hp (all in),
            from: [{ name, kind: "card"|"support"|"trait"|"grade", atk, hp (% in total), mA, mH (trait / grade: ×), n copies }] }]
     gradePct([atk, def, status, hp] 0–10) -> { atk, def, status, hp (% each), full } (also the Card Grader's "+x%" labels)
     rarityOf(deck, "cards"|"support", slot) -> the slot's rarity name (also used by js/deck.js, js/teamscore.js, js/share.js)
     wideFirst(supports[4]) -> [bool × 4]: false = a 2nd+ copy of a whole-deck support (gives nothing)
     supportRules(s), cardRules(c), deckWide(s), report()   (report = the table for the owner, also run by tools/deckbuff_report.js)
   }
   No DOM. Works in Node too (the report) with a stand-in CBI.
   ========================================================== */
(function (root) {
  const C = root.CBI;
  const SLOTS = 4;

  /* ---------- reading support texts ---------- */
  const STAT_RE = /\{(\d)\}% more (damage and max HP|max HP and damage|damage|max HP)(?! from)/g;
  // a piece that says when: the buff doesn't count
  const COND = /every time|every turn|each turn|every (?:other|\d+(?:st|nd|rd|th)) attack|\bfirst\b|\bunder \d|\bwhen\b|\bafter\b|\bonce\b|\bwhile\b|\bif\b|\brandom\b|\bup to \d+ times\b|\bchance\b|\bon hit\b/i;
  // a piece that only says when, for the pieces after it in the sentence ("from its 3rd attack on, it deals …")
  const PREFIX = /^(?:from|under|when|after|while|if|once|every time|the first time|at the start|each turn|every turn)\b/i;
  const PIECES = /,\s*|\s+and\s+(?=(?:it|the supported card|gets?|deals?|takes?|makes?|heals?|dodges?|has|counters?|can't)\b)|\s+and\s+(?=\{\d\})/i;
  const scopeOf = (t) => (/every other card in your deck/i.test(t) ? "others" : /every card in your deck/i.test(t) ? "all" : /the supported card|\bit\b/i.test(t) ? "slot" : null);
  const statsOf = (w) => (/damage and max HP|max HP and damage/i.test(w) ? ["dmg", "hp"] : /damage/i.test(w) ? ["dmg"] : ["hp"]);
  const descOf = (s) => String((s && s.effect && s.effect.desc) || "");
  const body = (d) => { const i = d.indexOf(": "); return i >= 0 && i < 90 ? d.slice(i + 2) : d; };   // the name / flavour before the colon goes

  const supCache = new WeakMap();
  // -> { rules: [{ scope: "slot"|"all"|"others", stat: "dmg"|"hp", i, text }], skipped: [{ stat, i, text }] }
  function supportRules(s) {
    if (!s || typeof s !== "object") return { rules: [], skipped: [] };
    if (supCache.has(s)) return supCache.get(s);
    const rules = [], skipped = [];
    body(descOf(s)).split(/(?<=\.)\s+/).forEach((sentence) => {
      let subj = "slot", when = false;
      sentence.split(PIECES).forEach((piece) => {
        const sc = scopeOf(piece);
        if (sc) subj = sc;
        const hits = [...piece.matchAll(STAT_RE)];
        if (!hits.length) { if (PREFIX.test(piece.trim())) when = true; return; }
        const cond = when || COND.test(piece);
        hits.forEach((m) => statsOf(m[2]).forEach((stat) => (cond ? skipped : rules).push({ scope: subj, stat, i: +m[1], text: piece.trim() })));
      });
    });
    const out = { rules, skipped };
    supCache.set(s, out);
    return out;
  }
  // a support whose effect reaches the whole deck (a second copy adds nothing · js/teamscore.js)
  // Mutation bonus at the support slot's rarity (owner's table from the game 2026-11-02 · C.mutAt in js/app.js: by the
  // support's odds at that rarity · every support · was the one number in the text, the rarity it was copied at) · 0 = Normal
  const mutOf = (s, rarity) => C.mutAt(s, rarity);
  const deckWide = (s) => /\bevery (?:other )?card in your deck\b|\bwhole deck\b/i.test(descOf(s));

  /* ---------- reading card abilities ---------- */
  const PCT = "\\+([\\d.]+)% (damage and HP|damage)";
  const CARD_RES = [
    [new RegExp(`^Every other card in your deck gets ${PCT}`, "i"), (m) => ({ to: "others", pct: +m[1], w: m[2] })],
    [new RegExp(`^With (.+?) in (?:the|your) deck, both get ${PCT}`, "i"), (m) => ({ to: "both", who: m[1], pct: +m[2], w: m[3] })],
    [new RegExp(`^With (.+?) in (?:the|your) deck: both ${PCT}`, "i"), (m) => ({ to: "both", who: m[1], pct: +m[2], w: m[3] })],
    [new RegExp(`^With (.+?) in (?:the|your) deck: ${PCT}`, "i"), (m) => ({ to: "self", who: m[1], pct: +m[2], w: m[3] })],
    [new RegExp(`^With (.+?) in (?:the|your) deck, (.+?) gets ${PCT}`, "i"), (m) => ({ to: "partner", who: m[1], pct: +m[3], w: m[4] })],
    [new RegExp(`^(.+?) cards in your deck get ${PCT}`, "i"), (m) => ({ to: "group", group: m[1], pct: +m[2], w: m[3] })],
  ];
  const cardCache = new WeakMap();
  function sentencesOf(c) {
    return ["passive", "skill"].flatMap((k) => {
      const d = String((c && c[k] && c[k].desc) || "");
      return d ? d.split(/(?<=\.)\s+/).map((x, i) => (i === 0 ? x.replace(/^[^.:]{1,40}:\s+/, "") : x).trim()) : [];
    });
  }
  // -> { rules: [{ to, who?, group?, dmg, hp, text }], other: [deck sentences not used] }
  function cardRules(c) {
    if (!c || typeof c !== "object") return { rules: [], other: [] };
    if (cardCache.has(c)) return cardCache.get(c);
    const rules = [], other = [];
    sentencesOf(c).forEach((t) => {
      for (const [re, make] of CARD_RES) {
        const m = re.exec(t);
        if (!m) continue;
        const r = make(m);
        rules.push({ ...r, dmg: r.pct, hp: /HP/.test(r.w) ? r.pct : 0, text: t });
        return;
      }
      if (/\bdeck\b/i.test(t) && !/enemy deck/i.test(t)) other.push(t);
    });
    const out = { rules, other };
    cardCache.set(c, out);
    return out;
  }

  /* ---------- names -> card ids (data/buffs.json) ---------- */
  const table = () => (C && C.state && C.state.buffs && typeof C.state.buffs === "object" ? C.state.buffs : {});
  const idsOf = (map, key) => { const v = map && typeof map === "object" ? map[key] : null; return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null; };
  const aliasIds = (name) => idsOf(table().aliases, name);
  const groupIds = (name) => idsOf(table().groups, name);
  const isOff = (id) => Array.isArray(table().off) && table().off.includes(id);

  const round = (n) => Math.round(n * 100) / 100;

  /* ---------- the deck ---------- */
  const known = (r) => typeof r === "string" && !!(C.state && C.state.meta && C.state.meta.rarities.some((x) => x.name === r));
  // a slot's rarity: its own (cardRarity / supRarity) · else the deck's (decks and links from before 2026-11-02) · else Normal
  function rarityOf(deck, kind, i) {
    const own = deck && (kind === "support" ? deck.supRarity : deck.cardRarity);
    if (Array.isArray(own) && known(own[i])) return own[i];
    return deck && known(deck.rarity) ? deck.rarity : "Normal";
  }
  // whole-deck supports count once: the first copy (leftmost) is true, later copies false · other supports always true
  function wideFirst(sat) {
    const seen = new Set();
    return sat.map((s) => {
      if (!s || !deckWide(s)) return true;
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }
  // Grade: 4 per card slot (0–10: Basic Attack, Defense, Status Damage, HP) · owner 2026-11-04 rule 2:
  // +2.5% a point on that stat only · all 4 at 10 = +30% more on every stat, added (10 = 25 + 30 = +55%)
  const GRADE_MAX = 10, GRADE_STEP = 2.5, GRADE_FULL = 30, GRADE_KEYS = ["atk", "def", "status", "hp"];
  const gradeNums = (g) => GRADE_KEYS.map((_, q) => Math.max(0, Math.min(GRADE_MAX, Math.round(Number(Array.isArray(g) ? g[q] : 0) || 0))));
  function gradePct(g) {
    const n = gradeNums(g), full = n.every((v) => v >= GRADE_MAX), o = { full };
    GRADE_KEYS.forEach((key, q) => { o[key] = round(n[q] * GRADE_STEP + (full ? GRADE_FULL : 0)); });
    return o;
  }
  const gradeAt = (deck, k) => gradePct(deck && Array.isArray(deck.grades) ? deck.grades[k] : null);
  const traitAt = (deck, k) => {
    const id = deck && Array.isArray(deck.trait) ? deck.trait[k] : null;
    return id ? (Array.isArray(C.state.traits) ? C.state.traits : []).find((t) => t.id === id) || null : null;
  };

  function compute(deck) {
    const st = C.state;
    const cardBy = new Map((st.cards || []).map((c) => [c.id, c])), supBy = new Map((Array.isArray(st.support) ? st.support : []).map((s) => [s.id, s]));
    const slot = (a) => { const o = []; for (let i = 0; i < SLOTS; i++) o.push(Array.isArray(a) && typeof a[i] === "string" && a[i] ? a[i] : null); return o; };
    const ids = slot(deck && deck.cards), sids = slot(deck && deck.support);
    const at = ids.map((id) => (id ? cardBy.get(id) || null : null)), sat = sids.map((id) => (id ? supBy.get(id) || null : null));
    const got = at.map(() => []);        // per slot: [{ key, name, kind, atk, hp }]
    const add = (k, src) => { if (at[k]) got[k].push(src); };

    // ① support · per target, each support id once · a whole-deck support: its first copy only (wideFirst)
    const supSeen = at.map(() => new Set());
    const first = wideFirst(sat);
    sat.forEach((s, j) => {
      if (!s || isOff(s.id) || !first[j]) return;
      const sr = rarityOf(deck, "support", j);
      supportRules(s).rules.forEach((r) => {
        const v = C.supBuffAt(s, r.i, sr);
        if (!(v > 0)) return;
        for (let k = 0; k < SLOTS; k++) {
          if (r.scope === "slot" ? k !== j : r.scope === "others" ? k === j : false) continue;
          const key = s.id + "|" + r.stat + "|" + r.i;
          if (supSeen[k].has(key)) continue;
          supSeen[k].add(key);
          add(k, { key: "s:" + s.id, copy: s.id, name: s.name, kind: "support", atk: r.stat === "dmg" ? v : 0, hp: r.stat === "hp" ? v : 0 });
        }
      });
      // mutation bonus: the supported card only, when the support is mutated (its slot above Normal)
      const mb = mutOf(s, sr);
      if (mb > 0) add(j, { key: "m:" + s.id, copy: s.id, name: s.name + " · Mutation", kind: "support", atk: mb, hp: mb });
    });
    // ② card abilities · every copy counts, never on itself
    at.forEach((c, j) => {
      if (!c || isOff(c.id)) return;
      cardRules(c).rules.forEach((r) => {
        const src = { key: "c:" + c.id, copy: j, name: c.name, kind: "card", atk: r.dmg, hp: r.hp };
        if (r.to === "others") { for (let k = 0; k < SLOTS; k++) if (k !== j) add(k, src); return; }
        if (r.to === "group") {
          const g = groupIds(r.group);
          if (g) for (let k = 0; k < SLOTS; k++) if (at[k] && g.includes(at[k].id)) add(k, src);
          return;
        }
        const pal = aliasIds(r.who);
        if (!pal) return;                                   // name not in data/buffs.json yet: skipped
        const mates = []; for (let k = 0; k < SLOTS; k++) if (k !== j && at[k] && pal.includes(at[k].id)) mates.push(k);
        if (!mates.length) return;
        if (r.to === "both" || r.to === "self") add(j, src);
        if (r.to === "both" || r.to === "partner") mates.forEach((k) => add(k, src));
      });
    });

    return at.map((c, k) => {
      if (!c || !c.base) return null;
      const rarity = rarityOf(deck, "cards", k);
      const base = { atk: C.statAt(c, "atk", rarity), hp: C.statAt(c, "hp", rarity) };
      // every buff multiplies: total % = (Π(1 + p/100) − 1) × 100
      const mul = (key) => got[k].reduce((a, x) => a * (1 + x[key] / 100), 1);
      const mA = mul("atk"), mH = mul("hp");
      const deckAtkPct = round((mA - 1) * 100), deckHpPct = round((mH - 1) * 100);
      // one line per source: its ATK and HP together, every copy multiplied (King of Conquerors ×3 = 1.15³ = +52.09%, n = 3)
      const from = [];
      got[k].forEach((x) => {
        let f = from.find((y) => y.key === x.key);
        if (!f) from.push(f = { key: x.key, name: x.name, kind: x.kind, atk: 0, hp: 0, copies: new Set() });
        f.atk = round(((1 + f.atk / 100) * (1 + x.atk / 100) - 1) * 100); f.hp = round(((1 + f.hp / 100) * (1 + x.hp / 100) - 1) * 100); f.copies.add(x.copy);
      });
      from.forEach((f) => { f.n = f.copies.size; delete f.copies; });
      // then the slot's trait and grade multiply (shown as ×N rows in the buff list)
      const t = traitAt(deck, k), gp = gradeAt(deck, k), gA = 1 + gp.atk / 100, gH = 1 + gp.hp / 100;
      const tA = t && t.dmg > 0 ? t.dmg : 1, tH = t && t.hp > 0 ? t.hp : 1;
      if (t && (tA !== 1 || tH !== 1)) from.push({ key: "t:" + t.id, name: t.name, kind: "trait", atk: round((tA - 1) * 100), hp: round((tH - 1) * 100), mA: tA, mH: tH, n: 1 });
      // grade row: Basic Attack -> ATK, HP -> HP (+2.5% a point · +30% more when all 4 are 10) · 0 / 0 = no row
      if (gp.atk || gp.hp) from.push({ key: "g", name: gp.full ? "Grade 10 MINT (all 4)" : "Grade", kind: "grade", atk: gp.atk, hp: gp.hp, mA: round(gA * 1e4) / 1e4, mH: round(gH * 1e4) / 1e4, n: 1 });
      // atkPct / hpPct = everything in (deck × trait × grade) = the buff pill under the card (owner 2026-11-04: grade shows there too)
      return {
        id: c.id, rarity, base, deckAtkPct, deckHpPct,
        atkPct: round((mA * tA * gA - 1) * 100), hpPct: round((mH * tH * gH - 1) * 100),
        trait: t ? t.id : null, fullGrade: gp.full, grade: gp,
        atk: Math.round(base.atk * mA * tA * gA),
        hp: Math.round(base.hp * mH * tH * gH),
        from,
      };
    });
  }

  /* ---------- the owner's check list (tools/deckbuff_report.js prints it) ---------- */
  function report() {
    const st = C.state, rows = { support: [], cards: [], missing: [] };
    (Array.isArray(st.support) ? st.support : []).forEach((s) => {
      const p = supportRules(s);
      rows.support.push({ id: s.id, name: s.name, counted: p.rules.map((r) => `${r.stat === "dmg" ? "DMG" : "HP"} {${r.i}} → ${r.scope}`), skipped: p.skipped.map((r) => `${r.stat === "dmg" ? "DMG" : "HP"} {${r.i}}: ${r.text}`) });
    });
    (st.cards || []).forEach((c) => {
      const p = cardRules(c);
      if (!p.rules.length && !p.other.length) return;
      rows.cards.push({ id: c.id, name: c.name, rules: p.rules.map((r) => {
        const known = r.group ? !!groupIds(r.group) : r.who ? !!aliasIds(r.who) : true;
        return `${r.to}${r.who ? " " + r.who : r.group ? " " + r.group : ""} +${r.dmg}% DMG${r.hp ? ` +${r.hp}% HP` : ""}${known ? "" : " (no table yet)"}`;
      }), other: p.other });
      p.rules.forEach((r) => { if ((r.who && !aliasIds(r.who)) || (r.group && !groupIds(r.group))) rows.missing.push(`${r.who || r.group} (${c.id})`); });
    });
    return rows;
  }

  root.CBI = root.CBI || {};
  root.CBI.deckBuff = { compute, rarityOf, wideFirst, supportRules, cardRules, deckWide, mutOf, report, gradePct, SLOTS, GRADE_MAX, GRADE_STEP, GRADE_FULL };
})(typeof window !== "undefined" ? window : globalThis);
