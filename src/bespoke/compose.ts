// منطق «عطرك الخاص» بلا واجهة: قراءة التركيبة (التوازن، الطابع، الثبات، التنبيهات) والسعر التقديري،
// وتحويلها إلى طلب وارد (رموز نصية) وإعادتها نصوصاً للفريق والعميل. يُختبر في tests/unit/bespoke.test.ts.
import type { Bi } from "../i18n/context";
import { CONCENTRATIONS, FAMILIES, LAYERS, MAX_PER_LAYER, MODES, NAME_MAX, PURPOSES, noteById, type Concentration, type Family, type Layer, type Mode, type Note, type Purpose } from "./notes";

export interface Composition {
  notes: string[];
  conc: Concentration;
  size: number;
  purpose: Purpose;
  /** الاسم على الزجاجة (اختياري) */
  name: string;
}

export interface BespokeRates {
  /** سعر المل لكل تركيز (ر.س) */
  perMl: Record<Concentration, number>;
  /** الزجاجة والعلبة والنقش */
  bottle: number;
  /** إضافة لكل مكوّن نادر */
  premium: number;
}

export const DEFAULT_BESPOKE: BespokeRates = { perMl: { edp: 14, extrait: 20, oil: 35 }, bottle: 120, premium: 120 };

export const EMPTY: Composition = { notes: [], conc: "edp", size: 50, purpose: "self", name: "" };

const notesOf = (c: Pick<Composition, "notes">) => c.notes.map(noteById).filter((x): x is Note => !!x);
export const inLayer = (c: Pick<Composition, "notes">, layer: Layer) => notesOf(c).filter((x) => x.layer === layer);

/** توليفات يعرفها العطّارون — تظهر للعميل تأكيداً لاختياره */
const PAIRS: [string, string, Bi][] = [
  ["rose_taifi", "oud_cambodi", { ar: "الورد والعود: توليفة الطائف الكلاسيكية", en: "Rose and oud: the classic Taif pairing" }],
  ["rose_taifi", "oud_hindi", { ar: "الورد والعود: توليفة الطائف الكلاسيكية", en: "Rose and oud: the classic Taif pairing" }],
  ["saffron", "oud_cambodi", { ar: "الزعفران يفتح العود ويلمّعه", en: "Saffron opens up and polishes the oud" }],
  ["saffron", "oud_hindi", { ar: "الزعفران يفتح العود ويلمّعه", en: "Saffron opens up and polishes the oud" }],
  ["cardamom", "coffee", { ar: "الهيل والقهوة: رائحة الضيافة", en: "Cardamom and coffee: the scent of hospitality" }],
  ["frankincense", "bakhoor", { ar: "اللبان والبخور: دفء المجلس", en: "Frankincense and bakhoor: the warmth of the majlis" }],
  ["jasmine", "sandalwood", { ar: "الفل والصندل: نعومة كريمية", en: "Jasmine and sandalwood: creamy softness" }],
  ["bergamot", "white_musk", { ar: "البرغموت والمسك الأبيض: نظافة أنيقة", en: "Bergamot and white musk: elegant cleanliness" }],
  ["lavender", "tonka", { ar: "الخزامى والتونكا: دفء هادئ", en: "Lavender and tonka: a calm warmth" }],
  ["iris", "vanilla", { ar: "السوسن والفانيليا: بودرة مخملية", en: "Iris and vanilla: velvety powder" }],
];
/** تضادات صعبة: لا تُمنع، لكن المستشار يحتاج أن يعرف */
const CLASHES: [string, string][] = [
  ["mint", "oud_hindi"],
  ["mint", "leather"],
  ["mint", "bakhoor"],
  ["grapefruit", "bakhoor"],
  ["lemon", "coffee"],
  ["tuberose", "oud_hindi"],
];

export type IssueCode = "need_top" | "need_heart" | "need_base" | "layer_full" | "heavy" | "clash" | "two_ouds" | "name_long";
export interface Issue {
  code: IssueCode;
  /** block يمنع الإرسال؛ warn يُرسَل مع ملاحظة للمستشار */
  level: "block" | "warn";
  text: Bi;
}

export interface Reading {
  ok: boolean;
  issues: Issue[];
  pairs: Bi[];
  /** وزن كل عائلة (مرجّح بالقوة) من 100 */
  character: { family: Family; label: Bi; pct: number }[];
  /** 1 خفيف … 3 قوي */
  intensity: 1 | 2 | 3;
  longevity: Bi;
}

