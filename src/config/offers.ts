// عرضا الدخول: مكالمة الاكتشاف المجانية وعينة الاكتشاف المدفوعة.
// كل الأرقام هنا قرارات تجارية قابلة للتعديل — راجعها قبل الإطلاق.
import type { Bi } from "@/i18n/context";

export const DISCOVERY_CALL = {
  minutes: 20,
  /** أيام العمل: 0 = الأحد … 4 = الخميس */
  workDays: [0, 1, 2, 3, 4],
  daysAhead: 14,
  /** مواعيد بتوقيت الرياض (24 ساعة) */
  slots: ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"],
  /** إن ضُبط رابط Cal.com أو Calendly يُستخدم بدل نموذج الحجز الداخلي */
  externalUrl: (import.meta.env.VITE_BOOKING_URL as string | undefined) || "",
};

export const DISCOVERY_KIT = {
  price: 750,
  vials: 3,
  ml: 2,
  /** يُخصم سعر العينة من قيمة المشروع إن بدأ العميل خلال هذه المدة */
  creditDays: 60,
  shipping: { ar: "3 – 5 أيام عمل داخل المملكة، و7 – 14 يوماً دولياً", en: "3 – 5 business days in KSA, 7 – 14 days internationally" } as Bi,
};

export const SAUDI_CITIES: Bi[] = [
  { ar: "الرياض", en: "Riyadh" },
  { ar: "جدة", en: "Jeddah" },
  { ar: "مكة المكرمة", en: "Makkah" },
  { ar: "المدينة المنورة", en: "Madinah" },
  { ar: "الدمام", en: "Dammam" },
  { ar: "الخبر", en: "Khobar" },
  { ar: "الطائف", en: "Taif" },
  { ar: "أبها", en: "Abha" },
  { ar: "تبوك", en: "Tabuk" },
  { ar: "القصيم", en: "Qassim" },
  { ar: "مدينة أخرى", en: "Other city" },
];
