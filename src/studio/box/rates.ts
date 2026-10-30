import type { BoxStyle } from "./types";
import { DEFAULT_EXTRA_RATES } from "../spec";

// أسعار العلب — ملف خفيف بلا تبعيات (يستورده نظام المحتوى في الحزمة الرئيسية)

export interface BoxRates {
  /** سعر الخامة لكل م² من الفرخ (ريال) لكل نوع */
  boardPerM2: Record<BoxStyle, number>;
  /** هدر القص والتجهيز فوق مساحة الفرخ (1.18 = 18%) */
  waste: number;
  /** طباعة لكل م²: لون كامل (أسود/مخصص) أو نص فقط على كرتون فاتح */
  printFloodPerM2: number;
  printLightPerM2: number;
  /** تشطيب لكل م² */
  finishPerM2: { matte: number; soft: number; gloss: number };
  /** فويل لكل علبة (ضربة واحدة) */
  foilPerUnit: number;
  /** تجميع ولصق لكل علبة حسب النوع (يشمل المغناطيس للمغناطيسية) */
  assemblyPerUnit: Record<BoxStyle, number>;
  /** قالب القص: لكل مم من خطوط القص والتكسير، بحد أدنى */
  diePerMm: number;
  dieMin: number;
  /** ألواح الطباعة والتجهيز لكل طلب */
  platesSetup: number;
  /** كليشة الفويل */
  foilBlock: number;
  /** الحد الأدنى للطلب لكل نوع */
  moq: Record<BoxStyle, number>;
  /** ملحقات التغليف لكل علبة (بطاقة شكر، حشوة…) بمعرّفات studio/spec.ts؛ الناقص يأخذ الافتراضي */
  extrasPerUnit?: Record<string, number>;
}

// أسعار مبدئية للتخطيط (ريال، السوق السعودي) — تُعاير على عروض موردي الكرتون والمطابع قبل الاعتماد
export const DEFAULT_BOX_RATES: BoxRates = {
  boardPerM2: { tuck: 3.5, drawer: 4.5, rigid: 16, magnetic: 16, tube: 12 },
  waste: 1.18,
  printFloodPerM2: 2.5,
  printLightPerM2: 0.8,
  finishPerM2: { matte: 1.2, soft: 2.6, gloss: 0.9 },
  foilPerUnit: 0.35,
  assemblyPerUnit: { tuck: 0.25, drawer: 1.6, rigid: 4.2, magnetic: 5.5, tube: 2.8 },
  diePerMm: 0.08,
  dieMin: 450,
  platesSetup: 450,
  foilBlock: 300,
  moq: { tuck: 500, drawer: 300, rigid: 300, magnetic: 300, tube: 300 },
  extrasPerUnit: { ...DEFAULT_EXTRA_RATES },
};

