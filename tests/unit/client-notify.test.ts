// @ts-nocheck — اختبار سلوك (fetch مزيّف)
import { test } from "node:test";
import assert from "node:assert/strict";
import { noticeFor, waNumber, POST } from "../../api/client-notify";
const t = (n, f) => test(n, f);
const P = '11111111-2222-3333-4444-555555555555';
await t('design sent for approval → notice with deep link', () => {
  const n = noticeFor({ table: 'project_items', type: 'INSERT', record: { id: 'I1', project_id: P, title: 'الملصق', version: 2, by_client: false, status: 'pending' } }, 'مسك الليل');
  assert.equal(n.subject, 'تصميم بانتظار اعتمادك: الملصق'); assert.match(n.text, /\(نسخة 2\)/); assert.equal(n.path, `/account/projects/${P}#it-I1`);
});
await t('client-sent design and superseding updates are silent', () => {
  assert.equal(noticeFor({ table: 'project_items', type: 'INSERT', record: { project_id: P, by_client: true, status: 'submitted' } }, 'x'), null);
  assert.equal(noticeFor({ table: 'project_items', type: 'UPDATE', record: { project_id: P, status: 'superseded' } }, 'x'), null);
});
await t('quote sent / paid; other quote updates silent', () => {
  assert.match(noticeFor({ table: 'project_quotes', type: 'UPDATE', record: { project_id: P, status: 'sent', ref: 'QT-1', total: 13800 }, old_record: { status: 'draft' } }, 'p').text, /13,800.00 ر.س/);
  assert.match(noticeFor({ table: 'project_quotes', type: 'UPDATE', record: { project_id: P, status: 'paid', ref: 'QT-1', paid_amount: 6900 }, old_record: { status: 'accepted' } }, 'p').subject, /استلمنا العربون/);
  assert.equal(noticeFor({ table: 'project_quotes', type: 'UPDATE', record: { project_id: P, status: 'accepted' }, old_record: { status: 'sent' } }, 'p'), null);
  assert.equal(noticeFor({ table: 'project_quotes', type: 'UPDATE', record: { project_id: P, status: 'void' }, old_record: { status: 'sent' } }, 'p'), null);
});
await t('stage change uses the track labels and names the next stage', () => {
  const n = noticeFor({ table: 'projects', type: 'UPDATE', record: { id: P, track: 'A', stage: 'formula' }, old_record: { stage: 'brief' } }, 'مسك');
  assert.equal(n.subject, 'مشروعك «مسك» انتقل إلى: التركيبة والعينات'); assert.match(n.text, /المرحلة التالية: الهوية والعبوة/);
  assert.match(noticeFor({ table: 'projects', type: 'UPDATE', record: { id: P, track: 'F', stage: 'delivered' }, old_record: { stage: 'printing' } }, 'x').text, /اكتمل/);
  assert.equal(noticeFor({ table: 'projects', type: 'UPDATE', record: { id: P, stage: 'brief', title: 'new' }, old_record: { stage: 'brief' } }, 'x'), null);
});
await t('Saudi numbers normalised for WhatsApp; others dropped', () => {
  assert.equal(waNumber('055 123 4567'), '966551234567'); assert.equal(waNumber('+966551234567'), '966551234567'); assert.equal(waNumber('551234567'), '966551234567'); assert.equal(waNumber('0112345678'), ''); assert.equal(waNumber(''), '');
});
await t('secret required', async () => {
  process.env.LEAD_WEBHOOK_SECRET = 's'.repeat(40);
  const r = await POST(new Request('https://x/api/client-notify', { method: 'POST', headers: { 'x-webhook-secret': 'nope' }, body: '{}' })); assert.equal(r.status, 401);
});

await t('contract sent and fully signed → client notices with a deep link', () => {
  const sent = noticeFor({ table: 'project_contracts', type: 'UPDATE', record: { project_id: P, ref: 'CT-260001', status: 'sent' }, old_record: { status: 'draft' } }, 'مسك الليل');
  assert.equal(sent.subject, 'عقد CT-260001 بانتظار توقيعك');
  assert.equal(sent.path, `/account/projects/${P}#pj-contract`);
  const signed = noticeFor({ table: 'project_contracts', type: 'UPDATE', record: { project_id: P, ref: 'CT-260001', status: 'signed' }, old_record: { status: 'client_signed' } }, 'مسك الليل');
  assert.match(signed.subject, /اكتمل توقيع العقد/);
  assert.equal(noticeFor({ table: 'project_contracts', type: 'UPDATE', record: { project_id: P, status: 'client_signed' }, old_record: { status: 'sent' } }, 'x'), null, 'the client signing is not notified back to the client');
});
