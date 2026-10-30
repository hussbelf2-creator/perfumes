import { useState } from "react";
import { useI18n } from "@/i18n/context";
import Lightbox from "@/creatives/components/Lightbox";
import { CImg } from "@/creatives/components/ui";
import { SPECIALTY_LABELS, type Creative, type Work } from "@/creatives/types";

// شبكة الأعمال: بطاقات بغلاف كل عمل، والنقر يفتح العارض
export default function WorkGrid({ works, creativeOf, showCreative = true }: { works: Work[]; creativeOf: (id: string) => Creative | undefined; showCreative?: boolean }) {
  const { t, pick, num } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {works.map((w, i) => {
          const c = creativeOf(w.creativeId);
          return (
            <li key={w.id} className={i % 5 === 0 ? "col-span-2 lg:col-span-1" : ""}>
              <button type="button" onClick={() => setOpen(i)} className="group block w-full text-start" aria-label={t(`عرض «${pick(w.title)}»`, `View “${pick(w.title)}”`)}>
                <span className="relative block">
                  <CImg src={w.images[0]} alt="" className={`rounded-[1.25rem] md:rounded-[1.75rem] ${i % 5 === 0 ? "aspect-[4/3] lg:aspect-[4/5]" : "aspect-[4/5]"}`} imgClassName="group-hover:scale-[1.04]" />
                  {w.images.length > 1 && (
                    <span className="absolute top-3 end-3 rounded-full bg-white/85 backdrop-blur px-2 py-1 text-[11px] text-ink-900 inline-flex items-center gap-1">
                      <i className="ri-image-2-line" aria-hidden="true"></i>
                      {num(w.images.length)}
                    </span>
                  )}
                </span>
                <span className="mt-3 block">
                  <span className="block font-display text-lg md:text-xl text-ink-900 leading-snug">{pick(w.title)}</span>
                  <span className="mt-1 block text-xs text-paper-500">
                    {pick(SPECIALTY_LABELS[w.category])}
                    {showCreative && c ? ` · ${pick(c.name)}` : ""}
                    {w.concept ? ` · ${t("تصوّري", "Concept")}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null && works[open] && <Lightbox works={works} index={open} onIndex={setOpen} onClose={() => setOpen(null)} creativeOf={showCreative ? creativeOf : undefined} />}
    </>
  );
}
