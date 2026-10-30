// مواصفات التصنيع في الاستوديو: ما يحتاجه المصنع فعلاً ليصنّع ما يراه العميل على الشاشة.
// - العبوة: آلية الغطاء، نوع المضخة، زخرفة الزجاج (كلها لا تغيّر المجسم بل تُرفق بالمواصفة والسعر)
// - العلبة: ملاءمة ذكية مع العبوة (النوع المناسب للحجم، وهل المقاس يحتضنها)، وملحقات التغليف
//   (بطاقة شكر، بطاقة المكوّنات، حشوة، شريط…) التي تُحسب في سعر العلبة وتصل المصنع ضمن الطلب.
import type { Bi } from "@/i18n/context";
import type { LabelDesign } from "./label/types";
import type { PackModel } from "./types";
import { LIMITS, THICKNESS, fitFor, type BoxDesign, type BoxStyle } from "./box/types";

// ─── خيارات العبوة ────────────────────────────────────────────────
export type CapMechanism = "screw" | "snap" | "magnetic" | "crimp";
export type Pump = "standard" | "fine" | "collar" | "rollon" | "dropper" | "none";
export type Decoration = "none" | "frost" | "coat" | "screen" | "uv" | "hotfoil" | "laser";

export interface BottleSpec {
  cap: CapMechanism;
  pump: Pump;
  deco: Decoration;
}

export const CAP_MECHANISMS: { id: CapMechanism; name: Bi; note: Bi; perUnit: number }[] = [
  { id: "screw", name: { ar: "غطاء لولبي", en: "Screw cap" }, note: { ar: "القياسي — يناسب كل الأعناق", en: "Standard — fits every neck" }, perUnit: 0 },
  { id: "snap", name: { ar: "غطاء ضغط", en: "Snap-on cap" }, note: { ar: "يُثبَّت بضغطة على طوق المضخة", en: "Presses onto the pump collar" }, perUnit: 0.6 },
  { id: "magnetic", name: { ar: "غطاء مغناطيسي", en: "Magnetic cap" }, note: { ar: "يلتقط العنق بمغناطيس — إحساس فاخر عند الفتح", en: "Snaps to the neck with a magnet — a premium feel" }, perUnit: 2.4 },
  { id: "crimp", name: { ar: "غطاء على طوق كريمب", en: "Cap over crimp collar" }, note: { ar: "مضخة مكبوسة بطوق معدني — لا تُفك ولا تتسرب", en: "Crimped pump with a metal collar — tamper-proof, leak-proof" }, perUnit: 1.1 },
];

export const PUMPS: { id: Pump; name: Bi; note: Bi; perUnit: number }[] = [
  { id: "standard", name: { ar: "مضخة رذاذ قياسية", en: "Standard spray pump" }, note: { ar: "لولبية، تُفك لإعادة التعبئة", en: "Screw-on, refillable" }, perUnit: 0 },
  { id: "fine", name: { ar: "رذاذ ناعم (Fine mist)", en: "Fine-mist pump" }, note: { ar: "غيمة أنعم وأغنى — للعطور الفاخرة", en: "A finer, richer cloud — for prestige scents" }, perUnit: 0.9 },
  { id: "collar", name: { ar: "مضخة بطوق معدني", en: "Pump with metal collar" }, note: { ar: "طوق ذهبي أو فضي ظاهر حول العنق", en: "A visible gold or silver collar at the neck" }, perUnit: 1.4 },
  { id: "rollon", name: { ar: "رول أون", en: "Roll-on" }, note: { ar: "كرة معدنية أو زجاجية — للزيوت 6 – 12 مل", en: "Metal or glass ball — for 6 – 12 ml oils" }, perUnit: 0.5 },
  { id: "dropper", name: { ar: "قطّارة", en: "Dropper" }, note: { ar: "للزيوت المركّزة والعود", en: "For concentrated oils and oud" }, perUnit: 0.8 },
  { id: "none", name: { ar: "بدون مضخة (سدادة)", en: "No pump (stopper)" }, note: { ar: "سدادة زجاجية أو فلين — للعطور التراثية", en: "Glass or cork stopper — heritage style" }, perUnit: 0.3 },
];

