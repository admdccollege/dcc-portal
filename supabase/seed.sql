-- =============================================================================
-- DCC Portal — DEVELOPMENT SEED (fictional data only)
-- =============================================================================
-- * Every person, phone number and address below is fictional.
-- * Demo accounts all use the password:  DccDemo@2026   (development only!)
-- * Grading schemes here are SAMPLES for demonstration. They are not official
--   COHSEM or Manipur University regulations; verify and configure the real
--   rules before production use.
-- * Never run this file against a production database.
-- =============================================================================

set session "dcc.seed" = 'on';

-- ---------------------------------------------------------------------------
-- Helpers (dropped at the end)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.seed_uuid(p text) returns uuid language sql immutable as $$
  select md5('dcc-seed:' || p)::uuid;
$$;

create or replace function pg_temp.seed_user(p_email text, p_name text, p_roles text[]) returns uuid
language plpgsql as $$
declare
  v_id uuid := pg_temp.seed_uuid(p_email);
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('DccDemo@2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now(),
    '', '', '', '', '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id, v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now())
  on conflict do nothing;
  update public.profiles set full_name = p_name where id = v_id;
  insert into public.user_roles (user_id, role_id)
  select v_id, r.id from public.roles r where r.key = any (p_roles)
  on conflict do nothing;
  return v_id;
end;
$$;

-- Run subsequent workflow calls as a given user (auth.uid() reads these claims).
create or replace function pg_temp.act_as(p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.seed_uuid(p_email)::text, 'role', 'authenticated')::text, false);
$$;

-- ---------------------------------------------------------------------------
-- Institution
-- ---------------------------------------------------------------------------
update public.institution_settings set
  name = 'Damdei Christian College',
  short_name = 'DCC',
  address = 'Manipur, India (demo address)',
  phone = '+91 00000 00000',
  email = 'office@dcc.example',
  website = 'https://dcc.example';

-- ---------------------------------------------------------------------------
-- Demo accounts
-- ---------------------------------------------------------------------------
select pg_temp.seed_user('superadmin@dcc.example', 'Demo Super Admin', array['super_admin']);
select pg_temp.seed_user('principal@dcc.example', 'Dr. Demo Principal', array['principal']);
select pg_temp.seed_user('office@dcc.example', 'Office Administrator (Demo)', array['office_admin']);
select pg_temp.seed_user('exams@dcc.example', 'Examination Controller (Demo)', array['exam_controller']);
select pg_temp.seed_user('accounts@dcc.example', 'Accountant (Demo)', array['accountant']);

-- ---------------------------------------------------------------------------
-- Academic sessions & departments
-- ---------------------------------------------------------------------------
insert into public.academic_sessions (id, name, start_date, end_date, is_current) values
  (pg_temp.seed_uuid('session:2025-26'), '2025-26', '2025-04-01', '2026-03-31', false),
  (pg_temp.seed_uuid('session:2026-27'), '2026-27', '2026-04-01', '2027-03-31', true),
  (pg_temp.seed_uuid('session:2027-28'), '2027-28', '2027-04-01', '2028-03-31', false);

insert into public.departments (id, code, name)
select pg_temp.seed_uuid('dept:' || code), code, name from (values
  ('ENG', 'English'), ('MATH', 'Mathematics'), ('PHY', 'Physics'), ('CHEM', 'Chemistry'),
  ('BIO', 'Biology'), ('HIST', 'History'), ('POL', 'Political Science'), ('ECO', 'Economics'),
  ('EDU', 'Education'), ('CS', 'Computer Science'), ('ADM', 'Administration')
) as d(code, name);

-- ---------------------------------------------------------------------------
-- SAMPLE grading schemes (verify against the applicable regulations)
-- ---------------------------------------------------------------------------
insert into public.grading_schemes (id, name, level, description, subject_pass_percent, aggregate_pass_percent,
  require_component_pass, require_all_subjects_pass, max_failed_subjects_for_compartment, use_grade_points, use_credits, decimals)
values
  (pg_temp.seed_uuid('scheme:hs'), 'Sample — Higher Secondary (verify with COHSEM)', 'higher_secondary',
   'SAMPLE ONLY: 30% per subject, component pass marks enforced, up to 2 failed subjects = compartment. Replace with verified COHSEM rules.',
   30, 30, true, true, 2, false, false, 2),
  (pg_temp.seed_uuid('scheme:ug'), 'Sample — FYUP 10-point (verify with university)', 'undergraduate',
   'SAMPLE ONLY: 40% per course, credit-weighted SGPA. Replace with verified Manipur University FYUP regulations.',
   40, null, true, true, 0, true, true, 2),
  (pg_temp.seed_uuid('scheme:pg'), 'Sample — PG semester (verify with university)', 'postgraduate',
   'SAMPLE ONLY: 45% per paper, 50% aggregate, credit-weighted SGPA. Replace with verified regulations.',
   45, 50, true, true, 0, true, true, 2);

insert into public.grading_rules (grading_scheme_id, grade, min_percent, grade_point, is_pass, description)
select pg_temp.seed_uuid('scheme:hs'), g, m, null, p, d from (values
  ('A+', 90, true, 'Outstanding'), ('A', 75, true, 'Excellent'), ('B', 60, true, 'Very good'),
  ('C', 45, true, 'Good'), ('D', 30, true, 'Pass'), ('F', 0, false, 'Fail')
) as r(g, m, p, d);
insert into public.grading_rules (grading_scheme_id, grade, min_percent, grade_point, is_pass, description)
select s, g, m, gp, p, d
from (values (pg_temp.seed_uuid('scheme:ug')), (pg_temp.seed_uuid('scheme:pg'))) sc(s)
cross join (values
  ('O', 90, 10, true, 'Outstanding'), ('A+', 80, 9, true, 'Excellent'), ('A', 70, 8, true, 'Very good'),
  ('B+', 60, 7, true, 'Good'), ('B', 50, 6, true, 'Above average'), ('C', 45, 5, true, 'Average'),
  ('P', 40, 4, true, 'Pass'), ('F', 0, 0, false, 'Fail')
) as r(g, m, gp, p, d)
where not (s = pg_temp.seed_uuid('scheme:pg') and g = 'P');  -- PG pass mark is 45 in this sample

