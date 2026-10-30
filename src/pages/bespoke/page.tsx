import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import Button from "@/components/ui/Button";
import LegalConsent from "@/components/feature/LegalConsent";
import AccountAfterRequest from "@/start/AccountAfterRequest";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { useContent } from "@/cms/ContentProvider";
import { submitForm } from "@/lib/forms";
import { upcomingDays } from "@/lib/calendar";
import { SITE, whatsappLink } from "@/config/site";
import { phoneOk } from "@/start/briefs";
import PhoneField from "@/components/feature/PhoneField";
import { formatPhone } from "@/lib/phone";
import { PERSONAL_TRACK } from "@/data/tracks";
import { serviceById } from "@/data/services";
import WorkspaceBar, { useCompleteWork, type WorkDraft } from "@/start/WorkspaceBar";
import { useBespokeRates } from "@/pricing/usePrices";
import { CONCENTRATIONS, FAMILIES, LAYERS, MAX_PER_LAYER, MODES, NAME_MAX, NOTES, PRESETS, PURPOSES, type Family, type Mode } from "@/bespoke/notes";
import { EMPTY, analyze, estimate, inLayer, startingPrice, toPayload, toggleNote, whatsappText, withConcentration, type Composition } from "@/bespoke/compose";
import { arCount, enCount } from "@/i18n/plural";

// «عطرك الخاص»: خدمة مستقلة للأفراد. يكوّن العميل هرمه العطري من مكتبة المكونات (مع قراءة فورية للتوازن والسعر)،
// ثم يحجز جلسة مع مستشار التكوين. الطلب يصل كبريف للمسار P فيصير مشروعاً في حسابه: محادثة المستشار، العينات، العرض والعربون.

const field =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";
const DRAFT = "pp_bespoke";

