// admin.js — หน้าแอดมิน (login ด้วย token, เพิ่ม/แก้/ลบการ์ด, จัดการ Rarity และ Mutation)
// ข้อมูลทั้งหมดบันทึกลง data/db.json และรูปลง images/ ใน GitHub repo
import { STATS, TIERS, TAG_GROUPS } from './config.js';
import { normalize, esc, byId, uid } from './data.js';
import { openCropper } from './cropper.js';
import { getToken, setToken, checkToken, readDb, writeDb, uploadFile, deleteFile } from './github.js';

const $ = s => document.querySelector(s);
let db = null, sha = null;            // ข้อมูลดิบ + เวอร์ชันบน GitHub
let D = normalize({});                // ข้อมูลที่จัดเรียงแล้ว
let editing = null, newBlob = null, busy = false;

const toast = (msg, ms = 2500) => {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
};
const fail = e => {
  console.error(e);
  const m = String(e.message || e);
  toast(m.includes('409') ? 'Data changed elsewhere — reload the page and try again' : 'Error: ' + m, 4000);
};

function show(page) {
  document.querySelectorAll('#tabs button[data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  document.querySelectorAll('main > section').forEach(s => s.classList.toggle('hidden', s.id !== 'page-' + page));
}
document.querySelectorAll('#tabs button[data-page]').forEach(b => b.onclick = () => {
  if (b.dataset.page === 'edit') startEdit(null); else show(b.dataset.page);
});

// ---------- Login ----------
$('#loginForm').onsubmit = e => { e.preventDefault(); setToken($('#token').value.trim()); enter(); };
$('#logout').onclick = () => { setToken(''); location.reload(); };

async function enter() {
  if (!getToken()) return show('login');
  $('#loginMsg').textContent = 'Checking key…';
  try { await checkToken(); }
  catch (e) { setToken(''); $('#loginMsg').textContent = 'Key not valid: ' + e.message; return show('login'); }
  $('#loginMsg').textContent = '';
  $('#tabs').classList.remove('hidden');
  await reload();
  show('cards');
}

async function reload() {
  try { ({ db, sha } = await readDb()); } catch (e) { return fail(e); }
  db.rarities ??= []; db.mutations ??= []; db.cards ??= [];
  render();
}
function render() {
  D = normalize(db);
  renderCardList(); renderCrud('rarities'); renderCrud('mutations'); fillSelects();
}

// บันทึก db.json ขึ้น GitHub (ทีละครั้ง)
async function save(message) {
  sha = await writeDb(db, sha, message);
  render();
  toast('Saved ✓ — site updates in about 1 minute');
}
async function guard(fn) {
  if (busy) return toast('Please wait…');
  busy = true;
  try { await fn(); } catch (e) { fail(e); }
  busy = false;
}

// ---------- Card list ----------
function renderCardList() {
  $('#cardList').innerHTML = D.cards.length ? D.cards.map(c => {
    const r = byId(D.rarities, c.rarity_id);
    return `<div class="list-item">
      ${c.image_url ? `<img src="${esc(c.image_url)}" alt="">` : ''}
      <div class="grow"><b>${esc(c.name)}</b><div class="muted">${esc(r?.name || '-')} · Tier ${esc(c.tier || '-')}</div></div>
      <button data-edit="${c.id}">Edit</button>
      <button class="danger" data-del="${c.id}">Delete</button></div>`;
  }).join('') : '<div class="muted">No cards yet. Tap “+ Add card”.</div>';
}
$('#cardList').onclick = e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) startEdit(byId(D.cards, ed));
  if (del) guard(async () => {
    const c = byId(db.cards, del);
    if (!confirm(`Delete "${c.name}"?`)) return;
    db.cards = db.cards.filter(x => x.id !== del);
    await save(`Delete card: ${c.name}`);
    if (c.image_url) await deleteFile(c.image_url, `Delete image: ${c.name}`);
  });
};

// ---------- Card form ----------
function fillSelects() {
  $('#fRarity').innerHTML = '<option value="">— none —</option>' +
    D.rarities.map(r => `<option value="${r.id}">${esc(r.name)}${r.odds_text ? ' (' + esc(r.odds_text) + ')' : ''}</option>`).join('');
  $('#fTier').innerHTML = '<option value="">Unranked</option>' +
    TIERS.map(t => `<option>${esc(t.name)}</option>`).join('');
  $('#fStats').innerHTML = STATS.map(s =>
    `<div><label>${s.label}</label><input type="number" inputmode="numeric" data-stat="${s.key}"></div>`).join('');
  $('#fTags').innerHTML = TAG_GROUPS.map(g => `<label>${esc(g.label)}</label><div class="checks">
    ${g.options.map(o => `<label><input type="${g.single ? 'radio' : 'checkbox'}" name="tag-${g.key}" value="${esc(g.key + ':' + o)}"> ${esc(o)}</label>`).join('')}
  </div>`).join('');
}

function startEdit(card) {
  editing = card; newBlob = null;
  $('#cardForm').reset();
  $('#formTitle').textContent = card ? 'Edit card' : 'Add card';
  $('#imgPrev').classList.toggle('hidden', !card?.image_url);
  $('#imgPrev').src = card?.image_url || '';
  if (card) {
    $('#fName').value = card.name;
    $('#fRarity').value = card.rarity_id ?? '';
    $('#fPassive').value = card.passive || '';
    $('#fSkill').value = card.skill || '';
    $('#fTier').value = card.tier || '';
    $('#fNotes').value = card.notes || '';
    document.querySelectorAll('[data-stat]').forEach(i => i.value = card.stats?.[i.dataset.stat] ?? '');
    document.querySelectorAll('#fTags input').forEach(i => i.checked = card.tags.includes(i.value));
  }
  show('edit');
}
$('#cancelEdit').onclick = () => show('cards');

