import { test } from "node:test";
import assert from "node:assert/strict";
import { Box3, Vector3 } from "three";
import { buildSpec, flatten, hingeAngle, segLen, polyArea, outlineOf, type Pt } from "@/studio/box/dielines";
import { defaultBox, fitFor, THICKNESS, type BoxStyle, type BoxDesign } from "@/studio/box/types";
import { dielineSvg, dielineStats } from "@/studio/box/export";
import { buildBoxModel } from "@/studio/box/model3d";

const ok = (name: string, cond: boolean, info = "") => test(name, () => assert.ok(cond, info));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const STYLES: BoxStyle[] = ["tuck", "rigid", "drawer", "magnetic", "tube"];
const sizes = [{ L: 56, W: 40, H: 124 }, { L: 30, W: 30, H: 60 }, { L: 120, W: 80, H: 200 }];

const inside = (p: Pt[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

for (const style of STYLES) for (const sz of sizes) {
  const d: BoxDesign = { ...defaultBox(), style, ...sz, ...(style === "tube" ? { W: sz.L } : {}) };
  const tag = `${style} ${sz.L}x${sz.W}x${sz.H}`;
  const spec = buildSpec(d);
  const flat = flatten(spec);
  // 1) كل حافة إما قص أو طي/لصق: محيط الألواح = القص + 2×الطي + 2×حدود اللصق
  const perim = flat.panels.reduce((a, p) => a + p.poly.reduce((s, q, i) => s + Math.hypot(p.poly[(i + 1) % p.poly.length][0] - q[0], p.poly[(i + 1) % p.poly.length][1] - q[1]), 0), 0);
  const st = dielineStats(flat);
  const glue = flat.glueEdges.reduce((a, s) => a + segLen(s), 0);
  ok(`${tag}: edges = cut + 2·crease`, near(perim, st.cut + 2 * st.crease + 2 * glue, 0.05), `${perim} vs ${st.cut + 2 * st.crease + 2 * glue}`);
  // 2) لا تتداخل الألواح في المخطط المسطّح (عينات شبكية كل 1 مم)
  let overlap = 0;
  const { minX, minY, maxX, maxY } = flat.bounds;
  for (let x = minX + 0.5; x < maxX; x += 1) for (let y = minY + 0.5; y < maxY; y += 1) {
    let n = 0;
    for (const p of flat.panels) if (inside(p.poly, x, y)) n++;
    if (n > 1) overlap++;
  }
  ok(`${tag}: no overlapping panels`, overlap === 0, `${overlap} cells`);
  // 3) مساحة الألواح = مساحة المضلعات (لا مضلع مقلوب أو منهار)
  ok(`${tag}: positive areas`, flat.panels.every((p) => Math.abs(polyArea(p.poly)) > 1));
  // 4) المجسم المطوي يُغلق على المقاس الخارجي المعلن
  const fakeCanvas = { width: 4, height: 4 } as unknown as HTMLCanvasElement;
  const m = buildBoxModel(d, spec, flat, { color: fakeCanvas, pbr: fakeCanvas, wMm: maxX - minX + 6, hMm: maxY - minY + 6, pxPerMm: 1 });
  m.setPose(1, 0);
  m.group.updateMatrixWorld(true);
  const b = new Box3().setFromObject(m.group);
  const size = b.getSize(new Vector3()).multiplyScalar(1000);
  const t = THICKNESS[style];
  ok(`${tag}: closed width`, near(size.x, spec.outer.w, t + 1.2), `${size.x.toFixed(2)} vs ${spec.outer.w}`);
  ok(`${tag}: closed depth`, near(size.z, spec.outer.d, t + 1.2), `${size.z.toFixed(2)} vs ${spec.outer.d}`);
  ok(`${tag}: closed height`, near(size.y, spec.outer.h, t + 1.2), `${size.y.toFixed(2)} vs ${spec.outer.h}`);
  ok(`${tag}: sits on the ground`, near(b.min.y, 0, 1e-6));
  // 5) الفتح يغيّر الشكل والإغلاق يعيده
  m.setPose(1, 1);
  const bo = new Box3().setFromObject(m.group).getSize(new Vector3()).multiplyScalar(1000);
  ok(`${tag}: opening changes the shape`, bo.distanceTo(size) > 5);
  m.setPose(1, 0);
  const bc = new Box3().setFromObject(m.group).getSize(new Vector3()).multiplyScalar(1000);
  ok(`${tag}: closing restores`, bc.distanceTo(size) < 1e-6);
  // 6) SVG: كل خط قص وطي موجود، والطبقات مسمّاة
  const svg = dielineSvg(d, spec, flat);
  const cutLayer = svg.split('id="cut"')[1].split("</g>")[0];
  const creaseLayer = svg.split('id="crease"')[1].split("</g>")[0];
  ok(`${tag}: svg cut lines`, (cutLayer.match(/<line /g) ?? []).length === flat.cuts.length);
  ok(`${tag}: svg crease lines`, (creaseLayer.match(/<line /g) ?? []).length === flat.folds.length);
  ok(`${tag}: svg size in mm`, /width="[\d.]+mm" height="[\d.]+mm"/.test(svg) && !svg.includes("NaN"));
}

// مقاسات علبة اللسان بالضبط
{
  const d = { ...defaultBox(), style: "tuck" as const, L: 56, W: 40, H: 124 };
  const st = dielineStats(flatten(buildSpec(d)));
  ok("tuck sheet width = 2L + 2W + glue(14)", near(st.sheetW, 2 * 56 + 2 * 40 + 14, 0.01), String(st.sheetW));
  ok("tuck sheet height = H + 2W + 2·tuck(18)", near(st.sheetH, 124 + 2 * 40 + 2 * 18, 0.01), String(st.sheetH));
  ok("tuck creases: 4 body + 4 lid/tuck + 4 dust", flatten(buildSpec(d)).folds.length === 12);
}
// ترتيب الطي والفتح
{
  const h = { edge: "top" as const, at: 0, fold: 90, stage: 1, openTo: -70, child: { id: "x", w: 1, h: 1, hinges: [] } };
  ok("stage 1 still flat at f=0.2 (of 4)", hingeAngle(h, 0.2, 0, 4) === 0);
  ok("stage 1 done at f=0.5", near(hingeAngle(h, 0.5, 0, 4), 90, 1e-9));
  ok("lid fully open", near(hingeAngle(h, 1, 1, 4), -70, 1e-9));
  ok("half open in between", hingeAngle(h, 1, 0.5, 4) < 90 && hingeAngle(h, 1, 0.5, 4) > -70);
}
// الملاءمة: الدرج يستلقي فيه المنتج
{
  const f = fitFor("drawer", { w: 50, d: 35, h: 120 });
  ok("drawer fit lies down", f.L > f.W && f.L >= 120 && f.H < 50, JSON.stringify(f));
  const tb = fitFor("tube", { w: 50, d: 35, h: 120 });
  ok("tube fit is round", tb.L === tb.W && tb.L >= 50);
  ok("limits clamp", fitFor("tuck", { w: 1, d: 1, h: 900 }).H === 400 && fitFor("tuck", { w: 1, d: 1, h: 900 }).L === 20);
}
// شكل الألسنة: مضلع ثابت
ok("outlineOf rect default", outlineOf({ id: "p", w: 3, h: 2, hinges: [] }).length === 4);
