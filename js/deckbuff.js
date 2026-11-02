/* ==========================================================
   Card Battle Infinity — Deck buffs (owner 2026-11-02 · PROGRESS §3.3 `deckbuff.js`)
   The ATK / HP a card shows in a deck once the deck's buffs are in:
     ATK = base × Π(1 + %damage ÷ 100) × trait damage · HP = base × Π(1 + %HP ÷ 100) × trait HP
   base = C.statAt(card, key, deck rarity) · every buff MULTIPLIES (checked 2026-11-02 on the owner's battle screenshot:
   King of Conquerors Godly 10.89M → 20.3M / 26.3M / 21.6M only fits multiplying) · the trait multiplier
   (data/traits.json dmg / hp) is on top (owner 2026-11-02: the numbers include the trait).
   Mutation bonus (game 2026-11-02): "Mutation bonus: +X% damage and max HP." in a support's text = the supported card
   (same column) gets +X% damage and max HP when the support is mutated (deck rarity above Normal).

   Where buffs come from (only the ones with no condition: a buff that starts on a hit / a turn / under X% HP doesn't change
   the starting numbers):
   ① Support (data/support.json effect.desc, value = C.supValAt at the deck's rarity)
      "the supported card gets / deals {n}% more damage / max HP" -> the card in the same column (support i -> card i)
      "EVERY card in your deck …" -> every card · "every OTHER card in your deck …" -> every card but the one it supports
      The same support in 2 slots does not stack on one card (owner 2026-11-02): a card gets each support's buff once.
   ② Card abilities (data/cards.json passive / skill desc) · every copy of a card counts (owner 2026-11-02), never on itself
      "Every other card in your deck gets +X% damage[ and HP]" -> every other slot
      "With NAME in the deck, both get +X% …" -> itself and each NAME card (only when a NAME card is in another slot)
      "With NAME in the deck: +X% …" -> itself only · "With NAME in the deck, NAME gets +X% …" -> the NAME cards only
      "GROUP cards in your deck get +X% …" -> every card of the group (itself too)
   NAME / GROUP -> card ids: data/buffs.json (aliases / groups · null = not known yet: the buff is skipped, never an error)

   CBI.deckBuff = {
     compute(deck, { traitOf(cardId, slot) -> trait id | null }) -> [slot × 4: null | { id, base{atk,hp}, atkPct, hpPct,
       trait, atk, hp, from: [{ name, kind: "card"|"support"|"trait", atk, hp (% in total · trait: ×), n copies }] }]
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
  // "Mutation bonus: +40% damage and max HP." -> 40 (0 = none)
  const MUT_RE = /Mutation bonus: \+([\d.]+)% damage and max HP/i;
  const mutOf = (s) => { const m = MUT_RE.exec(descOf(s)); return m ? +m[1] : 0; };
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
  function compute(deck, { traitOf } = {}) {
    const st = C.state, rarity = deck && st.meta && st.meta.rarities.some((r) => r.name === deck.rarity) ? deck.rarity : "Normal";
    const cardBy = new Map((st.cards || []).map((c) => [c.id, c])), supBy = new Map((Array.isArray(st.support) ? st.support : []).map((s) => [s.id, s]));
    const slot = (a) => { const o = []; for (let i = 0; i < SLOTS; i++) o.push(Array.isArray(a) && typeof a[i] === "string" && a[i] ? a[i] : null); return o; };
    const ids = slot(deck && deck.cards), sids = slot(deck && deck.support);
    const at = ids.map((id) => (id ? cardBy.get(id) || null : null)), sat = sids.map((id) => (id ? supBy.get(id) || null : null));
    const got = at.map(() => []);        // per slot: [{ key, name, kind, atk, hp }]
    const add = (k, src) => { if (at[k]) got[k].push(src); };

    // ① support · per target, each support id once
    const supSeen = at.map(() => new Set());
    sat.forEach((s, j) => {
      if (!s || isOff(s.id)) return;
      supportRules(s).rules.forEach((r) => {
        const v = C.supValAt(s, r.i, rarity);
        if (!(v > 0)) return;
        for (let k = 0; k < SLOTS; k++) {
          if (r.scope === "slot" ? k !== j : r.scope === "others" ? k === j : false) continue;
          const key = s.id + "|" + r.stat + "|" + r.i;
          if (supSeen[k].has(key)) continue;
          supSeen[k].add(key);
          add(k, { key: "s:" + s.id, copy: s.id, name: s.name, kind: "support", atk: r.stat === "dmg" ? v : 0, hp: r.stat === "hp" ? v : 0 });
        }
      });
      // mutation bonus: the supported card only, when the support is mutated
      const mb = rarity !== "Normal" ? mutOf(s) : 0;
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
      const base = { atk: C.statAt(c, "atk", rarity), hp: C.statAt(c, "hp", rarity) };
      // every buff multiplies: total % = (Π(1 + p/100) − 1) × 100
      const mul = (key) => got[k].reduce((a, x) => a * (1 + x[key] / 100), 1);
      const mA = mul("atk"), mH = mul("hp");
      const atkPct = round((mA - 1) * 100), hpPct = round((mH - 1) * 100);
      const tid = traitOf ? traitOf(c.id, k) : null;
      const trait = tid && C.traits && C.traits.byId ? C.traits.byId(tid) : null;
      const tD = trait && trait.dmg > 0 ? trait.dmg : 1, tH = trait && trait.hp > 0 ? trait.hp : 1;
      // one line per source: its ATK and HP together, every copy multiplied (King of Conquerors ×3 = 1.15³ = +52.09%, n = 3)
      const from = [];
      got[k].forEach((x) => {
        let f = from.find((y) => y.key === x.key);
        if (!f) from.push(f = { key: x.key, name: x.name, kind: x.kind, atk: 0, hp: 0, copies: new Set() });
        f.atk = round(((1 + f.atk / 100) * (1 + x.atk / 100) - 1) * 100); f.hp = round(((1 + f.hp / 100) * (1 + x.hp / 100) - 1) * 100); f.copies.add(x.copy);
      });
      from.forEach((f) => { f.n = f.copies.size; delete f.copies; });
      if (trait && (tD !== 1 || tH !== 1)) from.push({ key: "t:" + trait.id, name: trait.name, kind: "trait", atk: tD, hp: tH, n: 1, tier: trait.tier });
      return {
        id: c.id, base, atkPct, hpPct, trait,
        atk: Math.round(base.atk * mA * tD),
        hp: Math.round(base.hp * mH * tH),
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
  root.CBI.deckBuff = { compute, supportRules, cardRules, deckWide, mutOf, report, SLOTS };
})(typeof window !== "undefined" ? window : globalThis);
