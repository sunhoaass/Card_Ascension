#!/usr/bin/env python3
"""Score and rank every support card at Godly (PROGRESS ▶️ แผน 2026-10-30 ข้อ 2 · §5.4 + §7 B ข้อ 9).

    python3 tools/rank_support.py --sim <scratch>/sup.json            # battles (≈ 15 min on 4 cores) → per-trial gains
    python3 tools/rank_support.py --score <scratch>/sup.json          # table only
    python3 tools/rank_support.py --score <scratch>/sup.json --write  # + data/support.json (scores, tier, prevTier)

Battles (tools/deck_sim.py): the meta.rankTop ranked cards (48) only, no supports on the enemy side.
- trial = one host card (each ranked card TRIALS_PER_HOST times) + 4 random ranked cards, host in slot 1–5 in turn,
  vs the same 5 cards in a random order (mirror: even fights) · RUNS battles each side first · the same seeds with and without the support
- gain of a trial = deck score with the support on the host − deck score without it (deck score 0–100, §deck_sim)

Scores (0–100 · §5.4 weights 40 / 20 / 20 / 20):
- effect      = 100 × mean gain ÷ the best mean gain
- reliability = % of trials where the support helped (gain > 0): chance, triggers that never fire, slots that never come in
- flexibility = % of host cards whose mean gain is at least FLEX_SHARE of this support's own best 3 hosts
- synergy     = 100 × mean gain of its best 3 host cards ÷ the best such value
- value = 0.4 effect + 0.2 reliability + 0.2 flexibility + 0.2 synergy (at least 0.1: the site reads 0 as unranked · gems only)
  · tier by rank (meta.json → tiers[].supportTo) · prevTier = tier before this run ("" = was unranked)
"""
import argparse, json, os, random, sys
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deck_sim import deck_score, SUP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-30"
RARITY = "Godly"
TRIALS_PER_HOST = 40
RUNS = 4
FLEX_SHARE = 0.25
SEED = 20261030


def load():
    cards = json.load(open(os.path.join(ROOT, "data/cards.json")))
    meta = json.load(open(os.path.join(ROOT, "data/meta.json")))
    extra = {t["name"] for t in meta["tiers"] if t.get("cardsOnly")}
    ranked = sorted([c for c in cards if c.get("tier") and c["tier"] not in extra], key=lambda c: c["id"])
    if len(ranked) != meta["rankTop"]: sys.exit(f"{len(ranked)} ranked cards, meta.rankTop is {meta['rankTop']}")
    return ranked, meta


def trials(ranked):
    rng = random.Random(SEED)
    out = []
    for h in range(len(ranked)):
        for k in range(TRIALS_PER_HOST):
            others = rng.sample([i for i in range(len(ranked)) if i != h], 4)
            slot = k % 5
            own = others[:slot] + [h] + others[slot:]
            foe = rng.sample(own, 5)   # mirror: the same 5 cards in another order → close fights, the support decides
            out.append((h, slot, own, foe, rng.randrange(1 << 30)))
    return out


def play(args):
    """one trial: mean deck score over RUNS × 2 battles, for every support (None = baseline)."""
    t, ranked, sups = args
    h, slot, own, foe, seed = t
    d1 = [(ranked[i], None, RARITY) for i in foe]
    res = {}
    for s in [None] + sups:
        d0 = [(ranked[i], s if n == slot else None, RARITY) for n, i in enumerate(own)]
        tot = 0.0
        for f in (0, 1):
            for r in range(RUNS):
                rng = random.Random(seed * 7 + f * 1000 + r)
                tot += deck_score(d0, d1, f, rng.random)
        res[s["id"] if s else ""] = tot / (2 * RUNS)
    base = res.pop("")
    return {k: round(v - base, 4) for k, v in res.items()}


