const { chromium, OUT, url, FIX } = require('./lib.cjs');
const fs = require('fs');
const B = url('admin');
const PH = FIX;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [], errors = [];
  const desk = { width: 1440, height: 900 }, mob = { width: 390, height: 844 };
  // سياق واحد يحاكي متصفح المصمم ثم العميل (نفس التخزين المحلي = نفس "قاعدة البيانات" التجريبية)
  const ctx = await browser.newContext({ viewport: desk, acceptDownloads: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', 'ar'); sessionStorage.setItem('_i', '1'); } } catch {} });
  const run = async (name, fn, page) => {
    const p = page || await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/readdy|ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    if (!page) await p.close();
  };
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 8000 });
  // لوحة الرسم ليست فارغة: تباين البكسلات في وسطها
  const canvasVariance = (p, sel = 'canvas') => p.evaluate((s) => {
    const cvs = [...document.querySelectorAll(s)].filter(c => c.width > 200);
    const c = cvs[cvs.length - 1]; if (!c) return -1;
    const o = document.createElement('canvas'); o.width = 120; o.height = 120;
    const g = o.getContext('2d'); g.drawImage(c, c.width * 0.3, c.height * 0.15, c.width * 0.4, c.height * 0.7, 0, 0, 120, 120);
    const d = g.getImageData(0, 0, 120, 120).data; let m = 0, m2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; m += v; m2 += v * v; n++; }
    m /= n; return m2 / n - m * m;
  }, sel);
  const loginStaff = async (p, role) => {
    await p.goto(B + '/auth', { waitUntil: 'networkidle' });
    if (!p.url().includes('/auth')) { await p.evaluate(() => localStorage.removeItem('pp_session_email')); await p.goto(B + '/auth', { waitUntil: 'networkidle' }); }
    await p.getByLabel(/الدور التجريبي/).selectOption(role);
    await p.getByRole('button', { name: /دخول كفريق المنصة/ }).click();
    await p.waitForURL(/\/admin$/);
  };

  await run('designer: catalogue + photo → 3D bottle', async p => {
    await loginStaff(p, 'designer');
    await p.getByRole('navigation').getByRole('link', { name: /استوديو العبوات/ }).click();
    await p.waitForURL('**/admin/studio');
    await p.getByRole('heading', { name: 'استوديو العبوات' }).waitFor();
    await p.locator('main li').nth(3).waitFor();
    if ((await p.locator('main li').count()) !== 4) throw new Error('expected 4 seed bottles, got ' + (await p.locator('main li').count()));
    await p.screenshot({ path: `${OUT}/s1-admin-catalogue.png` });
    await p.getByRole('link', { name: 'عبوة جديدة من صورة' }).click();
    await p.waitForURL('**/admin/studio/new?kind=bottle');
    await p.getByLabel('صورة العبوة').setInputFiles(`${PH}/photo-bottle.jpg`);
    await p.getByText('حدود واضحة ومتناظرة').waitFor({ timeout: 10000 });
    await p.getByPlaceholder('مثال: أطلس · أسطواني').fill('مرآة · كتف ناعم');
    await p.getByPlaceholder('Atlas · cylinder').fill('Mirage · soft shoulder');
    await p.getByLabel('الارتفاع الحقيقي (مم)').fill('120');
    await p.getByLabel('طول العنق (مم)').fill('16');
    await p.getByLabel('السعة الاسمية (مل)').fill('100');
    const note = await p.locator('main p').filter({ hasText: 'السعة حتى الحافة' }).innerText();
    if (!/\d/.test(note)) throw new Error('no capacity estimate');
    await p.getByLabel(/منشور — يظهر للعملاء/).check();
    await p.locator('main canvas').nth(1).waitFor();
    await p.waitForTimeout(2500);
    const v = await canvasVariance(p, 'main canvas');
    if (v < 20) throw new Error('3D preview looks blank, variance ' + v);
    await p.screenshot({ path: `${OUT}/s2-editor-bottle.png`, fullPage: true });
    console.log('  capacity note:', note.replace(/\s+/g, ' '));
    await p.getByRole('button', { name: 'حفظ في الكتالوج' }).click();
    await toast(p, 'أُضيف النموذج');
    await p.waitForURL('**/admin/studio');
    const card = p.locator('main li').filter({ hasText: 'مرآة · كتف ناعم' });
    if (!(await card.locator('img').count())) throw new Error('no thumbnail saved');
    const src = await card.locator('img').getAttribute('src');
    if (!src.startsWith('data:image/webp') && !src.startsWith('data:image/png')) throw new Error('thumb ' + src.slice(0, 30));
  });

  await run('designer: transparent cap PNG → 3D cap', async p => {
    await loginStaff(p, 'designer');
    await p.goto(B + '/admin/studio/new?kind=cap', { waitUntil: 'networkidle' });
    await p.getByLabel('صورة العبوة').setInputFiles(`${PH}/photo-cap.png`);
    await p.getByText('خلفية شفافة').waitFor({ timeout: 10000 });
    await p.getByPlaceholder('مثال: أطلس · أسطواني').fill('تاج بحافة');
    await p.getByLabel('الارتفاع الحقيقي (مم)').fill('34');
    await p.getByRole('radio', { name: 'مربع' }).click();
    await p.getByLabel(/منشور — يظهر للعملاء/).check();
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `${OUT}/s3-editor-cap.png`, fullPage: true });
    await p.getByRole('button', { name: 'حفظ في الكتالوج' }).click();
    await toast(p, 'أُضيف النموذج');
  });

  await run('designer: unpublish hides from clients', async p => {
    await loginStaff(p, 'designer');
    await p.goto(B + '/admin/studio', { waitUntil: 'networkidle' });
    await p.locator('main li').first().waitFor();
    await p.locator('main li').filter({ hasText: 'بحر' }).getByLabel('منشور').uncheck();
    await toast(p, 'أُخفي عن العملاء');
  });

  await run('sales cannot open the studio', async p => {
    await loginStaff(p, 'sales');
    if (await p.getByRole('navigation').getByRole('link', { name: /استوديو العبوات/ }).count()) throw new Error('nav visible');
    await p.goto(B + '/admin/studio/new', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'هذه الصفحة خارج صلاحياتك' }).waitFor();
  });

  await run('client: configurator with new model, share link, PNG, AR', async p => {
    await p.evaluate(() => localStorage.removeItem('pp_session_email')).catch(() => {});
    await p.goto(B + '/studio-3d', { waitUntil: 'networkidle' });
    const bottles = p.getByRole('radiogroup', { name: 'شكل العبوة' }).getByRole('radio');
    const names = await bottles.allInnerTexts();
    if (names.some(n => n.includes('بحر'))) throw new Error('unpublished model visible to client');
    if (!names.some(n => n.includes('مرآة'))) throw new Error('new model missing: ' + names.join('|'));
    await bottles.filter({ hasText: 'مرآة' }).click();
    await p.getByRole('radiogroup', { name: 'الغطاء' }).getByRole('radio').filter({ hasText: 'تاج بحافة' }).click();
    await p.getByRole('radio', { name: 'مدخّن' }).click();
    await p.getByRole('radio', { name: 'خشب جوز' }).click();
    await p.getByRole('radio', { name: 'عودي داكن' }).click();
    await p.getByRole('button', { name: 'دوران تلقائي' }).click();
    await p.waitForTimeout(2500);
    if ((await canvasVariance(p)) < 20) throw new Error('viewer blank');
    const url = new URL(p.url());
    for (const [k, v] of [['g', 'smoke'], ['cf', 'wood'], ['l', 'oud']]) if (url.searchParams.get(k) !== v) throw new Error('url state ' + k);
    await p.screenshot({ path: `${OUT}/s4-client-configurator.png`, fullPage: true });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'حفظ صورة' }).click()]);
    const png = fs.readFileSync(await dl.path());
    if (png.slice(1, 4).toString() !== 'PNG' || png.length < 20000) throw new Error('png ' + png.length);
    // رابط المشاركة يعيد نفس التركيبة
    const p2 = await ctx.newPage();
    await p2.goto(url.toString(), { waitUntil: 'networkidle' });
    if ((await p2.getByRole('radio', { name: 'مدخّن' }).getAttribute('aria-checked')) !== 'true') throw new Error('share link lost glass');
    await p2.close();
    await p.getByRole('button', { name: 'شاهدها في مساحتك' }).click();
    const dlg = p.getByRole('dialog', { name: 'الواقع المعزز' });
    await dlg.waitFor();
    const mv = dlg.locator('model-viewer');
    await mv.waitFor({ state: 'attached', timeout: 15000 });
    if (!(await mv.getAttribute('src')).startsWith('blob:')) throw new Error('model-viewer src');
    await dlg.getByText(/لا يدعم الواقع المعزز|ضعها على طاولتك/).waitFor({ timeout: 30000 });
    // ملف GLB صالح: نعيد تصديره ونفحص التوقيع
    const glb = await p.evaluate(async () => { const r = await fetch(document.querySelector('model-viewer').getAttribute('src')); const b = new Uint8Array(await r.arrayBuffer()); return { magic: String.fromCharCode(...b.slice(0, 4)), size: b.length }; });
    if (glb.magic !== 'glTF' || glb.size < 10000) throw new Error('glb ' + JSON.stringify(glb));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/s5-ar-dialog.png` });
    await p.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' });
    await p.getByRole('link', { name: /ناقش هذه التركيبة/ }).click();
    await p.waitForURL('**/book?**');
    // نختار موعداً للوصول لخطوة البيانات ثم نتحقق من تعبئة الملاحظة
    const days = p.getByRole('radiogroup').nth(0).getByRole('radio');
    for (let i = 0; i < await days.count(); i++) { await days.nth(i).click(); const free = p.getByRole('radiogroup').nth(1).locator('button:not([disabled])'); if (await free.count()) { await free.first().click(); break; } }
    await p.getByRole('button', { name: 'التالي' }).click();
    const noteVal = await p.locator('#b-notes').inputValue();
    if (!noteVal.includes('مرآة') || !noteVal.includes('مدخّن')) throw new Error('note not prefilled: ' + noteVal);
    console.log('  booking note:', noteVal);
  });

  await run('client mobile + English', async () => {
    const m = await browser.newContext({ viewport: mob });
    await m.addInitScript(() => { try { localStorage.setItem('pp_lang', 'en'); } catch {} });
    const p = await m.newPage();
    p.on('pageerror', e => errors.push('mobile: ' + e.message));
    await p.goto(B + '/studio-3d?b=B-NOOR&c=C-CUBE&g=amber&cf=wood&l=oud', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: /Build your bottle/ }).waitFor();
    await p.waitForTimeout(2500);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 390) throw new Error('overflow ' + sw);
    if ((await canvasVariance(p)) < 20) throw new Error('viewer blank on mobile');
    await p.screenshot({ path: `${OUT}/s6-mobile-en.png`, fullPage: true });
    await m.close();
  });

  console.log(results.join('\n'));
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
  await browser.close();
})();
