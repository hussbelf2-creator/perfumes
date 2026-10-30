// التسعير والربحية والمخزون على Supabase حقيقي
const { chromium, B, sql, newCtx, register, login, harness, API, PUBLIC_API, ANON, VERIFY, FIX, OUT } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch();
  const { results, errors, run } = harness(OUT);
  const q = (s) => s.replace(/\s+/g, ' ');
  sql(q(`select set_config('app.quote_rpc','1',false); delete from public.projects where client_email='mona@live.test';
    delete from public.inventory_items where sku like 'T7-%'; delete from public.coupons where code like 'T7%';
    delete from public.contacts where email='mona@live.test'; delete from auth.users where email in ('mona@live.test','sales7@live.test');
    update public.business_settings set value = '{"discount_caps":{"owner":100,"admin":100,"sales":10},"margin_floor":25}';
    delete from public.site_content_drafts where key='pricing'; delete from public.site_content where key='pricing';`));
  const route = async (ctx) => {
    await ctx.route('**/api/payments/verify*', async (r) => { const u = new URL(r.request().url()); const res = await fetch(VERIFY + u.pathname + u.search); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); });
    await ctx.route(/cdn\.moyasar\.com\/.*\.js$/, (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.Moyasar={init:(o)=>{window.__moyasar=o;const b=document.createElement("button");b.type="button";b.textContent="ادفع (وهمي)";(typeof o.element==="string"?document.querySelector(o.element):o.element).appendChild(b);}};' }));
    await ctx.route(/cdn\.moyasar\.com\/.*\.css$/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    await ctx.route(/readdy\.ai/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":"OK"}' }));
  };
  const owner = await newCtx(browser); await route(owner);
  const sales = await newCtx(browser); await route(sales);
  const client = await newCtx(browser); await route(client);
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 10000 });
  let pid = '';

  await run('setup: sales member, client project; owner sets policy (sales 10%, floor 30%)', owner, async (p) => {
    const s = await sales.newPage(); await register(s, 'سعد', 'المبيعات', 'sales7@live.test'); await s.close();
    sql("update public.profiles set role='sales' where email='sales7@live.test'");
    const c = await client.newPage(); await register(c, 'منى', 'العمري', 'mona@live.test'); await c.close();
    sql("insert into public.contacts (name, email, phone, source) values ('منى العمري','mona@live.test','0551110000','brief')");
    pid = sql("insert into public.projects (title, track, client_email, contact_id, stage) select 'عطور منى','C','mona@live.test', id, 'brief' from public.contacts where email='mona@live.test' returning id").split('\n')[0];
    await login(p, 'owner@live.test');
    await p.goto(B + '/admin/pricing', { waitUntil: 'networkidle' });
    await p.getByLabel('حد الهامش الأدنى ٪').fill('30');
    await p.getByRole('button', { name: 'حفظ السياسة' }).click();
    await toast(p, /حُفظت السياسة/);
    if (sql("select value->>'margin_floor' from public.business_settings") !== '30') throw new Error('policy not saved');
  });

  await run('stock: item, two receipts → weighted average 7; balance not editable', owner, async (p) => {
    await p.goto(B + '/admin/inventory', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'مادة جديدة' }).click();
    const d = p.getByRole('dialog');
    await d.getByLabel('رمز المادة (SKU)').fill('t7-btl-50');
    await d.getByLabel('الاسم').fill('زجاجة 50 مل شفافة');
    await d.getByLabel('حد إعادة الطلب').fill('200');
    await d.getByRole('button', { name: 'حفظ المادة' }).click();
    await toast(p, /حُفظت المادة/);
    await p.getByRole('button', { name: /زجاجة 50 مل شفافة/ }).click();
    const dr = p.getByRole('dialog');
    for (const [qty, cost] of [['1000', '6'], ['500', '9']]) {
      await dr.getByLabel(/^الكمية/).fill(qty);
      await dr.getByLabel('تكلفة الوحدة (ر.س)').fill(cost);
      await dr.getByRole('button', { name: 'سجّل الحركة' }).click();
      await toast(p, /سُجّلت الحركة/);
      // النموذج يُفرَّغ بعد تسجيل الحركة
      await p.waitForFunction(() => !document.querySelector('[role=dialog] input[type=number]')?.value, null, { timeout: 10000 });
    }
    await dr.getByTestId('drawer-avg').filter({ hasText: '7.00' }).waitFor();
    if (sql("select concat_ws('|', on_hand, avg_cost) from public.inventory_items where sku='T7-BTL-50'") !== '1500.000|7.0000') throw new Error('balance');
  });

  await run('sales drafts a quote: stock-linked cost, live margin; 15% discount is above the cap', sales, async (p) => {
    // الجلسة من التسجيل؛ الدور يُقرأ من الملف الشخصي (صار مبيعات)
    await p.goto(B + '/admin', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: /سعد/ }).waitFor();
    await p.goto(B + '/admin/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'أنشئ عرض السعر' }).click();
    await p.getByLabel('مادة البند 1 من المخزون').selectOption({ label: 'T7-BTL-50 · زجاجة 50 مل شفافة' });
    if ((await p.getByLabel('تكلفة وحدة البند 1').inputValue()) !== '7') throw new Error('cost not auto-filled from stock');
    await p.getByLabel('وصف البند 1').fill('زجاجة مع علبة وطباعة');
    await p.getByLabel('كمية البند 1').fill('1000');
    await p.getByLabel('سعر وحدة البند 1').fill('20');
    await p.getByLabel('تكاليف أخرى (داخلية)').fill('500');
    await p.getByLabel('نوع الخصم').selectOption('pct');
    await p.getByLabel('قيمة الخصم').fill('15');
    await p.getByText(/أعلى من سقف دورك \(10٪\)/).waitFor();
    if (await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).isEnabled()) throw new Error('send should be disabled over cap');
    const profit = await p.getByTestId('editor-profit').innerText();
    if (!profit.includes('9,500.00')) throw new Error('profit ' + profit); // 17,000 − (7,000 + 500)
    await p.getByRole('button', { name: 'حفظ المسودة' }).click();
    await toast(p, /حُفظت مسودة العرض/);
    // الخادم يرفض الإرسال حتى لو تجاوز المتصفح
    const tok = (await (await fetch(API + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sales7@live.test', password: 'Passw0rd!x' }) })).json()).access_token;
    const qid = sql(`select id from public.project_quotes where project_id='${pid}'`);
    const r = await fetch(API + '/rest/v1/rpc/send_quote', { method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_id: qid }) });
    if (r.status < 400) throw new Error('server sent an over-cap quote');
  });

  await run('owner sends it; client sees the discount, never the costs; accepts', owner, async (p) => {
    await p.goto(B + '/admin/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await toast(p, /أُرسل العرض للعميل/);
    await p.getByTestId('quote-margin').filter({ hasText: /9,500.00 ر.س \(55.9%\)/ }).waitFor();
    if (sql(`select concat_ws('|', gross, discount, subtotal, total, deposit) from public.project_quotes where project_id='${pid}'`) !== '20000.00|3000.00|17000.00|19550.00|9775.00') throw new Error('totals');
    const c = await client.newPage();
    await c.goto(B + '/account/projects/' + pid, { waitUntil: 'networkidle' });
    await c.getByTestId('quote-discount').filter({ hasText: '3,000.00' }).waitFor();
    await c.getByText('خصم 15٪').waitFor();
    const ctok = (await (await fetch(API + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'mona@live.test', password: 'Passw0rd!x' }) })).json()).access_token;
    for (const tb of ['quote_costs', 'project_costs', 'inventory_items', 'business_settings']) {
      const r = await (await fetch(`${API}/rest/v1/${tb}?select=*`, { headers: { apikey: ANON, authorization: `Bearer ${ctok}` } })).json();
      if (!Array.isArray(r) || r.length) throw new Error(`client reads ${tb}`);
    }
    if (await c.getByText(/التكلفة|الربح المتوقع/).count()) throw new Error('internal numbers shown to client');
    await c.getByRole('button', { name: 'اعتمد العرض' }).click();
    await c.getByRole('button', { name: 'تأكيد الاعتماد' }).click();
    await c.getByRole('status').filter({ hasText: /اعتُمد العرض/ }).first().waitFor();
    await c.close();
  });

  await run('deposit paid → 1,000 reserved; issue from the project → cost recorded; actual margin', owner, async (p) => {
    const qid = sql(`select id from public.project_quotes where project_id='${pid}'`);
    const payId = '33333333-3333-4333-8333-333333333333';
    await fetch(VERIFY + '/mock', { method: 'POST', body: JSON.stringify({ id: payId, status: 'paid', amount: 977500, currency: 'SAR', metadata: { kind: 'deposit', quote_id: qid } }) });
    const c = await client.newPage();
    await c.goto(`${B}/account/projects/${pid}?pay=${qid}&id=${payId}&status=paid`, { waitUntil: 'networkidle' });
    await c.getByRole('status').filter({ hasText: 'تم الدفع' }).waitFor({ timeout: 10000 });
    await c.close();
    if (sql("select concat_ws('|', on_hand, reserved) from public.inventory_items where sku='T7-BTL-50'") !== '1500.000|1000.000') throw new Error('not reserved');
    await p.goto(B + '/admin/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'صرف 1,000' }).click();
    await toast(p, /صُرفت المواد/);
    await p.getByTestId('actual-cost').filter({ hasText: '7,000.00' }).waitFor();
    await p.getByLabel('المبلغ (ر.س)').last().fill('2000');
    await p.getByLabel('ملاحظة', { exact: true }).fill('تعبئة المصنع');
    await p.getByRole('button', { name: 'سجّل التكلفة' }).click();
    await toast(p, /سُجّلت التكلفة/);
    await p.getByTestId('actual-profit').filter({ hasText: /8,000.00 ر.س · 47.1%/ }).waitFor();
    if (sql("select concat_ws('|', on_hand, reserved) from public.inventory_items where sku='T7-BTL-50'") !== '500.000|0.000') throw new Error('issue balance');
  });

  await run('reports: profitability matches the database', owner, async (p) => {
    await p.goto(B + '/admin/reports', { waitUntil: 'networkidle' });
    const W = "now() - interval '30 days'";
    const rev = Number(sql(`select coalesce(sum(subtotal),0) from public.project_quotes where status='paid' and paid_at > ${W}`));
    const cost = Number(sql(`select coalesce(sum(c.amount),0) from public.project_costs c where c.project_id in (select project_id from public.project_quotes where status='paid' and paid_at > ${W})`));
    const vals = await p.getByTestId('margins').locator('[data-value]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));
    if (Math.round(vals[0]) !== Math.round(rev) || Math.round(vals[2]) !== Math.round(rev - cost)) throw new Error(`page ${vals} db rev ${rev} cost ${cost}`);
  });

  await run('price list: owner sets the kit price; coupon 20% applies at checkout; server verifies and redeems once', owner, async (p) => {
    await p.goto(B + '/admin/cms?doc=pricing', { waitUntil: 'networkidle' });
    await p.getByLabel('السعر (ر.س)').fill('900');
    await p.getByRole('button', { name: 'حفظ كمسودة' }).click();
    await toast(p, /حُفظت المسودة/);
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    await p.goto(B + '/admin/pricing', { waitUntil: 'networkidle' });
    await p.getByLabel('الكود').fill('T7KIT');
    await p.getByLabel('القيمة').fill('20');
    await p.getByLabel('حد الاستخدام').fill('1');
    await p.getByRole('button', { name: 'أنشئ الكوبون' }).click();
    await toast(p, /أُنشئ الكوبون/);
    const v = await client.newPage();
    await v.goto(B + '/discovery-kit', { waitUntil: 'networkidle' });
    const flow = v.locator('#kit-flow');
    for (const o of ['عودي وشرقي', 'متوازن للاستخدام اليومي', 'للجنسين', '200 – 450 ر.س']) await flow.getByRole('radio', { name: new RegExp('^' + o) }).click();
    await flow.getByRole('button', { name: /اطلب العينات · 900/ }).click();
    await v.fill('#k-first', 'نورة'); await v.fill('#k-last', 'S'); await v.fill('#k-phone', '+966500000000');
    await v.fill('#k-email', 'n7@example.com'); await v.selectOption('#k-city', 'Riyadh'); await v.fill('#k-address', 'RRRD1234');
    await flow.getByRole('button', { name: 'المتابعة للدفع' }).click();
    await v.waitForFunction(() => window.__moyasar?.amount === 90000, null, { timeout: 10000 });
    await v.getByLabel('كوبون الخصم').fill('NOPE');
    await v.getByRole('button', { name: 'تطبيق' }).click();
    await v.getByRole('alert').filter({ hasText: 'الكوبون غير صالح' }).waitFor();
    await v.getByLabel('كوبون الخصم').fill('t7kit');
    await v.getByRole('button', { name: 'تطبيق' }).click();
    await v.getByRole('status').filter({ hasText: 'طُبّق الكوبون T7KIT' }).waitFor();
    await v.waitForFunction(() => window.__moyasar?.amount === 72000 && window.__moyasar.metadata.coupon === 'T7KIT', null, { timeout: 10000 });
    const ref = await v.evaluate(() => window.__moyasar.metadata.order_ref);
    const payId = '44444444-4444-4444-8444-444444444444';
    await fetch(VERIFY + '/mock', { method: 'POST', body: JSON.stringify({ id: payId, status: 'paid', amount: 72000, currency: 'SAR', metadata: { kind: 'kit', order_ref: ref, coupon: 'T7KIT', email: 'n7@example.com' } }) });
    await v.goto(`${B}/discovery-kit/paid?id=${payId}&status=paid`, { waitUntil: 'networkidle' });
    await v.getByRole('heading', { name: /تم الدفع/ }).waitFor({ timeout: 10000 });
    if (sql("select uses from public.coupons where code='T7KIT'") !== '1') throw new Error('coupon not redeemed');
    // كوبون استُنفد: دفعة ثانية به لا تُقبل
    const pay2 = '55555555-5555-4555-8555-555555555555';
    await fetch(VERIFY + '/mock', { method: 'POST', body: JSON.stringify({ id: pay2, status: 'paid', amount: 72000, currency: 'SAR', metadata: { kind: 'kit', order_ref: 'KIT-X', coupon: 'T7KIT' } }) });
    const r = await (await fetch(`${VERIFY}/api/payments/verify?id=${pay2}`)).json();
    if (r.paid) throw new Error('used-up coupon accepted');
    await v.close();
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
