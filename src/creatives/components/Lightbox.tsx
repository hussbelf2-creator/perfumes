import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { SPECIALTY_LABELS, type Creative, type Work } from "../types";
import { CImg } from "./ui";

// عارض الأعمال: صورة كبيرة، تنقّل بين صور العمل وبين الأعمال، Esc للإغلاق، والأسهم حسب اتجاه اللغة

export default function Lightbox({ works, index, onIndex, onClose, creativeOf }: { works: Work[]; index: number; onIndex: (i: number) => void; onClose: () => void; creativeOf?: (id: string) => Creative | undefined }) {
  const { t, pick, dir, num } = useI18n();
  const work = works[index];
  const [img, setImg] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<number | null>(null);
  const creative = creativeOf?.(work.creativeId);

  useEffect(() => setImg(0), [index]);

  // تركيز وإرجاعه، وقفل تمرير الصفحة
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  const total = work.images.length;
  // «التالي»: صورة تالية داخل العمل، ثم العمل التالي
  const step = (d: 1 | -1) => {
    const n = img + d;
    if (n >= 0 && n < total) return setImg(n);
    const w = (index + d + works.length) % works.length;
    if (w !== index) onIndex(w);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // في العربية السهم الأيسر هو «التالي»
      else if (e.key === "ArrowLeft") step(dir === "rtl" ? 1 : -1);
      else if (e.key === "ArrowRight") step(dir === "rtl" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = pick(work.title);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[90] text-white flex flex-col"
      style={{ backgroundColor: "#15101D" }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) step((dx < 0) === (dir === "ltr") ? 1 : -1);
      }}
    >
      <header className="flex items-center justify-between gap-3 px-4 md:px-8 py-4">
        <p className="text-sm text-white/60 font-mono" aria-live="polite">
          {num(index + 1)} / {num(works.length)}
          {total > 1 && <span className="ms-3">· {t("صورة", "Image")} {num(img + 1)}/{num(total)}</span>}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label={t("إغلاق", "Close")}>
          <i className="ri-close-line text-xl" aria-hidden="true"></i>
        </button>
      </header>
      <div className="relative flex-1 min-h-0 px-4 md:px-20">
        <CImg key={work.images[img]} src={work.images[img]} alt={`${title} — ${num(img + 1)}`} fit="contain" eager className="absolute inset-0 !bg-transparent mx-4 md:mx-20" />
        {(works.length > 1 || total > 1) && (
          <>
            <button type="button" onClick={() => step(-1)} className="absolute top-1/2 -translate-y-1/2 start-2 md:start-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label={t("السابق", "Previous")}>
              <i className="ri-arrow-right-s-line text-2xl inline-block flip-ltr" aria-hidden="true"></i>
            </button>
            <button type="button" onClick={() => step(1)} className="absolute top-1/2 -translate-y-1/2 end-2 md:end-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label={t("التالي", "Next")}>
              <i className="ri-arrow-left-s-line text-2xl inline-block flip-ltr" aria-hidden="true"></i>
            </button>
          </>
        )}
      </div>
      <footer className="px-4 md:px-8 py-5 grid md:grid-cols-[1fr_auto] gap-3 items-end max-w-6xl w-full mx-auto">
        <div className="min-w-0">
          <p className="text-xs text-white/50">
            {pick(SPECIALTY_LABELS[work.category])} · {work.year}
            {work.concept ? <span className="ms-2 rounded-full bg-white/10 px-2 py-0.5">{t("مشروع تصوّري", "Concept project")}</span> : work.client ? <span className="ms-2">· {work.client}</span> : null}
          </p>
          <h2 className="mt-1 font-display text-2xl">{title}</h2>
          {pick(work.summary) && <p className="mt-1 text-sm text-white/70 leading-[1.8] max-w-2xl">{pick(work.summary)}</p>}
        </div>
        {creative && (
          <Link to={`/creatives/${creative.slug}`} onClick={onClose} className="justify-self-start md:justify-self-end rounded-full bg-white text-ink-900 px-4 py-2.5 text-sm inline-flex items-center gap-2">
            {t("ملف", "Profile:")} {pick(creative.name)}
            <i className="ri-arrow-left-line inline-block flip-ltr" aria-hidden="true"></i>
          </Link>
        )}
        {total > 1 && (
          <div className="md:col-span-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("صور العمل", "Work images")}>
            {work.images.map((src, i) => (
              <button key={src + i} type="button" onClick={() => setImg(i)} aria-pressed={i === img} aria-label={`${t("صورة", "Image")} ${num(i + 1)}`} className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === img ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}>
                <CImg src={src} alt="" className="w-16 h-12" />
              </button>
            ))}
          </div>
        )}
      </footer>
    </div>,
    document.body,
  );
}
