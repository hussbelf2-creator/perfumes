// العقود: يكتبها المصنع (الفريق) مع ملحق مواصفات (أصناف، كميات، صور، ملفات) ويرسلها للعميل.
// بعد الإرسال يُقفل النص ويُبصم (sha256 على الخادم)، ويوقّع كل طرف بصورة توقيعه على البصمة التي رآها.
import type { Bi } from "@/i18n/context";

export const CONTRACT_STATUSES = ["draft", "sent", "changes", "client_signed", "signed", "void"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface ContractParty {
  name: string;
  /** سجل تجاري أو هوية وطنية */
  idLabel: string;
  idNumber: string;
  address: string;
  /** يمثّله في التوقيع */
  representative: string;
}

export interface ContractSection {
  title: string;
  body: string;
}

export interface SpecItem {
  id: string;
  name: string;
  description: string;
  qty: number;
  unit: string;
  /** صور الصنف (مسارات تخزين المشروع) */
  images: string[];
  /** ملفات PDF: مواصفات فنية، رسومات… */
  files: string[];
}

export interface Contract {
  id: string;
  projectId: string;
  quoteId: string | null;
  ref: string;
  status: ContractStatus;
  title: string;
  company: ContractParty;
  client: ContractParty;
  sections: ContractSection[];
  specs: SpecItem[];
  contentHash: string | null;
  sentAt: string | null;
  changeNote: string | null;
  clientSignature: string | null;
  clientSignedName: string | null;
  clientSignedAt: string | null;
  companySignature: string | null;
  companySignedName: string | null;
  companySignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContractDraft = Pick<Contract, "projectId" | "quoteId" | "title" | "company" | "client" | "sections" | "specs">;

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, Bi> = {
  draft: { ar: "مسودة", en: "Draft" },
  sent: { ar: "بانتظار توقيع العميل", en: "Awaiting client signature" },
  changes: { ar: "طلب العميل تعديلاً", en: "Changes requested" },
  client_signed: { ar: "وقّع العميل — بانتظار توقيع المنشأة", en: "Client signed — awaiting company" },
  signed: { ar: "موقّع من الطرفين", en: "Signed by both parties" },
  void: { ar: "ملغى", en: "Void" },
};

export const LIMITS = { title: 160, sections: 40, sectionTitle: 160, sectionBody: 6000, specs: 30, name: 120, description: 1000, unit: 20, images: 8, files: 4, maxQty: 10_000_000 } as const;

/** العقد قابل للتحرير؟ (مسودة، أو طلب العميل تعديله) */
export const editable = (c: Pick<Contract, "status">) => c.status === "draft" || c.status === "changes";

export const blankParty = (): ContractParty => ({ name: "", idLabel: "", idNumber: "", address: "", representative: "" });

/** مجموع الكميات حسب الوحدة (للملخص) */
export function totalsByUnit(specs: SpecItem[]) {
  const m = new Map<string, number>();
  for (const s of specs) m.set(s.unit || "—", (m.get(s.unit || "—") ?? 0) + (Number(s.qty) || 0));
  return [...m.entries()].map(([unit, qty]) => ({ unit, qty }));
}

/** فحص المسودة قبل الحفظ (الخادم يفرض نفس الحدود) */
export function contractProblem(d: ContractDraft): string | null {
  if (!d.title.trim() || d.title.length > LIMITS.title) return "contract_title";
  if (d.sections.length > LIMITS.sections || d.sections.some((s) => s.title.length > LIMITS.sectionTitle || s.body.length > LIMITS.sectionBody)) return "contract_sections";
  if (d.specs.length > LIMITS.specs) return "contract_specs";
  for (const s of d.specs) {
    if (!s.name.trim() || s.name.length > LIMITS.name || s.description.length > LIMITS.description || s.unit.length > LIMITS.unit) return "contract_specs";
    if (!(Number(s.qty) > 0 && Number(s.qty) <= LIMITS.maxQty)) return "contract_qty";
    if (s.images.length > LIMITS.images || s.files.length > LIMITS.files) return "contract_files";
  }
  return null;
}
