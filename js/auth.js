import { CONFIG } from './config.js';
import { rpc, requestOtp, session } from './api.js';
import {
  $, $$, esc, h, icon, toast, withBusy, bindTelMask, telDigits, fmtTel,
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
  const purpose = isReset ? 'reset' : 'register';
  app.innerHTML = `
  <div class="auth-page">
    ${brandPanel()}
    <main class="auth-main">
      <div class="auth-card auth-card-wide">
        <a class="back-link" href="#/login">${icon('back')} กลับหน้าเข้าสู่ระบบ</a>
        <div class="auth-card-head">
          <h2>${isReset ? 'ลืมรหัสผ่าน' : 'ลงทะเบียนนักเรียน'}</h2>
          <p class="muted">${isReset
            ? 'กรอกรหัสนักเรียน และเบอร์โทรเดิมที่เคยลงทะเบียนไว้เท่านั้น เพื่อรับ OTP และตั้งรหัสผ่านใหม่'
            : 'กรอกรหัสนักเรียน ระบบจะดึงข้อมูลให้อัตโนมัติ จากนั้นยืนยันเบอร์โทรด้วย OTP'}</p>
        </div>

        <ol class="steps" aria-label="ขั้นตอน">
          <li class="step active" data-step="1"><span>1</span>ข้อมูลนักเรียน</li>
          <li class="step" data-step="2"><span>2</span>ยืนยัน OTP</li>
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
              <div class="input-row">
                <div class="input-wrap grow">
                  <span class="input-ic">${icon('phone')}</span>
                  <input id="r-tel" inputmode="tel" maxlength="12" placeholder="###-###-####" disabled />
                </div>
                <button type="button" class="btn btn-gold" id="r-otp-btn" disabled>ขอ OTP</button>
              </div>
              <small class="hint" id="r-tel-hint"></small>
            </div>
            <div class="debug-box" id="r-debug" hidden></div>
            <div class="field">
              <label for="r-otp">6. รหัส OTP 6 หลัก</label>
              <div class="input-row">
                <div class="input-wrap grow">
                  <span class="input-ic">${icon('shield')}</span>
                  <input id="r-otp" class="otp-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" disabled />
                </div>
                <button type="button" class="btn btn-outline" id="r-verify-btn" disabled>ยืนยัน OTP</button>
              </div>
              <small class="hint" id="r-otp-hint"></small>
            </div>
          </section>

          <section class="form-section" id="pw-section" aria-disabled="true">
            ${pwField('r-pw', isReset ? '7. สร้างรหัสผ่านใหม่' : '7. สร้างรหัสผ่าน', 'ตัวเลข + ตัวอักษร + อักขระพิเศษ')}
            <ul class="pw-rules" id="pw-rules">
              ${pwRules.map((r) => `<li data-rule="${r.id}">${icon('check')} ${r.label}</li>`).join('')}
            </ul>
            ${pwField('r-pw2', '8. ยืนยันรหัสผ่าน', 'กรอกให้เหมือนข้อ 7 ทุกประการ')}
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
  const st = { student: null, otpRequested: false, verifyToken: null, expiresAt: 0, resendAt: 0, timer: null };
  const pwInputs = [el('r-pw'), el('r-pw2')];
  pwInputs.forEach((i) => (i.disabled = true));

  const setStep = (n) => $$('.step').forEach((s) => {
    const k = Number(s.dataset.step);
    s.classList.toggle('active', k === n); s.classList.toggle('done', k < n);
  });
  const hint = (id, text, kind = '') => { const x = el(id); x.textContent = text; x.className = 'hint ' + kind; };

  function resetOtp() {
    st.otpRequested = false; st.verifyToken = null; st.expiresAt = 0; st.otpMsg = '';
    el('r-otp').value = ''; el('r-otp').disabled = true; el('r-verify-btn').disabled = true;
    el('r-debug').hidden = true; hint('r-otp-hint', '');
    pwInputs.forEach((i) => { i.disabled = true; i.value = ''; });
    $('#pw-section').setAttribute('aria-disabled', 'true');
    updatePw(); setStep(st.student ? 2 : 1);
  }

  function telValid() { return /^0\d{9}$/.test(telDigits(el('r-tel').value)); }
  function syncOtpBtn() {
    const wait = Math.max(0, Math.ceil((st.resendAt - Date.now()) / 1000));
    const ok = st.student && telValid() && !st.verifyToken && wait === 0;
    el('r-otp-btn').disabled = !ok;
    el('r-otp-btn').textContent = wait > 0 ? `ขอใหม่ใน ${wait} วิ` : (st.otpRequested ? 'ขอ OTP ใหม่' : 'ขอ OTP');
  }

  function tick() {
    syncOtpBtn();
    if (st.otpRequested && !st.verifyToken) {
      const left = Math.max(0, Math.ceil((st.expiresAt - Date.now()) / 1000));
      const t = `รหัสหมดอายุใน ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} นาที`;
      if (left > 0) hint('r-otp-hint', st.otpMsg ? `${st.otpMsg} · ${t}` : t, st.otpMsg ? 'bad' : 'warn');
      else { hint('r-otp-hint', 'รหัส OTP หมดอายุแล้ว กรุณากด “ขอ OTP ใหม่”', 'bad'); el('r-otp').disabled = true; el('r-verify-btn').disabled = true; }
    }
    if (!document.body.contains(el('r-otp-btn'))) clearInterval(st.timer);
  }
  st.timer = setInterval(tick, 1000);

  // 1) รหัสนักเรียน -> ดึงข้อมูลจากตาราง data
  el('r-id').addEventListener('input', async (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    st.student = null;
    ['r-no', 'r-name', 'r-class'].forEach((i) => (el(i).value = ''));
    el('r-tel').disabled = true; resetOtp(); syncOtpBtn();
    if (e.target.value.length < 5) { hint('r-id-hint', e.target.value ? 'กรอกให้ครบ 5 หลัก' : ''); return; }
    hint('r-id-hint', 'กำลังค้นหาข้อมูล…');
    try {
      const r = await rpc('student_lookup', { p_student_id: e.target.value }, { auth: false });
      if (!r.found) return hint('r-id-hint', 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาติดต่อครูประจำวิชา', 'bad');
      if (!isReset && r.registered) return hint('r-id-hint', 'รหัสนี้ลงทะเบียนแล้ว หากลืมรหัสผ่านให้ใช้เมนู “ลืมรหัสผ่าน”', 'bad');
      if (isReset && !r.registered) return hint('r-id-hint', 'รหัสนี้ยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อน', 'bad');
      st.student = r;
      el('r-no').value = r.no ?? '-'; el('r-name').value = r.name; el('r-class').value = r.class;
      hint('r-id-hint', 'พบข้อมูลนักเรียน', 'good');
      el('r-tel').disabled = false; el('r-tel').focus();
      setStep(2); syncOtpBtn();
    } catch (ex) { hint('r-id-hint', ex.message, 'bad'); }
  });

  // 5) เบอร์โทร
  bindTelMask(el('r-tel'));
  el('r-tel').addEventListener('input', () => {
    if (st.otpRequested) resetOtp();
    hint('r-tel-hint', el('r-tel').value && !telValid() ? 'รูปแบบ ###-###-#### (10 หลัก ขึ้นต้นด้วย 0)' : '', 'warn');
    syncOtpBtn();
  });

  el('r-otp-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'กำลังส่ง…';
    try {
      const r = await requestOtp(st.student.ID, telDigits(el('r-tel').value), purpose);
      st.otpRequested = true; st.otpMsg = '';
      st.expiresAt = Date.now() + (r.expires_in || CONFIG.OTP_SECONDS) * 1000;
      st.resendAt = Date.now() + CONFIG.OTP_RESEND_SECONDS * 1000;
      el('r-otp').disabled = false; el('r-otp').value = ''; el('r-otp').focus();
      hint('r-tel-hint', `ส่งรหัส OTP ไปที่ ${fmtTel(el('r-tel').value)} แล้ว`, 'good');
      if (r.debug_code) {
        const d = el('r-debug');
        d.innerHTML = `<b>โหมดทดสอบ (ยังไม่ส่ง SMS จริง)</b> รหัส OTP คือ <code>${esc(r.debug_code.slice(0, 3))} ${esc(r.debug_code.slice(3))}</code>`;
        d.hidden = false;
      }
      toast('ส่งรหัส OTP แล้ว', 'success');
    } catch (ex) { hint('r-tel-hint', ex.message, 'bad'); }
    tick();
  });

  // 6) OTP
  el('r-otp').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (e.target.value.length < 6) st.otpMsg = '';
    el('r-verify-btn').disabled = e.target.value.length !== 6;
    if (e.target.value.length === 6) el('r-verify-btn').click();
  });
  el('r-verify-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    await withBusy(btn, async () => {
      try {
        const r = await rpc('verify_otp', {
          p_student_id: st.student.ID, p_tel: telDigits(el('r-tel').value), p_purpose: purpose, p_code: el('r-otp').value,
        }, { auth: false });
        if (!r.ok) {
          let msg = { OTP_INVALID: 'รหัส OTP ไม่ถูกต้อง', OTP_EXPIRED: 'รหัส OTP หมดอายุแล้ว', OTP_LOCKED: 'กรอกผิดเกินกำหนด กรุณาขอรหัสใหม่', OTP_NOT_FOUND: 'ไม่พบรหัส กรุณาขอ OTP ใหม่' }[r.error] || r.error;
          if (r.error === 'OTP_INVALID' && r.remaining >= 0) msg += ` (เหลืออีก ${r.remaining} ครั้ง)`;
          st.otpMsg = msg; hint('r-otp-hint', msg, 'bad'); return;
        }
        st.verifyToken = r.verify_token; st.otpMsg = '';
        hint('r-otp-hint', 'ยืนยัน OTP สำเร็จ กรุณาตั้งรหัสผ่าน', 'good');
        el('r-otp').disabled = true; el('r-tel').disabled = true; el('r-id').disabled = true;
        pwInputs.forEach((i) => (i.disabled = false));
        $('#pw-section').setAttribute('aria-disabled', 'false');
        el('r-pw').focus(); setStep(3); syncOtpBtn();
      } catch (ex) { hint('r-otp-hint', ex.message, 'bad'); }
    });
    delete btn.dataset.busy;
    if (st.verifyToken) btn.disabled = true;
  });

  // 7-8) รหัสผ่าน
  function updatePw() {
    const p = el('r-pw').value, p2 = el('r-pw2').value;
    pwRules.forEach((r) => $(`[data-rule=${r.id}]`).classList.toggle('ok', r.test(p)));
    if (!p2) hint('r-pw2-hint', '');
    else if (p === p2) hint('r-pw2-hint', 'รหัสผ่านตรงกัน', 'good');
    else hint('r-pw2-hint', 'รหัสผ่านไม่ตรงกับข้อ 7', 'bad');
    el('r-save').disabled = !(st.verifyToken && pwStrong(p) && p === p2);
  }
  pwInputs.forEach((i) => i.addEventListener('input', updatePw));

  el('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = el('r-err'); err.hidden = true;
    if (el('r-save').disabled) return;
    await withBusy(el('r-save'), async () => {
      try {
        await rpc('complete_otp', {
          p_student_id: st.student.ID, p_tel: telDigits(el('r-tel').value), p_purpose: purpose,
          p_verify_token: st.verifyToken, p_password: el('r-pw').value,
        }, { auth: false });
        clearInterval(st.timer);
        toast(isReset ? 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' : 'ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ', 'success', 5000);
        location.hash = '#/login';
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  });
}