export function analyze(c: Composition): Reading {
  const list = notesOf(c);
  const issues: Issue[] = [];
  const has = (id: string) => c.notes.includes(id);
  for (const l of LAYERS) {
    const k = list.filter((x) => x.layer === l.id).length;
    if (!k) issues.push({ code: `need_${l.id}` as IssueCode, level: "block", text: { ar: `اختر مكوناً واحداً على الأقل في ${l.label.ar}`, en: `Pick at least one ${l.label.en.toLowerCase()} note` } });
    if (k > MAX_PER_LAYER) issues.push({ code: "layer_full", level: "block", text: { ar: `${l.label.ar}: ثلاثة مكونات كحد أقصى`, en: `${l.label.en}: three notes at most` } });
  }
  if (c.name.trim().length > NAME_MAX) issues.push({ code: "name_long", level: "block", text: { ar: `الاسم على الزجاجة ${NAME_MAX} حرفاً كحد أقصى`, en: `The bottle name is ${NAME_MAX} characters at most` } });
  if (list.filter((x) => x.strength === 3).length >= 2)
    issues.push({ code: "heavy", level: "warn", text: { ar: "مكونان طاغيان أو أكثر: قد يغطي أحدهما الآخر — سيوازن المستشار النسب", en: "Two or more dominant notes may drown each other — your consultant will balance the ratios" } });
  if (has("oud_cambodi") && has("oud_hindi"))
    issues.push({ code: "two_ouds", level: "warn", text: { ar: "عودان معاً: جميل لمحبي العود، وثقيل لغيرهم", en: "Two ouds together: lovely for oud lovers, heavy for others" } });
  for (const [a, b] of CLASHES)
    if (has(a) && has(b)) {
      const [x, y] = [noteById(a)!, noteById(b)!];
      issues.push({ code: "clash", level: "warn", text: { ar: `${x.name.ar} مع ${y.name.ar}: تضاد صعب، يحتاج نسباً دقيقة`, en: `${x.name.en} with ${y.name.en}: a tricky contrast that needs precise ratios` } });
    }
  const pairs = [...new Map(PAIRS.filter(([a, b]) => has(a) && has(b)).map(([, , t]) => [t.ar, t])).values()];

  const total = list.reduce((s, x) => s + x.strength, 0) || 1;
  const weights = new Map<Family, number>();
  for (const x of list) weights.set(x.family, (weights.get(x.family) ?? 0) + x.strength);
  const character = [...weights.entries()]
    .map(([family, w]) => ({ family, label: FAMILIES[family], pct: Math.round((w / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const avg = list.length ? total / list.length : 0;
  const intensity = (avg >= 2.2 || c.conc === "oil" ? 3 : avg >= 1.6 || c.conc === "extrait" ? 2 : 1) as 1 | 2 | 3;
  const baseScore = inLayer(c, "base").reduce((s, x) => s + x.strength, 0) + (c.conc === "extrait" ? 1 : c.conc === "oil" ? 2 : 0);
  const longevity: Bi = baseScore >= 6 ? { ar: "طويل جداً (أكثر من 12 ساعة)", en: "Very long (12+ hours)" } : baseScore >= 4 ? { ar: "طويل (8 – 12 ساعة)", en: "Long (8 – 12 hours)" } : { ar: "متوسط (5 – 8 ساعات)", en: "Moderate (5 – 8 hours)" };

  return { ok: !issues.some((i) => i.level === "block"), issues, pairs, character, intensity, longevity };
}

/** يضيف مكوناً أو يزيله، ولا يتجاوز حد الطبقة */
export function toggleNote(c: Composition, id: string): Composition {
  if (c.notes.includes(id)) return { ...c, notes: c.notes.filter((x) => x !== id) };
  const note = noteById(id);
  if (!note || inLayer(c, note.layer).length >= MAX_PER_LAYER) return c;
  return { ...c, notes: [...c.notes, id] };
}

/** يُبقي الحجم صالحاً عند تغيير التركيز (الدهن بأحجام أصغر) */
export function withConcentration(c: Composition, conc: Concentration): Composition {
  const sizes = CONCENTRATIONS.find((x) => x.id === conc)!.sizes;
  return { ...c, conc, size: sizes.includes(c.size) ? c.size : sizes[1] };
}

export const VAT = 0.15;
export interface Estimate {
  juice: number;
  bottle: number;
  premium: number;
  premiumCount: number;
  /** ضريبة القيمة المضافة 15٪ — التقدير شامل لها كما يُعرض للعميل */
  vat: number;
  total: number;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
export function estimate(c: Composition, rates: BespokeRates = DEFAULT_BESPOKE): Estimate {
  const premiumCount = notesOf(c).filter((x) => x.premium).length;
  const juice = r2(c.size * rates.perMl[c.conc]);
  const premium = r2(premiumCount * rates.premium);
  const net = r2(juice + rates.bottle + premium);
  const vat = r2(net * VAT);
  return { juice, bottle: rates.bottle, premium, premiumCount, vat, total: r2(net + vat) };
}

/** أقل سعر ممكن («يبدأ من»): أصغر حجم من أرخص تركيز بلا مكونات نادرة */
export function startingPrice(rates: BespokeRates = DEFAULT_BESPOKE) {
  return Math.min(...CONCENTRATIONS.map((x) => r2((x.sizes[0] * rates.perMl[x.id] + rates.bottle) * (1 + VAT))));
}

// ─── الطلب الوارد ─────────────────────────────────────────────────
export function toPayload(c: Composition, mode: Mode, extra: { slotRiyadh?: string; slotUtc?: string; estimate: number }): Record<string, string> {
  const p: Record<string, string> = {
    p_top: inLayer(c, "top").map((x) => x.id).join(","),
    p_heart: inLayer(c, "heart").map((x) => x.id).join(","),
    p_base: inLayer(c, "base").map((x) => x.id).join(","),
    p_conc: c.conc,
    p_size: String(c.size),
    p_purpose: c.purpose,
    p_mode: mode,
    p_estimate: String(extra.estimate),
  };
  if (c.name.trim()) p.p_name = c.name.trim().slice(0, NAME_MAX);
  if (extra.slotRiyadh) p.slot_riyadh = extra.slotRiyadh;
  if (extra.slotUtc) p.slot_utc = extra.slotUtc;
  return p;
}

/** الطلب الوارد نص حر من المتصفح: كل مكوّن في طبقته فقط، بلا تكرار، وبحجم صالح للتركيز */
export function fromPayload(p: Record<string, string | undefined>): Composition {
  const fields: [Layer, string | undefined][] = [["top", p.p_top], ["heart", p.p_heart], ["base", p.p_base]];
  const ids = [...new Set(fields.flatMap(([layer, s]) => (s ?? "").split(",").filter((id) => noteById(id)?.layer === layer).slice(0, MAX_PER_LAYER)))];
  const conc = (CONCENTRATIONS.some((x) => x.id === p.p_conc) ? p.p_conc : "edp") as Concentration;
  const sizes = CONCENTRATIONS.find((x) => x.id === conc)!.sizes;
  const size = sizes.includes(Number(p.p_size)) ? Number(p.p_size) : sizes[1];
  return { notes: ids, conc, size, purpose: (PURPOSES.some((x) => x.id === p.p_purpose) ? p.p_purpose : "self") as Purpose, name: p.p_name ?? "" };
}

/** ملخص الطلب كأسطر سؤال/جواب (الإدارة، لوحة العميل، إشعار الفريق) */
export function bespokeLines(payload: Record<string, unknown>, pick: (b: Bi) => string, t: (ar: string, en: string) => string) {
  const p = payload as Record<string, string>;
  const c = fromPayload(p);
  const names = (layer: Layer) => inLayer(c, layer).map((x) => pick(x.name)).join("، ");
  const lines: { q: string; a: string }[] = [];
  const add = (q: string, a: string | undefined) => a && lines.push({ q, a });
  add(t("لمن", "For"), PURPOSES.find((x) => x.id === p.p_purpose) && pick(PURPOSES.find((x) => x.id === p.p_purpose)!.label));
  for (const l of LAYERS) add(pick(l.label), names(l.id));
  const conc = CONCENTRATIONS.find((x) => x.id === c.conc)!;
  add(t("التركيز والحجم", "Concentration & size"), `${pick(conc.label)} · ${c.size} ${t("مل", "ml")}`);
  add(t("الاسم على الزجاجة", "Name on the bottle"), p.p_name);
  const mode = MODES.find((x) => x.id === p.p_mode);
  add(t("جلسة المستشار", "Consultation"), mode && [pick(mode.label), p.slot_riyadh].filter(Boolean).join(" · "));
  add(t("التقدير الذي رآه العميل (شامل الضريبة)", "Estimate shown to the client (incl. VAT)"), p.p_estimate && `${Number(p.p_estimate).toLocaleString("en-US")} ${t("ر.س", "SAR")}`);
  add(t("ملاحظات العميل", "Client notes"), p.message);
  return lines;
}

/** رسالة واتساب جاهزة للمستشار تحمل التركيبة */
export function whatsappText(c: Composition, pick: (b: Bi) => string, t: (ar: string, en: string) => string) {
  const parts = LAYERS.map((l) => `${pick(l.label)}: ${inLayer(c, l.id).map((x) => pick(x.name)).join("، ") || "—"}`);
  const conc = CONCENTRATIONS.find((x) => x.id === c.conc)!;
  return [t("مرحباً، أرغب في تكوين عطري الخاص:", "Hello, I'd like to create my signature scent:"), ...parts, `${pick(conc.label)} · ${c.size} ${t("مل", "ml")}`].join("\n");
}
