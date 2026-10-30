// فحص ربط الباك إند (Supabase): الجداول، الحماية (RLS)، الحاويات، الصلاحيات، وإعدادات الدخول.
// الاستخدام: npm run check:backend  (يقرأ .env.local إن وُجد، أو متغيرات البيئة)
//   SUPABASE_URL (أو VITE_SUPABASE_URL)، SUPABASE_ANON_KEY (أو VITE_SUPABASE_ANON_KEY)، SUPABASE_SERVICE_ROLE_KEY
// لا يغيّر بيانات حقيقية: يُدرج طلب نشرة تجريبياً ثم يحذفه بمفتاح الخدمة.

const env = (...names) => names.map((n) => process.env[n]).find(Boolean) ?? "";
const URL_ = env("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/$/, "");
const ANON = env("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
const SERVICE = env("SUPABASE_SERVICE_ROLE_KEY");

let failed = 0, warned = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m, hint) => (failed++, console.log(`  ✗ ${m}${hint ? `\n      ← ${hint}` : ""}`));
const warn = (m, hint) => (warned++, console.log(`  ! ${m}${hint ? `\n      ← ${hint}` : ""}`));
const section = (t) => console.log(`\n${t}`);

if (!URL_ || !ANON || !SERVICE) {
  console.error("يلزم SUPABASE_URL وSUPABASE_ANON_KEY وSUPABASE_SERVICE_ROLE_KEY (في .env.local أو البيئة).");
  process.exit(2);
}

const req = async (path, { key = ANON, method = "GET", body, headers = {} } = {}) => {
  try {
    const r = await fetch(`${URL_}${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ليس JSON */
    }
    return { status: r.status, json, text };
  } catch (e) {
    return { status: 0, json: null, text: String(e) };
  }
};

section("1 · الاتصال");
const health = await req("/auth/v1/health");
if (health.status === 200) ok(`خدمة الدخول تعمل (${URL_})`);
else {
  bad(`تعذّر الوصول إلى ${URL_}`, health.text.slice(0, 160));
  process.exit(1);
}
const anonKeyOk = await req("/rest/v1/packaging_models?select=id&limit=1");
if (anonKeyOk.status === 401) bad("المفتاح العام (anon) مرفوض", "انسخه من Project Settings ← API");
const svc = await req("/rest/v1/role_permissions?select=role&limit=1", { key: SERVICE });
if (svc.status === 401) bad("مفتاح الخدمة (service_role) مرفوض", "انسخه من Project Settings ← API (Secret)");

section("2 · الجداول (طُبّق supabase/schema.sql؟)");
const TABLES = ["profiles", "role_permissions", "audit_log", "contacts", "activities", "leads", "tasks", "payments", "packaging_models", "ai3d_jobs", "creatives", "creative_works", "site_content", "site_content_drafts", "site_content_versions", "projects", "project_items", "project_comments", "project_quotes", "saved_designs", "quote_costs", "project_costs", "inventory_items", "inventory_moves", "coupons", "coupon_redemptions", "business_settings", "rate_events", "project_contracts"];
const missing = [];
for (const t of TABLES) {
  const r = await req(`/rest/v1/${t}?select=*&limit=0`, { key: SERVICE });
  if (r.status !== 200) missing.push(t);
}
if (missing.length) bad(`جداول ناقصة: ${missing.join("، ")}`, "شغّل: npm run db:apply");
else ok(`الجداول الـ${TABLES.length} موجودة`);
const perms = await req("/rest/v1/role_permissions?select=role,permission", { key: SERVICE });
const n = Array.isArray(perms.json) ? perms.json.length : 0;
if (n >= 30) ok(`مصفوفة الصلاحيات محمّلة (${n} صلاحية)`);
else bad(`مصفوفة الصلاحيات ناقصة (${n})`, "أعد تشغيل npm run db:apply");
const catalogue = await req("/rest/v1/packaging_models?select=id&published=eq.true");
if (Array.isArray(catalogue.json) && catalogue.json.length) ok(`كتالوج العبوات ظاهر للزوار (${catalogue.json.length} نموذج)`);
else warn("كتالوج العبوات فارغ للزوار", "انشر نماذج من /admin/studio");

section("3 · الحماية (ما لا يجب أن يراه الزائر)");
for (const t of ["profiles", "contacts", "leads", "activities", "payments", "audit_log", "site_content_drafts", "projects", "project_items", "project_quotes", "saved_designs", "ai3d_jobs", "quote_costs", "project_costs", "inventory_items", "inventory_moves", "coupons", "coupon_redemptions", "business_settings", "rate_events", "project_contracts"]) {
  const r = await req(`/rest/v1/${t}?select=*&limit=1`);
  if (r.status === 200 && Array.isArray(r.json) && r.json.length === 0) continue;
  if (r.status === 401 || r.status === 403) continue;
  bad(`الزائر يقرأ ${t}!`, "تحقق أن RLS مفعّل — أعد npm run db:apply");
}
ok("الزائر لا يقرأ بيانات العملاء والطلبات والمدفوعات والمشاريع وعروض الأسعار والتكاليف والمخزون والكوبونات");
const hp = await req("/rest/v1/rpc/has_perm", { method: "POST", body: { p: "crm.view" } });
if (hp.status === 200 && hp.json === false) ok("دالة الصلاحيات has_perm تعمل وترفض الزائر");
else bad("دالة has_perm لا تعمل كما يجب", hp.text.slice(0, 160));
const sneak = await req("/rest/v1/site_content", { method: "POST", body: { key: "hero", value: { x: 1 } } });
if (sneak.status >= 400) ok("الزائر لا يكتب على محتوى الموقع");
else bad("الزائر استطاع الكتابة على محتوى الموقع!", "أعد npm run db:apply");
// طلب نشرة تجريبي: يصل كزائر، ثم نحذفه بمفتاح الخدمة
const marker = `check-${Date.now()}@example.invalid`;
const lead = await req("/rest/v1/leads", { method: "POST", body: { kind: "newsletter", payload: { email: marker }, page: "/check" }, headers: { prefer: "return=minimal" } });
if (lead.status === 201) ok("نماذج الموقع تصل إلى صندوق الوارد (إدراج كزائر)");
else bad("تعذّر إرسال نموذج كزائر", lead.text.slice(0, 160));
await req(`/rest/v1/leads?payload->>email=eq.${encodeURIComponent(marker)}`, { key: SERVICE, method: "DELETE" });

section("4 · حاويات الملفات");
const buckets = await req("/storage/v1/bucket", { key: SERVICE });
const B = Object.fromEntries((Array.isArray(buckets.json) ? buckets.json : []).map((b) => [b.id, b.public]));
for (const [id, pub, why] of [["models", true, "نماذج 3D"], ["portfolio", true, "صور أعمال المبدعين"], ["site", true, "صورة الواجهة"], ["projects", false, "ملفات مشاريع العملاء"]]) {
  if (!(id in B)) bad(`الحاوية ${id} غير موجودة (${why})`, "أعد npm run db:apply");
  else if (B[id] !== pub) bad(`الحاوية ${id} ${B[id] ? "عامة" : "خاصة"} والمفروض ${pub ? "عامة" : "خاصة"}`, id === "projects" ? "ملفات العملاء يجب ألا تكون عامة" : "");
  else ok(`${id}: ${pub ? "عامة" : "خاصة"} — ${why}`);
}

section("5 · الدخول والإدارة");
const settings = await req("/auth/v1/settings");
if (settings.json?.mailer_autoconfirm === true) warn("تأكيد البريد معطّل", "فعّله: Authentication ← Providers ← Email ← Confirm email (ربط المشاريع بالبريد يفترض أن صاحبه أكّده)");
else if (settings.json) ok("تأكيد البريد مفعّل");
const owners = await req("/rest/v1/profiles?select=email&role=eq.owner", { key: SERVICE });
if (Array.isArray(owners.json) && owners.json.length) ok(`يوجد مالك للمنصة (${owners.json.map((o) => o.email).join("، ")})`);
else warn("لا يوجد مالك بعد", "سجّل حسابك في الموقع ثم نفّذ في SQL Editor:\n        update public.profiles set role = 'owner' where email = 'you@example.com';");

console.log(`\n${failed ? `✗ ${failed} مشكلة` : "✓ الباك إند مربوط وسليم"}${warned ? ` · ${warned} تنبيه` : ""}\n`);
process.exit(failed ? 1 : 0);
