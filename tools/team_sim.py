#!/usr/bin/env python3
"""Meta teams for 3 modes: PvP · Tower Infinity · Overall (PROGRESS ▶️ แผน 2026-10-30 ข้อ 6 · §7 B ข้อ 10).

    python3 tools/team_sim.py --calibrate                       # tower floors of a few reference decks (pick TOWER_K0 / TOWER_G)
    python3 tools/team_sim.py --search <scratch>/teams.json     # 9 teams (≈ 1 h on 4 cores · progress on stderr)
    python3 tools/team_sim.py --hosts <scratch>/hosts.json      # support gains per card (48 + Utility) → team.bestSupport (≈ 30 min)
    python3 tools/team_sim.py --report <scratch>/teams.json     # table of the 9 teams (re-scored with more battles)
    python3 tools/team_sim.py --write <scratch>/teams.json <scratch>/hosts.json   # data/teams.json · cards team.bestSupport · support bestDeck

Battles = tools/deck_sim.py (5 v 5 with supports, abilities from matchup_sim.parse) at Godly.
Pool: the meta.rankTop ranked cards (48) + the Utility row (11) · the 100 support cards (gems-only Shadow Garden Strategist left out).
A deck = 5 cards (no repeats) with a support under each (no repeated support either: valid whether or not the game allows repeats, §8).

- TIMEOUT: a fight still going after MAX_TURNS turns (two healing decks never finish) goes to the side with more HP left (% of its deck)
- HP left counts at most 100% of the deck's starting HP (cards that grow on a kill would score past 100)
- PvP   = the mean deck score (0–100, 50 = even, §deck_sim) against a gauntlet of player decks, both sides first:
          GAUNTLET random strong decks (5 of the Meta…A cards in a random order, each with a different Meta…S support)
          + the best and second decks found in round 1 + the reference deck (round 2 searches again against them: players copy what wins)
- Tower = Tower Infinity: floor after floor of 5 enemy cards (5 of the 48 ranked cards, no supports) that get TOWER_G × stronger
          every floor (floor 1 = TOWER_K0 × their stats) · the deck keeps its HP between floors (fallen cards stay down, no heal)
          · a lost or timed-out floor ends the run · score = floors cleared + share of the last floor's enemy HP taken
          · TOWER_SEQ fixed enemy sequences (the same for every deck) · T = 50 × floors ÷ the reference deck's floors
- Overall = (PvP + T) ÷ 2 (a deck that has to do both)
- 3 teams a mode: best · second (shares ≤ SECOND_SHARE cards with the best) · easy (cards odds ≤ 1 in EASY_CARD, support ≤ 1 in EASY_SUP)
- search = hill climbing from the best cards by Overall: every pass tries each card swap (any pool card in any slot), each order swap
  and each support swap (shortlist: the SUP_SHORT best by Value + every support a host card ranks top 3) and keeps the best move
"""
import argparse, json, os, random, sys, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deck_sim
from deck_sim import Battle

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-30"
RARITY = "Godly"
MAX_TURNS = 200            # timeout for PvP / tower fights (deck_sim keeps 3000 for the support ranking)
SEED = 20261031
GAUNTLET = 24              # random strong decks in the PvP gauntlet
RUNS = 2                   # battles per gauntlet deck per side first
TOWER_SEQ = 10             # enemy sequences per tower run
TOWER_K0 = 0.25            # floor 1 enemies = this × their Normal stats (our cards: Normal stats too, deck_sim ignores card rarity)
TOWER_G = 1.12             # every floor ×1.12
TOWER_MAX = 80
SECOND_SHARE = 2
EASY_CARD = 1_000_000_000  # 1 in 1B (Witch of Envy / Storm Dragon / Destroyer God 917.5M … the Utility row)
EASY_SUP = 1_000_000       # 1 in 1M (82 of 100 support)
SUP_SHORT = 40
PASSES = 15
FINAL_GAUNTLET, FINAL_RUNS, FINAL_SEQ = 40, 3, 16   # --report