-- ---------------------------------------------------------------------------
-- Programmes & terms
-- ---------------------------------------------------------------------------
insert into public.programmes (id, code, name, level, stream, term_kind, total_terms, awarding_body, grading_scheme_id, department_id) values
  (pg_temp.seed_uuid('prog:HS-ARTS'), 'HS-ARTS', 'Higher Secondary (Arts)', 'higher_secondary', 'Arts', 'class', 2, 'COHSEM', pg_temp.seed_uuid('scheme:hs'), null),
  (pg_temp.seed_uuid('prog:HS-SCI'), 'HS-SCI', 'Higher Secondary (Science)', 'higher_secondary', 'Science', 'class', 2, 'COHSEM', pg_temp.seed_uuid('scheme:hs'), null),
  (pg_temp.seed_uuid('prog:FYUP-BA'), 'FYUP-BA', 'FYUP Bachelor of Arts', 'undergraduate', 'Arts', 'semester', 8, 'Manipur University', pg_temp.seed_uuid('scheme:ug'), null),
  (pg_temp.seed_uuid('prog:FYUP-BSC'), 'FYUP-BSC', 'FYUP Bachelor of Science', 'undergraduate', 'Science', 'semester', 8, 'Manipur University', pg_temp.seed_uuid('scheme:ug'), null),
  (pg_temp.seed_uuid('prog:MA-ENG'), 'MA-ENG', 'Master of Arts (English)', 'postgraduate', null, 'semester', 4, 'Manipur University', pg_temp.seed_uuid('scheme:pg'), pg_temp.seed_uuid('dept:ENG')),
  (pg_temp.seed_uuid('prog:MSC-CHEM'), 'MSC-CHEM', 'Master of Science (Chemistry)', 'postgraduate', null, 'semester', 4, 'Manipur University', pg_temp.seed_uuid('scheme:pg'), pg_temp.seed_uuid('dept:CHEM'));

insert into public.programme_terms (id, programme_id, sequence, name)
select pg_temp.seed_uuid('term:' || p.code || ':' || n), p.id, n,
       case when p.term_kind = 'class' then (array['Class XI', 'Class XII'])[n] else 'Semester ' || n end
from public.programmes p cross join generate_series(1, 8) n
where n <= p.total_terms;

-- ---------------------------------------------------------------------------
-- Subjects
-- ---------------------------------------------------------------------------
insert into public.subjects (id, code, name, level, department_id, credits, has_practical)
select pg_temp.seed_uuid('subj:' || code), code, name, lvl::public.programme_level, pg_temp.seed_uuid('dept:' || dept), credits, prac
from (values
  -- Higher Secondary
  ('HS-ENG',  'English',             'higher_secondary', 'ENG',  null::numeric, false),
  ('HS-MIL',  'Modern Indian Language (Manipuri)', 'higher_secondary', 'ENG', null, false),
  ('HS-PHY',  'Physics',             'higher_secondary', 'PHY',  null, true),
  ('HS-CHE',  'Chemistry',           'higher_secondary', 'CHEM', null, true),
  ('HS-MAT',  'Mathematics',         'higher_secondary', 'MATH', null, false),
  ('HS-BIO',  'Biology',             'higher_secondary', 'BIO',  null, true),
  ('HS-HIS',  'History',             'higher_secondary', 'HIST', null, false),
  ('HS-POL',  'Political Science',   'higher_secondary', 'POL',  null, false),
  ('HS-ECO',  'Economics',           'higher_secondary', 'ECO',  null, false),
  ('HS-EDU',  'Education',           'higher_secondary', 'EDU',  null, false),
  -- FYUP
  ('ENG-MJ-101', 'Introduction to Literary Studies', 'undergraduate', 'ENG', 4, false),
  ('HIS-MJ-101', 'History of North-East India I',    'undergraduate', 'HIST', 4, false),
  ('POL-MN-101', 'Introduction to Political Theory', 'undergraduate', 'POL', 4, false),
  ('PHY-MJ-101', 'Mechanics',                        'undergraduate', 'PHY', 4, true),
  ('CHE-MN-101', 'Inorganic Chemistry I',            'undergraduate', 'CHEM', 4, true),
  ('MAT-MJ-101', 'Calculus',                         'undergraduate', 'MATH', 4, false),
  ('MDC-101',    'Environmental Studies',            'undergraduate', 'BIO', 3, false),
  ('AEC-101',    'English Communication',            'undergraduate', 'ENG', 2, false),
  ('SEC-101',    'Digital Literacy',                 'undergraduate', 'CS', 3, false),
  ('VAC-101',    'Understanding India',              'undergraduate', 'HIST', 2, false),
  ('ENG-MJ-301', 'British Poetry and Drama',         'undergraduate', 'ENG', 4, false),
  ('PHY-MJ-301', 'Thermal Physics',                  'undergraduate', 'PHY', 4, true),
  -- PG
  ('MAENG-C101', 'Chaucer to the Renaissance',       'postgraduate', 'ENG', 4, false),
  ('MAENG-C102', 'Literary Criticism I',             'postgraduate', 'ENG', 4, false),
  ('MAENG-C103', 'Indian Writing in English',        'postgraduate', 'ENG', 4, false),
  ('MSCCH-C101', 'Advanced Inorganic Chemistry',     'postgraduate', 'CHEM', 4, true),
  ('MSCCH-C102', 'Quantum Chemistry',                'postgraduate', 'CHEM', 4, false),
  ('MSCCH-C103', 'Organic Reaction Mechanisms',      'postgraduate', 'CHEM', 4, true)
) as s(code, name, lvl, dept, credits, prac);

