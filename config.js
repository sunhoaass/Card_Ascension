// =====================================================
// config.js — ไฟล์เดียวที่ต้องแก้เวลาย้ายไปเกมอื่น
// =====================================================

export const SITE = {
  name: 'Card Battle Infinity',
  tagline: 'Tier list & card database',
};

// repo ที่เก็บเว็บ + ข้อมูล (ถ้าย้ายเกม/เปลี่ยนชื่อ repo แก้ตรงนี้)
export const GITHUB = { owner: 'sunhoaass', repo: 'Card_Ascension', branch: 'main' };

// ขนาดรูปการ์ดหลังตัด (ทุกใบจะออกมาขนาดนี้เท่ากัน)
export const CARD_IMAGE = { width: 600, height: 840 };

// ค่าสถานะของเกมนี้ (เพิ่ม/ลบได้ เช่น { key: 'spd', label: 'SPD' })
export const STATS = [
  { key: 'atk', label: 'ATK' },
  { key: 'hp', label: 'HP' },
];

// ช่องใน Tier List (เรียงจากบนลงล่าง)
export const TIERS = [
  { name: 'SS', color: '#ff5c7a' },
  { name: 'S', color: '#ff9f43' },
  { name: 'A', color: '#feca57' },
  { name: 'B', color: '#1dd1a1' },
  { name: 'C', color: '#54a0ff' },
  { name: 'Support', color: '#a78bfa' },
];

// Tag ของการ์ด (ใช้ในระบบวิเคราะห์ทีมเฟสต่อไป)
// single: true = เลือกได้อันเดียว
export const TAG_GROUPS = [
  { key: 'attack', label: 'Attack type', single: true, options: ['Single', 'AoE'] },
  { key: 'role', label: 'Role', options: ['Damage', 'Control', 'Heal', 'Buff', 'Debuff', 'Revive', 'Energy drain', 'Tank'] },
  { key: 'status', label: 'Status effects', options: ['Burn', 'Poison', 'Bleed', 'Stun', 'Freeze', 'Silence'] },
];
