/* Card pages c/<id>/ + c/ (PROGRESS ▶️ แผนปรับปรุงเว็บ รอบ 8 · tools/card_pages.py) — static pages, no data loaded.
   Only the site's press feedback (§4): .fx-press = scale .96 (css/fx.css) + the short gold ring (FX.press in js/fx.js
   needs the whole site, so the ring is made here the same way: span.fx-ring, removed when its animation ends). */
(() => {
  "use strict";
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest && e.target.closest(".fx-press");
    if (!b || reduced()) return;
    const r = document.createElement("span");
    r.className = "fx-ring";
    r.setAttribute("aria-hidden", "true");
    b.appendChild(r);
    r.addEventListener("animationend", () => r.remove(), { once: true });
    setTimeout(() => r.remove(), 900);   // the ring never stays (a page leaving mid-animation)
  });
})();
