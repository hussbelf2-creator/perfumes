// «ابدأ مسارك» على Supabase حقيقي: الملخص قبل الحساب، والطلب يتحول لمشروع بالبريد المؤكَّد
const { chromium, B, sql, newCtx, register, login, harness, API, PUBLIC_API, ANON, VERIFY, FIX, OUT } = require('./lib.cjs');
const { execSync } = require('child_process');
const api = (path, { method = 'GET', body, token = ANON } = {}) =>
  fetch(API + path, { method, headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const tokenFor = async (email) => (await (await fetch(API + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Passw0rd!x' }) })).json()).access_token;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const { results, errors, run } = harness(OUT);
  sql(`delete from public.activities where body like 'مرحلة المشروع%'; delete from public.projects where client_email in ('hala@live.test','mallory@live.test'); delete from public.leads where kind='brief'; delete from public.contacts where email in ('hala@live.test','victim@live.test'); delete from auth.users where email in ('hala@live.test','mallory@live.test');`.replace(/\s+/g, ' '));
  const visitor = await newCtx(browser);
  const owner = await newCtx(browser);
  let projectId = '';

  await run('brief first (package preselected, flags, draft), then contact with Saudi mobile, then password-only account → project', visitor, async (p) => {
    await p.goto(B + '/services/A', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: 'اطلب هذه الباقة' }).nth(1).click();
    await p.waitForURL(/\/start\/A\?package=1$/);
    await p.getByRole('heading', { level: 1, name: 'براند عطري كامل' }).waitFor();
    if (!(await p.getByRole('radio', { name: 'التوقيع' }).isChecked())) throw new Error('package not preselected');
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByRole('alert').filter({ hasText: 'بقيت أسئلة بلا إجابة' }).waitFor();
    if ((await p.locator('fieldset[aria-invalid=true]').count()) !== 4) throw new Error('expected 4 flagged questions');
    await p.getByText('فكرة فقط', { exact: true }).click();
    await p.getByText('رجالي', { exact: true }).click();
    await p.getByText('300 – 1,000', { exact: true }).click();
    await p.getByText('1 – 3 أشهر', { exact: true }).click();
    await p.getByRole('button', { name: 'أضف تفاصيل (اختياري)' }).click();
    await p.getByLabel('اسم البراند (إن وُجد)').fill('مسك الليل');
    await p.getByLabel('أخبرنا بفكرتك').fill('عود فاخر للإهداء قبل رمضان');
    // المسودة تبقى بعد التحديث
    await p.reload({ waitUntil: 'networkidle' });
    if (!(await p.getByRole('radio', { name: 'رجالي' }).isChecked())) throw new Error('draft lost on reload');
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByRole('heading', { name: 'أين نتواصل معك؟' }).waitFor();
    if (await p.getByLabel(/كلمة المرور/).count()) throw new Error('password asked before sending');
    // الخطوة الثانية (المسودة لكل تبويب، فنكمل في الصفحة نفسها)
    await p.getByLabel('الاسم الأول').fill('هلا');
    await p.getByLabel('اسم العائلة').fill('الشمري');
    await p.getByLabel('البريد الإلكتروني').fill('Hala@Live.test');
    await p.getByLabel('الجوال (واتساب)').fill('12345');
    await p.getByRole('button', { name: 'أرسل الطلب' }).click();
    await p.getByRole('alert').filter({ hasText: 'رقم جوال سعودياً' }).waitFor();
    await p.getByLabel('الجوال (واتساب)').fill('055 123 4567');
    await p.getByRole('button', { name: 'أرسل الطلب' }).click();
    await p.getByRole('status').filter({ hasText: 'وصل طلبك يا هلا' }).waitFor({ timeout: 10000 });
    const row = sql("select concat_ws('|', l.payload->>'a_package', l.payload->>'a_audience', l.payload->>'brand', c.phone, c.source) from public.leads l join public.contacts c on c.id = l.contact_id where l.kind='brief'");
    if (row !== '1|men|مسك الليل|0551234567|brief') throw new Error('lead ' + row);
    if (sql("select count(*) from public.projects where client_email='hala@live.test'") !== '0') throw new Error('project created before account');
    // اكتمل الإرسال: تُمسح المسودة
    const left = await p.evaluate(() => sessionStorage.getItem('pp_start_A'));
    if (left) throw new Error('draft not cleared');
    // كلمة مرور فقط → حساب → المشروع
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    projectId = new URL(p.url()).pathname.split('/').pop();
    await p.getByRole('status').filter({ hasText: 'مدير مشروع يتصل بك خلال يوم عمل' }).waitFor();
    await p.getByRole('heading', { level: 1, name: 'مسك الليل' }).waitFor();
    const summary = p.locator('details').filter({ hasText: 'ملخص الطلب' });
    for (const s of ['فكرة فقط', 'رجالي', 'التوقيع', 'عود فاخر للإهداء قبل رمضان']) await summary.getByText(s).first().waitFor();
    const pr = sql(`select concat_ws('|', coalesce(owner_id::text,'none'), stage, track, client_id is not null) from public.projects where id='${projectId}'`);
    if (pr !== 'none|brief|A|t') throw new Error('project ' + pr);
    if (sql(`select project_id from public.leads where kind='brief'`) !== projectId) throw new Error('lead not marked');
  });

  await run('team sees the brief in the inbox and opens the project', owner, async (p) => {
    await login(p, 'owner@live.test');
    await p.goto(B + '/admin/inbox?tab=brief', { waitUntil: 'networkidle' });
    await p.getByText('مسك الليل').first().click();
    const dr = p.getByRole('dialog');
    for (const s of ['رجالي', '300 – 1,000', 'التوقيع']) await dr.getByText(s).first().waitFor();
    await dr.getByRole('link', { name: 'فتح المشروع' }).click();
    await p.waitForURL(new RegExp(`/admin/projects/${projectId}$`));
    await p.locator('details').filter({ hasText: 'ملخص الطلب' }).getByText('فكرة فقط').waitFor();
  });

  await run('notification deep link opens the lead; track stages in admin and for the client', owner, async (p) => {
    const leadId = sql("select id from public.leads where kind='brief' and payload->>'email'='hala@live.test'");
    await p.goto(B + '/admin/inbox?open=' + leadId, { waitUntil: 'networkidle' });
    await p.getByRole('dialog').getByText('مسك الليل').first().waitFor();
    await p.goto(B + '/admin/projects/' + projectId, { waitUntil: 'networkidle' });
    await p.getByRole('list', { name: /المرحلة الحالية: البريف والاستراتيجية/ }).waitFor();
    await p.getByRole('button', { name: 'إعدادات المشروع' }).click();
    const dr = p.getByRole('dialog');
    const opts = await dr.getByLabel('المرحلة').locator('option').allInnerTexts();
    if (opts.join('|') !== 'البريف والاستراتيجية|التركيبة والعينات|الهوية والعبوة|التصنيع والإطلاق|التسليم') throw new Error('stages ' + opts.join('|'));
    await dr.getByLabel('المرحلة').selectOption({ label: 'التركيبة والعينات' });
    await dr.getByRole('button', { name: 'حفظ' }).click();
    await p.getByRole('status').filter({ hasText: 'حُفظ المشروع' }).first().waitFor();
    if (sql(`select stage from public.projects where id='${projectId}'`) !== 'formula') throw new Error('stage not saved');
    if (sql("select count(*) from public.activities where body like '%: التركيبة والعينات'") !== '1') throw new Error('activity label');
    // المرحلة لا تخص مساراً آخر: الخادم يرفضها
    const otok = await tokenFor('owner@live.test');
    const bad = await api(`/rest/v1/projects?id=eq.${projectId}`, { method: 'PATCH', body: { stage: 'proof' }, token: otok });
    if (bad.status < 400) throw new Error('foreign stage accepted');
    const c = await visitor.newPage();
    await c.goto(B + '/account/projects/' + projectId, { waitUntil: 'networkidle' });
    await c.getByRole('list', { name: /المرحلة الحالية: التركيبة والعينات/ }).waitFor();
    await c.getByText('4 – 8 أسابيع').first().waitFor();
    await c.close();
  });

  await run('signed-in client starts a second track: no contact form, straight to the project', visitor, async (p) => {
    await p.goto(B + '/start/D', { waitUntil: 'networkidle' });
    await p.getByText('هوية كاملة', { exact: true }).click();
    await p.getByText('عصري بسيط', { exact: true }).click();
    await p.getByText('مرن', { exact: true }).click();
    await p.getByRole('radio', { name: 'لم أحدد بعد' }).last().check({ force: true });
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByText('سيُضاف الطلب إلى حسابك:').waitFor();
    if (await p.getByLabel('البريد الإلكتروني').count()) throw new Error('email asked again');
    if ((await p.getByLabel('الجوال (واتساب)').inputValue()) !== '0551234567') throw new Error('phone not prefilled');
    await p.getByRole('button', { name: 'أرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    await p.getByRole('heading', { level: 1, name: 'هوية بصرية · هلا' }).waitFor();
    if (sql("select count(*) from public.projects where client_email='hala@live.test'") !== '2') throw new Error('expected 2 projects');
  });

  await run('server rules: nobody claims another email, forged fields are reset', visitor, async () => {
    // طلب باسم الضحية من زائر
    const ins = await fetch(API + '/rest/v1/leads', { method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ kind: 'brief', payload: { track: 'A', email: 'victim@live.test', firstName: 'x' }, project_id: projectId }) });
    if (ins.status !== 201) throw new Error('anon brief insert ' + ins.status);
    if (sql("select coalesce(project_id::text,'null') from public.leads where payload->>'email'='victim@live.test'") !== 'null') throw new Error('forged project_id kept');
    // حساب آخر يطالب: لا يأخذ شيئاً
    await fetch(API + '/auth/v1/signup', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'mallory@live.test', password: 'Passw0rd!x' }) });
    const tok = await tokenFor('mallory@live.test');
    const c = await api('/rest/v1/rpc/claim_briefs', { method: 'POST', body: {}, token: tok });
    if (c.status !== 200 || c.json.length !== 0) throw new Error('claim ' + JSON.stringify(c));
    // الزائر لا يستدعي الدالة
    const anon = await api('/rest/v1/rpc/claim_briefs', { method: 'POST', body: {} });
    if (anon.status < 400) throw new Error('anon claim allowed');
    // الفريق لا يغيّر ربط الطلب بالمشروع يدوياً
    const otok = await tokenFor('owner@live.test');
    const id = sql("select id from public.leads where payload->>'email'='victim@live.test'");
    const up = await api(`/rest/v1/leads?id=eq.${id}`, { method: 'PATCH', body: { project_id: projectId }, token: otok });
    if (up.status < 400) throw new Error('staff relinked lead: ' + up.status);
    // العميل لا يغيّر مسؤول مشروعه ولا ملخصه
    const htok = await tokenFor('hala@live.test');
    const pu = await api(`/rest/v1/projects?id=eq.${projectId}`, { method: 'PATCH', body: { brief: { x: 1 } }, token: htok });
    if (pu.status === 200 && pu.json.length) throw new Error('client edited project');
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
