// مواصفات التصنيع في الاستوديو: خيارات العبوة، الملاءمة الذكية للعلبة، الملحقات، جاهزية الملصق — ومتطلبات التصنيع والتصدير في الصفحات
const { chromium, OUT, url } = require('./lib.cjs');
const B = url('site');
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

  await run('bottle options live in the URL, price the bottle and reach the summary', async (p) => {
    await p.goto(B + '/studio-3d', { waitUntil: 'networkidle' });
    await p.getByTestId('bottle-spec').waitFor();
    await p.getByRole('radio', { name: /غطاء مغناطيسي/ }).click();
    await p.getByRole('radio', { name: /نقش ليزر/ }).click();
    await p.waitForURL(/cm=magnetic/);
    if (!/dc=laser/.test(p.url())) throw new Error('decoration not in url');
    await p.getByText('إضافة الخيارات: 4.60 ر.س لكل عبوة').waitFor();
    const sum = await p.locator('section[aria-label="خيارات التصميم"] p').filter({ hasText: /^أطلس/ }).first().innerText();
    if (!sum.includes('غطاء مغناطيسي') || !sum.includes('نقش ليزر')) throw new Error('summary ' + sum);
    // يعود كما هو من الرابط
    await p.reload({ waitUntil: 'networkidle' });
    if ((await p.getByRole('radio', { name: /غطاء مغناطيسي/ }).getAttribute('aria-checked')) !== 'true') throw new Error('spec lost on reload');
  });

  await run('smart fit: ok when auto-fitted, tight when the inner height shrinks, suggests the style for the size', async (p) => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    const fit = p.getByTestId('smart-fit');
    await fit.waitFor();
    if ((await fit.getAttribute('data-level')) !== 'ok') throw new Error('default box should fit');
    // 50 مل: الاقتراح علبة صلبة بدل البلسان
    await fit.getByText(/ننصح بـ«علبة صلبة بغطاء»/).waitFor();
    await p.getByLabel('الارتفاع').fill('90');
    await p.getByLabel('الارتفاع').press('Enter');
    await p.waitForFunction(() => document.querySelector('[data-testid=smart-fit]')?.dataset.level === 'tight');
    await fit.getByRole('button', { name: 'طابق المقاس تلقائياً' }).click();
    await p.waitForFunction(() => document.querySelector('[data-testid=smart-fit]')?.dataset.level === 'ok');
    await p.getByLabel('العرض').fill('120');
    await p.getByLabel('العرض').press('Enter');
    await p.waitForFunction(() => document.querySelector('[data-testid=smart-fit]')?.dataset.level === 'loose');
    await fit.getByRole('button', { name: 'اعتمد المقترح' }).click();
    await p.waitForFunction(() => document.querySelector('[data-testid=smart-fit]')?.dataset.level === 'ok');
    if ((await p.getByRole('radio', { name: /علبة صلبة بغطاء/ }).getAttribute('aria-checked')) !== 'true') throw new Error('suggested style not applied');
  });

  await run('extras: recommendations follow the box, one insert at a time, priced into the box and kept in the summary', async (p) => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: /علبة مغناطيسية/ }).click();
    const extras = p.getByTestId('extras');
    await extras.getByText('موصى به لهذه العلبة').waitFor();
    const before = await p.getByTestId('box-unit-price').innerText();
    await extras.getByRole('button', { name: 'أضف كل المقترحات' }).click();
    for (const n of ['حشوة إسفنج EVA', 'بطاقة المكوّنات (INCI)', 'بطاقة شكر']) if (!(await extras.getByRole('checkbox', { name: n }).isChecked())) throw new Error('not added: ' + n);
    await extras.getByRole('checkbox', { name: 'حشوة ورق مقولب' }).check();
    if (await extras.getByRole('checkbox', { name: 'حشوة إسفنج EVA' }).isChecked()) throw new Error('two inserts at once');
    const after = await p.getByTestId('box-unit-price').innerText();
    if (before === after) throw new Error('extras not priced');
    await p.locator('details').filter({ hasText: 'كيف حُسب السعر؟' }).locator('summary').click();
    await p.getByTestId('box-breakdown').getByText(/الملحقات \(/).waitFor();
    const sum = await p.locator('.bg-ink-900 p').filter({ hasText: /ملحقات:/ }).first().innerText();
    if (!sum.includes('حشوة ورق مقولب') || !sum.includes('بطاقة شكر')) throw new Error('summary ' + sum);
    // يبقى بعد التحديث (محفوظ مع العلبة)
    await p.reload({ waitUntil: 'networkidle' });
    if (!(await p.getByTestId('extras').getByRole('checkbox', { name: 'بطاقة شكر' }).isChecked())) throw new Error('extras lost on reload');
  });

  await run('label readiness flags the missing volume and clears when it matches the bottle', async (p) => {
    await p.goto(B + '/studio-3d?tab=label', { waitUntil: 'networkidle' });
    await p.getByRole('switch', { name: 'أضف ملصقاً على العبوة' }).check();
    const list = p.getByTestId('label-checklist');
    await list.waitFor();
    const details = p.getByLabel(/التفاصيل/).first();
    await details.fill('Eau de Parfum');
    await list.locator('[data-ok=false]').filter({ hasText: 'الحجم بالمل' }).waitFor();
    await details.fill('Eau de Parfum · 100 ml');
    await list.locator('[data-ok=false]').filter({ hasText: 'لا يطابق العبوة' }).waitFor();
    await details.fill('Eau de Parfum · 50 ml');
    await p.waitForFunction(() => !document.querySelector('[data-testid=label-checklist] [data-ok=false]'));
  });

  await run('service page lists manufacturing requirements; services page has the export explorer', async (p) => {
    await p.goto(B + '/services/E#requirements', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'ما نحتاجه منك، وما تستلمه منا' }).waitFor();
    await p.getByText('إشعار هيئة الغذاء والدواء (SFDA)').waitFor();
    await p.getByText('تشغيلة تجريبية').waitFor();
    await p.goto(B + '/services', { waitUntil: 'networkidle' });
    const tabs = p.getByRole('tablist', { name: 'التصدير' });
    await tabs.getByRole('tab', { name: /المستندات/ }).click();
    await p.getByText('شهادة منشأ').waitFor();
    await tabs.getByRole('tab', { name: /شروط التسليم/ }).click();
    await p.getByText(/DDP/).waitFor();
  });

  await run('mobile: studio options and extras do not overflow', async (p) => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    const ov = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (await ov()) throw new Error('overflow box tab: ' + (await ov()));
    await p.goto(B + '/studio-3d', { waitUntil: 'networkidle' });
    await p.getByTestId('bottle-spec').waitFor();
    if (await ov()) throw new Error('overflow bottle tab: ' + (await ov()));
  }, { viewport: { width: 375, height: 812 } });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
