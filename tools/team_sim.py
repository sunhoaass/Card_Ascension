#!/usr/bin/env python3
"""Meta Decks: 3 teams per mode, found by battle simulation (PROGRESS ▶️ แผน 2026-10-30 ข้อ 6 · HISTORY §9).

    python3 tools/team_sim.py --search <scratch>/teams.json        # local search, 9 teams (≈ 1 h on 4 cores)
    python3 tools/team_sim.py --check <scratch>/teams.json         # fresh seeds, more runs: final scores + baselines
    python3 tools/team_sim.py --hosts <scratch>/hosts.json         # gain of every support on every card (≈ 12 min)
    python3 tools/team_sim.py --write <scratch>/teams.json <scratch>/hosts.json   # data/teams.json + team.bestSupport + bestDeck

Battles are tools/deck_sim.py (5 v 5, card abilities from matchup_sim.parse, supports from deck_sim.SUP) at RARITY.
Cards = the meta.rankTop ranked cards + the Utility row · supports = every support with a battle effect.

Modes (the owner's 3 modes, 2026-10-30):
- pvp    = player decks: our deck (with supports) vs FIELD_N strong random decks (5 of the top FIELD_CARDS cards,
           each with a support from the top FIELD_SUPS by Value, random order) · each side first · deck score 0–100 (deck_sim)
- tower  = Tower Infinity, a long climb: waves of 5 random ranked cards (no supports) one after another, every wave
           TOWER_GROW × stronger than the last · our HP, knocked-out cards, used revives and debuffs carry over
           · score = enemy cards knocked out before the whole deck falls (+ the share of the last wave's HP taken)
- overall = goes anywhere: 50% pvp ÷ best pvp + 50% tower ÷ best tower (best = the "best" team of each mode)

Teams per mode: best (any card / support) · alt (shares at most ALT_SHARED cards with best) · easy (cards with Normal odds
≤ 1 in EASY_CARD_ODDS, supports ≤ 1 in EASY_SUP_ODDS) · supports are different in every slot of a team.
Search = steepest-ascent local search on fixed seeds (common random numbers): replace a card, replace a support,
swap two slots (card + its support), swap two cards (supports stay), swap two supports · from several starts.
"""
import argparse, json, math, os, random, sys, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deck_sim
from deck_sim import Battle, U, SUP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-30"
RARITY = "Godly"
FIELD_N, FIELD_CARDS, FIELD_SUPS, PVP_RUNS, META_RUNS = 24, 24, 30, 1, 2
TOWER_GROW, TOWER_RUNS, TOWER_WAVES = 1.2, 16, 60
EASY_CARD_ODDS, EASY_SUP_ODDS = 1_000_000_000, 1_000_000
ALT_SHARED = 2
SEED = 20261030


# ---------- data ----------
def load():
    cards = json.load(open(os.path.join(ROOT, "data/cards.json")))
    sups = json.load(open(os.path.join(ROOT, "data/support.json")))
    meta = json.load(open(os.path.join(ROOT, "data/meta.json")))
    extra = {t["name"] for t in meta["tiers"] if t.get("cardsOnly")}
    ranked = [c for c in cards if c.get("tier") and c["tier"] not in extra]
    util = [c for c in cards if c.get("tier") in extra]
    if len(ranked) != meta["rankTop"]: sys.exit(f"{len(ranked)} ranked cards, meta.rankTop is {meta['rankTop']}")
    ranked.sort(key=lambda c: -c["scores"]["overall"])
    util.sort(key=lambda c: -c.get("utilGain", 0))
    sups = [s for s in sups if s["id"] in SUP and "none" not in SUP[s["id"]]([0.0] * 4)]
    sups.sort(key=lambda s: -s["scores"]["value"])
    return ranked, util, sups


D = {}   # filled in each worker: cards / sups by id, ranked list, field


