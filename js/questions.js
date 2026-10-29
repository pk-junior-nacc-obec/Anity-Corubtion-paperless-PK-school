import { $, $$, esc, h, icon, toast } from './ui.js';

export const QTYPES = {
  paragraph: 'ตอบแบบย่อหน้า',
  short: 'ตอบแบบสั้น ๆ',
  single: 'ตัวเลือก (ตอบได้ข้อเดียว)',
  multiple: 'ตัวเลือก (ตอบได้หลายข้อ)',
  dropdown: 'เลื่อนลง (ดรอปดาวน์)',
  matching: 'แบบโยงคำตอบ (A → 1)',
  scale: 'สเกลเชิงเส้น',
  stars: 'คะแนนแบบดาว',
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function defaultQuestion(type = 'short') {
  return {
    id: null, question_text: '', image_data: null, image_source: '', answer_type: type,
    options: ['single', 'multiple', 'dropdown'].includes(type) ? ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'] : [],
    settings: defaultSettings(type),
  };
}
function defaultSettings(type) {
  if (type === 'matching') return { left: ['', ''], right: ['', ''] };
  if (type === 'scale') return { min: 1, max: 5, min_label: '', max_label: '' };
  if (type === 'stars') return { count: 5 };
  return {};
}

/** ตรวจว่าตอบแล้วหรือยัง (ตรงกับฟังก์ชัน _is_answered ในฐานข้อมูล) */
export function isAnswered(q, a) {
  if (a === null || a === undefined) return false;
  if (typeof a === 'string') return a.trim() !== '';
  if (typeof a === 'number') return true;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === 'object') {
    const need = Math.max(1, (q.settings?.left || []).length || 1);
    return Object.values(a).filter((v) => v !== '' && v !== null && v !== undefined).length >= need;
  }
  return false;
}

