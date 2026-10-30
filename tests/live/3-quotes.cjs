// عرض السعر والعربون على Supabase حقيقي: مسودة → إرسال → تعديل → اعتماد → مويسر (وهمي) / تحويل بنكي
const { chromium, B, sql, newCtx, register, login, harness, API, PUBLIC_API, ANON, VERIFY, FIX, OUT } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const { results, errors, run } = harness(OUT);
  sql(`delete from public.projects where client_email in ('qa@live.test'); delete from public.contacts where email='qa@live.test'; delete from auth.users where email='qa@live.test'; delete from public.payments where kind='deposit'; delete from public.site_content_drafts where key='site'; delete from public.site_content where key='site';`.replace(/\s+/g, ' '));
  const route = async (ctx) => {
    // دالة التحقق (Vercel) محلياً، ونموذج مويسر وهمي يكشف ما يُمرَّر له
    await ctx.route('**/api/payments/verify*', async (r) => { const u = new URL(r.request().url()); const res = await fetch(VERIFY + u.pathname + u.search); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); });
    await ctx.route(/cdn\.moyasar\.com\/.*\.js$/, (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.Moyasar={init:(o)=>{window.__moyasar=o;const b=document.createElement("button");b.type="button";b.textContent="ادفع (وهمي)";(typeof o.element==="string"?document.querySelector(o.element):o.element).appendChild(b);}};' }));
    await ctx.route(/cdn\.moyasar\.com\/.*\.css$/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  };
  const owner = await newCtx(browser); await route(owner);
  const client = await newCtx(browser); await route(client);
  const toast = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 10000 });
  let pid = '';

  await run('setup: client account, project in brief linked to a CRM contact; billing details in CMS', owner, async (p) => {
    const c = await client.newPage();
    await register(c, 'قمر', 'الحربي', 'qa@live.test');
    await c.close();
    sql("insert into public.contacts (name, email, phone, source) values ('قمر الحربي','qa@live.test','0553334444','brief')");
    pid = sql("insert into public.projects (title, track, client_email, contact_id, stage) select 'دار قمر','D','qa@live.test', id, 'brief' from public.contacts where email='qa@live.test' returning id").split('\n')[0];
    await login(p, 'owner@live.test');
    await p.goto(B + '/admin/cms?doc=site', { waitUntil: 'networkidle' });
    await p.getByLabel('الاسم النظامي للمنشأة').fill('شركة منصة العطور');
    await p.getByLabel('الرقم الضريبي').fill('300000000000003');
    await p.getByLabel('اسم البنك').fill('مصرف الراجحي');
    await p.getByLabel('الآيبان').fill('sa03 8000 0000 6080 1016 7519');
    await p.getByRole('button', { name: 'حفظ كمسودة' }).click();
    await toast(p, /حُفظت المسودة/);
    await p.getByRole('button', { name: 'نشر', exact: true }).click();
    await toast(p, /نُشر في الموقع/);
    if (sql("select value->'billing'->>'iban' from public.site_content where key='site'") !== 'SA0380000000608010167519') throw new Error('iban not normalised');
  });

  await run('team drafts a quote (live totals, VAT 15%), client cannot see the draft, then sends it', owner, async (p) => {
    await p.goto(B + '/admin/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'أنشئ عرض السعر' }).click();
    await p.getByLabel('وصف البند 1').fill('هوية بصرية كاملة');
    await p.getByLabel('سعر وحدة البند 1').fill('12000');
    await p.getByRole('button', { name: '+ بند' }).click();
    await p.getByLabel('وصف البند 2').fill('دليل استخدام الهوية');
    await p.getByLabel('سعر وحدة البند 2').fill('2500.5');
    const total = await p.getByTestId('editor-total').innerText();
    if (!total.includes('16,675.58')) throw new Error('live total ' + total);
    await p.getByRole('button', { name: 'حفظ المسودة' }).click();
    await toast(p, /حُفظت مسودة العرض/);
    const c = await client.newPage();
    await c.goto(B + '/account/projects/' + pid, { waitUntil: 'networkidle' });
    await c.getByRole('heading', { level: 1, name: 'دار قمر' }).waitFor();
    if (await c.getByText('عرض السعر').count()) throw new Error('draft visible to client');
    await c.close();
    await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await toast(p, /أُرسل العرض للعميل/);
    const row = sql(`select concat_ws('|', status, subtotal, vat, total, deposit) from public.project_quotes where project_id='${pid}'`);
    if (row !== 'sent|14500.50|2175.08|16675.58|8337.79') throw new Error('db ' + row);
    if (sql("select concat_ws('|', stage, value) from public.contacts where email='qa@live.test'") !== 'proposal|16675.58') throw new Error('crm not updated');
  });

  await run('client asks for changes; team sends an updated quote; old one is superseded', client, async (p) => {
    await p.goto(B + '/account', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'راجع عرض السعر لـ«دار قمر»' }).waitFor();
    await p.getByRole('link', { name: /^راجِع واعتمد: راجع عرض السعر/ }).click();
    await p.waitForURL(/#pj-quote$/);
    await p.goto(B + '/account/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByText('الرقم الضريبي 300000000000003').waitFor();
    await p.getByRole('button', { name: 'طلب تعديل' }).click();
    await p.getByLabel('ما الذي تريد تعديله في العرض؟').fill('هل يمكن إلغاء الدليل؟');
    await p.getByRole('button', { name: 'أرسل طلب التعديل' }).click();
    await toast(p, /وصل طلبك للفريق/);
    await p.getByRole('list', { name: 'الرسائل' }).getByText(/هل يمكن إلغاء الدليل/).waitFor();
    const o = await owner.newPage();
    await o.goto(B + '/admin/projects/' + pid, { waitUntil: 'networkidle' });
    await o.getByText('ملاحظة العميل: هل يمكن إلغاء الدليل؟').waitFor();
    await o.getByRole('button', { name: 'عرض محدّث' }).click();
    await o.getByRole('button', { name: 'احذف البند 2' }).click();
    await o.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await o.getByRole('status').filter({ hasText: /أُرسل العرض للعميل/ }).first().waitFor();
    await o.close();
    if (sql(`select string_agg(status, ',' order by created_at) from public.project_quotes where project_id='${pid}'`) !== 'void,sent') throw new Error('versions');
    await p.reload({ waitUntil: 'networkidle' });
    await p.getByTestId('quote-total').filter({ hasText: '13,800.00' }).waitFor();
    await p.getByText('عروض سابقة').waitFor();
  });

  await run('client approves; deposit form gets the server amount; bank details shown; "I transferred" tells the team', client, async (p) => {
    await p.goto(B + '/account/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: 'اعتمد العرض' }).click();
    await p.getByText(/باعتمادك توافق على البنود أعلاه بإجمالي 13,800.00 ر.س/).waitFor();
    await p.getByRole('button', { name: 'تأكيد الاعتماد' }).click();
    await toast(p, /اعتُمد العرض/);
    await p.getByRole('heading', { name: /ادفع العربون 6,900.00 ر.س/ }).waitFor();
    await p.waitForFunction(() => !!window.__moyasar, null, { timeout: 10000 });
    const o = await p.evaluate(() => ({ amount: window.__moyasar.amount, meta: window.__moyasar.metadata, cb: window.__moyasar.callback_url }));
    const qid = sql(`select id from public.project_quotes where project_id='${pid}' and status='accepted'`);
    if (o.amount !== 690000 || o.meta.kind !== 'deposit' || o.meta.quote_id !== qid || !o.cb.endsWith(`/account/projects/${pid}?pay=${qid}`)) throw new Error('moyasar opts ' + JSON.stringify(o));
    if ((await p.getByTestId('iban').innerText()) !== 'SA03 8000 0000 6080 1016 7519') throw new Error('iban display');
    await p.getByPlaceholder('مرجع التحويل (اختياري)').fill('TRX-77');
    await p.getByRole('button', { name: 'حوّلت العربون' }).click();
    await p.getByRole('status').filter({ hasText: 'أبلغنا الفريق' }).waitFor();
    await p.getByRole('list', { name: 'الرسائل' }).getByText(/حوّلت العربون لعرض QT-.*TRX-77/).waitFor();
  });

  await run('tampered gateway amount is rejected; the real deposit is recorded, project starts, deal won', client, async (p) => {
    const qid = sql(`select id from public.project_quotes where project_id='${pid}' and status='accepted'`);
    const pay = (id, amount) => fetch(VERIFY + '/mock', { method: 'POST', body: JSON.stringify({ id, status: 'paid', amount, currency: 'SAR', metadata: { kind: 'deposit', quote_id: qid }, source: { type: 'creditcard', company: 'mada' } }) });
    const bad = '11111111-1111-4111-8111-111111111111', good = '22222222-2222-4222-8222-222222222222';
    await pay(bad, 100);
    await p.goto(`${B}/account/projects/${pid}?pay=${qid}&id=${bad}&status=paid`, { waitUntil: 'networkidle' });
    await p.getByRole('status').filter({ hasText: 'لم تكتمل عملية الدفع' }).waitFor({ timeout: 10000 });
    if (sql(`select status from public.project_quotes where id='${qid}'`) !== 'accepted') throw new Error('tampered payment accepted');
    await pay(good, 690000);
    await p.goto(`${B}/account/projects/${pid}?pay=${qid}&id=${good}&status=paid`, { waitUntil: 'networkidle' });
    await p.getByRole('status').filter({ hasText: 'تم الدفع — استلمنا العربون' }).waitFor({ timeout: 10000 });
    await p.getByText(/استلمنا العربون 6,900.00 ر.س/).waitFor();
    await p.getByRole('list', { name: /المرحلة الحالية: المفاهيم/ }).waitFor();
    const row = sql(`select concat_ws('|', q.status, q.payment_method, q.payment_ref, c.stage) from public.project_quotes q join public.projects p on p.id=q.project_id join public.contacts c on c.id=p.contact_id where q.id='${qid}'`);
    if (row !== `paid|moyasar|${good}|won`) throw new Error('after pay ' + row);
    if (sql(`select concat_ws('|', kind, order_ref, amount) from public.payments where id='${good}'`) !== `deposit|${sql(`select ref from public.project_quotes where id='${qid}'`)}|690000`) throw new Error('payments log');
  });

  await run('team: bank transfer recorded manually on a new quote; quote locked after sending', owner, async (p) => {
    await p.goto(B + '/admin/projects/' + pid, { waitUntil: 'networkidle' });
    await p.getByText(/استُلم 6,900.00 ر.س · مويسر/).waitFor();
    await p.getByRole('button', { name: 'عرض محدّث' }).click();
    await p.getByLabel('وصف البند 1').fill('طباعة بطاقات');
    await p.getByLabel('سعر وحدة البند 1').fill('1000');
    await p.getByLabel('العربون ٪').fill('100');
    await p.getByRole('button', { name: 'حفظ وإرسال للعميل' }).click();
    await toast(p, /أُرسل العرض للعميل/);
    await p.getByRole('button', { name: 'تسجيل دفعة مستلمة' }).click();
    await p.getByLabel('المرجع').fill('RJHI-555');
    await p.getByRole('button', { name: 'تأكيد الاستلام' }).click();
    await toast(p, /سُجّلت الدفعة/);
    await p.getByText(/استُلم 1,150.00 ر.س · تحويل بنكي · RJHI-555/).waitFor();
    // العرض المرسَل لا يُعدَّل مباشرة
    const tok = (await (await fetch(API + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@live.test', password: 'Passw0rd!x' }) })).json()).access_token;
    const q = sql(`select id from public.project_quotes where project_id='${pid}' and status='paid' order by created_at desc limit 1`);
    const r = await fetch(`${API}/rest/v1/project_quotes?id=eq.${q}`, { method: 'PATCH', headers: { apikey: ANON, authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ label: 'x', qty: 1, unit: 1 }] }) });
    if (r.status < 400) throw new Error('paid quote edited: ' + r.status);
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
