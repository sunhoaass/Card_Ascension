/* ==========================================================
   FX — shared motion helpers (§4 Motion Guide)
   Use these from any page. Don't write new press/tilt/count code.
     FX.press(root)        – press glow ring on every .fx-press inside root
     FX.tilt(cardEl)       – 3D tilt + holo glare that follows the finger
     FX.countTo(el, to)    – number counts from current value to `to`
     FX.stagger(listEl)    – children slide in one after another (opts: { cls, max, cleanup })
     FX.flip(el, rect)     – shared-element move: el animates from `rect` to where it is now
     FX.fade(el, to)       – fade in (1) or out (0); still works when motion is reduced
     FX.toast(text, opts)  – short message at the bottom (opts: { action: { label, fn }, duration, bottom })
     FX.flash(el)          – short glow around el after it was saved / copied (image saved, link copied)
     FX.backdrop(el)       – the "Castle Night" background (drawn once, moved by CSS: no animation loop · 2026-11-04)
     FX.reduced            – true when the user asked for less motion
     FX.lite / FX.probe()  – automatic lite mode for low-end devices (html.lite, step 9.5)
   Performance rules (step 9.5): no requestAnimationFrame that runs forever · animate transform/opacity only ·
   card auras only move while the card is on screen (.card.is-live, set in js/app.js)
   ========================================================== */
