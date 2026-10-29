-- =============================================================================
-- DCC Portal — Atomic bulk student import
-- =============================================================================
-- Imports all rows in ONE transaction: if any row fails (duplicate, invalid
-- value), nothing is saved. Rows are pre-validated by the application, and the
-- database constraints re-validate everything.
create or replace function public.import_students(
  p_rows jsonb,
  p_academic_session_id uuid,
  p_programme_id uuid,
  p_term_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_n integer := 0;
begin
  if not ((select public.has_permission('students.import')) and (select public.has_permission('students.manage'))) then
    raise exception 'Not authorised to import students' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to import' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'At most 2000 rows can be imported at once' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_n := v_n + 1;
    begin
      perform public.create_student(
        r,
        jsonb_build_object('name', r ->> 'guardian_name', 'relationship', r ->> 'guardian_relationship', 'phone', r ->> 'guardian_phone'),
        jsonb_build_object('academic_session_id', p_academic_session_id, 'programme_id', p_programme_id,
                           'term_id', p_term_id, 'roll_no', r ->> 'roll_no'),
        '{}'
      );
    exception when others then
      raise exception 'Row %: %', v_n + 1, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  perform public.log_audit('students.import', 'students', null, jsonb_build_object('rows', v_n,
    'programme_id', p_programme_id, 'term_id', p_term_id));
  return v_n;
end;
$$;
grant execute on function public.import_students(jsonb, uuid, uuid, uuid) to authenticated;

-- Replace the subject combination of a student's active enrolment.
create or replace function public.set_student_subjects(p_enrolment_id uuid, p_offering_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.student_enrolments;
begin
  if not (select public.has_permission('students.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v_e from public.student_enrolments where id = p_enrolment_id for update;
  if v_e.id is null then raise exception 'Enrolment not found' using errcode = 'P0002'; end if;
  if v_e.status <> 'active' then raise exception 'Only the active enrolment can be changed' using errcode = 'P0001'; end if;

  -- Subjects with recorded marks cannot be removed (preserves academic history)
  if exists (
    select 1 from public.student_subject_enrolments sse
    join public.examination_subjects es on es.course_offering_id = sse.course_offering_id
    join public.marks m on m.examination_subject_id = es.id and m.student_id = v_e.student_id
    where sse.enrolment_id = p_enrolment_id and not (sse.course_offering_id = any (p_offering_ids))
  ) then
    raise exception 'A subject with recorded marks cannot be removed from the combination' using errcode = 'P0001';
  end if;

  delete from public.student_subject_enrolments sse
  using public.course_offerings o
  where sse.enrolment_id = p_enrolment_id and o.id = sse.course_offering_id
    and not o.is_compulsory and not (sse.course_offering_id = any (p_offering_ids));

  insert into public.student_subject_enrolments (enrolment_id, course_offering_id)
  select p_enrolment_id, o.id from public.course_offerings o
  where o.academic_session_id = v_e.academic_session_id and o.programme_id = v_e.programme_id and o.term_id = v_e.term_id
    and (o.is_compulsory or o.id = any (p_offering_ids))
  on conflict do nothing;

  perform public.log_audit('students.subjects', 'student_enrolments', p_enrolment_id::text,
    jsonb_build_object('offerings', p_offering_ids));
end;
$$;
grant execute on function public.set_student_subjects(uuid, uuid[]) to authenticated;
