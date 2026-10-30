// التقارير وقائمة العروض على Supabase: الأرقام في الصفحة = الأرقام من قاعدة البيانات مباشرة
const { chromium, B, sql, newCtx, login, harness, API, PUBLIC_API, ANON, VERIFY, FIX, OUT } = require('./lib.cjs');
(async () => {
  const browser = await chromium.launch();
  const { results, errors, run } = harness(OUT);
  const owner = await newCtx(browser, 'ar', { acceptDownloads: true });
  const W = "now() - interval '30 days'";
  const n = (q) => Number(sql(q));
  // بيانات معروفة فوق ما أنشأته t3: عرض مدفوع لمشروع «مسك الليل»، وعرض مرسل لمشروع الهوية
  sql(`select set_config('app.quote_rpc','1',false); delete from public.project_quotes where project_id in (select project_id from public.leads where kind='brief' and project_id is not null);`);
  const seed = (title, extra) => sql(`select set_config('app.quote_rpc','1',false); insert into public.project_quotes (project_id, ref, status, lines, ${Object.keys(extra).join(', ')}) select p.id, 'QT-T6-' || left(md5(random()::text), 6), ${extra.__status}, '[{"label":"بند","qty":1,"unit":1000}]' , ${Object.entries(extra).filter(([k]) => k !== '__status').map(([, v]) => v).join(', ')} from public.projects p where p.title = '${title}';`.replace('__status, ', ''));
  seed('مسك الليل', { __status: "'paid'", sent_at: "now() - interval '2 days'", decided_at: "now() - interval '2 days'", paid_at: "now() - interval '1 day'", paid_amount: 575, payment_method: "'bank'", payment_ref: "'T6'" });
  seed('هوية بصرية · هلا', { __status: "'sent'", sent_at: "now() - interval '1 day'" });
  await run('reports: funnel, collected and quotes sent match the database (30 days)', owner, async (p) => {
    await login(p, 'owner@live.test');
    await p.goto(B + '/admin/reports', { waitUntil: 'networkidle' });
    await p.getByRole('heading', { name: 'التقارير' }).waitFor();
    const briefs = `from public.leads l where l.kind='brief' and l.created_at > ${W}`;
    const has = (cond) => `exists (select 1 from public.project_quotes q where q.project_id=l.project_id and ${cond})`;
    const want = {
      brief: n(`select count(*) ${briefs}`),
      project: n(`select count(*) ${briefs} and l.project_id is not null`),
      quoted: n(`select count(*) ${briefs} and ${has('q.sent_at is not null')}`),
      accepted: n(`select count(*) ${briefs} and ${has("q.status in ('accepted','paid')")}`),
      paid: n(`select count(*) ${briefs} and ${has("q.status='paid'")}`),
    };
    if (!want.brief || !want.paid) throw new Error('test data missing: run 2-start and 3-quotes first ' + JSON.stringify(want));
    for (const [k, v] of Object.entries(want)) {
      const txt = await p.locator(`li[data-step=${k}]`).innerText();
      if (!new RegExp(`(^|\\D)${v.toLocaleString('en')}(\\D|$)`).test(txt.split('\n')[1] || txt)) throw new Error(`${k}: page "${txt}" want ${v}`);
    }
    const collected = n(`select coalesce((select sum(paid_amount) from public.project_quotes where status='paid' and paid_at > ${W}),0) + coalesce((select sum(amount)/100.0 from public.payments where status='paid' and kind is distinct from 'deposit' and created_at > ${W}),0)`);
    const kpi = await p.getByTestId('kpi-collected').getAttribute('data-value');
    if (Math.round(Number(kpi)) !== Math.round(collected)) throw new Error(`collected page ${kpi} db ${collected}`);
    const sent = n(`select count(*) from public.project_quotes where sent_at > ${W} and status <> 'void'`);
    if (Number(await p.getByTestId('kpi-sent').innerText()) !== sent) throw new Error('sent');
    // تغيير الفترة يعيد الحساب
    await p.getByRole('button', { name: '7 يوماً' }).click();
    if ((await p.getByRole('button', { name: '7 يوماً' }).getAttribute('aria-pressed')) !== 'true') throw new Error('period toggle');
  });

  await run('reports: action lists link to the right place', owner, async (p) => {
    // عرض مرسل قديم ينتظر العميل
    const q = sql("select q.id || '|' || q.project_id || '|' || q.ref from public.project_quotes q where q.status='sent' limit 1");
    if (!q) throw new Error('no sent quote in data');
    const [qid, pid, ref] = q.split('|');
    sql(`select set_config('app.quote_rpc','1',false); update public.project_quotes set sent_at = now() - interval '5 days' where id='${qid}'`);
    await p.goto(B + '/admin/reports', { waitUntil: 'networkidle' });
    const sec = p.getByRole('region', { name: 'عرض بلا رد' });
    await sec.getByText(ref).click();
    await p.waitForURL(new RegExp(`/admin/projects/${pid}$`));
  });

  await run('quotes page: filters, search and CSV export', owner, async (p) => {
    await p.goto(B + '/admin/quotes', { waitUntil: 'networkidle' });
    await p.getByLabel('الحالة').selectOption('all');
    const rows = await p.locator('tbody tr').count();
    if (rows !== n('select count(*) from public.project_quotes')) throw new Error('rows ' + rows);
    await p.getByLabel('الحالة').selectOption('paid');
    if ((await p.locator('tbody tr').count()) !== n("select count(*) from public.project_quotes where status='paid'")) throw new Error('paid filter');
    const ref = sql("select ref from public.project_quotes where status='paid' limit 1");
    await p.getByPlaceholder('ابحث برقم العرض أو المشروع أو البريد').fill(ref);
    if ((await p.locator('tbody tr').count()) !== 1) throw new Error('search');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'تصدير CSV' }).click()]);
    const csv = require('fs').readFileSync(await dl.path(), 'utf8');
    if (!csv.includes(ref) || !csv.split('\n')[0].includes('deposit_sar')) throw new Error('csv');
  });

  await run('legacy admin pages redirect to the real ones; nav shows them', owner, async (p) => {
    await p.goto(B + '/admin/orders', { waitUntil: 'networkidle' });
    if (!p.url().endsWith('/admin/quotes')) throw new Error('orders ' + p.url());
    await p.goto(B + '/admin/settings', { waitUntil: 'networkidle' });
    if (!p.url().endsWith('/admin/cms')) throw new Error('settings ' + p.url());
    const nav = p.getByRole('navigation', { name: 'لوحة الإدارة' });
    for (const l of ['عروض الأسعار', 'التقارير']) await nav.getByRole('link', { name: l }).waitFor();
    if (await nav.getByText('صفحات قيد الترحيل').count()) throw new Error('legacy group still shown');
  });

  console.log(results.join('\n'));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
