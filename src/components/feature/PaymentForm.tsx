import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { PAYMENTS, toHalalas } from "@/config/payments";
import { loadMoyasar } from "@/lib/payments";

interface PaymentFormProps {
  amountSar: number;
  description: string;
  /** صفحة العودة بعد الدفع؛ مويسر يضيف إليها id وstatus وmessage */
  callbackPath: string;
  metadata: Record<string, string>;
}

// غلاف نموذج مويسر: تحميل كسول، حالة تحميل، وبديل واضح إن تعذّر الوصول للبوابة
export default function PaymentForm({ amountSar, description, callbackPath, metadata }: PaymentFormProps) {
  const { t, lang, sar, num } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const meta = JSON.stringify(metadata);

  useEffect(() => {
    let cancelled = false;
    loadMoyasar()
      .then(() => {
        if (cancelled || !host.current || !window.Moyasar) return;
        host.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.className = "mysr-form";
        host.current.appendChild(mount);
        window.Moyasar.init({
          element: mount,
          amount: toHalalas(amountSar),
          currency: "SAR",
          description,
          publishable_api_key: PAYMENTS.publishableKey,
          callback_url: `${window.location.origin}${callbackPath}`,
          language: lang,
          methods: PAYMENTS.methods,
          supported_networks: PAYMENTS.networks,
          metadata: JSON.parse(meta) as Record<string, string>,
          apple_pay: { country: "SA", label: description, validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate" },
        });
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [amountSar, description, callbackPath, meta, lang]);

  return (
    <div>
      {PAYMENTS.testMode && (
        <p className="mb-4 rounded-xl bg-sand-soft px-4 py-2.5 text-xs text-ink-900">
          {t("وضع الاختبار: استخدم بطاقة مويسر التجريبية", "Test mode: use Moyasar's test card")}{" "}
          <bdi dir="ltr" className="font-mono">4111 1111 1111 1111</bdi>
          {t(" — لن يُخصم مبلغ حقيقي.", " — no real charge.")}
        </p>
      )}
      {state === "loading" && (
        <div className="space-y-3" aria-busy="true" aria-label={t("جاري تحميل نموذج الدفع", "Loading payment form")}>
          <div className="h-12 rounded-xl shimmer bg-paper-100" />
          <div className="h-12 rounded-xl shimmer bg-paper-100" />
          <div className="h-12 rounded-xl shimmer bg-paper-100" />
        </div>
      )}
      {state === "error" && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("تعذّر تحميل بوابة الدفع. طلبك محفوظ — سنتواصل معك لإتمام الدفع، أو أعد تحميل الصفحة.", "The payment gateway didn't load. Your order is saved — we'll contact you to complete payment, or reload the page.")}
        </p>
      )}
      <div ref={host} className="pp-moyasar" dir={lang === "ar" ? "rtl" : "ltr"} />
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-paper-500">
        <span className="inline-flex items-center gap-1.5"><i className="ri-lock-2-line" aria-hidden="true"></i>{t("دفع مشفّر عبر مويسر", "Encrypted payment via Moyasar")}</span>
        <span>{t("مدى · فيزا · ماستركارد · Apple Pay · STC Pay", "mada · Visa · Mastercard · Apple Pay · STC Pay")}</span>
        <span className="ms-auto">{Number.isInteger(amountSar) ? sar(amountSar) : t(`${num(amountSar, 2)} ر.س`, `SAR ${num(amountSar, 2)}`)}</span>
      </div>
    </div>
  );
}
