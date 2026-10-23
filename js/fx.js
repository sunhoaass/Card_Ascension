/* ==========================================================
   FX — shared motion helpers (§4 Motion Guide)
   Use these from any page. Don't write new press/tilt/count code.
     FX.press(root)        – press glow ring on every .fx-press inside root
     FX.tilt(cardEl)       – 3D tilt + holo glare that follows the finger
     FX.countTo(el, to)    – number counts from current value to `to`
     FX.stagger(listEl)    – children slide in one after another (opts: { cls, max, cleanup })
     FX.flip(el, rect)     – shared-element move: el animates from `rect` to where it is now
     FX.fade(el, to)       – fade in (1) or out (0); still works when motion is reduced
     FX.starfield(canvas)  – slow parallax star background
     FX.reduced            – true when the user asked for less motion
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
    let raf = 0;
    const move = (e) => {
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
    const start = (e) => { card.classList.add("is-tilting"); move(e); };
    const end = () => {
      cancelAnimationFrame(raf);
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

  /* ---------- Starfield (canvas, 3 parallax layers) ---------- */
  FX.starfield = function (canvas) {
    const ctx = canvas.getContext("2d");
    const layers = [
      { n: 70, speed: 0.04, size: [0.4, 1.0], alpha: 0.5 },
      { n: 40, speed: 0.09, size: [0.8, 1.5], alpha: 0.75 },
      { n: 14, speed: 0.18, size: [1.2, 2.2], alpha: 1 },
    ];
    let w = 0, h = 0, dpr = 1, stars = [], raf = 0, last = 0, scrollY = 0;
    const tints = ["255,255,255", "190,230,255", "215,195,255"];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = Math.min(1.6, (w * h) / (390 * 844)); // fewer stars on small screens
      stars = [];
      layers.forEach((L, li) => {
        for (let i = 0; i < Math.round(L.n * area); i++) {
          stars.push({
            x: Math.random() * w, y: Math.random() * h, li,
            r: L.size[0] + Math.random() * (L.size[1] - L.size[0]),
            a: L.alpha * (0.5 + Math.random() * 0.5),
            tw: Math.random() * Math.PI * 2,
            c: tints[(Math.random() * tints.length) | 0],
          });
        }
      });
      draw(0);
    }
    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const L = layers[s.li];
        s.y -= L.speed * dt * 0.06;
        if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
        s.tw += dt * 0.0015;
        const y = ((s.y - scrollY * L.speed * 0.6) % (h + 8) + h + 8) % (h + 8) - 4;
        ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(s.tw));
        ctx.fillStyle = `rgb(${s.c})`;
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function loop(now) {
      const dt = Math.min(50, now - (last || now)); last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    }
    function play() { if (!FX.reduced && !raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    window.addEventListener("resize", () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 150); });
    window.addEventListener("scroll", () => { scrollY = window.scrollY; if (!raf) draw(0); }, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
    mq.addEventListener?.("change", () => (FX.reduced ? stop() : play()));
    resize(); play();
  };

  window.FX = FX;
})();
