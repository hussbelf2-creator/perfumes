const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const desk = { width: 1440, height: 900 }, mob = { width: 390, height: 844 };
  const ctxFor = async (vp, lang = 'ar') => {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(l => { try { if (!sessionStorage.getItem('_init')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_init', '1'); } } catch {} }, lang);
    return ctx;
  };
  const run = async (name, fn, vp = desk, lang = 'ar') => {
    const ctx = await ctxFor(vp, lang);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/readdy|ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    await p.route(/readdy\.ai\/api\/form/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await ctx.close();
  };
  const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
  const loginStaff = async (p, role) => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel(/الدور التجريبي|Demo role/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة|Continue as platform staff/ }).click();
    await p.waitForURL(/\/admin$/);
    await p.locator('main h1').first().waitFor();
  };
  const toast = async (p, re) => { await p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 5000 }); };
  const noOverflow = async (p, w) => { const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > w) throw new Error('overflow ' + sw); };

  await run('owner overview', async p => {
    await loginStaff(p, 'owner');
    const h1 = await p.locator('main h1').innerText();
    if (!/أحمد/.test(h1)) throw new Error('greeting ' + h1);
    for (const l of ['صندوق الوارد', 'مراحل البيع', 'العملاء', 'المهام', 'المدفوعات', 'الفريق والصلاحيات', 'سجل التدقيق']) {
      if (!(await p.getByRole('navigation').getByRole('link', { name: new RegExp(l) }).count())) throw new Error('nav missing ' + l);
    }
    await p.waitForTimeout(900);
    await shot(p, 'admin-1-overview', true);
  });

  await run('inbox: open, assign, status, note', async p => {
    await loginStaff(p, 'owner');
    await p.getByRole('navigation').getByRole('link', { name: /صندوق الوارد/ }).click();
    await p.waitForURL('**/admin/inbox');
    await shot(p, 'admin-2-inbox', true);
    await p.locator('main ul button').filter({ hasText: 'سارة العنزي' }).click();
    const dlg = p.getByRole('dialog');
    await dlg.waitFor();
    const wa = await dlg.getByRole('link', { name: 'واتساب' }).getAttribute('href');
    if (!wa.startsWith('https://wa.me/966551230011')) throw new Error('wa ' + wa);
    if (!(await dlg.getByRole('link', { name: 'إلى التقويم' }).getAttribute('href')).includes('calendar.google.com')) throw new Error('gcal');
    await dlg.getByLabel('المسؤول').selectOption({ label: 'فيصل القحطاني' });
    await toast(p, 'أُسند العميل');
    await dlg.getByLabel('حالة الطلب').selectOption('in_progress');
    await toast(p, 'حُدّثت الحالة');
    await dlg.getByLabel('ملاحظة سريعة على العميل').fill('اتصلت بها، تفضّل مكالمة فيديو الأحد.');
    await dlg.getByRole('button', { name: 'حفظ الملاحظة' }).click();
    await toast(p, 'أُضيفت الملاحظة');
    await shot(p, 'admin-3-inbox-drawer');
    await p.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' });
    // التحقق في ملف العميل
    await p.goto(B + '/admin/contacts/C-1001', { waitUntil: 'networkidle' });
    const body = await p.locator('main').innerText();
    for (const s of ['تفضّل مكالمة فيديو الأحد', 'أُسند إلى فيصل القحطاني']) if (!body.includes(s)) throw new Error('timeline missing ' + s);
  });

  await run('pipeline: move by menu + drag', async p => {
    await loginStaff(p, 'owner');
    await p.goto(B + '/admin/pipeline', { waitUntil: 'networkidle' });
    await shot(p, 'admin-4-pipeline');
    await p.getByLabel('نقل خالد الزهراني إلى').selectOption('contacted');
    await toast(p, 'نُقل خالد الزهراني');
    const col = p.getByRole('region', { name: 'تم التواصل' });
    if (!(await col.getByText('خالد الزهراني').count())) throw new Error('not moved');
    const card = p.locator('li[draggable="true"]').filter({ hasText: 'منيرة السبيعي' });
    await card.dragTo(p.getByRole('region', { name: 'مؤهَّل' }));
    await toast(p, 'نُقل منيرة السبيعي');
    if (!(await p.getByRole('region', { name: 'مؤهَّل' }).getByText('منيرة السبيعي').count())) throw new Error('drag failed');
  });

  await run('contacts: search, detail, value, task, csv', async p => {
    await loginStaff(p, 'owner');
    await p.getByRole('search').getByRole('textbox').fill('الشمري');
    await p.keyboard.press('Enter');
    await p.waitForURL('**/admin/contacts?q=*');
    await p.getByText(/^1 من 14$/).waitFor();
    const rows = p.locator('main tbody tr');
    if ((await rows.count()) !== 1) throw new Error('search rows ' + (await rows.count()));
    await shot(p, 'admin-5-contacts');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /تصدير CSV/ }).click()]);
    const csv = require('fs').readFileSync(await dl.path(), 'utf8');
    if (!csv.startsWith('﻿name,') || !csv.includes('عبدالله الشمري')) throw new Error('csv');
    await rows.first().getByRole('link').click();
    await p.waitForURL('**/admin/contacts/C-1004');
    const val = p.getByLabel('القيمة المتوقعة (ر.س)');
    await val.fill('52000'); await val.blur();
    await toast(p, 'حُدّثت القيمة');
    await p.getByLabel('مهمة جديدة').fill('إرسال عرض السعر المحدّث');
    await p.getByRole('button', { name: 'إضافة مهمة' }).click();
    await toast(p, 'أُضيفت المهمة');
    await p.getByRole('radio', { name: 'مكالمة' }).click();
    await p.getByLabel('التفاصيل').fill('ناقشنا الكمية: 2500 عبوة.');
    await p.getByRole('button', { name: 'تسجيل', exact: true }).click();
    await toast(p, 'سُجّل النشاط');
    await p.waitForTimeout(500);
    await shot(p, 'admin-6-contact', true);
  });

  await run('new contact form', async p => {
    await loginStaff(p, 'admin');
    await p.goto(B + '/admin/contacts', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /عميل جديد/ }).click();
    const dlg = p.getByRole('dialog');
    await dlg.locator('input[name=name]').fill('بدر السهلي');
    await dlg.locator('#nc-phone').fill('0551112222');
    await dlg.getByRole('button', { name: 'إضافة' }).click();
    await p.waitForURL(/\/admin\/contacts\/C-/);
    await p.getByRole('heading', { name: 'بدر السهلي' }).waitFor();
    const wa = await p.getByRole('link', { name: 'واتساب' }).getAttribute('href');
    if (wa !== 'https://wa.me/966551112222') throw new Error('wa normalise ' + wa);
  });

  await run('team: owner changes role → audited; self locked', async p => {
    await loginStaff(p, 'owner');
    await p.goto(B + '/admin/team', { waitUntil: 'networkidle' });
    if (await p.locator('#role-USR-OWNER').count()) throw new Error('owner can edit self');
    await p.locator('#role-USR-SALES2').selectOption('designer');
    await toast(p, 'حُدّث الدور');
    await p.getByLabel('بريد العضو').fill('new.hire@perfume.sa');
    await p.locator('main form select').selectOption('editor');
    await p.getByRole('button', { name: 'منح الدور' }).click();
    await toast(p, 'مُنح دور');
    await shot(p, 'admin-7-team', true);
    await p.goto(B + '/admin/audit', { waitUntil: 'networkidle' });
    const a = await p.locator('main').innerText();
    if (!a.includes('sales → designer') || !a.includes('client → editor')) throw new Error('audit missing');
    await shot(p, 'admin-8-audit');
  });

  await run('admin cannot grant owner (UI + rule)', async p => {
    await loginStaff(p, 'admin');
    await p.goto(B + '/admin/team', { waitUntil: 'networkidle' });
    const opts = await p.locator('main form select option').allTextContents();
    if (opts.some(o => o.includes('مالك'))) throw new Error('owner offered to admin');
    if (await p.locator('#role-USR-OWNER').count()) throw new Error('admin can edit owner');
  });

  await run('sales: limited (no assign, no audit, read-only team)', async p => {
    await loginStaff(p, 'sales');
    const nav = await p.getByRole('navigation').innerText();
    if (nav.includes('سجل التدقيق')) throw new Error('audit in nav');
    if (!nav.includes('صندوق الوارد')) throw new Error('inbox missing');
    await p.goto(B + '/admin/audit', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'هذه الصفحة خارج صلاحياتك' }).waitFor();
    await shot(p, 'admin-9-forbidden');
    await p.goto(B + '/admin/contacts/C-1003', { waitUntil: 'networkidle' });
    if (await p.getByLabel('المسؤول').locator('xpath=self::select').count()) throw new Error('sales sees owner select');
    await p.getByLabel('المرحلة').selectOption('contacted');
    await toast(p, 'حُدّثت المرحلة');
    await p.goto(B + '/admin/team', { waitUntil: 'networkidle' });
    if (await p.getByRole('button', { name: 'منح الدور' }).count()) throw new Error('sales can grant');
  });

  await run('designer: no CRM, tasks only', async p => {
    await loginStaff(p, 'designer');
    // «مشاريع العملاء» مسموح (مشاريعه المسندة)؛ أقسام الـCRM لا
    const links = (await p.getByRole('navigation').getByRole('link').allInnerTexts()).map((x) => x.replace(/\d+/g, '').trim());
    if (links.some((x) => ['صندوق الوارد', 'العملاء', 'المدفوعات'].includes(x))) throw new Error('crm nav visible: ' + links);
    if (!links.includes('مشاريع العملاء')) throw new Error('designer should see assigned projects');
    await p.goto(B + '/admin/inbox', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'هذه الصفحة خارج صلاحياتك' }).waitFor();
    await p.goto(B + '/admin', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'مهامي' }).waitFor();
    await shot(p, 'admin-10-designer');
  });

  await run('separation: client ↛ admin, staff ↛ account', async p => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'دخول كعميل تجريبي' }).click();
    await p.goto(B + '/admin/inbox', { waitUntil: 'networkidle' });
    if (!p.url().endsWith('/account')) throw new Error('client reached ' + p.url());
    await p.goto(B + '/admin/orders', { waitUntil: 'networkidle' });
    if (!p.url().endsWith('/account')) throw new Error('client reached legacy ' + p.url());
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await loginStaff(p, 'sales');
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    if (!/\/admin$/.test(p.url())) throw new Error('staff reached account ' + p.url());
    await p.goto(B + '/account/projects', { waitUntil: 'networkidle' });
    if (!/\/admin$/.test(p.url())) throw new Error('staff reached account/projects');
    // الصفحات النموذجية القديمة تحوّلت لصفحات فعلية
    await p.goto(B + '/admin/orders', { waitUntil: 'networkidle' });
    if (!/\/admin\/quotes$/.test(p.url())) throw new Error('legacy orders not redirected ' + p.url());
  });

  await run('legacy /dashboard links redirect', async p => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'دخول كعميل تجريبي' }).click();
    await p.waitForURL(u => !u.pathname.startsWith('/auth'));
    await p.goto(B + '/dashboard/projects?x=1', { waitUntil: 'networkidle' });
    if (!p.url().endsWith('/account/projects?x=1')) throw new Error(p.url());
  });

  await run('website booking → appears in admin inbox', async p => {
    await p.goto(B + '/book', { waitUntil: 'networkidle' });
    const days = p.getByRole('radiogroup').nth(0).getByRole('radio');
    for (let i = 0; i < await days.count(); i++) { await days.nth(i).click(); const free = p.getByRole('radiogroup').nth(1).locator('button:not([disabled])'); if (await free.count()) { await free.first().click(); break; } }
    await p.getByRole('button', { name: 'التالي' }).click();
    await p.fill('#b-first', 'جواهر'); await p.fill('#b-last', 'التميمي'); await p.fill('#b-email', 'jawaher@newbrand.sa');
    await p.getByRole('button', { name: 'تأكيد الحجز' }).click();
    await p.getByRole('status').waitFor();
    await loginStaff(p, 'owner');
    await p.goto(B + '/admin/inbox', { waitUntil: 'networkidle' });
    const row = p.locator('main ul button').filter({ hasText: 'جواهر التميمي' });
    if (!(await row.count())) throw new Error('booking not in inbox');
    const ov = await p.goto(B + '/admin', { waitUntil: 'networkidle' });
    if (!(await p.locator('main').innerText()).includes('جواهر التميمي')) throw new Error('not in needs-attention');
  });

  await run('mobile admin: menu + no overflow', async p => {
    await loginStaff(p, 'owner');
    await noOverflow(p, 390);
    await shot(p, 'admin-11-mobile-overview', true);
    await p.getByRole('button', { name: 'فتح القائمة' }).click();
    await p.getByRole('dialog').getByRole('link', { name: /صندوق الوارد/ }).click();
    await p.waitForURL('**/admin/inbox');
    await noOverflow(p, 390);
    await p.locator('main ul button').first().click();
    await p.getByRole('dialog').waitFor();
    await shot(p, 'admin-12-mobile-drawer');
    for (const r of ['/admin/pipeline', '/admin/contacts', '/admin/contacts/C-1006', '/admin/tasks', '/admin/payments', '/admin/team', '/admin/audit']) {
      await p.goto(B + r, { waitUntil: 'networkidle' });
      await noOverflow(p, 390).catch(e => { throw new Error(r + ' ' + e.message); });
    }
  }, mob);

  await run('English admin', async p => {
    await loginStaff(p, 'owner');
    if (await p.evaluate(() => document.documentElement.dir) !== 'ltr') throw new Error('dir');
    await p.goto(B + '/admin/pipeline', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'Pipeline' }).waitFor();
    await shot(p, 'admin-13-pipeline-en');
    await p.goto(B + '/admin/team', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'Permission matrix' }).waitFor();
    if (!(await p.title()).includes('Team · Admin')) throw new Error('title ' + await p.title());
  }, desk, 'en');

  console.log(results.join('\n'));
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
  await browser.close();
})();
