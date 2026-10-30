// أسئلة «ابدأ مسارك»: لكل خدمة ما يحتاجه الفريق ليعود بعرض واضح من أول اتصال — اختيارات لا كتابة.
// الإجابات تُحفظ برموزها (a_<سؤال>) في الطلب الوارد، وتُعرض بنصوصها من هنا في الإدارة ولوحة العميل.
import type { Bi } from "../i18n/context";
import { SERVICE_TRACKS, type ServiceTrack } from "../data/services";
import { bespokeLines } from "../bespoke/compose";
import { WORK_LINK, workspaceOf } from "./workspaces";
import { SPEEDS } from "../lib/pricing";
import { bottleSpecLines, cleanExtras, extraById } from "../studio/spec";

export interface BriefOption {
  id: string;
  label: Bi;
}
export interface BriefQuestion {
  id: string;
  label: Bi;
  options: BriefOption[];
  /** أكثر من اختيار */
  multi?: boolean;
}
type TrackId = ServiceTrack["id"];

const o = (id: string, ar: string, en: string): BriefOption => ({ id, label: { ar, en } });
const NOT_SURE = o("unsure", "لم أحدد بعد", "Not sure yet");

const QTY: BriefQuestion = {
  id: "qty",
  label: { ar: "كم عبوة في أول دفعة؟", en: "How many units in the first batch?" },
  options: [o("lt300", "أقل من 300", "Under 300"), o("300_1000", "300 – 1,000", "300 – 1,000"), o("1000_5000", "1,000 – 5,000", "1,000 – 5,000"), o("gt5000", "أكثر من 5,000", "Over 5,000"), NOT_SURE],
};
const TIMING: BriefQuestion = {
  id: "timing",
  label: { ar: "متى تريد الإطلاق أو الاستلام؟", en: "When do you want to launch or receive it?" },
  options: [o("1m", "خلال شهر", "Within a month"), o("3m", "1 – 3 أشهر", "1 – 3 months"), o("6m", "3 – 6 أشهر", "3 – 6 months"), o("flex", "مرن", "Flexible")],
};

