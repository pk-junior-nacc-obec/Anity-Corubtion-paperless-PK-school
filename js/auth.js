import { CONFIG } from './config.js';
import { rpc, session } from './api.js';
import {
  $, $$, esc, h, icon, toast, withBusy, bindTelMask, telDigits,
  pwRules, pwStrong, pwField, bindPwToggles,
} from './ui.js';

const footer = () => `<footer class="site-footer">${esc(CONFIG.COPYRIGHT)}</footer>`;

function brandPanel() {
  return `
  <aside class="auth-brand">
    <div class="brand-pattern" aria-hidden="true"></div>
    <div class="brand-inner">
      <img class="brand-logo" src="${CONFIG.LOGO_LOCAL}" alt="โลโก้ ${esc(CONFIG.APP_NAME)}" width="148" height="148" />
      <p class="eyebrow">${esc(CONFIG.SUBJECT_NAME)} · ${esc(CONFIG.SCHOOL_NAME)}</p>
      <h1 class="brand-title">${esc(CONFIG.APP_NAME)}</h1>
      <p class="brand-sub">ระบบใบงานออนไลน์ไร้กระดาษ ส่งงาน ตรวจงาน และสรุปคะแนนได้ในที่เดียว</p>
      <ul class="brand-points">
        <li>${icon('book')} ใบงานแยกตามหน่วยการเรียนรู้</li>
        <li>${icon('check')} ติดตามสถานะการส่งงานแบบเรียลไทม์</li>
        <li>${icon('download')} ส่งออกคะแนนเป็น Excel และ PDF</li>
      </ul>
    </div>
  </aside>`;
}