-- ---------------------------------------------------------------------------
-- Course offerings (current session 2026-27)
-- ---------------------------------------------------------------------------
create temp table seed_offerings (prog text, term int, subj text, cat text, compulsory boolean);
insert into seed_offerings values
  ('HS-SCI', 1, 'HS-ENG', 'CORE', true), ('HS-SCI', 1, 'HS-MIL', 'LANG', true), ('HS-SCI', 1, 'HS-PHY', 'ELEC', true),
  ('HS-SCI', 1, 'HS-CHE', 'ELEC', true), ('HS-SCI', 1, 'HS-MAT', 'ELEC', false), ('HS-SCI', 1, 'HS-BIO', 'ELEC', false),
  ('HS-SCI', 2, 'HS-ENG', 'CORE', true), ('HS-SCI', 2, 'HS-MIL', 'LANG', true), ('HS-SCI', 2, 'HS-PHY', 'ELEC', true),
  ('HS-SCI', 2, 'HS-CHE', 'ELEC', true), ('HS-SCI', 2, 'HS-MAT', 'ELEC', false), ('HS-SCI', 2, 'HS-BIO', 'ELEC', false),
  ('HS-ARTS', 1, 'HS-ENG', 'CORE', true), ('HS-ARTS', 1, 'HS-MIL', 'LANG', true), ('HS-ARTS', 1, 'HS-HIS', 'ELEC', true),
  ('HS-ARTS', 1, 'HS-POL', 'ELEC', true), ('HS-ARTS', 1, 'HS-ECO', 'ELEC', false), ('HS-ARTS', 1, 'HS-EDU', 'ELEC', false),
  ('HS-ARTS', 2, 'HS-ENG', 'CORE', true), ('HS-ARTS', 2, 'HS-MIL', 'LANG', true), ('HS-ARTS', 2, 'HS-HIS', 'ELEC', true),
  ('HS-ARTS', 2, 'HS-POL', 'ELEC', true), ('HS-ARTS', 2, 'HS-ECO', 'ELEC', false), ('HS-ARTS', 2, 'HS-EDU', 'ELEC', false),
  ('FYUP-BA', 1, 'ENG-MJ-101', 'MAJOR', true), ('FYUP-BA', 1, 'HIS-MJ-101', 'MAJOR', false), ('FYUP-BA', 1, 'POL-MN-101', 'MINOR', true),
  ('FYUP-BA', 1, 'MDC-101', 'MDC', true), ('FYUP-BA', 1, 'AEC-101', 'AEC', true), ('FYUP-BA', 1, 'SEC-101', 'SEC', true),
  ('FYUP-BA', 1, 'VAC-101', 'VAC', true), ('FYUP-BA', 3, 'ENG-MJ-301', 'MAJOR', true),
  ('FYUP-BSC', 1, 'PHY-MJ-101', 'MAJOR', true), ('FYUP-BSC', 1, 'MAT-MJ-101', 'MAJOR', false), ('FYUP-BSC', 1, 'CHE-MN-101', 'MINOR', true),
  ('FYUP-BSC', 1, 'MDC-101', 'MDC', true), ('FYUP-BSC', 1, 'AEC-101', 'AEC', true), ('FYUP-BSC', 1, 'SEC-101', 'SEC', true),
  ('FYUP-BSC', 1, 'VAC-101', 'VAC', true), ('FYUP-BSC', 3, 'PHY-MJ-301', 'MAJOR', true),
  ('MA-ENG', 1, 'MAENG-C101', 'CORE', true), ('MA-ENG', 1, 'MAENG-C102', 'CORE', true), ('MA-ENG', 1, 'MAENG-C103', 'CORE', true),
  ('MSC-CHEM', 1, 'MSCCH-C101', 'CORE', true), ('MSC-CHEM', 1, 'MSCCH-C102', 'CORE', true), ('MSC-CHEM', 1, 'MSCCH-C103', 'CORE', true);

insert into public.course_offerings (id, academic_session_id, programme_id, term_id, subject_id, category_id, is_compulsory)
select pg_temp.seed_uuid('off:' || o.prog || ':' || o.term || ':' || o.subj),
       pg_temp.seed_uuid('session:2026-27'), p.id, pg_temp.seed_uuid('term:' || o.prog || ':' || o.term),
       pg_temp.seed_uuid('subj:' || o.subj), cc.id, o.compulsory
from seed_offerings o
join public.programmes p on p.code = o.prog
join public.course_categories cc on cc.level = p.level and cc.code = o.cat;

