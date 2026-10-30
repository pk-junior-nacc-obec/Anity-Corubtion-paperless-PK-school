// ==============================================================
//  สื่อประกอบใบงาน: ภาพ วิดีโอ เสียง PDF เอกสาร ลิงก์ YouTube / Google Drive
//  ไฟล์ถูกเก็บใน Supabase Storage (bucket: worksheet-media)
//  ข้อมูลเก็บใน question.settings.media = [{ id, kind, url, name, mime, size, caption }]
// ==============================================================
import { CONFIG } from './config.js';
import { rpc, session } from './api.js';
import { $$, esc, icon, toast } from './ui.js';

export const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const uid = () => Math.random().toString(36).slice(2, 9);

export const KIND_LABEL = {
  image: 'รูปภาพ', video: 'วิดีโอ', audio: 'เสียง', pdf: 'PDF', youtube: 'YouTube',
  drive: 'Google Drive', link: 'ลิงก์', file: 'ไฟล์',
};
const KIND_ICON = { image: 'image', video: 'video', audio: 'music', pdf: 'file', youtube: 'video', drive: 'clip', link: 'link', file: 'clip' };

export const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const EXT = {
  image: /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic)$/i,
  video: /\.(mp4|webm|ogv|mov|m4v)$/i,
  audio: /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i,
  pdf: /\.pdf$/i,
};
export function detectKind(mime = '', name = '') {
  mime = String(mime).toLowerCase();
  if (mime.startsWith('image/') && !/heic|heif|tiff/.test(mime)) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  for (const [k, re] of Object.entries(EXT)) if (re.test(name)) return k === 'image' && /heic$/i.test(name) ? 'file' : k;
  return 'file';
}

/** แปลงลิงก์ที่วางมาเป็นสื่อ (YouTube / Google Drive / ไฟล์ตรง / เว็บไซต์) */
export function parseLink(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let yt = null;
  if (host === 'youtu.be') yt = u.pathname.slice(1).split('/')[0];
  else if (host.endsWith('youtube.com')) {
    yt = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/) || [])[1] || null;
  }
  if (yt) {
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    const start = t ? parseInt(String(t).replace(/s$/, ''), 10) || 0 : 0;
    return { kind: 'youtube', url: u.href, embed: `https://www.youtube-nocookie.com/embed/${yt}${start ? `?start=${start}` : ''}` };
  }
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get('id');
    if (id) {
      const m = u.pathname.match(/^\/(document|spreadsheets|presentation|forms)\//);
      const embed = m ? `https://docs.google.com/${m[1]}/d/${id}/${m[1] === 'forms' ? 'viewform?embedded=true' : 'preview'}`
        : `https://drive.google.com/file/d/${id}/preview`;
      return { kind: 'drive', url: u.href, embed };
    }
  }
  const k = detectKind('', u.pathname);
  return { kind: k === 'file' ? 'link' : k, url: u.href };
}

const storageBase = () => `${CONFIG.SUPABASE_URL}/storage/v1/object`;
const publicUrl = (bucket, path) => `${storageBase()}/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

async function shrinkImage(file, maxSide = 1600, quality = 0.85) {
  if (!/^image\/(jpeg|png|webp|bmp)$/.test(file.type) || file.size < 400 * 1024) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}

function toDataUrl(file, maxSide = 1200) {
  return shrinkImage(file, maxSide, 0.8).then((f) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
  }));
}

function putFile(bucket, path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${storageBase()}/${bucket}/${path}`);
    xhr.setRequestHeader('apikey', CONFIG.SUPABASE_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${CONFIG.SUPABASE_KEY}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = xhr.responseText || '';
      try { const j = JSON.parse(msg); msg = j.message || j.error || msg; } catch { /* ignore */ }
      reject(Object.assign(new Error(msg || `HTTP ${xhr.status}`), { status: xhr.status, storage: true }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Failed to fetch'), { storage: true }));
    xhr.send(file);
  });
}

