-- Additive migration: never touches legacy browser storage or an existing application table.
begin;
revoke create on schema public from public,anon,authenticated;
create table public.roles (name text primary key check (name in ('admin','unit','validator','mutu','leader')));
insert into public.roles values ('admin'),('unit'),('validator'),('mutu'),('leader');
create table public.profiles (
 id uuid primary key references auth.users(id), display_name text not null check(length(display_name) between 1 and 200),
 role text not null default 'unit' references public.roles(name), active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.units (id text primary key check(length(id) between 1 and 100), name text not null check(length(name) between 1 and 200), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.indicators (id text primary key check(length(id) between 1 and 100), code text not null unique, name text not null check(length(name) between 1 and 1000), category text not null check(category in ('INM','IMP-RS','IMP-Unit')), active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.user_unit_assignments (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), unit_id text not null references public.units(id), indicator_id text references public.indicators(id), created_at timestamptz not null default now(), unique nulls not distinct(user_id, unit_id, indicator_id));
create table public.indicator_unit_assignments (indicator_id text not null references public.indicators(id), unit_id text not null references public.units(id), due_day integer not null default 10 check(due_day between 1 and 28), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(indicator_id,unit_id));
create table public.indicator_versions (id uuid primary key default gen_random_uuid(), indicator_id text not null references public.indicators(id), version integer not null check(version > 0), config jsonb not null, created_at timestamptz not null default now(), created_by uuid references public.profiles(id), unique(indicator_id,version), unique(id,indicator_id));
create table public.indicator_targets (id uuid primary key default gen_random_uuid(), version_id uuid not null references public.indicator_versions(id), period date not null check(extract(day from period)=1 and extract(year from period) between 2020 and 2100), target numeric check(target>=0 and target<=1e12), target_upper numeric check(target_upper>=target and target_upper<=1e12), created_at timestamptz not null default now(), unique(version_id,period), unique(id,version_id,period));
create table public.indicator_submissions (
 id uuid primary key, indicator_id text not null references public.indicators(id), unit_id text not null references public.units(id), period date not null,
 version_id uuid not null, target_id uuid not null, snapshot jsonb not null, data jsonb not null, result numeric,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','UNDER_VALIDATION','VALIDATED','PENDING_MUTU','NEEDS_REVISION','RESUBMITTED','NEEDS_CLARIFICATION','PUBLISHED')),
 lock_version integer not null default 1, revision_no integer not null default 1, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 unique(indicator_id,unit_id,period), foreign key(version_id,indicator_id) references public.indicator_versions(id,indicator_id), foreign key(target_id,version_id,period) references public.indicator_targets(id,version_id,period)
);
create table public.submission_revisions (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.indicator_submissions(id), lock_version integer not null, payload jsonb not null, created_at timestamptz not null default now(), unique(submission_id,lock_version));
create table public.validation_actions (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.indicator_submissions(id), validator_id uuid not null references public.profiles(id), action text not null, note text not null, data_version integer not null, created_at timestamptz not null default now());
create table public.quality_reviews (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.indicator_submissions(id), reviewer_id uuid not null references public.profiles(id), decision text not null, note text not null, data_version integer not null, created_at timestamptz not null default now());
create table public.evidence_files (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.indicator_submissions(id), object_path text not null unique, mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')), size_bytes bigint not null check(size_bytes between 1 and 5242880), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create table public.corrective_actions (id uuid primary key, submission_id uuid not null references public.indicator_submissions(id), root_cause text not null, recommendation text not null, action text not null, owner text not null, due_date date not null, evidence text not null, evaluation text not null, status text not null check(status in ('OPEN','IN_PROGRESS','CLOSED')), lock_version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id), event_key text not null, message text not null, target_url text not null, read_at timestamptz, created_at timestamptz not null default now(), unique(recipient_id,event_key));
create table public.audit_logs (id uuid primary key default gen_random_uuid(), submission_id uuid references public.indicator_submissions(id), actor_id uuid references public.profiles(id), action text not null, before_state jsonb, after_state jsonb, reason text not null default '', created_at timestamptz not null default now());
create table public.workflow_requests (id uuid primary key, actor_id uuid not null references public.profiles(id), submission_id uuid not null references public.indicator_submissions(id), action text not null, response jsonb not null, created_at timestamptz not null default now());
create index submissions_inbox on public.indicator_submissions(status,unit_id,period);
create index assignments_user on public.user_unit_assignments(user_id,unit_id);
create index revisions_latest on public.submission_revisions(submission_id,lock_version desc);
create index audit_actor_time on public.audit_logs(actor_id,created_at);
create index audit_submission_time on public.audit_logs(submission_id,created_at);
create index notifications_inbox on public.notifications(recipient_id,read_at,created_at desc);
create index actions_submission on public.corrective_actions(submission_id);
create index validation_submission on public.validation_actions(submission_id);
create index quality_submission on public.quality_reviews(submission_id);
create index evidence_submission on public.evidence_files(submission_id);

create function public.my_role() returns text language sql stable security definer set search_path = public, pg_temp as $$ select role from public.profiles where id=auth.uid() and active $$;
create function public.has_assignment(p_unit text,p_indicator text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.user_unit_assignments where user_id=auth.uid() and unit_id=p_unit and (indicator_id is null or indicator_id=p_indicator)) $$;
create function public.can_read_submission(p_id uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.indicator_submissions s where s.id=p_id and (public.my_role() in ('admin','mutu') or (public.my_role() in ('unit','validator') and public.has_assignment(s.unit_id,s.indicator_id)) or (public.my_role()='leader' and s.status='PUBLISHED')))
$$;
create function public.can_read_published(p_id uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select public.can_read_submission(p_id) or (public.my_role()='leader' and exists(select 1 from public.submission_revisions where submission_id=p_id and payload->>'status'='PUBLISHED'))
$$;
create function public.can_edit_submission(p_id uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.indicator_submissions s where s.id=p_id and s.created_by=auth.uid() and public.my_role()='unit' and public.has_assignment(s.unit_id,s.indicator_id) and s.status in ('DRAFT','NEEDS_REVISION','NEEDS_CLARIFICATION'))
$$;
create function public.require_actor() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.my_role() is null then raise exception 'Akun tidak aktif atau belum login.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.audit_logs where actor_id=auth.uid() and created_at>now()-interval '1 minute')>=120 then raise exception 'Terlalu banyak perubahan; coba kembali satu menit lagi.'; end if;
end $$;
create function public.validate_definition(d jsonb) returns void language plpgsql immutable set search_path=public,pg_temp as $$
declare field text;
begin
 foreach field in array array['definition','numerator_label','denominator_label','measurement','direction','aggregation','unit_label','frequency','source','inclusion','exclusion','owner'] loop
  if jsonb_typeof(d->field) is distinct from 'string' then raise exception 'Field definisi wajib bertipe teks.'; end if;
 end loop;
 if jsonb_typeof(d) is distinct from 'object' or not(d ?& array['definition','numerator_label','denominator_label','measurement','multiplier','direction','aggregation','unit_label','frequency','source','inclusion','exclusion','owner','min_sample','min_value','max_value']) then raise exception 'Definisi belum lengkap.'; end if;
 if (d->>'measurement') not in ('proportion','rate','time','count') or (d->>'direction') not in ('higher_is_better','lower_is_better','range') or (d->>'aggregation') not in ('weighted','sum','none') or d->>'frequency'<>'monthly' then raise exception 'Formula/arah tidak didukung.'; end if;
 if length(trim(d->>'definition')) not between 1 and 4000 or length(trim(d->>'source')) not between 1 and 1000 or length(trim(d->>'owner')) not between 1 and 200 or length(trim(d->>'unit_label')) not between 1 and 100 then raise exception 'Definisi, sumber, satuan dan PIC wajib diisi.'; end if;
 if length(d->>'inclusion')>2000 or length(d->>'exclusion')>2000 or length(d->>'numerator_label')>1000 or length(d->>'denominator_label')>1000 then raise exception 'Definisi terlalu panjang.'; end if;
 if jsonb_typeof(d->'multiplier')<>'number' or not((d->>'multiplier')::numeric>0 and (d->>'multiplier')::numeric<=1000000) or jsonb_typeof(d->'min_sample')<>'number' or (d->>'min_sample')::numeric<0 or mod((d->>'min_sample')::numeric,1)<>0 or jsonb_typeof(d->'min_value')<>'number' or jsonb_typeof(d->'max_value')<>'number' or not((d->>'min_value')::numeric>=0 and (d->>'max_value')::numeric>0 and (d->>'max_value')::numeric<=1e12 and (d->>'min_value')::numeric<=(d->>'max_value')::numeric) then raise exception 'Rentang definisi tidak valid.'; end if;
 if (d->>'measurement'='proportion' and (d->>'multiplier')::numeric<>100) or ((d->>'measurement' in ('proportion','rate')) <> (d->>'aggregation'='weighted')) then raise exception 'Konfigurasi agregasi tidak valid.'; end if;
end $$;
create function public.calculate_measurement(d jsonb,v jsonb,submitting boolean default false) returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
declare n numeric; den numeric; val numeric; k text; expected text; field text;
begin
 if jsonb_typeof(v) is distinct from 'object' or not(v ?& array['kind','numerator','denominator','value','reason_code','reason','notes','intervention']) or v-array['kind','numerator','denominator','value','reason_code','reason','notes','intervention']<>'{}'::jsonb then raise exception 'Data pengukuran tidak valid.'; end if;
 foreach field in array array['kind','reason_code','reason','notes','intervention'] loop
  if jsonb_typeof(v->field) is distinct from 'string' or length(v->>field)>(case when field='notes' then 4000 when field='reason' then 2000 else 1000 end) then raise exception 'Teks pengukuran tidak valid.'; end if;
 end loop;
 foreach field in array array['numerator','denominator','value'] loop
  if jsonb_typeof(v->field) not in ('null','number') then raise exception 'Angka harus bertipe number/null.'; end if;
  if jsonb_typeof(v->field)='number' and not((v->>field)::numeric between 0 and 1e12) then raise exception 'Angka di luar rentang.'; end if;
 end loop;
 k:=v->>'kind'; n:=(v->>'numerator')::numeric; den:=(v->>'denominator')::numeric; val:=(v->>'value')::numeric;
 if k in ('no_cases','not_applicable','missing') then
  expected:=case k when 'no_cases' then 'NO_ELIGIBLE_CASES' when 'not_applicable' then 'NOT_APPLICABLE' else 'AWAITING_DATA' end;
  if v->>'reason_code'<>expected or length(trim(v->>'reason'))=0 or n is not null or den is not null or val is not null then raise exception 'Alasan terstruktur wajib; angka harus kosong.'; end if;
  if submitting and k='missing' then raise exception 'Data belum lengkap tidak dapat diajukan.'; end if;
  return null;
 end if;
 if k is distinct from 'measured' then raise exception 'Jenis pengukuran tidak dikenal.'; end if;
 if d->>'measurement' in ('proportion','rate') then
  if n is null or den is null or mod(n,1)<>0 or mod(den,1)<>0 or val is not null then raise exception 'Numerator/denominator wajib bilangan bulat; nilai manual tidak dipakai.'; end if;
  if den<=0 then raise exception 'Denominator nol: pilih Tidak ada kasus dan isi alasan.'; end if;
  if d->>'measurement'='proportion' and n>den then raise exception 'Numerator tidak boleh melebihi denominator untuk proporsi.'; end if;
  if submitting and den<(d->>'min_sample')::numeric then raise exception 'Sampel minimal belum terpenuhi.'; end if;
  val:=n/den*(d->>'multiplier')::numeric;
 elsif d->>'measurement' in ('time','count') then
  if val is null or n is not null or den is not null or (d->>'measurement'='count' and mod(val,1)<>0) then raise exception 'Nilai wajib sesuai tipe indikator.'; end if;
 else raise exception 'Formula tidak didukung.';
 end if;
 if val<(d->>'min_value')::numeric or val>(d->>'max_value')::numeric then raise exception 'Nilai di luar rentang definisi.'; end if;
 return val;
end $$;
-- Revisions contain data; audit stores only actor, state, version, reason (no file contents).
create function public.record_change(s public.indicator_submissions,previous jsonb,reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.submission_revisions(submission_id,lock_version,payload) values(s.id,s.lock_version,to_jsonb(s));
 insert into public.audit_logs(submission_id,actor_id,action,before_state,after_state,reason) values(s.id,auth.uid(),s.status,previous,jsonb_build_object('status',s.status,'lock_version',s.lock_version),reason);
end $$;
create function public.save_submission_draft(p_id uuid,p_indicator_id text,p_unit_id text,p_period date,p_data jsonb,p_expected_version integer) returns public.indicator_submissions language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.indicator_submissions; v public.indicator_versions; t public.indicator_targets; i public.indicators; before jsonb;
begin
 perform public.require_actor();
 if public.my_role()<>'unit' or not public.has_assignment(p_unit_id,p_indicator_id) then raise exception 'Akses unit ditolak.' using errcode='42501'; end if;
 if not exists(select 1 from public.units where id=p_unit_id and active) or not exists(select 1 from public.indicator_unit_assignments where indicator_id=p_indicator_id and unit_id=p_unit_id) then raise exception 'Unit/indikator tidak aktif atau belum dipetakan.'; end if;
 select * into i from public.indicators where id=p_indicator_id and active;
 if not found then raise exception 'Indikator belum aktif.'; end if;
 select * into s from public.indicator_submissions where id=p_id for update;
 if found then
  if not public.can_edit_submission(s.id) or s.unit_id<>p_unit_id or s.indicator_id<>p_indicator_id or s.period<>p_period then raise exception 'Draft terkunci/identitas tidak sesuai.' using errcode='42501'; end if;
  if s.lock_version<>p_expected_version then raise exception 'CONFLICT: data telah berubah; muat ulang.' using errcode='40001'; end if;
  before:=jsonb_build_object('status',s.status,'lock_version',s.lock_version);
  s.result:=public.calculate_measurement(s.snapshot->'definition',p_data,false);
  s.data:=p_data; s.lock_version:=s.lock_version+1; s.updated_at:=now();
  update public.indicator_submissions set data=s.data,result=s.result,lock_version=s.lock_version,updated_at=s.updated_at where id=s.id;
 else
  if p_expected_version<>0 then raise exception 'CONFLICT: draft tidak ditemukan.' using errcode='40001'; end if;
  select iv.* into v from public.indicator_versions iv join public.indicator_targets it on it.version_id=iv.id where iv.indicator_id=p_indicator_id and it.period=p_period and it.target is not null order by iv.version desc limit 1;
  if not found then raise exception 'Definisi/target periode belum disahkan Admin.'; end if;
  perform public.validate_definition(v.config);
  select * into strict t from public.indicator_targets where version_id=v.id and period=p_period;
  if v.config->>'direction'='range' and t.target_upper is null then raise exception 'Batas atas target wajib.'; end if;
  insert into public.indicator_submissions(id,indicator_id,unit_id,period,version_id,target_id,snapshot,data,result,created_by)
  values(p_id,p_indicator_id,p_unit_id,p_period,v.id,t.id,jsonb_build_object('definition',v.config,'target',t.target,'target_upper',t.target_upper,'version',v.version,'code',i.code,'name',i.name),p_data,public.calculate_measurement(v.config,p_data,false),auth.uid()) returning * into s;
 end if;
 perform public.record_change(s,before,'Simpan draft');
 return s;
end $$;
create function public.transition_submission(p_id uuid,p_expected_version integer,p_action text,p_note text,p_request_id uuid) returns public.indicator_submissions language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.indicator_submissions; role_name text; owner boolean; validator boolean; next_status text; steps text[]; previous jsonb; request public.workflow_requests; recipient uuid; dest text;
begin
 perform public.require_actor();
 select * into s from public.indicator_submissions where id=p_id for update;
 if not found then raise exception 'Pengajuan tidak ditemukan.' using errcode='42501'; end if;
 select * into request from public.workflow_requests where id=p_request_id;
 if found then
  if request.actor_id<>auth.uid() or request.submission_id<>p_id or request.action<>p_action then raise exception 'Idempotency key tidak sesuai.'; end if;
  return jsonb_populate_record(null::public.indicator_submissions,request.response);
 end if;
 if s.lock_version<>p_expected_version then raise exception 'CONFLICT: versi sudah berubah; muat ulang.' using errcode='40001'; end if;
 role_name:=public.my_role();
 owner:=role_name='unit' and s.created_by=auth.uid() and public.has_assignment(s.unit_id,s.indicator_id);
 validator:=role_name='validator' and s.created_by<>auth.uid() and public.has_assignment(s.unit_id,s.indicator_id);
 if p_note is null or length(p_note)>2000 or (p_action<>'submit' and length(trim(p_note))=0) then raise exception 'Catatan keputusan/alasan wajib, maksimal 2000 karakter.'; end if;
 if p_action='submit' and owner and s.status in ('DRAFT','NEEDS_REVISION','NEEDS_CLARIFICATION') then
  perform public.calculate_measurement(s.snapshot->'definition',s.data,true);
  steps:=array[case when s.status='DRAFT' then 'SUBMITTED' else 'RESUBMITTED' end];
 elsif p_action='start_validation' and validator and s.status in ('SUBMITTED','RESUBMITTED') then steps:=array['UNDER_VALIDATION'];
 elsif p_action='reject' and validator and s.status='UNDER_VALIDATION' then steps:=array['NEEDS_REVISION'];
 elsif p_action='approve' and validator and s.status='UNDER_VALIDATION' then steps:=array['VALIDATED','PENDING_MUTU'];
 elsif p_action='clarify' and role_name='mutu' and auth.uid()<>s.created_by and s.status='PENDING_MUTU' then steps:=array['NEEDS_CLARIFICATION'];
 elsif p_action='publish' and role_name='mutu' and auth.uid()<>s.created_by and s.status='PENDING_MUTU' then
  perform public.calculate_measurement(s.snapshot->'definition',s.data,true); steps:=array['PUBLISHED'];
 elsif p_action='amend' and owner and s.status='PUBLISHED' then steps:=array['DRAFT']; s.revision_no:=s.revision_no+1; s.published_at:=null;
 else raise exception 'Transisi tidak sah atau akses ditolak.' using errcode='42501';
 end if;
 foreach next_status in array steps loop
  previous:=jsonb_build_object('status',s.status,'lock_version',s.lock_version);
  s.status:=next_status; s.lock_version:=s.lock_version+1; s.updated_at:=now();
  if next_status='PUBLISHED' then s.published_at:=now(); end if;
  update public.indicator_submissions set status=s.status,lock_version=s.lock_version,revision_no=s.revision_no,updated_at=s.updated_at,published_at=s.published_at where id=s.id;
  perform public.record_change(s,previous,p_note);
 end loop;
 if p_action in ('start_validation','reject','approve') then insert into public.validation_actions(submission_id,validator_id,action,note,data_version) values(s.id,auth.uid(),p_action,p_note,s.lock_version); end if;
 if p_action in ('clarify','publish') then insert into public.quality_reviews(submission_id,reviewer_id,decision,note,data_version) values(s.id,auth.uid(),p_action,p_note,s.lock_version); end if;
 dest:=case when p_action='submit' then '/validator' when p_action='approve' then '/mutu/inbox' when p_action='publish' then '/pimpinan/dashboard' else '/unit/submissions' end;
 for recipient in select distinct p.id from public.profiles p where p.active and (
  (p_action='submit' and p.role='validator' and p.id<>s.created_by and exists(select 1 from public.user_unit_assignments a where a.user_id=p.id and a.unit_id=s.unit_id and (a.indicator_id is null or a.indicator_id=s.indicator_id))) or
  (p_action='approve' and p.role='mutu') or (p_action in ('reject','clarify') and p.id=s.created_by) or (p_action='publish' and (p.role in ('leader','mutu') or p.id=s.created_by))
 ) loop
  insert into public.notifications(recipient_id,event_key,message,target_url) values(recipient,s.id::text||':'||s.lock_version,s.snapshot->>'code'||' · '||s.status,dest) on conflict do nothing;
 end loop;
 insert into public.workflow_requests(id,actor_id,submission_id,action,response) values(p_request_id,auth.uid(),s.id,p_action,to_jsonb(s));
 return s;
end $$;
-- Only newest published revision per slot; an in-progress amendment cannot remove the last official version.
create view public.official_submissions with (security_invoker=true) as
 select distinct on (submission_id) submission_id, payload from public.submission_revisions where payload->>'status'='PUBLISHED' order by submission_id,lock_version desc;
create function public.mark_notification_read(p_id uuid) returns void language sql security definer set search_path=public,pg_temp as $$ update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and recipient_id=auth.uid() and public.my_role() is not null $$;
create function public.save_corrective_action(p_action jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.indicator_submissions; a public.corrective_actions; aid uuid; expected integer;
begin
 perform public.require_actor();
 select * into s from public.indicator_submissions where id=(p_action->>'submission_id')::uuid for update;
 if not found or not public.can_read_submission(s.id) or not(public.my_role()='mutu' or (public.my_role()='unit' and public.has_assignment(s.unit_id,s.indicator_id))) then raise exception 'Akses tindak lanjut ditolak.' using errcode='42501'; end if;
 if length(trim(p_action->>'action')) not between 1 and 4000 or length(trim(p_action->>'owner')) not between 1 and 200 or p_action->>'status' not in ('OPEN','IN_PROGRESS','CLOSED') or length(p_action->>'root_cause')>4000 or length(p_action->>'recommendation')>4000 or length(p_action->>'evidence')>2000 or length(p_action->>'evaluation')>4000 or ((p_action->>'status')='CLOSED' and length(trim(p_action->>'evaluation'))=0) then raise exception 'Isi tindakan, PIC dan evaluasi penutupan.'; end if;
 aid:=(p_action->>'id')::uuid; expected:=(p_action->>'lock_version')::integer;
 select * into a from public.corrective_actions where id=aid for update;
 if found and (a.lock_version<>expected or a.submission_id<>s.id) then raise exception 'CONFLICT: tindak lanjut berubah.' using errcode='40001'; end if;
 if not found and expected<>0 then raise exception 'CONFLICT: tindak lanjut tidak ditemukan.'; end if;
 insert into public.corrective_actions(id,submission_id,root_cause,recommendation,action,owner,due_date,evidence,evaluation,status,lock_version)
 values(aid,s.id,p_action->>'root_cause',p_action->>'recommendation',p_action->>'action',p_action->>'owner',(p_action->>'due_date')::date,p_action->>'evidence',p_action->>'evaluation',p_action->>'status',expected+1)
 on conflict(id) do update set root_cause=excluded.root_cause,recommendation=excluded.recommendation,action=excluded.action,owner=excluded.owner,due_date=excluded.due_date,evidence=excluded.evidence,evaluation=excluded.evaluation,status=excluded.status,lock_version=excluded.lock_version,updated_at=now();
 insert into public.audit_logs(submission_id,actor_id,action,reason) values(s.id,auth.uid(),'CORRECTIVE_ACTION','Perubahan tindak lanjut');
end $$;
create function public.admin_save_master(p_input jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i jsonb; d jsonb; vid uuid; next_version integer; uid text; selected_indicator_id text;
begin
 perform public.require_actor(); if public.my_role()<>'admin' then raise exception 'Admin diperlukan.' using errcode='42501'; end if;
 i:=p_input->'indicator'; d:=p_input->'config'; selected_indicator_id:=i->>'id';
 perform public.validate_definition(d);
 if (p_input->>'target')::numeric not between 0 and 1e12 or jsonb_typeof(p_input->'target') is distinct from 'number' or (d->>'direction'='range' and (jsonb_typeof(p_input->'target_upper') is distinct from 'number' or (p_input->>'target_upper')::numeric<(p_input->>'target')::numeric)) then raise exception 'Target wajib valid.'; end if;
 insert into public.indicators(id,code,name,category,active) values(selected_indicator_id,i->>'code',i->>'name',i->>'category',(i->>'active')::boolean)
 on conflict(id) do update set code=excluded.code,name=excluded.name,category=excluded.category,active=excluded.active,updated_at=now();
 -- Lock the indicator across concurrent new-version requests.
 perform 1 from public.indicators where id=selected_indicator_id for update;
 select coalesce(max(version),0)+1 into next_version from public.indicator_versions where public.indicator_versions.indicator_id=selected_indicator_id;
 insert into public.indicator_versions(indicator_id,version,config,created_by) values(selected_indicator_id,next_version,d,auth.uid()) returning id into vid;
 insert into public.indicator_targets(version_id,period,target,target_upper) values(vid,(p_input->>'period')::date,(p_input->>'target')::numeric,(p_input->>'target_upper')::numeric);
 for uid in select jsonb_array_elements_text(p_input->'unit_ids') loop
  insert into public.indicator_unit_assignments(indicator_id,unit_id) values(selected_indicator_id,uid) on conflict do nothing;
 end loop;
 insert into public.audit_logs(actor_id,action,reason) values(auth.uid(),'MASTER_VERSION','Versi baru: '||selected_indicator_id||' v'||next_version);
end $$;
create function public.admin_save_user(p_profile jsonb,p_assignments jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a jsonb; uid uuid; old public.profiles;
begin
 perform public.require_actor(); if public.my_role()<>'admin' then raise exception 'Admin diperlukan.' using errcode='42501'; end if;
 uid:=(p_profile->>'id')::uuid;
 -- Serialize administrator changes so the last active admin cannot be removed concurrently.
 perform pg_advisory_xact_lock(72834190);
 select * into old from public.profiles where id=uid for update;
 if not found then raise exception 'Buat/invite akun melalui Supabase Auth terlebih dahulu.'; end if;
 if old.role='admin' and old.active and (p_profile->>'role'<>'admin' or not (p_profile->>'active')::boolean) and (select count(*) from public.profiles where role='admin' and active)=1 then raise exception 'Admin aktif terakhir tidak boleh dinonaktifkan.'; end if;
 update public.profiles set display_name=p_profile->>'display_name',role=p_profile->>'role',active=(p_profile->>'active')::boolean,updated_at=now() where id=uid;
 delete from public.user_unit_assignments where user_id=uid;
 for a in select * from jsonb_array_elements(p_assignments) loop
  insert into public.user_unit_assignments(user_id,unit_id,indicator_id) values(uid,a->>'unit_id',a->>'indicator_id');
 end loop;
 insert into public.audit_logs(actor_id,action,reason) values(auth.uid(),'USER_ASSIGNMENT','Konfigurasi role/penugasan '||uid);
end $$;
create function public.admin_save_unit(p_unit jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.require_actor(); if public.my_role()<>'admin' then raise exception 'Admin diperlukan.' using errcode='42501'; end if;
 insert into public.units(id,name,active) values(p_unit->>'id',p_unit->>'name',(p_unit->>'active')::boolean) on conflict(id) do update set name=excluded.name,active=excluded.active,updated_at=now();
 insert into public.audit_logs(actor_id,action,reason) values(auth.uid(),'UNIT_CONFIG','Konfigurasi unit');
end $$;
create function public.generate_deadline_reminders() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare period_date date; slot record;
begin
 period_date:=date_trunc('month',now())::date-interval '1 month';
 for slot in select distinct a.user_id,m.unit_id,m.indicator_id from public.indicator_unit_assignments m join public.indicators i on i.id=m.indicator_id and i.active join public.units u on u.id=m.unit_id and u.active join public.user_unit_assignments a on a.unit_id=m.unit_id and (a.indicator_id is null or a.indicator_id=m.indicator_id) join public.profiles p on p.id=a.user_id and p.active and p.role='unit'
 where current_date>date_trunc('month',now())::date+(m.due_day-1) and not exists(select 1 from public.indicator_submissions s where s.indicator_id=m.indicator_id and s.unit_id=m.unit_id and s.period=period_date and s.status not in ('DRAFT','NEEDS_REVISION','NEEDS_CLARIFICATION')) loop
  insert into public.notifications(recipient_id,event_key,message,target_url) values(slot.user_id,'deadline:'||period_date||':'||slot.unit_id||':'||slot.indicator_id,'Pengingat pelaporan '||slot.indicator_id||' · '||period_date,'/unit/input') on conflict do nothing;
 end loop;
end $$;
revoke all on function public.generate_deadline_reminders() from public,anon,authenticated;
create function public.enqueue_deadline_reminders() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.require_actor(); if public.my_role() not in ('admin','mutu') then raise exception 'Tim Mutu/Admin diperlukan.' using errcode='42501'; end if;
 perform public.generate_deadline_reminders();
end $$;
create function public.handle_new_quality_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.profiles(id,display_name) values(new.id,'Akun baru (menunggu Admin)'); return new;
end $$;
create trigger quality_user_created after insert on auth.users for each row execute function public.handle_new_quality_user();

-- All business writes go through validated RPCs. RLS remains in force for SELECT and Storage.
do $$ declare t text; begin
 foreach t in array array['roles','profiles','units','indicators','user_unit_assignments','indicator_unit_assignments','indicator_versions','indicator_targets','indicator_submissions','submission_revisions','validation_actions','quality_reviews','evidence_files','corrective_actions','notifications','audit_logs','workflow_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy roles_read on public.roles for select to authenticated using(public.my_role() is not null);
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.my_role() in ('admin','mutu') or (public.my_role() in ('unit','validator') and exists(select 1 from public.indicator_submissions s where s.created_by=profiles.id and public.can_read_submission(s.id))));
create policy units_read on public.units for select to authenticated using(public.my_role() is not null);
create policy indicators_read on public.indicators for select to authenticated using(public.my_role() is not null);
create policy versions_read on public.indicator_versions for select to authenticated using(public.my_role() is not null);
create policy targets_read on public.indicator_targets for select to authenticated using(public.my_role() is not null);
create policy mappings_read on public.indicator_unit_assignments for select to authenticated using(public.my_role() in ('admin','mutu','leader') or public.has_assignment(unit_id,indicator_id));
create policy assignments_read on public.user_unit_assignments for select to authenticated using(user_id=auth.uid() or public.my_role() in ('admin','mutu'));
create policy submissions_read on public.indicator_submissions for select to authenticated using(public.can_read_submission(id));
create policy revisions_read on public.submission_revisions for select to authenticated using((public.my_role()='leader' and payload->>'status'='PUBLISHED') or (public.my_role()<>'leader' and public.can_read_submission(submission_id)));
create policy validations_read on public.validation_actions for select to authenticated using(public.can_read_published(submission_id));
create policy reviews_read on public.quality_reviews for select to authenticated using(public.can_read_published(submission_id));
create policy evidence_read on public.evidence_files for select to authenticated using(public.can_read_submission(submission_id));
create policy corrective_read on public.corrective_actions for select to authenticated using(public.can_read_published(submission_id));
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=auth.uid() and public.my_role() is not null);
create policy audit_read on public.audit_logs for select to authenticated using(public.my_role() in ('admin','mutu') or public.can_read_published(submission_id));
-- No workflow_requests policy: idempotency responses are only accessible inside the authorized RPC.
grant select on public.official_submissions to authenticated;
-- Supabase grants function execution by default; revoke every helper explicitly.
revoke all on function public.my_role(), public.has_assignment(text,text), public.can_read_submission(uuid), public.can_read_published(uuid), public.can_edit_submission(uuid), public.require_actor(), public.validate_definition(jsonb), public.calculate_measurement(jsonb,jsonb,boolean), public.record_change(public.indicator_submissions,jsonb,text), public.save_submission_draft(uuid,text,text,date,jsonb,integer), public.transition_submission(uuid,integer,text,text,uuid), public.mark_notification_read(uuid), public.save_corrective_action(jsonb), public.admin_save_master(jsonb), public.admin_save_user(jsonb,jsonb), public.admin_save_unit(jsonb), public.enqueue_deadline_reminders(), public.handle_new_quality_user() from public, anon, authenticated;
grant execute on function public.my_role(), public.has_assignment(text,text), public.can_read_submission(uuid), public.can_read_published(uuid), public.can_edit_submission(uuid), public.save_submission_draft(uuid,text,text,date,jsonb,integer), public.transition_submission(uuid,integer,text,text,uuid), public.mark_notification_read(uuid), public.save_corrective_action(jsonb), public.admin_save_master(jsonb), public.admin_save_user(jsonb,jsonb), public.admin_save_unit(jsonb), public.enqueue_deadline_reminders() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('quality-evidence','quality-evidence',false,5242880,array['application/pdf','image/png','image/jpeg']);
create policy quality_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='quality-evidence' and public.can_edit_submission(((storage.foldername(name))[1])::uuid));
create policy quality_evidence_select on storage.objects for select to authenticated using(bucket_id='quality-evidence' and public.can_read_submission(((storage.foldername(name))[1])::uuid));
-- Objects are immutable; no overwrite, delete or anonymous/public download policy.
create function public.register_evidence(p_submission_id uuid,p_path text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare object_metadata jsonb;
begin
 perform public.require_actor();
 -- Lock with submit/approve so evidence cannot be attached after the draft was submitted.
 perform 1 from public.indicator_submissions where id=p_submission_id for update;
 if not public.can_edit_submission(p_submission_id) or split_part(p_path,'/',1)<>p_submission_id::text then raise exception 'Akses bukti ditolak.' using errcode='42501'; end if;
 select metadata into object_metadata from storage.objects where bucket_id='quality-evidence' and name=p_path;
 if not found then raise exception 'Berkas belum diunggah.'; end if;
 insert into public.evidence_files(submission_id,object_path,mime_type,size_bytes,created_by) values(p_submission_id,p_path,object_metadata->>'mimetype',(object_metadata->>'size')::bigint,auth.uid());
 insert into public.audit_logs(submission_id,actor_id,action,reason) values(p_submission_id,auth.uid(),'EVIDENCE','Bukti non-sensitif dilampirkan');
end $$;
revoke all on function public.register_evidence(uuid,text) from public,anon,authenticated;
grant execute on function public.register_evidence(uuid,text) to authenticated;
-- Pimpinan may read aggregate queue metrics, never unfinished measurements/revisions.
create function public.workflow_summary() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(summary)), '[]'::jsonb) from (
  select s.indicator_id,s.unit_id,s.period,
   (s.status in ('SUBMITTED','RESUBMITTED','UNDER_VALIDATION'))::integer pending_validation,
   (s.status='PENDING_MUTU')::integer pending_mutu,
   (s.status not in ('DRAFT','NEEDS_REVISION','NEEDS_CLARIFICATION') or exists(select 1 from public.submission_revisions r where r.submission_id=s.id and r.payload->>'status'='PUBLISHED'))::integer reported,
   coalesce(sum(extract(epoch from (approved.created_at-started.created_at))/3600),0) validation_hours,
   count(approved.id)::integer validation_count
  from public.indicator_submissions s
  left join public.validation_actions approved on approved.submission_id=s.id and approved.action='approve'
  left join public.validation_actions started on started.submission_id=s.id and started.action='start_validation' and started.data_version=approved.data_version-2
  where public.my_role() in ('admin','mutu','leader') or (public.my_role() in ('unit','validator') and public.has_assignment(s.unit_id,s.indicator_id))
  group by s.id,s.indicator_id,s.unit_id,s.period,s.status
 ) summary
$$;
revoke all on function public.workflow_summary() from public,anon,authenticated;
grant execute on function public.workflow_summary() to authenticated;
-- Realtime respects table SELECT policies. No sensitive payload is broadcast on public channels.
alter publication supabase_realtime add table public.indicator_submissions,public.notifications,public.corrective_actions;
commit;