-- ---------------------------------------------------------------------------
-- Staff (fictional) with accounts for teachers
-- ---------------------------------------------------------------------------
create temp table seed_staff (emp text, name text, designation text, dept text, email text, teaching boolean, subjects text[]);
insert into seed_staff values
  ('DCC-E001', 'Dr. Demo Principal', 'Principal', 'ADM', 'principal@dcc.example', false, '{}'),
  ('DCC-E002', 'Lalthansanga Demo', 'Office Superintendent', 'ADM', 'office@dcc.example', false, '{}'),
  ('DCC-E003', 'Ngaihte Exam Demo', 'Controller of Examinations', 'ADM', 'exams@dcc.example', false, '{}'),
  ('DCC-E004', 'Kimboi Accounts Demo', 'Accountant', 'ADM', 'accounts@dcc.example', false, '{}'),
  ('DCC-T001', 'Grace Lalnunpuii', 'Assistant Professor', 'ENG', 'teacher.english@dcc.example', true,
     '{HS-SCI:1:HS-ENG,HS-ARTS:1:HS-ENG,FYUP-BA:1:ENG-MJ-101,FYUP-BA:1:AEC-101,FYUP-BSC:1:AEC-101,MA-ENG:1:MAENG-C101}'),
  ('DCC-T002', 'Thangminlen Haokip', 'Associate Professor', 'PHY', 'teacher.physics@dcc.example', true,
     '{HS-SCI:1:HS-PHY,HS-SCI:2:HS-PHY,FYUP-BSC:1:PHY-MJ-101,FYUP-BSC:3:PHY-MJ-301}'),
  ('DCC-T003', 'Esther Niangneihoih', 'Assistant Professor', 'CHEM', 'teacher.chemistry@dcc.example', true,
     '{HS-SCI:1:HS-CHE,HS-SCI:2:HS-CHE,FYUP-BSC:1:CHE-MN-101,MSC-CHEM:1:MSCCH-C101,MSC-CHEM:1:MSCCH-C103}'),
  ('DCC-T004', 'Samuel Lianzamang', 'Assistant Professor', 'MATH', 'teacher.maths@dcc.example', true,
     '{HS-SCI:1:HS-MAT,HS-SCI:2:HS-MAT,FYUP-BSC:1:MAT-MJ-101}'),
  ('DCC-T005', 'Hoineilhing Kipgen', 'Assistant Professor', 'BIO', 'teacher.biology@dcc.example', true,
     '{HS-SCI:1:HS-BIO,HS-SCI:2:HS-BIO,FYUP-BA:1:MDC-101,FYUP-BSC:1:MDC-101}'),
  ('DCC-T006', 'Daniel Thangkhosei', 'Assistant Professor', 'HIST', 'teacher.history@dcc.example', true,
     '{HS-ARTS:1:HS-HIS,HS-ARTS:2:HS-HIS,FYUP-BA:1:HIS-MJ-101,FYUP-BA:1:VAC-101,FYUP-BSC:1:VAC-101}'),
  ('DCC-T007', 'Ruth Chingneilhing', 'Assistant Professor', 'POL', 'teacher.polsci@dcc.example', true,
     '{HS-ARTS:1:HS-POL,HS-ARTS:2:HS-POL,FYUP-BA:1:POL-MN-101}'),
  ('DCC-T008', 'Paul Mangkhosat', 'Assistant Professor', 'ECO', 'teacher.economics@dcc.example', true,
     '{HS-ARTS:1:HS-ECO,HS-ARTS:2:HS-ECO}'),
  ('DCC-T009', 'Lydia Vungngaihlun', 'Assistant Professor', 'EDU', 'teacher.education@dcc.example', true,
     '{HS-ARTS:1:HS-EDU,HS-ARTS:2:HS-EDU}'),
  ('DCC-T010', 'Thoibi Devi Demo', 'Assistant Professor', 'ENG', 'teacher.mil@dcc.example', true,
     '{HS-SCI:1:HS-MIL,HS-ARTS:1:HS-MIL,HS-SCI:2:HS-MIL,HS-ARTS:2:HS-MIL,HS-SCI:2:HS-ENG,HS-ARTS:2:HS-ENG}'),
  ('DCC-T011', 'Joseph Lalremsiama', 'Assistant Professor', 'CS', 'teacher.cs@dcc.example', true,
     '{FYUP-BA:1:SEC-101,FYUP-BSC:1:SEC-101}'),
  ('DCC-T012', 'Hannah Lunminthang', 'Professor', 'ENG', 'teacher.pgenglish@dcc.example', true,
     '{MA-ENG:1:MAENG-C102,MA-ENG:1:MAENG-C103,FYUP-BA:3:ENG-MJ-301}'),
  ('DCC-T013', 'David Chinkhanmung', 'Associate Professor', 'CHEM', 'teacher.pgchem@dcc.example', true,
     '{MSC-CHEM:1:MSCCH-C102}');

do $$
declare r record; v_uid uuid;
begin
  for r in select * from seed_staff loop
    if r.teaching then
      v_uid := pg_temp.seed_user(r.email, r.name, array['teacher']);
    else
      v_uid := pg_temp.seed_uuid(r.email);
    end if;
    insert into public.staff (id, profile_id, employee_id, full_name, designation, department_id, email, phone, is_teaching, date_of_joining, qualification)
    values (pg_temp.seed_uuid('staff:' || r.emp), v_uid, r.emp, r.name, r.designation, pg_temp.seed_uuid('dept:' || r.dept),
            r.email, '+91 90000 ' || lpad((10000 + right(r.emp, 3)::int)::text, 5, '0'),
            r.teaching, date '2015-07-01' + (right(r.emp, 3)::int * 97), case when r.teaching then 'M.A./M.Sc., NET (fictional)' end);
    insert into public.teacher_assignments (staff_id, course_offering_id, role)
    select pg_temp.seed_uuid('staff:' || r.emp), pg_temp.seed_uuid('off:' || x), 'teacher'
    from unnest(r.subjects) x;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Students (fictional names) — deterministic pseudo-random generation
