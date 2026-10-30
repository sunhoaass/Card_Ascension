#!/usr/bin/env python3
"""Deck-vs-deck battle simulator with support cards (PROGRESS ▶️ แผน 2026-10-30 ข้อ 2 · ใช้ต่อในข้อ 6).

Card abilities come from tools/matchup_sim.py parse() (passive.desc) · support effects from SUP below
(one entry per support id, written from effect.desc · values = effect.vals at a rarity after the game's soft cap, §5.4).

    python3 tools/deck_sim.py --parse                    # every support: Godly text → effects (check SUP against the text)
    python3 tools/deck_sim.py --demo a,b,c,d,e x,y,z,v,w  # one deck vs another (no supports), score of the first deck

Battle rules (same assumptions as matchup_sim · §7 B ข้อ 2 · extended to 5 cards a side):
- each side fights with its front card (slot 1 first) · the next card comes in when the front one falls · turns alternate sides
- at the start of a side's turn every card on that side takes its damage over time (burn / poison / fire on the bench too),
  then the front card heals (regen, "EVERY card in your deck heals" heals the whole side) and the bench healers heal it
- "Every other card in your deck …", "EVERY card in your deck …", "Every enemy card starts with …" are set once at the start
  · the same buff from 2 cards / support adds up (+33% and +33% damage = +66% · owner 2026-10-30) · "less damage" multiplies
- whole-bench hits, card-behind hits and Fairy Law hit the bench (Spirit Medium Granny in any slot of that side = no damage)
- "When it comes in" effects fire when the card enters (also at the start for slot 1)
- the strongest enemy card's doom counts that card's side turns (it may sit on the bench)
- seal stops the card's own ability only (supports keep working) · a debuff block stops one stun / paralyze / freeze /
  confuse / seal / mark / weaken / burn / poison / bleed / crush / black flame / fire landing on that card
- deck score: winner 50 + half of its HP left (% of its deck's max HP) · loser 50 − the same · draw (MAX_TURNS) 50
"""
import argparse, json, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matchup_sim import parse, merged, in_group

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = ["Normal", "Shiny", "Rainbow", "Secret", "Divine", "Cosmic", "Ascended", "Godlike", "Godly"]
SOFT = {"chance": (75, 25), "other": (150, 75)}      # same as app.js SOFT (§5.4)
FIRE_PCT = 0.05     # "sets the whole enemy deck on fire" has no number: 5% of the burner's ATK per turn (middle of 0 / 5 / 10)
SUP_DOT_TURNS = 3   # support burn / poison has no duration in game → 3 turns, refreshed by every hit (like matchup_sim THORN_TURNS)
MAX_TURNS = 3000


# ---------- support values at a rarity (port of app.js supAt / supValAt) ----------
def sup_at(base, level):
    b = round(float(base) * 1000)
    if b <= 0: return 0.0
    n = b * (4 + level)
    q, r = divmod(n, 400)
    return (q + 1 if r > 200 or (r == 200 and q % 2) else q) / 10


def sup_kind(desc, i):
    import re
    if re.search(r"\{%d\}%% (chance|of (the )?hits)" % i, desc): return "chance"
    if re.search(r"\{%d\}%% HP\b" % i, desc): return "hp"
    return "other"


def sup_val(s, i, rarity="Godly"):
    e = s["effect"]; base = e["vals"][i]; level = LEVELS.index(rarity); k = sup_kind(e["desc"], i)
    dp = 0 if e.get("dp") == 0 else 1
    v = float(base) * (1 + 0.25 * level)
    plain = sup_at(base, level) if dp else round(v)
    if k == "hp": return min(100.0, plain)
    if v <= SOFT[k][0]: return plain
    t, c = SOFT[k]
    v = t + c * (1 - math.exp(-(v - t) / c))
    return round(v, 1) if dp else round(v)


