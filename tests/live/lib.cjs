// اختبارات «حية» على Supabase حقيقي (محلي): المصادقة وRLS والدوال والتخزين والدفع الوهمي.
// تحتاج تشغيلاً يدوياً — انظر tests/README.md. كل الإعداد من متغيرات البيئة:
//   LIVE_URL        نسخة الموقع المبنية على Supabase المحلي (افتراضي http://localhost:4178)
//   LIVE_API        رابط Supabase (افتراضي http://localhost:54321)
//   LIVE_PUBLIC_API رابط Supabase كما بُني به الموقع (افتراضي = LIVE_API)
//   LIVE_ANON_KEY   المفتاح العام لـSupabase المحلي
//   LIVE_DB_URL     اتصال psql بقاعدة Supabase المحلية (افتراضي postgresql://postgres:postgres@localhost:54322/postgres)
//   LIVE_VERIFY     خادم التحقق الوهمي من الدفع (tests/live/verify-server.ts، افتراضي http://localhost:8788)
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const B = process.env.LIVE_URL || 'http://localhost:4178';
const API = process.env.LIVE_API || 'http://localhost:54321';
// رابط Supabase الذي بُنيت به نسخة الموقع (قد يختلف عن LIVE_API إن مرّ عبر https)
const PUBLIC_API = process.env.LIVE_PUBLIC_API || API;
const ANON = process.env.LIVE_ANON_KEY || '';
const VERIFY = process.env.LIVE_VERIFY || 'http://localhost:8788';
const DB = process.env.LIVE_DB_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
const FIX = path.join(__dirname, '..', 'fixtures', 'e2e');
if (!ANON) throw new Error('LIVE_ANON_KEY is not set');

const OUT = path.join(__dirname, '.out', path.basename(require.main.filename, '.cjs'));
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) => execFileSync('psql', [DB, '-tA', '-c', q]).toString().trim();
async function newCtx(browser, lang = 'ar', opts = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('_i')) { localStorage.setItem('pp_lang', l); sessionStorage.setItem('_i', '1'); } } catch {} }, lang);
  await ctx.route(/readdy\.ai\/api\/search-image/, (r) => r.fulfill({ path: `${FIX}/face.jpg`, contentType: 'image/jpeg' }));
  return ctx;
}
async function register(p, first, last, email, pass = 'Passw0rd!x') {
  await p.goto(B + '/auth?mode=register', { waitUntil: 'networkidle' });
  await p.getByLabel('الاسم الأول').fill(first);
  await p.getByLabel('اسم العائلة').fill(last);
  await p.getByLabel('البريد الإلكتروني').fill(email);
  await p.locator('#a-pass').fill(pass);
  await p.getByRole('radio').first().click();
  await p.locator('form button[type=submit]').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 15000 });
}
async function login(p, email, pass = 'Passw0rd!x') {
  await p.goto(B + '/auth', { waitUntil: 'networkidle' });
  await p.getByLabel('البريد الإلكتروني').fill(email);
  await p.locator('#a-pass').fill(pass);
  await p.locator('form button[type=submit]').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 15000 });
}
function harness(OUT) {
  const results = [], errors = [];
  const run = async (name, ctx, fn) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|remixicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
    p.on('response', r => { if (/:54(321|443)/.test(r.url()) && r.status() >= 400 && !/\/auth\/v1\/token/.test(r.url())) errors.push(`${name} HTTP ${r.status()} ${r.request().method()} ${r.url().replace(B, '').slice(0, 140)}`); });
    try { await fn(p); results.push('PASS ' + name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); await p.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {}); }
    await p.close();
  };
  return { results, errors, run };
}
module.exports = { chromium, B, API, PUBLIC_API, ANON, VERIFY, FIX, OUT, sql, newCtx, register, login, harness };