def simulate(out):
    ranked, _ = load()
    sups = json.load(open(os.path.join(ROOT, "data/support.json")))
    missing = [s["id"] for s in sups if s["id"] not in SUP]
    if missing: sys.exit(f"not in deck_sim.SUP: {missing}")
    ts = trials(ranked)
    with Pool() as pool:
        gains = pool.map(play, [(t, ranked, sups) for t in ts], chunksize=2)
    json.dump({"rarity": RARITY, "runs": RUNS, "hosts": [c["id"] for c in ranked],
               "trials": [[t[0], t[1]] for t in ts], "gains": gains}, open(out, "w"))


def score(path, write):
    d = json.load(open(path))
    hosts, tr, gains = d["hosts"], d["trials"], d["gains"]
    spath = os.path.join(ROOT, "data/support.json")
    raw = open(spath).read()
    sups = json.loads(raw)
    _, meta = load()
    st = {}
    for s in sups:
        i = s["id"]
        g = [x[i] for x in gains]
        by = {}
        for (h, _), x in zip(tr, g): by.setdefault(h, []).append(x)
        hm = sorted((sum(v) / len(v) for v in by.values()), reverse=True)
        top3 = sum(hm[:3]) / 3
        slot = [0.0] * 5; sn = [0] * 5
        for (_, sl), x in zip(tr, g): slot[sl] += x; sn[sl] += 1
        st[i] = dict(mean=sum(g) / len(g), pos=100 * sum(1 for x in g if x > 0) / len(g), top3=top3,
                     flex=100 * sum(1 for x in hm if top3 > 0 and x >= FLEX_SHARE * top3) / len(hm),
                     best=hosts[max(by, key=lambda h: sum(by[h]) / len(by[h]))],
                     slots=[round(slot[k] / sn[k], 2) for k in range(5)])
    best_mean = max(v["mean"] for v in st.values())
    best_top3 = max(v["top3"] for v in st.values())
    r = {}
    for i, v in st.items():
        o = dict(effect=round(max(0.0, 100 * v["mean"] / best_mean), 1), reliability=round(v["pos"], 1),
                 flexibility=round(v["flex"], 1), synergy=round(max(0.0, 100 * v["top3"] / best_top3), 1))
        o["value"] = max(0.1, round(0.4 * o["effect"] + 0.2 * (o["reliability"] + o["flexibility"] + o["synergy"]), 1))   # 0 = unranked on the site
        r[i] = o
    name = {s["id"]: s["name"] for s in sups}
    rank = sorted(r, key=lambda i: (-r[i]["value"], name[i]))
    tiers = [t for t in meta["tiers"] if "supportTo" in t]
    pos = {}
    for n, i in enumerate(rank):   # equal value = same rank (§5.4) → same tier
        pos[i] = pos[rank[n - 1]] if n and r[i]["value"] == r[rank[n - 1]]["value"] else n + 1
        r[i]["tier"] = next(t["name"] for t in tiers if pos[i] <= t["supportTo"])
    old = {s["id"]: s.get("tier", "") for s in sups}
    print("| # | Support | Tier | Value | Effect | Reliab. | Flex. | Synergy | gain | best 3 | best host | gain by slot 1–5 |")
    print("|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|")
    for i in rank:
        o, v = r[i], st[i]
        print(f"| {pos[i]} | {name[i]} | {o['tier']} | {o['value']} | {o['effect']} | {o['reliability']} | {o['flexibility']} | {o['synergy']} "
              f"| {v['mean']:.2f} | {v['top3']:.2f} | {v['best']} | {' / '.join('%g' % x for x in v['slots'])} |")
    if not write: return
    for s in sups:
        i = s["id"]
        s["prevTier"] = old[i]
        s["scores"] = {k: r[i][k] for k in ("effect", "reliability", "flexibility", "synergy", "value")}
        s["tier"] = r[i]["tier"]
        s["updated"] = TODAY
    open(spath, "w").write(json.dumps(sups, ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sim")
    ap.add_argument("--score")
    ap.add_argument("--write", action="store_true")
    o = ap.parse_args()
    if o.sim: simulate(o.sim)
    if o.score: score(o.score, o.write)


if __name__ == "__main__":
    main()
