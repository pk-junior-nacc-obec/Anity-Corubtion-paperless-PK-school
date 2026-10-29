import { rpc, session } from './api.js';
import {
  $, $$, esc, h, icon, toast, modal, confirmBox, withBusy, emptyState, skeleton, num,
  fmtTel, bindTelMask, telDigits, pwStrong, loadScript,
} from './ui.js';
import { renderQuestionEditor, defaultQuestion, validateQuestions, cleanQuestion } from './questions.js';
import { renderClassReport } from './teacher.js';

const XLSX_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

const TABS = [
  { id: 'sheets', label: 'จัดการใบงาน', ic: 'book' },
  { id: 'users', label: 'บัญชีผู้ใช้', ic: 'users' },
  { id: 'data', label: 'รายชื่อนักเรียน', ic: 'list' },
  { id: 'report', label: 'ผลงานนักเรียน', ic: 'grid' },
];

export async function renderAdmin(main, me, sub = 'sheets', arg = null) {
  if (sub === 'edit') return renderEditor(main, arg);
  main.innerHTML = `
    <nav class="tabs" aria-label="เมนูผู้ดูแลระบบ">
      ${TABS.map((t) => `<a href="#/admin/${t.id}" class="tab ${t.id === sub ? 'active' : ''}">${icon(t.ic)}<span>${t.label}</span></a>`).join('')}
    </nav>
    <div id="admin-body"></div>`;
  const body = $('#admin-body');
  if (sub === 'users') return renderUsers(body, arg || 'student');
  if (sub === 'data') return renderData(body);
  if (sub === 'report') return renderClassReport(body, me, { title: 'ผลงานนักเรียนรายห้อง', eyebrow: 'Admin' });
  return renderSheets(body);
}

// ===================================================================
//  จัดการหน่วยการเรียนรู้ + ใบงาน
// ===================================================================
async function renderSheets(body) {
  body.innerHTML = `
    <section class="page-head">
      <div><p class="eyebrow">Admin</p><h1>หน่วยการเรียนรู้และใบงาน</h1>
      <p class="muted">เพิ่ม แก้ไข และจัดทำใบงานแบบฝึกหัดในแต่ละหน่วย</p></div>
      <div class="head-actions"><button class="btn btn-primary" id="add-unit">${icon('plus')} เพิ่มหน่วยการเรียนรู้</button></div>
    </section>
    <section id="units">${skeleton(3)}</section>`;
  $('#add-unit').addEventListener('click', () => unitModal(null, () => renderSheets(body)));

  let units;
  try { units = await rpc('list_curriculum'); }
  catch (e) { $('#units').innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }
  if (!units.length) { $('#units').innerHTML = emptyState('ยังไม่มีหน่วยการเรียนรู้', 'กด “เพิ่มหน่วยการเรียนรู้” เพื่อเริ่มต้น', 'book'); return; }

  $('#units').innerHTML = `<div class="unit-list">${units.map((u) => `
    <details class="unit-card" open>
      <summary>
        <span class="unit-badge">หน่วยที่ ${u.unit_no}</span>
        <span class="unit-title">${esc(u.unit_name)}</span>
        <span class="unit-meta">${u.worksheets.length} ใบงาน</span>
        <span class="unit-actions">
          <button class="btn btn-sm btn-ghost" data-edit-unit="${u.id}">${icon('edit')} แก้ไข</button>
          <button class="btn btn-sm btn-ghost danger" data-del-unit="${u.id}">${icon('trash')} ลบ</button>
        </span>
        <span class="unit-chev">${icon('down')}</span>
      </summary>
      <div class="ws-list">
        ${u.worksheets.map((w) => `
          <div class="ws-item ws-admin">
            <span class="ws-no">ใบงานที่ ${w.sheet_no}</span>
            <span class="ws-name">${esc(w.sheet_name)}</span>
            <span class="ws-info">${w.question_count} ข้อ · คะแนนเต็ม ${num(w.full_score)}</span>
            <span class="ws-classes">${classBadges(w.classes)}</span>
            <span class="ws-actions">
              <a class="btn btn-sm btn-outline" href="#/admin/edit/${w.id}">${icon('edit')} แก้ไข</a>
              <button class="btn btn-sm btn-ghost danger" data-del-ws="${w.id}" data-name="${esc(w.sheet_name)}">${icon('trash')}</button>
            </span>
          </div>`).join('')}
        <a class="ws-add" href="#/admin/edit/new?unit=${u.id}">${icon('plus')} เพิ่มใบงานในหน่วยนี้</a>
      </div>
    </details>`).join('')}</div>`;

  $$('[data-edit-unit]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    unitModal(units.find((u) => u.id === Number(b.dataset.editUnit)), () => renderSheets(body));
  }));
  $$('[data-del-unit]').forEach((b) => b.addEventListener('click', async (e) => {
    e.preventDefault();
    const u = units.find((x) => x.id === Number(b.dataset.delUnit));
    if (!await confirmBox(`ลบ “หน่วยที่ ${u.unit_no} ${u.unit_name}” และใบงานทั้งหมดในหน่วย (รวมคำตอบของนักเรียน)?`, { okText: 'ลบ', danger: true })) return;
    try { await rpc('admin_delete_unit', { p_id: u.id }); toast('ลบหน่วยแล้ว', 'success'); renderSheets(body); }
    catch (ex) { toast(ex.message, 'error'); }
  }));
  $$('[data-del-ws]').forEach((b) => b.addEventListener('click', async () => {
    if (!await confirmBox(`ลบใบงาน “${b.dataset.name}” และคำตอบของนักเรียนทั้งหมด?`, { okText: 'ลบ', danger: true })) return;
    try { await rpc('admin_delete_worksheet', { p_id: Number(b.dataset.delWs) }); toast('ลบใบงานแล้ว', 'success'); renderSheets(body); }
    catch (ex) { toast(ex.message, 'error'); }
  }));
}

