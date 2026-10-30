import { $, $$, esc, h, icon, toast } from './ui.js';
import { mediaHtml, getMedia, migrateLegacy, mediaEditorHtml, bindMediaEditor, cleanMedia } from './media.js';

export const QTYPES = {
  intro: 'บทนำ / ใบความรู้ / สื่อประกอบ (ไม่ต้องตอบ)',
  paragraph: 'ตอบแบบย่อหน้า',
  short: 'ตอบแบบสั้น ๆ',
  single: 'ตัวเลือก (ตอบได้ข้อเดียว)',
  multiple: 'ตัวเลือก (ตอบได้หลายข้อ)',
  dropdown: 'เลื่อนลง (ดรอปดาวน์)',
  matching: 'แบบโยงคำตอบ (A → 1)',
  scale: 'สเกลเชิงเส้น',
  stars: 'คะแนนแบบดาว',
  subq: 'ข้อย่อย / หลายช่องคำตอบ',
  table: 'ตารางให้กรอกคำตอบ',
};

export const SUBQ_KINDS = {
  short: 'ตอบสั้น ๆ', paragraph: 'ย่อหน้า', number: 'ตัวเลข', single: 'ตัวเลือก (ข้อเดียว)', dropdown: 'ดรอปดาวน์',
};
export const CELL_KINDS = { text: 'ข้อความ (คงที่)', input: 'ช่องกรอกสั้น', area: 'ช่องกรอกหลายบรรทัด' };

const uid = () => Math.random().toString(36).slice(2, 8);
const isIntro = (q) => q.answer_type === 'intro';
export const isQuestion = (q) => !isIntro(q);

/** กำหนดเลขข้อให้แสดง (บทนำไม่นับเป็นข้อ) */
export function numberQuestions(list) {
  let n = 0;
  return list.map((q) => (isIntro(q) ? null : ++n));
}

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
  if (type === 'intro') return { title: '' };
  if (type === 'subq') return { items: [newSubItem(), newSubItem()] };
  if (type === 'table') return {
    cols: ['หัวข้อ', 'คำตอบ'],
    rows: [1, 2, 3].map((i) => [{ t: 'text', v: `รายการที่ ${i}` }, { t: 'input', v: '' }]),
  };
  return {};
}
function newSubItem(kind = 'short') { return { id: uid(), label: '', kind, options: [] }; }
const filled = (v) => v !== null && v !== undefined && (typeof v === 'number' || String(v).trim() !== '');

/** มีการกรอกอย่างน้อย 1 ช่องหรือไม่ */
export function hasAny(a) {
  if (a === null || a === undefined) return false;
  if (typeof a === 'string') return a.trim() !== '';
  if (typeof a === 'number' || typeof a === 'boolean') return true;
  if (Array.isArray(a)) return a.some(hasAny);
  if (typeof a === 'object') return Object.values(a).some(hasAny);
  return false;
}
function tableInputKeys(s) {
  const keys = [];
  (s.rows || []).forEach((row, r) => row.forEach((c, ci) => { if (c.t === 'input' || c.t === 'area') keys.push(`r${r}c${ci}`); }));
  return keys;
}

