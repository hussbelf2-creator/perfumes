// @ts-nocheck — اختبار سلوك (fetch مزيّف)
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../api/payments/verify";
const ID = '760878ec-d1d3-5f72-9056-191683f55872';
const calls = [];
let next = null;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('site_content') || String(url).includes('coupon_redemptions')) return new Response('[]', { status: 200 });
  if (String(url).includes('supabase')) return new Response(null, { status: 201 });
  if (next instanceof Error) throw next;
  return next;
};
const pay = (o) => new Response(JSON.stringify({ id: ID, status: 'paid', amount: 75000, currency: 'SAR', metadata: { order_ref: 'KIT-ABC234', kind: 'kit', email: 'a@b.co' }, source: { type: 'creditcard', company: 'mada' }, ...o }), { status: 200 });
const call = async (id = ID) => { const r = await GET(new Request('https://x.test/api/payments/verify?id=' + id)); return { code: r.status, body: await r.json(), cache: r.headers.get('cache-control') }; };
const t = (name, fn) => test(name, async () => { calls.length = 0; await fn(); });

delete process.env.MOYASAR_SECRET_KEY;
await t('rejects malformed id (no gateway call)', async () => { const r = await call('../../v1/invoices'); assert.equal(r.code, 400); assert.equal(calls.length, 0); });
await t('503 when secret missing', async () => { const r = await call(); assert.equal(r.code, 503); assert.equal(r.body.paid, false); });
process.env.MOYASAR_SECRET_KEY = 'sk_test_SECRET';
await t('paid + correct amount => paid', async () => {
  next = pay();
  const r = await call();
  assert.equal(r.body.paid, true); assert.equal(r.body.ref, 'KIT-ABC234'); assert.equal(r.cache, 'no-store');
  assert.equal(calls[0].url, 'https://api.moyasar.com/v1/payments/' + ID);
  assert.equal(calls[0].init.headers.Authorization, 'Basic ' + btoa('sk_test_SECRET:'));
  assert.ok(!JSON.stringify(r.body).includes('SECRET'));
});
await t('paid but tampered amount => not paid', async () => { next = pay({ amount: 100 }); const r = await call(); assert.equal(r.body.paid, false); assert.equal(r.body.status, 'amount_mismatch'); });
await t('paid in wrong currency => not paid', async () => { next = pay({ currency: 'USD' }); const r = await call(); assert.equal(r.body.paid, false); });
await t('failed payment => not paid', async () => { next = pay({ status: 'failed' }); const r = await call(); assert.equal(r.body.paid, false); assert.equal(r.body.status, 'failed'); });
await t('404 from gateway', async () => { next = new Response('{}', { status: 404 }); const r = await call(); assert.equal(r.code, 404); });
await t('gateway 500 => 502', async () => { next = new Response('x', { status: 500 }); const r = await call(); assert.equal(r.code, 502); });
await t('gateway unreachable => 502', async () => { next = new Error('ECONNRESET'); const r = await call(); assert.equal(r.code, 502); assert.equal(r.body.status, 'gateway_unreachable'); });
await t('custom price env respected', async () => { process.env.KIT_PRICE_HALALAS = '50000'; next = pay({ amount: 50000 }); const r = await call(); assert.equal(r.body.paid, true); delete process.env.KIT_PRICE_HALALAS; });
await t('records to supabase when configured', async () => {
  process.env.SUPABASE_URL = 'https://p.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk';
  next = pay(); await call();
  const sb = calls.find(c => c.url.includes('/rest/v1/payments'));
  assert.ok(sb, 'no supabase call'); assert.equal(sb.url, 'https://p.supabase.co/rest/v1/payments?on_conflict=id');
  const row = JSON.parse(sb.init.body); assert.equal(row.order_ref, 'KIT-ABC234'); assert.equal(row.method, 'mada');
});
// السعر من وثيقة الأسعار المنشورة والكوبون من الخادم
const routeSb = (handlers) => { globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); for (const [re, fn] of handlers) if (re.test(String(url))) return fn(init); if (next instanceof Error) throw next; return next; }; };
await t('kit price comes from the published pricing document', async () => {
  routeSb([[/site_content/, () => new Response(JSON.stringify([{ value: { kit: { price: 900 } } }]), { status: 200 })], [/rest\/v1\/payments/, () => new Response(null, { status: 201 })]]);
  next = pay({ amount: 90000 }); let r = await call(); assert.equal(r.body.paid, true);
  next = pay({ amount: 75000 }); r = await call(); assert.equal(r.body.paid, false); assert.equal(r.body.status, 'amount_mismatch');
});
await t('coupon: server computes the price and redeems after a verified payment', async () => {
  const rpcs = [];
  routeSb([[/site_content/, () => new Response(JSON.stringify([{ value: { kit: { price: 750 } } }]), { status: 200 })], [/rest\/v1\/payments/, () => new Response(null, { status: 201 })],
    [/rpc\/coupon_price/, (init) => { const b = JSON.parse(init.body); rpcs.push(['price', b]); return new Response(JSON.stringify(b.p_code === 'RAMADAN' ? 60000 : null), { status: 200 }); }],
    [/rpc\/redeem_coupon/, (init) => { rpcs.push(['redeem', JSON.parse(init.body)]); return new Response('"ok"', { status: 200 }); }]]);
  next = pay({ amount: 60000, metadata: { order_ref: 'KIT-1', kind: 'kit', coupon: 'RAMADAN' } });
  let r = await call(); assert.equal(r.body.paid, true);
  assert.deepEqual(rpcs.map((x) => x[0]), ['price', 'redeem']); assert.equal(rpcs[1][1].p_base, 75000); assert.equal(rpcs[1][1].p_paid, 60000);
  rpcs.length = 0;
  next = pay({ amount: 60000, metadata: { order_ref: 'KIT-2', kind: 'kit', coupon: 'FAKE' } });
  r = await call(); assert.equal(r.body.paid, false); assert.ok(!rpcs.some((x) => x[0] === 'redeem'));
  next = pay({ amount: 50000, metadata: { order_ref: 'KIT-3', kind: 'kit', coupon: 'RAMADAN' } });
  r = await call(); assert.equal(r.body.paid, false);
});

