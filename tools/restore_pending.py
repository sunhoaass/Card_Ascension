#!/usr/bin/env python3
"""Move cards / supports back from data/pending/ into the site's data (owner 2026-11-03: the site shows only cards already
redrawn · everything not redrawn yet waits in data/pending/cards.json + support.json, which the site never loads).

    python3 tools/restore_pending.py <id> [<id> …]

Run it at the start of a redraw round for the ids being redrawn (tools/erase_all.py finds an id in data/cards.json /
support.json) · then the usual steps: game text, "redraw": true, image in rd/. Ids not in pending are reported, nothing else changes.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def path(*p):
    return os.path.join(ROOT, "data", *p)


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(p, data):
    with open(p, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def main(ids):
    if not ids: raise SystemExit(__doc__)
    want = set(ids)
    for kind in ("cards", "support"):
        live, wait = load(path(kind + ".json")), load(path("pending", kind + ".json"))
        back = [x for x in wait if x.get("id") in want]
        if not back: continue
        have = {x.get("id") for x in live}
        live += [x for x in back if x["id"] not in have]
        save(path(kind + ".json"), live)
        save(path("pending", kind + ".json"), [x for x in wait if x.get("id") not in want])
        for x in back: print(kind, x["id"]); want.discard(x["id"])
    for i in sorted(want): print("not in pending:", i)


if __name__ == "__main__":
    main(sys.argv[1:])
