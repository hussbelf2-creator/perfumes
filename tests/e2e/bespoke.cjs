// «عطرك الخاص» للأفراد في الوضع التجريبي: التكوين والقراءة الفورية والسعر، الجلسة، الحساب، ثم المشروع عند العميل والفريق
const { chromium, OUT, url } = require('./lib.cjs');
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
  const total = async (p) => (await p.getByTestId('bk-total').innerText()).replace(/[^\d]/g, '');
  const note = (p, id) => p.locator(`[data-note="${id}"]`);
  const clear = async (p) => { const b = p.getByRole('button', { name: 'ابدأ من الصفر' }); if (await b.count()) await b.click(); };
  const ctx = await ctxFor();

  await run('home and nav lead to the service; a preset fills the pyramid', ctx, async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: /عطرك الخاص، بمكوناتك أنت/ }).waitFor();
    await p.getByRole('link', { name: /ليالي الطائف/ }).click();
    await p.waitForURL(/\/bespoke\?preset=taif_nights$/);
    await p.getByRole('heading', { level: 1, name: /عطرٌ لا يملكه/ }).waitFor();
    if (!(await p.title()).includes('عطرك الخاص')) throw new Error('title ' + await p.title());
    await p.getByTestId('pyr-heart').getByText('ورد طائفي').waitFor();
    await p.getByTestId('pyr-base').getByText('عود كمبودي · عنبر').waitFor();
    if ((await note(p, 'rose_taifi').getAttribute('aria-pressed')) !== 'true') throw new Error('preset not pressed');
    await p.getByTestId('bk-issues').getByText(/توليفة الطائف الكلاسيكية/).waitFor();
    // (50 مل × 14 + 120 + 3 نادرة × 120) × 1.15
    if ((await total(p)) !== '1357') throw new Error('total ' + await total(p));
  });

  await run('live reading: layer limit, warnings, concentration and size, engraving', ctx, async (p) => {
    await p.goto(B + '/bespoke', { waitUntil: 'networkidle' });
    await clear(p);
    for (const id of ['bergamot', 'lemon', 'mandarin']) await note(p, id).click();
    if (!(await note(p, 'mint').isDisabled())) throw new Error('fourth top note allowed');
    if ((await p.getByTestId('count-top').innerText()).replace(/\s/g, '') !== '3/3') throw new Error('counter');
    await note(p, 'lemon').click();
    await note(p, 'mint').click();
    // تصفية بالعائلة
    await p.getByRole('button', { name: 'خشبي وعود' }).click();
    if (await note(p, 'jasmine').count()) throw new Error('family filter');
    await note(p, 'oud_hindi').click();
    await note(p, 'leather').click();
    await p.getByRole('button', { name: 'الكل' }).click();
    await note(p, 'jasmine').click();
    const issues = p.getByTestId('bk-issues');
    await issues.getByText(/مكونان طاغيان/).waitFor();
    await issues.getByText(/النعناع مع العود الهندي|نعناع مع عود هندي/).waitFor();
    await p.getByRole('radio', { name: /دهن عطري/ }).click();
    await p.getByRole('radio', { name: '12 مل' }).waitFor();
    if ((await p.getByRole('radio', { name: '12 مل' }).getAttribute('aria-checked')) !== 'true') throw new Error('oil size not reset to 12');
    // (12 × 35 + 120 + عود هندي نادر 120) × 1.15
    if ((await total(p)) !== '759') throw new Error('oil total ' + await total(p));
    await p.getByTestId('bk-longevity').getByText(/طويل جداً/).waitFor();
    await p.getByLabel('الاسم على الزجاجة (اختياري)').fill('نورة');
    await p.getByTestId('bk-engraving').getByText('نورة').waitFor();
    await p.screenshot({ path: `${OUT}/composer.png` });
  });

  await run('incomplete pyramid is blocked with reasons', ctx, async (p) => {
    await p.goto(B + '/bespoke', { waitUntil: 'networkidle' });
    await clear(p);
    await note(p, 'bergamot').click();
    await p.getByRole('button', { name: 'التالي: جلسة المستشار' }).click();
    await p.getByText('اختر مكوناً واحداً على الأقل في القلب').waitFor();
    await p.getByText('اختر مكوناً واحداً على الأقل في القاعدة').waitFor();
    if (await p.getByRole('heading', { name: 'جلسة مع مستشار التكوين' }).count()) throw new Error('advanced while blocked');
  });

  await run('consultation booking → account → project with the composition; draft survives a reload', ctx, async (p) => {
    await p.goto(B + '/bespoke?preset=majlis', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم على الزجاجة (اختياري)').fill('سارة');
    await p.reload({ waitUntil: 'networkidle' });
    if ((await p.getByLabel('الاسم على الزجاجة (اختياري)').inputValue()) !== 'سارة') throw new Error('draft lost');
    await p.getByRole('button', { name: 'التالي: جلسة المستشار' }).click();
    await p.getByRole('heading', { name: 'جلسة مع مستشار التكوين' }).waitFor();
    // بلا عنوان فعلي للاستوديو لا يظهر خيار الزيارة
    if (await p.getByRole('radio', { name: /زيارة الاستوديو/ }).count()) throw new Error('studio visit shown without an address');
    await p.getByLabel('الاسم الأول').fill('سارة');
    await p.getByLabel('اسم العائلة').fill('العتيبي');
    await p.getByLabel('البريد الإلكتروني').fill('sara@scent.test');
    await p.getByLabel('الجوال (واتساب)').fill('0551234567');
    await p.getByRole('button', { name: 'احجز الجلسة' }).click();
    await p.getByRole('alert').filter({ hasText: 'اختر يوماً ووقتاً' }).waitFor();
    await p.getByRole('radiogroup', { name: 'الوقت' }).locator('[role=radio]:not([disabled])').last().click();
    await p.getByLabel(/عطور تحبها اليوم/).fill('أحب البخور الخفيف');
    await p.getByTestId('legal-consent').waitFor();
    await p.getByRole('button', { name: 'احجز الجلسة' }).click();
    await p.getByRole('status').filter({ hasText: 'وصلت تركيبتك يا سارة' }).waitFor();
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي' }).click();
    await p.waitForURL(/\/account\/projects\/[0-9a-f-]{36}\?new=1$/, { timeout: 15000 });
    await p.getByRole('heading', { level: 1, name: 'عطرك الخاص · سارة' }).waitFor();
    const sum = p.locator('details').filter({ hasText: 'ملخص الطلب' });
    await sum.getByText('قهوة، لبان ظفاري').waitFor();
    await sum.getByText('بخور، صندل').waitFor();
    await sum.getByText(/مكالمة فيديو · \d{4}-\d{2}-\d{2} \d{2}:\d{2}/).waitFor();
    await sum.getByText('أحب البخور الخفيف').waitFor();
    await p.getByText('التكوين والاستشارة').first().waitFor();
    await p.getByText('العينات التجريبية').first().waitFor();
  });

  await run('team: inbox shows the composition readable; project uses the personal track stages', ctx, async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin/);
    await p.goto(B + '/admin/inbox?tab=brief', { waitUntil: 'networkidle' });
    await p.getByText('عطرك الخاص').first().click();
    const dr = p.getByRole('dialog');
    await dr.getByText('قهوة، لبان ظفاري').waitFor();
    await dr.getByText('سارة', { exact: true }).first().waitFor();
    if (await dr.getByText('p_heart').count()) throw new Error('raw code shown');
    await dr.getByRole('link', { name: 'فتح المشروع' }).click();
    await p.waitForURL(/\/admin\/projects\//);
    await p.getByText('عطرك الخاص').first().waitFor();
    await p.getByText('التعبئة والنقش').first().waitFor();
  });

  await run('price list: individual prices are editable and drive the estimate', ctx, async (p) => {
    await p.goto(B + '/admin/cms?doc=pricing', { waitUntil: 'networkidle' });
    await p.getByLabel('المل · أو دو بارفان').fill('20');
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await p.getByRole('status').filter({ hasText: /نُشر في الموقع/ }).first().waitFor();
    const s = await p.context().newPage();
    await s.goto(B + '/bespoke?preset=velvet', { waitUntil: 'networkidle' });
    await s.getByRole('radio', { name: /أو دو بارفان/ }).click();
    await s.getByRole('radio', { name: '50 مل' }).click();
    // (50 × 20 + 120 + سوسن نادر 120) × 1.15
    if ((await total(s)) !== '1426') throw new Error('total after price change ' + await total(s));
    await s.close();
  });

  await run('English page has no Arabic', await ctxFor('en'), async (p) => {
    await p.goto(B + '/bespoke?preset=najdi_morning', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { level: 1, name: /A scent no one/ }).waitFor();
    await p.getByTestId('pyr-top').getByText('Bergamot · Cardamom').waitFor();
    const ar = await p.evaluate(() => /[؀-ۿ]/.test(document.querySelector('main').innerText.replace(/[٠-٩]/g, '')));
    if (ar) throw new Error('Arabic text on English page');
  });

  for (const lang of ['ar', 'en']) {
    await run(`mobile ${lang}: sticky estimate bar, no overflow`, await ctxFor(lang, { viewport: { width: 375, height: 812 } }), async (p) => {
      await p.goto(B + '/bespoke?preset=velvet', { waitUntil: 'networkidle' });
      const ov = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (await ov()) throw new Error('overflow ' + (await ov()));
      const bar = p.getByRole('button', { name: lang === 'ar' ? 'التالي' : 'Next', exact: true });
      await bar.click();
      await p.locator('#bk-phone').waitFor();
      if (await ov()) throw new Error('overflow step 2');
      await p.screenshot({ path: `${OUT}/mobile-${lang}-consult.png` });
    });
  }

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