/** อัปโหลด 1 ไฟล์ -> คืนค่า media item */
export async function uploadFile(file, onProgress) {
  if (file.size > MAX_BYTES) throw new Error(`ไฟล์ “${file.name}” ใหญ่ ${fmtSize(file.size)} เกิน ${MAX_MB} MB · กรุณาอัปโหลดขึ้น YouTube หรือ Google Drive แล้วใช้ “เพิ่มลิงก์” แทน`);
  const kind = detectKind(file.type, file.name);
  const f = kind === 'image' ? await shrinkImage(file) : file;
  const base = { id: uid(), kind, name: file.name, mime: f.type || '', size: f.size, caption: '' };
  try {
    const t = await rpc('admin_media_ticket', { p_name: f.name, p_mime: f.type || '', p_size: f.size });
    await putFile(t.bucket, t.path, f, onProgress);
    return { ...base, url: publicUrl(t.bucket, t.path), path: t.path };
  } catch (e) {
    // ยังไม่ได้ตั้งค่า Storage: รูปภาพเก็บแบบฝังในฐานข้อมูลได้ ไฟล์อื่นต้องตั้งค่าก่อน
    if (kind === 'image' && (e.storage || /ฐานข้อมูล/.test(e.message))) {
      const url = await toDataUrl(file);
      toast('ยังไม่ได้เปิดใช้ Storage จึงเก็บรูปแบบย่อขนาดไว้ในฐานข้อมูลแทน', 'info', 5000);
      return { ...base, url, mime: 'image/jpeg', size: Math.round(url.length * 0.75) };
    }
    if (e.storage) {
      const m = e.message || '';
      if (/bucket not found/i.test(m)) throw new Error('ยังไม่ได้สร้างที่เก็บไฟล์ (Storage bucket “worksheet-media”) · กรุณารันไฟล์ 01_schema.sql ใหม่');
      if (e.status === 413 || /too large|exceeded/i.test(m)) throw new Error(`ไฟล์ใหญ่เกินที่ Supabase อนุญาต (${MAX_MB} MB) · ใช้ลิงก์ YouTube / Google Drive แทน`);
      if (e.status === 403 || /row-level security|policy|unauthori/i.test(m)) throw new Error('Storage ไม่อนุญาตให้อัปโหลด · กรุณารันไฟล์ 01_schema.sql ใหม่เพื่อสร้างสิทธิ์');
      throw new Error(`อัปโหลดไม่สำเร็จ: ${m}`);
    }
    throw e;
  }
}

// ---------------------------------------------------------------
//  แสดงสื่อ (นักเรียน / ครู)
// ---------------------------------------------------------------
const safeUrl = (u) => (/^(https?:|data:image\/)/i.test(String(u || '')) ? String(u) : '');

function fileCard(m, label = 'เปิด / ดาวน์โหลด') {
  const url = safeUrl(m.url);
  return `<a class="media-file" href="${esc(url)}" target="_blank" rel="noopener" ${m.kind === 'link' ? '' : 'download'}>
    <span class="mf-ic k-${esc(m.kind)}">${icon(KIND_ICON[m.kind] || 'clip')}</span>
    <span class="mf-body"><strong>${esc(m.name || m.caption || url)}</strong>
      <small>${esc(KIND_LABEL[m.kind] || 'ไฟล์')}${m.size ? ` · ${fmtSize(m.size)}` : ''}</small></span>
    <span class="mf-go">${icon(m.kind === 'link' ? 'external' : 'download')}<span>${label}</span></span></a>`;
}

export function mediaItemHtml(m, { alt = 'สื่อประกอบ' } = {}) {
  const url = safeUrl(m.url);
  if (!url) return '';
  const cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  switch (m.kind) {
    case 'image':
      return `<figure class="media-item m-image"><a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(m.caption || alt)}" loading="lazy" /></a>${cap}</figure>`;
    case 'video':
      return `<figure class="media-item m-video"><video controls preload="metadata" playsinline src="${esc(url)}"></video>${cap}</figure>`;
    case 'audio':
      return `<figure class="media-item m-audio"><div class="m-audio-row">${icon('music')}<span>${esc(m.name || 'ไฟล์เสียง')}</span></div><audio controls preload="metadata" src="${esc(url)}"></audio>${cap}</figure>`;
    case 'pdf':
      return `<figure class="media-item m-pdf"><iframe src="${esc(url)}#view=FitH" title="${esc(m.name || 'PDF')}" loading="lazy"></iframe>${fileCard(m, 'เปิดเต็มจอ')}${cap}</figure>`;
    case 'youtube': case 'drive':
      return `<figure class="media-item m-embed"><div class="m-frame"><iframe src="${esc(m.embed || url)}" title="${esc(m.caption || KIND_LABEL[m.kind])}" loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <a class="m-open" href="${esc(url)}" target="_blank" rel="noopener">${icon('external')} เปิดใน ${esc(KIND_LABEL[m.kind])}</a>${cap}</figure>`;
    default:
      return `<figure class="media-item m-file">${fileCard(m)}${cap}</figure>`;
  }
}