# ---------- data ----------
def load():
    cards = json.load(open(os.path.join(ROOT, "data/cards.json")))
    sups = json.load(open(os.path.join(ROOT, "data/support.json")))
    meta = json.load(open(os.path.join(ROOT, "data/meta.json")))
    extra = {t["name"] for t in meta["tiers"] if t.get("cardsOnly")}
    ranked = sorted([c for c in cards if c.get("tier") and c["tier"] not in extra], key=lambda c: c["id"])
    util = sorted([c for c in cards if c.get("tier") in extra], key=lambda c: c["id"])
    if len(ranked) != meta["rankTop"]: sys.exit(f"{len(ranked)} ranked cards, meta.rankTop is {meta['rankTop']}")
    sups = [s for s in sups if s["id"] in deck_sim.SUP and deck_sim.SUP[s["id"]]([0.1] * 3).get("none") is None]
    return ranked, util, sups, meta


D = {}   # worker data: card / support by id, ranked list, gauntlet, tower floors


def init(gauntlet=None, extra=None):
    deck_sim.MAX_TURNS = MAX_TURNS
    ranked, util, sups, meta = load()
    D["card"] = {c["id"]: c for c in ranked + util}
    D["sup"] = {s["id"]: s for s in sups}
    D["ranked"] = ranked
    D["gauntlet"] = (gauntlet or make_gauntlet(ranked, sups, GAUNTLET, SEED)) + (extra or [])
    D["floors"] = {}


def make_gauntlet(ranked, sups, n, seed):
    rng = random.Random(seed)
    strong = [c["id"] for c in ranked if c["tier"] in ("Meta", "SS", "S", "A")]
    good = [s["id"] for s in sups if s["tier"] in ("Meta", "SS", "S")]
    return [tuple(zip(rng.sample(strong, 5), rng.sample(good, 5))) for _ in range(n)]


def deck_of(t):
    return [(D["card"][c], D["sup"][s] if s else None, RARITY) for c, s in t]


def left(b, side):
    """HP left, % of the deck's HP at the start · at most 100 (kill growth can push a card past its starting max HP)."""
    return min(100.0, sum(max(0.0, u.hp) for u in b.sides[side] if u.alive and not u.shadow) / b.start_max[side] * 100)


def duel(d0, d1, first, rnd):
    """deck score of d0 (0–100) · timeout = more HP left wins by the difference."""
    b = Battle(d0, d1, rnd)
    w = b.run(first)
    if w is None: return 50 + (left(b, 0) - left(b, 1)) / 2
    return 50 + left(b, 0) / 2 if w == 0 else 50 - left(b, 1) / 2


def pvp(t, gauntlet=None, runs=RUNS):
    d0 = deck_of(t)
    tot = n = 0
    for g, foe in enumerate(gauntlet or D["gauntlet"]):
        d1 = deck_of(foe)
        for f in (0, 1):
            for r in range(runs):
                tot += duel(d0, d1, f, random.Random(SEED + g * 100 + f * 10 + r).random); n += 1
    return tot / n


def floor_deck(seq, fl):
    k = (seq, fl)
    if k not in D["floors"]:
        rng = random.Random(SEED * 31 + seq * 1000 + fl)
        m = TOWER_K0 * TOWER_G ** (fl - 1)
        out = []
        for c in rng.sample(D["ranked"], 5):
            b = dict(c["base"]); b["atk"] = b["atk"] * m; b["hp"] = b["hp"] * m
            out.append(({**c, "base": b}, None, RARITY))
        D["floors"][k] = out
    return D["floors"][k]


def tower_run(t, seq):
    """floors cleared (float) by deck t in enemy sequence seq · HP carries over, fallen cards stay down."""
    alive = [(c, s, 1.0) for c, s in t]        # card id, support id, HP share left
    for fl in range(1, TOWER_MAX + 1):
        mine = [(D["card"][c], D["sup"][s] if s else None, RARITY) for c, s, _ in alive]
        rnd = random.Random(SEED * 7 + seq * 1000 + fl).random
        b = Battle(mine, floor_deck(seq, fl), rnd)
        for u, (_, _, h) in zip(b.sides[0], alive): u.hp = u.max * h
        w = b.run(0 if rnd() < 0.5 else 1)
        if w != 0:
            return fl - 1 + max(0.0, 1 - left(b, 1) / 100)
        alive = [(c, s, u.hp / u.max) for (c, s, _), u in zip(alive, b.sides[0]) if u.alive and not u.shadow and u.hp > 0]
        if not alive: return float(fl)
    return float(TOWER_MAX)


