#!/usr/bin/env python3
"""Rank the cards and fill the Utility row (PROGRESS ▶️ แผน 2026-10-30 ข้อ 1 · §5.3 + §7 B ข้อ 8).

    python3 tools/matchup_sim.py --ids <48 ranked + utility candidates> --runs 2000 --out <scratch>/sim.json
    python3 tools/matchup_sim.py --ids <same> --runs 2000 --equal --out <scratch>/eq.json
    python3 tools/rank_cards.py <scratch>/sim.json <scratch>/eq.json                 # tables only
    python3 tools/rank_cards.py <scratch>/sim.json <scratch>/eq.json --write         # + data/cards.json
    (--util N = how many Utility cards · default 10)

1. ranked = every simulated card with Normal odds ≥ 1 in MIN_ODDS (must be meta.rankTop cards)
2. scores inside those cards only: ATK / HP percentile, Matchup, Passive (= Skill), Team, Overall
3. tier by rank (meta.json → tiers[].to: last rank of each tier · not by score)
4. Utility = the other simulated cards whose ability lifts the whole deck, best `utilGain` first:
   scores against the ranked cards (group = ranked + itself) · tier "Utility" · utilGain = % deck power gain
5. --write: scores, tier, prevTier (tier before this run, "" = was unranked), beats / losesTo, utilGain, updated
   · cards that drop out lose tier + scores (prevTier kept)
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matchup_sim import parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-31"
MIN_ODDS = 500_000_000      # owner 2026-10-30: rank every card at 1 in 500M or rarer (Normal)
INC = 0.15                  # an equal card takes ATK / HP = 15% of its max HP per enemy hit (HP ≈ 6.67 × ATK for these cards)
GROUP_BUFF = re.compile(r"(\w[\w ]*?) cards in your deck get \+([\d.]+)% damage( and HP)?")
GROUPS = {"shadow garden": {"atomic-shadow-lord"}, "nazarick": {"undead-overlord-king"}}   # group members among the cards that matter (guessed from name · like matchup_sim GROUPS)


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
    if "bench_heal" in a: t += 4 + 100 * a["bench_heal"]
    if a.get("team_link") or "shadow_boost" in a: t += 3
    if "kill_gain" in a: t += 4 + 20 * a["kill_gain"]
    if "raise" in a: t += 8
    if "swap" in a: t += 4
    if "doom" in a: t += 10
    if "skip_weaker" in a: t += 8
    if "copy" in a: t += 4
    if a.get("dr", 0) >= 0.15 or "block" in a or "revive" in a or "survive" in a or a.get("regen", 0) >= 0.04 or "dr_until" in a: t += 4
    return min(97.0, t)


def score(i, group, cards, sc, esc):
    """scores of card i against the cards in group (i may or may not be in it)."""
    pool = group if i in group else group + [i]
    def pctl(key):
        return 100.0 * sum(1 for j in pool if key(cards[j]) <= key(cards[i])) / len(pool)
    a = parse(cards[i]["passive"]["desc"])
    others = [j for j in group if j != i]
    m = sum(sc[(i, j)] for j in others) / len(others)
    a1 = sum(esc[(i, j)] for j in others) / len(others)
    tp = team_pts(a)
    pas = round(max(40.0, min(98.0, 25 + 0.75 * a1 + 0.7 * (tp - 60))))
    o = dict(atk=round(pctl(lambda c: c["base"]["atk"]), 1), hp=round(pctl(lambda c: c["base"]["hp"]), 1),
             passive=pas, skill=pas, matchup=round(m, 1), team=round(tp))
    o["overall"] = round(0.125 * o["atk"] + 0.125 * o["hp"] + 0.15 * (o["passive"] + o["skill"]) + 0.25 * o["matchup"] + 0.2 * o["team"], 1)
    o["a1"] = round(a1, 1)
    return o


def util_gain(u, deck, cards):
    """% deck power gain when u joins deck (4 cards · u in slot 5, so it sits on the bench behind all of them).
    deck power = Σ ATK × HP × damage mult × HP mult (sequential 1-on-1 fights: damage dealt ≈ ATK × turns alive)
    · "Every other card … +X% damage" → others ×(1+X) · "Every enemy card starts with X% less damage" → everyone's HP ×1/(1−X)
    · "While on the bench, heals the card in front X%" → others' HP ×1/(1 − X/INC) · group buffs count only for group members in deck."""
    a = parse(cards[u]["passive"]["desc"])
    pw = lambda c: c["base"]["atk"] * c["base"]["hp"]
    before = sum(pw(cards[j]) for j in deck)
    hp_all = 1 / (1 - a.get("enemy_less", 0))
    other = (1 + a.get("team_dmg", 0)) * hp_all / (1 - a.get("bench_heal", 0) / INC)
    after = pw(cards[u]) * hp_all
    gm = GROUP_BUFF.search(cards[u]["passive"]["desc"])
    for j in deck:
        x = other
        if gm and j in GROUPS.get(gm[1].lower(), ()):
            x *= (1 + float(gm[2]) / 100) ** (2 if gm[3] else 1)
        after += pw(cards[j]) * x
    return round(100 * (after / before - 1), 1)


