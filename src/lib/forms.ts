import { supabase } from "@/lib/supabase";
import { TURNSTILE_SITE_KEY, turnstileToken } from "@/lib/turnstile";

export type FormKind = "contact" | "consultation" | "newsletter" | "booking" | "kit" | "design" | "brief";

// نقاط الإرسال الحالية (Readdy) — يمكن استبدالها بمتغيرات البيئة دون تعديل الكود
const ENDPOINTS: Record<FormKind, string> = {
  contact: import.meta.env.VITE_CONTACT_FORM_URL || "https://readdy.ai/api/form/d980tsfk7gok24d49v30",
  consultation: import.meta.env.VITE_CONSULTATION_FORM_URL || "https://readdy.ai/api/form/d94lp2dmi650so75e4vg",
  newsletter: import.meta.env.VITE_NEWSLETTER_FORM_URL || "https://readdy.ai/api/form/d94lp2dmi650so75e500",
  // الحجوزات وطلبات العينة تصل لنفس صندوق التواصل حتى تُضبط نقاط مستقلة
  booking: import.meta.env.VITE_BOOKING_FORM_URL || import.meta.env.VITE_CONTACT_FORM_URL || "https://readdy.ai/api/form/d980tsfk7gok24d49v30",
  kit: import.meta.env.VITE_KIT_FORM_URL || import.meta.env.VITE_CONTACT_FORM_URL || "https://readdy.ai/api/form/d980tsfk7gok24d49v30",
  brief: import.meta.env.VITE_BRIEF_FORM_URL || import.meta.env.VITE_CONTACT_FORM_URL || "https://readdy.ai/api/form/d980tsfk7gok24d49v30",
  design: import.meta.env.VITE_DESIGN_FORM_URL || import.meta.env.VITE_CONTACT_FORM_URL || "https://readdy.ai/api/form/d980tsfk7gok24d49v30",
};

const HONEYPOT_FIELDS = ["phone_alt", "website_alt"];

const RATE_LIMITED = "وصلنا عدد كبير من الطلبات منك. انتظر بضع دقائق ثم حاول مرة أخرى.";
const CAPTCHA_FAILED = "تعذّر التحقق من أنك لست روبوتاً. حدّث الصفحة ثم حاول مرة أخرى.";

/** الزائر غير المسجل يمر بالتحقق البشري إن ضُبط مفتاحه؛ المسجّل يرسل مباشرة */
async function insertLead(kind: FormKind, payload: Record<string, string>): Promise<SubmitResult> {
  const page = window.location.pathname;
  const { data } = await supabase!.auth.getSession();
  if (TURNSTILE_SITE_KEY && !data.session) {
    let token: string;
    try {
      token = await turnstileToken(document.documentElement.lang === "en" ? "en" : "ar");
    } catch {
      return { ok: false, message: CAPTCHA_FAILED };
    }
    const r = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload, page, token }) });
    if (r.ok) return { ok: true, message: "" };
    const { error } = (await r.json().catch(() => ({}))) as { error?: string };
    if (error === "rate_limited") return { ok: false, message: RATE_LIMITED };
    if (error === "captcha_failed") return { ok: false, message: CAPTCHA_FAILED };
    throw new Error(error || "failed");
  }
  const { error } = await supabase!.from("leads").insert({ kind, payload, page });
  if (error?.message.includes("rate_limited")) return { ok: false, message: RATE_LIMITED };
  if (error) throw error;
  return { ok: true, message: "" };
}

export interface SubmitResult {
  ok: boolean;
  message: string;
}

/**
 * يرسل بيانات النموذج: إلى جدول `leads` في Supabase إن كان مفعّلاً، وإلا إلى نقطة الإرسال المهيأة.
 */
export async function submitForm(kind: FormKind, formData: FormData, endpoint?: string): Promise<SubmitResult> {
  const honeypot = HONEYPOT_FIELDS.map((f) => formData.get(f)).some((v) => v && String(v).trim() !== "");
  HONEYPOT_FIELDS.forEach((f) => formData.delete(f));
  if (honeypot) {
    // روبوت سبام — نتظاهر بالنجاح دون إرسال
    return { ok: true, message: "" };
  }

  const payload: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") payload[key] = value.trim();
  });

  try {
    if (supabase) return await insertLead(kind, payload);

    const response = await fetch(endpoint || ENDPOINTS[kind], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });
    const text = await response.text();
    let parsed: { code?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (response.ok && (!parsed || !parsed.code || parsed.code === "OK")) {
      // الوضع التجريبي: يظهر الطلب في صندوق وارد لوحة الإدارة على هذا المتصفح
      // (في Supabase يربطه مُشغّل قاعدة البيانات بالعميل تلقائياً)
      if (kind !== "newsletter") {
        await import("@/admin/data/localRepo").then((m) => m.ingestDemoLead(kind, payload, window.location.pathname)).catch(() => undefined);
      }
      return { ok: true, message: "" };
    }
    return { ok: false, message: "تعذّر الإرسال حالياً. يرجى المحاولة مرة أخرى بعد قليل." };
  } catch {
    return { ok: false, message: "تعذّر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى." };
  }
}
