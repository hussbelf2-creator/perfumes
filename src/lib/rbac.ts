import type { Bi } from "@/i18n/context";

// الأدوار والصلاحيات — المصدر الوحيد للواجهة.
// نفس المصفوفة مكررة في supabase/schema.sql (جدول role_permissions) وهي الحماية الفعلية.

export const ROLES = ["owner", "admin", "sales", "designer", "production", "editor", "client"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ROLES.filter((r) => r !== "client") as Exclude<Role, "client">[];

export const PERMISSIONS = [
  "crm.view",
  "crm.edit",
  "crm.assign",
  "payments.view",
  "projects.view",
  "projects.manage",
  "content.edit",
  "studio.manage",
  "team.view",
  "team.manage",
  "audit.view",
  "pricing.manage",
  "inventory.view",
  "inventory.manage",
  "contracts.sign",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  sales: ["crm.view", "crm.edit", "payments.view", "projects.view", "projects.manage", "team.view", "inventory.view"],
  // المصمم يرى المشاريع المسندة إليه فقط (لا صلاحية عرض عامة)
  designer: ["studio.manage", "team.view"],
  production: ["crm.view", "projects.view", "team.view", "inventory.view", "inventory.manage"],
  editor: ["content.edit", "team.view"],
  client: [],
};

export const ROLE_LABELS: Record<Role, Bi> = {
  owner: { ar: "مالك المنصة", en: "Owner" },
  admin: { ar: "مدير", en: "Admin" },
  sales: { ar: "مبيعات", en: "Sales" },
  designer: { ar: "مصمم", en: "Designer" },
  production: { ar: "إنتاج", en: "Production" },
  editor: { ar: "محرر محتوى", en: "Content editor" },
  client: { ar: "عميل", en: "Client" },
};

export const ROLE_HINTS: Record<Role, Bi> = {
  owner: { ar: "كل الصلاحيات، ويمنح دور المالك", en: "Everything, including granting owner" },
  admin: { ar: "كل الصلاحيات عدا منح دور المالك", en: "Everything except granting owner" },
  sales: { ar: "العملاء والطلبات والمدفوعات", en: "Clients, requests and payments" },
  designer: { ar: "المشاريع المسندة إليه والاستوديو", en: "Assigned projects and studio" },
  production: { ar: "متابعة المشاريع والمخزون للتجهيز والشحن", en: "Projects and stock for fulfilment" },
  editor: { ar: "محتوى الموقع", en: "Website content" },
  client: { ar: "لوحة العميل فقط", en: "Client account only" },
};

export const PERMISSION_LABELS: Record<Permission, Bi> = {
  "crm.view": { ar: "عرض العملاء والطلبات", en: "View clients & requests" },
  "crm.edit": { ar: "تعديل العملاء والمراحل والملاحظات", en: "Edit clients, stages & notes" },
  "crm.assign": { ar: "إسناد العملاء للفريق", en: "Assign clients to staff" },
  "payments.view": { ar: "عرض المدفوعات", en: "View payments" },
  "projects.view": { ar: "عرض كل المشاريع", en: "View all projects" },
  "projects.manage": { ar: "إنشاء المشاريع ورفع التصاميم للاعتماد", en: "Create projects & send designs for approval" },
  "content.edit": { ar: "تعديل محتوى الموقع", en: "Edit website content" },
  "studio.manage": { ar: "إدارة الاستوديو والأعمال", en: "Manage studio & works" },
  "team.view": { ar: "عرض الفريق", en: "View team" },
  "team.manage": { ar: "إدارة الفريق والأدوار", en: "Manage team & roles" },
  "audit.view": { ar: "سجل التدقيق", en: "Audit log" },
  "pricing.manage": { ar: "الأسعار والخصومات والكوبونات", en: "Prices, discounts & coupons" },
  "inventory.view": { ar: "عرض المخزون", en: "View stock" },
  "inventory.manage": { ar: "إدارة المخزون (استلام، صرف، جرد)", en: "Manage stock (receive, issue, count)" },
  "contracts.sign": { ar: "التوقيع على العقود باسم المنشأة", en: "Sign contracts on behalf of the company" },
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
export const isStaff = (role?: Role | null) => !!role && role !== "client";
export const can = (role: Role | null | undefined, perm: Permission) => !!role && ROLE_PERMISSIONS[role].includes(perm);

/** من يستطيع منح دور معيّن: المالك فقط يمنح "مالك"، ولا أحد يغيّر دوره بنفسه */
export function canGrant(actor: Role | null | undefined, target: Role) {
  if (!can(actor, "team.manage")) return false;
  return target !== "owner" || actor === "owner";
}
