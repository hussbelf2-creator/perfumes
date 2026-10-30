import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTES, PRESETS, CONCENTRATIONS, noteById } from "@/bespoke/notes";
import { EMPTY, analyze, estimate, startingPrice, toggleNote, withConcentration, toPayload, fromPayload, bespokeLines, whatsappText, DEFAULT_BESPOKE, type Composition } from "@/bespoke/compose";
import { briefLines } from "@/start/briefs";
import { stagesFor } from "@/projects/stages";
import { sanitize, DEFAULTS } from "@/cms/schema";

const ar = (b: { ar: string }) => b.ar;
const tAr = (a: string) => a;
const comp = (notes: string[], o: Partial<Composition> = {}): Composition => ({ ...EMPTY, notes, ...o });

test("note library: unique ids, every layer and preset note exists", () => {
  assert.equal(new Set(NOTES.map((n) => n.id)).size, NOTES.length);
  for (const l of ["top", "heart", "base"]) assert.ok(NOTES.filter((n) => n.layer === l).length >= 6, l);
  for (const p of PRESETS) for (const id of p.notes) assert.ok(noteById(id), `${p.id}/${id}`);
});
test("presets are complete compositions", () => {
  for (const p of PRESETS) assert.ok(analyze(comp(p.notes)).ok, p.id);
});
test("each layer needs a note; empty composition is blocked", () => {
  const r = analyze(EMPTY);
  assert.equal(r.ok, false);
  assert.deepEqual(r.issues.filter((i) => i.level === "block").map((i) => i.code).sort(), ["need_base", "need_heart", "need_top"]);
  assert.equal(analyze(comp(["bergamot", "jasmine"])).issues.find((i) => i.level === "block")?.code, "need_base");
});
test("toggle respects three notes per layer and removes on second click", () => {
  let c = comp([]);
  for (const id of ["bergamot", "lemon", "mandarin", "mint"]) c = toggleNote(c, id);
  assert.deepEqual(c.notes, ["bergamot", "lemon", "mandarin"]);
  c = toggleNote(c, "lemon");
  assert.deepEqual(c.notes, ["bergamot", "mandarin"]);
  assert.deepEqual(toggleNote(c, "nope").notes, c.notes);
});
test("warnings: two dominant notes, two ouds, a tricky clash; classic pairs recognised", () => {
  const r = analyze(comp(["mint", "rose_taifi", "oud_cambodi", "oud_hindi"]));
  const codes = r.issues.map((i) => i.code);
  assert.ok(r.ok, "warnings do not block");
  assert.ok(codes.includes("heavy") && codes.includes("two_ouds") && codes.includes("clash"));
  assert.ok(r.pairs.some((p) => p.ar.includes("الورد والعود")));
  assert.equal(r.pairs.filter((p) => p.ar.includes("الورد والعود")).length, 1, "same pairing text once");
});
test("character adds to ~100 and is led by the strongest family", () => {
  const r = analyze(comp(["saffron", "rose_taifi", "oud_cambodi", "amber"]));
  const sum = r.character.reduce((s, c) => s + c.pct, 0);
  assert.ok(sum >= 98 && sum <= 102, String(sum));
  assert.equal(r.character[0].family, "woody");
});
test("longevity grows with base strength and concentration", () => {
  const light = analyze(comp(["bergamot", "orange_blossom", "white_musk"]));
  const heavy = analyze(comp(["bergamot", "orange_blossom", "oud_hindi", "bakhoor"], { conc: "oil", size: 12 }));
  assert.match(light.longevity.ar, /متوسط/);
  assert.match(heavy.longevity.ar, /طويل جداً/);
  assert.equal(heavy.intensity, 3);
});
test("price: ml × rate + bottle + rare surcharge; oil keeps a valid size", () => {
  const e = estimate(comp(["saffron", "rose_taifi", "oud_cambodi"], { conc: "edp", size: 50 }));
  // (700 + 120 + 360) = 1180 قبل الضريبة، + 15٪ = 1357
  assert.deepEqual(e, { juice: 700, bottle: 120, premium: 360, premiumCount: 3, vat: 177, total: 1357 });
  const oil = withConcentration(comp([], { size: 50 }), "oil");
  assert.equal(oil.size, 12);
  assert.equal(withConcentration(comp([], { size: 30, conc: "edp" }), "extrait").size, 30);
  assert.equal(startingPrice(), Math.min(...CONCENTRATIONS.map((c) => Math.round((c.sizes[0] * DEFAULT_BESPOKE.perMl[c.id] + DEFAULT_BESPOKE.bottle) * 1.15 * 100) / 100)));
});
test("payload round-trip, junk ids dropped, name capped", () => {
  const c = comp(["bergamot", "rose_taifi", "amber"], { conc: "extrait", size: 100, purpose: "gift", name: "نورة" });
  const p = toPayload(c, "studio", { estimate: 2440, slotRiyadh: "2026-10-21 14:00" });
  assert.equal(p.p_top, "bergamot");
  assert.equal(p.p_mode, "studio");
  assert.deepEqual(fromPayload(p), c);
  assert.deepEqual(fromPayload({ p_top: "bergamot,<x>", p_conc: "hack" }).notes, ["bergamot"]);
  assert.equal(fromPayload({ p_conc: "hack" }).conc, "edp");
  assert.equal(toPayload(comp([], { name: "x".repeat(40) }), "video", { estimate: 0 }).p_name.length, 20);
});
test("brief summary for the team and client shows names, not codes", () => {
  const p = { track: "P", ...toPayload(comp(["bergamot", "rose_taifi", "oud_cambodi"], { name: "سارة" }), "video", { estimate: 1060, slotRiyadh: "2026-10-21 14:00" }), message: "أحب العود" };
  const lines = briefLines(p, ar, tAr);
  const text = lines.map((l) => `${l.q}: ${l.a}`).join("\n");
  for (const want of ["المقدمة: برغموت", "القلب: ورد طائفي", "القاعدة: عود كمبودي", "سارة", "مكالمة فيديو · 2026-10-21 14:00", "1,060 ر.س", "أحب العود"]) assert.ok(text.includes(want), want);
  assert.deepEqual(bespokeLines(p, ar, tAr), lines);
  assert.ok(!/rose_taifi|p_top/.test(text));
});
test("WhatsApp message carries the composition", () => {
  const m = whatsappText(comp(["lemon", "jasmine", "sandalwood"]), ar, tAr);
  assert.match(m, /المقدمة: ليمون/);
  assert.match(m, /القاعدة: صندل/);
});
test("track P stages and editable prices", () => {
  assert.deepEqual(stagesFor("P").map((s) => s.id), ["brief", "sampling", "bottling", "delivered"]);
  const s = sanitize("pricing", { ...DEFAULTS.pricing, bespoke: { perMl: { edp: -5, extrait: "x", oil: 40 }, bottle: 99.999, premium: 1e9 } });
  assert.deepEqual(s.bespoke, { perMl: { edp: 0.5, extrait: DEFAULT_BESPOKE.perMl.extrait, oil: 40 }, bottle: 100, premium: 100000 });
});

test("payload from the browser is sanitised: layers, duplicates, sizes", () => {
  const c = fromPayload({ p_top: "saffron,saffron,oud_hindi", p_heart: "oud_hindi,rose_taifi", p_base: "amber", p_conc: "oil", p_size: "100" });
  assert.deepEqual(c.notes, ["saffron", "rose_taifi", "amber"], "oud_hindi is a base note and appears in neither top nor heart");
  assert.equal(c.size, 12, "100 ml is not an oil size");
});
test("bottle name: trailing spaces don't block", () => {
  const r = analyze(comp(["bergamot", "jasmine", "amber"], { name: "x".repeat(20) + "  " }));
  assert.ok(r.ok);
});
