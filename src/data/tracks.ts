// كل مسارات المشاريع في النظام: مسارات الأعمال الستة (src/data/services.ts) + «عطرك الخاص» للأفراد.
// للبحث في النظام (المراحل، الملخص، الإدارة)؛ صفحات التسويق للأعمال تبقى على SERVICE_TRACKS.
// الاستيراد نسبي لأن دوال الخادم (api/) تستخدمه.
import type { Bi } from "../i18n/context";
import { SERVICE_TRACKS } from "./services";

export interface TrackInfo {
  id: string;
  title: Bi;
  steps: { title: Bi; desc: Bi; time: Bi }[];
}

/** «عطرك الخاص»: عطر شخصي لفرد، بتركيبة يختار مكوناتها ويضبطها معه مستشار التكوين */
export const PERSONAL_TRACK: TrackInfo & { id: "P"; duration: Bi } = {
  id: "P",
  title: { ar: "عطرك الخاص", en: "Your signature scent" },
  duration: { ar: "2 – 3 أسابيع", en: "2 – 3 weeks" },
  steps: [
    { title: { ar: "التكوين والاستشارة", en: "Composition & consultation" }, desc: { ar: "تختار مكوناتك ثم تضبطها مع مستشار التكوين", en: "You pick your notes, then refine them with a composition consultant" }, time: { ar: "يوم – 3 أيام", en: "1 – 3 days" } },
    { title: { ar: "العينات التجريبية", en: "Trial samples" }, desc: { ar: "نسختان بنسب مختلفة تجربهما على جلدك", en: "Two versions with different ratios to try on your skin" }, time: { ar: "أسبوع", en: "1 week" } },
    { title: { ar: "التعبئة والنقش", en: "Bottling & engraving" }, desc: { ar: "تعبئة النسخة المعتمدة ونقش اسمك على الزجاجة", en: "Filling the approved version and engraving your name" }, time: { ar: "3 – 5 أيام", en: "3 – 5 days" } },
  ],
};

export const ALL_TRACKS: TrackInfo[] = [...SERVICE_TRACKS, PERSONAL_TRACK];
export const trackInfo = (id?: string | null) => ALL_TRACKS.find((x) => x.id === id);
