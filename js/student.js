import { rpc } from './api.js';
import { $, $$, esc, h, icon, toast, withBusy, emptyState, skeleton, num, fmtDate } from './ui.js';
import { renderQuestion, isAnswered } from './questions.js';

const STATUS = {
  complete: { cls: 'st-complete', text: 'ทำครบแล้ว' },
  partial: { cls: 'st-partial', text: 'ทำยังไม่ครบ' },
  none: { cls: 'st-none', text: 'ยังไม่ทำ' },
};

// ===================================================================
//  หน้าหลักนักเรียน : รายการหน่วย -> ใบงาน
// ===================================================================
export async function renderStudentHome(main, me) {
  main.innerHTML = `
    <section class="page-head">
      <div>
        <p class="eyebrow">นักเรียน · ${esc(me.class || '')}</p>
        <h1>ใบงานของฉัน</h1>
        <p class="muted">เลือกหน่วยการเรียนรู้เพื่อดูใบงานทั้งหมดในหน่วย</p>
      </div>
      <div class="legend">
        <span><i class="dot st-complete"></i>ทำครบแล้ว</span>
        <span><i class="dot st-partial"></i>ทำยังไม่ครบ</span>
        <span><i class="dot st-none"></i>ยังไม่ทำ</span>
      </div>
    </section>
    <section id="stu-summary" class="stat-row"></section>
    <section id="stu-units">${skeleton(3)}</section>`;

  let units;
  try { units = await rpc('list_curriculum'); }
  catch (e) { $('#stu-units').innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }

  const all = units.flatMap((u) => u.worksheets);
  const c = { complete: 0, partial: 0, none: 0 };
  all.forEach((w) => c[w.status || 'none']++);
  $('#stu-summary').innerHTML = `
    <div class="stat"><span class="stat-num">${all.length}</span><span class="stat-label">ใบงานทั้งหมด</span></div>
    <div class="stat stat-green"><span class="stat-num">${c.complete}</span><span class="stat-label">ทำครบแล้ว</span></div>
    <div class="stat stat-red"><span class="stat-num">${c.partial}</span><span class="stat-label">ทำยังไม่ครบ</span></div>
    <div class="stat"><span class="stat-num">${c.none}</span><span class="stat-label">ยังไม่ทำ</span></div>`;

  if (!units.length) { $('#stu-units').innerHTML = emptyState('ยังไม่มีใบงาน', 'เมื่อผู้ดูแลระบบเพิ่มใบงาน รายการจะแสดงที่นี่', 'book'); return; }

  const open = new Set(JSON.parse(sessionStorage.getItem('stu_open') || '[]'));
  $('#stu-units').innerHTML = `<div class="unit-list">${units.map((u) => {
    const done = u.worksheets.filter((w) => w.status === 'complete').length;
    const pct = u.worksheets.length ? Math.round((done / u.worksheets.length) * 100) : 0;
    return `
    <details class="unit-card" data-unit="${u.id}" ${open.has(u.id) ? 'open' : ''}>
      <summary>
        <span class="unit-badge">หน่วยที่ ${u.unit_no}</span>
        <span class="unit-title">${esc(u.unit_name)}</span>
        <span class="unit-meta">${u.worksheets.length} ใบงาน · ทำครบ ${done}</span>
        <span class="progress" aria-label="ความคืบหน้า ${pct}%"><i style="width:${pct}%"></i></span>
        <span class="unit-chev">${icon('down')}</span>
      </summary>
      <div class="ws-list">
        ${u.worksheets.length ? u.worksheets.map((w) => {
          const st = STATUS[w.status || 'none'];
          return `<a class="ws-item ${st.cls}" href="#/student/ws/${w.id}">
            <span class="ws-no">ใบงานที่ ${w.sheet_no}</span>
            <span class="ws-name">${esc(w.sheet_name)}</span>
            <span class="ws-info">${w.question_count} ข้อ · คะแนนเต็ม ${num(w.full_score)}</span>
            <span class="ws-status">${w.score !== null && w.score !== undefined ? `ได้ ${num(w.score)}/${num(w.full_score)} คะแนน` : st.text}</span>
            ${icon('chevron', 'ws-go')}
          </a>`; }).join('') : '<p class="muted pad">ยังไม่มีใบงานในหน่วยนี้</p>'}
      </div>
    </details>`; }).join('')}</div>`;

  $$('.unit-card').forEach((d) => d.addEventListener('toggle', () => {
    const id = Number(d.dataset.unit);
    d.open ? open.add(id) : open.delete(id);
    sessionStorage.setItem('stu_open', JSON.stringify([...open]));
  }));
}

