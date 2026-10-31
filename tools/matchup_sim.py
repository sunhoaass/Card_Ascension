#!/usr/bin/env python3
"""1-on-1 matchup simulator for ranking cards (PROGRESS §7 B · "การ์ดทั้งเกม ③").

Reads each card's ability text (data/cards.json → passive.desc), turns the known sentences
into effects, and plays every pair of the given cards against each other.

    python3 tools/matchup_sim.py --top 70 --runs 2000 --out <scratchpad>/sim.json
    python3 tools/matchup_sim.py --ids a,b,c ... --runs 2000 --out ...
    python3 tools/matchup_sim.py --parse --top 70        # show what was understood per card

Battle rules (same assumptions as W2 · §7 B ข้อ 2):
- turns alternate, one card each side (1-on-1: bench / "card behind" / deck buffs / bench heals / shadow boosts / kill gains do nothing)
- every pair is played twice (each side attacks first), N random runs each, then averaged
- pair score: winner 50 + half of its HP% left, loser 50 − the same · Matchup = mean over opponents
- "sets the whole enemy deck on fire" has no number in game → played with 0% / 5% / 10% of the
  burner's ATK per turn and averaged (only for pairs that have such a card)
- execute ("instantly kills under X%") is checked on hits only, not on damage over time
- "ignores shields, dodges and barriers" skips dodge and block · % damage reduction and "survives with 1 HP" still work
- lethal damage first uses "survives its first killing blow", then "comes back once"
"""
import argparse, json, math, os, random, re, sys
from multiprocessing import Pool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRE_VARIANTS = (0.0, 0.05, 0.10)
THORN_TURNS = 3  # "Whoever hits it gets N Burn stacks" has no duration in game → same 3 turns as the other stacks
MAX_TURNS = 400

# card groups used by "+X% damage against <Group> cards" / "Takes 2x damage from <Group> cards"
# (series is empty for most cards → guessed from id/name · see HISTORY §9 ③)
GROUPS = {
    "sun": {"sun-breath-origin", "sun-god-captain", "pumpkin-sun-pride", "sun-dance-slayer"},
    "vampire": {"no-life-king", "time-stop-vampire", "bloody-valkyrie"},
    "apostle": {"white-hawk-godhand"},
    "titan": {"founding-titan"},
}


def in_group(card, group):
    if group == "demon":
        n = card["id"] + " " + card["name"].lower()
        return "demon" in n or card["id"] in {"moon-breath-swordsman", "demon-progenitor"}
    return card["id"] in GROUPS.get(group, set())


F = r"([\d.]+)"


def parse(desc):
    """ability text → dict of effects (unknown sentences are listed under 'unknown')."""
    a = {"unknown": []}
    sents = re.split(r"(?<!\bMr\.)(?<!\bDr\.)(?<=\.)\s+", desc.strip())  # "Mr. Satan" is one sentence
    for i, s0 in enumerate(sents):
        prefixed = not re.match(r"When \w+ falls", s0)  # "When Ace falls: +34%" is a deck link, not a flat buff
        if not one(a, s0) and not (prefixed and one(a, re.sub(r"^[A-Z][\w' .-]*: ", "", s0))):  # "Madara: Every enemy…"
            if re.search(r"in the deck|in your deck|takes the killing blow for|When \w+ falls|brings \w+ back", s0):
                a.setdefault("team_link", []).append(s0)
            elif i == 0 and not re.search(r"\d", s0): a["flavor"] = s0
            else: a["unknown"].append(s0)
    hm = a.pop("hits_mult", None)
    if hm is not None:
        if "double" in a: a["double"] = (a["double"][0], hm)
        else: a["unknown"].append("Its hits do %sx damage." % hm)
    return a