/** รวมสื่อทั้งหมดของข้อ (รองรับรูปแบบเดิม image_data ด้วย) */
export function getMedia(q) {
  const list = Array.isArray(q.settings?.media) ? q.settings.media.filter((m) => m && m.url) : [];
  if (q.image_data) list.unshift({ id: 'legacy', kind: 'image', url: q.image_data, caption: q.image_source ? `ที่มา: ${q.image_source}` : '' });
  return list;
}

export function mediaHtml(q, opts) {
  const list = getMedia(q);
  if (!list.length) return '';
  return `<div class="media-list n-${Math.min(list.length, 3)}">${list.map((m) => mediaItemHtml(m, opts)).join('')}</div>`;
}

// ---------------------------------------------------------------
//  ตัวแก้ไขสื่อ (Admin)
// ---------------------------------------------------------------
/** ย้ายรูปแบบเดิม (image_data) มาอยู่ใน settings.media */
export function migrateLegacy(q) {
  q.settings = q.settings || {};
  if (!Array.isArray(q.settings.media)) q.settings.media = [];
  if (q.image_data) {
    q.settings.media.unshift({ id: uid(), kind: 'image', url: q.image_data, name: 'รูปประกอบ', mime: 'image/jpeg', size: 0,
      caption: q.image_source ? `ที่มา: ${q.image_source}` : '' });
    q.image_data = null; q.image_source = '';
  }
  return q.settings.media;
}

function thumb(m) {
  const url = safeUrl(m.url);
  if (m.kind === 'image' && url) return `<img src="${esc(url)}" alt="" />`;
  if (m.kind === 'video' && url) return `<video src="${esc(url)}#t=0.5" preload="metadata" muted playsinline></video>`;
  return `<span class="me-ic k-${esc(m.kind)}">${icon(KIND_ICON[m.kind] || 'clip')}</span>`;
}

export function mediaEditorHtml(q) {
  const list = q.settings.media;
  const up = q._uploads || [];
  return `<div class="media-edit">
    <div class="me-head">
      <label class="label">${icon('clip')} สื่อประกอบ / ไฟล์แนบ <span class="muted">(${list.length})</span></label>
      <span class="muted small">รูปภาพ วิดีโอ เสียง PDF Word PowerPoint Excel ฯลฯ ไฟล์ละไม่เกิน ${MAX_MB} MB · วิดีโอยาวแนะนำใช้ลิงก์ YouTube</span>
    </div>
    ${list.length ? `<ul class="me-list">${list.map((m, i) => `
      <li class="me-row">
        <div class="me-thumb">${thumb(m)}</div>
        <div class="me-info">
          <div class="me-name"><span class="chip k-${esc(m.kind)}">${esc(KIND_LABEL[m.kind] || 'ไฟล์')}</span>
            <a href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener">${esc(m.name || m.url)}</a>
            ${m.size ? `<small class="muted">${fmtSize(m.size)}</small>` : ''}</div>
          <input type="text" data-mcap="${i}" value="${esc(m.caption || '')}" placeholder="คำอธิบายใต้สื่อ / ที่มา (ถ้ามี)" />
        </div>
        <div class="me-tools">
          <button type="button" class="icon-btn" data-mup="${i}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">${icon('up')}</button>
          <button type="button" class="icon-btn" data-mdown="${i}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">${icon('down')}</button>
          <button type="button" class="icon-btn danger" data-mrm="${i}" aria-label="ลบสื่อ">${icon('trash')}</button>
        </div>
      </li>`).join('')}</ul>` : ''}
    ${up.length ? `<ul class="me-uploading">${up.map((u) => `<li><span class="me-ic">${icon('upload')}</span>
        <span class="grow">${esc(u.name)} <small class="muted">${fmtSize(u.size)}</small></span>
        <span class="me-bar"><i style="width:${Math.round(u.p * 100)}%"></i></span><small>${Math.round(u.p * 100)}%</small></li>`).join('')}</ul>` : ''}
    <div class="me-actions">
      <label class="btn btn-sm btn-outline upload-btn">${icon('upload')} อัปโหลดไฟล์
        <input type="file" multiple data-mfile hidden /></label>
      <div class="me-link">
        <input type="url" data-mlink placeholder="วางลิงก์ YouTube, Google Drive หรือเว็บไซต์" aria-label="ลิงก์สื่อ" />
        <button type="button" class="btn btn-sm btn-ghost" data-maddlink>${icon('link')} เพิ่มลิงก์</button>
      </div>
    </div>
  </div>`;
}

