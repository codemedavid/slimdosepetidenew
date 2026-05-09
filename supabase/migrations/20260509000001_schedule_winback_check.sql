-- Schedule the winback-check Edge Function to run daily at 09:00 UTC.
-- Requires the pg_cron and pg_net extensions (available on Supabase by default).
--
-- Before applying, set these database settings once in the Supabase SQL editor
-- (Project settings -> Database -> Custom Postgres config, or via SQL):
--   alter database postgres set "app.settings.supabase_url" = 'https://<PROJECT_REF>.supabase.co';
--   alter database postgres set "app.settings.service_role_key" = '<SERVICE_ROLE_KEY>';

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior schedule with the same name so re-running this migration is safe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'winback-check-daily') then
    perform cron.unschedule('winback-check-daily');
  end if;
end $$;

select cron.schedule(
  'winback-check-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/winback-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
