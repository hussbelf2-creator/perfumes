# الاختبارات

| الأمر | ماذا يختبر | يحتاج |
|---|---|---|
| `npm run test:unit` | منطق بلا متصفح: الحسابات (عروض الأسعار، الهوامش، التقارير، العلب، الحاسبة)، تنقية المحتوى والصفحات القانونية، هندسة الاستوديو، ودوال الخادم في `api/` (الدفع، الإشعارات، استقبال الطلبات) مع `fetch` مزيّف | Node 22 |
| `npm run test:db` | `supabase/schema.sql` على قاعدة فارغة: الصلاحيات وRLS لكل دور، المُشغّلات والدوال، حدود الإرسال، وقابلية إعادة تطبيق المخطط؛ ثم مطابقة حساب عروض الأسعار في المتصفح مع Postgres | PostgreSQL 16+ ومستخدم مشرف عبر `PGHOST` `PGUSER` `PGPASSWORD` |
| `npm run test:e2e` | المتصفح على الوضع التجريبي (بلا Supabase): يبني ثلاث نسخ (عادية، بمفتاح مويسر تجريبي، بدخول المدير التجريبي) ويشغّل معايناتها على 4173 و4174 و4177 | Chromium لـPlaywright (`npx playwright install chromium`) |

كلها تعمل تلقائياً في GitHub Actions مع كل دفع وطلب دمج (`.github/workflows/ci.yml`)، ومعها الفحص (`lint`) والأنواع (`tsc -b`) والبناء.

## تشغيل محلي

```bash
npm run test:unit
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
npm run test:e2e              # الكل
node tests/e2e/run.mjs quote  # ملف واحد (E2E_SKIP_BUILD=1 لتجاوز البناء)
```

لقطات الشاشة ولقطات الفشل في `tests/e2e/.out/` (وتُرفع كـartifact في CI عند الفشل).

## الاختبارات الحية (`tests/live/`) — يدوية

تختبر المنصة على Supabase حقيقي: التسجيل وتأكيد البريد، RLS عبر PostgREST، رفع الملفات للتخزين، الإشعارات، ودفع العربون عبر دالة التحقق مع مويسر وهمي. لا تعمل في CI لأنها تحتاج Supabase كاملاً.

1. شغّل Supabase محلياً (`supabase start` من Supabase CLI) وطبّق المخطط: `psql "$LIVE_DB_URL" -f supabase/schema.sql`.
2. ابنِ الموقع عليه وشغّل المعاينة على 4178:
   `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=… VITE_MOYASAR_PUBLISHABLE_KEY=pk_test_live npx vite build --outDir out-live && npx vite preview --outDir out-live --port 4178`
3. شغّل خادم التحقق الوهمي من الدفع:
   `LIVE_SERVICE_KEY=… node --import ./tests/unit/setup.mjs --import jiti/register tests/live/verify-server.ts`
4. شغّلها بالترتيب (كل ملف يبني على بيانات سابقه): `LIVE_ANON_KEY=… node tests/live/run.mjs` أو ملفاً واحداً: `node tests/live/run.mjs 3-quotes`

المتغيرات وقيمها الافتراضية في رأس `tests/live/lib.cjs`. المفاتيح هنا مفاتيح Supabase **المحلي** فقط — لا تستخدم مفاتيح الإنتاج.
