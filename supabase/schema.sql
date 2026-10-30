-- ════════════════════════════════════════════════════════════════════
-- منصة العطور — مخطط قاعدة البيانات (Supabase / PostgreSQL 15+)
-- نفّذه كاملاً من SQL Editor. الملف قابل لإعادة التنفيذ بأمان.
--
-- المبادئ:
--   • الصلاحيات في جدول role_permissions — نفس مصفوفة src/lib/rbac.ts
--   • RLS على كل جدول: الواجهة تُخفي، وقاعدة البيانات تمنع
--   • سجل التدقيق ونشاطات العملاء تُكتب بمُشغّلات (triggers) لا يمكن تجاوزها من المتصفح
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── الأدوار والصلاحيات ────────────────────────────────────────────
create table if not exists public.role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);

delete from public.role_permissions;
insert into public.role_permissions (role, permission)
select r, p from (values ('owner'), ('admin')) as roles(r),
  unnest(array['crm.view','crm.edit','crm.assign','payments.view','projects.view','projects.manage','content.edit','studio.manage','team.view','team.manage','audit.view','pricing.manage','inventory.view','inventory.manage','contracts.sign']) as p
union all select 'sales', unnest(array['crm.view','crm.edit','payments.view','projects.view','projects.manage','team.view','inventory.view'])
-- المصمم يرى المشاريع المسندة إليه فقط (عبر designer_id)، لا كلها
union all select 'designer', unnest(array['studio.manage','team.view'])
union all select 'production', unnest(array['crm.view','projects.view','team.view','inventory.view','inventory.manage'])
union all select 'editor', unnest(array['content.edit','team.view']);

alter table public.role_permissions enable row level security;
drop policy if exists "read permissions" on public.role_permissions;
create policy "read permissions" on public.role_permissions for select to authenticated using (true);

-- ─── الملفات الشخصية (الفريق والعملاء) ────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  role text not null default 'client'
    check (role in ('owner','admin','sales','designer','production','editor','client')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists country text;
alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles add constraint profiles_country_check check (country is null or country ~ '^[A-Z]{2}$');

alter table public.profiles enable row level security;

-- دور المستخدم الحالي (معطّل الحساب = بلا دور)
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.role_permissions rp
    where rp.role = public.app_role() and rp.permission = p
  )
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() <> 'client', false)
$$;

-- كل مستخدم جديد يبدأ عميلاً
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, country)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    case when upper(new.raw_user_meta_data ->> 'country') ~ '^[A-Z]{2}$' then upper(new.raw_user_meta_data ->> 'country') end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── سجل التدقيق (إلحاق فقط) ───────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
drop policy if exists "audit read" on public.audit_log;
create policy "audit read" on public.audit_log for select to authenticated using (public.has_perm('audit.view'));
-- لا سياسات إدراج/تعديل/حذف: الكتابة عبر المُشغّلات فقط

create or replace function public.write_audit(p_action text, p_entity text, p_id text, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_id, p_detail)
$$;
revoke execute on function public.write_audit(text, text, text, text) from public, anon, authenticated;

-- حماية تغيير الأدوار والتفعيل
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor_role text := public.app_role();
begin
  if new.id <> old.id or coalesce(new.email, '') <> coalesce(old.email, '') then
    -- البريد مصدره auth.users؛ لا يُعدّل من هنا
    if auth.uid() is not null then raise exception 'profile_identity_locked' using errcode = '42501'; end if;
  end if;

  if new.role is distinct from old.role or new.active is distinct from old.active then
    -- auth.uid() فارغ = SQL Editor أو service_role (إعداد أول مالك)
    if auth.uid() is not null then
      if old.id = auth.uid() then raise exception 'cannot_change_own_role' using errcode = '42501'; end if;
      if not public.has_perm('team.manage') then raise exception 'permission_denied:team.manage' using errcode = '42501'; end if;
      if (new.role = 'owner' or old.role = 'owner') and actor_role <> 'owner' then
        raise exception 'only_owner_manages_owners' using errcode = '42501';
      end if;
    end if;
    if old.role = 'owner' and old.active and (new.role <> 'owner' or not new.active)
       and not exists (select 1 from public.profiles where role = 'owner' and active and id <> old.id) then
      raise exception 'last_owner' using errcode = '42501';
    end if;
    if new.role is distinct from old.role then
      perform public.write_audit('team.role', 'profile', old.id::text, old.role || ' → ' || new.role);
    end if;
    if new.active is distinct from old.active then
      perform public.write_audit(case when new.active then 'team.activate' else 'team.deactivate' end, 'profile', old.id::text, null);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile_update();

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_perm('team.view'));
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_perm('team.manage'))
  with check (id = auth.uid() or public.has_perm('team.manage'));

-- ─── CRM: العملاء ────────────────────────────────────────────────
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  city text,
  company text,
  source text not null default 'manual'
    check (source in ('booking','kit','contact','consultation','newsletter','manual','design','brief')),
  stage text not null default 'new'
    check (stage in ('new','contacted','qualified','proposal','won','lost')),
  value numeric(12, 2) not null default 0 check (value >= 0),
  owner_id uuid references public.profiles (id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('booking','kit','contact','consultation','newsletter','manual','design','brief'));
-- العملاء من أغلب دول العالم: الدولة (ISO من حرفين) والجوال بصيغة E.164
alter table public.contacts add column if not exists country text;
alter table public.contacts drop constraint if exists contacts_country_check;
alter table public.contacts add constraint contacts_country_check check (country is null or country ~ '^[A-Z]{2}$');
create index if not exists contacts_email_idx on public.contacts (lower(email));
create index if not exists contacts_phone_idx on public.contacts (phone);
create index if not exists contacts_stage_idx on public.contacts (stage);

alter table public.contacts enable row level security;
drop policy if exists "contacts read" on public.contacts;
create policy "contacts read" on public.contacts for select to authenticated using (public.has_perm('crm.view'));
drop policy if exists "contacts insert" on public.contacts;
create policy "contacts insert" on public.contacts for insert to authenticated
  with check (public.has_perm('crm.edit') and (owner_id is null or public.has_perm('crm.assign')));
drop policy if exists "contacts update" on public.contacts;
create policy "contacts update" on public.contacts for update to authenticated
  using (public.has_perm('crm.edit')) with check (public.has_perm('crm.edit'));
drop policy if exists "contacts delete" on public.contacts;
create policy "contacts delete" on public.contacts for delete to authenticated using (public.has_perm('team.manage'));

-- ─── CRM: النشاطات (غير قابلة للتعديل) ────────────────────────────
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type text not null check (type in ('note','call','email','whatsapp','meeting','stage','assign','request','payment','value')),
  body text not null default '',
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists activities_contact_idx on public.activities (contact_id, created_at desc);

alter table public.activities enable row level security;
drop policy if exists "activities read" on public.activities;
create policy "activities read" on public.activities for select to authenticated using (public.has_perm('crm.view'));
drop policy if exists "activities insert" on public.activities;
-- الموظف يسجّل نشاطاته اليدوية باسمه فقط؛ الأنواع الآلية تكتبها المُشغّلات
create policy "activities insert" on public.activities for insert to authenticated
  with check (
    public.has_perm('crm.edit') and actor_id = auth.uid()
    and type in ('note','call','email','whatsapp','meeting')
    and length(body) between 1 and 4000
  );

-- إدراج فقط (يُستدعى من داخل مُشغّل العميل نفسه، حيث لا يجوز تحديث الصف ذاته)
create or replace function public.add_activity(p_contact uuid, p_type text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.activities (contact_id, type, body, actor_id) values (p_contact, p_type, p_body, auth.uid());
$$;
revoke execute on function public.add_activity(uuid, text, text) from public, anon, authenticated;

-- إدراج + تحديث آخر نشاط للعميل
create or replace function public.log_activity(p_contact uuid, p_type text, p_body text) returns void
language sql security definer set search_path = public as $$
  select public.add_activity(p_contact, p_type, p_body);
  update public.contacts set last_activity_at = now() where id = p_contact;
$$;
revoke execute on function public.log_activity(uuid, text, text) from public, anon, authenticated;

create or replace function public.touch_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.contacts set last_activity_at = now() where id = new.contact_id;
  return new;
end $$;
drop trigger if exists activity_touch on public.activities;
create trigger activity_touch after insert on public.activities
  for each row when (new.type in ('note','call','email','whatsapp','meeting'))
  execute function public.touch_contact();

-- تغييرات العميل: الإسناد يحتاج crm.assign، وكل تغيير مهم يُسجَّل
create or replace function public.guard_contact_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id then
    if auth.uid() is not null and not public.has_perm('crm.assign') then
      raise exception 'permission_denied:crm.assign' using errcode = '42501';
    end if;
    perform public.add_activity(old.id, 'assign',
      coalesce((select first_name || ' ' || last_name from public.profiles where id = new.owner_id), '—'));
    perform public.write_audit('crm.assign', 'contact', old.id::text, '→ ' || coalesce(new.owner_id::text, '—'));
    update public.leads set assignee_id = new.owner_id
      where contact_id = old.id and status in ('new', 'in_progress');
  end if;
  if new.stage is distinct from old.stage then
    perform public.add_activity(old.id, 'stage', old.stage || ' → ' || new.stage);
    perform public.write_audit('crm.stage', 'contact', old.id::text, old.stage || ' → ' || new.stage);
  end if;
  if new.value is distinct from old.value then
    perform public.add_activity(old.id, 'value', old.value || ' → ' || new.value);
  end if;
  new.last_activity_at := now();
  return new;
end $$;
drop trigger if exists guard_contact on public.contacts;
create trigger guard_contact before update on public.contacts
  for each row execute function public.guard_contact_update();

create or replace function public.audit_contact_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    perform public.write_audit('crm.create', 'contact', new.id::text, new.name);
  end if;
  return new;
end $$;
drop trigger if exists audit_contact_new on public.contacts;
create trigger audit_contact_new after insert on public.contacts
  for each row execute function public.audit_contact_insert();

-- ─── الطلبات الواردة من نماذج الموقع ──────────────────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  page text,
  created_at timestamptz not null default now()
);
alter table public.leads add column if not exists contact_id uuid references public.contacts (id) on delete set null;
alter table public.leads add column if not exists status text not null default 'new';
alter table public.leads add column if not exists assignee_id uuid references public.profiles (id) on delete set null;
alter table public.leads drop constraint if exists leads_kind_check;
alter table public.leads add constraint leads_kind_check check (kind in ('contact','consultation','newsletter','booking','kit','design','brief'));
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new','in_progress','done','archived'));
create index if not exists leads_created_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
drop policy if exists "anyone can submit leads" on public.leads;
-- الزائر يرسل طلباً فقط؛ الحالة والإسناد والربط يفرضها المُشغّل lead_link على الخادم
-- (سياسة RLS تُقيَّم بعد مُشغّلات BEFORE، لذلك لا نشترط هنا أن تكون فارغة)
create policy "anyone can submit leads" on public.leads for insert to anon, authenticated
  with check (pg_column_size(payload) < 16384);
drop policy if exists "admins read leads" on public.leads;
drop policy if exists "leads read" on public.leads;
create policy "leads read" on public.leads for select to authenticated using (public.has_perm('crm.view'));
drop policy if exists "leads update" on public.leads;
create policy "leads update" on public.leads for update to authenticated
  using (public.has_perm('crm.edit')) with check (public.has_perm('crm.edit'));

-- كل طلب وارد يُربط بعميل (يُنشأ إن لم يوجد بنفس البريد أو الجوال)
create or replace function public.link_lead_to_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := nullif(lower(trim(new.payload ->> 'email')), '');
  v_phone text := nullif(regexp_replace(coalesce(new.payload ->> 'phone', ''), '[\s-]', '', 'g'), '');
  v_name text := nullif(trim(coalesce(new.payload ->> 'firstName', '') || ' ' || coalesce(new.payload ->> 'lastName', '')), '');
  v_country text := upper(coalesce(nullif(new.payload ->> 'country', ''), new.payload ->> 'phone_country'));
  v_local text;
  v_contact public.contacts%rowtype;
begin
  -- قيم يفرضها الخادم مهما أرسل المتصفح
  new.status := 'new';
  new.contact_id := null;
  new.assignee_id := null;
  new.project_id := null;
  if new.kind = 'newsletter' then return new; end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  -- الجوال السعودي المحلي القديم (05…) يُوحَّد إلى E.164، ويطابق العملاء المسجلين بأي الصيغتين
  if v_phone ~ '^05[0-9]{8}$' then v_phone := '+966' || substr(v_phone, 2); end if;
  v_local := case when v_phone ~ '^\+9665[0-9]{8}$' then '0' || substr(v_phone, 5) end;
  select * into v_contact from public.contacts
    where (v_email is not null and lower(email) = v_email)
       or (v_phone is not null and (phone = v_phone or phone = v_local))
    order by created_at limit 1;
  if not found then
    insert into public.contacts (name, email, phone, city, country, source, value)
    values (coalesce(v_name, v_email, v_phone, '—'), v_email, v_phone, new.payload ->> 'city', v_country, new.kind,
            case when new.kind = 'kit' then 750 else 0 end)
    returning * into v_contact;
  end if;
  new.contact_id := v_contact.id;
  new.assignee_id := v_contact.owner_id;
  return new;
