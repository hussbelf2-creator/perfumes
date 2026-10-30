const { chromium, OUT, url, FIX } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const run = async (name, vp, lang, fn, video) => {
    const ctx = await browser.newContext({ viewport: vp, ...(video ? { recordVideo: { dir: OUT + '/video', size: vp } } : {}) });
    await ctx.addInitScript(l => { try { localStorage.setItem('pp_lang', l); } catch {} }, lang);
    const page = await ctx.newPage();
    const posted = [];
    await page.route(/readdy\.ai\/api\/form/, async r => { posted.push(decodeURIComponent((r.request().postData() || '').replace(/\+/g, ' '))); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }); });
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    try { await fn(page, posted); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }); }
    await ctx.close();
  };
  const B = url('site');
  const desk = { width: 1440, height: 900 }, mob = { width: 390, height: 844 };
  const noOverflow = async (p, w) => { const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > w) throw new Error('overflow ' + sw); };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const book = (lang, vp, tag) => async (p, posted) => {
    const ar = lang === 'ar';
    await p.goto(B + '/book?track=B', { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${OUT}/book-1-${tag}.png`, fullPage: true });
    const next = p.getByRole('button', { name: ar ? 'التالي' : 'Next' });
    if (await next.isEnabled()) throw new Error('next enabled without slot');
    const days = p.getByRole('radiogroup').nth(0).getByRole('radio');
    let picked = false;
    for (let i = 0; i < await days.count() && !picked; i++) {
      await days.nth(i).click();
      const free = p.getByRole('radiogroup').nth(1).locator('button:not([disabled])');
      if (await free.count()) { await free.first().click(); picked = true; }
    }
    if (!picked) throw new Error('no free slot');
    await p.getByRole('radio', { name: ar ? 'واتساب' : 'WhatsApp' }).click();
    await noOverflow(p, vp.width);
    await p.screenshot({ path: `${OUT}/book-2-${tag}.png`, fullPage: true });
    await next.click();
    if (await p.locator('#b-track').inputValue() !== 'B') throw new Error('track not prefilled');
    await p.fill('#b-first', ar ? 'سارة' : 'Sara');
    await p.fill('#b-last', ar ? 'العتيبي' : 'Otaibi');
    await p.fill('#b-email', 'sara@example.com');
    await p.getByRole('button', { name: ar ? 'تأكيد الحجز' : 'Confirm booking' }).click();
    if (posted.length) throw new Error('submitted without phone');
    await p.fill('#b-phone', '+966 55 123 4567');
    await p.screenshot({ path: `${OUT}/book-3-${tag}.png`, fullPage: true });
    await p.getByRole('button', { name: ar ? 'تأكيد الحجز' : 'Confirm booking' }).click();
    await p.getByRole('status').waitFor();
    const body = posted.join('\n');
    for (const k of ['slot_utc', 'slot_riyadh', 'whatsapp', 'sara@example.com', 'request_type=discovery_call']) if (!body.includes(k)) throw new Error('payload missing ' + k);
    const g = await p.getByRole('link', { name: /Google Calendar/ }).getAttribute('href');
    if (!/calendar\.google\.com.*dates=\d{8}T\d{6}Z(%2F|\/)\d{8}T\d{6}Z/.test(g)) throw new Error('bad gcal ' + g);
    const ics = await p.getByRole('link', { name: /Apple/ }).getAttribute('href');
    if (!ics.startsWith('data:text/calendar')) throw new Error('bad ics');
    await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/book-4-${tag}.png`, fullPage: true });
  };
  await run('book flow AR desktop', desk, 'ar', book('ar', desk, 'ar-desk'), true);
  await run('book flow EN mobile', mob, 'en', book('en', mob, 'en-mob'), true);

  const kit = (lang, vp, tag) => async (p, posted) => {
    const ar = lang === 'ar';
    await p.goto(B + '/discovery-kit', { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${OUT}/kit-1-${tag}.png`, fullPage: true });
    const flow = p.locator('#kit-flow');
    for (const opt of ar ? ['عودي وشرقي', 'قوي وفوّاح', 'رجالي', 'أكثر من 450 ر.س'] : ['Oud & oriental', 'Bold, long trail', 'Men', 'Over SAR 450']) {
      await flow.getByRole('radio', { name: new RegExp('^' + esc(opt)) }).click();
    }
    await flow.getByText(ar ? 'عود دخاني' : 'Smoked oud').waitFor();
    if (!(await flow.innerText()).includes(ar ? 'إكستريه' : 'Extrait')) throw new Error('intensity note missing');
    await noOverflow(p, vp.width);
    await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/kit-2-${tag}.png`, fullPage: true });
    await flow.getByRole('button', { name: ar ? /اطلب العينات/ : /Order the kit/ }).click();
    await p.fill('#k-first', ar ? 'خالد' : 'Khalid');
    await p.fill('#k-last', ar ? 'الحربي' : 'Harbi');
    await p.fill('#k-phone', '+966 50 000 0000');
    await p.fill('#k-email', 'k@example.com');
    await p.selectOption('#k-city', 'Jeddah');
    await p.fill('#k-address', ar ? 'حي الروضة' : 'Al Rawdah');
    await p.screenshot({ path: `${OUT}/kit-3-${tag}.png`, fullPage: true });
    await flow.getByRole('button', { name: ar ? 'أكّد الطلب' : 'Place order' }).click();
    await p.getByRole('status').waitFor();
    const body = posted.join('\n');
    for (const k of ['family=oud', 'intensity=bold', 'Smoked oud', 'Jeddah', 'request_type=discovery_kit']) if (!body.includes(k)) throw new Error('payload missing ' + k);
    await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/kit-4-${tag}.png`, fullPage: true });
  };
  await run('kit flow AR mobile', mob, 'ar', kit('ar', mob, 'ar-mob'), true);
  await run('kit flow EN desktop', desk, 'en', kit('en', desk, 'en-desk'), true);

  await run('home entry offers + CTAs AR', desk, 'ar', async p => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.locator('#entry-title').scrollIntoViewIfNeeded();
    await p.waitForTimeout(1200);
    await p.locator('section[aria-labelledby="entry-title"]').screenshot({ path: `${OUT}/home-offers-ar.png` });
    if (!(await p.getByRole('link', { name: 'مكالمة مجانية', exact: true }).count())) throw new Error('nav CTA');
    await p.getByRole('link', { name: 'اختر موعدك' }).click();
    await p.waitForURL('**/book');
    await p.goto(B + '/services/C', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: 'تحدّث مع خبير أولاً' }).first().click();
    await p.waitForURL('**/book?track=C');
  });
  await run('home entry offers EN mobile + titles', mob, 'en', async p => {
    await p.goto(B + '/', { waitUntil: 'networkidle' });
    await p.locator('#entry-title').scrollIntoViewIfNeeded();
    await p.waitForTimeout(1200);
    await p.locator('section[aria-labelledby="entry-title"]').screenshot({ path: `${OUT}/home-offers-en-mob.png` });
    await noOverflow(p, 390);
    await p.goto(B + '/discovery-kit', { waitUntil: 'networkidle' });
    if (!(await p.title()).includes('Discovery kit')) throw new Error('title ' + await p.title());
    await p.goto(B + '/book', { waitUntil: 'networkidle' });
    if (!(await p.title()).includes('discovery call')) throw new Error('title ' + await p.title());
  });

  console.log(results.join('\n'));
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
