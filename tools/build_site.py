#!/usr/bin/env python3
"""Build the public website into dist/: only the files the site uses (PROGRESS ▶️ แผนปรับปรุงเว็บ รอบ 2).

Cloudflare Pages (owner sets once · Settings → Build): Build command `python3 tools/build_site.py`
· Build output directory `dist` · Root directory empty. Before this, Pages put the whole repo on the web.

    python3 tools/build_site.py           # rebuild dist/ (the old dist/ is deleted first · dist/ is in .gitignore)
    python3 tools/build_site.py --list    # also print every file that goes on the web

What goes on the web = WEB below. Everything else stays in the repo only: PROGRESS.md, HISTORY.md, CLAUDE.md, *.md,
inbox/, cropped_cards/ (game screenshots · rule 10), mockup/, tools/, docs/, data/pending/cards.json,
images/silver/portrait-src/ (raw frames + reference screenshot).
A new file / folder the site loads → add it to WEB (a folder under images/ needs nothing: images/ goes up whole).

Exit 1 (Cloudflare then keeps the last good deploy) when
  · a path the site loads (index.html · site.webmanifest · css url() · js string paths · data/*.json "images/…")
    is in the repo but did not get into dist/, or
  · an internal file got into dist/.
Standard library only, Python 3.6+ (Cloudflare build image).
"""
import json
import os
import re
import shutil
import sys
from fnmatch import fnmatchcase

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

# Patterns are per path segment: "*" never crosses "/", "**" = any number of folders.
WEB = [
    "index.html", "robots.txt", "sitemap.xml", "site.webmanifest",
    "googleac6eef435a8d1c66.html",                   # Google Search Console check · never remove
    "_headers", "_redirects", "404.html",            # Cloudflare Pages extras (only if one is ever added)
    "_routes.json",                                  # Pages: which paths run functions/_middleware.js (internal → 404)
    "css/*.css", "js/*.js",
    "data/*.json",
    "data/pending/support.json",                     # js/battle.js loads it (the rest of data/pending/ is internal)
    "images/**",
    "c/**",                                          # card pages (tools/card_pages.py · round 8)
]
NOT_WEB = [
    "images/silver/portrait-src/**",
]
SKIP_DIRS = {".git", "dist", "node_modules", "__pycache__", ".claude"}

# Never on the web, whatever WEB says (second lock).
INTERNAL_TOP = {"inbox", "cropped_cards", "mockup", "tools", "docs", "functions", ".git", ".claude"}
INTERNAL_EXT = (".md", ".py", ".pyc", ".sh")
INTERNAL_PATHS = {"data/pending/cards.json"}
SITE = "https://card-battle-infinity.pages.dev/"


def match(path, pattern):
    """Segment-wise glob: match("data/pending/x.json", "data/*.json") is False · "**" eats 0+ segments."""
    p, q = path.split("/"), pattern.split("/")

    def go(i, j):
        if j == len(q):
            return i == len(p)
        if q[j] == "**":
            return any(go(k, j + 1) for k in range(i, len(p) + 1))
        return i < len(p) and fnmatchcase(p[i], q[j]) and go(i + 1, j + 1)

    return go(0, 0)


def repo_files():
    for top, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not (top == ROOT and d.startswith(".")))
        for f in sorted(files):
            if f.startswith("."):
                continue
            yield os.path.relpath(os.path.join(top, f), ROOT).replace(os.sep, "/")


def is_web(rel):
    return any(match(rel, w) for w in WEB) and not any(match(rel, n) for n in NOT_WEB)


def is_internal(rel):
    return (rel.split("/")[0] in INTERNAL_TOP or rel.lower().endswith(INTERNAL_EXT)
            or rel in INTERNAL_PATHS or "/portrait-src/" in rel)


