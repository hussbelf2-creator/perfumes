// أرقام الجوال الدولية: الدولة + رمزها، والتخزين بصيغة E.164 (+9665xxxxxxxx) ليعمل واتساب والاتصال من أي بلد.
// المصنع في السعودية والعملاء من أغلب دول العالم؛ السعودية افتراضية ولها تحقق أدق (جوال يبدأ بـ5 وتسعة أرقام).
import type { Bi } from "@/i18n/context";

export interface Country {
  /** رمز ISO من حرفين */
  iso: string;
  name: Bi;
  /** رمز الاتصال الدولي بلا + */
  dial: string;
  /** طول الرقم الوطني دون صفر البداية [أدنى، أقصى] */
  len?: [number, number];
  /** نمط الجوال الوطني حين نعرفه بدقة */
  mobile?: RegExp;
}

const c = (iso: string, ar: string, en: string, dial: string, len?: [number, number], mobile?: RegExp): Country => ({ iso, name: { ar, en }, dial, len, mobile });

/** الخليج أولاً ثم بقية الدول مرتبة بالاسم العربي */
export const COUNTRIES: Country[] = [
  c("SA", "السعودية", "Saudi Arabia", "966", [9, 9], /^5\d{8}$/),
  c("AE", "الإمارات", "United Arab Emirates", "971", [8, 9], /^5\d{8}$/),
  c("KW", "الكويت", "Kuwait", "965", [8, 8]),
  c("QA", "قطر", "Qatar", "974", [8, 8]),
  c("BH", "البحرين", "Bahrain", "973", [8, 8]),
  c("OM", "عُمان", "Oman", "968", [8, 8]),
  ...[
    c("JO", "الأردن", "Jordan", "962", [8, 9]),
    c("ES", "إسبانيا", "Spain", "34", [9, 9]),
    c("AU", "أستراليا", "Australia", "61", [9, 9]),
    c("DE", "ألمانيا", "Germany", "49", [7, 12]),
    c("ID", "إندونيسيا", "Indonesia", "62", [9, 12]),
    c("IQ", "العراق", "Iraq", "964", [10, 10]),
    c("IR", "إيران", "Iran", "98", [10, 10]),
    c("IE", "أيرلندا", "Ireland", "353", [7, 9]),
    c("IT", "إيطاليا", "Italy", "39", [6, 11]),
    c("PK", "باكستان", "Pakistan", "92", [10, 10]),
    c("BR", "البرازيل", "Brazil", "55", [10, 11]),
    c("PT", "البرتغال", "Portugal", "351", [9, 9]),
    c("BE", "بلجيكا", "Belgium", "32", [8, 9]),
    c("BD", "بنغلاديش", "Bangladesh", "880", [10, 10]),
    c("PL", "بولندا", "Poland", "48", [9, 9]),
    c("TR", "تركيا", "Turkey", "90", [10, 10]),
    c("TN", "تونس", "Tunisia", "216", [8, 8]),
    c("DZ", "الجزائر", "Algeria", "213", [9, 9]),
    c("ZA", "جنوب أفريقيا", "South Africa", "27", [9, 9]),
    c("DK", "الدنمارك", "Denmark", "45", [8, 8]),
    c("RU", "روسيا", "Russia", "7", [10, 10]),
    c("SG", "سنغافورة", "Singapore", "65", [8, 8]),
    c("SD", "السودان", "Sudan", "249", [9, 9]),
    c("SE", "السويد", "Sweden", "46", [7, 10]),
    c("CH", "سويسرا", "Switzerland", "41", [9, 9]),
    c("SY", "سوريا", "Syria", "963", [9, 9]),
    c("CN", "الصين", "China", "86", [11, 11]),
    c("FR", "فرنسا", "France", "33", [9, 9]),
    c("PS", "فلسطين", "Palestine", "970", [9, 9]),
    c("PH", "الفلبين", "Philippines", "63", [10, 10]),
    c("CA", "كندا", "Canada", "1", [10, 10]),
    c("KR", "كوريا الجنوبية", "South Korea", "82", [9, 10]),
    c("LB", "لبنان", "Lebanon", "961", [7, 8]),
    c("LY", "ليبيا", "Libya", "218", [9, 9]),
    c("MY", "ماليزيا", "Malaysia", "60", [9, 10]),
    c("EG", "مصر", "Egypt", "20", [10, 10], /^1\d{9}$/),
    c("MA", "المغرب", "Morocco", "212", [9, 9]),
    c("MX", "المكسيك", "Mexico", "52", [10, 10]),
    c("GB", "المملكة المتحدة", "United Kingdom", "44", [10, 10]),
    c("NG", "نيجيريا", "Nigeria", "234", [10, 10]),
    c("NO", "النرويج", "Norway", "47", [8, 8]),
    c("AT", "النمسا", "Austria", "43", [7, 12]),
    c("IN", "الهند", "India", "91", [10, 10]),
    c("NL", "هولندا", "Netherlands", "31", [9, 9]),
    c("US", "الولايات المتحدة", "United States", "1", [10, 10]),
    c("JP", "اليابان", "Japan", "81", [9, 10]),
    c("YE", "اليمن", "Yemen", "967", [9, 9]),
    c("GR", "اليونان", "Greece", "30", [10, 10]),
  ].sort((a, b) => a.name.ar.localeCompare(b.name.ar, "ar")),
];

