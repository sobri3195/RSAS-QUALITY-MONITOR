-- Optional operator step on a Supabase project with pg_cron enabled.
-- Run as database owner. Daily 00:15 UTC (07:15 UTC+7), previous reporting month.
-- Replacing the named job is safe; unique event keys deduplicate repeated runs.
select cron.schedule('rsas-quality-deadlines','15 0 * * *','select public.generate_deadline_reminders();');
