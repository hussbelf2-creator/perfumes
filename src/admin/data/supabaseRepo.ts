import type { SupabaseClient } from "@supabase/supabase-js";
import { isRole } from "@/lib/rbac";
import type { Activity, AuditEntry, Contact, CrmRepo, Lead, Payment, Task, TeamMember } from "./types";
import { NotFoundError, PermissionError } from "./types";

// مستودع الإنتاج: كل قيد صلاحية يُفرض في قاعدة البيانات (RLS + مُشغّلات).
// النشاطات الآلية وسجل التدقيق تكتبها المُشغّلات، فلا نكتبها من هنا.

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const LIMIT = 2000;

function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  const m = /permission_denied:([\w.]+)/.exec(error.message);
  if (m) throw new PermissionError(m[1]);
  if (error.code === "42501" || /row-level security|cannot_change_own_role|only_owner|last_owner/.test(error.message)) {
    throw new PermissionError(error.message);
  }
  throw new Error(error.message);
}

const toTeam = (r: Row): TeamMember => ({
  id: String(r.id),
  firstName: String(r.first_name ?? ""),
  lastName: String(r.last_name ?? ""),
  email: String(r.email ?? ""),
  role: isRole(r.role) ? r.role : "client",
  active: r.active !== false,
  createdAt: String(r.created_at),
});

const toContact = (r: Row): Contact => ({
  id: String(r.id),
  name: String(r.name),
  email: str(r.email),
  phone: str(r.phone),
  city: str(r.city),
  country: str(r.country),
  company: str(r.company),
  source: r.source as Contact["source"],
  stage: r.stage as Contact["stage"],
  value: Number(r.value ?? 0),
  ownerId: str(r.owner_id),
  tags: (r.tags as string[]) ?? [],
  createdAt: String(r.created_at),
  lastActivityAt: String(r.last_activity_at),
});

const toLead = (r: Row): Lead => ({
  id: String(r.id),
  kind: r.kind as Lead["kind"],
  payload: Object.fromEntries(Object.entries((r.payload as Row) ?? {}).map(([k, v]) => [k, String(v ?? "")])),
  page: str(r.page),
  createdAt: String(r.created_at),
  contactId: str(r.contact_id),
  status: r.status as Lead["status"],
  assigneeId: str(r.assignee_id),
  projectId: str(r.project_id),
});

const toActivity = (r: Row): Activity => ({
  id: String(r.id),
  contactId: String(r.contact_id),
  type: r.type as Activity["type"],
  body: String(r.body ?? ""),
  actorId: str(r.actor_id),
  createdAt: String(r.created_at),
});

const toTask = (r: Row): Task => ({
  id: String(r.id),
  contactId: str(r.contact_id),
  title: String(r.title),
  dueAt: String(r.due_at),
  done: Boolean(r.done),
  assigneeId: str(r.assignee_id),
  createdBy: str(r.created_by),
  createdAt: String(r.created_at),
});

const toPayment = (r: Row): Payment => ({
  id: String(r.id),
  orderRef: str(r.order_ref),
  kind: str(r.kind),
  amount: Number(r.amount),
  currency: String(r.currency ?? "SAR"),
  status: String(r.status),
  method: str(r.method),
  email: str(r.email),
  createdAt: String(r.created_at),
});

const toAudit = (r: Row): AuditEntry => ({
  id: String(r.id),
  actorId: str(r.actor_id),
  action: String(r.action),
  entity: String(r.entity),
  entityId: str(r.entity_id),
  detail: str(r.detail),
  createdAt: String(r.created_at),
});

export function createSupabaseRepo(db: SupabaseClient): CrmRepo {
  const list = async <T,>(table: string, map: (r: Row) => T, order = "created_at") => {
    // RLS تعيد فقط ما يسمح به دور المستخدم؛ الجداول غير المسموحة تعود فارغة
    let q = db.from(table).select("*");
    // الفريق فقط — ملفات العملاء ليست جزءاً من إدارة الفريق
    if (table === "profiles") q = q.neq("role", "client");
    const { data, error } = await q.order(order, { ascending: false }).limit(LIMIT);
    fail(error);
    return (data ?? []).map(map);
  };

  return {
    mode: "supabase",

    async load() {
      const [team, contacts, leads, activities, tasks, payments, audit] = await Promise.all([
        list("profiles", toTeam),
        list("contacts", toContact, "last_activity_at"),
        list("leads", toLead),
        list("activities", toActivity),
        list("tasks", toTask, "due_at"),
        list("payments", toPayment),
        list("audit_log", toAudit),
      ]);
      return { team, contacts, leads, activities, tasks, payments, audit };
    },

    async createContact(input) {
      const { data, error } = await db
        .from("contacts")
        .insert({
          name: input.name.trim(),
          email: input.email?.trim().toLowerCase() || null,
          phone: input.phone?.trim() || null,
          city: input.city || null,
          country: input.country || null,
          company: input.company || null,
          value: input.value ?? 0,
          owner_id: input.ownerId ?? null,
        })
        .select()
        .single();
      fail(error);
      return toContact(data as Row);
    },

    async updateContact(id, patch) {
      const row: Row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.email !== undefined) row.email = patch.email;
      if (patch.phone !== undefined) row.phone = patch.phone;
      if (patch.city !== undefined) row.city = patch.city;
      if (patch.country !== undefined) row.country = patch.country;
      if (patch.company !== undefined) row.company = patch.company;
      if (patch.stage !== undefined) row.stage = patch.stage;
      if (patch.value !== undefined) row.value = patch.value;
      if ("ownerId" in patch) row.owner_id = patch.ownerId ?? null;
      if (patch.tags !== undefined) row.tags = patch.tags;
      const { error, count } = await db.from("contacts").update(row, { count: "exact" }).eq("id", id);
      fail(error);
      // RLS لا ترفع خطأ عند المنع، بل لا تطابق أي صف
      if (count === 0) throw new PermissionError("crm.edit");
    },

    async updateLead(id, patch) {
      const row: Row = {};
      if (patch.status) row.status = patch.status;
      if ("assigneeId" in patch) row.assignee_id = patch.assigneeId ?? null;
      const { error, count } = await db.from("leads").update(row, { count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("crm.edit");
    },

    async addActivity(input, actor) {
      const { error } = await db.from("activities").insert({ contact_id: input.contactId, type: input.type, body: input.body.trim(), actor_id: actor.id });
      fail(error);
    },

    async addTask(input, actor) {
      const { error } = await db.from("tasks").insert({
        title: input.title.trim(),
        due_at: input.dueAt,
        contact_id: input.contactId ?? null,
        assignee_id: input.assigneeId ?? actor.id,
        created_by: actor.id,
      });
      fail(error);
    },

    async setTaskDone(id, done) {
      const { error, count } = await db.from("tasks").update({ done }, { count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("crm.edit");
    },

    async setRole(memberId, role) {
      const { error, count } = await db.from("profiles").update({ role }, { count: "exact" }).eq("id", memberId);
      fail(error);
      if (count === 0) throw new PermissionError("team.manage");
    },

    async setActive(memberId, active) {
      const { error, count } = await db.from("profiles").update({ active }, { count: "exact" }).eq("id", memberId);
      fail(error);
      if (count === 0) throw new PermissionError("team.manage");
    },

    async addMember(email, role) {
      // الحساب يُنشأ بالتسجيل في الموقع (عميل افتراضياً)، ثم يُمنح الدور هنا
      const { error, count } = await db.from("profiles").update({ role }, { count: "exact" }).eq("email", email.trim().toLowerCase());
      fail(error);
      if (count === 0) throw new NotFoundError(email);
    },
  };
}
