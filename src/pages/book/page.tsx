import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import Button from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { submitForm } from "@/lib/forms";
import { upcomingDays, googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import { DISCOVERY_CALL } from "@/config/offers";
import { useContent } from "@/cms/ContentProvider";
import { SERVICE_TRACKS } from "@/data/services";
import { PHOTOS } from "@/lib/photos";
import LegalConsent from "@/components/feature/LegalConsent";
import PhoneField from "@/components/feature/PhoneField";

type Channel = "video" | "phone" | "whatsapp";

const field =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";

const BookPage = () => {
  const { t, pick, lang } = useI18n();
  const { user } = useAuth();
  const [params] = useSearchParams();
  // المدة والمواعيد من «محتوى الموقع»؛ رابط التقويم الخارجي من متغير البيئة
  const call = useContent("offers").call;
  const days = useMemo(() => upcomingDays(new Date(), call), [call]);
  const [dayKey, setDayKey] = useState(days[0]?.key ?? "");
  const [time, setTime] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("video");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<{ start: Date; name: string } | null>(null);

  const day = days.find((d) => d.key === dayKey);
  const slot = day?.slots.find((s) => s.time === time && !s.past);
  const locale = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  const fmtDay = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, { timeZone: "Asia/Riyadh", ...opts });
  const fmtTime = (d: Date) => d.toLocaleTimeString(locale, { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" });
  const localTime = (d: Date) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const userInRiyadh = Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Riyadh";

  const channels: { id: Channel; icon: string; label: string }[] = [
    { id: "video", icon: "ri-vidicon-line", label: t("مكالمة فيديو", "Video call") },
    { id: "phone", icon: "ri-phone-line", label: t("اتصال هاتفي", "Phone call") },
    { id: "whatsapp", icon: "ri-whatsapp-line", label: t("واتساب", "WhatsApp") },
  ];

  const title = t("مكالمة اكتشاف — منصة العطور", "Discovery call — Perfume Platform");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slot) return;
    const form = new FormData(e.currentTarget);
    form.set("slot_riyadh", `${dayKey} ${time} (Asia/Riyadh)`);
    form.set("slot_utc", slot.start.toISOString());
    form.set("channel", channel);
    form.set("language", lang);
    form.set("request_type", "discovery_call");
    setStatus("loading");
    setError("");
    const r = await submitForm("booking", form);
    if (r.ok) {
      setBooked({ start: slot.start, name: String(form.get("firstName") || "") });
      setStep(3);
      setStatus("idle");
    } else {
      setError(t(r.message, "Couldn't book right now. Please try again shortly."));
      setStatus("error");
    }
  };

  const agenda = [
    { icon: "ri-lightbulb-flash-line", text: t("نسمع فكرتك وجمهورك والسعر الذي تتخيله", "We hear your idea, audience and target price") },
    { icon: "ri-route-line", text: t("نقترح المسار الأنسب ومدته", "We suggest the right track and its timeline") },
    { icon: "ri-calculator-line", text: t("نعطيك نطاق تكلفة تقديرياً", "We give you an estimated cost range") },
    { icon: "ri-file-list-3-line", text: t("تصلك خلاصة مكتوبة بعد المكالمة", "You get a written summary afterwards") },
  ];

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("مكالمة اكتشاف مجانية", "Free discovery call")}
        title={<>{t(`${call.minutes} دقيقة`, `${call.minutes} minutes`)} <span className="text-paper-400">{t("تختصر عليك أسابيع.", "that save you weeks.")}</span></>}
        intro={t(
          "تحدّث مع مختص قبل أي التزام: نفهم فكرتك، ونقترح المسار والمدة ونطاق التكلفة. بلا رسوم وبلا التزام.",
          "Talk to a specialist before committing to anything: we understand your idea and suggest the track, timeline and cost range. Free, no obligation.",
        )}
      />

      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-8 items-start">
        {/* ماذا يحدث في المكالمة */}
        <Reveal className="lg:col-span-5 min-w-0 space-y-6">
          <div className="rounded-[1.75rem] overflow-hidden">
            <Photo src={PHOTOS.consult} alt={t("جلسة اكتشاف حول لوحة مرجعية لبراند عطري", "Discovery session around a fragrance moodboard")} className="aspect-[16/10]" zoom />
          </div>
          <div className="rounded-[1.75rem] bg-white border border-paper-200 p-7">
            <p className="text-sm text-paper-500">{t("ماذا يحدث في المكالمة", "What happens on the call")}</p>
            <ul className="mt-5 space-y-4">
              {agenda.map((a) => (
                <li key={a.text} className="flex gap-3 text-ink-900">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-sand-soft flex items-center justify-center"><i className={a.icon} aria-hidden="true"></i></span>
                  <span className="pt-1.5">{a.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-paper-200 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper-600">
              <span className="inline-flex items-center gap-2"><i className="ri-time-line" aria-hidden="true"></i>{t(`${call.minutes} دقيقة`, `${call.minutes} minutes`)}</span>
              <span className="inline-flex items-center gap-2"><i className="ri-price-tag-3-line" aria-hidden="true"></i>{t("مجانية", "Free")}</span>
              <span className="inline-flex items-center gap-2"><i className="ri-translate-2" aria-hidden="true"></i>{t("بالعربية أو الإنجليزية", "Arabic or English")}</span>
            </div>
          </div>
        </Reveal>

        {/* الحجز */}
        <Reveal index={1} className="lg:col-span-7 min-w-0 order-first lg:order-none">
          <div className="rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-9">
            {DISCOVERY_CALL.externalUrl ? (
              // تقويم خارجي (Cal.com / Calendly) يعرض التوفر الفعلي للفريق
              <div className="text-center py-6">
                <span className="w-16 h-16 mx-auto rounded-full bg-sand-soft text-ink-900 flex items-center justify-center">
                  <i className="ri-calendar-schedule-line text-2xl" aria-hidden="true"></i>
                </span>
                <h2 className="mt-6 font-display text-3xl text-ink-900">{t("اختر موعدك من تقويمنا", "Pick a time on our calendar")}</h2>
                <p className="mt-3 text-paper-600">{t("يعرض التقويم الأوقات المتاحة فعلياً، ويصلك التأكيد ورابط المكالمة فوراً.", "The calendar shows real availability, and you get the confirmation and call link instantly.")}</p>
                <div className="mt-8 flex justify-center">
                  <Button href={DISCOVERY_CALL.externalUrl} arrow>{t("افتح التقويم", "Open the calendar")}</Button>
                </div>
              </div>
            ) : (
            <>
            {step !== 3 && (
              <ol className="flex items-center gap-3 mb-8 text-sm" aria-label={t("خطوات الحجز", "Booking steps")}>
                {[t("الموعد", "Time"), t("بياناتك", "Your details")].map((s, i) => (
                  <li key={s} className={`flex items-center gap-2 ${step === i + 1 ? "text-ink-900" : "text-paper-400"}`} aria-current={step === i + 1 ? "step" : undefined}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs ${step === i + 1 ? "bg-ink-900 text-white" : step > i + 1 ? "bg-accent2 text-white" : "bg-paper-100"}`}>
                      {step > i + 1 ? <i className="ri-check-line" aria-hidden="true"></i> : i + 1}
                    </span>
                    {s}
                    {i === 0 && <span className="w-8 h-px bg-paper-300 ms-1" aria-hidden="true" />}
                  </li>
                ))}
              </ol>
            )}

            {step === 1 && (
              <div className="panel-in">
                <h2 className="font-display text-2xl text-ink-900">{t("اختر اليوم", "Pick a day")}</h2>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="radiogroup" aria-label={t("اختر اليوم", "Pick a day")}>
                  {days.map((d) => {
                    const on = d.key === dayKey;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setDayKey(d.key);
                          setTime("");
                        }}
                        className={`shrink-0 w-[4.75rem] rounded-2xl border py-3 text-center transition-colors ${on ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 hover:border-ink-900"}`}
                      >
                        <span className={`block text-xs ${on ? "text-white/70" : "text-paper-500"}`}>{fmtDay(d.date, { weekday: "short" })}</span>
                        <span className="block font-display text-2xl mt-0.5">{fmtDay(d.date, { day: "numeric" })}</span>
                        <span className={`block text-xs ${on ? "text-white/70" : "text-paper-500"}`}>{fmtDay(d.date, { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-2xl text-ink-900">{t("اختر الوقت", "Pick a time")}</h2>
                  <span className="text-xs text-paper-500">{t("بتوقيت الرياض", "Riyadh time (GMT+3)")}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2" role="radiogroup" aria-label={t("اختر الوقت", "Pick a time")}>
                  {day?.slots.map((s) => {
                    const on = s.time === time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={s.past}
                        onClick={() => setTime(s.time)}
                        className={`rounded-xl border py-3 text-sm transition-colors disabled:opacity-35 disabled:line-through ${on ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 hover:border-ink-900"}`}
                      >
                        {fmtTime(s.start)}
                      </button>
                    );
                  })}
                </div>
                {slot && !userInRiyadh && (
                  <p className="mt-3 text-xs text-paper-500">{t("أي في توقيتك المحلي:", "That's in your local time:")} {localTime(slot.start)}</p>
                )}

                <h2 className="mt-8 font-display text-2xl text-ink-900">{t("كيف نتواصل؟", "How should we connect?")}</h2>
                <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("كيف نتواصل؟", "How should we connect?")}>
                  {channels.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={channel === c.id}
                      onClick={() => setChannel(c.id)}
                      className={`rounded-2xl border p-4 flex flex-col items-center gap-2 text-sm transition-colors ${channel === c.id ? "border-ink-900 bg-paper-50 text-ink-900" : "border-paper-200 text-paper-600 hover:border-paper-400"}`}
                    >
                      <i className={`${c.icon} text-xl`} aria-hidden="true"></i>
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-paper-600" aria-live="polite">
                    {slot ? `${fmtDay(slot.start, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(slot.start)}` : t("اختر يوماً ووقتاً للمتابعة", "Choose a day and time to continue")}
                  </p>
                  <Button onClick={() => slot && setStep(2)} disabled={!slot} arrow>{t("التالي", "Next")}</Button>
                </div>
              </div>
            )}

            {step === 2 && slot && (
              <form onSubmit={onSubmit} className="panel-in">
                <button type="button" onClick={() => setStep(1)} className="mb-6 inline-flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm text-ink-900">
                  <i className="ri-calendar-event-line" aria-hidden="true"></i>
                  {fmtDay(slot.start, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(slot.start)}
                  <span className="text-paper-500 underline underline-offset-4 ms-2">{t("تغيير", "Change")}</span>
                </button>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="b-first" className="block text-sm text-paper-600 mb-2">{t("الاسم الأول", "First name")}</label>
                    <input id="b-first" name="firstName" required autoComplete="given-name" defaultValue={user?.firstName} className={field} />
                  </div>
                  <div>
                    <label htmlFor="b-last" className="block text-sm text-paper-600 mb-2">{t("اسم العائلة", "Last name")}</label>
                    <input id="b-last" name="lastName" required autoComplete="family-name" defaultValue={user?.lastName} className={field} />
                  </div>
                  <div>
                    <label htmlFor="b-email" className="block text-sm text-paper-600 mb-2">{t("البريد الإلكتروني", "Email")}</label>
                    <input id="b-email" name="email" type="email" required autoComplete="email" defaultValue={user?.email} className={field} />
                  </div>
                  <div>
                    <label htmlFor="b-phone" className="block text-sm text-paper-600 mb-2">
                      {channel === "video" ? t("الجوال (اختياري)", "Mobile (optional)") : t("الجوال", "Mobile")}
                    </label>
                    <PhoneField id="b-phone" name="phone" required={channel !== "video"} className={field} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="b-track" className="block text-sm text-paper-600 mb-2">{t("ما الذي يهمك؟", "What are you interested in?")}</label>
                    <select id="b-track" name="subject" defaultValue={params.get("track") ? `${params.get("track")}` : ""} className={field}>
                      <option value="">{t("لست متأكداً بعد", "Not sure yet")}</option>
                      {SERVICE_TRACKS.map((s) => (
                        <option key={s.id} value={s.id}>{pick(s.title)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="b-notes" className="block text-sm text-paper-600 mb-2">{t("نبذة عن فكرتك (اختياري)", "A line about your idea (optional)")}</label>
                    <textarea id="b-notes" name="message" rows={3} maxLength={400} defaultValue={params.get("note")?.slice(0, 400) ?? undefined} className={`${field} resize-none`} placeholder={t("مثال: عطر عودي للرجال بسعر 300 ريال", "e.g. An oud scent for men at SAR 300")} />
                  </div>
                </div>
                <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
                  <input type="text" name="phone_alt" tabIndex={-1} autoComplete="off" />
                </div>
                {status === "error" && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-xs space-y-1">
                    <p className="text-xs text-paper-500">{t("سيصلك تأكيد الموعد ورابط المكالمة على بريدك.", "You'll receive the confirmation and call link by email.")}</p>
                    <LegalConsent action={{ ar: "بالحجز", en: "booking" }} />
                  </div>
                  <Button type="submit" disabled={status === "loading"} arrow>
                    {status === "loading" ? t("جارٍ الحجز…", "Booking…") : t("تأكيد الحجز", "Confirm booking")}
                  </Button>
                </div>
              </form>
            )}

            {step === 3 && booked && (
              <div role="status" className="panel-in text-center py-6">
                <span className="w-16 h-16 mx-auto rounded-full bg-ink-900 text-white flex items-center justify-center">
                  <i className="ri-calendar-check-line text-2xl" aria-hidden="true"></i>
                </span>
                <h2 className="mt-6 font-display text-3xl text-ink-900">{t(`استلمنا طلب الموعد، ${booked.name}.`, `Request received, ${booked.name}.`)}</h2>
                <p className="mt-3 text-lg text-paper-700">
                  {fmtDay(booked.start, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(booked.start)} {t("بتوقيت الرياض", "Riyadh time")}
                </p>
                <p className="mt-2 text-sm text-paper-500">{t("سيؤكد فريقنا الموعد ويرسل رابط المكالمة خلال ساعات العمل.", "Our team will confirm and send the call link within business hours.")}</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <a href={googleCalendarUrl(title, booked.start, call.minutes, t("مكالمة اكتشاف لبراندك العطري", "Discovery call for your fragrance brand"))} target="_blank" rel="noopener noreferrer" className="rounded-full border border-paper-300 hover:border-ink-900 px-5 py-3 text-sm text-ink-900 inline-flex items-center gap-2">
                    <i className="ri-google-line" aria-hidden="true"></i>
                    {t("أضف إلى Google Calendar", "Add to Google Calendar")}
                  </a>
                  <a href={icsDataUrl(title, booked.start, call.minutes, t("مكالمة اكتشاف لبراندك العطري", "Discovery call for your fragrance brand"))} download="discovery-call.ics" className="rounded-full border border-paper-300 hover:border-ink-900 px-5 py-3 text-sm text-ink-900 inline-flex items-center gap-2">
                    <i className="ri-calendar-2-line" aria-hidden="true"></i>
                    {t("Apple / Outlook", "Apple / Outlook")}
                  </a>
                </div>
                <div className="mt-10 pt-8 border-t border-paper-200">
                  <p className="text-sm text-paper-600">{t("حتى موعد المكالمة، جرّب الحاسبة أو اطلب عينة الاكتشاف.", "Before the call, try the calculator or order the discovery kit.")}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Button to="/pricing" variant="secondary">{t("حاسبة التكلفة", "Cost calculator")}</Button>
                    <Button to="/discovery-kit" variant="primary" arrow>{t("عينة الاكتشاف", "Discovery kit")}</Button>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </Reveal>
      </main>
      <FooterSection />
    </div>
  );
};

export default BookPage;
