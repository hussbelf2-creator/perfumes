import { useI18n } from "@/i18n/context";
import Button from "@/components/ui/Button";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 bg-ink-900 text-white overflow-hidden">
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 text-[10rem] md:text-[18rem] leading-none font-display text-white/5 select-none pointer-events-none">404</span>
      <div className="relative z-10 max-w-md">
        <span className="w-14 h-14 rounded-full bg-accent2 flex items-center justify-center mx-auto mb-8"><i className="ri-compass-3-line text-2xl" aria-hidden="true"></i></span>
        <h1 className="font-display text-4xl md:text-5xl mb-4">{t("الصفحة غير موجودة", "Page not found")}</h1>
        <p className="text-white/65 leading-[1.8] mb-10">{t("ربما تغيّر الرابط أو حُذفت الصفحة.", "The link may have changed or the page was removed.")}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button to="/" variant="light" arrow>{t("الصفحة الرئيسية", "Home")}</Button>
          <Button to="/services" variant="ghost" className="!text-white border border-white/25 hover:!bg-white/10">{t("الخدمات", "Services")}</Button>
        </div>
      </div>
    </main>
  );
}
