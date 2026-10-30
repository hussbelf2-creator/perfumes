import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { useImageSrc } from "../images";
import { SPECIALTY_ICONS, SPECIALTY_LABELS, type Creative, type Specialty } from "../types";

/** صورة عمل أو مصمم: تحلّ روابط idb: وتُظهر وميضاً أثناء التحميل وبديلاً هادئاً عند التعذر */
export function CImg({ src, alt, className = "", imgClassName = "", eager = false, fit = "cover" }: { src?: string | null; alt: string; className?: string; imgClassName?: string; eager?: boolean; fit?: "cover" | "contain" }) {
  const url = useImageSrc(src);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  // رابط جديد (مثلاً بعد توقيع ملف خاص) يبدأ تحميلاً جديداً بدل أن يرث خطأ الرابط السابق
  const [shown, setShown] = useState(url);
  if (shown !== url) {
    setShown(url);
    setState("loading");
  }
  const failed = state === "error" || (!url && src === null);
  return (
    // التموضع من className إن وُجد (دمج relative وabsolute يجعل أحدهما يلغي الآخر)
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} overflow-hidden bg-sand ${state === "loading" && !failed ? "shimmer" : ""} ${className}`}>
      {url && !failed && (
        <img
          src={url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={`absolute inset-0 w-full h-full ${fit === "cover" ? "object-cover" : "object-contain"} transition-[opacity,transform] duration-700 ${state === "loaded" ? "opacity-100" : "opacity-0"} ${imgClassName}`}
        />
      )}
      {failed && (
        <div role="img" aria-label={alt} className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sand-soft to-sand">
          <i className="ri-image-line text-3xl text-ink-900/20" aria-hidden="true"></i>
        </div>
      )}
    </div>
  );
}

/** الصورة الشخصية، أو الحرف الأول على خلفية هادئة (لا نولّد وجوهاً وهمية) */
export function Monogram({ creative, size = "md" }: { creative: Pick<Creative, "name" | "avatar">; size?: "sm" | "md" | "lg" }) {
  const { pick } = useI18n();
  const name = pick(creative.name);
  const cls = size === "lg" ? "w-24 h-24 md:w-28 md:h-28 text-4xl" : size === "sm" ? "w-9 h-9 text-sm" : "w-14 h-14 text-xl";
  if (creative.avatar) return <CImg src={creative.avatar} alt={name} className={`${cls} rounded-full shrink-0 ring-4 ring-paper-50`} />;
  return (
    <span className={`${cls} rounded-full shrink-0 ring-4 ring-paper-50 bg-ink-900 text-white font-display flex items-center justify-center`} aria-hidden="true">
      {name.trim().charAt(0)}
    </span>
  );
}

export function SampleBadge({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-paper-100 text-paper-600 px-2.5 py-1 text-[11px] ${className}`} title={t("ملف للعرض التوضيحي وليس مصمماً متعاقداً", "A demonstration profile, not a contracted creative")}>
      <i className="ri-information-line" aria-hidden="true"></i>
      {t("ملف توضيحي", "Sample profile")}
    </span>
  );
}

export function Availability({ available }: { available: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${available ? "text-[#1F6B4F]" : "text-paper-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${available ? "bg-[#1F6B4F]" : "bg-paper-400"}`} aria-hidden="true" />
      {available ? t("متاح لمشاريع جديدة", "Taking new projects") : t("جدوله ممتلئ حالياً", "Fully booked for now")}
    </span>
  );
}

export function SpecialtyChip({ s }: { s: Specialty }) {
  const { pick } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-paper-200 bg-white/70 px-2.5 py-1 text-[11px] text-paper-700">
      <i className={SPECIALTY_ICONS[s]} aria-hidden="true"></i>
      {pick(SPECIALTY_LABELS[s])}
    </span>
  );
}

/** أزرار التصفية حسب التخصص (مع «الكل») */
export function SpecialtyFilter({ options, value, onChange, label }: { options: Specialty[]; value: Specialty | "all"; onChange: (v: Specialty | "all") => void; label: string }) {
  const { t, pick } = useI18n();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {(["all", ...options] as const).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`rounded-full px-4 py-2 text-sm border transition-colors ${value === id ? "bg-ink-900 text-white border-ink-900" : "border-paper-300 text-paper-700 hover:border-ink-900"}`}
        >
          {id === "all" ? t("الكل", "All") : pick(SPECIALTY_LABELS[id])}
        </button>
      ))}
    </div>
  );
}
