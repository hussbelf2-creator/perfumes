import type { Bi } from "../i18n/context";

// مشاريع العملاء: مراحل، وتصاميم تُرفع للاعتماد بنسخ متتالية، ونقاش، وتصاميم الاستوديو المحفوظة في الحساب

/** مراحل المشروع العامة (بلا مسار). لكل مسار مراحله في stages.ts */
export const PROJECT_STAGES = ["brief", "design", "sampling", "production", "delivered"] as const;
export type GenericStage = (typeof PROJECT_STAGES)[number];
/** مفتاح مرحلة صالح لمسار المشروع (stagesFor) */
export type ProjectStage = string;
export const PROJECT_STATUSES = ["active", "on_hold", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STAGE_LABELS: Record<GenericStage, Bi> = {
  brief: { ar: "الملخص والاتجاه", en: "Brief & direction" },
  design: { ar: "التصميم", en: "Design" },
  sampling: { ar: "العينات", en: "Sampling" },
  production: { ar: "الإنتاج", en: "Production" },
  delivered: { ar: "التسليم", en: "Delivered" },
};
export const STATUS_LABELS: Record<ProjectStatus, Bi> = {
  active: { ar: "نشط", en: "Active" },
  on_hold: { ar: "متوقف مؤقتاً", en: "On hold" },
  done: { ar: "مكتمل", en: "Completed" },
};

export const ITEM_KINDS = ["identity", "label", "box", "bottle", "sample", "other"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const KIND_LABELS: Record<ItemKind, Bi> = {
  identity: { ar: "هوية", en: "Identity" },
  label: { ar: "ملصق", en: "Label" },
  box: { ar: "علبة", en: "Box" },
  bottle: { ar: "عبوة", en: "Bottle" },
  sample: { ar: "عينة", en: "Sample" },
  other: { ar: "أخرى", en: "Other" },
};
export const KIND_ICONS: Record<ItemKind, string> = {
  identity: "ri-quill-pen-line",
  label: "ri-price-tag-3-line",
  box: "ri-box-3-line",
  bottle: "ri-flask-line",
  sample: "ri-test-tube-line",
  other: "ri-file-line",
};

/**
 * pending   بانتظار اعتماد العميل
 * approved  اعتمده العميل
 * changes   طلب العميل تعديلات
 * superseded حلّت محله نسخة أحدث
 * submitted أرسله العميل للفريق (تصميم من الاستوديو) — لا يحتاج اعتماداً
 */
export const ITEM_STATUSES = ["pending", "approved", "changes", "superseded", "submitted"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const ITEM_STATUS_LABELS: Record<ItemStatus, Bi> = {
  pending: { ar: "بانتظار اعتمادك", en: "Awaiting your approval" },
  approved: { ar: "معتمد", en: "Approved" },
  changes: { ar: "مطلوب تعديل", en: "Changes requested" },
  superseded: { ar: "نسخة سابقة", en: "Earlier version" },
  submitted: { ar: "أرسله العميل", en: "Sent by the client" },
};

export interface Project {
  id: string;
  title: string;
  /** مسار الخدمة A–F (اختياري) */
  track?: string | null;
  contactId?: string | null;
  /** بريد العميل: يُربط بحسابه تلقائياً عند التسجيل أو الدخول */
  clientEmail: string;
  clientId?: string | null;
  designerId?: string | null;
  ownerId?: string | null;
  stage: ProjectStage;
  status: ProjectStatus;
  dueDate?: string | null;
  /** ملخص «ابدأ مسارك» كما أرسله العميل (رموز الإجابات a_*، والاسم والجوال) */
  brief?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  projectId: string;
  /** سلسلة النسخ: معرّف النسخة الأولى (النسخ اللاحقة تشير إليه) */
  threadId: string;
  version: number;
  kind: ItemKind;
  title: string;
  status: ItemStatus;
  /** صور (https، idb:، أو sb: في تخزين خاص) أو ملفات PDF */
  files: string[];
  /** تصميم من استوديو 3D */
  studio?: { link: string; summary: string } | null;
  note: string;
  createdBy: string;
  byClient: boolean;
  createdAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  itemId?: string | null;
  authorId: string;
  authorName: string;
  /** من العميل؟ (لتمييز الفقاعات) */
  fromClient: boolean;
  body: string;
  createdAt: string;
}

export interface SavedDesign {
  id: string;
  ownerId: string;
  name: string;
  /** رابط الاستوديو بإعداداته (مسار داخلي /studio-3d?...) */
  link: string;
  summary: string;
  /** صورة مصغّرة صغيرة (data:image/webp) */
  thumb?: string | null;
  /** تصميم الملصق والعلبة كما هما — لإعادة فتحهما */
  label?: unknown;
  box?: unknown;
  createdAt: string;
  updatedAt: string;
}

// ─── عروض الأسعار ───────────────────────────────────────────────────
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "changes", "paid", "void"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, Bi> = {
  draft: { ar: "مسودة", en: "Draft" },
  sent: { ar: "بانتظار اعتمادك", en: "Awaiting your approval" },
  accepted: { ar: "معتمد — بانتظار العربون", en: "Approved — deposit due" },
  changes: { ar: "طُلب تعديله", en: "Changes requested" },
  paid: { ar: "دُفع العربون", en: "Deposit paid" },
  void: { ar: "مُلغى", en: "Superseded" },
};
export const VAT_RATE = 15;

export interface QuoteLine {
  label: string;
  qty: number;
  unit: number;
}
export interface Quote {
  id: string;
  projectId: string;
  ref: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  vatRate: number;
  depositPct: number;
  /** مجموع البنود قبل الخصم */
  gross: number;
  discountKind?: "pct" | "amount" | null;
  discountValue: number;
  discount: number;
  /** بعد الخصم وقبل الضريبة */
  subtotal: number;
  vat: number;
  total: number;
  deposit: number;
  validUntil?: string | null;
  notes: string;
  createdAt: string;
  sentAt?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  paymentMethod?: "moyasar" | "bank" | "cash" | null;
  paymentRef?: string | null;
}
export type QuoteDraft = Pick<Quote, "projectId" | "lines" | "depositPct" | "validUntil" | "notes" | "discountKind" | "discountValue">;

/** تكلفة داخلية لبنود العرض (لا يراها العميل) — بترتيب البنود نفسه */
export interface QuoteCostLine {
  unitCost: number;
  /** مادة من المخزون تُحجز عند دفع العربون */
  itemId?: string | null;
  /** كم وحدة مخزون لكل وحدة في البند (افتراضياً 1) */
  perUnit?: number | null;
}
export interface QuoteCost {
  quoteId: string;
  lines: QuoteCostLine[];
  extraCost: number;
}

export const COST_KINDS = ["materials", "factory", "design", "shipping", "other"] as const;
export type CostKind = (typeof COST_KINDS)[number];
export const COST_KIND_LABELS: Record<CostKind, Bi> = {
  materials: { ar: "مواد من المخزون", en: "Materials from stock" },
  factory: { ar: "المصنع والتعبئة", en: "Factory & filling" },
  design: { ar: "التصميم", en: "Design" },
  shipping: { ar: "الشحن", en: "Shipping" },
  other: { ar: "أخرى", en: "Other" },
};
/** تكلفة فعلية مسجّلة على المشروع */
export interface ProjectCost {
  id: string;
  projectId: string;
  kind: CostKind;
  amount: number;
  note: string;
  /** من صرف مخزون (لا تُحذف يدوياً) */
  moveId?: string | null;
  createdAt: string;
}

/** بالهللة، بتقريب النصف بعيداً عن الصفر كما يفعل Postgres (مع تصحيح أخطاء الفاصلة العائمة: 2175.075 لا 2175.0749…) */
const halalas = (sar: number) => Math.round(sar * 100 + (sar >= 0 ? 1e-6 : -1e-6));
/** تقريب لخانتين كما يقرّب Postgres round(x, 2) (لا 1.005 → 1.00) */
export const round2 = (sar: number) => halalas(sar) / 100;
export const lineTotal = (l: QuoteLine) => halalas((Number(l.qty) || 0) * (Number(l.unit) || 0)) / 100;
/** المجاميع كما يحسبها الخادم (quote_before): تقريب كل سطر، ثم الخصم، ثم الضريبة، ثم العربون */
export function quoteTotals(lines: QuoteLine[], vatRate = VAT_RATE, depositPct = 50, discountKind: Quote["discountKind"] = null, discountValue = 0) {
  const gross = lines.reduce((s, l) => s + halalas((Number(l.qty) || 0) * (Number(l.unit) || 0)), 0);
  const v = Number(discountValue) || 0;
  const discount = discountKind === "pct" ? halalas((gross * v) / 10000) : discountKind === "amount" ? Math.min(halalas(v), gross) : 0;
  const sub = gross - discount;
  const vat = halalas((sub * vatRate) / 10000);
  const total = sub + vat;
  const deposit = halalas((total * depositPct) / 10000);
  return { gross: gross / 100, discount: discount / 100, subtotal: sub / 100, vat: vat / 100, total: total / 100, deposit: deposit / 100 };
}

/** الهامش المتوقع: الإيراد بعد الخصم وقبل الضريبة − التكلفة الداخلية */
export function quoteMargin(q: Pick<Quote, "lines" | "subtotal">, cost: Pick<QuoteCost, "lines" | "extraCost"> | null | undefined) {
  if (!cost) return null;
  const c = q.lines.reduce((s, l, i) => s + halalas((Number(l.qty) || 0) * (Number(cost.lines[i]?.unitCost) || 0)), 0) / 100 + (Number(cost.extraCost) || 0);
  const profit = Math.round((q.subtotal - c) * 100) / 100;
  return { cost: Math.round(c * 100) / 100, profit, pct: q.subtotal > 0 ? (profit / q.subtotal) * 100 : 0 };
}

export type NewProject = Pick<Project, "title" | "track" | "contactId" | "clientEmail" | "designerId" | "ownerId" | "stage" | "status" | "dueDate">;
export type NewItem = Pick<ProjectItem, "projectId" | "kind" | "title" | "files" | "studio" | "note"> & { threadId?: string | null };

/** الحالات التي تنتظر قراراً من العميل */
export const awaitingClient = (i: ProjectItem) => i.status === "pending";
/** أحدث نسخة من كل سلسلة */
export function latestPerThread(items: ProjectItem[]) {
  const m = new Map<string, ProjectItem>();
  for (const i of items) {
    const cur = m.get(i.threadId);
    if (!cur || i.version > cur.version) m.set(i.threadId, i);
  }
  return [...m.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
