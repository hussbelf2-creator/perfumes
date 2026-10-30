import { supabase } from "@/lib/supabase";
import { can, type Role } from "@/lib/rbac";
import { PermissionError, ValidationError } from "@/admin/data/types";
import { stageOk } from "./stages";
import { isEmail, quoteTotals, round2, VAT_RATE, type NewItem, type NewProject, type Project, type ProjectComment, type ProjectItem, type ProjectCost, type Quote, type QuoteCost, type QuoteDraft, type SavedDesign } from "./types";
import { stagesFor } from "./stages";
import { capFor, localPolicy } from "@/pricing/repo";
import { localReserveForQuote } from "@/inventory/repo";
import { contractProblem, editable, type Contract, type ContractDraft, type ContractStatus } from "@/contracts/types";

// المشاريع والاعتمادات. القواعد هنا مطابقة لقواعد قاعدة البيانات (project_access وdecide_item)
// حتى يتصرف الوضع التجريبي كما يتصرف الإنتاج.

export interface PActor {
  id: string;
  role: Role;
  email: string;
  name: string;
}
export type Access = "manage" | "designer" | "view" | "client" | null;
export interface ProjectsData {
  projects: Project[];
  items: ProjectItem[];
  comments: ProjectComment[];
  quotes: Quote[];
  /** داخلية: للفريق فقط (فارغة للعميل) */
  quoteCosts: QuoteCost[];
  costs: ProjectCost[];
  /** العقود: الفريق يرى كلها، والعميل المرسلة إليه فقط */
  contracts: Contract[];
}
export type CostInput = Omit<QuoteCost, "quoteId">;
export type DesignInput = Pick<SavedDesign, "name" | "link" | "summary" | "thumb" | "label" | "box">;

export function accessOf(p: Pick<Project, "designerId" | "clientId" | "clientEmail">, a: PActor | null): Access {
  if (!a) return null;
  if (can(a.role, "projects.manage")) return "manage";
  if (p.designerId && p.designerId === a.id) return "designer";
  if (can(a.role, "projects.view")) return "view";
  if ((p.clientId && p.clientId === a.id) || (!p.clientId && a.role === "client" && p.clientEmail === a.email.toLowerCase())) return "client";
  return null;
}

export interface ProjectsRepo {
  load(a: PActor): Promise<ProjectsData>;
  createProject(input: NewProject, a: PActor): Promise<Project>;
  updateProject(id: string, patch: Partial<NewProject>, a: PActor): Promise<void>;
  deleteProject(id: string, a: PActor): Promise<void>;
  addItem(input: NewItem, a: PActor): Promise<ProjectItem>;
  decide(itemId: string, decision: "approved" | "changes", note: string, a: PActor): Promise<void>;
  comment(projectId: string, itemId: string | null, body: string, a: PActor): Promise<void>;
  listDesigns(a: PActor): Promise<SavedDesign[]>;
  saveDesign(input: DesignInput, id: string | null, a: PActor): Promise<SavedDesign>;
  deleteDesign(id: string, a: PActor): Promise<void>;
  saveQuote(input: QuoteDraft, id: string | null, a: PActor, cost?: CostInput | null): Promise<Quote>;
  addCost(input: Pick<ProjectCost, "projectId" | "kind" | "amount" | "note">, a: PActor): Promise<void>;
  deleteCost(id: string, a: PActor): Promise<void>;
  deleteQuote(id: string, a: PActor): Promise<void>;
  sendQuote(id: string, a: PActor): Promise<void>;
  decideQuote(id: string, decision: "accepted" | "changes", note: string, a: PActor): Promise<void>;
  markQuotePaid(id: string, method: "bank" | "cash", ref: string, amount: number, a: PActor): Promise<void>;
  saveContract(input: ContractDraft, id: string | null, a: PActor): Promise<Contract>;
  deleteContract(id: string, a: PActor): Promise<void>;
  sendContract(id: string, a: PActor): Promise<void>;
  /** إعادة المرسل للتحرير (قبل توقيع العميل) */
  reopenContract(id: string, a: PActor): Promise<void>;
  contractChanges(id: string, note: string, a: PActor): Promise<void>;
  /** التوقيع بصورة التوقيع واسم الموقّع، على البصمة المعروضة له؛ يعيد الحالة الجديدة */
  signContract(id: string, side: "client" | "company", signature: string, name: string, hash: string, a: PActor): Promise<ContractStatus>;
  voidContract(id: string, a: PActor): Promise<void>;
  /** يحوّل طلبات «ابدأ مسارك» المرسلة ببريد العميل إلى مشاريع في حسابه؛ يعيد معرّفات الجديدة */
  claimBriefs(a: PActor): Promise<string[]>;
}

