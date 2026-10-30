// بيانات العلامة الثابتة. بيانات التواصل هنا هي القيم الافتراضية فقط:
// تُعدَّل من لوحة الإدارة ← محتوى الموقع (src/cms). الحقول الفارغة تُخفى من الواجهة.

import type { Bi } from "@/i18n/context";
import type { SiteDoc } from "@/cms/schema";

export const SITE = {
  name: { ar: "منصة العطور الاحترافية", en: "The Perfume Platform" } as Bi,
  shortName: { ar: "منصة العطور", en: "Perfume Platform" } as Bi,
  tagline: { ar: "براندك العطري من الفكرة إلى الرف", en: "Your fragrance brand, from idea to shelf" } as Bi,
  url: "https://perfumes-phi.vercel.app",
  // TODO: انقل الشعار إلى public/ — الرابط الحالي مستضاف لدى Readdy
  logo: "https://public.readdy.ai/ai/img_res/d731bdfe-bbad-4a91-b6ce-fc896c33896a.png",

  // بيانات التواصل — أدخل البيانات الحقيقية قبل الإطلاق
  email: "",
  phone: "", // بصيغة دولية مثل: +966500000000
  whatsapp: "", // أرقام فقط مثل: 966500000000
  address: { ar: "المملكة العربية السعودية", en: "Saudi Arabia" } as Bi,
  workingHours: { ar: "الأحد – الخميس، 9 ص – 6 م", en: "Sun – Thu, 9am – 6pm" } as Bi,

  social: {
    instagram: "",
    x: "",
    tiktok: "",
    snapchat: "",
    linkedin: "",
  },
} as const;

/** رابط واتساب من رقم المحتوى (فارغ إن لم يُضبط الرقم) */
export function whatsappLink(whatsapp: string, message = "مرحباً، أرغب في الاستفسار عن إنشاء براند عطري / Hello, I'd like to ask about creating a fragrance brand") {
  if (!whatsapp) return "";
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

// حقائق تشغيلية مستمدة من نطاق الخدمات نفسه — لا أرقام تسويقية غير موثّقة.
export const PLATFORM_FACTS: { value: number; prefix?: string; label: Bi }[] = [
  { value: 6, label: { ar: "مسارات خدمة مستقلة", en: "Independent service tracks" } },
  { value: 20, label: { ar: "مرحلة عمل موثّقة", en: "Documented work stages" } },
  { value: 1, label: { ar: "مدير مشروع لكل براند", en: "Project manager per brand" } },
  { value: 6, prefix: "3–", label: { ar: "أشهر من الفكرة للإطلاق", en: "Months from idea to launch" } },
];

export interface ContactChannel {
  icon: string;
  title: Bi;
  lines: Bi<string[]>;
  href?: string;
}

// قنوات التواصل المتاحة فعلياً فقط — تظهر القناة حين تُعبّأ بياناتها في «محتوى الموقع»
export function contactChannels(c: SiteDoc): ContactChannel[] {
  return [
    c.whatsapp && { icon: "ri-whatsapp-line", title: { ar: "واتساب", en: "WhatsApp" }, lines: { ar: ["تحدث معنا مباشرة"], en: ["Chat with us directly"] }, href: whatsappLink(c.whatsapp) },
    c.phone && { icon: "ri-phone-line", title: { ar: "اتصل بنا", en: "Call us" }, lines: { ar: [c.phone], en: [c.phone] }, href: `tel:${c.phone}` },
    c.email && { icon: "ri-mail-line", title: { ar: "البريد الإلكتروني", en: "Email" }, lines: { ar: [c.email], en: [c.email] }, href: `mailto:${c.email}` },
    { icon: "ri-map-pin-line", title: { ar: "موقعنا", en: "Location" }, lines: { ar: [c.address.ar, c.workingHours.ar].filter(Boolean), en: [c.address.en, c.workingHours.en].filter(Boolean) } },
  ].filter(Boolean) as ContactChannel[];
}

const SOCIAL_META: Record<keyof SiteDoc["social"], { icon: string; label: string }> = {
  instagram: { icon: "ri-instagram-line", label: "Instagram" },
  x: { icon: "ri-twitter-x-line", label: "X" },
  tiktok: { icon: "ri-tiktok-line", label: "TikTok" },
  snapchat: { icon: "ri-snapchat-line", label: "Snapchat" },
  linkedin: { icon: "ri-linkedin-line", label: "LinkedIn" },
};

export function socialLinks(c: SiteDoc) {
  return (Object.keys(SOCIAL_META) as (keyof SiteDoc["social"])[])
    .filter((k) => c.social[k])
    .map((k) => ({ ...SOCIAL_META[k], href: c.social[k] }));
}