def one(a, s):
    """one sentence → effect in a · False if not understood"""
    m = None
    def g(p):
        nonlocal m
        m = re.fullmatch(p, s.rstrip("."))
        return m
    if True:
        if g(F + r"% chance to dodge each hit"): a["dodge"] = float(m[1]) / 100
        elif g(r"Ignores (the enemy's )?shields, dodges and barriers"): a["ignore"] = True
        elif g(r"Its attacks can't be dodged"): a["undodgeable"] = True
        elif g(r"Every hit also hits the whole enemy bench for " + F + r"%( of its normal hit \(no crits or bonuses\))?"): a["bench"] = float(m[1]) / 100
        elif g(r"Its first attack also hits the whole enemy bench for " + F + "%"): a["bench_first"] = float(m[1]) / 100
        elif g(r"Every enemy card starts with " + F + "% less damage"): a["enemy_less"] = float(m[1]) / 100
        elif g(r"Every (\d)\w\w attack also hits the card behind for " + F + r"%( of its normal hit \(no crits or bonuses\))?"): a["behind"] = (int(m[1]), float(m[2]) / 100)
        elif g(r"Comes back once with " + F + "% HP"): a["revive"] = float(m[1]) / 100
        elif g(r"Heals " + F + "% of its max HP every turn"): a["regen"] = float(m[1]) / 100
        elif g(r"Survives its first killing blow with 1 HP"): a["survive"] = True
        elif g(r"Each kill gives it " + F + "% of the defeated card's damage and HP"): a["kill_gain"] = float(m[1]) / 100
        elif g(r"Takes " + F + "% less damage"): a["dr"] = float(m[1]) / 100
        elif g(r"Takes " + F + r"% less damage until it has been hit (\d+) times"): a["dr_until"] = (float(m[1]) / 100, int(m[2]))
        elif g(r"Takes " + F + r"% less from an attack each time it has seen it \(up to (\d+) times\)"): a["adapt"] = (float(m[1]) / 100, int(m[2]))
        elif g(r"Can't be stunned, frozen or paralyzed"): a["cc_immune"] = True
        elif g(r"Can't be stunned, frozen, paralyzed, confused, sealed or weakened"): a["cc_immune"] = a["status_immune"] = True
        elif g(r"Can't be burned"): a["burn_immune"] = True
        elif g(r"Heals " + F + "% of the damage it deals"): a["lifesteal"] = float(m[1]) / 100
        elif g(r"Every (\d)\w\w attack does " + F + "x damage"): a["every_n"] = (int(m[1]), float(m[2]))
        elif g(r"Its first hit on each new enemy does " + F + "x damage"): a["first_mult"] = float(m[1])
        elif g(r"Its first hit on each new enemy Seals (its|that card's) ability for (\d+) turns?"): a["seal_first"] = int(m[2])
        elif g(r"Its hits do " + F + "x damage"): a["hits_mult"] = float(m[1])
        elif g(r"\+" + F + "% damage every time it is hit"): a["hit_ramp"] = float(m[1]) / 100
        elif g(r"\+" + F + r"% damage every turn \(up to (\d+) times\)"): a["turn_ramp"] = (float(m[1]) / 100, int(m[2]))
        elif g(r"\+" + F + "% damage every turn"): a["turn_ramp"] = (float(m[1]) / 100, 10 ** 6)
        elif g(r"\+" + F + "% damage"): a["flat"] = a.get("flat", 0) + float(m[1]) / 100
        elif g(r"\+" + F + r"% damage against (\w+) cards"): a["vs_group"] = (m[2].lower(), float(m[1]) / 100)
        elif g(r"Takes " + F + r"x damage from (\w+) cards"): a["weak_group"] = (m[2].lower(), float(m[1]))
        elif g(r"Copies the ability of every (new )?enemy card it faces"): a["copy"] = True
        elif g(r"Attackers take " + F + "% of their damage back"): a["reflect"] = float(m[1]) / 100
        elif g(r"Sends " + F + "% of the damage it takes back at the attacker"): a["reflect"] = float(m[1]) / 100
        elif g(r"Instantly kills enemies under " + F + r"% HP \(not bosses\)"): a["execute"] = float(m[1]) / 100
        elif g(F + r"% chance per hit to instantly kill an enemy under " + F + r"% HP \(not bosses\)"): a["instakill"] = (float(m[1]) / 100, float(m[2]) / 100)
        elif g(F + r"% chance per hit to Confuse the enemy \((it hits itself instead|it skips its next turn and hits itself for half damage)\)"): a["confuse"] = float(m[1]) / 100
        elif g(r"Under " + F + r"% HP: \+" + F + "% damage"): a["low_hp"] = (float(m[1]) / 100, float(m[2]) / 100)
        elif g(F + r"% chance to attack twice \(each hit does " + F + r"x damage\)"): a["double"] = (float(m[1]) / 100, float(m[2]))
        elif g(F + r"% chance to attack twice"): a["double"] = (float(m[1]) / 100, 1.0)
        elif g(r"Always attacks twice \(each hit does " + F + r"x damage\)"): a["double"] = (1.0, float(m[1]))
        elif g(F + r"% chance per hit to Stun the enemy for (\d+) turns?"): a["stun"] = (float(m[1]) / 100, int(m[2]))
        elif g(F + r"% chance per hit to Paralyze the enemy for (\d+) turns \(50% chance to lose each turn\)"): a["paralyze"] = (float(m[1]) / 100, int(m[2]))
        elif g(F + r"% chance per hit to Freeze the enemy for (\d+) turns? \(frozen cards take 25% more damage\)"): a["freeze"] = (float(m[1]) / 100, int(m[2]))
        elif g(F + r"x damage against frozen enemies"): a["vs_frozen"] = float(m[1])
        elif g(F + r"% chance per hit to Seal the enemy's ability for (\d+) turns( \(bosses: \d+ turns?\))?"): a["seal_chance"] = (float(m[1]) / 100, int(m[2]))
        elif g(F + r"% chance to counter-attack when hit"): a["counter"] = float(m[1]) / 100
        elif g(r"Blocks the first (\d+) hits completely"): a["block"] = int(m[1])
        elif g(F + r"% chance to crit for " + F + "x damage"): a["crit"] = (float(m[1]) / 100, float(m[2]))
        elif g(r"Every hit sets the whole enemy deck on fire for (\d+) turns?"): a["fire"] = int(m[1])
        elif g(r"Each hit sets every enemy card on fire for (\d+) turns? \(5% of its max HP per turn\)"): a["fire"] = int(m[1])
        elif g(r"Each hit adds (\d+) (Burn|Poison|Bleed) stacks? \(" + F + r"% of the enemy's max HP per turn each, up to (\d+), (\d+) turns\)"):
            a.setdefault("dots", []).append((m[2].lower(), int(m[1]), float(m[3]) / 100, int(m[4]), int(m[5])))
        elif g(r"Each hit adds (\d+) (Burn|Poison|Bleed) stacks? \(each stack: " + F + r"% of the enemy's max HP per turn, max (\d+) stacks, (\d+) turns\)"):
            a.setdefault("dots", []).append((m[2].lower(), int(m[1]), float(m[3]) / 100, int(m[4]), int(m[5])))
        elif g(r"Each hit also deals " + F + "% of the enemy's max HP"): a["maxhp_hit"] = float(m[1]) / 100
        elif g(r"Hits set black flames on the enemy: " + F + "% of its max HP every turn, forever"): a["black_flame"] = float(m[1]) / 100
        elif g(r"Each hit crushes the enemy for " + F + r"% of its max HP per turn for (\d+) turns"): a["crush"] = (float(m[1]) / 100, int(m[2]))
        elif g(r"When it comes in, the strongest enemy card dies after (\d+) turns unless this card falls first \(bosses lose 30% HP( instead)?\)"): a["doom"] = int(m[1])
        elif g(r"When it comes in, every weaker enemy card loses its first turn \(not bosses\)"): a["skip_weaker"] = True
        elif g(r"When it comes in, every enemy card with less power than it loses its next turn"): a["skip_weaker"] = True
        elif g(F + r"% chance per hit to Mark the enemy \(it takes " + F + r"% more damage from everyone\)"): a["mark"] = (float(m[1]) / 100, float(m[2]) / 100)
        elif g(F + r"% chance per hit to Mark the enemy: it takes " + F + r"% more damage from every card"): a["mark"] = (float(m[1]) / 100, float(m[2]) / 100)
        elif g(r"Black Flash: " + F + r"% chance \(\+" + F + r"% per Zone, up to (\d+)\) to hit for " + F + r"x damage, guaranteed at full Zone"):
            a["black_flash"] = (float(m[1]) / 100, float(m[2]) / 100, int(m[3]), float(m[4]))
        elif g(r"Once, raises a defeated enemy as its shadow at " + F + "% strength"): a["raise"] = float(m[1]) / 100
        elif g(r"Each hit swaps the enemy's front card with a random (one|card from its deck) \(not bosses\)"): a["swap"] = True
        elif g(r"Every other card in your deck gets \+" + F + "% damage"): a["team_dmg"] = float(m[1]) / 100
        elif g(r"While on the bench, heals the card in front " + F + "% of its max HP every turn"): a["bench_heal"] = float(m[1]) / 100
        elif g(r"Shadows raised by your deck are " + F + "% stronger"): a["shadow_boost"] = float(m[1]) / 100
        elif g(r"Whoever hits it gets (\d+) (Burn|Poison|Bleed) stacks? \(" + F + r"% max HP per turn, up to (\d+)\)"):
            a["thorns"] = (m[2].lower(), int(m[1]), float(m[3]) / 100, int(m[4]), THORN_TURNS)
        elif g(r"When knocked out, it explodes for " + F + "% of its max HP on the enemy in front"): a["explode"] = float(m[1]) / 100
        else: return False
    return True


