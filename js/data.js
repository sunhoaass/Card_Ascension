// data.js — โหลดข้อมูลการ์ด + ฟังก์ชันคำนวณที่ใช้ร่วมกัน
import { STATS } from './config.js';

const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

// จัดเรียงข้อมูลให้พร้อมใช้ (ใช้ทั้งหน้าเว็บและหน้าแอดมิน)
export function normalize(db) {
  return {
    updated: db.updated || null,
    cards: [...(db.cards || [])].map(c => ({ stats: {}, tags: [], ...c })),
    rarities: [...(db.rarities || [])].sort(bySort),
    mutations: [...(db.mutations || [])].sort(bySort),
  };
}

export async function loadAll() {
  const res = await fetch('data/db.json?v=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Cannot load data/db.json');
  return normalize(await res.json());
}

// อันดับค่าสถานะ: { [cardId]: { atk: {rank, total}, hp: {...} } }
export function statRanks(cards) {
  const out = {};
  for (const s of STATS) {
    const list = cards
      .filter(c => Number.isFinite(c.stats?.[s.key]))
      .sort((a, b) => b.stats[s.key] - a.stats[s.key]);
    let rank = 0, prev = null;
    list.forEach((c, i) => {
      const v = c.stats[s.key];
      if (v !== prev) { rank = i + 1; prev = v; }
      (out[c.id] ??= {})[s.key] = { rank, total: list.length };
    });
  }
  return out;
}

// คูณค่าสถานะตามกลายพันธุ์ที่เลือก
export function applyMutation(stats = {}, m) {
  const r = {};
  for (const s of STATS) {
    const v = stats[s.key];
    if (!Number.isFinite(v)) continue;
    r[s.key] = m && (m.applies_to === 'all' || m.applies_to === s.key)
      ? Math.round(v * Number(m.multiplier)) : v;
  }
  return r;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = n => Number(n).toLocaleString('en-US');
export const byId = (list, id) => list.find(x => x.id === id);
export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