// ===================================================================
//  แสดงคำถาม + ช่องตอบ (นักเรียนทำ / ครูดูแบบอ่านอย่างเดียว)
// ===================================================================
export function renderQuestion(q, value, { readonly = false, onChange = () => {} } = {}) {
  const wrap = h(`
    <article class="q-card ${readonly ? 'ro' : ''}" data-qid="${q.id}">
      <header class="q-head">
        <span class="q-no">ข้อที่ ${q.q_no}</span>
        <span class="q-type">${esc(QTYPES[q.answer_type] || '')}</span>
        <span class="q-state"></span>
      </header>
      ${q.question_text ? `<div class="q-text">${esc(q.question_text).replace(/\n/g, '<br>')}</div>` : ''}
      ${q.image_data ? `<figure class="q-figure"><img src="${q.image_data}" alt="รูปประกอบข้อที่ ${q.q_no}" loading="lazy" />
        ${q.image_source ? `<figcaption>ที่มา: ${esc(q.image_source)}</figcaption>` : ''}</figure>` : ''}
      <div class="q-answer"></div>
    </article>`);
  const box = $('.q-answer', wrap);
  const name = `q${q.id}`;
  let val = value ?? null;
  const dis = readonly ? 'disabled' : '';
  const opts = Array.isArray(q.options) ? q.options : [];
  const s = q.settings || {};
  const fire = () => { markState(); onChange(val); };
  const markState = () => {
    const ok = isAnswered(q, val);
    wrap.classList.toggle('answered', ok);
    $('.q-state', wrap).innerHTML = ok ? `${icon('check')} ตอบแล้ว` : 'ยังไม่ตอบ';
  };

  switch (q.answer_type) {
    case 'paragraph': {
      box.innerHTML = `<textarea rows="5" ${dis} placeholder="พิมพ์คำตอบ…">${esc(val ?? '')}</textarea>`;
      $('textarea', box).addEventListener('input', (e) => { val = e.target.value; fire(); });
      break;
    }
    case 'short': {
      box.innerHTML = `<input type="text" ${dis} placeholder="คำตอบสั้น ๆ" value="${esc(val ?? '')}" />`;
      $('input', box).addEventListener('input', (e) => { val = e.target.value; fire(); });
      break;
    }
    case 'single': {
      box.innerHTML = `<div class="choice-list">${opts.map((o, i) => `
        <label class="choice"><input type="radio" name="${name}" value="${esc(o)}" ${val === o ? 'checked' : ''} ${dis} />
        <span class="choice-mark"></span><span>${esc(o)}</span></label>`).join('')}</div>`;
      $$('input', box).forEach((inp) => inp.addEventListener('change', () => { val = inp.value; fire(); }));
      break;
    }
    case 'multiple': {
      const arr = Array.isArray(val) ? val : [];
      box.innerHTML = `<div class="choice-list">${opts.map((o) => `
        <label class="choice"><input type="checkbox" value="${esc(o)}" ${arr.includes(o) ? 'checked' : ''} ${dis} />
        <span class="choice-mark square"></span><span>${esc(o)}</span></label>`).join('')}</div>`;
      $$('input', box).forEach((inp) => inp.addEventListener('change', () => {
        val = $$('input:checked', box).map((x) => x.value); fire();
      }));
      break;
    }
    case 'dropdown': {
      box.innerHTML = `<select ${dis}><option value="">— เลือกคำตอบ —</option>${opts.map((o) =>
        `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      $('select', box).addEventListener('change', (e) => { val = e.target.value; fire(); });
      break;
    }
    case 'matching': {
      const left = s.left || [], right = s.right || [];
      const cur = (val && typeof val === 'object' && !Array.isArray(val)) ? { ...val } : {};
      box.innerHTML = `
        <div class="match-grid">
          <div class="match-col">
            <h5>รายการ</h5>
            ${left.map((l, i) => `
              <div class="match-row">
                <span class="match-key">${LETTERS[i]}</span>
                <span class="match-text">${esc(l)}</span>
                <select data-i="${i}" ${dis} aria-label="จับคู่ ${LETTERS[i]}">
                  <option value="">โยงไปข้อ…</option>
                  ${right.map((_, j) => `<option value="${j}" ${String(cur[i]) === String(j) ? 'selected' : ''}>${j + 1}</option>`).join('')}
                </select>
              </div>`).join('')}
          </div>
          <div class="match-col">
            <h5>คำตอบ</h5>
            ${right.map((r, j) => `<div class="match-row"><span class="match-key alt">${j + 1}</span><span class="match-text">${esc(r)}</span></div>`).join('')}
          </div>
        </div>`;
      $$('select', box).forEach((sel) => sel.addEventListener('change', () => {
        if (sel.value === '') delete cur[sel.dataset.i]; else cur[sel.dataset.i] = sel.value;
        val = Object.keys(cur).length ? { ...cur } : null; fire();
      }));
      break;
    }
    case 'scale': {
      const min = Number(s.min ?? 1), max = Number(s.max ?? 5);
      const nums = []; for (let i = min; i <= max; i++) nums.push(i);
      box.innerHTML = `
        <div class="scale">
          ${s.min_label ? `<span class="scale-label">${esc(s.min_label)}</span>` : ''}
          <div class="scale-row">${nums.map((n) => `
            <label class="scale-opt"><input type="radio" name="${name}" value="${n}" ${Number(val) === n && val !== null ? 'checked' : ''} ${dis} />
            <span>${n}</span></label>`).join('')}</div>
          ${s.max_label ? `<span class="scale-label">${esc(s.max_label)}</span>` : ''}
        </div>`;
      $$('input', box).forEach((inp) => inp.addEventListener('change', () => { val = Number(inp.value); fire(); }));
      break;
    }
    case 'stars': {
      const count = Math.max(1, Math.min(10, Number(s.count ?? 5)));
      const draw = () => $$('.star', box).forEach((b, i) => b.classList.toggle('on', val !== null && i < Number(val)));
      box.innerHTML = `<div class="stars" role="radiogroup" aria-label="ให้คะแนนดาว">${Array.from({ length: count }, (_, i) =>
        `<button type="button" class="star" data-v="${i + 1}" ${dis} aria-label="${i + 1} ดาว">${icon('star')}</button>`).join('')}
        <span class="stars-val"></span></div>`;
      const label = () => { $('.stars-val', box).textContent = val ? `${val} / ${count} ดาว` : ''; };
      $$('.star', box).forEach((b) => b.addEventListener('click', () => { val = Number(b.dataset.v); draw(); label(); fire(); }));
      draw(); label();
      break;
    }
    default:
      box.textContent = 'รูปแบบคำตอบไม่รองรับ';
  }
  markState();
  return { el: wrap, get: () => val };
}

