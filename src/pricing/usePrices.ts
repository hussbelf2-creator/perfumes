import { useContent } from "@/cms/ContentProvider";
import type { Bi } from "@/i18n/context";
import type { ServiceTrack } from "@/data/services";

// الأسعار العامة من وثيقة «الأسعار» المنشورة (تُعدَّل من اللوحة) — والافتراضي من الكود

export const useCalc = () => useContent("pricing").calc;
export const useKitPrice = () => useContent("pricing").kit.price;
/** أسعار «عطرك الخاص» */
export const useBespokeRates = () => useContent("pricing").bespoke;

/** «يبدأ من …» لكل مسار؛ 0 = عرض سعر مخصص */
export function useServicePrice() {
  const prices = useContent("pricing").services;
  return (s: Pick<ServiceTrack, "id" | "price">): Bi => {
    const n = prices[s.id];
    if (n === undefined) return s.price;
    // 0 = لا سعر ابتدائي: نص المسار نفسه إن كان وصفاً («حسب الكمية»)، وإلا «عرض سعر مخصص»
    if (!n) return /\d/.test(s.price.en) ? { ar: "عرض سعر مخصص", en: "Custom quote" } : s.price;
    const f = n.toLocaleString("en-US");
    // عروض الأسعار تضيف ضريبة القيمة المضافة فوق المبلغ
    return { ar: `يبدأ من ${f} ر.س قبل الضريبة`, en: `From SAR ${f} excl. VAT` };
  };
}