-- ---------------------------------------------------------------------------
select setseed(0.2026);
do $$
declare
  first_f text[] := array['Grace','Esther','Mary','Ruth','Hannah','Lydia','Lalmuanpuii','Niangsianching','Hoineilhing',
                          'Kimneihat','Lhingneikim','Chingngaihlun','Boinu','Ngaihlun','Thoibi','Sanatombi','Linthoi','Nengneihoi',
                          'Vungngaihching','Dimneilhing','Florence','Rebecca','Joy','Sarah'];
  first_m text[] := array['Joseph','Daniel','Samuel','David','Paul','Thangboi','Chinkhanmung','Lianzamang','Nemkholal',
                          'Thangminlal','Vungzalian','Kapkholal','Mangboi','Jamkhokai','Lunminthang','Tomba','Ibomcha','Seilen',
                          'Paominlen','Khaigoulen','Stephen','John','Peter','Andrew'];
  surnames text[] := array['Haokip','Kipgen','Guite','Vaiphei','Zou','Hmar','Singsit','Touthang','Lhouvum','Baite','Gangte',
                           'Simte','Tonsing','Khongsai','Mate','Chongloi','Lunkim','Sitlhou','Doungel','Infimate','Ngaihte','Valte'];
  villages text[] := array['Demo Veng','Sample Village','Model Town (demo)','Hill View (demo)','New Lane (demo)','College Road (demo)'];
  cls record;
  i integer;
  v_gender public.gender;
  v_name text;
  v_sid uuid;
  v_eid uuid;
  v_n integer := 0;
  v_opt uuid[];
begin
  perform pg_temp.act_as('office@dcc.example');
  for cls in
    select * from (values
      ('HS-SCI', 1, 26, 2010), ('HS-SCI', 2, 22, 2009), ('HS-ARTS', 1, 24, 2010), ('HS-ARTS', 2, 20, 2009),
      ('FYUP-BA', 1, 22, 2008), ('FYUP-BA', 3, 14, 2007), ('FYUP-BSC', 1, 18, 2008), ('FYUP-BSC', 3, 12, 2007),
      ('MA-ENG', 1, 10, 2004), ('MSC-CHEM', 1, 8, 2004)
    ) as t(prog, term, n, birth_year)
  loop
    for i in 1 .. cls.n loop
      v_n := v_n + 1;
      v_gender := case when random() < 0.52 then 'female'::public.gender else 'male'::public.gender end;
      v_name := case when v_gender = 'female' then first_f[1 + floor(random() * array_length(first_f, 1))::int]
                     else first_m[1 + floor(random() * array_length(first_m, 1))::int] end
                || ' ' || surnames[1 + floor(random() * array_length(surnames, 1))::int];

      -- Optional elective choices: pick one of the non-compulsory offerings
      select array_agg(id) into v_opt from (
        select o.id from public.course_offerings o
        where o.academic_session_id = pg_temp.seed_uuid('session:2026-27')
          and o.term_id = pg_temp.seed_uuid('term:' || cls.prog || ':' || cls.term) and not o.is_compulsory
        order by random() limit 1) x;

      v_sid := public.create_student(
        jsonb_build_object(
          'full_name', v_name,
          'date_of_birth', make_date(cls.birth_year, 1 + floor(random() * 12)::int, 1 + floor(random() * 27)::int),
          'gender', v_gender,
          'phone', '+91 98' || lpad((v_n * 7919 % 100000000)::text, 8, '0'),
          'email', 'student' || v_n || '@students.dcc.example',
          'address', villages[1 + floor(random() * array_length(villages, 1))::int] || ', Manipur',
          'admission_date', case when cls.term in (1) then date '2026-07-15' else date '2025-07-15' end,
          'university_roll_no', case when cls.prog like 'HS-%' then null else 'MU-DEMO-' || lpad(v_n::text, 5, '0') end
        ),
        jsonb_build_object('name', 'Guardian of ' || split_part(v_name, ' ', 1), 'relationship',
          case when random() < 0.6 then 'Father' else 'Mother' end, 'phone', '+91 97' || lpad((v_n * 104729 % 100000000)::text, 8, '0')),
        jsonb_build_object('academic_session_id', pg_temp.seed_uuid('session:2026-27'),
          'programme_id', pg_temp.seed_uuid('prog:' || cls.prog),
          'term_id', pg_temp.seed_uuid('term:' || cls.prog || ':' || cls.term),
          'roll_no', lpad(i::text, 3, '0')),
        coalesce(v_opt, '{}')
      );
    end loop;
  end loop;
end $$;

-- Two demo student logins linked to existing student records.
do $$
declare v_uid uuid;
begin
  v_uid := pg_temp.seed_user('student.science@dcc.example', 'Demo Student (Science)', array['student']);
  update public.students set profile_id = v_uid, email = 'student.science@dcc.example'
  where id = (select e.student_id from public.student_enrolments e
              where e.term_id = pg_temp.seed_uuid('term:HS-SCI:1') and e.roll_no = '001');
  v_uid := pg_temp.seed_user('student.arts@dcc.example', 'Demo Student (FYUP Arts)', array['student']);
  update public.students set profile_id = v_uid, email = 'student.arts@dcc.example'
  where id = (select e.student_id from public.student_enrolments e
              where e.term_id = pg_temp.seed_uuid('term:FYUP-BA:1') and e.roll_no = '001');
  update public.profiles p set full_name = s.full_name from public.students s where s.profile_id = p.id;
end $$;

-- ---------------------------------------------------------------------------
-- Attendance: last 20 weekdays for every subject offering (via save_attendance)
-- ---------------------------------------------------------------------------
select setseed(0.77);
do $$
declare
  d date;
  o record;
  v_records jsonb;
  k integer := 0;
