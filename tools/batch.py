#!/usr/bin/env python3
"""Card Battle Infinity — batch rounds for routine A (cards) and C (support) · PROGRESS.md §7 "Batch".

The owner drops one in-game Index screenshot (Normal) per card into inbox/cards/ and per support card into
inbox/support/. Each round Claude reads up to ROUND_MAX of them, writes what it read into a round file, and runs
`apply`. This script does the bookkeeping so every round is the same:

  python3 tools/batch.py status            what is waiting, in the order to do it (next round = the first 30)
  python3 tools/batch.py template          print an empty round file to fill in
  python3 tools/batch.py apply ROUND.json  write cards.json / support.json / pool.json / inbox/progress.json,
                                           make missing thumbnails, delete the inbox pictures that are done
  python3 tools/batch.py check             data files agree with each other (ids, pool, thumbnails)

Statuses in inbox/progress.json (per inbox file, keyed by "cards/<file>" or "support/<file>"):
  done     added to the site · picture deleted from the inbox
  later    a card under the rank cut (meta.rankMinOdds) seen while ranked cards / support still wait · only name + odds noted,
           done in a later round once nothing ranked is left · picture stays
  skipped  something on the picture could not be read (never guess) · picture stays · note says what
  problem  could not be added for another reason (e.g. same id as a different card) · picture stays · note says what
A picture that is replaced by a new file with the same name (different content) counts as new again.
Standard library + Pillow only.
"""
import datetime
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX = os.path.join(ROOT, "inbox")
PROGRESS = os.path.join(INBOX, "progress.json")
DATA = os.path.join(ROOT, "data")
KINDS = ("support", "cards")            # folder order = work order (support first)
PICS = (".png", ".jpg", ".jpeg", ".webp")
ROUND_MAX = 30
RANK_MIN_ODDS = 480_000_000            # fallback when meta.json has no rankMinOdds
GROUPS = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Secret", "Divine", "Astral", "Ascended"]
TODAY = datetime.date.today().isoformat()


# ---------- files ----------
def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save(path, obj):
    # same style as the files in data/: 2-space indent, real UTF-8, no newline at the end
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(obj, indent=2, ensure_ascii=False))


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def rank_cut():
    v = load(os.path.join(DATA, "meta.json"), {}).get("rankMinOdds")
    return v if isinstance(v, (int, float)) and v >= 0 else RANK_MIN_ODDS


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def inbox_files():
    out = []
    for kind in KINDS:
        d = os.path.join(INBOX, kind)
        if not os.path.isdir(d):
            continue
        for n in sorted(os.listdir(d)):
            if n.lower().endswith(PICS):
                out.append((kind, f"{kind}/{n}", os.path.join(d, n)))
    return out


# ---------- status ----------
def queue():
    """Files still to do, in work order: support → cards not seen yet → cards marked "later" (only when nothing else waits)."""
    prog = load(PROGRESS, {"files": {}})
    rec = prog.get("files", {})
    first, later = [], []
    for kind, key, path in inbox_files():
        r = rec.get(key)
        new = not r or r.get("sha1") != sha1(path)
        if new:
            first.append((kind, key, None))
        elif r.get("status") == "later":
            later.append((kind, key, r))
    first.sort(key=lambda x: KINDS.index(x[0]))
    later.sort(key=lambda x: -(x[2].get("odds") or 0))     # rarest of the commoner cards first
    return first, later, rec


