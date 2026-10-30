import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRACK_STAGE_KEYS, stagesFor, mapStage } from "@/projects/stages";
const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const ok = (c: boolean, m: string) => test(m, () => assert.ok(c));
for (const [t, keys] of Object.entries(TRACK_STAGE_KEYS)) {
  const m = sql.match(new RegExp(`when '${t}' then array\\[([^\\]]+)\\]`));
  const db = m ? m[1].replace(/'/g, "").split(",") : [];
  ok(JSON.stringify(db) === JSON.stringify([...keys, "delivered"]), `track ${t}: SQL stages = TS stages`);
  for (const s of stagesFor(t).slice(0, -1)) ok(sql.includes(`when '${s.id}' then '${s.label.ar}'`), `track ${t}: SQL label for ${s.id} = «${s.label.ar}»`);
}
ok(mapStage(null, "A", "design") === "formula", "generic design → A formula");
ok(mapStage("A", "C", "production") === "prototype", "A production → C prototype (clamped)");
ok(mapStage("A", "F", "delivered") === "delivered", "delivered stays delivered");
ok(mapStage("C", "D", "brief") === "brief", "brief stays brief");