function unitModal(unit, onSaved) {
  const m = modal({
    title: unit ? 'แก้ไขหน่วยการเรียนรู้' : 'เพิ่มหน่วยการเรียนรู้',
    body: `
      <div class="field"><label for="u-no">1. หน่วยการเรียนรู้ที่</label><input id="u-no" type="number" min="1" value="${unit?.unit_no ?? ''}" placeholder="เช่น 1" /></div>
      <div class="field"><label for="u-name">2. ชื่อหน่วยการเรียนรู้</label><input id="u-name" value="${esc(unit?.unit_name ?? '')}" placeholder="ชื่อหน่วย" /></div>`,
    actions: [
      { label: 'ยกเลิก' },
      { label: 'บันทึก', kind: 'btn-primary', onClick: ({ close, btn }) => withBusy(btn, async () => {
        const no = Number($('#u-no').value), name = $('#u-name').value.trim();
        if (!no || !name) return toast('กรุณากรอกข้อมูลให้ครบ', 'error');
        try {
          const id = await rpc('admin_save_unit', { p_id: unit?.id ?? null, p_unit_no: no, p_unit_name: name });
          toast('บันทึกหน่วยแล้ว', 'success'); close(); onSaved(id);
        } catch (e) { toast(e.message, 'error'); }
      }) },
    ],
  });
  setTimeout(() => $('#u-no', m.el)?.focus(), 50);
}