def tower(t, seqs=TOWER_SEQ):
    return sum(tower_run(t, q) for q in range(seqs)) / seqs


def evaluate(args):
    t, what = args
    out = {}
    if what in ("pvp", "overall", "all"): out["pvp"] = pvp(t)
    if what in ("tower", "overall", "all"): out["tower"] = tower(t)
    return out


def final_eval(args):
    t, gauntlet = args
    return {"pvp": pvp(t, gauntlet, FINAL_RUNS), "tower": tower(t, FINAL_SEQ)}


# ---------- search ----------
class Search:
    def __init__(s, pool, tref):
        s.pool, s.tref = pool, tref
        s.cache = {}

    def objective(s, r, mode):
        if mode == "pvp": return r["pvp"]
        T = 50 * r["tower"] / s.tref
        return T if mode == "tower" else (r["pvp"] + T) / 2

    def scores(s, decks, mode):
        what = "overall" if mode == "overall" else mode
        todo = [t for t in decks if (t, what) not in s.cache]
        for t, r in zip(todo, s.pool.map(evaluate, [(t, what) for t in todo], chunksize=1)):
            s.cache[(t, what)] = r
        return [s.objective(s.cache[(t, what)], mode) for t in decks]

    def climb(s, start, mode, cards, sups, ok, label):
        cur = tuple(start)
        best = s.scores([cur], mode)[0]
        for p in range(PASSES):
            t0 = time.time()
            nb = set()
            ids = [c for c, _ in cur]; used_s = {x for _, x in cur}
            for i in range(5):
                for c in cards:
                    if c not in ids: nb.add(cur[:i] + ((c, cur[i][1]),) + cur[i + 1:])
                for x in sups:
                    if x not in used_s: nb.add(cur[:i] + ((cur[i][0], x),) + cur[i + 1:])
                for j in range(i + 1, 5):
                    l = list(cur); l[i], l[j] = l[j], l[i]; nb.add(tuple(l))                       # card + its support move
                    l = list(cur); l[i], l[j] = (l[j][0], l[i][1]), (l[i][0], l[j][1]); nb.add(tuple(l))   # cards only
            nb = [t for t in nb if ok(t)]
            sc = s.scores(nb, mode)
            k = max(range(len(nb)), key=lambda k: sc[k])
            log(f"  {label} pass {p + 1}: {len(nb)} decks {time.time() - t0:.0f}s best {sc[k]:.2f} (was {best:.2f})")
            if sc[k] <= best + 0.05: break
            cur, best = nb[k], sc[k]
            log(f"    → {' · '.join(f'{c}+{x}' for c, x in cur)}")
        return cur, best


def log(m):
    print(m, file=sys.stderr, flush=True)


def reference(ranked, sups):
    top = sorted(ranked, key=lambda c: -c["scores"]["overall"])[:5]
    ts = sorted(sups, key=lambda x: -x["scores"]["value"])[:5]
    return tuple((c["id"], x["id"]) for c, x in zip(top, ts))


def start_deck(cards, sups, card_by, sup_by, avoid=()):
    cs = [c for c in sorted(cards, key=lambda i: -card_by[i]["scores"]["overall"]) if c not in avoid][:5]
    if len(cs) < 5: cs = (cs + [c for c in sorted(cards, key=lambda i: -card_by[i]["scores"]["overall"]) if c not in cs])[:5]
    ss = sorted(sups, key=lambda i: -sup_by[i]["scores"]["value"])[:5]
    return tuple(zip(cs, ss))


