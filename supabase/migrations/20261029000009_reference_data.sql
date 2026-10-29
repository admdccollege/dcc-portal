-- =============================================================================
-- DCC Portal — Default reference data (all editable by administrators)
-- =============================================================================
-- Grading schemes are NOT created here: COHSEM / Manipur University rules must
-- be configured and verified by the college. The development seed contains
-- clearly-labelled sample schemes only.
-- =============================================================================

insert into public.attendance_statuses (code, label, counts_as_present, counts_in_total, sort_order) values
  ('P',  'Present',                true,  true,  1),
  ('A',  'Absent',                 false, true,  2),
  ('L',  'Late',                   true,  true,  3),
  ('AL', 'Approved leave',         false, false, 4),
  ('OD', 'On official duty',       true,  true,  5),
  ('ML', 'Medical leave',          false, false, 6)
on conflict (code) do nothing;

insert into public.payment_methods (code, name, requires_reference) values
  ('cash', 'Cash', false),
  ('bank_transfer', 'Bank transfer (NEFT/RTGS/IMPS)', true),
  ('upi', 'UPI', true),
  ('cheque', 'Cheque', true),
  ('demand_draft', 'Demand draft', true)
on conflict (code) do nothing;

insert into public.examination_types (code, name, is_supplementary, sort_order) values
  ('UT',   'Unit / Periodic Test',     false, 1),
  ('IA',   'Internal Assessment',      false, 2),
  ('PRAC', 'Practical Examination',    false, 3),
  ('TERM', 'Terminal Examination',     false, 4),
  ('SEM',  'Semester Examination',     false, 5),
  ('IMP',  'Improvement Examination',  true,  6),
  ('SUPP', 'Supplementary Examination', true, 7)
on conflict (code) do nothing;

insert into public.course_categories (level, code, name, sort_order) values
  ('higher_secondary', 'CORE',  'Core / Compulsory', 1),
  ('higher_secondary', 'LANG',  'Language',          2),
  ('higher_secondary', 'ELEC',  'Elective',          3),
  ('undergraduate',    'MAJOR', 'Major',             1),
  ('undergraduate',    'MINOR', 'Minor',             2),
  ('undergraduate',    'MDC',   'Multidisciplinary Course (MDC)', 3),
  ('undergraduate',    'AEC',   'Ability Enhancement Course (AEC/AECC)', 4),
  ('undergraduate',    'SEC',   'Skill Enhancement Course (SEC)', 5),
  ('undergraduate',    'VAC',   'Value Added Course (VAC)', 6),
  ('undergraduate',    'INT',   'Internship / Project', 7),
  ('postgraduate',     'CORE',  'Core',              1),
  ('postgraduate',     'ELEC',  'Elective',          2),
  ('postgraduate',     'OE',    'Open Elective',     3),
  ('postgraduate',     'DISS',  'Dissertation / Project', 4)
on conflict (level, code) do nothing;

insert into public.fee_heads (code, name, category, is_optional) values
  ('ADM',   'Admission Fee',        'admission',     false),
  ('TUI',   'Tuition Fee',          'tuition',       false),
  ('SEMF',  'Semester Fee',         'semester',      false),
  ('LAB',   'Laboratory Fee',       'laboratory',    false),
  ('LIB',   'Library Fee',          'miscellaneous', false),
  ('DEV',   'Development Fee',      'miscellaneous', false),
  ('HOS',   'Hostel Fee',           'hostel',        true),
  ('EXAM',  'Examination Fee',      'examination',   false),
  ('FINE',  'Fine',                 'fine',          false)
on conflict (code) do nothing;

insert into public.timetable_periods (period_no, start_time, end_time, label) values
  (1, '09:30', '10:20', 'Period 1'),
  (2, '10:20', '11:10', 'Period 2'),
  (3, '11:10', '12:00', 'Period 3'),
  (4, '12:00', '12:50', 'Period 4'),
  (5, '13:30', '14:20', 'Period 5'),
  (6, '14:20', '15:10', 'Period 6')
on conflict (period_no) do nothing;