// ===================================================================
//  ตัวแก้ไขใบงาน
// ===================================================================
const classLevel = (c) => String(c).split('/')[0].trim() || c;
const sortClasses = (arr) => [...new Set(arr.map((c) => String(c).trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));

function classBadges(classes) {
  const list = sortClasses(classes || []);
  if (!list.length) return '<span class="cls-badge all">ทุกห้อง</span>';
  return list.map((c) => `<span class="cls-badge">${esc(c)}</span>`).join('');
}

/** ตัวเลือกระดับชั้น/ห้อง แบบหลายรายการ (จัดกลุ่มตามระดับชั้น) */
function classPicker(host, allClasses, selected, onChange) {
  const sel = new Set(sortClasses(selected));
  let pool = sortClasses([...allClasses, ...sel]);
  const draw = () => {
    const groups = {};
    pool.forEach((c) => (groups[classLevel(c)] ||= []).push(c));
    host.innerHTML = `
      <div class="cls-toolbar">
        <span class="muted" id="cls-count">เลือกแล้ว ${sel.size} ห้อง</span>
        <span class="grow"></span>
        <button type="button" class="btn btn-sm btn-ghost" data-cls-all>${icon('check')} เลือกทั้งหมด</button>
        <button type="button" class="btn btn-sm btn-ghost" data-cls-none>${icon('x')} ล้าง</button>
      </div>
      ${pool.length ? Object.entries(groups).map(([lv, cs]) => `
        <div class="cls-group">
          <div class="cls-group-head"><strong>${esc(lv)}</strong>
            <button type="button" class="link-btn" data-cls-level="${esc(lv)}">${cs.every((c) => sel.has(c)) ? 'ยกเลิกทั้งระดับ' : 'เลือกทั้งระดับ'}</button></div>
          <div class="cls-chips">${cs.map((c) => `
            <label class="cls-chip ${sel.has(c) ? 'on' : ''}"><input type="checkbox" value="${esc(c)}" ${sel.has(c) ? 'checked' : ''} />${esc(c)}</label>`).join('')}
          </div>
        </div>`).join('') : '<p class="muted">ยังไม่มีข้อมูลห้องเรียน — นำเข้าข้อมูลนักเรียนก่อน หรือพิมพ์เพิ่มด้านล่าง</p>'}
      <div class="input-row cls-add">
        <input id="cls-new" class="grow" placeholder="เพิ่มห้องที่ไม่มีในรายการ เช่น ม.2/3" />
        <button type="button" class="btn btn-outline btn-sm" id="cls-add-btn">${icon('plus')} เพิ่ม</button>
      </div>`;
  };
  const changed = () => { draw(); onChange([...sel]); };
  host.addEventListener('change', (e) => {
    const cb = e.target.closest('.cls-chip input'); if (!cb) return;
    cb.checked ? sel.add(cb.value) : sel.delete(cb.value); changed();
  });
  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-cls-all]')) { pool.forEach((c) => sel.add(c)); changed(); }
    else if (e.target.closest('[data-cls-none]')) { sel.clear(); changed(); }
    else if (e.target.closest('[data-cls-level]')) {
      const lv = e.target.closest('[data-cls-level]').dataset.clsLevel;
      const cs = pool.filter((c) => classLevel(c) === lv);
      const all = cs.every((c) => sel.has(c));
      cs.forEach((c) => (all ? sel.delete(c) : sel.add(c))); changed();
    } else if (e.target.closest('#cls-add-btn')) addNew();
  });
  host.addEventListener('keydown', (e) => { if (e.target.id === 'cls-new' && e.key === 'Enter') { e.preventDefault(); addNew(); } });
  function addNew() {
    const v = $('#cls-new', host).value.trim(); if (!v) return;
    pool = sortClasses([...pool, v]); sel.add(v); changed();
  }
  draw();
  return { get: () => sortClasses([...sel]) };
}

