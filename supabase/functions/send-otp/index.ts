// =====================================================================
//  Supabase Edge Function : send-otp
//  สร้างรหัส OTP 6 หลัก (ผ่านฟังก์ชัน create_otp ในฐานข้อมูล) แล้วส่ง SMS
//  ผู้ให้บริการ SMS : ThaiBulkSMS (https://developer.thaibulksms.com)
//
//  ตั้งค่า Secrets (Dashboard > Edge Functions > Secrets):
//    THAIBULKSMS_API_KEY     = API Key
//    THAIBULKSMS_API_SECRET  = API Secret
//    THAIBULKSMS_SENDER      = ชื่อผู้ส่งที่อนุมัติแล้ว (เช่น OTP หรือ PKSCHOOL)
//    THAIBULKSMS_FORCE       = (ไม่บังคับ) standard | corporate
//    OTP_DEBUG               = (ไม่บังคับ) true = ทดสอบโดยไม่ส่ง SMS จริง แสดงรหัสบนหน้าจอ
//                               ** ห้ามเปิดในการใช้งานจริง **
//  SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ
//  ปิด "Verify JWT" ของฟังก์ชันนี้ (เพราะเว็บเรียกด้วย publishable key)
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { student_id?: string; tel?: string; purpose?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "BAD_REQUEST" }, 400); }

  const student_id = String(body.student_id ?? "").trim();
  const tel = String(body.tel ?? "").replace(/\D/g, "");
  const purpose = body.purpose === "reset" ? "reset" : "register";

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1) สร้างรหัส (ตรวจรหัสนักเรียน / เบอร์โทร / จำกัด 1 ครั้งต่อ 60 วินาที)
  const { data: code, error } = await sb.rpc("create_otp", {
    p_student_id: student_id, p_tel: tel, p_purpose: purpose,
  });
  if (error || !code) return json({ ok: false, error: error?.message ?? "OTP_ERROR" }, 400);

  const pretty = `${String(code).slice(0, 3)} ${String(code).slice(3)}`;
  const message =
    `รหัส OTP ในการลงทะเบียน Anity Corubtion paperless PK school ในรายวิชาต้านทุจริต โรงเรียนภูเขียว คือ ${pretty}`;

  const apiKey = Deno.env.get("THAIBULKSMS_API_KEY");
  const apiSecret = Deno.env.get("THAIBULKSMS_API_SECRET");
  const sender = Deno.env.get("THAIBULKSMS_SENDER") ?? "";
  const debug = Deno.env.get("OTP_DEBUG") === "true";

  if (!apiKey || !apiSecret) {
    if (debug) return json({ ok: true, expires_in: 300, debug_code: code, debug_message: message });
    return json({ ok: false, error: "SMS_NOT_CONFIGURED" }, 500);
  }

  // 2) ส่ง SMS ทันที
  const form = new URLSearchParams({ msisdn: tel, message, sender });
  const force = Deno.env.get("THAIBULKSMS_FORCE");
  if (force) form.set("force", force);

  const res = await fetch("https://api-v2.thaibulksms.com/sms", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${apiKey}:${apiSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("ThaiBulkSMS error", res.status, detail);
    return json({ ok: false, error: "SMS_SEND_FAILED", detail }, 502);
  }

  return json({ ok: true, expires_in: 300, ...(debug ? { debug_code: code } : {}) });
});