const STUDIO_LINK = /^\/studio-3d([?#]|$)/;
function checkProject(p: Partial<NewProject>) {
  if (p.title !== undefined && (!p.title.trim() || p.title.length > 120)) throw new ValidationError("project_title");
  if (p.clientEmail !== undefined && !isEmail(p.clientEmail.trim())) throw new ValidationError("client_email");
  if (p.stage !== undefined && p.track !== undefined && !stageOk(p.track, p.stage)) throw new ValidationError("stage");
}
function checkItem(i: NewItem) {
  if (!i.title.trim() || i.title.length > 120) throw new ValidationError("title");
  if (i.files.length > 12) throw new ValidationError("too_many_images");
  if (!i.files.length && !i.studio) throw new ValidationError("item_empty");
  if (i.studio && !STUDIO_LINK.test(i.studio.link)) throw new ValidationError("studio_link");
  if (i.note.length > 2000) throw new ValidationError("note_too_long");
}
function checkQuote(q: QuoteDraft) {
  if (!q.lines.length || q.lines.length > 40) throw new ValidationError("quote_lines");
  for (const l of q.lines) {
    if (!l.label.trim() || l.label.length > 200) throw new ValidationError("quote_line_label");
    if (!(l.qty > 0 && l.qty <= 1_000_000) || !(l.unit >= 0 && l.unit <= 10_000_000)) throw new ValidationError("quote_line_number");
  }
  if (!Number.isInteger(q.depositPct) || q.depositPct < 0 || q.depositPct > 100) throw new ValidationError("deposit_pct");
  if (q.notes.length > 2000) throw new ValidationError("note_too_long");
  if (q.discountKind && !(q.discountValue >= 0 && (q.discountKind !== "pct" || q.discountValue <= 100))) throw new ValidationError("discount_value");
}
function checkCost(c: CostInput) {
  if (c.lines.length > 40 || c.lines.some((l) => !(Number(l.unitCost) >= 0 && Number(l.unitCost) <= 10_000_000) || (l.perUnit != null && !(l.perUnit > 0)))) throw new ValidationError("cost_value");
  if (!(c.extraCost >= 0)) throw new ValidationError("cost_value");
}
const today = () => new Date().toISOString().slice(0, 10);

function checkDesign(d: DesignInput) {
  if (!d.name.trim() || d.name.length > 80) throw new ValidationError("design_name");
  if (!STUDIO_LINK.test(d.link) || d.link.length > 2000) throw new ValidationError("studio_link");
  if (d.thumb && (!/^data:image\/(webp|png|jpeg);base64,/.test(d.thumb) || d.thumb.length >= 120_000)) throw new ValidationError("thumb");
}

// ─── الوضع التجريبي ───────────────────────────────────────────────
const KEY = "pp_projects_v1";
interface Store extends ProjectsData {
  designs: SavedDesign[];
  quoteSeq?: number;
  contractSeq?: number;
}
function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { quotes: [], quoteCosts: [], costs: [], contracts: [], ...(JSON.parse(raw) as Store) };
  } catch {
    /* نبدأ فارغاً */
  }
  return { projects: [], items: [], comments: [], quotes: [], quoteCosts: [], costs: [], contracts: [], designs: [] };
}
function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new ValidationError("storage_full");
  }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();

