import type { Bi } from "@/i18n/context";

export type PackKind = "bottle" | "cap";
/** المقطع العرضي: دائري، أو مربع بزوايا ناعمة، أو بيضاوي */
export type Section = "round" | "square" | "oval";

/** نقطة في المقطع الجانبي: [نصف القطر، الارتفاع] بالمليمتر، من القاعدة للأعلى */
export type ProfilePoint = [number, number];

export interface PackModel {
  id: string;
  kind: PackKind;
  name: Bi;
  capacityMl?: number | null;
  heightMm: number;
  /** للعبوة: طول العنق الذي يغطيه الغطاء */
  neckMm: number;
  profile: ProfilePoint[];
  section: Section;
  /** العمق ÷ العرض (1 = متساوٍ) */
  depthRatio: number;
  /** أُس المقطع الفائق: 2 دائري، وكلما زاد اقترب من المربع */
  squareness: number;
  thumb?: string | null;
  /** profile: مولَّد من المقطع (قابل للتخصيص) · ai: ملف GLB من الذكاء الاصطناعي (يُعرض كما هو) */
  source?: "profile" | "ai";
  /** رابط https، أو idb:<مفتاح> في الوضع التجريبي */
  glbUrl?: string | null;
  usdzUrl?: string | null;
  published: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export type NewPackModel = Omit<PackModel, "id" | "createdAt" | "updatedAt">;
