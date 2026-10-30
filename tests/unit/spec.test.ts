// @ts-nocheck — مواصفات التصنيع: ملاءمة العلبة بالعبوة، الملحقات، خيارات العبوة، جاهزية الملصق
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAP_MECHANISMS, DECORATIONS, EXTRAS, PUMPS, bottleSpecExtra, bottleSpecLines, cleanExtras, extrasPerUnit, fitStatus, labelChecklist, parseBottleSpec, recommendStyle, recommendedExtras, toggleExtra } from "../../src/studio/spec";
import { defaultBox, fitFor } from "../../src/studio/box/types";
import { estimateBox } from "../../src/studio/box/pricing";
import { briefLines } from "../../src/start/briefs";
import { sanitize } from "../../src/cms/schema";

const pick = (b) => b.ar;
const t = (ar) => ar;
const fit50 = { w: 42, d: 42, h: 113 }; // أطلس 50 مل مع غطائه

test("bottle spec parses only known options and prices the extras", () => {
  const get = (k) => ({ cm: "magnetic", pm: "fine", dc: "bogus" })[k] ?? null;
  const s = parseBottleSpec(get);
  assert.deepEqual(s, { cap: "magnetic", pump: "fine", deco: "none" });
  assert.equal(bottleSpecExtra(s), 2.4 + 0.9);
  assert.deepEqual(bottleSpecLines(s, pick), ["غطاء مغناطيسي", "رذاذ ناعم (Fine mist)"]);
  assert.deepEqual(bottleSpecLines({ cap: "screw", pump: "standard", deco: "none" }, pick), []);
  for (const list of [CAP_MECHANISMS, PUMPS, DECORATIONS, EXTRAS]) assert.equal(new Set(list.map((x) => x.id)).size, list.length);
});

test("recommendStyle: small → tuck/tube, 50 ml → rigid, 100 ml → magnetic", () => {
  assert.equal(recommendStyle({ w: 20, d: 20, h: 60 }, 10).style, "tube");
  assert.equal(recommendStyle({ w: 35, d: 35, h: 85 }, 30).style, "tuck");
  assert.equal(recommendStyle(fit50, 50).style, "rigid");
  assert.equal(recommendStyle({ w: 55, d: 55, h: 140 }, 100).style, "magnetic");
});

test("fitStatus: auto-fitted size is ok; a smaller inner size is tight; a huge one is loose; drawer lays the bottle down", () => {
  const d = { ...defaultBox(), style: "rigid", ...fitFor("rigid", fit50) };
  assert.equal(fitStatus(d, fit50).level, "ok");
  assert.equal(fitStatus({ ...d, H: fit50.h - 2 }, fit50).level, "tight");
  assert.equal(fitStatus({ ...d, L: fit50.w + 1.5, W: fit50.d + 1.5, H: fit50.h + 1.5 }, fit50).level, "snug");
  assert.equal(fitStatus({ ...d, L: d.L + 40 }, fit50).level, "loose");
  const drawer = { ...d, style: "drawer", ...fitFor("drawer", fit50) };
  assert.equal(fitStatus(drawer, fit50).level, "ok");
  assert.ok(drawer.L > drawer.H, "drawer length holds the bottle height");
  const tube = { ...d, style: "tube", ...fitFor("tube", fit50) };
  assert.equal(fitStatus(tube, fit50).level, "ok");
});

test("extras: one insert at a time, unknown ids dropped, recommendations follow the box and market", () => {
  let x = toggleExtra([], "insert_eva");
  x = toggleExtra(x, "insert_pulp");
  assert.deepEqual(x, ["insert_pulp"]);
  x = toggleExtra(x, "thanks");
  x = toggleExtra(x, "thanks");
  assert.deepEqual(x, ["insert_pulp"]);
  assert.deepEqual(cleanExtras(["thanks", "nope", "thanks", 5]), ["thanks"]);
  assert.deepEqual(cleanExtras("thanks"), []);
  const rigid = { ...defaultBox(), style: "rigid", ...fitFor("rigid", fit50) };
  const rec = recommendedExtras(rigid, fit50, true).map((r) => r.id);
  assert.ok(rec.includes("insert_eva") && rec.includes("ingredients") && rec.includes("shipper"), rec.join());
  const local = recommendedExtras({ ...defaultBox(), style: "tuck", ...fitFor("tuck", fit50) }, fit50, false).map((r) => r.id);
  assert.ok(!local.includes("shipper") && !local.includes("insert_eva") && local.includes("ingredients"), local.join());
  assert.equal(extrasPerUnit(["thanks", "insert_eva"]), 0.45 + 1.8);
  assert.equal(extrasPerUnit(["thanks"], { thanks: 1 }), 1);
});

test("box estimate adds an extras line priced from the content rates", () => {
  const base = { ...defaultBox(), extras: [] };
  const withExtras = { ...base, extras: ["thanks", "insert_eva"] };
  const a = estimateBox(base, 1000), b = estimateBox(withExtras, 1000);
  const line = b.variable.find((l) => l.key === "extras");
  assert.ok(line && line.value === 2.25, JSON.stringify(line));
  assert.ok(b.unit > a.unit);
  const rates = sanitize("pricing", { box: { extrasPerUnit: { thanks: 2, bogus: 9, insert_eva: -1 } } }).box;
  assert.equal(rates.extrasPerUnit.thanks, 2);
  assert.equal(rates.extrasPerUnit.insert_eva, 0);
  assert.equal("bogus" in rates.extrasPerUnit, false);
  assert.equal(estimateBox(withExtras, 1000, rates).variable.find((l) => l.key === "extras").value, 2);
});

test("label checklist flags a missing volume and a volume that doesn't match the bottle", () => {
  const bottle = { capacityMl: 50, profile: [[21, 0], [21, 100]] };
  const label = (details) => ({ enabled: true, widthMm: 60, texts: [{ id: "brand", text: "Maison" }, { id: "name", text: "عود الليل" }, { id: "details", text: details }] });
  const ok = labelChecklist(label("Eau de Parfum · 50 ml"), bottle);
  assert.ok(ok.every((c) => c.ok), JSON.stringify(ok));
  const miss = labelChecklist(label("Eau de Parfum"), bottle).find((c) => c.id === "volume");
  assert.equal(miss.ok, false);
  const wrong = labelChecklist(label("EDP 100 ml"), bottle).find((c) => c.id === "volume");
  assert.equal(wrong.ok, false);
  assert.match(wrong.text.ar, /100 مل/);
  assert.deepEqual(labelChecklist(null, bottle), []);
});

test("brief lines render the bottle spec and extras readably for the team", () => {
  const L = briefLines({ track: "C", a_need: "box", spec_bottle: "أطلس 50ml", spec_cap: "magnetic", spec_pump: "standard", spec_deco: "laser", box_extras: "thanks,insert_eva,bogus" }, pick, t);
  const spec = L.find((l) => l.q === "مواصفة العبوة");
  assert.ok(spec && spec.a.includes("أطلس") && spec.a.includes("مغناطيسي") && spec.a.includes("ليزر"), JSON.stringify(L));
  const ex = L.find((l) => l.q === "ملحقات التغليف");
  assert.equal(ex.a, "بطاقة شكر، حشوة إسفنج EVA");
  assert.ok(!L.some((l) => l.a.includes("bogus")));
});
