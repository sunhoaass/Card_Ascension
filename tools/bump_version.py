#!/usr/bin/env python3
"""Bump the ?v= cache number on every css/ and js/ line of index.html (PROGRESS.md rule 9) in one go.

    python3 tools/bump_version.py           # all css/js ?v= -> (highest now + 1), and PROGRESS.md rule 9 "ตอนนี้ / ครั้งถัดไป"
    python3 tools/bump_version.py 130       # all -> 130
    python3 tools/bump_version.py --check   # exit 1 when the numbers are not all the same (no change)
                                            # or sw.js's file lists don't match the repo (improvement round 5)

Site icons use their own number (?v=2 · images/ + site.webmanifest) and are never touched here.
sw.js needs no number: js/app.js registers it as sw.js?v=<its own ?v=> (a new ?v= = a new service worker).
After a bump it runs tools/card_pages.py (the card pages c/<id>/ use the same ?v=).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
PROGRESS = ROOT / "PROGRESS.md"
ASSET = re.compile(r'((?:css|js)/[\w./-]+\.(?:css|js))\?v=(\d+)')
RULE9 = re.compile(r"ตอนนี้ `(\d+)` · ครั้งถัดไป `(\d+)`")


def sw_problems():
    sys.path.insert(0, str(ROOT / "tools"))
    from build_site import sw_problems as check   # one check for both tools
    return check(str(ROOT))


def main(argv):
    html = INDEX.read_text(encoding="utf-8")
    found = ASSET.findall(html)
    if not found:
        sys.exit("no css/js ?v= in index.html")
    nums = sorted({int(v) for _, v in found})
    if "--check" in argv:
        bad = sw_problems()
        for b in bad:
            print(b)
        if len(nums) > 1:
            odd = [f"{p}?v={v}" for p, v in found if int(v) != max(nums)]
            print(f"mixed ?v= numbers {nums}: " + ", ".join(odd))
            sys.exit(1)
        if bad:
            sys.exit(1)
        print(f"ok: {len(found)} files on ?v={nums[0]} · sw.js lists match")
        return
    args = [a for a in argv if not a.startswith("-")]
    new = int(args[0]) if args else max(nums) + 1
    if new <= max(nums) and not args:
        sys.exit("new number must be higher than the current one")
    html, n = ASSET.subn(lambda m: f"{m.group(1)}?v={new}", html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"index.html: {n} css/js lines {nums} -> ?v={new}")
    if PROGRESS.exists():
        text = PROGRESS.read_text(encoding="utf-8")
        text, k = RULE9.subn(f"ตอนนี้ `{new}` · ครั้งถัดไป `{new + 1}`", text, count=1)
        if k:
            PROGRESS.write_text(text, encoding="utf-8")
            print(f"PROGRESS.md rule 9: now {new} · next {new + 1}")
        else:
            print("PROGRESS.md rule 9 pattern not found (update it by hand)")
    pages = ROOT / "tools" / "card_pages.py"   # the card pages c/<id>/ load css/js with the same ?v= (round 8)
    if pages.exists():
        import subprocess
        subprocess.run([sys.executable, str(pages)], check=False)


if __name__ == "__main__":
    main(sys.argv[1:])
