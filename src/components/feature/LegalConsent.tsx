import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";

// سطر الموافقة الضمنية قرب أزرار الإرسال والدفع (الروابط تفتح في تبويب جديد حتى لا يضيع النموذج)
export default function LegalConsent({ action, refund = false, className = "" }: { action: { ar: string; en: string }; refund?: boolean; className?: string }) {
  const { t, pick } = useI18n();
  const a = (to: string, label: string) => (
    <Link to={to} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-ink-900">{label}</Link>
  );
  return (
    <p className={`text-xs text-paper-500 leading-[1.8] ${className}`} data-testid="legal-consent">
      {t(`${pick(action)} توافق على `, `By ${pick(action)}, you agree to the `)}
      {a("/terms", t("الشروط والأحكام", "Terms"))}
      {refund ? (
        <>
          {t("، ", ", ")}
          {a("/refund", t("سياسة الإلغاء والاسترجاع", "Refund policy"))}
          {t("، و", ", and ")}
        </>
      ) : (
        t(" و", " and ")
      )}
      {a("/privacy", t("سياسة الخصوصية", "Privacy policy"))}
      {t(".", ".")}
    </p>
  );
}
