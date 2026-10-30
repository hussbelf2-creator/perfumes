\set ON_ERROR_STOP 1
\set QUIET 1
create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin raise notice '% %', case when cond then 'PASS' else 'FAIL' end, label; end $$;
create function pg_temp.denied(q text, label text) returns void language plpgsql as $$
begin
  execute q;
  raise notice 'FAIL % (was allowed)', label;
exception when others then
  raise notice 'PASS % [%]', label, sqlerrm;
end $$;
create function pg_temp.allowed(q text, label text) returns void language plpgsql as $$
begin execute q; raise notice 'PASS %', label;
exception when others then raise notice 'FAIL % [%]', label, sqlerrm; end $$;

-- المستخدمون (إنشاء auth.users يُنشئ profiles تلقائياً)
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','Owner@x.sa','{"first_name":"أحمد","last_name":"الكاف"}'),
 ('00000000-0000-0000-0000-00000000000b','admin@x.sa','{"first_name":"ريم","last_name":"الشهري"}'),
 ('00000000-0000-0000-0000-00000000000c','sales@x.sa','{"first_name":"فيصل","last_name":"القحطاني"}'),
 ('00000000-0000-0000-0000-00000000000d','designer@x.sa','{}'),
 ('00000000-0000-0000-0000-00000000000e','editor@x.sa','{}'),
 ('00000000-0000-0000-0000-00000000000f','client@x.sa','{}'),
 ('00000000-0000-0000-0000-000000000010','sales2@x.sa','{}');
select pg_temp.ok((select count(*) from profiles) = 7 and (select bool_and(role='client') from profiles), 'signup creates client profiles');
select pg_temp.ok((select email from profiles where id='00000000-0000-0000-0000-00000000000a') = 'owner@x.sa', 'email normalised to lowercase');
-- العميل الحالي أكّد بريده (ربط المشاريع بالبريد المؤكَّد فقط)
update auth.users set email_confirmed_at = now() where email = 'client@x.sa';
-- أول مالك من SQL Editor (بلا auth.uid)
update profiles set role='owner' where email='owner@x.sa';
update profiles set role='admin' where email='admin@x.sa';
update profiles set role='sales' where email in ('sales@x.sa','sales2@x.sa');
update profiles set role='designer' where email='designer@x.sa';
update profiles set role='editor' where email='editor@x.sa';
select pg_temp.ok((select count(*) from audit_log where action='team.role') = 6, 'role changes audited even from SQL editor');

-- ── زائر مجهول يرسل طلباً
set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.allowed($$insert into leads(kind,payload,page) values ('booking','{"firstName":"سارة","lastName":"العنزي","email":"Sara@Oud.sa","phone":"+966 55 123","slot_utc":"2026-10-20T08:00:00Z"}','/book')$$, 'anon submits booking');
select pg_temp.allowed($$insert into leads(kind,payload) values ('kit','{"firstName":"سارة","email":"sara@oud.sa"}')$$, 'anon submits kit (same email)');
select pg_temp.allowed($$insert into leads(kind,payload,status,assignee_id) values ('contact','{"email":"spoof@x.sa"}','done','00000000-0000-0000-0000-00000000000c')$$, 'anon spoof attempt accepted as plain lead');
select pg_temp.denied($$insert into leads(kind,payload) values ('contact', jsonb_build_object('m', repeat('x', 20000)))$$, 'anon cannot send oversized payload');
select pg_temp.denied($$insert into leads(kind,payload) values ('hack','{}')$$, 'anon cannot invent lead kind');
select pg_temp.ok((select count(*) from leads) = 0, 'anon cannot read leads');
select pg_temp.ok((select count(*) from contacts) = 0, 'anon cannot read contacts');
select pg_temp.denied($$insert into contacts(name) values ('x')$$, 'anon cannot create contact directly');
reset role;
select pg_temp.ok((select status from leads where payload->>'email'='spoof@x.sa') = 'new' and (select assignee_id from leads where payload->>'email'='spoof@x.sa') is null, 'spoofed status/assignee overridden by server');
delete from leads where payload->>'email'='spoof@x.sa'; delete from contacts where email='spoof@x.sa';
select pg_temp.ok((select count(*) from contacts) = 1, 'two requests, same email → one contact');
select pg_temp.ok((select count(*) from leads where contact_id is not null) = 2, 'both leads linked to contact');
select pg_temp.ok((select value from contacts limit 1) = 0 and (select source from contacts limit 1) = 'booking', 'contact source = first request');
select pg_temp.ok((select count(*) from activities where type='request') = 2, 'request activities logged');

-- ── عميل مسجّل
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from contacts) = 0 and (select count(*) from leads) = 0, 'client sees no CRM data');
select pg_temp.ok((select count(*) from profiles) = 1, 'client sees only own profile');
select pg_temp.denied($$update profiles set role='owner' where id='00000000-0000-0000-0000-00000000000f'$$, 'client cannot promote self');
select pg_temp.allowed($$update profiles set phone='+966500' where id='00000000-0000-0000-0000-00000000000f'$$, 'client edits own phone');
select pg_temp.denied($$update profiles set email='x@y.z' where id='00000000-0000-0000-0000-00000000000f'$$, 'client cannot change profile email');
select pg_temp.ok((select count(*) from payments) = 0 and (select count(*) from audit_log) = 0, 'client sees no payments/audit');

-- ── مبيعات
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from contacts) = 1 and (select count(*) from leads) = 2, 'sales sees CRM');
select pg_temp.allowed($$update contacts set stage='contacted', value=45000$$, 'sales moves stage + value');
select pg_temp.denied($$update contacts set owner_id='00000000-0000-0000-0000-00000000000c'$$, 'sales cannot self-assign (crm.assign)');
select pg_temp.allowed($$update leads set status='in_progress'$$, 'sales updates lead status');
select pg_temp.denied($$update leads set assignee_id='00000000-0000-0000-0000-00000000000c'$$, 'sales cannot assign lead');
select pg_temp.denied($$update leads set payload='{}'$$, 'sales cannot alter lead content');
select pg_temp.allowed($$insert into activities(contact_id,type,body) select id,'call','مكالمة تعريفية' from contacts$$, 'sales logs call (actor defaults to self)');
select pg_temp.denied($$insert into activities(contact_id,type,body,actor_id) select id,'note','x','00000000-0000-0000-0000-00000000000b' from contacts$$, 'sales cannot log as someone else');
select pg_temp.denied($$insert into activities(contact_id,type,body) select id,'stage','fake' from contacts$$, 'sales cannot forge system activity');
update activities set body='edited';
select pg_temp.ok(not exists(select 1 from activities where body='edited'), 'activities are immutable');
select pg_temp.denied($$insert into audit_log(action,entity) values ('x','y')$$, 'sales cannot write audit');
select pg_temp.ok((select count(*) from audit_log) = 0, 'sales cannot read audit');
select pg_temp.denied($$select public.write_audit('x','y','z','w')$$, 'sales cannot call write_audit');
update profiles set role='admin' where id='00000000-0000-0000-0000-000000000010';
delete from contacts;
reset role;
select pg_temp.ok((select role from profiles where id='00000000-0000-0000-0000-000000000010') = 'sales', 'sales cannot change roles (row untouched)');
select pg_temp.ok((select count(*) from contacts) = 1, 'sales cannot delete contacts (row untouched)');
select pg_temp.ok((select stage from contacts) = 'contacted' and (select value from contacts) = 45000, 'stage/value saved');
select pg_temp.ok((select count(*) from activities where type in ('stage','value') and actor_id='00000000-0000-0000-0000-00000000000c') = 2, 'stage+value activities by trigger, attributed to sales');
select pg_temp.ok(exists(select 1 from audit_log where action='crm.stage' and actor_id='00000000-0000-0000-0000-00000000000c'), 'stage change audited with actor');
select pg_temp.ok(exists(select 1 from audit_log where action='crm.lead_status'), 'lead status audited');

-- ── مدير
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select pg_temp.allowed($$update contacts set owner_id='00000000-0000-0000-0000-00000000000c'$$, 'admin assigns contact');
reset role;
select pg_temp.ok((select bool_and(assignee_id='00000000-0000-0000-0000-00000000000c') from leads where status in ('new','in_progress')), 'open leads follow contact owner');
select pg_temp.ok(exists(select 1 from activities where type='assign' and body like '%فيصل%'), 'assign activity names the assignee');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select pg_temp.denied($$update profiles set role='owner' where email='sales2@x.sa'$$, 'admin cannot grant owner');
select pg_temp.denied($$update profiles set role='client' where email='owner@x.sa'$$, 'admin cannot demote owner');
select pg_temp.denied($$update profiles set role='client' where email='admin@x.sa'$$, 'admin cannot change own role');
select pg_temp.allowed($$update profiles set role='designer' where email='sales2@x.sa'$$, 'admin changes sales2 → designer');
select pg_temp.ok((select count(*) from audit_log) > 0, 'admin reads audit');

