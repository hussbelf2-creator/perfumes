const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const run = async (name, fn, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await ctx.close();
  };
  const staff = async (p, role, lang = 'ar') => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.evaluate((l) => localStorage.setItem('pp_lang', l), lang);
    await p.reload({ waitUntil: 'networkidle' });
    await p.getByLabel(/الدور التجريبي|Demo role/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة|Continue as platform staff/i }).click();
    await p.waitForURL(/\/admin$/);
  };
  await run('owner: reports render with sections; empty funnel explained', async (p) => {
    await staff(p, 'owner');
    await p.getByRole('navigation', { name: 'لوحة الإدارة' }).getByRole('link', { name: 'التقارير' }).click();
    await p.getByRole('heading', { name: 'التقارير' }).waitFor();
    for (const s of ['القمع: طلبات الفترة إلى أين وصلت؟', 'يحتاج تدخلاً اليوم', 'حسب المسار', 'المحصّل أسبوعياً']) await p.getByText(s).first().waitFor();
    await p.getByText('لا طلبات في هذه الفترة').waitFor();
    if ((await p.locator('tr[data-track]').count()) !== 7) throw new Error('tracks (6 + personal)');
  });
  await run('owner: quotes page', async (p) => {
    await staff(p, 'owner');
    await p.goto(B + '/admin/quotes', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'عروض الأسعار' }).waitFor();
    await p.getByText('لا عروض هنا').waitFor();
  });
  for (const role of ['designer', 'editor', 'production']) {
    await run(`${role}: no reports or quotes`, async (p) => {
      await staff(p, role);
      const nav = p.getByRole('navigation', { name: 'لوحة الإدارة' });
      if (await nav.getByRole('link', { name: 'التقارير' }).count()) throw new Error('reports in nav');
      if (await nav.getByRole('link', { name: 'عروض الأسعار' }).count()) throw new Error('quotes in nav');
      await p.goto(B + '/admin/reports', { waitUntil: 'networkidle' });
      if (await p.getByRole('heading', { name: 'التقارير' }).count()) throw new Error('reports reachable');
    });
  }
  await run('English reports: no Arabic UI text', async (p) => {
    await staff(p, 'admin', 'en');
    await p.goto(B + '/admin/reports', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'Reports' }).waitFor();
    const txt = await p.locator('main').innerText();
    const ar = txt.match(/[؀-ۿ]+/g)?.filter((w) => !['براند', 'عطري', 'كامل', 'تطوير', 'عطر', 'عبوة', 'وتغليف', 'هوية', 'بصرية', 'تصنيع', 'طباعة', 'وتنفيذ'].includes(w));
    if (ar?.length) throw new Error('Arabic: ' + ar.slice(0, 5).join(' '));
  });
  await run('mobile: reports and quotes fit', async (p) => {
    await staff(p, 'owner');
    for (const u of ['/admin/reports', '/admin/quotes']) {
      await p.goto(B + u, { waitUntil: 'networkidle' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov) throw new Error(`${u} overflow ${ov}`);
    }
  }, { viewport: { width: 375, height: 812 } });
  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
