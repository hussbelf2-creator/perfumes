import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, sanitize, rejectedFields } from "@/cms/schema";
import { DEFAULT_LEGAL, LEGAL_KINDS, LEGAL_VARS } from "@/data/legal";

test("default legal document survives sanitize unchanged", () => assert.deepEqual(sanitize("legal", DEFAULTS.legal), DEFAULTS.legal));
test("garbage → defaults", () => {
  for (const bad of [null, 42, "x", [1], { privacy: "x" }]) assert.deepEqual(sanitize("legal", bad), { ...DEFAULTS.legal, updated: DEFAULTS.legal.updated });
});
test("every page has an Arabic and English title, intro and sections", () => {
  for (const k of LEGAL_KINDS) {
    const p = DEFAULT_LEGAL[k];
    assert.ok(p.title.ar && p.title.en && p.intro.ar && p.intro.en, k);
    assert.ok(p.sections.length >= 5, `${k} sections`);
    for (const s of p.sections) assert.ok(s.title.ar && s.title.en && s.body.ar && s.body.en, `${k}/${s.id}`);
  }
});
test("default texts only use known variables", () => {
  const used = JSON.stringify(DEFAULT_LEGAL).match(/\{(\w+)\}/g) ?? [];
  for (const v of used) assert.ok((LEGAL_VARS as readonly string[]).includes(v.slice(1, -1)), v);
});
test("privacy policy covers the PDPL essentials", () => {
  const ids = DEFAULT_LEGAL.privacy.sections.map((s) => s.id);
  for (const id of ["controller", "collect", "purpose", "share", "transfer", "retention", "rights"]) assert.ok(ids.includes(id), id);
  assert.match(DEFAULT_LEGAL.privacy.sections.find((s) => s.id === "rights")!.body.ar, /سدايا/);
});
test("empty sections are dropped; a page emptied entirely falls back to its default", () => {
  const v = structuredClone(DEFAULTS.legal);
  v.terms.sections = [{ id: "a", title: { ar: "", en: "x" }, body: { ar: "y", en: "y" } }, { id: "b<script>", title: { ar: "عنوان", en: "T" }, body: { ar: "نص", en: "Text" } }];
  v.refund.sections = [];
  const s = sanitize("legal", v);
  assert.deepEqual(s.terms.sections.map((x) => x.id), ["bscript"]);
  assert.deepEqual(s.refund.sections, DEFAULT_LEGAL.refund.sections);
});
test("long bodies are capped and a bad date is reported", () => {
  const v = structuredClone(DEFAULTS.legal);
  v.privacy.sections[0].body.ar = "x".repeat(9000);
  v.updated = "yesterday";
  assert.equal(sanitize("legal", v).privacy.sections[0].body.ar.length, 8000);
  assert.ok(rejectedFields("legal", v).includes("updated"));
});
