/* ==========================================================
   Background music (step 9.6b, §12.5)
   · file: audio/bgm.mp3 (the owner adds it; a free track that needs no credit). No file = the ♪ buttons stay hidden.
   · starts OFF (browsers block sound before a tap, and nobody wants a surprise in public)
   · on = fade in over 0.6 s · off = fade out, then pause
   · remembers cbi:music ("on" / "off") and cbi:musicVol (0–1, default 0.35)
   · if it was on last time, it starts again after the first tap anywhere on the page (browser rule)
   · pauses when the tab is hidden / the phone locks, carries on when the page is back
   · preload="none": nothing is downloaded until music is turned on
   Buttons: every .js-music (top bar on phones, menu rail on PC). The sound-wave bars only move while it plays.
   ========================================================== */
(function () {
  const SRC = "audio/bgm.mp3";
  const KEY = "cbi:music", VOL_KEY = "cbi:musicVol";
  const FADE = 600;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let audio = null, on = false, fadeT = 0, buttons = [];
  const volume = () => {
    const v = parseFloat(store.get(VOL_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.35;
  };

  function paint() {
    buttons.forEach((b) => {
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", "Background music: " + (on ? "on" : "off"));
      b.title = on ? "Music on — tap to turn off" : "Music off — tap to play";
    });
  }

  function fadeTo(to, done) {
    clearInterval(fadeT);
    const from = audio.volume, t0 = performance.now();
    fadeT = setInterval(() => {                       // a short timer, not an endless animation loop
      const k = Math.min(1, (performance.now() - t0) / FADE);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k === 1) { clearInterval(fadeT); if (done) done(); }
    }, 30);
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "none";
    audio.loop = true;
    audio.volume = 0;
    audio.src = SRC;
    return audio;
  }

  function play() {
    ensureAudio();
    const p = audio.play();
    if (p && p.then) p.then(() => fadeTo(volume())).catch(() => { on = false; paint(); });
    else fadeTo(volume());
  }

  function set(next, { save = true } = {}) {
    on = next;
    paint();
    if (save) store.set(KEY, on ? "on" : "off");
    if (on) play();
    else if (audio) fadeTo(0, () => audio.pause());
  }

  function init() {
    buttons = [...document.querySelectorAll(".js-music")];
    if (!buttons.length) return;
    // show the buttons only when the music file is really there (one small HEAD request, no download)
    fetch(SRC, { method: "HEAD", cache: "no-cache" }).then((res) => {
      if (!res.ok) return;
      buttons.forEach((b) => { b.hidden = false; b.addEventListener("click", () => set(!on)); });
      paint();
      // it was on last time: start after the first tap / key press anywhere (autoplay rule)
      if (store.get(KEY) === "on") {
        const resume = (e) => {
          if (e.target.closest && e.target.closest(".js-music")) return;   // the button handles itself
          set(true, { save: false });
        };
        const once = (e) => { ["pointerdown", "keydown"].forEach((t) => document.removeEventListener(t, once, true)); resume(e); };
        ["pointerdown", "keydown"].forEach((t) => document.addEventListener(t, once, true));
      }
    }).catch(() => {});

    document.addEventListener("visibilitychange", () => {
      if (!audio || !on) return;
      if (document.hidden) { clearInterval(fadeT); audio.pause(); }
      else { audio.volume = 0; play(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