def setup():
    if D: return D
    ranked, util, sups = load()
    D["ranked"], D["util"], D["sups"] = ranked, util, sups
    D["card"] = {c["id"]: c for c in ranked + util}
    D["sup"] = {s["id"]: s for s in sups}
    rng = random.Random(SEED)
    field = []
    top_c, top_s = ranked[:FIELD_CARDS], sups[:FIELD_SUPS]
    for _ in range(FIELD_N):
        cs = rng.sample(top_c, 5); ss = rng.sample(top_s, 5)
        field.append([(c, s, RARITY) for c, s in zip(cs, ss)])
    D["field"] = field
    return D


def deck_of(deck):
    d = setup()
    return [(d["card"][c], d["sup"][s] if s else None, RARITY) for c, s in deck]


# ---------- pvp ----------
def deck_score(deck0, deck1, first, rnd):
    """deck_sim.deck_score, but HP left is capped at 100% (a card that grows from kills, like Ant King, can end above its start)."""
    b = Battle(deck0, deck1, rnd)
    w = b.run(first)
    if w is None: return 50.0
    left = min(100.0, sum(max(0.0, u.hp) for u in b.sides[w] if u.alive and not u.shadow) / b.start_max[w] * 100)
    return 50 + left / 2 if w == 0 else 50 - left / 2


def versus(me, field, seed, runs):
    tot = n = 0
    for k, foe in enumerate(field):
        for f in (0, 1):
            for r in range(runs):
                rng = random.Random(seed * 31 + k * 977 + f * 101 + r)
                tot += deck_score(me, foe, f, rng.random); n += 1
    return tot / n


def pvp(deck, seed=SEED, runs=PVP_RUNS):
    """mean deck score vs the random field · with a meta field (round 2: the decks of round 1) half of it is vs those."""
    d = setup()
    me = deck_of(deck)
    v = versus(me, d["field"], seed, runs)
    if d.get("meta"): v = (v + versus(me, d["meta"], seed + 7, META_RUNS)) / 2
    return v


# ---------- tower ----------
class Tower(Battle):
    """our deck vs wave after wave of 5 cards · the next wave comes in when one is wiped out (made in tower())."""

    def make_wave(s):
        d = setup()
        k = TOWER_GROW ** s.wave
        return [(c, None, RARITY, k) for c in s.wrng.sample(d["ranked"], 5)]

    def front(s, side):
        for u in s.sides[side]:
            if u.alive: return u
        if side == 1 and s.wave + 1 < TOWER_WAVES and any(u.alive for u in s.sides[0]):
            s.next_wave()
            return s.sides[1][0]
        return None

    def next_wave(s):
        s.kills += sum(1 for u in s.sides[1] if not u.shadow)
        s.wave += 1
        us = []
        for i, (c, _, _, k) in enumerate(s.make_wave()):
            u = U(c, None, 1, i, s.rnd); u.atk *= k; u.max *= k; u.hp = u.max
            us.append(u)
        for u in us:
            if "team_dmg" in u.a:
                for o in us:
                    if o is not u: o.flat += u.a["team_dmg"]
        mine = [u for u in s.sides[0] if u.alive]
        for v in mine:
            if "enemy_less" in v.a:
                for o in us: o.out_mult *= 1 - v.a["enemy_less"]
        less = 1.0
        for u in us:
            if "enemy_less" in u.a: less *= 1 - u.a["enemy_less"]
        for u in s.sides[0]: u.out_mult = less   # the new wave's "every enemy card starts with less damage"
        s.sides[1] = us
        s.guard[1] = False


def tower(deck, seed=SEED, runs=TOWER_RUNS):
    me = deck_of(deck)
    tot = 0.0
    # the first wave goes through Battle.__init__, which takes (card, support, rarity): scale it afterwards
    for r in range(runs):
        rng = random.Random(seed * 17 + r)
        b = Tower.__new__(Tower)
        b.wrng = random.Random(seed * 53 + r); b.wave = 0; b.kills = 0
        w0 = b.make_wave()
        Battle.__init__(b, me, [(c, None, rr) for c, _, rr, _ in w0], rng.random)
        b.run(r % 2)
        left = [u for u in b.sides[1] if not u.shadow]
        b.kills += sum(1 for u in left if not u.alive)
        alive = [u for u in left if u.alive]
        part = sum(1 - max(0.0, u.hp) / u.max for u in alive) / 5 if alive else 0.0
        tot += b.kills + part
    return tot / runs


