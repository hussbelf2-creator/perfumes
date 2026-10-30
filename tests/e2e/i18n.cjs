const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('site');
(async () => {
  const b = await chromium.launch();
  const results = [], errors = [];
  const run = async (name, vp, fn) => {
    const ctx = await b.newContext({ viewport: vp });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    try { await fn(p); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
    await ctx.close();
  };
  const D = { width: 1440, height: 900 }, M = { width: 390, height: 844 };
  await run('toggle switches to English + LTR, persists', D, async p => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'Switch to English' }).first().click();
    if (await p.evaluate(() => document.documentElement.dir) !== 'ltr') throw new Error('dir not ltr');
    const h1 = await p.locator('h1').innerText();
    if (!h1.includes('Your fragrance brand')) throw new Error('h1 ' + h1);
    await p.reload({ waitUntil: 'networkidle' });
    if (await p.evaluate(() => document.documentElement.lang) !== 'en') throw new Error('not persisted');
  });
  await run('?lang=en deep link, services EN', D, async p => {
    await p.goto(B + '/services?lang=en', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: /What does each track include/ }).waitFor();
    if (!(await p.title()).includes('Services')) throw new Error('title ' + await p.title());
  });
  await run('service detail EN + all 6 tracks render', D, async p => {
    for (const id of ['A','B','C','D','E','F']) {
      await p.goto(`${B}/services/${id}?lang=en`, { waitUntil: 'networkidle' });
      await p.locator('#packages').waitFor();
      const body = await p.locator('main, body').first().innerText();
      if (/[؀-ۿ]{3,}/.test(await p.locator('h1').innerText())) throw new Error('arabic h1 on ' + id);
    }
  });
  await run('chooser recommends track', D, async p => {
    await p.goto(B + '/services?lang=ar', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: 'لدي عطر وأحتاج العبوة' }).click();
    await p.getByText('المسار المقترح لك').waitFor();
    await p.getByRole('link', { name: 'اعرض المسار' }).click();
    await p.waitForURL(/services\/C/);
  });
  await run('pricing math (1000, standard)', D, async p => {
    await p.goto(B + '/pricing?lang=en', { waitUntil: 'networkidle' });
    const txt = await p.locator('aside').innerText();
    // base 63 * 0.92 = 57.96 -> SAR 58
    if (!txt.includes('SAR 58')) throw new Error('unit ' + txt.slice(0, 120));
  });
  // المرحلة 7: لوحة العميل حقيقية (بلا بيانات نموذجية)، والصفحات النموذجية القديمة تُحوَّل
  await run('client dashboard EN: real empty state, no Arabic in headings', D, async p => {
    await p.goto(B + '/auth?lang=en'); await p.getByRole('button', { name: 'Continue as demo client' }).click(); await p.waitForURL(/services/);
    await p.goto(B + '/dashboard', { waitUntil: 'networkidle' });
    await p.getByText('No projects in your account yet').waitFor();
    const heads = (await p.locator('main h1, main h2, nav').allInnerTexts()).join(' ');
    if (/[\u0600-\u06FF]{3,}/.test(heads.replace(/منصة العطور|عميل تجريبي|عميل/g, ''))) throw new Error('Arabic in EN dashboard: ' + heads);
  });
  await run('legacy sample pages redirect to the real account', D, async p => {
    await p.goto(B + '/auth?lang=en'); await p.getByRole('button', { name: 'Continue as demo client' }).click(); await p.waitForURL(/services/);
    await p.goto(B + '/dashboard/messages', { waitUntil: 'networkidle' });
    if (!/\/account\/projects$/.test(new URL(p.url()).pathname)) throw new Error(p.url());
    await p.getByRole('heading', { name: 'My projects' }).waitFor();
  });
  for (const lang of ['ar', 'en']) for (const path of ['/', '/services', '/services/A', '/pricing', '/faq', '/auth']) {
    await run(`no h-overflow mobile ${lang} ${path}`, M, async p => {
      await p.goto(`${B}${path}${path.includes('?') ? '&' : '?'}lang=${lang}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(400);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > 391) throw new Error('scrollWidth ' + sw);
    });
  }
  console.log(results.join('\n')); console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
