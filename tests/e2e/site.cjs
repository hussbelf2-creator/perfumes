const { chromium, OUT, url, FIX } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch();
  const results = [];
  const errors = [];
  const run = async (name, vp, fn) => {
    const ctx = await browser.newContext({ viewport: vp, locale: 'ar-SA' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/readdy|ERR_|net::|Failed to load resource/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(page); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
    await ctx.close();
  };
  const B = url('site');
  const desk = { width: 1440, height: 900 }, mob = { width: 390, height: 844 };

  await run('home desktop', desk, async p => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { level: 1 }).waitFor();
    const h1 = await p.getByRole('heading', { level: 1 }).innerText();
    if (!h1.includes('براندك العطري')) throw new Error('hero h1 ' + h1);
    const body = await p.locator('body').innerText();
    for (const bad of ['+200', '98%', 'المنصة الأولى', '+966 50 123', 'alfajr']) if (body.includes(bad)) throw new Error('claim still present: ' + bad);
    await p.screenshot({ path: OUT + '/home-desktop.png' });
  });
  await run('home mobile + menu', mob, async p => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.screenshot({ path: OUT + '/home-mobile.png' });
    await p.getByRole('button', { name: 'فتح القائمة' }).click();
    await p.locator('#mobile-menu').waitFor();
    const n = await p.locator('#mobile-menu').getByRole('link', { name: 'عن المنصة', exact: true }).count();
    if (n !== 1) throw new Error('duplicate about link count=' + n);
    await p.screenshot({ path: OUT + '/menu-mobile.png' });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 390) throw new Error('horizontal overflow ' + sw);
  });
  await run('deep link /services (SPA)', desk, async p => {
    const r = await p.goto(B + '/services', { waitUntil: 'networkidle' });
    if (r.status() !== 200) throw new Error('status ' + r.status());
    if (!(await p.title()).includes('الخدمات')) throw new Error('title ' + await p.title());
  });
  await run('admin blocked for guest', desk, async p => {
    await p.goto(B + '/admin', { waitUntil: 'networkidle' });
    if (!p.url().includes('/auth')) throw new Error('not redirected: ' + p.url());
  });
  await run('pricing public', desk, async p => {
    await p.goto(B + '/pricing', { waitUntil: 'networkidle' });
    if (p.url().includes('/auth')) throw new Error('redirected to auth');
    await p.getByText('كم تكلّف زجاجتك').first().waitFor();
    await p.screenshot({ path: OUT + '/pricing.png', fullPage: false });
  });
  await run('register -> logout -> wrong pw rejected -> right pw ok', desk, async p => {
    await p.goto(B + '/auth?mode=register', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم الأول').fill('سارة');
    await p.getByLabel('اسم العائلة').fill('أحمد');
    await p.getByLabel('البريد الإلكتروني').fill('Sara@Test.com');
    await p.getByLabel('كلمة المرور', { exact: true }).fill('secret123');
    await p.screenshot({ path: OUT + '/register.png' });
    await p.locator('form button[type=submit]').click();
    await p.waitForURL(/\/services/);
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel('البريد الإلكتروني').fill('sara@test.com');
    await p.getByLabel('كلمة المرور', { exact: true }).fill('WRONG-pass');
    await p.locator('form button[type=submit]').click();
    await p.getByRole('alert').waitFor();
    if (p.url().includes('/services')) throw new Error('wrong password accepted');
    await p.getByLabel('كلمة المرور', { exact: true }).fill('secret123');
    await p.locator('form button[type=submit]').click();
    await p.waitForURL(/\/services/);
    await p.goto(B + '/admin', { waitUntil: 'networkidle' });
    if (p.url().includes('/admin')) throw new Error('client reached admin');
  });
  await run('dashboard renders (demo client)', desk, async p => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'دخول كعميل تجريبي' }).click();
    await p.waitForURL(/\/services/);
    await p.goto(B + '/dashboard', { waitUntil: 'networkidle' });
    await p.screenshot({ path: OUT + '/dashboard.png' });
  });
  await run('admin hidden in prod build (no demo admin button)', desk, async p => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    if (await p.getByRole('button', { name: /دخول كمالك المنصة|دخول كفريق المنصة/ }).count()) throw new Error('demo team login visible with VITE_ENABLE_DEMO_ADMIN=false');
  });
  await run('legacy demo routes redirect to the real platform', desk, async p => {
    const cases = [['/brand-creation', /\/services\/A$/], ['/visual-identity', /\/services\/D$/], ['/manufacturing', /\/services\/E$/], ['/workflow', /\/services$/], ['/packaging-customizer', /\/studio-3d\?tab=box$/], ['/packaging', /\/studio-3d\?tab=box$/]];
    for (const [from, to] of cases) {
      await p.goto(B + from, { waitUntil: 'networkidle' });
      if (!to.test(p.url())) throw new Error(from + ' -> ' + p.url());
    }
  });
  await run('legal pages, footer links and consent lines', desk, async p => {
    for (const [path, title] of [['/privacy', 'سياسة الخصوصية'], ['/terms', 'الشروط والأحكام'], ['/refund', 'سياسة الإلغاء والاسترجاع']]) {
      await p.goto(B + path, { waitUntil: 'networkidle' });
      await p.getByRole('heading', { level: 1, name: title }).waitFor();
      if ((await p.locator('main section h2').count()) < 5) throw new Error(path + ' sections');
      if (/\{\w+\}/.test(await p.locator('main').innerText())) throw new Error(path + ' unfilled variable');
    }
    if ((await p.title()).indexOf('الإلغاء') < 0) throw new Error('title ' + await p.title());
    await p.locator('footer').getByRole('link', { name: 'الخصوصية' }).click();
    await p.waitForURL(/\/privacy$/);
    await p.goto(B + '/auth?mode=register', { waitUntil: 'networkidle' });
    const c = p.getByTestId('legal-consent');
    await c.waitFor();
    if ((await c.getByRole('link').count()) !== 2) throw new Error('consent links');
  });
  await run('404 arabic', desk, async p => {
    await p.goto(B + '/nope', { waitUntil: 'networkidle' });
    await p.getByText('الصفحة غير موجودة').waitFor();
  });
  await run('contact page', mob, async p => {
    await p.goto(B + '/contact', { waitUntil: 'networkidle' });
    await p.screenshot({ path: OUT + '/contact-mobile.png', fullPage: true });
  });
  console.log(results.join('\n'));
  console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
  await browser.close();
})();
