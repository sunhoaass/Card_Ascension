// Check the card pages c/<id>/ (tools/card_pages.py) against the site's own numbers (window.CBI in js/app.js).
// Every card / support: odds at 9 rarities, HP / ATK at 9 rarities (cards), tier shown or not, support text at Normal.
//   python3 -m http.server 8010 --bind 127.0.0.1 &   (from the repo root)
//   node tools/card_pages_test.js [http://127.0.0.1:8010/]
// Exit 1 on any difference. Needs Playwright (preinstalled in Claude's cloud sessions).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:8010/";
const ROOT = path.resolve(__dirname, "..");
const unesc = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + "#home", { waitUntil: "load" });
  await page.waitForFunction(() => window.CBI && window.CBI.state && window.CBI.state.loaded, null, { timeout: 30000 });
  const want = await page.evaluate(() => {
    const C = window.CBI, S = C.state, R = S.meta.rarities.map((r) => r.name);
    const one = (x) => {
      const sup = C.isSupport(x);
      return {
        id: x.id, sup,
        odds: R.map((r) => C.fmtOdds(C.oddsAt(x, r))),
        hp: sup ? null : R.map((r) => C.fmtHp(C.statAt(x, "hp", r))),
        atk: sup ? null : R.map((r) => C.fmtStat(C.statAt(x, "atk", r))),
        tier: C.isRanked(x) ? x.tier : "",
        text: sup && x.effect && typeof x.effect === "object" ? C.supText(x, x.effect.desc, "Normal") : null,
      };
    };
    return S.cards.map(one).concat((S.support || []).map(one));
  });
  await browser.close();

  let bad = 0, n = 0;
  const fail = (id, what, a, b) => { bad++; if (bad <= 25) console.log(`DIFF ${id} ${what}: site ${JSON.stringify(a)} · page ${JSON.stringify(b)}`); };
  for (const w of want) {
    const file = path.join(ROOT, "c", w.id, "index.html");
    if (!fs.existsSync(file)) { fail(w.id, "page", "exists", "missing"); continue; }
    const html = fs.readFileSync(file, "utf8");
    n++;
    const rows = [...html.matchAll(/<tr><th scope="row">.*?<\/th>(.*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => unesc(c[1].replace(/<[^>]+>/g, ""))));
    if (rows.length !== w.odds.length) { fail(w.id, "rows", w.odds.length, rows.length); continue; }
    rows.forEach((r, i) => {
      if (r[0] !== w.odds[i]) fail(w.id, "odds#" + i, w.odds[i], r[0]);
      if (!w.sup) {
        if (r[1] !== w.hp[i]) fail(w.id, "hp#" + i, w.hp[i], r[1]);
        if (r[2] !== w.atk[i]) fail(w.id, "atk#" + i, w.atk[i], r[2]);
      }
    });
    const tier = (html.match(/<dt>Tier<\/dt><dd>(.*?)<\/dd>/) || [])[1] || "";
    if (unesc(tier) !== w.tier) fail(w.id, "tier", w.tier, tier);
    if (w.sup && w.text != null) {
      const p = (html.match(/<small>Effect · at Normal<\/small>.*?<\/h2>(?:<p>(.*?)<\/p>)?/) || [])[1] || "";
      if (unesc(p) !== w.text) fail(w.id, "effect text", w.text, unesc(p));
    }
  }
  const extra = fs.readdirSync(path.join(ROOT, "c")).filter((d) => fs.existsSync(path.join(ROOT, "c", d, "index.html")) && !want.some((w) => w.id === d));
  extra.forEach((d) => fail(d, "page", "no such card on the site", "exists"));
  console.log(bad ? `FAILED: ${bad} difference(s) in ${n} pages` : `ok: ${n} pages match the site (odds · HP · ATK at every rarity · tier · support text)`);
  process.exit(bad ? 1 : 0);
})();
