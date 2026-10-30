import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, type Lang } from "./context";
import { buildI18n } from "./build";

const KEY = "pp_lang";

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "ar") {
      // رابط مشارَك بلغة محددة: نحفظها حتى تبقى بعد التنقل
      localStorage.setItem(KEY, q);
      return q;
    }
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    /* التخزين غير متاح */
  }
  return "ar";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* التخزين غير متاح */
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo(() => buildI18n(lang, setLang), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