# ---------- support effects (v = effect.vals at the rarity, as fractions: 15% → 0.15) ----------
# keys: flat (+dmg) · maxhp · rand_boost · double (p) · crit (p, x) · dodge · dr · regen · regen_chance (p, x) · lifesteal
# · heal_taken · heal_all (every card of the side, at the start of this card's turns) · low_heal (under x, heal y, once)
# · ko_heal · shield (start) · shield_every (n turns, x) · nullify (first n hits do no damage) · big_guard (once, a hit > x max HP)
# · survive_p · revive (p, hp) · counter · reflect · dblock (debuffs blocked) · cc_immune · ignore · undodgeable
# · turn_ramp (x, cap) · hit_ramp · low_hp (under x, +y) · after3 (+x from the 3rd attack) · first_fight (+x on its first attack)
# · first_new (×x on the first hit of each new enemy) · every_n [(n, ×x)] · maxhp_hit · shape (+x of the enemy's ATK per hit)
# · dot (kind, pct, cap) · leech (pct) · mark (p, x) · weaken (p, x, cap stacks) · stun / paralyze / freeze / seal / confuse (p[, turns])
# · vs_frozen · gem (p, x) · execute · splash (x of the hit on the whole bench) · fairy (x of each enemy's max HP, once)
# · entry_hit (x of the enemy's max HP) · entry_skip (p) · entry_miss (n, p) · seal_first (turns) · bench_heal · bench_guard
# · team_others (+dmg for every other card) · team_all (dmg, hp for every card) · none (no battle effect: gems)
SUP = {
    "automail-mechanic": lambda v: dict(maxhp=v[0]),
    "flying-cat-partner": lambda v: dict(double=v[0]),
    "fox-kit-trickster": lambda v: dict(dot=("burn", v[0], 3)),
    "gate-healer": lambda v: dict(heal_all=v[0]),
    "inventor-girl": lambda v: dict(rand_boost=v[0]),
    "navigation-pixie": lambda v: dict(flat=v[0]),
    "pig-captain": lambda v: dict(survive_p=v[0], maxhp=v[1]),
    "plant-healer": lambda v: dict(heal_taken=v[0]),
    "portal-playboy": lambda v: dict(dodge=v[0]),
    "spirit-sidekick": lambda v: dict(hit_ramp=v[0]),
    "cafe-owner-owl": lambda v: dict(lifesteal=v[0]),
    "crow-banker": lambda v: dict(mark=(1.0, v[0])),
    "desert-princess": lambda v: dict(double=v[0]),
    "doctor-hunter": lambda v: dict(entry_hit=v[0]),
    "food-mage": lambda v: dict(ko_heal=v[0]),
    "foundation-gentleman": lambda v: dict(flat=v[0], maxhp=v[1]),
    "fox-mask-mentor": lambda v: dict(turn_ramp=(v[0], 5)),
    "lonely-crimson-mage": lambda v: dict(paralyze=(v[0], 2)),
    "master-spy-father": lambda v: dict(crit=(v[0], 2.0)),
    "mind-transfer-kunoichi": lambda v: dict(confuse=v[0]),
    "namekian-healer": lambda v: dict(regen=v[0]),
    "nen-teacher": lambda v: dict(dr=v[0]),
    "rifle-girl": lambda v: dict(first_fight=v[0]),
    "salt-splash-mentor": lambda v: dict(weaken=(v[0], v[1], 1)),
    "second-princess": lambda v: dict(maxhp_hit=v[0]),
    "senzu-bean-cat": lambda v: dict(low_heal=(0.30, v[0])),
    "shadow-garden-strategist": lambda v: dict(none=True),
    "silent-healer-elf": lambda v: dict(heal_all=v[0]),
    "sister-of-prayer": lambda v: dict(dblock=1, shield=v[0]),
    "song-sorceress": lambda v: dict(every_n=[(2, 1 + v[0])]),
    "spirit-ferry-girl": lambda v: dict(survive_p=v[0], regen=v[1]),
    "spirit-medium-granny": lambda v: dict(bench_guard=True, dr=v[0]),
    "toad-boss": lambda v: dict(entry_hit=v[0]),
    "true-queen": lambda v: dict(team_others=v[0]),
    "boomerang-demon-slayer": lambda v: dict(every_n=[(2, 1 + v[0])]),
    "corps-master": lambda v: dict(team_all=(v[0], v[0])),
    "crusader-tank": lambda v: dict(maxhp=v[0], hit_ramp=v[1]),
    "doctor-demon": lambda v: dict(dot=("poison", v[0], 3)),
    "dwarf-warrior-guard": lambda v: dict(dr=v[0], reflect=v[1]),
    "erasure-teacher": lambda v: dict(seal=(v[0], 1)),
    "fate-thread-witch": lambda v: dict(nullify=1, dodge=v[1]),        # 152.9% less on the first hit = no damage
    "foresight-hero": lambda v: dict(dodge=v[0]),
    "gem-mage": lambda v: dict(gem=(v[0], 0.5)),
    "genius-inventor": lambda v: dict(shield=v[0]),
    "goddess-princess": lambda v: dict(cc_immune=True, regen=v[0]),
    "gun-captain": lambda v: dict(dot=("burn", v[0], 3)),
    "half-elf-ice-mage": lambda v: dict(freeze=(v[0], 1)),
    "hawks-eye-sniper": lambda v: dict(crit=(v[0], 2.0)),
    "healing-hero": lambda v: dict(heal_all=v[0]),
    "pacifier-prince": lambda v: dict(big_guard=0.20),                   # 166% weaker = no damage, once
    "star-key-mage": lambda v: dict(flat=v[0]),
    "supreme-kai": lambda v: dict(after3=v[0]),
    "turtle-hermit": lambda v: dict(maxhp=v[0], turn_ramp=(v[1], 5)),
    "weather-witch-navigator": lambda v: dict(paralyze=(v[0], 2)),
    "wind-tunnel-monk": lambda v: dict(lifesteal=v[0]),
    "zero-gravity-hero": lambda v: dict(stun=(v[0], 1)),
    "blue-healer-cat-knight": lambda v: dict(regen=v[0]),
    "charge-commander": lambda v: dict(team_others=v[0]),
    "cherry-blossom-medic": lambda v: dict(every_n=[(3, 1 + v[0])]),
    "flower-hand-scholar": lambda v: dict(splash=v[0], stun=(v[1], 1)),
    "future-sight-dog": lambda v: dict(nullify=2),                      # 150% less on the first 2 hits = no damage
    "gentle-palm-heiress": lambda v: dict(weaken=(1.0, v[0], 5)),
    "gentle-priest": lambda v: dict(heal_all=v[0]),
    "golden-shield-healer": lambda v: dict(shield=v[0]),
    "hellsing-commander": lambda v: dict(first_new=1 + v[0]),
    "hero-of-legend": lambda v: dict(low_hp=(0.30, v[0])),
    "reindeer-doctor": lambda v: dict(low_heal=(0.40, v[0])),
    "sacred-arrow-priestess": lambda v: dict(seal_first=1, flat=v[0]),
    "shadow-strategist": lambda v: dict(entry_skip=v[0]),
    "teacher-alchemist": lambda v: dict(counter=v[0]),
    "titan-scientist": lambda v: dict(mark=(1.0, v[0])),
    "useless-goddess": lambda v: dict(revive=(v[0], v[1])),
    "water-king-teacher": lambda v: dict(shield_every=(3, v[0])),
    "ancient-archmage": lambda v: dict(ignore=True, flat=v[0]),
    "dark-king-coach": lambda v: dict(counter=v[0], undodgeable=True),
    "geass-strategist": lambda v: dict(confuse=v[0]),
    "great-spirit-cat": lambda v: dict(freeze=(v[0], 1), vs_frozen=1.30),
    "guild-master-giant": lambda v: dict(team_all=(v[0], v[0])),
    "hat-and-clogs-shopkeeper": lambda v: dict(entry_miss=(2, v[0])),
    "serpent-sin-mage": lambda v: dict(dblock=3, dr=v[0]),
    "slug-princess-hokage": lambda v: dict(low_heal=(0.30, v[0])),
    "spirit-wave-master": lambda v: dict(every_n=[(2, 1 + v[0])]),
    "sweet-tooth-detective": lambda v: dict(weaken=(1.0, v[0], 4)),
    "chainsaw-pup-devil": lambda v: dict(revive=(v[0], v[1])),
    "flower-healer-captain": lambda v: dict(regen_chance=(v[0], v[1])),
    "rewind-girl": lambda v: dict(low_heal=(0.20, v[0])),
    "angel-attendant": lambda v: dict(dodge=v[0]),
    "first-master-fairy": lambda v: dict(fairy=v[0]),
    "nine-tails-fox": lambda v: dict(flat=v[0]),
    "wish-granter": lambda v: dict(flat=v[0], maxhp=v[1]),
    "eternal-wish-dragon": lambda v: dict(revive=(v[0], v[2]), team_others=v[1]),
    "immortal-witch": lambda v: dict(revive=(v[0], v[1])),
    "library-spirit": lambda v: dict(leech=v[0]),
    "little-witch": lambda v: dict(dblock=2, dr=v[0]),
    "mind-reader-child": lambda v: dict(dodge=v[0]),
    "notebook-genius": lambda v: dict(mark=(1.0, v[0]), execute=0.06),
    "ogre-shrine-princess": lambda v: dict(flat=v[0]),
    "reverse-cursed-doctor": lambda v: dict(heal_taken=v[0]),
    "shapeshift-actor": lambda v: dict(shape=v[0]),
    "sky-dragon-healer": lambda v: dict(bench_heal=v[0]),
}


