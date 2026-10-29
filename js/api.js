import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

export const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ERRORS = {
  INVALID_LOGIN: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  INVALID_ROLE: 'กรุณาเลือกสถานะผู้ใช้งาน',
  SESSION_EXPIRED: 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่',
  FORBIDDEN: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้',
  INVALID_STUDENT_ID: 'รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก',
  INVALID_TEL: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0',
  STUDENT_NOT_FOUND: 'ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาติดต่อครูประจำวิชา',
  ALREADY_REGISTERED: 'รหัสนักเรียนนี้ลงทะเบียนแล้ว หากลืมรหัสผ่านให้ใช้เมนู “ลืมรหัสผ่าน”',
  NOT_REGISTERED: 'รหัสนักเรียนนี้ยังไม่ได้ลงทะเบียน',
  TEL_MISMATCH: 'เบอร์โทรไม่ตรงกับที่ลงทะเบียนไว้',
  OTP_TOO_SOON: 'ขอ OTP ได้ครั้งละ 1 นาที กรุณารอสักครู่',
  OTP_NOT_FOUND: 'ไม่พบรหัส OTP กรุณากด “ขอ OTP” ใหม่',
  OTP_EXPIRED: 'รหัส OTP หมดอายุแล้ว กรุณาขอใหม่',
  OTP_LOCKED: 'กรอก OTP ผิดเกินกำหนด กรุณาขอรหัสใหม่',
  OTP_INVALID: 'รหัส OTP ไม่ถูกต้อง',
  VERIFY_EXPIRED: 'การยืนยัน OTP หมดอายุ กรุณาขอ OTP ใหม่',
  WEAK_PASSWORD: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีตัวเลข ตัวอักษร และอักขระพิเศษ',
  SMS_NOT_CONFIGURED: 'ระบบส่ง SMS ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ',
  SMS_SEND_FAILED: 'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  ALREADY_GRADED: 'ใบงานนี้ครูตรวจให้คะแนนแล้ว ไม่สามารถแก้ไขได้',
  SCORE_OUT_OF_RANGE: 'คะแนนต้องไม่ติดลบและไม่เกินคะแนนเต็มของใบงาน',
  REQUIRED_FIELDS: 'กรุณากรอกข้อมูลให้ครบถ้วน',
  PASSWORD_REQUIRED: 'กรุณากำหนดรหัสผ่าน',
  DUPLICATE_USERNAME: 'ชื่อผู้ใช้หรือรหัสนี้มีอยู่แล้วในระบบ',
  LAST_ADMIN: 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน',
  DELETE_SELF: 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่',
  NOT_FOUND: 'ไม่พบข้อมูล',
};

export function errText(e) {
  const msg = typeof e === 'string' ? e : (e?.message || String(e ?? ''));
  for (const k of Object.keys(ERRORS)) if (msg.includes(k)) return ERRORS[k];
  if (msg.includes('PGRST202') || msg.includes('Could not find the function') || msg.includes('PGRST205'))
    return 'ยังไม่ได้ติดตั้งฐานข้อมูล กรุณารันไฟล์ supabase/01_schema.sql ใน SQL Editor';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
  if (msg.includes('Failed to send a request to the Edge Function'))
    return 'ยังไม่ได้ติดตั้ง Edge Function “send-otp” สำหรับส่ง SMS';
  return msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

const KEY = 'pk_ac_session';
export const session = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(s) { localStorage.setItem(KEY, JSON.stringify(s)); },
  clear() { localStorage.removeItem(KEY); },
};

let onExpired = () => {};
export const setExpiredHandler = (fn) => { onExpired = fn; };

/** เรียกฟังก์ชัน RPC — ถ้า auth=true จะแนบ token ของ session อัตโนมัติ */
export async function rpc(fn, params = {}, { auth = true } = {}) {
  const body = auth ? { p_token: session.get()?.token ?? null, ...params } : params;
  const { data, error } = await sb.rpc(fn, body);
  if (error) {
    if (auth && error.message?.includes('SESSION_EXPIRED')) { session.clear(); onExpired(); }
    throw new Error(errText(error));
  }
  return data;
}

/** ขอ OTP ผ่าน Edge Function (สร้างรหัส + ส่ง SMS) */
export async function requestOtp(student_id, tel, purpose) {
  const { data, error } = await sb.functions.invoke(CONFIG.OTP_FUNCTION, {
    body: { student_id, tel, purpose },
  });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(errText(msg));
  }
  if (!data?.ok) throw new Error(errText(data?.error));
  return data;
}
