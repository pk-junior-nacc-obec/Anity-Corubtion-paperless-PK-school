-- =====================================================================
--  ข้อมูลตัวอย่าง (ไม่บังคับ) : รันหลัง 01_schema.sql เพื่อทดลองระบบ
--  ลบออกได้ภายหลังจากหน้า Admin หรือ Table Editor
-- =====================================================================

-- รายชื่อนักเรียนต้นฉบับ (ตาราง data)
insert into public.data ("ID", no, name, class) values
  ('10001', 1, 'เด็กชายสมชาย ใจดี',     'ม.1/1'),
  ('10002', 2, 'เด็กหญิงสมหญิง รักเรียน', 'ม.1/1'),
  ('10003', 3, 'เด็กชายภูผา เขียวขจี',   'ม.1/1'),
  ('10004', 1, 'เด็กหญิงมะลิ ซื่อตรง',    'ม.1/2'),
  ('10005', 2, 'เด็กชายกล้า สุจริต',     'ม.1/2')
on conflict ("ID") do nothing;

-- ครูตัวอย่าง (username: teacher1 / password: Teacher@1234) รับผิดชอบ ม.1/1 และ ม.1/2
insert into public.userteacher (username, password, name, class, tel)
values ('teacher1', public._hash_pw('Teacher@1234'), 'ครูใจงาม ยุติธรรม', 'ม.1/1,ม.1/2', '0800000000')
on conflict (username) do nothing;

-- หน่วยการเรียนรู้ + ใบงานตัวอย่าง
do $$
declare u1 bigint; w1 bigint; w2 bigint;
begin
  if exists (select 1 from public.units) then return; end if;

  insert into public.units(unit_no, unit_name) values (1, 'การคิดแยกแยะระหว่างผลประโยชน์ส่วนตนและผลประโยชน์ส่วนรวม')
    returning id into u1;

  insert into public.worksheets(unit_id, sheet_no, sheet_name, full_score, description, classes)
  values (u1, 1, 'ความหมายของผลประโยชน์ส่วนตน', 10, 'ให้นักเรียนตอบคำถามทุกข้อ', '{ม.1/1,ม.1/2}')
  returning id into w1;

  insert into public.questions(worksheet_id, q_no, question_text, answer_type, options, settings) values
    (w1, 1, 'ผลประโยชน์ส่วนตน หมายถึงอะไร จงอธิบาย', 'paragraph', '[]', '{}'),
    (w1, 2, 'ข้อใดเป็นการทุจริตต่อหน้าที่', 'single',
       '["นำของใช้สำนักงานไปใช้ส่วนตัว","ทำงานตรงเวลา","คืนเงินทอนที่เกินมา","ช่วยเพื่อนทำความสะอาด"]', '{}'),
    (w1, 3, 'เลือกพฤติกรรมที่แสดงถึงความซื่อสัตย์ (ตอบได้มากกว่า 1 ข้อ)', 'multiple',
       '["ไม่ลอกการบ้านเพื่อน","เก็บของได้แล้วส่งคืน","แซงคิว","ยอมรับผิดเมื่อทำผิด"]', '{}'),
    (w1, 4, 'จับคู่คำศัพท์กับความหมายให้ถูกต้อง', 'matching', '[]',
       '{"left":["สุจริต","ทุจริต","พอเพียง"],"right":["ประพฤติชอบ","ประพฤติมิชอบ","ใช้ชีวิตพอประมาณ"]}'),
    (w1, 5, 'นักเรียนเห็นด้วยกับการต่อต้านการทุจริตมากน้อยเพียงใด', 'scale', '[]',
       '{"min":1,"max":5,"min_label":"น้อยที่สุด","max_label":"มากที่สุด"}'),
    (w1, 6, 'ให้คะแนนความเข้าใจของตนเองในหน่วยนี้', 'stars', '[]', '{"count":5}');

  insert into public.worksheets(unit_id, sheet_no, sheet_name, full_score, description, classes)
  values (u1, 2, 'กรณีศึกษาในโรงเรียน', 10, 'อ่านสถานการณ์แล้วตอบคำถาม', '{ม.1/1}')
  returning id into w2;

  insert into public.questions(worksheet_id, q_no, question_text, answer_type, options, settings) values
    (w2, 1, 'ถ้าเพื่อนขอให้ช่วยบอกคำตอบระหว่างสอบ นักเรียนจะทำอย่างไร', 'short', '[]', '{}'),
    (w2, 2, 'เลือกระดับชั้นของนักเรียน', 'dropdown', '["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"]', '{}');
end $$;