async function renderEditor(main, arg) {
  main.innerHTML = skeleton(4);
  const [idPart, query] = String(arg || 'new').split('?');
  const presetUnit = new URLSearchParams(query || '').get('unit');
  let units, ws, allClasses = [];
  try {
    [units, allClasses] = await Promise.all([rpc('list_curriculum'), rpc('list_classes').catch(() => [])]);
    if (idPart !== 'new') ws = (await rpc('get_worksheet', { p_worksheet_id: Number(idPart) })).worksheet;
  } catch (e) { main.innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }

  const unitOf = (id) => units.find((u) => u.id === Number(id));
  const state = ws ? {
    id: ws.id, unit_id: ws.unit_id, sheet_no: ws.sheet_no, sheet_name: ws.sheet_name,
    full_score: ws.full_score, description: ws.description || '', classes: ws.classes || [],
    questions: ws.questions.map((q) => ({ ...q, options: [...(q.options || [])], settings: JSON.parse(JSON.stringify(q.settings || {})) })),
  } : {
    id: null, unit_id: presetUnit ? Number(presetUnit) : units[0]?.id ?? null,
    sheet_no: ((unitOf(presetUnit || units[0]?.id)?.worksheets || []).reduce((m, w) => Math.max(m, w.sheet_no), 0) + 1),
    sheet_name: '', full_score: 10, description: '', classes: [], questions: [defaultQuestion('short')],
  };
  if (state.questions.length && state.questions.some((q) => q.answer_type === 'matching')) {
    state.questions.forEach((q) => { if (q.answer_type === 'matching') { q.settings.left ||= []; q.settings.right ||= []; } });
  }
  let dirty = false;

  main.innerHTML = `
    <a class="back-link" href="#/admin/sheets">${icon('back')} กลับไปหน้าจัดการใบงาน</a>
    <section class="page-head">
      <div><p class="eyebrow">Admin · ${ws ? 'แก้ไขใบงาน' : 'สร้างใบงานใหม่'}</p>
      <h1>${ws ? esc(`ใบงานที่ ${ws.sheet_no} ${ws.sheet_name}`) : 'ใบงานใหม่'}</h1></div>
    </section>
    <section class="panel">
      <div class="grid-2">
        <div class="field">
          <label for="e-unit">1-2. หน่วยการเรียนรู้</label>
          <div class="input-row">
            <select id="e-unit" class="grow">${units.length ? units.map((u) => `<option value="${u.id}" ${u.id === Number(state.unit_id) ? 'selected' : ''}>หน่วยที่ ${u.unit_no} ${esc(u.unit_name)}</option>`).join('') : '<option value="">— ยังไม่มีหน่วย —</option>'}</select>
            <button type="button" class="btn btn-outline" id="e-new-unit">${icon('plus')} หน่วยใหม่</button>
          </div>
        </div>
        <div class="grid-2 tight">
          <div class="field"><label for="e-no">3. ใบงานที่</label><input id="e-no" type="number" min="1" value="${state.sheet_no}" /></div>
          <div class="field"><label for="e-full">5. คะแนนเต็มของใบงาน</label><input id="e-full" type="number" min="0" step="0.5" value="${state.full_score}" /></div>
        </div>
      </div>
      <div class="field"><label for="e-name">4. ชื่อใบงาน</label><input id="e-name" value="${esc(state.sheet_name)}" placeholder="ชื่อใบงาน" /></div>
      <div class="field"><label for="e-desc">คำชี้แจง (ไม่บังคับ)</label><textarea id="e-desc" rows="2" placeholder="คำชี้แจงสำหรับนักเรียน">${esc(state.description)}</textarea></div>
    </section>
    <section class="panel">
      <div class="panel-sub">
        <h3>ระดับชั้น / ห้องที่ทำใบงานนี้ได้ <span class="req">*</span></h3>
        <p class="muted">ใบงานจะแสดงในหน้านักเรียนเฉพาะห้องที่เลือก เลือกได้หลายห้อง${ws && !(ws.classes || []).length ? ' · <span class="warn-text">ใบงานนี้ยังไม่ได้กำหนดห้อง (ปัจจุบันแสดงทุกห้อง)</span>' : ''}</p>
      </div>
      <div id="e-classes"></div>
    </section>
    <section class="panel-title"><h2>6. รายละเอียดใบงาน</h2><span class="muted" id="q-count"></span></section>
    <section id="qe-list" class="qe-list"></section>
    <div class="add-q">
      <label for="add-type" class="muted">เพิ่มข้อใหม่แบบ</label>
      <select id="add-type">
        <option value="paragraph">ตอบแบบย่อหน้า</option><option value="short" selected>ตอบแบบสั้น ๆ</option>
        <option value="single">ตัวเลือกเดียว</option><option value="multiple">หลายตัวเลือก</option>
        <option value="dropdown">เลื่อนลง (ดรอปดาวน์)</option><option value="matching">แบบโยงคำตอบ</option>
        <option value="scale">สเกลเชิงเส้น</option><option value="stars">คะแนนแบบดาว</option>
      </select>
      <button class="btn btn-gold" id="add-q">${icon('plus')} เพิ่มข้อ</button>
    </div>
    <div class="save-bar">
      <div class="save-progress"><span id="dirty-text" class="muted">ยังไม่มีการเปลี่ยนแปลง</span></div>
      <button class="btn btn-primary" id="e-save">${icon('save')} บันทึกใบงาน</button>
    </div>`;

  const mark = () => { dirty = true; $('#dirty-text').textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; $('#dirty-text').className = 'warn-text'; };
  const list = $('#qe-list');
  const draw = () => {
    list.innerHTML = '';
    $('#q-count').textContent = `${state.questions.length} ข้อ`;
    state.questions.forEach((q, i) => list.appendChild(renderQuestionEditor(q, i, state.questions.length, {
      onChange: mark,
      onMove: (d) => { const j = i + d; [state.questions[i], state.questions[j]] = [state.questions[j], state.questions[i]]; mark(); draw(); },
      onRemove: async () => {
        if (!await confirmBox(`ลบข้อที่ ${i + 1}? (คำตอบของนักเรียนในข้อนี้จะหายไปเมื่อบันทึก)`, { okText: 'ลบ', danger: true })) return;
        state.questions.splice(i, 1); mark(); draw();
      },
      onDuplicate: () => { const c = JSON.parse(JSON.stringify(q)); c.id = null; state.questions.splice(i + 1, 0, c); mark(); draw(); },
    })));
    if (!state.questions.length) list.innerHTML = emptyState('ยังไม่มีข้อคำถาม', 'เลือกรูปแบบคำตอบด้านล่าง แล้วกด “เพิ่มข้อ”', 'list');
  };
  draw();
  const picker = classPicker($('#e-classes'), allClasses, state.classes, (v) => { state.classes = v; mark(); });

  ['e-unit', 'e-no', 'e-full', 'e-name', 'e-desc'].forEach((id) => $('#' + id).addEventListener('input', mark));
  $('#add-q').addEventListener('click', () => {
    state.questions.push(defaultQuestion($('#add-type').value)); mark(); draw();
    list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#e-new-unit').addEventListener('click', () => unitModal(null, async (id) => {
    units = await rpc('list_curriculum');
    $('#e-unit').innerHTML = units.map((u) => `<option value="${u.id}" ${u.id === id ? 'selected' : ''}>หน่วยที่ ${u.unit_no} ${esc(u.unit_name)}</option>`).join('');
    mark();
  }));

  $('#e-save').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const payload = {
      id: state.id, unit_id: Number($('#e-unit').value) || null, sheet_no: Number($('#e-no').value) || null,
      sheet_name: $('#e-name').value.trim(), full_score: Number($('#e-full').value), description: $('#e-desc').value.trim() || null,
      classes: picker.get(), questions: state.questions.map(cleanQuestion),
    };
    if (!payload.unit_id) return toast('กรุณาเลือกหรือสร้างหน่วยการเรียนรู้', 'error');
    if (!payload.sheet_no) return toast('กรุณากรอก “ใบงานที่”', 'error');
    if (!payload.sheet_name) return toast('กรุณากรอกชื่อใบงาน', 'error');
    if (!(payload.full_score >= 0)) return toast('คะแนนเต็มไม่ถูกต้อง', 'error');
    if (!payload.classes.length) { $('#e-classes').scrollIntoView({ behavior: 'smooth', block: 'center' }); return toast('กรุณาเลือกระดับชั้น/ห้องอย่างน้อย 1 ห้อง', 'error'); }
    const err = validateQuestions(state.questions);
    if (err) return toast(err, 'error', 5000);
    try {
      const id = await rpc('admin_save_worksheet', { p_ws: payload });
      dirty = false;
      toast('บันทึกใบงานแล้ว', 'success');
      if (!state.id) { location.hash = `#/admin/edit/${id}`; return; }
      renderEditor(main, String(id));
    } catch (ex) { toast(ex.message, 'error'); }
  }));

  const guard = (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } };
  window.addEventListener('beforeunload', guard);
  const off = () => { window.removeEventListener('beforeunload', guard); window.removeEventListener('hashchange', off); };
  window.addEventListener('hashchange', off);
}

