// الدفع الإلكتروني عبر Moyasar (مدى، فيزا/ماستركارد، Apple Pay، STC Pay)
// بدون المفتاح العام يعود الموقع لمسار "سنتواصل معك لإتمام الدفع"
const publishableKey = (import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY as string | undefined) || "";

export const PAYMENTS = {
  enabled: publishableKey.startsWith("pk_"),
  publishableKey,
  testMode: publishableKey.startsWith("pk_test_"),
  /** نسخة نموذج الدفع من CDN مويسر — حدّثها بعد مراجعة سجل الإصدارات */
  sdkVersion: (import.meta.env.VITE_MOYASAR_SDK_VERSION as string | undefined) || "1.14.0",
  methods: ["creditcard", "applepay", "stcpay"] as const,
  networks: ["mada", "visa", "mastercard"] as const,
  /** نقطة التحقق من الدفع على الخادم (Vercel Function) */
  verifyUrl: "/api/payments/verify",
};

/** الريال → هللة (مويسر تستقبل أصغر وحدة) */
export const toHalalas = (sar: number) => Math.round(sar * 100);