class U:
    __slots__ = ("c", "a", "atk", "hp", "max", "revived", "survived", "block", "hits", "turns", "attacks", "stun", "para",
                 "frozen", "sealed", "confused", "marked", "dots", "bflame", "crush", "fire", "out_mult", "seen",
                 "zone", "doom", "skip", "met", "fire_in", "fire_out")

    def __init__(s, card, abil):
        s.c = card; s.a = abil
        s.atk = card["base"]["atk"]; s.max = card["base"]["hp"]; s.hp = s.max
        s.revived = s.survived = False
        s.block = abil.get("block", 0)
        s.hits = s.turns = s.attacks = 0
        s.stun = s.para = s.frozen = s.sealed = 0
        s.confused = False; s.marked = 0.0
        s.dots = {}; s.bflame = 0.0; s.crush = []; s.fire = 0; s.fire_in = s.fire_out = 0.0
        s.out_mult = 1.0; s.seen = 0; s.zone = 0; s.doom = None; s.skip = False; s.met = False

    def has(s, k):
        return s.sealed == 0 and k in s.a

    def get(s, k, d=None):
        return s.a.get(k, d) if s.sealed == 0 else d


def lethal(u):
    """u.hp <= 0 → use survive / revive · returns True if u is dead."""
    if u.hp > 0: return False
    if u.has("survive") and not u.survived:
        u.survived = True; u.hp = 1; return False
    if u.has("revive") and not u.revived:
        u.revived = True; u.hp = u.max * u.a["revive"]
        u.dots = {}; u.bflame = 0.0; u.crush = []; u.fire = 0
        return False
    return True