// ===================================================================
//  บัญชีผู้ใช้ (นักเรียน / ครู / Admin)
// ===================================================================
const KINDS = {
  student: { label: 'นักเรียน', user: 'ID' },
  teacher: { label: 'ครู', user: 'username' },
  admin: { label: 'ผู้ดูแลระบบ', user: 'username' },
};

async function renderUsers(body, kind) {
  if (!KINDS[kind]) kind = 'student';
  body.innerHTML = `
    <section class="page-head">
      <div><p class="eyebrow">Admin</p><h1>บัญชีผู้ใช้งาน</h1>
      <p class="muted">แก้ไข Username, Password และชื่อ - สกุลที่ใช้เข้าสู่ระบบ</p></div>
      <div class="head-actions">
        ${kind !== 'student' ? `<button class="btn btn-primary" id="add-user">${icon('plus')} เพิ่ม${KINDS[kind].label}</button>` : ''}
      </div>
    </section>
    <div class="subtabs">
      ${Object.entries(KINDS).map(([k, v]) => `<a href="#/admin/users/${k}" class="subtab ${k === kind ? 'active' : ''}">${v.label}</a>`).join('')}
      <div class="search grow"><span class="input-ic">${icon('search')}</span><input id="u-search" placeholder="ค้นหาชื่อ / username / ระดับชั้น" /></div>
    </div>
    <section id="u-table">${skeleton(4)}</section>`;

  let rows;
  try { rows = await rpc('admin_list_users', { p_kind: kind }); }
  catch (e) { $('#u-table').innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }
  const reload = () => renderUsers(body, kind);
  $('#add-user')?.addEventListener('click', () => userModal(kind, null, reload));

  const draw = (q = '') => {
    const f = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
    if (!f.length) { $('#u-table').innerHTML = emptyState(rows.length ? 'ไม่พบข้อมูลที่ค้นหา' : `ยังไม่มีบัญชี${KINDS[kind].label}`,
      kind === 'student' && !rows.length ? 'นักเรียนจะปรากฏที่นี่เมื่อลงทะเบียนผ่านหน้าเข้าสู่ระบบ' : '', 'users'); return; }
    const cols = kind === 'student'
      ? [['เลขที่', (r) => r.no ?? ''], ['รหัสนักเรียน (Username)', (r) => `<span class="mono">${esc(r.ID)}</span>`], ['ชื่อ - สกุล', (r) => esc(r.name)], ['ระดับชั้น', (r) => esc(r.class)], ['เบอร์โทร', (r) => esc(fmtTel(r.tel))]]
      : kind === 'teacher'
        ? [['Username', (r) => `<span class="mono">${esc(r.username)}</span>`], ['ชื่อ - สกุล', (r) => esc(r.name)], ['ระดับชั้นที่รับผิดชอบ', (r) => esc(r.class)], ['เบอร์โทร', (r) => esc(fmtTel(r.tel))]]
        : [['Username', (r) => `<span class="mono">${esc(r.username)}</span>`], ['ชื่อ - สกุล', (r) => esc(r.name)], ['Position', (r) => esc(r.position)]];
    $('#u-table').innerHTML = `
      <div class="table-scroll"><table class="data-table">
        <thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}<th class="t-right">จัดการ</th></tr></thead>
        <tbody>${f.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}
          <td class="t-right nowrap">
            <button class="btn btn-sm btn-outline" data-edit="${r.id}">${icon('edit')} แก้ไข</button>
            <button class="btn btn-sm btn-ghost danger" data-del="${r.id}" aria-label="ลบ">${icon('trash')}</button>
          </td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">ทั้งหมด ${f.length} รายการ</p>`;
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => userModal(kind, rows.find((r) => r.id === Number(b.dataset.edit)), reload)));
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const r = rows.find((x) => x.id === Number(b.dataset.del));
      if (!await confirmBox(`ลบบัญชี “${r.name}”?${kind === 'student' ? ' (นักเรียนจะต้องลงทะเบียนใหม่ แต่คำตอบใบงานยังอยู่)' : ''}`, { okText: 'ลบ', danger: true })) return;
      try { await rpc('admin_delete_user', { p_kind: kind, p_id: r.id }); toast('ลบบัญชีแล้ว', 'success'); reload(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  };
  draw();
  $('#u-search').addEventListener('input', (e) => draw(e.target.value));
}

