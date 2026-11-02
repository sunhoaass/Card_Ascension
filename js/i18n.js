/* ==========================================================
   Thai / English switch (replaces the old ♪ music button)
   · English is the default and the source of truth. Thai = text only (card names, skill names, numbers stay as in the game).
   · cbi:lang = "th" | "en". The button saves the choice and reloads the page (same #route), so nothing is half-translated.
   · UI text: a MutationObserver translates text nodes + aria-label / title / placeholder / alt from I18N_UI (js/i18n-th-ui.js).
   · Skill text: I18N.desc(text) translates a card ability / support effect sentence by sentence from I18N_SK (js/i18n-th-sk*.js).
   · Dictionary keys = the English text with every number replaced by "#"; Thai values use #1 #2 … for the numbers in order.
   · Not in the dictionary = stays English (never breaks anything).
   Must load BEFORE app.js.
   ========================================================== */
(function () {
  const KEY = "cbi:lang";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const lang = store.get(KEY) === "th" ? "th" : "en";
  const NUM = /\{\d\}|\d+(?:[.,]\d+)*/g;
  const UI = Object.create(null), SK = Object.create(null), RULES = [];
  const merge = (to, from) => { if (from) for (const k in from) to[k] = from[k]; };

  const fill = (th, nums) => th.replace(/#(\d)/g, (m, i) => (nums[+i - 1] != null ? nums[+i - 1] : m));
  function lookup(dict, text) {
    const nums = [];
    const key = text.replace(NUM, (m) => (nums.push(m), "#"));
    const th = dict[key];
    return th == null ? null : fill(th, nums);
  }

  function ui(text) {
    if (lang !== "th" || !text) return text;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    if (!m[2]) return text;
    const core = m[2].replace(/\s+/g, " ");
    let out = lookup(UI, core);
    if (out == null) for (const [re, fn] of RULES) { const r = re.exec(core); if (r) { out = fn(r); break; } }
    if (out == null && core.includes(" · ")) {         // "a · b · c" notes: translate each piece
      const parts = core.split(" · "), t = parts.map((x) => ui(x));
      if (t.some((x, i) => x !== parts[i])) out = t.join(" · ");
    }
    return out == null ? text : m[1] + out + m[3];
  }

  // a whole ability text, sentence by sentence
  function desc(text) {
    if (lang !== "th" || !text) return text;
    const s = String(text);
    const whole = lookup(SK, s.trim());
    if (whole != null) return whole;
    return s.split(/(?<=[.!?])\s+/).map((p) => {
      p = p.trim();
      const out = lookup(SK, p);
      if (out != null) return out;
      // "Name: <ability sentence>" → keep the name, translate the rest
      const m = /^([^:.]{1,40}): (.+)$/.exec(p);
      if (m) {
        const rest = lookup(SK, m[2]);
        if (rest != null) { const head = lookup(SK, m[1]); return (head == null ? m[1] : head) + ": " + rest; }
      }
      return p;
    }).join(" ");
  }

  /* ---------- UI text (DOM) ---------- */
  const ATTRS = ["aria-label", "title", "placeholder", "alt"];
  const seen = new WeakMap();                       // text node / element attr → last Thai output we wrote
  function textNode(n) {
    const v = n.nodeValue;
    if (!v || seen.get(n) === v || !/[A-Za-z]/.test(v)) return;
    const out = ui(v);
    if (out !== v) { n.nodeValue = out; seen.set(n, out); }
  }
  function attrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const out = ui(v); if (out !== v) el.setAttribute(a, out); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches("script,style")) return;
    attrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) textNode(n); else attrs(n); }
  }

  function start() {
    document.documentElement.lang = lang;
    document.querySelectorAll(".js-lang").forEach((b) => {
      const th = lang === "th";
      b.hidden = false;
      b.setAttribute("aria-label", th ? "เปลี่ยนเป็นภาษาอังกฤษ" : "เปลี่ยนเป็นภาษาไทย / Switch to Thai");
      b.title = th ? "English" : "ภาษาไทย";
      b.querySelectorAll(".lang__code").forEach((s) => { s.textContent = th ? "EN" : "ไทย"; });
      b.querySelectorAll(".lang__label").forEach((s) => { s.textContent = th ? "English" : "ภาษาไทย"; });
      b.addEventListener("click", () => {
        store.set(KEY, th ? "en" : "th");
        location.reload();
      });
    });
    if (lang !== "th") return;
    document.documentElement.classList.add("is-th");
    walk(document.body);
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === "childList") r.addedNodes.forEach(walk);
        else if (r.type === "characterData") textNode(r.target);
        else if (r.type === "attributes") attrs(r.target);
      }
    }).observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  }

  window.I18N = {
    lang, ui, desc,
    addUI: (d) => merge(UI, d),
    addSK: (d) => merge(SK, d),
    addRules: (r) => RULES.push(...r),
    start,
    _dict: { UI, SK },
  };
  if (lang === "th") document.documentElement.classList.add("is-th");
  document.documentElement.lang = lang;
  // the dictionaries load right after this file; walk once everything has parsed
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
