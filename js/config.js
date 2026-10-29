// ==============================================================
//  ตั้งค่าระบบ  (แก้ไขได้ที่ไฟล์นี้ไฟล์เดียว)
// ==============================================================
export const CONFIG = {
  APP_NAME: 'Anity Corubtion paperless PK school',
  SCHOOL_NAME: 'โรงเรียนภูเขียว',
  SUBJECT_NAME: 'รายวิชาต้านทุจริต',

  // Supabase
  SUPABASE_URL: 'https://uscyhrdjtczrojmgnyiv.supabase.co',
  SUPABASE_KEY: 'sb_publishable_x6_dIJ_8NePRqIIe1K__3Q_1xihSjSt',

  // ชื่อ Edge Function สำหรับส่ง OTP ทาง SMS
  OTP_FUNCTION: 'send-otp',
  OTP_SECONDS: 300,        // OTP มีอายุ 5 นาที
  OTP_RESEND_SECONDS: 60,  // ขอ OTP ใหม่ได้ทุก 60 วินาที

  // โลโก้ (Google Drive file ID)
  LOGO_DRIVE_ID: '1E3Sfzalpk46I9uOFhsnfWrBURGb8LsED',
  LOGO_LOCAL: 'assets/logo.png',

  COPYRIGHT: '© Anity Corubtion paperless PK school ALLRIGHT RESERVED',
};

export const logoUrl = (size = 256) =>
  `https://lh3.googleusercontent.com/d/${CONFIG.LOGO_DRIVE_ID}=s${size}`;
