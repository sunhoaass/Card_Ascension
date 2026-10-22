// app.js — หน้าเว็บสาธารณะ (Tier List + Cards + รายละเอียดการ์ด)
import { SITE, STATS, TIERS, TAG_GROUPS } from './config.js';
import { loadAll, statRanks, applyMutation, esc, fmt, byId } from './data.js';

const $ = s => document.querySelector(s);
let D = { cards: [], rarities: [], mutations: [] }, ranks = {};

document.title = SITE.name;
$('#siteName').textContent = SITE.name;

// ---------- หน้า (ครั้งแรกเปิด Tier List แล้วจำหน้าล่าสุด) ----------
function show(page) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  document.querySelectorAll('main > section').forEach(s => s.classList.toggle('hidden', s.id !== 'page-' + page));
  try { localStorage.setItem('cbi.page', page); } catch {}
}
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => show(b.dataset.page));
let start = 'tier';
try { start = localStorage.getItem('cbi.page') || 'tier'; } catch {}
show(start);

// ---------- การ์ดย่อ ----------
function thumb(c) {
  const r = byId(D.rarities, c.rarity_id);
  return `<button class="card-thumb" data-id="${c.id}" title="${esc(c.name)}">
    ${c.image_url ? `<img src="${esc(c.image_url)}" alt="${esc(c.name)}" loading="lazy">` : '<div class="noimg"></div>'}
    <div class="nm">${r ? `<span class="pill" style="background:${esc(r.color)}">${esc(r.name)}</span> ` : ''}${esc(c.name)}</div>
  </button>`;
}

function renderTier() {
  const known = new Set(TIERS.map(t => t.name));
  const rows = TIERS.map(t => ({ ...t, cards: D.cards.filter(c => c.tier === t.name) }));
  const rest = D.cards.filter(c => !known.has(c.tier));
  if (rest.length) rows.push({ name: 'Unranked', color: '#8b93a8', cards: rest });
  $('#page-tier').innerHTML = rows.map(t => `<div class="tier">
    <div class="lbl" style="background:${t.color}">${esc(t.name)}</div>
    <div class="cards">${t.cards.map(thumb).join('')}</div></div>`).join('');
}

function renderGrid() {
  const q = $('#q').value.trim().toLowerCase(), rf = $('#fRarity').value;
  const list = D.cards.filter(c =>
    (!q || c.name.toLowerCase().includes(q)) && (!rf || String(c.rarity_id) === rf));
  $('#grid').innerHTML = list.map(thumb).join('') || '<div class="muted">No cards yet.</div>';
}
$('#q').oninput = renderGrid;
$('#fRarity').onchange = renderGrid;

// ---------- รายละเอียดการ์ด ----------
function openDetail(id) {
  const c = byId(D.cards, id); if (!c) return;
  const r = byId(D.rarities, c.rarity_id);
  const m = document.createElement('div');
  m.className = 'modal';
  let mut = null;

  const tagsHtml = TAG_GROUPS.map(g => {
    const t = c.tags.filter(x => x.startsWith(g.key + ':')).map(x => x.slice(g.key.length + 1));
    return t.length ? `<div><span class="muted">${esc(g.label)}:</span> ${t.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : '';
  }).join('');

  const statsHtml = () => {
    const s = applyMutation(c.stats, mut);
    return STATS.filter(x => s[x.key] != null).map(x => {
      const rk = ranks[c.id]?.[x.key];
      return `<div class="stat"><span>${x.label}</span><span><b>${fmt(s[x.key])}</b>
        ${rk ? `<span class="muted"> · #${rk.rank} of ${rk.total}</span>` : ''}</span></div>`;
    }).join('');
  };

  m.innerHTML = `<div class="sheet">
    <div class="detail-top">
      ${c.image_url ? `<img src="${esc(c.image_url)}" alt="">` : ''}
      <div>
        <h2 style="margin:0 0 6px">${esc(c.name)}</h2>
        ${r ? `<span class="pill" style="background:${esc(r.color)}">${esc(r.name)}</span>
          <div class="muted">${esc(r.odds_text || '')}</div>` : ''}
        ${c.tier ? `<div style="margin-top:6px">Tier: <b>${esc(c.tier)}</b></div>` : ''}
      </div>
    </div>
    ${D.mutations.length ? `<label>Mutation</label><div class="row" id="muts" style="flex-wrap:wrap">
      <button class="mut-btn on" data-m="">Base</button>
      ${D.mutations.map(x => `<button class="mut-btn" data-m="${x.id}" style="border-left:4px solid ${esc(x.color)}">
        ${esc(x.name)} x${esc(x.multiplier)}</button>`).join('')}</div>` : ''}
    <div id="stats" style="margin-top:8px">${statsHtml()}</div>
    ${c.passive ? `<label>Passive</label><div>${esc(c.passive)}</div>` : ''}
    ${c.skill ? `<label>Skill</label><div>${esc(c.skill)}</div>` : ''}
    ${tagsHtml ? `<label>Tags</label>${tagsHtml}` : ''}
    ${c.notes ? `<label>Notes</label><div>${esc(c.notes)}</div>` : ''}
    <button style="width:100%;margin-top:16px" data-close>Close</button>
  </div>`;

  m.addEventListener('click', e => {
    if (e.target === m || e.target.hasAttribute('data-close')) return m.remove();
    const b = e.target.closest('.mut-btn'); if (!b) return;
    mut = b.dataset.m ? byId(D.mutations, b.dataset.m) : null;
    m.querySelectorAll('.mut-btn').forEach(x => x.classList.toggle('on', x === b));
    m.querySelector('#stats').innerHTML = statsHtml();
  });
  document.body.appendChild(m);
}
document.addEventListener('click', e => {
  const t = e.target.closest('.card-thumb');
  if (t && !t.closest('.modal')) openDetail(t.dataset.id);
});

// ---------- โหลดข้อมูล ----------
(async () => {
  try {
    D = await loadAll();
    ranks = statRanks(D.cards);
    $('#fRarity').innerHTML += D.rarities.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    const last = D.updated;
    $('#updated').textContent = `${D.cards.length} cards` +
      (last ? ` · Updated ${new Date(last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '');
    renderTier(); renderGrid();
  } catch (err) {
    $('#updated').textContent = 'Could not load data — check config.js';
    console.error(err);
  }
})();
