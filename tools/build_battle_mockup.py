"""Build mockup/battle.html from the real index.html (PROGRESS ▶️ "⚔️ ระบบต่อสู้" · step ① round 3).

The mockup is the real site (every page, CSS, JS and data) with <base href="../"> so it runs from mockup/,
plus a 4th menu button "Battle" and the Battle page (mockup/battle/battle.css + battle.js). Nothing in the real
site changes. Run again after index.html changes:  python3 tools/build_battle_mockup.py
--artifact DIR also writes DIR/index.html for the claude.ai artifact (no <base>, no ?v=, no own <html>/<head>/<body>).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

NAV_BTN = """      <!-- MOCKUP: Battle (PROGRESS ▶️ ⚔️ · mockup/battle/battle.js shows the page; app.js stays as it is) -->
      <li><button class="nav__btn fx-press" data-page="battle" type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/></svg><span>Battle</span></button></li>
"""

PAGE = """
    <!-- ===================== MOCKUP · Battle (PROGRESS ▶️ ⚔️ · step ① round 3) ===================== -->
    <section id="page-battle" class="page" hidden aria-labelledby="bt-title" data-no-detail>
      <div class="page__head">
        <p class="page__eyebrow">The Colosseum</p>
        <h1 id="bt-title" class="page__title">Battle</h1>
        <div class="page__rule" aria-hidden="true"><svg><use href="#i-flourish"/></svg></div>
        <p class="page__lead">Build a team like a deck, then fight the Guild Boss or another team.</p>
      </div>

      <div class="bt-lab" lang="th">
        <div class="bt-lab__row">
          <span class="bt-lab__tag">MOCKUP</span>
          <button type="button" class="bt-lab__b fx-press" data-bt-lab="boss">Guild Boss</button>
          <button type="button" class="bt-lab__b fx-press" data-bt-lab="arena">Arena</button>
          <button type="button" class="bt-lab__b fx-press" data-bt-lab="result">Result</button>
          <button type="button" class="bt-lab__b fx-press" data-bt-lab="ask">คำถาม <span id="bt-ask-count">0 / 9</span></button>
        </div>
        <p class="bt-lab__note" id="bt-note"></p>
      </div>

      <div id="bt-tabs" class="seg glass" role="tablist" aria-label="Battle mode" style="--n:2;--i:0">
        <span class="seg__ind" aria-hidden="true"></span>
        <button class="seg__btn fx-press" type="button" role="tab" data-bt-lab="boss" aria-selected="true">Guild Boss</button>
        <button class="seg__btn fx-press" type="button" role="tab" data-bt-lab="arena" aria-selected="false">Arena</button>
      </div>

      <!-- Guild Boss -->
      <div class="bt-view bt-view--boss" data-bt-view="boss">
        <div class="bt-col">
          <section class="panel">
            <div class="bt-h"><h2>Guild Boss</h2><span class="chip glass">Ends in&nbsp;<span class="bt-timer" id="bt-timer">2d 14:32:08</span></span></div>
            <div class="bt-boss">
              <div class="bt-boss__card" id="bt-boss-card"></div>
              <div>
                <h3 class="bt-boss__name">Quirk Thief Overlord</h3>
                <p class="bt-boss__tag">Gets stronger every stage!</p>
                <dl class="bt-kv">
                  <dt>HP</dt><dd class="inf">INFINITE</dd>
                  <dt>ATK (card)</dt><dd class="atk">3,761,530</dd>
                  <dt>ATK in fight</dt><dd class="atk" id="bt-boss-atk">460,425,250</dd>
                  <dt>Support</dt><dd>None</dd>
                </dl>
              </div>
            </div>
          </section>
          <section class="panel bt-stage">
            <div class="bt-stage__top"><span class="tm-field__label">Stage</span><span class="bt-faint">next at <b class="bt-timer">1.02T</b></span></div>
            <div class="bt-stage__top"><span class="bt-stage__n"><span id="bt-stage-n">448</span> <small>/ 1,500</small></span>
              <label class="tm-field" style="margin:0;display:flex;gap:8px;align-items:center"><span class="tm-field__label" style="margin:0">Your stage</span><input class="tm-input" id="bt-stage" type="number" inputmode="numeric" min="1" max="1500" value="448"></label></div>
            <span class="bt-bar"><i style="--p:.62"></i></span>
            <div class="bt-stats"><div class="bt-stat"><span>Guild damage</span><b>18.42T</b></div><div class="bt-stat"><span>Your damage</span><b>2.91T</b></div></div>
          </section>
          <section class="panel">
            <div class="bt-h"><h3>Best fights</h3><small>Saved on this device</small></div>
            <ol class="bt-list" id="bt-best"></ol>
          </section>
        </div>
        <div class="bt-col">
          <section class="panel">
            <div class="bt-h"><h2>Your team</h2><small>Tap a card: rarity, grade, trait, HP / ATK</small></div>
            <div class="bt-team__bar"><span class="bt-team__from" data-team-from="boss"></span><button type="button" class="tm-btn fx-press" data-bt="load" data-team="boss">Load from My Decks</button></div>
            <div class="dk-board" data-board="boss"></div>
          </section>
          <button type="button" class="tm-btn tm-btn--primary fx-press bt-fight-btn" data-bt="fight" data-mode="boss">FIGHT</button>
        </div>
      </div>

      <!-- Arena -->
      <div class="bt-view bt-view--arena" data-bt-view="arena" hidden>
        <section class="panel">
          <div class="bt-h"><h2>Your team</h2><small>Order = who fights first</small></div>
          <div class="bt-team__bar"><span class="bt-team__from" data-team-from="a"></span><button type="button" class="tm-btn fx-press" data-bt="load" data-team="a">Load from My Decks</button></div>
          <div class="dk-board" data-board="a"></div>
        </section>
        <div class="bt-vs"><span>VS</span></div>
        <section class="panel">
          <div class="bt-h"><h2>Enemy team</h2><small>The team you face</small></div>
          <div class="bt-team__bar"><span class="bt-team__from" data-team-from="b"></span><button type="button" class="tm-btn fx-press" data-bt="load" data-team="b">Load from My Decks</button></div>
          <div class="dk-board" data-board="b"></div>
        </section>
        <section class="panel bt-sim">
          <div class="bt-h"><h2>Win chance</h2><small>Same rules as a real fight</small></div>
          <ul class="bt-rules">
            <li>You attack first · 1 round = you hit, then they hit · max 30 rounds</li>
            <li>No team wiped after 30 rounds: more cards alive wins → then team HP % → then HP % of the card fighting</li>
          </ul>
          <div class="bt-sim__ctl">
            <div class="seg glass" style="--n:3;--i:1"><span class="seg__ind" aria-hidden="true"></span><button type="button" class="seg__btn fx-press" data-bt="simn" data-n="100" aria-pressed="false">100</button><button type="button" class="seg__btn fx-press" data-bt="simn" data-n="500" aria-pressed="true">500</button><button type="button" class="seg__btn fx-press" data-bt="simn" data-n="1000" aria-pressed="false">1000</button></div>
            <button type="button" class="tm-btn tm-btn--primary fx-press" data-bt="sim">Simulate</button>
          </div>
          <button type="button" class="tm-btn fx-press" data-bt="fight" data-mode="arena" style="width:100%;margin-top:8px">Watch one fight</button>
          <div id="bt-sim-out"><div class="empty bt-sim__empty"><p class="empty__title">How often do you win?</p><p class="empty__text">Pick how many fights, then tap Simulate: win / lose / draw %, who carries, how luck changes it and a better order to try.</p></div></div>
        </section>
      </div>

      <!-- Result -->
      <div class="bt-view bt-view--result" data-bt-view="result" id="bt-result" hidden></div>

      <!-- Questions for the owner (tap a choice, then Copy answers) -->
      <div class="bt-view" data-bt-view="ask" hidden lang="th">
        <div id="bt-ask-list" class="bt-view"></div>
        <div class="panel glass bt-ask__bar"><button type="button" class="tm-btn fx-press" data-bt="resetask">ล้างคำตอบ</button><button type="button" class="tm-btn tm-btn--primary fx-press" data-bt="copyask">Copy answers</button></div>
        <textarea id="bt-ask-text" class="tm-input" hidden aria-label="Answers to copy"></textarea>
      </div>
    </section>
