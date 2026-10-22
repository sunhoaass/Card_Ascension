// cropper.js — ตัดรูปการ์ดให้ขนาดเท่ากันทุกใบ (ลากด้วยนิ้ว / จีบนิ้วซูม / สไลด์ซูม)
import { CARD_IMAGE } from './config.js';

export function openCropper(file) {
  return new Promise(resolve => {
    const { width: OW, height: OH } = CARD_IMAGE;
    const dW = Math.min(300, window.innerWidth - 64);
    const dH = Math.round(dW * OH / OW);

    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="sheet">
      <b>Crop card image</b>
      <div class="muted">Drag to move · pinch or slider to zoom</div>
      <div class="crop-wrap"><canvas width="${dW}" height="${dH}"></canvas></div>
      <input type="range" min="1" max="4" step="0.01" value="1">
      <div class="row" style="margin-top:12px">
        <button data-a="cancel">Cancel</button>
        <button data-a="ok" class="primary">Use image</button>
      </div></div>`;
    document.body.appendChild(m);

    const cv = m.querySelector('canvas'), ctx = cv.getContext('2d');
    const slider = m.querySelector('input');
    const img = new Image();
    const url = URL.createObjectURL(file);
    let base = 1, zoom = 1, x = 0, y = 0;

    const scale = () => base * zoom;
    const clamp = () => {
      const w = img.width * scale(), h = img.height * scale();
      x = Math.min(0, Math.max(dW - w, x));
      y = Math.min(0, Math.max(dH - h, y));
    };
    const draw = () => {
      clamp();
      ctx.clearRect(0, 0, dW, dH);
      ctx.drawImage(img, x, y, img.width * scale(), img.height * scale());
    };
    const zoomAt = (z, cx, cy) => {
      const old = scale();
      zoom = Math.min(4, Math.max(1, z));
      const k = scale() / old;
      x = cx - (cx - x) * k; y = cy - (cy - y) * k;
      slider.value = zoom; draw();
    };

    img.onload = () => {
      base = Math.max(dW / img.width, dH / img.height); // เต็มกรอบพอดี
      x = (dW - img.width * base) / 2; y = (dH - img.height * base) / 2;
      draw();
    };
    img.src = url;

    // ลาก + จีบนิ้ว
    const pts = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, e);
      if (pts.size === 1) { x += e.clientX - prev.clientX; y += e.clientY - prev.clientY; draw(); }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const r = cv.getBoundingClientRect();
        const cx = (a.clientX + b.clientX) / 2 - r.left, cy = (a.clientY + b.clientY) / 2 - r.top;
        if (pinch) zoomAt(zoom * d / pinch, cx, cy);
        pinch = d;
      }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    slider.oninput = () => zoomAt(Number(slider.value), dW / 2, dH / 2);

    const close = v => { URL.revokeObjectURL(url); m.remove(); resolve(v); };
    m.querySelector('[data-a=cancel]').onclick = () => close(null);
    m.querySelector('[data-a=ok]').onclick = () => {
      const out = document.createElement('canvas');
      out.width = OW; out.height = OH;
      const k = OW / dW;
      out.getContext('2d').drawImage(img, x * k, y * k, img.width * scale() * k, img.height * scale() * k);
      // webp ถ้าเครื่องรองรับ ไม่งั้นใช้ png
      out.toBlob(b => close(b), 'image/webp', 0.9);
    };
  });
}
