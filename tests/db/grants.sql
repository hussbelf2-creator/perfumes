-- الصلاحيات الافتراضية في Supabase
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on schema public to service_role; grant all on all tables in schema public to service_role; alter role service_role bypassrls;
