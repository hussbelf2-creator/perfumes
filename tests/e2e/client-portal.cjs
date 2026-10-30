const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
const D = FIX;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [], errors = [];
  const mk = async (opts = {}, lang = 'ar') => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_i', '1'); } } catch {} }, lang);
    await ctx.route(/readdy\.ai\/api\/search-image/, (r) => r.fulfill({ path: `${D}/face.jpg`, contentType: 'image/jpeg' }));
    return ctx;
  };
  const run = async (name, ctx, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 8000 });
  const staff = async (p, role) => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    if (!p.url().includes('/auth')) { await p.evaluate(() => localStorage.removeItem('pp_session_email')); await p.goto(B + '/auth', { waitUntil: 'networkidle' }); }
    await p.getByLabel(/الدور التجريبي/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin$/);
  };
  const client = async (p, path = '/account') => {
    await p.evaluate(() => localStorage.removeItem('pp_session_email')).catch(() => {});
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle', });
    await p.getByRole('button', { name: /دخول كعميل تجريبي/ }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'));
    await p.goto(B + path, { waitUntil: 'networkidle' });
  };

  const ctx = await mk();
  let projectUrl = '';
  await run('client before any project: honest empty state, legacy pages redirect', ctx, async p => {
    await client(p);
    await p.getByText('لا مشاريع في حسابك بعد').waitFor();
    if (await p.getByText('بيانات نموذجية').count()) throw new Error('sample-data banner still shown');
    for (const legacy of ['/account/invoices', '/account/messages', '/account/settings', '/dashboard/approvals']) {
      await p.goto(B + legacy, { waitUntil: 'networkidle' });
      if (!/\/account(\/projects|\/approvals)?$/.test(new URL(p.url()).pathname)) throw new Error(legacy + ' → ' + p.url());
    }
  });

  await run('sales opens a project from the CRM and sends the first design', ctx, async p => {
    await staff(p, 'sales');
    await p.goto(B + '/admin/contacts', { waitUntil: 'networkidle' });
    await p.locator('a[href^="/admin/contacts/C-"]').first().click();
    await p.getByRole('link', { name: 'مشروع جديد' }).click();
    await p.waitForURL(/\/admin\/projects\?new=1&contact=/);
    const dlg = p.getByRole('dialog');
    await dlg.getByLabel('اسم المشروع').fill('براند «مسك الليل»');
    if (!(await dlg.getByLabel('بريد العميل').inputValue())) throw new Error('email not prefilled from CRM');
    await dlg.getByLabel('بريد العميل').fill('client@demo.local');
    await dlg.getByLabel('المصمم المسند').selectOption({ label: 'نورة الدوسري' });
    await dlg.getByRole('button', { name: 'إنشاء المشروع' }).click();
    await toast(p, /أُنشئ المشروع/);
    await p.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}$/);
    projectUrl = new URL(p.url()).pathname;
    await p.getByLabel('العنوان').fill('الملصق الأمامي');
    await p.getByLabel('ملفات التصميم').setInputFiles([`${D}/work.png`, `${D}/brief.pdf`]);
    await p.getByRole('list', { name: 'الملفات المرفوعة' }).locator('li').nth(1).waitFor({ timeout: 10000 });
    await p.getByLabel('ملاحظة للعميل (اختياري)').fill('نسخة أولى بخط أميري وفويل ذهبي');
    await p.getByRole('button', { name: 'أرسل للعميل' }).click();
    await toast(p, /أُرسل التصميم للعميل/);
    await p.getByText('بانتظار العميل').first().waitFor();
    // نشاط على ملف العميل؟ (الـCRM التجريبي منفصل: نكتفي بوجود الرابط)
    await p.getByRole('link', { name: 'ملف العميل في الـCRM' }).waitFor();
  });

  await run('designer sees only assigned projects and uploads; production views read-only', ctx, async p => {
    await staff(p, 'sales');
    await p.goto(B + '/admin/projects?new=1', { waitUntil: 'networkidle' });
    const dlg = p.getByRole('dialog');
    await dlg.getByLabel('اسم المشروع').fill('مشروع لا يخص المصمم');
    await dlg.getByLabel('بريد العميل').fill('other@brand.sa');
    await dlg.getByRole('button', { name: 'إنشاء المشروع' }).click();
    await toast(p, /أُنشئ المشروع/);
    await staff(p, 'designer');
    await p.getByRole('link', { name: 'مشاريع العملاء' }).click();
    const cards = p.locator('main a[href^="/admin/projects/"]');
    await cards.first().waitFor();
    if (await cards.count() !== 1) throw new Error('designer sees ' + await cards.count());
    await cards.first().click();
    if (await p.getByRole('button', { name: 'إعدادات المشروع' }).count()) throw new Error('designer can edit settings');
    await p.getByLabel('النوع').selectOption({ label: 'علبة' });
    await p.getByLabel('العنوان').fill('العلبة المغناطيسية');
    await p.getByLabel('ملفات التصميم').setInputFiles([`${D}/face.jpg`]);
    await p.getByRole('list', { name: 'الملفات المرفوعة' }).locator('li').first().waitFor({ timeout: 10000 });
    await p.getByRole('button', { name: 'أرسل للعميل' }).click();
    await toast(p, /أُرسل التصميم للعميل/);
    await staff(p, 'production');
    await p.goto(B + '/admin/projects', { waitUntil: 'networkidle' });
    if (await p.locator('main a[href^="/admin/projects/"]').count() !== 2) throw new Error('production should see all');
    await p.goto(B + projectUrl, { waitUntil: 'networkidle' });
    await p.getByText('الملصق الأمامي').waitFor();
    if (await p.getByRole('button', { name: 'أرسل للعميل' }).count()) throw new Error('production can upload');
    await staff(p, 'editor');
    await p.goto(B + '/admin/projects', { waitUntil: 'networkidle' });
    await p.getByText('ليست لديك صلاحية لهذه الصفحة').waitFor();
    if (await p.getByRole('link', { name: 'مشاريع العملاء' }).count()) throw new Error('editor sees nav');
  });

  await run('client reviews: viewer, change request needs a note, approve', ctx, async p => {
    await client(p);
    const badge = p.getByRole('navigation', { name: 'حسابي' }).getByRole('link', { name: /بانتظار اعتمادي/ });
    if (!/2|٢/.test(await badge.innerText())) throw new Error('badge ' + await badge.innerText());
    await p.getByRole('heading', { name: /^اعتمد «/ }).waitFor();
    await p.getByRole('link', { name: /الملصق الأمامي/ }).click();
    await p.getByRole('heading', { level: 1, name: 'براند «مسك الليل»' }).waitFor();
    const card = p.locator('article').filter({ hasText: 'الملصق الأمامي' });
    await card.getByText('نسخة أولى بخط أميري وفويل ذهبي').waitFor();
    // العارض
    await card.getByRole('button', { name: 'تكبير الصورة 1' }).click();
    const viewer = p.getByRole('dialog');
    await p.waitForFunction(() => { const i = document.querySelector('[role=dialog] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    await p.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });
    if (!(await card.getByRole('button', { name: 'فتح PDF' }).count())) throw new Error('pdf tile');
    await card.getByRole('button', { name: 'طلب تعديل' }).click();
    const send = card.getByRole('button', { name: 'أرسل طلب التعديل' });
    if (!(await send.isDisabled())) throw new Error('empty note allowed');
    await card.getByLabel('ما الذي تريد تعديله؟').fill('نريد اسم العطر أكبر قليلاً');
    await send.click();
    await toast(p, /وصل طلبك للفريق/);
    await card.getByText('مطلوب تعديل').waitFor();
    const box = p.locator('article').filter({ hasText: 'العلبة المغناطيسية' });
    p.once('dialog', (d) => d.accept());
    await box.getByRole('button', { name: 'اعتماد' }).click();
    await toast(p, /اعتُمد التصميم/);
    await box.getByText('معتمد').first().waitFor();
    if (await p.getByRole('navigation', { name: 'حسابي' }).getByRole('link', { name: /بانتظار اعتمادي/ }).locator('span[aria-label]').count()) throw new Error('badge should be gone');
    // الملاحظة صارت رسالة في النقاش
    await p.getByRole('list', { name: 'الرسائل' }).getByText('نريد اسم العطر أكبر قليلاً').waitFor();
    await p.getByLabel('رسالة جديدة').fill('ومتى تصل العينات؟');
    await p.getByRole('button', { name: 'إرسال' }).click();
    await p.getByRole('list', { name: 'الرسائل' }).getByText('ومتى تصل العينات؟').waitFor();
  });

  await run('team sees the change request, sends v2; client approves v2 with history', ctx, async p => {
    await staff(p, 'designer');
    const nav = p.getByRole('link', { name: /مشاريع العملاء/ });
    await p.waitForFunction(() => [...document.querySelectorAll('nav a')].some(a => a.textContent.includes('مشاريع العملاء') && /\d|[٠-٩]/.test(a.textContent)), null, { timeout: 8000 });
    await nav.click();
    await p.getByText(/1 طلب تعديل|١ طلب تعديل/).waitFor();
    await p.goto(B + projectUrl, { waitUntil: 'networkidle' });
    await p.getByText('«نريد اسم العطر أكبر قليلاً»').first().waitFor();
    await p.getByRole('list', { name: 'الرسائل' }).getByText('ومتى تصل العينات؟').waitFor();
    await p.getByRole('button', { name: 'أرسل نسخة معدّلة' }).click();
    await p.getByText(/ستكون النسخة 2|ستكون النسخة ٢/).waitFor();
    await p.getByLabel('ملفات التصميم').setInputFiles([`${D}/face.jpg`]);
    await p.getByRole('list', { name: 'الملفات المرفوعة' }).locator('li').first().waitFor({ timeout: 10000 });
    await p.getByLabel('ملاحظة للعميل (اختياري)').fill('كبّرنا الاسم 20%');
    await p.getByRole('button', { name: 'أرسل للعميل' }).click();
    await toast(p, /أُرسلت النسخة الجديدة/);
    await p.getByLabel('رسالة جديدة').fill('العينات تصل الأحد القادم');
    await p.getByRole('button', { name: 'إرسال' }).click();
    await p.getByRole('list', { name: 'الرسائل' }).getByText('العينات تصل الأحد القادم').waitFor();
    await client(p, projectUrl.replace('/admin/', '/account/'));
    const card = p.locator('article').filter({ hasText: 'الملصق الأمامي' });
    await card.getByText(/النسخة 2|النسخة ٢/).first().waitFor();
    await card.getByText('كبّرنا الاسم 20%').waitFor();
    await card.getByRole('button', { name: /النسخ السابقة/ }).click();
    await card.getByText('«نريد اسم العطر أكبر قليلاً»').waitFor();
    p.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'اعتماد' }).click();
    await toast(p, /اعتُمد التصميم/);
    const msgs = await p.getByRole('list', { name: 'الرسائل' }).innerText();
    if (!/فريق المنصة/.test(msgs) || !/العينات تصل الأحد القادم/.test(msgs)) throw new Error('team message not shown to client');
  });

  await run('studio: save to account, reopen restores label & box, send to project', ctx, async p => {
    await client(p, '/studio-3d?tab=box');
    await p.getByRole('radio', { name: /علبة مغناطيسية/ }).click();
    await p.getByLabel('اسم الدار', { exact: true }).fill('Dar Musk');
    await p.waitForSelector('[role=img][aria-busy=false] canvas', { timeout: 30000 });
    await p.waitForTimeout(800);
    p.once('dialog', (d) => d.accept('علبة مسك الليل'));
    await p.getByRole('button', { name: 'احفظ في حسابي' }).click();
    await toast(p, /حُفظ التصميم في حسابك/);
    // نغيّر محلياً ثم نفتح المحفوظ: يجب أن يعود كما حُفظ
    await p.getByLabel('اسم الدار', { exact: true }).fill('Changed');
    await p.waitForTimeout(600);
    await p.getByRole('status').getByRole('link', { name: 'تصاميمي' }).click();
    await p.waitForURL(/\/account\/designs$/);
    const card = p.locator('li').filter({ hasText: 'علبة مسك الليل' });
    await card.locator('img').waitFor({ timeout: 8000 }).catch(() => { throw new Error('no thumbnail'); });
    await card.getByRole('link', { name: 'فتح في الاستوديو' }).click();
    await p.waitForURL(/\/studio-3d/);
    await p.waitForFunction(() => !location.search.includes('design='), null, { timeout: 8000 });
    await p.getByRole('radio', { name: /علبة مغناطيسية/ }).and(p.locator('[aria-checked=true]')).waitFor({ timeout: 8000 });
    if (await p.getByLabel('اسم الدار', { exact: true }).inputValue() !== 'Dar Musk') throw new Error('box not restored');
    await p.goto(B + projectUrl.replace('/admin/', '/account/'), { waitUntil: 'networkidle' });
    const sel = p.getByLabel('التصميم', { exact: true });
    await sel.waitFor();
    console.log('OPTIONS', await sel.locator('option').allInnerTexts(), await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('pp_projects_v1')).designs.map(d => [d.name, d.ownerId]))), await p.evaluate(() => localStorage.getItem('pp_session_email')));
    await sel.selectOption({ label: 'علبة مسك الليل' });
    await p.getByLabel('النوع', { exact: true }).selectOption({ label: 'علبة' });
    await p.getByRole('button', { name: 'أرسل للفريق' }).click();
    await toast(p, /أُرسل التصميم للفريق/);
    await p.locator('article').filter({ hasText: 'علبة مسك الليل' }).getByText('أرسله العميل').waitFor();
    await staff(p, 'sales');
    await p.goto(B + projectUrl, { waitUntil: 'networkidle' });
    const a = p.locator('article').filter({ hasText: 'علبة مسك الليل' });
    await a.getByRole('link', { name: /فتح التصميم في استوديو 3D/ }).waitFor();
  });

  await run('another client sees nothing; anonymous save asks to sign in', ctx, async p => {
    await p.goto(B + '/auth?mode=register', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth?mode=register', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم الأول').fill('سارة');
    await p.getByLabel('اسم العائلة').fill('العنزي');
    await p.getByLabel('البريد الإلكتروني').fill('sara@other.sa');
    await p.locator('#a-pass').fill('Passw0rd!x');
    await p.getByRole('radio').first().click();
    await p.getByRole('button', { name: /إنشاء الحساب|أنشئ حسابك|إنشاء حساب/ }).last().click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 8000 });
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByText('لا مشاريع في حسابك بعد').waitFor();
    await p.goto(B + projectUrl.replace('/admin/', '/account/'), { waitUntil: 'networkidle' });
    await p.getByText('لم نجد هذا المشروع في حسابك').waitFor();
    await p.goto(B + '/account/designs', { waitUntil: 'networkidle' });
    await p.getByText('لا تصاميم محفوظة').waitFor();
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/studio-3d', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'سجّل الدخول للحفظ' }).click();
    await p.waitForURL(/\/auth/);
  });

  const mob = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await run('mobile account pages', mob, async p => {
    // نسخة بيانات من السياق الأول
    const store = await (async () => { const q = await ctx.newPage(); await q.goto(B + '/', { waitUntil: 'domcontentloaded' }); const v = await q.evaluate(() => localStorage.getItem('pp_projects_v1')); await q.close(); return v; })();
    await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
    await p.evaluate((v) => localStorage.setItem('pp_projects_v1', v), store);
    await client(p);
    for (const path of ['/account', '/account/projects', projectUrl.replace('/admin/', '/account/'), '/account/approvals', '/account/designs']) {
      await p.goto(B + path, { waitUntil: 'networkidle' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) throw new Error(path + ' overflow ' + ov);
    }
    await p.goto(B + projectUrl.replace('/admin/', '/account/'), { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${OUT}/mobile-project.png`, fullPage: true });
  });

  const en = await mk({}, 'ar');
  await run('English client pages', en, async p => {
    await client(p);
    await p.evaluate(() => localStorage.setItem('pp_lang', 'en'));
    await p.reload({ waitUntil: 'networkidle' });
    await p.getByText('No projects in your account yet').waitFor();
    await p.getByRole('link', { name: 'My designs' }).waitFor();
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