def cmd_status():
    first, later, rec = queue()
    cut = rank_cut()
    counts = {}
    for r in rec.values():
        counts[r.get("status", "?")] = counts.get(r.get("status", "?"), 0) + 1
    print(f"rank cut: 1 in {cut:,} (meta.rankMinOdds) · round size {ROUND_MAX}")
    print("progress.json:", ", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "empty")
    print(f"waiting: {len(first)} new ({sum(1 for k in first if k[0] == 'support')} support) · {len(later)} later (under the cut)")
    nxt = first[:ROUND_MAX] if first else later[:ROUND_MAX]
    if not nxt:
        print("nothing to do: the inbox is empty (or only skipped / problem files are left)")
    else:
        mode = "NEW: support first, then cards (a card under the cut -> status later)" if first else "LATER: cards under the cut (no short / tierNote / bestTrait)"
        print(f"\nnext round ({len(nxt)} files · {mode}):")
        for kind, key, r in nxt:
            print(f"  {key}" + (f"   ({r.get('name', '?')} · 1 in {r.get('odds', 0):,})" if r else ""))
    left = [(k, r) for k, r in rec.items() if r.get("status") in ("skipped", "problem")]
    if left:
        print("\nwaiting for the owner (skipped / problem · replace the picture or delete it):")
        for k, r in left:
            print(f"  {k}: {r['status']} · {r.get('note', '')}")


TEMPLATE = {
    "_how": "One item per inbox file. status: done | later | skipped | problem. Numbers = Normal rarity, exactly as on the picture.",
    "items": [
        {"file": "cards/IMG_0001.png", "status": "done", "group": "Mythic",
         "card": {"id": "bald-cadet", "name": "Bald Cadet", "series": "Attack on Titan",
                  "atk": 390, "hp": 2598, "odds": 59, "obtain": "Rolls anywhere",
                  "passive": {"name": "ODM Gear", "desc": "15% dodge"}, "exact": {}}},
        {"file": "support/IMG_0002.png", "status": "done", "group": "Rare",
         "support": {"id": "gate-healer", "name": "Gate Healer", "odds": 106,
                     "effect": {"name": "Mend", "desc": "Heals 10% HP every turn"}}},
        {"file": "cards/IMG_0003.png", "status": "later", "name": "Some Common Card", "odds": 1200},
        {"file": "cards/IMG_0004.png", "status": "skipped", "note": "HP hidden behind a popup"},
    ],
}


# ---------- apply ----------
def num(v, what):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v <= 0:
        raise ValueError(f"{what} must be a number > 0 (got {v!r})")
    return int(v) if float(v).is_integer() else v


def thumb(kind_dir, id_):
    """images/<cards|support>/thumb/<id>.webp 300×420 from the 600×840 picture (routine A step 1)."""
    big = os.path.join(ROOT, "images", kind_dir, f"{id_}.webp")
    small = os.path.join(ROOT, "images", kind_dir, "thumb", f"{id_}.webp")
    if not os.path.exists(big):
        return "no picture"
    if os.path.exists(small):
        return "ok"
    from PIL import Image
    os.makedirs(os.path.dirname(small), exist_ok=True)
    Image.open(big).convert("RGB").resize((300, 420), Image.LANCZOS).save(small, "WEBP", quality=82, method=6)
    return "thumb made"


def new_card(c):
    return {
        "id": c["id"], "name": c["name"], "series": c.get("series", ""),
        "image": f"images/cards/{c['id']}.webp",
        "base": {"atk": num(c["atk"], "atk"), "hp": num(c["hp"], "hp"), "def": c.get("def", 0), "status": c.get("status", 0),
                 "odds": num(c["odds"], "odds")},
        "exact": c.get("exact", {}),
        "obtain": c.get("obtain", ""),
        "passive": {"name": c.get("passive", {}).get("name", ""), "desc": c.get("passive", {}).get("desc", "")},
        "skill": {"name": "", "desc": ""},
        "scores": {"atk": 0, "hp": 0, "passive": 0, "skill": 0, "matchup": 0, "team": 0, "overall": 0},
        "tier": "",
        "updated": TODAY,
    }


def merge_card(old, c):
    """Routine A on a card that is already in cards.json: refresh what the picture shows, keep task B's analysis."""
    fresh = new_card(c)
    for k in ("name", "series", "image", "base", "exact", "obtain", "passive"):
        if k == "series" and not fresh[k]:
            continue
        old[k] = fresh[k]
    old["updated"] = TODAY
    return old


def new_support(s):
    eff = s.get("effect", "")
    return {
        "id": s["id"], "name": s["name"], "image": f"images/support/{s['id']}.webp",
        "effect": eff if isinstance(eff, str) else {"name": eff.get("name", ""), "desc": eff.get("desc", "")},
        "odds": num(s["odds"], "odds"),
        "obtain": s.get("obtain", ""),
        "scores": {"effect": 0, "reliability": 0, "flexibility": 0, "synergy": 0, "value": 0},
        "tier": "", "bestWith": [], "bestDeck": [], "avoidWith": [], "notes": "",
        "updated": TODAY,
    }


def merge_support(old, s):
    fresh = new_support(s)
    for k in ("name", "image", "effect", "odds", "obtain"):
        old[k] = fresh[k]
    old["updated"] = TODAY
    return old


def pool_put(pool, kind, id_, name, odds, group):
    items = pool.setdefault("items", [])
    row = next((x for x in items if x.get("kind") == kind and (x.get("id") == id_ or x.get("name") == name)), None)
    if row is None:
        row = {"name": name, "kind": kind, "group": "", "baseOdds": odds, "id": id_}
        items.append(row)
    row.update({"name": name, "baseOdds": odds, "id": id_})
    if group:
        row["group"] = group
    items.sort(key=lambda x: (x.get("kind") != "card", x.get("baseOdds") or 0, x.get("name", "")))


def cmd_apply(path):
    rnd = load(path, None)
    if not rnd or not isinstance(rnd.get("items"), list):
        sys.exit(f"{path}: needs {{\"items\": [...]}} (see `batch.py template`)")
    if len(rnd["items"]) > ROUND_MAX:
        sys.exit(f"{len(rnd['items'])} items: a round is at most {ROUND_MAX} files")
    cut = rank_cut()
    cards = load(os.path.join(DATA, "cards.json"), [])
    sups = load(os.path.join(DATA, "support.json"), [])
    pool = load(os.path.join(DATA, "pool.json"), {"updated": TODAY, "items": []})
    prog = load(PROGRESS, {"updated": TODAY, "round": 0, "files": {}})
    prog["round"] = prog.get("round", 0) + 1
    on_disk = {key: p for _, key, p in inbox_files()}
    report, delete = [], []

    for it in rnd["items"]:
        key, st = it.get("file", ""), it.get("status")
        if key not in on_disk:
            report.append(f"!! {key}: not in the inbox, ignored")
            continue
        rec = {"status": st, "sha1": sha1(on_disk[key]), "round": prog["round"], "date": TODAY}
        try:
            if st == "done":
                if key.startswith("cards/"):
                    c = dict(it["card"])
                    c["id"] = c.get("id") or slug(c["name"])
                    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", c["id"]):
                        raise ValueError(f"bad id {c['id']!r}")
                    old = next((x for x in cards if x["id"] == c["id"]), None)
                    if old and old["name"] != c["name"]:
                        raise ValueError(f"id {c['id']} is already {old['name']}")
                    card = merge_card(old, c) if old else new_card(c)
                    if not old:
                        cards.append(card)
                    ranked = card["base"]["odds"] >= cut
                    pool_put(pool, "card", card["id"], card["name"], card["base"]["odds"], it.get("group", ""))
                    pic = thumb("cards", card["id"])
                    rec.update(id=card["id"], odds=card["base"]["odds"], ranked=ranked)
                    report.append(f"ok {key}: card {card['id']} ({'ranked' if ranked else 'under the cut'}{', updated' if old else ''}) · {pic}")
                else:
                    s = dict(it["support"])
                    s["id"] = s.get("id") or slug(s["name"])
                    old = next((x for x in sups if x["id"] == s["id"]), None)
                    if old and old["name"] != s["name"]:
                        raise ValueError(f"id {s['id']} is already {old['name']}")
                    sup = merge_support(old, s) if old else new_support(s)
                    if not old:
                        sups.append(sup)
                    pool_put(pool, "support", sup["id"], sup["name"], sup["odds"], it.get("group", ""))
                    pic = thumb("support", sup["id"])
                    rec.update(id=sup["id"], odds=sup["odds"], ranked=True)
                    report.append(f"ok {key}: support {sup['id']}{' (updated)' if old else ''} · {pic}")
                if it.get("group") and it["group"] not in GROUPS:
                    report.append(f"   note: group {it['group']!r} is not one of {GROUPS}")
                if pic == "no picture":
                    report.append(f"   note: images/{'cards' if key.startswith('cards/') else 'support'}/{rec['id']}.webp is missing (the site draws placeholder art)")
                delete.append(on_disk[key])
            elif st == "later":
                odds = num(it["odds"], "odds")
                if odds >= cut:
                    raise ValueError(f"1 in {odds:,} is not under the cut (1 in {cut:,}): do it now")
                rec.update(name=it.get("name", ""), odds=odds)
                report.append(f"-- {key}: later ({it.get('name', '?')} · 1 in {odds:,})")
            elif st in ("skipped", "problem"):
                rec["note"] = it.get("note", "")
                if not rec["note"]:
                    raise ValueError("skipped / problem needs a note (what could not be read)")
                report.append(f"-- {key}: {st} · {rec['note']}")
            else:
                raise ValueError(f"unknown status {st!r}")
        except (KeyError, ValueError) as e:
            rec = {"status": "problem", "sha1": rec["sha1"], "round": prog["round"], "date": TODAY, "note": f"apply: {e}"}
            report.append(f"!! {key}: problem · {e}")
        prog["files"][key] = rec

    pool["updated"] = prog["updated"] = TODAY
    save(os.path.join(DATA, "cards.json"), cards)
    save(os.path.join(DATA, "support.json"), sups)
    save(os.path.join(DATA, "pool.json"), pool)
    save(PROGRESS, prog)
    for p in delete:
        os.remove(p)
    print("\n".join(report))
    print(f"\nround {prog['round']}: {len(delete)} added · pictures deleted from the inbox: {len(delete)}")
    first, later, _ = queue()
    print(f"still waiting: {len(first)} new · {len(later)} later")


# ---------- check ----------
def cmd_check():
    cards = load(os.path.join(DATA, "cards.json"), [])
    sups = load(os.path.join(DATA, "support.json"), [])
    pool = load(os.path.join(DATA, "pool.json"), {"items": []})
    cut, bad = rank_cut(), []
    for kind, arr in (("cards", cards), ("support", sups)):
        ids = [x["id"] for x in arr]
        bad += [f"{kind}: id {i} twice" for i in sorted({i for i in ids if ids.count(i) > 1})]
        for x in arr:
            if os.path.exists(os.path.join(ROOT, "images", kind, f"{x['id']}.webp")) and not os.path.exists(os.path.join(ROOT, "images", kind, "thumb", f"{x['id']}.webp")):
                bad.append(f"{kind}: {x['id']} has no thumbnail")
    pids = {(x.get("kind"), x.get("id")) for x in pool.get("items", [])}
    bad += [f"pool: card {c['id']} missing" for c in cards if ("card", c["id"]) not in pids]
    bad += [f"pool: support {s['id']} missing" for s in sups if ("support", s["id"]) not in pids]
    under = [c for c in cards if c["base"]["odds"] < cut]
    bad += [f"cards: {c['id']} is under the cut but has tier {c['tier']} (it will not show on the Tier List)" for c in under if c.get("tier")]
    ranked_todo = [c["id"] for c in cards if c["base"]["odds"] >= cut and not (c.get("tier") and c.get("scores", {}).get("overall"))]
    print(f"cards {len(cards)} ({len(cards) - len(under)} ranked group · {len(under)} under the cut) · support {len(sups)} · pool {len(pool.get('items', []))}")
    print(f"waiting for task B: {len(ranked_todo)} cards · {sum(1 for s in sups if not s.get('tier'))} support")
    print("\n".join(bad) if bad else "all good")


def main():
    a = sys.argv[1:]
    if a[:1] == ["status"]:
        cmd_status()
    elif a[:1] == ["template"]:
        print(json.dumps(TEMPLATE, indent=2, ensure_ascii=False))
    elif a[:1] == ["apply"] and len(a) == 2:
        cmd_apply(a[1])
    elif a[:1] == ["check"]:
        cmd_check()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
