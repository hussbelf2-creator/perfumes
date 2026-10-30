import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { submitForm } from "@/lib/forms";
import { SERVICE_TRACKS } from "@/data/services";
import PhoneField from "@/components/feature/PhoneField";

const field =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";

// نموذج التواصل الموحّد — يرسل اسم المسار المختار ليصل الطلب مصنّفاً
export default function ContactForm({ defaultTrack = "" }: { defaultTrack?: string }) {
  const { t, pick } = useI18n();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("loading");
    setErrorMessage("");
    const result = await submitForm("contact", new FormData(form));
    if (result.ok) {
      setStatus("success");
      form.reset();
    } else {
      setErrorMessage(t(result.message, "Couldn't send right now. Please try again shortly."));
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div role="status" className="panel-in min-h-[24rem] flex flex-col justify-center rounded-[1.75rem] border border-paper-200 bg-white p-10">
        <span className="w-12 h-12 rounded-full bg-ink-900 text-white flex items-center justify-center"><i className="ri-check-line text-xl" aria-hidden="true"></i></span>
        <p className="mt-6 font-display text-3xl text-ink-900">{t("شكراً لك.", "Thank you.")}</p>
        <p className="mt-3 text-paper-600">{t("وصلتنا رسالتك، وسنعود إليك خلال يوم عمل.", "We've got your message and will reply within one business day.")}</p>
        <button type="button" onClick={() => setStatus("idle")} className="mt-8 self-start text-sm text-ink-900 border-b border-ink-900/30 pb-1">
          {t("إرسال رسالة أخرى", "Send another message")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative rounded-[1.75rem] border border-paper-200 bg-white p-6 md:p-9">
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="c-first" className="block text-sm text-paper-600 mb-2">{t("الاسم الأول", "First name")}</label>
          <input id="c-first" name="firstName" required autoComplete="given-name" className={field} />
        </div>
        <div>
          <label htmlFor="c-last" className="block text-sm text-paper-600 mb-2">{t("اسم العائلة", "Last name")}</label>
          <input id="c-last" name="lastName" required autoComplete="family-name" className={field} />
        </div>
        <div>
          <label htmlFor="c-email" className="block text-sm text-paper-600 mb-2">{t("البريد الإلكتروني", "Email")}</label>
          <input id="c-email" name="email" type="email" required autoComplete="email" className={field} />
        </div>
        <div>
          <label htmlFor="c-phone" className="block text-sm text-paper-600 mb-2">{t("الجوال (اختياري)", "Mobile (optional)")}</label>
          <PhoneField id="c-phone" name="phone" className={field} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-track" className="block text-sm text-paper-600 mb-2">{t("المسار الذي يهمك", "Track you're interested in")}</label>
          <select id="c-track" name="subject" defaultValue={defaultTrack} className={field}>
            <option value="">{t("لست متأكداً بعد", "Not sure yet")}</option>
            {SERVICE_TRACKS.map((s) => (
              <option key={s.id} value={`${s.id} — ${s.title.en}`}>{pick(s.title)}</option>
            ))}
            <option value="partnership">{t("شراكة", "Partnership")}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-message" className="block text-sm text-paper-600 mb-2">{t("رسالتك", "Your message")}</label>
          <textarea
            id="c-message"
            name="message"
            required
            rows={4}
            maxLength={500}
            placeholder={t("مثال: براند عطور شرقية للرجال، بسعر تجزئة حوالي 250 ر.س", "e.g. An oriental men's line, retailing around SAR 250")}
            className={`${field} resize-none`}
          />
        </div>
      </div>
      <input type="hidden" name="language" value={t("ar", "en")} />
      <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
        <input type="text" name="phone_alt" tabIndex={-1} autoComplete="off" />
      </div>
      {status === "error" && <p role="alert" className="mt-5 text-sm text-red-700">{errorMessage}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-paper-500">{t("لا نبيع بياناتك، ونستخدمها وفق سياسة الخصوصية.", "We never sell your data; see our privacy policy.")}</p>
        <button type="submit" disabled={status === "loading"} className="rounded-full bg-ink-900 hover:bg-ink-700 text-white px-8 py-3.5 transition-colors disabled:opacity-60">
          {status === "loading" ? t("جارٍ الإرسال…", "Sending…") : t("إرسال", "Send")}
        </button>
      </div>
    </form>
  );
}