def reduce_mult(d, att):
    m = 1.0
    if d.has("dr"): m *= 1 - d.a["dr"]
    if d.has("dr_until") and d.hits < d.a["dr_until"][1]: m *= 1 - d.a["dr_until"][0]
    if d.has("adapt"): m *= 1 - d.a["adapt"][0] * min(d.a["adapt"][1], d.seen)
    if d.marked: m *= 1 + d.marked
    if d.frozen: m *= 1.25
    wg = d.get("weak_group")
    if wg and in_group(att.c, wg[0]): m *= wg[1]
    return max(m, 0.0)


def one_hit(att, d, mult, rnd, counter=False):
    """one hit of att on d · returns 'dead' if d died, 'attdead' if att died (reflect/confuse)."""
    if not counter and att.confused:
        att.confused = False
        dmg = att.atk * mult * 0.5   # game text 2026-10-30: "skips its next turn and hits itself for half damage"
        att.hp -= dmg * reduce_mult(att, att)
        return "attdead" if lethal(att) else None
    # dodge / block
    ign = att.has("ignore")
    if d.has("dodge") and not ign and not att.has("undodgeable") and rnd() < d.a["dodge"]:
        return None
    if d.block > 0 and not ign and d.sealed == 0:
        d.block -= 1; d.hits += 1; d.seen += 1
        return None
    dmg = att.atk * mult * att.out_mult
    if d.frozen and att.has("vs_frozen"): dmg *= att.a["vs_frozen"]
    vg = att.get("vs_group")
    if vg and in_group(d.c, vg[0]): dmg *= 1 + vg[1]
    dmg *= reduce_mult(d, att)
    if att.has("maxhp_hit"): dmg += d.max * att.a["maxhp_hit"] * reduce_mult(d, att)
    d.hp -= dmg
    dealt = dmg
    d.hits += 1; d.seen += 1
    th = d.get("thorns")
    if th and not (th[0] == "burn" and att.has("burn_immune")):
        st_ = att.dots.get(th[0], (0, 0, 0))[0]
        att.dots[th[0]] = (min(th[3], st_ + th[1]), th[2], th[4])
    # reflect
    if d.has("reflect"):
        att.hp -= dealt * d.a["reflect"]
    if att.has("lifesteal"): att.hp = min(att.max, att.hp + dealt * att.a["lifesteal"])
    # on-hit effects (before death check so revive keeps nothing)
    dead = d.hp <= 0
    if not dead:
        if att.has("execute") and d.hp < d.max * att.a["execute"]: d.hp = 0; dead = True
        ik = att.get("instakill")
        if not dead and ik and d.hp < d.max * ik[1] and rnd() < ik[0]: d.hp = 0; dead = True
    if dead:
        if lethal(d): return "dead"
    else:
        cc = not d.has("cc_immune")
        st = att.get("stun")
        if st and cc and rnd() < st[0]: d.stun = max(d.stun, st[1])
        pa = att.get("paralyze")
        if pa and cc and rnd() < pa[0]: d.para = max(d.para, pa[1])
        fr = att.get("freeze")
        if fr and cc and rnd() < fr[0]: d.frozen = max(d.frozen, fr[1])
        st_ok = "status_immune" not in d.a   # confused / sealed / weakened
        if att.has("confuse") and st_ok and rnd() < att.a["confuse"]: d.confused = True
        sc = att.get("seal_chance")
        if sc and st_ok and rnd() < sc[0]: d.sealed = max(d.sealed, sc[1])
        mk = att.get("mark")
        if mk and rnd() < mk[0]: d.marked = mk[1]
        for kind, n, pct, cap, turns in att.get("dots") or []:
            if kind == "burn" and d.has("burn_immune"): continue
            st_ = d.dots.get(kind, (0, 0, 0))[0]
            d.dots[kind] = (min(cap, st_ + n), pct, turns)
        if att.has("black_flame"): d.bflame = max(d.bflame, att.a["black_flame"])
        cr = att.get("crush")
        if cr: d.crush = [[cr[0], cr[1]]]  # no stacks in the text → a new hit refreshes it
        if att.has("fire") and not d.has("burn_immune"):
            d.fire = max(d.fire, att.a["fire"]); d.fire_in = att.fire_out
    if att.hp <= 0 and lethal(att): return "attdead"
    if dead: return None  # d survived thanks to survive/revive
    # counter
    if not counter and d.has("counter") and rnd() < d.a["counter"]:
        r = one_hit(d, att, 1.0 + bonus(d), rnd, counter=True)
        if r == "dead": return "attdead"
        if r == "attdead": return "dead"
    return None


