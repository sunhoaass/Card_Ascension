/* Cloudflare Pages Function: keeps the repo's internal files off the website (PROGRESS ▶️ แผนปรับปรุงเว็บ รอบ 2 · rule 14).
   Works with no Cloudflare dashboard setting: Pages finds this functions/ folder by itself on every deploy.
   /_routes.json sends only the internal paths here (every other request never runs this and costs nothing).
   Internal path → 404 "Not found" · anything else that still lands here → next() = the normal file, so the site
   keeps working even if _routes.json were ignored. Same list as tools/build_site.py (NOT web) and /_routes.json. */
const INTERNAL = [
  /^\/[^/]+\.md$/i,                                   // PROGRESS.md · HISTORY.md · CLAUDE.md · SUPPORT-CHANGES.md
  /^\/(inbox|cropped_cards|mockup|tools|docs|functions|dist)(\/|$)/i,
  /^\/data\/pending\/cards\.json$/i,                  // data/pending/support.json stays: js/battle.js loads it
  /^\/images\/silver\/portrait-src(\/|$)/i,
  /^\/(\.|netlify\.toml$|_routes\.json$)/i,           // dotfiles · host config
  /\.(py|pyc|sh)$/i,
];

export async function onRequest({ request, next }) {
  let path = "/";
  try { path = decodeURIComponent(new URL(request.url).pathname); } catch { path = new URL(request.url).pathname; }
  if (INTERNAL.some((re) => re.test(path))) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } });
  }
  return next();
}
