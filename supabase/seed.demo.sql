-- EXPLICIT STAGING ONLY. Never run against a production project.
-- The browser demo does not need this file. To exercise hosted staging, create a
-- synthetic Petugas Unit account in Auth and set these transaction-local settings:
-- begin; set local rsas.environment='staging'; set local rsas.demo_unit_user='<Auth UUID>';
-- Run this file in the SAME transaction, then commit. No password/key is created.
do $$
declare uid uuid; vid uuid; tid uuid; sid uuid; config jsonb;
begin
 if current_setting('rsas.environment',true) is distinct from 'staging' then raise exception 'Demo seed requires explicit staging opt-in.'; end if;
 uid:=nullif(current_setting('rsas.demo_unit_user',true),'')::uuid;
 if uid is null or not exists(select 1 from public.profiles where id=uid and role='unit' and active) then raise exception 'Prepare an active synthetic unit Auth account.'; end if;
 config:='{"definition":"DEMO: synthetic training observations, not a clinical standard","numerator_label":"Synthetic compliant trials","denominator_label":"Synthetic total trials","measurement":"proportion","multiplier":100,"direction":"higher_is_better","aggregation":"weighted","unit_label":"%","frequency":"monthly","source":"STAGING SYNTHETIC","inclusion":"Training trials","exclusion":"None","owner":"Staging team","min_sample":0,"min_value":0,"max_value":100}'::jsonb;
 perform public.validate_definition(config);
 insert into public.units(id,name) values('DEMO-SQL-A','DEMO staging unit');
 insert into public.indicators(id,code,name,category,active) values('DEMO-SQL-PROP','DEMO-SQL-PROP','DEMO synthetic process','INM',true);
 insert into public.indicator_versions(indicator_id,version,config) values('DEMO-SQL-PROP',1,config) returning id into vid;
 insert into public.indicator_targets(version_id,period,target) values(vid,'2026-04-01',95) returning id into tid;
 insert into public.indicator_unit_assignments(indicator_id,unit_id) values('DEMO-SQL-PROP','DEMO-SQL-A');
 insert into public.user_unit_assignments(user_id,unit_id,indicator_id) values(uid,'DEMO-SQL-A','DEMO-SQL-PROP');
 -- Seed remains a draft: staging publication still exercises real validator/Mutu RPCs.
 sid:=gen_random_uuid();
 insert into public.indicator_submissions(id,indicator_id,unit_id,period,version_id,target_id,snapshot,data,result,created_by)
 values(sid,'DEMO-SQL-PROP','DEMO-SQL-A','2026-04-01',vid,tid,jsonb_build_object('definition',config,'target',95,'target_upper',null,'version',1,'code','DEMO-SQL-PROP','name','DEMO synthetic process'),'{"kind":"measured","numerator":9,"denominator":10,"value":null,"reason_code":"","reason":"","notes":"STAGING SYNTHETIC","intervention":""}',90,uid);
 insert into public.submission_revisions(submission_id,lock_version,payload) select id,lock_version,to_jsonb(s) from public.indicator_submissions s where id=sid;
 insert into public.audit_logs(submission_id,actor_id,action,reason) values(sid,uid,'DEMO_SEED','Explicit staging-only synthetic draft');
end $$;
