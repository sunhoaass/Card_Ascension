/* ==========================================================
   Card Battle Infinity — Team score (step 11)
   A formula that runs in the browser (no AI, no server). It only reads what Claude already wrote into data/*.json,
   so the score changes the moment a card is swapped. The full formula is written down in PROGRESS.md §10.5.

   CBI.teamScore = {
     score(deck, modeId?)       -> { score 1–100 | null, raw, band, label, parts[5], notes[], members, mode }
     analyze(deck)              -> { strong{tags,cards,teams}, weak{tags,cards}, modes[], data{} }
     suggest(deck, kind, n = 3) -> [{ id, slot, gain, before, after }]   kind = "cards" | "support"
     band(score), modeConfig(id), PARTS
   }
   deck = { mode, rarity?, cards: [5 ids | null], support: [5 ids | null], traits?: { "<card id>": "<trait id>" } } (the shape of cbi:decks;
          traits = the user's trait per card from js/traits.js, added by js/deck.js for the user's own decks only)

   The 5 parts (weights per mode from data/meta.json -> modes[].weights; default 30 / 25 / 20 / 15 / 10):
     power     card Overall (unranked = from ATK × HP) + its trait bonus vs the best 5 cards in the library (no traits)
               · support Value (unranked = from its effect value at the deck's rarity) vs the best support
     synergy   cards with a partner from team.bestWith · support that fits the card above it · minus avoidWith clashes
     coverage  share of Meta cards (Meta/SS) the team beats (beats) · minus every weakTo tag shared by 3+ cards
     roles     the roles the mode asks for (modes[].roles, default Tank 1 · DPS 2; Hybrid fills any one)
     position  each card in the slot from its team.position
   An empty slot gives 0. A part with no data in the whole library yet scores half of what is filled
   ("Not enough data yet"), so missing data never breaks the page and never reaches 100.
   100 ("Perfect") only when every part is full; everything else is rounded down (max 99).
   Needs js/app.js (CBI.state, CBI.isRanked). No DOM.
   ========================================================== */
