"""Battle skills for the cards not in data/battle.json yet (PROGRESS §14 · step ④ · 2026-11-05).

Reads each card's ability text (data/cards.json + data/pending/cards.json) with the same sentence reader the matchup
simulator uses (tools/matchup_sim.py parse) plus a few sentences only this tool knows, and writes the fields js/battle.js
fights with into data/battle.json "cards". A sentence the engine can't fight with yet goes into the card's "todo" list
(the fight still runs, the result says "Partly simulated"). Cards already in battle.json are never changed.
Deck links ("With X in the deck, both get …", "Every other card in your deck gets …") are not battle fields: js/deckbuff.js
already puts them into the numbers before the fight.

    python3 tools/battle_skills.py            # write data/battle.json (+ the groups the "against X cards" skills need)
    python3 tools/battle_skills.py --dry      # print what it would do
"""
import argparse, json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import matchup_sim as M  # noqa: E402

F = r"([\d.]+)"
# sentences the matchup reader doesn't know (seen in the pending cards' texts)
EXTRA = [
    (r"Loses " + F + r"% of its max HP every attack", lambda m: {"selfDmg": p(m[1])}),
    (r"Its first attack of the fight does " + F + r"x damage", lambda m: {"firstFight": float(m[1])}),
    (F + r"% chance per hit to Weaken the enemy \(" + F + r"% less damage for the fight\)", lambda m: {"weakenHit": {"p": p(m[1]), "v": p(m[2])}}),
    (F + r"% chance to (?:counter-attack|strike back) when hit \(" + F + r"x damage\)", lambda m: {"counter": {"p": p(m[1]), "m": float(m[2])}}),
    (r"Heals " + F + r"% of its max HP after each kill", lambda m: {"killHeal": p(m[1])}),
    (r"When it comes in, Stuns the enemy in front for (\d+) turns?", lambda m: {"entryStun": int(m[1])}),
    (F + r"% chance per hit to Seal the enemy's ability for (\d+) turns?", lambda m: {"seal": {"p": p(m[1]), "turns": int(m[2])}}),
    (r"Each hit lowers the enemy's damage by " + F + r"% \(up to (\d+) times\)", lambda m: {"weakenHit": {"p": 1, "v": p(m[1]), "n": int(m[2])}}),
    (r"From its (\d+)\w\w attack on: \+" + F + r"% damage", lambda m: {"dmgFrom": {"n": int(m[1]), "v": p(m[2])}}),
    (r"Blocks the first hit completely", lambda m: {"block": 1}),
    (r"Copies the ability of every (?:new )?enemy card it faces", lambda m: {"copy": 1}),
    (F + r"x against (\w+) cards", lambda m: {"vs": {"group": group_name(m[2].lower()), "m": float(m[1])}}),
]


def p(x):
    return round(float(x) / 100, 4)


def ability(c):
    a = c.get("passive") or {}
    return a if a.get("name") else (c.get("skill") or {})


def sentences(desc):
    return re.split(r"(?<!\bMr\.)(?<!\bDr\.)(?<=\.)\s+", desc.strip())


def extra(s):
    s = re.sub(r"^[\w' .-]+: ", "", s.rstrip("."))
    for pat, make in EXTRA:
        m = re.fullmatch(pat, s)
        if m: return make(m)
    return None


def group_name(g):
    return g[:1].upper() + g[1:]


