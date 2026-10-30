import { PAYMENTS } from "@/config/payments";

// نموذج مويسر يُحمَّل من CDN عند الحاجة فقط — لا يثقل الصفحات الأخرى
interface MoyasarInit {
  element: HTMLElement | string;
  amount: number;
  currency: "SAR";
  description: string;
  publishable_api_key: string;
  callback_url: string;
  language?: "ar" | "en";
  methods?: readonly string[];
  supported_networks?: readonly string[];
  metadata?: Record<string, string>;
  apple_pay?: { country: string; label: string; validate_merchant_url: string };
  on_completed?: (payment: { id: string; status: string }) => Promise<void> | void;
}

declare global {
  interface Window {
    Moyasar?: { init: (opts: MoyasarInit) => void };
  }
}

let loading: Promise<void> | null = null;

export function loadMoyasar(): Promise<void> {
  if (window.Moyasar) return Promise.resolve();
  if (loading) return loading;
  const base = `https://cdn.moyasar.com/mpf/${PAYMENTS.sdkVersion}`;
  loading = new Promise<void>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${base}/moyasar.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `${base}/moyasar.js`;
    s.async = true;
    s.onload = () => (window.Moyasar ? resolve() : reject(new Error("Moyasar unavailable")));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Moyasar failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type MoyasarInitOptions = MoyasarInit;

export interface VerifyResult {
  paid: boolean;
  status: string;
  amount?: number;
  ref?: string;
  id?: string;
  message?: string;
}

/** التحقق يتم على الخادم بالمفتاح السري — لا نثق بمعاملات الرابط وحدها */
export async function verifyPayment(id: string): Promise<VerifyResult> {
  try {
    const r = await fetch(`${PAYMENTS.verifyUrl}?id=${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    const data = (await r.json()) as VerifyResult;
    return data;
  } catch {
    return { paid: false, status: "unverified" };
  }
}

// الطلب المعلّق يُحفظ في الجلسة: يتيح إعادة محاولة الدفع دون إعادة تعبئة البيانات
export interface PendingKitOrder {
  ref: string;
  name: string;
  email: string;
  directions: string[];
  amount: number;
  /** كوبون مقبول وسعر الدفع بعده (ر.س) */
  coupon?: string | null;
  payable?: number | null;
}

const KEY = "pp_kit_order";

export function savePendingOrder(o: PendingKitOrder) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* التخزين غير متاح — يبقى الطلب في الذاكرة فقط */
  }
}

export function readPendingOrder(): PendingKitOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingKitOrder) : null;
  } catch {
    return null;
  }
}

export function clearPendingOrder() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* لا شيء */
  }
}

/** رقم طلب قصير مقروء: KIT-7F3K9Q */
export function newOrderRef(prefix = "KIT") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}
