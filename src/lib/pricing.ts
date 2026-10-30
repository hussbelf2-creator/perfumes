// نموذج التكلفة — نفس أرقام ومعادلات الحاسبة الأصلية، في مكان واحد
import type { Bi } from "@/i18n/context";

export interface CostItem {
  key: string;
  label: Bi;
  icon: string;
  perUnit: number;
  optional?: boolean;
}

export const COST_ITEMS: CostItem[] = [
  { key: "bottle", label: { ar: "الزجاجة والغطاء", en: "Bottle & cap" }, icon: "ri-flask-line", perUnit: 22 },
  { key: "formula", label: { ar: "التركيبة العطرية", en: "Fragrance oil" }, icon: "ri-drop-line", perUnit: 18 },
  { key: "box", label: { ar: "العلبة والتغليف", en: "Box & packing" }, icon: "ri-gift-2-line", perUnit: 8 },
  { key: "filling", label: { ar: "التعبئة والتشغيل", en: "Filling & operations" }, icon: "ri-settings-3-line", perUnit: 6 },
  { key: "design", label: { ar: "التصميم (موزّع)", en: "Design (amortised)" }, icon: "ri-palette-line", perUnit: 5 },
  { key: "print", label: { ar: "الطباعة والملصق", en: "Print & label" }, icon: "ri-printer-line", perUnit: 4 },
  { key: "shipping", label: { ar: "الشحن والتوصيل", en: "Shipping & delivery" }, icon: "ri-truck-line", perUnit: 3, optional: true },
];

export const VOLUME_TIERS = [
  { qty: 500, discount: 0 },
  { qty: 1000, discount: 8 },
  { qty: 2500, discount: 15 },
  { qty: 5000, discount: 22 },
  { qty: 10000, discount: 30 },
];

export const SPEEDS: { id: "standard" | "express" | "urgent"; label: Bi; time: Bi; multiplier: number }[] = [
  { id: "standard", label: { ar: "قياسي", en: "Standard" }, time: { ar: "8 – 10 أسابيع", en: "8 – 10 weeks" }, multiplier: 1 },
  { id: "express", label: { ar: "سريع", en: "Express" }, time: { ar: "6 – 8 أسابيع", en: "6 – 8 weeks" }, multiplier: 1.2 },
  { id: "urgent", label: { ar: "عاجل", en: "Urgent" }, time: { ar: "4 – 6 أسابيع", en: "4 – 6 weeks" }, multiplier: 1.5 },
];

export const SAMPLE_COST = 500;
export const DESIGN_ROUND_COST = 2000;
export const RETAIL_MULTIPLIER = 3.5;

/** أرقام الحاسبة القابلة للتعديل من «محتوى الموقع ← الأسعار» (الافتراضي = الثوابت أعلاه) */
export interface CalcConfig {
  /** تكلفة الوحدة لكل عنصر (ر.س) */
  items: Record<string, number>;
  tiers: { qty: number; discount: number }[];
  speeds: Record<(typeof SPEEDS)[number]["id"], number>;
  sample: number;
  designRound: number;
  retail: number;
}
export const DEFAULT_CALC: CalcConfig = {
  items: Object.fromEntries(COST_ITEMS.map((i) => [i.key, i.perUnit])),
  tiers: VOLUME_TIERS.map((t) => ({ ...t })),
  speeds: Object.fromEntries(SPEEDS.map((s) => [s.id, s.multiplier])) as CalcConfig["speeds"],
  sample: SAMPLE_COST,
  designRound: DESIGN_ROUND_COST,
  retail: RETAIL_MULTIPLIER,
};

export function discountFor(qty: number, tiers: CalcConfig["tiers"] = VOLUME_TIERS) {
  return tiers.filter((t) => qty >= t.qty).pop()?.discount ?? 0;
}

export function estimate({
  qty,
  speed = "standard",
  shipping = false,
  samples = 3,
  designRounds = 2,
  box,
  cfg = DEFAULT_CALC,
}: {
  qty: number;
  speed?: (typeof SPEEDS)[number]["id"];
  shipping?: boolean;
  samples?: number;
  designRounds?: number;
  /** علبة مصممة في الاستوديو: تكلفتها المتغيرة تحل محل تقدير العلبة العام، وتجهيزها يُضاف مرة واحدة */
  box?: { perUnit: number; setup: number } | null;
  cfg?: CalcConfig;
}) {
  const items = COST_ITEMS.filter((i) => !i.optional || (i.key === "shipping" && shipping)).map((i) => ({ ...i, perUnit: i.key === "box" && box ? Math.round(box.perUnit * 100) / 100 : (cfg.items[i.key] ?? i.perUnit) }));
  const base = items.reduce((s, i) => s + i.perUnit, 0);
  const mult = cfg.speeds[speed] ?? 1;
  const discount = discountFor(qty, cfg.tiers);
  const unit = base * mult * (1 - discount / 100);
  const production = unit * qty;
  const sampling = samples * cfg.sample;
  const design = designRounds * cfg.designRound;
  const boxSetup = box?.setup ?? 0;
  const total = production + sampling + design + boxSetup;
  const retail = unit * cfg.retail;
  const margin = retail > 0 ? (retail - unit) / retail : 0;
  return { items, base, mult, discount, unit, production, sampling, design, boxSetup, total, retail, margin };
}
