-- =====================================================================
--  Anity Corubtion paperless PK school
--  Supabase SQL Editor : สร้างตาราง + ฟังก์ชันทั้งหมด (รันไฟล์นี้ก่อน)
--  ทุกตารางมีคอลัมน์ id (Primary Key) สำหรับอ้างอิง
--  ความปลอดภัย: เปิด RLS ทุกตาราง (ไม่มี policy) -> เว็บเข้าถึงข้อมูล
--  ได้เฉพาะผ่านฟังก์ชัน RPC ด้านล่างเท่านั้น และรหัสผ่านถูกเข้ารหัส bcrypt
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) ตาราง data : รายชื่อนักเรียนต้นฉบับ (ใช้ดึง เลขที่ / ชื่อ-สกุล / ระดับชั้น)
-- ---------------------------------------------------------------------
create table if not exists public.data (
  id          bigint generated always as identity primary key,
  "ID"        text not null unique check ("ID" ~ '^[0-9]{5}$'),   -- รหัสนักเรียน 5 หลัก
  no          integer,                                            -- เลขที่
  name        text not null,                                      -- ชื่อ - สกุล
  class       text not null,                                      -- ระดับชั้น เช่น ม.1/1
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) ตาราง userstudent : บัญชีนักเรียนที่ลงทะเบียนแล้ว
-- ---------------------------------------------------------------------
create table if not exists public.userstudent (
  id          bigint generated always as identity primary key,
  "ID"        text not null unique,          -- รหัสนักเรียน (ใช้เป็น username)
  no          integer,
  name        text not null,
  class       text,
  tel         text not null,                 -- เก็บเป็นตัวเลข 10 หลัก
  password    text not null,                 -- bcrypt hash
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) ตาราง userteacher : บัญชีครู (class = ระดับชั้นที่รับผิดชอบ
--    ถ้ารับผิดชอบหลายห้องให้คั่นด้วย , เช่น  ม.1/1,ม.1/2)
-- ---------------------------------------------------------------------
create table if not exists public.userteacher (
  id          bigint generated always as identity primary key,
  username    text not null unique,
  password    text not null,
  name        text not null,
  class       text not null,
  tel         text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4) ตาราง admin : บัญชีผู้ดูแลระบบ (position = 'Admin')
-- ---------------------------------------------------------------------
create table if not exists public.admin (
  id          bigint generated always as identity primary key,
  username    text not null unique,
  password    text not null,
  name        text not null,
  "position"  text not null default 'Admin',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) ตาราง reset_attempts : บันทึกการตั้งรหัสผ่านใหม่ (ป้องกันการเดาเบอร์โทร)
-- ---------------------------------------------------------------------
create table if not exists public.reset_attempts (
  id          bigint generated always as identity primary key,
  student_id  text not null,
  success     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists reset_attempts_lookup on public.reset_attempts (student_id, created_at desc);

-- ลบระบบ OTP ของเวอร์ชันก่อนหน้า (ถ้าเคยรันไว้)
drop function if exists public.create_otp(text, text, text);
drop function if exists public.create_otp(text, text, text, text);
drop function if exists public.verify_otp(text, text, text, text);
drop function if exists public.verify_otp(text, text, text, text, text);
drop function if exists public.complete_otp(text, text, text, uuid, text);
drop function if exists public.complete_otp(text, text, text, text, uuid, text);
drop function if exists public._norm_email(text);
drop table if exists public.otp_codes;

-- ---------------------------------------------------------------------
-- 6) ตาราง app_sessions : session การเข้าสู่ระบบ (อายุ 12 ชม.)
-- ---------------------------------------------------------------------
create table if not exists public.app_sessions (
  id            bigint generated always as identity primary key,
  token         uuid not null unique default gen_random_uuid(),
  role          text not null check (role in ('student','teacher','admin')),
  user_ref      text not null,          -- student: รหัสนักเรียน / teacher, admin: username
  display_name  text,
  class         text,
  expires_at    timestamptz not null default now() + interval '12 hours',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7) ตาราง units : หน่วยการเรียนรู้