const SPECIFIC: Record<TrackId, BriefQuestion[]> = {
  A: [
    { id: "stage", label: { ar: "أين وصلت فكرتك؟", en: "Where is your idea now?" }, options: [o("idea", "فكرة فقط", "Just an idea"), o("name", "عندي اسم البراند", "I have the brand name"), o("identity", "عندي هوية وأحتاج المنتج", "I have an identity, need the product")] },
    { id: "audience", label: { ar: "لمن العطر؟", en: "Who is it for?" }, options: [o("men", "رجالي", "Men"), o("women", "نسائي", "Women"), o("unisex", "للجنسين", "Unisex")] },
  ],
  B: [
    { id: "goal", label: { ar: "ما الذي تحتاجه؟", en: "What do you need?" }, options: [o("new", "تركيبة جديدة", "A new formula"), o("improve", "تحسين عطر قائم", "Improve an existing scent"), o("line", "خط من عدة عطور", "A line of several scents")] },
    { id: "family", label: { ar: "العائلة العطرية (اختر ما يناسب)", en: "Scent family (pick any)" }, multi: true, options: [o("oud", "عود", "Oud"), o("musk", "مسك", "Musk"), o("floral", "زهري", "Floral"), o("amber", "عنبري وشرقي", "Amber & oriental"), o("fresh", "حمضي ومنعش", "Citrus & fresh"), NOT_SURE] },
  ],
  C: [
    { id: "need", label: { ar: "ماذا تحتاج؟ (اختر ما يناسب)", en: "What do you need? (pick any)" }, multi: true, options: [o("bottle", "زجاجة", "Bottle"), o("cap", "غطاء", "Cap"), o("box", "علبة", "Box"), o("label", "ملصق", "Label"), o("gift", "طقم هدايا", "Gift set")] },
    { id: "size", label: { ar: "حجم العبوة", en: "Bottle size" }, options: [o("30", "30 مل", "30 ml"), o("50", "50 مل", "50 ml"), o("100", "100 مل", "100 ml"), o("multi", "أكثر من حجم", "Several sizes"), NOT_SURE] },
  ],
  D: [
    { id: "need", label: { ar: "ماذا تحتاج؟", en: "What do you need?" }, options: [o("logo", "شعار فقط", "Logo only"), o("full", "هوية كاملة", "Full identity"), o("refresh", "تطوير هوية قائمة", "Refresh an existing identity")] },
    { id: "deliverables", label: { ar: "ما الذي تريد استلامه؟ (اختر ما يناسب)", en: "What should we deliver? (pick any)" }, multi: true, options: [o("logo", "الشعار وتنويعاته", "Logo & variations"), o("palette", "الألوان والخطوط", "Colours & typography"), o("pack", "تصميم العبوة والعلبة", "Bottle & box design"), o("social", "قوالب السوشال ميديا", "Social media templates"), o("guide", "دليل استخدام الهوية", "Brand guidelines"), NOT_SURE] },
    { id: "naming", label: { ar: "اسم البراند", en: "Brand name" }, options: [o("ready", "جاهز ومحسوم", "Ready and final"), o("options", "عندي خيارات وأحتاج رأياً", "I have options, need advice"), o("need", "أحتاج تسمية من الصفر", "I need naming from scratch")] },
    { id: "style", label: { ar: "الطابع الأقرب لك", en: "Closest style" }, options: [o("classic", "فاخر كلاسيكي", "Classic luxury"), o("minimal", "عصري بسيط", "Modern minimal"), o("bold", "جريء ومختلف", "Bold & different"), o("heritage", "تراثي", "Heritage")] },
    { id: "audience", label: { ar: "لمن البراند؟", en: "Who is the brand for?" }, options: [o("men", "رجالي", "Men"), o("women", "نسائي", "Women"), o("unisex", "للجنسين", "Unisex"), o("gift", "الإهداء والشركات", "Gifting & corporate")] },
  ],
  E: [
    { id: "formula", label: { ar: "هل التركيبة جاهزة؟", en: "Is the formula ready?" }, options: [o("ready", "نعم، جاهزة", "Yes, ready"), o("reference", "عندي عطر مرجعي", "I have a reference scent"), o("develop", "نحتاج تطويرها", "It needs developing")] },
    { id: "packaging", label: { ar: "هل العبوات جاهزة؟", en: "Is the packaging ready?" }, options: [o("yes", "نعم", "Yes"), o("partly", "جزئياً", "Partly"), o("no", "لا", "No")] },
  ],
  F: [
    { id: "items", label: { ar: "ماذا تريد طباعته؟ (اختر ما يناسب)", en: "What do you want printed? (pick any)" }, multi: true, options: [o("labels", "ملصقات", "Labels"), o("boxes", "علب", "Boxes"), o("cards", "بطاقات وكتيبات", "Cards & leaflets"), o("bags", "أكياس", "Bags"), o("gift", "تغليف هدايا", "Gift wrapping")] },
    { id: "files", label: { ar: "ملفات التصميم", en: "Design files" }, options: [o("ready", "جاهزة للطباعة", "Print-ready"), o("prep", "تحتاج تجهيزاً", "Need preparing"), o("design", "نحتاج تصميماً", "We need a design")] },
  ],
};

const NEEDS_QTY: TrackId[] = ["A", "C", "E", "F"];

/** الباقات تأتي من بيانات الخدمة نفسها، فيبقى العرض والسؤال متطابقين */
function packageQuestion(t: ServiceTrack): BriefQuestion {
  return {
    id: "package",
    label: { ar: "الباقة الأقرب لك", en: "The closest package" },
    options: [...t.packages.map((p, i) => ({ id: String(i), label: p.name })), NOT_SURE],
  };
}

export function briefQuestions(track: ServiceTrack): BriefQuestion[] {
  return [...SPECIFIC[track.id], ...(NEEDS_QTY.includes(track.id) ? [QTY] : []), TIMING, packageQuestion(track)];
}

export type Answers = Record<string, string[]>;

