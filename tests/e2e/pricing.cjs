const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('admin');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [], errors = [];
  const mk = async (opts = {}, lang = 'ar') => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_i', '1'); } } catch {} }, lang);
    return ctx;
  };
  const run = async (name, ctx, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  // «ر.س» تحوي نقطة: نلتقط الرقم العشري نفسه
  const parse = (txt) => Number((txt.replace(/,/g, '').match(/\d+(\.\d+)?/) || ['NaN'])[0]);
  const price = async (p) => parse(await p.getByTestId('box-unit-price').innerText());
  // ننتظر تغيّر السعر بعد إجراء
  const changes = async (p, fn, cmp, label) => {
    const before = await price(p);
    await fn();
    await p.waitForFunction(([b, c]) => { const v = Number((document.querySelector('[data-testid=box-unit-price]').innerText.replace(/,/g, '').match(/\d+(\.\d+)?/) || ['NaN'])[0]); return c === 'up' ? v > b : v < b; }, [before, cmp], { timeout: 5000 }).catch(() => { throw new Error(`${label}: price did not go ${cmp} from ${before}`); });
  };

  const ctx = await mk();
  await run('price updates live with every design choice', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: /Tuck End/ }).click();
    const p0 = await price(p);
    if (!(p0 > 0.5 && p0 < 10)) throw new Error('tuck price ' + p0);
    // نفس السعر بجانب المعاينة
    const stat = await p.locator('dl').filter({ hasText: /للعلبة ×/ }).innerText();
    if (!stat.replace(/,/g, '').includes(p0.toFixed(2))) throw new Error('viewer stat differs: ' + stat + ' vs ' + p0);
    await changes(p, async () => { const h = p.getByLabel('الارتفاع', { exact: true }); await h.fill('180'); await h.press('Enter'); }, 'up', 'taller box');
    await changes(p, () => p.getByRole('radio', { name: 'حبر' }).click(), 'down', 'no foil');
    await changes(p, () => p.getByRole('radio', { name: 'أبيض' }).click(), 'down', 'white board');
    await changes(p, () => p.getByRole('radio', { name: /علبة مغناطيسية/ }).click(), 'up', 'magnetic');
    await changes(p, () => p.getByRole('group', { name: 'كميات شائعة' }).getByRole('button', { name: /^5,000$/ }).click(), 'down', 'qty 5000');
    if (!/لـ 5,000 علبة/.test(await p.getByTestId('box-total').innerText())) throw new Error('total text');
    const q = p.getByLabel('الكمية', { exact: true });
    await q.fill('100'); await q.press('Enter');
    await p.getByRole('alert').filter({ hasText: /أقل كمية لهذا النوع/ }).waitFor();
    await p.getByText('كيف حُسب السعر؟').click();
    const bd = await p.getByTestId('box-breakdown').innerText();
    for (const s of ['الكرتون والخامة', 'الطباعة', 'التشطيب', 'التجميع واللصق', 'قالب القص والتكسير', 'م²']) if (!bd.includes(s)) throw new Error('breakdown missing ' + s);
    await q.fill('2500'); await q.press('Enter');
    // الحفظ في المتصفح مؤجّل: ننتظر وصول الكمية للتخزين بدل مهلة ثابتة (تتأخر تحت الحمل)
    await p.waitForFunction(() => /"qty":2500/.test(localStorage.getItem('pp_box_v1') || ''), null, { timeout: 10000 });
  });

  await run('cost calculator uses the studio box', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: 'تكلفة العطر كاملة' }).click();
    await p.waitForURL(/\/pricing\?qty=2500&box=1/);
    const card = p.getByTestId('studio-box');
    await card.getByText(/علبتك من الاستوديو: علبة مغناطيسية/).waitFor();
    const total = () => p.locator('aside').getByText(/الإجمالي التقديري/).locator('..').innerText();
    const n = (x) => Number(x.replace(/[^\d]/g, ''));
    const withBox = await total();
    if (!(await p.getByText('تجهيز العلبة (قالب وألواح)').count())) throw new Error('setup line missing');
    await card.getByRole('checkbox', { name: 'احسب بعلبتي' }).uncheck();
    await p.waitForFunction(() => !document.body.innerText.includes('تجهيز العلبة (قالب وألواح)'), null, { timeout: 5000 });
    const generic = await total();
    // التجهيز وحده (قالب + ألواح) أكثر من 900 ريال
    if (!(n(withBox) - n(generic) > 900)) throw new Error(`total should include the box setup: ${withBox} vs ${generic}`);
  });

  const fresh = await mk();
  await run('calculator without a studio box invites designing one', fresh, async p => {
    await p.goto(B + '/pricing', { waitUntil: 'networkidle' });
    await p.getByTestId('studio-box-cta').click();
    await p.waitForURL(/\/studio-3d\?tab=box/);
  });

  await run('admin changes rates in the CMS (editor cannot); the studio follows', ctx, async p => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    // المحرر لا يرى وثيقة الأسعار (pricing.manage للمالك والمدير)
    await p.getByLabel(/الدور التجريبي/).selectOption('editor');
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin$/);
    await p.goto(B + '/admin/cms?doc=pricing', { waitUntil: 'networkidle' });
    if (await p.getByTestId('pricing-sample').count()) throw new Error('editor reached the price list');
    await p.evaluate(() => localStorage.removeItem('pp_session_email'));
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    await p.getByLabel(/الدور التجريبي/).selectOption('admin');
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin$/);
    await p.goto(B + '/admin/cms?doc=pricing', { waitUntil: 'networkidle' });
    const sample = p.getByTestId('pricing-sample');
    const before = await sample.innerText();
    await p.getByLabel('مغناطيسية · التجميع لكل علبة').fill('12');
    await p.waitForFunction((b) => document.querySelector('[data-testid=pricing-sample]').innerText !== b, before);
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await p.getByRole('status').filter({ hasText: /نُشر في الموقع/ }).first().waitFor();
    const s = await p.context().newPage();
    await s.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    const v = parse(await s.getByTestId('box-unit-price').innerText());
    // تصميمنا مغناطيسي: التجميع ارتفع من 5.5 إلى 12 → السعر يرتفع 6.5 تقريباً (بعد خصم 15% عند 2500)
    const bd = await (async () => { await s.getByText('كيف حُسب السعر؟').click(); return s.getByTestId('box-breakdown').innerText(); })();
    if (!/12\.00/.test(bd)) throw new Error('assembly rate not applied: ' + bd);
    if (!(v > 10)) throw new Error('price ' + v);
    await s.close();
  });

  const mob = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await run('mobile: price card and calculator fit', mob, async p => {
    for (const path of ['/studio-3d?tab=box', '/pricing?qty=1000&box=1']) {
      await p.goto(B + path, { waitUntil: 'networkidle' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) throw new Error(path + ' overflow ' + ov);
    }
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByTestId('box-unit-price').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/mobile-price.png` });
  });

  const en = await mk({}, 'en');
  await run('English price card', en, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByText('Estimated price per box').waitFor();
    if (!/^SAR \d/.test(await p.getByTestId('box-unit-price').innerText())) throw new Error('format');
    await p.getByRole('link', { name: 'Full product cost' }).waitFor();
  });

  await run('box changed then calculator opened immediately: the latest box is used', await mk(), async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: /علبة مغناطيسية/ }).waitFor();
    // النقرتان في اللحظة نفسها: الانتقال قبل انقضاء مهلة الحفظ المؤجّل
    await p.evaluate(() => {
      [...document.querySelectorAll('[role=radio]')].find((x) => /علبة مغناطيسية/.test(x.textContent || x.getAttribute('aria-label') || '')).click();
      [...document.querySelectorAll('a')].find((x) => x.textContent.includes('تكلفة العطر كاملة')).click();
    });
    await p.waitForURL(/\/pricing\?/);
    await p.getByTestId('studio-box').getByText(/علبتك من الاستوديو: علبة مغناطيسية/).waitFor();
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