# ---------- search ----------
KEYS = [f"{m}-{k}" for m in ("pvp", "tower", "overall") for k in ("best", "alt", "easy")]
REF = {}   # overall: best pvp / tower scores (set by the parent before the overall searches, passed to the workers)


def value(mode, deck, seed=SEED, ref=None):
    if mode == "pvp": return pvp(deck, seed)
    if mode == "tower": return tower(deck, seed)
    ref = ref or REF
    return 50 * pvp(deck, seed) / ref["pvp"] + 50 * tower(deck, seed) / ref["tower"]


def _job(a):
    mode, deck, ref = a
    return value(mode, deck, ref=ref)


def neighbours(deck, P, S):
    cards = [c for c, _ in deck]; sups = [s for _, s in deck]
    out = []
    for i in range(5):
        for c in P:
            if c not in cards: out.append(deck[:i] + [(c, deck[i][1])] + deck[i + 1:])
        for x in S:
            if x not in sups: out.append(deck[:i] + [(deck[i][0], x)] + deck[i + 1:])
        for j in range(i + 1, 5):
            d = deck[:]; d[i], d[j] = d[j], d[i]; out.append(d)                       # slot swap (card + its support)
            d = deck[:]; d[i], d[j] = (deck[j][0], deck[i][1]), (deck[i][0], deck[j][1]); out.append(d)   # cards only
            d = deck[:]; d[i], d[j] = (deck[i][0], deck[j][1]), (deck[j][0], deck[i][1]); out.append(d)   # supports only
    return out


def local_search(pool, mode, start, P, S, ok, rng, chunk=16, max_evals=1600, log=None):
    cur = list(start)
    cs = pool.map(_job, [(mode, cur, dict(REF))])[0]
    evals = 1
    while evals < max_evals:
        nb = [n for n in neighbours(cur, P, S) if ok(n)]
        rng.shuffle(nb)
        moved = False
        for i in range(0, len(nb), chunk):
            batch = nb[i:i + chunk]
            sc = pool.map(_job, [(mode, n, dict(REF)) for n in batch])
            evals += len(batch)
            j = max(range(len(batch)), key=lambda k: sc[k])
            if sc[j] > cs + 1e-9:
                cur, cs, moved = batch[j], sc[j], True
                if log: log(f"  {mode} {cs:7.2f}  evals {evals:5d}  " + " · ".join(f"{c}+{x}" for c, x in cur))
                break
            if evals >= max_evals: break
        if not moved: break
    return cur, cs, evals