begin
  perform pg_temp.act_as('superadmin@dcc.example');
  for d in
    select x::date from generate_series(current_date - 34, current_date - 1, interval '1 day') x
    where extract(isodow from x) between 1 and 5
    order by 1 desc limit 20
  loop
    for o in
      select co.* from public.course_offerings co
      where co.academic_session_id = pg_temp.seed_uuid('session:2026-27')
    loop
      select jsonb_agg(jsonb_build_object('student_id', e.student_id,
               'status_code', case
                 when hashtext(e.student_id::text) % 9 = 0 and random() < 0.45 then 'A'   -- a few chronic absentees
                 when random() < 0.07 then 'A'
                 when random() < 0.03 then 'AL'
                 when random() < 0.03 then 'L'
                 else 'P' end))
        into v_records
      from public.student_subject_enrolments sse
      join public.student_enrolments e on e.id = sse.enrolment_id and e.status = 'active'
      where sse.course_offering_id = o.id;
      if v_records is not null then
        k := k + 1;
        perform public.save_attendance(o.academic_session_id, o.programme_id, o.term_id, o.id, d,
          (1 + (k % 6))::smallint, v_records, null);
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Examinations
--   1. HS-SCI Class XI "Unit Test I"  → fully processed and PUBLISHED
--   2. FYUP-BSC Sem 1 "Internal Assessment I" → marks entry in progress
--   3. HS-ARTS Class XI "First Terminal Examination" → scheduled
-- ---------------------------------------------------------------------------
select setseed(0.31);
do $$
declare
  v_exam uuid := pg_temp.seed_uuid('exam:hs-sci-ut1');
  v_ia uuid := pg_temp.seed_uuid('exam:bsc-ia1');
  v_term uuid := pg_temp.seed_uuid('exam:hsarts-term1');
  es record;
  v_entries jsonb;
begin
  perform pg_temp.act_as('exams@dcc.example');

  insert into public.examinations (id, academic_session_id, programme_id, term_id, examination_type_id, grading_scheme_id, name,
    start_date, end_date, marks_entry_deadline, is_provisional, created_by)
  values
    (v_exam, pg_temp.seed_uuid('session:2026-27'), pg_temp.seed_uuid('prog:HS-SCI'), pg_temp.seed_uuid('term:HS-SCI:1'),
     (select id from public.examination_types where code = 'UT'), pg_temp.seed_uuid('scheme:hs'), 'Unit Test I',
     current_date - 40, current_date - 36, now() + interval '30 days', true, pg_temp.seed_uuid('exams@dcc.example')),
    (v_ia, pg_temp.seed_uuid('session:2026-27'), pg_temp.seed_uuid('prog:FYUP-BSC'), pg_temp.seed_uuid('term:FYUP-BSC:1'),
     (select id from public.examination_types where code = 'IA'), pg_temp.seed_uuid('scheme:ug'), 'Internal Assessment I',
     current_date - 10, current_date - 6, now() + interval '14 days', true, pg_temp.seed_uuid('exams@dcc.example')),
    (v_term, pg_temp.seed_uuid('session:2026-27'), pg_temp.seed_uuid('prog:HS-ARTS'), pg_temp.seed_uuid('term:HS-ARTS:1'),
     (select id from public.examination_types where code = 'TERM'), pg_temp.seed_uuid('scheme:hs'), 'First Terminal Examination',
     current_date + 20, current_date + 30, now() + interval '45 days', true, pg_temp.seed_uuid('exams@dcc.example'));

  -- Unit Test I: theory 50 (pass 15) for every subject; practical 20 (pass 6) for Physics & Chemistry
  insert into public.examination_subjects (examination_id, course_offering_id, component, max_marks, pass_marks, exam_date)
  select v_exam, o.id, 'theory', 50, 15, current_date - 40 + (row_number() over (order by s.code))::int % 5
  from public.course_offerings o join public.subjects s on s.id = o.subject_id
  where o.term_id = pg_temp.seed_uuid('term:HS-SCI:1') and o.academic_session_id = pg_temp.seed_uuid('session:2026-27');
  insert into public.examination_subjects (examination_id, course_offering_id, component, max_marks, pass_marks, exam_date)
  select v_exam, o.id, 'practical', 20, 6, current_date - 36
  from public.course_offerings o join public.subjects s on s.id = o.subject_id
  where o.term_id = pg_temp.seed_uuid('term:HS-SCI:1') and s.code in ('HS-PHY', 'HS-CHE')
    and o.academic_session_id = pg_temp.seed_uuid('session:2026-27');

  -- IA: 25 marks, pass 10, for every BSc Sem 1 course
  insert into public.examination_subjects (examination_id, course_offering_id, component, max_marks, pass_marks, exam_date,
    examiner_staff_id)
  select v_ia, o.id, 'internal', 25, 10, current_date - 8,
         (select ta.staff_id from public.teacher_assignments ta where ta.course_offering_id = o.id limit 1)
  from public.course_offerings o
  where o.term_id = pg_temp.seed_uuid('term:FYUP-BSC:1') and o.academic_session_id = pg_temp.seed_uuid('session:2026-27');

  -- Terminal exam: theory 100 / pass 30
  insert into public.examination_subjects (examination_id, course_offering_id, component, max_marks, pass_marks, exam_date)
  select v_term, o.id, 'theory', 100, 30, current_date + 20 + (row_number() over (order by o.id))::int
  from public.course_offerings o
  where o.term_id = pg_temp.seed_uuid('term:HS-ARTS:1') and o.academic_session_id = pg_temp.seed_uuid('session:2026-27');

  perform public.transition_examination(v_exam, 'marks_entry');
  perform public.transition_examination(v_ia, 'marks_entry');
  perform public.transition_examination(v_term, 'scheduled');

  -- Unit Test marks for every candidate (a couple absent, some low scores)
  for es in select * from public.examination_subjects where examination_id = v_exam loop
    select jsonb_agg(case
             when random() < 0.03 then jsonb_build_object('student_id', cp.student_id, 'status', 'absent', 'marks', null)
             else jsonb_build_object('student_id', cp.student_id, 'status', 'present',
                    'marks', least(es.max_marks, greatest(0, round((es.max_marks * (0.38 + random() * 0.6))::numeric, 0))))
           end)
      into v_entries
    from public.exam_candidate_pairs(v_exam) cp where cp.course_offering_id = es.course_offering_id;
    perform public.save_marks(es.id, v_entries, null);
  end loop;

  -- IA marks: entered for all but one course (to show progress / missing marks)
  for es in select es2.* from public.examination_subjects es2 join public.course_offerings o on o.id = es2.course_offering_id
            join public.subjects s on s.id = o.subject_id
            where es2.examination_id = v_ia and s.code <> 'SEC-101' loop
    select jsonb_agg(jsonb_build_object('student_id', cp.student_id, 'status', 'present',
             'marks', round((es.max_marks * (0.3 + random() * 0.68))::numeric, 1)))
      into v_entries
    from public.exam_candidate_pairs(v_ia) cp where cp.course_offering_id = es.course_offering_id;
    perform public.save_marks(es.id, v_entries, null);
  end loop;

  -- Lock, process, approve (principal) and publish Unit Test I
  perform public.transition_examination(v_exam, 'marks_locked');
  perform public.compute_exam_results(v_exam);
  perform pg_temp.act_as('principal@dcc.example');
  perform public.transition_examination(v_exam, 'results_approved');
  perform pg_temp.act_as('exams@dcc.example');
  perform public.transition_examination(v_exam, 'published');
