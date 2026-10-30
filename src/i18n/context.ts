import { createContext, useContext } from "react";

export type Lang = "ar" | "en";

/** نص ثنائي اللغة يُكتب بجانب استخدامه */
export interface Bi<T = string> {
  ar: T;
  en: T;
}

export interface I18nContextType {
  lang: Lang;
  dir: "rtl" | "ltr";
  isAr: boolean;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** t("عربي", "English") */
  t: (ar: string, en: string) => string;
  /** يختار نسخة اللغة الحالية من كائن { ar, en } */
  pick: <T>(v: Bi<T>) => T;
  /** تنسيق رقم بأرقام لاتينية في اللغتين */
  num: (n: number, digits?: number) => string;
  /** تنسيق مبلغ بالريال */
  sar: (n: number) => string;
  /** تنسيق تاريخ (يوم وشهر) */
  date: (d: Date, opts?: Intl.DateTimeFormatOptions) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