def sup_effects(s, rarity="Godly"):
    v = [sup_val(s, i, rarity) / 100 for i in range(len(s["effect"]["vals"]))]
    return SUP[s["id"]](v)


# ---------- battle ----------
class U:
    def __init__(s, card, e, side, idx, rnd):
        s.c = card; s.a = parse(card["passive"]["desc"]); s.e = e or {}; s.side = side; s.idx = idx
        s.atk = float(card["base"]["atk"]); s.max = float(card["base"]["hp"])
        s.flat = 0.0
        e = s.e
        if "maxhp" in e: s.max *= 1 + e["maxhp"]
        if "rand_boost" in e:
            if rnd() < 0.5: s.flat += e["rand_boost"]
            else: s.max *= 1 + e["rand_boost"]
        s.flat += e.get("flat", 0.0)
        s.hp = s.max
        s.alive = True
        s.revived = s.survived = s.s_survived = s.s_revived = s.low_used = s.big_used = s.fairy_used = False
        s.block = s.a.get("block", 0); s.nullify = e.get("nullify", 0); s.dblock = e.get("dblock", 0)
        s.shield = 0.0
        s.hits = s.turns = s.attacks = 0
        s.stun = s.para = s.frozen = s.sealed = 0
        s.confused = False; s.marked = 0.0; s.weak = 0; s.weak_x = 0.0
        s.dots = {}; s.bflame = 0.0; s.crush = []; s.fire = 0; s.fire_in = 0.0; s.gem = 0.0; s.leech = None
        s.out_mult = 1.0; s.seen = 0; s.zone = 0; s.doom = None; s.skip = False; s.miss = None
        s.met = set(); s.first_done = False; s.copied = set(); s.shadow = False

    def has(s, k): return s.sealed == 0 and k in s.a
    def get(s, k, d=None): return s.a.get(k, d) if s.sealed == 0 else d


