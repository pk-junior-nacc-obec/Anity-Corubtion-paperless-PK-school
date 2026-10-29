# Anity Corubtion paperless PK school

ระบบใบงานออนไลน์ (Paperless) รายวิชาต้านทุจริต โรงเรียนภูเขียว
เว็บไซต์แบบ Static (HTML/CSS/JavaScript) สำหรับโฮสต์บน GitHub Pages และใช้ Supabase เป็นฐานข้อมูล

## โครงสร้างไฟล์

```
index.html                  หน้าเว็บหลัก (มี favicon จากโลโก้ Google Drive)
css/style.css               ธีม ขาว - ม่วง - ทอง รองรับทุกขนาดหน้าจอ
js/config.js                ตั้งค่าชื่อเว็บ, Supabase URL, API Key, Logo ID
js/*.js                     โค้ดหน้าเข้าสู่ระบบ / นักเรียน / ครู / Admin
assets/logo.png             โลโก้สำรอง
supabase/01_schema.sql      สร้างตาราง คอลัมน์ ฟังก์ชัน และสิทธิ์ทั้งหมด (รันก่อน)
supabase/02_sample_data.sql ข้อมูลตัวอย่าง (ไม่บังคับ)
supabase/functions/send-otp/index.ts  Edge Function ส่ง OTP ทาง SMS
```

## ขั้นตอนที่ 1 สร้างฐานข้อมูล

1. เข้า Supabase โปรเจกต์ `uscyhrdjtczrojmgnyiv` แล้วไปที่ **SQL Editor > New query**
2. คัดลอกเนื้อหาทั้งหมดของ `supabase/01_schema.sql` ไปวาง แล้วกด **Run**
3. (ไม่บังคับ) รัน `supabase/02_sample_data.sql` เพื่อเพิ่มนักเรียน ครู และใบงานตัวอย่าง

ตารางที่สร้าง (ทุกตารางมีคอลัมน์ `id` สำหรับอ้างอิง)

| ตาราง | หน้าที่ |
|---|---|
| `data` | รายชื่อนักเรียนต้นทาง: `ID`, `no`, `name`, `class` |
| `userstudent` | บัญชีนักเรียนที่ลงทะเบียน: `ID`, `name`, `class`, `tel`, `password` |
| `userteacher` | บัญชีครู: `username`, `password`, `name`, `class` |
| `admin` | บัญชีผู้ดูแล: `username`, `password`, `name`, `position` |
| `units` / `worksheets` / `questions` | หน่วยการเรียนรู้ ใบงาน และข้อคำถาม |
| `submissions` | คำตอบ สถานะ และคะแนนของนักเรียน |
| `otp_codes` / `app_sessions` | OTP (หมดอายุ 5 นาที) และการเข้าสู่ระบบ |

ความปลอดภัย: เปิด RLS ทุกตาราง (ไม่มีใครอ่านตารางตรง ๆ ได้ด้วย API Key สาธารณะ) เว็บเรียกผ่านฟังก์ชัน RPC เท่านั้น และรหัสผ่านถูกเข้ารหัสด้วย bcrypt

บัญชีเริ่มต้น
- Admin: `admin` / `Admin@1234` (กรุณาเปลี่ยนรหัสผ่านทันทีในเมนู บัญชีผู้ใช้ > ผู้ดูแลระบบ)
- ครูตัวอย่าง (จากไฟล์ 02): `teacher1` / `Teacher@1234` รับผิดชอบ ม.1/1,ม.1/2
- ครู 1 คนรับผิดชอบหลายห้องได้ โดยคั่นด้วยเครื่องหมายจุลภาค เช่น `ม.1/1,ม.1/2`

## ขั้นตอนที่ 2 ตั้งค่าการส่ง OTP ทาง SMS

เว็บแบบ Static ส่ง SMS เองไม่ได้ จึงใช้ Supabase Edge Function ร่วมกับผู้ให้บริการ SMS (ThaiBulkSMS)

1. สมัครบัญชีและซื้อเครดิต SMS ที่ ThaiBulkSMS แล้วรับ API Key / API Secret และชื่อผู้ส่ง (Sender name)
2. ใน Supabase ไปที่ **Edge Functions > Deploy a new function > Via Editor** ตั้งชื่อ `send-otp`
   แล้ววางโค้ดจาก `supabase/functions/send-otp/index.ts` กด Deploy
3. ในหน้าตั้งค่าของฟังก์ชัน ให้ **ปิด "Verify JWT"**
4. ไปที่ **Edge Functions > Secrets** เพิ่มค่า
   - `THAIBULKSMS_API_KEY`
   - `THAIBULKSMS_API_SECRET`
   - `THAIBULKSMS_SENDER` (ชื่อผู้ส่งที่อนุมัติแล้ว)
   - `THAIBULKSMS_FORCE` (ไม่บังคับ เช่น `corporate` เพื่อใช้ SMS แบบ corporate)
   - `OTP_DEBUG` = `true` (เฉพาะช่วงทดสอบ: ระบบจะแสดงรหัส OTP บนหน้าจอโดยไม่ส่ง SMS ห้ามเปิดใช้งานจริง)

ข้อความที่ส่ง: `รหัส OTP ในการลงทะเบียน Anity Corubtion paperless PK school ในรายวิชาต้านทุจริต โรงเรียนภูเขียว คือ ### ###`

## ขั้นตอนที่ 3 อัปโหลดขึ้น GitHub Pages

1. สร้าง Repository ใหม่บน GitHub
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ให้ `index.html` อยู่ที่ระดับบนสุดของ repo)
3. ไปที่ **Settings > Pages** เลือก Source = `Deploy from a branch`, Branch = `main`, โฟลเดอร์ `/ (root)` แล้วกด Save
4. รอประมาณ 1-2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

## การปรับแต่ง

แก้ไขใน `js/config.js` เช่น ชื่อเว็บ ชื่อโรงเรียน ชื่อวิชา เวลา OTP และ Logo ID
(ระบบเรียก `setFaviconUrl` เพื่อตั้งค่า favicon จากโลโก้ Google Drive ให้อัตโนมัติ)

กฎรหัสผ่าน: ต้องมีอย่างน้อย 8 ตัวอักษร มีตัวเลข ตัวอักษรภาษาอังกฤษ และอักขระพิเศษอย่างน้อยอย่างละ 1 ตัว

นำเข้ารายชื่อนักเรียน: เมนู Admin > รายชื่อนักเรียน > นำเข้า Excel / CSV โดยไฟล์มีหัวคอลัมน์ `ID`, `no`, `name`, `class`

---
© Anity Corubtion paperless PK school ALLRIGHT RESERVED