// ── بعد المراجعة
await t('tampered amount is recorded as amount_mismatch, not paid', async () => {
  process.env.SUPABASE_URL = 'https://p.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk';
  routeSb([[/site_content/, () => new Response('[]', { status: 200 })], [/coupon_redemptions/, () => new Response('[]', { status: 200 })], [/rest\/v1\/payments/, () => new Response(null, { status: 201 })]]);
  next = pay({ amount: 100 });
  const r = await call();
  assert.equal(r.body.paid, false);
  const row = JSON.parse(calls.find((c) => c.url.includes('/rest/v1/payments')).init.body);
  assert.equal(row.status, 'amount_mismatch');
});
await t('price list unreachable → 502, the payment is not judged on a fallback price', async () => {
  routeSb([[/site_content/, () => new Response('x', { status: 500 })]]);
  next = pay();
  const r = await call();
  assert.equal(r.code, 502);
  assert.equal(r.body.status, 'pricing_unavailable');
});
await t('coupon re-check after the last use is consumed still reads paid (recorded redemption wins)', async () => {
  const rpcs = [];
  routeSb([[/site_content/, () => new Response(JSON.stringify([{ value: { kit: { price: 750 } } }]), { status: 200 })], [/coupon_redemptions/, () => new Response(JSON.stringify([{ amount: 60000 }]), { status: 200 })], [/rest\/v1\/payments/, () => new Response(null, { status: 201 })],
    [/rpc\//, (init) => { rpcs.push(init.body); return new Response('null', { status: 200 }); }]]);
  next = pay({ amount: 60000, metadata: { order_ref: 'KIT-9', kind: 'kit', coupon: 'ONCE' } });
  const r = await call();
  assert.equal(r.body.paid, true);
  assert.equal(rpcs.length, 0, 'no price recomputation or second redemption');
});
await t('lost race for the last coupon use → needs_review, not paid', async () => {
  routeSb([[/site_content/, () => new Response(JSON.stringify([{ value: { kit: { price: 750 } } }]), { status: 200 })], [/coupon_redemptions/, () => new Response('[]', { status: 200 })], [/rest\/v1\/payments/, () => new Response(null, { status: 201 })],
    [/rpc\/coupon_price/, () => new Response('60000', { status: 200 })], [/rpc\/redeem_coupon/, () => new Response('"invalid"', { status: 200 })]]);
  next = pay({ amount: 60000, metadata: { order_ref: 'KIT-10', kind: 'kit', coupon: 'LAST' } });
  const r = await call();
  assert.equal(r.body.paid, false);
  assert.equal(r.body.status, 'needs_review');
});
await t('deposit charged but quote already paid elsewhere → 409 needs_review, recorded for refund', async () => {
  const Q = '11111111-2222-3333-4444-555555555555';
  routeSb([[/project_quotes/, () => new Response(JSON.stringify([{ ref: 'QT-260001', deposit: 500, status: 'paid' }]), { status: 200 })], [/rpc\/record_deposit/, () => new Response('"already_paid"', { status: 200 })], [/rest\/v1\/payments/, () => new Response(null, { status: 201 })]]);
  next = pay({ amount: 50000, metadata: { kind: 'deposit', quote_id: Q } });
  const r = await call();
  assert.equal(r.code, 409);
  assert.equal(r.body.status, 'needs_review');
  const row = JSON.parse(calls.find((c) => c.url.includes('/rest/v1/payments')).init.body);
  assert.equal(row.status, 'needs_review');
});