$('#imgFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const blob = await openCropper(f);
  e.target.value = '';
  if (!blob) return;
  newBlob = blob;
  $('#imgPrev').src = URL.createObjectURL(blob);
  $('#imgPrev').classList.remove('hidden');
};

$('#cardForm').onsubmit = e => {
  e.preventDefault();
  const btn = $('#saveBtn'); btn.disabled = true; btn.textContent = 'Saving…';
  guard(async () => {
    const id = editing?.id ?? uid();
    const name = $('#fName').value.trim();
    const old = editing ? byId(db.cards, id) : null;
    let image_url = old?.image_url ?? null;
    if (newBlob) {
      const ext = newBlob.type === 'image/webp' ? 'webp' : 'png';
      const path = `images/${id}-${Date.now()}.${ext}`;   // ชื่อใหม่ทุกครั้ง กันรูปเก่าค้าง
      await uploadFile(path, newBlob, `Image: ${name}`);
      image_url = path;
    }
    const stats = {};
    document.querySelectorAll('[data-stat]').forEach(i => { if (i.value !== '') stats[i.dataset.stat] = Number(i.value); });
    const now = new Date().toISOString();
    const row = {
      id, name, image_url,
      rarity_id: $('#fRarity').value || null,
      stats,
      passive: $('#fPassive').value.trim() || null,
      skill: $('#fSkill').value.trim() || null,
      tags: [...document.querySelectorAll('#fTags input:checked')].map(i => i.value),
      tier: $('#fTier').value || null,
      notes: $('#fNotes').value.trim() || null,
      extra: old?.extra ?? {},
      created_at: old?.created_at ?? now,
      updated_at: now,
    };
    if (old) db.cards[db.cards.indexOf(old)] = row; else db.cards.push(row);
    await save(`${old ? 'Edit' : 'Add'} card: ${name}`);
    if (newBlob && old?.image_url && old.image_url !== image_url) await deleteFile(old.image_url, `Remove old image: ${name}`);
    show('cards');
  }).finally(() => { btn.disabled = false; btn.textContent = 'Save card'; });
};

// ---------- Rarities / Mutations (ตารางแก้ไขได้) ----------
const CRUD = {
  rarities: {
    title: 'Rarities', hint: 'e.g. Common · 1 IN 10, Secret · 1 IN 100K',
    fields: [
      { k: 'name', label: 'Name', type: 'text' },
      { k: 'odds_text', label: 'Odds', type: 'text' },
      { k: 'color', label: 'Color', type: 'color' },
      { k: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
  mutations: {
    title: 'Mutations', hint: 'e.g. Gold x2 (all stats), Diamond x3',
    fields: [
      { k: 'name', label: 'Name', type: 'text' },
      { k: 'multiplier', label: 'Multiply ×', type: 'number', step: '0.01' },
      { k: 'applies_to', label: 'Applies to', type: 'select',
        options: [['all', 'All stats'], ...STATS.map(s => [s.key, s.label + ' only'])] },
      { k: 'color', label: 'Color', type: 'color' },
      { k: 'sort_order', label: 'Order', type: 'number' },
    ],
  },
};

function fieldHtml(f, v) {
  if (f.type === 'select') return `<select data-k="${f.k}">${f.options.map(([val, lab]) =>
    `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  return `<input data-k="${f.k}" type="${f.type}" ${f.step ? `step="${f.step}"` : ''} value="${esc(v ?? '')}">`;
}

function renderCrud(table) {
  const cfg = CRUD[table];
  const rowHtml = (r = {}) => `<div class="panel" data-row="${r.id ?? ''}" style="background:var(--panel2)">
    <div class="row">${cfg.fields.map(f => `<div style="min-width:90px"><label>${f.label}</label>${fieldHtml(f, r[f.k])}</div>`).join('')}</div>
    <div class="row" style="margin-top:10px">
      ${r.id ? `<button class="danger" data-act="del">Delete</button>` : ''}
      <button class="primary" data-act="save">${r.id ? 'Save' : 'Add'}</button></div></div>`;
  $('#page-' + table).innerHTML = `<h3 style="margin-top:0">${cfg.title}</h3>
    <div class="muted" style="margin-bottom:10px">${cfg.hint}</div>
    ${D[table].map(r => rowHtml(r)).join('')}<b>Add new</b>${rowHtml({ color: '#9aa4b2', applies_to: 'all', sort_order: D[table].length })}`;
}

for (const table of Object.keys(CRUD)) {
  $('#page-' + table).addEventListener('click', e => {
    const act = e.target.dataset.act; if (!act) return;
    const box = e.target.closest('[data-row]'), id = box.dataset.row;
    guard(async () => {
      if (act === 'del') {
        if (!confirm('Delete this?')) return;
        db[table] = db[table].filter(x => x.id !== id);
        if (table === 'rarities') db.cards.forEach(c => { if (c.rarity_id === id) c.rarity_id = null; });
        return save(`Delete ${table.slice(0, -1)}`);
      }
      const row = {};
      box.querySelectorAll('[data-k]').forEach(i => {
        row[i.dataset.k] = i.type === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value.trim();
      });
      if (!row.name) return toast('Name is required');
      if (table === 'mutations' && !row.multiplier) row.multiplier = 1;
      if (row.sort_order == null) row.sort_order = 0;
      if (id) Object.assign(byId(db[table], id), row);
      else db[table].push({ id: uid(), ...row });
      await save(`${id ? 'Edit' : 'Add'} ${table.slice(0, -1)}: ${row.name}`);
    });
  });
}

enter();