"""

FIGHT = """
  <!-- MOCKUP · Battle fight (full screen, over the site) -->
  <div class="bt-fight" id="bt-fight" hidden data-no-detail>
    <div class="bt-ft__top">
      <span class="chip glass" id="bt-mode">Guild Boss</span>
      <div class="bt-ft__round"><small>ROUND</small><b id="bt-round">1<em> / 30</em></b></div>
      <div class="bt-ft__tr"><button type="button" class="iconbtn glass fx-press" id="bt-sound" aria-label="Sound on"></button></div>
    </div>
    <div class="bt-arena"><div class="bt-fslot" id="bt-slot-a"></div><div class="bt-fslot" id="bt-slot-b"></div></div>
    <div class="bt-ft__bottom">
      <div class="bt-teams">
        <div class="bt-left"><b><em id="bt-left-a">4/4</em> left</b><div class="bt-bench" id="bt-bench-a"></div></div>
        <div class="bt-left bt-left--b"><b><em id="bt-left-b">1/1</em> left</b><div class="bt-bench" id="bt-bench-b"></div></div>
      </div>
      <div class="bt-ctl">
        <div class="bt-spd" role="group" aria-label="Speed"><button type="button" data-spd="1" aria-pressed="true">1x</button><button type="button" data-spd="2" aria-pressed="false">2x</button><button type="button" data-spd="3" aria-pressed="false">3x</button></div>
        <button type="button" class="tm-btn fx-press" id="bt-hide"><span>Hide</span></button>
        <button type="button" class="tm-btn tm-btn--danger fx-press" id="bt-end">End Battle</button>
      </div>
    </div>
  </div>
