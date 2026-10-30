import { can } from "@/lib/rbac";
import { buildSeed } from "./seed";
import { assertActiveChange, assertCan, assertContactPatch, assertLeadPatch, assertRoleChange, canTouchTask } from "./rules";
import type { Activity, Actor, AuditEntry, Contact, CrmRepo, CrmSnapshot, LeadKind, Source } from "./types";
import { NotFoundError, PermissionError, STAGE_LABELS } from "./types";
import { canGrant } from "@/lib/rbac";

// مستودع الوضع التجريبي: البيانات في localStorage لهذا المتصفح فقط

const KEY = "pp_crm_v1";

function read(): CrmSnapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CrmSnapshot;
  } catch {
    /* تالفة أو غير متاحة — نعيد البذر */
  }
  const seed = buildSeed();
  write(seed);
  return seed;
}

function write(s: CrmSnapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* التخزين ممتلئ أو محظور — تبقى التغييرات للجلسة الحالية */
  }
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const now = () => new Date().toISOString();

function audit(s: CrmSnapshot, actor: Actor, action: string, entity: string, entityId: string, detail?: string) {
  const e: AuditEntry = { id: uid("AU"), actorId: actor.id, action, entity, entityId, detail: detail ?? null, createdAt: now() };
  s.audit.unshift(e);
}

function activity(s: CrmSnapshot, a: Omit<Activity, "id" | "createdAt">) {
  s.activities.unshift({ ...a, id: uid("A"), createdAt: now() });
  const c = s.contacts.find((x) => x.id === a.contactId);
  if (c) c.lastActivityAt = now();
}

export function resetDemoCrm() {
  write(buildSeed());
}

/** طلب وارد من نماذج الموقع (في Supabase يقوم بهذا مُشغّل قاعدة البيانات) */
export function ingestDemoLead(kind: LeadKind, payload: Record<string, string>, page?: string) {
  const s = read();
  const email = (payload.email || "").trim().toLowerCase();
  const phone = (payload.phone || "").replace(/\s+/g, "");
  let c = s.contacts.find((x) => (email && x.email?.toLowerCase() === email) || (phone && x.phone?.replace(/\s+/g, "") === phone));
  const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() || email || phone || "—";
  if (!c) {
    c = {
      id: uid("C"),
      name,
      email: email || null,
      phone: phone || null,
      city: payload.city || null,
      country: /^[A-Z]{2}$/.test(payload.country || payload.phone_country || "") ? payload.country || payload.phone_country : null,
      company: null,
      source: kind as Source,
      stage: "new",
      value: kind === "kit" ? 750 : 0,
      ownerId: null,
      tags: [],
      createdAt: now(),
      lastActivityAt: now(),
    };
    s.contacts.unshift(c);
  }
  s.leads.unshift({ id: uid("L"), kind, payload, page: page ?? null, createdAt: now(), contactId: c.id, status: "new", assigneeId: c.ownerId ?? null });
  activity(s, { contactId: c.id, type: "request", body: "طلب وارد من الموقع", actorId: null });
  write(s);
}

/** طلبات «ابدأ مسارك» بهذا البريد التي لم تتحول لمشروع بعد (الوضع التجريبي؛ في Supabase: claim_briefs) */
export function pendingDemoBriefs(email: string) {
  const e = email.trim().toLowerCase();
  return read().leads.filter((l) => l.kind === "brief" && !l.projectId && (l.payload.email || "").toLowerCase() === e);
}
export function markDemoBrief(leadId: string, projectId: string) {
  const s = read();
  s.leads = s.leads.map((l) => (l.id === leadId ? { ...l, projectId } : l));
  write(s);
}

