// المخزون والتسعير في الوضع التجريبي: الصلاحيات، والدورة كاملة، والإنجليزية، والجوال
const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', 'ar'); sessionStorage.setItem('_i', '1'); } } catch {} });
  await ctx.route(/readdy\.ai\/api\/form/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
  const run = async (name, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 8000 });
  const as = async (p, role) => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel(/الدور التجريبي|Demo role/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة|Continue as platform staff/ }).click();
    await p.waitForURL(/\/admin$/);
    await p.getByRole('navigation', { name: /لوحة الإدارة|Admin/ }).getByRole('link', { name: /نظرة عامة|Overview/ }).waitFor();
  };
  const nav = (p) => p.getByRole('navigation', { name: /لوحة الإدارة|Admin/ });

  await run('permissions by role: stock and pricing', async (p) => {
    const want = { owner: [true, true, true], admin: [true, true, true], sales: [true, false, false], production: [true, true, false], designer: [false, false, false], editor: [false, false, false] };
    for (const [role, [view, manage, pricing]] of Object.entries(want)) {
      await as(p, role);
      if ((await nav(p).getByRole('link', { name: 'المخزون' }).count() > 0) !== view) throw new Error(`${role} stock nav`);
      if ((await nav(p).getByRole('link', { name: 'التسعير والربحية' }).count() > 0) !== pricing) throw new Error(`${role} pricing nav`);
      if (view) {
        await p.goto(B + '/admin/inventory', { waitUntil: 'networkidle' });
        if ((await p.getByRole('button', { name: 'مادة جديدة' }).count() > 0) !== manage) throw new Error(`${role} manage button`);
      }
      if (role === 'editor') {
        await p.goto(B + '/admin/cms?doc=pricing', { waitUntil: 'networkidle' });
        if (await p.getByTestId('pricing-sample').count()) throw new Error('editor reached the price list');
        if (await p.getByRole('tab', { name: /الأسعار/ }).count()) throw new Error('editor sees pricing tab');
      }
    }
  });

  await run('demo cycle: stock → quote with discount & cost → paid → reserved → issued → project cost', async (p) => {
    await as(p, 'production');
    await p.goto(B + '/admin/inventory', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'مادة جديدة' }).click();
    const d = p.getByRole('dialog');
    await d.getByLabel('رمز المادة (SKU)').fill('BOX-MAG');
    await d.getByLabel('الاسم').fill('علبة مغناطيسية سوداء');
    await d.getByLabel('الفئة').selectOption({ label: 'علب' });
    await d.getByLabel('حد إعادة الطلب').fill('100');
    await d.getByRole('button', { name: 'حفظ المادة' }).click();
    await toast(p, /حُفظت المادة/);
    await p.getByRole('button', { name: /علبة مغناطيسية سوداء/ }).click();
    const dr = p.getByRole('dialog');
    await dr.getByLabel(/^الكمية/).fill('300');
    await dr.getByLabel('تكلفة الوحدة (ر.س)').fill('12');
    await dr.getByRole('button', { name: 'سجّل الحركة' }).click();
    await toast(p, /سُجّلت الحركة/);
    await dr.getByTestId('drawer-avg').filter({ hasText: '12.00' }).waitFor();
    // owner: project + quote
    await as(p, 'owner');
    await p.goto(B + '/admin/projects?new=1', { waitUntil: 'networkidle' });
    const dlg = p.getByRole('dialog');
    await dlg.getByLabel('اسم المشروع').fill('طقم هدايا');
    await dlg.getByLabel('بريد العميل').fill('gift@demo.test');
    await dlg.getByRole('button', { name: 'إنشاء المشروع' }).click();
    await p.waitForURL(/\/admin\/projects\/[0-9a-f-]{36}$/);
    const path = new URL(p.url()).pathname;
    await p.getByRole('button', { name: 'أنشئ عرض السعر' }).click();
    await p.getByLabel('مادة البند 1 من المخزون').selectOption({ label: 'BOX-MAG · علبة مغناطيسية سوداء' });
    await p.getByLabel('كمية البند 1').fill('250');
    await p.getByLabel('سعر وحدة البند 1').fill('40');
    await p.getByLabel('نوع الخصم').selectOption('amount');
    await p.getByLabel('قيمة الخصم').fill('1000');
    // 10,000 − 1,000 = 9,000 ؛ التكلفة 250 × 12 = 3,000 ← ربح 6,000 (66.7%)
    await p.getByTestId('editor-profit').filter({ hasText: '6,000.00' }).waitFor();
    await p.getByTestId('editor-margin').filter({ hasText: '66.7' }).waitFor();
    await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await toast(p, /أُرسل العرض للعميل/);
    await p.getByRole('button', { name: 'تسجيل دفعة مستلمة' }).click();
    await p.getByLabel('المرجع').fill('TRX-9');
    await p.getByRole('button', { name: 'تأكيد الاستلام' }).click();
    await toast(p, /سُجّلت الدفعة/);
    await p.getByRole('button', { name: 'صرف 250' }).click();
    await toast(p, /صُرفت المواد/);
    await p.getByTestId('actual-cost').filter({ hasText: '3,000.00' }).waitFor();
    await p.getByTestId('actual-profit').filter({ hasText: /6,000.00 ر.س · 66.7%/ }).waitFor();
    await p.goto(B + '/admin/inventory', { waitUntil: 'networkidle' });
    if ((await p.locator('tr[data-sku="BOX-MAG"] [data-available]').getAttribute('data-available')) !== '50') throw new Error('available after issue');
    await p.getByTestId('low-count').filter({ hasText: '1' }).waitFor();
    // تقرير: مواد تحتاج إعادة طلب
    await p.goto(B + '/admin/reports', { waitUntil: 'networkidle' });
    await p.getByRole('region', { name: 'مواد تحتاج إعادة طلب' }).getByText('BOX-MAG · علبة مغناطيسية سوداء').waitFor();
    void path;
  });

  await run('owner: policy and coupons (demo)', async (p) => {
    await as(p, 'owner');
    await p.goto(B + '/admin/pricing', { waitUntil: 'networkidle' });
    await p.getByLabel(/سقف خصم مبيعات/).fill('15');
    await p.getByRole('button', { name: 'حفظ السياسة' }).click();
    await toast(p, /حُفظت السياسة/);
    await p.getByLabel('الكود').fill('WELCOME');
    await p.getByLabel('النوع').selectOption('amount');
    await p.getByLabel('القيمة').fill('100');
    await p.getByRole('button', { name: 'أنشئ الكوبون' }).click();
    await toast(p, /أُنشئ الكوبون/);
    await p.locator('[data-coupon="WELCOME"]').getByRole('button', { name: 'تعطيل' }).click();
    await toast(p, /عُطّل الكوبون/);
    await p.locator('[data-coupon="WELCOME"]').getByText('معطّل').waitFor();
    await p.getByLabel('الكود').fill('WELCOME');
    await p.getByRole('button', { name: 'أنشئ الكوبون' }).click();
    await p.getByText('هذا الكود مستخدم.').first().waitFor();
  });

  await run('English stock & pricing; mobile fit', async (p) => {
    await as(p, 'owner');
    await p.evaluate(() => localStorage.setItem('pp_lang', 'en'));
    for (const u of ['/admin/inventory', '/admin/pricing']) {
      await p.goto(B + u, { waitUntil: 'networkidle' });
      const txt = (await p.locator('main').innerText()).replace(/علبة مغناطيسية سوداء|طقم هدايا/g, '');
      if (/[؀-ۿ]/.test(txt)) throw new Error('Arabic in ' + u + ': ' + txt.match(/[؀-ۿ]+/g).slice(0, 4).join(' '));
    }
    await p.evaluate(() => localStorage.setItem('pp_lang', 'ar'));
    await p.setViewportSize({ width: 375, height: 812 });
    for (const u of ['/admin/inventory', '/admin/pricing', '/admin/cms?doc=pricing']) {
      await p.goto(B + u, { waitUntil: 'networkidle' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov) throw new Error(`${u} overflow ${ov}`);
    }
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