end $$;
drop trigger if exists lead_link on public.leads;
create trigger lead_link before insert on public.leads
  for each row execute function public.link_lead_to_contact();

create or replace function public.lead_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.contact_id is not null then
    perform public.log_activity(new.contact_id, 'request', 'طلب وارد من الموقع (' || new.kind || ')');
  end if;
  return new;
end $$;
drop trigger if exists lead_logged on public.leads;
create trigger lead_logged after insert on public.leads
  for each row execute function public.lead_activity();

create or replace function public.guard_lead_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> old.kind or new.payload <> old.payload or new.contact_id is distinct from old.contact_id
     or (new.project_id is distinct from old.project_id and coalesce(current_setting('app.claiming', true), '') <> '1') then
    if auth.uid() is not null then raise exception 'lead_content_locked' using errcode = '42501'; end if;
  end if;
  -- pg_trigger_depth() = 1: تعديل مباشر من المستخدم؛ أعمق من ذلك = مزامنة من مُشغّل العميل
  if new.assignee_id is distinct from old.assignee_id and auth.uid() is not null
     and pg_trigger_depth() = 1 and not public.has_perm('crm.assign') then
    raise exception 'permission_denied:crm.assign' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    perform public.write_audit('crm.lead_status', 'lead', old.id::text, old.status || ' → ' || new.status);
  end if;
  return new;
end $$;
drop trigger if exists guard_lead on public.leads;
create trigger guard_lead before update on public.leads
  for each row execute function public.guard_lead_update();

-- ─── المهام والمتابعات ─────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  due_at timestamptz not null,
  done boolean not null default false,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id, done, due_at);

alter table public.tasks enable row level security;
drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using (public.has_perm('crm.view') or assignee_id = auth.uid());
drop policy if exists "tasks insert" on public.tasks;
create policy "tasks insert" on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.has_perm('crm.edit') or (public.is_staff() and assignee_id = auth.uid()))
  );
drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks for update to authenticated
  using (public.has_perm('crm.edit') or assignee_id = auth.uid())
  with check (public.has_perm('crm.edit') or assignee_id = auth.uid());
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete to authenticated using (public.has_perm('crm.edit'));

-- ─── المدفوعات (مويسر) ─────────────────────────────────────────────
-- تُكتب من دالة الخادم api/payments/verify بمفتاح service_role فقط
create table if not exists public.payments (
  id text primary key,            -- معرّف الدفعة في مويسر
  order_ref text,                 -- رقم الطلب في الموقع (KIT-XXXXXX)
  kind text,
  amount integer not null,        -- بالهللة
  currency text not null default 'SAR',
  status text not null,
  method text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;
drop policy if exists "admins read payments" on public.payments;
drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments for select to authenticated using (public.has_perm('payments.view'));

-- الدفعة الناجحة تظهر في سجل العميل
create or replace function public.payment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_contact uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') and new.email is not null then
    select id into v_contact from public.contacts where lower(email) = lower(new.email) order by created_at limit 1;
    if v_contact is not null then
      perform public.log_activity(v_contact, 'payment', (new.amount / 100.0)::text || ' ' || new.currency || ' · ' || coalesce(new.order_ref, new.id));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists payment_logged on public.payments;
create trigger payment_logged after insert or update on public.payments
  for each row execute function public.payment_activity();

-- ─── أستوديو العبوات: كتالوج العبوات والأغطية ثلاثية الأبعاد ─────────────
create table if not exists public.packaging_models (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('bottle', 'cap')),
  name_ar text not null check (length(name_ar) between 1 and 80),
  name_en text,
  capacity_ml integer check (capacity_ml is null or capacity_ml between 1 and 5000),
  height_mm numeric(7, 2) not null check (height_mm between 3 and 600),
  neck_mm numeric(7, 2) not null default 0 check (neck_mm >= 0),
  -- [[نصف القطر، الارتفاع], ...] بالمليمتر
  profile jsonb not null check (jsonb_typeof(profile) = 'array' and jsonb_array_length(profile) between 2 and 400),
  section text not null default 'round' check (section in ('round', 'square', 'oval')),
  depth_ratio numeric(4, 3) not null default 1 check (depth_ratio between 0.2 and 1),
  squareness numeric(5, 2) not null default 2 check (squareness between 2 and 40),
  -- صورة مصغّرة (data URL صغير) — حدّ الحجم يمنع إساءة الاستخدام
  thumb text check (thumb is null or length(thumb) < 250000),
  published boolean not null default false,
  sort integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.packaging_models enable row level security;
drop policy if exists "models read" on public.packaging_models;
-- الزوار والعملاء يرون المنشور فقط؛ فريق الأستوديو يرى الكل
create policy "models read" on public.packaging_models for select to anon, authenticated
  using (published or public.has_perm('studio.manage'));
drop policy if exists "models write" on public.packaging_models;
create policy "models write" on public.packaging_models for all to authenticated
  using (public.has_perm('studio.manage')) with check (public.has_perm('studio.manage'));

create or replace function public.touch_model() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.published is distinct from old.published then
      perform public.write_audit(case when new.published then 'studio.publish' else 'studio.unpublish' end, 'packaging_model', old.id, old.name_ar);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    perform public.write_audit('studio.create', 'packaging_model', new.id, new.name_ar);
  end if;
  if tg_op = 'DELETE' then
    perform public.write_audit('studio.delete', 'packaging_model', old.id, old.name_ar);
    return old;
  end if;
  return new;
end $$;
drop trigger if exists model_touch on public.packaging_models;
create trigger model_touch before update on public.packaging_models
  for each row execute function public.touch_model();
drop trigger if exists model_audit on public.packaging_models;
create trigger model_audit after insert or delete on public.packaging_models
  for each row execute function public.touch_model();

-- نماذج الذكاء الاصطناعي: ملف GLB جاهز بدل المقطع الجانبي
alter table public.packaging_models add column if not exists source text not null default 'profile';
alter table public.packaging_models drop constraint if exists packaging_models_source_check;
alter table public.packaging_models add constraint packaging_models_source_check check (source in ('profile', 'ai'));
alter table public.packaging_models add column if not exists glb_url text;
alter table public.packaging_models add column if not exists usdz_url text;
alter table public.packaging_models drop constraint if exists packaging_models_urls_check;
-- روابط https فقط (تمنع حقن javascript: أو روابط محلية)
alter table public.packaging_models add constraint packaging_models_urls_check
  check ((glb_url is null or glb_url ~ '^https://') and (usdz_url is null or usdz_url ~ '^https://'));
alter table public.packaging_models drop constraint if exists packaging_models_ai_glb_check;
alter table public.packaging_models add constraint packaging_models_ai_glb_check check (source <> 'ai' or glb_url is not null);

-- مهام التحويل بالذكاء الاصطناعي: يكتبها الخادم (api/ai3d) بمفتاح الخدمة فقط
create table if not exists public.ai3d_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meshy', 'fal')),
  provider_task_id text not null,
  meta jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  glb_url text check (glb_url is null or glb_url ~ '^https://'),
  usdz_url text check (usdz_url is null or usdz_url ~ '^https://'),
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai3d_jobs enable row level security;
drop policy if exists "ai jobs read" on public.ai3d_jobs;
create policy "ai jobs read" on public.ai3d_jobs for select to authenticated using (public.has_perm('studio.manage'));

-- حاوية الملفات: قراءة عامة (العملاء يحمّلون النماذج)، والكتابة بمفتاح الخدمة فقط
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('models', 'models', true) on conflict (id) do nothing;
  end if;
end $$;

-- كتالوج البداية (مولَّد من src/studio/seed.ts) — لا يمس النماذج التي عدّلتها الإدارة
insert into public.packaging_models (id, kind, name_ar, name_en, capacity_ml, height_mm, neck_mm, profile, section, depth_ratio, squareness, published, sort) values
  ('B-ATLAS', 'bottle', 'أطلس · أسطواني', 'Atlas · cylinder', 50, 96, 13, '[[17.4,0],[18.3,1.5],[18.4,3],[18.4,70],[17.8,74],[15.1,78],[8.9,81.5],[7.6,83],[7.6,96]]', 'round', 1, 2, true, 1),
  ('B-NOOR', 'bottle', 'نور · مربع مسطّح', 'Noor · flat square', 100, 112, 12, '[[26,0],[26.9,2.5],[26.9,88],[25.5,93],[17.8,97.5],[8.8,99.5],[7.8,100.5],[7.8,112]]', 'square', 0.55, 7, true, 2),
  ('B-QAHWA', 'bottle', 'قهوة · كروي قصير', 'Qahwa · squat round', 30, 66, 10, '[[14.8,0],[17.3,2],[18.9,8],[19.6,20],[18.9,33],[16.7,42],[11.6,50],[7.9,54],[7.4,56],[7.4,66]]', 'round', 1, 2, true, 3),
  ('B-BAHR', 'bottle', 'بحر · بيضاوي طويل', 'Bahr · tall oval', 75, 128, 11, '[[21.5,0],[22.9,2.5],[22.9,104],[21.1,110],[13.4,114.5],[8,116.5],[7.5,117],[7.5,128]]', 'oval', 0.62, 2, true, 4),
  ('C-CYL', 'cap', 'أسطوانة', 'Cylinder', null, 30, 0, '[[11.2,0],[11.2,28],[10.6,29.6],[9.8,30]]', 'round', 1, 2, true, 1),
  ('C-CUBE', 'cap', 'مكعب', 'Cube', null, 30, 0, '[[14.5,0],[15,1],[15,29],[14.5,30]]', 'square', 1, 9, true, 2),
  ('C-DOME', 'cap', 'قبة', 'Dome', null, 26, 0, '[[12.5,0],[12.5,9],[12.2,14],[11,18.5],[8.5,22.5],[5,25],[1,26]]', 'round', 1, 2, true, 3),
  ('C-TOWER', 'cap', 'برج مخروطي', 'Tapered tower', null, 44, 0, '[[12,0],[13.5,4],[12.5,30],[10.5,42],[9.5,44]]', 'square', 1, 4, true, 4)
on conflict (id) do nothing;

-- ─── استوديو المبدعين: المصممون وأعمالهم ─────────────────────────
create table if not exists public.creatives (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 48),
  name_ar text not null check (length(name_ar) between 1 and 80),
  name_en text check (name_en is null or length(name_en) <= 80),
  title_ar text not null default '' check (length(title_ar) <= 120),
  title_en text check (title_en is null or length(title_en) <= 120),
  bio_ar text not null default '' check (length(bio_ar) <= 1200),
  bio_en text check (bio_en is null or length(bio_en) <= 1200),
  city_ar text not null default '' check (length(city_ar) <= 60),
  city_en text check (city_en is null or length(city_en) <= 60),
  specialties text[] not null check (cardinality(specialties) between 1 and 6
    and specialties <@ array['identity','label','packaging','bottle','3d','photo']),
  years_exp integer not null default 0 check (years_exp between 0 and 60),
  rate_from integer check (rate_from is null or rate_from between 0 and 10000000),
  turnaround_days integer check (turnaround_days is null or turnaround_days between 1 and 365),
  avatar text check (avatar is null or avatar ~ '^https://'),
  available boolean not null default true,
  featured boolean not null default false,
  published boolean not null default false,
  -- ملف توضيحي: تعرض الواجهة شارة واضحة للزائر
  sample boolean not null default false,
  profile_id uuid references public.profiles (id) on delete set null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_works (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.creatives (id) on delete cascade,
  title_ar text not null check (length(title_ar) between 1 and 120),
  title_en text check (title_en is null or length(title_en) <= 120),
  summary_ar text not null default '' check (length(summary_ar) <= 600),
  summary_en text check (summary_en is null or length(summary_en) <= 600),
  category text not null check (category in ('identity','label','packaging','bottle','3d','photo')),
  -- روابط https فقط، صورة واحدة على الأقل و12 كحد أقصى
  images text[] not null check (cardinality(images) between 1 and 12),
  client text check (client is null or length(client) <= 80),
  concept boolean not null default false,
  year integer not null check (year between 1990 and 2100),
  published boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creative_works_creative_idx on public.creative_works (creative_id, sort);

-- كل الصور روابط https (يمنع javascript: والروابط المحلية) — القيود لا تقبل استعلامات فرعية فنستخدم دالة
create or replace function public.all_https(urls text[]) returns boolean
language sql immutable as $$ select coalesce(bool_and(u ~ '^https://'), true) from unnest(urls) u $$;
alter table public.creative_works drop constraint if exists creative_works_images_https;
alter table public.creative_works add constraint creative_works_images_https check (public.all_https(images));

alter table public.creatives enable row level security;
alter table public.creative_works enable row level security;
drop policy if exists "creatives read" on public.creatives;
create policy "creatives read" on public.creatives for select to anon, authenticated
  using (published or public.has_perm('studio.manage'));
drop policy if exists "creatives write" on public.creatives;
create policy "creatives write" on public.creatives for all to authenticated
  using (public.has_perm('studio.manage')) with check (public.has_perm('studio.manage'));
drop policy if exists "works read" on public.creative_works;
-- العمل يظهر للزائر فقط إن كان هو ومصممه منشورين
create policy "works read" on public.creative_works for select to anon, authenticated
  using (public.has_perm('studio.manage')
    or (published and exists (select 1 from public.creatives c where c.id = creative_id and c.published)));
drop policy if exists "works write" on public.creative_works;
create policy "works write" on public.creative_works for all to authenticated
  using (public.has_perm('studio.manage')) with check (public.has_perm('studio.manage'));

create or replace function public.touch_creative() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := case when tg_table_name = 'creatives' then 'creative' else 'creative_work' end;
  v_name text;
begin
  if tg_op = 'DELETE' then
    v_name := coalesce(to_jsonb(old) ->> 'name_ar', to_jsonb(old) ->> 'title_ar');
    perform public.write_audit(v_kind || '.delete', v_kind, old.id::text, v_name);
    return old;
  end if;
  -- الجدولان يختلفان في اسم العمود؛ to_jsonb يتفادى خطأ الحقل غير الموجود
  v_name := coalesce(to_jsonb(new) ->> 'name_ar', to_jsonb(new) ->> 'title_ar');
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_at := old.created_at;
    if new.published is distinct from old.published then
      perform public.write_audit(v_kind || case when new.published then '.publish' else '.unpublish' end, v_kind, old.id::text, v_name);
    end if;
    return new;
  end if;
  perform public.write_audit(v_kind || '.create', v_kind, new.id::text, v_name);
  return new;
end $$;
drop trigger if exists creative_touch on public.creatives;
create trigger creative_touch before update on public.creatives for each row execute function public.touch_creative();
drop trigger if exists creative_audit on public.creatives;
create trigger creative_audit after insert or delete on public.creatives for each row execute function public.touch_creative();
drop trigger if exists work_touch on public.creative_works;
create trigger work_touch before update on public.creative_works for each row execute function public.touch_creative();
drop trigger if exists work_audit on public.creative_works;
create trigger work_audit after insert or delete on public.creative_works for each row execute function public.touch_creative();

-- حاوية صور الأعمال: قراءة عامة، والرفع والحذف لفريق الأستوديو فقط
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('portfolio', 'portfolio', true, 5242880, array['image/webp','image/jpeg','image/png'])
    on conflict (id) do nothing;
    execute 'drop policy if exists "portfolio write" on storage.objects';
    execute 'create policy "portfolio write" on storage.objects for insert to authenticated with check (bucket_id = ''portfolio'' and public.has_perm(''studio.manage''))';
    execute 'drop policy if exists "portfolio delete" on storage.objects';
    execute 'create policy "portfolio delete" on storage.objects for delete to authenticated using (bucket_id = ''portfolio'' and public.has_perm(''studio.manage''))';
  end if;
end $$;

-- ─── محتوى الموقع (CMS): مسودة ← نشر ← نسخ للاسترجاع ─────────────────
-- المنشور يقرؤه الجميع؛ المسودات والنسخ لصلاحية content.edit فقط.
-- لا كتابة مباشرة على المنشور: النشر عبر publish_content() التي تحفظ نسخة وتسجّل التدقيق.
create table if not exists public.site_content (
  key text primary key check (key in ('site','announcement','hero','faq','offers')),
  value jsonb not null check (jsonb_typeof(value) = 'object' and pg_column_size(value) < 65536),
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id) on delete set null
);
create table if not exists public.site_content_drafts (
  key text primary key check (key in ('site','announcement','hero','faq','offers')),
  value jsonb not null check (jsonb_typeof(value) = 'object' and pg_column_size(value) < 65536),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create table if not exists public.site_content_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id) on delete set null
);
create index if not exists site_content_versions_key_idx on public.site_content_versions (key, published_at desc);
-- وثيقة أسعار العلب (المرحلة 7+): نوسّع قائمة المفاتيح على الجداول القائمة
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check check (key in ('site','announcement','hero','faq','offers','pricing','legal'));
alter table public.site_content_drafts drop constraint if exists site_content_drafts_key_check;
alter table public.site_content_drafts add constraint site_content_drafts_key_check check (key in ('site','announcement','hero','faq','offers','pricing','legal'));