/** ผูกเหตุการณ์ของตัวแก้ไขสื่อ  rebuild = วาดตัวแก้ไขใหม่ */
export function bindMediaEditor(root, q, { rebuild, onChange }) {
  const list = q.settings.media;
  const mv = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; rebuild(); onChange(); };
  $$('[data-mcap]', root).forEach((inp) => inp.addEventListener('input', () => { list[Number(inp.dataset.mcap)].caption = inp.value; onChange(); }));
  $$('[data-mup]', root).forEach((b) => b.addEventListener('click', () => mv(Number(b.dataset.mup), -1)));
  $$('[data-mdown]', root).forEach((b) => b.addEventListener('click', () => mv(Number(b.dataset.mdown), 1)));
  $$('[data-mrm]', root).forEach((b) => b.addEventListener('click', () => { list.splice(Number(b.dataset.mrm), 1); rebuild(); onChange(); }));

  const linkInp = root.querySelector('[data-mlink]');
  const addLink = () => {
    const v = linkInp.value.trim(); if (!v) return linkInp.focus();
    const p = parseLink(v);
    if (!p) return toast('ลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://', 'error');
    let name = p.url;
    try { const u = new URL(p.url); name = decodeURIComponent(u.pathname.split('/').pop() || '') || u.hostname; } catch { /* ignore */ }
    list.push({ id: uid(), ...p, name: p.kind === 'youtube' ? 'วิดีโอ YouTube' : p.kind === 'drive' ? 'ไฟล์จาก Google Drive' : name, mime: '', size: 0, caption: '' });
    rebuild(); onChange();
  };
  root.querySelector('[data-maddlink]')?.addEventListener('click', addLink);
  linkInp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });

  const fileInp = root.querySelector('[data-mfile]');
  fileInp?.addEventListener('change', async () => {
    const files = [...fileInp.files]; fileInp.value = '';
    if (!files.length) return;
    if (!session.get()?.token) return toast('กรุณาเข้าสู่ระบบใหม่', 'error');
    q._uploads = q._uploads || [];
    const jobs = files.map((f) => ({ name: f.name, size: f.size, p: 0, f }));
    q._uploads.push(...jobs); rebuild();
    for (const job of jobs) {
      try {
        let last = 0;
        const item = await uploadFile(job.f, (p) => {
          job.p = p; const now = Date.now();
          if (now - last > 150) { last = now; const bar = [...root.querySelectorAll('.me-uploading li')][q._uploads.indexOf(job)]; if (bar) { bar.querySelector('i').style.width = `${Math.round(p * 100)}%`; bar.lastElementChild.textContent = `${Math.round(p * 100)}%`; } }
        });
        list.push(item);
        toast(`อัปโหลด “${job.name}” แล้ว`, 'success', 2200);
      } catch (e) { toast(e.message || 'อัปโหลดไม่สำเร็จ', 'error', 6000); }
      q._uploads.splice(q._uploads.indexOf(job), 1);
      rebuild(); onChange();
    }
  });
}

export const cleanMedia = (list) => (Array.isArray(list) ? list : [])
  .filter((m) => m && safeUrl(m.url))
  .map((m) => {
    const o = { id: m.id || uid(), kind: m.kind || 'file', url: m.url, name: String(m.name || '').slice(0, 200), mime: m.mime || '', size: Number(m.size) || 0, caption: String(m.caption || '').trim() };
    if (m.embed) o.embed = m.embed;
    if (m.path) o.path = m.path;
    return o;
  });