-- ── مالك
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.allowed($$update profiles set role='owner' where email='admin@x.sa'$$, 'owner grants owner');
select pg_temp.denied($$update profiles set active=false where email='owner@x.sa'$$, 'owner cannot deactivate self');
select pg_temp.allowed($$update profiles set role='admin' where email='admin@x.sa'$$, 'owner demotes second owner');
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.denied($$update profiles set role='admin' where email='owner@x.sa'$$, 'last owner protected even from SQL editor');

-- ── مصمم: مهامه فقط
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.ok((select count(*) from contacts) = 0 and (select count(*) from payments) = 0, 'designer sees no CRM/payments');
select pg_temp.allowed($$insert into tasks(title,due_at,assignee_id) values ('تجهيز ملف التصميم', now()+interval '1 day','00000000-0000-0000-0000-00000000000d')$$, 'designer adds own task');
select pg_temp.denied($$insert into tasks(title,due_at,assignee_id) values ('x', now(),'00000000-0000-0000-0000-00000000000c')$$, 'designer cannot assign task to others');
select pg_temp.denied($$insert into tasks(title,due_at,assignee_id,created_by) values ('x', now(),'00000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-00000000000b')$$, 'designer cannot forge created_by');
reset role;
insert into tasks(title,due_at,assignee_id,created_by) values ('مهمة المبيعات', now(), '00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.ok((select count(*) from tasks) = 1, 'designer sees only own task');
select pg_temp.allowed($$update tasks set done=true$$, 'designer completes own task');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from tasks) = 2, 'sales (crm.view) sees all tasks');

-- ── المدفوعات
reset role;
insert into payments(id,order_ref,kind,amount,status,method,email) values ('p1','KIT-ABC234','kit',75000,'paid','mada','SARA@oud.sa');
select pg_temp.ok(exists(select 1 from activities where type='payment' and body like '750%KIT-ABC234%'), 'paid payment appears on contact timeline');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from payments) = 1, 'sales sees payments');
select pg_temp.denied($$insert into payments(id,amount,status) values ('p2',1,'paid')$$, 'staff cannot forge payments');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.ok((select count(*) from payments) = 0 and (select count(*) from contacts) = 0, 'editor sees no payments/CRM');
select pg_temp.ok((select count(*) from profiles) = 7, 'editor sees team (team.view)');

-- ── حساب معطّل يفقد صلاحياته فوراً
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
update profiles set active=false where email='sales@x.sa';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from contacts) = 0 and (select count(*) from leads) = 0, 'deactivated sales loses access immediately');
reset role;
select pg_temp.ok(exists(select 1 from audit_log where action='team.deactivate'), 'deactivation audited');

-- ── أستوديو العبوات
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select count(*) from packaging_models where published) = 8, 'seed catalogue: 8 published models');
update packaging_models set published=false where id='C-TOWER';
set role anon;
select pg_temp.ok((select count(*) from packaging_models) = 7, 'anon sees published only');
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile) values ('cap','x',10,'[[1,0],[1,10]]')$$, 'anon cannot add models');
update packaging_models set name_ar='hacked';
reset role;
select pg_temp.ok(not exists(select 1 from packaging_models where name_ar='hacked'), 'anon cannot edit models');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.ok((select count(*) from packaging_models) = 8, 'designer sees unpublished too');
select pg_temp.allowed($$insert into packaging_models(id,kind,name_ar,height_mm,neck_mm,profile,published) values ('B-TEST','bottle','تجربة',90,12,'[[20,0],[20,78],[8,82],[8,90]]',false)$$, 'designer adds model');
select pg_temp.allowed($$update packaging_models set published=true where id='B-TEST'$$, 'designer publishes');
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile) values ('cap','x',10,'[[1,0]]')$$, 'profile needs ≥ 2 points');
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile,thumb) values ('cap','x',10,'[[1,0],[1,10]]', repeat('x', 300000))$$, 'oversized thumbnail rejected');
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile,section) values ('cap','x',10,'[[1,0],[1,10]]','hexagon')$$, 'unknown section rejected');
select pg_temp.allowed($$delete from packaging_models where id='B-TEST'$$, 'designer deletes');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
-- sales2 أصبح مصمماً في اختبار سابق؛ نستخدم حساب المحرر بدلاً منه
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile) values ('cap','x',10,'[[1,0],[1,10]]')$$, 'editor (no studio.manage) cannot add');
update packaging_models set published=false where id='B-ATLAS';
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select published from packaging_models where id='B-ATLAS'), 'editor cannot unpublish (row untouched)');
select pg_temp.ok((select count(*) from audit_log where action in ('studio.create','studio.publish','studio.delete') and actor_id='00000000-0000-0000-0000-00000000000d') = 3, 'studio create/publish/delete audited with designer as actor');

-- ── نماذج الذكاء الاصطناعي ومهامها
reset role; select set_config('request.jwt.claim.sub','',false);
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.allowed($$insert into packaging_models(id,kind,name_ar,height_mm,profile,source,glb_url,published) values ('B-AI1','bottle','منتج بالذكاء',110,'[[20,0],[20,110]]','ai','https://proj.supabase.co/storage/v1/object/public/models/ai/x.glb',true)$$, 'designer saves AI model with https GLB');
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile,source,glb_url) values ('bottle','x',100,'[[1,0],[1,10]]','ai','javascript:alert(1)')$$, 'non-https model URL rejected');
select pg_temp.denied($$insert into packaging_models(kind,name_ar,height_mm,profile,source) values ('bottle','x',100,'[[1,0],[1,10]]','ai')$$, 'AI model requires a GLB');
select pg_temp.ok((select count(*) from ai3d_jobs) = 0, 'designer can read jobs table (empty)');
select pg_temp.denied($$insert into ai3d_jobs(provider,provider_task_id) values ('meshy','t')$$, 'jobs not writable from the browser');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from ai3d_jobs) = 0, 'sales cannot see AI jobs');
select pg_temp.ok((select public.has_perm('studio.manage')) = false, 'has_perm RPC: sales lacks studio.manage');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.ok((select public.has_perm('studio.manage')) = true, 'has_perm RPC: designer has studio.manage (used by api/ai3d)');
reset role;