(function () {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FX = { get reduced() { return mq.matches; } };

  /* ---------- Page zoom (W3) ----------
     Screens wider than 1920px zoom the whole page (script in index.html <head>). Rects, pointer positions and scrollY are
     then in screen px, CSS lengths in page px: divide a screen distance by FX.zoom() before writing it into a style. */
  // speed 2026-11-03: read from the inline style the <head> script writes (the only zoom on the page) · currentCSSZoom
  // brought the whole page's style up to date first (a 30 ms stall in the level-dot tap on a 6× slowed phone)
  FX.zoom = () => parseFloat(document.documentElement.style.zoom) || 1;

  /* ---------- Press glow ring ---------- */
  FX.press = function (root = document) {
    root.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".fx-press");
      if (!btn || FX.reduced) return;
      const r = btn.getBoundingClientRect();
      const ring = document.createElement("span");
      ring.className = "fx-ring";
      const z = FX.zoom();
      ring.style.left = (e.clientX - r.left) / z + "px";
      ring.style.top = (e.clientY - r.top) / z + "px";
      btn.appendChild(ring);
      ring.addEventListener("animationend", () => ring.remove(), { once: true });
    }, { passive: true });
  };

  /* ---------- 3D tilt + glare ---------- */
  FX.tilt = function (card, max = 10) {
    if (FX.reduced || card.dataset.tilt) return;
    card.dataset.tilt = "1";
    let raf = 0, x0 = 0, y0 = 0, touch = false;
    const move = (e) => {
      // a finger moving up/down is scrolling the page, not tilting: let go (phones send pointercancel for this
      // too, but not every browser does; without it the card would repaint on every scroll frame)
      if (touch && Math.abs(e.clientY - y0) > 10 && Math.abs(e.clientY - y0) > Math.abs(e.clientX - x0)) { end(); return; }
      if (!card.classList.contains("is-tilting")) {
        if (e.pointerType === "mouse" && !e.buttons) card.classList.add("is-tilting");   // mouse still over it (e.g. after a drag)
        else return;
      }
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty("--ry", (px * max * 2).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-py * max * 2).toFixed(2) + "deg");
        card.style.setProperty("--gx", (px * r.width).toFixed(1) + "px");
        card.style.setProperty("--gy", (py * r.height).toFixed(1) + "px");
      });
    };
    const start = (e) => {
      touch = e.pointerType !== "mouse"; x0 = e.clientX; y0 = e.clientY;
      card.classList.add("is-tilting"); move(e);
    };
    const end = () => {
      cancelAnimationFrame(raf);
      touch = false;
      if (!card.classList.contains("is-tilting")) return;
      card.classList.remove("is-tilting");
      ["--rx", "--ry", "--gx", "--gy"].forEach((p) => card.style.removeProperty(p));
    };
    card.addEventListener("pointerenter", start);
    card.addEventListener("pointerdown", start);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", end);
    card.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") end(); });
    card.addEventListener("pointercancel", end);
  };

  /* ---------- Count numbers up/down ---------- */
  // a redrawn card's letters (css/fx.css .rd-ot) draw their black edge from data-t: it follows the text every frame
  FX.countTo = function (el, to, { duration = 400, format = (n) => Math.round(n).toLocaleString("en-US") } = {}) {
    const from = Number(el.dataset.value || 0);
    const host = el.closest ? el.closest("[data-t]") : null;
    const put = (t) => { el.textContent = t; if (host) host.dataset.t = host.textContent; };
    el.dataset.value = to;
    if (FX.reduced || from === to) { put(format(to)); return; }
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      put(format(from + (to - from) * ease(t)));
      if (t < 1 && el.dataset.value == to) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- Stagger children ---------- */
  // cls: "fx-stagger" (tier rows) | "fx-grid-in" | "fx-up"   max: cap the delay (items after it start together)
  // limit: only the first N children animate (big grids: the rest are off-screen anyway)
  // cleanup: remove the class once finished so re-inserted children don't replay the animation
  FX.stagger = function (list, gap = 60, { cls = "fx-stagger", max = Infinity, limit = Infinity, cleanup = false } = {}) {
    list.classList.remove(cls);
    [...list.children].forEach((c, i) => {
      c.style.setProperty("--d", Math.min(i, max) * gap + "ms");
      c.style.animation = i >= limit ? "none" : "";
    });
    void list.offsetWidth; // restart animation
    list.classList.add(cls);
    if (cleanup) {
      clearTimeout(list._fxStagger);
      list._fxStagger = setTimeout(() => list.classList.remove(cls), Math.min(list.children.length, max + 1) * gap + 520);
    }
  };

  /* ---------- Shared-element move (FLIP) ----------
     Animates `el` from `rect` (a DOMRect of where it used to be) to its current place.
     reverse: true plays it the other way (current place -> rect) and keeps the end state.
     Uses transform only. Returns the Animation, or null when motion is reduced. */
  FX.flip = function (el, rect, { duration = 400, reverse = false } = {}) {
    if (FX.reduced || !rect || !el.animate) return null;
    const to = el.getBoundingClientRect();
    if (!to.width || !rect.width) return null;
    const z = FX.zoom();
    const moved = `translate(${(rect.left - to.left) / z}px, ${(rect.top - to.top) / z}px) scale(${rect.width / to.width})`;
    el.style.transformOrigin = "0 0";
    const anim = el.animate(
      reverse ? [{ transform: "none" }, { transform: moved }] : [{ transform: moved }, { transform: "none" }],
      { duration, easing: "cubic-bezier(.2,.8,.2,1)", fill: reverse ? "forwards" : "none" }
    );
    if (!reverse) {
      const reset = () => { el.style.transformOrigin = ""; };
      anim.addEventListener("finish", reset); anim.addEventListener("cancel", reset);
    }
    return anim;
  };

  /* ---------- Fade in / out (opacity only) ---------- */
  FX.fade = function (el, to, { duration = 250 } = {}) {
    if (!el.animate) return null;
    return el.animate([{ opacity: to ? 0 : 1 }, { opacity: to ? 1 : 0 }], {
      duration: FX.reduced ? Math.min(duration, 150) : duration,
      easing: "cubic-bezier(.2,.8,.2,1)", fill: "both",
    });
  };

  /* ---------- Toast (short message at the bottom, optional action button) ----------
     FX.toast("Row deleted", { action: { label: "Undo", fn }, duration: 3200, bottom: 120 })
     bottom: px from the bottom of the screen (to sit above something docked there); leave out for the default spot. */
  let toastEl = null, toastTimer = 0;
  FX.toast = function (text, { action = null, duration = 3200, bottom = null } = {}) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "fx-toast glass";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    const hide = () => { clearTimeout(toastTimer); toastEl.classList.remove("is-on"); };
    clearTimeout(toastTimer);
    toastEl.replaceChildren();
    const msg = document.createElement("span");
    msg.className = "fx-toast__text";
    msg.textContent = text;
    toastEl.appendChild(msg);
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fx-toast__btn fx-press";
      b.textContent = action.label;
      b.addEventListener("click", () => { hide(); action.fn(); }, { once: true });
      toastEl.appendChild(b);
    }
    if (bottom == null) toastEl.style.removeProperty("--toast-b");
    else toastEl.style.setProperty("--toast-b", Math.round(bottom) + "px");
    toastEl.classList.remove("is-on"); void toastEl.offsetWidth; toastEl.classList.add("is-on");
    toastTimer = setTimeout(hide, duration);
  };

  /* ---------- Flash (a short glow around something that was just saved / copied) ----------
     FX.flash(boardEl) · transform + opacity only · motion reduced = a plain fade */
  FX.flash = function (el) {
    if (!el || !el.isConnected || !el.animate) return null;
    const ring = document.createElement("span");
    ring.className = "fx-flash";
    ring.setAttribute("aria-hidden", "true");
    const restore = getComputedStyle(el).position === "static";
    if (restore) el.style.position = "relative";
    el.appendChild(ring);
    const a = ring.animate(
      FX.reduced
        ? [{ opacity: 0 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0 }]
        : [{ opacity: 0, transform: "scale(.985)" }, { opacity: 1, transform: "scale(1)", offset: 0.3 }, { opacity: 0, transform: "scale(1.01)" }],
      { duration: FX.reduced ? 450 : 700, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
    const done = () => { ring.remove(); if (restore) el.style.position = ""; };
    a.addEventListener("finish", done); a.addEventListener("cancel", done);
    return a;
  };

  /* ---------- Lite mode (step 9.5: automatic only, no button) ----------
     On for low-end devices: deviceMemory ≤ 4, hardwareConcurrency ≤ 4, or < 45 fps in the 2 s probe after boot.
     Sets html.lite. It only thins the lamp motes of the backdrop and the Ascended floating particles (3 of 5):
     every press / drag / card-open / score animation stays exactly the same. */
  FX.lite = false;
  function setLite(on) {
    if (FX.lite === on) return;
    FX.lite = on;
    document.documentElement.classList.toggle("lite", on);
    document.dispatchEvent(new CustomEvent("fx:lite", { detail: on }));
  }
  {
    const nav = navigator;
    if ((nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)) setLite(true);
  }
  // FX.probe(): called once by js/app.js after the first render. Counts frames for 2 s (then stops: not a loop).
  FX.probe = function () {
    if (FX.lite || document.hidden) return;
    let n = 0, t0 = 0, away = false;
    const off = () => { away = true; };
    document.addEventListener("visibilitychange", off, { once: true });
    const f = (t) => {
      if (!t0) t0 = t;
      n++;
      if (t - t0 < 2000) { requestAnimationFrame(f); return; }
      document.removeEventListener("visibilitychange", off);
      if (!away && ((n - 1) * 1000) / (t - t0) < 45) setLite(true);
    };
    requestAnimationFrame(f);
  };

  /* ---------- Backdrop "Castle Night" (owner's pick 2026-11-04 · mockup/bright-themes.html D1 · was the Victorian
     night city of step 9.6b) ----------
     Navy → violet sky + stars (one twinkling layer) + moon with a breathing halo + a shooting star now and then +
     a castle city: far hills, back houses, front houses, the castle in the middle, lit windows (half of them on their
     own layer that dims and lights up) + window glow + fog + golden fireflies. All drawn ONCE; the GPU does the rest:
     · always moving = CSS transform / opacity animations, each on its own layer (base.css)
     · the city moves only while the page scrolls: a paused Web Animation whose currentTime follows the scroll
       (Chrome's fast path, no re-layering per scroll step; never write style.transform on scroll)
     · no requestAnimationFrame loop · lite mode = fewer fireflies, no twinkle / shooting star (base.css) · reduced motion = still
     The castle and city are made up for this site (no game art). Seeded random, so it looks the same on every visit. */
  FX.backdrop = function (root) {
    if (!root) return;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = (v) => v.toFixed(0);
    let back = "", front = "", win = "", win2 = "";
    for (let x = -10; x < 1210;) {                                   // back houses
      const w = 24 + rnd() * 30, h = 40 + rnd() * 70;
      back += `<rect x="${n(x)}" y="${n(220 - h)}" width="${n(w)}" height="${n(h + 40)}"/>`;
      if (rnd() > 0.5) back += `<polygon points="${n(x)},${n(220 - h)} ${n(x + w / 2)},${n(200 - h)} ${n(x + w)},${n(220 - h)}"/>`;
      x += w + 2;
    }
    const house = (x, w, h) => {                                     // front house with a pointed roof and a lit window or two
      const top = 260 - h;
      front += `<rect x="${x}" y="${top}" width="${w}" height="${h}"/><polygon points="${x - 3},${top} ${n(x + w / 2)},${n(top - 14 - rnd() * 10)} ${x + w + 3},${top}"/>`;
      for (let k = 0; k < 2; k++) if (rnd() > 0.45) {
        const r = `<rect x="${n(x + 5 + rnd() * (w - 12))}" y="${n(top + 8 + rnd() * (h - 24))}" width="4" height="6"/>`;
        if (rnd() > 0.5) win += r; else win2 += r;
      }
    };
    for (let x = -6; x < 470;) { const w = 22 + Math.round(rnd() * 22); house(x, w, 26 + Math.round(rnd() * 40) + Math.round((x / 470) * 20)); x += w + 4; }
    for (let x = 736; x < 1215;) { const w = 22 + Math.round(rnd() * 22); house(x, w, 26 + Math.round(rnd() * 40) + Math.round(((1200 - x) / 470) * 20)); x += w + 4; }
    const castle =                                                   // wall + battlements, two big towers, keep, turrets, central spire with a flag
      `<rect x="468" y="176" width="264" height="84"/>` + Array.from({ length: 12 }, (_, i) => `<rect x="${470 + i * 22}" y="168" width="11" height="10"/>`).join("") +
      `<rect x="478" y="112" width="38" height="148"/><polygon points="472,114 497,52 522,114"/><rect x="684" y="112" width="38" height="148"/><polygon points="678,114 703,52 728,114"/>` +
      `<rect x="540" y="122" width="120" height="138"/><rect x="528" y="98" width="24" height="70"/><polygon points="524,100 540,62 556,100"/><rect x="648" y="98" width="24" height="70"/><polygon points="644,100 660,62 676,100"/>` +
      `<rect x="560" y="90" width="20" height="40"/><polygon points="556,92 570,58 584,92"/><rect x="620" y="90" width="20" height="40"/><polygon points="616,92 630,58 644,92"/>` +
      `<rect x="584" y="56" width="32" height="80"/><polygon points="578,58 600,0 622,58"/><rect x="599" y="-14" width="2" height="16"/><polygon points="601,-14 614,-10 601,-6"/>`;
    win += `<path d="M588 260V236a12 12 0 0 1 24 0V260Z"/><rect x="595" y="72" width="10" height="16" rx="5"/><rect x="494" y="130" width="6" height="11" rx="3"/><rect x="700" y="130" width="6" height="11" rx="3"/><rect x="562" y="150" width="6" height="12" rx="3"/><rect x="632" y="150" width="6" height="12" rx="3"/>`;
    win2 += `<rect x="494" y="170" width="6" height="11" rx="3"/><rect x="700" y="170" width="6" height="11" rx="3"/><rect x="537" y="118" width="6" height="10" rx="3"/><rect x="657" y="118" width="6" height="10" rx="3"/><rect x="580" y="196" width="6" height="12" rx="3"/><rect x="614" y="196" width="6" height="12" rx="3"/>`;
    const svg = (cls, body) => `<svg class="${cls}" viewBox="0 -20 1200 280" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${body}</svg>`;
    root.innerHTML =
      `<div class="bd-stars"></div><div class="bd-moon"></div><i class="bd-shoot"></i>` +
      `<div class="bd-city">` +
        svg("bd-town", `<path class="c3" d="M0 260V176Q120 148 240 170T480 158T720 164T960 152T1200 166V260Z"/><g class="c2">${back}</g><g class="c1">${front}${castle}</g><g class="w">${win}</g>`) +
        svg("bd-win2", `<g class="w">${win2}</g>`) +
      `</div><div class="bd-lamps"></div><div class="bd-fog"></div><div class="bd-motes"></div>`;
    const city = root.querySelector(".bd-city");
    // a paused Web Animation (not a paused CSS animation: Chrome only keeps the scroll-driven currentTime on the
    // compositor fast path for script animations; a paused CSS one re-layerised and repainted the page every frame)
    const anim = city.animate ? city.animate([{ transform: "translate3d(0, 0, 0)" }, { transform: "translate3d(0, 70px, 0)" }], { duration: 1000, fill: "both" }) : null;
    if (!anim) return;
    anim.pause();
    let max = 1;
    const measure = () => { max = Math.max(1, document.documentElement.scrollHeight * FX.zoom() - innerHeight); };
    const sync = () => { if (!FX.reduced) anim.currentTime = Math.min(1, window.scrollY / max) * 1000; };
    measure(); sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", () => { measure(); sync(); });
    // page height changes when tabs switch / lists grow: re-measure now and then (cheap, no loop)
    if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); sync(); }).observe(document.body);
  };

  window.FX = FX;
})();