/** بصمة نص العقد (الوضع التجريبي؛ على الخادم يحسبها Postgres) */
async function contentHash(c: Contract) {
  const text = JSON.stringify({ ref: c.ref, title: c.title, company: c.company, client: c.client, sections: c.sections, specs: c.specs });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** الوضع التجريبي: تكلفة مواد صُرفت من المخزون لمشروع (يستدعيها مستودع المخزون) */
export function localAddMaterialCost(projectId: string, amount: number, note: string, moveId: string) {
  const s = read();
  s.costs.push({ id: uid(), projectId, kind: "materials", amount, note, moveId, createdAt: now() });
  write(s);
}

const localRepo: ProjectsRepo = {
  async load(a) {
    const s = read();
    const projects = s.projects.filter((p) => accessOf(p, a));
    const ids = new Set(projects.map((p) => p.id));
    return {
      projects: projects.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)),
      items: s.items.filter((i) => ids.has(i.projectId)),
      comments: s.comments.filter((c) => ids.has(c.projectId)).sort((x, y) => x.createdAt.localeCompare(y.createdAt)),
      quotes: s.quotes
        .filter((q) => {
          // مشروع لا يراه المستخدم: يُستبعد قبل فحص الصلاحية (لا انهيار للعميل والمصمم)
          const proj = ids.has(q.projectId) ? projects.find((p) => p.id === q.projectId) : undefined;
          if (!proj) return false;
          const acc = accessOf(proj, a);
          return (acc === "manage" || acc === "view" || (acc === "client" && q.status !== "draft"));
        })
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
      // التكاليف للفريق الذي يدير المشروع أو يراه — لا للعميل ولا للمصمم
      quoteCosts: s.quoteCosts.filter((c) => {
        const q = s.quotes.find((x) => x.id === c.quoteId);
        const p = q && projects.find((x) => x.id === q.projectId);
        return !!p && ["manage", "view"].includes(accessOf(p, a) ?? "");
      }),
      costs: s.costs.filter((c) => {
        const p = projects.find((x) => x.id === c.projectId);
        return !!p && ["manage", "view"].includes(accessOf(p, a) ?? "");
      }),
      contracts: s.contracts
        .filter((c) => {
          const p = projects.find((x) => x.id === c.projectId);
          const acc = p ? accessOf(p, a) : null;
          return acc === "manage" || acc === "view" || (acc === "client" && c.status !== "draft");
        })
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    };
  },
  async createProject(input, a) {
    if (!can(a.role, "projects.manage")) throw new PermissionError("projects.manage");
    checkProject(input);
    const s = read();
    const t = now();
    const p: Project = { ...input, id: uid(), clientEmail: input.clientEmail.trim().toLowerCase(), clientId: null, ownerId: input.ownerId ?? a.id, createdAt: t, updatedAt: t };
    s.projects.push(p);
    write(s);
    return p;
  },
  async updateProject(id, patch, a) {
    if (!can(a.role, "projects.manage")) throw new PermissionError("projects.manage");
    checkProject(patch);
    const s = read();
    const cur = s.projects.find((p) => p.id === id);
    if (cur && patch.stage !== undefined && patch.track === undefined && !stageOk(cur.track, patch.stage)) throw new ValidationError("stage");
    s.projects = s.projects.map((p) => (p.id === id ? { ...p, ...patch, ...(patch.clientEmail && patch.clientEmail.trim().toLowerCase() !== p.clientEmail ? { clientEmail: patch.clientEmail.trim().toLowerCase(), clientId: null } : {}), updatedAt: now() } : p));
    write(s);
  },
  async deleteProject(id, a) {
    // كالخادم: الحذف للمالك والمدير، ولا يُحذف مشروع فيه عرض مدفوع
    if (!can(a.role, "team.manage")) throw new PermissionError("team.manage");
    const s = read();
    if (s.quotes.some((q) => q.projectId === id && q.status === "paid")) throw new ValidationError("project_paid");
    write({ ...s, projects: s.projects.filter((p) => p.id !== id), items: s.items.filter((i) => i.projectId !== id), comments: s.comments.filter((c) => c.projectId !== id), quotes: s.quotes.filter((q) => q.projectId !== id) });
  },
  async addItem(input, a) {
    checkItem(input);
    const s = read();
    const p = s.projects.find((x) => x.id === input.projectId);
    const acc = p ? accessOf(p, a) : null;
    if (!acc || acc === "view") throw new PermissionError("projects.manage");
    const id = uid();
    const t = now();
    let item: ProjectItem;
    if (acc === "client") {
      item = { ...input, id, threadId: id, version: 1, status: "submitted", byClient: true, createdBy: a.id, createdAt: t, decidedAt: null, decidedBy: null, decisionNote: null };
    } else {
      const thread = input.threadId ? s.items.find((i) => i.id === input.threadId && i.projectId === input.projectId) : null;
      if (input.threadId && !thread) throw new ValidationError("not_found");
      // السلسلة تُعرف بجذرها: النسخة الثالثة تُرفع من الثانية كما من الأولى
      const root = thread ? thread.threadId || thread.id : id;
      const version = thread ? Math.max(0, ...s.items.filter((i) => i.threadId === root).map((i) => i.version)) + 1 : 1;
      item = { ...input, id, threadId: root, version, status: "pending", byClient: false, createdBy: a.id, createdAt: t, decidedAt: null, decidedBy: null, decisionNote: null };
      if (thread) s.items = s.items.map((i) => (i.threadId === root && i.status !== "superseded" ? { ...i, status: "superseded" } : i));
    }
    s.items.push(item);
    s.projects = s.projects.map((x) => (x.id === input.projectId ? { ...x, updatedAt: t } : x));
    write(s);
    return item;
  },
  async decide(itemId, decision, note, a) {
    const s = read();
    const it = s.items.find((i) => i.id === itemId);
    if (!it) throw new ValidationError("not_found");
    const p = s.projects.find((x) => x.id === it.projectId)!;
    if (accessOf(p, a) !== "client") throw new PermissionError("client_only");
    if (it.status !== "pending") throw new ValidationError("not_pending");
    const n = note.trim();
    if (decision === "changes" && !n) throw new ValidationError("note_required");
    if (n.length > 2000) throw new ValidationError("note_too_long");
    const t = now();
    s.items = s.items.map((i) => (i.id === itemId ? { ...i, status: decision, decidedAt: t, decidedBy: a.id, decisionNote: n || null } : i));
    if (n) s.comments.push({ id: uid(), projectId: p.id, itemId, authorId: a.id, authorName: a.name, fromClient: true, body: n, createdAt: t });
    s.projects = s.projects.map((x) => (x.id === p.id ? { ...x, updatedAt: t } : x));
    write(s);
  },
  async comment(projectId, itemId, body, a) {
    const b = body.trim();
    if (!b || b.length > 4000) throw new ValidationError("comment");
    const s = read();
    const p = s.projects.find((x) => x.id === projectId);
    const acc = p ? accessOf(p, a) : null;
    if (!acc) throw new PermissionError("projects.view");
    if (itemId && !s.items.some((i) => i.id === itemId && i.projectId === projectId)) throw new ValidationError("not_found");
    s.comments.push({ id: uid(), projectId, itemId, authorId: a.id, authorName: a.name, fromClient: acc === "client", body: b, createdAt: now() });
    write(s);
  },
  async listDesigns(a) {
    return read().designs.filter((d) => d.ownerId === a.id).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  },
  async saveDesign(input, id, a) {
    checkDesign(input);
    const s = read();
    const t = now();
    let out: SavedDesign;
    if (id) {
      const prev = s.designs.find((d) => d.id === id && d.ownerId === a.id);
      if (!prev) throw new ValidationError("not_found");
      out = { ...prev, ...input, updatedAt: t };
      s.designs = s.designs.map((d) => (d.id === id ? out : d));
    } else {
      out = { ...input, id: uid(), ownerId: a.id, createdAt: t, updatedAt: t };
      s.designs.push(out);
    }
    write(s);
    return out;
  },
  async deleteDesign(id, a) {
    const s = read();
    write({ ...s, designs: s.designs.filter((d) => !(d.id === id && d.ownerId === a.id)) });
  },
  async saveQuote(input, id, a, cost) {
    checkQuote(input);
    if (cost) checkCost(cost);
    const s = read();
    const p = s.projects.find((x) => x.id === input.projectId);
    if (!p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    const t = now();
    const lines = input.lines.map((l) => ({ label: l.label.trim(), qty: Number(l.qty), unit: Number(l.unit) }));
    // قيمة الخصم تُخزَّن بخانتين على الخادم (numeric(12,2))
    input = { ...input, discountValue: round2(Number(input.discountValue) || 0) };
    let out: Quote;
    if (id) {
      const prev = s.quotes.find((q) => q.id === id);
      if (!prev) throw new ValidationError("not_found");
      if (prev.status !== "draft") throw new ValidationError("quote_locked");
      out = { ...prev, lines, depositPct: input.depositPct, validUntil: input.validUntil || null, notes: input.notes, discountKind: input.discountKind ?? null, discountValue: input.discountKind ? input.discountValue : 0, ...quoteTotals(lines, prev.vatRate, input.depositPct, input.discountKind, input.discountValue) };
      s.quotes = s.quotes.map((q) => (q.id === id ? out : q));
    } else {
      s.quoteSeq = (s.quoteSeq ?? 0) + 1;
      out = { id: uid(), projectId: p.id, ref: `QT-${t.slice(2, 4)}${String(s.quoteSeq).padStart(4, "0")}`, status: "draft", lines, vatRate: VAT_RATE, depositPct: input.depositPct, discountKind: input.discountKind ?? null, discountValue: input.discountKind ? input.discountValue : 0, ...quoteTotals(lines, VAT_RATE, input.depositPct, input.discountKind, input.discountValue), validUntil: input.validUntil || null, notes: input.notes, createdAt: t };
      s.quotes.push(out);
    }
    if (cost) s.quoteCosts = [...s.quoteCosts.filter((c) => c.quoteId !== out.id), { quoteId: out.id, lines: cost.lines, extraCost: cost.extraCost }];
    write(s);
    return out;
  },
  async deleteQuote(id, a) {
    const s = read();
    const q = s.quotes.find((x) => x.id === id);
    if (!q) return;
    const p = s.projects.find((x) => x.id === q.projectId);
    if (!p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (q.status !== "draft") throw new ValidationError("quote_locked");
    write({ ...s, quotes: s.quotes.filter((x) => x.id !== id) });
  },
  async sendQuote(id, a) {
    const s = read();
    const q = s.quotes.find((x) => x.id === id);
    if (!q) throw new ValidationError("not_found");
    const p = s.projects.find((x) => x.id === q.projectId);
    if (!p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (q.status !== "draft") throw new ValidationError("not_draft");
    if (!q.lines.length || q.total <= 0) throw new ValidationError("quote_empty");
    if (q.validUntil && q.validUntil < today()) throw new ValidationError("quote_expired");
    if (q.discount > 0 && q.gross > 0 && (q.discount / q.gross) * 100 > capFor(localPolicy(), a.role) + 0.001) throw new PermissionError("discount_cap");
    const t = now();
    s.quotes = s.quotes.map((x) => (x.id === id ? { ...x, status: "sent", sentAt: t } : x.projectId === q.projectId && ["sent", "changes", "accepted"].includes(x.status) ? { ...x, status: "void" } : x));
    write(s);
  },
  async decideQuote(id, decision, note, a) {
    const s = read();
    const q = s.quotes.find((x) => x.id === id);
    if (!q) throw new ValidationError("not_found");
    const p = s.projects.find((x) => x.id === q.projectId)!;
    if (accessOf(p, a) !== "client") throw new PermissionError("client_only");
    if (q.status !== "sent") throw new ValidationError("not_pending");
    const n = note.trim();
    if (decision === "accepted" && q.validUntil && q.validUntil < today()) throw new ValidationError("quote_expired");
    if (decision === "changes" && !n) throw new ValidationError("note_required");
    if (n.length > 2000) throw new ValidationError("note_too_long");
    const t = now();
    s.quotes = s.quotes.map((x) => (x.id === id ? { ...x, status: decision, decidedAt: t, decisionNote: n || null } : x));
    if (n) s.comments.push({ id: uid(), projectId: p.id, itemId: null, authorId: a.id, authorName: a.name, fromClient: true, body: `ملاحظة على عرض السعر ${q.ref}: ${n}`, createdAt: t });
    write(s);
  },
  // ─── العقود (الوضع التجريبي: نفس قواعد الخادم) ──────────────────
  async saveContract(input, id, a) {
    const code = contractProblem(input);
    if (code) throw new ValidationError(code);
    const s = read();
    const p = s.projects.find((x) => x.id === input.projectId);
    if (!p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (input.quoteId && !s.quotes.some((q) => q.id === input.quoteId && q.projectId === p.id)) throw new ValidationError("not_found");
    const t = now();
    let out: Contract;
    if (id) {
      const prev = s.contracts.find((c) => c.id === id);
      if (!prev) throw new ValidationError("not_found");
      if (!editable(prev)) throw new ValidationError("contract_locked");
      out = { ...prev, ...input, projectId: prev.projectId, updatedAt: t };
      s.contracts = s.contracts.map((c) => (c.id === id ? out : c));
    } else {
      s.contractSeq = (s.contractSeq ?? 0) + 1;
      out = { ...input, id: uid(), ref: `CT-${t.slice(2, 4)}${String(s.contractSeq).padStart(4, "0")}`, status: "draft", contentHash: null, sentAt: null, changeNote: null, clientSignature: null, clientSignedName: null, clientSignedAt: null, companySignature: null, companySignedName: null, companySignedAt: null, createdAt: t, updatedAt: t };
      s.contracts.push(out);
    }
    write(s);
    return out;
  },
  async deleteContract(id, a) {
    const s = read();
    const c = s.contracts.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (c.status !== "draft" || c.sentAt) throw new ValidationError("contract_locked");
    write({ ...s, contracts: s.contracts.filter((x) => x.id !== id) });
  },
  async sendContract(id, a) {
    const s = read();
    const c = s.contracts.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (!editable(c)) throw new ValidationError("not_draft");
    if (!c.sections.length) throw new ValidationError("contract_empty");
    const hash = await contentHash(c);
    s.contracts = s.contracts.map((x) => (x.id === id ? { ...x, status: "sent", sentAt: now(), contentHash: hash, changeNote: null } : x));
    write(s);
  },
  async reopenContract(id, a) {
    const s = read();
    const c = s.contracts.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (c.status !== "sent" && c.status !== "changes") throw new ValidationError("contract_locked");
    s.contracts = s.contracts.map((x) => (x.id === id ? { ...x, status: "draft", contentHash: null, companySignature: null, companySignedName: null, companySignedAt: null } : x));
    write(s);
  },
  async contractChanges(id, note, a) {
    const s = read();
    const c = s.contracts.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p || accessOf(p, a) !== "client") throw new PermissionError("client_only");
    if (c.status !== "sent") throw new ValidationError("not_pending");
    const n = note.trim();
    if (!n) throw new ValidationError("note_required");
    if (n.length > 2000) throw new ValidationError("note_too_long");
    const t = now();
    s.contracts = s.contracts.map((x) => (x.id === id ? { ...x, status: "changes", changeNote: n, companySignature: null, companySignedName: null, companySignedAt: null } : x));
    s.comments.push({ id: uid(), projectId: p.id, itemId: null, authorId: a.id, authorName: a.name, fromClient: true, body: `ملاحظة على العقد ${c.ref}: ${n}`, createdAt: t });
    write(s);
  },
  async signContract(id, side, signature, name, hash, a) {
    const s = read();
    const c = s.contracts.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p) throw new ValidationError("not_found");
    if (side === "client" && accessOf(p, a) !== "client") throw new PermissionError("client_only");
    if (side === "company" && (accessOf(p, a) !== "manage" || !can(a.role, "contracts.sign"))) throw new PermissionError("contracts.sign");
    if (c.status !== "sent" && c.status !== "client_signed") throw new ValidationError("not_signable");
    if (hash !== c.contentHash) throw new ValidationError("contract_changed");
    const n = name.trim();
    if (n.length < 2 || n.length > 120) throw new ValidationError("signer_name");
    if (!signature) throw new ValidationError("signature_file");
    const t = now();
    let next: Contract;
    if (side === "client") {
      if (c.clientSignature) throw new ValidationError("already_signed");
      next = { ...c, clientSignature: signature, clientSignedName: n, clientSignedAt: t, status: c.companySignature ? "signed" : "client_signed" };
      s.comments.push({ id: uid(), projectId: p.id, itemId: null, authorId: a.id, authorName: a.name, fromClient: true, body: `وقّع العميل العقد ${c.ref}`, createdAt: t });
    } else {
      if (c.companySignature) throw new ValidationError("already_signed");
      next = { ...c, companySignature: signature, companySignedName: n, companySignedAt: t, status: c.clientSignature ? "signed" : c.status };
    }
    s.contracts = s.contracts.map((x) => (x.id === id ? next : x));
    write(s);
    return next.status;
  },
  async voidContract(id, a) {
    const s = read();
    const c = s.contracts.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (c.status === "signed" && !can(a.role, "contracts.sign")) throw new PermissionError("contracts.sign");
    s.contracts = s.contracts.map((x) => (x.id === id ? { ...x, status: "void" } : x));
    write(s);
  },
  async markQuotePaid(id, method, ref, amount, a) {
    const s = read();
    const q = s.quotes.find((x) => x.id === id);
    if (!q) throw new ValidationError("not_found");
    const p = s.projects.find((x) => x.id === q.projectId)!;
    if (accessOf(p, a) !== "manage" || !can(a.role, "payments.view")) throw new PermissionError("payments.view");
    if (q.status !== "sent" && q.status !== "accepted") throw new ValidationError("not_payable");
    if (!(amount > 0 && amount >= q.deposit && amount <= q.total)) throw new ValidationError("bad_amount");
    if (!ref.trim() || ref.length > 120) throw new ValidationError("payment_ref");
    const t = now();
    s.quotes = s.quotes.map((x) => (x.id === id ? { ...x, status: "paid", paidAt: t, paidAmount: round2(amount), paymentMethod: method, paymentRef: ref.trim(), decidedAt: x.decidedAt ?? t } : x));
    // الدفع يبدأ العمل: من الملخص إلى المرحلة الثانية
    s.projects = s.projects.map((x) => (x.id === p.id && x.stage === "brief" ? { ...x, stage: stagesFor(x.track)[1].id, updatedAt: t } : x));
    write(s);
    const cost = s.quoteCosts.find((c) => c.quoteId === q.id);
    if (cost) localReserveForQuote(p.id, q, cost.lines);
  },
  async addCost(input, a) {
    const s = read();
    const p = s.projects.find((x) => x.id === input.projectId);
    if (!p || accessOf(p, a) !== "manage") throw new PermissionError("projects.manage");
    if (!(input.amount > 0)) throw new ValidationError("cost_value");
    s.costs.push({ ...input, id: uid(), note: input.note.trim(), moveId: null, createdAt: now() });
    write(s);
  },
  async deleteCost(id, a) {
    const s = read();
    const c = s.costs.find((x) => x.id === id);
    const p = c && s.projects.find((x) => x.id === c.projectId);
    if (!c || !p || accessOf(p, a) !== "manage" || c.moveId) throw new PermissionError("projects.manage");
    write({ ...s, costs: s.costs.filter((x) => x.id !== id) });
  },
  async claimBriefs(a) {
    if (a.role !== "client") return [];
    const crm = await import("@/admin/data/localRepo");
    const leads = crm.pendingDemoBriefs(a.email);
    if (!leads.length) return [];
    const s = read();
    const ids: string[] = [];
    for (const l of leads.slice(0, 5)) {
      const t = now();
      const p: Project = {
        id: uid(),
        title: (l.payload.brand || [l.payload.track_title, l.payload.firstName].filter(Boolean).join(" · ") || "مشروع جديد").slice(0, 120),
        track: l.payload.track || null,
        contactId: l.contactId ?? null,
        clientEmail: a.email.toLowerCase(),
        clientId: a.id,
        designerId: null,
        ownerId: null,
        stage: "brief",
        status: "active",
        dueDate: null,
        brief: l.payload,
        createdAt: t,
        updatedAt: t,
      };
      s.projects.push(p);
      ids.push(p.id);
      crm.markDemoBrief(l.id, p.id);
    }
    write(s);
    return ids;
  },
};

// ─── Supabase ────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const projectFromRow = (r: Row): Project => ({
  id: String(r.id),
  title: String(r.title),
  track: (r.track as string) ?? null,
  contactId: (r.contact_id as string) ?? null,
  clientEmail: String(r.client_email),
  clientId: (r.client_id as string) ?? null,
  designerId: (r.designer_id as string) ?? null,
  ownerId: (r.owner_id as string) ?? null,
  stage: r.stage as Project["stage"],
  status: r.status as Project["status"],
  dueDate: (r.due_date as string) ?? null,
  brief: (r.brief as Record<string, string>) ?? null,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const projectToRow = (p: Partial<NewProject>): Row => {
  const r: Row = {};
  if (p.title !== undefined) r.title = p.title.trim();
  if (p.track !== undefined) r.track = p.track || null;
  if (p.contactId !== undefined) r.contact_id = p.contactId || null;
  if (p.clientEmail !== undefined) r.client_email = p.clientEmail.trim();
  if (p.designerId !== undefined) r.designer_id = p.designerId || null;
  if (p.ownerId !== undefined) r.owner_id = p.ownerId || null;
  if (p.stage !== undefined) r.stage = p.stage;
  if (p.status !== undefined) r.status = p.status;
  if (p.dueDate !== undefined) r.due_date = p.dueDate || null;
  return r;
};
const itemFromRow = (r: Row): ProjectItem => ({
  id: String(r.id),
  projectId: String(r.project_id),
  threadId: String(r.thread_id),
  version: Number(r.version),
  kind: r.kind as ProjectItem["kind"],
  title: String(r.title),
  status: r.status as ProjectItem["status"],
  files: (r.files as string[]) ?? [],
  studio: (r.studio as ProjectItem["studio"]) ?? null,
  note: String(r.note ?? ""),
  createdBy: String(r.created_by ?? ""),
  byClient: Boolean(r.by_client),
  createdAt: String(r.created_at),
  decidedAt: (r.decided_at as string) ?? null,
  decidedBy: (r.decided_by as string) ?? null,
  decisionNote: (r.decision_note as string) ?? null,
});
const commentFromRow = (r: Row): ProjectComment => ({
  id: String(r.id),
  projectId: String(r.project_id),
  itemId: (r.item_id as string) ?? null,
  authorId: String(r.author_id ?? ""),
  authorName: String(r.author_name ?? ""),
  fromClient: Boolean(r.from_client),
  body: String(r.body),
  createdAt: String(r.created_at),
});
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const partyFromRow = (v: unknown) => {
  const o = obj(v);
  return { name: String(o.name ?? ""), idLabel: String(o.idLabel ?? ""), idNumber: String(o.idNumber ?? ""), address: String(o.address ?? ""), representative: String(o.representative ?? "") };
};
const contractFromRow = (r: Row): Contract => ({
  id: String(r.id),
  projectId: String(r.project_id),
  quoteId: (r.quote_id as string) ?? null,
  ref: String(r.ref),
  status: r.status as ContractStatus,
  title: String(r.title),
  company: partyFromRow(r.company),
  client: partyFromRow(r.client),
  sections: ((r.sections as Row[]) ?? []).map((x) => ({ title: String(x.title ?? ""), body: String(x.body ?? "") })),
  specs: ((r.specs as Row[]) ?? []).map((x, i) => ({ id: String(x.id ?? `s${i}`), name: String(x.name ?? ""), description: String(x.description ?? ""), qty: Number(x.qty) || 0, unit: String(x.unit ?? ""), images: ((x.images as string[]) ?? []).map(String), files: ((x.files as string[]) ?? []).map(String) })),
  contentHash: (r.content_hash as string) ?? null,
  sentAt: (r.sent_at as string) ?? null,
  changeNote: (r.change_note as string) ?? null,
  clientSignature: (r.client_signature as string) ?? null,
  clientSignedName: (r.client_signed_name as string) ?? null,
  clientSignedAt: (r.client_signed_at as string) ?? null,
  companySignature: (r.company_signature as string) ?? null,
  companySignedName: (r.company_signed_name as string) ?? null,
  companySignedAt: (r.company_signed_at as string) ?? null,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

const quoteFromRow = (r: Row): Quote => ({
  id: String(r.id),
  projectId: String(r.project_id),
  ref: String(r.ref),
  status: r.status as Quote["status"],
  lines: ((r.lines as Quote["lines"]) ?? []).map((l) => ({ label: String(l.label), qty: Number(l.qty), unit: Number(l.unit) })),
  vatRate: Number(r.vat_rate),
  depositPct: Number(r.deposit_pct),
  gross: Number(r.gross ?? r.subtotal),
  discountKind: (r.discount_kind as Quote["discountKind"]) ?? null,
  discountValue: Number(r.discount_value ?? 0),
  discount: Number(r.discount ?? 0),
  subtotal: Number(r.subtotal),
  vat: Number(r.vat),
  total: Number(r.total),
  deposit: Number(r.deposit),
  validUntil: (r.valid_until as string) ?? null,
  notes: String(r.notes ?? ""),
  createdAt: String(r.created_at),
  sentAt: (r.sent_at as string) ?? null,
  decidedAt: (r.decided_at as string) ?? null,
  decisionNote: (r.decision_note as string) ?? null,
  paidAt: (r.paid_at as string) ?? null,
  paidAmount: r.paid_amount == null ? null : Number(r.paid_amount),
  paymentMethod: (r.payment_method as Quote["paymentMethod"]) ?? null,
  paymentRef: (r.payment_ref as string) ?? null,
});
const designFromRow = (r: Row): SavedDesign => ({
  id: String(r.id),
  ownerId: String(r.owner_id),
  name: String(r.name),
  link: String(r.link),
  summary: String(r.summary ?? ""),
  thumb: (r.thumb as string) ?? null,
  label: r.label ?? null,
  box: r.box ?? null,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

function remoteRepo(): ProjectsRepo {
  const db = supabase!;
  const fail = (e: { message: string } | null) => {
    if (!e) return;
    const m = e.message;
    if (m.includes("quote_locked")) throw new ValidationError("quote_locked");
    for (const code of ["contract_locked", "contract_changed", "contract_empty", "contract_files", "contract_quote", "signer_name", "signature_file", "already_signed", "not_signable"]) if (m.includes(code)) throw new ValidationError(code);
    if (m.includes("project_contracts_shape")) throw new ValidationError("contract_specs");
    if (m.includes("contracts.sign")) throw new PermissionError("contracts.sign");
    if (m.includes("discount_over_cap")) throw new PermissionError("discount_cap");
    if (m.includes("discount_pct")) throw new ValidationError("discount_value");
    if (/permission|row-level security/i.test(m)) throw new PermissionError(/client_only/.test(m) ? "client_only" : /payments/.test(m) ? "payments.view" : "projects.manage");
    for (const code of ["not_draft", "quote_empty", "quote_expired", "not_payable", "bad_amount", "payment_ref", "bad_method"]) if (m.includes(code)) throw new ValidationError(code);
    if (m.includes("projects_stage_ok")) throw new ValidationError("stage");
    for (const code of ["not_pending", "note_required", "note_too_long", "not_found", "bad_thread"]) if (m.includes(code)) throw new ValidationError(code === "bad_thread" ? "not_found" : code);
    throw new Error(m);
  };
  return {
    async load() {
      // RLS تعيد ما يحق للمستخدم رؤيته فقط
      const [p, i, c, q, qc, pc, ct] = await Promise.all([
        db.from("projects").select("*").order("updated_at", { ascending: false }),
        db.from("project_items").select("*"),
        db.from("project_comments").select("*").order("created_at"),
        db.from("project_quotes").select("*").order("created_at", { ascending: false }),
        db.from("quote_costs").select("*"),
        db.from("project_costs").select("*").order("created_at"),
        db.from("project_contracts").select("*").order("created_at", { ascending: false }),
      ]);
      fail(p.error);
      fail(i.error);
      fail(c.error);
      fail(q.error);
      return {
        projects: (p.data ?? []).map(projectFromRow),
        items: (i.data ?? []).map(itemFromRow),
        comments: (c.data ?? []).map(commentFromRow),
        quotes: (q.data ?? []).map(quoteFromRow),
        // قد لا تُطبَّق هذه الجداول بعد على مشروع قديم: نكمل دونها
        quoteCosts: qc.error ? [] : (qc.data ?? []).map((r: Row) => ({ quoteId: String(r.quote_id), extraCost: Number(r.extra_cost), lines: ((r.lines as Row[]) ?? []).map((l) => ({ unitCost: Number(l.unit_cost), itemId: (l.item_id as string) ?? null, perUnit: l.per_unit == null ? null : Number(l.per_unit) })) })),
        costs: pc.error ? [] : (pc.data ?? []).map((r: Row) => ({ id: String(r.id), projectId: String(r.project_id), kind: r.kind as ProjectCost["kind"], amount: Number(r.amount), note: String(r.note ?? ""), moveId: (r.move_id as string) ?? null, createdAt: String(r.created_at) })),
        contracts: ct.error ? [] : (ct.data ?? []).map(contractFromRow),
      };
    },
    async createProject(input) {
      checkProject(input);
      const { data, error } = await db.from("projects").insert(projectToRow(input)).select().single();
      fail(error);
      return projectFromRow(data as Row);
    },
    async updateProject(id, patch) {
      checkProject(patch);
      const { error, count } = await db.from("projects").update(projectToRow(patch), { count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("projects.manage");
    },
    async deleteProject(id) {
      const { count: paid } = await db.from("project_quotes").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "paid");
      if (paid) throw new ValidationError("project_paid");
      const { error, count } = await db.from("projects").delete({ count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("team.manage");
    },
    async addItem(input) {
      checkItem(input);
      const { data, error } = await db
        .from("project_items")
        .insert({ project_id: input.projectId, thread_id: input.threadId ?? null, kind: input.kind, title: input.title.trim(), files: input.files, studio: input.studio ?? null, note: input.note })
        .select()
        .single();
      fail(error);
      return itemFromRow(data as Row);
    },
    async decide(itemId, decision, note) {
      const { error } = await db.rpc("decide_item", { p_id: itemId, p_decision: decision, p_note: note });
      fail(error);
    },
    async comment(projectId, itemId, body) {
      const b = body.trim();
      if (!b || b.length > 4000) throw new ValidationError("comment");
      const { error } = await db.from("project_comments").insert({ project_id: projectId, item_id: itemId, body: b });
      fail(error);
    },
    async listDesigns() {
      const { data, error } = await db.from("saved_designs").select("*").order("updated_at", { ascending: false });
      fail(error);
      return (data ?? []).map(designFromRow);
    },
    async saveDesign(input, id) {
      checkDesign(input);
      const row = { name: input.name.trim(), link: input.link, summary: input.summary.slice(0, 600), thumb: input.thumb ?? null, label: input.label ?? null, box: input.box ?? null };
      const q = id ? db.from("saved_designs").update(row).eq("id", id) : db.from("saved_designs").insert(row);
      const { data, error } = await q.select().single();
      fail(error);
      return designFromRow(data as Row);
    },
    async deleteDesign(id) {
      const { error } = await db.from("saved_designs").delete().eq("id", id);
      fail(error);
    },
    async saveQuote(input, id, _a, cost) {
      checkQuote(input);
      if (cost) checkCost(cost);
      const row = { lines: input.lines.map((l) => ({ label: l.label.trim(), qty: Number(l.qty), unit: Number(l.unit) })), deposit_pct: input.depositPct, valid_until: input.validUntil || null, notes: input.notes, discount_kind: input.discountKind || null, discount_value: input.discountKind ? input.discountValue : 0 };
      const q = id ? db.from("project_quotes").update(row).eq("id", id) : db.from("project_quotes").insert({ ...row, project_id: input.projectId });
      const { data, error } = await q.select().single();
      fail(error);
      const out = quoteFromRow(data as Row);
      if (cost) {
        const { error: e2 } = await db.from("quote_costs").upsert({ quote_id: out.id, extra_cost: cost.extraCost, lines: cost.lines.map((l) => ({ unit_cost: Number(l.unitCost) || 0, item_id: l.itemId || null, per_unit: l.perUnit ?? null })) });
        fail(e2);
      }
      return out;
    },
    async addCost(input) {
      const { error } = await db.from("project_costs").insert({ project_id: input.projectId, kind: input.kind, amount: input.amount, note: input.note.trim() });
      fail(error);
    },
    async deleteCost(id) {
      const { error, count } = await db.from("project_costs").delete({ count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("projects.manage");
    },
    async deleteQuote(id) {
      const { error } = await db.from("project_quotes").delete().eq("id", id);
      fail(error);
    },
    async sendQuote(id) {
      const { error } = await db.rpc("send_quote", { p_id: id });
      fail(error);
    },
    async decideQuote(id, decision, note) {
      const { error } = await db.rpc("decide_quote", { p_id: id, p_decision: decision, p_note: note });
      fail(error);
    },
    async saveContract(input, id) {
      const code = contractProblem(input);
      if (code) throw new ValidationError(code);
      const row = { project_id: input.projectId, quote_id: input.quoteId, title: input.title.trim(), company: input.company, client: input.client, sections: input.sections, specs: input.specs.map((x) => ({ ...x, qty: Number(x.qty) })) };
      const res = id ? await db.from("project_contracts").update(row).eq("id", id).select("*").maybeSingle() : await db.from("project_contracts").insert(row).select("*").maybeSingle();
      fail(res.error);
      if (!res.data) throw new PermissionError("projects.manage");
      return contractFromRow(res.data as Row);
    },
    async deleteContract(id) {
      const { error, count } = await db.from("project_contracts").delete({ count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new ValidationError("contract_locked");
    },
    async sendContract(id) {
      const { error } = await db.rpc("send_contract", { p_id: id });
      fail(error);
    },
    async reopenContract(id) {
      const { error } = await db.rpc("reopen_contract", { p_id: id });
      fail(error);
    },
    async contractChanges(id, note) {
      const { error } = await db.rpc("contract_changes", { p_id: id, p_note: note });
      fail(error);
    },
    async signContract(id, side, signature, name, hash) {
      const { data, error } = await db.rpc("sign_contract", { p_id: id, p_side: side, p_signature: signature, p_name: name, p_hash: hash });
      fail(error);
      return data as ContractStatus;
    },
    async voidContract(id) {
      const { error } = await db.rpc("void_contract", { p_id: id });
      fail(error);
    },
    async markQuotePaid(id, method, ref, amount) {
      const { error } = await db.rpc("mark_quote_paid", { p_id: id, p_method: method, p_ref: ref, p_amount: amount });
      fail(error);
    },
    async claimBriefs(a) {
      if (a.role !== "client") return [];
      // الخادم يطابق البريد المؤكَّد للجلسة نفسها؛ المتصفح لا يحدد ما يُطالَب به
      const { data, error } = await db.rpc("claim_briefs");
      fail(error);
      return ((data as string[] | null) ?? []).map(String);
    },
  };
}

export const projectsRepo: ProjectsRepo = supabase ? remoteRepo() : localRepo;