class Battle:
    def __init__(s, deck0, deck1, rnd):
        """deck = [(card, support or None, rarity)] · support = a support.json item"""
        s.rnd = rnd
        s.sides = []
        for side, deck in enumerate((deck0, deck1)):
            us = [U(c, sup_effects(sp, r) if sp else None, side, i, rnd) for i, (c, sp, r) in enumerate(deck)]
            s.sides.append(us)
        s.guard = [any(u.e.get("bench_guard") for u in us) for us in s.sides]
        for side in (0, 1):
            mine, foe = s.sides[side], s.sides[1 - side]
            for u in mine:
                if "team_dmg" in u.a:
                    for o in mine:
                        if o is not u: o.flat += u.a["team_dmg"]
                if "team_others" in u.e:
                    for o in mine:
                        if o is not u: o.flat += u.e["team_others"]
                if "team_all" in u.e:
                    for o in mine: o.flat += u.e["team_all"][0]
                if "enemy_less" in u.a:
                    for o in foe: o.out_mult *= 1 - u.a["enemy_less"]
            hp_all = sum(u.e["team_all"][1] for u in mine if "team_all" in u.e)   # 2 "max HP" support add up (owner 2026-10-30: no overwrite)
            if hp_all:
                for o in mine: o.max *= 1 + hp_all; o.hp = o.max
        for us in s.sides:
            for u in us:
                if "shield" in u.e: u.shield = u.max * u.e["shield"]
        s.start_max = [sum(u.max for u in us) for us in s.sides]

    # --- helpers ---
    def front(s, side):
        for u in s.sides[side]:
            if u.alive: return u
        return None

    def bench(s, side):
        f = s.front(side)
        return [u for u in s.sides[side] if u.alive and u is not f]

    def behind(s, side):
        b = s.bench(side)
        return b[0] if b else None

    def debuff(s, d):
        if d.dblock > 0: d.dblock -= 1; return False
        return True

    def reduce_mult(s, d, att):
        m = 1.0
        if d.has("dr"): m *= 1 - d.a["dr"]
        if "dr" in d.e: m *= 1 - d.e["dr"]
        if d.has("dr_until") and d.hits < d.a["dr_until"][1]: m *= 1 - d.a["dr_until"][0]
        if d.has("adapt"): m *= 1 - d.a["adapt"][0] * min(d.a["adapt"][1], d.seen)
        if d.marked: m *= 1 + d.marked
        if d.frozen: m *= 1.25
        wg = d.get("weak_group")
        if wg and in_group(att.c, wg[0]): m *= wg[1]
        return max(m, 0.0)

    def out_mult(s, u):
        return u.out_mult * (1 - u.weak_x) ** u.weak if u.weak else u.out_mult

    def bonus(s, u):
        b = u.flat + (u.a.get("flat", 0) if u.sealed == 0 else 0)
        tr = u.get("turn_ramp")
        if tr: b += tr[0] * min(tr[1], u.turns)
        if "turn_ramp" in u.e: b += u.e["turn_ramp"][0] * min(u.e["turn_ramp"][1], u.turns)
        hr = u.get("hit_ramp")
        if hr: b += hr * u.hits
        if "hit_ramp" in u.e: b += u.e["hit_ramp"] * u.hits
        lh = u.get("low_hp")
        if lh and u.hp < u.max * lh[0]: b += lh[1]
        if "low_hp" in u.e and u.hp < u.max * u.e["low_hp"][0]: b += u.e["low_hp"][1]
        if "after3" in u.e and u.attacks >= 3: b += u.e["after3"]
        return b

    def lethal(s, u, doom=False):
        """u.hp <= 0 → survive / revive · True = dead (marks it)."""
        if u.hp > 0: return False
        if not doom:
            if u.has("survive") and not u.survived:
                u.survived = True; u.hp = 1; return False
            if "survive_p" in u.e and not u.s_survived:
                u.s_survived = True
                if s.rnd() < u.e["survive_p"]: u.hp = 1; return False
        if u.has("revive") and not u.revived:
            u.revived = True; u.hp = u.max * u.a["revive"]; s.clear_dots(u); return False
        if "revive" in u.e and not u.s_revived:
            u.s_revived = True
            if s.rnd() < u.e["revive"][0]: u.hp = u.max * u.e["revive"][1]; s.clear_dots(u); return False
        u.alive = False
        return True

    def clear_dots(s, u):
        u.dots = {}; u.bflame = 0.0; u.crush = []; u.fire = 0; u.leech = None; u.gem = 0.0

    def raw_damage(s, d, dmg, att=None, ign=False):
        """damage that already went through reductions: shield → HP · heal_taken."""
        if dmg <= 0: return 0.0
        if d.shield > 0 and not ign:
            a = min(d.shield, dmg); d.shield -= a; dmg -= a
        d.hp -= dmg
        if "heal_taken" in d.e and d.hp > 0: d.hp = min(d.max, d.hp + dmg * d.e["heal_taken"])
        return dmg

    def side_hit(s, d, dmg):
        """bench / card-behind / Fairy Law damage (no dodge, no block) · Spirit Medium Granny guards that side."""
        if s.guard[d.side] or dmg <= 0: return
        s.raw_damage(d, dmg)
        s.low_heal(d)
        if d.hp <= 0 and s.lethal(d): s.fell(d, None)

    def low_heal(s, u):
        lh = u.e.get("low_heal")
        if lh and not u.low_used and 0 < u.hp < u.max * lh[0]:
            u.low_used = True; u.hp = min(u.max, u.hp + u.max * lh[1])

    def fell(s, u, killer):
        """u just died: explode, killer gains · a new front card comes in."""
        if u.has("explode"):
            f = s.front(1 - u.side)
            if f: s.raw_damage(f, u.max * u.a["explode"]); s.low_heal(f); (f.hp <= 0 and s.lethal(f) and s.fell(f, None))
        if killer is not None and killer.alive:
            kg = killer.get("kill_gain")
            if kg: killer.atk += kg * u.atk; killer.max += kg * u.max; killer.hp += kg * u.max
            if "ko_heal" in killer.e: killer.hp = min(killer.max, killer.hp + killer.max * killer.e["ko_heal"])
            if killer.has("raise") and not getattr(killer, "raised", False) and not u.shadow:
                killer.raised = True
                boost = 1 + sum(o.a.get("shadow_boost", 0) for o in s.sides[killer.side] if o.alive)
                sh = U(u.c, None, killer.side, len(s.sides[killer.side]), s.rnd)
                sh.atk = u.c["base"]["atk"] * killer.a["raise"] * boost; sh.max = sh.hp = u.c["base"]["hp"] * killer.a["raise"] * boost
                sh.shadow = True
                s.sides[killer.side].append(sh)

    def enter(s, u):
        """u becomes the front card of its side."""
        foe = s.front(1 - u.side)
        if foe is None: return
        e = u.e
        if "entry_hit" in e:
            s.raw_damage(foe, foe.max * e["entry_hit"] * s.reduce_mult(foe, u)); s.low_heal(foe)
            if foe.hp <= 0 and s.lethal(foe): s.fell(foe, u); foe = s.front(1 - u.side)
            if foe is None: return
        if "entry_skip" in e and s.rnd() < e["entry_skip"] and s.debuff(foe): foe.skip = True
        if "entry_miss" in e: foe.miss = [e["entry_miss"][0], e["entry_miss"][1]]
        if u.has("doom"):
            alive = [o for o in s.sides[1 - u.side] if o.alive]
            if alive:
                t = max(alive, key=lambda o: o.atk * o.max)
                t.doom = [u.a["doom"], u]
        if u.has("skip_weaker"):
            for o in s.sides[1 - u.side]:
                if o.alive and o.atk < u.atk: o.skip = True

    # --- one hit ---
    def hit(s, att, d, mult, counter=False):
        """'dead' = d fell, 'attdead' = att fell, None"""
        rnd = s.rnd
        if not counter and att.confused:
            att.confused = False
            s.raw_damage(att, att.atk * mult * s.reduce_mult(att, att))
            return "attdead" if att.hp <= 0 and s.lethal(att) else None
        ign = att.has("ignore") or att.e.get("ignore", False)
        if not counter and att.miss and att.miss[0] > 0:
            att.miss[0] -= 1
            if rnd() < att.miss[1]: return None
        und = ign or att.has("undodgeable") or att.e.get("undodgeable", False)
        if not und:
            if d.has("dodge") and rnd() < d.a["dodge"]: return None
            if "dodge" in d.e and rnd() < d.e["dodge"]: return None
        if d.block > 0 and not ign and d.sealed == 0:
            d.block -= 1; d.hits += 1; d.seen += 1
            return None
        dmg = att.atk * mult * s.out_mult(att)
        if "shape" in att.e: dmg += d.atk * att.e["shape"] * s.out_mult(att)
        if d.frozen:
            if att.has("vs_frozen"): dmg *= att.a["vs_frozen"]
            if "vs_frozen" in att.e: dmg *= att.e["vs_frozen"]
        vg = att.get("vs_group")
        if vg and in_group(d.c, vg[0]): dmg *= 1 + vg[1]
        rm = s.reduce_mult(d, att)
        dmg *= rm
        if att.has("maxhp_hit"): dmg += d.max * att.a["maxhp_hit"] * rm
        if "maxhp_hit" in att.e: dmg += d.max * att.e["maxhp_hit"] * rm
        d.hits += 1; d.seen += 1
        if d.nullify > 0: d.nullify -= 1; dmg = 0.0
        elif "big_guard" in d.e and not d.big_used and dmg > d.max * d.e["big_guard"]: d.big_used = True; dmg = 0.0
        dealt = s.raw_damage(d, dmg, att, ign)
        th = d.get("thorns")
        if th and not (th[0] == "burn" and att.has("burn_immune")) and s.debuff(att):
            st_ = att.dots.get(th[0], (0, 0, 0))[0]
            att.dots[th[0]] = (min(th[3], st_ + th[1]), th[2], th[4])
        if d.has("reflect"): s.raw_damage(att, dealt * d.a["reflect"])
        if "reflect" in d.e: s.raw_damage(att, dealt * d.e["reflect"])
        ls = (att.a.get("lifesteal", 0) if att.sealed == 0 else 0) + att.e.get("lifesteal", 0)
        if ls: att.hp = min(att.max, att.hp + dealt * ls)
        # bench splash (from the hit before the target's reductions)
        base_hit = att.atk * mult * s.out_mult(att)
        if att.has("bench"):
            for o in s.bench(d.side): s.side_hit(o, att.atk * s.out_mult(att) * att.a["bench"] * s.reduce_mult(o, att))
        if "splash" in att.e:
            for o in s.bench(d.side): s.side_hit(o, base_hit * att.e["splash"] * s.reduce_mult(o, att))
        dead = d.hp <= 0
        if not dead:
            ex = (att.a.get("execute", 0) if att.sealed == 0 else 0)
            ex = max(ex, att.e.get("execute", 0))
            if ex and d.hp < d.max * ex: d.hp = 0; dead = True
            ik = att.get("instakill")
            if not dead and ik and d.hp < d.max * ik[1] and rnd() < ik[0]: d.hp = 0; dead = True
        if dead:
            if s.lethal(d): s.fell(d, att); return "dead"
        else:
            s.low_heal(d)
            s.on_hit(att, d, dealt)
        if att.hp <= 0 and s.lethal(att): s.fell(att, d); return "attdead"
        if dead: return None
        s.low_heal(att)
        if not counter and d.alive:
            p = 1.0
            if d.has("counter"): p *= 1 - d.a["counter"]
            if "counter" in d.e: p *= 1 - d.e["counter"]
            if p < 1 and rnd() < 1 - p:
                r = s.hit(d, att, 1.0 + s.bonus(d), counter=True)
                if r == "dead": return "attdead"
                if r == "attdead": return "dead"
        return None

    def on_hit(s, att, d, dealt):
        rnd = s.rnd
        cc = not (d.has("cc_immune") or d.e.get("cc_immune"))
        for st in (att.get("stun"), att.e.get("stun")):
            if st and cc and rnd() < st[0] and s.debuff(d): d.stun = max(d.stun, st[1])
        for pa in (att.get("paralyze"), att.e.get("paralyze")):
            if pa and cc and rnd() < pa[0] and s.debuff(d): d.para = max(d.para, pa[1])
        for fr in (att.get("freeze"), att.e.get("freeze")):
            if fr and cc and rnd() < fr[0] and s.debuff(d): d.frozen = max(d.frozen, fr[1])
        for cf in ((att.a.get("confuse") if att.sealed == 0 else None), att.e.get("confuse")):
            if cf and rnd() < cf and s.debuff(d): d.confused = True
        for sc in (att.get("seal_chance"), att.e.get("seal")):
            if sc and rnd() < sc[0] and s.debuff(d): d.sealed = max(d.sealed, sc[1])
        for mk in (att.get("mark"), att.e.get("mark")):
            if mk and rnd() < mk[0] and s.debuff(d): d.marked = max(d.marked, mk[1])
        wk = att.e.get("weaken")
        if wk and d.weak < wk[2] and rnd() < wk[0] and s.debuff(d):
            d.weak += 1; d.weak_x = wk[1]
        for kind, n, pct, cap, turns in att.get("dots") or []:
            if kind == "burn" and d.has("burn_immune"): continue
            if not s.debuff(d): continue
            st_ = d.dots.get(kind, (0, 0, 0))[0]
            d.dots[kind] = (min(cap, st_ + n), pct, turns)
        if "dot" in att.e:
            kind, pct, cap = att.e["dot"]
            if not (kind == "burn" and d.has("burn_immune")) and s.debuff(d):
                k = kind + "_s"; st_ = d.dots.get(k, (0, 0, 0))[0]
                d.dots[k] = (min(cap, st_ + 1), pct, SUP_DOT_TURNS)
        if "leech" in att.e and s.debuff(d): d.leech = [att.e["leech"], 3, att]
        if "gem" in att.e and rnd() < att.e["gem"][0]: d.gem += dealt * att.e["gem"][1]
        if att.has("black_flame") and s.debuff(d): d.bflame = max(d.bflame, att.a["black_flame"])
        cr = att.get("crush")
        if cr and s.debuff(d): d.crush = [[cr[0], cr[1]]]
        if att.has("fire"):
            for o in s.sides[d.side]:
                if o.alive and not o.has("burn_immune") and s.debuff(o):
                    o.fire = max(o.fire, att.a["fire"]); o.fire_in = att.atk * FIRE_PCT
        if att.has("swap") and d.alive:
            b = s.bench(d.side)
            if b:
                o = s.rnd_choice(b); L = s.sides[d.side]; i, j = L.index(d), L.index(o)
                L[i], L[j] = L[j], L[i]

    def rnd_choice(s, xs): return xs[int(s.rnd() * len(xs))]

    # --- turns ---
    def side_start(s, side):
        """damage over time on every card of the side, then heals on the front card · True if the side is out"""
        for u in list(s.sides[side]):
            if not u.alive: continue
            tick = 0.0
            for kind, (n, pct, t) in list(u.dots.items()):
                tick += n * pct * u.max
                if t > 1: u.dots[kind] = (n, pct, t - 1)
                else: del u.dots[kind]
            tick += u.bflame * u.max
            for cr in u.crush: tick += cr[0] * u.max; cr[1] -= 1
            u.crush = [c for c in u.crush if c[1] > 0]
            if u.fire > 0: tick += u.fire_in; u.fire -= 1
            if u.gem: tick += u.gem; u.gem = 0.0
            if u.leech:
                pct, t, src = u.leech; dmg = pct * u.max; tick += dmg
                if src.alive: src.hp = min(src.max, src.hp + dmg)
                u.leech = [pct, t - 1, src] if t > 1 else None
            if tick:
                u.hp -= tick
                if u.hp <= 0:
                    if s.lethal(u): s.fell(u, None)
                else: s.low_heal(u)
        f = s.front(side)
        if f is None: return True
        if f.has("regen"): f.hp = min(f.max, f.hp + f.max * f.a["regen"])
        if "regen" in f.e: f.hp = min(f.max, f.hp + f.max * f.e["regen"])
        if "regen_chance" in f.e and s.rnd() < f.e["regen_chance"][0]: f.hp = min(f.max, f.hp + f.max * f.e["regen_chance"][1])
        if "heal_all" in f.e:
            for o in s.sides[side]:
                if o.alive: o.hp = min(o.max, o.hp + o.max * f.e["heal_all"])
        for o in s.bench(side):
            x = (o.a.get("bench_heal", 0) if o.sealed == 0 else 0) + o.e.get("bench_heal", 0)
            if x: f.hp = min(f.max, f.hp + f.max * x)
        if "shield_every" in f.e and f.turns > 0 and f.turns % f.e["shield_every"][0] == 0:
            f.shield = max(f.shield, f.max * f.e["shield_every"][1])
        return False

    def run(s, first):
        entered = [None, None]
        side = first
        for side_ in (first, 1 - first):
            f = s.front(side_); entered[side_] = f; s.enter(f)
        turn = 0
        rnd = s.rnd
        while turn < MAX_TURNS:
            turn += 1
            for sd in (0, 1):   # a card that fell mid-turn: the next one comes in
                f = s.front(sd)
                if f is None: return 1 - sd
                if f is not entered[sd]: entered[sd] = f; s.enter(f)
            if s.side_start(side): return 1 - side
            att = s.front(side)
            if att is not entered[side]: entered[side] = att; s.enter(att)
            d = s.front(1 - side)
            if d is None: return side
            if d is not entered[1 - side]: entered[1 - side] = d; s.enter(d)
            acted = True
            if att.skip: att.skip = False; acted = False
            elif att.stun > 0: att.stun -= 1; acted = False
            elif att.frozen > 0: att.frozen -= 1; acted = False
            elif att.para > 0:
                att.para -= 1
                if rnd() < 0.5: acted = False
            if acted:
                att.turns += 1; att.attacks += 1
                if att.has("copy") and id(d) not in att.copied:
                    att.copied.add(id(d)); att.a = merged(att.a, d.a)
                mult = 1.0 + s.bonus(att)
                en = att.get("every_n")
                if en and att.attacks % en[0] == 0: mult *= en[1]
                for n, x in att.e.get("every_n", ()):
                    if att.attacks % n == 0: mult *= x
                if "first_fight" in att.e and not att.first_done: mult *= 1 + att.e["first_fight"]
                att.first_done = True
                cr = att.get("crit")
                if cr and rnd() < cr[0]: mult *= cr[1]
                if "crit" in att.e and rnd() < att.e["crit"][0]: mult *= att.e["crit"][1]
                bf = att.get("black_flash")
                if bf:
                    ch = 1.0 if att.zone >= bf[2] else bf[0] + bf[1] * att.zone
                    if rnd() < ch: mult *= bf[3]; att.zone = min(bf[2], att.zone + 1)
                hits = 1
                db = att.get("double")
                if db and rnd() < db[0]: hits = 2; mult *= db[1]
                elif "double" in att.e and rnd() < att.e["double"]: hits = 2
                key = (d.side, d.idx, id(d))
                first_hit = key not in att.met
                att.met.add(key)
                if "fairy" in att.e and not att.fairy_used:
                    att.fairy_used = True
                    for o in [o for o in s.sides[d.side] if o.alive]:
                        if o is d: s.raw_damage(o, o.max * att.e["fairy"]); s.low_heal(o); (o.hp <= 0 and s.lethal(o) and s.fell(o, att))
                        else: s.side_hit(o, o.max * att.e["fairy"])
                if d.alive:
                    if att.has("bench_first") and att.attacks == 1:
                        for o in s.bench(d.side): s.side_hit(o, att.atk * s.out_mult(att) * att.a["bench_first"] * s.reduce_mult(o, att))
                    bh = att.get("behind")
                    if bh and att.attacks % bh[0] == 0:
                        o = s.behind(d.side)
                        if o: s.side_hit(o, att.atk * mult * s.out_mult(att) * bh[1] * s.reduce_mult(o, att))
                    for h in range(hits):
                        if not d.alive or not att.alive: break
                        fm = 1.0
                        if first_hit and h == 0:
                            if att.has("first_mult"): fm *= att.a["first_mult"]
                            if "first_new" in att.e: fm *= att.e["first_new"]
                        r = s.hit(att, d, mult * fm)
                        if first_hit and h == 0 and d.alive and d.hp > 0:
                            sf = max(att.get("seal_first", 0) or 0, att.e.get("seal_first", 0))
                            if sf and s.debuff(d): d.sealed = max(d.sealed, sf)
                        if r: break
            if att.alive and att.sealed > 0: att.sealed -= 1
            for o in s.sides[side]:   # doom counts the doomed card's side turns
                if o.alive and o.doom:
                    o.doom[0] -= 1
                    if not o.doom[1].alive: o.doom = None
                    elif o.doom[0] <= 0:
                        o.doom = None; o.hp = 0
                        if s.lethal(o, doom=True): s.fell(o, None)
            if s.front(0) is None: return 1
            if s.front(1) is None: return 0
            side = 1 - side
        return None