export const DECORATIONS: { id: Decoration; name: Bi; note: Bi; perUnit: number; setup: number }[] = [
  { id: "none", name: { ar: "بدون زخرفة", en: "No decoration" }, note: { ar: "الزجاج كما هو والملصق يحمل الهوية", en: "Plain glass; the label carries the identity" }, perUnit: 0, setup: 0 },
  { id: "frost", name: { ar: "تخشين (فروستد)", en: "Frosting" }, note: { ar: "حمض يطفئ لمعة الزجاج كلّه", en: "Acid-etched matte over the whole bottle" }, perUnit: 0.9, setup: 0 },
  { id: "coat", name: { ar: "طلاء لوني", en: "Colour coating" }, note: { ar: "رش لون كامل أو متدرج على الزجاج", en: "Full or gradient spray colour on the glass" }, perUnit: 1.3, setup: 350 },
  { id: "screen", name: { ar: "طباعة حريرية", en: "Screen printing" }, note: { ar: "لون أو لونان مباشرة على الزجاج بدل الملصق", en: "One or two colours printed on the glass instead of a label" }, perUnit: 0.7, setup: 600 },
  { id: "uv", name: { ar: "طباعة UV رقمية", en: "Digital UV print" }, note: { ar: "ألوان كاملة وتدرجات على الزجاج — بلا قوالب", en: "Full colour and gradients on glass — no plates" }, perUnit: 1.6, setup: 0 },
  { id: "hotfoil", name: { ar: "فويل حراري على الزجاج", en: "Hot foil on glass" }, note: { ar: "شعار ذهبي أو فضي معدني", en: "A metallic gold or silver mark" }, perUnit: 1.1, setup: 450 },
  { id: "laser", name: { ar: "نقش ليزر", en: "Laser engraving" }, note: { ar: "حفر دائم — للأسماء والإصدارات المحدودة", en: "Permanent etching — names and limited editions" }, perUnit: 2.2, setup: 0 },
];

export const DEFAULT_BOTTLE_SPEC: BottleSpec = { cap: "screw", pump: "standard", deco: "none" };

const oneOf = <T extends string>(list: { id: T }[], v: string | null | undefined, d: T): T => (list.some((x) => x.id === v) ? (v as T) : d);
/** من معاملات الرابط (cm, pm, dc) */
export function parseBottleSpec(get: (k: string) => string | null): BottleSpec {
  return { cap: oneOf(CAP_MECHANISMS, get("cm"), "screw"), pump: oneOf(PUMPS, get("pm"), "standard"), deco: oneOf(DECORATIONS, get("dc"), "none") };
}
export const capById = (id: CapMechanism) => CAP_MECHANISMS.find((x) => x.id === id)!;
export const pumpById = (id: Pump) => PUMPS.find((x) => x.id === id)!;
export const decoById = (id: Decoration) => DECORATIONS.find((x) => x.id === id)!;

/** الإضافة لكل عبوة فوق سعر الزجاجة والغطاء القياسيين */
export const bottleSpecExtra = (s: BottleSpec) => capById(s.cap).perUnit + pumpById(s.pump).perUnit + decoById(s.deco).perUnit;

/** سطور المواصفة للملخص والطلب */
export function bottleSpecLines(s: BottleSpec, pick: (b: Bi) => string): string[] {
  const out: string[] = [];
  if (s.cap !== "screw") out.push(pick(capById(s.cap).name));
  if (s.pump !== "standard") out.push(pick(pumpById(s.pump).name));
  if (s.deco !== "none") out.push(pick(decoById(s.deco).name));
  return out;
}

// ─── ملحقات التغليف ───────────────────────────────────────────────
export type ExtraId = "thanks" | "ingredients" | "authenticity" | "tissue" | "ribbon" | "insert_eva" | "insert_pulp" | "insert_satin" | "seal" | "shrink" | "shipper";
export type ExtraGroup = "cards" | "insert" | "wrap" | "protect";

