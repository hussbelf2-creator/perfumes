// يبني نسخ الوضع التجريبي الثلاث، يشغّل معايناتها، ثم ينفّذ اختبارات المتصفح ويلخّص النتيجة.
//   node tests/e2e/run.mjs              كل الاختبارات
//   node tests/e2e/run.mjs quote stock  اختبارات محددة
//   E2E_SKIP_BUILD=1                    استخدم البناء السابق
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const vite = path.join(root, "node_modules", ".bin", "vite");

// بلا Supabase: كل البيانات في المتصفح (الوضع التجريبي)
const base = { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_MOYASAR_PUBLISHABLE_KEY: "", VITE_ENABLE_DEMO_ADMIN: "false", VITE_TURNSTILE_SITE_KEY: "" };
const VARIANTS = [
  { key: "site", port: 4173, env: {} },
  { key: "pay", port: 4174, env: { VITE_MOYASAR_PUBLISHABLE_KEY: "pk_test_demo123" } },
  { key: "admin", port: 4177, env: { VITE_ENABLE_DEMO_ADMIN: "true" } },
];
const outDir = (v) => path.join(here, ".build", v.key);

if (!process.env.E2E_SKIP_BUILD) {
  for (const v of VARIANTS) {
    console.log(`build ${v.key}…`);
    const r = spawnSync(vite, ["build", "--outDir", outDir(v), "--emptyOutDir", "--logLevel", "error"], { cwd: root, stdio: "inherit", env: { ...process.env, ...base, ...v.env } });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

const servers = VARIANTS.map((v) => spawn(vite, ["preview", "--outDir", outDir(v), "--port", String(v.port), "--strictPort"], { cwd: root, stdio: "ignore" }));
const stop = () => servers.forEach((s) => s.kill());
process.on("exit", stop);
process.on("SIGINT", () => process.exit(130));

const waitFor = async (url) => {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* لم يبدأ بعد */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`preview did not start: ${url}`);
};
await Promise.all(VARIANTS.map((v) => waitFor(`http://localhost:${v.port}/`)));

const asked = process.argv.slice(2);
const suites = readdirSync(here)
  .filter((f) => f.endsWith(".cjs") && f !== "lib.cjs")
  .map((f) => f.replace(/\.cjs$/, ""))
  .filter((s) => !asked.length || asked.includes(s));

let failed = 0, passed = 0;
const failures = [];
for (const s of suites) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(here, `${s}.cjs`)], { cwd: root, encoding: "utf8", timeout: 15 * 60_000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const pass = out.split("\n").filter((l) => l.startsWith("PASS")).length;
  const fails = out.split("\n").filter((l) => l.startsWith("FAIL"));
  const ok = r.status === 0 && fails.length === 0 && pass > 0;
  passed += pass;
  failed += fails.length + (ok || fails.length ? 0 : 1);
  console.log(`${ok ? "✓" : "✗"} ${s}: ${pass} passed${fails.length ? `, ${fails.length} failed` : ""} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  if (!ok) {
    failures.push(s);
    console.log(fails.length ? fails.join("\n") : out.slice(-2000));
  }
}
console.log(`\ne2e: ${passed} passed, ${failed} failed${failures.length ? ` (${failures.join(", ")})` : ""} — screenshots in tests/e2e/.out/`);
stop();
process.exit(failed ? 1 : 0);
