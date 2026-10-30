// يشغّل الاختبارات الحية بالترتيب (كل ملف يبني على بيانات سابقه: الطلب → المشروع → العرض → التقارير)
//   node tests/live/run.mjs            الكل
//   node tests/live/run.mjs 3-quotes   ملف واحد
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const asked = process.argv.slice(2);
const suites = readdirSync(here).filter((f) => /^\d-.*\.cjs$/.test(f)).sort().filter((f) => !asked.length || asked.some((a) => f.startsWith(a)));
let failed = 0;
for (const f of suites) {
  const r = spawnSync(process.execPath, [path.join(here, f)], { encoding: "utf8", timeout: 15 * 60_000 });
  const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n");
  const pass = lines.filter((l) => l.startsWith("PASS")).length;
  const fails = lines.filter((l) => l.startsWith("FAIL"));
  const errors = lines.filter((l) => /^errors?:/i.test(l) && !/none/.test(l));
  const ok = r.status === 0 && !fails.length && !errors.length && pass > 0;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${f}: ${pass} passed${fails.length ? `, ${fails.length} failed` : ""}`);
  if (!ok) console.log([...fails, ...errors].join("\n") || lines.slice(-20).join("\n"));
}
process.exit(failed ? 1 : 0);