def clean(ref, base=""):
    """A link / src as written → repo path, or None when it is not a file of this site."""
    ref = ref.strip()
    if ref.startswith(SITE):
        ref, base = ref[len(SITE):], ""             # the site's own full URL = from the root
    elif re.match(r"^(?:[a-z]+:|//|#)", ref, re.I) or not ref:
        return None
    ref = ref.split("#")[0].split("?")[0]
    if not ref or ref.endswith("/") or "${" in ref:
        return None
    if ref.startswith("/"):                          # root path (card pages: /css/…, /images/…)
        base = ""
    path = os.path.normpath(os.path.join(base, ref.lstrip("/"))).replace(os.sep, "/")
    return None if path.startswith("..") else path


def references(dist):
    """Every file path the built site asks for that can be read from its files (no template paths)."""
    refs = {}

    def add(path, src):
        if path:
            refs.setdefault(path, src)

    def read(rel):
        with open(os.path.join(dist, rel), encoding="utf-8") as fh:
            return fh.read()

    files = []
    for top, _, names in os.walk(dist):
        files += [os.path.relpath(os.path.join(top, n), dist).replace(os.sep, "/") for n in names]
    for rel in files:
        if rel.endswith(".html"):
            for attr, ref in re.findall(r'\b(src|href|content)\s*=\s*"([^"]+)"', read(rel)):
                if attr == "content" and not ref.startswith(SITE):
                    continue                         # meta text (description, generator …), not a file
                if re.search(r"\.\w{2,5}(?:[?#].*)?$", ref):
                    add(clean(ref, os.path.dirname(rel)), rel)
        elif rel.endswith(".webmanifest"):
            for icon in json.loads(read(rel)).get("icons", []):
                add(clean(icon.get("src", ""), os.path.dirname(rel)), rel)
        elif rel.endswith(".css"):
            for ref in re.findall(r"url\(\s*['\"]?([^'\")]+)", read(rel)):
                add(clean(ref, os.path.dirname(rel)), rel)
        elif rel.endswith(".js"):        # paths in js are read from the page (index.html), not from js/
            for ref in re.findall(r"[\"'`]((?:images|data|css|js)/[^\"'`\s]+?\.\w{2,5})(?=[\"'`?#])", read(rel)):
                add(clean(ref), rel)
        elif rel.endswith(".json") and rel.startswith("data/"):
            for ref in re.findall(r'"((?:images|data)/[^"]+\.\w{2,5})"', read(rel)):
                add(clean(ref), rel)
    return refs


def build(listing=False):
    if os.path.basename(DIST) != "dist" or os.path.dirname(DIST) != ROOT:
        sys.exit("refusing to clear " + DIST)
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)

    web, left = [], {}
    for rel in repo_files():
        if is_web(rel):
            web.append(rel)
        else:
            top = rel.split("/")[0] if "/" in rel else "(root files)"
            n, size = left.get(top, (0, 0))
            left[top] = (n + 1, size + os.path.getsize(os.path.join(ROOT, rel)))

    total = 0
    for rel in web:
        dst = os.path.join(DIST, *rel.split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, *rel.split("/")), dst)
        total += os.path.getsize(dst)
        if listing:
            print("  " + rel)

    errors = []
    leaked = [rel for rel in web if is_internal(rel)]
    errors += ["internal file in dist/: " + rel for rel in leaked]
    gone, broken = [], []
    for path, src in sorted(references(DIST).items()):
        if os.path.isfile(os.path.join(DIST, path)):
            continue
        (gone if os.path.isfile(os.path.join(ROOT, path)) else broken).append("%s (from %s)" % (path, src))
    errors += ["the site loads it but it is not in dist/ (add it to WEB): " + g for g in gone]

    print("dist/: %d files · %.1f MB" % (len(web), total / 1e6))
    print("kept off the web: " + " · ".join(
        "%s %d (%.1f MB)" % (top, n, size / 1e6) for top, (n, size) in sorted(left.items(), key=lambda kv: -kv[1][1])))
    for b in broken:
        print("note: missing in the repo too (the site already falls back): " + b)
    if errors:
        print("\n".join("ERROR: " + e for e in errors))
        sys.exit(1)
    print("ok: every path the site loads is in dist/ · no internal files")


if __name__ == "__main__":
    build(listing="--list" in sys.argv[1:])
