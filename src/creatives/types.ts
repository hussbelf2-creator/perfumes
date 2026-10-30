import type { Bi } from "@/i18n/context";

// استوديو المبدعين: المصممون وأعمالهم المعروضة في الموقع

export const SPECIALTIES = ["identity", "label", "packaging", "bottle", "3d", "photo"] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const SPECIALTY_LABELS: Record<Specialty, Bi> = {
  identity: { ar: "هوية بصرية", en: "Brand identity" },
  label: { ar: "تصميم ملصقات", en: "Label design" },
  packaging: { ar: "تغليف وعلب", en: "Packaging" },
  bottle: { ar: "تصميم عبوات", en: "Bottle design" },
  "3d": { ar: "تصيير ثلاثي الأبعاد", en: "3D rendering" },
  photo: { ar: "تصوير منتجات", en: "Product photography" },
};

export const SPECIALTY_ICONS: Record<Specialty, string> = {
  identity: "ri-quill-pen-line",
  label: "ri-price-tag-3-line",
  packaging: "ri-box-3-line",
  bottle: "ri-flask-line",
  "3d": "ri-shapes-line",
  photo: "ri-camera-lens-line",
};

export interface Creative {
  id: string;
  /** رابط الملف الشخصي /creatives/:slug */
  slug: string;
  name: Bi;
  /** المسمى: «مصممة هوية بصرية» */
  title: Bi;
  bio: Bi;
  city: Bi;
  specialties: Specialty[];
  yearsExp: number;
  /** يبدأ من (ر.س) — اختياري */
  rateFrom?: number | null;
  /** مدة التسليم المعتادة بالأيام */
  turnaroundDays?: number | null;
  /** صورة شخصية: https أو idb:<مفتاح> في الوضع التجريبي */
  avatar?: string | null;
  available: boolean;
  featured: boolean;
  published: boolean;
  /** ملف توضيحي (ليس مصمماً حقيقياً) — يظهر للزائر بشارة واضحة */
  sample: boolean;
  /** حساب الفريق المرتبط (دور مصمم) — اختياري */
  profileId?: string | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface Work {
  id: string;
  creativeId: string;
  title: Bi;
  summary: Bi;
  category: Specialty;
  /** الصور: الأولى هي الغلاف */
  images: string[];
  /** اسم العميل/البراند — يُترك فارغاً لمشروع تصوّري */
  client?: string | null;
  /** مشروع تصوّري (ليس عملاً منفذاً لعميل) */
  concept: boolean;
  year: number;
  published: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export type NewCreative = Omit<Creative, "id" | "createdAt" | "updatedAt">;
export type NewWork = Omit<Work, "id" | "createdAt" | "updatedAt">;

export const BUDGETS: { id: string; label: Bi }[] = [
  { id: "lt5", label: { ar: "أقل من 5,000 ر.س", en: "Under SAR 5,000" } },
  { id: "5-15", label: { ar: "5,000 – 15,000 ر.س", en: "SAR 5,000 – 15,000" } },
  { id: "15-40", label: { ar: "15,000 – 40,000 ر.س", en: "SAR 15,000 – 40,000" } },
  { id: "gt40", label: { ar: "أكثر من 40,000 ر.س", en: "Over SAR 40,000" } },
  { id: "unsure", label: { ar: "لم أحدد بعد", en: "Not sure yet" } },
];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);

export const isSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 48;
