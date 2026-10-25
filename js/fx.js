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
     FX.backdrop(el)       – the night-city background (drawn once, moved by CSS: no animation loop, step 9.6b)
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
  FX.zoom = () => document.documentElement.currentCSSZoom || parseFloat(document.documentElement.style.zoom) || 1;

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
  FX.countTo = function (el, to, { duration = 400, format = (n) => Math.round(n).toLocaleString("en-US") } = {}) {
    const from = Number(el.dataset.value || 0);
    el.dataset.value = to;
    if (FX.reduced || from === to) { el.textContent = format(to); return; }
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      el.textContent = format(from + (to - from) * ease(t));
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

  /* ---------- Backdrop: the night city (step 9.6b, replaces FX.starfield) ----------
     Night sky + faint stars + moon + Victorian skyline (2 layers: palace dome, clock tower with a lit face,
     lit windows) + lamp light on the street + fog + lamp motes rising. All drawn ONCE; the GPU does the rest:
     · always moving = fog (bd-fog) + motes (bd-motes): CSS transform animations, 2 full-screen layers
     · the skyline moves only while the page scrolls: a paused Web Animation whose currentTime follows
       the scroll (Chrome's fast path, no re-layering per scroll step; never write style.transform on scroll)
     · no requestAnimationFrame loop · lite mode = fewer motes (base.css) · reduced motion = still picture
     The skyline is made up for this site (no game art). Seeded random, so it looks the same on every visit. */
  FX.backdrop = function (root) {
    if (!root) return;
    const W = 1440, H = 420;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function layer(minH, maxH, fill, windows, landmarks) {
      let d = `M0 ${H}`, x = 0, win = "";
      while (x < W) {
        const lm = landmarks.find((l) => !l.done && x + 60 >= l.x);
        if (lm) lm.done = true;
        const w = lm ? (lm.type === "tower" ? 84 : 190) : 40 + rnd() * 70;
        const h = minH + rnd() * (maxH - minH), top = H - h, kind = rnd();
        d += ` L${x} ${top}`;
        if (lm && lm.type === "tower") {                      // clock tower with a lit face
          const cx = x + w / 2, tw = 34, th = lm.h;
          d += ` L${cx - tw} ${top} L${cx - tw} ${H - th} L${cx - tw - 6} ${H - th} L${cx} ${H - th - 70} L${cx + tw + 6} ${H - th} L${cx + tw} ${H - th} L${cx + tw} ${top}`;
          win += `<circle cx="${cx}" cy="${H - th + 34}" r="18" fill="#f4d79a" opacity=".85"/><circle cx="${cx}" cy="${H - th + 34}" r="18" fill="none" stroke="#3a2e1a" stroke-width="2"/>` +
            `<path d="M${cx} ${H - th + 34}v-12M${cx} ${H - th + 34}l8 5" stroke="#3a2e1a" stroke-width="2" stroke-linecap="round"/>` +
            `<path d="M${cx} ${H - th - 70}v-26" stroke="${fill}" stroke-width="3"/>`;
        } else if (lm && lm.type === "dome") {                // palace dome
          const cx = x + w / 2, r = 58, b = H - lm.h;
          d += ` L${cx - 90} ${top} L${cx - 90} ${b} L${cx - r} ${b} A${r} ${r} 0 0 1 ${cx + r} ${b} L${cx + 90} ${b} L${cx + 90} ${top}`;
          win += `<path d="M${cx} ${b - r}v-34" stroke="${fill}" stroke-width="4"/><circle cx="${cx}" cy="${b - r - 38}" r="5" fill="${fill}"/>`;
        } else if (kind < 0.3) {                              // gable
          d += ` L${x + w / 2} ${top - 26 - rnd() * 18} L${x + w} ${top}`;
        } else if (kind < 0.45) {                             // spire
          d += ` L${x + w * 0.4} ${top} L${x + w / 2} ${top - 60 - rnd() * 40} L${x + w * 0.6} ${top} L${x + w} ${top}`;
        } else if (kind < 0.7) {                              // mansard roof with a chimney
          const cx = x + w * 0.75;
          d += ` L${x + 8} ${top - 14} L${cx - 6} ${top - 14} L${cx - 6} ${top - 34} L${cx + 6} ${top - 34} L${cx + 6} ${top - 14} L${x + w - 8} ${top - 14} L${x + w} ${top}`;
        } else d += ` L${x + w} ${top}`;
        if (windows) {
          for (let wy = top + 14; wy < H - 20; wy += 22) for (let wx = x + 8; wx < x + w - 12; wx += 16) {
            if (rnd() < 0.14) win += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="6" height="10" rx="1" fill="#ffd48a" opacity="${(0.45 + rnd() * 0.5).toFixed(2)}"/>`;
          }
        }
        d += ` L${x + w} ${H}`;
        x += w;
      }
      d += ` L${W} ${H} Z`;
      return `<path d="${d}" fill="${fill}"/>${win}`;
    }
    const far = layer(120, 230, "#161c34", false, [{ x: 330, type: "dome", h: 210 }]);
    const near = layer(60, 150, "#0a0e1c", true, [{ x: 1010, type: "tower", h: 280 }]);
    root.innerHTML =
      `<div class="bd-stars"></div><div class="bd-moon"></div>` +
      `<div class="bd-city"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g opacity=".9">${far}</g>${near}</svg></div>` +
      `<div class="bd-lamps"></div><div class="bd-fog"></div><div class="bd-motes"></div>`;
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