export const EXTRAS: { id: ExtraId; group: ExtraGroup; name: Bi; note: Bi; perUnit: number; icon: string }[] = [
  { id: "thanks", group: "cards", name: { ar: "بطاقة شكر", en: "Thank-you card" }, note: { ar: "بطاقة مطبوعة باسم الدار ورسالة قصيرة", en: "A printed card with the brand and a short message" }, perUnit: 0.45, icon: "ri-heart-3-line" },
  { id: "ingredients", group: "cards", name: { ar: "بطاقة المكوّنات (INCI)", en: "Ingredients card (INCI)" }, note: { ar: "قائمة المكوّنات والمسببات للحساسية — مطلوبة نظامياً في أغلب الأسواق إن لم تُطبع على العلبة", en: "Ingredients and allergens — required in most markets unless printed on the box" }, perUnit: 0.4, icon: "ri-file-list-3-line" },
  { id: "authenticity", group: "cards", name: { ar: "بطاقة أصالة ورقم تسلسلي", en: "Authenticity card & serial" }, note: { ar: "رقم فريد وكود QR للتحقق", en: "A unique number and QR for verification" }, perUnit: 0.6, icon: "ri-shield-check-line" },
  { id: "insert_eva", group: "insert", name: { ar: "حشوة إسفنج EVA", en: "EVA foam insert" }, note: { ar: "تجويف بشكل الزجاجة — الأكثر حماية", en: "A cavity cut to the bottle — the most protective" }, perUnit: 1.8, icon: "ri-stack-line" },
  { id: "insert_pulp", group: "insert", name: { ar: "حشوة ورق مقولب", en: "Moulded pulp insert" }, note: { ar: "قابلة لإعادة التدوير وبلون طبيعي", en: "Recyclable, natural colour" }, perUnit: 1.2, icon: "ri-leaf-line" },
  { id: "insert_satin", group: "insert", name: { ar: "بطانة ساتان", en: "Satin lining" }, note: { ar: "قماش مشدود فوق الحشوة — للعلب الصلبة", en: "Fabric stretched over the insert — rigid boxes" }, perUnit: 2.6, icon: "ri-t-shirt-line" },
  { id: "tissue", group: "wrap", name: { ar: "ورق حرير مطبوع", en: "Printed tissue paper" }, note: { ar: "يلفّ الزجاجة داخل العلبة", en: "Wraps the bottle inside the box" }, perUnit: 0.35, icon: "ri-file-paper-2-line" },
  { id: "ribbon", group: "wrap", name: { ar: "شريط ساتان", en: "Satin ribbon" }, note: { ar: "ربطة حول العلبة أو مقبض للدرج", en: "A bow around the box or a drawer pull" }, perUnit: 0.5, icon: "ri-gift-line" },
  { id: "seal", group: "protect", name: { ar: "ملصق ختم (ضمان الفتح الأول)", en: "Tamper seal sticker" }, note: { ar: "يُقطع عند أول فتح", en: "Breaks on first opening" }, perUnit: 0.15, icon: "ri-sticky-note-line" },
  { id: "shrink", group: "protect", name: { ar: "تغليف سيلوفان حراري", en: "Cellophane shrink wrap" }, note: { ar: "غلاف شفاف بشريط نزع — مطلوب في بعض المتاجر", en: "Clear film with a tear strip — required by some retailers" }, perUnit: 0.4, icon: "ri-checkbox-blank-line" },
  { id: "shipper", group: "protect", name: { ar: "كرتون شحن خارجي (12 علبة)", en: "Outer shipping carton (12 units)" }, note: { ar: "كرتون مموج مطبوع بالباركود للشحن والتخزين", en: "Corrugated, barcoded, for shipping and storage" }, perUnit: 0.55, icon: "ri-truck-line" },
];
export const EXTRA_GROUPS: { id: ExtraGroup; name: Bi }[] = [
  { id: "cards", name: { ar: "بطاقات داخل العلبة", en: "Cards inside the box" } },
  { id: "insert", name: { ar: "الحشوة", en: "Insert" } },
  { id: "wrap", name: { ar: "اللمسة", en: "Finishing touch" } },
  { id: "protect", name: { ar: "الحماية والشحن", en: "Protection & shipping" } },
];
export const extraById = (id: string) => EXTRAS.find((x) => x.id === id);
export const DEFAULT_EXTRA_RATES: Record<ExtraId, number> = Object.fromEntries(EXTRAS.map((x) => [x.id, x.perUnit])) as Record<ExtraId, number>;
/** قائمة ملحقات نظيفة من أي مصدر (رابط، تخزين، طلب وارد) */
export const cleanExtras = (v: unknown): ExtraId[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is ExtraId => typeof x === "string" && !!extraById(x)))] : []);
/** حشوة واحدة فقط: اختيار حشوة يستبدل الأخرى */
export function toggleExtra(list: ExtraId[], id: ExtraId): ExtraId[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  const ex = extraById(id)!;
  return [...list.filter((x) => ex.group !== "insert" || extraById(x)!.group !== "insert"), id];
}