-- ── استوديو المبدعين
reset role; select set_config('request.jwt.claim.sub','',false);
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.allowed($$insert into creatives(id,slug,name_ar,specialties,published) values ('11111111-1111-1111-1111-111111111111','reem','ريم','{identity,label}',true)$$, 'designer adds a creative');
select pg_temp.allowed($$insert into creatives(id,slug,name_ar,specialties,published) values ('22222222-2222-2222-2222-222222222222','draft-one','مسودة','{packaging}',false)$$, 'designer adds an unpublished creative');
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties) values ('reem','نسخة','{identity}')$$, 'duplicate slug rejected');
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties) values ('Bad Slug!','x','{identity}')$$, 'invalid slug rejected');
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties) values ('x1','x','{hacking}')$$, 'unknown specialty rejected');
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties) values ('x2','x','{}')$$, 'at least one specialty');
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties,avatar) values ('x3','x','{identity}','javascript:alert(1)')$$, 'non-https avatar rejected');
select pg_temp.allowed($$insert into creative_works(id,creative_id,title_ar,category,images,year,published) values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','هوية','identity','{https://cdn.x/a.webp,https://cdn.x/b.webp}',2025,true)$$, 'designer adds a published work');
select pg_temp.allowed($$insert into creative_works(creative_id,title_ar,category,images,year,published) values ('11111111-1111-1111-1111-111111111111','مسودة عمل','label','{https://cdn.x/c.webp}',2025,false)$$, 'designer adds an unpublished work');
select pg_temp.allowed($$insert into creative_works(creative_id,title_ar,category,images,year,published) values ('22222222-2222-2222-2222-222222222222','عمل مخفي','packaging','{https://cdn.x/d.webp}',2025,true)$$, 'published work under unpublished creative');
select pg_temp.denied($$insert into creative_works(creative_id,title_ar,category,images,year) values ('11111111-1111-1111-1111-111111111111','x','label','{}',2025)$$, 'work needs an image');
select pg_temp.denied($$insert into creative_works(creative_id,title_ar,category,images,year) values ('11111111-1111-1111-1111-111111111111','x','label','{https://a.b/1,javascript:alert(1)}',2025)$$, 'every image must be https');
select pg_temp.denied($$insert into creative_works(creative_id,title_ar,category,images,year) values ('11111111-1111-1111-1111-111111111111','x','label',array_fill('https://a.b/x'::text, array[13]),2025)$$, 'max 12 images');
select pg_temp.denied($$insert into creative_works(creative_id,title_ar,category,images,year) values ('11111111-1111-1111-1111-111111111111','x','label','{https://a.b/1}',1800)$$, 'year range enforced');
select pg_temp.ok((select count(*) from creatives) = 2 and (select count(*) from creative_works) = 3, 'designer sees drafts too');
-- الزائر: المنشور فقط، ولا عمل لمصمم غير منشور
set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select count(*) from creatives) = 1, 'anon sees only published creatives');
select pg_temp.ok((select count(*) from creative_works) = 1, 'anon sees only published works of published creatives');
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties) values ('anon','x','{identity}')$$, 'anon cannot add creatives');
update creatives set published=false;
select pg_temp.denied($$insert into creative_works(creative_id,title_ar,category,images,year) values ('11111111-1111-1111-1111-111111111111','x','label','{https://a.b/1}',2025)$$, 'anon cannot add works');
-- العميل والمبيعات والمحرر: قراءة المنشور فقط، بلا كتابة
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from creatives) = 1 and (select count(*) from creative_works) = 1, 'client sees the public catalogue only');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
update creatives set published=false where id='11111111-1111-1111-1111-111111111111';
delete from creative_works;
select pg_temp.denied($$insert into creatives(slug,name_ar,specialties) values ('ed','x','{identity}')$$, 'editor (no studio.manage) cannot add creatives');
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select published from creatives where id='11111111-1111-1111-1111-111111111111') and (select count(*) from creative_works) = 3, 'anon/editor updates and deletes had no effect');
-- إلغاء النشر يخفي الأعمال عن الزائر، والحذف يتسلسل، والتدقيق يسجّل
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
update creatives set published=false, created_at='2000-01-01' where id='11111111-1111-1111-1111-111111111111';
set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select count(*) from creative_works) = 0, 'unpublishing a creative hides its works');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.allowed($$delete from creatives where id='22222222-2222-2222-2222-222222222222'$$, 'designer deletes a creative');
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select count(*) from creative_works where creative_id='22222222-2222-2222-2222-222222222222') = 0, 'works cascade-deleted with their creative');
select pg_temp.ok((select created_at from creatives where id='11111111-1111-1111-1111-111111111111') > '2001-01-01', 'created_at cannot be rewritten');
select pg_temp.ok((select count(*) from audit_log where action in ('creative.create','creative.unpublish','creative.delete','creative_work.create') and actor_id='00000000-0000-0000-0000-00000000000d') = 7, 'creative changes audited with the designer as actor');
-- طلب تصميم من الزائر يصل للـCRM
set role anon;
select pg_temp.allowed($$insert into leads(kind,payload,page) values ('design','{"firstName":"نوف","email":"nouf@brand.sa","creative":"reem","service":"label","budget":"5-15"}','/creatives/reem')$$, 'anon submits a design brief');
reset role;
select pg_temp.ok((select source from contacts where email='nouf@brand.sa') = 'design', 'design brief creates a contact with source design');

-- ── محتوى الموقع (CMS)
reset role; select set_config('request.jwt.claim.sub','',false);
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.allowed($$insert into site_content_drafts(key,value) values ('hero','{"line1":{"ar":"عنوان جديد","en":"New title"}}')$$, 'editor saves a draft');
select pg_temp.ok((select updated_by from site_content_drafts where key='hero') = '00000000-0000-0000-0000-00000000000e', 'draft author forced by server');
select pg_temp.denied($$insert into site_content_drafts(key,value) values ('evil','{}')$$, 'unknown content key rejected');
select pg_temp.denied($$insert into site_content_drafts(key,value) values ('faq','[1,2]')$$, 'content must be a JSON object');
select pg_temp.denied($$insert into site_content(key,value) values ('hero','{"x":1}')$$, 'editor cannot write published content directly');
select pg_temp.allowed($$select public.publish_content('hero')$$, 'editor publishes');
select pg_temp.ok((select value->'line1'->>'ar' from site_content where key='hero') = 'عنوان جديد', 'published value matches draft');
select pg_temp.ok((select count(*) from site_content_drafts where key='hero') = 0, 'draft cleared after publish');
select pg_temp.ok((select count(*) from site_content_versions where key='hero') = 1, 'version stored');
select pg_temp.denied($$select public.publish_content('hero')$$, 'publishing without a draft fails');
-- زائر: يقرأ المنشور فقط
set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select count(*) from site_content) = 1, 'anon reads published content');
select pg_temp.ok((select count(*) from site_content_drafts) = 0 and (select count(*) from site_content_versions) = 0, 'anon sees no drafts or versions');
select pg_temp.denied($$select public.publish_content('hero')$$, 'anon cannot publish');
-- مسودة ثانية من المحرر ثم محاولات من أدوار بلا صلاحية
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
insert into site_content_drafts(key,value) values ('hero','{"line1":{"ar":"مسودة سرية","en":"Secret draft"}}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from site_content_drafts) = 0, 'sales cannot read drafts');
select pg_temp.denied($$select public.publish_content('hero')$$, 'sales cannot publish');
select pg_temp.denied($$insert into site_content_drafts(key,value) values ('site','{}')$$, 'sales cannot write drafts');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from site_content_drafts) = 0 and (select count(*) from site_content_versions) = 0, 'client sees no drafts or versions');
reset role;
select pg_temp.ok((select value->'line1'->>'ar' from site_content where key='hero') = 'عنوان جديد', 'published content unchanged by others');
-- النشر الثاني ثم استرجاع النسخة الأولى كمسودة
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select pg_temp.allowed($$select public.publish_content('hero')$$, 'admin publishes second version');
select pg_temp.allowed($$select public.restore_content_version((select id from site_content_versions where value->'line1'->>'ar'='عنوان جديد'))$$, 'admin restores first version as draft');
select pg_temp.ok((select value->'line1'->>'ar' from site_content_drafts where key='hero') = 'عنوان جديد' and (select value->'line1'->>'ar' from site_content where key='hero') = 'مسودة سرية', 'restore creates a draft without touching live content');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$select public.restore_content_version((select id from site_content_versions limit 1))$$, 'sales cannot restore versions');
reset role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select count(*) from audit_log where action='content.publish') = 2 and (select count(*) from audit_log where action='content.restore') = 1, 'publish and restore audited');
-- حد النسخ: 30 لكل وثيقة
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
do $$ begin for i in 1..32 loop insert into site_content_drafts(key,value) values ('faq', jsonb_build_object('n', i)) on conflict (key) do update set value = excluded.value; perform public.publish_content('faq'); end loop; end $$;
reset role;
select pg_temp.ok((select count(*) from site_content_versions where key='faq') = 30 and (select value->>'n' from site_content where key='faq') = '32', 'versions capped at 30, latest live');

