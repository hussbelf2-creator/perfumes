import type { Bi } from "@/i18n/context";
import { discountFor, type CalcConfig } from "@/lib/pricing";
import { buildSpec, flatten, segLen } from "./dielines";
import type { BoxDesign } from "./types";
import { DEFAULT_BOX_RATES, type BoxRates } from "./rates";
import { cleanExtras, extraById, extrasPerUnit } from "../spec";

export { DEFAULT_BOX_RATES, type BoxRates };

// تكلفة العلبة من تصميمها الفعلي: مساحة الفرخ من مخطط القص نفسه، وخامة كل نوع، والطباعة والتشطيب
// والفويل والتجميع — متغيرة لكل علبة — ثم تكاليف التجهيز (قالب القص، ألواح الطباعة، كليشة الفويل)
// تُوزَّع على الكمية. الأسعار قرارات تجارية تُعدَّل من «محتوى الموقع» (وثيقة الأسعار).

export interface CostLine {
  key: string;
  label: Bi;
  value: number;
}

export interface BoxEstimate {
  qty: number;
  /** مساحة الفرخ المستهلك م² (مستطيل المخطط × الهدر) */
  sheetM2: number;
  /** طول خطوط القص والتكسير (مم) */
  dieMm: number;
  /** متغيرة لكل علبة قبل خصم الكمية */
  variable: CostLine[];
  variableTotal: number;
  /** تجهيز لمرة واحدة */
  setup: CostLine[];
  setupTotal: number;
  discount: number;
  /** سعر العلبة = المتغيرة بعد الخصم + التجهيز ÷ الكمية */
  unit: number;
  total: number;
  moq: number;
  belowMoq: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimateBox(d: BoxDesign, qty: number, rates: BoxRates = DEFAULT_BOX_RATES, tiers?: CalcConfig["tiers"]): BoxEstimate {
  const flat = flatten(buildSpec(d));
  const { minX, minY, maxX, maxY } = flat.bounds;
  // الفرخ مستطيل (القطع تُرصّ في فرخ واحد) + هامش القص 3 مم من كل جانب، ثم الهدر
  const sheetM2 = (((maxX - minX + 6) * (maxY - minY + 6)) / 1e6) * rates.waste;
  const dieMm = flat.cuts.reduce((s, c) => s + segLen(c), 0) + flat.folds.reduce((s, c) => s + segLen(c), 0);
  // الكرتون الأسود أو الملوّن يحتاج تغطية لونية كاملة؛ الأبيض والكريمي والكرافت يُطبع عليها النص فقط
  const flood = d.board === "black" || d.board === "custom";
  const variable: CostLine[] = [
    { key: "board", label: { ar: "الكرتون والخامة", en: "Board & material" }, value: sheetM2 * rates.boardPerM2[d.style] },
    { key: "print", label: { ar: "الطباعة", en: "Printing" }, value: sheetM2 * (flood ? rates.printFloodPerM2 : rates.printLightPerM2) },
    { key: "finish", label: { ar: "التشطيب", en: "Finish" }, value: sheetM2 * rates.finishPerM2[d.finish] },
    ...(d.foil !== "none" ? [{ key: "foil", label: { ar: "الفويل", en: "Foil stamping" }, value: rates.foilPerUnit }] : []),
    { key: "assembly", label: { ar: "التجميع واللصق", en: "Assembly & gluing" }, value: rates.assemblyPerUnit[d.style] },
    // ملحقات التغليف (بطاقات، حشوة، شريط…) بسعرها لكل علبة
    ...(cleanExtras(d.extras).length
      ? [{ key: "extras", label: { ar: `الملحقات (${cleanExtras(d.extras).map((x) => extraById(x)!.name.ar).join("، ")})`, en: `Extras (${cleanExtras(d.extras).map((x) => extraById(x)!.name.en).join(", ")})` }, value: extrasPerUnit(cleanExtras(d.extras), rates.extrasPerUnit) }]
      : []),
  ].map((l) => ({ ...l, value: round2(l.value) }));
  const setup: CostLine[] = [
    { key: "die", label: { ar: "قالب القص والتكسير", en: "Cutting & creasing die" }, value: Math.max(rates.dieMin, dieMm * rates.diePerMm) },
    { key: "plates", label: { ar: "ألواح الطباعة والتجهيز", en: "Print plates & make-ready" }, value: rates.platesSetup },
    ...(d.foil !== "none" ? [{ key: "foilBlock", label: { ar: "كليشة الفويل", en: "Foil block" }, value: rates.foilBlock }] : []),
  ].map((l) => ({ ...l, value: Math.round(l.value) }));
  const variableTotal = round2(variable.reduce((s, l) => s + l.value, 0));
  const setupTotal = setup.reduce((s, l) => s + l.value, 0);
  const q = Math.max(1, Math.round(qty));
  const discount = discountFor(q, tiers);
  const unit = round2(variableTotal * (1 - discount / 100) + setupTotal / q);
  const moq = rates.moq[d.style];
  return { qty: q, sheetM2, dieMm, variable, variableTotal, setup, setupTotal, discount, unit, total: Math.round(unit * q), moq, belowMoq: q < moq };
}