function userModal(kind, row, onSaved) {
  const isNew = !row;
  const pwHelp = 'อย่างน้อย 8 ตัว มีตัวเลข ตัวอักษร และอักขระพิเศษ';
  let fields = '';
  if (kind === 'student') {
    fields = `
      <div class="field"><label for="m-user">Username (รหัสนักเรียน 5 หลัก)</label><input id="m-user" inputmode="numeric" maxlength="5" value="${esc(row.ID)}" /></div>
      <div class="field"><label for="m-name">ชื่อ - สกุล</label><input id="m-name" value="${esc(row.name)}" /></div>
      <div class="field"><label for="m-tel">เบอร์โทร</label><input id="m-tel" inputmode="tel" value="${esc(fmtTel(row.tel))}" /></div>`;
  } else {
    fields = `
      <div class="field"><label for="m-user">Username</label><input id="m-user" value="${esc(row?.username ?? '')}" autocomplete="off" /></div>
      <div class="field"><label for="m-name">ชื่อ - สกุล</label><input id="m-name" value="${esc(row?.name ?? '')}" /></div>
      ${kind === 'teacher' ? `
      <div class="field"><label for="m-class">ระดับชั้นที่รับผิดชอบ</label><input id="m-class" value="${esc(row?.class ?? '')}" placeholder="เช่น ม.1/1 หรือ ม.1/1,ม.1/2" />
        <small class="hint">หลายห้องให้คั่นด้วยเครื่องหมายจุลภาค ( , )</small></div>
      <div class="field"><label for="m-tel">เบอร์โทร</label><input id="m-tel" inputmode="tel" value="${esc(fmtTel(row?.tel ?? ''))}" /></div>` : ''}`;
  }
  const m = modal({
    title: `${isNew ? 'เพิ่ม' : 'แก้ไข'}บัญชี${KINDS[kind].label}`,
    body: `${fields}
      <div class="field"><label for="m-pw">Password ${isNew ? '' : '<span class="muted">(เว้นว่างหากไม่ต้องการเปลี่ยน)</span>'}</label>
        <input id="m-pw" type="text" autocomplete="new-password" placeholder="${pwHelp}" /><small class="hint">${pwHelp}</small></div>`,
    actions: [
      { label: 'ยกเลิก' },
      { label: 'บันทึก', kind: 'btn-primary', onClick: ({ close, btn }) => withBusy(btn, async () => {
        const pw = $('#m-pw', m.el).value;
        if ((isNew || pw) && !pwStrong(pw)) return toast(`รหัสผ่าน: ${pwHelp}`, 'error');
        const p = { id: row?.id ?? null, name: $('#m-name', m.el).value.trim(), password: pw };
        if (kind === 'student') { p.ID = $('#m-user', m.el).value.trim(); p.tel = telDigits($('#m-tel', m.el).value); }
        else { p.username = $('#m-user', m.el).value.trim(); }
        if (kind === 'teacher') { p.class = $('#m-class', m.el).value.trim(); p.tel = telDigits($('#m-tel', m.el).value); }
        try {
          await rpc('admin_save_user', { p_kind: kind, p });
          toast('บันทึกแล้ว', 'success'); close();
          if (kind === 'admin' && row && row.username === session.get()?.username && p.username !== row.username) {
            toast('เปลี่ยน Username ของตนเองแล้ว ครั้งถัดไปให้เข้าสู่ระบบด้วยชื่อใหม่', 'info', 5000);
          }
          onSaved();
        } catch (e) { toast(e.message, 'error'); }
      }) },
    ],
  });
  const tel = $('#m-tel', m.el); if (tel) bindTelMask(tel);
}