-- ---------------------------------------------------------------------
create table if not exists public.units (
  id          bigint generated always as identity primary key,
  unit_no     integer not null,          -- หน่วยการเรียนรู้ที่
  unit_name   text not null,             -- ชื่อหน่วยการเรียนรู้
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8) ตาราง worksheets : ใบงาน
-- ---------------------------------------------------------------------
create table if not exists public.worksheets (
  id          bigint generated always as identity primary key,
  unit_id     bigint not null references public.units(id) on delete cascade,
  sheet_no    integer not null,                    -- ใบงานที่
  sheet_name  text not null,                       -- ชื่อใบงาน
  full_score  numeric(6,2) not null default 10 check (full_score >= 0),  -- คะแนนเต็ม
  description text,                                -- คำชี้แจง
  classes     text[] not null default '{}',        -- ระดับชั้น/ห้องที่ทำใบงานนี้ได้ เช่น {ม.1/1,ม.1/2}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.worksheets add column if not exists classes text[] not null default '{}';
create index if not exists worksheets_unit on public.worksheets(unit_id);

-- ---------------------------------------------------------------------
-- 9) ตาราง questions : รายละเอียดใบงาน (ข้อที่ / คำถาม / รูป / รูปแบบคำตอบ)
--    answer_type : paragraph | short | single | multiple | dropdown
--                  | matching | scale | stars
--    options     : ตัวเลือก (single / multiple / dropdown)  ["ก","ข",...]
--    settings    : matching -> {"left":[...],"right":[...]}
--                  scale    -> {"min":1,"max":5,"min_label":"","max_label":""}
--                  stars    -> {"count":5}
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id             bigint generated always as identity primary key,
  worksheet_id   bigint not null references public.worksheets(id) on delete cascade,
  q_no           integer not null,                 -- ข้อที่
  question_text  text,                             -- คำถามแบบตัวหนังสือ
  image_data     text,                             -- รูปภาพ (data URL ที่ย่อขนาดแล้ว)
  image_source   text,                             -- ที่มาของรูป
  answer_type    text not null default 'short'
                 check (answer_type in ('paragraph','short','single','multiple','dropdown','matching','scale','stars')),
  options        jsonb not null default '[]'::jsonb,
  settings       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists questions_ws on public.questions(worksheet_id, q_no);

-- ---------------------------------------------------------------------
-- 10) ตาราง submissions : การทำใบงานของนักเรียน + คะแนนจากครู
--     status : none (ยังไม่ทำ) | partial (ทำไม่ครบ) | complete (ทำครบแล้ว)
-- ---------------------------------------------------------------------
create table if not exists public.submissions (
  id               bigint generated always as identity primary key,
  worksheet_id     bigint not null references public.worksheets(id) on delete cascade,
  student_id       text not null,                  -- รหัสนักเรียน
  answers          jsonb not null default '{}'::jsonb,  -- {"<question id>": คำตอบ}
  answered_count   integer not null default 0,
  total_questions  integer not null default 0,
  status           text not null default 'none' check (status in ('none','partial','complete')),
  submitted_at     timestamptz,
  score            numeric(6,2),
  feedback         text,
  graded_by        text,
  graded_at        timestamptz,
  updated_at       timestamptz not null default now(),
  unique (worksheet_id, student_id)
);
create index if not exists submissions_student on public.submissions(student_id);

-- เปิด RLS ทุกตาราง (ไม่สร้าง policy = ห้ามเข้าถึงตรงด้วย publishable key)
alter table public.data          enable row level security;
alter table public.userstudent   enable row level security;
alter table public.userteacher   enable row level security;
alter table public.admin         enable row level security;
alter table public.reset_attempts enable row level security;
alter table public.app_sessions  enable row level security;
alter table public.units         enable row level security;
alter table public.worksheets    enable row level security;
alter table public.questions     enable row level security;
alter table public.submissions   enable row level security;

-- =====================================================================
--  ฟังก์ชันภายใน (helper)
-- =====================================================================
create or replace function public._hash_pw(p text)
returns text language sql volatile security definer set search_path = public, extensions as $$
  select extensions.crypt(p, extensions.gen_salt('bf', 10));
$$;

