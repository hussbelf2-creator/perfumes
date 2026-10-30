import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { quoteTotals } from "@/projects/types";
// مقارنة معاينة عرض السعر في المتصفح بحساب Postgres الفعلي على حالات حدّية وعشوائية
// (يحتاج psql ومتغيرات الاتصال PGHOST/PGUSER/PGPASSWORD كما في run.sh)
const cases: { lines: { label: string; qty: number; unit: number }[]; dep: number }[] = [
  { lines: [{ label: "a", qty: 1, unit: 12000 }, { label: "b", qty: 1, unit: 2500.5 }], dep: 50 },
  { lines: [{ label: "a", qty: 3, unit: 0.35 }], dep: 33 },
  { lines: [{ label: "a", qty: 1, unit: 1.005 }], dep: 50 },
  { lines: [{ label: "a", qty: 1000, unit: 4.35 }, { label: "b", qty: 7, unit: 19.99 }], dep: 30 },
];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 300; i++) cases.push({ lines: Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ label: "x", qty: Math.max(1, Math.floor(rnd() * 3000)) / (rnd() < 0.2 ? 4 : 1), unit: Math.round(rnd() * 500000) / 100 })), dep: Math.floor(rnd() * 101) });
const sqlFor = (c: (typeof cases)[number]) => {
  const lines = JSON.stringify(c.lines).replace(/'/g, "''");
  return `select concat_ws('|', s, v, s+v, round((s+v)*${c.dep}/100, 2)) from (select s, round(s*15/100, 2) v from (select coalesce(sum(round((l->>'qty')::numeric*(l->>'unit')::numeric, 2)),0) s from jsonb_array_elements('${lines}'::jsonb) l) a) b;`;
};
test(`${cases.length} quotes: browser totals = Postgres totals`, () => {
  const out = execFileSync("psql", ["-d", "postgres", "-tA"], { input: cases.map(sqlFor).join("\n") }).toString().trim().split("\n");
  const bad: string[] = [];
  cases.forEach((c, i) => {
    const t = quoteTotals(c.lines, 15, c.dep);
    const mine = [t.subtotal, t.vat, t.total, t.deposit].map((n) => n.toFixed(2)).join("|");
    const db = out[i].split("|").map((n) => Number(n).toFixed(2)).join("|");
    if (mine !== db) bad.push(`${JSON.stringify(c)} browser ${mine} db ${db}`);
  });
  assert.deepEqual(bad.slice(0, 5), []);
});
