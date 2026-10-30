import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { submitForm } from "@/lib/forms";
import { BUDGETS, SPECIALTIES, SPECIALTY_LABELS, type Creative, type Specialty } from "../types";
import PhoneField from "@/components/feature/PhoneField";

const field =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";

/** تصميم مُرفق من استوديو 3D (يصل في الرابط: design=ملخص، link=رابط التركيبة) */
function useStudioAttachment() {
  const [params] = useSearchParams();
  return useMemo(() => {
    const design = params.get("design")?.slice(0, 600) ?? "";
    const link = params.get("link") ?? "";
    // روابط الموقع نفسه فقط
    const safe = link.startsWith(window.location.origin + "/studio-3d") ? link.slice(0, 1500) : "";
    return design ? { design, link: safe } : null;
  }, [params]);
}

export default function BriefForm({ creatives, fixed }: { creatives: Creative[]; fixed?: Creative }) {
  const { t, pick } = useI18n();
  const { user } = useAuth();
  const { lang } = useI18n();
  const studio = useStudioAttachment();
  const [creativeId, setCreativeId] = useState(fixed?.id ?? "");
  const [attach, setAttach] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [sentName, setSentName] = useState("");
  const chosen = fixed ?? creatives.find((c) => c.id === creativeId);
  const services: Specialty[] = chosen ? chosen.specialties : [...SPECIALTIES];
  const today = new Date().toISOString().slice(0, 10);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const message = String(form.get("message") ?? "").trim();
    if (message.length < 20) {
      setError(t("صف مشروعك في 20 حرفاً على الأقل حتى يفهمه المصمم.", "Describe your project in at least 20 characters so the creative understands it."));
      setStatus("error");
      return;
    }
    form.delete("creative_choice");
    if (chosen) {
      form.set("creative", chosen.slug);
      form.set("creative_name", pick(chosen.name));
    }
    if (studio && attach) {
      form.set("studio_design", studio.design);
      if (studio.link) form.set("studio_link", studio.link);
    }
    form.set("language", lang);
    form.set("request_type", "design_brief");
    setStatus("loading");
    setError("");
    const r = await submitForm("design", form);
    if (r.ok) {
      setSentName(String(form.get("firstName") || ""));
      setStatus("done");
    } else {
      setError(t(r.message, "Couldn't send right now. Please try again shortly."));
      setStatus("error");
    }
  };

  if (status === "done")
    return (
      <div role="status" className="panel-in text-center py-8">
        <span className="w-16 h-16 mx-auto rounded-full bg-ink-900 text-white flex items-center justify-center">
          <i className="ri-palette-line text-2xl" aria-hidden="true"></i>
        </span>
        <h3 className="mt-6 font-display text-3xl text-ink-900">{t(`وصل طلبك، ${sentName}.`, `Brief received, ${sentName}.`)}</h3>
        <p className="mt-3 text-paper-600 leading-[1.8] max-w-md mx-auto">
          {chosen
            ? t(`نراجع الملخص مع ${pick(chosen.name)} ونرتّب لك جلسة تعارف خلال يومي عمل.`, `We'll review the brief with ${pick(chosen.name)} and set up an intro session within two business days.`)
            : t("نرشّح لك المصمم الأنسب ونرتّب جلسة تعارف خلال يومي عمل.", "We'll match you with the right creative and set up an intro session within two business days.")}
        </p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="grid sm:grid-cols-2 gap-5">
        {!fixed && (
          <div className="sm:col-span-2">
            <label htmlFor="br-creative" className="block text-sm text-paper-600 mb-2">{t("المصمم", "Creative")}</label>
            <select id="br-creative" name="creative_choice" value={creativeId} onChange={(e) => setCreativeId(e.target.value)} className={field}>
              <option value="">{t("رشّحوا لي المصمم الأنسب", "Match me with the right creative")}</option>
              {creatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {pick(c.name)}
                  {!c.available ? ` — ${t("جدوله ممتلئ", "fully booked")}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="br-first" className="block text-sm text-paper-600 mb-2">{t("الاسم الأول", "First name")}</label>
          <input id="br-first" name="firstName" required maxLength={60} autoComplete="given-name" defaultValue={user?.firstName} className={field} />
        </div>
        <div>
          <label htmlFor="br-last" className="block text-sm text-paper-600 mb-2">{t("اسم العائلة", "Last name")}</label>
          <input id="br-last" name="lastName" required maxLength={60} autoComplete="family-name" defaultValue={user?.lastName} className={field} />
        </div>
        <div>
          <label htmlFor="br-email" className="block text-sm text-paper-600 mb-2">{t("البريد الإلكتروني", "Email")}</label>
          <input id="br-email" name="email" type="email" required maxLength={120} autoComplete="email" defaultValue={user?.email} className={field} />
        </div>
        <div>
          <label htmlFor="br-phone" className="block text-sm text-paper-600 mb-2">{t("الجوال (اختياري)", "Mobile (optional)")}</label>
          <PhoneField id="br-phone" name="phone" className={field} />
        </div>
        <div>
          <label htmlFor="br-service" className="block text-sm text-paper-600 mb-2">{t("ما الذي تحتاجه؟", "What do you need?")}</label>
          <select key={chosen?.id ?? "any"} id="br-service" name="service" required defaultValue={services[0]} className={field}>
            {services.map((s) => (
              <option key={s} value={s}>{pick(SPECIALTY_LABELS[s])}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="br-budget" className="block text-sm text-paper-600 mb-2">{t("الميزانية التقريبية", "Approximate budget")}</label>
          <select id="br-budget" name="budget" defaultValue="unsure" className={field}>
            {BUDGETS.map((b) => (
              <option key={b.id} value={b.id}>{pick(b.label)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="br-deadline" className="block text-sm text-paper-600 mb-2">{t("متى تحتاجه؟ (اختياري)", "When do you need it? (optional)")}</label>
          <input id="br-deadline" name="deadline" type="date" min={today} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="br-msg" className="block text-sm text-paper-600 mb-2">{t("صف مشروعك", "Describe your project")}</label>
          <textarea
            id="br-msg"
            name="message"
            required
            rows={4}
            minLength={20}
            maxLength={1500}
            className={`${field} resize-none`}
            placeholder={t("مثال: براند عود للرجال، نحتاج شعاراً وملصقاً وعلبة مغناطيسية سوداء بفويل ذهبي، والإطلاق في رمضان.", "e.g. An oud brand for men: we need a logo, a label and a black magnetic box with gold foil, launching in Ramadan.")}
          />
        </div>
        {studio && (
          <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl bg-sand-soft p-4 cursor-pointer">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="mt-1 w-4 h-4 accent-ink-900" />
            <span className="min-w-0">
              <span className="block text-sm text-ink-900">{t("أرفق تصميمي من استوديو 3D", "Attach my 3D studio design")}</span>
              <span className="block mt-1 text-xs text-paper-600 leading-[1.7] break-words">{studio.design}</span>
            </span>
          </label>
        )}
      </div>
      <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
        <input type="text" name="phone_alt" tabIndex={-1} autoComplete="off" />
      </div>
      {status === "error" && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-paper-500 max-w-xs">{t("لا التزام بالدفع الآن: نبدأ بجلسة تعارف وعرض سعر واضح.", "No payment now: we start with an intro session and a clear quote.")}</p>
        <Button type="submit" disabled={status === "loading"} arrow>
          {status === "loading" ? t("جاري الإرسال…", "Sending…") : chosen ? t(`أرسل الطلب إلى ${pick(chosen.name).split(" ·")[0]}`, `Send brief to ${pick(chosen.name).split(" ·")[0]}`) : t("أرسل الطلب", "Send brief")}
        </Button>
      </div>
    </form>
  );
}
