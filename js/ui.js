// ---------- DOM helpers ----------
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Icons (Lucide paths) ----------
const P = {
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  video: '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.94a.5.5 0 0 0-.76-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
};
export const icon = (n, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// ---------- Toast ----------
export function toast(msg, type = 'info', ms = 3600) {
  const root = $('#toast-root');
  const el = h(`<div class="toast toast-${type}" role="status">${esc(msg)}</div>`);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

// ---------- Modal ----------
export function modal({ title, body, actions = [], size = '' }) {
  const root = $('#modal-root');
  const el = h(`
    <div class="modal-backdrop">
      <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-close aria-label="ปิด">${icon('x')}</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-foot"></div>
      </div>
    </div>`);
  const bodyEl = $('.modal-body', el);
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const foot = $('.modal-foot', el);
  if (!actions.length) foot.remove();
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  actions.forEach((a) => {
    const b = h(`<button class="btn ${a.kind || 'btn-ghost'}">${a.label}</button>`);
    b.addEventListener('click', () => a.onClick ? a.onClick({ close, el, btn: b }) : close());
    foot.appendChild(b);
  });
  $('[data-close]', el).addEventListener('click', close);
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  document.addEventListener('keydown', onKey);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return { close, el, body: bodyEl };
}

export function confirmBox(message, { okText = 'ยืนยัน', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'ยืนยันการทำรายการ',
      body: `<p class="confirm-text">${esc(message)}</p>`,
      actions: [
        { label: 'ยกเลิก', onClick: ({ close }) => { done = true; close(); resolve(false); } },
        { label: okText, kind: danger ? 'btn-danger' : 'btn-primary', onClick: ({ close }) => { done = true; close(); resolve(true); } },
      ],
    });
    $('[data-close]', m.el).addEventListener('click', () => { if (!done) resolve(false); });
  });
}

// ---------- Buttons ----------
export async function withBusy(btn, fn) {
  if (!btn) return fn();
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('busy');
  try { return await fn(); }
  finally { btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = old; }
}

// ---------- Phone ----------
export const telDigits = (s) => String(s ?? '').replace(/\D/g, '').slice(0, 10);
export function fmtTel(s) {
  const d = telDigits(s);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
export function bindTelMask(input) {
  input.addEventListener('input', () => { input.value = fmtTel(input.value); });
}

// ---------- Password policy ----------
export const pwRules = [
  { id: 'len', label: 'อย่างน้อย 8 ตัวอักษร', test: (p) => p.length >= 8 },
  { id: 'num', label: 'มีตัวเลขอย่างน้อย 1 ตัว', test: (p) => /[0-9]/.test(p) },
  { id: 'alpha', label: 'มีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'spec', label: 'มีอักขระพิเศษอย่างน้อย 1 ตัว เช่น @ # ! _', test: (p) => /[^A-Za-z0-9]/.test(p) },
];
export const pwStrong = (p) => pwRules.every((r) => r.test(p || ''));

export function pwField(id, label, placeholder = '') {
  return `
  <div class="field">
    <label for="${id}">${label}</label>
    <div class="input-wrap">
      <span class="input-ic">${icon('key')}</span>
      <input id="${id}" type="password" autocomplete="new-password" placeholder="${esc(placeholder)}" />
      <button type="button" class="pw-toggle" data-toggle="${id}" aria-label="แสดงรหัสผ่าน">${icon('eye')}</button>
    </div>
  </div>`;
}
export function bindPwToggles(root) {
  $$('[data-toggle]', root).forEach((b) => b.addEventListener('click', () => {
    const inp = $('#' + b.dataset.toggle, root);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.innerHTML = icon(show ? 'eyeOff' : 'eye');
  }));
}

// ---------- Misc ----------
export const fmtDate = (s) => s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
export const num = (v) => (v === null || v === undefined || v === '') ? '' : (Number(v) % 1 === 0 ? String(Number(v)) : Number(v).toFixed(2));

const _scripts = new Map();
function loadOne(src, timeout) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    const t = setTimeout(() => { s.remove(); rej(new Error('timeout')); }, timeout);
    s.src = src; s.async = true;
    s.onload = () => { clearTimeout(t); res(); };
    s.onerror = () => { clearTimeout(t); s.remove(); rej(new Error('error')); };
    document.head.appendChild(s);
  });
}
/** โหลดไลบรารีภายนอกครั้งเดียว รอจนโหลดเสร็จจริง และสลับไปใช้ CDN สำรองอัตโนมัติ
 *  src = URL เดียว หรือ array ของ URL (ตัวแรกคือหลัก ที่เหลือคือสำรอง) */
export function loadScript(src, { timeout = 15000, check } = {}) {
  const list = Array.isArray(src) ? src : [src];
  const key = list[0];
  if (check && check()) return Promise.resolve();
  if (_scripts.has(key)) return _scripts.get(key);
  const p = (async () => {
    for (const url of list) {
      try { await loadOne(url, timeout); if (!check || check()) return; } catch { /* ลอง CDN ถัดไป */ }
    }
    _scripts.delete(key);
    throw new Error('โหลดไลบรารีไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  })();
  _scripts.set(key, p);
  return p;
}

export function setFaviconUrl(url) {
  let link = document.getElementById('app-favicon');
  if (!link) { link = document.createElement('link'); link.id = 'app-favicon'; link.rel = 'icon'; document.head.appendChild(link); }
  link.href = url;
}

export const emptyState = (title, text = '', ic = 'file') => `
  <div class="empty">
    <div class="empty-ic">${icon(ic)}</div>
    <h4>${esc(title)}</h4>
    ${text ? `<p>${esc(text)}</p>` : ''}
  </div>`;

export const skeleton = (rows = 3) => `<div class="skel-wrap">${Array.from({ length: rows }, () => '<div class="skel"></div>').join('')}</div>`;