export const localRepo: CrmRepo = {
  mode: "demo",

  async load(actor) {
    const s = read();
    const crm = can(actor.role, "crm.view");
    const self = s.team.find((m) => m.id === actor.id);
    if (self && !self.active) throw new PermissionError("account.inactive");
    return {
      team: can(actor.role, "team.view") ? s.team : s.team.filter((m) => m.id === actor.id),
      contacts: crm ? s.contacts : [],
      leads: crm ? s.leads : [],
      activities: crm ? s.activities : [],
      tasks: crm ? s.tasks : s.tasks.filter((t) => t.assigneeId === actor.id),
      payments: can(actor.role, "payments.view") ? s.payments : [],
      audit: can(actor.role, "audit.view") ? s.audit : [],
    };
  },

  async createContact(input, actor) {
    assertCan(actor, "crm.edit");
    if (input.ownerId) assertCan(actor, "crm.assign");
    const s = read();
    const c: Contact = {
      id: uid("C"),
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      city: input.city || null,
      country: input.country || null,
      company: input.company || null,
      source: "manual",
      stage: "new",
      value: input.value ?? 0,
      ownerId: input.ownerId ?? null,
      tags: [],
      createdAt: now(),
      lastActivityAt: now(),
    };
    s.contacts.unshift(c);
    activity(s, { contactId: c.id, type: "note", body: "أُضيف العميل يدوياً", actorId: actor.id });
    audit(s, actor, "crm.create", "contact", c.id, c.name);
    write(s);
    return c;
  },

  async updateContact(id, patch, actor) {
    assertContactPatch(actor, patch);
    const s = read();
    const c = s.contacts.find((x) => x.id === id);
    if (!c) return;
    if (patch.stage && patch.stage !== c.stage) {
      activity(s, { contactId: id, type: "stage", body: `${c.stage} → ${patch.stage}`, actorId: actor.id });
      audit(s, actor, "crm.stage", "contact", id, `${c.stage} → ${patch.stage}`);
    }
    if ("ownerId" in patch && patch.ownerId !== c.ownerId) {
      const m = s.team.find((x) => x.id === patch.ownerId);
      activity(s, { contactId: id, type: "assign", body: m ? `أُسند إلى ${m.firstName} ${m.lastName}` : "أُلغي الإسناد", actorId: actor.id });
      audit(s, actor, "crm.assign", "contact", id, `→ ${patch.ownerId ?? "—"}`);
      // الطلبات المفتوحة تتبع مسؤول العميل
      s.leads.forEach((l) => l.contactId === id && l.status !== "done" && l.status !== "archived" && (l.assigneeId = patch.ownerId ?? null));
    }
    if (typeof patch.value === "number" && patch.value !== c.value) {
      activity(s, { contactId: id, type: "value", body: `${c.value} → ${patch.value}`, actorId: actor.id });
    }
    Object.assign(c, patch, { lastActivityAt: now() });
    write(s);
  },

  async updateLead(id, patch, actor) {
    assertLeadPatch(actor, patch);
    const s = read();
    const l = s.leads.find((x) => x.id === id);
    if (!l) return;
    if (patch.status && patch.status !== l.status) audit(s, actor, "crm.lead_status", "lead", id, `${l.status} → ${patch.status}`);
    if ("assigneeId" in patch && patch.assigneeId !== l.assigneeId) audit(s, actor, "crm.assign", "lead", id, `→ ${patch.assigneeId ?? "—"}`);
    Object.assign(l, patch);
    write(s);
  },

  async addActivity(input, actor) {
    assertCan(actor, "crm.edit");
    const s = read();
    activity(s, { ...input, body: input.body.trim(), actorId: actor.id });
    write(s);
  },

  async addTask(input, actor) {
    const assigneeId = input.assigneeId ?? actor.id;
    if (!canTouchTask(actor, assigneeId)) throw new PermissionError("crm.edit");
    const s = read();
    s.tasks.unshift({ id: uid("T"), contactId: input.contactId ?? null, title: input.title.trim(), dueAt: input.dueAt, done: false, assigneeId, createdBy: actor.id, createdAt: now() });
    write(s);
  },

  async setTaskDone(id, done, actor) {
    const s = read();
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    if (!canTouchTask(actor, t.assigneeId)) throw new PermissionError("crm.edit");
    t.done = done;
    write(s);
  },

  async setRole(memberId, role, actor) {
    const s = read();
    const m = s.team.find((x) => x.id === memberId);
    if (!m) return;
    assertRoleChange(actor, m, role, s.team);
    audit(s, actor, "team.role", "profile", memberId, `${m.role} → ${role}`);
    m.role = role;
    write(s);
  },

  async setActive(memberId, active, actor) {
    const s = read();
    const m = s.team.find((x) => x.id === memberId);
    if (!m) return;
    assertActiveChange(actor, m, s.team);
    audit(s, actor, active ? "team.activate" : "team.deactivate", "profile", memberId);
    m.active = active;
    write(s);
  },

  async addMember(rawEmail, role, actor) {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new NotFoundError("email");
    if (!canGrant(actor.role, role)) throw new PermissionError("team.manage");
    const s = read();
    const existing = s.team.find((m) => m.email === email);
    if (existing) {
      assertRoleChange(actor, existing, role, s.team);
      audit(s, actor, "team.role", "profile", existing.id, `${existing.role} → ${role}`);
      existing.role = role;
    } else {
      const id = uid("USR");
      const local = email.split("@")[0];
      s.team.push({ id, firstName: local, lastName: "", email, role, active: true, createdAt: now() });
      audit(s, actor, "team.role", "profile", id, `client → ${role}`);
    }
    write(s);
  },
};