end $$;

-- ---------------------------------------------------------------------------
-- Fees: structures, assignments, payments (as the accountant)
-- ---------------------------------------------------------------------------
select setseed(0.55);
do $$
declare
  p record;
  v_fs uuid;
  a record;
  v_pid uuid;
  v_n integer := 0;
begin
  perform pg_temp.act_as('accounts@dcc.example');
  for p in
    select pr.code, pr.id as programme_id, t.id as term_id, t.name as term_name, pr.level
    from public.programmes pr join public.programme_terms t on t.programme_id = pr.id
    where exists (select 1 from public.student_enrolments e where e.term_id = t.id and e.status = 'active')
  loop
    v_fs := pg_temp.seed_uuid('fs:' || p.code || ':' || p.term_name);
    insert into public.fee_structures (id, academic_session_id, programme_id, term_id, name, due_date)
    values (v_fs, pg_temp.seed_uuid('session:2026-27'), p.programme_id, p.term_id,
            case when p.level = 'higher_secondary' then 'Annual Fees 2026-27' else 'Semester Fees' end,
            current_date - 15);
    insert into public.fee_structure_items (fee_structure_id, fee_head_id, amount)
    select v_fs, h.id, case h.code
        when 'TUI' then case p.level when 'higher_secondary' then 6000 when 'undergraduate' then 4500 else 7500 end
        when 'LAB' then case when p.code in ('HS-SCI', 'FYUP-BSC', 'MSC-CHEM') then 1500 else 0 end
        when 'LIB' then 500 when 'DEV' then 1000 when 'HOS' then 12000 end
    from public.fee_heads h where h.code in ('TUI', 'LAB', 'LIB', 'DEV', 'HOS');
    delete from public.fee_structure_items where fee_structure_id = v_fs and amount = 0;

    perform public.assign_fee_structure(v_fs,
      array(select e.student_id from public.student_enrolments e where e.term_id = p.term_id and e.status = 'active'), '{}');
  end loop;

  -- Payments: ~70% paid in full, ~15% part-paid, ~15% unpaid
  for a in select * from public.student_fee_assignments order by created_at, id loop
    v_n := v_n + 1;
    if random() < 0.70 then
      if v_n % 2 = 0 then
        perform public.record_payment(a.id, a.gross_amount, 'cash', current_date - (v_n % 28), null, null);
      else
        perform public.record_payment(a.id, a.gross_amount, 'upi', current_date - (v_n % 28), 'UPI-DEMO-' || v_n, null);
      end if;
    elsif random() < 0.5 then
      perform public.record_payment(a.id, round(a.gross_amount / 2, 0), 'bank_transfer', current_date - (v_n % 20),
        'NEFT-DEMO-' || v_n, 'Part payment');
    end if;
  end loop;

  -- One mistaken payment reversed (demonstrates the audit trail)
  select id into v_pid from public.payments where method_code = 'cash' order by created_at limit 1;
  perform public.reverse_payment(v_pid, 'Duplicate entry recorded in error (demo)');

  -- A concession requested by the accountant, approved by the principal
  perform public.request_concession((select a2.id from public.student_fee_assignments a2
      where not exists (select 1 from public.payments x where x.student_fee_assignment_id = a2.id) order by a2.id limit 1),
    'scholarship', 2000, 'Merit scholarship (demo)');
  perform pg_temp.act_as('principal@dcc.example');
  perform public.decide_concession((select id from public.fee_concessions limit 1), true, 'Approved as per scholarship committee (demo)');
end $$;

-- ---------------------------------------------------------------------------
-- Admissions for 2027-28 (open period) with applications in several states
-- ---------------------------------------------------------------------------
do $$
declare
  v_period uuid := pg_temp.seed_uuid('adm:fyup-ba-2027');
  v_hs uuid := pg_temp.seed_uuid('adm:hs-sci-2027');
  v_a uuid;
  i integer;
  names text[] := array['Lalnunmawii Demo','Thangkhanlal Demo','Niangneih Demo','Seiminlen Demo','Chiinngaihching Demo','Mangminthang Demo'];