def search(out):
    ranked, util, sups, meta = load()
    card_by = {c["id"]: c for c in ranked + util}; sup_by = {s["id"]: s for s in sups}
    all_cards = [c["id"] for c in ranked + util]
    short = [s["id"] for s in sorted(sups, key=lambda x: -x["scores"]["value"])[:SUP_SHORT]]
    easy_cards = [c for c in all_cards if card_by[c]["base"]["odds"] <= EASY_CARD]
    easy_sups = [s for s in sorted(sups, key=lambda x: -x["scores"]["value"]) if s["odds"] <= EASY_SUP][:SUP_SHORT]
    ref = reference(ranked, sups)
    res = {"ref": ref, "teams": {}, "rounds": []}
    extra = []
    for rnd_ in (1, 2):
        log(f"round {rnd_} · gauntlet {GAUNTLET} random + {len(extra)} found decks")
        with Pool(initializer=init, initargs=(None, extra)) as pool:
            S = Search(pool, 1.0)
            S.tref = pool.map(evaluate, [(ref, "tower")])[0]["tower"]
            log(f"reference {ref} tower {S.tref:.2f}")
            teams = {}
            for mode in ("pvp", "tower", "overall"):
                prev = res["teams"].get(mode, {})
                b0 = prev.get("best", {}).get("deck") or start_deck(all_cards, short, card_by, sup_by)
                best, bs = S.climb(b0, mode, all_cards, short, lambda t: True, f"{mode} best")
                bset = {c for c, _ in best}
                ok2 = lambda t, bset=bset: len({c for c, _ in t} & bset) <= SECOND_SHARE
                s0 = prev.get("second", {}).get("deck")
                if not s0 or not ok2(tuple(map(tuple, s0))): s0 = start_deck(all_cards, short, card_by, sup_by, avoid=bset)
                second, ss = S.climb(tuple(map(tuple, s0)), mode, all_cards, short, ok2, f"{mode} second")
                e0 = prev.get("easy", {}).get("deck") or start_deck(easy_cards, easy_sups, card_by, sup_by)
                easy, es = S.climb(tuple(map(tuple, e0)), mode, easy_cards, easy_sups, lambda t: True, f"{mode} easy")
                teams[mode] = {"best": {"deck": best, "score": bs}, "second": {"deck": second, "score": ss}, "easy": {"deck": easy, "score": es}}
            res["teams"] = teams
            res["rounds"].append({"round": rnd_, "tref": S.tref, "teams": teams})
            json.dump(res, open(out, "w"), indent=1)
        extra = list({tuple(v["deck"]) for m in teams.values() for k, v in m.items() if k in ("best", "second")} | {ref})
    res["found"] = extra
    json.dump(res, open(out, "w"), indent=1)


def report(path):
    r = json.load(open(path))
    ranked, util, sups, meta = load()
    gauntlet = make_gauntlet(ranked, sups, FINAL_GAUNTLET, SEED + 1) + [tuple(map(tuple, t)) for t in r.get("found", [])]
    decks = [("reference", "", tuple(map(tuple, r["ref"])))] + [(m, k, tuple(map(tuple, v["deck"]))) for m, ks in r["teams"].items() for k, v in ks.items()]
    with Pool(initializer=init) as pool:
        sc = pool.map(final_eval, [(t, gauntlet) for _, _, t in decks], chunksize=1)
    tref = sc[0]["tower"]
    card_by = {c["id"]: c for c in ranked + util}; sup_by = {s["id"]: s for s in sups}
    print(f"gauntlet {len(gauntlet)} decks × 2 sides × {FINAL_RUNS} · tower {FINAL_SEQ} sequences · reference floors {tref:.2f}")
    print("| mode | team | PvP | Tower floors | T | Overall | cards (support) |")
    print("|---|---|---:|---:|---:|---:|---|")
    out = {}
    for (m, k, t), s in zip(decks, sc):
        T = 50 * s["tower"] / tref
        out[f"{m}|{k}"] = {"pvp": round(s["pvp"], 1), "tower": round(s["tower"], 2), "T": round(T, 1), "overall": round((s["pvp"] + T) / 2, 1)}
        print(f"| {m} | {k} | {s['pvp']:.1f} | {s['tower']:.2f} | {T:.1f} | {(s['pvp'] + T) / 2:.1f} | "
              + " · ".join(f"{card_by[c]['name']} ({sup_by[x]['name']})" for c, x in t) + " |")
    r["final"] = out
    json.dump(r, open(path, "w"), indent=1)


# ---------- support gains per card → team.bestSupport ----------
HOST_TRIALS = 40


