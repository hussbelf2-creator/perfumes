import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { useContent } from "@/cms/ContentProvider";

// شريط الثقة تحت الهيرو (على طريقة بوابات الدفع): حقائق قابلة للتحقق لا شعارات —
// أين نصنّع، كيف تدفع، كيف تُحمى، ومتى تسترد. ثم «ابدأ خلال دقائق» بثلاث خطوات.
export default function TrustStrip() {
  const { t } = useI18n();
  const site = useContent("site");
  const items = [
    { icon: "ri-building-2-line", head: t("مصنع في السعودية", "Made in Saudi Arabia"), sub: t("ونشحن لأغلب دول العالم بمستندات التصدير", "Shipping worldwide with export documents") },
    { icon: "ri-bank-card-line", head: t("دفع آمن عبر مويسر", "Secure payment via Moyasar"), sub: t("مدى، فيزا، ماستركارد، Apple Pay — أو تحويل بنكي", "mada, Visa, Mastercard, Apple Pay — or bank transfer") },
    { icon: "ri-file-shield-2-line", head: t("عقد إلكتروني موقّع", "E-signed contract"), sub: t("مواصفات وكميات وصور، يوقّعه الطرفان قبل الإنتاج", "Specs, quantities and images, signed by both sides before production") },
    { icon: "ri-refund-2-line", head: t("العربون يُسترد قبل البدء", "Deposit refundable before work starts"), sub: t("وكل مرحلة تُعتمد قبل التي تليها", "And every stage is approved before the next") },
  ];
  const steps = [
    { n: 1, head: t("صمّم أو احسب", "Design or calculate"), sub: t("في الاستوديو أو الحاسبة — بلا حساب", "In the studio or calculator — no account needed") },
    { n: 2, head: t("أنشئ حسابك", "Create your account"), sub: t("كلمة مرور فوق بياناتك، لا رسوم", "A password on top of your details, no fees") },
    { n: 3, head: t("تابع من لوحتك", "Follow from your dashboard"), sub: t("عرض سعر، عقد، تصاميم للاعتماد، ومدير مشروع", "Quote, contract, designs to approve and a project manager") },
  ];
  return (
    <section className="bg-white border-b border-paper-200" aria-label={t("لماذا تثق بنا", "Why trust us")}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-paper-200 lg:divide-x rtl:lg:divide-x-reverse">
          {items.map((x) => (
            <li key={x.head} className="flex items-start gap-3 py-5 lg:px-5 first:ps-0 last:pe-0">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-accent3-soft text-accent3-ink flex items-center justify-center" aria-hidden="true"><i className={`${x.icon} text-xl`}></i></span>
              <span className="min-w-0">
                <span className="block text-sm text-ink-900 font-medium">{x.head}</span>
                <span className="block text-xs text-paper-500 leading-[1.6] mt-0.5">{x.sub}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-paper-200 py-6 flex flex-col lg:flex-row lg:items-center gap-5">
          <p className="font-display text-xl text-ink-900 shrink-0">{t("ابدأ خلال دقائق", "Start in minutes")}</p>
          <ol className="flex-1 grid sm:grid-cols-3 gap-3" aria-label={t("كيف تبدأ", "How to start")}>
            {steps.map((s) => (
              <li key={s.n} className="flex items-start gap-3">
                <span className="w-7 h-7 shrink-0 rounded-full bg-ink-900 text-white text-xs flex items-center justify-center tabular-nums">{s.n}</span>
                <span>
                  <span className="block text-sm text-ink-900">{s.head}</span>
                  <span className="block text-xs text-paper-500">{s.sub}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link to="/services" className="shrink-0 inline-flex items-center gap-2 rounded-full bg-ink-900 text-white px-5 py-2.5 text-sm hover:bg-ink-700 transition-colors">
            {t("اختر مسارك", "Pick your track")}
            <i className="ri-arrow-left-line flip-ltr" aria-hidden="true"></i>
          </Link>
        </div>
        {site.whatsapp && <span className="sr-only">{t("الدعم عبر واتساب متاح", "WhatsApp support available")}</span>}
      </div>
    </section>
  );
}