begin
  perform pg_temp.act_as('office@dcc.example');
  insert into public.admission_periods (id, academic_session_id, programme_id, term_id, title, opens_on, closes_on, admission_fee, seats,
    eligibility_rules, min_qualifying_percent, required_documents)
  values
    (v_period, pg_temp.seed_uuid('session:2027-28'), pg_temp.seed_uuid('prog:FYUP-BA'), pg_temp.seed_uuid('term:FYUP-BA:1'),
     'FYUP B.A. Semester 1 Admission 2027-28', current_date - 20, current_date + 40, 1500, 120,
     'Passed Class XII (any stream) from a recognised board. (Sample rule — configure as per college policy.)', 35,
     array['Class X marksheet', 'Class XII marksheet', 'Transfer certificate', 'Passport photograph']),
    (v_hs, pg_temp.seed_uuid('session:2027-28'), pg_temp.seed_uuid('prog:HS-SCI'), pg_temp.seed_uuid('term:HS-SCI:1'),
     'Class XI Science Admission 2027-28', current_date - 10, current_date + 50, 1000, 80,
     'Passed Class X with Mathematics and Science. (Sample rule.)', 45,
     array['Class X marksheet', 'Transfer certificate', 'Passport photograph']);

  for i in 1 .. array_length(names, 1) loop
    v_a := public.create_admission(jsonb_build_object(
      'admission_period_id', case when i <= 4 then v_period else v_hs end,
      'applicant_name', names[i], 'date_of_birth', make_date(2008, i, 10 + i), 'gender', case when i % 2 = 0 then 'male' else 'female' end,
      'phone', '+91 96000 0000' || i, 'email', 'applicant' || i || '@mail.example',
      'address', 'Demo Address ' || i || ', Manipur', 'guardian_name', 'Guardian ' || i, 'guardian_relationship', 'Parent',
      'guardian_phone', '+91 95000 0000' || i, 'previous_institution', 'Demo Higher Secondary School',
      'previous_board', case when i <= 4 then 'COHSEM' else 'BOSEM' end, 'previous_exam', case when i <= 4 then 'Class XII' else 'Class X' end,
      'previous_year', 2027, 'previous_percentage', 55 + i * 5));
    if i in (1, 2) then
      update public.admission_documents set submitted = true where admission_id = v_a;
      perform public.verify_admission_document(d.id, true, null) from public.admission_documents d where d.admission_id = v_a;
      perform public.review_admission(v_a, 'approved', 'Documents verified; eligible.');
    elsif i = 3 then
      perform public.review_admission(v_a, 'under_review', null);
    elsif i = 4 then
      perform public.review_admission(v_a, 'rejected', 'Incomplete documents after reminder (demo).');
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Timetable for HS-SCI Class XI (Mon–Sat, conflict-free)
-- ---------------------------------------------------------------------------
do $$
declare
  o record;
  d integer;
  p integer;
  idx integer := 0;
  offs uuid[];
  v_staff uuid;
begin
  perform pg_temp.act_as('office@dcc.example');
  select array_agg(co.id order by s.code) into offs
  from public.course_offerings co join public.subjects s on s.id = co.subject_id
  where co.term_id = pg_temp.seed_uuid('term:HS-SCI:1') and co.academic_session_id = pg_temp.seed_uuid('session:2026-27');
  for d in 1 .. 6 loop
    for p in 1 .. 4 loop
      idx := idx + 1;
      select ta.staff_id into v_staff from public.teacher_assignments ta where ta.course_offering_id = offs[1 + (idx + d) % array_length(offs, 1)] limit 1;
      begin
        insert into public.timetable_entries (academic_session_id, programme_id, term_id, course_offering_id, staff_id, day_of_week, period_no, room)
        values (pg_temp.seed_uuid('session:2026-27'), pg_temp.seed_uuid('prog:HS-SCI'), pg_temp.seed_uuid('term:HS-SCI:1'),
                offs[1 + (idx + d) % array_length(offs, 1)], v_staff, d, p, 'Room 101');
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Notices
-- ---------------------------------------------------------------------------
do $$
declare v_id uuid;
begin
  perform pg_temp.act_as('office@dcc.example');
  insert into public.notices (title, body, category, author_id, is_pinned)
  values ('Christmas and New Year holidays', 'The college will remain closed from 24 December to 2 January. Classes resume on 3 January. (Demo notice)',
          'holiday', pg_temp.seed_uuid('office@dcc.example'), true) returning id into v_id;
  insert into public.notice_audiences (notice_id, audience) values (v_id, 'everyone');
  perform public.publish_notice(v_id, true);

  insert into public.notices (title, body, category, author_id)
  values ('Unit Test I results published — Class XI Science', 'Results of Unit Test I for Class XI Science are available in the student portal. Provisional; subject to verification. (Demo)',
          'examination', pg_temp.seed_uuid('office@dcc.example')) returning id into v_id;
  insert into public.notice_audiences (notice_id, audience, programme_id, term_id)
  values (v_id, 'class', pg_temp.seed_uuid('prog:HS-SCI'), pg_temp.seed_uuid('term:HS-SCI:1'));
  perform public.publish_notice(v_id, true);

  insert into public.notices (title, body, category, author_id, expires_at)
  values ('Semester fee due date reminder', 'Students with outstanding semester fees are requested to clear dues at the accounts office. (Demo)',
          'fee', pg_temp.seed_uuid('office@dcc.example'), now() + interval '30 days') returning id into v_id;
  insert into public.notice_audiences (notice_id, audience) values (v_id, 'all_students');
  perform public.publish_notice(v_id, true);

  insert into public.notices (title, body, category, author_id)
  values ('Staff meeting: examination duties', 'All teaching staff are requested to attend a meeting on examination duties in the conference hall. (Demo)',
          'general', pg_temp.seed_uuid('office@dcc.example')) returning id into v_id;
  insert into public.notice_audiences (notice_id, audience) values (v_id, 'all_staff');
  perform public.publish_notice(v_id, true);

  insert into public.notices (title, body, category, author_id)
  values ('DRAFT: Admission 2027-28 prospectus', 'Draft notice — not visible to students until published. (Demo)',
          'admission', pg_temp.seed_uuid('office@dcc.example')) returning id into v_id;
  insert into public.notice_audiences (notice_id, audience) values (v_id, 'everyone');
end $$;

-- Reset impersonation and clean up
select set_config('request.jwt.claims', '', false);
reset "dcc.seed";
drop table seed_offerings;
drop table seed_staff;