def convert(c):
    """card → (fields, todo sentences, groups used)"""
    desc = ability(c).get("desc") or ""
    a = M.parse(desc)
    k, todo, groups = {}, [], set()
    for s in a.pop("unknown", []):
        e = extra(s)
        if e:
            k.update(e)
            if "vs" in e: groups.add(e["vs"]["group"])
        else: todo.append(s.strip())
    # deck links: "With X in the deck …" is in js/deckbuff.js already · "When X falls …" / "takes the killing blow for X" happen in a fight → todo
    todo += [s.strip() for s in a.pop("team_link", []) if not re.search(r"in (?:the|your) deck", s)]
    if "dodge" in a: k["dodge"] = a["dodge"]
    if a.get("ignore"): k["ignore"] = 1
    if a.get("undodgeable"): k["sure"] = 1
    if "bench" in a: k["splash"] = a["bench"]
    if "bench_first" in a: k["splashFirst"] = a["bench_first"]
    if "enemy_less" in a: k["weaken"] = round(1 - a["enemy_less"], 4)
    if "behind" in a: k["behind"] = {"every": a["behind"][0], "m": a["behind"][1]}
    for f in ("revive", "regen", "lifesteal", "dr", "reflect"):
        if f in a: k[f] = a[f]
    if a.get("survive"): k["survive"] = 1
    if "kill_gain" in a: k["killGain"] = a["kill_gain"]
    if "dr_until" in a: k["early"] = {"dr": a["dr_until"][0], "n": a["dr_until"][1]}
    if "adapt" in a: v, n = a["adapt"]; k["adapt"] = v if n == 3 else {"v": v, "n": n}
    if a.get("cc_immune"): k["noCC"] = 1
    if a.get("status_immune"): k["noDebuff"] = 1
    if a.get("burn_immune"): k["noDot"] = ["burn"]
    if "every_n" in a: k["everyN"] = {"n": a["every_n"][0], "m": a["every_n"][1]}
    if "first_mult" in a: k["first"] = a["first_mult"]
    if "seal_first" in a: k["sealFirst"] = a["seal_first"]
    if "hit_ramp" in a: k["onHitAtk"] = a["hit_ramp"]
    if "turn_ramp" in a: k["perTurn"] = {"v": a["turn_ramp"][0], "n": min(a["turn_ramp"][1], 999)}
    if "flat" in a: k["dmg"] = round(a["flat"], 4)
    if "vs_group" in a: g = group_name(a["vs_group"][0]); groups.add(g); k["vs"] = {"group": g, "m": round(1 + a["vs_group"][1], 4)}
    if "weak_group" in a: g = group_name(a["weak_group"][0]); groups.add(g); k["weakTo"] = {"group": g, "m": a["weak_group"][1]}
    if a.get("copy"): k["copy"] = 1
    if "execute" in a: k["execute"] = {"p": 1, "under": a["execute"]}
    if "instakill" in a: k["execute"] = {"p": a["instakill"][0], "under": a["instakill"][1]}
    if "confuse" in a: k["confuse"] = {"p": a["confuse"]}
    if "low_hp" in a: k["lowHp"] = {"under": a["low_hp"][0], "dmg": a["low_hp"][1]}
    if "double" in a: k["double"] = {"p": a["double"][0], "m": a["double"][1]}
    cc = []
    if "stun" in a: cc.append({"p": a["stun"][0], "turns": a["stun"][1], "lose": 1, "kind": "Stun"})
    if "paralyze" in a: cc.append({"p": a["paralyze"][0], "turns": a["paralyze"][1], "lose": 0.5, "kind": "Paralyze"})
    if "freeze" in a: cc.append({"p": a["freeze"][0], "turns": a["freeze"][1], "lose": 1, "kind": "Freeze"})
    if cc: k["stun"] = cc[0]
    for x in cc[1:]: todo.append("%d%% chance per hit to %s (only one stun-like effect per card is simulated)" % (round(x["p"] * 100), x["kind"]))
    if "vs_frozen" in a: k["vsFrozen"] = a["vs_frozen"]
    if "seal_chance" in a: k["seal"] = {"p": a["seal_chance"][0], "turns": a["seal_chance"][1]}
    if "counter" in a and "counter" not in k: k["counter"] = a["counter"]
    if "block" in a: k["block"] = a["block"]
    if "crit" in a: k["crit"] = [a["crit"][0], a["crit"][1]]
    dots = []
    if "fire" in a: dots.append({"kind": "burn", "name": "fire", "add": 1, "pct": 0.05, "max": 1, "turns": a["fire"], "all": 1})
    for kind, add, pct, mx, turns in a.get("dots", []): dots.append({"kind": kind, "add": add, "pct": pct, "max": mx, "turns": turns})
    if "black_flame" in a: dots.append({"kind": "burn", "name": "black flame", "add": 1, "pct": a["black_flame"], "max": 1, "turns": 999})
    if "crush" in a: dots.append({"kind": "bleed", "name": "crush", "add": 1, "pct": a["crush"][0], "max": 1, "turns": a["crush"][1]})
    if dots: k["dot"] = dots[0] if len(dots) == 1 else dots
    if "maxhp_hit" in a: k["maxHp"] = a["maxhp_hit"]
    if "mark" in a: k["markHit"] = {"p": a["mark"][0], "v": a["mark"][1]}
    if "black_flash" in a: b = a["black_flash"]; k["bf"] = {"p": b[0], "per": b[1], "max": b[2], "m": b[3]}
    if "raise" in a: k["arise"] = a["raise"]
    if "thorns" in a: kind, add, pct, mx, turns = a["thorns"]; k["thorns"] = {"kind": kind, "add": add, "pct": pct, "max": mx, "turns": turns}
    if "explode" in a: k["explode"] = a["explode"]
    # not in the engine yet → todo (the game's words)
    for s in sentences(desc):
        if UNSUPPORTED & set(parse_one(s)): todo.append(s.strip())
    return k, todo, groups


