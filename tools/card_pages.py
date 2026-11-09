#!/usr/bin/env python3
"""One page per card and support for Google and link previews (PROGRESS ▶️ แผนปรับปรุงเว็บ รอบ 8).
Pages live in the repo (no Cloudflare build): c/<id>/index.html (card or support) + c/index.html (all) + sitemap.xml.

    python3 tools/card_pages.py           # write c/ + sitemap.xml from data/ (after any change to cards / support / ?v=)
    python3 tools/card_pages.py --check   # exit 1 when c/ or sitemap.xml is out of date (writes nothing)

· Numbers are the site's own: ports of js/app.js statAt / oddsAt / shortNum (fmtOdds) / fmtHp / fmtStat and the tier cut
  (topOnly + isRanked). A change there = change it here too (tools/card_pages_test.js compares every number with window.CBI).
· Support text = the Normal values ({0} → effect.vals[0]); the other rarities (soft caps, steps, Mutation bonus) stay on the
  site (app.js supValAt) and are not copied here.
· Each page: name, art, odds, HP / ATK at all 9 rarities (cards), abilities, tier when ranked, "Open in database" → /#card/<id>.
  No redirect: a page that jumps to /#card/<id> counts as a redirect to the home page for Google (owner chose 2026-11-09).
· css/js load with the ?v= of index.html (tools/bump_version.py runs this script after it changes the number).
· Old c/<id>/ folders whose card left the site are removed (only folders this script wrote: the generator meta tag).
Standard library only.
"""
import html
import json
import math
import os
import re
import shutil
import sys
from decimal import ROUND_HALF_UP, Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://card-battle-infinity.pages.dev/"
OUT = "c"
MARK = '<meta name="generator" content="tools/card_pages.py">'
FONTS = "https://fonts.googleapis.com/css2?family=Marcellus+SC&family=Nunito+Sans:wght@400;600;700;800&display=swap"
CSS = ["tokens", "base", "fx", "tiermaker", "cardpage"]          # .panel / page head / .fx-* / .tm-btn are the site's own
TIER_VAR = {"Meta": "--t-meta", "SS": "--t-ss", "S": "--t-s", "A": "--t-a", "B": "--t-b", "C": "--t-c", "D": "--t-d",
            "Utility": "--t-x-teal"}                             # = TIER_COLOR in js/app.js


def read_json(rel, default=None):
    try:
        with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        if default is None:
            raise
        return default


def version():
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
        nums = [int(v) for v in re.findall(r"(?:css|js)/[\w./-]+\.(?:css|js)\?v=(\d+)", fh.read())]
    return max(nums) if nums else 1


# ---------- numbers: ports of js/app.js ----------
def js_round(x):                      # Math.round: halves go up
    return int(math.floor(x + 0.5))


def to_fixed1(x):                     # Number.prototype.toFixed(1): the nearest tenth of the exact binary value, ties up
    return Decimal(x).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def num_str(d):                       # a JS Number printed: 15 · 14.8 (no trailing .0)
    s = format(d, "f")
    return s.rstrip("0").rstrip(".") if "." in s else s


def commas(n):                        # toLocaleString("en-US") of a whole number
    return "{:,}".format(int(n))


SHORT = [(1e18, "Qi"), (1e15, "Qd"), (1e12, "T"), (1e9, "B"), (1e6, "M")]


def short_num(n):
    if js_round(n) < 1e4:
        return commas(js_round(n))
    if js_round(n / 1e3) < 1000:
        return "%dK" % js_round(n / 1e3)
    for i, (v, s) in enumerate(SHORT):
        if n < v and v != 1e6:
            continue
        x = n / v
        r = Decimal(js_round(x)) if x >= 100 else to_fixed1(x)
        return "1" + SHORT[i - 1][1] if r >= 1000 and i > 0 else num_str(r) + s
    return commas(js_round(n))


def fmt_odds(n):
    return "1 in " + short_num(n)


def fmt_stat(n):
    return commas(js_round(n))


def fmt_hp(n):
    n = js_round(n)
    if n < 1e8:
        return commas(n)
    for i, (v, u) in enumerate(SHORT):
        if n < v:
            continue
        t = to_fixed1(n / v)
        return "1.0" + SHORT[i - 1][1] if t >= 1000 and i > 0 else format(t, "f") + u
    return commas(n)