/** يعرض إجابة مخزّنة (رموز مفصولة بفواصل) بنصها */
export function answerText(trackId: string | null | undefined, qid: string, raw: string, pick: (b: Bi) => string): { q: string; a: string } | null {
  const track = SERVICE_TRACKS.find((s) => s.id === trackId);
  if (!track) return null;
  const q = briefQuestions(track).find((x) => x.id === qid);
  if (!q) return null;
  const a = raw
    .split(",")
    .map((id) => q.options.find((x) => x.id === id))
    .filter((x): x is BriefOption => !!x)
    .map((x) => pick(x.label))
    .join("، ");
  return a ? { q: pick(q.label), a } : null;
}

/** ملخص الطلب كأسطر سؤال/جواب، بالترتيب المعروض للعميل */
export function briefLines(payload: Record<string, unknown> | null | undefined, pick: (b: Bi) => string, t: (ar: string, en: string) => string) {
  if (!payload) return [];
  const p = payload as Record<string, string>;
  // «عطرك الخاص»: تركيبة مكونات لا أسئلة
  if (p.track === "P") return bespokeLines(p, pick, t);
  const track = SERVICE_TRACKS.find((s) => s.id === p.track);
  if (!track) return [];
  const lines: { q: string; a: string }[] = [];
  for (const q of briefQuestions(track)) {
    const v = p[`a_${q.id}`];
    const x = v ? answerText(track.id, q.id, v, pick) : null;
    if (x) lines.push(x);
  }
  if (p.brand) lines.push({ q: t("اسم البراند", "Brand name"), a: p.brand });
  if (p.message) lines.push({ q: t("تفاصيل إضافية", "More details"), a: p.message });
  if (p.ref_link) lines.push({ q: t("مرجع", "Reference"), a: p.ref_link });
  // ما أنجزه في لوحة العمل: ملخصها، وتفاصيلها المقروءة (تركيبة البراند أو أرقام الحاسبة)
  const ws = workspaceOf(track.id);
  if (ws && p.work_summary) lines.push({ q: pick(ws.label), a: p.work_summary });
  if (track.id === "B" && (p.p_top || p.p_heart || p.p_base)) lines.push(...bespokeLines({ p_top: p.p_top, p_heart: p.p_heart, p_base: p.p_base, p_conc: p.p_conc, p_size: p.p_size, p_purpose: p.p_purpose, p_name: p.p_name }, pick, t));
  if ((track.id === "C" || track.id === "F") && (p.spec_cap || p.box_extras)) {
    const spec = bottleSpecLines({ cap: (p.spec_cap as never) || "screw", pump: (p.spec_pump as never) || "standard", deco: (p.spec_deco as never) || "none" }, pick);
    if (p.spec_bottle || spec.length) lines.push({ q: t("مواصفة العبوة", "Bottle specification"), a: [p.spec_bottle, ...spec].filter(Boolean).join(" · ") });
    const extras = cleanExtras((p.box_extras ?? "").split(",")).map((x) => pick(extraById(x)!.name));
    if (extras.length) lines.push({ q: t("ملحقات التغليف", "Packaging extras"), a: extras.join("، ") });
  }
  if (track.id === "E" && p.calc_qty) {
    const sp = SPEEDS.find((x) => x.id === p.calc_speed);
    lines.push({ q: t("أرقام الحاسبة", "Calculator figures"), a: [`${Number(p.calc_qty).toLocaleString("en-US")} ${t("زجاجة", "bottles")}`, sp && pick(sp.label), p.calc_unit && `${Number(p.calc_unit).toLocaleString("en-US")} ${t("ر.س للزجاجة", "SAR per bottle")}`, p.calc_total && `${t("الإجمالي التقديري", "estimated total")} ${Number(p.calc_total).toLocaleString("en-US")} ${t("ر.س", "SAR")}`].filter(Boolean).join(" · ") });
  }
  return lines;
}

/** رابط لوحة العمل المرفق بالطلب — داخلي فقط (لا نعرض للفريق رابطاً خارجياً من المتصفح) */
export function workLink(payload: Record<string, unknown> | null | undefined): string | null {
  const l = payload?.work_link;
  return typeof l === "string" && l.length <= 1500 && WORK_LINK.test(l) ? l : null;
}

export const isSaudiMobile = (s: string) => /^(?:\+?966|0)?5\d{8}$/.test(s.replace(/[\s-]/g, ""));
export { phoneOk } from "../lib/phone";