export const DEFAULT_COUNTRY = "SA";
export const countryByIso = (iso?: string | null) => COUNTRIES.find((x) => x.iso === iso?.toUpperCase());

/** علم الدولة من رمزها (حروف المؤشر الإقليمي) */
export const flag = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));

// المنطقة الزمنية للجهاز مؤشر أصدق على موقع الزائر من لغة متصفحه (كثير من الأجهزة في الخليج بلغة en-US)
const TZ_COUNTRY: Record<string, string> = {
  "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Kuwait": "KW", "Asia/Qatar": "QA", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
  "Asia/Amman": "JO", "Asia/Baghdad": "IQ", "Asia/Beirut": "LB", "Asia/Damascus": "SY", "Asia/Aden": "YE", "Asia/Gaza": "PS", "Asia/Hebron": "PS",
  "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Tunis": "TN", "Africa/Tripoli": "LY", "Africa/Khartoum": "SD",
  "Africa/Lagos": "NG", "Africa/Johannesburg": "ZA", "Asia/Tehran": "IR", "Europe/Istanbul": "TR", "Asia/Karachi": "PK", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Asia/Dhaka": "BD", "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY", "Asia/Singapore": "SG", "Asia/Manila": "PH", "Asia/Shanghai": "CN", "Asia/Seoul": "KR", "Asia/Tokyo": "JP",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Lisbon": "PT",
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Warsaw": "PL", "Europe/Athens": "GR", "Europe/Moscow": "RU", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR", "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
};

/** الدولة الأرجح للزائر من المنطقة الزمنية لجهازه، وإلا السعودية (سوق المصنع الأول) */
export function guessCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  } catch {
    /* لا شيء */
  }
  return DEFAULT_COUNTRY;
}

