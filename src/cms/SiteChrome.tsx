import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { useCms, useContent } from "./ContentProvider";
import { announcementLive } from "./schema";

const APP_AREA = /^\/(admin|account|auth|contract)/;
const DISMISS = "pp_announce_dismissed";

// شريط الإعلان: عائم أسفل الصفحة (لا يزيح الترويسة الثابتة)، ويُخفى إن أغلقه الزائر حتى يتغيّر نصه
export function AnnouncementBar() {
  const a = useContent("announcement");
  const { pick, t } = useI18n();
  const { pathname } = useLocation();
  const sig = `${a.text.ar}|${a.link}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS);
    } catch {
      return null;
    }
  });
  if (!announcementLive(a) || APP_AREA.test(pathname) || dismissed === sig || pathname === a.link) return null;
  const close = () => {
    try {
      localStorage.setItem(DISMISS, sig);
    } catch {
      /* */
    }
    setDismissed(sig);
  };
  const dark = a.tone === "dark";
  const label = pick(a.linkLabel);
  return (
    // حاوية بعرض الشاشة تتوسّط المحتوى (بلا إزاحات تتعارض مع اتجاه اللغة)، وتترك مكان زر واتساب على الجوال
    <aside aria-label={t("إعلان", "Announcement")} className="fixed bottom-4 inset-x-3 z-40 flex justify-center pointer-events-none fade-up">
      <div className={`pointer-events-auto w-full sm:w-auto sm:max-w-xl me-[4.5rem] sm:me-0 rounded-2xl shadow-xl shadow-black/20 ring-1 ring-white/15 ps-4 pe-2 py-2.5 flex items-center gap-3 ${dark ? "bg-ink-900 text-white" : "bg-accent2 text-white"}`}>
        <p className="text-sm leading-snug flex-1 min-w-0">{pick(a.text)}</p>
        {a.link && label && (
          a.link.startsWith("/") ? (
            <Link to={a.link} className="shrink-0 rounded-full bg-white text-ink-900 px-3 py-1.5 text-xs">{label}</Link>
          ) : (
            <a href={a.link} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-white text-ink-900 px-3 py-1.5 text-xs">{label}</a>
          )
        )}
        <button type="button" onClick={close} className="shrink-0 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label={t("إغلاق الإعلان", "Dismiss announcement")}>
          <i className="ri-close-line" aria-hidden="true"></i>
        </button>
      </div>
    </aside>
  );
}

/** شارة وضع المعاينة: المسودات ظاهرة لهذا المحرر فقط */
export function PreviewBadge() {
  const { preview, setPreview } = useCms();
  const { t } = useI18n();
  if (!preview) return null;
  return (
    <div className="fixed top-[4.75rem] inset-x-3 z-[60] flex justify-center pointer-events-none">
    <div role="status" className="pointer-events-auto rounded-full bg-accent2 text-white shadow-lg ps-4 pe-1.5 py-1.5 flex items-center gap-3 text-sm">
      <span className="inline-flex items-center gap-2"><i className="ri-eye-line" aria-hidden="true"></i>{t("معاينة المسودات — تظهر لك فقط", "Previewing drafts — visible to you only")}</span>
      <button type="button" onClick={() => setPreview(false)} className="rounded-full bg-white/20 hover:bg-white/30 px-3 py-1 text-xs">{t("إيقاف", "Exit")}</button>
    </div>
    </div>
  );
}