-- ── مشاريع العملاء والاعتمادات
reset role; select set_config('request.jwt.claim.sub','',false);
-- 0x10 أصبح مصمماً في اختبار سابق؟ نثبّت الأدوار هنا
update profiles set role='designer' where id='00000000-0000-0000-0000-00000000000d';
update profiles set role='production' where id='00000000-0000-0000-0000-000000000010';
-- حساب المبيعات عُطّل في اختبار سابق
update profiles set active=true where id='00000000-0000-0000-0000-00000000000c';
select pg_temp.ok(not exists (select 1 from role_permissions where role='designer' and permission='projects.view'), 'designer no longer has projects.view');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into projects(id,title,track,client_email,designer_id,contact_id) values ('aaaaaaaa-0000-0000-0000-000000000001','براند «مسك»','C','Client@X.sa','00000000-0000-0000-0000-00000000000d',(select id from contacts limit 1))$$, 'sales creates a project for a registered client');
select pg_temp.allowed($$insert into projects(id,title,client_email) values ('aaaaaaaa-0000-0000-0000-000000000002','مشروع لعميل لم يسجّل','later@brand.sa')$$, 'sales creates a project for a future client');
select pg_temp.allowed($$insert into projects(id,title,client_email) values ('aaaaaaaa-0000-0000-0000-000000000003','مشروع آخر','other@brand.sa')$$, 'third project (not the designer''s)');
select pg_temp.denied($$insert into projects(title,client_email) values ('x','not-an-email')$$, 'invalid client email rejected');
reset role;
select pg_temp.ok((select client_id from projects where id='aaaaaaaa-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-00000000000f', 'project linked to client by email (case-insensitive)');
select pg_temp.ok((select owner_id from projects where id='aaaaaaaa-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-00000000000c', 'owner defaults to creator');
select pg_temp.ok((select count(*) from activities where type='project' and body like 'أُنشئ مشروع%') = 1, 'creation logged on the CRM contact');
-- من يرى ماذا
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.ok((select count(*) from projects) = 1, 'designer sees only the assigned project');
select pg_temp.denied($$insert into projects(title,client_email) values ('x','a@b.sa')$$, 'designer cannot create projects');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
select pg_temp.ok((select count(*) from projects) = 3, 'production (projects.view) sees all');
select pg_temp.denied($$insert into project_items(project_id,kind,title) values ('aaaaaaaa-0000-0000-0000-000000000001','label','x')$$, 'view-only role cannot upload');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.ok((select count(*) from projects) = 0, 'editor sees no projects');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from projects) = 1, 'client sees only own project');
select pg_temp.denied($$insert into projects(title,client_email) values ('x','client@x.sa')$$, 'client cannot create projects');
update projects set stage='delivered' where id='aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select pg_temp.ok((select stage from projects where id='aaaaaaaa-0000-0000-0000-000000000001') = 'brief', 'client cannot change the stage');
-- المصمم يرفع نسخة للاعتماد
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.allowed($$insert into project_items(id,project_id,kind,title,files,status,by_client,version) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','label','ملصق المسك',array['sb:projects/aaaaaaaa-0000-0000-0000-000000000001/a.webp'],'approved',true,9)$$, 'designer uploads v1 (spoofed fields)');
select pg_temp.denied($$insert into project_items(project_id,kind,title) values ('aaaaaaaa-0000-0000-0000-000000000003','label','x')$$, 'designer cannot upload to an unassigned project');
select pg_temp.denied($$insert into project_items(project_id,kind,title,files) values ('aaaaaaaa-0000-0000-0000-000000000001','label','x',array['javascript:alert(1)'])$$, 'non-storage file URL rejected');
select pg_temp.denied($$insert into project_items(project_id,kind,title,studio) values ('aaaaaaaa-0000-0000-0000-000000000001','label','x','{"link":"https://evil.com"}')$$, 'external studio link rejected');
reset role;
select pg_temp.ok((select status||'|'||version||'|'||by_client from project_items where id='bbbbbbbb-0000-0000-0000-000000000001') = 'pending|1|false', 'server forces pending, v1, staff author');
-- العميل يقرر
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from project_items) = 1, 'client sees the item');
update project_items set status='approved' where id='bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.ok((select status from project_items where id='bbbbbbbb-0000-0000-0000-000000000001') = 'pending', 'direct status update has no effect');
select pg_temp.denied($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000001','changes','  ')$$, 'requesting changes needs a note');
select pg_temp.allowed($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000001','changes','الخط أصغر من اللازم')$$, 'client requests changes');
select pg_temp.denied($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000001','approved')$$, 'cannot decide twice');
select pg_temp.ok((select count(*) from project_comments where body='الخط أصغر من اللازم' and from_client) = 1, 'note becomes a client comment');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select pg_temp.denied($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000001','approved')$$, 'designer cannot approve on behalf of the client');
-- نسخة ثانية تحل محل الأولى
select pg_temp.allowed($$insert into project_items(id,project_id,thread_id,kind,title) values ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','label','ملصق المسك')$$, 'designer uploads v2 in the same thread');
select pg_temp.denied($$insert into project_items(project_id,thread_id,kind,title) values ('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000009','label','x')$$, 'unknown thread rejected');
reset role;
select pg_temp.ok((select version from project_items where id='bbbbbbbb-0000-0000-0000-000000000002') = 2 and (select status from project_items where id='bbbbbbbb-0000-0000-0000-000000000001') = 'superseded', 'v2 numbered and v1 superseded');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
-- النسخة الثالثة تُرفع من آخر نسخة (كما تفعل الواجهة): تُنسب لجذر السلسلة
select pg_temp.allowed($$insert into project_items(id,project_id,thread_id,kind,title) values ('bbbbbbbb-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','label','ملصق المسك')$$, 'designer uploads v3 from v2');
reset role;
select pg_temp.ok((select version||'|'||thread_id from project_items where id='bbbbbbbb-0000-0000-0000-000000000009') = '3|bbbbbbbb-0000-0000-0000-000000000001' and (select status from project_items where id='bbbbbbbb-0000-0000-0000-000000000002') = 'superseded', 'v3 numbered on the root thread and v2 superseded');
-- نعيد v2 معلّقة ونحذف v3 لبقية الاختبارات
delete from project_items where id='bbbbbbbb-0000-0000-0000-000000000009';
update project_items set status='pending' where id='bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.denied($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000001','approved')$$, 'superseded version cannot be approved');
select pg_temp.allowed($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000002','approved')$$, 'client approves v2');
-- العميل يرسل تصميماً ويعلّق
select pg_temp.allowed($$insert into project_items(id,project_id,kind,title,studio,status) values ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','bottle','عبوتي من الاستوديو','{"link":"/studio-3d?b=B-NOOR","summary":"نور"}','approved')$$, 'client submits a studio design');
select pg_temp.denied($$insert into project_items(project_id,kind,title) values ('aaaaaaaa-0000-0000-0000-000000000003','label','x')$$, 'client cannot post to another client''s project');
select pg_temp.allowed($$insert into project_comments(project_id,body,author_id,from_client) values ('aaaaaaaa-0000-0000-0000-000000000001','متى العينات؟','00000000-0000-0000-0000-00000000000c',false)$$, 'client comments (spoofed author)');
select pg_temp.denied($$insert into project_comments(project_id,body) values ('aaaaaaaa-0000-0000-0000-000000000003','x')$$, 'client cannot comment on another project');
select pg_temp.denied($$select public.decide_item('bbbbbbbb-0000-0000-0000-000000000003','approved')$$, 'own submission is not an approval item');
reset role;
select pg_temp.ok((select status||'|'||by_client from project_items where id='bbbbbbbb-0000-0000-0000-000000000003') = 'submitted|true', 'client submission forced to submitted');
select pg_temp.ok((select author_id::text||'|'||from_client from project_comments where body='متى العينات؟') = '00000000-0000-0000-0000-00000000000f|true', 'comment author forced to the client');
select pg_temp.ok((select count(*) from audit_log where action in ('project.changes','project.approve')) = 2, 'decisions audited');
select pg_temp.ok((select count(*) from activities where type='project' and body like 'اعتمد العميل%') = 1, 'approval logged on CRM contact');
-- عميل يسجّل لاحقاً يرى مشروعه
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000020','Later@Brand.sa','{}');
select pg_temp.ok((select client_id from projects where id='aaaaaaaa-0000-0000-0000-000000000002') is null, 'signup with an unconfirmed email does not see the project');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000020';
select pg_temp.ok((select client_id from projects where id='aaaaaaaa-0000-0000-0000-000000000002') = '00000000-0000-0000-0000-000000000020', 'confirming the email links the waiting project');
-- (يعود غير مؤكَّد لاختبار claim_briefs أدناه)
update auth.users set email_confirmed_at = null where id = '00000000-0000-0000-0000-000000000020';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from projects) = 1 and (select count(*) from project_items) = 0 and (select count(*) from project_comments) = 0, 'new client sees only own project and nothing else');
-- التصاميم المحفوظة
select pg_temp.allowed($$insert into saved_designs(name,link,owner_id) values ('تصميمي','/studio-3d?b=B-ATLAS','00000000-0000-0000-0000-00000000000f')$$, 'client saves a design (spoofed owner)');
select pg_temp.denied($$insert into saved_designs(name,link) values ('x','https://evil.com')$$, 'external design link rejected');
select pg_temp.denied($$insert into saved_designs(name,link,thumb) values ('x','/studio-3d','javascript:alert(1)')$$, 'non-image thumbnail rejected');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from saved_designs) = 0, 'other client cannot see the design');
reset role;
select pg_temp.ok((select owner_id from saved_designs where name='تصميمي') = '00000000-0000-0000-0000-000000000020', 'owner forced to the saver');
-- حذف المشروع يتسلسل
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
delete from projects where id='aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select pg_temp.ok((select count(*) from projects where id='aaaaaaaa-0000-0000-0000-000000000001') = 1, 'sales cannot delete a project (owner/admin only)');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.allowed($$delete from projects where id='aaaaaaaa-0000-0000-0000-000000000001'$$, 'owner deletes a project');
reset role;
select pg_temp.ok((select count(*) from project_items where project_id='aaaaaaaa-0000-0000-0000-000000000001') = 0 and (select count(*) from project_comments where project_id='aaaaaaaa-0000-0000-0000-000000000001') = 0, 'items and comments cascade');

-- ── وثيقة أسعار العلب
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.denied($$insert into site_content_drafts(key,value) values ('pricing','{"box":{"waste":9}}')$$, 'editor cannot draft prices (pricing.manage)');
select pg_temp.allowed($$insert into site_content_drafts(key,value) values ('announcement','{}') on conflict (key) do update set value = excluded.value$$, 'editor still edits other content');
reset role; delete from site_content_drafts where key='announcement'; set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.allowed($$insert into site_content_drafts(key,value) values ('pricing','{"box":{"waste":1.2}}')$$, 'owner drafts box pricing');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.denied($$select public.publish_content('pricing')$$, 'editor cannot publish prices');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.allowed($$select public.publish_content('pricing')$$, 'owner publishes box pricing');
set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select value->'box'->>'waste' from site_content where key='pricing') = '1.2', 'visitors read published pricing');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
set role authenticated;
select pg_temp.denied($$insert into site_content_drafts(key,value) values ('pricing','{}')$$, 'sales cannot change pricing');
reset role;

