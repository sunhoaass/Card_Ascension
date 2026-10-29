#!/usr/bin/env python3
"""Pick the rankTop (50) cards and score them (PROGRESS §5.3 + §7 B ข้อ 8 · "การ์ดทั้งเกม ③").

    python3 tools/matchup_sim.py --top 72 --runs 2000 --out <scratch>/sim.json
    python3 tools/matchup_sim.py --top 72 --runs 2000 --equal --out <scratch>/eq.json
    python3 tools/rank_cards.py <scratch>/sim.json <scratch>/eq.json            # table only
    python3 tools/rank_cards.py <scratch>/sim.json <scratch>/eq.json --write    # + data/cards.json

1. provisional Overall inside the simulated pool → best rankTop cards
2. real scores inside those cards only: ATK / HP percentile, Matchup, Passive (= Skill), Team, Overall, tier
3. --write: scores, tier, beats / losesTo, updated on the ranked cards · every other card must already be unranked
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matchup_sim import parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-29"


def load(f):
    d = json.load(open(f)); sc = {}; wr = {}
    for a, b, s, w in d["pairs"]:
        sc[(a, b)] = s; sc[(b, a)] = 100 - s; wr[(a, b)] = w; wr[(b, a)] = 1 - w
    return d["ids"], sc, wr


def team_pts(a):
    """Team rubric (§7 B ข้อ 4 + 8): how much the ability helps the rest of the deck."""
    t = 60.0
    if "bench" in a: t += 12 * a["bench"] / 0.2
    if "bench_first" in a: t += 6
    if "behind" in a: t += 5
    if "fire" in a: t += 6
    if "enemy_less" in a: t += 50 * a["enemy_less"]
    if "team_dmg" in a: t += 60 * a["team_dmg"]
    if a.get("team_link"): t += 3
    if "kill_gain" in a: t += 4 + 20 * a["kill_gain"]
    if "raise" in a: t += 8
    if "swap" in a: t += 4
    if "doom" in a: t += 10
    if "skip_weaker" in a: t += 8
    if "copy" in a: t += 4
    if a.get("dr", 0) >= 0.15 or "block" in a or "revive" in a or "survive" in a or a.get("regen", 0) >= 0.04 or "dr_until" in a: t += 4
    return min(97.0, t)


def score(ids, cards, sc, esc, tiers):
    def pctl(key):
        v = {i: key(cards[i]) for i in ids}
        return {i: 100.0 * sum(1 for j in ids if v[j] <= v[i]) / len(ids) for i in ids}
    atk = pctl(lambda c: c["base"]["atk"]); hp = pctl(lambda c: c["base"]["hp"])
    out = {}
    for i in ids:
        a = parse(cards[i]["passive"]["desc"])
        others = [j for j in ids if j != i]
        m = sum(sc[(i, j)] for j in others) / len(others)
        a1 = sum(esc[(i, j)] for j in others) / len(others)
        tm = round(team_pts(a))
        pas = round(max(40.0, min(98.0, 25 + 0.75 * a1 + 0.7 * (team_pts(a) - 60))))
        o = dict(atk=round(atk[i], 1), hp=round(hp[i], 1), passive=pas, skill=pas, matchup=round(m, 1), team=tm)
        o["overall"] = round(0.125 * o["atk"] + 0.125 * o["hp"] + 0.15 * (o["passive"] + o["skill"]) + 0.25 * o["matchup"] + 0.2 * o["team"], 1)
        o["tier"] = next(t["name"] for t in tiers if o["overall"] >= t["min"])
        o["a1"] = round(a1, 1)
        out[i] = o
    return out


def main():
    sim_f, eq_f = sys.argv[1], sys.argv[2]
    write = "--write" in sys.argv
    meta = json.load(open(os.path.join(ROOT, "data/meta.json")))
    tiers = sorted(meta["tiers"], key=lambda t: -t["min"])
    path = os.path.join(ROOT, "data/cards.json")
    raw = open(path).read()
    lst = json.loads(raw)
    cards = {c["id"]: c for c in lst}
    pool, sc, wr = load(sim_f)
    _, esc, _ = load(eq_f)
    prov = score(pool, cards, sc, esc, tiers)
    top = set(sorted(pool, key=lambda i: -prov[i]["overall"])[: meta["rankTop"]])
    ids = [i for i in pool if i in top]  # stat order
    r = score(ids, cards, sc, esc, tiers)
    rank = sorted(ids, key=lambda i: -r[i]["overall"])
    print("| # | Card | Tier | Overall | ATK/HP pct | Passive (A1) | Matchup | Team | stat # | beats/loses |")
    for n, i in enumerate(rank):
        o = r[i]
        b = sum(1 for j in ids if j != i and wr[(i, j)] > 0.5); l = sum(1 for j in ids if j != i and wr[(i, j)] < 0.5)
        print(f"| {n+1} | {cards[i]['name']} | {o['tier']} | {o['overall']} | {o['atk']} | {o['passive']} ({o['a1']}) | {o['matchup']} | {o['team']} | {pool.index(i)+1} | {b}/{l} |")
    print("in from outside the stat top:", [i for i in ids if pool.index(i) >= meta["rankTop"]])
    print("out of the stat top:", [i for i in pool[: meta["rankTop"]] if i not in top])
    if not write: return
    for c in lst:
        i = c["id"]
        if i not in r:
            if c.get("tier") or c["scores"].get("overall"):
                sys.exit(f"{i} is ranked but not in the new top: unrank it first")
            continue
        o = r[i]
        c["scores"] = {k: o[k] for k in ("atk", "hp", "passive", "skill", "matchup", "team", "overall")}
        c["tier"] = o["tier"]
        c["beats"] = [j for j in ids if j != i and wr[(i, j)] > 0.5]
        c["losesTo"] = [j for j in ids if j != i and wr[(i, j)] < 0.5]
        c["updated"] = TODAY
    open(path, "w").write(json.dumps(lst, ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""))


if __name__ == "__main__":
    main()
