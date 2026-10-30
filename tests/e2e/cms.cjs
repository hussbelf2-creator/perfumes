const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
const D = FIX;
(async () => {
  const browser = await chromium.launch();
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
  const login = async (p, role) => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    if (!p.url().includes('/auth')) { await p.evaluate(() => localStorage.removeItem('pp_session_email')); await p.goto(B + '/auth', { waitUntil: 'networkidle' }); }
    await p.getByLabel(/الدور التجريبي/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin$/);
  };
  const open = async (p, doc) => { await p.goto(B + '/admin/cms?doc=' + doc, { waitUntil: 'networkidle' }); await p.getByTestId('cms-status').waitFor(); };
  const status = (p) => p.getByTestId('cms-status').innerText();
  const h1 = async (p) => (await p.locator('h1').first().innerText()).replace(/\s+/g, ' ');

  const ctx = await mk();
  await run('draft is private; preview shows it; publish makes it live', ctx, async p => {
    await login(p, 'editor');
    await p.getByRole('link', { name: 'محتوى الموقع' }).click();
    await p.waitForURL(/\/admin\/cms/);
    if (!/المحتوى الأصلي/.test(await status(p))) throw new Error('status ' + await status(p));
    await p.getByLabel('العنوان · السطر الأول · عربي').fill('عطرك القادم،');
    if (!/غير محفوظة/.test(await status(p))) throw new Error('dirty status');
    await p.getByRole('button', { name: 'حفظ كمسودة' }).click();
    await toast(p, /حُفظت المسودة/);
    if (!/لم تُنشر/.test(await status(p))) throw new Error('draft status ' + await status(p));
    const site = await p.context().newPage();
    await site.goto(B + '/', { waitUntil: 'networkidle' });
    if ((await h1(site)).includes('عطرك القادم')) throw new Error('draft leaked to the site');
    // المعاينة: تبويب جديد يُظهر المسودة مع شارة المعاينة
    const [pv] = await Promise.all([p.context().waitForEvent('page'), p.getByRole('button', { name: 'معاينة في الموقع' }).click()]);
    await pv.waitForLoadState('networkidle');
    await pv.getByText('معاينة المسودات — تظهر لك فقط').waitFor({ timeout: 8000 });
    await pv.waitForFunction(() => document.querySelector('h1').innerText.includes('عطرك القادم'), null, { timeout: 8000 });
    await pv.getByRole('button', { name: 'إيقاف' }).click();
    await pv.waitForFunction(() => !document.querySelector('h1').innerText.includes('عطرك القادم'), null, { timeout: 8000 });
    await pv.close();
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    if (!/منشور/.test(await status(p))) throw new Error('published status ' + await status(p));
    await site.reload({ waitUntil: 'networkidle' });
    await site.waitForFunction(() => document.querySelector('h1').innerText.includes('عطرك القادم'), null, { timeout: 8000 });
    // الزيارة التالية تُرسم مباشرة من المخزَّن (بلا ومضة للنص القديم)
    const firstPaint = await site.evaluate(() => JSON.parse(localStorage.getItem('pp_cms_cache')).hero.line1.ar);
    if (firstPaint !== 'عطرك القادم،') throw new Error('cache ' + firstPaint);
    await site.close();
  });

  await run('versions: second publish, restore first as draft, republish', ctx, async p => {
    await login(p, 'admin');
    await open(p, 'hero');
    await p.getByLabel('العنوان · السطر الأول · عربي').fill('نسخة ثانية،');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const list = p.getByRole('complementary').filter({ hasText: 'النسخ المنشورة' }).locator('li');
    if (await list.count() !== 2) throw new Error('versions ' + await list.count());
    await list.nth(1).getByRole('button', { name: 'استرجاع' }).click();
    await toast(p, /استُرجعت النسخة كمسودة/);
    if (await p.getByLabel('العنوان · السطر الأول · عربي').inputValue() !== 'عطرك القادم،') throw new Error('restore value');
    const site = await p.context().newPage();
    await site.goto(B + '/', { waitUntil: 'networkidle' });
    if (!(await h1(site)).includes('نسخة ثانية')) throw new Error('restore must not publish');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    await site.reload({ waitUntil: 'networkidle' });
    if (!(await h1(site)).includes('عطرك القادم')) throw new Error('republish');
    await site.close();
  });

  await run('contact: invalid email blocked; WhatsApp button and contact page update', ctx, async p => {
    await login(p, 'editor');
    await open(p, 'site');
    await p.getByLabel('البريد', { exact: true }).fill('hello@');
    await p.getByRole('button', { name: 'حفظ كمسودة' }).click();
    await p.getByRole('alert').filter({ hasText: /صحّح هذه الحقول.*البريد/ }).waitFor();
    await p.getByLabel('البريد', { exact: true }).fill('hello@maison.sa');
    await p.getByLabel('واتساب (أرقام فقط)').fill('+966 55 123 4567');
    if (await p.getByLabel('واتساب (أرقام فقط)').inputValue() !== '966551234567') throw new Error('digits only');
    await p.getByLabel('إنستغرام').fill('https://instagram.com/maison');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const site = await p.context().newPage();
    await site.goto(B + '/contact', { waitUntil: 'networkidle' });
    const wa = site.getByRole('link', { name: 'تواصل معنا عبر واتساب' });
    if (!(await wa.getAttribute('href')).startsWith('https://wa.me/966551234567')) throw new Error('whatsapp');
    await site.getByRole('link', { name: /hello@maison\.sa/ }).waitFor();
    if (await site.locator('footer a[aria-label="Instagram"]').getAttribute('href') !== 'https://instagram.com/maison') throw new Error('instagram');
    await site.close();
  });

  await run('announcement: shows on site pages, dismiss persists, hidden in admin', ctx, async p => {
    await login(p, 'editor');
    await open(p, 'announcement');
    await p.getByRole('switch', { name: 'إظهار الشريط' }).check();
    await p.getByLabel('النص · عربي').fill('خصم الإطلاق حتى نهاية الشهر');
    await p.getByLabel('الرابط').fill('/pricing');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    if (await p.getByRole('complementary', { name: 'إعلان' }).count()) throw new Error('shown inside admin');
    const site = await p.context().newPage();
    await site.goto(B + '/services', { waitUntil: 'networkidle' });
    const bar = site.getByRole('complementary', { name: 'إعلان' });
    await bar.getByText('خصم الإطلاق حتى نهاية الشهر').waitFor();
    await bar.getByRole('link', { name: 'اطلبها' }).click();
    await site.waitForURL(/\/pricing$/);
    await bar.waitFor({ state: 'detached', timeout: 4000 }).catch(() => { throw new Error('bar shown on its own target page'); });
    await site.goto(B + '/about', { waitUntil: 'networkidle' });
    await site.getByRole('button', { name: 'إغلاق الإعلان' }).click();
    await site.reload({ waitUntil: 'networkidle' });
    if (await site.getByRole('complementary', { name: 'إعلان' }).count()) throw new Error('dismiss not remembered');
    await site.close();
    // نص جديد يعود للظهور رغم الإغلاق السابق، والتاريخ المنتهي يخفيه
    await p.getByLabel('النص · عربي').fill('عرض جديد');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const s2 = await p.context().newPage();
    await s2.goto(B + '/about', { waitUntil: 'networkidle' });
    await s2.getByText('عرض جديد').waitFor();
    await p.getByLabel('ينتهي في (اختياري)').fill('2020-01-01');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    await s2.reload({ waitUntil: 'networkidle' });
    if (await s2.getByText('عرض جديد').count()) throw new Error('expired announcement visible');
    await s2.close();
  });

  await run('FAQ: add, hide, reorder; site pages follow', ctx, async p => {
    await login(p, 'editor');
    await open(p, 'faq');
    await p.getByRole('button', { name: 'سؤال جديد' }).click();
    await p.getByLabel('السؤال · عربي').fill('هل تشحنون خارج السعودية؟');
    await p.getByLabel('الإجابة · عربي').fill('نعم، لدول الخليج خلال أسبوع عمل.');
    const items = p.locator('ol > li');
    const n = await items.count();
    for (let i = n - 1; i > 0; i--) await p.getByRole('button', { name: `حرّك السؤال ${i + 1} للأعلى` }).click();
    // إخفاء السؤال الذي صار ثانياً
    const second = await items.nth(1).locator('button[aria-expanded]').innerText();
    await items.nth(1).locator('button[aria-expanded]').click();
    await p.getByRole('checkbox', { name: 'منشور' }).uncheck();
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const site = await p.context().newPage();
    await site.goto(B + '/', { waitUntil: 'networkidle' });
    const homeQs = await site.locator('#faq, section').filter({ hasText: 'هل تشحنون خارج السعودية؟' }).count();
    if (!homeQs) throw new Error('new question not first on home');
    await site.goto(B + '/faq', { waitUntil: 'networkidle' });
    await site.getByText('هل تشحنون خارج السعودية؟').waitFor();
    if (await site.getByText(second, { exact: true }).count()) throw new Error('hidden question still shown: ' + second);
    await site.close();
  });

  await run('offers: call length and slots drive the booking page', ctx, async p => {
    await login(p, 'editor');
    await open(p, 'offers');
    await p.getByLabel('المدة (دقيقة)').fill('30');
    await p.getByRole('button', { name: 'احذف موعد 10:00' }).click();
    await p.getByLabel('موعد جديد').fill('17:30');
    await p.getByRole('button', { name: 'إضافة موعد' }).click();
    await p.getByLabel('عدد العينات').fill('4');
    if (!(await p.getByText(/السعر يُعدَّل من وثيقة «الأسعار»/).count())) throw new Error('price note');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const site = await p.context().newPage();
    await site.goto(B + '/book', { waitUntil: 'networkidle' });
    if (!(await h1(site)).includes('30 دقيقة')) throw new Error('minutes ' + await h1(site));
    // المواعيد تُعرض بنظام 12 ساعة (5:30 م)
    const times = (await site.locator('main button').allInnerTexts()).join(' | ');
    if (/(^|\D)10:00/.test(times) || !/5:30/.test(times)) throw new Error('slots not applied: ' + times);
    await site.goto(B + '/discovery-kit', { waitUntil: 'networkidle' });
    await site.getByText(/4 عينات|٤ عينات/).first().waitFor();
    if (!(await site.getByText(/750/).count())) throw new Error('price changed');
    await site.close();
  });

  await run('legal pages: edit a section, publish, variables filled on the site', ctx, async p => {
    await login(p, 'editor');
    await open(p, 'legal');
    await p.getByText('صياغة مبدئية').first().waitFor();
    await p.getByRole('tab', { name: 'الشروط' }).click();
    await p.getByRole('button', { name: 'مقدّم الخدمة' }).click();
    await p.getByLabel('عنوان القسم · عربي').fill('من نحن نظامياً');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const site = await p.context().newPage();
    await site.goto(B + '/terms', { waitUntil: 'networkidle' });
    await site.getByRole('heading', { name: /من نحن نظامياً/ }).waitFor();
    const text = await site.locator('main').innerText();
    if (/\{(legalName|cr|vat|email|phone|address|kitCreditDays)\}/.test(text)) throw new Error('unfilled variable');
    await site.close();
  });
  await run('spam protection card: human check needs Turnstile keys', ctx, async p => {
    await login(p, 'owner');
    await p.goto(B + '/admin/pricing', { waitUntil: 'networkidle' });
    await p.getByText('الحماية من الرسائل المزعجة').waitFor();
    if (!(await p.getByTestId('captcha-toggle').isDisabled())) throw new Error('toggle enabled without keys');
    await p.getByText(/VITE_TURNSTILE_SITE_KEY/).waitFor();
  });
  await run('hero image upload; discard and unsaved-change guard', ctx, async p => {
    await login(p, 'editor');
    await open(p, 'hero');
    await p.getByLabel('صورة الواجهة').setInputFiles(`${D}/work.png`);
    await p.waitForFunction(() => [...document.querySelectorAll('main img')].some(i => i.src.startsWith('blob:') && i.naturalWidth === 1800), null, { timeout: 10000 });
    p.once('dialog', (d) => d.dismiss());
    await p.getByRole('button', { name: /التواصل والحسابات/ }).click();
    if (!/doc=hero|cms$/.test(p.url()) || !/غير محفوظة/.test(await status(p))) throw new Error('left with unsaved changes');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    const site = await p.context().newPage();
    await site.goto(B + '/', { waitUntil: 'networkidle' });
    await site.waitForFunction(() => { const i = document.querySelector('section img'); return i && i.src.startsWith('blob:') && i.naturalWidth > 0; }, null, { timeout: 8000 });
    await site.close();
    await p.getByLabel('السطر الصغير أعلى العنوان · عربي').fill('تجربة');
    p.once('dialog', (d) => d.accept());
    await p.getByRole('button', { name: 'تجاهل التعديلات' }).click();
    await p.waitForFunction(() => document.querySelector('[data-testid=cms-status]').innerText.includes('منشور'));
    if (await p.getByLabel('السطر الصغير أعلى العنوان · عربي').inputValue() === 'تجربة') throw new Error('discard');
  });

  await run('permissions: only content.edit roles', ctx, async p => {
    for (const role of ['sales', 'designer', 'production']) {
      await login(p, role);
      if (await p.getByRole('link', { name: 'محتوى الموقع' }).count()) throw new Error(role + ' sees nav');
      await p.goto(B + '/admin/cms', { waitUntil: 'networkidle' });
      if (await p.getByTestId('cms-status').count()) throw new Error(role + ' opened editor');
    }
    await p.goto(B + '/admin/content', { waitUntil: 'networkidle' });
    if (!p.url().includes('/admin')) throw new Error('legacy redirect');
    // غير المحرر لا يرى المسودات حتى لو فعّل علامة المعاينة يدوياً
    await login(p, 'editor');
    await open(p, 'hero');
    await p.getByLabel('العنوان · السطر الأول · عربي').fill('مسودة سرية');
    await p.getByRole('button', { name: 'حفظ كمسودة' }).click();
    await toast(p, /حُفظت المسودة/);
    await login(p, 'sales');
    await p.evaluate(() => sessionStorage.setItem('pp_cms_preview', '1'));
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    if ((await h1(p)).includes('مسودة سرية')) throw new Error('sales saw a draft');
    if (await p.getByText('معاينة المسودات').count()) throw new Error('preview badge for sales');
  });

  const mob = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await run('mobile editor usable', mob, async p => {
    await login(p, 'editor');
    for (const doc of ['hero', 'faq', 'offers', 'site', 'announcement']) {
      await open(p, doc);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) throw new Error(doc + ' overflow ' + ov);
    }
    await p.screenshot({ path: `${OUT}/mobile-cms.png`, fullPage: true });
  });

  const en = await mk({}, 'ar');
  await run('English editor', en, async p => {
    await login(p, 'editor');
    await p.evaluate(() => localStorage.setItem('pp_lang', 'en'));
    await p.goto(B + '/admin/cms?doc=faq', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'Site content' }).waitFor();
    await p.getByRole('button', { name: 'Publish', exact: true }).waitFor();
    await p.getByRole('button', { name: 'New question' }).waitFor();
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