-- ── «ابدأ مسارك»: الملخص قبل الحساب
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.allowed($$insert into leads(kind,payload,project_id) values ('brief','{"track":"C","email":"later@brand.sa","firstName":"لاحق","phone":"0551112222","brand":"عنبر","a_need":"box,label"}','aaaaaaaa-0000-0000-0000-000000000002')$$, 'visitor sends a brief (forged project link)');
select pg_temp.allowed($$insert into leads(kind,payload) values ('brief','{"track":"A","email":"unconf@brand.sa"}')$$, 'visitor sends a brief for an unconfirmed email');
select pg_temp.denied($$select public.claim_briefs()$$, 'anon cannot claim');
reset role;
select pg_temp.ok((select project_id from leads where payload->>'email'='later@brand.sa') is null, 'forged project link reset on insert');
select pg_temp.ok((select source from contacts where phone='+966551112222') = 'brief', 'brief creates a contact with source brief');
-- عملاء دوليون: الدولة تُحفظ، والجوال السعودي المحلي يطابق العميل نفسه بصيغة E.164
insert into leads(kind,payload) values ('brief','{"track":"D","email":"intl@brand.ae","firstName":"ريم","phone":"+971501234567","country":"ae"}');
select pg_temp.ok((select country from contacts where email='intl@brand.ae') = 'AE', 'international lead stores its country (upper-cased)');
insert into leads(kind,payload) values ('contact','{"email":"other@brand.sa","phone":"055 111 2222","country":"S1"}');
select pg_temp.ok((select count(*) from contacts where phone in ('+966551112222','0551112222')) = 1, 'local 05 number matches the same contact as its E.164 form');
insert into leads(kind,payload) values ('kit','{"email":"bad@brand.sa","phone_country":"KW","country":"<x>"}');
select pg_temp.ok((select country from contacts where email='bad@brand.sa') is null, 'invalid country code is dropped, not stored');
select pg_temp.denied($$update contacts set country = 'Saudi' where email = 'intl@brand.ae'$$, 'country must be a two-letter code');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000031','gb@brand.co.uk','{"first_name":"Amy","phone":"+447700900123","country":"gb"}');
select pg_temp.ok((select country from profiles where id='00000000-0000-0000-0000-000000000031') = 'GB', 'registration country lands on the profile');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000021','unconf@brand.sa','{}');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
select pg_temp.ok((select count(*) from public.claim_briefs()) = 0, 'unconfirmed email claims nothing');
reset role; update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000020';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from public.claim_briefs()) = 1, 'confirmed client claims own brief');
select pg_temp.ok((select count(*) from public.claim_briefs()) = 0, 'claim is one-time');
select pg_temp.ok((select count(*) from projects where title = 'عنبر' and stage = 'brief' and track = 'C' and owner_id is null and brief->>'a_need' = 'box,label') = 1, 'project from brief: title, stage, track, no staff owner, brief kept');
update projects set brief = '{}' where title = 'عنبر';
reset role;
select pg_temp.ok((select brief->>'a_need' from projects where title = 'عنبر') = 'box,label', 'client cannot edit the project');
select pg_temp.ok((select p.title from leads l join projects p on p.id = l.project_id where l.payload->>'email'='later@brand.sa') = 'عنبر', 'lead linked to its project');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$update leads set project_id = null where payload->>'email'='later@brand.sa'$$, 'staff cannot relink a brief');
reset role;

-- ── مراحل خاصة بكل مسار
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into projects(title,track,client_email,stage) values ('طباعة','F','p@brand.sa','proof')$$, 'track F accepts its own stage');
select pg_temp.denied($$insert into projects(title,track,client_email,stage) values ('طباعة2','F','p@brand.sa','formula')$$, 'track F rejects another track''s stage');
select pg_temp.denied($$insert into projects(title,track,client_email,stage) values ('عام','','p@brand.sa','proof')$$, 'untracked project rejects track stages');
select pg_temp.allowed($$insert into projects(title,client_email,stage) values ('عام','p@brand.sa','sampling')$$, 'untracked project keeps generic stages');
select pg_temp.denied($$update projects set track = 'D' where title = 'طباعة'$$, 'changing track without mapping the stage is rejected');
select pg_temp.allowed($$update projects set track = 'D', stage = 'concepts' where title = 'طباعة'$$, 'changing track with a valid stage');
reset role;
select pg_temp.ok(public.stage_label('A','formula') = 'التركيبة والعينات' and public.stage_label('F','delivered') = 'التسليم' and public.stage_label(null,'brief') = 'الملخص والاتجاه', 'Arabic stage labels for the activity log');

-- ── عروض الأسعار والعربون (مشروع «عنبر»: مسار C، عميله 20، مربوط بعميل CRM)
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$insert into project_quotes(project_id,status,lines) select id,'paid','[]' from projects where title='عنبر'$$, 'cannot create a quote already paid');
select pg_temp.denied($$insert into project_quotes(project_id,lines) select id,'[{"label":"x","qty":0,"unit":5}]' from projects where title='عنبر'$$, 'zero quantity rejected');
select pg_temp.denied($$insert into project_quotes(project_id,lines) select id,'[{"label":"","qty":1,"unit":5}]' from projects where title='عنبر'$$, 'empty line label rejected');
select pg_temp.allowed($$insert into project_quotes(project_id,lines,deposit_pct,subtotal,total,ref) select id,'[{"label":"تصميم العلبة","qty":1,"unit":5000},{"label":"طباعة 1000 علبة","qty":1000,"unit":4.5}]',50,1,1,'QT-FAKE' from projects where title='عنبر'$$, 'sales drafts a quote (forged totals and ref)');
reset role;
select pg_temp.ok((select subtotal = 9500 and vat = 1425 and total = 10925 and deposit = 5462.50 and ref like 'QT-%' and ref <> 'QT-FAKE' from project_quotes q join projects p on p.id=q.project_id where p.title='عنبر'), 'totals, 15% VAT, deposit and ref computed on the server');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from project_quotes) = 0, 'client cannot see a draft');
select pg_temp.denied($$select public.send_quote((select id from project_quotes limit 1))$$, 'client cannot send');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$select public.send_quote(q.id) from project_quotes q join projects p on p.id=q.project_id where p.title='عنبر'$$, 'sales sends the quote');
select pg_temp.denied($$update project_quotes set lines='[{"label":"x","qty":1,"unit":1}]' where status='sent'$$, 'a sent quote is locked');
select pg_temp.denied($$delete from project_quotes where status='sent'$$, 'a sent quote cannot be deleted');
reset role;
select pg_temp.ok((select c.stage = 'proposal' and c.value = 10925 from contacts c where phone='+966551112222'), 'CRM deal moves to proposal with the quote value');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from project_quotes where status='sent') = 1, 'client sees the sent quote');
select pg_temp.denied($$select public.decide_quote((select id from project_quotes where status='sent'),'changes','')$$, 'changes need a note');
select pg_temp.allowed($$select public.decide_quote((select id from project_quotes where status='sent'),'changes','الطباعة أغلى من المتوقع')$$, 'client asks for changes');
select pg_temp.ok((select count(*) from project_comments where body like 'ملاحظة على عرض السعر%الطباعة أغلى%') = 1, 'the note lands in the project chat');
select pg_temp.denied($$select public.mark_quote_paid((select id from project_quotes limit 1),'bank','x',1)$$, 'client cannot mark paid');
select pg_temp.denied($$select public.record_deposit((select id from project_quotes limit 1),'pay_1',100)$$, 'client cannot record a gateway payment');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into project_quotes(project_id,lines,deposit_pct) select id,'[{"label":"تصميم العلبة","qty":1,"unit":5000},{"label":"طباعة 1000 علبة","qty":1000,"unit":4}]',30 from projects where title='عنبر'$$, 'sales drafts v2');
select pg_temp.allowed($$select public.send_quote(id) from project_quotes where status='draft'$$, 'sales sends v2');
reset role;
select pg_temp.ok((select string_agg(status, ',' order by created_at) from project_quotes) = 'void,sent', 'v1 voided when v2 is sent');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.allowed($$select public.decide_quote((select id from project_quotes where status='sent'),'accepted')$$, 'client accepts v2');
set role service_role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok((select public.record_deposit((select id from project_quotes where status='accepted'),'pay_ABC',100)) = 'amount_mismatch', 'gateway amount must match the deposit');
select pg_temp.ok((select public.record_deposit((select id from project_quotes where status='accepted'),'pay_ABC',310500)) = 'paid', 'deposit recorded (30% of 10,350)');
select pg_temp.ok((select public.record_deposit((select id from project_quotes where status='paid'),'pay_ABC',310500)) = 'paid', 'recording is idempotent');
select pg_temp.ok((select public.record_deposit((select id from project_quotes where status='paid'),'pay_OTHER',310500)) = 'already_paid', 'a second payment is not recorded');
reset role;
select pg_temp.ok((select stage from projects where title='عنبر') = 'design', 'payment moves the project from brief to its second stage');
select pg_temp.ok((select stage from contacts where phone='+966551112222') = 'won', 'CRM deal won');
select pg_temp.ok((select paid_amount = 3105 and payment_method = 'moyasar' from project_quotes where status='paid'), 'paid amount and method kept');
-- تحويل بنكي يسجّله الفريق
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into project_quotes(id,project_id,lines) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','[{"label":"هوية","qty":1,"unit":1000}]')$$, 'quote on a second project');
select pg_temp.denied($$select public.mark_quote_paid('bbbbbbbb-0000-0000-0000-000000000001','bank','TRX-1',100)$$, 'a draft cannot be paid');
select pg_temp.allowed($$select public.send_quote('bbbbbbbb-0000-0000-0000-000000000001')$$, 'sent');
select pg_temp.denied($$select public.mark_quote_paid('bbbbbbbb-0000-0000-0000-000000000001','bank','TRX-1',5000)$$, 'amount above total rejected');
select pg_temp.denied($$select public.mark_quote_paid('bbbbbbbb-0000-0000-0000-000000000001','crypto','TRX-1',100)$$, 'unknown method rejected');
select pg_temp.denied($$select public.mark_quote_paid('bbbbbbbb-0000-0000-0000-000000000001','bank','TRX-1',1)$$, 'token amount below the deposit rejected');
select pg_temp.allowed($$select public.mark_quote_paid('bbbbbbbb-0000-0000-0000-000000000001','bank','TRX-1',575)$$, 'sales records a bank transfer');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.ok((select count(*) from project_quotes) = 0, 'editor (no project access) sees no quotes');
reset role;
select pg_temp.allowed($$delete from projects where id='aaaaaaaa-0000-0000-0000-000000000002'$$, 'deleting a project');
select pg_temp.ok((select count(*) from project_quotes where id='bbbbbbbb-0000-0000-0000-000000000001') = 0, 'its quotes cascade');