(function () {
  const C = window.CBI;
  const SLOTS = 5;
  const UNRANKED = 50;                                   // pads the "strongest team" when the library has fewer than 5 cards (§10.5)
  const PARTS = [
    { key: "power", name: "Card power" },
    { key: "synergy", name: "Synergy" },
    { key: "coverage", name: "Coverage" },
    { key: "roles", name: "Roles" },
    { key: "position", name: "Position" },
  ];
  const DEFAULT_WEIGHTS = { power: 30, synergy: 25, coverage: 20, roles: 15, position: 10 };
  const DEFAULT_ROLES = { Tank: 1, DPS: 2 };
  const DEFAULT_MODES = [
    { id: "tower", name: "Ascended Tower", enabled: true },
    { id: "pvp", name: "PvP", enabled: true },
    { id: "story", name: "Story", enabled: true },
    { id: "boss", name: "Boss", enabled: false },
  ];
  // the knobs (PROGRESS.md §10.5 lists them; change here and there together)
  const K = {
    powerCards: 0.8, powerSupport: 0.2,   // card power: the 5 cards / the 5 support
    synPairs: 0.6, synSupport: 0.4,       // synergy: card pairs / support fit
    avoid: 0.2,                           // synergy lost per support + card pair in avoidWith
    supOther: 0.5,                        // a support that fits another card in the deck (not the one above it)
    weakMin: 3, weakHit: 0.25,            // coverage lost per weakTo tag shared by 3+ cards
    strongMin: 2,                         // "Strong vs": beaten by 2+ cards
    rolesNeed: 0.8, rolesAny: 0.2,        // roles: the mode's needs / every card has a role
    posNear: 0.5,                         // position: one slot away from its best slot
    traitPts: 20,                         // card power: the strongest trait (Ascendant) adds this many points to a card's value
    threatTiers: ["Meta", "SS"],         // Meta cards (owner 2026-10-24: tier Meta (was GOD) + SS)
    unrMin: 10, unrMax: 60,               // an unranked card / support is worth unrMin … unrMax (2026-10-28 · PROGRESS §10.5)
    unrSupNoData: 0.5,                    // unranked support with no effect value (or no other support of its type): this share of the level's range
  };
  const BANDS = [
    { min: 100, band: "perfect", label: "Perfect" },
    { min: 80, band: "good", label: "Strong" },
    { min: 50, band: "mid", label: "Decent" },
    { min: 0, band: "bad", label: "Needs work" },
  ];
  const EPS = 1e-9;

  /* ---------- small helpers ---------- */
  const list = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && x) : typeof a === "string" && a ? [a] : []);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const pretty = (s) => String(s).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const fmt = (n) => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const isRankedSup = (s) => !!(s && s.scores && s.scores.value > 0 && s.tier);
  const tagKey = (t) => String(t).trim().toLowerCase();

  /* ---------- modes (data/meta.json -> modes, else the defaults; every mode uses the same weights until §8 is answered) ---------- */
  function modeList() {
    const m = C.state.meta && Array.isArray(C.state.meta.modes) ? C.state.meta.modes : [];
    return DEFAULT_MODES.map((d) => {
      const x = m.find((y) => y && y.id === d.id);
      return x ? { ...d, name: typeof x.name === "string" && x.name ? x.name : d.name, enabled: typeof x.enabled === "boolean" ? x.enabled : d.enabled } : d;
    });
  }
  function modeConfig(id) {
    const m = C.state.meta && Array.isArray(C.state.meta.modes) ? C.state.meta.modes.find((y) => y && y.id === id) : null;
    // weights: any non-negative numbers, scaled so they add up to 100
    const w = {};
    let sum = 0;
    PARTS.forEach(({ key }) => {
      const v = m && m.weights ? num(m.weights[key]) : null;
      w[key] = v != null && v >= 0 ? v : DEFAULT_WEIGHTS[key];
      sum += w[key];
    });
    if (sum <= 0) Object.assign(w, DEFAULT_WEIGHTS), (sum = 100);
    PARTS.forEach(({ key }) => { w[key] = (w[key] / sum) * 100; });
    // roles: { "Tank": 1, "DPS": 2 } (whole numbers 0–5)
    let roles = DEFAULT_ROLES;
    if (m && m.roles && typeof m.roles === "object" && !Array.isArray(m.roles)) {
      roles = {};
      Object.keys(m.roles).forEach((r) => { const n = num(m.roles[r]); if (r && n != null && n > 0) roles[r] = Math.min(SLOTS, Math.floor(n)); });
    }
    return { id, weights: w, roles };
  }

  /* ---------- the library, read once (rebuilt only when the data arrays change) ---------- */
  let L = null;
  function lib() {
    const s = C.state;
    if (L && L.cardsSrc === s.cards && L.supSrc === s.support && L.teamsSrc === s.teams) return L;
    const cards = (Array.isArray(s.cards) ? s.cards : []).filter((c) => c && c.id);
    const sups = (Array.isArray(s.support) ? s.support : []).filter((x) => x && x.id);
    const team = (c) => (c.team && typeof c.team === "object" ? c.team : {});
    const has = {
      pairs: cards.some((c) => list(team(c).bestWith).length),
      supFit: cards.some((c) => list(team(c).bestSupport).length) || sups.some((x) => list(x.bestWith).length),
      beats: cards.some((c) => list(c.beats).length),
      weakTo: cards.some((c) => list(c.weakTo).length),
      tags: cards.some((c) => list(c.tags).length),
      roles: cards.some((c) => roleOf(c)),
      position: cards.some((c) => posRange(c)),
    };
    const ov = (c) => (C.isRanked(c) ? c.scores.overall : 0);
    // unranked cards (outside meta.rankTop): percentile of √(ATK × HP) at Normal among every card in the library
    const pow = (c) => { const b = c.base || {}; const a = Number(b.atk), h = Number(b.hp); return a > 0 && h > 0 ? Math.sqrt(a * h) : 0; };
    const pows = cards.map(pow).sort((a, b) => a - b);
    const unrCard = new Map();
    cards.forEach((c) => {
      if (C.isRanked(c)) return;
      const p = pow(c);
      let lo = 0, hi = pows.length;                        // how many cards have power ≤ this one
      while (lo < hi) { const m = (lo + hi) >> 1; if (pows[m] <= p) lo = m + 1; else hi = m; }
      unrCard.set(c.id, K.unrMin + (K.unrMax - K.unrMin) * (p > 0 ? lo / pows.length : 0));
    });
    // unranked support: the strongest Godly value of each effect type (support.effect.type), for the ratio in supUnr()
    const supTop = new Map();
    sups.forEach((x) => { const t = supType(x), v = C.supValue(x, "Godly"); if (t && v > 0) supTop.set(t, Math.max(supTop.get(t) || 0, v)); });
    const threats = cards.filter((c) => C.isRanked(c) && K.threatTiers.includes(c.tier)).sort((a, b) => ov(b) - ov(a) || a.name.localeCompare(b.name));
    const byTag = new Map();                               // tag -> card ids that have it
    cards.forEach((c) => list(c.tags).forEach((t) => { const k = tagKey(t); if (!byTag.has(k)) byTag.set(k, { name: t, ids: new Set() }); byTag.get(k).ids.add(c.id); }));
    L = {
      cardsSrc: s.cards, supSrc: s.support, teamsSrc: s.teams,
      cards, sups, has, threats, byTag, unrCard, supTop,
      cardById: new Map(cards.map((c) => [c.id, c])),
      supById: new Map(sups.map((x) => [x.id, x])),
      teams: (Array.isArray(s.teams) ? s.teams : []).filter((t) => t && Array.isArray(t.slots)),
      best: new Map(),                                     // "mode|rarity" -> { card, sup }
    };
    return L;
  }
  const teamOf = (c) => (c && c.team && typeof c.team === "object" ? c.team : {});
  function roleOf(c) {
    const r = typeof c.role === "string" ? c.role.trim() : "";
    return r && !r.includes("|") ? r : "";                 // "DPS | Tank | ..." is the schema placeholder, not a role
  }
  function posRange(c) {
    const p = teamOf(c).position;
    if (typeof p === "number" && p >= 1 && p <= SLOTS) return [p, p];
    const m = typeof p === "string" ? p.match(/^\s*([1-5])\s*(?:[-–—]\s*([1-5]))?\s*$/) : null;
    if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a;
    return [Math.min(a, b), Math.max(a, b)];
  }
  const supType = (s) => (s && s.effect && typeof s.effect === "object" && typeof s.effect.type === "string" ? s.effect.type.trim().toLowerCase() : "");
  // unranked support at a rarity: unrMin + range × (its value ÷ the strongest Godly value of the same effect type)
  // (no value / no type: unrSupNoData × the level's share, level share = (1 + 0.25 L) ÷ 3, Godly = 1)
  function supUnr(s, rarity) {
    const l = lib(), t = supType(s), v = C.supValue(s, rarity), top = t ? l.supTop.get(t) : 0;
    const r = v > 0 && top > 0 ? clamp01(v / top) : K.unrSupNoData * C.supLevelMult(rarity) / C.supLevelMult("Godly");
    return K.unrMin + (K.unrMax - K.unrMin) * r;
  }
  // a card's worth in a mode: Overall (unranked = from ATK × HP, §10.5), averaged with modes[mode] when the card has one
  function cardVal(c, mode) {
    const ov = C.isRanked(c) ? c.scores.overall : (lib().unrCard.get(c.id) ?? K.unrMin);
    const mv = c.modes && typeof c.modes === "object" ? num(c.modes[mode]) : null;
    return mv == null ? ov : (ov + clamp01(mv / 100) * 100) / 2;
  }
  function supVal(s, mode, rarity) {
    const v = isRankedSup(s) ? s.scores.value : supUnr(s, rarity);
    const mv = s.modes && typeof s.modes === "object" ? num(s.modes[mode]) : null;
    return mv == null ? v : (v + clamp01(mv / 100) * 100) / 2;
  }
  // trait bonus (PROGRESS §10.5): K.traitPts × power of the card's trait (0 no trait … 1 Ascendant), capped at 100
  const traitOf = (deck, c) => (deck && deck.traits && typeof deck.traits === "object" && typeof deck.traits[c.id] === "string" ? deck.traits[c.id] : null);
  const traitBonus = (deck, c) => { const id = traitOf(deck, c); return id && C.traits && C.traits.power ? K.traitPts * C.traits.power(id) : 0; };
  const cardValT = (deck, c, mode) => Math.min(100, cardVal(c, mode) + traitBonus(deck, c));
  // the best possible deck in this mode at this rarity: the 5 best cards, ranked or not (fewer than 5 cards = the rest count as 50),
  // and the best support in every slot (support may repeat)
  function bestOf(mode, rarity) {
    const l = lib(), key = mode + "|" + rarity;
    if (l.best.has(key)) return l.best.get(key);
    const cv = l.cards.map((c) => cardVal(c, mode)).sort((a, b) => b - a).slice(0, SLOTS);
    while (cv.length < SLOTS) cv.push(UNRANKED);
    const sv = l.sups.map((s) => supVal(s, mode, rarity));
    const b = { card: Math.max(1, cv.reduce((a, v) => a + v, 0) / SLOTS), sup: Math.max(1, sv.length ? Math.max(...sv) : 100) };
    l.best.set(key, b);
    return b;
  }
  const rarityOfDeck = (deck) => {
    const r = (deck && deck.rarity) || C.state.rarity;
    return C.state.meta && C.state.meta.rarities.some((x) => x.name === r) ? r : "Normal";
  };

  /* ==========================================================
     score(deck, modeId)
     ========================================================== */
  function band(score) {
    if (!Number.isFinite(score)) return { band: "none", label: "" };
    return BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];
  }

  function score(deck, modeId) {
    const l = lib();
    const mode = modeId || (deck && deck.mode) || "tower";
    const cfg = modeConfig(mode);
    const rarity = rarityOfDeck(deck);
    const cards = slots(deck && deck.cards), sups = slots(deck && deck.support);
    const at = cards.map((id) => (id ? l.cardById.get(id) || null : null));      // card per slot (null = empty or not in the library)
    const sat = sups.map((id) => (id ? l.supById.get(id) || null : null));
    const members = at.filter(Boolean);
    const nCards = members.length, nSup = sat.filter(Boolean).length;
    const missing = cards.filter((id, i) => id && !at[i]).length + sups.filter((id, i) => id && !sat[i]).length;
    const unranked = members.filter((c) => !C.isRanked(c)).length + sat.filter((s) => s && !isRankedSup(s)).length;
    const fill = nCards / SLOTS;
    const parts = {};

    /* Card power */
    {
      const b = bestOf(mode, rarity);
      const cAvg = at.reduce((a, c) => a + (c ? cardValT(deck, c, mode) : 0), 0) / SLOTS;
      const sAvg = sat.reduce((a, s) => a + (s ? supVal(s, mode, rarity) : 0), 0) / SLOTS;
      const cr = clamp01(cAvg / b.card), sr = clamp01(sAvg / b.sup);
      const v = l.sups.length ? K.powerCards * cr + K.powerSupport * sr : cr;
      const avgOv = nCards ? members.reduce((a, c) => a + cardValT(deck, c, mode), 0) / nCards : 0;
      const tb = members.reduce((a, c) => a + cardValT(deck, c, mode) - cardVal(c, mode), 0), nTr = members.filter((c) => traitBonus(deck, c) > 0).length;
      parts.power = {
        v, noData: false, traits: nTr, traitPts: tb,
        note: nCards || nSup
          ? `Cards ${Math.round(cr * 100)}% of the strongest team${nCards ? ` (avg ${fmt(avgOv)})` : ""}${nTr ? ` · ${nTr} with a trait (+${fmt(tb / nCards)} avg)` : ""}${l.sups.length ? ` · support ${Math.round(sr * 100)}%` : ""}`
          : "Add cards to build power",
      };
    }

    /* Synergy */
    {
      let pairs = 0;
      const linked = new Set();
      for (let i = 0; i < SLOTS; i++) for (let j = i + 1; j < SLOTS; j++) {
        const a = at[i], b = at[j];
        if (!a || !b) continue;
        if (list(teamOf(a).bestWith).includes(b.id) || list(teamOf(b).bestWith).includes(a.id)) { pairs++; linked.add(i); linked.add(j); }
      }
      const pairV = l.has.pairs ? linked.size / SLOTS : 0.5 * fill;
      const fits = (s, c) => list(teamOf(c).bestSupport).includes(s.id) || list(s.bestWith).includes(c.id);
      let supSum = 0, supFull = 0, avoid = 0;
      sat.forEach((s, i) => {
        if (!s) return;
        if (at[i] && fits(s, at[i])) { supSum += 1; supFull++; }
        else if (members.some((c) => fits(s, c))) supSum += K.supOther;
        const bad = list(s.avoidWith);
        avoid += members.filter((c) => bad.includes(c.id)).length;
      });
      const supV = l.has.supFit ? supSum / SLOTS : 0.5 * (nSup / SLOTS);
      const v = clamp01((l.sups.length ? K.synPairs * pairV + K.synSupport * supV : pairV) - K.avoid * avoid);
      const bits = [];
      bits.push(l.has.pairs ? `${linked.size}/${SLOTS} cards have a partner` : "card pairs: not enough data");
      if (l.sups.length) bits.push(l.has.supFit ? `${supFull}/${SLOTS} support fit their card` : "support fit: not enough data");
      if (avoid) bits.push(`${avoid} support clash${avoid === 1 ? "" : "es"}`);
      const supOk = l.has.supFit;
      const noData = l.sups.length ? !l.has.pairs && !supOk : !l.has.pairs;
      const partial = !noData && !!l.sups.length && l.has.pairs !== supOk;
      parts.synergy = { v, noData, partial, note: bits.join(" · "), pairs, avoid };
    }

    /* Coverage */
    {
      const beaten = new Set();
      members.forEach((c) => list(c.beats).forEach((id) => beaten.add(id)));
      const canCover = l.has.beats && l.threats.length > 0;
      const covered = canCover ? l.threats.filter((t) => beaten.has(t.id)).length : 0;
      let v = canCover ? covered / l.threats.length : 0.5 * fill;
      const weak = weakTags(members);
      v = clamp01(v - K.weakHit * weak.length);
      const bits = [canCover ? `Beats ${covered} of ${l.threats.length} Meta cards` : l.has.beats ? "no Meta (Meta/SS) cards in the library yet" : "who beats whom: not enough data"];
      if (weak.length) bits.push(`${weak[0].count} cards weak to ${weak[0].name}${weak.length > 1 ? ` (+${weak.length - 1} more)` : ""}`);
      parts.coverage = { v, noData: !canCover, note: bits.join(" · "), covered, weak };
    }

    /* Roles */
    {
      const need = cfg.roles, total = Object.values(need).reduce((a, n) => a + n, 0);
      const count = {};
      let hybrid = 0, withRole = 0;
      members.forEach((c) => {
        const r = roleOf(c);
        if (!r) return;
        withRole++;
        const k = Object.keys(need).find((x) => x.toLowerCase() === r.toLowerCase());
        if (k) count[k] = (count[k] || 0) + 1;
        else if (r.toLowerCase() === "hybrid") hybrid++;
      });
      let met = 0;
      Object.keys(need).forEach((k) => { met += Math.min(need[k], count[k] || 0); });
      met += Math.min(hybrid, total - met);                // a Hybrid fills any one missing role
      const needV = total ? met / total : withRole / SLOTS;
      const v = l.has.roles ? K.rolesNeed * needV + K.rolesAny * (withRole / SLOTS) : 0.5 * fill;
      const note = l.has.roles
        ? (total ? Object.keys(need).map((k) => `${k} ${Math.min(need[k], count[k] || 0)}/${need[k]}`).join(" · ") + (hybrid ? ` · Hybrid ${hybrid}` : "") : `${withRole}/${SLOTS} cards have a role`)
        : "card roles: not enough data";
      parts.roles = { v, noData: !l.has.roles, note, need };
    }

    /* Position */
    {
      let sum = 0, right = 0;
      at.forEach((c, i) => {
        if (!c) return;
        const r = posRange(c);
        if (!r) { sum += 0.5; return; }
        const p = i + 1, d = p < r[0] ? r[0] - p : p > r[1] ? p - r[1] : 0;
        if (d === 0) { sum += 1; right++; } else if (d === 1) sum += K.posNear;
      });
      const v = l.has.position ? sum / SLOTS : 0.5 * fill;
      parts.position = { v, noData: !l.has.position, note: l.has.position ? `${right}/${SLOTS} cards in their best slot` : "best slots: not enough data" };
    }

    /* Total: weights of this mode, rounded down; 100 only when every part is full */
    let raw = 0;
    const out = PARTS.map(({ key, name }) => {
      const p = parts[key];
      const max = cfg.weights[key];
      const pts = max * p.v;
      raw += pts;
      return { key, name, max, pts, v: p.v, noData: p.noData, partial: !!p.partial, note: p.note };
    });
    const empty = nCards + nSup === 0;
    const full = out.every((p) => p.v >= 1 - EPS);
    const sc = empty ? null : full ? 100 : Math.max(1, Math.min(99, Math.floor(raw + EPS)));
    const notes = [];
    if (unranked) notes.push(`${unranked} unranked ${unranked === 1 ? "pick is" : "picks are"} scored from ${unranked === 1 ? "its" : "their"} stats (cards: ATK and HP · support: effect at ${rarity}).`);
    if (missing) notes.push(`${missing} ${missing === 1 ? "card isn't" : "cards aren't"} in the library yet, so ${missing === 1 ? "it doesn't" : "they don't"} count.`);
    if (out.some((p) => p.noData || p.partial)) notes.push("Parts marked “Not enough data yet” score half until the cards are analysed.");
    const b = band(sc);
    return { score: sc, raw, band: b.band, label: b.label, parts: out, notes, empty, mode, rarity, nCards, nSup, unranked, missing };
  }
  function slots(a) {
    const out = [];
    for (let i = 0; i < SLOTS; i++) out.push(Array.isArray(a) && typeof a[i] === "string" && a[i] ? a[i] : null);
    return out;
  }
  function weakTags(members) {
    const cnt = new Map();
    members.forEach((c) => new Set(list(c.weakTo).map(tagKey)).forEach((k) => cnt.set(k, (cnt.get(k) || 0) + 1)));
    const name = (k) => { const t = lib().byTag.get(k); if (t) return t.name; const m = members.flatMap((c) => list(c.weakTo)).find((x) => tagKey(x) === k); return m || k; };
    return [...cnt].filter(([, n]) => n >= K.weakMin).map(([k, n]) => ({ key: k, name: pretty(name(k)), count: n })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  /* ==========================================================
     analyze(deck): Strong vs / Weak vs / Fits modes (made from the data, nothing written by hand)
     ========================================================== */
  function analyze(deck) {
    const l = lib();
    const at = slots(deck && deck.cards).map((id) => (id ? l.cardById.get(id) || null : null));
    const members = at.filter(Boolean);
    const inDeck = new Set(members.map((c) => c.id));
    const ov = (c) => (C.isRanked(c) ? c.scores.overall : 0);

    // Strong vs: cards / tags / meta teams that 2+ of our cards beat
    const beatCount = new Map();
    members.forEach((c) => new Set(list(c.beats)).forEach((id) => beatCount.set(id, (beatCount.get(id) || 0) + 1)));
    const strongCards = [...beatCount].filter(([id, n]) => n >= K.strongMin && l.cardById.has(id))
      .map(([id, n]) => ({ id, name: l.cardById.get(id).name, tier: C.isRanked(l.cardById.get(id)) ? l.cardById.get(id).tier : "", count: n }))
      .sort((a, b) => b.count - a.count || ov(l.cardById.get(b.id)) - ov(l.cardById.get(a.id)) || a.name.localeCompare(b.name));
    const tagHits = new Map();                             // tag -> how many of our cards beat at least one card with it
    members.forEach((c) => {
      const tags = new Set();
      list(c.beats).forEach((id) => { const x = l.cardById.get(id); if (x) list(x.tags).forEach((t) => tags.add(tagKey(t))); });
      tags.forEach((k) => tagHits.set(k, (tagHits.get(k) || 0) + 1));
    });
    const strongTags = [...tagHits].filter(([, n]) => n >= K.strongMin)
      .map(([k, n]) => ({ key: k, name: pretty((l.byTag.get(k) || { name: k }).name), count: n }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const strongTeams = l.teams.map((t) => {
      const ids = [...new Set(t.slots.map((s) => (typeof s === "string" ? s : s && s.card)).filter(Boolean))];
      const hit = ids.filter((id) => beatCount.has(id)).length;
      return { id: t.id || "", name: t.name || pretty(t.id || "Deck"), count: hit, mock: !!t.mock };
    }).filter((t) => t.count >= K.strongMin).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    // Weak vs: tags 3+ of our cards are weak to · Meta (Meta/SS) cards nobody in the team beats
    const weak = weakTags(members);
    const beaten = new Set(beatCount.keys());
    const weakCards = l.has.beats && members.length
      ? l.threats.filter((t) => !beaten.has(t.id) && !inDeck.has(t.id)).map((t) => ({ id: t.id, name: t.name, tier: t.tier }))
      : [];

    // Fits modes: this deck scored in every mode that can be played, best first
    const modes = modeList().filter((m) => m.enabled).map((m) => { const r = score(deck, m.id); return { id: m.id, name: m.name, score: r.score, raw: r.raw, band: r.band }; })
      .sort((a, b) => (b.raw - a.raw) || a.name.localeCompare(b.name));

    return {
      strong: { cards: strongCards, tags: strongTags, teams: strongTeams },
      weak: { tags: weak, cards: weakCards },
      modes,
      data: { beats: l.has.beats, tags: l.has.tags, weakTo: l.has.weakTo, threats: l.threats.length },
      members: members.length,
    };
  }

  /* ==========================================================
     suggest(deck, kind): try every card not in the deck in every empty slot; the n that raise the score most
     ========================================================== */
  function suggest(deck, kind, n = 3) {
    const l = lib();
    const key = kind === "support" ? "support" : "cards";
    const arr = slots(deck && deck[key]);
    const empties = arr.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
    if (!empties.length) return [];
    const base = score(deck);
    const used = new Set(slots(deck && deck.cards).filter(Boolean));
    const pool = key === "cards" ? l.cards.filter((c) => !used.has(c.id)) : l.sups;
    const out = [];
    pool.forEach((x) => {
      let best = null;
      empties.forEach((i) => {
        const next = { ...deck, cards: slots(deck.cards), support: slots(deck.support) };
        next[key][i] = x.id;
        const r = score(next);
        if (!best || r.raw > best.raw + EPS) best = { id: x.id, slot: i, raw: r.raw, after: r.score };
      });
      if (best && best.raw > base.raw + EPS) out.push({ ...best, gain: best.raw - base.raw, before: base.score });
    });
    const val = (id) => (key === "cards" ? cardValT(deck, l.cardById.get(id), base.mode) : supVal(l.supById.get(id), base.mode, base.rarity));
    return out.sort((a, b) => b.gain - a.gain || val(b.id) - val(a.id) || a.id.localeCompare(b.id)).slice(0, n);
  }

  C.teamScore = { score, analyze, suggest, band, modeConfig, modes: modeList, PARTS, K, SLOTS };
})();