def stat_at(card, key, rarity):
    ex = (card.get("exact") or {}).get(rarity["name"]) or {}
    if ex.get(key):
        return ex[key]
    return js_round(card["base"][key] * rarity["stat"])


def odds_at(x, rarity, support):
    base = (float(x.get("odds") or 0) if support else x["base"]["odds"])
    return base * rarity["odds"]


def sup_text(s):                      # effect text at Normal: {i} → vals[i] (1 decimal, or 0 with effect.dp 0)
    e = s.get("effect") if isinstance(s.get("effect"), dict) else {}
    vals = e.get("vals") if isinstance(e.get("vals"), list) else []
    dp0 = e.get("dp") == 0
    text = re.sub(r"\s*Mutation bonus: \+[\d.]+% damage and max HP\.?", "", str(e.get("desc") or ""), flags=re.I)

    def val(m):
        i = int(m.group(1))
        if i >= len(vals) or vals[i] is None:
            return m.group(0)
        v = float(vals[i])
        return str(js_round(v)) if dp0 else num_str(to_fixed1(v))
    return re.sub(r"\{(\d)\}", val, text)


def shown_tiers(items, val, top, extra):
    """id → tier the site shows (topOnly at boot + isRanked) · beyond meta.rankTop = no tier · rows like Utility keep theirs."""
    ranked = sorted([x for x in items if x.get("tier") and x["tier"] not in extra and val(x) > 0], key=lambda x: -val(x))
    cut = {x["id"] for x in ranked[top:]}
    return {x["id"]: x["tier"] for x in items if x.get("tier") and x["id"] not in cut and val(x) > 0}


# ---------- html ----------
def e(s):
    return html.escape(str(s), quote=True)


def clip(text, n=158):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= n:
        return text
    cut = text[: n - 1].rsplit(" ", 1)[0].rstrip(",;:.")
    return cut + "…"