"""


def build():
    s = (ROOT / "index.html").read_text(encoding="utf-8")
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base href="../">  <!-- MOCKUP: every path = the real site -->', 1)
    s = re.sub(r"<title>.*?</title>", "<title>Battle Mockup</title>", s, count=1, flags=re.S)
    s = s.replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">', 1)
    s = re.sub(r'<ul class="nav__list" style="--n:3">', '<ul class="nav__list" style="--n:4">', s, count=1)
    deck_btn = re.search(r'\s*<li><button class="nav__btn fx-press" data-page="deck".*?</li>\n', s, flags=re.S)
    assert deck_btn, "Deck menu button not found"
    s = s[: deck_btn.end()] + NAV_BTN + s[deck_btn.end():]
    assert "  </main>" in s
    s = s.replace("  </main>", PAGE + "  </main>\n" + FIGHT, 1)
    css = re.findall(r'<link rel="stylesheet" href="css/home\.css[^"]*">', s)
    assert css, "css/home.css link not found"
    s = s.replace(css[0], css[0] + '\n  <link rel="stylesheet" href="mockup/battle/battle.css">', 1)
    js = re.findall(r'<script src="js/tiermaker\.js[^"]*"></script>', s)
    assert js, "js/tiermaker.js script not found"
    s = s.replace(js[0], js[0] + '\n  <script src="mockup/battle/battle.js"></script>', 1)
    return s


def artifact(s):
    a = s.replace('\n  <base href="../">  <!-- MOCKUP: every path = the real site -->', "")
    a = re.sub(r'\?v=\d+', "", a)
    a = re.sub(r'<!doctype html>\s*', "", a, flags=re.I)
    a = re.sub(r'</?html[^>]*>\s*|</?head>\s*|</?body[^>]*>\s*', "", a)
    a = re.sub(r"<script>\s*\(function \(\) \{\s*try \{\s*if \(/\(\^\|\\\.\)github.*?</script>\s*", "", a, flags=re.S)   # the GitHub Pages redirect
    a = re.sub(r'media="print" onload="this.media=\'all\'"', "", a)
    a = re.sub(r'<script type="application/ld\+json">.*?</script>\s*', "", a, flags=re.S)
    title = '<title>Battle Mockup</title>\n'
    a = title + a.replace("<title>Battle Mockup</title>", "", 1)
    return a


if __name__ == "__main__":
    html = build()
    (ROOT / "mockup" / "battle.html").write_text(html, encoding="utf-8")
    print("wrote mockup/battle.html", len(html))
    if len(sys.argv) > 2 and sys.argv[1] == "--artifact":
        out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(artifact(html), encoding="utf-8")
        print("wrote", out / "index.html")