// ─── الملاءمة الذكية بين العلبة والعبوة ───────────────────────────
export interface Fit {
  w: number;
  d: number;
  h: number;
}

/** النوع المناسب لحجم العبوة: الصغير يوفّر، والكبير يستحق علبة صلبة */
export function recommendStyle(fit: Fit, capacityMl?: number | null): { style: BoxStyle; reason: Bi } {
  const ml = capacityMl ?? 0;
  if (ml > 0 && ml <= 15) return { style: "tube", reason: { ar: "حجم عيّنة أو سفر: الأسطوانة الورقية أخف وأوفر وتحمي الزجاجة الصغيرة", en: "Sample or travel size: a paper tube is light, economical and protective" } };
  if (fit.h <= 95 || (ml > 0 && ml <= 30)) return { style: "tuck", reason: { ar: "عبوة صغيرة: علبة بلسان توفّر الكرتون والتجميع دون أن تبدو رخيصة مع تشطيب جيد", en: "A small bottle: a tuck-end box saves board and assembly, and still looks refined with a good finish" } };
  if (ml >= 100 || fit.h >= 135) return { style: "magnetic", reason: { ar: "عبوة كبيرة: العلبة المغناطيسية تحمل الوزن وتعطي تجربة فتح فاخرة تليق بالحجم", en: "A large bottle: a magnetic box carries the weight and opens like a luxury piece" } };
  return { style: "rigid", reason: { ar: "حجم المتجر الأشهر (50 مل): العلبة الصلبة توازن بين الفخامة والتكلفة", en: "The most common retail size (50 ml): a rigid box balances premium feel and cost" } };
}

export type FitLevel = "ok" | "tight" | "loose" | "snug";
export interface FitStatus {
  level: FitLevel;
  /** الفراغ حول العبوة بكل اتجاه (مم) — سالب يعني لا تدخل */
  clearance: { w: number; d: number; h: number };
  message: Bi;
}

/** هل المقاس الداخلي يحتضن العبوة؟ ضيّق لا يُصنَّع، وواسع يحتاج حشوة */
export function fitStatus(d: BoxDesign, fit: Fit): FitStatus {
  // الدرج يستلقي فيه المنتج (الطول = ارتفاع العبوة)، والأسطوانة قطرها يحتضن أكبر بُعد
  const need = d.style === "drawer" ? { w: fit.h, d: fit.w, h: fit.d } : d.style === "tube" ? { w: Math.max(fit.w, fit.d), d: Math.max(fit.w, fit.d), h: fit.h } : { w: fit.w, d: fit.d, h: fit.h };
  const clearance = { w: d.L - need.w, d: (d.style === "tube" ? d.L : d.W) - need.d, h: d.H - need.h };
  const min = Math.min(clearance.w, clearance.d, clearance.h);
  const max = Math.max(clearance.w, clearance.d, clearance.h);
  if (min < 1) return { level: "tight", clearance, message: { ar: "العبوة لا تدخل في هذا المقاس — ضيّق بمقدار", en: "The bottle won't fit this size — short by" } };
  if (min < 2.5) return { level: "snug", clearance, message: { ar: "ملاصق جداً: قد يخدش الزجاج أو يعلق الغطاء. أضف 2 – 3 مم", en: "Very snug: may scratch the glass or jam the lid. Add 2 – 3 mm" } };
  if (max > 24) return { level: "loose", clearance, message: { ar: "فراغ كبير: تتحرك الزجاجة في الشحن — تحتاج حشوة أو مقاساً أصغر", en: "Too much room: the bottle will move in transit — add an insert or shrink the size" } };
  return { level: "ok", clearance, message: { ar: "المقاس يحتضن العبوة بهامش مناسب", en: "The size holds the bottle with the right margin" } };
}

/** المقاس الموصى به مع هامش يناسب النوع (كما يُنتج فعلاً) */
export const smartFit = (style: BoxStyle, fit: Fit) => fitFor(style, fit);