def search(out, meta=None):
    """round 1 (meta=None): every mode vs the random field · round 2 (meta = round 1's file): pvp + overall again, half vs
    round 1's 9 decks (players copy the strong decks), starting from round 1's decks · tower is copied (no field)."""
    d = setup()
    r1 = json.load(open(meta)) if meta else None
    if r1: d["meta"] = [deck_of(r1[k]["deck"]) for k in KEYS]
    ranked, util, sups = d["ranked"], d["util"], d["sups"]
    P_all = [c["id"] for c in ranked + util]
    S_all = [s["id"] for s in sups[:50]]
    P_easy = [c["id"] for c in ranked + util if c["base"]["odds"] <= EASY_CARD_ODDS]
    S_easy = [s["id"] for s in sups if s["odds"] <= EASY_SUP_ODDS][:50]
    rng = random.Random(SEED)
    log = lambda m: print(m, flush=True)
    res = json.load(open(out)) if os.path.exists(out) else {}
    if r1:
        for k in KEYS:
            if k.startswith("tower"): res[k] = r1[k]

    def starts(P, S, n_random):
        pc = [c for c in P if c in {x["id"] for x in ranked}][:5]
        ps = S[:5]
        st = [list(zip(pc, ps))]
        for _ in range(n_random):
            st.append(list(zip(rng.sample(P, 5), rng.sample(S, 5))))
        return st

    def run(key, mode, P, S, ok, n_random):
        if key in res: log(f"{key}: done {res[key]['score']:.2f}"); return
        best = None
        for k, st in enumerate(([r1[key]["deck"]] if r1 else []) + starts(P, S, 0 if r1 else n_random)):
            if not ok(st): continue
            t = time.time()
            deck, sc, ev = local_search(pool, mode, st, P, S, ok, rng, log=log)
            log(f"{key} start {k}: {sc:.2f} ({ev} evals, {time.time() - t:.0f}s)")
            if best is None or sc > best[1]: best = (deck, sc)
        res[key] = {"mode": mode, "deck": best[0], "score": best[1]}
        json.dump(res, open(out, "w"), indent=1)

    distinct = lambda dk: len({c for c, _ in dk}) == 5 and len({x for _, x in dk}) == 5
    easy_ok = lambda dk: distinct(dk) and all(c in P_easy for c, _ in dk) and all(x in S_easy for _, x in dk)
    with Pool() as pool:
        for mode in ("pvp", "tower", "overall"):
            if mode == "overall":
                REF.update(pvp=res["pvp-best"]["score"], tower=res["tower-best"]["score"])
                res["ref"] = dict(REF)
            run(f"{mode}-best", mode, P_all, S_all, distinct, 1)
            best_cards = {c for c, _ in res[f"{mode}-best"]["deck"]}
            alt_ok = lambda dk, b=best_cards: distinct(dk) and len(b & {c for c, _ in dk}) <= ALT_SHARED
            P_alt = sorted(P_all, key=lambda c: c in best_cards)   # the start takes the top cards that are not in best
            run(f"{mode}-alt", mode, P_alt, S_all, alt_ok, 0)
            run(f"{mode}-easy", mode, P_easy, S_easy, easy_ok, 0)


# ---------- best support per card (team.bestSupport) ----------
HOST_TRIALS, HOST_RUNS = 24, 2


def _host(a):
    """one trial: deck score with each support on the host − without (same seeds) · like rank_support.play."""
    h, slot, own, foe, seed = a
    d = setup()
    c = d["card"]
    d1 = [(c[i], None, RARITY) for i in foe]
    res = {}
    for x in [None] + [s["id"] for s in d["sups"]]:
        d0 = [(c[i], d["sup"][x] if x and n == slot else None, RARITY) for n, i in enumerate(own)]
        tot = 0.0
        for f in (0, 1):
            for r in range(HOST_RUNS):
                rng = random.Random(seed * 7 + f * 1000 + r)
                tot += deck_score(d0, d1, f, rng.random)
        res[x or ""] = tot / (2 * HOST_RUNS)
    base = res.pop("")
    return h, {k: round(v - base, 3) for k, v in res.items()}


def hosts(out):
    """every ranked + Utility card with every support: host + 4 random ranked cards vs the same 5 in another order
    (mirror, like rank_support) · a ranked host moves through slots 1–5, a Utility host sits in slot 5 (where it plays)."""
    d = setup()
    rk = [c["id"] for c in d["ranked"]]
    rng = random.Random(SEED + 6)
    jobs = []
    for h in rk + [c["id"] for c in d["util"]]:
        for k in range(HOST_TRIALS):
            others = rng.sample([i for i in rk if i != h], 4)
            slot = 4 if h not in rk else k % 5
            own = others[:slot] + [h] + others[slot:]
            foe = rng.sample(own, 5) if h in rk else rng.sample(others, 4) + [h]
            jobs.append((h, slot, own, foe, rng.randrange(1 << 30)))
    with Pool() as pool:
        got = pool.map(_host, jobs, chunksize=4)
    by = {}
    for h, g in got:
        b = by.setdefault(h, {})
        for k, v in g.items(): b[k] = b.get(k, 0.0) + v / HOST_TRIALS
    json.dump({"trials": HOST_TRIALS, "runs": HOST_RUNS, "gain": {h: {k: round(v, 3) for k, v in g.items()} for h, g in by.items()}},
              open(out, "w"))