def head(title, desc, url, image=None, image_alt="", v=1, ld=None):
    og_img = image or SITE + "images/og.png"
    lines = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
        "  <title>%s</title>" % e(title),
        '  <meta name="description" content="%s">' % e(desc),
        '  <link rel="canonical" href="%s">' % e(url),
        '  <meta name="robots" content="index, follow, max-image-preview:large">',
        '  <meta name="theme-color" content="#0f1638">',
        '  <meta name="color-scheme" content="dark">',
        "  " + MARK,
        '  <meta property="og:type" content="website">',
        '  <meta property="og:site_name" content="Card Battle Infinity">',
        '  <meta property="og:title" content="%s">' % e(title),
        '  <meta property="og:description" content="%s">' % e(desc),
        '  <meta property="og:url" content="%s">' % e(url),
        '  <meta property="og:image" content="%s">' % e(og_img),
    ]
    if image:
        lines += ['  <meta property="og:image:type" content="image/webp">',
                  '  <meta property="og:image:width" content="600">',
                  '  <meta property="og:image:height" content="800">',
                  '  <meta property="og:image:alt" content="%s">' % e(image_alt)]
    lines += [
        '  <meta name="twitter:card" content="summary_large_image">',
        '  <meta name="twitter:title" content="%s">' % e(title),
        '  <meta name="twitter:description" content="%s">' % e(desc),
        '  <meta name="twitter:image" content="%s">' % e(og_img),
        '  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg?v=2">',
        '  <link rel="icon" type="image/png" sizes="48x48" href="/images/favicon-48.png?v=2">',
        '  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png?v=2">',
        '  <link rel="manifest" href="/site.webmanifest?v=2">',
        '  <link rel="preconnect" href="https://fonts.googleapis.com">',
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '  <link rel="stylesheet" href="%s" media="print" onload="this.media=\'all\'">' % FONTS,
        '  <noscript><link rel="stylesheet" href="%s"></noscript>' % FONTS,
    ]
    lines += ['  <link rel="stylesheet" href="/css/%s.css?v=%d">' % (c, v) for c in CSS]
    if ld:
        lines.append('  <script type="application/ld+json">%s</script>'
                     % json.dumps(ld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
    lines.append("</head>")
    return "\n".join(lines)


SPRITE = ('<svg class="svg-sprite" aria-hidden="true"><symbol id="i-flourish" viewBox="0 0 60 20"><g fill="none" '
          'stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M30 4l5 6-5 6-5-6z" fill="currentColor" '
          'fill-opacity=".25"/><path d="M25 10c-6 0-8-5-14-5-4 0-6 3-4 5M35 10c6 0 8-5 14-5 4 0 6 3 4 5"/><path d="M25 10C19 '
          '10 17 15 11 15c-4 0-6-3-4-5M35 10c6 0 8 5 14 5 4 0 6-3 4-5" stroke-width=".7"/></g></symbol></svg>')


def top_bar(here):
    links = [("/#cards", "Cards"), ("/#support", "Support"), ("/c/", "All cards")]
    a = "".join('<a class="cp-link fx-press" href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == here else "", t)
                for h, t in links)
    return ('<header class="cp-top">\n  <a class="cp-brand fx-press" href="/"><img src="/images/favicon.svg?v=2" alt="" '
            'width="28" height="28"><span>Card Battle Infinity</span></a>\n  <nav class="cp-top__links" '
            'aria-label="Site">%s</nav>\n</header>' % a)


def page_head(eyebrow, title):
    return ('<div class="page__head">\n      <p class="page__eyebrow">%s</p>\n      <h1 class="page__title">%s</h1>\n'
            '      <div class="page__rule" aria-hidden="true"><svg><use href="#i-flourish"/></svg></div>\n    </div>'
            % (e(eyebrow), e(title)))


def foot(v):
    return ('<footer class="cp-foot">Fan-made database for the Roblox game Card Battle Infinity · '
            '<a href="/">card-battle-infinity.pages.dev</a></footer>\n'
            '<script src="/js/cardpage.js?v=%d" defer></script>\n</body>\n</html>\n' % v)


def fact(label, value, cls="", style=""):
    return '<div class="cp-fact%s"%s><dt>%s</dt><dd>%s</dd></div>' % (
        " " + cls if cls else "", ' style="%s"' % style if style else "", e(label), e(value))


def item_page(x, kind, meta, tier, prev, nxt, v):
    sup = kind == "support"
    name, xid = x["name"], x["id"]
    url = SITE + "c/%s/" % xid
    rar = meta["rarities"]
    normal = rar[0]
    img = x.get("image") or ""
    odds = fmt_odds(odds_at(x, normal, sup))
    blocks = []                                        # ability panels
    if sup:
        eff = x.get("effect") if isinstance(x.get("effect"), dict) else {"name": "", "desc": x.get("effect") or ""}
        text = sup_text(x)
        if text or eff.get("name"):
            blocks.append(("Effect · at Normal", eff.get("name") or "Effect", text))
        desc = "%s, a support card in Card Battle Infinity (Roblox): %s. %s%s" % (
            name, odds, (eff.get("name") + ": ") if eff.get("name") else "", text)
        title = "%s — Support Card Effect & Odds | Card Battle Infinity" % name
    else:
        for label, a in (("Passive", x.get("passive")), ("Skill", x.get("skill"))):
            if isinstance(a, dict) and (a.get("name") or a.get("desc")):
                blocks.append((label, a.get("name") or label, a.get("desc") or ""))
        hp, atk = fmt_hp(stat_at(x, "hp", normal)), fmt_stat(stat_at(x, "atk", normal))
        lead = blocks[0] if blocks else None
        desc = "%s in Card Battle Infinity (Roblox): %s, HP %s and ATK %s at Normal.%s" % (
            name, odds, hp, atk, (" %s: %s" % (lead[1], lead[2])) if lead else "")
        title = "%s — Card Stats, Odds & Ability | Card Battle Infinity" % name
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Card Battle Infinity", "item": SITE},
        {"@type": "ListItem", "position": 2, "name": "All cards", "item": SITE + "c/"},
        {"@type": "ListItem", "position": 3, "name": name, "item": url}]}
    out = [head(title, clip(desc), url, SITE + img if img else None, "%s card art" % name, v, ld),
           '<body class="cp">', '<div id="backdrop" aria-hidden="true"></div>', SPRITE, top_bar(""),
           '<main class="main cp-main">', '  <article class="page fx-page-in">',
           '    <nav class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span>'
           '<a href="/c/">All cards</a><span aria-hidden="true">›</span><span aria-current="page">%s</span></nav>' % e(name),
           "    " + page_head("The Archive · Support card" if sup else "The Archive · Card", name),
           '    <div class="cp-hero fx-up">']
    if img:
        out.append('      <figure class="cp-art"><img src="/%s" alt="%s card art" width="600" height="800" '
                   'fetchpriority="high" decoding="async"></figure>' % (e(img), e(name)))
    facts = [fact("Odds", odds)]
    if not sup:
        facts += [fact("HP", fmt_hp(stat_at(x, "hp", normal)), "cp-fact--hp"),
                  fact("ATK", fmt_stat(stat_at(x, "atk", normal)), "cp-fact--atk")]
    if tier:
        facts.append(fact("Tier", tier, "cp-fact--tier", "--tc: var(%s)" % TIER_VAR.get(tier, "--t-d")))
    if x.get("series"):
        facts.append(fact("Series", x["series"]))
    if x.get("obtain"):
        facts.append(fact("How to get", x["obtain"], "cp-fact--wide"))
    out += ['      <div class="cp-info">',
            '        <dl class="cp-facts">%s</dl>' % "".join(facts),
            '        <a class="tm-btn tm-btn--primary fx-press cp-open" href="/#card/%s">Open in database'
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a>' % e(xid)]
    for label, aname, text in blocks:
        out.append('        <section class="panel cp-sec"><h2><small>%s</small>%s</h2>%s</section>'
                   % (e(label), e(aname), "<p>%s</p>" % e(text) if text else ""))
    out += ["      </div>", "    </div>"]
    rows = []
    for r in rar:
        cells = ['<th scope="row"><i class="cp-dot" data-r="%s" aria-hidden="true"></i>%s</th>' % (e(r["name"]), e(r["name"])),
                 '<td class="cp-odds">%s</td>' % e(fmt_odds(odds_at(x, r, sup)))]
        if not sup:
            cells += ['<td class="cp-hp">%s</td>' % e(fmt_hp(stat_at(x, "hp", r))),
                      '<td class="cp-atk">%s</td>' % e(fmt_stat(stat_at(x, "atk", r)))]
        rows.append("<tr>%s</tr>" % "".join(cells))
    cols = '<th scope="col">Rarity</th><th scope="col">Odds</th>' + (
        "" if sup else '<th scope="col">HP</th><th scope="col">ATK</th>')
    out += ['    <section class="panel cp-sec cp-rar%s fx-up">' % (" cp-rar--sup" if sup else ""),
            "      <h2>%s</h2>" % ("Odds by rarity" if sup else "Stats by rarity"),
            '      <div class="cp-table"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>'
            % (cols, "".join(rows)),
            "    </section>",
            '    <nav class="cp-pn" aria-label="%s">' % ("Other support cards" if sup else "Other cards")]
    if prev:
        out.append('      <a class="tm-btn fx-press" href="/c/%s/" rel="prev"><span aria-hidden="true">‹</span> %s</a>'
                   % (e(prev["id"]), e(prev["name"])))
    if nxt:
        out.append('      <a class="tm-btn fx-press cp-pn__next" href="/c/%s/" rel="next">%s <span aria-hidden="true">›</span></a>'
                   % (e(nxt["id"]), e(nxt["name"])))
    out += ["    </nav>", "  </article>", "</main>", foot(v)]
    return "\n".join(out)


def thumb(img):
    i = img.rfind("/")
    t = img[: i + 1] + "thumb/" + img[i + 1:]
    return t if os.path.isfile(os.path.join(ROOT, t)) else img


def index_page(groups, v):
    n = sum(len(g[2]) for g in groups)
    desc = ("Every card in Card Battle Infinity (Roblox): %d cards and %d support cards with odds, HP and ATK at all "
            "9 rarities and their abilities." % (len(groups[0][2]), len(groups[1][2])))
    out = [head("All Cards & Support Cards | Card Battle Infinity", desc, SITE + "c/", None, "", v),
           '<body class="cp">', '<div id="backdrop" aria-hidden="true"></div>', SPRITE, top_bar("/c/"),
           '<main class="main cp-main">', '  <article class="page fx-page-in">',
           "    " + page_head("The Archive", "All cards")]
    k = 0
    for gid, label, items in groups:
        out.append('    <section class="cp-group" aria-labelledby="cp-%s">' % gid)
        out.append('      <h2 class="page__subtitle" id="cp-%s">%s <small>%d</small></h2>' % (gid, e(label), len(items)))
        out.append('      <ul class="cp-tiles">')
        for x in items:
            k += 1
            img = x.get("image") or ""
            pic = ('<img src="/%s" alt="" width="300" height="400"%s decoding="async">'
                   % (e(thumb(img)), "" if k <= 12 else ' loading="lazy"')) if img else ""
            out.append('        <li><a class="cp-tile fx-press" href="/c/%s/">%s<span>%s</span></a></li>'
                       % (e(x["id"]), pic, e(x["name"])))
        out += ["      </ul>", "    </section>"]
    out += ["  </article>", "</main>", foot(v)]
    assert k == n
    return "\n".join(out)


def sitemap(entries):
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, mod, freq, pri in entries:
        out += ["  <url>", "    <loc>%s</loc>" % e(loc)]
        if mod:
            out.append("    <lastmod>%s</lastmod>" % mod)
        out += ["    <changefreq>%s</changefreq>" % freq, "    <priority>%s</priority>" % pri, "  </url>"]
    out.append("</urlset>")
    return "\n".join(out) + "\n"


def day(s):
    m = re.match(r"^\d{4}-\d{2}-\d{2}", str(s or ""))
    return m.group(0) if m else ""


def build():
    """→ {repo path: text} for every file this script owns."""
    meta = read_json("data/meta.json")
    cards = [c for c in read_json("data/cards.json") if c.get("id") and c.get("name") and c.get("base")]
    sups = [s for s in read_json("data/support.json", []) if s.get("id") and s.get("name")]
    news = read_json("data/news.json", {})
    v = version()
    extra = {t["name"] for t in meta.get("tiers", []) if t.get("cardsOnly")}
    top = int(meta.get("rankTop") or 48)
    top_s = int(meta.get("rankTopSupport") or top)
    ctier = shown_tiers(cards, lambda c: float((c.get("scores") or {}).get("overall") or 0), top, extra)
    stier = shown_tiers(sups, lambda s: float((s.get("scores") or {}).get("value") or 0), top_s, extra)
    files = {}
    groups = []
    for gid, label, kind, items, tiers in (("cards", "Cards", "card", cards, ctier),
                                           ("support", "Support cards", "support", sups, stier)):
        items = sorted(items, key=lambda x: (x["name"].lower(), x["id"]))
        groups.append((gid, label, items))
        for i, x in enumerate(items):
            files["%s/%s/index.html" % (OUT, x["id"])] = item_page(
                x, kind, meta, tiers.get(x["id"], ""), items[i - 1] if i else None,
                items[i + 1] if i + 1 < len(items) else None, v)
    files[OUT + "/index.html"] = index_page(groups, v)
    every = [x for g in groups for x in g[2]]
    newest = max([day(x.get("updated")) for x in every] + [day(meta.get("updated"))])
    home = max(day(meta.get("updated")), day(news.get("updated")))
    files["sitemap.xml"] = sitemap([(SITE, home, "weekly", "1.0"), (SITE + "c/", newest, "weekly", "0.8")]
                                   + [(SITE + "c/%s/" % x["id"], day(x.get("updated")), "monthly", "0.6") for x in every])
    return files


def stale(files):
    """c/<id>/ folders this script wrote before whose card is gone."""
    base = os.path.join(ROOT, OUT)
    gone = []
    if os.path.isdir(base):
        for d in sorted(os.listdir(base)):
            page = os.path.join(base, d, "index.html")
            if "%s/%s/index.html" % (OUT, d) in files or not os.path.isfile(page):
                continue
            with open(page, encoding="utf-8") as fh:
                if MARK in fh.read():
                    gone.append(d)
    return gone


def main(argv):
    files = build()
    changed = []
    for rel, text in sorted(files.items()):
        path = os.path.join(ROOT, *rel.split("/"))
        try:
            with open(path, encoding="utf-8") as fh:
                same = fh.read() == text
        except OSError:
            same = False
        if not same:
            changed.append(rel)
    gone = stale(files)
    if "--check" in argv:
        if changed or gone:
            print("out of date: %d file(s) %s%s · run python3 tools/card_pages.py" % (
                len(changed), ", ".join(changed[:5]) + (" …" if len(changed) > 5 else ""),
                (" · stale: " + ", ".join(gone)) if gone else ""))
            sys.exit(1)
        print("ok: %d card pages + c/index.html + sitemap.xml up to date" % (len(files) - 2))
        return
    for rel in changed:
        path = os.path.join(ROOT, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(files[rel])
    for d in gone:
        shutil.rmtree(os.path.join(ROOT, OUT, d))
    print("card pages: %d written · %d unchanged · %d removed (%s) · ?v=%d" % (
        len(changed), len(files) - len(changed), len(gone), ", ".join(gone) or "none", version()))


if __name__ == "__main__":
    main(sys.argv[1:])