def host_trials(ranked, util):
    from rank_support import trials, SEED as RS
    out = [(h, slot, own, foe, seed) for h, slot, own, foe, seed in trials(ranked)]   # = the support ranking's trials
    rng = random.Random(RS + 1)
    n = len(ranked)
    for u in range(len(util)):
        h = n + u
        for k in range(HOST_TRIALS):
            others = rng.sample(range(n), 4)
            slot = k % 5
            own = others[:slot] + [h] + others[slot:]
            out.append((h, slot, own, rng.sample(own, 5), rng.randrange(1 << 30)))
    return out


def hosts(out):
    from rank_support import play
    ranked, util, sups, _ = load()
    allc = ranked + util
    ts = host_trials(ranked, util)
    with Pool() as pool:   # deck_sim.MAX_TURNS stays 3000 here: the same battles as the support ranking
        gains = pool.map(play, [(t, allc, sups) for t in ts], chunksize=2)
    by = {}
    for (h, *_), g in zip(ts, gains):
        d = by.setdefault(allc[h]["id"], {})
        for k, v in g.items(): d.setdefault(k, []).append(v)
    json.dump({c: {k: round(sum(v) / len(v), 4) for k, v in d.items()} for c, d in by.items()}, open(out, "w"))


# ---------- write ----------
def best_support(gains, n=3):
    return [k for k, v in sorted(gains.items(), key=lambda kv: -kv[1]) if v > 0][:n]


def write(tpath, hpath, names):
    r = json.load(open(tpath))
    hg = json.load(open(hpath))
    cpath = os.path.join(ROOT, "data/cards.json"); spath = os.path.join(ROOT, "data/support.json")
    craw, sraw = open(cpath).read(), open(spath).read()
    cards, sups = json.loads(craw), json.loads(sraw)
    teams = []
    for m in ("pvp", "tower", "overall"):
        for k in ("best", "second", "easy"):
            t = r["teams"][m][k]["deck"]
            nm = names[f"{m}|{k}"]
            teams.append({"id": nm["id"], "name": nm["name"], "mode": m, "kind": k,
                          "slots": [{"card": c, "support": x} for c, x in t],
                          "sim": r.get("final", {}).get(f"{m}|{k}", {}),
                          "notes": nm["notes"], "updated": TODAY})
    open(os.path.join(ROOT, "data/teams.json"), "w").write(json.dumps(teams, ensure_ascii=False, indent=2) + "\n")
    used = {}
    for t in teams:
        for sl in t["slots"]: used.setdefault(sl["support"], []).append(t["id"])
    for c in cards:
        if c["id"] in hg:
            c.setdefault("team", {})
            c["team"]["bestSupport"] = best_support(hg[c["id"]])
            c["team"].setdefault("position", "")
            c["team"].setdefault("bestWith", [])
            c["updated"] = TODAY
    for s in sups:
        s["bestDeck"] = list(dict.fromkeys(used.get(s["id"], [])))
    open(cpath, "w").write(json.dumps(cards, ensure_ascii=False, indent=2) + ("\n" if craw.endswith("\n") else ""))
    open(spath, "w").write(json.dumps(sups, ensure_ascii=False, indent=2) + ("\n" if sraw.endswith("\n") else ""))


def calibrate():
    init()
    ranked, util, sups, _ = load()
    ref = reference(ranked, sups)
    weak = tuple((c["id"], None) for c in sorted(ranked, key=lambda c: c["scores"]["overall"])[:5])
    nosup = tuple((c, None) for c, _ in ref)
    for name, t in (("reference", ref), ("reference no support", nosup), ("weakest 5", weak)):
        t0 = time.time()
        print(name, [round(tower_run(t, q), 2) for q in range(TOWER_SEQ)], f"{time.time() - t0:.1f}s", f"pvp {pvp(t):.1f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calibrate", action="store_true")
    ap.add_argument("--search"); ap.add_argument("--report"); ap.add_argument("--hosts")
    ap.add_argument("--write", nargs=3, metavar=("TEAMS", "HOSTS", "NAMES"))
    o = ap.parse_args()
    if o.calibrate: calibrate()
    if o.search: search(o.search)
    if o.report: report(o.report)
    if o.hosts: hosts(o.hosts)
    if o.write: write(o.write[0], o.write[1], json.load(open(o.write[2])))


if __name__ == "__main__":
    main()