/** الملحقات الموصى بها لهذا التصميم والسوق */
export function recommendedExtras(d: BoxDesign, fit: Fit | null, exporting: boolean): { id: ExtraId; why: Bi }[] {
  const out: { id: ExtraId; why: Bi }[] = [];
  const status = fit ? fitStatus(d, fit) : null;
  if (d.style === "rigid" || d.style === "magnetic") out.push({ id: "insert_eva", why: { ar: "العلب الصلبة تُباع بحشوة تثبّت الزجاجة في مكانها", en: "Rigid boxes ship with an insert that holds the bottle in place" } });
  else if (status?.level === "loose") out.push({ id: "insert_pulp", why: { ar: "الفراغ حول العبوة يحتاج حشوة حتى لا تتحرك", en: "The space around the bottle needs an insert" } });
  out.push({ id: "ingredients", why: exporting ? { ar: "التصدير يتطلب قائمة المكوّنات (INCI) ومسببات الحساسية مع المنتج", en: "Export markets require an INCI list and allergens with the product" } : { ar: "هيئة الغذاء والدواء تطلب قائمة المكوّنات على العبوة أو معها", en: "The SFDA requires an ingredients list on or with the pack" } });
  if (exporting) out.push({ id: "shipper", why: { ar: "الشحن الدولي يحتاج كرتوناً خارجياً بالباركود", en: "International shipping needs a barcoded outer carton" } });
  if (d.style !== "tuck") out.push({ id: "thanks", why: { ar: "لمسة صغيرة ترفع تجربة الفتح وتُشارك على السوشال", en: "A small touch that lifts the unboxing and gets shared" } });
  return out;
}

/** تكلفة الملحقات لكل علبة (من أسعار المحتوى إن وُجدت) */
export function extrasPerUnit(extras: ExtraId[] | undefined, rates: Partial<Record<ExtraId, number>> = DEFAULT_EXTRA_RATES): number {
  return (extras ?? []).reduce((s, id) => s + (rates[id] ?? DEFAULT_EXTRA_RATES[id] ?? 0), 0);
}

// ─── جاهزية الملصق للتصنيع والتسجيل ──────────────────────────────
export interface LabelCheck {
  id: "brand" | "name" | "volume" | "conc" | "fit";
  ok: boolean;
  text: Bi;
}

/** ما يجب أن يحمله الملصق قبل الطباعة والتسجيل (الحجم بالمل إلزامي، والتركيز معتاد) */
export function labelChecklist(label: LabelDesign | null, bottle: PackModel | null): LabelCheck[] {
  if (!label?.enabled) return [];
  const txt = (id: "brand" | "name" | "details") => label.texts.find((x) => x.id === id)?.text.trim() ?? "";
  const all = label.texts.map((x) => x.text).join(" ");
  const ml = /(\d+)\s*(ml|مل)/i.exec(all);
  const volumeOk = !!ml && (!bottle?.capacityMl || Number(ml[1]) === bottle.capacityMl);
  return [
    { id: "brand", ok: txt("brand").length > 0, text: { ar: "اسم الدار", en: "Brand name" } },
    { id: "name", ok: txt("name").length > 0, text: { ar: "اسم العطر", en: "Fragrance name" } },
    { id: "volume", ok: volumeOk, text: ml && !volumeOk ? { ar: `الحجم على الملصق (${ml[1]} مل) لا يطابق العبوة (${bottle?.capacityMl} مل)`, en: `Label volume (${ml[1]} ml) doesn't match the bottle (${bottle?.capacityMl} ml)` } : { ar: "الحجم بالمل (إلزامي نظامياً)", en: "Volume in ml (legally required)" } },
    { id: "conc", ok: /(edp|edt|parfum|extrait|cologne|بارفان|تواليت|إكستريه|كولونيا|زيت|oil)/i.test(all), text: { ar: "التركيز (EDP، EDT، إكستريه…)", en: "Concentration (EDP, EDT, extrait…)" } },
    { id: "fit", ok: !!bottle && label.widthMm <= Math.max(...bottle.profile.map((p) => p[0])) * 2 * Math.PI * 0.9 + 1, text: { ar: "عرض الملصق يناسب محيط العبوة", en: "Label width suits the bottle circumference" } },
  ];
}

export const clampDim = (n: number) => Math.min(LIMITS.max, Math.max(LIMITS.min, Math.round(n)));
export const wallOf = (style: BoxStyle) => THICKNESS[style];
