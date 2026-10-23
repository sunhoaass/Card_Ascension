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
     FX.starfield(el)      – slow parallax star background (drawn once, moved by CSS: no animation loop)
     FX.reduced            – true when the user asked for less motion
     FX.lite / FX.probe()  – automatic lite mode for low-end devices (html.lite, step 9.5)
   Performance rules (step 9.5): no requestAnimationFrame that runs forever · animate transform/opacity only ·
   card auras only move while the card is on screen (.card.is-live, set in js/app.js)
   ========================================================== */
(function () {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FX = { get reduced() { return mq.matches; } };

  /* ---------- Press glow ring ---------- */
  FX.press = function (root = document) {
    root.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".fx-press");
      if (!btn || FX.reduced) return;
      const r = btn.getBoundingClientRect();
      const ring = document.createElement("span");
      ring.className = "fx-ring";
      ring.style.left = e.clientX - r.left + "px";
      ring.style.top = e.clientY - r.top + "px";
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
    const moved = `translate(${rect.left - to.left}px, ${rect.top - to.top}px) scale(${rect.width / to.width})`;
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
     Sets html.lite. It only halves the background stars and the Ascended floating particles:
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

  /* ---------- Starfield (3 parallax layers) ----------
     Step 9.5: no canvas loop any more. Each layer's stars are drawn ONCE into an SVG, then the GPU does the rest
     with CSS: drift = transform animation, twinkle = opacity animation (each layer on its own beat, a third of a
     cycle apart, so the sky never dims as a whole), scroll parallax = transform of the layer.
     Same star counts, sizes, colours, drift speeds and twinkle speed as the old canvas.
     One GPU layer per depth on purpose: every extra star layer costs a whole screen of drawing per frame.
     The SVG holds the stars 3 times (period T) so drift + parallax can wrap without a seam. */
  FX.starfield = function (root) {
    const layers = [
      { n: 70, speed: 0.04, size: [0.4, 1.0], alpha: 0.5 },
      { n: 40, speed: 0.09, size: [0.8, 1.5], alpha: 0.75 },
      { n: 14, speed: 0.18, size: [1.2, 2.2], alpha: 1 },
    ];
    const tints = ["255,255,255", "190,230,255", "215,195,255"];
    const TWINKLE = Math.round((Math.PI * 2) / 0.0015);   // ≈ 4189 ms, the old canvas twinkle speed
    let w = 0, h = 0, T = 0, wraps = [];
    const rnd = (a, b) => a + Math.random() * (b - a);

    function build() {
      w = root.clientWidth || innerWidth;
      h = root.clientHeight || innerHeight;
      // period T: at least the tallest the viewport gets (phone address bar hidden), so it never needs a rebuild on scroll
      T = Math.ceil(Math.max(h, (window.screen && screen.height) || 0) + 8);
      const area = Math.min(1.6, (w * h) / (390 * 844)) * (T / h) * (FX.lite ? 0.5 : 1);   // same density as before
      const frag = document.createDocumentFragment();
      wraps = layers.map((L, li) => {
        const wrap = document.createElement("div");
        wrap.className = "sf-layer";
        const stars = [];
        const n = Math.round(L.n * area);
        for (let i = 0; i < n; i++) {
          const x = rnd(0, w).toFixed(1), y = rnd(0, T), r = rnd(L.size[0], L.size[1]).toFixed(2);
          const a = (L.alpha * rnd(0.5, 1)).toFixed(2), c = tints[(Math.random() * tints.length) | 0];
          let dots = "";
          for (let k = 0; k < 3; k++) dots += `<circle cx="${x}" cy="${(y + k * T).toFixed(1)}" r="${r}"/>`;
          stars.push(`<g fill="rgb(${c})" fill-opacity="${a}">${dots}</g>`);
        }
        const driftMs = Math.round(T / (L.speed * 0.06));   // the old canvas moved speed × 0.06 px per ms
        const el = document.createElement("div");
        el.className = "sf-drift";
        el.style.height = T * 3 + "px";
        el.style.animationDuration = `${driftMs}ms, ${TWINKLE}ms`;
        el.style.animationDelay = `${-Math.round(Math.random() * driftMs)}ms, ${-Math.round((li / layers.length) * TWINKLE)}ms`;
        el.innerHTML = `<svg width="${w}" height="${T * 3}" viewBox="0 0 ${w} ${T * 3}" aria-hidden="true">${stars.join("")}</svg>`;
        wrap.appendChild(el);
        frag.appendChild(wrap);
        // scroll parallax = a paused animation whose time is the offset in px (1 ms = 1 px). Setting currentTime
        // takes Chrome's fast path (no re-layering of the page per scroll step, unlike writing style.transform)
        const anim = wrap.animate ? wrap.animate([{ transform: "translate3d(0, 0, 0)" }, { transform: `translate3d(0, ${-T}px, 0)` }], { duration: T, fill: "both" }) : null;
        if (anim) anim.pause();
        return { wrap, anim, k: L.speed * 0.6 };
      });
      root.replaceChildren(frag);
      parallax();
    }
    // stars move up a little slower than the page (deeper layers slower), wrapping every T px
    function parallax() {
      const y = window.scrollY;
      for (const L of wraps) {
        const o = (y * L.k) % T;
        if (L.anim) L.anim.currentTime = o;
        else L.wrap.style.transform = `translate3d(0, ${-o.toFixed(1)}px, 0)`;
      }
    }

    let lastW = 0;
    window.addEventListener("resize", () => {
      clearTimeout(build.t);
      build.t = setTimeout(() => {
        // phones resize the viewport when the address bar slides; only rebuild when the stars would no longer cover it
        if (root.clientWidth !== lastW || root.clientHeight + 8 > T) { lastW = root.clientWidth; build(); }
      }, 150);
    });
    window.addEventListener("scroll", parallax, { passive: true });
    document.addEventListener("fx:lite", build);
    lastW = root.clientWidth;
    build();
  };

  window.FX = FX;
})();
