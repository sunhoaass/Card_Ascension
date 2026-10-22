// github.js — บันทึกข้อมูลขึ้น GitHub โดยตรง (ใช้ในหน้าแอดมินเท่านั้น)
import { GITHUB } from './config.js';

const API = `https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}`;
const TOKEN_KEY = 'cbi.token';
export const DB_PATH = 'data/db.json';

export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 404 && opts.allow404) return null;
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`GitHub ${res.status}: ${j.message || res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

// ตรวจว่า token ใช้แก้ repo นี้ได้จริง
export async function checkToken() {
  const r = await gh('');
  if (!r.permissions?.push) throw new Error('This token cannot write to the repo');
  return r;
}

// ---------- base64 ----------
const bytesToB64 = bytes => {
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const textToB64 = t => bytesToB64(new TextEncoder().encode(t));
const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, '')), c => c.charCodeAt(0)));
const blobToB64 = async blob => bytesToB64(new Uint8Array(await blob.arrayBuffer()));

// ---------- ไฟล์ข้อมูล ----------
// อ่านจาก GitHub ตรงๆ (สดกว่าหน้าเว็บที่อาจ cache ไว้ 1–10 นาที)
export async function readDb() {
  const f = await gh(`/contents/${DB_PATH}?ref=${GITHUB.branch}`, { allow404: true });
  if (!f) return { db: { updated: null, rarities: [], mutations: [], cards: [] }, sha: null };
  return { db: JSON.parse(b64ToText(f.content)), sha: f.sha };
}

export async function writeDb(db, sha, message) {
  db.updated = new Date().toISOString();
  const r = await gh(`/contents/${DB_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch: GITHUB.branch, content: textToB64(JSON.stringify(db, null, 1)), ...(sha ? { sha } : {}) }),
  });
  return r.content.sha;
}

export async function uploadFile(path, blob, message) {
  await gh(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch: GITHUB.branch, content: await blobToB64(blob) }),
  });
}

export async function deleteFile(path, message) {
  const f = await gh(`/contents/${path}?ref=${GITHUB.branch}`, { allow404: true });
  if (!f) return;
  await gh(`/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message, branch: GITHUB.branch, sha: f.sha }) });
}
