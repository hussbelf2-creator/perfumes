import { useI18n } from "@/i18n/context";
export default function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50" role="status" aria-live="polite">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-stone-500 text-sm">{t("جاري التحميل…", "Loading…")}</p>
      </div>
    </div>
  );
}