// ===================================================================
//  หน้าทำใบงาน
// ===================================================================
export async function renderStudentWorksheet(main, me, wsId) {
  main.innerHTML = skeleton(4);
  let data;
  try { data = await rpc('get_worksheet', { p_worksheet_id: Number(wsId) }); }
  catch (e) { main.innerHTML = emptyState('โหลดใบงานไม่สำเร็จ', e.message, 'x'); return; }

  const ws = data.worksheet, sub = data.submission;
  const answers = { ...(sub?.answers || {}) };
  const graded = sub && sub.score !== null && sub.score !== undefined;
  let dirty = false;

  main.innerHTML = `
    <a class="back-link" href="#/student">${icon('back')} กลับไปหน้าใบงาน</a>
    <section class="ws-hero">
      <p class="eyebrow">หน่วยที่ ${ws.unit_no} · ${esc(ws.unit_name)}</p>
      <h1>ใบงานที่ ${ws.sheet_no} ${esc(ws.sheet_name)}</h1>
      <div class="ws-hero-meta">
        <span class="chip">${icon('list')} ${ws.questions.length} ข้อ</span>
        <span class="chip chip-gold">คะแนนเต็ม ${num(ws.full_score)}</span>
        <span class="chip" id="ws-status-chip"></span>
      </div>
      ${ws.description ? `<p class="ws-desc">${esc(ws.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${graded ? `<div class="grade-banner">${icon('check')} ครูตรวจแล้ว ได้คะแนน <b>${num(sub.score)}</b> / ${num(ws.full_score)}
        ${sub.feedback ? `<p>ความคิดเห็นจากครู: ${esc(sub.feedback)}</p>` : ''}</div>` : ''}
    </section>
    <section id="q-list" class="q-list"></section>
    ${graded ? '' : `
    <div class="save-bar">
      <div class="save-progress"><span id="prog-text"></span><span class="progress"><i id="prog-bar"></i></span></div>
      <button class="btn btn-primary" id="ws-save">${icon('save')} บันทึกคำตอบ</button>
    </div>`}`;

  const list = $('#q-list');
  if (!ws.questions.length) list.innerHTML = emptyState('ใบงานนี้ยังไม่มีคำถาม', '', 'file');
  ws.questions.forEach((q) => {
    const r = renderQuestion(q, answers[q.id], {
      readonly: graded,
      onChange: (v) => { answers[q.id] = v; dirty = true; updateProgress(); },
    });
    list.appendChild(r.el);
  });

  function updateProgress() {
    const total = ws.questions.length;
    const done = ws.questions.filter((q) => isAnswered(q, answers[q.id])).length;
    const status = done === 0 ? 'none' : done >= total ? 'complete' : 'partial';
    const chip = $('#ws-status-chip');
    chip.className = 'chip ' + STATUS[status].cls;
    chip.textContent = `${STATUS[status].text} (${done}/${total})`;
    if ($('#prog-text')) {
      $('#prog-text').textContent = `ตอบแล้ว ${done} จาก ${total} ข้อ`;
      $('#prog-bar').style.width = total ? `${(done / total) * 100}%` : '0';
    }
    return { done, total, status };
  }
  updateProgress();

  const saveBtn = $('#ws-save');
  if (saveBtn) saveBtn.addEventListener('click', () => withBusy(saveBtn, async () => {
    const clean = {};
    ws.questions.forEach((q) => { if (isAnswered(q, answers[q.id])) clean[q.id] = answers[q.id]; });
    try {
      const r = await rpc('student_save_answers', { p_worksheet_id: ws.id, p_answers: clean });
      dirty = false;
      if (r.status === 'complete') toast('บันทึกและส่งใบงานเรียบร้อย (ทำครบทุกข้อ)', 'success');
      else toast(`บันทึกแล้ว ยังเหลืออีก ${r.total_questions - r.answered_count} ข้อ`, 'warn');
    } catch (e) { toast(e.message, 'error'); }
  }));

  const guard = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', guard);
  const onHash = () => { window.removeEventListener('beforeunload', guard); window.removeEventListener('hashchange', onHash); };
  window.addEventListener('hashchange', onHash);
}
