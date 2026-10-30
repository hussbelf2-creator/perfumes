import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateBox, DEFAULT_BOX_RATES } from "@/studio/box/pricing";
import { defaultBox, fitFor } from "@/studio/box/types";
import { estimate, COST_ITEMS } from "@/lib/pricing";
import { sanitize, DEFAULTS } from "@/cms/schema";
const ok = (name: string, cond: boolean, info = "") => test(name, () => assert.ok(cond, info));
const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;
const base = { ...defaultBox(), ...fitFor("tuck", { w: 52, d: 36, h: 120 }) };

const e1 = estimateBox(base, 1000);
ok("unit = variable×(1−discount) + setup/qty", near(e1.unit, Math.round((e1.variableTotal * (1 - e1.discount / 100) + e1.setupTotal / 1000) * 100) / 100));
ok("total = unit × qty", e1.total === Math.round(e1.unit * 1000));
ok("variable = sum of lines", near(e1.variableTotal, e1.variable.reduce((s, l) => s + l.value, 0)));
ok("bigger box costs more", estimateBox({ ...base, H: base.H + 60 }, 1000).unit > e1.unit);
ok("more boxes → cheaper per box", estimateBox(base, 5000).unit < e1.unit && estimateBox(base, 1000).unit < estimateBox(base, 500).unit);
ok("rigid & magnetic cost more than tuck", estimateBox({ ...base, style: "rigid" }, 1000).unit > e1.unit && estimateBox({ ...base, style: "magnetic" }, 1000).unit > e1.unit);
ok("foil adds a per-unit line and a block", estimateBox({ ...base, foil: "none" }, 1000).unit < e1.unit && !estimateBox({ ...base, foil: "none" }, 1000).setup.some((l) => l.key === "foilBlock"));
ok("black board costs more to print than white", estimateBox({ ...base, board: "black" }, 1000).unit > estimateBox({ ...base, board: "white" }, 1000).unit);
ok("soft-touch > matte > gloss finish", (() => { const f = (x: "soft" | "matte" | "gloss") => estimateBox({ ...base, finish: x }, 1000).variable.find((l) => l.key === "finish")!.value; return f("soft") > f("matte") && f("matte") > f("gloss"); })());
ok("die at least the minimum", e1.setup.find((l) => l.key === "die")!.value >= DEFAULT_BOX_RATES.dieMin);
ok("below MOQ flagged", estimateBox(base, 200).belowMoq && !e1.belowMoq);
ok("sheet area from the real dieline (positive, < 1 m²)", e1.sheetM2 > 0.01 && e1.sheetM2 < 1);
const cheap = { ...DEFAULT_BOX_RATES, boardPerM2: { ...DEFAULT_BOX_RATES.boardPerM2, tuck: 0 } };
ok("rates parameter is honoured", estimateBox(base, 1000, cheap).unit < e1.unit);
// الحاسبة الرئيسية
const generic = estimate({ qty: 1000 });
const withBox = estimate({ qty: 1000, box: { perUnit: e1.variableTotal, setup: e1.setupTotal } });
ok("generic estimate unchanged without a box", generic.items.find((i) => i.key === "box")!.perUnit === COST_ITEMS.find((i) => i.key === "box")!.perUnit && generic.boxSetup === 0);
ok("studio box replaces the generic box line", near(withBox.items.find((i) => i.key === "box")!.perUnit, e1.variableTotal));
ok("box setup added once to the total", near(withBox.total - withBox.production - withBox.sampling - withBox.design, e1.setupTotal, 0.5));
// وثيقة الأسعار في المحتوى
ok("pricing defaults stable", JSON.stringify(sanitize("pricing", DEFAULTS.pricing)) === JSON.stringify(DEFAULTS.pricing));
const bad = sanitize("pricing", { box: { waste: 9, boardPerM2: { tuck: -5, rigid: "x" }, moq: { tuck: 12.7 }, foilPerUnit: 0.123456 } });
ok("waste clamped to ≤ 2", bad.box.waste === 2);
ok("negative price clamped to 0, junk falls back", bad.box.boardPerM2.tuck === 0 && bad.box.boardPerM2.rigid === DEFAULT_BOX_RATES.boardPerM2.rigid);
ok("MOQ integer", bad.box.moq.tuck === 13);
ok("money rounded to halalas", bad.box.foilPerUnit === 0.12);
ok("garbage document → defaults", JSON.stringify(sanitize("pricing", "nope")) === JSON.stringify(DEFAULTS.pricing));