def deck_score(deck0, deck1, first, rnd):
    """score of deck0 (0–100) for one battle."""
    b = Battle(deck0, deck1, rnd)
    w = b.run(first)
    if w is None: return 50.0
    left = sum(max(0.0, u.hp) for u in b.sides[w] if u.alive and not u.shadow) / b.start_max[w] * 100
    return 50 + left / 2 if w == 0 else 50 - left / 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--parse", action="store_true")
    ap.add_argument("--rarity", default="Godly")
    ap.add_argument("--demo", nargs=2)
    ap.add_argument("--runs", type=int, default=200)
    o = ap.parse_args()
    sups = json.load(open(os.path.join(ROOT, "data/support.json")))
    if o.parse:
        missing = [s["id"] for s in sups if s["id"] not in SUP]
        if missing: print("NOT IN SUP:", missing)
        for s in sups:
            if s["id"] not in SUP: continue
            v = [sup_val(s, i, o.rarity) for i in range(len(s["effect"]["vals"]))]
            txt = s["effect"]["desc"]
            for i, x in enumerate(v): txt = txt.replace("{%d}" % i, ("%g" % x))
            print(f"{s['id']}: {sup_effects(s, o.rarity)}\n    {txt}")
        return
    if o.demo:
        cards = {c["id"]: c for c in json.load(open(os.path.join(ROOT, "data/cards.json")))}
        d0 = [(cards[i], None, o.rarity) for i in o.demo[0].split(",")]
        d1 = [(cards[i], None, o.rarity) for i in o.demo[1].split(",")]
        rng = random.Random(1)
        sc = [deck_score(d0, d1, f, rng.random) for f in (0, 1) for _ in range(o.runs)]
        print(round(sum(sc) / len(sc), 2))


if __name__ == "__main__":
    main()
