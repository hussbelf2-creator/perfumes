const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
const D = FIX;
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const mk = async (opts = {}, lang = 'ar') => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_i', '1'); } } catch {} }, lang);
    // خدمة الصور الخارجية محجوبة في بيئة الاختبار: صورة بديلة
    await ctx.route(/readdy\.ai\/api\/search-image/, (r) => r.fulfill({ path: `${D}/face.jpg`, contentType: 'image/jpeg' }));
    // نماذج Readdy الخارجية: نجاح وهمي (الوضع التجريبي يسجّل الطلب محلياً)
    await ctx.route(/readdy\.ai\/api\/form/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
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
  const errToast = (p, re) => p.getByRole('alert').filter({ hasText: re }).first().waitFor({ timeout: 8000 });
  const login = async (p, role) => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    if (!p.url().includes('/auth')) { await p.evaluate(() => localStorage.removeItem('pp_session_email')); await p.goto(B + '/auth', { waitUntil: 'networkidle' }); }
    await p.getByLabel(/الدور التجريبي/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin$/);
  };
  const fillBrief = async (p, first, msg) => {
    await p.getByLabel('الاسم الأول').fill(first);
    await p.getByLabel('اسم العائلة').fill('القحطاني');
    await p.getByLabel('البريد الإلكتروني').fill(`u${Date.now()}@brand.sa`);
    await p.getByLabel('الميزانية التقريبية').selectOption('5-15');
    await p.getByLabel('صف مشروعك').fill(msg);
  };

  const ctx = await mk();
  await run('public directory: sample profiles, filter, works', ctx, async p => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.getByRole('navigation').getByRole('link', { name: 'المبدعون' }).first().click();
    await p.waitForURL(/\/creatives$/);
    await p.getByRole('heading', { name: 'المصممون' }).waitFor();
    const cards = p.locator('a[href^="/creatives/"]');
    if (await cards.count() !== 3) throw new Error('cards ' + await cards.count());
    if (await p.getByText('ملف توضيحي').count() !== 3) throw new Error('sample badges');
    await p.getByRole('group', { name: 'تصفية حسب التخصص' }).getByRole('button', { name: 'تغليف وعلب' }).click();
    if (await cards.count() !== 1) throw new Error('filter cards ' + await cards.count());
    const works = await p.locator('#works li').count();
    if (works !== 2) throw new Error('filtered works ' + works);
    if (await p.title() !== 'استوديو المبدعين | منصة العطور') throw new Error('title ' + await p.title());
  });

  await run('profile + lightbox: keyboard, focus, RTL arrows', ctx, async p => {
    await p.goto(B + '/creatives/reem-studio', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { level: 1, name: /ريم/ }).waitFor();
    if (!/ريم/.test(await p.title())) throw new Error('title');
    const opener = p.getByRole('button', { name: /عرض «هوية «سَهم»»/ });
    await opener.click();
    const dlg = p.getByRole('dialog');
    await dlg.waitFor();
    const counter = () => dlg.locator('[aria-live]').innerText();
    if (!/1 \/ 3|١ \/ ٣/.test(await counter())) throw new Error('counter ' + await counter());
    await p.waitForFunction(() => { const i = document.querySelector('[role=dialog] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    await p.keyboard.press('ArrowLeft'); // التالي في العربية: الصورة الثانية من العمل نفسه
    if (!/2\/2|٢\/٢/.test(await counter())) throw new Error('image step ' + await counter());
    await p.keyboard.press('ArrowLeft'); // العمل التالي
    if (!/2 \/ 3|٢ \/ ٣/.test(await counter())) throw new Error('work step ' + await counter());
    await dlg.getByRole('button', { name: 'السابق' }).click();
    if (!/1 \/ 3|١ \/ ٣/.test(await counter())) throw new Error('prev ' + await counter());
    await p.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' });
    if (!(await opener.evaluate((e) => e === document.activeElement))) throw new Error('focus not restored');
    if (await p.evaluate(() => document.body.style.overflow) === 'hidden') throw new Error('scroll still locked');
  });

  await run('unknown profile shows not-found', ctx, async p => {
    await p.goto(B + '/creatives/nobody-here', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'لم نجد هذا المصمم' }).waitFor();
  });

  await run('brief from a profile lands in the inbox with readable fields', ctx, async p => {
    await p.goto(B + '/creatives/faisal-pack#brief', { waitUntil: 'networkidle' });
    if (await p.getByLabel('المصمم', { exact: true }).count()) throw new Error('creative select should be hidden on profile');
    const svc = await p.getByLabel('ما الذي تحتاجه؟').locator('option').allInnerTexts();
    if (svc.join() !== 'تغليف وعلب,تصيير ثلاثي الأبعاد') throw new Error('services ' + svc);
    await fillBrief(p, 'نوف', 'قصير');
    await p.getByRole('button', { name: /أرسل الطلب إلى فيصل/ }).click();
    if (!(await p.getByLabel('صف مشروعك').evaluate((e) => e.validity.tooShort || e.matches(':invalid')))) throw new Error('short brief accepted');
    await p.getByLabel('صف مشروعك').fill('علبة مغناطيسية سوداء بفويل ذهبي لثلاثة عطور، الإطلاق في رمضان.');
    await p.getByRole('button', { name: /أرسل الطلب إلى فيصل/ }).click();
    await p.getByRole('status').filter({ hasText: 'وصل طلبك، نوف.' }).waitFor({ timeout: 8000 });
    await login(p, 'sales');
    await p.goto(B + '/admin/inbox?tab=design', { waitUntil: 'networkidle' });
    const row = p.getByRole('button', { name: /نوف/ }).first();
    await row.waitFor({ timeout: 8000 });
    if (!/فيصل · تغليف وثلاثي الأبعاد · تغليف وعلب/.test(await p.locator('main').innerText())) throw new Error('summary');
    await row.click();
    const drawer = p.getByRole('dialog');
    for (const s of ['طلب تصميم', 'المصمم المطلوب', '5,000 – 15,000 ر.س', 'تغليف وعلب', 'علبة مغناطيسية سوداء']) if (!(await drawer.innerText()).includes(s)) throw new Error('drawer missing ' + s);
    const link = drawer.getByRole('link', { name: /فيصل/ });
    if (await link.getAttribute('href') !== '/creatives/faisal-pack') throw new Error('creative link');
  });

  await run('3D studio → "finish with a creative" attaches the design', ctx, async p => {
    await p.goto(B + '/studio-3d?g=smoke', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: 'أكملها مع مصمم' }).click();
    await p.waitForURL(/\/creatives\?design=/);
    const attach = p.getByRole('checkbox', { name: /أرفق تصميمي من استوديو 3D/ });
    await attach.waitFor();
    if (!(await attach.isChecked())) throw new Error('attach not default');
    await p.getByLabel('المصمم', { exact: true }).selectOption({ label: 'ريم · استوديو الهوية' });
    await fillBrief(p, 'هيا', 'ملصق وهوية لعطر زهري بزجاج مدخّن، نريد إحساساً هادئاً وفاخراً.');
    await p.getByRole('button', { name: /أرسل الطلب إلى ريم/ }).click();
    await p.getByRole('status').filter({ hasText: 'وصل طلبك، هيا.' }).waitFor({ timeout: 8000 });
    await login(p, 'admin');
    await p.goto(B + '/admin/inbox?tab=design', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /هيا/ }).first().click();
    const txt = await p.getByRole('dialog').innerText();
    if (!/تصميمه في استوديو 3D/.test(txt) || !/مدخّن/.test(txt)) throw new Error('studio design missing');
    const href = await p.getByRole('dialog').getByRole('link', { name: /\/studio-3d/ }).getAttribute('href');
    if (!href.includes('g=smoke')) throw new Error('studio link ' + href);
  });

  await run('designer creates a creative, uploads work, it goes live', ctx, async p => {
    await login(p, 'designer');
    await p.getByRole('link', { name: 'استوديو المبدعين' }).click();
    await p.waitForURL(/\/admin\/creatives$/);
    await p.getByRole('link', { name: 'مصمم جديد' }).click();
    await p.getByLabel('الاسم · عربي').fill('سلمى · خط عربي');
    await p.getByLabel('الاسم · إنجليزي').fill('Salma Calligraphy');
    if (await p.getByLabel('رابط الملف').inputValue() !== 'salma-calligraphy') throw new Error('slug ' + await p.getByLabel('رابط الملف').inputValue());
    await p.getByLabel('المسمّى · عربي').fill('خطاطة ومصممة شعارات');
    // بلا تخصص: يُرفض
    await p.getByRole('button', { name: 'إنشاء الملف' }).click();
    await errToast(p, /اختر تخصصاً واحداً على الأقل/);
    await p.getByRole('group', { name: 'التخصصات' }).getByRole('button', { name: 'هوية بصرية' }).click();
    await p.getByRole('switch', { name: 'منشور في الموقع' }).check();
    await p.getByLabel('الصورة الشخصية').setInputFiles(`${D}/face.jpg`);
    await p.waitForFunction(() => document.querySelector('main img'), null, { timeout: 8000 });
    await p.getByRole('button', { name: 'إنشاء الملف' }).click();
    await toast(p, /أُضيف المصمم/);
    await p.waitForURL(/\/admin\/creatives\/CR-/);
    await p.getByRole('button', { name: 'عمل جديد' }).click();
    const dr = p.getByRole('dialog');
    if (!(await dr.getByRole('button', { name: 'إضافة العمل' }).isDisabled())) throw new Error('save enabled without image');
    await dr.getByLabel('صور العمل').setInputFiles(`${D}/not-image.png`);
    await dr.getByRole('alert').filter({ hasText: /تعذّر قراءة الصورة|ليس صورة/ }).waitFor();
    await dr.getByLabel('صور العمل').setInputFiles([`${D}/work.png`, `${D}/face.jpg`]);
    await dr.getByRole('list', { name: 'الصور المرفوعة' }).locator('li').nth(1).waitFor({ timeout: 10000 });
    // تقديم الصورة الثانية لتصبح الغلاف
    await dr.getByRole('button', { name: 'قدّم الصورة 2' }).click();
    await dr.getByLabel('العنوان · عربي').fill('شعار «حبر»');
    await dr.getByRole('button', { name: 'إضافة العمل' }).click();
    await toast(p, /أُضيف العمل/);
    await p.getByText('شعار «حبر»').waitFor();
    // الزائر يراه
    await p.goto(B + '/creatives', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: /سلمى · خط عربي/ }).click();
    await p.waitForURL(/\/creatives\/salma-calligraphy$/);
    await p.getByRole('heading', { level: 1, name: /سلمى/ }).waitFor();
    if (await p.getByText('ملف توضيحي').count()) throw new Error('real creative marked sample');
    await p.getByRole('button', { name: /عرض «شعار «حبر»»/ }).click();
    await p.waitForFunction(() => { const i = document.querySelector('[role=dialog] img'); return i && i.complete && i.naturalWidth > 0 && i.src.startsWith('blob:'); }, null, { timeout: 8000 });
    const w = await p.evaluate(() => document.querySelector('[role=dialog] img').naturalWidth);
    if (w !== 400) throw new Error('cover order wrong / not resized: ' + w);
    await p.keyboard.press('ArrowLeft');
    await p.waitForFunction(() => { const i = document.querySelector('[role=dialog] img'); return i && i.complete && i.naturalWidth === 1600; }, null, { timeout: 8000 });
  });

  await run('slug clash, unpublish hides, delete work and creative', ctx, async p => {
    await login(p, 'designer');
    await p.goto(B + '/admin/creatives/new', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم · عربي').fill('نسخة');
    await p.getByLabel('رابط الملف').fill('reem-studio');
    await p.getByRole('group', { name: 'التخصصات' }).getByRole('button', { name: 'تصميم ملصقات' }).click();
    await p.getByRole('button', { name: 'إنشاء الملف' }).click();
    await errToast(p, /هذا الرابط مستخدم/);
    await p.goto(B + '/admin/creatives', { waitUntil: 'networkidle' });
    const card = p.locator('li').filter({ hasText: 'سلمى · خط عربي' });
    await card.getByRole('button', { name: 'إخفاء' }).click();
    await toast(p, /أُخفي الملف/);
    const pub = await p.context().newPage();
    await pub.goto(B + '/creatives/salma-calligraphy', { waitUntil: 'networkidle' });
    await pub.getByRole('heading', { name: 'لم نجد هذا المصمم' }).waitFor();
    await pub.close();
    await card.getByRole('link', { name: /تعديل سلمى/ }).first().click();
    p.on('dialog', (d) => d.accept());
    await p.getByRole('button', { name: 'حذف «شعار «حبر»»' }).click();
    await toast(p, /حُذف العمل/);
    await p.getByRole('button', { name: 'حذف المصمم' }).click();
    await p.waitForURL(/\/admin\/creatives$/);
    // القائمة تُحمَّل بعد الانتقال: ننتظر اختفاء المحذوف بدل فحص فوري
    await p.getByText('سلمى · خط عربي').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => { throw new Error('still listed'); });
    const audit = await p.evaluate(() => JSON.parse(localStorage.getItem('pp_creatives_v1')).creatives.length);
    if (audit !== 3) throw new Error('catalog size ' + audit);
  });

  await run('permissions: sales and editor cannot manage creatives', ctx, async p => {
    for (const role of ['sales', 'editor']) {
      await login(p, role);
      if (await p.getByRole('link', { name: 'استوديو المبدعين' }).count()) throw new Error(role + ' sees nav item');
      await p.goto(B + '/admin/creatives', { waitUntil: 'networkidle' });
      if (await p.getByRole('link', { name: 'مصمم جديد' }).count()) throw new Error(role + ' opened page');
    }
  });

  const mob = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await run('mobile: directory, profile, lightbox swipe', mob, async p => {
    for (const path of ['/creatives', '/creatives/faisal-pack']) {
      await p.goto(B + path, { waitUntil: 'networkidle' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) throw new Error(path + ' overflow ' + ov);
    }
    await p.getByRole('button', { name: /عرض «/ }).first().click();
    const dlg = p.getByRole('dialog');
    await dlg.waitFor();
    const before = await dlg.locator('[aria-live]').innerText();
    await dlg.dispatchEvent('touchstart', { touches: [{ clientX: 100, clientY: 400, identifier: 1 }], changedTouches: [{ clientX: 100, clientY: 400, identifier: 1 }] });
    await dlg.dispatchEvent('touchend', { touches: [], changedTouches: [{ clientX: 300, clientY: 400, identifier: 1 }] });
    if (await dlg.locator('[aria-live]').innerText() === before) throw new Error('swipe did nothing');
    await p.screenshot({ path: `${OUT}/m-lightbox.png` });
  });

  const en = await mk({}, 'en');
  await run('English directory and profile', en, async p => {
    await p.goto(B + '/creatives', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'The creatives' }).waitFor();
    await p.getByRole('link', { name: /Faisal · Packaging & 3D/ }).click();
    await p.getByRole('heading', { level: 1, name: 'Faisal · Packaging & 3D' }).waitFor();
    await p.getByRole('button', { name: /Send brief to Faisal/ }).waitFor();
    const body = await p.locator('main').innerText();
    if (/[؀-ۿ]{3,}/.test(body)) throw new Error('Arabic in EN: ' + body.match(/[؀-ۿ ]{3,}/)[0]);
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