-- ══ التسعير والربحية والمخزون ══
-- (المستخدمون: a مالك، c مبيعات، e محرر، d مصمم، 10 إنتاج، 20 عميل مشروع «عنبر» — حُذف مشروعه الثاني)
reset role;
insert into projects (id, title, track, client_email, stage) values ('cccccccc-0000-0000-0000-000000000001','مخزون','C','later@brand.sa','brief');
-- ── المخزون
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$insert into inventory_items(sku,name) values ('BTL-50','زجاجة')$$, 'sales cannot add stock items');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
select pg_temp.allowed($$insert into inventory_items(id,sku,name,category,on_hand,avg_cost,reorder_level) values ('dddddddd-0000-0000-0000-000000000001','btl-50','زجاجة 50 مل','bottle',9999,1,200)$$, 'production adds an item (forged balance)');
reset role;
select pg_temp.ok((select sku = 'BTL-50' and on_hand = 0 and avg_cost = 0 from inventory_items where id='dddddddd-0000-0000-0000-000000000001'), 'sku normalised; balance and cost start at zero');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
select pg_temp.denied($$insert into inventory_moves(item_id,kind,qty) values ('dddddddd-0000-0000-0000-000000000001','receive',100)$$, 'receiving needs a unit cost');
select pg_temp.allowed($$insert into inventory_moves(item_id,kind,qty,unit_cost) values ('dddddddd-0000-0000-0000-000000000001','receive',1000,6)$$, 'receive 1000 @ 6');
select pg_temp.allowed($$insert into inventory_moves(item_id,kind,qty,unit_cost) values ('dddddddd-0000-0000-0000-000000000001','receive',500,9)$$, 'receive 500 @ 9');
reset role;
select pg_temp.ok((select on_hand = 1500 and avg_cost = 7 from inventory_items where sku='BTL-50'), 'weighted average cost = 7');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
select pg_temp.allowed($$update inventory_items set on_hand = 1, avg_cost = 0, name = 'زجاجة 50 مل شفافة' where sku='BTL-50'$$, 'editing an item');
reset role;
select pg_temp.ok((select on_hand = 1500 and avg_cost = 7 and name like '%شفافة' from inventory_items where sku='BTL-50'), 'balance cannot be edited directly');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
select pg_temp.denied($$insert into inventory_moves(item_id,kind,qty) values ('dddddddd-0000-0000-0000-000000000001','issue',2000)$$, 'cannot issue more than on hand');
select pg_temp.denied($$insert into inventory_moves(item_id,kind,qty) values ('dddddddd-0000-0000-0000-000000000001','adjust',-10)$$, 'adjustment needs a note');
select pg_temp.allowed($$insert into inventory_moves(item_id,kind,qty,note) values ('dddddddd-0000-0000-0000-000000000001','adjust',-10,'كسر أثناء النقل')$$, 'stock-take adjustment −10');
select pg_temp.denied($$insert into inventory_moves(item_id,kind,qty) values ('dddddddd-0000-0000-0000-000000000001','reserve',5)$$, 'reservation needs a project');
update inventory_moves set qty = 1; delete from inventory_moves;
select pg_temp.ok((select count(*) from inventory_moves where qty = 1) = 0 and (select count(*) from inventory_moves) = 3, 'moves are append-only (update/delete do nothing)');
select pg_temp.ok((select count(*) from inventory_moves) = 3, 'moves visible to production');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select count(*) from inventory_items) = 1, 'sales can read stock (for quoting)');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.ok((select count(*) from inventory_items) = 0, 'editor sees no stock');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from inventory_items) = 0 and (select count(*) from inventory_moves) = 0, 'client sees no stock');
-- ── العرض: الخصم والتكلفة
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into project_quotes(id,project_id,lines,discount_kind,discount_value) values ('eeeeeeee-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','[{"label":"علبة وزجاجة","qty":1000,"unit":20}]','pct',15)$$, 'sales drafts a quote with 15% discount');
reset role;
select pg_temp.ok((select gross = 20000 and discount = 3000 and subtotal = 17000 and vat = 2550 and total = 19550 from project_quotes where id='eeeeeeee-0000-0000-0000-000000000001'), 'discount before VAT: 20,000 − 15% → 17,000 + VAT 2,550');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into quote_costs(quote_id,lines,extra_cost) values ('eeeeeeee-0000-0000-0000-000000000001','[{"unit_cost":7,"item_id":"dddddddd-0000-0000-0000-000000000001"}]',500)$$, 'sales records internal costs');
select pg_temp.denied($$insert into quote_costs(quote_id,lines) values ('eeeeeeee-0000-0000-0000-000000000001','[{"unit_cost":-1}]')$$, 'negative cost rejected');
select pg_temp.allowed($$update quote_costs set lines = '[{"unit_cost":7,"item_id":"dddddddd-0000-0000-0000-000000000001","per_unit":null}]' where quote_id='eeeeeeee-0000-0000-0000-000000000001'$$, 'null per_unit (as the app sends it) is accepted');
select pg_temp.denied($$select public.send_quote('eeeeeeee-0000-0000-0000-000000000001')$$, '15% is above the sales cap (10%)');
select pg_temp.allowed($$update project_quotes set discount_value = 10 where id='eeeeeeee-0000-0000-0000-000000000001'$$, 'sales lowers it to 10%');
select pg_temp.allowed($$select public.send_quote('eeeeeeee-0000-0000-0000-000000000001')$$, 'within cap: sent');
select pg_temp.denied($$update quote_costs set extra_cost = 0 where quote_id='eeeeeeee-0000-0000-0000-000000000001'$$, 'costs lock with the sent quote');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select discount = 2000 and total = 20700 from project_quotes where id='eeeeeeee-0000-0000-0000-000000000001'), 'client sees the discount on the quote');
select pg_temp.ok((select count(*) from quote_costs) = 0, 'client never sees internal costs');
select pg_temp.allowed($$select public.decide_quote('eeeeeeee-0000-0000-0000-000000000001','accepted')$$, 'client accepts');
set role service_role; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok(public.record_deposit('eeeeeeee-0000-0000-0000-000000000001','pay_INV',1035000) = 'paid', 'deposit paid');
reset role;
select pg_temp.ok((select reserved = 1000 from inventory_items where sku='BTL-50') and public.reserved_for('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001') = 1000, 'paying the deposit reserves 1,000 bottles for the project');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
select pg_temp.denied($$insert into inventory_moves(item_id,kind,qty,project_id) values ('dddddddd-0000-0000-0000-000000000001','release',1001,'cccccccc-0000-0000-0000-000000000001')$$, 'cannot release more than reserved');
select pg_temp.allowed($$insert into inventory_moves(item_id,kind,qty,project_id) values ('dddddddd-0000-0000-0000-000000000001','issue',600,'cccccccc-0000-0000-0000-000000000001')$$, 'production issues 600 to the project');
reset role;
select pg_temp.ok((select on_hand = 890 and reserved = 400 from inventory_items where sku='BTL-50'), 'issue lowers stock and the reservation');
select pg_temp.ok((select kind = 'materials' and amount = 4200 from project_costs where project_id='cccccccc-0000-0000-0000-000000000001'), 'issued materials cost the project 600 × 7');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into project_costs(project_id,kind,amount,note) values ('cccccccc-0000-0000-0000-000000000001','factory',3000,'تعبئة')$$, 'sales records a factory cost');
delete from project_costs where kind='materials';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from project_costs) = 0, 'client never sees project costs');
reset role;
select pg_temp.ok((select count(*) from project_costs where kind='materials') = 1, 'materials cost row survived');
-- ── سياسة التسعير
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.ok((select (value->>'margin_floor')::int = 25 from business_settings), 'staff read the pricing policy');
update business_settings set value = '{"discount_caps":{"sales":50}}';
reset role;
select pg_temp.ok((select (value->'discount_caps'->>'sales')::int = 10 from business_settings), 'sales cannot raise its own cap');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.denied($$update business_settings set value = '{"discount_caps":{"sales":150},"margin_floor":20}'$$, 'cap above 100 rejected');
select pg_temp.allowed($$update business_settings set value = '{"discount_caps":{"owner":100,"admin":100,"sales":20},"margin_floor":30}'$$, 'owner sets sales cap 20% and margin floor 30%');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
select pg_temp.ok((select count(*) from business_settings) = 0, 'client cannot read the pricing policy');
-- ── الكوبونات
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$insert into coupons(code,kind,value) values ('RAMADAN','pct',20)$$, 'sales cannot create coupons');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.allowed($$insert into coupons(code,kind,value,max_uses,uses) values ('ramadan','pct',20,2,99)$$, 'owner creates RAMADAN 20% × 2 (forged uses)');
select pg_temp.denied($$insert into coupons(code,kind,value) values ('BAD','pct',150)$$, 'percent above 100 rejected');
select pg_temp.allowed($$insert into coupons(code,kind,value,valid_until) values ('OLD','amount',100,'2020-01-01')$$, 'expired coupon');
set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok(public.coupon_price('ramadan','kit',75000) = 60000, 'visitor checks RAMADAN: 750 → 600');
select pg_temp.ok(public.coupon_price('OLD','kit',75000) is null and public.coupon_price('NOPE','kit',75000) is null, 'expired and unknown codes are invalid');
select pg_temp.ok((select count(*) from coupons) = 0, 'visitors cannot list coupons');
select pg_temp.denied($$select public.redeem_coupon('RAMADAN','kit','p1',75000,60000)$$, 'visitor cannot redeem');
set role service_role;
select pg_temp.ok(public.redeem_coupon('RAMADAN','kit','p1',75000,50000) = 'mismatch', 'paid amount must match the coupon price');
select pg_temp.ok(public.redeem_coupon('RAMADAN','kit','p1',75000,60000) = 'ok' and public.redeem_coupon('RAMADAN','kit','p1',75000,60000) = 'ok', 'redeemed once per payment');
select pg_temp.ok(public.redeem_coupon('RAMADAN','kit','p2',75000,60000) = 'ok' and public.redeem_coupon('RAMADAN','kit','p3',75000,60000) = 'invalid', 'max uses enforced');
reset role;
select pg_temp.ok((select uses from coupons where code='RAMADAN') = 2 and (select count(*) from coupon_redemptions) = 2, 'two redemptions recorded');
-- ── الحماية من الإغراق
set role anon; select set_config('request.jwt.claim.sub','',false);
select set_config('request.headers','{"cf-connecting-ip":"9.9.9.9","x-client-ip":"1.1.1.1"}',false);
select pg_temp.ok(public.request_ip() = '9.9.9.9', 'visitor ip from cf-connecting-ip (x-client-ip ignored for visitors)');
select pg_temp.allowed($$insert into leads(kind,payload) values ('contact','{"email":"a1@x.sa"}'),('contact','{"email":"a2@x.sa"}'),('contact','{"email":"a3@x.sa"}'),('contact','{"email":"a4@x.sa"}'),('contact','{"email":"a5@x.sa"}')$$, 'five leads from one address pass');
select pg_temp.denied($$insert into leads(kind,payload) values ('contact','{"email":"a6@x.sa"}')$$, 'sixth lead from the same address within 10 minutes is rate limited');
select set_config('request.headers','{"cf-connecting-ip":"8.8.8.8"}',false);
select pg_temp.allowed($$insert into leads(kind,payload) values ('contact','{"email":"other@x.sa"}')$$, 'another address still passes');
select set_config('request.headers','{"cf-connecting-ip":"7.7.7.1"}',false);
select pg_temp.allowed($$insert into leads(kind,payload) values ('contact','{"email":"Same@x.sa"}')$$, 'email 1');
select set_config('request.headers','{"cf-connecting-ip":"7.7.7.2"}',false);
select pg_temp.allowed($$insert into leads(kind,payload) values ('contact','{"email":"same@x.sa"}')$$, 'email 2');
select set_config('request.headers','{"cf-connecting-ip":"7.7.7.3"}',false);
select pg_temp.allowed($$insert into leads(kind,payload) values ('contact','{"email":"same@x.sa"}')$$, 'email 3');
select set_config('request.headers','{"cf-connecting-ip":"7.7.7.4"}',false);
select pg_temp.denied($$insert into leads(kind,payload) values ('contact','{"email":" SAME@x.sa "}')$$, 'fourth lead for one email from rotating addresses is rate limited');
reset role;
select pg_temp.ok((select count(*) from contacts where email in ('a6@x.sa')) = 0, 'rejected lead created no contact');
select pg_temp.ok((select count(*) from rate_events) > 0, 'events recorded');
set role anon;
select pg_temp.ok((select count(*) from rate_events) = 0, 'visitors cannot read rate events');
select pg_temp.denied($$select public.rate_hit('x', 1, interval '1 minute')$$, 'visitors cannot call rate_hit');
-- الكوبونات: 10 محاولات لكل عنوان
select set_config('request.headers','{"cf-connecting-ip":"6.6.6.6"}',false);
select pg_temp.ok((select count(*) from generate_series(1,10) g where public.coupon_price('GUESS' || g,'kit',75000) is null) = 10, 'ten coupon guesses answered');
select pg_temp.denied($$select public.coupon_price('RAMADAN','kit',75000)$$, 'eleventh coupon check is rate limited');
set role service_role;
select pg_temp.ok(public.coupon_price('OLD','kit',75000) is null, 'server (service key) is not rate limited');
-- التحقق البشري الإلزامي
reset role;
update business_settings set value = value || '{"captcha_required":true}';
set role anon; select set_config('request.headers','{"cf-connecting-ip":"5.5.5.5"}',false);
select pg_temp.denied($$insert into leads(kind,payload) values ('contact','{"email":"bot@x.sa"}')$$, 'with captcha required, visitors cannot insert directly');
set role service_role; select set_config('request.headers','{"x-client-ip":"5.5.5.5"}',false);
select pg_temp.ok(public.request_ip() = '5.5.5.5', 'server passes the visitor ip in x-client-ip');
select pg_temp.allowed($$insert into leads(kind,payload) values ('contact','{"email":"human@x.sa"}')$$, 'verified lead via the server passes');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false); select set_config('request.headers','{"cf-connecting-ip":"5.5.5.6"}',false);
select pg_temp.allowed($$insert into leads(kind,payload) values ('brief','{"track":"A","email":"client@x.sa"}')$$, 'signed-in clients are not asked for captcha');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.denied($$update business_settings set value = value || '{"captcha_required":"yes"}'$$, 'captcha flag must be boolean');
reset role; select set_config('request.headers','',false);
update business_settings set value = value - 'captcha_required';
-- ── الصفحات القانونية في المحتوى
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select pg_temp.allowed($$insert into site_content_drafts(key,value) values ('legal','{"updated":"2026-10-20"}') on conflict (key) do update set value = excluded.value$$, 'editor drafts the legal pages');
select pg_temp.denied($$insert into site_content_drafts(key,value) values ('legalese','{}')$$, 'unknown content key rejected');
reset role;
-- ── «عطرك الخاص» (المسار P)
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-000000000030','noura@scent.sa', now());
set role anon; select set_config('request.jwt.claim.sub','',false); select set_config('request.headers','{"cf-connecting-ip":"4.4.4.4"}',false);
select pg_temp.allowed($$insert into leads(kind,payload) values ('brief','{"track":"P","email":"noura@scent.sa","firstName":"نورة","p_top":"bergamot","p_heart":"rose_taifi","p_base":"oud_cambodi","p_conc":"edp","p_size":"50","p_mode":"video"}')$$, 'visitor sends a signature-scent composition');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000030',false);
select pg_temp.ok((select count(*) from public.claim_briefs()) = 1, 'individual claims the composition as a project');
reset role;
select pg_temp.ok((select track = 'P' and stage = 'brief' and brief ->> 'p_heart' = 'rose_taifi' from projects where client_email='noura@scent.sa'), 'project on track P at the composition stage, with the composition');
select pg_temp.ok(public.track_stages('P') = array['brief','sampling','bottling','delivered'] and public.stage_label('P','sampling') = 'العينات التجريبية', 'track P stages and labels');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.allowed($$update projects set stage='sampling' where client_email='noura@scent.sa'$$, 'team moves it to trial samples');
select pg_temp.denied($$update projects set stage='design' where client_email='noura@scent.sa'$$, 'stage from another track rejected');
select pg_temp.denied($$update projects set track='Z' where client_email='noura@scent.sa'$$, 'unknown track rejected');
reset role; select set_config('request.headers','',false);
-- ── مراجعة: صلاحيات وسجلات مالية
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok(public.discount_cap('sales') = 0, 'clients cannot read internal discount caps');
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select pg_temp.denied($$select public.reserved_for('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001')$$, 'visitors cannot query reservations');
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
delete from projects where id='cccccccc-0000-0000-0000-000000000001';
reset role;
select pg_temp.ok((select count(*) from projects where id='cccccccc-0000-0000-0000-000000000001') = 1, 'a project with a paid quote cannot be deleted (financial record)');
-- ── العقود
reset role;
insert into projects (id, title, track, client_email) values ('eeeeeeee-0000-0000-0000-000000000001','عقد مسك','E','client@x.sa');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$insert into project_contracts(id,project_id,title,company,client,sections,specs,status,client_signature) values ('ffffffff-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001','عقد تصنيع','{"name":"المصنع"}','{"name":"العميل"}','[{"title":"موضوع العقد","body":"تصنيع 1000 عبوة"}]','[{"name":"زجاجة 50 مل","qty":1000,"unit":"قطعة","images":["sb:projects/eeeeeeee-0000-0000-0000-000000000001/a.webp"],"files":[]}]','signed','sb:x')$$, 'sales drafts a contract (forged status and signature)');
reset role;
select pg_temp.ok((select status = 'draft' and client_signature is null and ref like 'CT-%' from project_contracts where id='ffffffff-0000-0000-0000-000000000001'), 'insert forced to an unsigned draft with a CT ref');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$insert into project_contracts(project_id,title,specs) values ('eeeeeeee-0000-0000-0000-000000000001','x','[{"name":"y","qty":1,"images":["sb:projects/aaaaaaaa-0000-0000-0000-000000000003/z.webp"]}]')$$, 'attachments from another project''s folder rejected');
select pg_temp.denied($$insert into project_contracts(project_id,title,specs) values ('eeeeeeee-0000-0000-0000-000000000001','x','[{"name":"y","qty":0}]')$$, 'zero quantity rejected');
select pg_temp.denied($$insert into project_contracts(project_id,title,sections) values ('eeeeeeee-0000-0000-0000-000000000001','x','{"a":1}')$$, 'malformed sections rejected');
-- العميل لا يرى المسودة
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from project_contracts) = 0, 'client cannot see a draft contract');
select pg_temp.denied($$select public.send_contract('ffffffff-0000-0000-0000-000000000001')$$, 'client cannot send');
-- الإرسال
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$select public.send_contract('ffffffff-0000-0000-0000-000000000001')$$, 'sales sends the contract');
reset role;
select pg_temp.ok((select status = 'sent' and length(content_hash) = 64 from project_contracts where id='ffffffff-0000-0000-0000-000000000001'), 'sent with a sha256 fingerprint');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$update project_contracts set title = 'معدَّل' where id='ffffffff-0000-0000-0000-000000000001'$$, 'sent contract content is locked');
select pg_temp.denied($$select public.sign_contract('ffffffff-0000-0000-0000-000000000001','company','sb:projects/eeeeeeee-0000-0000-0000-000000000001/s.png','فيصل',(select content_hash from project_contracts where id='ffffffff-0000-0000-0000-000000000001'))$$, 'sales cannot sign for the company');
delete from project_contracts where id='ffffffff-0000-0000-0000-000000000001';
reset role;
select pg_temp.ok((select count(*) from project_contracts where id='ffffffff-0000-0000-0000-000000000001') = 1, 'sent contract still exists');
-- العميل
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok((select count(*) from project_contracts) = 1, 'client sees the sent contract');
select pg_temp.denied($$select public.sign_contract('ffffffff-0000-0000-0000-000000000001','client','sb:projects/eeeeeeee-0000-0000-0000-000000000001/s.png','نورة','0000')$$, 'signing a different fingerprint rejected');
select pg_temp.denied($$select public.sign_contract('ffffffff-0000-0000-0000-000000000001','client','sb:projects/aaaaaaaa-0000-0000-0000-000000000003/s.png','نورة',(select content_hash from project_contracts where id='ffffffff-0000-0000-0000-000000000001'))$$, 'signature image from another project rejected');
select pg_temp.denied($$select public.sign_contract('ffffffff-0000-0000-0000-000000000001','company','sb:projects/eeeeeeee-0000-0000-0000-000000000001/s.png','نورة',(select content_hash from project_contracts where id='ffffffff-0000-0000-0000-000000000001'))$$, 'client cannot sign as the company');
select pg_temp.allowed($$select public.contract_changes('ffffffff-0000-0000-0000-000000000001','الكمية 1500')$$, 'client requests changes');
reset role;
select pg_temp.ok((select status||'|'||change_note from project_contracts where id='ffffffff-0000-0000-0000-000000000001') = 'changes|الكمية 1500' and (select count(*) from project_comments where body like 'ملاحظة على العقد%') = 1, 'changes recorded and posted to the project thread');
-- التعديل ثم إعادة الإرسال ثم التوقيع
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.allowed($$update project_contracts set specs = '[{"name":"زجاجة 50 مل","qty":1500,"unit":"قطعة","images":[],"files":[]}]' where id='ffffffff-0000-0000-0000-000000000001'$$, 'sales edits the contract after a change request');
select pg_temp.allowed($$select public.send_contract('ffffffff-0000-0000-0000-000000000001')$$, 'sales re-sends');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000f',false);
select pg_temp.ok(public.sign_contract('ffffffff-0000-0000-0000-000000000001','client','sb:projects/eeeeeeee-0000-0000-0000-000000000001/sig-client.png','نورة العميل',(select content_hash from project_contracts where id='ffffffff-0000-0000-0000-000000000001')) = 'client_signed', 'client signs the shown fingerprint');
select pg_temp.denied($$select public.sign_contract('ffffffff-0000-0000-0000-000000000001','client','sb:projects/eeeeeeee-0000-0000-0000-000000000001/sig-client.png','نورة',(select content_hash from project_contracts where id='ffffffff-0000-0000-0000-000000000001'))$$, 'cannot sign twice');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$select public.reopen_contract('ffffffff-0000-0000-0000-000000000001')$$, 'a client-signed contract cannot be reopened for editing');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select pg_temp.ok(public.sign_contract('ffffffff-0000-0000-0000-000000000001','company','sb:projects/eeeeeeee-0000-0000-0000-000000000001/sig-co.png','أحمد الكاف',(select content_hash from project_contracts where id='ffffffff-0000-0000-0000-000000000001')) = 'signed', 'owner countersigns → signed');
reset role;
select pg_temp.ok((select client_signed_name||'|'||company_signed_name||'|'||(client_signed_at is not null) from project_contracts where id='ffffffff-0000-0000-0000-000000000001') = 'نورة العميل|أحمد الكاف|true', 'both signatures recorded with names and times');
select pg_temp.ok((select count(*) from audit_log where action like 'contract.%') >= 4, 'contract actions audited');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select pg_temp.denied($$select public.void_contract('ffffffff-0000-0000-0000-000000000001')$$, 'sales cannot void a signed contract');
reset role;
