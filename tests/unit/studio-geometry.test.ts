// @ts-nocheck — اختبار هندسي على three.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLoft, smoothProfile } from "@/studio/geometry";
import { sectionAreaFactor } from "@/studio/profile";
const ok = (c, l) => test(l, () => assert.ok(c));
// الحجم بالتكامل على المثلثات (مبرهنة التباعد): موجب = العموديات للخارج والمجسم مغلق
const volume = (g) => { const p = g.getAttribute('position'), ix = g.getIndex().array; let v = 0;
  for (let i = 0; i < ix.length; i += 3) { const a = ix[i], b = ix[i+1], c = ix[i+2];
    const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),bx=p.getX(b),by=p.getY(b),bz=p.getZ(b),cx=p.getX(c),cy=p.getY(c),cz=p.getZ(c);
    v += (ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx)) / 6; } return v; };
let g = buildLoft([[20, 0], [20, 80]], { squareness: 2, depthRatio: 1, segments: 256 });
const cyl = Math.PI * 400 * 80;
ok(Math.abs(volume(g) - cyl) / cyl < 0.002, `cylinder volume positive & ≈ πr²h (${volume(g).toFixed(0)} vs ${cyl.toFixed(0)})`);
g = buildLoft([[20, 0], [20, 80]], { squareness: 40, depthRatio: 0.5, segments: 256 });
const box = sectionAreaFactor(40) * 20 * 10 * 80; // نفس معادلة حساب السعة
ok(Math.abs(volume(g) - box) / box < 0.002, `square section geometry = capacity formula (${volume(g).toFixed(0)} vs ${box})`);
g = buildLoft([[30, 0], [30, 75], [10, 90], [10, 110]], { squareness: 2, depthRatio: 1, fromY: 6, toY: 60, inset: 2.5 });
const liq = Math.PI * 27.5 ** 2 * 54;
ok(Math.abs(volume(g) - liq) / liq < 0.01, `liquid: clipped 6→60mm with 2.5mm wall (${(volume(g)/1000).toFixed(1)}ml)`);
const bb = g.boundingBox; ok(Math.abs(bb.min.y - 6) < 1e-6 && Math.abs(bb.max.y - 60) < 1e-6, 'clip bounds exact');
// العمودي عند الواجهة الأمامية يشير للخارج (+z)
g = buildLoft([[20, 0], [20, 80]], { squareness: 2, depthRatio: 1, segments: 64 });
const n = g.getAttribute('normal'), pp = g.getAttribute('position');
let front = -1; for (let i = 0; i < pp.count; i++) if (Math.abs(pp.getX(i)) < 1e-6 && pp.getZ(i) > 19 && pp.getY(i) > 10 && pp.getY(i) < 70) { front = i; break; }
ok(front < 0 || n.getZ(front) > 0.9, 'front normal points outward');
const uv = g.getAttribute('uv'); let fu = -1; for (let i = 0; i < pp.count; i++) if (Math.abs(pp.getX(i)) < 1e-6 && pp.getZ(i) > 19) { fu = uv.getX(i); break; }
ok(Math.abs(fu - 0.5) < 1e-6, `front of bottle at u = 0.5 (label centre), seam at back (${fu})`);
{
  const ok2 = ok;
  const sp = smoothProfile([[30, 0], [30, 75], [10, 90], [10, 110]]);
  ok2(sp.every(([r]) => r <= 30 + 1e-9 && r >= 10 - 1e-9), 'monotone: no overshoot beyond neighbouring points');
  ok2(sp.filter(([, y]) => y <= 75).every(([r]) => Math.abs(r - 30) < 1e-9), 'straight wall stays exactly straight');
  const dome = smoothProfile([[12.5, 0], [12.5, 9], [12.2, 14], [11, 18.5], [8.5, 22.5], [5, 25], [1, 26]]);
  ok2(dome.length > 30, `dome densified to ${dome.length} points (smooth)`);
}
