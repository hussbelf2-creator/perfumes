import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import Button from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { useContent } from "@/cms/ContentProvider";
import { verifyPayment, readPendingOrder, clearPendingOrder, type VerifyResult } from "@/lib/payments";
import { useKitPrice } from "@/pricing/usePrices";

// حالات قد يكون المبلغ خُصم فيها: لا نطلب من العميل الدفع مرة أخرى
const REVIEW = ["not_configured", "unverified", "gateway_unreachable", "gateway_error", "pricing_unavailable", "needs_review", "db_unreachable"];

// صفحة العودة من مويسر: /discovery-kit/paid?id=…&status=…&message=…
const KitPaidPage = () => {
  const { t, pick, sar } = useI18n();
  const DISCOVERY_KIT = useContent("offers").kit;
  const price = useKitPrice();
  const [params] = useSearchParams();
  const id = params.get("id") || "";
  const [order] = useState(readPendingOrder);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!id) {
      setResult({ paid: false, status: "missing" });
      return;
    }
    let cancelled = false;
    verifyPayment(id).then((r) => {
      if (cancelled) return;
      setResult(r);
      if (r.paid) clearPendingOrder();
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const ref = result?.ref || order?.ref || "";
  const gatewayMsg = params.get("message");

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-5 md:px-8 pt-32 md:pt-40 pb-24">
        <div className="rounded-[1.75rem] bg-white border border-paper-200 p-7 md:p-10 text-center">
          {!result && (
            <div role="status" aria-live="polite" className="py-10">
              <span className="w-12 h-12 mx-auto block rounded-full border-2 border-paper-200 border-t-ink-900 animate-spin" aria-hidden="true" />
              <p className="mt-6 text-paper-600">{t("نتحقق من الدفع…", "Verifying your payment…")}</p>
            </div>
          )}

          {result?.paid && (
            <div role="status" className="panel-in">
              <span className="w-16 h-16 mx-auto rounded-full bg-ink-900 text-white flex items-center justify-center">
                <i className="ri-check-line text-3xl" aria-hidden="true"></i>
              </span>
              <h1 className="mt-6 font-display text-3xl md:text-4xl text-ink-900">
                {order?.name ? t(`تم الدفع، ${order.name}.`, `Payment received, ${order.name}.`) : t("تم الدفع بنجاح.", "Payment received.")}
              </h1>
              <p className="mt-3 text-paper-600 leading-[1.8]">{t("بدأنا تجهيز عيناتك، وستصلك رسالة عند الشحن.", "We've started preparing your samples and will message you when they ship.")}</p>
              <dl className="mt-8 grid grid-cols-2 gap-px bg-paper-200 rounded-2xl overflow-hidden text-start">
                {[
                  { k: t("رقم الطلب", "Order"), v: ref || "—", mono: true },
                  { k: t("المبلغ", "Amount"), v: sar((result.amount ?? price * 100) / 100) },
                  { k: t("الاتجاهات", "Directions"), v: order?.directions.join(" · ") || "—" },
                  { k: t("الشحن", "Shipping"), v: pick(DISCOVERY_KIT.shipping) },
                ].map((x) => (
                  <div key={x.k} className="bg-white p-4">
                    <dt className="text-xs text-paper-500">{x.k}</dt>
                    <dd className={`mt-1 text-ink-900 ${x.mono ? "font-mono" : ""}`} dir={x.mono ? "ltr" : undefined} style={x.mono ? { textAlign: "start" } : undefined}>{x.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-xs text-paper-500">
                {t(`احتفظ برقم الطلب؛ يُخصم المبلغ من مشروعك إن بدأت خلال ${DISCOVERY_KIT.creditDays} يوماً.`, `Keep your order number; the amount is credited if you start a project within ${DISCOVERY_KIT.creditDays} days.`)}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button to="/book" variant="secondary">{t("احجز مكالمة المتابعة", "Book your follow-up call")}</Button>
                <Button to="/services" arrow>{t("استكشف الخدمات", "Explore services")}</Button>
              </div>
            </div>
          )}

          {result && !result.paid && (
            <div role="alert" className="panel-in">
              <span className="w-16 h-16 mx-auto rounded-full bg-sand-soft text-ink-900 flex items-center justify-center">
                <i className="ri-error-warning-line text-3xl" aria-hidden="true"></i>
              </span>
              <h1 className="mt-6 font-display text-3xl text-ink-900">
                {REVIEW.includes(result.status)
                  ? t("لم نتمكن من تأكيد الدفع بعد.", "We couldn't confirm the payment yet.")
                  : t("لم تكتمل عملية الدفع.", "The payment didn't go through.")}
              </h1>
              <p className="mt-3 text-paper-600 leading-[1.8]">
                {result.status === "amount_mismatch"
                  ? t("المبلغ المدفوع لا يطابق سعر الطلب. سيتواصل معك فريقنا لتسوية ذلك.", "The amount paid doesn't match the order. Our team will contact you to sort it out.")
                  : REVIEW.includes(result.status)
                    ? t("إن خُصم المبلغ من حسابك فطلبك بأمان — سنراجعه ونؤكده لك خلال يوم عمل.", "If you were charged, your order is safe — we'll review and confirm it within one business day.")
                    : t("لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى ببطاقة أخرى أو وسيلة دفع مختلفة.", "You haven't been charged. You can try again with another card or payment method.")}
              </p>
              {gatewayMsg && <p className="mt-3 text-sm text-paper-500" dir="auto">{gatewayMsg}</p>}
              {ref && <p className="mt-3 text-sm text-paper-500">{t("رقم الطلب:", "Order:")} <span className="font-mono" dir="ltr">{ref}</span></p>}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {order && result.status !== "amount_mismatch" && result.status !== "needs_review" && (
                  <Button to="/discovery-kit?retry=1" arrow>{t("أعد محاولة الدفع", "Try paying again")}</Button>
                )}
                <Button to="/contact" variant="secondary">{t("تواصل معنا", "Contact us")}</Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <FooterSection />
    </div>
  );
};

export default KitPaidPage;
