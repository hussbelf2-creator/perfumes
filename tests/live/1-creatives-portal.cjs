const { chromium, B, sql, newCtx, register, login, harness, API, PUBLIC_API, ANON, VERIFY, FIX, OUT } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const { results, errors, run } = harness(OUT);
  // بداية نظيفة لكل تشغيل
  sql(`delete from public.leads where contact_id in (select id from public.contacts where email='sara@brand.test');
    delete from public.contacts where email='sara@brand.test';
    delete from public.site_content_versions; delete from public.site_content_drafts; delete from public.site_content;
    delete from public.creatives where slug='salma-live';
    delete from public.projects; delete from public.saved_designs; delete from public.audit_log where action like 'project.%';
    delete from auth.users where email in ('nouf@live.test','sara2@live.test');`.replace(/\s+/g, ' '));
  const owner = await newCtx(browser);
  const visitor = await newCtx(browser);
  const client = await newCtx(browser);
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 10000 });

  await run('owner logs in', owner, async p => { await login(p, 'owner@live.test'); });

  await run('visitor message → inbox, linked to a CRM contact', visitor, async p => {
    await p.goto(B + '/contact', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم الأول').fill('سارة');
    await p.getByLabel('اسم العائلة').fill('العنزي');
    await p.getByLabel('البريد الإلكتروني').fill('sara@brand.test');
    await p.getByLabel('رسالتك').fill('أريد براند عود للرجال');
    await p.locator('form:has(#c-first) button[type=submit]').click();
    await p.waitForFunction(() => /شكراً|وصلت|تم/.test(document.body.innerText), null, { timeout: 10000 });
    if (sql("select count(*) from public.leads l join public.contacts c on c.id=l.contact_id where c.email='sara@brand.test'") !== '1') throw new Error('lead not linked');
    const q = await owner.newPage();
    await q.goto(B + '/admin/inbox', { waitUntil: 'networkidle' });
    await q.getByText('سارة العنزي').first().waitFor({ timeout: 10000 });
    await q.close();
  });

  await run('CMS: draft private, publish reaches visitors', owner, async p => {
    await p.goto(B + '/admin/cms?doc=hero', { waitUntil: 'networkidle' });
    await p.getByTestId('cms-status').waitFor();
    await p.getByLabel('العنوان · السطر الأول · عربي').fill('عطرك من قاعدة البيانات،');
    await p.getByRole('button', { name: 'حفظ كمسودة' }).click();
    await toast(p, /حُفظت المسودة/);
    const v = await visitor.newPage();
    await v.goto(B + '/', { waitUntil: 'networkidle' });
    if ((await v.locator('h1').first().innerText()).includes('قاعدة البيانات')) throw new Error('draft leaked');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    await v.reload({ waitUntil: 'networkidle' });
    await v.waitForFunction(() => document.querySelector('h1').innerText.includes('قاعدة البيانات'), null, { timeout: 10000 });
    await v.close();
    if (sql("select count(*) from public.site_content_versions where key='hero'") !== '1') throw new Error('version not stored');
  });

  await run('creatives: profile + uploaded work (public storage) visible to visitors', owner, async p => {
    await p.goto(B + '/admin/creatives/new', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم · عربي').fill('سلمى · خط عربي');
    await p.getByLabel('الاسم · إنجليزي').fill('Salma Live');
    await p.getByRole('group', { name: 'التخصصات' }).getByRole('button', { name: 'هوية بصرية' }).click();
    await p.getByRole('switch', { name: 'منشور في الموقع' }).check();
    await p.getByRole('button', { name: 'إنشاء الملف' }).click();
    await toast(p, /أُضيف المصمم/);
    await p.waitForURL(/\/admin\/creatives\/[0-9a-f-]{36}$/);
    await p.getByRole('button', { name: 'عمل جديد' }).click();
    const dr = p.getByRole('dialog');
    await dr.getByLabel('صور العمل').setInputFiles(`${FIX}/work.png`);
    await dr.getByRole('list', { name: 'الصور المرفوعة' }).locator('li').first().waitFor({ timeout: 15000 });
    await dr.getByLabel('العنوان · عربي').fill('شعار «حبر»');
    await dr.getByRole('button', { name: 'إضافة العمل' }).click();
    await toast(p, /أُضيف العمل/);
    const img = sql("select images[1] from public.creative_works where title_ar='شعار «حبر»'");
    if (!img.startsWith(PUBLIC_API + '/storage/v1/object/public/portfolio/works/')) throw new Error('image url ' + img);
    const v = await visitor.newPage();
    await v.goto(B + '/creatives/salma-live', { waitUntil: 'networkidle' });
    await v.getByRole('button', { name: /عرض «شعار «حبر»»/ }).click();
    await v.waitForFunction(() => { const i = document.querySelector('[role=dialog] img'); return i && i.complete && i.naturalWidth === 1600; }, null, { timeout: 10000 });
    await v.close();
  });

  let projectPath = '';
  await run('projects: owner sends a design to a not-yet-registered client', owner, async p => {
    await p.goto(B + '/admin/projects?new=1', { waitUntil: 'networkidle' });
    const dlg = p.getByRole('dialog');
    await dlg.getByLabel('اسم المشروع').fill('براند «مسك الليل»');
    await dlg.getByLabel('بريد العميل').fill('Nouf@Live.test');
    await dlg.getByRole('button', { name: 'إنشاء المشروع' }).click();
    await toast(p, /أُنشئ المشروع/);
    await p.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}$/);
    projectPath = new URL(p.url()).pathname;
    await p.getByText('يُربط عند تسجيل العميل بهذا البريد').waitFor();
    await p.getByLabel('العنوان').fill('الملصق الأمامي');
    await p.getByLabel('ملفات التصميم').setInputFiles([`${FIX}/work.png`, `${FIX}/brief.pdf`]);
    await p.getByRole('list', { name: 'الملفات المرفوعة' }).locator('li').nth(1).waitFor({ timeout: 15000 });
    await p.getByRole('button', { name: 'أرسل للعميل' }).click();
    await toast(p, /أُرسل التصميم للعميل/);
    const files = sql("select array_to_string(files, ' ') from public.project_items where title='الملصق الأمامي'");
    if (!/^sb:projects\/[0-9a-f-]{36}\/\S+\.webp sb:projects\/[0-9a-f-]{36}\/\S+\.pdf$/.test(files)) throw new Error('files ' + files);
    // الحاوية خاصة: لا رابط عام
    const path = files.split(' ')[0].slice('sb:projects/'.length);
    const res = await p.request.get(`${PUBLIC_API}/storage/v1/object/public/projects/${path}`);
    if (res.status() < 400) throw new Error('private file reachable publicly: ' + res.status());
    // تظهر الصورة للفريق عبر رابط موقّع
    await p.waitForFunction(() => [...document.querySelectorAll('article img')].some((i) => i.complete && i.naturalWidth > 0 && i.src.includes('/object/sign/projects/')), null, { timeout: 10000 });
  });

  await run('client signs up with that email, sees the project, approves, comments', client, async p => {
    await register(p, 'نوف', 'العتيبي', 'nouf@live.test');
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'اعتمد «الملصق الأمامي»' }).waitFor({ timeout: 10000 });
    await p.goto(B + projectPath.replace('/admin/', '/account/'), { waitUntil: 'networkidle' });
    const card = p.locator('article').filter({ hasText: 'الملصق الأمامي' });
    await p.waitForFunction(() => [...document.querySelectorAll('article img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
    await card.getByRole('button', { name: 'طلب تعديل' }).click();
    await card.getByLabel('ما الذي تريد تعديله؟').fill('الاسم أكبر قليلاً');
    await card.getByRole('button', { name: 'أرسل طلب التعديل' }).click();
    await toast(p, /وصل طلبك/);
    await p.getByLabel('رسالة جديدة').fill('ومتى العينات؟');
    await p.getByRole('button', { name: 'إرسال' }).click();
    await p.getByRole('list', { name: 'الرسائل' }).getByText('ومتى العينات؟').waitFor({ timeout: 10000 });
    if (sql("select status from public.project_items where title='الملصق الأمامي'") !== 'changes') throw new Error('decision not stored');
    if (sql("select count(*) from public.audit_log where action='project.changes'") !== '1') throw new Error('not audited');
  });

  await run('owner sends v2; client approves; history and names', owner, async p => {
    await p.goto(B + projectPath, { waitUntil: 'networkidle' });
    await p.getByRole('list', { name: 'الرسائل' }).getByText('ومتى العينات؟').waitFor({ timeout: 10000 });
    await p.getByText(/نوف العتيبي/).first().waitFor();
    await p.getByRole('button', { name: 'أرسل نسخة معدّلة' }).click();
    await p.getByLabel('ملفات التصميم').setInputFiles([`${FIX}/face.jpg`]);
    await p.getByRole('list', { name: 'الملفات المرفوعة' }).locator('li').first().waitFor({ timeout: 15000 });
    await p.getByRole('button', { name: 'أرسل للعميل' }).click();
    await toast(p, /أُرسلت النسخة الجديدة/);
    const c = await client.newPage();
    await c.goto(B + projectPath.replace('/admin/', '/account/'), { waitUntil: 'networkidle' });
    const card = c.locator('article').filter({ hasText: 'الملصق الأمامي' });
    await card.getByText(/النسخة 2/).first().waitFor({ timeout: 10000 });
    c.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'اعتماد' }).click();
    await c.getByRole('status').filter({ hasText: /اعتُمد التصميم/ }).first().waitFor({ timeout: 10000 });
    await c.close();
    if (sql("select string_agg(version||':'||status, ',' order by version) from public.project_items where title='الملصق الأمامي'") !== '1:superseded,2:approved') throw new Error('versions ' + sql("select string_agg(version||':'||status, ',' order by version) from public.project_items"));
  });

  await run('studio: catalogue from DB, client saves a design to the account', client, async p => {
    await p.goto(B + '/studio-3d', { waitUntil: 'networkidle' });
    await p.getByRole('radiogroup', { name: 'شكل العبوة' }).getByRole('radio').first().waitFor({ timeout: 15000 });
    await p.waitForSelector('[role=img] canvas', { timeout: 30000 });
    await p.waitForTimeout(1500);
    p.once('dialog', (d) => d.accept('تصميمي الأول'));
    await p.getByRole('button', { name: 'احفظ في حسابي' }).click();
    await p.getByRole('status').filter({ hasText: /حُفظ التصميم في حسابك/ }).waitFor({ timeout: 10000 });
    if (sql("select count(*) from public.saved_designs d join public.profiles p on p.id=d.owner_id where p.email='nouf@live.test' and d.thumb like 'data:image/%'") !== '1') throw new Error('design not saved with thumb');
    await p.goto(B + '/account/designs', { waitUntil: 'networkidle' });
    await p.getByText('تصميمي الأول').waitFor({ timeout: 10000 });
  });

  await run('isolation: another client sees nothing of Nouf', await newCtx(browser), async p => {
    await register(p, 'سارة', 'العنزي', 'sara2@live.test');
    await p.goto(B + projectPath.replace('/admin/', '/account/'), { waitUntil: 'networkidle' });
    await p.getByText('لم نجد هذا المشروع في حسابك').waitFor({ timeout: 10000 });
    await p.goto(B + '/account/designs', { waitUntil: 'networkidle' });
    await p.getByText('لا تصاميم محفوظة').waitFor({ timeout: 10000 });
    await p.goto(B + '/admin', { waitUntil: 'networkidle' });
    if (new URL(p.url()).pathname.startsWith('/admin')) throw new Error('client reached admin');
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