alter table public.site_content enable row level security;
alter table public.site_content_drafts enable row level security;
alter table public.site_content_versions enable row level security;
drop policy if exists "content read" on public.site_content;
create policy "content read" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "drafts all" on public.site_content_drafts;
-- وثيقة الأسعار قرار تجاري: تحتاج pricing.manage فوق صلاحية المحتوى
create policy "drafts all" on public.site_content_drafts for all to authenticated
  using (public.has_perm('content.edit') and (key <> 'pricing' or public.has_perm('pricing.manage')))
  with check (public.has_perm('content.edit') and (key <> 'pricing' or public.has_perm('pricing.manage')));
drop policy if exists "versions read" on public.site_content_versions;
create policy "versions read" on public.site_content_versions for select to authenticated using (public.has_perm('content.edit'));

-- كاتب المسودة يفرضه الخادم
create or replace function public.touch_draft() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists draft_touch on public.site_content_drafts;
create trigger draft_touch before insert or update on public.site_content_drafts for each row execute function public.touch_draft();

create or replace function public.publish_content(p_key text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  t timestamptz := clock_timestamp();
begin
  if not public.has_perm('content.edit') then raise exception 'permission_denied:content.edit' using errcode = '42501'; end if;
  if p_key = 'pricing' and not public.has_perm('pricing.manage') then raise exception 'permission_denied:pricing.manage' using errcode = '42501'; end if;
  select value into v from public.site_content_drafts where key = p_key;
  if v is null then raise exception 'no_draft' using errcode = 'P0002'; end if;
  insert into public.site_content (key, value, published_at, published_by) values (p_key, v, t, auth.uid())
    on conflict (key) do update set value = excluded.value, published_at = t, published_by = auth.uid();
  insert into public.site_content_versions (key, value, published_at, published_by) values (p_key, v, t, auth.uid());
  -- نحتفظ بآخر 30 نسخة لكل وثيقة
  delete from public.site_content_versions where key = p_key and id not in
    (select id from public.site_content_versions where key = p_key order by published_at desc limit 30);
  delete from public.site_content_drafts where key = p_key;
  perform public.write_audit('content.publish', 'content', p_key, null);
  return t;
end $$;

-- الاسترجاع يعيد النسخة كمسودة (تُراجع ثم تُنشر) — لا ينشر مباشرة
create or replace function public.restore_content_version(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.site_content_versions%rowtype;
begin
  if not public.has_perm('content.edit') then raise exception 'permission_denied:content.edit' using errcode = '42501'; end if;
  select * into r from public.site_content_versions where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.key = 'pricing' and not public.has_perm('pricing.manage') then raise exception 'permission_denied:pricing.manage' using errcode = '42501'; end if;
  insert into public.site_content_drafts (key, value) values (r.key, r.value)
    on conflict (key) do update set value = excluded.value;
  perform public.write_audit('content.restore', 'content', r.key, to_char(r.published_at, 'YYYY-MM-DD HH24:MI'));
end $$;
revoke all on function public.publish_content(text) from public, anon;
revoke all on function public.restore_content_version(uuid) from public, anon;
grant execute on function public.publish_content(text) to authenticated;
grant execute on function public.restore_content_version(uuid) to authenticated;

-- صور المحتوى (صورة الواجهة): قراءة عامة، والرفع لـ content.edit
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('site', 'site', true, 5242880, array['image/webp','image/jpeg','image/png'])
    on conflict (id) do nothing;
    execute 'drop policy if exists "site write" on storage.objects';
    execute 'create policy "site write" on storage.objects for insert to authenticated with check (bucket_id = ''site'' and public.has_perm(''content.edit''))';
  end if;
end $$;

-- ─── مشاريع العملاء والاعتمادات ──────────────────────────────────────
-- من يرى المشروع: projects.manage (المبيعات/الإدارة)، المصمم المسند إليه، projects.view (الإنتاج)،
-- والعميل صاحب المشروع. التعديل على الاعتماد يتم عبر decide_item() فقط.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in ('note','call','email','whatsapp','meeting','stage','assign','request','payment','value','project'));

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  track text check (track is null or track in ('A','B','C','D','E','F')),
  contact_id uuid references public.contacts (id) on delete set null,
  client_email text not null check (client_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(client_email) <= 160),
  client_id uuid references public.profiles (id) on delete set null,
  designer_id uuid references public.profiles (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  stage text not null default 'brief',
  status text not null default 'active' check (status in ('active','on_hold','done')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists projects_email_idx on public.projects (lower(client_email));

-- مراحل كل مسار (مطابقة لـ src/projects/stages.ts). الأولى brief والأخيرة delivered دائماً
create or replace function public.track_stages(p_track text) returns text[]
language sql immutable as $$
  select case p_track
    when 'A' then array['brief','formula','identity','production','delivered']
    when 'B' then array['brief','first_round','refinement','approval','delivered']
    when 'C' then array['brief','design','prototype','delivered']
    when 'D' then array['brief','concepts','system','delivered']
    when 'E' then array['brief','sourcing','production','delivered']
    when 'F' then array['brief','proof','printing','delivered']
    when 'P' then array['brief','sampling','bottling','delivered']
    else array['brief','design','sampling','production','delivered']
  end
$$;
-- الاسم العربي للمرحلة في سجل نشاط العميل
create or replace function public.stage_label(p_track text, p_stage text) returns text
language sql immutable as $$
  select coalesce(case p_track
    when 'A' then case p_stage when 'brief' then 'البريف والاستراتيجية' when 'formula' then 'التركيبة والعينات' when 'identity' then 'الهوية والعبوة' when 'production' then 'التصنيع والإطلاق' end
    when 'B' then case p_stage when 'brief' then 'البريف' when 'first_round' then 'الجولة الأولى' when 'refinement' then 'التحسين' when 'approval' then 'الاعتماد' end
    when 'C' then case p_stage when 'brief' then 'الاتجاه' when 'design' then 'التصميم' when 'prototype' then 'النموذج' end
    when 'D' then case p_stage when 'brief' then 'الاستكشاف' when 'concepts' then 'المفاهيم' when 'system' then 'النظام' end
    when 'E' then case p_stage when 'brief' then 'مراجعة الملفات' when 'sourcing' then 'التوريد' when 'production' then 'الإنتاج' end
    when 'F' then case p_stage when 'brief' then 'فحص الملفات' when 'proof' then 'البروفة' when 'printing' then 'الطباعة' end
    when 'P' then case p_stage when 'brief' then 'التكوين والاستشارة' when 'sampling' then 'العينات التجريبية' when 'bottling' then 'التعبئة والنقش' end
    else case p_stage when 'brief' then 'الملخص والاتجاه' when 'design' then 'التصميم' when 'sampling' then 'العينات' when 'production' then 'الإنتاج' end
  end, case when p_stage = 'delivered' then 'التسليم' end, p_stage)
$$;
-- ترحيل: المشاريع القائمة بمراحل عامة تنتقل لما يقابل موضعها في مراحل مسارها
alter table public.projects drop constraint if exists projects_stage_check;
alter table public.projects drop constraint if exists projects_stage_ok;
update public.projects p set stage = case
    when p.stage = 'delivered' then 'delivered'
    else (public.track_stages(p.track))[least(coalesce(array_position(array['brief','design','sampling','production'], p.stage), 1), cardinality(public.track_stages(p.track)) - 1)]
  end
  where not (p.stage = any (public.track_stages(p.track)));
-- المسار P: «عطرك الخاص» للأفراد
alter table public.projects drop constraint if exists projects_track_check;
alter table public.projects add constraint projects_track_check check (track is null or track in ('A','B','C','D','E','F','P'));
alter table public.projects add constraint projects_stage_ok check (stage = any (public.track_stages(track)));

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$ begin return t::uuid; exception when others then return null; end $$;

-- 'manage' | 'designer' | 'view' | 'client' | null
create or replace function public.project_access(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then null
    when public.has_perm('projects.manage') then 'manage'
    when exists (select 1 from public.projects where id = p and designer_id = auth.uid()) then 'designer'
    when public.has_perm('projects.view') then 'view'
    when exists (select 1 from public.projects where id = p and client_id = auth.uid()) then 'client'
  end
$$;

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  thread_id uuid,
  version integer not null default 1,
  kind text not null check (kind in ('identity','label','box','bottle','sample','other')),
  title text not null check (length(title) between 1 and 120),
  status text not null default 'pending' check (status in ('pending','approved','changes','superseded','submitted')),
  files text[] not null default '{}' check (cardinality(files) <= 12),
  studio jsonb check (studio is null or (jsonb_typeof(studio) = 'object' and pg_column_size(studio) < 4000)),
  note text not null default '' check (length(note) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  by_client boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text check (decision_note is null or length(decision_note) <= 2000)
);
create index if not exists project_items_project_idx on public.project_items (project_id, created_at desc);
create or replace function public.files_ok(f text[]) returns boolean
language sql immutable as $$ select coalesce(bool_and(u ~ '^(https://|sb:projects/[0-9a-f-]{36}/)'), true) from unnest(f) u $$;
alter table public.project_items drop constraint if exists project_items_files_ok;
alter table public.project_items add constraint project_items_files_ok check (public.files_ok(files));
-- رابط التصميم داخلي فقط (/studio-3d…) — لا روابط خارجية مضللة
alter table public.project_items drop constraint if exists project_items_studio_link;
alter table public.project_items add constraint project_items_studio_link check (studio is null or (studio ->> 'link') ~ '^/studio-3d([?#]|$)');

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid references public.project_items (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  from_client boolean not null default false,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists project_comments_project_idx on public.project_comments (project_id, created_at);

create table if not exists public.saved_designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  link text not null check (link ~ '^/studio-3d([?#]|$)' and length(link) <= 2000),
  summary text not null default '' check (length(summary) <= 600),
  thumb text check (thumb is null or (thumb ~ '^data:image/(webp|png|jpeg);base64,' and length(thumb) < 120000)),
  label jsonb check (label is null or pg_column_size(label) < 300000),
  box jsonb check (box is null or pg_column_size(box) < 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.project_comments enable row level security;
alter table public.saved_designs enable row level security;

drop policy if exists "projects read" on public.projects;
create policy "projects read" on public.projects for select to authenticated using (public.project_access(id) is not null);
drop policy if exists "projects write" on public.projects;
drop policy if exists "projects insert" on public.projects;
drop policy if exists "projects update" on public.projects;
drop policy if exists "projects delete" on public.projects;
create policy "projects insert" on public.projects for insert to authenticated with check (public.has_perm('projects.manage'));
create policy "projects update" on public.projects for update to authenticated
  using (public.has_perm('projects.manage')) with check (public.has_perm('projects.manage'));
-- الحذف يمحو العروض والتكاليف معه: للمالك والمدير فقط (وشرط العرض المدفوع بعد جدول العروض أدناه)
create policy "projects delete" on public.projects for delete to authenticated using (public.has_perm('team.manage'));

drop policy if exists "items read" on public.project_items;
create policy "items read" on public.project_items for select to authenticated using (public.project_access(project_id) is not null);
drop policy if exists "items insert" on public.project_items;
-- الحقول الحساسة (الحالة، الكاتب، النسخة) يفرضها المُشغّل
create policy "items insert" on public.project_items for insert to authenticated
  with check (public.project_access(project_id) in ('manage','designer','client'));
drop policy if exists "items delete" on public.project_items;
create policy "items delete" on public.project_items for delete to authenticated using (public.project_access(project_id) = 'manage');

drop policy if exists "comments read" on public.project_comments;
create policy "comments read" on public.project_comments for select to authenticated using (public.project_access(project_id) is not null);
drop policy if exists "comments insert" on public.project_comments;
create policy "comments insert" on public.project_comments for insert to authenticated with check (public.project_access(project_id) is not null);

drop policy if exists "designs own" on public.saved_designs;
create policy "designs own" on public.saved_designs for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ربط المشروع بحساب العميل عبر البريد (الآن أو عند تسجيله لاحقاً)
create or replace function public.project_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.client_email := lower(trim(new.client_email));
  if tg_op = 'INSERT' or new.client_email is distinct from old.client_email then
    -- بالبريد المؤكَّد فقط: من يسجّل ببريد غيره لا يرى مشاريعه
    new.client_id := (select p.id from public.profiles p join auth.users u on u.id = p.id
                      where p.email = new.client_email and u.email_confirmed_at is not null limit 1);
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    if new.stage is distinct from old.stage then
      perform public.write_audit('project.stage', 'project', old.id::text, old.stage || ' → ' || new.stage);
      if new.contact_id is not null then
        perform public.log_activity(new.contact_id, 'project', 'مرحلة المشروع «' || new.title || '»: ' || public.stage_label(new.track, new.stage));
      end if;
    end if;
  else
    -- منشئ المشروع من الفريق يصبح مسؤوله؛ مشروع بدأه العميل بنفسه (claim_briefs) يبقى بلا مسؤول حتى يُسند
    new.owner_id := coalesce(new.owner_id, case when public.is_staff() then auth.uid() end);
  end if;
  return new;
end $$;
drop trigger if exists project_touch on public.projects;
create trigger project_touch before insert or update on public.projects for each row execute function public.project_touch();

create or replace function public.project_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit('project.create', 'project', new.id::text, new.title);
  if new.contact_id is not null then
    perform public.log_activity(new.contact_id, 'project', 'أُنشئ مشروع «' || new.title || '»');
  end if;
  return new;
end $$;
drop trigger if exists project_created on public.projects;
create trigger project_created after insert on public.projects for each row execute function public.project_created();

create or replace function public.link_projects_to_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from auth.users where id = new.id and email_confirmed_at is not null) then
    update public.projects set client_id = new.id where client_id is null and client_email = new.email;
  end if;
  return new;
end $$;
drop trigger if exists profile_links_projects on public.profiles;
create trigger profile_links_projects after insert or update of email on public.profiles
  for each row execute function public.link_projects_to_profile();

-- عند تأكيد البريد: تُربط مشاريع هذا البريد بالحساب
create or replace function public.link_projects_on_confirm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.projects set client_id = new.id
      where client_id is null and client_email = lower(trim(new.email));
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.link_projects_on_confirm();

-- ─── بدء مسار من الموقع: الملخص أولاً ثم الحساب ──────────────────────
-- الزائر يرسل ملخصه كطلب وارد (kind = 'brief') دون حساب. حين يدخل صاحب البريد بحساب مؤكَّد
-- تتحول طلباته إلى مشاريع في مرحلة «الملخص» — على الخادم وبالبريد المؤكَّد فقط، فلا يدّعي أحد طلب غيره.
alter table public.projects add column if not exists brief jsonb;
alter table public.projects drop constraint if exists projects_brief_size;
alter table public.projects add constraint projects_brief_size check (brief is null or pg_column_size(brief) < 16384);
alter table public.leads add column if not exists project_id uuid references public.projects (id) on delete set null;

create or replace function public.claim_briefs() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  l public.leads%rowtype;
  v_project uuid;
  v_title text;
begin
  if auth.uid() is null then return; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return; end if;
  for l in
    select * from public.leads
    where kind = 'brief' and project_id is null and lower(payload ->> 'email') = v_email
      and created_at > now() - interval '90 days' and coalesce(payload ->> 'track', '') in ('A','B','C','D','E','F','P')
    order by created_at limit 5
    for update skip locked
  loop
    -- اسم البراند إن وُجد، وإلا «الخدمة · الاسم» حتى لا تتشابه المشاريع في قائمة الفريق
    v_title := left(coalesce(nullif(trim(l.payload ->> 'brand'), ''),
      nullif(concat_ws(' · ', nullif(trim(l.payload ->> 'track_title'), ''), nullif(trim(l.payload ->> 'firstName'), '')), ''), 'مشروع جديد'), 120);
    insert into public.projects (title, track, contact_id, client_email, owner_id, stage, status, brief)
      values (v_title, l.payload ->> 'track', l.contact_id, v_email,
              (select owner_id from public.contacts where id = l.contact_id), 'brief', 'active', l.payload)
      returning id into v_project;
    perform set_config('app.claiming', '1', true);
    update public.leads set project_id = v_project where id = l.id and project_id is null;
    perform set_config('app.claiming', '', true);
    return next v_project;
  end loop;
end $$;
revoke all on function public.claim_briefs() from public, anon;
grant execute on function public.claim_briefs() to authenticated;

-- ─── عروض الأسعار والعربون ───────────────────────────────────────────
-- الفريق يكتب العرض (مسودة لا يراها العميل) ثم يرسله؛ العميل يعتمده أو يطلب تعديله؛ ثم يُدفع العربون
-- عبر مويسر (يسجّله الخادم بعد التحقق من المبلغ) أو تحويلاً بنكياً يسجّله الفريق. المبالغ تُحسب هنا لا في المتصفح.
create sequence if not exists public.quote_seq;
create table if not exists public.project_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  ref text not null unique,
  status text not null default 'draft' check (status in ('draft','sent','accepted','changes','paid','void')),
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array' and pg_column_size(lines) < 20000),
  vat_rate numeric(5,2) not null default 15 check (vat_rate between 0 and 100),
  deposit_pct integer not null default 50 check (deposit_pct between 0 and 100),
  subtotal numeric(12,2) not null default 0,
  vat numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  valid_until date,
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text,
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text check (payment_method is null or payment_method in ('moyasar','bank','cash')),
  payment_ref text check (payment_ref is null or length(payment_ref) <= 120)
);
create index if not exists project_quotes_project_idx on public.project_quotes (project_id, created_at desc);
-- الخصم: نسبة أو مبلغ على مجموع البنود، قبل الضريبة. subtotal = gross − discount
alter table public.project_quotes add column if not exists gross numeric(12,2) not null default 0;
alter table public.project_quotes add column if not exists discount_kind text check (discount_kind is null or discount_kind in ('pct','amount'));
alter table public.project_quotes add column if not exists discount_value numeric(12,2) not null default 0 check (discount_value >= 0);
alter table public.project_quotes add column if not exists discount numeric(12,2) not null default 0;
alter table public.project_quotes enable row level security;

-- سطر صالح: وصف 1–200 حرف، كمية موجبة، سعر وحدة غير سالب
create or replace function public.quote_lines_ok(p jsonb) returns boolean
language sql immutable as $$
  select jsonb_array_length(p) <= 40 and coalesce(bool_and(
    jsonb_typeof(l) = 'object'
    and length(trim(coalesce(l ->> 'label', ''))) between 1 and 200
    and jsonb_typeof(l -> 'qty') = 'number' and (l ->> 'qty')::numeric > 0 and (l ->> 'qty')::numeric <= 1000000
    and jsonb_typeof(l -> 'unit') = 'number' and (l ->> 'unit')::numeric >= 0 and (l ->> 'unit')::numeric <= 10000000
  ), true) from jsonb_array_elements(p) l
$$;
alter table public.project_quotes drop constraint if exists project_quotes_lines_ok;
alter table public.project_quotes add constraint project_quotes_lines_ok check (public.quote_lines_ok(lines));

drop policy if exists "quotes read" on public.project_quotes;
create policy "quotes read" on public.project_quotes for select to authenticated using (
  public.project_access(project_id) in ('manage','view')
  or (public.project_access(project_id) = 'client' and status <> 'draft'));
drop policy if exists "quotes write" on public.project_quotes;
create policy "quotes write" on public.project_quotes for all to authenticated
  using (public.project_access(project_id) = 'manage') with check (public.project_access(project_id) = 'manage');

-- الفريق يعدّل المسودات فقط؛ الانتقالات (إرسال/اعتماد/دفع) عبر الدوال أدناه. المجاميع تُحسب دائماً من الأسطر
create or replace function public.quote_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rpc boolean := coalesce(current_setting('app.quote_rpc', true), '') = '1';
begin
  if not rpc then
    if tg_op = 'UPDATE' and old.status <> 'draft' then raise exception 'quote_locked' using errcode = '42501'; end if;
    if new.status <> 'draft' then raise exception 'quote_locked' using errcode = '42501'; end if;
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.created_at := now();
      -- الرقم من التسلسل دائماً (لا يختاره المتصفح)
      new.ref := 'QT-' || to_char(now(), 'YY') || lpad(nextval('public.quote_seq')::text, 4, '0');
    else
      new.ref := old.ref; new.created_by := old.created_by; new.created_at := old.created_at; new.project_id := old.project_id;
    end if;
    new.sent_at := null; new.decided_at := null; new.decided_by := null; new.decision_note := null;
    new.paid_at := null; new.paid_amount := null; new.payment_method := null; new.payment_ref := null;
  end if;
  select coalesce(sum(round((l ->> 'qty')::numeric * (l ->> 'unit')::numeric, 2)), 0) into new.gross from jsonb_array_elements(new.lines) l;
  if new.discount_kind = 'pct' and new.discount_value > 100 then raise exception 'discount_pct' using errcode = '22023'; end if;
  new.discount := case new.discount_kind
    when 'pct' then round(new.gross * new.discount_value / 100, 2)
    when 'amount' then least(new.discount_value, new.gross)
    else 0 end;
  if new.discount_kind is null then new.discount_value := 0; end if;
  new.subtotal := new.gross - new.discount;
  new.vat := round(new.subtotal * new.vat_rate / 100, 2);
  new.total := new.subtotal + new.vat;
  new.deposit := round(new.total * new.deposit_pct / 100, 2);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists quote_before on public.project_quotes;
create trigger quote_before before insert or update on public.project_quotes for each row execute function public.quote_before();

create or replace function public.quote_guard_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'draft' and pg_trigger_depth() = 1 and coalesce(current_setting('app.quote_rpc', true), '') <> '1'
     and exists (select 1 from public.projects where id = old.project_id) then
    raise exception 'quote_locked' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists quote_guard_delete on public.project_quotes;
create trigger quote_guard_delete before delete on public.project_quotes for each row execute function public.quote_guard_delete();
-- لا يُحذف مشروع فيه عرض مدفوع: سجل مالي
drop policy if exists "projects delete" on public.projects;
create policy "projects delete" on public.projects for delete to authenticated
  using (public.has_perm('team.manage') and not exists (select 1 from public.project_quotes q where q.project_id = projects.id and q.status = 'paid'));

-- إرسال العرض: يلغي العروض المعلّقة السابقة، ويحدّث مرحلة الصفقة وقيمتها في CRM
create or replace function public.send_quote(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  q public.project_quotes%rowtype;
  p public.projects%rowtype;
begin
  -- القفل يمنع سباق «تعديل المسودة أثناء الإرسال» (تجاوز سقف الخصم) و«إرسالين معاً»
  select * into q from public.project_quotes where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(q.project_id) is distinct from 'manage' then raise exception 'permission_denied:projects.manage' using errcode = '42501'; end if;
  if q.status <> 'draft' then raise exception 'not_draft' using errcode = '22023'; end if;
  if jsonb_array_length(q.lines) = 0 or q.total <= 0 then raise exception 'quote_empty' using errcode = '22023'; end if;
  if q.valid_until is not null and q.valid_until < current_date then raise exception 'quote_expired' using errcode = '22023'; end if;
  -- سقف الخصم حسب دور المرسِل (من إعدادات التسعير)؛ ما فوقه يرسله المالك أو المدير
  if q.discount > 0 and q.gross > 0 and q.discount / q.gross * 100 > public.discount_cap(public.app_role()) + 0.001 then
    raise exception 'discount_over_cap' using errcode = '42501';
  end if;
  perform set_config('app.quote_rpc', '1', true);
  update public.project_quotes set status = 'void' where project_id = q.project_id and id <> q.id and status in ('sent','changes','accepted');
  update public.project_quotes set status = 'sent', sent_at = now() where id = q.id;
  perform set_config('app.quote_rpc', '', true);
  select * into p from public.projects where id = q.project_id;
  perform public.write_audit('quote.send', 'project_quote', q.id::text, q.ref || ' · ' || q.total);
  if p.contact_id is not null then
    perform public.log_activity(p.contact_id, 'project', 'أُرسل عرض السعر ' || q.ref || ' بقيمة ' || q.total || ' ر.س');
    update public.contacts set value = q.total,
      stage = case when stage in ('new','contacted','qualified') then 'proposal' else stage end
      where id = p.contact_id;
  end if;
end $$;

-- العميل: اعتماد العرض أو طلب تعديله (بملاحظة)
create or replace function public.decide_quote(p_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  q public.project_quotes%rowtype;
  p public.projects%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  -- القفل: لا يُعتمد عرض أُلغي للتو بإرسال نسخة أحدث
  select * into q from public.project_quotes where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(q.project_id) is distinct from 'client' then raise exception 'permission_denied:client_only' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'not_pending' using errcode = '22023'; end if;
  if p_decision not in ('accepted','changes') then raise exception 'bad_decision' using errcode = '22023'; end if;
  if p_decision = 'accepted' and q.valid_until is not null and q.valid_until < current_date then raise exception 'quote_expired' using errcode = '22023'; end if;
  if p_decision = 'changes' and v_note is null then raise exception 'note_required' using errcode = '22023'; end if;
  if length(coalesce(v_note, '')) > 2000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  perform set_config('app.quote_rpc', '1', true);
  update public.project_quotes set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = v_note where id = p_id;
  perform set_config('app.quote_rpc', '', true);
  if v_note is not null then
    insert into public.project_comments (project_id, body) values (q.project_id, 'ملاحظة على عرض السعر ' || q.ref || ': ' || v_note);
  end if;
  select * into p from public.projects where id = q.project_id;
  perform public.write_audit(case when p_decision = 'accepted' then 'quote.accept' else 'quote.changes' end, 'project_quote', q.id::text, q.ref);
  if p.contact_id is not null then
    perform public.log_activity(p.contact_id, 'project',
      case when p_decision = 'accepted' then 'اعتمد العميل عرض السعر ' else 'طلب العميل تعديل عرض السعر ' end || q.ref);
  end if;
end $$;

-- أثر الدفع: الصفقة «مكسوبة» والمشروع يبدأ مرحلته الثانية إن كان في الملخص
create or replace function public.quote_paid_effects(q public.project_quotes) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.projects%rowtype;
begin
  select * into p from public.projects where id = q.project_id;
  if p.stage = 'brief' then
    update public.projects set stage = (public.track_stages(p.track))[2] where id = p.id;
  end if;
  -- المواد المربوطة ببنود العرض تُحجز من المخزون للمشروع (النقص يظهر رصيداً متاحاً سالباً)
  insert into public.inventory_moves (item_id, kind, qty, project_id, quote_id, note)
    select (c ->> 'item_id')::uuid, 'reserve', (q.lines -> (ord - 1)::int ->> 'qty')::numeric * coalesce((c ->> 'per_unit')::numeric, 1), q.project_id, q.id, 'حجز تلقائي عند دفع العربون ' || q.ref
    from public.quote_costs qc, jsonb_array_elements(qc.lines) with ordinality as x(c, ord)
    where qc.quote_id = q.id and c ->> 'item_id' is not null and q.lines -> (ord - 1)::int is not null
      and exists (select 1 from public.inventory_items i where i.id = (c ->> 'item_id')::uuid);
  perform public.write_audit('quote.paid', 'project_quote', q.id::text, q.ref || ' · ' || q.paid_amount || ' · ' || q.payment_method);
  if p.contact_id is not null then
    perform public.log_activity(p.contact_id, 'payment', 'دُفع العربون ' || q.paid_amount || ' ر.س · ' || q.ref);
    update public.contacts set stage = 'won' where id = p.contact_id and stage <> 'won';
  end if;
end $$;
revoke all on function public.quote_paid_effects(public.project_quotes) from public, anon, authenticated;

-- تحويل بنكي أو نقد: يسجّله الفريق (إدارة المشاريع + رؤية المدفوعات)
create or replace function public.mark_quote_paid(p_id uuid, p_method text, p_ref text, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
declare
  q public.project_quotes%rowtype;
begin
  -- القفل: دفعة مويسر وتسجيل تحويل في اللحظة نفسها لا يُحسبان مرتين (ولا ضغطتان على الزر)
  select * into q from public.project_quotes where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(q.project_id) is distinct from 'manage' or not public.has_perm('payments.view') then
    raise exception 'permission_denied:payments' using errcode = '42501';
  end if;
  if q.status not in ('sent','accepted') then raise exception 'not_payable' using errcode = '22023'; end if;
  if p_method not in ('bank','cash') then raise exception 'bad_method' using errcode = '22023'; end if;
  -- المسجَّل لا يقل عن العربون (لا يُعلَّم العرض مدفوعاً بمبلغ رمزي) ولا يتجاوز الإجمالي
  if p_amount is null or p_amount < q.deposit or p_amount <= 0 or p_amount > q.total then raise exception 'bad_amount' using errcode = '22023'; end if;
  if length(trim(coalesce(p_ref, ''))) not between 1 and 120 then raise exception 'payment_ref' using errcode = '22023'; end if;
  perform set_config('app.quote_rpc', '1', true);
  update public.project_quotes set status = 'paid', paid_at = now(), paid_amount = round(p_amount, 2), payment_method = p_method,
    payment_ref = trim(p_ref), decided_at = coalesce(decided_at, now()) where id = p_id returning * into q;
  perform set_config('app.quote_rpc', '', true);
  perform public.quote_paid_effects(q);
end $$;

-- دفعة مويسر: تستدعيها دالة التحقق على الخادم (مفتاح الخدمة فقط) بعد مطابقة المبلغ لدى مويسر
create or replace function public.record_deposit(p_quote uuid, p_payment text, p_halalas integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  q public.project_quotes%rowtype;
begin
  select * into q from public.project_quotes where id = p_quote for update;
  if not found then return 'not_found'; end if;
  if q.status = 'paid' then return case when q.payment_ref = p_payment then 'paid' else 'already_paid' end; end if;
  if q.status <> 'accepted' then return 'not_accepted'; end if;
  if p_halalas <> round(q.deposit * 100) then return 'amount_mismatch'; end if;
  perform set_config('app.quote_rpc', '1', true);
  update public.project_quotes set status = 'paid', paid_at = now(), paid_amount = q.deposit, payment_method = 'moyasar', payment_ref = p_payment
    where id = p_quote returning * into q;
  perform set_config('app.quote_rpc', '', true);
  perform public.quote_paid_effects(q);
  return 'paid';
end $$;

revoke all on function public.send_quote(uuid) from public, anon;
grant execute on function public.send_quote(uuid) to authenticated;
revoke all on function public.decide_quote(uuid, text, text) from public, anon;
grant execute on function public.decide_quote(uuid, text, text) to authenticated;
revoke all on function public.mark_quote_paid(uuid, text, text, numeric) from public, anon;
grant execute on function public.mark_quote_paid(uuid, text, text, numeric) to authenticated;
revoke all on function public.record_deposit(uuid, text, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_deposit(uuid, text, integer) to service_role;
  end if;
end $$;

create or replace function public.item_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  acc text := public.project_access(new.project_id);
  v_thread public.project_items%rowtype;
begin
  if acc is null or acc = 'view' then raise exception 'permission_denied:projects' using errcode = '42501'; end if;
  new.created_by := auth.uid();
  new.created_at := now();
  new.decided_at := null;
  new.decided_by := null;
  new.decision_note := null;
  if acc = 'client' then
    -- العميل يرسل تصميماً للفريق فقط؛ لا يُنشئ «نسخة للاعتماد» ولا يغيّر حالة
    new.by_client := true;
    new.status := 'submitted';
    new.thread_id := new.id;
    new.version := 1;
    return new;
  end if;
  new.by_client := false;
  new.status := 'pending';
  if new.thread_id is null or new.thread_id = new.id then
    new.thread_id := new.id;
    new.version := 1;
  else
    select * into v_thread from public.project_items where id = new.thread_id and project_id = new.project_id;
    if not found then raise exception 'bad_thread' using errcode = '22023'; end if;
    -- النسخة الجديدة تُبنى على أي نسخة سابقة: السلسلة تُعرف بجذرها
    new.thread_id := coalesce(v_thread.thread_id, v_thread.id);
    new.version := (select coalesce(max(version), 0) + 1 from public.project_items where thread_id = new.thread_id);
  end if;
  return new;
end $$;
drop trigger if exists item_before_insert on public.project_items;
create trigger item_before_insert before insert on public.project_items for each row execute function public.item_before_insert();

create or replace function public.item_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects%rowtype;
begin
  select * into p from public.projects where id = new.project_id;
  if not new.by_client then
    -- النسخة الجديدة تحل محل السابقة (لا يبقى إلا قرار واحد معلّق لكل تصميم)
    update public.project_items set status = 'superseded'
      where thread_id = new.thread_id and id <> new.id and status <> 'superseded';
  end if;
  if p.contact_id is not null then
    perform public.log_activity(p.contact_id, 'project',
      case when new.by_client then 'أرسل العميل تصميماً: ' || new.title
           else 'أُرسل للاعتماد: ' || new.title || ' (نسخة ' || new.version || ')' end);
  end if;
  return new;
end $$;
drop trigger if exists item_after_insert on public.project_items;
create trigger item_after_insert after insert on public.project_items for each row execute function public.item_after_insert();

-- قرار العميل: اعتماد أو طلب تعديل (مع ملاحظة إلزامية)
create or replace function public.decide_item(p_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  it public.project_items%rowtype;
  p public.projects%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into it from public.project_items where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(it.project_id) is distinct from 'client' then raise exception 'permission_denied:client_only' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'changes') then raise exception 'bad_decision' using errcode = '22023'; end if;
  if it.status <> 'pending' then raise exception 'not_pending' using errcode = '22023'; end if;
  if p_decision = 'changes' and v_note is null then raise exception 'note_required' using errcode = '22023'; end if;
  if length(coalesce(v_note, '')) > 2000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  update public.project_items set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = v_note where id = p_id;
  if v_note is not null then
    insert into public.project_comments (project_id, item_id, body) values (it.project_id, p_id, v_note);
  end if;
  select * into p from public.projects where id = it.project_id;
  perform public.write_audit(case when p_decision = 'approved' then 'project.approve' else 'project.changes' end, 'project_item', p_id::text, it.title || ' v' || it.version);
  if p.contact_id is not null then
    perform public.log_activity(p.contact_id, 'project',
      case when p_decision = 'approved' then 'اعتمد العميل: ' else 'طلب العميل تعديلاً على: ' end || it.title || ' (نسخة ' || it.version || ')');
  end if;
end $$;
revoke all on function public.decide_item(uuid, text, text) from public, anon;
grant execute on function public.decide_item(uuid, text, text) to authenticated;

create or replace function public.comment_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  acc text := public.project_access(new.project_id);
begin
  if acc is null then raise exception 'permission_denied:projects' using errcode = '42501'; end if;
  if new.item_id is not null and not exists (select 1 from public.project_items where id = new.item_id and project_id = new.project_id) then
    raise exception 'bad_item' using errcode = '22023';
  end if;
  new.author_id := auth.uid();
  new.created_at := now();
  new.from_client := acc = 'client';
  -- الاسم يُحفظ مع التعليق: العميل لا يقرأ ملفات الفريق
  new.author_name := coalesce((select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') from public.profiles where id = auth.uid()), '');
  return new;
end $$;
drop trigger if exists comment_before_insert on public.project_comments;
create trigger comment_before_insert before insert on public.project_comments for each row execute function public.comment_before_insert();

create or replace function public.design_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.owner_id := coalesce(auth.uid(), new.owner_id);
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists design_touch on public.saved_designs;
create trigger design_touch before insert or update on public.saved_designs for each row execute function public.design_touch();

-- ملفات المشاريع: حاوية خاصة (روابط موقّعة مؤقتة)، المسار <معرّف المشروع>/<ملف>
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('projects', 'projects', false, 15728640, array['image/webp','image/jpeg','image/png','application/pdf'])
    on conflict (id) do nothing;
    execute 'drop policy if exists "projects files read" on storage.objects';
    execute 'create policy "projects files read" on storage.objects for select to authenticated using (bucket_id = ''projects'' and public.project_access(public.try_uuid((storage.foldername(name))[1])) is not null)';
    execute 'drop policy if exists "projects files write" on storage.objects';
    execute 'create policy "projects files write" on storage.objects for insert to authenticated with check (bucket_id = ''projects'' and public.project_access(public.try_uuid((storage.foldername(name))[1])) in (''manage'',''designer'',''client''))';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- إعداد أول مالك (مرة واحدة من SQL Editor بعد تسجيله في الموقع):
--   update public.profiles set role = 'owner' where email = 'you@example.com';
-- بعدها يدير المالك بقية الأدوار من /admin/team.
-- ════════════════════════════════════════════════════════════════════

-- تحديث ذاكرة PostgREST لترى الجداول والدوال الجديدة فوراً
-- ═══ الحماية من الإغراق (السبام) ════════════════════════════════════
-- عدّاد أحداث بسيط لكل «دلو» (عنوان IP، بريد، …) — لا يقرؤه أحد مباشرة، فقط دوال الخادم
create table if not exists public.rate_events (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_bucket_idx on public.rate_events (bucket, created_at desc);
alter table public.rate_events enable row level security;

-- دور الطلب الحالي (anon / authenticated / service_role) حتى داخل دوال security definer
create or replace function public.request_role() returns text
language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('role', true), 'none'),
    current_user::text)
$$;

-- عنوان الزائر من ترويسات الطلب. خادمنا (مفتاح الخدمة) يمرّر عنوان الزائر الحقيقي في x-client-ip
create or replace function public.request_ip() returns text
language plpgsql stable set search_path = public as $$
declare
  h jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v text;
begin
  if public.request_role() = 'service_role' and nullif(h ->> 'x-client-ip', '') is not null then
    v := h ->> 'x-client-ip';
  else
    -- Supabase خلف Cloudflare: cf-connecting-ip يكتبه Cloudflare ولا يزوّره الزائر؛ x-forwarded-for وx-real-ip قابلان للتزوير
    v := nullif(h ->> 'cf-connecting-ip', '');
  end if;
  return nullif(left(trim(v), 64), '');
end $$;

-- يسجّل حدثاً ويرجع false إن تجاوز الدلو حده في النافذة الزمنية
create or replace function public.rate_hit(p_bucket text, p_max integer, p_window interval) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  -- طلبان متزامنان على الدلو نفسه لا يتجاوزان الحد معاً
  perform pg_advisory_xact_lock(hashtext(p_bucket));
  if (select count(*) from public.rate_events where bucket = p_bucket and created_at > now() - p_window) >= p_max then
    return false;
  end if;
  insert into public.rate_events (bucket) values (p_bucket);
  -- تنظيف دوري خفيف للأحداث القديمة
  if random() < 0.02 then delete from public.rate_events where created_at < now() - interval '2 days'; end if;
  return true;
end $$;
revoke all on function public.rate_hit(text, integer, interval) from public, anon, authenticated;

-- حدود إرسال الطلبات: لكل عنوان، ولكل بريد، وسقف عام لكل الزوار؛
-- والتحقق البشري (Turnstile) إلزامي للزوار إن فُعّل من الإعدادات (يمر الطلب حينها عبر /api/lead)
create or replace function public.lead_flood_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.request_role();
  v_ip text := public.request_ip();
  v_email text := nullif(lower(trim(new.payload ->> 'email')), '');
begin
  if v_role = 'anon' and coalesce((select (value ->> 'captcha_required')::boolean from public.business_settings where id), false) then
    raise exception 'captcha_required' using errcode = 'P0001';
  end if;
  if v_role in ('anon', 'authenticated', 'service_role') then
    if (v_ip is not null and (not public.rate_hit('lead:ip:' || v_ip, 5, interval '10 minutes') or not public.rate_hit('lead:ipday:' || v_ip, 30, interval '1 day')))
      or (v_email is not null and not public.rate_hit('lead:email:' || v_email, 3, interval '10 minutes'))
      or (v_role <> 'service_role' and not public.rate_hit('lead:all', 200, interval '10 minutes')) then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists lead_flood_guard on public.leads;
-- الاسم يسبق lead_link أبجدياً: يُرفض الطلب قبل إنشاء أي عميل
create trigger lead_flood_guard before insert on public.leads
  for each row execute function public.lead_flood_guard();


-- ═══ التسعير والربحية والمخزون ════════════════════════════════════════

-- ─── سياسة التسعير الداخلية (لا يراها العميل): سقف الخصم لكل دور، وحد الهامش الأدنى
create table if not exists public.business_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb check (pg_column_size(value) < 8192),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.business_settings (id, value)
  values (true, '{"discount_caps":{"owner":100,"admin":100,"sales":10},"margin_floor":25}'::jsonb)
  on conflict (id) do nothing;
alter table public.business_settings enable row level security;
drop policy if exists "settings read" on public.business_settings;
create policy "settings read" on public.business_settings for select to authenticated using (public.is_staff());
drop policy if exists "settings write" on public.business_settings;
create policy "settings write" on public.business_settings for update to authenticated
  using (public.has_perm('pricing.manage')) with check (public.has_perm('pricing.manage'));

create or replace function public.settings_touch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  caps jsonb := coalesce(new.value -> 'discount_caps', '{}'::jsonb);
  floor_ numeric := coalesce((new.value ->> 'margin_floor')::numeric, 0);
begin
  if exists (select 1 from jsonb_each(caps) c where jsonb_typeof(c.value) <> 'number' or (c.value)::text::numeric not between 0 and 100) then
    raise exception 'discount_caps' using errcode = '22023';
  end if;
  if floor_ not between 0 and 100 then raise exception 'margin_floor' using errcode = '22023'; end if;
  if new.value ? 'captcha_required' and jsonb_typeof(new.value -> 'captcha_required') <> 'boolean' then raise exception 'captcha_required' using errcode = '22023'; end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  perform public.write_audit('pricing.settings', 'settings', 'business', new.value::text);
  return new;
end $$;
drop trigger if exists settings_touch on public.business_settings;
create trigger settings_touch before update on public.business_settings for each row execute function public.settings_touch();

-- أقصى نسبة خصم يرسلها هذا الدور (بلا إعداد = 0)
create or replace function public.discount_cap(p_role text) returns numeric
language sql stable security definer set search_path = public as $$
  -- سقوف الخصم سياسة داخلية: لا يقرؤها العميل
  select case when public.is_staff()
    then coalesce((select (value -> 'discount_caps' ->> p_role)::numeric from public.business_settings where id), 0) else 0 end
$$;

-- ─── المخزون: المواد، وسجل حركات للإضافة فقط يحدّث الرصيد ومتوسط التكلفة
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null default 'other' check (category in ('bottle','cap','box','label','oil','sample','packaging','other')),
  unit text not null default 'pcs' check (unit in ('pcs','ml','g','kg','l')),
  on_hand numeric(14,3) not null default 0,
  reserved numeric(14,3) not null default 0,
  avg_cost numeric(14,4) not null default 0,
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  supplier text not null default '' check (length(supplier) <= 120),
  notes text not null default '' check (length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.inventory_moves (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  kind text not null check (kind in ('receive','issue','adjust','reserve','release')),
  -- adjust يقبل السالب (جرد)، والباقي موجب
  qty numeric(14,3) not null check (qty <> 0),
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  project_id uuid references public.projects (id) on delete set null,
  quote_id uuid references public.project_quotes (id) on delete set null,
  note text not null default '' check (length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_moves_item_idx on public.inventory_moves (item_id, created_at desc);
create index if not exists inventory_moves_project_idx on public.inventory_moves (project_id);
alter table public.inventory_items enable row level security;
alter table public.inventory_moves enable row level security;
drop policy if exists "inventory read" on public.inventory_items;
create policy "inventory read" on public.inventory_items for select to authenticated using (public.has_perm('inventory.view') or public.has_perm('inventory.manage'));
drop policy if exists "inventory insert" on public.inventory_items;
create policy "inventory insert" on public.inventory_items for insert to authenticated with check (public.has_perm('inventory.manage'));
drop policy if exists "inventory update" on public.inventory_items;
create policy "inventory update" on public.inventory_items for update to authenticated using (public.has_perm('inventory.manage')) with check (public.has_perm('inventory.manage'));
drop policy if exists "moves read" on public.inventory_moves;
create policy "moves read" on public.inventory_moves for select to authenticated using (public.has_perm('inventory.view') or public.has_perm('inventory.manage'));
drop policy if exists "moves insert" on public.inventory_moves;
create policy "moves insert" on public.inventory_moves for insert to authenticated with check (public.has_perm('inventory.manage'));
-- لا تعديل ولا حذف للحركات: التصحيح بحركة «تسوية» جديدة

-- الرصيد والتكلفة لا يُكتبان مباشرة: تحسبهما الحركات
create or replace function public.inventory_item_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.sku := upper(trim(new.sku));
  if coalesce(current_setting('app.inventory_move', true), '') <> '1' then
    if tg_op = 'INSERT' then
      new.on_hand := 0; new.reserved := 0; new.avg_cost := 0;
    else
      new.on_hand := old.on_hand; new.reserved := old.reserved; new.avg_cost := old.avg_cost;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists inventory_item_guard on public.inventory_items;
create trigger inventory_item_guard before insert or update on public.inventory_items for each row execute function public.inventory_item_guard();

-- المحجوز للمشروع من مادة (حجز − فك − صرف)
create or replace function public.reserved_for(p_item uuid, p_project uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case kind when 'reserve' then qty when 'release' then -qty when 'issue' then -qty else 0 end), 0)
  from public.inventory_moves where item_id = p_item and project_id = p_project
$$;
revoke all on function public.reserved_for(uuid, uuid) from public, anon;

create or replace function public.inventory_move_apply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  it public.inventory_items%rowtype;
  held numeric;
begin
  select * into it from public.inventory_items where id = new.item_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  new.created_by := auth.uid();
  new.created_at := now();
  if new.kind <> 'adjust' and new.qty <= 0 then raise exception 'qty_positive' using errcode = '22023'; end if;
  if new.kind = 'adjust' and length(trim(new.note)) = 0 then raise exception 'note_required' using errcode = '22023'; end if;
  perform set_config('app.inventory_move', '1', true);
  if new.kind = 'receive' then
    if new.unit_cost is null then raise exception 'unit_cost_required' using errcode = '22023'; end if;
    -- متوسط مرجّح: (الرصيد × المتوسط + الوارد × تكلفته) ÷ الرصيد الجديد
    update public.inventory_items set
      avg_cost = case when greatest(on_hand, 0) + new.qty > 0 then round((greatest(on_hand, 0) * avg_cost + new.qty * new.unit_cost) / (greatest(on_hand, 0) + new.qty), 4) else new.unit_cost end,
      on_hand = on_hand + new.qty
    where id = it.id;
  elsif new.kind = 'issue' then
    if new.qty > it.on_hand then raise exception 'insufficient_stock' using errcode = '22023'; end if;
    new.unit_cost := it.avg_cost;
    held := case when new.project_id is null then 0 else greatest(public.reserved_for(it.id, new.project_id), 0) end;
    update public.inventory_items set on_hand = on_hand - new.qty, reserved = greatest(reserved - least(new.qty, held), 0) where id = it.id;
  elsif new.kind = 'reserve' then
    if new.project_id is null then raise exception 'project_required' using errcode = '22023'; end if;
    update public.inventory_items set reserved = reserved + new.qty where id = it.id;
  elsif new.kind = 'release' then
    if new.project_id is null then raise exception 'project_required' using errcode = '22023'; end if;
    if new.qty > public.reserved_for(it.id, new.project_id) then raise exception 'release_exceeds' using errcode = '22023'; end if;
    update public.inventory_items set reserved = greatest(reserved - new.qty, 0) where id = it.id;
  else
    if it.on_hand + new.qty < 0 then raise exception 'insufficient_stock' using errcode = '22023'; end if;
    new.unit_cost := it.avg_cost;
    update public.inventory_items set on_hand = on_hand + new.qty where id = it.id;
  end if;
  perform set_config('app.inventory_move', '', true);
  return new;
end $$;
drop trigger if exists inventory_move_apply on public.inventory_moves;
create trigger inventory_move_apply before insert on public.inventory_moves for each row execute function public.inventory_move_apply();

-- ─── تكلفة بنود العرض (داخلية: لا يقرؤها العميل) — بالترتيب نفسه لبنود العرض
create table if not exists public.quote_costs (
  quote_id uuid primary key references public.project_quotes (id) on delete cascade,
  -- [{unit_cost, item_id?, per_unit?}] — per_unit: كم وحدة مخزون لكل وحدة في البند (افتراضياً 1)
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array' and pg_column_size(lines) < 20000),
  extra_cost numeric(12,2) not null default 0 check (extra_cost >= 0),
  updated_at timestamptz not null default now()
);
create or replace function public.quote_cost_lines_ok(p jsonb) returns boolean
language sql immutable as $$
  select jsonb_array_length(p) <= 40 and coalesce(bool_and(
    jsonb_typeof(l) = 'object'
    and jsonb_typeof(l -> 'unit_cost') = 'number' and (l ->> 'unit_cost')::numeric between 0 and 10000000
    and (l -> 'item_id' is null or jsonb_typeof(l -> 'item_id') = 'null' or public.try_uuid(l ->> 'item_id') is not null)
    and (l -> 'per_unit' is null or jsonb_typeof(l -> 'per_unit') = 'null' or (jsonb_typeof(l -> 'per_unit') = 'number' and (l ->> 'per_unit')::numeric > 0))
  ), true) from jsonb_array_elements(p) l
$$;
alter table public.quote_costs drop constraint if exists quote_costs_lines_ok;
alter table public.quote_costs add constraint quote_costs_lines_ok check (public.quote_cost_lines_ok(lines));
alter table public.quote_costs enable row level security;
drop policy if exists "quote costs read" on public.quote_costs;
create policy "quote costs read" on public.quote_costs for select to authenticated using (
  public.project_access((select project_id from public.project_quotes where id = quote_id)) in ('manage','view'));
drop policy if exists "quote costs write" on public.quote_costs;
create policy "quote costs write" on public.quote_costs for all to authenticated
  using (public.project_access((select project_id from public.project_quotes where id = quote_id)) = 'manage')
  with check (public.project_access((select project_id from public.project_quotes where id = quote_id)) = 'manage');
-- التكلفة تُقفل مع العرض بعد إرساله (التكاليف الفعلية تُسجَّل في project_costs)
create or replace function public.quote_costs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.quote_rpc', true), '') <> '1'
     and exists (select 1 from public.project_quotes where id = coalesce(new.quote_id, old.quote_id) and status <> 'draft') then
    raise exception 'quote_locked' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists quote_costs_guard on public.quote_costs;
create trigger quote_costs_guard before insert or update or delete on public.quote_costs for each row execute function public.quote_costs_guard();

-- ─── التكاليف الفعلية للمشروع: يدوية (مصنع، مصمم، شحن…) أو تلقائية عند صرف مواد من المخزون
create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('materials','factory','design','shipping','other')),
  amount numeric(12,2) not null check (amount > 0 and amount <= 100000000),
  note text not null default '' check (length(note) <= 300),
  move_id uuid unique references public.inventory_moves (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_costs_project_idx on public.project_costs (project_id);
alter table public.project_costs enable row level security;
drop policy if exists "costs read" on public.project_costs;
create policy "costs read" on public.project_costs for select to authenticated using (public.project_access(project_id) in ('manage','view'));
drop policy if exists "costs insert" on public.project_costs;
create policy "costs insert" on public.project_costs for insert to authenticated with check (public.project_access(project_id) = 'manage' and move_id is null);
drop policy if exists "costs delete" on public.project_costs;
create policy "costs delete" on public.project_costs for delete to authenticated using (public.project_access(project_id) = 'manage' and move_id is null);
create or replace function public.project_cost_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end $$;
drop trigger if exists project_cost_touch on public.project_costs;
create trigger project_cost_touch before insert on public.project_costs for each row execute function public.project_cost_touch();

-- صرف مواد لمشروع يسجّل تكلفتها عليه بمتوسط التكلفة لحظة الصرف
create or replace function public.inventory_issue_cost() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'issue' and new.project_id is not null and round(coalesce(new.unit_cost, 0) * new.qty, 2) > 0 then
    insert into public.project_costs (project_id, kind, amount, note, move_id)
      values (new.project_id, 'materials', round(new.unit_cost * new.qty, 2),
              (select name || ' × ' || trim(to_char(new.qty, 'FM999999990.###')) from public.inventory_items where id = new.item_id), new.id);
  end if;
  return new;
end $$;
drop trigger if exists inventory_issue_cost on public.inventory_moves;
create trigger inventory_issue_cost after insert on public.inventory_moves for each row execute function public.inventory_issue_cost();

-- ─── الكوبونات (عينة الاكتشاف وما يُدفع مباشرة من الموقع)
create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{3,24}$'),
  kind text not null check (kind in ('pct','amount')),
  value numeric(12,2) not null check (value > 0),
  scope text not null default 'kit' check (scope in ('kit')),
  valid_until date,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  active boolean not null default true,
  note text not null default '' check (length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'pct' or value <= 100)
);
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.coupons (code) on delete cascade,
  payment_id text not null unique,
  amount integer not null,
  discount integer not null,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
drop policy if exists "coupons manage" on public.coupons;
create policy "coupons manage" on public.coupons for all to authenticated using (public.has_perm('pricing.manage')) with check (public.has_perm('pricing.manage'));
drop policy if exists "redemptions read" on public.coupon_redemptions;
create policy "redemptions read" on public.coupon_redemptions for select to authenticated using (public.has_perm('pricing.manage') or public.has_perm('payments.view'));
create or replace function public.coupon_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.code := upper(trim(new.code));
  if tg_op = 'INSERT' then
    new.uses := 0; new.created_by := auth.uid(); new.created_at := now();
  else
    -- الكود والاستخدامات لا تُعدَّل (عطّل الكوبون وأنشئ غيره)
    new.code := old.code; new.uses := case when coalesce(current_setting('app.coupon_redeem', true), '') = '1' then new.uses else old.uses end;
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists coupon_touch on public.coupons;
create trigger coupon_touch before insert or update on public.coupons for each row execute function public.coupon_touch();

-- السعر بعد الكوبون بالهللة (null = كوبون غير صالح). متاحة للزائر: لا تكشف إلا صلاحية الكود الذي يكتبه
-- volatile: المحاولة تُسجَّل في عداد الحد (لا يُخزَّن الناتج مؤقتاً)
create or replace function public.coupon_price(p_code text, p_scope text, p_base integer) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip text := public.request_ip();
  v_price integer;
begin
  -- تخمين الأكواد: 10 محاولات لكل عنوان كل 10 دقائق (الخادم بمفتاح الخدمة معفى)
  if public.request_role() <> 'service_role' then
    if not public.rate_hit('coupon:' || coalesce(v_ip, 'unknown'), case when v_ip is null then 60 else 10 end, interval '10 minutes') then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;
  select case c.kind
      when 'pct' then greatest(p_base - round(p_base * c.value / 100)::integer, 0)
      else greatest(p_base - round(c.value * 100)::integer, 0) end
    into v_price
  from public.coupons c
  where c.code = upper(trim(p_code)) and c.scope = p_scope and c.active
    and (c.valid_until is null or c.valid_until >= current_date)
    and (c.max_uses is null or c.uses < c.max_uses)
    and p_base > 0;
  return v_price;
end $$;

-- تسجيل الاستخدام بعد دفع متحقَّق منه (مفتاح الخدمة فقط) — مرة لكل دفعة
create or replace function public.redeem_coupon(p_code text, p_scope text, p_payment text, p_base integer, p_paid integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_price integer;
begin
  if exists (select 1 from public.coupon_redemptions where payment_id = p_payment) then return 'ok'; end if;
  -- القفل: دفعتان متزامنتان لا تتجاوزان حد الاستخدام
  perform 1 from public.coupons where code = upper(trim(p_code)) for update;
  v_price := public.coupon_price(p_code, p_scope, p_base);
  if v_price is null then return 'invalid'; end if;
  if v_price <> p_paid then return 'mismatch'; end if;
  insert into public.coupon_redemptions (code, payment_id, amount, discount) values (upper(trim(p_code)), p_payment, p_paid, p_base - p_paid);
  perform set_config('app.coupon_redeem', '1', true);
  update public.coupons set uses = uses + 1 where code = upper(trim(p_code));
  perform set_config('app.coupon_redeem', '', true);
  return 'ok';
end $$;

revoke all on function public.coupon_price(text, text, integer) from public;
grant execute on function public.coupon_price(text, text, integer) to anon, authenticated;
revoke all on function public.redeem_coupon(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.discount_cap(text) from public, anon;
grant execute on function public.discount_cap(text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.redeem_coupon(text, text, text, integer, integer) to service_role;
    grant execute on function public.coupon_price(text, text, integer) to service_role;
  end if;
end $$;

-- ═══ العقود ═══════════════════════════════════════════════════════════
-- المصنع (الفريق) يكتب العقد وملحق المواصفات (الأصناف والكميات والصور والملفات) ويرسله للعميل.
-- بعد الإرسال يُقفل النص ويُحسب له بصمة (sha256)؛ كل توقيع يُربط بالبصمة التي رآها صاحبه،
-- فلا يُوقَّع نص غير المعروض. التعديل بعد الإرسال يعيده مسودة ويمسح التوقيعات.
create sequence if not exists public.contract_seq;

-- شكل الأقسام والملحق: يُفحص في القيد نفسه فلا تدخل بيانات تالفة من أي طريق
create or replace function public.contract_shape_ok(p_sections jsonb, p_specs jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(p_sections) = 'array' and jsonb_array_length(p_sections) <= 40
    and jsonb_typeof(p_specs) = 'array' and jsonb_array_length(p_specs) <= 30
    and not exists (select 1 from jsonb_array_elements(p_sections) x
      where jsonb_typeof(x -> 'title') is distinct from 'string' or jsonb_typeof(x -> 'body') is distinct from 'string'
        or length(x ->> 'title') > 160 or length(x ->> 'body') > 6000)
    and not exists (select 1 from jsonb_array_elements(p_specs) x
      where jsonb_typeof(x -> 'name') is distinct from 'string' or length(trim(x ->> 'name')) not between 1 and 120
        or length(coalesce(x ->> 'description', '')) > 1000 or length(coalesce(x ->> 'unit', '')) > 20
        or jsonb_typeof(x -> 'qty') is distinct from 'number' or (x ->> 'qty')::numeric <= 0 or (x ->> 'qty')::numeric > 10000000
        or jsonb_typeof(coalesce(x -> 'images', '[]')) <> 'array' or jsonb_array_length(coalesce(x -> 'images', '[]')) > 8
        or jsonb_typeof(coalesce(x -> 'files', '[]')) <> 'array' or jsonb_array_length(coalesce(x -> 'files', '[]')) > 4)
$$;

create table if not exists public.project_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  quote_id uuid references public.project_quotes (id) on delete set null,
  ref text not null unique,
  status text not null default 'draft' check (status in ('draft','sent','changes','client_signed','signed','void')),
  title text not null check (length(trim(title)) between 1 and 160),
  company jsonb not null default '{}'::jsonb check (jsonb_typeof(company) = 'object' and pg_column_size(company) < 4000),
  client jsonb not null default '{}'::jsonb check (jsonb_typeof(client) = 'object' and pg_column_size(client) < 4000),
  sections jsonb not null default '[]'::jsonb,
  specs jsonb not null default '[]'::jsonb,
  content_hash text,
  sent_at timestamptz,
  change_note text check (change_note is null or length(change_note) <= 2000),
  client_signature text,
  client_signed_name text,
  client_signed_at timestamptz,
  client_signed_by uuid references public.profiles (id) on delete set null,
  client_signed_ip text,
  company_signature text,
  company_signed_name text,
  company_signed_at timestamptz,
  company_signed_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_contracts drop constraint if exists project_contracts_shape;
alter table public.project_contracts add constraint project_contracts_shape check (public.contract_shape_ok(sections, specs) and pg_column_size(sections) + pg_column_size(specs) < 400000);
create index if not exists project_contracts_project_idx on public.project_contracts (project_id, created_at desc);
alter table public.project_contracts enable row level security;

-- الفريق الذي يدير المشروع أو يراه يقرأ كل العقود؛ العميل يرى المرسلة فقط (لا المسودات)
drop policy if exists "contracts read" on public.project_contracts;
create policy "contracts read" on public.project_contracts for select to authenticated
  using (public.project_access(project_id) in ('manage','view') or (public.project_access(project_id) = 'client' and status <> 'draft'));
drop policy if exists "contracts insert" on public.project_contracts;
create policy "contracts insert" on public.project_contracts for insert to authenticated with check (public.project_access(project_id) = 'manage');
drop policy if exists "contracts update" on public.project_contracts;
create policy "contracts update" on public.project_contracts for update to authenticated
  using (public.project_access(project_id) = 'manage') with check (public.project_access(project_id) = 'manage');
drop policy if exists "contracts delete" on public.project_contracts;
create policy "contracts delete" on public.project_contracts for delete to authenticated
  using (public.project_access(project_id) = 'manage' and status = 'draft' and sent_at is null);

-- الملفات (صور، ملفات، توقيعات) من مجلد المشروع نفسه في التخزين الخاص فقط
create or replace function public.contract_files_ok(p_project uuid, p_specs jsonb) returns boolean
language sql immutable as $$
  select not exists (
    select 1 from jsonb_array_elements(p_specs) x,
      lateral (select jsonb_array_elements_text(coalesce(x -> 'images', '[]')) union all select jsonb_array_elements_text(coalesce(x -> 'files', '[]'))) f(path)
    where f.path not like 'sb:projects/' || p_project::text || '/%')
$$;

-- الكتابة المباشرة: مسودة فقط وحقول المحتوى فقط؛ الحالة والبصمة والتوقيعات تفرضها الدوال
create or replace function public.contract_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.content_hash := null; new.sent_at := null; new.change_note := null;
    new.client_signature := null; new.client_signed_name := null; new.client_signed_at := null; new.client_signed_by := null; new.client_signed_ip := null;
    new.company_signature := null; new.company_signed_name := null; new.company_signed_at := null; new.company_signed_by := null;
    new.created_by := auth.uid();
    new.created_at := now();
    -- الرقم من الخادم (التسلسل لا يُمنح للمستخدمين)
    new.ref := 'CT-' || to_char(now(), 'YY') || lpad(nextval('public.contract_seq')::text, 4, '0');
  elsif coalesce(current_setting('app.contract_rpc', true), '') <> '1' then
    if old.status not in ('draft','changes') then raise exception 'contract_locked' using errcode = '42501'; end if;
    new.id := old.id; new.project_id := old.project_id; new.ref := old.ref; new.status := old.status;
    new.content_hash := old.content_hash; new.sent_at := old.sent_at; new.change_note := old.change_note;
    new.client_signature := old.client_signature; new.client_signed_name := old.client_signed_name; new.client_signed_at := old.client_signed_at;
    new.client_signed_by := old.client_signed_by; new.client_signed_ip := old.client_signed_ip;
    new.company_signature := old.company_signature; new.company_signed_name := old.company_signed_name;
    new.company_signed_at := old.company_signed_at; new.company_signed_by := old.company_signed_by;
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  if not public.contract_files_ok(new.project_id, new.specs) then raise exception 'contract_files' using errcode = '22023'; end if;
  if new.quote_id is not null and not exists (select 1 from public.project_quotes where id = new.quote_id and project_id = new.project_id) then
    raise exception 'contract_quote' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists contract_before on public.project_contracts;
create trigger contract_before before insert or update on public.project_contracts for each row execute function public.contract_before();

create or replace function public.contract_hash(c public.project_contracts) returns text
language sql immutable as $$
  select encode(sha256(convert_to(jsonb_build_object('ref', c.ref, 'title', c.title, 'company', c.company, 'client', c.client,
    'sections', c.sections, 'specs', c.specs)::text, 'UTF8')), 'hex')
$$;

-- يُسجَّل في نقاش المشروع وسجل العميل وسجل التدقيق
create or replace function public.contract_log(c public.project_contracts, p_action text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v_contact uuid;
begin
  perform public.write_audit(p_action, 'project_contract', c.id::text, c.ref);
  select contact_id into v_contact from public.projects where id = c.project_id;
  if v_contact is not null then perform public.log_activity(v_contact, 'project', p_text); end if;
end $$;
revoke all on function public.contract_log(public.project_contracts, text, text) from public, anon, authenticated;

create or replace function public.send_contract(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.project_contracts%rowtype;
begin
  select * into c from public.project_contracts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(c.project_id) is distinct from 'manage' then raise exception 'permission_denied:projects.manage' using errcode = '42501'; end if;
  if c.status not in ('draft','changes') then raise exception 'not_draft' using errcode = '22023'; end if;
  if jsonb_array_length(c.sections) = 0 then raise exception 'contract_empty' using errcode = '22023'; end if;
  perform set_config('app.contract_rpc', '1', true);
  update public.project_contracts set status = 'sent', sent_at = now(), content_hash = public.contract_hash(c), change_note = null where id = p_id returning * into c;
  perform set_config('app.contract_rpc', '', true);
  perform public.contract_log(c, 'contract.send', 'أُرسل العقد ' || c.ref || ' للعميل');
end $$;

-- إعادة العقد المرسل للتحرير (قبل توقيع العميل): يُمسح توقيع المنشأة المسبق وتسقط البصمة
create or replace function public.reopen_contract(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.project_contracts%rowtype;
begin
  select * into c from public.project_contracts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(c.project_id) is distinct from 'manage' then raise exception 'permission_denied:projects.manage' using errcode = '42501'; end if;
  if c.status not in ('sent','changes') then raise exception 'contract_locked' using errcode = '22023'; end if;
  perform set_config('app.contract_rpc', '1', true);
  update public.project_contracts set status = 'draft', content_hash = null,
    company_signature = null, company_signed_name = null, company_signed_at = null, company_signed_by = null where id = p_id;
  perform set_config('app.contract_rpc', '', true);
end $$;

create or replace function public.contract_changes(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.project_contracts%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into c from public.project_contracts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(c.project_id) is distinct from 'client' then raise exception 'permission_denied:client_only' using errcode = '42501'; end if;
  if c.status <> 'sent' then raise exception 'not_pending' using errcode = '22023'; end if;
  if v_note is null then raise exception 'note_required' using errcode = '22023'; end if;
  if length(v_note) > 2000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  perform set_config('app.contract_rpc', '1', true);
  update public.project_contracts set status = 'changes', change_note = v_note,
    company_signature = null, company_signed_name = null, company_signed_at = null, company_signed_by = null where id = p_id returning * into c;
  perform set_config('app.contract_rpc', '', true);
  insert into public.project_comments (project_id, body) values (c.project_id, 'ملاحظة على العقد ' || c.ref || ': ' || v_note);
  perform public.contract_log(c, 'contract.changes', 'طلب العميل تعديل العقد ' || c.ref);
end $$;

-- التوقيع: العميل (على المرسل) أو المنشأة (صلاحية contracts.sign) — بصورة توقيع من مجلد المشروع وبالبصمة المعروضة
create or replace function public.sign_contract(p_id uuid, p_side text, p_signature text, p_name text, p_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c public.project_contracts%rowtype;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  select * into c from public.project_contracts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_side not in ('client','company') then raise exception 'bad_side' using errcode = '22023'; end if;
  if p_side = 'client' and public.project_access(c.project_id) is distinct from 'client' then raise exception 'permission_denied:client_only' using errcode = '42501'; end if;
  if p_side = 'company' and (public.project_access(c.project_id) is distinct from 'manage' or not public.has_perm('contracts.sign')) then
    raise exception 'permission_denied:contracts.sign' using errcode = '42501';
  end if;
  if c.status not in ('sent','client_signed') then raise exception 'not_signable' using errcode = '22023'; end if;
  if p_hash is distinct from c.content_hash then raise exception 'contract_changed' using errcode = '22023'; end if;
  if v_name is null or length(v_name) not between 2 and 120 then raise exception 'signer_name' using errcode = '22023'; end if;
  if coalesce(p_signature, '') not like 'sb:projects/' || c.project_id::text || '/%' or length(p_signature) > 300 then raise exception 'signature_file' using errcode = '22023'; end if;
  perform set_config('app.contract_rpc', '1', true);
  if p_side = 'client' then
    if c.client_signature is not null then raise exception 'already_signed' using errcode = '22023'; end if;
    update public.project_contracts set client_signature = p_signature, client_signed_name = v_name, client_signed_at = now(),
      client_signed_by = auth.uid(), client_signed_ip = public.request_ip(),
      status = case when company_signature is not null then 'signed' else 'client_signed' end
      where id = p_id returning * into c;
  else
    if c.company_signature is not null then raise exception 'already_signed' using errcode = '22023'; end if;
    update public.project_contracts set company_signature = p_signature, company_signed_name = v_name, company_signed_at = now(), company_signed_by = auth.uid(),
      status = case when client_signature is not null then 'signed' else status end
      where id = p_id returning * into c;
  end if;
  perform set_config('app.contract_rpc', '', true);
  if p_side = 'client' then
    insert into public.project_comments (project_id, body) values (c.project_id, 'وقّع العميل العقد ' || c.ref);
  end if;
  perform public.contract_log(c, 'contract.sign_' || p_side,
    case when p_side = 'client' then 'وقّع العميل العقد ' else 'وقّعت المنشأة العقد ' end || c.ref || case when c.status = 'signed' then ' — اكتمل التوقيع' else '' end);
  return c.status;
end $$;

create or replace function public.void_contract(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.project_contracts%rowtype;
begin
  select * into c from public.project_contracts where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.project_access(c.project_id) is distinct from 'manage' then raise exception 'permission_denied:projects.manage' using errcode = '42501'; end if;
  -- العقد الموقّع من الطرفين يلغيه من يملك التوقيع عن المنشأة فقط
  if c.status = 'signed' and not public.has_perm('contracts.sign') then raise exception 'permission_denied:contracts.sign' using errcode = '42501'; end if;
  if c.status = 'void' then return; end if;
  perform set_config('app.contract_rpc', '1', true);
  update public.project_contracts set status = 'void' where id = p_id returning * into c;
  perform set_config('app.contract_rpc', '', true);
  perform public.contract_log(c, 'contract.void', 'أُلغي العقد ' || c.ref);
end $$;

revoke all on function public.send_contract(uuid) from public, anon;
revoke all on function public.reopen_contract(uuid) from public, anon;
revoke all on function public.contract_changes(uuid, text) from public, anon;
revoke all on function public.sign_contract(uuid, text, text, text, text) from public, anon;
revoke all on function public.void_contract(uuid) from public, anon;
grant execute on function public.send_contract(uuid) to authenticated;
grant execute on function public.reopen_contract(uuid) to authenticated;
grant execute on function public.contract_changes(uuid, text) to authenticated;
grant execute on function public.sign_contract(uuid, text, text, text, text) to authenticated;
grant execute on function public.void_contract(uuid) to authenticated;

notify pgrst, 'reload schema';