def bonus(u):
    b = u.a.get("flat", 0) if u.sealed == 0 else 0
    tr = u.get("turn_ramp")
    if tr: b += tr[0] * min(tr[1], u.turns)
    hr = u.get("hit_ramp")
    if hr: b += hr * u.hits
    lh = u.get("low_hp")
    if lh and u.hp < u.max * lh[0]: b += lh[1]
    return b


def start_of_turn(u, foe):
    """damage over time + regen + status · returns 'dead' / 'skip' / None"""
    tick = 0.0
    for kind, (n, pct, t) in list(u.dots.items()):
        tick += n * pct * u.max
        u.dots[kind] = (n, pct, t - 1) if t > 1 else None
        if u.dots[kind] is None: del u.dots[kind]
    tick += u.bflame * u.max
    for cr in u.crush:
        tick += cr[0] * u.max; cr[1] -= 1
    u.crush = [c for c in u.crush if c[1] > 0]
    if u.fire > 0:
        tick += u.fire_in; u.fire -= 1
    if tick:
        u.hp -= tick
        if lethal(u): return "dead"
    if u.has("regen"): u.hp = min(u.max, u.hp + u.max * u.a["regen"])
    return None


def fight(c1, a1, c2, a2, first, rnd, fire_pct):
    x, y = U(c1, a1), U(c2, a2)
    for u, v in ((x, y), (y, x)):
        u.fire_out = u.atk * fire_pct
        if "enemy_less" in v.a: u.out_mult *= 1 - v.a["enemy_less"]
        if "doom" in v.a: u.doom = v.a["doom"]
        if "skip_weaker" in v.a and u.atk < v.atk: u.skip = True
    order = (x, y) if first == 0 else (y, x)
    turn = 0
    while turn < MAX_TURNS:
        att, d = order[turn % 2], order[1 - turn % 2]
        turn += 1
        if start_of_turn(att, d) == "dead": return d, att
        acted = True
        if att.skip: att.skip = False; acted = False
        elif att.stun > 0: att.stun -= 1; acted = False
        elif att.frozen > 0: att.frozen -= 1; acted = False
        elif att.para > 0:
            att.para -= 1
            if rnd() < 0.5: acted = False
        if acted:
            att.turns += 1
            att.attacks += 1
            mult = 1.0 + bonus(att)
            en = att.get("every_n")
            if en and att.attacks % en[0] == 0: mult *= en[1]
            cr = att.get("crit")
            if cr and rnd() < cr[0]: mult *= cr[1]
            bf = att.get("black_flash")
            if bf:
                ch = 1.0 if att.zone >= bf[2] else bf[0] + bf[1] * att.zone
                if rnd() < ch:
                    mult *= bf[3]; att.zone = min(bf[2], att.zone + 1)
            hits = 1
            db = att.get("double")
            if db and rnd() < db[0]: hits = 2; mult *= db[1]
            first_hit = not att.met
            att.met = True
            for h in range(hits):
                fm = att.a["first_mult"] if first_hit and h == 0 and att.has("first_mult") else 1.0
                r = one_hit(att, d, mult * fm, rnd)
                if first_hit and h == 0 and att.has("seal_first") and d.hp > 0 and "status_immune" not in d.a: d.sealed = max(d.sealed, att.a["seal_first"])
                if r == "dead": return att, d
                if r == "attdead": return d, att
        # end of own turn: statuses on me tick down, doom counts my turns
        if att.sealed > 0: att.sealed -= 1
        if att.doom is not None:
            att.doom -= 1
            if att.doom <= 0:
                att.doom = None
                att.hp = 0
                if att.has("revive") and not att.revived:
                    att.revived = True; att.hp = att.max * att.a["revive"]
                else:
                    return d, att
    return None, None