// ===================================================================
//  รายชื่อนักเรียนต้นฉบับ (ตาราง data)
// ===================================================================
async function renderData(body) {
  body.innerHTML = `
    <section class="page-head">
      <div><p class="eyebrow">Admin</p><h1>รายชื่อนักเรียน (ตาราง data)</h1>
      <p class="muted">ข้อมูลนี้ใช้ดึง เลขที่ ชื่อ - สกุล และระดับชั้นตอนนักเรียนลงทะเบียน</p></div>
      <div class="head-actions">
        <label class="btn btn-outline upload-btn">${icon('upload')} นำเข้า Excel / CSV<input type="file" id="d-file" accept=".xlsx,.xls,.csv" hidden /></label>
        <button class="btn btn-primary" id="d-add">${icon('plus')} เพิ่มนักเรียน</button>
      </div>
    </section>
    <p class="muted small">ไฟล์นำเข้าต้องมีหัวคอลัมน์ <code>ID</code>, <code>no</code>, <code>name</code>, <code>class</code> (หรือ รหัสนักเรียน, เลขที่, ชื่อ-สกุล, ระดับชั้น) — รหัสซ้ำจะถูกอัปเดต</p>
    <div class="subtabs"><div class="search grow"><span class="input-ic">${icon('search')}</span><input id="d-search" placeholder="ค้นหารหัส / ชื่อ / ระดับชั้น" /></div></div>
    <section id="d-table">${skeleton(4)}</section>`;

  const reload = () => renderData(body);
  let rows;
  try { rows = await rpc('admin_list_users', { p_kind: 'data' }); }
  catch (e) { $('#d-table').innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }

  $('#d-add').addEventListener('click', () => dataModal(null, reload));
  $('#d-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      await loadScript(XLSX_CDN);
      const wb = window.XLSX.read(await f.arrayBuffer());
      const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      const pick = (r, keys) => { for (const k of Object.keys(r)) if (keys.includes(k.trim().toLowerCase())) return String(r[k]).trim(); return ''; };
      const list = raw.map((r) => ({
        ID: pick(r, ['id', 'รหัสนักเรียน', 'รหัส']).padStart(5, '0'),
        no: pick(r, ['no', 'เลขที่']),
        name: pick(r, ['name', 'ชื่อ-สกุล', 'ชื่อ - สกุล', 'ชื่อ']),
        class: pick(r, ['class', 'ระดับชั้น', 'ชั้น', 'ห้อง']),
      })).filter((r) => /^\d{5}$/.test(r.ID) && r.name);
      if (!list.length) return toast('ไม่พบข้อมูลที่ถูกต้องในไฟล์', 'error');
      if (!await confirmBox(`นำเข้ารายชื่อนักเรียน ${list.length} คน?`)) return;
      const n = await rpc('admin_import_data', { p_rows: list });
      toast(`นำเข้าแล้ว ${n} รายการ`, 'success'); reload();
    } catch (ex) { toast(ex.message, 'error'); }
    e.target.value = '';
  });

  const draw = (q = '') => {
    const f = rows.filter((r) => `${r.ID} ${r.name} ${r.class}`.toLowerCase().includes(q.toLowerCase()));
    if (!f.length) { $('#d-table').innerHTML = emptyState(rows.length ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีรายชื่อนักเรียน', 'เพิ่มทีละคนหรือนำเข้าจากไฟล์ Excel', 'users'); return; }
    $('#d-table').innerHTML = `
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th>ระดับชั้น</th><th>เลขที่</th><th>รหัสนักเรียน</th><th>ชื่อ - สกุล</th><th>สถานะ</th><th class="t-right">จัดการ</th></tr></thead>
        <tbody>${f.map((r) => `<tr>
          <td>${esc(r.class)}</td><td>${r.no ?? ''}</td><td class="mono">${esc(r.ID)}</td><td>${esc(r.name)}</td>
          <td>${r.registered ? '<span class="pill pill-green">ลงทะเบียนแล้ว</span>' : '<span class="pill">ยังไม่ลงทะเบียน</span>'}</td>
          <td class="t-right nowrap"><button class="btn btn-sm btn-outline" data-edit="${r.id}">${icon('edit')} แก้ไข</button>
          <button class="btn btn-sm btn-ghost danger" data-del="${r.id}" aria-label="ลบ">${icon('trash')}</button></td></tr>`).join('')}</tbody>
      </table></div><p class="muted small">ทั้งหมด ${f.length} คน</p>`;
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => dataModal(rows.find((r) => r.id === Number(b.dataset.edit)), reload)));
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const r = rows.find((x) => x.id === Number(b.dataset.del));
      if (!await confirmBox(`ลบ “${r.name}” ออกจากรายชื่อ?`, { okText: 'ลบ', danger: true })) return;
      try { await rpc('admin_delete_user', { p_kind: 'data', p_id: r.id }); toast('ลบแล้ว', 'success'); reload(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  };
  draw();
  $('#d-search').addEventListener('input', (e) => draw(e.target.value));
}

function dataModal(row, onSaved) {
  const m = modal({
    title: row ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน',
    body: `
      <div class="grid-2 tight">
        <div class="field"><label for="dd-id">รหัสนักเรียน (5 หลัก)</label><input id="dd-id" inputmode="numeric" maxlength="5" value="${esc(row?.ID ?? '')}" /></div>
        <div class="field"><label for="dd-no">เลขที่</label><input id="dd-no" type="number" min="1" value="${row?.no ?? ''}" /></div>
      </div>
      <div class="field"><label for="dd-name">ชื่อ - สกุล</label><input id="dd-name" value="${esc(row?.name ?? '')}" /></div>
      <div class="field"><label for="dd-class">ระดับชั้น</label><input id="dd-class" value="${esc(row?.class ?? '')}" placeholder="เช่น ม.1/1" /></div>`,
    actions: [
      { label: 'ยกเลิก' },
      { label: 'บันทึก', kind: 'btn-primary', onClick: ({ close, btn }) => withBusy(btn, async () => {
        const p = { id: row?.id ?? null, ID: $('#dd-id', m.el).value.trim(), no: $('#dd-no', m.el).value, name: $('#dd-name', m.el).value.trim(), class: $('#dd-class', m.el).value.trim() };
        if (!/^\d{5}$/.test(p.ID)) return toast('รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก', 'error');
        if (!p.name || !p.class) return toast('กรุณากรอกชื่อและระดับชั้น', 'error');
        try { await rpc('admin_save_user', { p_kind: 'data', p }); toast('บันทึกแล้ว', 'success'); close(); onSaved(); }
        catch (e) { toast(e.message, 'error'); }
      }) },
    ],
  });
}