const digits = (s: string) => (s ?? "").replace(/[^\d]/g, "");
/** الأرقام العربية/الفارسية ← لاتينية، كي يقبل الحقل ما يكتبه المستخدم بلوحة عربية */
export const latinDigits = (s: string) => (s ?? "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** الرقم الوطني دون صفر الاتصال المحلي (إيطاليا تحتفظ بصفرها) */
export function nationalOf(iso: string, raw: string): string {
  let d = digits(latinDigits(raw));
  const ct = countryByIso(iso);
  // لصق رقم دولي كامل في الحقل الوطني
  if (ct && d.startsWith("00" + ct.dial)) d = d.slice(2 + ct.dial.length);
  else if (ct && raw.trim().startsWith("+") && d.startsWith(ct.dial)) d = d.slice(ct.dial.length);
  if (iso !== "IT") d = d.replace(/^0+/, "");
  return d;
}

/** الدولة + الرقم الوطني ← E.164 (+9665xxxxxxxx)؛ فارغ إن لم يُكتب رقم */
export function toE164(iso: string, raw: string): string {
  const ct = countryByIso(iso) ?? countryByIso(DEFAULT_COUNTRY)!;
  const n = nationalOf(ct.iso, raw);
  return n ? `+${ct.dial}${n}` : "";
}

/** هل الرقم الوطني صالح لدولته؟ */
export function validNational(iso: string, raw: string): boolean {
  const ct = countryByIso(iso);
  const n = nationalOf(iso, raw);
  if (!ct || !n) return false;
  if (ct.mobile) return ct.mobile.test(n);
  const [min, max] = ct.len ?? [6, 12];
  return n.length >= min && n.length <= max && ct.dial.length + n.length <= 15;
}

/**
 * رقم مخزّن بأي صيغة ← الدولة والرقم الوطني.
 * الأرقام القديمة المحلية (05xxxxxxxx) سعودية؛ والدولية تُطابق بأطول رمز اتصال (+1 تذهب لأمريكا ما لم تُحدَّد كندا).
 */
export function parsePhone(stored?: string | null, fallback = DEFAULT_COUNTRY): { country: string; national: string } {
  const raw = latinDigits(stored ?? "").trim();
  if (!raw) return { country: fallback, national: "" };
  let d = digits(raw);
  const intl = raw.startsWith("+") || d.startsWith("00");
  if (d.startsWith("00")) d = d.slice(2);
  if (!intl) {
    // محلي: سعودي بصيغته المعتادة، وإلا يبقى على الدولة الافتراضية
    if (/^0?5\d{8}$/.test(d) && fallback === "SA") return { country: "SA", national: d.replace(/^0/, "") };
    if (/^9665\d{8}$/.test(d)) return { country: "SA", national: d.slice(3) };
    return { country: fallback, national: nationalOf(fallback, d) };
  }
  const fb = countryByIso(fallback);
  if (fb && d.startsWith(fb.dial)) return { country: fb.iso, national: d.slice(fb.dial.length) };
  const hit = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((x) => d.startsWith(x.dial) && x.iso !== "CA");
  return hit ? { country: hit.iso, national: d.slice(hit.dial.length) } : { country: fallback, national: d };
}

/** هل الرقم المخزّن (أي صيغة) صالح؟ */
export function phoneOk(stored?: string | null): boolean {
  const { country, national } = parsePhone(stored);
  return validNational(country, national);
}

/** رقم واتساب (أرقام فقط بالرمز الدولي) من أي صيغة، أو فارغ إن لم يكن صالحاً */
export function waDigits(stored?: string | null): string {
  const { country, national } = parsePhone(stored);
  if (!validNational(country, national)) return "";
  return toE164(country, national).slice(1);
}

/** عرض مقروء: +966 55 123 0011 */
export function formatPhone(stored?: string | null): string {
  const { country, national } = parsePhone(stored);
  const ct = countryByIso(country);
  if (!ct || !national) return stored ?? "";
  // آخر أربعة أرقام معاً، وما قبلها مجموعات ثلاثية من اليمين: 55 123 4567
  const groups = [national.slice(-4)];
  for (let rest = national.slice(0, -4); rest; rest = rest.slice(0, -3)) groups.unshift(rest.slice(-3));
  return `+${ct.dial} ${groups.join(" ")}`;
}

/** مثال الرقم الوطني لكل دولة في حقل الإدخال */
export function placeholderFor(iso: string): string {
  if (iso === "SA") return "5x xxx xxxx";
  if (iso === "AE") return "5x xxx xxxx";
  const ct = countryByIso(iso);
  const n = ct?.len?.[1] ?? 9;
  return "x".repeat(n).replace(/(x{3})(?=x)/g, "$1 ");
}
