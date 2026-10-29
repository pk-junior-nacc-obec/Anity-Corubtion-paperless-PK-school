-- =====================================================================
--  ไฟล์ตรวจสอบ (อ่านอย่างเดียว ไม่แก้ไขข้อมูล)
--  ใช้เมื่อ "นักเรียนส่งงานแล้ว แต่หน้าครูไม่แสดง"
--  รันทีละส่วนใน Supabase > SQL Editor แล้วดูผลลัพธ์
-- =====================================================================

-- 1) งานที่นักเรียนส่งล่าสุด 30 รายการ พร้อมห้องของนักเรียน
--    ถ้าไม่มีแถวเลย = คำตอบไม่ได้ถูกบันทึกลงฐานข้อมูล (ให้ดูข้อความแจ้งเตือนที่หน้านักเรียน)
select sb.updated_at, sb.student_id, coalesce(u.name, d.name) as name,
       d.class as class_in_data, u.class as class_in_userstudent,
       sb.worksheet_id, w.sheet_name, w.classes as worksheet_classes,
       sb.status, sb.answered_count, sb.total_questions, sb.score
  from public.submissions sb
  left join public.data d        on d."ID" = sb.student_id
  left join public.userstudent u on u."ID" = sb.student_id
  left join public.worksheets w  on w.id = sb.worksheet_id
 order by sb.updated_at desc
 limit 30;

-- 2) ห้องที่ครูแต่ละคนรับผิดชอบ เทียบกับห้องที่มีอยู่จริงในตาราง data
--    ช่อง missing_in_data ต้องว่าง ถ้ามีค่า = ชื่อห้องของครูไม่ตรงกับรายชื่อนักเรียน
select t.username, t.name, t.class as teacher_class,
       public._teacher_classes(t.class) as parsed_classes,
       array(select c from unnest(public._teacher_classes(t.class)) c
              where not exists (select 1 from public.data d
                                 where public._norm_class(d.class) = public._norm_class(c))) as missing_in_data
  from public.userteacher t order by t.username;

-- 3) ชื่อห้องทั้งหมดในระบบ (ใส่ [ ] เพื่อให้เห็นช่องว่างที่ซ่อนอยู่)
select '[' || class || ']' as class_raw, public._norm_class(class) as normalized, count(*) as students
  from public.data group by class order by 2, 1;

-- 4) นักเรียนที่ห้องในบัญชี (userstudent) ไม่ตรงกับตาราง data
select u."ID", u.name, u.class as userstudent_class, d.class as data_class
  from public.userstudent u join public.data d on d."ID" = u."ID"
 where public._norm_class(u.class) <> public._norm_class(d.class);
