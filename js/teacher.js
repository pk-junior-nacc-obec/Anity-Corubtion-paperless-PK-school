import { CONFIG } from './config.js';
import { rpc } from './api.js';
import { $, $$, esc, h, icon, toast, modal, withBusy, emptyState, skeleton, num, fmtDate, loadScript } from './ui.js';
import { renderQuestion } from './questions.js';

const XLSX_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

// ===================================================================
//  ตารางคะแนนรายห้อง (ครู + Admin ใช้ร่วมกัน)
// ===================================================================
export async function renderClassReport(main, me, { title = 'ตารางติดตามใบงาน', eyebrow = 'ครู' } = {}) {
  main.innerHTML = `
    <section class="page-head">
      <div>
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1>${esc(title)}</h1>
        <p class="muted">กดที่ช่องของนักเรียนเพื่อดูการทำใบงานและให้คะแนน</p>
      </div>
      <div class="head-actions">
        <div class="field inline"><label for="cls-select">ระดับชั้น</label><select id="cls-select"></select></div>
        <button class="btn btn-outline" id="rf-btn" title="โหลดข้อมูลล่าสุด">${icon('refresh')} รีเฟรช</button>
        <button class="btn btn-outline" id="exp-xlsx">${icon('download')} Excel</button>
        <button class="btn btn-outline" id="exp-pdf">${icon('file')} PDF</button>
      </div>
    </section>
    <div class="legend legend-wide">
      <span><i class="cell-demo c-done">${icon('check')}</i>ส่งแล้ว (รอตรวจ)</span>
      <span><i class="cell-demo c-score">8</i>ตรวจแล้ว (คะแนน)</span>
      <span><i class="cell-demo c-partial"></i>ทำยังไม่เสร็จทุกข้อ</span>
      <span><i class="cell-demo c-none"></i>ยังไม่ทำสักข้อ</span>
      <span class="rf-info muted" id="rf-info"></span>
    </div>
    <section id="report">${skeleton(5)}</section>`;

  let classes = [];
  try { classes = await rpc('list_classes'); }
  catch (e) { $('#report').innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }
  const sel = $('#cls-select');
  if (!classes.length) {
    sel.innerHTML = '<option>—</option>';
    $('#report').innerHTML = emptyState('ยังไม่มีระดับชั้น', 'เพิ่มรายชื่อนักเรียน (ตาราง data) ก่อน', 'users');
    return;
  }
  const saved = sessionStorage.getItem('report_class');
  sel.innerHTML = classes.map((c) => `<option ${c === saved ? 'selected' : ''}>${esc(c)}</option>`).join('');

  let report = null, busy = false;
  // silent = รีเฟรชเบื้องหลัง ไม่แสดงโครงโหลด และคงตำแหน่งเลื่อนตารางไว้
  const load = async (silent = false) => {
    if (busy) return; busy = true;
    sessionStorage.setItem('report_class', sel.value);
    const box = $('#report');
    const sc = $('.table-scroll', box); const keep = sc ? [sc.scrollLeft, sc.scrollTop] : null;
    if (!silent) box.innerHTML = skeleton(5);
    try {
      report = await rpc('class_report', { p_class: sel.value }); drawTable();
      const sc2 = $('.table-scroll', box); if (silent && sc2 && keep) [sc2.scrollLeft, sc2.scrollTop] = keep;
      const t = new Date();
      $('#rf-info').textContent = `อัปเดตล่าสุด ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')} น. (รีเฟรชอัตโนมัติทุก 30 วินาที)`;
    } catch (e) { if (!silent) box.innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); }
    finally { busy = false; }
  };
  sel.addEventListener('change', () => load());
  $('#rf-btn').addEventListener('click', (e) => withBusy(e.currentTarget, () => load(true)));

  // รีเฟรชอัตโนมัติเมื่อยังอยู่หน้านี้ เปิดแท็บอยู่ และไม่ได้เปิดหน้าต่างตรวจงาน
  const alive = () => document.body.contains(sel);
  const tick = () => {
    if (!alive()) { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); return; }
    if (document.visibilityState === 'visible' && !document.querySelector('.modal-backdrop, .modal.open, dialog[open]')) load(true);
  };
  const onVis = () => { if (document.visibilityState === 'visible') tick(); };
  const timer = setInterval(tick, 30000);
  document.addEventListener('visibilitychange', onVis);
  $('#exp-xlsx').addEventListener('click', (e) => withBusy(e.currentTarget, () => exportExcel(report)));
  $('#exp-pdf').addEventListener('click', (e) => withBusy(e.currentTarget, () => exportPdf(report)));

  function drawTable() {
    const { students, worksheets, cells } = report;
    if (!students.length) { $('#report').innerHTML = emptyState('ไม่มีนักเรียนในระดับชั้นนี้', '', 'users'); return; }
    const map = new Map(cells.map((c) => [`${c.student_id}|${c.worksheet_id}`, c]));
    // จัดกลุ่มหน่วย
    const units = [];
    worksheets.forEach((w) => {
      let u = units.find((x) => x.id === w.unit_id);
      if (!u) units.push(u = { id: w.unit_id, unit_no: w.unit_no, unit_name: w.unit_name, ws: [] });
      u.ws.push(w);
    });
    const fullTotal = worksheets.reduce((s, w) => s + Number(w.full_score || 0), 0);

    $('#report').innerHTML = `
      <div class="table-scroll">
        <table class="grade-table">
          <thead>
            <tr>
              <th rowspan="2" class="sticky-1">เลขที่</th>
              <th rowspan="2" class="sticky-2">รหัส</th>
              <th rowspan="2" class="sticky-3 th-name">ชื่อ - สกุล</th>
              ${units.map((u) => `<th colspan="${u.ws.length}" class="th-unit" title="${esc(u.unit_name)}">หน่วยที่ ${u.unit_no}<small>${esc(u.unit_name)}</small></th>`).join('')}
              <th rowspan="2" class="th-total">รวม<small>เต็ม ${num(fullTotal)}</small></th>
            </tr>
            <tr>${worksheets.map((w) => `<th class="th-ws" title="${esc(w.sheet_name)}">ใบงานที่ ${w.sheet_no}<small>เต็ม ${num(w.full_score)}</small></th>`).join('')}</tr>
          </thead>
          <tbody>
            ${students.map((s) => {
              let total = 0;
              const tds = worksheets.map((w) => {
                const c = map.get(`${s.ID}|${w.id}`);
                const graded = c && c.score !== null && c.score !== undefined;
                if (graded) total += Number(c.score);
                const st = c?.status || 'none';
                let cls = 'c-none', inner = '', label = 'ยังไม่ทำ';
                if (graded) { cls = 'c-score'; inner = num(c.score); label = `คะแนน ${num(c.score)}`; }
                else if (st === 'complete') { cls = 'c-done'; inner = icon('check'); label = 'ส่งแล้ว รอตรวจ'; }
                else if (st === 'partial') { cls = 'c-partial'; inner = `<span class="mini">${c.answered_count}/${c.total_questions}</span>`; label = 'ทำยังไม่เสร็จ'; }
                const clickable = graded || st !== 'none';
                return `<td class="cell ${cls}">${clickable
                  ? `<button class="cell-btn" data-s="${esc(s.ID)}" data-w="${w.id}" aria-label="${esc(s.name)} ใบงานที่ ${w.sheet_no}: ${label}">${inner}</button>`
                  : `<span aria-label="${label}" title="${label}"></span>`}</td>`;
              }).join('');
              return `<tr>
                <td class="sticky-1 t-center">${s.no ?? ''}</td>
                <td class="sticky-2 mono">${esc(s.ID)}</td>
                <td class="sticky-3 td-name">${esc(s.name)}${s.registered ? '' : ' <span class="tag-muted">ยังไม่ลงทะเบียน</span>'}</td>
                ${tds}
                <td class="td-total">${num(total)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    $$('.cell-btn', $('#report')).forEach((b) => b.addEventListener('click', () =>
      openGrading(b.dataset.s, Number(b.dataset.w), load)));
  }

  load();
}

