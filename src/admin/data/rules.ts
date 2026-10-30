import { can, canGrant, type Role } from "@/lib/rbac";
import type { Actor, ContactPatch, Lead, TeamMember } from "./types";
import { PermissionError } from "./types";

// قواعد الوصول على مستوى البيانات — تطابق سياسات RLS في supabase/schema.sql.
// المستودع التجريبي يطبّقها حرفياً، فيتصرف كما ستتصرف قاعدة البيانات الحقيقية.

export function assertCan(actor: Actor, perm: Parameters<typeof can>[1]) {
  if (!can(actor.role, perm)) throw new PermissionError(perm);
}

export function assertContactPatch(actor: Actor, patch: ContactPatch) {
  assertCan(actor, "crm.edit");
  if ("ownerId" in patch) assertCan(actor, "crm.assign");
}

export function assertLeadPatch(actor: Actor, patch: Partial<Pick<Lead, "status" | "assigneeId">>) {
  assertCan(actor, "crm.edit");
  if ("assigneeId" in patch) assertCan(actor, "crm.assign");
}

/** تغيير دور عضو: لا أحد يغيّر دوره بنفسه، والمالك فقط يمنح/يسحب دور المالك، ولا يبقى الفريق بلا مالك */
export function assertRoleChange(actor: Actor, target: TeamMember, next: Role, team: TeamMember[]) {
  if (actor.id === target.id) throw new PermissionError("team.self");
  if (!canGrant(actor.role, next)) throw new PermissionError("team.manage");
  if (target.role === "owner" && actor.role !== "owner") throw new PermissionError("team.owner");
  if (target.role === "owner" && next !== "owner" && team.filter((m) => m.role === "owner" && m.active).length <= 1) {
    throw new PermissionError("team.last_owner");
  }
}

export function assertActiveChange(actor: Actor, target: TeamMember, team: TeamMember[]) {
  if (actor.id === target.id) throw new PermissionError("team.self");
  assertCan(actor, "team.manage");
  if (target.role === "owner" && actor.role !== "owner") throw new PermissionError("team.owner");
  if (target.role === "owner" && target.active && team.filter((m) => m.role === "owner" && m.active).length <= 1) {
    throw new PermissionError("team.last_owner");
  }
}

/** المهام: من يملك crm.edit يدير كل المهام، وغيره يدير مهامه فقط */
export function canTouchTask(actor: Actor, assigneeId?: string | null) {
  return can(actor.role, "crm.edit") || assigneeId === actor.id;
}
