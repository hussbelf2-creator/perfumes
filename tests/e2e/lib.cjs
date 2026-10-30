// مشترك لاختبارات المتصفح: Playwright، مجلد اللقطات لكل ملف، روابط النسخ الثلاث، ومجلد الملفات الثابتة
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const name = path.basename(require.main.filename, '.cjs');
const OUT = path.join(__dirname, '.out', name);
fs.mkdirSync(OUT, { recursive: true });

// site: الموقع العادي · pay: بمفتاح مويسر تجريبي · admin: بدخول المدير التجريبي
const URLS = {
  site: process.env.E2E_SITE || 'http://localhost:4173',
  pay: process.env.E2E_PAY || 'http://localhost:4174',
  admin: process.env.E2E_ADMIN || 'http://localhost:4177',
};
const url = (k) => URLS[k];
const FIX = path.join(__dirname, '..', 'fixtures', 'e2e');

module.exports = { chromium, OUT, url, FIX };