# ---------- final check ----------
def _check(a):
    key, deck = a
    return key, pvp(deck, SEED + 1, 3), tower(deck, SEED + 1, 64)


def check(path):
    """fresh seeds, more runs · the 9 teams + baselines · round robin between the 9 teams (pvp, each side first, 20 runs)."""
    res = json.load(open(path))
    d = setup()
    d["meta"] = [deck_of(res[k]["deck"]) for k in KEYS]
    top = [c["id"] for c in d["ranked"][:5]]
    base = {"top5+top5sup": list(zip(top, [s["id"] for s in d["sups"][:5]])), "top5 no support": [(c, None) for c in top]}
    jobs = [(k, res[k]["deck"]) for k in KEYS] + list(base.items())
    with Pool() as pool:
        got = pool.map(_check, jobs)
        rr = pool.map(_rr, [(a, b, res) for a in KEYS for b in KEYS if a != b])
    ref = res.get("ref") or {}
    print("| team | PvP (vs field ½ + round-1 decks ½) | Tower (cards knocked out) | Overall | cards · supports |")
    print("|---|---:|---:|---:|---|")
    sc = {}
    for k, p, t in got:
        o = 50 * p / ref["pvp"] + 50 * t / ref["tower"] if ref else 0
        sc[k] = dict(pvp=round(p, 1), tower=round(t, 1), overall=round(o, 1))
        dk = res[k]["deck"] if k in res else base[k]
        print(f"| {k} | {p:.1f} | {t:.1f} | {o:.1f} | " + " · ".join(f"{c}+{x}" for c, x in dk) + " |")
    print("\nround robin (row deck score vs column, mean of both sides first):")
    tab = {(a, b): v for a, b, v in rr}
    print("| | " + " | ".join(KEYS) + " | mean |")
    for a in KEYS:
        row = [tab.get((a, b)) for b in KEYS]
        vals = [v for v in row if v is not None]
        print(f"| {a} | " + " | ".join("—" if v is None else f"{v:.0f}" for v in row) + f" | {sum(vals) / len(vals):.1f} |")
        sc[a]["rr"] = round(sum(vals) / len(vals), 1)
    json.dump(sc, open(path.replace(".json", "-check.json"), "w"), indent=1)


def _rr(a):
    x, y, res = a
    d0, d1 = deck_of(res[x]["deck"]), deck_of(res[y]["deck"])
    tot = 0.0
    for f in (0, 1):
        for r in range(20):
            rng = random.Random(SEED * 3 + f * 100 + r)
            tot += deck_score(d0, d1, f, rng.random)
    return x, y, tot / 40


# ---------- timing ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--search"); ap.add_argument("--meta"); ap.add_argument("--time", action="store_true")
    ap.add_argument("--hosts"); ap.add_argument("--check")
    o = ap.parse_args()
    if o.search: search(o.search, o.meta)
    if o.hosts: hosts(o.hosts)
    if o.check: check(o.check)
    if o.time: timing()


def timing():
    d = setup()
    deck = [(c["id"], s["id"]) for c, s in zip(d["ranked"][:5], d["sups"][:5])]
    t = time.time(); print("pvp", round(pvp(deck), 2), round(time.time() - t, 2), "s")
    t = time.time(); print("tower", round(tower(deck), 2), round(time.time() - t, 2), "s")
    deck = [(c["id"], None) for c in d["ranked"][:5]]
    t = time.time(); print("pvp nosup", round(pvp(deck), 2), round(time.time() - t, 2), "s")
    t = time.time(); print("tower nosup", round(tower(deck), 2), round(time.time() - t, 2), "s")


if __name__ == "__main__":
    main()
