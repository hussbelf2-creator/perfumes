// الوضع التجريبي (localStorage) يطابق قواعد الخادم في المشاريع والتصاميم
import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, String(v)), removeItem: (k: string) => store.delete(k), clear: () => store.clear() };

const { projectsRepo } = await import("@/projects/repo");
const owner = { id: "u-owner", role: "owner" as const, email: "owner@x.sa", name: "o" };
const sales = { id: "u-sales", role: "sales" as const, email: "sales@x.sa", name: "s" };
const clientA = { id: "u-a", role: "client" as const, email: "a@x.sa", name: "a" };
const clientB = { id: "u-b", role: "client" as const, email: "b@x.sa", name: "b" };
const blank = { title: "مشروع", track: "C", contactId: null, designerId: null, ownerId: null, stage: "brief", status: "active", dueDate: null } as const;

test("v3 uploaded from v2 continues the same thread and supersedes v2", async () => {
  const p = await projectsRepo.createProject({ ...blank, clientEmail: "a@x.sa" }, owner);
  const file = ["data:image/png;base64,AAAA"];
  const add = (threadId: string | null) => projectsRepo.addItem({ projectId: p.id, threadId, kind: "label", title: "ملصق", files: file, studio: null, note: "" }, owner);
  const v1 = await add(null);
  const v2 = await add(v1.id);
  const v3 = await add(v2.id);
  assert.equal(v3.version, 3);
  assert.equal(v3.threadId, v1.id);
  const items = (await projectsRepo.load(owner)).items.filter((i) => i.projectId === p.id);
  assert.deepEqual(items.map((i) => [i.version, i.status]).sort(), [[1, "superseded"], [2, "superseded"], [3, "pending"]]);
});

test("a client loads fine while other clients' projects have quotes", async () => {
  const p = await projectsRepo.createProject({ ...blank, clientEmail: "a@x.sa" }, owner);
  await projectsRepo.saveQuote({ projectId: p.id, lines: [{ label: "x", qty: 1, unit: 100 }], depositPct: 50, validUntil: null, notes: "", discountKind: null, discountValue: 0 }, null, owner);
  const d = await projectsRepo.load(clientB);
  assert.equal(d.projects.length, 0);
  assert.equal(d.quotes.length, 0);
  assert.ok((await projectsRepo.load(clientA)).projects.length >= 1);
});

test("sales cannot delete a project; owner can unless a quote is paid", async () => {
  const p = await projectsRepo.createProject({ ...blank, clientEmail: "a@x.sa" }, owner);
  await assert.rejects(projectsRepo.deleteProject(p.id, sales));
  await projectsRepo.deleteProject(p.id, owner);
  assert.ok(!(await projectsRepo.load(owner)).projects.some((x) => x.id === p.id));
});

test("contract flow: draft hidden from client → send locks + fingerprints → client signs → owner countersigns", async () => {
  const p = await projectsRepo.createProject({ ...blank, clientEmail: "a@x.sa" }, owner);
  const draft = { projectId: p.id, quoteId: null, title: "عقد تصنيع", company: { name: "المصنع", idLabel: "سجل تجاري", idNumber: "1010", address: "", representative: "" }, client: { name: "العميل", idLabel: "", idNumber: "", address: "", representative: "" }, sections: [{ title: "الموضوع", body: "تصنيع" }], specs: [{ id: "s1", name: "زجاجة", description: "50 مل", qty: 1000, unit: "قطعة", images: [], files: [] }] };
  await assert.rejects(projectsRepo.saveContract({ ...draft, specs: [{ ...draft.specs[0], qty: 0 }] }, null, owner), /contract_qty/);
  const c = await projectsRepo.saveContract(draft, null, sales);
  assert.match(c.ref, /^CT-\d{6}$/);
  assert.equal((await projectsRepo.load(clientA)).contracts.length, 0, "draft hidden from the client");
  await projectsRepo.sendContract(c.id, sales);
  const sent = (await projectsRepo.load(clientA)).contracts.find((x) => x.id === c.id)!;
  assert.equal(sent.status, "sent");
  assert.match(sent.contentHash ?? "", /^[0-9a-f]{64}$/);
  await assert.rejects(projectsRepo.saveContract({ ...draft, title: "معدّل" }, c.id, sales), /contract_locked/);
  await assert.rejects(projectsRepo.signContract(c.id, "client", "idb:sig", "العميل", "wrong", clientA), /contract_changed/);
  await assert.rejects(projectsRepo.signContract(c.id, "client", "idb:sig", "العميل", sent.contentHash!, clientB));
  assert.equal(await projectsRepo.signContract(c.id, "client", "idb:sig", "العميل", sent.contentHash!, clientA), "client_signed");
  await assert.rejects(projectsRepo.signContract(c.id, "client", "idb:sig", "العميل", sent.contentHash!, clientA), /already_signed/);
  await assert.rejects(projectsRepo.signContract(c.id, "company", "idb:sig2", "فيصل", sent.contentHash!, sales), "sales cannot sign for the company");
  await assert.rejects(projectsRepo.reopenContract(c.id, sales), /contract_locked/);
  assert.equal(await projectsRepo.signContract(c.id, "company", "idb:sig2", "أحمد", sent.contentHash!, owner), "signed");
  await assert.rejects(projectsRepo.voidContract(c.id, sales), "sales cannot void a signed contract");
});

test("contract changes: client asks, team edits and re-sends with a new fingerprint", async () => {
  const p = await projectsRepo.createProject({ ...blank, clientEmail: "a@x.sa" }, owner);
  const draft = { projectId: p.id, quoteId: null, title: "عقد", company: { name: "م", idLabel: "", idNumber: "", address: "", representative: "" }, client: { name: "ع", idLabel: "", idNumber: "", address: "", representative: "" }, sections: [{ title: "أ", body: "ب" }], specs: [] };
  const c = await projectsRepo.saveContract(draft, null, owner);
  await projectsRepo.sendContract(c.id, owner);
  const h1 = (await projectsRepo.load(owner)).contracts.find((x) => x.id === c.id)!.contentHash;
  await assert.rejects(projectsRepo.contractChanges(c.id, " ", clientA), /note_required/);
  await projectsRepo.contractChanges(c.id, "الكمية 1500", clientA);
  const d = await projectsRepo.load(owner);
  assert.equal(d.contracts.find((x) => x.id === c.id)!.status, "changes");
  assert.ok(d.comments.some((m) => m.body.includes("ملاحظة على العقد")));
  await projectsRepo.saveContract({ ...draft, sections: [{ title: "أ", body: "ب معدّل" }] }, c.id, owner);
  await projectsRepo.sendContract(c.id, owner);
  const h2 = (await projectsRepo.load(owner)).contracts.find((x) => x.id === c.id)!.contentHash;
  assert.notEqual(h1, h2);
});
