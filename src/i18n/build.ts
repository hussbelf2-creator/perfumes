import type { Bi, Lang, I18nContextType } from "./context";

/** يبني قيمة السياق للغة محددة — يُستخدم أيضاً لفرض العربية داخل أقسام بعينها */
export function buildI18n(lang: Lang, setLang: (l: Lang) => void): I18nContextType {
  const isAr = lang === "ar";
  const locale = isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  return {
    lang,
    dir: isAr ? "rtl" : "ltr",
    isAr,
    setLang,
    toggle: () => setLang(isAr ? "en" : "ar"),
    t: (ar: string, en: string) => (isAr ? ar : en),
    pick: <T,>(v: Bi<T>) => (isAr ? v.ar : v.en),
    num: (n: number, digits = 0) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    sar: (n: number) => (isAr ? `${Math.round(n).toLocaleString("en-US")} ر.س` : `SAR ${Math.round(n).toLocaleString("en-US")}`),
    date: (d: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) => d.toLocaleDateString(locale, opts),
  };
}