-- รองรับทั้งรหัสที่ hash แล้ว และรหัสที่พิมพ์ตรง ๆ ใน Table Editor (จะถูก hash อัตโนมัติเมื่อ login)
create or replace function public._check_pw(p text, h text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select case
    when h is null or p is null then false
    when h ~ '^\$2[abxy]?\$' then extensions.crypt(p, h) = h
    else p = h
  end;
$$;

create or replace function public._strong_pw(p text)
returns boolean language sql immutable as $$
  select p is not null and length(p) >= 8
     and p ~ '[0-9]' and p ~ '[A-Za-z]' and p ~ '[^A-Za-z0-9]';
$$;

create or replace function public._auth(p_token uuid, p_roles text[])
returns public.app_sessions language plpgsql security definer set search_path = public as $$
declare s public.app_sessions;
begin
  select * into s from public.app_sessions where token = p_token and expires_at > now();
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  if not (s.role = any(p_roles)) then raise exception 'FORBIDDEN'; end if;
  return s;
end $$;

create or replace function public._teacher_classes(p_class text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
  from unnest(string_to_array(coalesce(p_class,''), ',')) as x;
$$;

-- ตรวจว่าคำตอบ 1 ข้อ "ตอบแล้ว" หรือยัง
create or replace function public._is_answered(p_type text, p_settings jsonb, a jsonb)
returns boolean language sql immutable as $$
  select case
    when a is null or jsonb_typeof(a) = 'null' then false
    when jsonb_typeof(a) = 'string' then btrim(a #>> '{}') <> ''
    when jsonb_typeof(a) = 'number' then true
    when jsonb_typeof(a) = 'array'  then jsonb_array_length(a) > 0
    when jsonb_typeof(a) = 'object' then
      (select count(*) from jsonb_each_text(a) e where coalesce(e.value,'') <> '')
        >= greatest(1, case when jsonb_typeof(p_settings->'left') = 'array'
                            then jsonb_array_length(p_settings->'left') else 1 end)
    else false
  end;
$$;

-- คำนวณสถานะการทำใบงานใหม่ (เมื่อ admin แก้ไขข้อคำถาม)
create or replace function public._recompute_ws(p_ws bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.submissions s
     set total_questions = x.total,
         answered_count  = x.done,
         status = case when x.done = 0 then 'none'
                       when x.done >= x.total then 'complete'
                       else 'partial' end
    from (
      select s2.id,
             count(q.id) as total,
             count(q.id) filter (where public._is_answered(q.answer_type, q.settings, s2.answers -> (q.id::text))) as done
        from public.submissions s2
        left join public.questions q on q.worksheet_id = s2.worksheet_id
       where s2.worksheet_id = p_ws
       group by s2.id
    ) x
   where s.id = x.id;
end $$;

-- =====================================================================
--  เข้าสู่ระบบ / ออกจากระบบ
-- =====================================================================
create or replace function public.app_login(p_role text, p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint; v_user text; v_name text; v_class text; v_hash text; v_token uuid;
begin
  p_username := btrim(coalesce(p_username,''));
  if p_role = 'student' then
    select id, "ID", name, class, password into v_id, v_user, v_name, v_class, v_hash
      from public.userstudent where "ID" = p_username;
  elsif p_role = 'teacher' then
    select id, username, name, class, password into v_id, v_user, v_name, v_class, v_hash
      from public.userteacher where username = p_username;
  elsif p_role = 'admin' then
    select id, username, name, null, password into v_id, v_user, v_name, v_class, v_hash
      from public.admin where username = p_username and lower(btrim("position")) = 'admin';
  else
    raise exception 'INVALID_ROLE';
  end if;

  if v_id is null or not public._check_pw(p_password, v_hash) then
    perform pg_sleep(0.5);
    raise exception 'INVALID_LOGIN';
  end if;

  -- อัปเกรดรหัสที่ยังไม่ได้ hash
  if v_hash !~ '^\$2[abxy]?\$' then
    if p_role = 'student' then update public.userstudent set password = public._hash_pw(p_password) where id = v_id;
    elsif p_role = 'teacher' then update public.userteacher set password = public._hash_pw(p_password) where id = v_id;
    else update public.admin set password = public._hash_pw(p_password) where id = v_id; end if;
  end if;

  delete from public.app_sessions where expires_at < now();
  insert into public.app_sessions(role, user_ref, display_name, class)
       values (p_role, v_user, v_name, v_class)
    returning token into v_token;

  return json_build_object('token', v_token, 'role', p_role, 'username', v_user,
                           'name', v_name, 'class', v_class);
end $$;

create or replace function public.app_logout(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.app_sessions where token = p_token;
$$;

create or replace function public.app_me(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions;
begin
  s := public._auth(p_token, array['student','teacher','admin']);
  return json_build_object('role', s.role, 'username', s.user_ref, 'name', s.display_name, 'class', s.class);
end $$;

-- =====================================================================
--  ลงทะเบียน / ลืมรหัสผ่าน
-- =====================================================================
-- ค้นหาข้อมูลนักเรียนจากตาราง data ด้วยรหัส 5 หลัก
create or replace function public.student_lookup(p_student_id text)
returns json language plpgsql security definer set search_path = public as $$
declare d public.data; v_reg boolean;
begin
  if p_student_id !~ '^[0-9]{5}$' then raise exception 'INVALID_STUDENT_ID'; end if;
  select * into d from public.data where "ID" = p_student_id;
  if not found then return json_build_object('found', false); end if;
  select exists(select 1 from public.userstudent where "ID" = p_student_id) into v_reg;
  return json_build_object('found', true, 'ID', d."ID", 'no', d.no, 'name', d.name,
                           'class', d.class, 'registered', v_reg);
end $$;

-- ลงทะเบียน : ตั้งรหัสผ่านเองได้ทันที (ไม่ใช้ OTP)
create or replace function public.student_register(p_student_id text, p_tel text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare d public.data;
begin
  p_student_id := btrim(coalesce(p_student_id, ''));
  p_tel := regexp_replace(coalesce(p_tel,''), '[^0-9]', '', 'g');
  if p_student_id !~ '^[0-9]{5}$' then raise exception 'INVALID_STUDENT_ID'; end if;
  if p_tel !~ '^0[0-9]{9}$' then raise exception 'INVALID_TEL'; end if;
  if not public._strong_pw(p_password) then raise exception 'WEAK_PASSWORD'; end if;
  select * into d from public.data where "ID" = p_student_id;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if exists (select 1 from public.userstudent where "ID" = p_student_id) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  insert into public.userstudent("ID", no, name, class, tel, password)
       values (d."ID", d.no, d.name, d.class, p_tel, public._hash_pw(p_password));
  return json_build_object('ok', true);
end $$;

-- ลืมรหัสผ่าน : ต้องใช้เบอร์โทรเดิมที่ลงทะเบียนไว้เท่านั้น
-- (กรอกเบอร์ผิดได้ไม่เกิน 5 ครั้งใน 15 นาที)
create or replace function public.student_reset_password(p_student_id text, p_tel text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_user public.userstudent; v_fail int;
begin
  p_student_id := btrim(coalesce(p_student_id, ''));
  p_tel := regexp_replace(coalesce(p_tel,''), '[^0-9]', '', 'g');
  if p_student_id !~ '^[0-9]{5}$' then raise exception 'INVALID_STUDENT_ID'; end if;
  if p_tel !~ '^0[0-9]{9}$' then raise exception 'INVALID_TEL'; end if;
  if not public._strong_pw(p_password) then raise exception 'WEAK_PASSWORD'; end if;

  select * into v_user from public.userstudent where "ID" = p_student_id;
  if not found then raise exception 'NOT_REGISTERED'; end if;

  delete from public.reset_attempts where created_at < now() - interval '1 day';
  select count(*) into v_fail from public.reset_attempts
   where student_id = p_student_id and not success and created_at > now() - interval '15 minutes';
  if v_fail >= 5 then return json_build_object('ok', false, 'error', 'TOO_MANY_ATTEMPTS'); end if;

  if v_user.tel <> p_tel then
    insert into public.reset_attempts(student_id, success) values (p_student_id, false);
    perform pg_sleep(0.5);
    return json_build_object('ok', false, 'error', 'TEL_MISMATCH', 'remaining', 4 - v_fail);
  end if;

  update public.userstudent set password = public._hash_pw(p_password), updated_at = now()
   where id = v_user.id;
  insert into public.reset_attempts(student_id, success) values (p_student_id, true);
  delete from public.app_sessions where role = 'student' and user_ref = p_student_id;
  return json_build_object('ok', true);
end $$;

-- =====================================================================
--  ใบงาน (ทุกบทบาทอ่านได้)
-- =====================================================================
-- ใบงานนี้แสดงให้ห้อง p_class หรือไม่ (classes ว่าง = ทุกห้อง สำหรับใบงานเก่า)
create or replace function public._ws_visible(p_classes text[], p_class text)
returns boolean language sql immutable as $$
  select coalesce(cardinality(p_classes), 0) = 0 or coalesce(p_class, '') = any(p_classes)
$$;

create or replace function public.list_curriculum(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions;
begin
  s := public._auth(p_token, array['student','teacher','admin']);
  return coalesce((
    select json_agg(json_build_object(
      'id', u.id, 'unit_no', u.unit_no, 'unit_name', u.unit_name,
      'worksheets', coalesce((
        select json_agg(json_build_object(
          'id', w.id, 'sheet_no', w.sheet_no, 'sheet_name', w.sheet_name,
          'full_score', w.full_score, 'description', w.description,
          'classes', case when s.role = 'student' then null else to_json(w.classes) end,
          'question_count', (select count(*) from public.questions q where q.worksheet_id = w.id),
          'status', case when s.role = 'student' then coalesce(sb.status, 'none') end,
          'answered_count', sb.answered_count,
          'score', case when s.role = 'student' then sb.score end
        ) order by w.sheet_no, w.id)
        from public.worksheets w
        left join public.submissions sb
               on sb.worksheet_id = w.id and s.role = 'student' and sb.student_id = s.user_ref
       where w.unit_id = u.id
         and (s.role <> 'student' or public._ws_visible(w.classes, s.class))), '[]'::json)
    ) order by u.unit_no, u.id)
    from public.units u
   where s.role <> 'student'
      or exists (select 1 from public.worksheets w2
                  where w2.unit_id = u.id and public._ws_visible(w2.classes, s.class))), '[]'::json);
end $$;

create or replace function public._worksheet_json(p_ws bigint)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', w.id, 'unit_id', w.unit_id, 'unit_no', u.unit_no, 'unit_name', u.unit_name,
    'sheet_no', w.sheet_no, 'sheet_name', w.sheet_name, 'full_score', w.full_score,
    'description', w.description, 'classes', to_json(w.classes),
    'questions', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'q_no', q.q_no, 'question_text', q.question_text,
        'image_data', q.image_data, 'image_source', q.image_source,
        'answer_type', q.answer_type, 'options', q.options, 'settings', q.settings
      ) order by q.q_no, q.id)
      from public.questions q where q.worksheet_id = w.id), '[]'::json))
  from public.worksheets w join public.units u on u.id = w.unit_id
  where w.id = p_ws;
$$;

create or replace function public.get_worksheet(p_token uuid, p_worksheet_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; v_ws json; v_sub json;
begin
  s := public._auth(p_token, array['student','teacher','admin']);
  v_ws := public._worksheet_json(p_worksheet_id);
  if v_ws is null then raise exception 'NOT_FOUND'; end if;
  if s.role = 'student' then
    if not exists (select 1 from public.worksheets where id = p_worksheet_id and public._ws_visible(classes, s.class)) then
      raise exception 'NOT_ASSIGNED';
    end if;
    select row_to_json(x) into v_sub from (
      select answers, status, answered_count, total_questions, score, feedback, graded_at, submitted_at, updated_at
        from public.submissions where worksheet_id = p_worksheet_id and student_id = s.user_ref) x;
  end if;
  return json_build_object('worksheet', v_ws, 'submission', v_sub);
end $$;

-- นักเรียนบันทึกคำตอบ
create or replace function public.student_save_answers(p_token uuid, p_worksheet_id bigint, p_answers jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; v_total int; v_done int; v_status text; v_old public.submissions;
begin
  s := public._auth(p_token, array['student']);
  if not exists (select 1 from public.worksheets where id = p_worksheet_id) then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from public.worksheets where id = p_worksheet_id and public._ws_visible(classes, s.class)) then
    raise exception 'NOT_ASSIGNED';
  end if;
  select * into v_old from public.submissions where worksheet_id = p_worksheet_id and student_id = s.user_ref;
  if found and v_old.score is not null then raise exception 'ALREADY_GRADED'; end if;

  select count(*), count(*) filter (where public._is_answered(q.answer_type, q.settings, p_answers -> (q.id::text)))
    into v_total, v_done
    from public.questions q where q.worksheet_id = p_worksheet_id;
  v_status := case when v_done = 0 then 'none' when v_done >= v_total then 'complete' else 'partial' end;

  insert into public.submissions(worksheet_id, student_id, answers, answered_count, total_questions, status, submitted_at, updated_at)
       values (p_worksheet_id, s.user_ref, coalesce(p_answers,'{}'::jsonb), v_done, v_total, v_status,
               case when v_status = 'complete' then now() end, now())
  on conflict (worksheet_id, student_id) do update
     set answers = excluded.answers, answered_count = excluded.answered_count,
         total_questions = excluded.total_questions, status = excluded.status,
         submitted_at = case when excluded.status = 'complete'
                             then coalesce(public.submissions.submitted_at, now()) else null end,
         updated_at = now();

  return json_build_object('status', v_status, 'answered_count', v_done, 'total_questions', v_total);
end $$;

-- =====================================================================
--  ครู / Admin : รายงานผลรายห้อง และการให้คะแนน
-- =====================================================================
create or replace function public.list_classes(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions;
begin
  s := public._auth(p_token, array['teacher','admin']);
  if s.role = 'teacher' then
    return to_json(public._teacher_classes(s.class));
  end if;
  return coalesce((select json_agg(c order by c) from (
            select distinct class as c from public.data where class is not null
            union select distinct class from public.userstudent where class is not null) t), '[]'::json);
end $$;

create or replace function public.class_report(p_token uuid, p_class text)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; v_students json; v_ws json; v_cells json;
begin
  s := public._auth(p_token, array['teacher','admin']);
  if s.role = 'teacher' and not (p_class = any(public._teacher_classes(s.class))) then
    raise exception 'FORBIDDEN';
  end if;

  with st as (
    select d."ID" as sid, d.no, coalesce(u.name, d.name) as name, (u.id is not null) as registered
      from public.data d left join public.userstudent u on u."ID" = d."ID"
     where d.class = p_class
    union all
    select u."ID", u.no, u.name, true
      from public.userstudent u
     where u.class = p_class and not exists (select 1 from public.data d where d."ID" = u."ID")
  )
  select coalesce(json_agg(json_build_object('ID', sid, 'no', no, 'name', name, 'registered', registered)
                           order by no nulls last, sid), '[]'::json)
    into v_students from st;

  select coalesce(json_agg(json_build_object('id', w.id, 'unit_id', u.id, 'unit_no', u.unit_no,
                    'unit_name', u.unit_name, 'sheet_no', w.sheet_no, 'sheet_name', w.sheet_name,
                    'full_score', w.full_score) order by u.unit_no, u.id, w.sheet_no, w.id), '[]'::json)
    into v_ws
    from public.worksheets w join public.units u on u.id = w.unit_id
   where public._ws_visible(w.classes, p_class);

  select coalesce(json_agg(json_build_object('student_id', sb.student_id, 'worksheet_id', sb.worksheet_id,
                    'status', sb.status, 'score', sb.score, 'answered_count', sb.answered_count,
                    'total_questions', sb.total_questions)), '[]'::json)
    into v_cells
    from public.submissions sb
   where sb.student_id in (
          select d."ID" from public.data d where d.class = p_class
          union select u."ID" from public.userstudent u where u.class = p_class);

  return json_build_object('class', p_class, 'students', v_students, 'worksheets', v_ws, 'cells', v_cells);
end $$;

create or replace function public._student_class(p_student text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select class from public.userstudent where "ID" = p_student),
                  (select class from public.data where "ID" = p_student));
$$;

create or replace function public.get_submission(p_token uuid, p_worksheet_id bigint, p_student_id text)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; v_sub json; v_student json;
begin
  s := public._auth(p_token, array['teacher','admin']);
  if s.role = 'teacher' and not (public._student_class(p_student_id) = any(public._teacher_classes(s.class))) then
    raise exception 'FORBIDDEN';
  end if;
  select row_to_json(x) into v_sub from (
    select answers, status, answered_count, total_questions, score, feedback, graded_by, graded_at, submitted_at, updated_at
      from public.submissions where worksheet_id = p_worksheet_id and student_id = p_student_id) x;
  select json_build_object('ID', d."ID", 'no', d.no, 'name', coalesce(u.name, d.name), 'class', coalesce(u.class, d.class))
    into v_student
    from (select p_student_id as sid) k
    left join public.data d on d."ID" = k.sid
    left join public.userstudent u on u."ID" = k.sid;
  return json_build_object('worksheet', public._worksheet_json(p_worksheet_id),
                           'submission', v_sub, 'student', v_student);
end $$;

create or replace function public.grade_submission(p_token uuid, p_worksheet_id bigint, p_student_id text,
                                                   p_score numeric, p_feedback text)
returns json language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; v_full numeric;
begin
  s := public._auth(p_token, array['teacher','admin']);
  if s.role = 'teacher' and not (public._student_class(p_student_id) = any(public._teacher_classes(s.class))) then
    raise exception 'FORBIDDEN';
  end if;
  select full_score into v_full from public.worksheets where id = p_worksheet_id;
  if v_full is null then raise exception 'NOT_FOUND'; end if;
  if p_score is not null and (p_score < 0 or p_score > v_full) then raise exception 'SCORE_OUT_OF_RANGE'; end if;

  insert into public.submissions(worksheet_id, student_id, score, feedback, graded_by, graded_at,
                                 total_questions)
       values (p_worksheet_id, p_student_id, p_score, p_feedback, s.display_name,
               case when p_score is not null then now() end,
               (select count(*) from public.questions where worksheet_id = p_worksheet_id))
  on conflict (worksheet_id, student_id) do update
     set score = excluded.score, feedback = excluded.feedback,
         graded_by = excluded.graded_by, graded_at = excluded.graded_at, updated_at = now();
  return json_build_object('ok', true);
end $$;

-- =====================================================================
--  Admin : จัดการหน่วย / ใบงาน / ผู้ใช้
-- =====================================================================
create or replace function public.admin_save_unit(p_token uuid, p_id bigint, p_unit_no integer, p_unit_name text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public._auth(p_token, array['admin']);
  if p_unit_no is null or btrim(coalesce(p_unit_name,'')) = '' then raise exception 'REQUIRED_FIELDS'; end if;
  if p_id is null then
    insert into public.units(unit_no, unit_name) values (p_unit_no, btrim(p_unit_name)) returning id into v_id;
  else
    update public.units set unit_no = p_unit_no, unit_name = btrim(p_unit_name) where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_unit(p_token uuid, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._auth(p_token, array['admin']);
  delete from public.units where id = p_id;
end $$;

create or replace function public.admin_save_worksheet(p_token uuid, p_ws jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; q jsonb; v_keep bigint[] := '{}'; v_qid bigint; i int := 0; v_classes text[];
begin
  perform public._auth(p_token, array['admin']);
  if (p_ws->>'unit_id') is null or (p_ws->>'sheet_no') is null or btrim(coalesce(p_ws->>'sheet_name','')) = '' then
    raise exception 'REQUIRED_FIELDS';
  end if;
  select coalesce(array_agg(distinct c order by c), '{}') into v_classes
    from (select btrim(x) as c from jsonb_array_elements_text(coalesce(p_ws->'classes', '[]'::jsonb)) x) t
   where c <> '';
  if cardinality(v_classes) = 0 then raise exception 'CLASSES_REQUIRED'; end if;

  if (p_ws->>'id') is null then
    insert into public.worksheets(unit_id, sheet_no, sheet_name, full_score, description, classes)
         values ((p_ws->>'unit_id')::bigint, (p_ws->>'sheet_no')::int, btrim(p_ws->>'sheet_name'),
                 coalesce((p_ws->>'full_score')::numeric, 10), p_ws->>'description', v_classes)
      returning id into v_id;
  else
    v_id := (p_ws->>'id')::bigint;
    update public.worksheets
       set unit_id = (p_ws->>'unit_id')::bigint, sheet_no = (p_ws->>'sheet_no')::int,
           sheet_name = btrim(p_ws->>'sheet_name'), full_score = coalesce((p_ws->>'full_score')::numeric, 10),
           description = p_ws->>'description', classes = v_classes, updated_at = now()
     where id = v_id;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;

  for q in select value from jsonb_array_elements(coalesce(p_ws->'questions', '[]'::jsonb)) loop
    i := i + 1;
    v_qid := null;
    if (q->>'id') is not null then
      update public.questions
         set q_no = i, question_text = q->>'question_text', image_data = q->>'image_data',
             image_source = q->>'image_source', answer_type = coalesce(q->>'answer_type','short'),
             options = coalesce(q->'options','[]'::jsonb), settings = coalesce(q->'settings','{}'::jsonb)
       where id = (q->>'id')::bigint and worksheet_id = v_id
      returning id into v_qid;
    end if;
    if v_qid is null then
      insert into public.questions(worksheet_id, q_no, question_text, image_data, image_source, answer_type, options, settings)
           values (v_id, i, q->>'question_text', q->>'image_data', q->>'image_source',
                   coalesce(q->>'answer_type','short'), coalesce(q->'options','[]'::jsonb),
                   coalesce(q->'settings','{}'::jsonb))
        returning id into v_qid;
    end if;
    v_keep := v_keep || v_qid;
  end loop;

  delete from public.questions where worksheet_id = v_id and not (id = any(v_keep));
  perform public._recompute_ws(v_id);
  return v_id;
end $$;

create or replace function public.admin_delete_worksheet(p_token uuid, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._auth(p_token, array['admin']);
  delete from public.worksheets where id = p_id;
end $$;

-- p_kind : student | teacher | admin | data
create or replace function public.admin_list_users(p_token uuid, p_kind text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform public._auth(p_token, array['admin']);
  if p_kind = 'student' then
    return coalesce((select json_agg(json_build_object('id', id, 'ID', "ID", 'no', no, 'name', name,
             'class', class, 'tel', tel, 'created_at', created_at) order by class, no, "ID") from public.userstudent), '[]'::json);
  elsif p_kind = 'teacher' then
    return coalesce((select json_agg(json_build_object('id', id, 'username', username, 'name', name,
             'class', class, 'tel', tel) order by name) from public.userteacher), '[]'::json);
  elsif p_kind = 'admin' then
    return coalesce((select json_agg(json_build_object('id', id, 'username', username, 'name', name,
             'position', "position") order by id) from public.admin), '[]'::json);
  elsif p_kind = 'data' then
    return coalesce((select json_agg(json_build_object('id', d.id, 'ID', d."ID", 'no', d.no, 'name', d.name,
             'class', d.class, 'registered', exists(select 1 from public.userstudent u where u."ID" = d."ID"))
             order by d.class, d.no, d."ID") from public.data d), '[]'::json);
  end if;
  raise exception 'INVALID_KIND';
end $$;

create or replace function public.admin_save_user(p_token uuid, p_kind text, p jsonb)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare v_id bigint := (p->>'id')::bigint; v_pw text := nullif(p->>'password',''); v_old text; v_new text;
begin
  perform public._auth(p_token, array['admin']);
  if v_pw is not null and not public._strong_pw(v_pw) then raise exception 'WEAK_PASSWORD'; end if;

  if p_kind = 'student' then
    if v_id is null then raise exception 'REQUIRED_FIELDS'; end if;
    v_new := btrim(p->>'ID');
    if v_new !~ '^[0-9]{5}$' then raise exception 'INVALID_STUDENT_ID'; end if;
    select "ID" into v_old from public.userstudent where id = v_id;
    update public.userstudent
       set "ID" = v_new, name = coalesce(nullif(btrim(p->>'name'),''), name),
           tel = coalesce(nullif(regexp_replace(coalesce(p->>'tel',''),'[^0-9]','','g'),''), tel),
           password = coalesce(public._hash_pw(v_pw), password), updated_at = now()
     where id = v_id;
    if v_old is distinct from v_new then
      update public.submissions set student_id = v_new where student_id = v_old;
      delete from public.app_sessions where role = 'student' and user_ref = v_old;
    end if;
    if v_pw is not null then delete from public.app_sessions where role = 'student' and user_ref = v_new; end if;

  elsif p_kind = 'teacher' then
    if btrim(coalesce(p->>'username','')) = '' or btrim(coalesce(p->>'name','')) = '' or btrim(coalesce(p->>'class','')) = '' then
      raise exception 'REQUIRED_FIELDS';
    end if;
    if v_id is null then
      if v_pw is null then raise exception 'PASSWORD_REQUIRED'; end if;
      insert into public.userteacher(username, password, name, class, tel)
           values (btrim(p->>'username'), public._hash_pw(v_pw), btrim(p->>'name'), btrim(p->>'class'),
                   nullif(regexp_replace(coalesce(p->>'tel',''),'[^0-9]','','g'),''))
        returning id into v_id;
    else
      update public.userteacher
         set username = btrim(p->>'username'), name = btrim(p->>'name'), class = btrim(p->>'class'),
             tel = nullif(regexp_replace(coalesce(p->>'tel',''),'[^0-9]','','g'),''),
             password = coalesce(public._hash_pw(v_pw), password)
       where id = v_id;
      delete from public.app_sessions where role = 'teacher' and user_ref not in (select username from public.userteacher);
    end if;

  elsif p_kind = 'admin' then
    if btrim(coalesce(p->>'username','')) = '' or btrim(coalesce(p->>'name','')) = '' then raise exception 'REQUIRED_FIELDS'; end if;
    if v_id is null then
      if v_pw is null then raise exception 'PASSWORD_REQUIRED'; end if;
      insert into public.admin(username, password, name, "position")
           values (btrim(p->>'username'), public._hash_pw(v_pw), btrim(p->>'name'), 'Admin') returning id into v_id;
    else
      update public.admin set username = btrim(p->>'username'), name = btrim(p->>'name'),
             password = coalesce(public._hash_pw(v_pw), password) where id = v_id;
    end if;

  elsif p_kind = 'data' then
    if coalesce(p->>'ID','') !~ '^[0-9]{5}$' then raise exception 'INVALID_STUDENT_ID'; end if;
    if btrim(coalesce(p->>'name','')) = '' or btrim(coalesce(p->>'class','')) = '' then raise exception 'REQUIRED_FIELDS'; end if;
    if v_id is null then
      insert into public.data("ID", no, name, class)
           values (p->>'ID', nullif(p->>'no','')::int, btrim(p->>'name'), btrim(p->>'class')) returning id into v_id;
    else
      update public.data set "ID" = p->>'ID', no = nullif(p->>'no','')::int, name = btrim(p->>'name'),
             class = btrim(p->>'class') where id = v_id;
    end if;
  else
    raise exception 'INVALID_KIND';
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'DUPLICATE_USERNAME';
end $$;

create or replace function public.admin_delete_user(p_token uuid, p_kind text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; v_ref text;
begin
  s := public._auth(p_token, array['admin']);
  if p_kind = 'student' then
    delete from public.userstudent where id = p_id returning "ID" into v_ref;
    delete from public.app_sessions where role = 'student' and user_ref = v_ref;
  elsif p_kind = 'teacher' then
    delete from public.userteacher where id = p_id returning username into v_ref;
    delete from public.app_sessions where role = 'teacher' and user_ref = v_ref;
  elsif p_kind = 'admin' then
    if (select count(*) from public.admin) <= 1 then raise exception 'LAST_ADMIN'; end if;
    if exists (select 1 from public.admin where id = p_id and username = s.user_ref) then raise exception 'DELETE_SELF'; end if;
    delete from public.admin where id = p_id;
  elsif p_kind = 'data' then
    delete from public.data where id = p_id;
  else
    raise exception 'INVALID_KIND';
  end if;
end $$;

-- นำเข้ารายชื่อนักเรียนหลายคน (Excel / CSV) -> ตาราง data
create or replace function public.admin_import_data(p_token uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  perform public._auth(p_token, array['admin']);
  for r in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    if coalesce(r->>'ID','') ~ '^[0-9]{5}$' and btrim(coalesce(r->>'name','')) <> '' then
      insert into public.data("ID", no, name, class)
           values (r->>'ID', nullif(regexp_replace(coalesce(r->>'no',''),'[^0-9]','','g'),'')::int,
                   btrim(r->>'name'), btrim(coalesce(r->>'class','')))
      on conflict ("ID") do update set no = excluded.no, name = excluded.name, class = excluded.class;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- =====================================================================
--  สิทธิ์การเรียกใช้ฟังก์ชัน
-- =====================================================================
-- ฟังก์ชันภายใน : ห้ามเรียกจากเว็บ
revoke execute on function public._hash_pw(text)                     from public, anon, authenticated;
revoke execute on function public._check_pw(text, text)              from public, anon, authenticated;
revoke execute on function public._strong_pw(text)                   from public, anon, authenticated;
revoke execute on function public._auth(uuid, text[])                from public, anon, authenticated;
revoke execute on function public._teacher_classes(text)             from public, anon, authenticated;
revoke execute on function public._is_answered(text, jsonb, jsonb)   from public, anon, authenticated;
revoke execute on function public._recompute_ws(bigint)              from public, anon, authenticated;
revoke execute on function public._worksheet_json(bigint)            from public, anon, authenticated;
revoke execute on function public._student_class(text)               from public, anon, authenticated;
revoke execute on function public._ws_visible(text[], text)          from public, anon, authenticated;

-- ฟังก์ชันที่เว็บเรียกได้ (ทุกฟังก์ชันตรวจ token และบทบาทภายในอีกชั้น)
grant execute on function public.app_login(text, text, text)                         to anon, authenticated;
grant execute on function public.app_logout(uuid)                                    to anon, authenticated;
grant execute on function public.app_me(uuid)                                        to anon, authenticated;
grant execute on function public.student_lookup(text)                                to anon, authenticated;
grant execute on function public.student_register(text, text, text)                 to anon, authenticated;
grant execute on function public.student_reset_password(text, text, text)           to anon, authenticated;
grant execute on function public.list_curriculum(uuid)                               to anon, authenticated;
grant execute on function public.get_worksheet(uuid, bigint)                         to anon, authenticated;
grant execute on function public.student_save_answers(uuid, bigint, jsonb)           to anon, authenticated;
grant execute on function public.list_classes(uuid)                                  to anon, authenticated;
grant execute on function public.class_report(uuid, text)                            to anon, authenticated;
grant execute on function public.get_submission(uuid, bigint, text)                  to anon, authenticated;
grant execute on function public.grade_submission(uuid, bigint, text, numeric, text) to anon, authenticated;
grant execute on function public.admin_save_unit(uuid, bigint, integer, text)        to anon, authenticated;
grant execute on function public.admin_delete_unit(uuid, bigint)                     to anon, authenticated;
grant execute on function public.admin_save_worksheet(uuid, jsonb)                   to anon, authenticated;
grant execute on function public.admin_delete_worksheet(uuid, bigint)                to anon, authenticated;
grant execute on function public.admin_list_users(uuid, text)                        to anon, authenticated;
grant execute on function public.admin_save_user(uuid, text, jsonb)                  to anon, authenticated;
grant execute on function public.admin_delete_user(uuid, text, bigint)               to anon, authenticated;
grant execute on function public.admin_import_data(uuid, jsonb)                      to anon, authenticated;

-- =====================================================================
--  บัญชี Admin เริ่มต้น  (username: admin / password: Admin@1234)
--  ** เข้าสู่ระบบแล้วกรุณาเปลี่ยนรหัสผ่านทันที **
-- =====================================================================
insert into public.admin(username, password, name, "position")
values ('admin', public._hash_pw('Admin@1234'), 'ผู้ดูแลระบบ', 'Admin')
on conflict (username) do nothing;

notify pgrst, 'reload schema';
