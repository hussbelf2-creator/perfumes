// @ts-nocheck — اختبار هندسي على three.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { extractProfile, estimateCapacityMl, sectionAreaFactor, rescale } from "@/studio/profile";
const dir = new URL("../fixtures/studio/", import.meta.url);
const load = (n) => { const m = JSON.parse(readFileSync(new URL(`${n}.json`, dir), 'utf8')); return { data: new Uint8Array(gunzipSync(readFileSync(new URL(`${n}.rgba.gz`, dir)))), width: m.w, height: m.h }; };
const ok = (c, l) => test(l, () => assert.ok(c));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

let e = extractProfile(load('cyl'), { threshold: 40, cropTop: 0, cropBottom: 0, smoothing: 3, heightMm: 80 });
// 400px → 80mm ⇒ 0.2mm/px ⇒ r = 100px = 20mm
ok(e && e.mode === 'color', 'cylinder: color mode');
ok(e && e.profile.every(([r]) => near(r, 20, 0.3)), `cylinder radius ≈ 20mm (got ${e?.profile.map(p => p[0]).slice(0, 3)})`);
ok(e && near(Math.max(...e.profile.map(p => p[1])), 80, 0.5), 'cylinder height = 80mm');
ok(e && e.asymmetry < 0.01, `cylinder symmetric (${e?.asymmetry.toFixed(3)})`);
ok(e && e.profile.length <= 6, `straight sides simplified to few points (${e?.profile.length})`);

e = extractProfile(load('bottle'), { threshold: 40, cropTop: 0, cropBottom: 0, smoothing: 1, heightMm: 110 });
// 440px → 110mm ⇒ 0.25mm/px ; body r=120px=30mm ; neck r=40px=10mm ; shoulder starts y=(560-260)=300px=75mm
const interp = (prof, y) => { for (let i = 1; i < prof.length; i++) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / ((y1 - y0) || 1)); } return NaN; };
let at = (y) => interp(e.profile, y);
ok(near(at(30), 30, 0.6), `bottle body r≈30mm (${at(30)})`);
ok(near(at(105), 10, 0.6), `bottle neck r≈10mm (${at(105)})`);
ok(near(at(82), 20, 3), `bottle shoulder tapers (${at(82)})`);
const capMl = estimateCapacityMl(e.profile, { squareness: 2, depthRatio: 1, neckMm: 20, wallMm: 0, baseMm: 0 });
// cylinder part: π·30²·75 = 212 ml + shoulder frustum ~ 15mm (r 30→10): π·15/3·(900+300+100)=20.4ml ⇒ ~232
ok(near(capMl, 232, 12), `capacity estimate ≈ 232ml (${capMl})`);

e = extractProfile(load('cap'), { threshold: 40, cropTop: 0, cropBottom: 0, smoothing: 2, heightMm: 30 });
ok(e && e.mode === 'alpha', 'transparent PNG uses alpha');
ok(e && e.profile.every(([r]) => near(r, 12, 0.3)), `cap radius 60px@0.2 = 12mm (${e?.profile[0]})`);

e = extractProfile(load('noisy'), { threshold: 30, cropTop: 0, cropBottom: 0, smoothing: 4, heightMm: 76, suppressBaseShadow: false });
// glass edges 220..379 ⇒ r=80px; 380px tall ⇒ 0.2mm/px ⇒ 16mm. Shadow widens bottom rows unless cropped
ok(e && near(at.call(null, 0) || 0, 0, 1e9), 'noisy runs');
const mids = [20, 35, 50].map(y => interp(e.profile, y));
ok(mids.every(r => near(r, 16, 0.8)), `noisy: light glass centre doesn't break edges, r≈16 (${mids.map(r => r.toFixed(1)).join(',')})`);
const wide = Math.max(...e.profile.map(p => p[0]));
ok(wide > 20, `low threshold: soft shadow widens the base (max r ${wide})`);
const e2 = extractProfile(load('noisy'), { threshold: 60, cropTop: 0, cropBottom: 0, smoothing: 4, heightMm: 76 });
const m2 = e2 && Math.max(...e2.profile.map(p => p[0]));
ok(e2 && m2 < 17, `higher threshold ignores the soft shadow (max r ${m2})`);
ok(near(sectionAreaFactor(2), Math.PI, 1e-6), 'superellipse n=2 area = π');
ok(near(sectionAreaFactor(60), 4, 0.15), 'superellipse n→∞ area → 4 (square)');
ok(near(Math.max(...rescale([[10, 0], [5, 50]], 100).map(p => p[1])), 100, 1e-9), 'rescale height');
ok(extractProfile({ data: new Uint8Array(40 * 40 * 4).fill(255), width: 40, height: 40 }, { threshold: 40, cropTop: 0, cropBottom: 0, smoothing: 3, heightMm: 50 }) === null, 'blank image → null (no crash)');
const e3 = extractProfile(load('noisy'), { threshold: 30, cropTop: 0, cropBottom: 0, smoothing: 4, heightMm: 76 });
const m3 = Math.max(...e3.profile.map(p => p[0]));
ok(m3 < 17 && e3.shadowRows > 0, `default: base shadow suppressed even at low threshold (max r ${m3}, ${e3.shadowRows} rows)`);
const eb = extractProfile(load('bottle'), { threshold: 40, cropTop: 0, cropBottom: 0, smoothing: 1, heightMm: 110 });
ok(eb.shadowRows === 0, 'no false suppression on a clean bottle');