UNSUPPORTED = {"doom", "skip_weaker", "swap", "bench_heal", "shadow_boost"}


def parse_one(s):
    d = {}
    if not M.one(d, s): M.one(d, re.sub(r"^[A-Z][\w' .-]*: ", "", s))
    return d


def build_groups(cards, names, old):
    """group name → card ids: the matchup simulator's lists + every card whose name says it (a guess, like Sun / Demon)"""
    out = {}
    for g in sorted(names | {"Sun", "Demon"}):
        low = g.lower()
        ids = set(old.get(g, [])) | set(M.GROUPS.get(low, set()))
        for c in cards:
            n = (c["id"] + " " + c["name"]).lower()
            if (low == "demon" and M.in_group(c, "demon")) or re.search(r"\b" + re.escape(low) + r"\b", n.replace("-", " ")): ids.add(c["id"])
        out[g] = sorted(ids)
    return out


# supports (written by hand from each text · 2026-11-05): only what happens in a fight · "+x% damage / max HP" with no
# condition is in js/deckbuff.js already, so a support that only does that has no entry here · "$n" = its n-th value,
# "1+$n" = 1 + that · legacy one-word entries (teamHeal, lifesteal, hitHeal, dodge, mark, lucky, echo, onHitAtk) = the
# engine's support effects · "todo" = the part the engine can't do yet (status turns not in the text = 3, like the simulator)
DOT = lambda kind: {"kind": kind, "add": 1, "pct": "$0", "max": 3, "turns": 3}
SUPPORT = {
    "flying-cat-partner": {"double": {"p": "$0", "m": 1}},
    "desert-princess": {"double": {"p": "$0", "m": 1}},
    "fox-kit-trickster": {"dot": DOT("burn")},
    "gun-captain": {"dot": DOT("burn")},
    "doctor-demon": {"dot": DOT("poison")},
    "inventor-girl": {"todo": ["every fight a random boost to its damage or its max HP"]},
    "doctor-hunter": {"entryHit": "$0"},
    "toad-boss": {"entryHit": "$0"},
    "food-mage": {"killHeal": "$0"},
    "fox-mask-mentor": {"perTurn": {"v": "$0", "n": 5}},
    "turtle-hermit": {"perTurn": {"v": "$1", "n": 5}},
    "lonely-crimson-mage": {"stun": {"p": "$0", "turns": 2, "lose": 0.5, "kind": "Paralyze"}},
    "weather-witch-navigator": {"stun": {"p": "$0", "turns": 2, "lose": 0.5, "kind": "Paralyze"}},
    "zero-gravity-hero": {"stun": {"p": "$0", "turns": 1, "lose": 1, "kind": "Stun"}},
    "half-elf-ice-mage": {"stun": {"p": "$0", "turns": 1, "lose": 1, "kind": "Freeze"}},
    "great-spirit-cat": {"stun": {"p": "$0", "turns": 1, "lose": 1, "kind": "Freeze"}, "vsFrozen": "1+$1"},   # "does {1}% more damage to frozen enemies" (on top of the rule's 25% for any frozen enemy)
    "wish-granter": {"reviveChance": {"p": 1, "v": "$1"}, "regen": "$0", "todo": ["blocks the first 2 debuffs that would hit it each fight"]},
    "flower-hand-scholar": {"splash": "$0", "stun": {"p": "$1", "turns": 1, "lose": 1, "kind": "Stun"}},
    "master-spy-father": {"crit": ["$0", 2]},
    "hawks-eye-sniper": {"crit": ["$0", 2]},
    "mind-transfer-kunoichi": {"confuse": {"p": "$0"}},
    "geass-strategist": {"confuse": {"p": "$0"}},
    "namekian-healer": {"regen": "$0"},
    "blue-healer-cat-knight": {"regen": "$0"},
    "goddess-princess": {"noCC": 1, "regen": "$0"},
    "spirit-ferry-girl": {"b": {"lucky": "$0"}, "regen": "$1"},
    "nen-teacher": {"dr": "$0"},
    "nine-tails-fox": {"dr": "$2"},
    "dwarf-warrior-guard": {"dr": "$0", "reflect": "$1"},
    "rifle-girl": {"firstFight": "1+$0"},
    "hellsing-commander": {"first": "1+$0"},
    "song-sorceress": {"everyN": {"n": 2, "m": "1+$0"}},
    "cherry-blossom-medic": {"everyN": {"n": 3, "m": "1+$0"}},
    "supreme-kai": {"dmgFrom": {"n": 3, "v": "$0"}},
    "hero-of-legend": {"lowHp": {"under": 0.5, "dmg": "$0"}},
    "salt-splash-mentor": {"weakenHit": {"p": "$0", "v": "$1", "n": 1}},
    "gentle-palm-heiress": {"weakenHit": {"p": 1, "v": "$0", "n": 5}},
    "sweet-tooth-detective": {"weakenHit": {"p": 1, "v": "$0", "n": 4}},
    "second-princess": {"maxHp": "$0"},
    "senzu-bean-cat": {"lowHeal": {"under": 0.3, "v": "$0"}},
    "reindeer-doctor": {"lowHeal": {"under": 0.4, "v": "$0"}},
    "slug-princess-hokage": {"lowHeal": {"under": 0.3, "v": "$0"}},
    "rewind-girl": {"lowHeal": {"under": 0.2, "v": "$0"}},
    "silent-healer-elf": "teamHeal",
    "healing-hero": "teamHeal",
    "gentle-priest": "teamHeal",
    "boomerang-demon-slayer": "echo",
    "wind-tunnel-monk": "lifesteal",
    "reverse-cursed-doctor": "hitHeal",
    "foresight-hero": "dodge",
    "mind-reader-child": "dodge",   # "its normal attacks have x% chance to miss" = a dodge for the supported card
    "titan-scientist": "mark",
    "notebook-genius": {"b": {"mark": "$0"}, "execute": {"p": 1, "under": 0.06}},
    "angel-attendant": {"b": {"dodge": "$0"}},
    "fate-thread-witch": {"early": {"dr": "$0", "n": 1}, "b": {"dodge": "$1"}},
    "future-sight-dog": {"early": {"dr": "$0", "n": 2}},
    "crusader-tank": {"onHitHp": "$0", "onHitAtk": "$1"},
    "erasure-teacher": {"seal": {"p": "$0", "turns": 1}},
    "sacred-arrow-priestess": {"sealFirst": 1},
    "shadow-strategist": {"entryStun": {"p": "$0", "turns": 1}},
    "useless-goddess": {"reviveChance": {"p": "$0", "v": "$1"}},
    "chainsaw-pup-devil": {"reviveChance": {"p": "$0", "v": "$1"}},
    "immortal-witch": {"reviveChance": {"p": "$0", "v": "$1"}},
    "eternal-wish-dragon": {"reviveChance": {"p": "$0", "v": "$2"}},
    "flower-healer-captain": {"regenChance": {"p": "$0", "v": "$1"}},
    "teacher-alchemist": {"counter": "$0"},
    "dark-king-coach": {"counter": "$0", "sure": 1},
    "ancient-archmage": {"ignore": 1},
    "shapeshift-actor": {"addFoeAtk": "$0"},
    "genius-inventor": {"shieldStart": "$0"},
    "golden-shield-healer": {"shieldStart": "$0"},
    "sister-of-prayer": {"shieldStart": "$0", "todo": ["the first debuff that would hit it each fight is blocked"]},
    "serpent-sin-mage": {"dr": "$0", "todo": ["the first 3 debuffs that would hit it each fight are blocked"]},
    "little-witch": {"dr": "$0", "todo": ["the first 2 debuffs that would hit it each fight are blocked"]},
    "spirit-medium-granny": {"dr": "$0", "todo": ["protects the whole deck from splash, card-behind and bench hits"]},
    "pacifier-prince": {"todo": ["once per fight, a hit bigger than 20% of its HP is weaker"]},
    "water-king-teacher": {"todo": ["every 3rd turn a shield"]},
    "gem-mage": {"todo": ["a gem that explodes next turn"]},
    "library-spirit": {"dot": {"kind": "bleed", "name": "leech", "add": 1, "pct": "$0", "max": 1, "turns": 3}, "todo": ["the leeched HP goes back to it"]},
    "hat-and-clogs-shopkeeper": {"todo": ["blinds the enemy in front when it comes in (its next 3 attacks may miss)"]},
    "first-master-fairy": {"todo": ["its first hit blasts every enemy card for x% of its max HP"]},
    "sky-dragon-healer": {"todo": ["while it waits on the bench, the card in front heals"]},
}
# only "+x% damage / max HP" (js/deckbuff.js) or nothing in a fight (gems) → no entry
STAT_ONLY = {"automail-mechanic", "navigation-pixie", "foundation-gentleman", "star-key-mage", "ogre-shrine-princess",
             "corps-master", "guild-master-giant", "true-queen", "charge-commander", "shadow-garden-strategist"}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dry", action="store_true"); args = ap.parse_args()
    path = os.path.join(ROOT, "data", "battle.json")
    bd = json.load(open(path, encoding="utf-8"))
    load = lambda f: (lambda d: d["cards"] if isinstance(d, dict) else d)(json.load(open(os.path.join(ROOT, "data", f), encoding="utf-8")))
    cards = load("cards.json") + load("pending/cards.json")
    added, todo_n, kinds, groups = 0, 0, Counter(), set()
    for c in cards:
        if c["id"] in bd["cards"]: continue
        k, todo, gs = convert(c)
        groups |= gs
        if todo: k["todo"] = todo; todo_n += 1
        bd["cards"][c["id"]] = k; added += 1
        kinds.update(x for x in k if x != "todo")
    sups = (lambda d: d["support"] if isinstance(d, dict) else d)(json.load(open(os.path.join(ROOT, "data", "pending", "support.json"), encoding="utf-8")))
    sadd, missing = 0, []
    for sp in sups:
        if sp["id"] in bd["support"] or sp["id"] in STAT_ONLY: continue
        if sp["id"] in SUPPORT: bd["support"][sp["id"]] = SUPPORT[sp["id"]]; sadd += 1
        else: missing.append(sp["id"])
    print("supports added %d · stat only %d · not mapped: %s" % (sadd, len(STAT_ONLY), missing or "none"))
    g = build_groups(cards, groups, {k: v for k, v in bd.get("groups", {}).items() if isinstance(v, list)})
    bd["updated"] = "2026-11-05"
    bd["groups"] = {"guess": "group = the cards whose name says it + a few by hand (tools/matchup_sim.py GROUPS) · not checked in the game", **g}
    print("added %d cards · %d with a todo · fields: %s" % (added, todo_n, ", ".join("%s %d" % x for x in kinds.most_common())))
    print("groups:", {k: len(v) for k, v in g.items()})
    if args.dry: return
    write(path, bd)


