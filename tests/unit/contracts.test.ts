import { test } from "node:test";
import assert from "node:assert/strict";
import { newContract } from "@/contracts/template";
import { contractProblem, totalsByUnit } from "@/contracts/types";
import { clientActions } from "@/projects/next";
import { DEFAULTS } from "@/cms/schema";

const project = { id: "p1", title: "مسك الليل", track: "E", clientEmail: "a@x.sa", stage: "brief", status: "active", dueDate: "2026-12-01", createdAt: "", updatedAt: "" } as never;
const quote = { id: "q1", projectId: "p1", ref: "QT-260007", status: "accepted", lines: [{ label: "زجاجة 50 مل", qty: 1000, unit: 12 }, { label: "علبة", qty: 1000, unit: 4 }], subtotal: 16000, total: 18400, deposit: 9200, vatRate: 15, depositPct: 50, createdAt: "" } as never;
const site = { ...DEFAULTS.site, billing: { ...DEFAULTS.site.billing, legalName: "شركة عطور الطائف", cr: "1010123456" } };

test("template is filled from the project, quote and company details, and passes validation", () => {
  const d = newContract({ project, quote, site, clientName: "نورة" });
  assert.equal(contractProblem(d), null);
  assert.equal(d.company.name, "شركة عطور الطائف");
  assert.equal(d.company.idNumber, "1010123456");
  assert.equal(d.quoteId, "q1");
  const text = d.sections.map((s) => s.body).join("\n");
  for (const want of ["18,400 ر.س", "9,200 ر.س", "QT-260007", "2026-12-01", "«مسك الليل»", "نورة"]) assert.ok(text.includes(want), want);
  assert.deepEqual(d.specs.map((s) => [s.name, s.qty]), [["زجاجة 50 مل", 1000], ["علبة", 1000]]);
});
test("without a quote the template still validates and has no items", () => {
  const d = newContract({ project, quote: null, site, clientName: "نورة" });
  assert.equal(contractProblem(d), null);
  assert.equal(d.specs.length, 0);
});
test("validation catches empty names, bad quantities and too many files", () => {
  const d = newContract({ project, quote, site, clientName: "x" });
  assert.equal(contractProblem({ ...d, title: " " }), "contract_title");
  assert.equal(contractProblem({ ...d, specs: [{ ...d.specs[0], name: "" }] }), "contract_specs");
  assert.equal(contractProblem({ ...d, specs: [{ ...d.specs[0], qty: -1 }] }), "contract_qty");
  assert.equal(contractProblem({ ...d, specs: [{ ...d.specs[0], files: ["a", "b", "c", "d", "e"] }] }), "contract_files");
});
test("quantities are totalled per unit", () => {
  assert.deepEqual(totalsByUnit([{ qty: 1000, unit: "قطعة" }, { qty: 500, unit: "قطعة" }, { qty: 20, unit: "لتر" }] as never), [{ unit: "قطعة", qty: 1500 }, { unit: "لتر", qty: 20 }]);
});
test("a sent, unsigned contract becomes the client's next step (after the deposit, before quotes)", () => {
  const contract = { id: "c1", projectId: "p1", ref: "CT-260001", title: "عقد", status: "sent", clientSignature: null, sentAt: "2026-10-20T10:00:00Z", createdAt: "" } as never;
  const acts = clientActions({ items: [], quotes: [{ ...(quote as object), status: "sent", sentAt: "2026-10-19T10:00:00Z" } as never], contracts: [contract] });
  assert.deepEqual(acts.map((a) => a.kind), ["contract", "quote"]);
  assert.equal(acts[0].to, "/account/projects/p1#pj-contract");
  assert.equal(clientActions({ items: [], quotes: [], contracts: [{ ...(contract as object), status: "client_signed" } as never] }).length, 0);
});