// ===================================================================
//  หน้าต่างตรวจใบงาน + ให้คะแนน
// ===================================================================
export async function openGrading(studentId, wsId, onSaved) {
  const m = modal({ title: 'ตรวจใบงาน', body: skeleton(4), size: 'modal-xl' });
  let data;
  try { data = await rpc('get_submission', { p_worksheet_id: wsId, p_student_id: studentId }); }
  catch (e) { m.body.innerHTML = emptyState('โหลดข้อมูลไม่สำเร็จ', e.message, 'x'); return; }
  const { worksheet: ws, submission: sub, student: st } = data;
  const answers = sub?.answers || {};

  m.body.innerHTML = `
    <div class="grade-layout">
      <div class="grade-main">
        <div class="grade-head">
          <p class="eyebrow">หน่วยที่ ${ws.unit_no} · ใบงานที่ ${ws.sheet_no}</p>
          <h3>${esc(ws.sheet_name)}</h3>
          <p class="muted">${esc(st?.name || studentId)} · รหัส ${esc(studentId)} · ${esc(st?.class || '')} · เลขที่ ${st?.no ?? '-'}</p>
          <p class="muted small">ตอบแล้ว ${sub?.answered_count ?? 0}/${ws.questions.length} ข้อ · บันทึกล่าสุด ${fmtDate(sub?.updated_at)}</p>
        </div>
        <div class="q-list compact" id="g-qs"></div>
      </div>
      <aside class="grade-side">
        <div class="score-box">
          <label for="g-score">คะแนนที่ได้</label>
          <div class="score-input"><input id="g-score" type="number" inputmode="decimal" min="0" max="${ws.full_score}" step="0.5"
             value="${sub?.score ?? ''}" placeholder="0" /><span>/ ${num(ws.full_score)}</span></div>
          <small class="hint" id="g-hint">กรอกได้สูงสุด ${num(ws.full_score)} คะแนน</small>
          <label for="g-fb">ความคิดเห็นถึงนักเรียน</label>
          <textarea id="g-fb" rows="4" placeholder="(ไม่บังคับ)">${esc(sub?.feedback || '')}</textarea>
          <button class="btn btn-primary btn-block" id="g-save">${icon('save')} บันทึกคะแนน</button>
          ${sub?.graded_at ? `<p class="muted small">ตรวจล่าสุดโดย ${esc(sub.graded_by || '')} · ${fmtDate(sub.graded_at)}</p>` : ''}
        </div>
      </aside>
    </div>`;
  const qs = $('#g-qs', m.el);
  if (!ws.questions.length) qs.innerHTML = emptyState('ไม่มีคำถาม');
  ws.questions.forEach((q) => qs.appendChild(renderQuestion(q, answers[q.id], { readonly: true }).el));

  const inp = $('#g-score', m.el), hint = $('#g-hint', m.el);
  inp.addEventListener('input', () => {
    const v = Number(inp.value);
    const bad = inp.value !== '' && (v < 0 || v > Number(ws.full_score) || Number.isNaN(v));
    hint.className = 'hint ' + (bad ? 'bad' : '');
    hint.textContent = bad ? `คะแนนต้องอยู่ระหว่าง 0 - ${num(ws.full_score)}` : `กรอกได้สูงสุด ${num(ws.full_score)} คะแนน`;
  });
  $('#g-save', m.el).addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const raw = inp.value.trim();
    const v = raw === '' ? null : Number(raw);
    if (v !== null && (Number.isNaN(v) || v < 0 || v > Number(ws.full_score))) { toast(`คะแนนต้องอยู่ระหว่าง 0 - ${num(ws.full_score)}`, 'error'); return; }
    try {
      await rpc('grade_submission', { p_worksheet_id: wsId, p_student_id: studentId, p_score: v, p_feedback: $('#g-fb', m.el).value || null });
      toast('บันทึกคะแนนแล้ว', 'success');
      m.close(); onSaved && onSaved();
    } catch (ex) { toast(ex.message, 'error'); }
  }));
}