interface Draft {
  comp: Composition;
  mode: Mode;
  contact: { firstName: string; lastName: string; email: string; phone: string; country?: string };
  message: string;
}
function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function Pyramid({ comp }: { comp: Composition }) {
  const { t, pick } = useI18n();
  const widths = { top: "w-[55%]", heart: "w-[78%]", base: "w-full" };
  return (
    <div className="space-y-1.5" aria-label={t("هرم عطرك", "Your scent pyramid")}>
      {LAYERS.map((l) => {
        const list = inLayer(comp, l.id);
        return (
          <div key={l.id} className={`${widths[l.id]} mx-auto rounded-xl px-3 py-2.5 text-center ${list.length ? "bg-ink-900 text-white" : "bg-paper-100 text-paper-400"}`} data-testid={`pyr-${l.id}`}>
            <p className={`text-[10px] ${list.length ? "text-white/60" : ""}`}>{pick(l.label)}</p>
            <p className="text-sm leading-snug">{list.length ? list.map((x) => pick(x.name)).join(" · ") : t("لم تختر بعد", "Not chosen yet")}</p>
          </div>
        );
      })}
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const { t, num } = useI18n();
  const labels = [t("كوّن عطرك", "Compose"), t("جلسة المستشار", "Consultation"), t("تم", "Done")];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-2 text-sm" aria-label={t("خطوات الطلب", "Request steps")}>
      {labels.map((l, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "next";
        return (
          <li key={l} className="flex items-center gap-2 sm:gap-3" aria-current={state === "current" ? "step" : undefined}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${state === "next" ? "border border-paper-300 text-paper-500" : "bg-ink-900 text-white"}`}>
              {state === "done" ? <i className="ri-check-line" aria-hidden="true"></i> : num(n)}
            </span>
            <span className={state === "next" ? "text-paper-500" : "text-ink-900"}>{l}</span>
            {i < labels.length - 1 && <span className="w-3 sm:w-10 h-px bg-paper-300" aria-hidden="true"></span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function BespokePage() {
  const { t, pick, num, lang, isAr } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rates = useBespokeRates();
  const site = useContent("site");
  const call = useContent("offers").call;
  const days = useMemo(() => upcomingDays(new Date(), call), [call]);
  const isClient = !!user && user.role === "client";
  // لوحة عمل مسار «تطوير التركيبة» للبراندات (?track=B): المكوّن نفسه، لكن الإكمال يذهب إلى بريف المسار لا إلى جلسة الأفراد
  const brandTrack = params.get("track") === "B" ? serviceById("B") : undefined;
  const completeWork = useCompleteWork(brandTrack?.id);

  const initial = useMemo<Draft>(() => {
    const saved = readDraft();
    const preset = PRESETS.find((p) => p.id === params.get("preset"));
    return {
      comp: preset ? { ...(saved?.comp ?? EMPTY), notes: preset.notes } : (saved?.comp ?? EMPTY),
      mode: saved?.mode ?? "video",
      contact: saved?.contact ?? { firstName: "", lastName: "", email: "", phone: "" },
      message: saved?.message ?? "",
    };
  }, [params]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [comp, setComp] = useState<Composition>(initial.comp);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [contact, setContact] = useState(initial.contact);
  const [message, setMessage] = useState(initial.message);
  const [family, setFamily] = useState<Family | "all">("all");
  const [dayKey, setDayKey] = useState(days[0]?.key ?? "");
  const [time, setTime] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);

  const reading = useMemo(() => analyze(comp), [comp]);
  const price = useMemo(() => estimate(comp, rates), [comp, rates]);
  const conc = CONCENTRATIONS.find((x) => x.id === comp.conc)!;
  const day = days.find((d) => d.key === dayKey);
  const slot = day?.slots.find((s) => s.time === time && !s.past);
  const needsSlot = mode !== "whatsapp";
  const money = (n: number) => { const d = Number.isInteger(n) ? 0 : 2; return t(`${num(n, d)} ر.س`, `SAR ${num(n, d)}`); };
  const locale = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  const fmtDay = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, { timeZone: "Asia/Riyadh", ...o });
  const fmtTime = (d: Date) => d.toLocaleTimeString(locale, { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    document.title = `${pick(PERSONAL_TRACK.title)} | ${t("منصة العطور", "Perfume Platform")}`;
  }, [pick, t]);

  useEffect(() => {
    if (step === 3) return;
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify({ comp, mode, contact, message }));
    } catch {
      /* التخزين غير متاح */
    }
  }, [comp, mode, contact, message, step]);

  useEffect(() => {
    if (step === 1) return;
    headRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const userPhone = user?.phone;
  useEffect(() => {
    if (userPhone) setContact((c) => (c.phone ? c : { ...c, phone: userPhone }));
  }, [userPhone]);

  // ما يُرفق بطلب البراند: المكوّنات بطبقاتها والتركيز والحجم (بلا سعر الأفراد ولا جلسة)
  const workDraft = (): WorkDraft => {
    const { p_top, p_heart, p_base, p_conc, p_size, p_purpose, p_name } = toPayload(comp, mode, { estimate: 0 });
    const layers = LAYERS.map((l) => `${pick(l.label)}: ${inLayer(comp, l.id).map((x) => pick(x.name)).join("، ") || "—"}`);
    return {
      summary: [...layers, `${pick(conc.label)} · ${num(comp.size)} ${t("مل", "ml")}`].join(" | "),
      link: "/bespoke?track=B",
      fields: { p_top, p_heart, p_base, p_conc, p_size, p_purpose, ...(p_name ? { p_name } : {}) },
    };
  };
  const toConsult = () => {
    setTried(true);
    if (!reading.ok) {
      document.getElementById("bk-reading")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (completeWork) return completeWork(workDraft());
    setStep(2);
  };

  const who = isClient ? { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: contact.phone } : contact;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (needsSlot && !slot) return setError(t("اختر يوماً ووقتاً للجلسة.", "Pick a day and time for the session."));
    // الصفحة قد تبقى مفتوحة ساعات: الموعد الذي صار قريباً جداً أو مضى يُرفض عند الإرسال
    if (needsSlot && slot && slot.start.getTime() < Date.now() + 2 * 3_600_000) {
      setTime("");
      return setError(t("هذا الموعد لم يعد متاحاً — اختر موعداً آخر.", "That time is no longer available — pick another."));
    }
    if (!phoneOk(who.phone)) {
      setError(t("أدخل رقم جوال صحيحاً بعد اختيار الدولة.", "Enter a valid mobile number after choosing your country."));
      document.getElementById("bk-phone")?.focus();
      return;
    }
    const form = new FormData();
    form.set("track", "P");
    form.set("subject", "P");
    form.set("track_title", pick(PERSONAL_TRACK.title));
    const payload = toPayload(comp, mode, { estimate: price.total, ...(needsSlot && slot ? { slotRiyadh: `${dayKey} ${time}`, slotUtc: slot.start.toISOString() } : {}) });
    for (const [k, v] of Object.entries(payload)) form.set(k, v);
    if (message.trim()) form.set("message", message.trim().slice(0, 1500));
    form.set("firstName", who.firstName);
    form.set("lastName", who.lastName);
    form.set("email", who.email.trim().toLowerCase());
    form.set("phone", who.phone.replace(/[\s-]/g, ""));
    if (contact.country) form.set("country", contact.country);
    form.set("language", isAr ? "ar" : "en");
    setBusy(true);
    const r = await submitForm("brief", form);
    setBusy(false);
    if (!r.ok) return setError(t(r.message, "Couldn't send right now. Please try again shortly."));
    try {
      sessionStorage.removeItem(DRAFT);
    } catch {
      /* لا شيء */
    }
    if (isClient) return navigate("/account?started=1", { replace: true });
    setStep(3);
  };

  const visible = NOTES.filter((x) => family === "all" || x.family === family);
  const wa = whatsappLink(site.whatsapp, whatsappText(comp, pick, t));
  // زيارة الاستوديو تظهر فقط حين يُدخل عنوان فعلي في «التواصل والحسابات» (الافتراضي اسم الدولة فقط)
  const hasStudio = site.address.ar.trim() !== SITE.address.ar;
  const modes = MODES.filter((m) => m.id !== "studio" || hasStudio);
  useEffect(() => {
    if (mode === "studio" && !hasStudio) setMode("video");
  }, [mode, hasStudio]);
  const pill = (on: boolean) => `rounded-full border px-4 py-2 text-sm transition-colors ${on ? "bg-ink-900 border-ink-900 text-white" : "bg-white border-paper-300 text-ink-900 hover:border-ink-900"}`;

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      {brandTrack && <div className="pt-[4.25rem]"><WorkspaceBar track="B" work={workDraft} ready={reading.ok} /></div>}
      <header className={`${brandTrack ? "pt-10 md:pt-14" : "pt-32 md:pt-40"} pb-10`}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 text-sm text-paper-500 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
              {brandTrack ? t(`المسار N°${brandTrack.no} · ${pick(brandTrack.title)}`, `Track N°${brandTrack.no} · ${pick(brandTrack.title)}`) : t("للأفراد · عطرك الخاص", "For individuals · Your signature scent")}
            </p>
            <h1 className="font-display text-ink-900 text-[2.4rem] leading-[1.15] sm:text-5xl md:text-6xl tracking-tight">
              {brandTrack ? (
                <>{t("كوّن تركيبة", "Compose the formula")} <span className="text-paper-400">{t("براندك.", "of your brand.")}</span></>
              ) : (
                <>{t("عطرٌ لا يملكه", "A scent no one")} <span className="text-paper-400">{t("أحدٌ غيرك.", "else owns.")}</span></>
              )}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-[1.8] text-paper-600">
              {brandTrack
                ? t(
                    "اختر المكوّنات طبقةً طبقة لترسم اتجاه عطرك، وشاهد توازنه وثباته وأنت تختار. هذه نقطة البدء للعطّار: يحوّل اختيارك إلى تركيبة احترافية بجولات عينات حتى تعتمدها.",
                    "Pick notes layer by layer to set your scent's direction, and watch its balance and longevity as you go. This is the perfumer's starting point: your picks become a professional formula through sample rounds until you approve.",
                  )
                : t(
                    "اختر مكوناتك طبقةً طبقة، وشاهد طابع عطرك وثباته وسعره وأنت تختار. ثم يضبط معك مستشار التكوين النسب، ونرسل لك عينتين تجربهما قبل أن نعبّئ زجاجتك وننقش اسمك عليها.",
                    "Pick your notes layer by layer and see your scent's character, longevity and price as you go. A composition consultant then fine-tunes the ratios with you, and we send two samples to try before we fill your bottle and engrave your name.",
                  )}
            </p>
          </div>
          <ul className="lg:col-span-5 grid grid-cols-3 gap-2 text-center">
            {(brandTrack
              ? [
                  { icon: "ri-price-tag-3-line", a: pick(brandTrack.price) },
                  { icon: "ri-time-line", a: pick(brandTrack.duration) },
                  { icon: "ri-test-tube-line", a: t("جولات عينات حتى الاعتماد", "Sample rounds until approval") },
                ]
              : [
                  { icon: "ri-price-tag-3-line", a: t(`يبدأ من ${num(startingPrice(rates))} ر.س`, `From SAR ${num(startingPrice(rates))}`) },
                  { icon: "ri-time-line", a: pick(PERSONAL_TRACK.duration) },
                  { icon: "ri-user-voice-line", a: t("جلسة مستشار مجانية", "Free consultant session") },
                ]
            ).map((x) => (
              <li key={x.icon} className="rounded-2xl bg-white border border-paper-200 px-2 py-4 text-sm text-ink-900">
                <i className={`${x.icon} text-xl text-paper-500`} aria-hidden="true"></i>
                <span className="block mt-1.5">{x.a}</span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-28 lg:pb-24">
        {!brandTrack && <Steps step={step} />}

        {step === 1 && (
          <div className="mt-8 grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 min-w-0 space-y-10">
              <section aria-labelledby="bk-presets">
                <h2 id="bk-presets" className="font-display text-2xl text-ink-900">{t("ابدأ من فكرة جاهزة، أو من الصفر", "Start from an idea, or from scratch")}</h2>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PRESETS.map((p) => {
                    const on = p.notes.length === comp.notes.length && p.notes.every((id) => comp.notes.includes(id));
                    return (
                      <button key={p.id} type="button" aria-pressed={on} onClick={() => setComp({ ...comp, notes: p.notes })} className={`rounded-2xl border p-4 text-start transition-colors ${on ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 hover:border-paper-400"}`}>
                        <span className="block font-display text-lg text-ink-900">{pick(p.name)}</span>
                        <span className="block mt-1 text-xs text-paper-500 leading-relaxed">{pick(p.story)}</span>
                      </button>
                    );
                  })}
                </div>
                {comp.notes.length > 0 && (
                  <button type="button" onClick={() => setComp({ ...comp, notes: [] })} className="mt-3 text-sm text-paper-600 underline underline-offset-4 hover:text-ink-900">{t("ابدأ من الصفر", "Clear and start over")}</button>
                )}
              </section>

              <section aria-labelledby="bk-notes">
                <h2 id="bk-notes" className="font-display text-2xl text-ink-900">{t("اختر مكوناتك", "Choose your notes")}</h2>
                <p className="mt-2 text-sm text-paper-600">{t(`حتى ${num(MAX_PER_LAYER)} مكوّنات في كل طبقة. «نادر» مكوّن فاخر بإضافة على السعر.`, `Up to ${MAX_PER_LAYER} notes per layer. “Rare” marks a luxury material with a surcharge.`)}</p>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("تصفية حسب العائلة", "Filter by family")}>
                  <button type="button" aria-pressed={family === "all"} onClick={() => setFamily("all")} className={pill(family === "all")}>{t("الكل", "All")}</button>
                  {(Object.keys(FAMILIES) as Family[]).map((f) => (
                    <button key={f} type="button" aria-pressed={family === f} onClick={() => setFamily(f)} className={pill(family === f)}>{pick(FAMILIES[f])}</button>
                  ))}
                </div>
                <div className="mt-6 space-y-8">
                  {LAYERS.map((l) => {
                    const count = inLayer(comp, l.id).length;
                    const list = visible.filter((x) => x.layer === l.id);
                    return (
                      <fieldset key={l.id} aria-describedby={`bk-h-${l.id}`}>
                        <legend className="w-full flex items-baseline justify-between gap-3">
                          <span className="font-medium text-ink-900">{pick(l.label)}</span>
                          <span className={`text-xs font-mono ${count >= MAX_PER_LAYER ? "text-ink-900" : "text-paper-500"}`} data-testid={`count-${l.id}`}>{num(count)}/{num(MAX_PER_LAYER)}</span>
                        </legend>
                        <p id={`bk-h-${l.id}`} className="text-xs text-paper-500 mt-1">{pick(l.hint)}</p>
                        {list.length ? (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {list.map((x) => {
                              const on = comp.notes.includes(x.id);
                              const full = !on && count >= MAX_PER_LAYER;
                              return (
                                <button key={x.id} type="button" aria-pressed={on} disabled={full} onClick={() => setComp(toggleNote(comp, x.id))} data-note={x.id} className={`relative rounded-2xl border p-3 text-start transition-colors disabled:opacity-40 ${on ? "border-ink-900 bg-ink-900 text-white" : "border-paper-200 bg-white hover:border-ink-900"}`}>
                                  <span className="block text-sm font-medium pe-10">{pick(x.name)}</span>
                                  <span className={`block mt-1 text-xs leading-relaxed ${on ? "text-white/70" : "text-paper-500"}`}>{pick(x.feel)}</span>
                                  {x.premium && <span className={`absolute top-2.5 end-2.5 rounded-full px-2 py-0.5 text-[10px] ${on ? "bg-white/15 text-white" : "bg-sand-soft text-ink-900"}`}>{t("نادر", "Rare")}</span>}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-paper-400">{t("لا مكونات من هذه العائلة في هذه الطبقة.", "No notes from this family in this layer.")}</p>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="bk-format" className="space-y-6">
                <h2 id="bk-format" className="font-display text-2xl text-ink-900">{t("الشكل والحجم", "Format & size")}</h2>
                <div role="radiogroup" aria-label={t("التركيز", "Concentration")} className="grid sm:grid-cols-3 gap-2">
                  {CONCENTRATIONS.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={comp.conc === c.id} onClick={() => setComp(withConcentration(comp, c.id))} className={`rounded-2xl border p-4 text-start transition-colors ${comp.conc === c.id ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 hover:border-paper-400"}`}>
                      <span className="block text-sm font-medium text-ink-900">{pick(c.label)}</span>
                      <span className="block mt-1 text-xs text-paper-500">{pick(c.note)}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("الحجم", "Size")}>
                  {conc.sizes.map((ml) => (
                    <button key={ml} type="button" role="radio" aria-checked={comp.size === ml} onClick={() => setComp({ ...comp, size: ml })} className={pill(comp.size === ml)}>{t(`${num(ml)} مل`, `${ml} ml`)}</button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("لمن العطر؟", "Who is it for?")}>
                  <span className="text-sm text-paper-600 me-1">{t("لمن العطر؟", "Who is it for?")}</span>
                  {PURPOSES.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={comp.purpose === p.id} onClick={() => setComp({ ...comp, purpose: p.id })} className={pill(comp.purpose === p.id)}>{pick(p.label)}</button>
                  ))}
                </div>
                <div className="max-w-sm">
                  <label htmlFor="bk-name" className="block text-sm text-paper-600 mb-2">{t("الاسم على الزجاجة (اختياري)", "Name on the bottle (optional)")}</label>
                  <input id="bk-name" value={comp.name} maxLength={NAME_MAX} onChange={(e) => setComp({ ...comp, name: e.target.value })} className={field} placeholder={t("مثال: نورة", "e.g. Noura")} />
                  <p className="mt-1 text-xs text-paper-400">{t(`يُنقش على الزجاجة · ${num(NAME_MAX)} حرفاً كحد أقصى`, `Engraved on the bottle · ${NAME_MAX} characters max`)}</p>
                </div>
              </section>
            </div>

            {/* القراءة الفورية */}
            <aside id="bk-reading" className="lg:col-span-4 lg:sticky lg:top-24 rounded-[1.75rem] bg-white border border-paper-200 p-6 space-y-6 scroll-mt-28" aria-label={t("قراءة عطرك", "Your scent reading")}>
              <div>
                <p className="text-sm text-paper-500 mb-3">{t("هرم عطرك", "Your pyramid")}</p>
                <Pyramid comp={comp} />
                {comp.name.trim() && <p className="mt-3 text-center font-display text-xl text-ink-900" data-testid="bk-engraving">{comp.name.trim()}</p>}
              </div>
              {reading.character.length > 0 && (
                <div>
                  <p className="text-sm text-paper-500 mb-2">{t("الطابع", "Character")}</p>
                  <ul className="space-y-1.5" data-testid="bk-character">
                    {reading.character.slice(0, 4).map((c) => (
                      <li key={c.family} className="text-xs">
                        <div className="flex justify-between text-ink-900"><span>{pick(c.label)}</span><span className="font-mono">{num(c.pct)}%</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-paper-100 overflow-hidden"><div className="h-full bg-ink-900 rounded-full" style={{ width: `${c.pct}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {comp.notes.length > 0 && (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-paper-500">{t("القوة", "Intensity")}</dt>
                    <dd className="mt-1 flex gap-1" aria-label={t(`${num(reading.intensity)} من 3`, `${reading.intensity} of 3`)}>
                      {[1, 2, 3].map((i) => <span key={i} className={`w-5 h-1.5 rounded-full ${i <= reading.intensity ? "bg-ink-900" : "bg-paper-200"}`} />)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-paper-500">{t("الثبات (تقديري)", "Longevity (est.)")}</dt>
                    <dd className="mt-1 text-ink-900 text-xs" data-testid="bk-longevity">{pick(reading.longevity)}</dd>
                  </div>
                </dl>
              )}
              {(reading.pairs.length > 0 || reading.issues.length > 0) && (
                <ul className="space-y-2 text-xs leading-relaxed" data-testid="bk-issues">
                  {reading.pairs.map((p) => (
                    <li key={p.ar} className="flex gap-2 text-[#1F6B4F]"><i className="ri-check-line mt-0.5" aria-hidden="true"></i>{pick(p)}</li>
                  ))}
                  {reading.issues.filter((i) => i.level === "warn" || tried).map((i) => (
                    <li key={i.code + i.text.ar} className={`flex gap-2 ${i.level === "block" ? "text-red-700" : "text-accent2-ink"}`} data-level={i.level}>
                      <i className={i.level === "block" ? "ri-error-warning-line mt-0.5" : "ri-information-line mt-0.5"} aria-hidden="true"></i>{pick(i.text)}
                    </li>
                  ))}
                </ul>
              )}
              {brandTrack ? (
                <div className="border-t border-paper-200 pt-5">
                  <p className="text-sm text-paper-600 leading-[1.8]">{t(`${pick(conc.label)} · ${num(comp.size)} مل. السعر في عرض الفريق بعد البريف — يبدأ من ${pick(brandTrack.price)}.`, `${pick(conc.label)} · ${comp.size} ml. Pricing comes in the team's quote after the brief — ${pick(brandTrack.price)}.`)}</p>
                  <Button onClick={toConsult} arrow className="mt-5 w-full hidden lg:inline-flex">{t("أكمل الطلب بهذه التركيبة", "Complete the request with this formula")}</Button>
                </div>
              ) : (
              <div className="border-t border-paper-200 pt-5">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-paper-600"><dt>{t(`${pick(conc.label)} · ${num(comp.size)} مل`, `${pick(conc.label)} · ${comp.size} ml`)}</dt><dd>{money(price.juice)}</dd></div>
                  <div className="flex justify-between text-paper-600"><dt>{t("الزجاجة والعلبة والنقش", "Bottle, box & engraving")}</dt><dd>{money(price.bottle)}</dd></div>
                  {/* الضريبة تُعرض سطراً مستقلاً: التقدير شامل لها كعرض السعر */}
                  {price.premiumCount > 0 && <div className="flex justify-between text-paper-600"><dt>{t(`${price.premiumCount === 1 ? "مكوّن نادر" : "مكوّنات نادرة"} × ${num(price.premiumCount)}`, `Rare notes × ${price.premiumCount}`)}</dt><dd>{money(price.premium)}</dd></div>}
                  <div className="flex justify-between text-paper-600"><dt>{t("ضريبة القيمة المضافة 15٪", "VAT 15%")}</dt><dd>{money(price.vat)}</dd></div>
                  <div className="flex justify-between pt-2 text-ink-900"><dt>{t("التقدير", "Estimate")}</dt><dd className="font-display text-2xl" data-testid="bk-total">{money(price.total)}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-paper-400 leading-relaxed">{t("شامل الضريبة. السعر النهائي في عرض السعر بعد جلسة المستشار، والجلسة مجانية.", "VAT included. The final price comes in your quote after the consultation, which is free.")}</p>
                <Button onClick={toConsult} arrow className="mt-5 w-full hidden lg:inline-flex">{t("التالي: جلسة المستشار", "Next: consultation")}</Button>
              </div>
              )}
            </aside>

            {/* شريط الجوال */}
            <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-paper-200 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-paper-500">{brandTrack ? t(arCount(comp.notes.length, { one: "مكوّن واحد", two: "مكوّنان", few: "مكوّنات", many: "مكوّناً" }, num), enCount(comp.notes.length, "note", "notes")) : t(`${arCount(comp.notes.length, { one: "مكوّن واحد", two: "مكوّنان", few: "مكوّنات", many: "مكوّناً" }, num)} · تقدير`, `${enCount(comp.notes.length, "note", "notes")} · estimate`)}</p>
                <p className="font-display text-xl text-ink-900">{brandTrack ? `${pick(conc.label)} · ${num(comp.size)} ${t("مل", "ml")}` : money(price.total)}</p>
              </div>
              <Button onClick={toConsult} arrow>{brandTrack ? t("أكمل الطلب", "Complete") : t("التالي", "Next")}</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={send} className="mt-8 max-w-3xl">
            <h2 ref={headRef} tabIndex={-1} className="font-display text-4xl text-ink-900 outline-none">{t("جلسة مع مستشار التكوين", "A session with your composition consultant")}</h2>
            <p className="mt-3 text-paper-600 leading-[1.8]">{t("يراجع المستشار اختيارك قبل الجلسة، ثم يقترح النسب والبدائل معك. الجلسة مجانية وبلا التزام.", "Your consultant reviews your picks before the session, then works out ratios and alternatives with you. Free, no obligation.")}</p>
            <button type="button" onClick={() => setStep(1)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm text-ink-900">
              <i className="ri-flask-line" aria-hidden="true"></i>
              {t(`${arCount(comp.notes.length, { one: "مكوّن واحد", two: "مكوّنان", few: "مكوّنات", many: "مكوّناً" }, num)} · ${pick(conc.label)} ${num(comp.size)} مل · ${money(price.total)}`, `${enCount(comp.notes.length, "note", "notes")} · ${pick(conc.label)} ${comp.size} ml · ${money(price.total)}`)}
              <span className="text-paper-500 underline underline-offset-4 ms-2">{t("تعديل", "Edit")}</span>
            </button>

            <div className="mt-8 grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label={t("طريقة الجلسة", "Session type")}>
              {modes.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} className={`rounded-2xl border p-4 text-start transition-colors ${mode === m.id ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 hover:border-paper-400"}`}>
                  <i className={`${m.icon} text-xl text-ink-900`} aria-hidden="true"></i>
                  <span className="block mt-2 text-sm font-medium text-ink-900">{pick(m.label)}</span>
                  <span className="block mt-1 text-xs text-paper-500">{pick(m.note)}</span>
                </button>
              ))}
            </div>

            {needsSlot ? (
              <div className="mt-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-2xl text-ink-900">{t("الموعد المفضل", "Preferred time")}</h3>
                  <span className="text-xs text-paper-500">{t("بتوقيت الرياض", "Riyadh time (GMT+3)")}</span>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="radiogroup" aria-label={t("اليوم", "Day")}>
                  {days.map((d) => {
                    const on = d.key === dayKey;
                    return (
                      <button key={d.key} type="button" role="radio" aria-checked={on} onClick={() => { setDayKey(d.key); setTime(""); }} className={`shrink-0 w-[4.75rem] rounded-2xl border py-3 text-center transition-colors ${on ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 bg-white hover:border-ink-900"}`}>
                        <span className={`block text-xs ${on ? "text-white/70" : "text-paper-500"}`}>{fmtDay(d.date, { weekday: "short" })}</span>
                        <span className="block font-display text-2xl mt-0.5">{fmtDay(d.date, { day: "numeric" })}</span>
                        <span className={`block text-xs ${on ? "text-white/70" : "text-paper-500"}`}>{fmtDay(d.date, { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2" role="radiogroup" aria-label={t("الوقت", "Time")}>
                  {day?.slots.map((s) => (
                    <button key={s.time} type="button" role="radio" aria-checked={s.time === time} disabled={s.past} onClick={() => setTime(s.time)} className={`rounded-xl border py-3 text-sm transition-colors disabled:opacity-35 disabled:line-through ${s.time === time ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 bg-white hover:border-ink-900"}`}>
                      {fmtTime(s.start)}
                    </button>
                  ))}
                </div>
                {mode === "studio" && <p className="mt-3 text-xs text-paper-500">{t(`الاستوديو: ${pick(site.address)}. يؤكد المستشار العنوان والموعد معك.`, `Studio: ${pick(site.address)}. Your consultant confirms the address and time with you.`)}</p>}
              </div>
            ) : (
              <p className="mt-6 rounded-xl bg-white border border-paper-200 px-4 py-3 text-sm text-paper-600">{t("يبدأ المستشار المحادثة معك على واتساب خلال ساعات العمل، ومعه تركيبتك.", "Your consultant starts the WhatsApp chat during working hours, with your composition in hand.")}</p>
            )}

            <div className="mt-8 grid sm:grid-cols-2 gap-5">
              {isClient ? (
                <p className="sm:col-span-2 rounded-xl bg-white border border-paper-200 px-4 py-3 text-sm text-paper-600">
                  {t("سيُضاف الطلب إلى حسابك:", "The request goes to your account:")} <span className="text-ink-900">{user.firstName} {user.lastName}</span> · <span dir="ltr">{user.email}</span>
                </p>
              ) : (
                <>
                  <div>
                    <label htmlFor="bk-first" className="block text-sm text-paper-600 mb-2">{t("الاسم الأول", "First name")}</label>
                    <input id="bk-first" required maxLength={60} autoComplete="given-name" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} className={field} />
                  </div>
                  <div>
                    <label htmlFor="bk-last" className="block text-sm text-paper-600 mb-2">{t("اسم العائلة", "Last name")}</label>
                    <input id="bk-last" required maxLength={60} autoComplete="family-name" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} className={field} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bk-email" className="block text-sm text-paper-600 mb-2">{t("البريد الإلكتروني", "Email")}</label>
                    <input id="bk-email" type="email" required dir="ltr" maxLength={120} autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={field} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="bk-phone" className="block text-sm text-paper-600 mb-2">{t("الجوال (واتساب)", "Mobile (WhatsApp)")}</label>
                <PhoneField id="bk-phone" required defaultValue={who.phone} defaultCountry={contact.country} onChange={(phone, country) => setContact((c) => ({ ...c, phone, country }))} className={field} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bk-msg" className="block text-sm text-paper-600 mb-2">{t("عطور تحبها اليوم، أو ما تريد أن يذكّرك به عطرك (اختياري)", "Scents you love today, or what you want yours to remind you of (optional)")}</label>
                <textarea id="bk-msg" rows={3} maxLength={1500} value={message} onChange={(e) => setMessage(e.target.value)} className={`${field} resize-none`} placeholder={t("مثال: أحب العود لكن ليس الثقيل، وأريده للعمل والمساء.", "e.g. I love oud but not heavy ones; for work and evenings.")} />
              </div>
            </div>
            {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button type="submit" arrow disabled={busy}>{busy ? t("جارٍ الإرسال…", "Sending…") : t("احجز الجلسة", "Book the session")}</Button>
              <button type="button" onClick={() => setStep(1)} className="text-sm text-paper-600 underline underline-offset-4 hover:text-ink-900">{t("رجوع", "Back")}</button>
            </div>
            <LegalConsent action={{ ar: "بالحجز", en: "booking" }} className="mt-6" />
          </form>
        )}

        {step === 3 && (
          <div className="mt-8 max-w-2xl">
            <div role="status">
              <span className="w-14 h-14 rounded-full bg-ink-900 text-white flex items-center justify-center"><i className="ri-check-line text-2xl" aria-hidden="true"></i></span>
              <h2 ref={headRef} tabIndex={-1} className="mt-6 font-display text-4xl text-ink-900 outline-none">{t(`وصلت تركيبتك يا ${contact.firstName}.`, `Your composition is in, ${contact.firstName}.`)}</h2>
              <p className="mt-3 text-paper-600 leading-[1.8]">
                {mode === "whatsapp"
                  ? t("يبدأ مستشار التكوين المحادثة معك على واتساب خلال ساعات العمل.", "Your composition consultant will start the WhatsApp chat during working hours.")
                  : t(`يؤكد مستشار التكوين موعدك (${slot ? `${fmtDay(slot.start, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(slot.start)}` : ""}) على`, `Your composition consultant will confirm your session (${slot ? `${fmtDay(slot.start, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(slot.start)}` : ""}) on`)}{" "}
                {mode !== "whatsapp" && <span dir="ltr" className="text-ink-900">{formatPhone(contact.phone)}</span>}
              </p>
            </div>
            <div className="mt-8 rounded-2xl bg-white border border-paper-200 p-6">
              <Pyramid comp={comp} />
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1F6B4F] text-white px-5 py-2.5 text-sm">
                  <i className="ri-whatsapp-line" aria-hidden="true"></i>
                  {t("تحدث مع المستشار الآن", "Talk to the consultant now")}
                </a>
              )}
            </div>
            {!user && <AccountAfterRequest contact={contact} pitch={t("تابع تركيبتك ومحادثة المستشار وعيناتك من حسابك. اختر كلمة مرور فقط — بياناتك الباقية لدينا.", "Follow your composition, consultant chat and samples from your account. Just pick a password — we have the rest.")} />}
            <Link to="/" className="mt-8 inline-block text-sm text-paper-600 underline underline-offset-4 hover:text-ink-900">{t("العودة للرئيسية", "Back to home")}</Link>
          </div>
        )}
      </main>
      <FooterSection />
    </div>
  );
}
