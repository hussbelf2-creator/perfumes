// عروض الأسعار في الوضع التجريبي + الإنجليزية + الجوال
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
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 8000 });
  const asStaff = async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel(/الدور التجريبي|Demo role/).selectOption('owner');
    await p.getByRole('button', { name: /دخول كفريق المنصة|team/i }).click();
    await p.waitForURL(/\/admin/);
  };
  const asClient = async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel('البريد الإلكتروني').fill('lama@demo.test');
    await p.locator('#a-pass').fill('Passw0rd!x');
    await p.locator('form button[type=submit]').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'));
  };
  const ctx = await ctxFor();
  let path = '';

  await run('demo: client starts a project; team quotes; client approves; team records the transfer; stage advances', ctx, async (p) => {
    await p.goto(B + '/start/D', { waitUntil: 'networkidle' });
    for (const s of ['هوية كاملة', 'الشعار وتنويعاته', 'جاهز ومحسوم', 'عصري بسيط', 'للجنسين', 'مرن']) await p.getByText(s, { exact: true }).click();
    await p.locator('fieldset').filter({ hasText: 'الباقة الأقرب لك' }).locator('label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الاسم الأول').fill('لمى'); await p.getByLabel('اسم العائلة').fill('الزهراني');
    await p.getByLabel('البريد الإلكتروني').fill('lama@demo.test'); await p.getByLabel('الجوال (واتساب)').fill('0551212121');
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي وأرسل الطلب' }).click();
    await p.waitForURL(/\?new=1/);
    path = new URL(p.url()).pathname;
    await asStaff(p);
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'أنشئ عرض السعر' }).click();
    await p.getByLabel('وصف البند 1').fill('هوية بصرية');
    await p.getByLabel('سعر وحدة البند 1').fill('8000');
    await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await toast(p, /أُرسل العرض للعميل/);
    await asClient(p);
    await p.goto(B + path, { waitUntil: 'networkidle' });
    await p.getByTestId('quote-total').filter({ hasText: '9,200.00' }).waitFor();
    await p.getByRole('button', { name: 'اعتمد العرض' }).click();
    await p.getByRole('button', { name: 'تأكيد الاعتماد' }).click();
    await toast(p, /اعتُمد العرض/);
    await p.getByText('سيتواصل معك الفريق لترتيب دفع العربون.').waitFor();
    await asStaff(p);
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'تسجيل دفعة مستلمة' }).click();
    await p.getByLabel('المرجع').fill('TRX-1');
    await p.getByRole('button', { name: 'تأكيد الاستلام' }).click();
    await toast(p, /سُجّلت الدفعة/);
    await asClient(p);
    await p.goto(B + path, { waitUntil: 'networkidle' });
    await p.getByText(/استلمنا العربون 4,600.00 ر.س/).waitFor();
    await p.getByRole('list', { name: /المرحلة الحالية: المفاهيم/ }).waitFor();
  });

  await run('demo: validation messages in the editor', ctx, async (p) => {
    await asStaff(p);
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'عرض محدّث' }).click();
    await p.getByLabel('وصف البند 1').fill('');
    await p.getByRole('button', { name: 'حفظ المسودة' }).click();
    await p.getByRole('alert').filter({ hasText: 'لكل بند وصف' }).first().waitFor({ timeout: 8000 }).catch(async () => { await p.getByText('لكل بند وصف').first().waitFor({ timeout: 3000 }); });
  });

  await run('next step: deposit first, then nothing left — the card says what the team is on', ctx, async (p) => {
    await asStaff(p);
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'عرض محدّث' }).click();
    await p.getByLabel('وصف البند 1').fill('بطاقات');
    await p.getByLabel('سعر وحدة البند 1').fill('1000');
    await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await toast(p, /أُرسل العرض للعميل/);
    await asClient(p);
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'راجع عرض السعر لـ«هوية بصرية · لمى»' }).waitFor();
    await p.getByRole('link', { name: /^راجِع واعتمد: / }).click();
    await p.getByRole('button', { name: 'اعتمد العرض' }).click();
    await p.getByRole('button', { name: 'تأكيد الاعتماد' }).click();
    await toast(p, /اعتُمد العرض/);
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'ادفع عربون «هوية بصرية · لمى»' }).waitFor();
    await p.screenshot({ path: `${OUT}/next-step.png`, clip: { x: 0, y: 0, width: 1440, height: 460 } });
    await asStaff(p);
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'تسجيل دفعة مستلمة' }).click();
    await p.getByLabel('المرجع').fill('TRX-2');
    await p.getByRole('button', { name: 'تأكيد الاستلام' }).click();
    await toast(p, /سُجّلت الدفعة/);
    await asClient(p);
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'لا شيء مطلوب منك الآن' }).waitFor();
    await p.getByText(/الفريق يعمل على «المفاهيم»/).waitFor();
    const badge = await p.getByRole('navigation', { name: 'حسابي' }).getByRole('link', { name: /بانتظار اعتمادي/ }).innerText();
    if (/\d|[٠-٩]/.test(badge.replace('بانتظار اعتمادي', ''))) throw new Error('badge still shows ' + badge);
  });

  // الحسابات التجريبية في متصفح واحد: نكمل في السياق نفسه
  await run('English client quote', ctx, async (p) => {
    await asClient(p);
    await p.evaluate(() => localStorage.setItem('pp_lang', 'en'));
    await p.goto(B + path, { waitUntil: 'networkidle' });
    await p.getByText('Deposit paid').first().waitFor();
    await p.getByText('Total incl. VAT').waitFor();
    const ar = await p.evaluate(() => /[؀-ۿ]/.test([...document.querySelectorAll('main section')].filter((s) => s.querySelector('#pj-quote')).map((s) => s.innerText.replace(/هوية بصرية|لمى|الزهراني|بطاقات/g, '')).join(' ')));
    if (ar) throw new Error('Arabic UI text in English quote');
  });

  await run('mobile: quote card fits', ctx, async (p) => {
    await p.setViewportSize({ width: 375, height: 812 });
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.setItem('pp_lang', 'ar'));
    await p.goto(B + path, { waitUntil: 'networkidle' });
    await p.locator('#pj-quote').waitFor();
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov) throw new Error('overflow ' + ov);
    await p.screenshot({ path: `${OUT}/mobile-quote.png`, fullPage: true });
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
