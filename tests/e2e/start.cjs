// «ابدأ مسارك» في الوضع التجريبي + الإنجليزية + الجوال
const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const ctxFor = async (lang = 'ar', opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_i', '1'); } } catch {} }, lang);
    await ctx.route(/readdy\.ai\/api\/form/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
    return ctx;
  };
  const run = async (name, ctx, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  const ctx = await ctxFor();

  await run('demo: start C (multi-select), send, password-only account → project with brief; inbox shows it', ctx, async (p) => {
    await p.goto(B + '/services/C', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: 'ابدأ هذا المسار' }).first().click();
    await p.waitForURL(/\/studio-3d\?track=C$/);
    // لوحة العمل أولاً: الاستوديو بشريط «أكمل الطلب» — العلبة المعروضة تُرفق بالطلب
    await p.getByRole('tab', { name: 'العلبة' }).click();
    await p.getByRole('region', { name: 'لوحة العمل' }).getByRole('button', { name: 'أكمل الطلب' }).click();
    await p.waitForURL(/\/start\/C\?from=work$/);
    await p.getByTestId('work-card').waitFor();
    await p.getByText('علبة', { exact: true }).click();
    await p.getByText('ملصق', { exact: true }).click();
    await p.getByText('50 مل', { exact: true }).click();
    await p.getByText('أكثر من 5,000', { exact: true }).click();
    await p.getByText('خلال شهر', { exact: true }).click();
    // «لم أحدد بعد» في الباقة
    await p.locator('fieldset').filter({ hasText: 'الباقة الأقرب لك' }).getByText('لم أحدد بعد').click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الاسم الأول').fill('ريم');
    await p.getByLabel('اسم العائلة').fill('القحطاني');
    await p.getByLabel('البريد الإلكتروني').fill('reem@demo.test');
    await p.getByLabel('الجوال (واتساب)').fill('+966 55 000 1111');
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي وأرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    await p.getByRole('heading', { level: 1, name: 'عبوة وتغليف · ريم' }).waitFor();
    const sum = p.locator('details').filter({ hasText: 'ملخص الطلب' });
    await sum.getByText('علبة، ملصق').waitFor();
    await sum.getByText('50 مل').waitFor();
    // تصميم الاستوديو مرفق: رابط يعيد فتحه، ونسخة محفوظة في «تصاميمي»
    const wl = await sum.getByTestId('work-link').getAttribute('href');
    if (!/^\/studio-3d/.test(wl)) throw new Error('work link ' + wl);
    await p.goto(B + '/account/designs', { waitUntil: 'networkidle' });
    await p.getByText(/عبوة وتغليف · \d{2}\/\d{2}\/\d{4}/).waitFor();
    // المشروع في القائمة الجانبية ونظرة عامة
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: /عبوة وتغليف/ }).first().waitFor();
  });

  await run('demo: same email again → "you already have an account"', ctx, async (p) => {
    // نخرج ثم نرسل طلباً جديداً بالبريد نفسه
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/start/F', { waitUntil: 'networkidle' });
    await p.getByText('ملصقات', { exact: true }).click();
    await p.getByText('جاهزة للطباعة', { exact: true }).click();
    await p.getByText('أقل من 300', { exact: true }).click();
    await p.getByText('مرن', { exact: true }).click();
    await p.locator('fieldset').filter({ hasText: 'الباقة الأقرب لك' }).locator('label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الاسم الأول').fill('ريم');
    await p.getByLabel('اسم العائلة').fill('القحطاني');
    await p.getByLabel('البريد الإلكتروني').fill('reem@demo.test');
    await p.getByLabel('الجوال (واتساب)').fill('0550001111');
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Another1!x');
    await p.getByRole('button', { name: 'أنشئ حسابي وأرسل الطلب' }).click();
    await p.getByRole('heading', { name: 'لديك حساب بهذا البريد' }).waitFor();
    // لم يُرسل طلب مكرر قبل الدخول
    const before = await p.evaluate(() => (JSON.parse(localStorage.getItem('pp_crm_v1') || '{}').leads || []).filter((l) => l.payload?.track === 'F').length);
    if (before) throw new Error('brief sent before sign-in');
    await p.getByRole('alert').getByRole('link', { name: 'تسجيل الدخول' }).click();
    await p.waitForURL(/\/auth$/);
    await p.getByRole('heading', { name: 'مرحباً بعودتك' }).waitFor();
    await p.getByLabel('البريد الإلكتروني').fill('reem@demo.test');
    await p.locator('#a-pass').fill('Passw0rd!x');
    await p.locator('form button[type=submit]').click();
    // يعود إلى خطوة الإرسال وإجاباته محفوظة
    await p.waitForURL(/\/start\/F\?resume=1$/);
    await p.getByRole('heading', { level: 1, name: 'أرسل الطلب إلى حسابك' }).waitFor();
    await p.getByRole('button', { name: 'أرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    await p.goto(B + '/account/projects', { waitUntil: 'networkidle' });
    await p.getByText('طباعة وتنفيذ').first().waitFor({ timeout: 10000 });
  });

  await run('demo: team inbox has a "Track starts" tab with readable answers', ctx, async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    const btn = p.getByRole('button', { name: /دخول كفريق المنصة/ });
    if (await btn.count()) { await btn.click(); } else throw new Error('no demo team login');
    await p.waitForURL(/\/admin/);
    await p.goto(B + '/admin/inbox?tab=brief', { waitUntil: 'networkidle' });
    await p.getByRole('tab', { name: /بدء مسار/ }).waitFor();
    await p.getByText('عبوة وتغليف').first().click();
    const dr = p.getByRole('dialog');
    await dr.getByText('علبة، ملصق').waitFor();
    await dr.getByRole('link', { name: 'فتح المشروع' }).waitFor();
  });

  await run('navbar services menu: picking a track navigates (desktop) and closes the menu', ctx, async (p) => {
    await p.goto(B + '/services/A', { waitUntil: 'networkidle' });
    await p.evaluate(() => scrollTo(0, 1800));
    await p.getByRole('navigation').first().getByRole('button', { name: 'الخدمات' }).click();
    await p.locator('header a[href="/services/D"]').first().click();
    await p.waitForURL(/\/services\/D$/);
    if (await p.locator('header a[href="/services/E"]').first().isVisible()) throw new Error('menu stayed open');
    await p.getByRole('heading', { level: 1, name: 'هوية بصرية' }).waitFor();
  });

  await run('visual identity brief: numbered cards, progress after each answer, international phone in E.164', ctx, async (p) => {
    await p.goto(B + '/start/D', { waitUntil: 'networkidle' });
    const bar = p.getByRole('progressbar');
    if ((await bar.getAttribute('aria-valuemax')) !== '7') throw new Error('expected 7 questions');
    await p.getByText('سؤال 1 من 7').waitFor();
    await p.getByText('هوية كاملة', { exact: true }).click();
    if ((await bar.getAttribute('aria-valuenow')) !== '1') throw new Error('progress not updated');
    await p.locator('#q-need[data-answered]').waitFor();
    for (const s of ['الشعار وتنويعاته', 'دليل استخدام الهوية', 'أحتاج تسمية من الصفر', 'جريء ومختلف', 'الإهداء والشركات', '3 – 6 أشهر']) await p.getByText(s, { exact: true }).click();
    await p.locator('#q-package label').first().click();
    await p.getByText(/اكتملت الإجابات/).waitFor();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الاسم الأول').fill('ريم'); await p.getByLabel('اسم العائلة').fill('المنصوري');
    await p.getByLabel('البريد الإلكتروني').fill('reem@brand.ae');
    await p.getByLabel('الدولة ورمز الاتصال').selectOption('AE');
    await p.getByLabel('الجوال (واتساب)').fill('050 123 4567');
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي وأرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    const lead = await p.evaluate(() => JSON.parse(localStorage.getItem('pp_crm_v1') || '{}').leads?.find((l) => l.payload?.email === 'reem@brand.ae')?.payload);
    if (!lead || lead.phone !== '+971501234567' || lead.country !== 'AE' || lead.a_deliverables !== 'logo,guide') throw new Error('payload ' + JSON.stringify(lead));
  });

  await run('workspaces: manufacturing starts in the calculator, formula in the composer; figures reach the project summary', ctx, async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    // E: الخدمة → الحاسبة (لوحة العمل) → أكمل الطلب → البريف ومعه الأرقام
    await p.goto(B + '/services/E', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: 'ابدأ هذا المسار' }).first().click();
    await p.waitForURL(/\/pricing\?track=E$/);
    await p.getByRole('region', { name: 'لوحة العمل' }).waitFor();
    await p.getByRole('button', { name: /^2,500/ }).click();
    await p.getByRole('button', { name: 'اطلب عرض سعر رسمي بهذه الأرقام' }).click();
    await p.waitForURL(/\/start\/E\?from=work$/);
    await p.getByTestId('work-card').getByText(/2,500 زجاجة/).waitFor();
    for (const s of ['نعم، جاهزة', 'نعم', '1,000 – 5,000', 'مرن']) await p.getByText(s, { exact: true }).first().click();
    await p.locator('#q-package label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الاسم الأول').fill('سعد'); await p.getByLabel('اسم العائلة').fill('العمري');
    await p.getByLabel('البريد الإلكتروني').fill('saad@ws.test'); await p.getByLabel('الجوال (واتساب)').fill('0557778888');
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي وأرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    const sum = p.locator('details').filter({ hasText: 'ملخص الطلب' });
    await sum.getByText(/أرقام الحاسبة/).waitFor();
    await sum.getByText(/2,500 زجاجة · قياسي/).first().waitFor();
    if (!/^\/pricing\?qty=2500/.test(await sum.getByTestId('work-link').getAttribute('href'))) throw new Error('calculator link');
    // B: المكوّن بلا سعر الأفراد ولا جلسة، والتركيبة تصل مقروءة
    await p.goto(B + '/bespoke?track=B&preset=majlis', { waitUntil: 'networkidle' });
    if (await p.getByTestId('bk-total').count()) throw new Error('personal price shown on the brand track');
    await p.getByRole('region', { name: 'لوحة العمل' }).getByRole('button', { name: 'أكمل الطلب' }).click();
    await p.waitForURL(/\/start\/B\?from=work$/);
    await p.getByTestId('work-card').getByText(/القلب: قهوة، لبان ظفاري/).waitFor();
    // عميل مسجّل: الإرسال مباشرة دون كلمة مرور
    await p.getByText('تركيبة جديدة', { exact: true }).click();
    await p.getByText('عود', { exact: true }).click();
    await p.getByText('مرن', { exact: true }).click();
    await p.locator('#q-package label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByRole('heading', { level: 1, name: 'أرسل الطلب إلى حسابك' }).waitFor();
    if (await p.locator('#st-pass').count()) throw new Error('password asked from a signed-in client');
    await p.getByRole('button', { name: 'أرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    const sum2 = p.locator('details').filter({ hasText: 'ملخص الطلب' });
    await sum2.getByText('قهوة، لبان ظفاري').first().waitFor();
    if (await sum2.getByText(/جلسة المستشار/).count()) throw new Error('consultation line on a brand formula');
  });

  await run('workspace bar fits a phone and the request completes from the studio', await ctxFor('ar', { viewport: { width: 375, height: 812 } }), async (p) => {
    await p.goto(B + '/studio-3d?track=F&tab=label', { waitUntil: 'networkidle' });
    const ov = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (await ov()) throw new Error('overflow with the workspace bar: ' + (await ov()));
    await p.getByRole('region', { name: 'لوحة العمل' }).getByRole('button', { name: 'أكمل الطلب' }).click();
    await p.waitForURL(/\/start\/F\?from=work$/);
    await p.getByTestId('work-card').waitFor();
    if (await ov()) throw new Error('overflow on the brief with the work card');
  });

  await run('demo owner: one click from sign-in to the admin as platform owner', ctx, async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /دخول كمالك المنصة/ }).click();
    await p.waitForURL(/\/admin/);
    await p.getByRole('link', { name: /الفريق/ }).first().waitFor();
  });

  await run('English start page', await ctxFor('en'), async (p) => {
    await p.goto(B + '/start/B', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { level: 1, name: 'Fragrance Development' }).waitFor();
    await p.getByText('A new formula', { exact: true }).click();
    await p.getByText('Oud', { exact: true }).click();
    await p.getByText('Musk', { exact: true }).click();
    await p.getByText('Not sure yet', { exact: true }).first().click();
    if (await p.getByRole('checkbox', { name: 'Oud' }).isChecked()) throw new Error('"not sure" should clear other picks');
    await p.getByText('Oud', { exact: true }).click();
    if (await p.getByRole('checkbox', { name: 'Not sure yet' }).isChecked()) throw new Error('a pick should clear "not sure"');
    await p.getByRole('button', { name: 'Next' }).click();
    await p.getByRole('alert').filter({ hasText: 'Some questions are unanswered' }).waitFor();
    const ar = await p.evaluate(() => /[؀-ۿ]/.test(document.querySelector('main').innerText));
    if (ar) throw new Error('Arabic text on English page');
  });

  for (const lang of ['ar', 'en']) {
    await run(`mobile ${lang}: no horizontal overflow on both steps`, await ctxFor(lang, { viewport: { width: 375, height: 812 } }), async (p) => {
      await p.goto(B + '/start/A?package=0', { waitUntil: 'networkidle' });
      const ov = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (await ov()) throw new Error('overflow step 1: ' + (await ov()));
      for (const q of await p.locator('fieldset').all()) await q.locator('label').first().click();
      await p.locator('form button[type=submit]').click();
      await p.locator('#st-phone').waitFor();
      if (await ov()) throw new Error('overflow step 2');
      await p.screenshot({ path: `${OUT}/mobile-${lang}-step2.png` });
    });
  }

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