// ===================================================================
//  ตัวแก้ไขคำถาม (Admin)
// ===================================================================
async function compressImage(file, maxSide = 1200, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

export function renderQuestionEditor(q, index, total, { onChange, onMove, onRemove, onDuplicate }) {
  const el = h(`<article class="qe-card"></article>`);
  const build = () => {
    const t = q.answer_type;
    el.innerHTML = `
      <header class="qe-head">
        <span class="q-no">ข้อที่ ${index + 1}</span>
        <div class="qe-tools">
          <button type="button" class="icon-btn" data-act="up" ${index === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">${icon('up')}</button>
          <button type="button" class="icon-btn" data-act="down" ${index === total - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">${icon('down')}</button>
          <button type="button" class="icon-btn" data-act="dup" aria-label="คัดลอกข้อ">${icon('copy')}</button>
          <button type="button" class="icon-btn danger" data-act="del" aria-label="ลบข้อ">${icon('trash')}</button>
        </div>
      </header>
      <div class="qe-body">
        <div class="field">
          <label>คำถาม (ตัวหนังสือ)</label>
          <textarea rows="2" data-f="question_text" placeholder="พิมพ์คำถาม…">${esc(q.question_text || '')}</textarea>
        </div>
        <div class="qe-image">
          ${q.image_data ? `<div class="qe-img-prev"><img src="${q.image_data}" alt="รูปประกอบ" />
            <button type="button" class="btn btn-sm btn-ghost" data-act="rmimg">${icon('trash')} ลบรูป</button></div>` : ''}
          <label class="btn btn-sm btn-outline upload-btn">${icon('image')} ${q.image_data ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
            <input type="file" accept="image/*" data-act="img" hidden /></label>
          <div class="field grow">
            <label>ที่มาของรูป</label>
            <input type="text" data-f="image_source" value="${esc(q.image_source || '')}" placeholder="เช่น สำนักงาน ป.ป.ช. (ถ้ามี)" />
          </div>
        </div>
        <div class="field">
          <label>รูปแบบคำตอบ</label>
          <select data-f="answer_type">${Object.entries(QTYPES).map(([k, v]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="qe-config"></div>
      </div>`;
    const cfg = $('.qe-config', el);

    if (['single', 'multiple', 'dropdown'].includes(t)) {
      cfg.innerHTML = `<label class="label">ตัวเลือก</label>
        <div class="opt-list">${q.options.map((o, i) => `
          <div class="opt-row"><span class="opt-mark ${t === 'multiple' ? 'square' : ''}">${t === 'dropdown' ? i + 1 : ''}</span>
          <input type="text" data-opt="${i}" value="${esc(o)}" placeholder="ตัวเลือกที่ ${i + 1}" />
          <button type="button" class="icon-btn" data-rmopt="${i}" ${q.options.length <= 1 ? 'disabled' : ''} aria-label="ลบตัวเลือก">${icon('x')}</button></div>`).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-ghost" data-act="addopt">${icon('plus')} เพิ่มตัวเลือก</button>`;
    } else if (t === 'matching') {
      const s = q.settings;
      cfg.innerHTML = `<div class="match-edit">
        <div><label class="label">รายการ (A, B, C…)</label>
          ${s.left.map((v, i) => `<div class="opt-row"><span class="match-key">${LETTERS[i]}</span>
            <input type="text" data-left="${i}" value="${esc(v)}" placeholder="รายการ ${LETTERS[i]}" />
            <button type="button" class="icon-btn" data-rmleft="${i}" ${s.left.length <= 1 ? 'disabled' : ''} aria-label="ลบ">${icon('x')}</button></div>`).join('')}
          <button type="button" class="btn btn-sm btn-ghost" data-act="addleft">${icon('plus')} เพิ่มรายการ</button></div>
        <div><label class="label">คำตอบ (1, 2, 3…)</label>
          ${s.right.map((v, i) => `<div class="opt-row"><span class="match-key alt">${i + 1}</span>
            <input type="text" data-right="${i}" value="${esc(v)}" placeholder="คำตอบ ${i + 1}" />
            <button type="button" class="icon-btn" data-rmright="${i}" ${s.right.length <= 1 ? 'disabled' : ''} aria-label="ลบ">${icon('x')}</button></div>`).join('')}
          <button type="button" class="btn btn-sm btn-ghost" data-act="addright">${icon('plus')} เพิ่มคำตอบ</button></div>
      </div>`;
    } else if (t === 'scale') {
      const s = q.settings;
      cfg.innerHTML = `<div class="grid-4">
        <div class="field"><label>ค่าต่ำสุด</label><select data-s="min">${[0, 1].map((n) => `<option ${Number(s.min) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label>ค่าสูงสุด</label><select data-s="max">${[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option ${Number(s.max) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label>ป้ายกำกับค่าต่ำสุด</label><input type="text" data-s="min_label" value="${esc(s.min_label || '')}" placeholder="เช่น น้อยที่สุด" /></div>
        <div class="field"><label>ป้ายกำกับค่าสูงสุด</label><input type="text" data-s="max_label" value="${esc(s.max_label || '')}" placeholder="เช่น มากที่สุด" /></div>
      </div>`;
    } else if (t === 'stars') {
      cfg.innerHTML = `<div class="field narrow"><label>จำนวนดาว</label>
        <select data-s="count">${[3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option ${Number(q.settings.count) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    } else {
      cfg.innerHTML = `<p class="muted small">${t === 'paragraph' ? 'นักเรียนพิมพ์คำตอบแบบหลายบรรทัด' : 'นักเรียนพิมพ์คำตอบสั้น ๆ 1 บรรทัด'}</p>`;
    }
    bind();
  };

  const bind = () => {
    $$('[data-f]', el).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const f = inp.dataset.f;
      if (f === 'answer_type') {
        const old = q.answer_type; q.answer_type = inp.value;
        const choice = ['single', 'multiple', 'dropdown'];
        if (choice.includes(q.answer_type) && !(choice.includes(old) && q.options.length)) q.options = ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'];
        if (!choice.includes(q.answer_type)) q.options = [];
        q.settings = defaultSettings(q.answer_type);
        build();
      } else q[f] = inp.value;
      onChange();
    }));
    $$('[data-opt]', el).forEach((inp) => inp.addEventListener('input', () => { q.options[inp.dataset.opt] = inp.value; onChange(); }));
    $$('[data-rmopt]', el).forEach((b) => b.addEventListener('click', () => { q.options.splice(Number(b.dataset.rmopt), 1); build(); onChange(); }));
    $$('[data-left]', el).forEach((inp) => inp.addEventListener('input', () => { q.settings.left[inp.dataset.left] = inp.value; onChange(); }));
    $$('[data-right]', el).forEach((inp) => inp.addEventListener('input', () => { q.settings.right[inp.dataset.right] = inp.value; onChange(); }));
    $$('[data-rmleft]', el).forEach((b) => b.addEventListener('click', () => { q.settings.left.splice(Number(b.dataset.rmleft), 1); build(); onChange(); }));
    $$('[data-rmright]', el).forEach((b) => b.addEventListener('click', () => { q.settings.right.splice(Number(b.dataset.rmright), 1); build(); onChange(); }));
    $$('[data-s]', el).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = inp.dataset.s; q.settings[k] = ['min', 'max', 'count'].includes(k) ? Number(inp.value) : inp.value; onChange();
    }));
    $$('[data-act]', el).forEach((b) => {
      const act = b.dataset.act;
      if (act === 'img') {
        b.addEventListener('change', async () => {
          const f = b.files[0]; if (!f) return;
          if (!f.type.startsWith('image/')) return toast('กรุณาเลือกไฟล์รูปภาพ', 'error');
          try { q.image_data = await compressImage(f); build(); onChange(); }
          catch { toast('อ่านไฟล์รูปไม่สำเร็จ', 'error'); }
        });
        return;
      }
      b.addEventListener('click', () => {
        if (act === 'up') onMove(-1);
        else if (act === 'down') onMove(1);
        else if (act === 'del') onRemove();
        else if (act === 'dup') onDuplicate();
        else if (act === 'rmimg') { q.image_data = null; build(); onChange(); }
        else if (act === 'addopt') { q.options.push(`ตัวเลือกที่ ${q.options.length + 1}`); build(); onChange(); }
        else if (act === 'addleft') { q.settings.left.push(''); build(); onChange(); }
        else if (act === 'addright') { q.settings.right.push(''); build(); onChange(); }
      });
    });
  };
  build();
  return el;
}

/** ตรวจความถูกต้องของคำถามก่อนบันทึก */
export function validateQuestions(list) {
  for (let i = 0; i < list.length; i++) {
    const q = list[i], n = i + 1;
    if (!q.question_text?.trim() && !q.image_data) return `ข้อที่ ${n}: กรุณาใส่คำถามหรือรูปภาพ`;
    if (['single', 'multiple', 'dropdown'].includes(q.answer_type)) {
      const o = q.options.map((x) => x.trim()).filter(Boolean);
      if (o.length < 2) return `ข้อที่ ${n}: ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`;
      if (new Set(o).size !== o.length) return `ข้อที่ ${n}: ตัวเลือกซ้ำกัน`;
    }
    if (q.answer_type === 'matching') {
      if (q.settings.left.some((x) => !x.trim()) || q.settings.right.some((x) => !x.trim())) return `ข้อที่ ${n}: กรอกรายการโยงคำตอบให้ครบ`;
    }
    if (q.answer_type === 'scale' && Number(q.settings.min) >= Number(q.settings.max)) return `ข้อที่ ${n}: ค่าต่ำสุดต้องน้อยกว่าค่าสูงสุด`;
  }
  return null;
}

export function cleanQuestion(q) {
  const out = { ...q };
  if (['single', 'multiple', 'dropdown'].includes(q.answer_type)) out.options = q.options.map((x) => x.trim()).filter(Boolean);
  if (q.answer_type === 'matching') out.settings = { left: q.settings.left.map((x) => x.trim()), right: q.settings.right.map((x) => x.trim()) };
  return out;
}
