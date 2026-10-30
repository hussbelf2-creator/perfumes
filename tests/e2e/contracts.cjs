// العقود في الوضع التجريبي: المصنع يكتب العقد والملحق (أصناف، كميات، صور، PDF) ويرسله؛ العميل يطلب تعديلاً ثم يوقّع؛ المالك يوقّع عن المنشأة
const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', 'ar'); sessionStorage.setItem('_i', '1'); } } catch {} });
  await ctx.route(/readdy\.ai\/api\/form/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
  await ctx.route(/readdy\.ai\/api\/search-image/, (r) => r.fulfill({ path: `${FIX}/face.jpg`, contentType: 'image/jpeg' }));
  const run = async (name, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 8000 });
  const asStaff = async (p, role) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel(/الدور التجريبي/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin/);
  };
  const asClient = async (p) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel('البريد الإلكتروني').fill('hind@contract.test');
    await p.locator('#a-pass').fill('Passw0rd!x');
    await p.locator('form button[type=submit]').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'));
  };
  const drawSignature = async (p) => {
    const box = await p.getByTestId('signature-canvas').boundingBox();
    await p.mouse.move(box.x + 40, box.y + 100);
    await p.mouse.down();
    for (let i = 1; i <= 20; i++) await p.mouse.move(box.x + 40 + i * 18, box.y + 100 + Math.sin(i / 2) * 30);
    await p.mouse.up();
  };
  let path = '', contractId = '';

  await run('client starts a manufacturing project and creates an account', async (p) => {
    await p.goto(B + '/start/E', { waitUntil: 'networkidle' });
    for (const s of ['نعم، جاهزة', 'نعم', '300 – 1,000', 'مرن']) await p.getByText(s, { exact: true }).first().click();
    await p.locator('fieldset').filter({ hasText: 'الباقة الأقرب لك' }).locator('label').first().click();
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.getByLabel('الاسم الأول').fill('هند'); await p.getByLabel('اسم العائلة').fill('السبيعي');
    await p.getByLabel('البريد الإلكتروني').fill('hind@contract.test'); await p.getByLabel('الجوال (واتساب)').fill('0553334444');
    await p.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('Passw0rd!x');
    await p.getByRole('button', { name: 'أنشئ حسابي وأرسل الطلب' }).click();
    await p.waitForURL(/\?new=1/);
    path = new URL(p.url()).pathname;
  });

  await run('sales drafts from the template, adds annex items with an image and a PDF, and sends', async (p) => {
    await asStaff(p, 'sales');
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'أنشئ عقداً' }).click();
    // القالب مملوء: بنود جاهزة باسم المشروع والعميل
    if ((await p.getByLabel(/^عنوان البند \d+$/).count()) < 8) throw new Error('template clauses missing');
    if (!(await p.getByLabel('نص البند 1', { exact: true }).inputValue()).includes('هند السبيعي')) throw new Error('client name not filled');
    await p.getByRole('button', { name: 'صنف جديد' }).click();
    await p.getByLabel('اسم الصنف 1', { exact: true }).fill('زجاجة 50 مل شفافة');
    await p.getByLabel('كمية الصنف 1', { exact: true }).fill('1000');
    await p.getByTestId('spec-editor').first().locator('textarea').fill('زجاج فلينت، عنق 15 مم، رذاذ ذهبي');
    await p.getByTestId('spec-editor').first().locator('input[type=file]').setInputFiles([`${FIX}/work.png`, `${FIX}/brief.pdf`]);
    await p.getByTestId('spec-editor').first().getByText(/1\/8 صور · 1\/4 ملفات/).waitFor({ timeout: 15000 });
    await p.getByTestId('spec-editor').first().scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/contract-editor.png` });
    await p.getByRole('button', { name: 'صنف جديد' }).click();
    await p.getByLabel('اسم الصنف 2', { exact: true }).fill('علبة مغناطيسية');
    await p.getByLabel('كمية الصنف 2', { exact: true }).fill('0');
    await p.getByRole('button', { name: 'احفظ وأرسل للعميل' }).click();
    await p.getByText('الكمية لكل صنف أكبر من صفر.').first().waitFor();
    await p.getByLabel('كمية الصنف 2', { exact: true }).fill('1000');
    await p.getByRole('button', { name: 'احفظ وأرسل للعميل' }).click();
    await toast(p, /أُرسل العقد للعميل/);
    await p.getByTestId('contract-status').filter({ hasText: 'بانتظار توقيع العميل' }).waitFor();
    if (await p.getByRole('button', { name: 'وقّع عن المنشأة' }).count()) throw new Error('sales sees the company signature');
    await p.getByText('إجمالي الكميات: 2,000 قطعة').waitFor();
  });

  await run('client: next step, reads the annex with its image, requests a change', async (p) => {
    await asClient(p);
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: /وقّع عقد «/ }).waitFor();
    await p.goto(B + path, { waitUntil: 'networkidle' });
    const specs = p.getByTestId('contract-specs');
    await specs.getByText('زجاجة 50 مل شفافة').waitFor();
    await specs.getByText('زجاج فلينت، عنق 15 مم، رذاذ ذهبي').waitFor();
    await specs.getByRole('button', { name: /تكبير الصورة/ }).first().waitFor();
    await p.getByRole('button', { name: 'طلب تعديل' }).click();
    await p.getByLabel('ما الذي تريد تعديله في العقد أو الملحق؟').fill('الكمية 1500 زجاجة بدل 1000');
    await p.getByRole('button', { name: 'أرسل طلب التعديل' }).click();
    await toast(p, /وصل طلبك للفريق/);
    await p.getByTestId('contract-status').filter({ hasText: 'طلب العميل تعديلاً' }).waitFor();
  });

  await run('sales edits after the change request and re-sends', async (p) => {
    await asStaff(p, 'sales');
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByText('«الكمية 1500 زجاجة بدل 1000»').waitFor();
    await p.getByRole('button', { name: 'حرّر العقد' }).click();
    await p.getByLabel('كمية الصنف 1', { exact: true }).fill('1500');
    await p.getByRole('button', { name: 'احفظ وأرسل للعميل' }).click();
    await toast(p, /أُرسل العقد للعميل/);
    await p.getByText('إجمالي الكميات: 2,500 قطعة').waitFor();
  });

  await run('client draws a signature and signs', async (p) => {
    await asClient(p);
    await p.goto(B + path, { waitUntil: 'networkidle' });
    await p.getByText('إجمالي الكميات: 2,500 قطعة').waitFor();
    await p.getByRole('button', { name: 'راجعت العقد — أوقّع' }).click();
    const box = p.getByTestId('sign-client');
    if (!(await box.getByRole('button', { name: 'وقّع العقد' }).isDisabled())) throw new Error('sign enabled before agreeing');
    await box.getByRole('checkbox').check();
    await box.getByRole('button', { name: 'وقّع العقد' }).click();
    await box.getByRole('alert').filter({ hasText: 'ارسم التوقيع' }).waitFor();
    await drawSignature(p);
    await box.getByRole('button', { name: 'وقّع العقد' }).click();
    await toast(p, /وُقّع العقد/);
    await p.getByTestId('contract-status').filter({ hasText: 'وقّع العميل' }).waitFor();
    await p.getByRole('img', { name: /توقيع هند السبيعي/ }).waitFor();
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    if (await p.getByRole('heading', { name: /وقّع عقد «/ }).count()) throw new Error('still a next step after signing');
  });

  await run('owner signs for the company by uploading a signature image → signed by both; printable copy', async (p) => {
    await asStaff(p, 'owner');
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'وقّع عن المنشأة' }).click();
    const box = p.getByTestId('sign-company');
    await box.getByLabel('اسم الموقّع عن المنشأة').fill('أحمد الكاف');
    await box.getByRole('button', { name: 'ارفع صورة التوقيع' }).click();
    await box.getByLabel(/صورة التوقيع/).setInputFiles(`${FIX}/work.png`);
    await box.getByRole('checkbox').check();
    await box.getByRole('button', { name: 'وقّع العقد' }).click();
    await toast(p, /وُقّع العقد عن المنشأة/);
    await p.getByTestId('contract-status').filter({ hasText: 'موقّع من الطرفين' }).waitFor();
    const link = p.getByRole('link', { name: 'نسخة للطباعة / PDF' }).first();
    contractId = (await link.getAttribute('href')).split('/').pop();
    await p.goto(B + '/contract/' + contractId, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'اطبع أو احفظ PDF' }).waitFor();
    await p.getByRole('img', { name: /توقيع أحمد الكاف/ }).waitFor();
    await p.getByRole('img', { name: /توقيع هند السبيعي/ }).waitFor();
    await p.getByText(/بصمة النص الموقّع/).waitFor();
    // كل الصور (الملحق والتوقيعان) تُحمَّل فعلاً — شرط للطباعة وPDF
    await p.waitForFunction(() => { const im = [...document.querySelectorAll('.contract-doc img')]; return im.length >= 3 && im.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000 }).catch(async () => {
      const st = await p.evaluate(() => [...document.querySelectorAll('.contract-doc img')].map((i) => `${i.alt}:${i.complete}:${i.naturalWidth}:${i.src.slice(0, 30)}`));
      throw new Error('images not loaded ' + JSON.stringify(st));
    });
    await p.screenshot({ path: `${OUT}/contract-signed.png`, fullPage: true });
  });

  await run('signed contract is locked: no edit, sales cannot void', async (p) => {
    await asStaff(p, 'sales');
    await p.goto(B + path.replace('/account/', '/admin/'), { waitUntil: 'networkidle' });
    await p.getByTestId('contract-status').filter({ hasText: 'موقّع من الطرفين' }).waitFor();
    for (const b of ['حرّر العقد', 'ألغِ العقد', 'وقّع عن المنشأة']) if (await p.getByRole('button', { name: b }).count()) throw new Error('visible: ' + b);
  });

  await run('client sees the signed copy; another client cannot open it', async (p) => {
    await asClient(p);
    await p.goto(B + '/contract/' + contractId, { waitUntil: 'networkidle' });
    await p.getByTestId('contract-status').filter({ hasText: 'موقّع من الطرفين' }).waitFor();
    await p.setViewportSize({ width: 375, height: 812 });
    await p.goto(B + path, { waitUntil: 'networkidle' });
    await p.locator('#pj-contract').waitFor();
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov) throw new Error('mobile overflow ' + ov);
    await p.screenshot({ path: `${OUT}/contract-mobile.png`, fullPage: true });
    await p.setViewportSize({ width: 1440, height: 900 });
    // عميل آخر
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'دخول كعميل تجريبي' }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'));
    await p.goto(B + '/contract/' + contractId, { waitUntil: 'networkidle' });
    await p.getByText('لم نجد هذا العقد في حسابك.').waitFor();
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
