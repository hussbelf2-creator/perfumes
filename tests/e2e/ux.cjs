// تجربة المستخدم على طريقة بوابات الدفع: ثقة تحت الهيرو، أسعار شفافة، قائمة تفعيل في اللوحة، تنقل مبسّط
const { chromium, OUT, url } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const run = async (name, fn, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.route(/readdy\.ai\/api\/form/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await ctx.close();
  };

  await run('home: primary CTA goes to the tracks, trust strip and no-surprise pricing are present', async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.getByText('بلا رسوم تأسيس · عرض سعر مفصّل قبل أي دفع').waitFor();
    const trust = p.getByRole('region', { name: 'لماذا تثق بنا' });
    await trust.getByText('دفع آمن عبر مويسر').waitFor();
    await trust.getByText('ابدأ خلال دقائق').waitFor();
    await p.getByRole('heading', { name: 'أسعار بلا مفاجآت.' }).waitFor();
    await p.getByText('رسوم تأسيس أو اشتراك').waitFor();
    await p.getByText('15٪ تظهر سطراً مستقلاً في كل عرض').waitFor();
    await p.getByRole('link', { name: 'ابدأ مشروعك' }).first().click();
    await p.waitForURL(/\/services$/);
  });

  await run('navbar: tools first (studio, pricing), concepts and FAQ moved into the services panel', async (p) => {
    await p.goto(B + '/about', { waitUntil: 'networkidle' });
    const nav = p.getByRole('navigation', { name: 'القائمة الرئيسية' });
    await nav.getByRole('link', { name: 'الاستوديو' }).waitFor();
    await nav.getByRole('link', { name: 'الأسعار' }).waitFor();
    if (await nav.getByRole('link', { name: 'النماذج' }).count()) throw new Error('concepts still in the top bar');
    await nav.getByRole('button', { name: 'الخدمات' }).click();
    await p.locator('header').getByRole('link', { name: 'الأسئلة الشائعة' }).click();
    await p.waitForURL(/\/faq$/);
  });

  await run('dashboard: activation checklist ticks as the client progresses', async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth?mode=register', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم الأول').fill('نوف'); await p.getByLabel('اسم العائلة').fill('الحربي');
    await p.getByLabel('البريد الإلكتروني').fill('nouf@ux.test');
    await p.locator('#a-pass').fill('Passw0rd!x');
    await p.locator('form button[type=submit]').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'));
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    const gs = p.getByTestId('getting-started');
    await gs.getByRole('heading', { name: '1 من 5 خطوات مكتملة' }).waitFor();
    if ((await gs.getByRole('progressbar').getAttribute('aria-valuenow')) !== '1') throw new Error('progress');
    // الخطوة التالية مميزة وتقود إلى الاستوديو
    await gs.locator('[aria-current=step]').getByRole('link', { name: /صمّم في الاستوديو/ }).click();
    await p.waitForURL(/\/studio-3d\?track=C/);
    // بعد إرسال طلب: ثلاث خطوات مكتملة
    await p.goto(B + '/start/F', { waitUntil: 'networkidle' });
    for (const s of ['ملصقات', 'جاهزة للطباعة', 'أقل من 300', 'مرن']) await p.getByText(s, { exact: true }).click();
    await p.locator('#q-package label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الجوال (واتساب)').fill('0559990000');
    await p.getByRole('button', { name: 'أرسل الطلب' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByTestId('getting-started').getByRole('heading', { name: '3 من 5 خطوات مكتملة' }).waitFor();
  });

  await run('account step reassures: no fees now, call within a day', async (p) => {
    await p.goto(B + '/start/D', { waitUntil: 'networkidle' });
    for (const s of ['شعار فقط', 'الشعار وتنويعاته', 'جاهز ومحسوم', 'تراثي', 'رجالي', 'خلال شهر']) await p.getByText(s, { exact: true }).click();
    await p.locator('#q-package label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByText('لا رسوم الآن — العربون بعد اعتماد عرض السعر').waitFor();
    await p.getByText('مدير مشروع يتصل خلال يوم عمل').first().waitFor();
  });

  await run('mobile: home with the trust strip and fees has no horizontal overflow', async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov) throw new Error('overflow ' + ov);
    await p.getByRole('button', { name: 'فتح القائمة' }).click();
    await p.locator('#mobile-menu').getByRole('link', { name: 'الأسئلة الشائعة' }).waitFor();
  }, { viewport: { width: 375, height: 812 } });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