// ===================================================================
//  หน้าเข้าสู่ระบบ
// ===================================================================
export function renderLogin(app, { onLogin }) {
  app.innerHTML = `
  <div class="auth-page">
    ${brandPanel()}
    <main class="auth-main">
      <div class="auth-card">
        <div class="auth-card-head">
          <img class="mobile-logo" src="${CONFIG.LOGO_LOCAL}" alt="" width="64" height="64" />
          <h2>เข้าสู่ระบบ</h2>
          <p class="muted">เลือกสถานะผู้ใช้งาน แล้วกรอกชื่อผู้ใช้และรหัสผ่าน</p>
        </div>
        <form id="login-form" novalidate>
          <div class="field">
            <span class="label">สถานะ</span>
            <div class="role-switch" role="radiogroup" aria-label="สถานะผู้ใช้งาน">
              <label class="role-opt"><input type="radio" name="role" value="student" checked />
                <span>${icon('user')}<b>นักเรียน</b></span></label>
              <label class="role-opt"><input type="radio" name="role" value="teacher" />
                <span>${icon('users')}<b>ครู</b></span></label>
              <label class="role-opt"><input type="radio" name="role" value="admin" />
                <span>${icon('shield')}<b>Admin</b></span></label>
            </div>
          </div>
          <div class="field">
            <label for="lg-user" id="lg-user-label">Username (รหัสนักเรียน)</label>
            <div class="input-wrap">
              <span class="input-ic">${icon('user')}</span>
              <input id="lg-user" autocomplete="username" inputmode="numeric" placeholder="รหัสนักเรียน 5 หลัก" required />
            </div>
          </div>
          <div class="field">
            <label for="lg-pass">Password</label>
            <div class="input-wrap">
              <span class="input-ic">${icon('key')}</span>
              <input id="lg-pass" type="password" autocomplete="current-password" placeholder="รหัสผ่าน" required />
              <button type="button" class="pw-toggle" data-toggle="lg-pass" aria-label="แสดงรหัสผ่าน">${icon('eye')}</button>
            </div>
          </div>
          <p class="form-error" id="lg-err" hidden></p>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="lg-btn">เข้าสู่ระบบ</button>
          <div class="auth-links" id="student-links">
            <a href="#/register">${icon('plus')} ลงทะเบียน</a>
            <a href="#/forgot">${icon('key')} ลืมรหัสผ่าน</a>
          </div>
        </form>
      </div>
      ${footer()}
    </main>
  </div>`;

  bindPwToggles(app);
  const user = $('#lg-user'), label = $('#lg-user-label'), links = $('#student-links');
  const syncRole = () => {
    const role = $('input[name=role]:checked').value;
    const isStu = role === 'student';
    label.textContent = isStu ? 'Username (รหัสนักเรียน)' : 'Username';
    user.placeholder = isStu ? 'รหัสนักเรียน 5 หลัก' : 'ชื่อผู้ใช้';
    user.inputMode = isStu ? 'numeric' : 'text';
    links.style.visibility = isStu ? 'visible' : 'hidden';
  };
  $$('input[name=role]').forEach((r) => r.addEventListener('change', syncRole));
  syncRole();

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#lg-err'); err.hidden = true;
    const role = $('input[name=role]:checked').value;
    const username = user.value.trim(), password = $('#lg-pass').value;
    if (!username || !password) { err.textContent = 'กรุณากรอก Username และ Password'; err.hidden = false; return; }
    await withBusy($('#lg-btn'), async () => {
      try {
        const s = await rpc('app_login', { p_role: role, p_username: username, p_password: password }, { auth: false });
        session.set(s);
        toast(`ยินดีต้อนรับ ${s.name}`, 'success');
        onLogin(s);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  });
}

// ===================================================================
//  ลงทะเบียน / ลืมรหัสผ่าน (ใช้ฟอร์มเดียวกัน)
// ===================================================================
export function renderRegister(app, mode = 'register') {
  const isReset = mode === 'reset';
  app.innerHTML = `
  <div class="auth-layout">
    ${brandPanel()}
    <main class="auth-main">
      <div class="auth-card auth-card-wide">
        <a class="back-link" href="#/login">${icon('back')} กลับหน้าเข้าสู่ระบบ</a>
        <div class="auth-card-head">
          <h2>${isReset ? 'ลืมรหัสผ่าน' : 'ลงทะเบียนนักเรียน'}</h2>
          <p class="muted">${isReset
            ? 'กรอกรหัสนักเรียน และเบอร์โทรเดิมที่เคยลงทะเบียนไว้เท่านั้น แล้วตั้งรหัสผ่านใหม่'
            : 'กรอกรหัสนักเรียน ระบบจะดึงข้อมูลให้อัตโนมัติ จากนั้นกรอกเบอร์โทรและตั้งรหัสผ่านด้วยตนเอง'}</p>
        </div>

        <ol class="steps" aria-label="ขั้นตอน">
          <li class="step active" data-step="1"><span>1</span>ข้อมูลนักเรียน</li>
          <li class="step" data-step="2"><span>2</span>เบอร์โทร</li>
          <li class="step" data-step="3"><span>3</span>ตั้งรหัสผ่าน</li>
        </ol>

        <form id="reg-form" novalidate>
          <section class="form-section">
            <div class="field">
              <label for="r-id">1. รหัสนักเรียน 5 หลัก</label>
              <div class="input-wrap">
                <span class="input-ic">${icon('user')}</span>
                <input id="r-id" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="เช่น 12345" />
              </div>
              <small class="hint" id="r-id-hint"></small>
            </div>
            <div class="grid-3">
              <div class="field"><label for="r-no">2. เลขที่</label><input id="r-no" readonly tabindex="-1" placeholder="-" /></div>
              <div class="field span-2"><label for="r-name">3. ชื่อ - สกุล</label><input id="r-name" readonly tabindex="-1" placeholder="-" /></div>
            </div>
            <div class="field"><label for="r-class">4. ระดับชั้น</label><input id="r-class" readonly tabindex="-1" placeholder="-" /></div>
          </section>

          <section class="form-section">
            <div class="field">
              <label for="r-tel">5. เบอร์โทร ${isReset ? '<em class="tag-gold">ต้องเป็นเบอร์เดิมที่ลงทะเบียนไว้</em>' : ''}</label>
              <div class="input-wrap">
                <span class="input-ic">${icon('phone')}</span>
                <input id="r-tel" inputmode="tel" maxlength="12" placeholder="###-###-####" disabled />
              </div>
              <small class="hint" id="r-tel-hint"></small>
            </div>
          </section>

          <section class="form-section" id="pw-section" aria-disabled="true">
            ${pwField('r-pw', isReset ? '6. สร้างรหัสผ่านใหม่' : '6. สร้างรหัสผ่าน', 'ตัวเลข + ตัวอักษร + อักขระพิเศษ')}
            <ul class="pw-rules" id="pw-rules">
              ${pwRules.map((r) => `<li data-rule="${r.id}">${icon('check')} ${r.label}</li>`).join('')}
            </ul>
            ${pwField('r-pw2', '7. ยืนยันรหัสผ่าน', 'กรอกให้เหมือนข้อ 6 ทุกประการ')}
            <small class="hint" id="r-pw2-hint"></small>
          </section>

          <p class="form-error" id="r-err" hidden></p>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="r-save" disabled>${icon('save')} บันทึก</button>
        </form>
      </div>
      ${footer()}
    </main>
  </div>`;

  bindPwToggles(app);
  const el = (id) => $('#' + id);
  const st = { student: null };
  const pwInputs = [el('r-pw'), el('r-pw2')];

  const setStep = (n) => $$('.step').forEach((s) => {
    const k = Number(s.dataset.step);
    s.classList.toggle('active', k === n); s.classList.toggle('done', k < n);
  });
  const hint = (id, text, kind = '') => { const x = el(id); x.textContent = text; x.className = 'hint ' + kind; };
  const telValid = () => /^0\d{9}$/.test(telDigits(el('r-tel').value));

  function sync() {
    const ready = !!st.student && telValid();
    pwInputs.forEach((i) => (i.disabled = !ready));
    $('#pw-section').setAttribute('aria-disabled', String(!ready));
    setStep(!st.student ? 1 : ready ? 3 : 2);
    updatePw();
  }

  // 1) รหัสนักเรียน -> ดึงข้อมูลจากตาราง data
  el('r-id').addEventListener('input', async (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    st.student = null;
    ['r-no', 'r-name', 'r-class'].forEach((i) => (el(i).value = ''));
    el('r-tel').disabled = true; sync();
    if (e.target.value.length < 5) { hint('r-id-hint', e.target.value ? 'กรอกให้ครบ 5 หลัก' : ''); return; }
    hint('r-id-hint', 'กำลังค้นหาข้อมูล…');
    const value = e.target.value;
    try {
      const r = await rpc('student_lookup', { p_student_id: value }, { auth: false });
      if (el('r-id').value !== value) return;
      if (!r.found) return hint('r-id-hint', 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาติดต่อครูประจำวิชา', 'bad');
      if (!isReset && r.registered) return hint('r-id-hint', 'รหัสนี้ลงทะเบียนแล้ว หากลืมรหัสผ่านให้ใช้เมนู “ลืมรหัสผ่าน”', 'bad');
      if (isReset && !r.registered) return hint('r-id-hint', 'รหัสนี้ยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อน', 'bad');
      st.student = r;
      el('r-no').value = r.no ?? '-'; el('r-name').value = r.name; el('r-class').value = r.class;
      hint('r-id-hint', 'พบข้อมูลนักเรียน', 'good');
      el('r-tel').disabled = false; el('r-tel').focus();
      sync();
    } catch (ex) { hint('r-id-hint', ex.message, 'bad'); }
  });

  // 5) เบอร์โทร
  bindTelMask(el('r-tel'));
  el('r-tel').addEventListener('input', () => {
    hint('r-tel-hint', el('r-tel').value && !telValid() ? 'รูปแบบ ###-###-#### (10 หลัก ขึ้นต้นด้วย 0)' : '', 'warn');
    sync();
  });

  // 6-7) รหัสผ่าน
  function updatePw() {
    const p = el('r-pw').value, p2 = el('r-pw2').value;
    pwRules.forEach((r) => $(`[data-rule=${r.id}]`).classList.toggle('ok', r.test(p)));
    if (!p2) hint('r-pw2-hint', '');
    else if (p === p2) hint('r-pw2-hint', 'รหัสผ่านตรงกัน', 'good');
    else hint('r-pw2-hint', 'รหัสผ่านไม่ตรงกับข้อ 6', 'bad');
    el('r-save').disabled = !(st.student && telValid() && pwStrong(p) && p === p2);
  }
  pwInputs.forEach((i) => i.addEventListener('input', updatePw));
  sync();

  el('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = el('r-err'); err.hidden = true;
    if (el('r-save').disabled) return;
    await withBusy(el('r-save'), async () => {
      try {
        const params = { p_student_id: st.student.ID, p_tel: telDigits(el('r-tel').value), p_password: el('r-pw').value };
        if (isReset) {
          const r = await rpc('student_reset_password', params, { auth: false });
          if (!r.ok) {
            let msg = r.error === 'TOO_MANY_ATTEMPTS'
              ? 'กรอกเบอร์โทรผิดเกิน 5 ครั้ง กรุณารอ 15 นาทีแล้วลองใหม่ หรือติดต่อครู / ผู้ดูแลระบบ'
              : 'เบอร์โทรไม่ตรงกับที่ลงทะเบียนไว้';
            if (r.error === 'TEL_MISMATCH' && r.remaining >= 0) msg += ` (ลองได้อีก ${r.remaining} ครั้ง)`;
            hint('r-tel-hint', msg, 'bad');
            err.textContent = msg; err.hidden = false;
            return;
          }
        } else {
          await rpc('student_register', params, { auth: false });
        }
        toast(isReset ? 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' : 'ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ', 'success', 5000);
        location.hash = '#/login';
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  });
}