def main():
    sim_f, eq_f = sys.argv[1], sys.argv[2]
    write = "--write" in sys.argv
    n_util = int(sys.argv[sys.argv.index("--util") + 1]) if "--util" in sys.argv else 10
    meta = json.load(open(os.path.join(ROOT, "data/meta.json")))
    rank_tiers = [t for t in meta["tiers"] if "to" in t]
    path = os.path.join(ROOT, "data/cards.json")
    raw = open(path).read()
    lst = json.loads(raw)
    cards = {c["id"]: c for c in lst}
    pool, sc, wr = load(sim_f)
    _, esc, _ = load(eq_f)

    ids = [i for i in pool if cards[i]["base"]["odds"] >= MIN_ODDS]
    if len(ids) != meta["rankTop"]: sys.exit(f"{len(ids)} cards at 1 in {MIN_ODDS:,}+ in the sim, meta.rankTop is {meta['rankTop']}")
    r = {i: score(i, ids, cards, sc, esc) for i in ids}
    rank = sorted(ids, key=lambda i: (-r[i]["overall"], cards[i]["name"]))
    for n, i in enumerate(rank):
        r[i]["tier"] = next(t["name"] for t in rank_tiers if n + 1 <= t["to"])

    deck = rank[:4]
    fifth = 100 * cards[rank[4]]["base"]["atk"] * cards[rank[4]]["base"]["hp"] / sum(cards[j]["base"]["atk"] * cards[j]["base"]["hp"] for j in deck)
    cand = []
    for u in pool:
        if u in r: continue
        a = parse(cards[u]["passive"]["desc"])
        if not ({"team_dmg", "enemy_less", "bench_heal", "shadow_boost"} & a.keys() or GROUP_BUFF.search(cards[u]["passive"]["desc"])): continue
        cand.append((util_gain(u, deck, cards), u))
    cand.sort(key=lambda x: (-x[0], cards[x[1]]["name"]))
    util = [u for g, u in cand[:n_util] if g > 0]
    for g, u in cand:
        if u in util:
            r[u] = score(u, ids, cards, sc, esc); r[u]["tier"] = "Utility"; r[u]["utilGain"] = g

    old = {c["id"]: c.get("tier", "") for c in lst}
    print("| # | Card | Tier (was) | Overall | ATK pct | HP pct | Passive (A1) | Matchup | Team | odds | beats/loses |")
    print("|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|")
    for n, i in enumerate(rank):
        o = r[i]
        b = sum(1 for j in ids if j != i and wr[(i, j)] > 0.5); l = sum(1 for j in ids if j != i and wr[(i, j)] < 0.5)
        print(f"| {n+1} | {cards[i]['name']} | {o['tier']} ({old[i] or '–'}) | {o['overall']} | {o['atk']} | {o['hp']} | {o['passive']} ({o['a1']}) | {o['matchup']} | {o['team']} | {cards[i]['base']['odds']:.3g} | {b}/{l} |")
    print(f"\nreference deck (top 4): {', '.join(cards[j]['name'] for j in deck)} · the 5th card would add {fifth:.1f}%")
    print("\n| Utility | utilGain % | Overall | Passive (A1) | Matchup | Team | odds | picked |")
    print("|---|---:|---:|---:|---:|---:|---:|---|")
    for g, u in cand:
        o = r.get(u) or score(u, ids, cards, sc, esc)
        print(f"| {cards[u]['name']} | {g} | {o['overall']} | {o['passive']} ({o['a1']}) | {o['matchup']} | {o['team']} | {cards[u]['base']['odds']:.3g} | {'✓' if u in util else ''} |")
    print("dropped:", [i for i in old if old[i] and i not in r])
    if not write: return
    for c in lst:
        i = c["id"]
        if i not in r and not old[i]: continue
        c["prevTier"] = old[i]
        if i not in r:
            c["tier"] = ""
            c["scores"] = {k: 0 for k in ("atk", "hp", "passive", "skill", "matchup", "team", "overall")}
            for k in ("beats", "losesTo"): c.pop(k, None)
            c.pop("utilGain", None)
        else:
            o = r[i]
            c["scores"] = {k: o[k] for k in ("atk", "hp", "passive", "skill", "matchup", "team", "overall")}
            c["tier"] = o["tier"]
            c["beats"] = [j for j in ids if j != i and wr[(i, j)] > 0.5]
            c["losesTo"] = [j for j in ids if j != i and wr[(i, j)] < 0.5]
            if "utilGain" in o: c["utilGain"] = o["utilGain"]
            else: c.pop("utilGain", None)
        c["updated"] = TODAY
    open(path, "w").write(json.dumps(lst, ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""))


if __name__ == "__main__":
    main()
