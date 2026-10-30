const { chromium, OUT, url, FIX } = require('./lib.cjs');
const fs = require('fs');
const B = url('site');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [], errors = [];
  const mk = async (opts = {}, lang = 'ar') => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
    await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_i', '1'); } } catch {} }, lang);
    return ctx;
  };
  const run = async (name, ctx, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/readdy|ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  // بصمة مصغّرة للوحة الرسم لمقارنة لقطتين
  const sig = (p) => p.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].filter(x => x.width > 200).pop();
    const o = document.createElement('canvas'); o.width = 48; o.height = 48;
    const g = o.getContext('2d'); g.drawImage(c, 0, 0, 48, 48);
    return Array.from(g.getImageData(0, 0, 48, 48).data);
  });
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4) / 3; };
  const variance = (a) => { let m = 0, m2 = 0, n = 0; for (let i = 0; i < a.length; i += 4) { const v = (a[i] + a[i + 1] + a[i + 2]) / 3; m += v; m2 += v * v; n++; } m /= n; return m2 / n - m * m; };
  const ready = async (p) => { await p.waitForSelector('[role=img][aria-busy=false] canvas', { timeout: 30000 }); await p.waitForTimeout(900); };
  const STY = { tuck: /Tuck End/, rigid: /صلبة بغطاء/, drawer: /علبة درج/, magnetic: /مغناطيسية/, tube: /أسطوانة/ };

  const ctx = await mk();
  await run('box tab from URL renders a 3D box', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await ready(p);
    if (await p.getByRole('tab', { name: 'العلبة' }).getAttribute('aria-selected') !== 'true') throw new Error('tab not selected');
    const v = variance(await sig(p));
    if (v < 30) throw new Error('blank canvas ' + v);
    if (!(await p.getByTestId('dieline-preview').locator('line').count())) throw new Error('no dieline preview');
  });

  await run('all five styles: geometry, sizes and dieline update', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await ready(p);
    const seen = new Set(), sheets = new Set();
    let prev = await sig(p);
    for (const [k, re] of Object.entries(STY)) {
      await p.getByRole('radio', { name: re }).click();
      await p.waitForTimeout(400);
      await ready(p);
      if (await p.getByRole('radio', { name: re }).getAttribute('aria-checked') !== 'true') throw new Error(k + ' not checked');
      seen.add(await p.getByTestId('outer-size').innerText());
      sheets.add(await p.getByTestId('sheet-size').innerText());
      const s = await sig(p);
      if (k !== 'tuck' && diff(prev, s) < 1.5) throw new Error(k + ': render did not change');
      prev = s;
      const lines = await p.getByTestId('dieline-preview').locator('line').count();
      if (lines < 8) throw new Error(k + ': too few dieline lines ' + lines);
    }
    if (seen.size < 4 || sheets.size < 5) throw new Error(`sizes not distinct ${[...seen]} ${[...sheets]}`);
  });

  await run('fold slider, play animation and open/close', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: STY.tuck }).click();
    await ready(p);
    await p.getByRole('button', { name: 'دوران تلقائي' }).click(); // إيقاف الدوران لمقارنة ثابتة
    await p.waitForTimeout(800);
    const closed = await sig(p);
    const slider = p.getByLabel('مرحلة الطي');
    await slider.fill('0');
    await p.waitForTimeout(1500);
    const flat = await sig(p);
    if (diff(closed, flat) < 4) throw new Error('flat looks like closed ' + diff(closed, flat));
    await p.getByRole('button', { name: 'شغّل حركة الطي' }).click();
    await p.waitForTimeout(1600);
    const mid = Number(await slider.inputValue());
    if (!(mid > 0 && mid < 100)) throw new Error('animation not in progress: ' + mid);
    await p.waitForFunction(() => document.querySelector('input[aria-label="مرحلة الطي"]').value === '100', null, { timeout: 8000 });
    await p.getByRole('button', { name: /^افتح/ }).click();
    await p.getByRole('button', { name: /^أغلق/ }).waitFor({ timeout: 4000 });
    await p.waitForTimeout(1500);
    if (diff(closed, await sig(p)) < 1.5) throw new Error('open looks closed');
    await p.getByRole('button', { name: /^أغلق/ }).click();
    await p.getByRole('button', { name: /^افتح/ }).waitFor({ timeout: 4000 });
  });

  await run('dimensions: typed, clamped and fitted to bottle', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: STY.tuck }).click();
    const w = p.getByLabel('العرض', { exact: true });
    await w.fill('80'); await w.press('Enter');
    await p.getByTestId('outer-size').filter({ hasText: /(81|٨١) ×/ }).waitFor({ timeout: 4000 });
    await w.fill('5'); await w.blur();
    if (await w.inputValue() !== '20') throw new Error('not clamped: ' + await w.inputValue());
    await p.getByRole('button', { name: 'ملاءمة للعبوة المختارة' }).click();
    const fitted = Number(await w.inputValue());
    if (!(fitted > 25 && fitted < 120)) throw new Error('fit width ' + fitted);
    const h = Number(await p.getByLabel('الارتفاع', { exact: true }).inputValue());
    if (!(h > 60)) throw new Error('fit height ' + h);
  });

  await run('exports: SVG dieline and 2-page PDF', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: STY.magnetic }).click();
    await ready(p);
    const [svgDl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'مخطط القص SVG' }).click()]);
    const svgPath = `${OUT}/${svgDl.suggestedFilename()}`; await svgDl.saveAs(svgPath);
    const svg = fs.readFileSync(svgPath, 'utf8');
    if (!/^box-MAGNETIC-.*\.svg$/.test(svgDl.suggestedFilename())) throw new Error('name ' + svgDl.suggestedFilename());
    for (const id of ['id="cut"', 'id="crease"', 'id="glue"', 'mm"', 'stroke="#EC008C"']) if (!svg.includes(id)) throw new Error('svg missing ' + id);
    const [pdfDl] = await Promise.all([p.waitForEvent('download', { timeout: 40000 }), p.getByRole('button', { name: 'ملف الطباعة PDF' }).click()]);
    const pdfPath = `${OUT}/${pdfDl.suggestedFilename()}`; await pdfDl.saveAs(pdfPath);
    const pdf = fs.readFileSync(pdfPath);
    if (pdf.slice(0, 4).toString() !== '%PDF') throw new Error('not a pdf');
    const pages = (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;
    if (pages !== 2) throw new Error('pages ' + pages);
    if (pdf.length < 30000) throw new Error('pdf too small (no artwork?) ' + pdf.length);
  });

  await run('design persists across reloads; label copy works', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.setItem('pp_label_v1', JSON.stringify({ enabled: true, shape: 'rect', widthMm: 40, heightMm: 50, centerYmm: 40, paper: 'white', customColor: '#fff', finish: 'matte', border: { enabled: false, color: '#000', foil: 'none' }, texts: [{ id: 'brand', text: 'Dar Oud', font: 'amiri', sizeMm: 5, weight: 700, color: '#000', foil: 'none', y: 0.3, trackingMm: 0 }, { id: 'name', text: 'مسك', font: 'amiri', sizeMm: 4, weight: 400, color: '#000', foil: 'none', y: 0.5, trackingMm: 0 }, { id: 'details', text: '100 ml', font: 'amiri', sizeMm: 2, weight: 400, color: '#000', foil: 'none', y: 0.8, trackingMm: 0 }], logo: null })));
    await p.reload({ waitUntil: 'networkidle' });
    await p.getByRole('radio', { name: STY.drawer }).click();
    await p.getByRole('button', { name: 'انسخ من تصميم الملصق' }).click();
    if (await p.getByLabel('اسم الدار', { exact: true }).inputValue() !== 'Dar Oud') throw new Error('brand not copied');
    if (await p.getByLabel('الخط').inputValue() !== 'amiri') throw new Error('font not copied');
    await p.waitForTimeout(700); // الحفظ مؤجّل 400 مللي ثانية
    await p.reload({ waitUntil: 'networkidle' });
    if (await p.getByRole('radio', { name: STY.drawer }).getAttribute('aria-checked') !== 'true') throw new Error('style not persisted');
    if (await p.getByLabel('اسم الدار', { exact: true }).inputValue() !== 'Dar Oud') throw new Error('brand not persisted');
    if (!(await p.locator('.bg-ink-900 >> text=/علبة: علبة درج/').count())) throw new Error('summary lacks the box');
  });

  await run('tabs: bottle viewer still works and tab is in the URL', ctx, async p => {
    await p.goto(B + '/studio-3d', { waitUntil: 'networkidle' });
    await p.getByRole('tab', { name: 'العلبة' }).click();
    await p.waitForURL(/tab=box/);
    await ready(p);
    await p.getByRole('tab', { name: 'العبوة والخامات' }).click();
    await p.waitForURL(u => !u.toString().includes('tab='));
    await p.getByRole('radiogroup', { name: 'شكل العبوة' }).waitFor();
    await p.waitForTimeout(1500);
    if (variance(await sig(p)) < 30) throw new Error('bottle canvas blank');
  });

  await run('AR export works for the box', ctx, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await ready(p);
    await p.getByRole('button', { name: /شاهدها في مساحتك/ }).click();
    await p.getByRole('dialog').waitFor({ timeout: 20000 });
  });

  const mob = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await run('mobile: no overflow, controls reachable', mob, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await ready(p);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ov > 0) throw new Error('overflow ' + ov);
    const bb = await p.getByLabel('مرحلة الطي').boundingBox();
    if (!bb || bb.width < 80 || bb.x < 0 || bb.x + bb.width > 390) throw new Error('slider ' + JSON.stringify(bb));
    for (const re of Object.values(STY)) {
      await p.getByRole('radio', { name: re }).click();
      await p.waitForTimeout(300);
      const o2 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (o2 > 0) throw new Error('overflow after style ' + o2);
    }
    await p.screenshot({ path: `${OUT}/mobile-box.png`, fullPage: true });
  });

  const en = await mk({}, 'en');
  await run('English UI', en, async p => {
    await p.goto(B + '/studio-3d?tab=box', { waitUntil: 'networkidle' });
    await p.getByRole('tab', { name: 'Box' }).waitFor();
    await p.getByRole('radio', { name: /Reverse tuck end/ }).waitFor();
    await p.getByRole('button', { name: 'Print-ready PDF' }).waitFor();
    await p.getByLabel('Fold progress').waitFor();
    const body = await p.locator('main').innerText();
    if (/[؀-ۿ]{3,}/.test(body.replace(/عود الليل/g, ''))) throw new Error('Arabic left in EN UI: ' + body.match(/[؀-ۿ ]{3,}/)[0]);
    await ready(p);
    await p.screenshot({ path: `${OUT}/en-box.png` });
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(results.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
