// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { WORKSPACES, WORK_LINK, trackStart, workspaceOf } from "../../src/start/workspaces";
import { briefLines, workLink } from "../../src/start/briefs";
import { SERVICE_TRACKS } from "../../src/data/services";

const pick = (b) => b.ar;
const t = (ar) => ar;

test("every workspace path is an internal route that carries its track", () => {
  for (const [id, ws] of Object.entries(WORKSPACES)) {
    assert.match(ws.path, WORK_LINK, id);
    assert.ok(ws.path.includes(`track=${id}`), id);
  }
  assert.equal(workspaceOf("C").path, "/studio-3d?track=C");
  assert.equal(workspaceOf("A"), undefined);
  assert.equal(workspaceOf(null), undefined);
});

test("trackStart: workspace tracks start in their tool, others in the brief; package passes through", () => {
  assert.equal(trackStart("C"), "/studio-3d?track=C");
  assert.equal(trackStart("C", 1), "/studio-3d?track=C&package=1");
  assert.equal(trackStart("F", 0), "/studio-3d?track=F&tab=label&package=0");
  assert.equal(trackStart("A"), "/start/A");
  assert.equal(trackStart("D", 2), "/start/D?package=2");
});

test("work link: only internal workspace routes are shown as links", () => {
  assert.equal(workLink({ work_link: "/studio-3d?tab=box&b=B1" }), "/studio-3d?tab=box&b=B1");
  assert.equal(workLink({ work_link: "/pricing?qty=1000" }), "/pricing?qty=1000");
  assert.equal(workLink({ work_link: "https://evil.example/studio-3d" }), null);
  assert.equal(workLink({ work_link: "//evil.example" }), null);
  assert.equal(workLink({ work_link: "/admin" }), null);
  assert.equal(workLink({ work_link: "/studio-3dx" }), null);
  assert.equal(workLink({}), null);
  assert.equal(workLink(null), null);
});

test("brief lines include the workspace summary, the brand formula and the calculator figures", () => {
  const C = briefLines({ track: "C", a_need: "box,label", work_summary: "زجاجة نور 50ml | علبة: درج 60×40×120 مم" }, pick, t);
  assert.ok(C.some((l) => l.q === "استوديو العبوة 3D" && l.a.includes("درج")));
  const B = briefLines({ track: "B", a_goal: "new", work_summary: "x", p_top: "bergamot", p_heart: "rose_taifi", p_base: "oud_cambodi", p_conc: "edp", p_size: "50" }, pick, t);
  assert.ok(B.some((l) => l.q === "القلب" && l.a.includes("ورد")), JSON.stringify(B));
  assert.ok(!B.some((l) => l.q.includes("جلسة")), "no consultation line for a brand formula");
  const E = briefLines({ track: "E", a_formula: "ready", calc_qty: "2000", calc_speed: "express", calc_unit: "61.5", calc_total: "123000" }, pick, t);
  const calc = E.find((l) => l.q === "أرقام الحاسبة");
  assert.ok(calc && calc.a.includes("2,000") && calc.a.includes("سريع") && calc.a.includes("123,000"), JSON.stringify(E));
  // مسار بلا لوحة عمل يتجاهل الملخص الغريب
  const D = briefLines({ track: "D", a_need: "logo", work_summary: "x" }, pick, t);
  assert.ok(!D.some((l) => l.a === "x"));
  for (const s of SERVICE_TRACKS) assert.ok(Array.isArray(briefLines({ track: s.id }, pick, t)));
});