/** ตรวจว่าตอบแล้วหรือยัง (ตรงกับฟังก์ชัน _is_answered ในฐานข้อมูล) */
export function isAnswered(q, a) {
  if (isIntro(q)) return false;
  if (a === null || a === undefined) return false;
  if (q.answer_type === 'subq') {
    const items = q.settings?.items || [];
    return typeof a === 'object' && items.length > 0 && items.every((it) => filled(a[it.id]));
  }
  if (q.answer_type === 'table') {
    const keys = tableInputKeys(q.settings || {});
    return typeof a === 'object' && keys.length > 0 && keys.every((k) => filled(a[k]));
  }
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
export function renderQuestion(q, value, { readonly = false, onChange = () => {}, no = q.q_no } = {}) {
  if (isIntro(q)) {
    const el = h(`
      <article class="intro-card">
        ${q.settings?.title ? `<h3 class="intro-title">${esc(q.settings.title)}</h3>` : ''}
        ${q.question_text ? `<div class="intro-text">${esc(q.question_text).replace(/\n/g, '<br>')}</div>` : ''}
        ${mediaHtml(q, { alt: q.settings?.title || 'สื่อประกอบ' })}
      </article>`);
    return { el, get: () => null };
  }
  const wrap = h(`
    <article class="q-card ${readonly ? 'ro' : ''}" data-qid="${q.id}">
      <header class="q-head">
        <span class="q-no">ข้อที่ ${no}</span>
        <span class="q-type">${esc(QTYPES[q.answer_type] || '')}</span>
        <span class="q-state"></span>
      </header>
      ${q.question_text ? `<div class="q-text">${esc(q.question_text).replace(/\n/g, '<br>')}</div>` : ''}
      ${mediaHtml(q, { alt: `สื่อประกอบข้อที่ ${no}` })}
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
    $('.q-state', wrap).innerHTML = ok ? `${icon('check')} ตอบแล้ว` : hasAny(val) ? 'ตอบยังไม่ครบ' : 'ยังไม่ตอบ';
  };
  const objVal = () => (val && typeof val === 'object' && !Array.isArray(val)) ? { ...val } : {};

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
    case 'subq': {
      const items = s.items || [];
      const cur = objVal();
      box.innerHTML = `<ol class="subq-list">${items.map((it, i) => {
        const v = cur[it.id];
        const lab = `<span class="subq-no">${no}.${i + 1}</span><span class="subq-label">${esc(it.label || '')}</span>`;
        let inp;
        if (it.kind === 'paragraph') inp = `<textarea rows="3" data-k="${it.id}" ${dis} placeholder="พิมพ์คำตอบ…">${esc(v ?? '')}</textarea>`;
        else if (it.kind === 'number') inp = `<input type="number" inputmode="decimal" data-k="${it.id}" ${dis} value="${esc(v ?? '')}" placeholder="ตัวเลข" />`;
        else if (it.kind === 'single') inp = `<div class="choice-list compact">${(it.options || []).map((o) => `
            <label class="choice"><input type="radio" name="${name}-${it.id}" data-k="${it.id}" value="${esc(o)}" ${v === o ? 'checked' : ''} ${dis} />
            <span class="choice-mark"></span><span>${esc(o)}</span></label>`).join('')}</div>`;
        else if (it.kind === 'dropdown') inp = `<select data-k="${it.id}" ${dis}><option value="">— เลือกคำตอบ —</option>${(it.options || []).map((o) =>
            `<option value="${esc(o)}" ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        else inp = `<input type="text" data-k="${it.id}" ${dis} value="${esc(v ?? '')}" placeholder="คำตอบ" />`;
        return `<li class="subq-item ${it.kind === 'paragraph' || it.kind === 'single' ? 'stack' : ''}"><div class="subq-q">${lab}</div><div class="subq-a">${inp}</div></li>`;
      }).join('')}</ol>`;
      $$('[data-k]', box).forEach((inp) => {
        const ev = inp.type === 'radio' || inp.tagName === 'SELECT' ? 'change' : 'input';
        inp.addEventListener(ev, () => {
          const k = inp.dataset.k;
          if (inp.type === 'radio' && !inp.checked) return;
          const v = inp.type === 'number' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
          if (v === '' ) delete cur[k]; else cur[k] = v;
          val = Object.keys(cur).length ? { ...cur } : null; fire();
        });
      });
      break;
    }
    case 'table': {
      const cols = s.cols || [], rows = s.rows || [];
      const cur = objVal();
      box.innerHTML = `<div class="ans-table-wrap"><table class="ans-table">
        ${cols.some((c) => String(c).trim()) ? `<thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>${rows.map((row, r) => `<tr>${row.map((c, ci) => {
          const k = `r${r}c${ci}`;
          if (c.t === 'input') return `<td class="cell-in"><input type="text" data-k="${k}" ${dis} value="${esc(cur[k] ?? '')}" placeholder="${esc(c.v || '')}" aria-label="แถว ${r + 1} คอลัมน์ ${ci + 1}" /></td>`;
          if (c.t === 'area') return `<td class="cell-in"><textarea rows="2" data-k="${k}" ${dis} placeholder="${esc(c.v || '')}" aria-label="แถว ${r + 1} คอลัมน์ ${ci + 1}">${esc(cur[k] ?? '')}</textarea></td>`;
          return `<td class="cell-fixed">${esc(c.v || '').replace(/\n/g, '<br>')}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>`;
      $$('[data-k]', box).forEach((inp) => inp.addEventListener('input', () => {
        const k = inp.dataset.k;
        if (inp.value.trim() === '') delete cur[k]; else cur[k] = inp.value;
        val = Object.keys(cur).length ? { ...cur } : null; fire();
      }));
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
export function renderQuestionEditor(q, index, total, { onChange, onMove, onRemove, onDuplicate, no = index + 1 }) {
  const el = h(`<article class="qe-card"></article>`);
  migrateLegacy(q);
  const build = () => {
    const t = q.answer_type;
    const intro = t === 'intro';
    el.classList.toggle('qe-intro', intro);
    el.innerHTML = `
      <header class="qe-head">
        <span class="q-no ${intro ? 'intro' : ''}">${intro ? `${icon('book')} บทนำ / ใบความรู้` : `ข้อที่ ${no}`}</span>
        <div class="qe-tools">
          <button type="button" class="icon-btn" data-act="up" ${index === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">${icon('up')}</button>
          <button type="button" class="icon-btn" data-act="down" ${index === total - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">${icon('down')}</button>
          <button type="button" class="icon-btn" data-act="dup" aria-label="คัดลอกข้อ">${icon('copy')}</button>
          <button type="button" class="icon-btn danger" data-act="del" aria-label="ลบข้อ">${icon('trash')}</button>
        </div>
      </header>
      <div class="qe-body">
        ${intro ? `<div class="field"><label>หัวข้อ (ถ้ามี)</label>
          <input type="text" data-st="title" value="${esc(q.settings?.title || '')}" placeholder="เช่น บทนำ, คำชี้แจง, อ่านบทความต่อไปนี้" /></div>` : ''}
        <div class="field">
          <label>${intro ? 'ข้อความ / คำอธิบาย / ใบความรู้' : 'คำถาม (ตัวหนังสือ)'}</label>
          <textarea rows="${intro ? 4 : 2}" data-f="question_text" placeholder="${intro ? 'พิมพ์คำอธิบาย บทความ ใบความรู้ หรือเนื้อหาที่ให้นักเรียนอ่าน/ดูก่อนทำข้อถัดไป…' : 'พิมพ์คำถาม…'}">${esc(q.question_text || '')}</textarea>
        </div>
        <div class="qe-media">${mediaEditorHtml(q)}</div>
        <div class="field">
          <label>รูปแบบ</label>
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
    } else if (t === 'subq') {
      const items = q.settings.items;
      cfg.innerHTML = `<label class="label">ข้อย่อย / ช่องคำตอบ <span class="muted">(${items.length} ช่อง)</span></label>
        <div class="subq-edit">${items.map((it, i) => `
          <div class="subq-erow">
            <span class="subq-no">${no}.${i + 1}</span>
            <input type="text" class="grow" data-si="${i}" data-sk="label" value="${esc(it.label || '')}" placeholder="คำถามย่อย หรือชื่อช่อง เช่น ชื่อ, เหตุผล, ข้อดี (เว้นว่างได้)" />
            <select data-si="${i}" data-sk="kind" aria-label="รูปแบบช่อง">${Object.entries(SUBQ_KINDS).map(([k, v]) => `<option value="${k}" ${k === it.kind ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <span class="subq-tools">
              <button type="button" class="icon-btn" data-sup="${i}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">${icon('up')}</button>
              <button type="button" class="icon-btn" data-sdown="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">${icon('down')}</button>
              <button type="button" class="icon-btn" data-srm="${i}" ${items.length <= 1 ? 'disabled' : ''} aria-label="ลบช่อง">${icon('x')}</button>
            </span>
            ${['single', 'dropdown'].includes(it.kind) ? `<input type="text" class="subq-opts" data-si="${i}" data-sk="options" value="${esc((it.options || []).join(', '))}" placeholder="ตัวเลือก คั่นด้วยจุลภาค เช่น ใช่, ไม่ใช่, ไม่แน่ใจ" />` : ''}
          </div>`).join('')}
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-sm btn-ghost" data-act="addsub">${icon('plus')} เพิ่มข้อย่อย / ช่อง</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="addsub5">${icon('plus')} เพิ่มทีละ 5 ช่อง</button>
        </div>`;
    } else if (t === 'table') {
      const st = q.settings; const nc = st.cols.length, nr = st.rows.length;
      cfg.innerHTML = `
        <div class="tbl-size">
          <div class="field"><label>จำนวนแถว</label><input type="number" min="1" max="50" data-tsize="rows" value="${nr}" /></div>
          <div class="field"><label>จำนวนคอลัมน์</label><input type="number" min="1" max="10" data-tsize="cols" value="${nc}" /></div>
          <p class="muted small grow">กำหนดหัวตาราง และเลือกว่าแต่ละช่องเป็น “ข้อความ” (ครูกำหนด) หรือ “ช่องกรอก” (นักเรียนตอบ) · ใส่ข้อความในช่องกรอกเพื่อเป็นคำใบ้ได้</p>
        </div>
        <div class="tbl-edit-wrap"><table class="tbl-edit">
          <thead><tr>${st.cols.map((c, ci) => `<th>
            <input type="text" data-tcol="${ci}" value="${esc(c)}" placeholder="หัวตาราง ${ci + 1}" />
            <select data-tcolkind="${ci}" aria-label="ตั้งทั้งคอลัมน์"><option value="">ตั้งทั้งคอลัมน์…</option>${Object.entries(CELL_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </th>`).join('')}</tr></thead>
          <tbody>${st.rows.map((row, r) => `<tr>${row.map((c, ci) => `<td class="k-${c.t}">
            <select data-tk="${r}-${ci}" aria-label="ชนิดช่อง">${Object.entries(CELL_KINDS).map(([k, v]) => `<option value="${k}" ${k === c.t ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <input type="text" data-tv="${r}-${ci}" value="${esc(c.v || '')}" placeholder="${c.t === 'text' ? 'ข้อความในช่อง' : 'คำใบ้ (ไม่บังคับ)'}" />
          </td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <div class="row-actions">
          <button type="button" class="btn btn-sm btn-ghost" data-act="addrow">${icon('plus')} เพิ่มแถว</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="addcol" ${nc >= 10 ? 'disabled' : ''}>${icon('plus')} เพิ่มคอลัมน์</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="rmrow" ${nr <= 1 ? 'disabled' : ''}>${icon('x')} ลบแถวสุดท้าย</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="rmcol" ${nc <= 1 ? 'disabled' : ''}>${icon('x')} ลบคอลัมน์สุดท้าย</button>
        </div>`;
    } else if (t === 'intro') {
      cfg.innerHTML = `<p class="muted small">ส่วนนี้แสดงให้นักเรียนอ่านก่อนทำข้อถัดไป ไม่ต้องตอบ และไม่นับเป็นข้อ · เพิ่มได้หลายส่วนในตำแหน่งใดก็ได้</p>`;
    } else {
      cfg.innerHTML = `<p class="muted small">${t === 'paragraph' ? 'นักเรียนพิมพ์คำตอบแบบหลายบรรทัด' : 'นักเรียนพิมพ์คำตอบสั้น ๆ 1 บรรทัด'}</p>`;
    }
    bind();
  };

  const bind = () => {
    bindMediaEditor($('.qe-media', el), q, { rebuild: build, onChange });
    $$('[data-f]', el).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const f = inp.dataset.f;
      if (f === 'answer_type') {
        const old = q.answer_type; q.answer_type = inp.value;
        const choice = ['single', 'multiple', 'dropdown'];
        if (choice.includes(q.answer_type) && !(choice.includes(old) && q.options.length)) q.options = ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'];
        if (!choice.includes(q.answer_type)) q.options = [];
        q.settings = { ...defaultSettings(q.answer_type), media: q.settings.media || [] };
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
    // บทนำ
    $$('[data-st]', el).forEach((inp) => inp.addEventListener('input', () => { q.settings[inp.dataset.st] = inp.value; onChange(); }));
    // ข้อย่อย
    $$('[data-si]', el).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const it = q.settings.items[Number(inp.dataset.si)]; const k = inp.dataset.sk;
      if (k === 'options') it.options = inp.value.split(',').map((x) => x.trim()).filter(Boolean);
      else it[k] = inp.value;
      if (k === 'kind') { if (['single', 'dropdown'].includes(it.kind) && !(it.options || []).length) it.options = ['ใช่', 'ไม่ใช่']; build(); }
      onChange();
    }));
    const mv = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
    $$('[data-srm]', el).forEach((b) => b.addEventListener('click', () => { q.settings.items.splice(Number(b.dataset.srm), 1); build(); onChange(); }));
    $$('[data-sup]', el).forEach((b) => b.addEventListener('click', () => { mv(q.settings.items, Number(b.dataset.sup), -1); build(); onChange(); }));
    $$('[data-sdown]', el).forEach((b) => b.addEventListener('click', () => { mv(q.settings.items, Number(b.dataset.sdown), 1); build(); onChange(); }));
    // ตาราง
    const resize = (nr, nc) => {
      const st = q.settings;
      nr = Math.max(1, Math.min(50, nr | 0)); nc = Math.max(1, Math.min(10, nc | 0));
      while (st.cols.length < nc) st.cols.push('');
      st.cols.length = nc;
      st.rows = Array.from({ length: nr }, (_, r) => Array.from({ length: nc }, (_, c) =>
        st.rows[r]?.[c] ?? { t: c === 0 && nc > 1 ? 'text' : 'input', v: c === 0 && nc > 1 ? `รายการที่ ${r + 1}` : '' }));
    };
    $$('[data-tsize]', el).forEach((inp) => inp.addEventListener('change', () => {
      const st = q.settings;
      if (inp.dataset.tsize === 'rows') resize(Number(inp.value), st.cols.length); else resize(st.rows.length, Number(inp.value));
      build(); onChange();
    }));
    $$('[data-tcol]', el).forEach((inp) => inp.addEventListener('input', () => { q.settings.cols[Number(inp.dataset.tcol)] = inp.value; onChange(); }));
    $$('[data-tcolkind]', el).forEach((sel) => sel.addEventListener('change', () => {
      if (!sel.value) return; const ci = Number(sel.dataset.tcolkind);
      q.settings.rows.forEach((row) => { if (row[ci]) row[ci].t = sel.value; }); build(); onChange();
    }));
    $$('[data-tk]', el).forEach((sel) => sel.addEventListener('change', () => {
      const [r, c] = sel.dataset.tk.split('-').map(Number); q.settings.rows[r][c].t = sel.value; build(); onChange();
    }));
    $$('[data-tv]', el).forEach((inp) => inp.addEventListener('input', () => {
      const [r, c] = inp.dataset.tv.split('-').map(Number); q.settings.rows[r][c].v = inp.value; onChange();
    }));
    $$('[data-act]', el).forEach((b) => {
      const act = b.dataset.act;
      b.addEventListener('click', () => {
        if (act === 'up') onMove(-1);
        else if (act === 'down') onMove(1);
        else if (act === 'del') onRemove();
        else if (act === 'dup') onDuplicate();
        else if (act === 'addopt') { q.options.push(`ตัวเลือกที่ ${q.options.length + 1}`); build(); onChange(); }
        else if (act === 'addleft') { q.settings.left.push(''); build(); onChange(); }
        else if (act === 'addright') { q.settings.right.push(''); build(); onChange(); }
        else if (act === 'addsub') { q.settings.items.push(newSubItem()); build(); onChange(); }
        else if (act === 'addsub5') { for (let k = 0; k < 5; k++) q.settings.items.push(newSubItem()); build(); onChange(); }
        else if (act === 'addrow') { resize(q.settings.rows.length + 1, q.settings.cols.length); build(); onChange(); }
        else if (act === 'addcol') { resize(q.settings.rows.length, q.settings.cols.length + 1); build(); onChange(); }
        else if (act === 'rmrow') { resize(q.settings.rows.length - 1, q.settings.cols.length); build(); onChange(); }
        else if (act === 'rmcol') { resize(q.settings.rows.length, q.settings.cols.length - 1); build(); onChange(); }
      });
    });
  };
  build();
  return el;
}

/** ตรวจความถูกต้องของคำถามก่อนบันทึก */
export function validateQuestions(list) {
  if (list.some((q) => (q._uploads || []).length)) return 'กำลังอัปโหลดไฟล์ กรุณารอให้เสร็จก่อนบันทึก';
  if (!list.some(isQuestion)) return 'ใบงานต้องมีข้อคำถามอย่างน้อย 1 ข้อ (นอกจากบทนำ)';
  const nos = numberQuestions(list);
  for (let i = 0; i < list.length; i++) {
    const q = list[i], n = nos[i];
    if (isIntro(q)) {
      if (!q.question_text?.trim() && !getMedia(q).length && !q.settings?.title?.trim()) return `บทนำ/ใบความรู้ (ลำดับที่ ${i + 1}): กรุณาใส่หัวข้อ ข้อความ หรือสื่อประกอบ`;
      continue;
    }
    if (!q.question_text?.trim() && !getMedia(q).length) return `ข้อที่ ${n}: กรุณาใส่คำถามหรือสื่อประกอบ`;
    if (q.answer_type === 'subq') {
      const items = q.settings.items || [];
      if (!items.length) return `ข้อที่ ${n}: ต้องมีข้อย่อยอย่างน้อย 1 ช่อง`;
      for (let k = 0; k < items.length; k++) {
        if (['single', 'dropdown'].includes(items[k].kind) && (items[k].options || []).length < 2) return `ข้อที่ ${n}.${k + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก (คั่นด้วย , )`;
      }
    }
    if (q.answer_type === 'table' && !tableInputKeys(q.settings).length) return `ข้อที่ ${n}: ตารางต้องมี “ช่องกรอก” อย่างน้อย 1 ช่อง`;
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
  const { _uploads, ...out } = q;
  const media = cleanMedia(getMedia(q).filter((m) => m.id !== 'legacy'));
  if (['single', 'multiple', 'dropdown'].includes(q.answer_type)) out.options = q.options.map((x) => x.trim()).filter(Boolean);
  if (q.answer_type === 'matching') out.settings = { left: q.settings.left.map((x) => x.trim()), right: q.settings.right.map((x) => x.trim()) };
  if (q.answer_type === 'intro') out.settings = { title: (q.settings.title || '').trim() };
  if (q.answer_type === 'subq') out.settings = { items: q.settings.items.map((it) => ({
    id: it.id || uid(), label: (it.label || '').trim(), kind: it.kind || 'short',
    options: ['single', 'dropdown'].includes(it.kind) ? [...new Set((it.options || []).map((x) => x.trim()).filter(Boolean))] : [] })) };
  if (q.answer_type === 'table') out.settings = { cols: q.settings.cols.map((c) => String(c ?? '').trim()),
    rows: q.settings.rows.map((row) => row.map((c) => ({ t: c.t, v: String(c.v ?? '').trim() }))) };
  if (q.image_data) { media.unshift(...cleanMedia([{ kind: 'image', url: q.image_data, name: 'รูปประกอบ', caption: q.image_source ? `ที่มา: ${q.image_source}` : '' }])); }
  out.image_data = null; out.image_source = null;
  out.settings = { ...(out.settings || {}), media };
  return out;
}
