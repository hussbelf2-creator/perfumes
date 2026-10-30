import type { Bi } from "@/i18n/context";
import type { Role } from "@/lib/rbac";

export const STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const SOURCES = ["brief", "booking", "kit", "design", "contact", "consultation", "newsletter", "manual"] as const;
export type Source = (typeof SOURCES)[number];

export type LeadKind = Exclude<Source, "manual">;
export const LEAD_STATUSES = ["new", "in_progress", "done", "archived"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const ACTIVITY_TYPES = ["note", "call", "email", "whatsapp", "meeting", "stage", "assign", "request", "payment", "value", "project"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  /** الدولة (ISO من حرفين) */
  country?: string | null;
  company?: string | null;
  source: Source;
  stage: Stage;
  /** قيمة الصفقة المتوقعة بالريال */
  value: number;
  ownerId?: string | null;
  tags: string[];
  createdAt: string;
  lastActivityAt: string;
}

export interface Lead {
  id: string;
  kind: LeadKind;
  payload: Record<string, string>;
  page?: string | null;
  createdAt: string;
  contactId?: string | null;
  status: LeadStatus;
  assigneeId?: string | null;
  /** طلب «ابدأ مسارك» تحوّل إلى مشروع بعد دخول صاحبه */
  projectId?: string | null;
}

export interface Activity {
  id: string;
  contactId: string;
  type: ActivityType;
  body: string;
  actorId?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  contactId?: string | null;
  title: string;
  dueAt: string;
  done: boolean;
  assigneeId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderRef?: string | null;
  kind?: string | null;
  /** بالهللة */
  amount: number;
  currency: string;
  status: string;
  method?: string | null;
  email?: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
  createdAt: string;
}

export interface Actor {
  id: string;
  role: Role;
}

export type ContactPatch = Partial<Pick<Contact, "name" | "email" | "phone" | "city" | "country" | "company" | "stage" | "value" | "ownerId" | "tags">>;
export type NewContact = Pick<Contact, "name"> & Partial<Pick<Contact, "email" | "phone" | "city" | "country" | "company" | "value" | "ownerId">>;
export type NewTask = Pick<Task, "title" | "dueAt"> & Partial<Pick<Task, "contactId" | "assigneeId">>;
export type NewActivity = Pick<Activity, "contactId" | "type" | "body">;

export interface CrmSnapshot {
  team: TeamMember[];
  contacts: Contact[];
  leads: Lead[];
  activities: Activity[];
  tasks: Task[];
  payments: Payment[];
  audit: AuditEntry[];
}

export interface CrmRepo {
  readonly mode: "demo" | "supabase";
  /** يحمّل ما تسمح به صلاحيات المستخدم فقط */
  load(actor: Actor): Promise<CrmSnapshot>;
  createContact(input: NewContact, actor: Actor): Promise<Contact>;
  updateContact(id: string, patch: ContactPatch, actor: Actor): Promise<void>;
  updateLead(id: string, patch: Partial<Pick<Lead, "status" | "assigneeId">>, actor: Actor): Promise<void>;
  addActivity(input: NewActivity, actor: Actor): Promise<void>;
  addTask(input: NewTask, actor: Actor): Promise<void>;
  setTaskDone(id: string, done: boolean, actor: Actor): Promise<void>;
  setRole(memberId: string, role: Role, actor: Actor): Promise<void>;
  setActive(memberId: string, active: boolean, actor: Actor): Promise<void>;
  /** منح دور لمستخدم مسجّل بالبريد (في Supabase يجب أن يكون قد أنشأ حساباً أولاً) */
  addMember(email: string, role: Role, actor: Actor): Promise<void>;
}

export class NotFoundError extends Error {}

export class PermissionError extends Error {
  perm: string;
  constructor(perm: string) {
    super(`permission_denied:${perm}`);
    this.perm = perm;
  }
}

/** خطأ تحقق برمز تترجمه الواجهة (validationText) */
export class ValidationError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const STAGE_LABELS: Record<Stage, Bi> = {
  new: { ar: "جديد", en: "New" },
  contacted: { ar: "تم التواصل", en: "Contacted" },
  qualified: { ar: "مؤهَّل", en: "Qualified" },
  proposal: { ar: "عرض سعر", en: "Proposal" },
  won: { ar: "تم التعاقد", en: "Won" },
  lost: { ar: "لم يتم", en: "Lost" },
};

export const SOURCE_LABELS: Record<Source, Bi> = {
  brief: { ar: "بدء مسار", en: "Track start" },
  booking: { ar: "مكالمة اكتشاف", en: "Discovery call" },
  kit: { ar: "عينة الاكتشاف", en: "Discovery kit" },
  design: { ar: "طلب تصميم", en: "Design brief" },
  contact: { ar: "نموذج التواصل", en: "Contact form" },
  consultation: { ar: "طلب استشارة", en: "Consultation" },
  newsletter: { ar: "النشرة", en: "Newsletter" },
  manual: { ar: "إضافة يدوية", en: "Added manually" },
};

export const SOURCE_ICONS: Record<Source, string> = {
  brief: "ri-rocket-2-line",
  booking: "ri-calendar-event-line",
  kit: "ri-flask-line",
  design: "ri-palette-line",
  contact: "ri-mail-line",
  consultation: "ri-chat-3-line",
  newsletter: "ri-newspaper-line",
  manual: "ri-user-add-line",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, Bi> = {
  new: { ar: "جديد", en: "New" },
  in_progress: { ar: "قيد المتابعة", en: "In progress" },
  done: { ar: "منجز", en: "Done" },
  archived: { ar: "مؤرشف", en: "Archived" },
};

export const ACTIVITY_LABELS: Record<ActivityType, Bi> = {
  note: { ar: "ملاحظة", en: "Note" },
  call: { ar: "مكالمة", en: "Call" },
  email: { ar: "بريد", en: "Email" },
  whatsapp: { ar: "واتساب", en: "WhatsApp" },
  meeting: { ar: "اجتماع", en: "Meeting" },
  stage: { ar: "تغيير المرحلة", en: "Stage change" },
  assign: { ar: "إسناد", en: "Assignment" },
  request: { ar: "طلب وارد", en: "Inbound request" },
  payment: { ar: "دفعة", en: "Payment" },
  value: { ar: "تعديل القيمة", en: "Value change" },
  project: { ar: "مشروع", en: "Project" },
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  note: "ri-sticky-note-line",
  call: "ri-phone-line",
  email: "ri-mail-line",
  whatsapp: "ri-whatsapp-line",
  meeting: "ri-team-line",
  stage: "ri-arrow-left-right-line",
  assign: "ri-user-shared-line",
  request: "ri-inbox-archive-line",
  payment: "ri-bank-card-line",
  value: "ri-money-dollar-circle-line",
  project: "ri-folder-3-line",
};
