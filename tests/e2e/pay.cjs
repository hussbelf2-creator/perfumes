const { chromium, OUT, url, FIX } = require('./lib.cjs');
const B = url('pay');
const ID = '760878ec-d1d3-5f72-9056-191683f55872';
// بديل لمكتبة مويسر: يسجّل خيارات init ويحاكي إعادة التوجيه بعد الدفع
const STUB = `window.Moyasar={init:function(o){window.__mysr=o;var el=typeof o.element==='string'?document.querySelector(o.element):o.element;
el.innerHTML='<div style="border:1px solid #ddd;border-radius:12px;padding:16px;font:14px sans-serif">[Moyasar form stub] '+o.methods.join(', ')+'<br><button id="stub-pay" style="margin-top:12px;padding:10px 16px;background:#111;color:#fff;border-radius:8px">Pay '+(o.amount/100)+' SAR</button> <button id="stub-fail" style="padding:10px 16px">Decline</button></div>';
el.querySelector('#stub-pay').onclick=function(){location.href=o.callback_url+'?id=${ID}&status=paid&message=APPROVED'};
el.querySelector('#stub-fail').onclick=function(){location.href=o.callback_url+'?id=${ID}&status=failed&message=Insufficient%20funds'};}};`;
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  const run = async (name, vp, lang, opts, fn) => {
    const ctx = await browser.newContext({ viewport: vp, recordVideo: { dir: OUT + '/video', size: vp } });
    await ctx.addInitScript(l => { try { localStorage.setItem('pp_lang', l); } catch {} }, lang);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await p.route(/readdy\.ai\/api\/form/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
    await p.route(/cdn\.moyasar\.com\/mpf\/.*\/moyasar\.js/, r => opts.cdnDown ? r.abort() : r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
    await p.route(/cdn\.moyasar\.com\/mpf\/.*\/moyasar\.css/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const verifyHits = [];
    await p.route(/\/api\/payments\/verify/, r => { verifyHits.push(r.request().url()); const v = opts.verify || { paid: true, status: 'paid', amount: 75000, ref: undefined, id: ID }; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) }); });
    try { await fn(p, verifyHits); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }); }
    await ctx.close();
  };
  const desk = { width: 1440, height: 900 }, mob = { width: 390, height: 844 };
  const toPay = async (p, ar) => {
    await p.goto(B + '/discovery-kit', { waitUntil: 'networkidle' });
    const flow = p.locator('#kit-flow');
    for (const o of ar ? ['عودي وشرقي', 'متوازن للاستخدام اليومي', 'للجنسين', '200 – 450 ر.س'] : ['Oud & oriental', 'Balanced, everyday', 'Unisex', 'SAR 200 – 450']) await flow.getByRole('radio', { name: new RegExp('^' + o) }).click();
    await flow.getByRole('button', { name: ar ? /اطلب العينات/ : /Order the kit/ }).click();
    await p.fill('#k-first', ar ? 'نورة' : 'Noura'); await p.fill('#k-last', 'S'); await p.fill('#k-phone', '+966500000000');
    await p.fill('#k-email', 'n@example.com'); await p.selectOption('#k-city', 'Riyadh'); await p.fill('#k-address', 'RRRD1234');
    await flow.getByRole('button', { name: ar ? 'المتابعة للدفع' : 'Continue to payment' }).click();
    await p.locator('#stub-pay').waitFor();
    return flow;
  };

  await run('pay success AR desktop', desk, 'ar', {}, async (p, hits) => {
    const flow = await toPay(p, true);
    const o = await p.evaluate(() => ({ ...window.__mysr, element: undefined }));
    if (o.amount !== 75000 || o.currency !== 'SAR') throw new Error('amount ' + o.amount);
    if (!o.publishable_api_key.startsWith('pk_test_')) throw new Error('key');
    if (!o.callback_url.endsWith('/discovery-kit/paid')) throw new Error('cb ' + o.callback_url);
    if (!/^KIT-[A-Z2-9]{6}$/.test(o.metadata.order_ref)) throw new Error('ref ' + o.metadata.order_ref);
    if (!o.supported_networks.includes('mada') || !o.methods.includes('applepay')) throw new Error('methods');
    if (o.language !== 'ar') throw new Error('lang');
    if (!(await flow.innerText()).includes('4111')) throw new Error('test-mode hint');
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '/pay-1-form-ar.png', fullPage: true });
    await p.click('#stub-pay');
    await p.waitForURL('**/discovery-kit/paid?**');
    await p.getByRole('heading', { name: /تم الدفع، نورة/ }).waitFor();
    if (!hits.length || !hits[0].includes(`id=${'760878ec'}`)) throw new Error('verify not called');
    if (!(await p.locator('main').innerText()).includes(o.metadata.order_ref)) throw new Error('ref not shown');
    if (await p.evaluate(() => sessionStorage.getItem('pp_kit_order'))) throw new Error('pending not cleared');
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '/pay-2-success-ar.png', fullPage: true });
  });

  await run('pay declined -> retry EN mobile', mob, 'en', { verify: { paid: false, status: 'failed', id: ID } }, async p => {
    await toPay(p, false);
    await p.screenshot({ path: OUT + '/pay-1-form-en-mob.png', fullPage: true });
    await p.click('#stub-fail');
    await p.getByRole('heading', { name: "The payment didn't go through." }).waitFor();
    if (!(await p.locator('main').innerText()).includes('Insufficient funds')) throw new Error('gateway msg');
    await p.screenshot({ path: OUT + '/pay-3-failed-en-mob.png', fullPage: true });
    await p.getByRole('link', { name: 'Try paying again' }).click();
    await p.waitForURL('**/discovery-kit?retry=1');
    await p.locator('#stub-pay').waitFor();
    const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > 390) throw new Error('overflow ' + sw);
  });

  await run('URL says paid but server says no => not paid', desk, 'en', { verify: { paid: false, status: 'amount_mismatch', id: ID } }, async p => {
    await toPay(p, false);
    await p.click('#stub-pay'); // callback has status=paid in URL
    await p.getByRole('heading', { name: "The payment didn't go through." }).waitFor();
    if (await p.getByRole('link', { name: 'Try paying again' }).count()) throw new Error('retry shown on mismatch');
  });

  await run('gateway script blocked => graceful message', desk, 'ar', { cdnDown: true }, async p => {
    await p.goto(B + '/discovery-kit', { waitUntil: 'networkidle' });
    const flow = p.locator('#kit-flow');
    for (const o of ['عودي وشرقي', 'متوازن للاستخدام اليومي', 'للجنسين', '200 – 450 ر.س']) await flow.getByRole('radio', { name: new RegExp('^' + o) }).click();
    await flow.getByRole('button', { name: /اطلب العينات/ }).click();
    await p.fill('#k-first', 'نورة'); await p.fill('#k-last', 'S'); await p.fill('#k-phone', '+966500000000');
    await p.fill('#k-email', 'n@example.com'); await p.selectOption('#k-city', 'Riyadh'); await p.fill('#k-address', 'RRRD1234');
    await flow.getByRole('button', { name: 'المتابعة للدفع' }).click();
    await flow.getByRole('alert').waitFor();
    if (!(await flow.getByRole('alert').innerText()).includes('تعذّر تحميل بوابة الدفع')) throw new Error('msg');
  });

  await run('paid page without id', desk, 'en', {}, async (p, hits) => {
    await p.goto(B + '/discovery-kit/paid', { waitUntil: 'networkidle' });
    await p.getByRole('alert').waitFor();
    if (hits.length) throw new Error('verify called without id');
  });

  console.log(results.join('\n'));
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
