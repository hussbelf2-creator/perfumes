// @ts-nocheck — اختبار سلوك (fetch مزيّف)
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST, compose } from "../../api/lead-notify";
const calls = [];
let fail = new Set();
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
  const name = String(url).includes('graph.facebook') ? 'whatsapp' : String(url).includes('resend') ? 'email' : 'webhook';
  return new Response('{}', { status: fail.has(name) ? 500 : 200 });
};
const SECRET = 'x'.repeat(40);
const lead = { id: '11111111-2222-3333-4444-555555555555', kind: 'brief', payload: { track: 'A', track_title: 'براند عطري كامل', firstName: 'هلا', lastName: 'الشمري', phone: '0551234567', email: 'hala@x.sa', a_stage: 'idea', a_audience: 'men', a_qty: '300_1000', a_timing: '3m', a_package: '1', brand: 'مسك الليل', message: 'سطر\nثانٍ' } };
const req = (body, secret = SECRET) => new Request('https://x.test/api/lead-notify', { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-webhook-secret': secret } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const ev = (record = lead) => ({ type: 'INSERT', table: 'leads', schema: 'public', record, old_record: null });
const t = (name, fn) => test(name, async () => { calls.length = 0; fail = new Set(); await fn(); });
const env = (o) => { for (const k of ['LEAD_WEBHOOK_SECRET','SITE_URL','NOTIFY_KINDS','WHATSAPP_TOKEN','WHATSAPP_PHONE_NUMBER_ID','NOTIFY_WHATSAPP_TO','WHATSAPP_TEMPLATE','WHATSAPP_TEMPLATE_LANG','RESEND_API_KEY','NOTIFY_EMAIL_TO','NOTIFY_EMAIL_FROM','NOTIFY_WEBHOOK_URL']) delete process.env[k]; Object.assign(process.env, o); };

await t('503 without a strong secret', async () => { env({ LEAD_WEBHOOK_SECRET: 'short' }); const r = await POST(req(ev())); assert.equal(r.status, 503); assert.equal(calls.length, 0); });
await t('401 on missing or wrong secret (no sends)', async () => {
  env({ LEAD_WEBHOOK_SECRET: SECRET, NOTIFY_WEBHOOK_URL: 'https://hooks.test/x' });
  assert.equal((await POST(req(ev(), null))).status, 401);
  assert.equal((await POST(req(ev(), 'y'.repeat(40)))).status, 401);
  assert.equal((await POST(req(ev(), SECRET + 'x'))).status, 401);
  assert.equal(calls.length, 0);
});
await t('ignores non-insert events, other tables, newsletter', async () => {
  env({ LEAD_WEBHOOK_SECRET: SECRET, NOTIFY_WEBHOOK_URL: 'https://hooks.test/x' });
  for (const b of [{ ...ev(), type: 'UPDATE' }, { ...ev(), table: 'contacts' }, ev({ ...lead, kind: 'newsletter' })]) { const r = await POST(req(b)); assert.equal(r.status, 200); assert.ok((await r.json()).skipped); }
  assert.equal(calls.length, 0);
});
await t('400 on bad json; 503 when no channel configured', async () => {
  env({ LEAD_WEBHOOK_SECRET: SECRET });
  assert.equal((await POST(req('{nope'))).status, 400);
  assert.equal((await POST(req(ev()))).status, 503);
});
await t('message: who, how to reach, readable answers, deep link', async () => {
  const m = compose(lead, 'https://brand.sa/');
  assert.match(m.subject, /طلب «ابدأ مسارك» — هلا الشمري/);
  for (const s of ['0551234567 · hala@x.sa', 'براند عطري كامل', 'فكرة فقط', 'رجالي', '300 – 1,000', 'التوقيع', 'مسك الليل']) assert.ok(m.text.includes(s), s);
  assert.ok(m.text.endsWith('https://brand.sa/admin/inbox?open=11111111-2222-3333-4444-555555555555'));
  assert.ok(!/\n|\s{2,}/.test(m.oneLine)); assert.ok(m.oneLine.length <= 900);
});
await t('all three channels fire with the right shapes', async () => {
  env({ LEAD_WEBHOOK_SECRET: SECRET, SITE_URL: 'https://brand.sa', WHATSAPP_TOKEN: 'WA_TOKEN', WHATSAPP_PHONE_NUMBER_ID: '123', NOTIFY_WHATSAPP_TO: '+966 55 000 1111, 966550002222', WHATSAPP_TEMPLATE: 'new_lead', RESEND_API_KEY: 're_KEY', NOTIFY_EMAIL_TO: 'a@brand.sa,b@brand.sa', NOTIFY_EMAIL_FROM: 'المنصة <noreply@brand.sa>', NOTIFY_WEBHOOK_URL: 'https://hooks.test/x' });
  const r = await POST(req(ev())); const b = await r.json();
  assert.equal(r.status, 200); assert.deepEqual(b.sent.sort(), ['email', 'webhook', 'whatsapp', 'whatsapp']);
  const wa = calls.filter((c) => c.url.includes('graph.facebook'));
  assert.equal(wa[0].url, 'https://graph.facebook.com/v21.0/123/messages');
  assert.deepEqual(wa.map((c) => c.body.to), ['966550001111', '966550002222']);
  assert.equal(wa[0].body.template.name, 'new_lead'); assert.equal(wa[0].body.template.language.code, 'ar');
  assert.equal(wa[0].init.headers.Authorization, 'Bearer WA_TOKEN');
  const em = calls.find((c) => c.url.includes('resend')); assert.deepEqual(em.body.to, ['a@brand.sa', 'b@brand.sa']); assert.match(em.body.subject, /هلا الشمري/);
  const wh = calls.find((c) => c.url === 'https://hooks.test/x'); assert.equal(wh.body.lead_id, lead.id); assert.ok(wh.body.text.includes('مسك الليل'));
  assert.ok(!JSON.stringify(b).includes('WA_TOKEN') && !JSON.stringify(b).includes('re_KEY'));
});
await t('one channel failing still reports success; all failing → 502', async () => {
  env({ LEAD_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: 'k', NOTIFY_EMAIL_TO: 'a@b.sa', NOTIFY_EMAIL_FROM: 'n@b.sa', NOTIFY_WEBHOOK_URL: 'https://hooks.test/x' });
  fail = new Set(['email']);
  let r = await POST(req(ev())); let b = await r.json(); assert.equal(r.status, 200); assert.deepEqual(b.sent, ['webhook']); assert.deepEqual(b.failed, ['email 500']);
  fail = new Set(['email', 'webhook']);
  r = await POST(req(ev())); assert.equal(r.status, 502);
});
await t('non-https webhook is never called; NOTIFY_KINDS filters', async () => {
  env({ LEAD_WEBHOOK_SECRET: SECRET, NOTIFY_WEBHOOK_URL: 'http://internal/x' });
  assert.equal((await POST(req(ev()))).status, 503); assert.equal(calls.length, 0);
  env({ LEAD_WEBHOOK_SECRET: SECRET, NOTIFY_WEBHOOK_URL: 'https://hooks.test/x', NOTIFY_KINDS: 'booking' });
  const r = await POST(req(ev())); assert.equal((await r.json()).skipped, 'kind'); assert.equal(calls.length, 0);
});
await t('other kinds: booking message uses subject/message', async () => {
  const m = compose({ id: 'L1', kind: 'contact', payload: { firstName: 'سارة', subject: 'B', message: 'أريد عطراً' } }, '');
  assert.ok(m.text.startsWith('رسالة من الموقع — سارة')); assert.ok(m.text.includes('أريد عطراً')); assert.equal(m.link, '');
});