// ===================================================================
//  ส่งออก Excel / PDF
// ===================================================================
function buildRows(report) {
  const { students, worksheets, cells } = report;
  const map = new Map(cells.map((c) => [`${c.student_id}|${c.worksheet_id}`, c]));
  const head = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ - สกุล',
    ...worksheets.map((w) => `หน่วย ${w.unit_no} ใบงาน ${w.sheet_no} (${num(w.full_score)})`), `รวม (${num(worksheets.reduce((s, w) => s + Number(w.full_score || 0), 0))})`];
  const rows = students.map((s) => {
    let total = 0;
    const vals = worksheets.map((w) => {
      const c = map.get(`${s.ID}|${w.id}`);
      if (c && c.score !== null && c.score !== undefined) { total += Number(c.score); return Number(c.score); }
      if (c?.status === 'complete') return 'รอตรวจ';
      if (c?.status === 'partial') return 'ทำไม่ครบ';
      return 'ยังไม่ทำ';
    });
    return [s.no ?? '', s.ID, s.name, ...vals, total];
  });
  return { head, rows };
}

async function exportExcel(report) {
  if (!report) return;
  await loadScript(XLSX_CDN);
  const { head, rows } = buildRows(report);
  const XLSX = window.XLSX;
  const ws = XLSX.utils.aoa_to_sheet([[`${CONFIG.APP_NAME} — สรุปคะแนน ${report.class}`], [], head, ...rows]);
  ws['!cols'] = head.map((_, i) => ({ wch: i === 2 ? 30 : i < 2 ? 10 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'คะแนน');
  XLSX.writeFile(wb, `คะแนน_${report.class.replace(/[\\/]/g, '-')}.xlsx`);
}

async function exportPdf(report) {
  if (!report) return;
  await loadScript(PDF_CDN);
  const { head, rows } = buildRows(report);
  const el = h(`
    <div class="pdf-sheet" style="width:${head.length > 8 ? 980 : 690}px">
      <div class="pdf-head">
        <img src="${CONFIG.LOGO_LOCAL}" alt="" width="56" height="56" />
        <div><h2>สรุปคะแนนใบงาน ${esc(CONFIG.SUBJECT_NAME)}</h2>
        <p>${esc(CONFIG.SCHOOL_NAME)} · ระดับชั้น ${esc(report.class)} · พิมพ์เมื่อ ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}</p></div>
      </div>
      <table><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td class="${i === 2 ? 'l' : ''}">${esc(typeof v === 'number' ? num(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="pdf-foot">${esc(CONFIG.COPYRIGHT)}</p>
    </div>`);
  const holder = h('<div class="pdf-holder" aria-hidden="true"></div>');
  holder.appendChild(el);
  document.body.appendChild(holder);
  try {
    await window.html2pdf().set({
      margin: [8, 8, 8, 8], filename: `คะแนน_${report.class.replace(/[\\/]/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: head.length > 8 ? 'landscape' : 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
    }).from(el).save();
  } finally { holder.remove(); }
}
