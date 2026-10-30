import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";

// نافذة الواقع المعزز: model-viewer يُحمَّل عند الطلب فقط (حجمه كبير)
// webxr: أندرويد Chrome · quick-look: آيفون/آيباد (يولّد USDZ تلقائياً من GLB)

type MV = HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> };

export default function ArViewer({ glb, iosSrc, title, shareUrl, onClose }: { glb: Blob; iosSrc?: string; title: string; shareUrl: string; onClose: () => void }) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [mv, setMv] = useState<MV | null>(null);
  const [canAr, setCanAr] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(glb);
    let el: MV | null = null;
    let cancelled = false;
    void import("@google/model-viewer").then(() => {
      if (cancelled || !host.current) return;
      el = document.createElement("model-viewer") as MV;
      el.setAttribute("src", url);
      // USDZ جاهز من المزوّد (Meshy) أدق على آيفون من التحويل التلقائي
      if (iosSrc) el.setAttribute("ios-src", iosSrc);
      el.setAttribute("alt", title);
      el.setAttribute("ar", "");
      el.setAttribute("ar-modes", "webxr quick-look");
      el.setAttribute("ar-scale", "fixed");
      el.setAttribute("camera-controls", "");
      el.setAttribute("auto-rotate", "");
      el.setAttribute("shadow-intensity", "1");
      el.setAttribute("environment-image", "neutral");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.background = "#F3F1EC";
      el.addEventListener("load", () => setCanAr(Boolean(el?.canActivateAR)));
      host.current.appendChild(el);
      setMv(el);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      el?.remove();
      URL.revokeObjectURL(url);
      document.removeEventListener("keydown", onKey);
    };
  }, [glb, iosSrc, title, onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-ink-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t("الواقع المعزز", "Augmented reality")}>
      <div className="w-full max-w-lg rounded-[1.75rem] bg-white overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-paper-200">
          <h2 className="font-display text-lg text-ink-900">{t("شاهدها في مساحتك", "See it in your space")}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-paper-100 flex items-center justify-center" aria-label={t("إغلاق", "Close")}>
            <i className="ri-close-line text-lg" aria-hidden="true"></i>
          </button>
        </header>
        <div ref={host} className="h-[52vh] max-h-[460px] bg-paper-50" data-testid="ar-host" />
        <div className="p-5 space-y-3">
          {canAr ? (
            <button type="button" onClick={() => void mv?.activateAR?.()} className="w-full rounded-full bg-ink-900 text-white py-3 text-sm inline-flex items-center justify-center gap-2">
              <i className="ri-camera-lens-line" aria-hidden="true"></i>
              {t("ضعها على طاولتك بالكاميرا", "Place it on your table with the camera")}
            </button>
          ) : (
            <>
              <p className="text-sm text-paper-600 leading-[1.8]">
                {canAr === false
                  ? t("هذا الجهاز لا يدعم الواقع المعزز. افتح الرابط على جوال حديث (آيفون أو أندرويد) لترى العبوة بحجمها الحقيقي.", "This device doesn't support AR. Open the link on a recent iPhone or Android phone to see the bottle at real size.")
                  : t("جاري تجهيز النموذج…", "Preparing the model…")}
              </p>
              {canAr === false && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true));
                  }}
                  className="w-full rounded-full border border-paper-300 py-3 text-sm text-ink-900 inline-flex items-center justify-center gap-2"
                >
                  <i className={copied ? "ri-check-line" : "ri-link"} aria-hidden="true"></i>
                  {copied ? t("نُسخ الرابط", "Link copied") : t("انسخ رابط هذه التركيبة", "Copy a link to this design")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