def merged(a, b):
    """copy: own ability + every effect of the enemy it does not have itself"""
    out = dict(a)
    for k, v in b.items():
        if k in ("copy", "unknown", "flavor", "team_link"): continue
        if k not in out: out[k] = v
    return out


def play_pair(args):
    c1, c2, runs, seed = args
    a1, a2 = parse(c1["passive"]["desc"]), parse(c2["passive"]["desc"])
    if a1.get("copy"): a1 = merged(a1, a2)
    if a2.get("copy"): a2 = merged(a2, parse(c1["passive"]["desc"]))
    fires = FIRE_VARIANTS if ("fire" in a1 or "fire" in a2) else (0.0,)
    rng = random.Random(seed)
    rnd = rng.random
    s1 = w1 = n = 0.0
    hp1 = hp2 = 0.0
    for fp in fires:
        for first in (0, 1):
            for _ in range(runs):
                w, l = fight(c1, a1, c2, a2, first, rnd, fp)
                n += 1
                if w is None:
                    s1 += 50; w1 += 0.5; continue
                left = max(0.0, w.hp) / w.max * 100
                sc = 50 + left / 2
                if w.c is c1: s1 += sc; w1 += 1; hp1 += left
                else: s1 += 100 - sc; hp2 += left
    return c1["id"], c2["id"], s1 / n, w1 / n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=0)
    ap.add_argument("--ids", default="")
    ap.add_argument("--runs", type=int, default=2000)
    ap.add_argument("--out", default="")
    ap.add_argument("--parse", action="store_true")
    ap.add_argument("--equal", action="store_true", help="every card gets the same ATK/HP → ability power only")
    o = ap.parse_args()
    cards = json.load(open(os.path.join(ROOT, "data/cards.json")))
    cards.sort(key=lambda c: -math.sqrt(c["base"]["atk"] * c["base"]["hp"]))
    sel = cards[:o.top] if o.top else []
    if o.ids:
        want = o.ids.split(",")
        by = {c["id"]: c for c in cards}
        sel = [by[i] for i in want]
    if o.equal:
        sel = [dict(c, base=dict(c["base"], atk=1000000, hp=6667000)) for c in sel]
    if o.parse:
        for c in sel:
            p = parse(c["passive"]["desc"])
            print(c["id"], {k: v for k, v in p.items() if k not in ("flavor",) and v != []})
        return
    jobs = [(sel[i], sel[j], o.runs, i * 1000 + j) for i in range(len(sel)) for j in range(i + 1, len(sel))]
    with Pool() as pool:
        res = pool.map(play_pair, jobs, chunksize=4)
    out = {"ids": [c["id"] for c in sel], "runs": o.runs, "pairs": [[a, b, round(s, 3), round(w, 4)] for a, b, s, w in res]}
    if o.out:
        json.dump(out, open(o.out, "w"))
    else:
        json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
