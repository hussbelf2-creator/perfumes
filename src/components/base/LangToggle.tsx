import { useI18n } from "@/i18n/context";

// مبدّل اللغة: يعرض اسم اللغة الأخرى
export default function LangToggle({ className = "" }: { className?: string }) {
  const { isAr, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      lang={isAr ? "en" : "ar"}
      aria-label={isAr ? "Switch to English" : "التبديل إلى العربية"}
      className={`inline-flex items-center gap-1.5 text-sm text-paper-600 hover:text-ink-900 transition-colors ${className}`}
    >
      <i className="ri-global-line" aria-hidden="true"></i>
      {isAr ? "EN" : "عربي"}
    </button>
  );
}
