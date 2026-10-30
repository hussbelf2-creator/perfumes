// @ts-nocheck — اختبار هندسي على three.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLabelGeometry, perimeter, labelZone } from "@/studio/label/geometry";
const ok = (c, l) => test(l, () => assert.ok(c));
const rowLen = (g, segU, j) => { const p = g.getAttribute('position'); let L = 0; for (let i = 1; i <= segU; i++) { const a = j * (segU + 1) + i - 1, b = a + 1; L += Math.hypot(p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a)); } return L; };
const cyl = [[20, 0], [20, 80]];
let g = buildLabelGeometry(cyl, 2, 1, { widthMm: 50, heightMm: 30, centerYmm: 40, offsetMm: 0 }, 128, 8);
ok(Math.abs(rowLen(g, 128, 4) - 50) < 0.1, `round: label arc width = 50mm (${rowLen(g, 128, 4).toFixed(2)})`);
const pp = g.getAttribute('position'); let ymin = 1e9, ymax = -1e9; for (let i = 0; i < pp.count; i++) { ymin = Math.min(ymin, pp.getY(i)); ymax = Math.max(ymax, pp.getY(i)); }
ok(Math.abs(ymin - 25) < 1e-6 && Math.abs(ymax - 55) < 1e-6, 'height 30mm centred at 40mm');
// المنتصف على الواجهة الأمامية (+z) والعموديات للخارج
const mid = 4 * 129 + 64; ok(Math.abs(pp.getX(mid)) < 1e-6 && pp.getZ(mid) > 19.9, 'label centre on the front face');
const n = g.getAttribute('normal'); ok(n.getZ(mid) > 0.99, 'label faces outward');
// u يزيد نحو +x (يمين المشاهد) — وإلا انعكس النص
ok(pp.getX(4 * 129 + 0) < 0 && pp.getX(4 * 129 + 128) > 0, 'u=0 on viewer\'s left, u=1 on the right (text not mirrored)');
g = buildLabelGeometry([[26.9, 0], [26.9, 88]], 7, 0.55, { widthMm: 40, heightMm: 30, centerYmm: 40, offsetMm: 0 }, 128, 8);
ok(Math.abs(rowLen(g, 128, 4) - 40) < 0.15, `square flat bottle: arc width = 40mm (${rowLen(g, 128, 4).toFixed(2)})`);
g = buildLabelGeometry(cyl, 2, 1, { widthMm: 400, heightMm: 20, centerYmm: 40, offsetMm: 0 }, 128, 4);
const P = perimeter(20, 2, 1); ok(Math.abs(P - 2 * Math.PI * 20) < 0.05, `perimeter of r=20 circle = 2πr (${P.toFixed(2)})`);
ok(rowLen(g, 128, 2) <= P * 0.961, `too-wide label clamped below full wrap (${rowLen(g, 128, 2).toFixed(1)} of ${P.toFixed(1)})`);
const z = labelZone([[17.4, 0], [18.3, 1.5], [18.4, 3], [18.4, 70], [17.8, 74], [15.1, 78], [8.9, 81.5], [7.6, 83], [7.6, 96]], 13);
ok(z.top > 70 && z.top < 78 && z.bottom <= 6, `label zone below the shoulder (${z.bottom.toFixed(1)}–${z.top.toFixed(1)}mm)`);
{
  // انتظام التوزيع: على الواجهة المسطحة كل عمود من الملصق يبعد نفس المسافة عن جاره (لا تمطيط في المنتصف)
  const bl = buildLabelGeometry;
  const g2 = bl([[26.9, 0], [26.9, 88]], 7, 0.55, { widthMm: 40, heightMm: 30, centerYmm: 40, offsetMm: 0 }, 64, 2);
  const p2 = g2.getAttribute('position'); const steps = [];
  for (let i = 1; i <= 64; i++) { const a = 65 + i - 1, b = a + 1; steps.push(Math.hypot(p2.getX(b) - p2.getX(a), p2.getZ(b) - p2.getZ(a))); }
  const mx = Math.max(...steps), mn = Math.min(...steps);
  ok(mx / mn < 1.02, `square bottle: uniform column spacing (max/min ${(mx / mn).toFixed(3)}; ${mn.toFixed(3)}–${mx.toFixed(3)}mm)`);
}