def write(path, bd):
    """one line per card / support (like the file was written by hand)"""
    def one(v):   # { "a": 1, "b": [0.2, 2.5] } like the hand-written lines
        if isinstance(v, dict): return "{ " + ", ".join("%s: %s" % (json.dumps(k, ensure_ascii=False), one(x)) for k, x in v.items()) + " }" if v else "{}"
        if isinstance(v, list): return "[" + ", ".join(one(x) for x in v) + "]"
        return json.dumps(v, ensure_ascii=False)
    out = ["{"]
    keys = list(bd.keys())
    for i, key in enumerate(keys):
        v, comma = bd[key], "," if i < len(keys) - 1 else ""
        if key in ("cards", "support", "traits", "groups") and isinstance(v, dict):
            out.append('  "%s": {' % key)
            items = list(v.items())
            for j, (n, x) in enumerate(items): out.append('    "%s": %s%s' % (n, one(x), "," if j < len(items) - 1 else ""))
            out.append("  }" + comma)
        elif key == "clip" and isinstance(v, dict):
            out.append('  "%s": {' % key)
            items = list(v.items())
            for j, (n, x) in enumerate(items): out.append('    "%s": %s%s' % (n, one(x), "," if j < len(items) - 1 else ""))
            out.append("  }" + comma)
        else: out.append('  "%s": %s%s' % (key, one(v), comma))
    out.append("}")
    open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
