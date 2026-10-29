import { CONFIG, logoUrl } from './config.js';
import { rpc, session, setExpiredHandler } from './api.js';
import { esc, icon, toast, setFaviconUrl, confirmBox } from './ui.js';
import { renderLogin, renderRegister } from './auth.js';
import { renderStudentHome, renderStudentWorksheet } from './student.js';
import { renderClassReport } from './teacher.js';
import { renderAdmin } from './admin.js';

// .setFaviconUrl ของโลโก้ (เหมือน HtmlOutput.setFaviconUrl ของ Apps Script)
setFaviconUrl(logoUrl(64));
document.title = CONFIG.APP_NAME;

const app = document.getElementById('app');
const ROLE_LABEL = { student: 'นักเรียน', teacher: 'ครู', admin: 'Admin' };
const HOME = { student: '#/student', teacher: '#/teacher', admin: '#/admin/sheets' };

setExpiredHandler(() => {
  toast('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่', 'warn');
  location.hash = '#/login';
});

function shell(me) {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="${HOME[me.role]}">
          <img src="${CONFIG.LOGO_LOCAL}" alt="" width="40" height="40" />
          <span class="brand-text"><b>${esc(CONFIG.APP_NAME)}</b><small>${esc(CONFIG.SUBJECT_NAME)} · ${esc(CONFIG.SCHOOL_NAME)}</small></span>
        </a>
        <div class="user-box">
          <span class="avatar" aria-hidden="true">${esc((me.name || '?').replace(/^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|ครู)/, '').trim().charAt(0))}</span>
          <span class="user-meta"><b>${esc(me.name)}</b><small><span class="role-pill role-${me.role}">${ROLE_LABEL[me.role]}</span>${me.class ? ` ${esc(me.class)}` : ''}</small></span>
          <button class="icon-btn on-dark" id="logout" aria-label="ออกจากระบบ" title="ออกจากระบบ">${icon('logout')}</button>
        </div>
      </header>
      <main class="container" id="main"></main>
      <footer class="site-footer">${esc(CONFIG.COPYRIGHT)}</footer>
    </div>`;
  document.getElementById('logout').addEventListener('click', async () => {
    if (!await confirmBox('ต้องการออกจากระบบหรือไม่?', { okText: 'ออกจากระบบ' })) return;
    try { await rpc('app_logout'); } catch { /* ignore */ }
    session.clear();
    location.hash = '#/login';
  });
  return document.getElementById('main');
}

async function route() {
  const hash = location.hash || '#/login';
  const [path] = hash.slice(2).split('?');
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  const parts = path.split('/').filter(Boolean);
  const me = session.get();
  window.scrollTo(0, 0);

  if (!me || ['login', 'register', 'forgot'].includes(parts[0])) {
    if (me && parts[0] === 'login') { location.hash = HOME[me.role]; return; }
    if (parts[0] === 'register') return renderRegister(app, 'register');
    if (parts[0] === 'forgot') return renderRegister(app, 'reset');
    if (location.hash !== '#/login') { history.replaceState(null, '', '#/login'); }
    return renderLogin(app, { onLogin: (s) => { location.hash = HOME[s.role]; } });
  }

  // ป้องกันเข้าหน้าของบทบาทอื่น
  const area = parts[0];
  const allowed = { student: ['student'], teacher: ['teacher'], admin: ['admin'] }[me.role];
  if (!allowed.includes(area)) { location.hash = HOME[me.role]; return; }

  const main = shell(me);
  if (me.role === 'student') {
    if (parts[1] === 'ws' && parts[2]) return renderStudentWorksheet(main, me, parts[2]);
    return renderStudentHome(main, me);
  }
  if (me.role === 'teacher') return renderClassReport(main, me, { title: 'ตารางติดตามใบงาน', eyebrow: `ครู · ${me.class || ''}` });
  if (me.role === 'admin') return renderAdmin(main, me, parts[1] || 'sheets', (parts[2] || null) && parts[2] + query);
}

window.addEventListener('hashchange', route);

// ตรวจสอบ session เดิมก่อนเริ่ม
(async () => {
  const me = session.get();
  if (me?.token) {
    try { const fresh = await rpc('app_me'); session.set({ ...me, ...fresh }); }
    catch { session.clear(); }
  }
  route();
})();
