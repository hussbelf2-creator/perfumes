import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import Button from "@/components/ui/Button";
import { useI18n, type Bi } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { submitForm } from "@/lib/forms";
import { DISCOVERY_KIT, SAUDI_CITIES } from "@/config/offers";
import { useContent } from "@/cms/ContentProvider";
import { PHOTOS } from "@/lib/photos";
import { PAYMENTS } from "@/config/payments";
import PaymentForm from "@/components/feature/PaymentForm";
import { newOrderRef, readPendingOrder, savePendingOrder, type PendingKitOrder } from "@/lib/payments";
import { useKitPrice } from "@/pricing/usePrices";
import { pricingRepo } from "@/pricing/repo";
import LegalConsent from "@/components/feature/LegalConsent";
import PhoneField from "@/components/feature/PhoneField";
import { COUNTRIES, flag, guessCountry } from "@/lib/phone";

type Answers = { family?: string; intensity?: string; audience?: string; price?: string };

const QUESTIONS: { id: keyof Answers; q: Bi; options: { id: string; label: Bi; hint?: Bi }[] }[] = [
  {
    id: "family",
    q: { ar: "أي عائلة عطرية تجذبك؟", en: "Which scent family draws you in?" },
    options: [
      { id: "oud", label: { ar: "عودي وشرقي", en: "Oud & oriental" }, hint: { ar: "عود، عنبر، بخور", en: "Oud, amber, incense" } },
      { id: "floral", label: { ar: "زهري", en: "Floral" }, hint: { ar: "ورد طائفي، ياسمين", en: "Taif rose, jasmine" } },
      { id: "fresh", label: { ar: "منعش", en: "Fresh" }, hint: { ar: "حمضيات، بحري، أخضر", en: "Citrus, marine, green" } },
      { id: "woody", label: { ar: "خشبي", en: "Woody" }, hint: { ar: "صندل، أرز، فيتيفر", en: "Sandalwood, cedar, vetiver" } },
      { id: "gourmand", label: { ar: "حلو دافئ", en: "Gourmand" }, hint: { ar: "فانيليا، قهوة، تمر", en: "Vanilla, coffee, dates" } },
    ],
  },
  {
    id: "intensity",
    q: { ar: "كم تريد قوته وثباته؟", en: "How strong should it be?" },
    options: [
      { id: "soft", label: { ar: "هادئ وقريب من الجلد", en: "Soft, close to skin" } },
      { id: "balanced", label: { ar: "متوازن للاستخدام اليومي", en: "Balanced, everyday" } },
      { id: "bold", label: { ar: "قوي وفوّاح", en: "Bold, long trail" } },
    ],
  },
  {
    id: "audience",
    q: { ar: "لمن تصنعه؟", en: "Who is it for?" },
    options: [
      { id: "men", label: { ar: "رجالي", en: "Men" } },
      { id: "women", label: { ar: "نسائي", en: "Women" } },
      { id: "unisex", label: { ar: "للجنسين", en: "Unisex" } },
    ],
  },
  {
    id: "price",
    q: { ar: "بأي سعر تجزئة تتخيله على الرف؟", en: "What retail price do you picture?" },
    options: [
      { id: "entry", label: { ar: "أقل من 200 ر.س", en: "Under SAR 200" } },
      { id: "mid", label: { ar: "200 – 450 ر.س", en: "SAR 200 – 450" } },
      { id: "premium", label: { ar: "أكثر من 450 ر.س", en: "Over SAR 450" } },
    ],
  },
];

// اتجاهات مقترحة لكل عائلة — ثلاث قراءات مختلفة للفكرة نفسها
const DIRECTIONS: Record<string, { name: Bi; notes: Bi }[]> = {
  oud: [
    { name: { ar: "عود دخاني", en: "Smoked oud" }, notes: { ar: "عود كمبودي · بخور · جلد", en: "Cambodian oud · incense · leather" } },
    { name: { ar: "عود وردي", en: "Rose oud" }, notes: { ar: "ورد طائفي · عود · زعفران", en: "Taif rose · oud · saffron" } },
    { name: { ar: "عنبر ناعم", en: "Soft amber" }, notes: { ar: "عنبر · فانيليا · مسك أبيض", en: "Amber · vanilla · white musk" } },
  ],
  floral: [
    { name: { ar: "ورد طائفي", en: "Taif rose" }, notes: { ar: "ورد · ليتشي · مسك", en: "Rose · lychee · musk" } },
    { name: { ar: "زهر أبيض", en: "White florals" }, notes: { ar: "ياسمين · زهر البرتقال · توبيروز", en: "Jasmine · orange blossom · tuberose" } },
    { name: { ar: "زهري مسكي", en: "Musky floral" }, notes: { ar: "سوسن · مسك · خشب الكشمير", en: "Iris · musk · cashmere wood" } },
  ],
  fresh: [
    { name: { ar: "حمضي مشرق", en: "Bright citrus" }, notes: { ar: "برغموت · ليمون · نيرولي", en: "Bergamot · lemon · neroli" } },
    { name: { ar: "بحري معدني", en: "Mineral marine" }, notes: { ar: "ملح البحر · مريمية · أمبروكسان", en: "Sea salt · sage · ambroxan" } },
    { name: { ar: "أخضر عشبي", en: "Green herbal" }, notes: { ar: "شاي أخضر · نعناع · فيتيفر", en: "Green tea · mint · vetiver" } },
  ],
  woody: [
    { name: { ar: "صندل كريمي", en: "Creamy sandalwood" }, notes: { ar: "صندل · حليب · تونكا", en: "Sandalwood · milk · tonka" } },
    { name: { ar: "أرز جاف", en: "Dry cedar" }, notes: { ar: "أرز · فلفل وردي · بخور", en: "Cedar · pink pepper · incense" } },
    { name: { ar: "خشب وتوابل", en: "Spiced woods" }, notes: { ar: "هيل · قرفة · باتشولي", en: "Cardamom · cinnamon · patchouli" } },
  ],
  gourmand: [
    { name: { ar: "قهوة عربية", en: "Arabic coffee" }, notes: { ar: "قهوة · هيل · عنبر", en: "Coffee · cardamom · amber" } },
    { name: { ar: "تمر وفانيليا", en: "Dates & vanilla" }, notes: { ar: "تمر · فانيليا · صندل", en: "Dates · vanilla · sandalwood" } },
    { name: { ar: "كراميل مملح", en: "Salted caramel" }, notes: { ar: "كراميل · ملح · مسك", en: "Caramel · salt · musk" } },
  ],
};

const INTENSITY_NOTE: Record<string, Bi> = {
  soft: { ar: "بتركيز أو دو تواليت", en: "at Eau de Toilette strength" },
  balanced: { ar: "بتركيز أو دو بارفان", en: "at Eau de Parfum strength" },
  bold: { ar: "بتركيز إكستريه", en: "at Extrait strength" },
};

const field =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";

const DiscoveryKitPage = () => {
  const { t, pick, sar, num } = useI18n();
  const money = (n: number) => (Number.isInteger(n) ? sar(n) : t(`${num(n, 2)} ر.س`, `SAR ${num(n, 2)}`));
  // تفاصيل العينة من «محتوى الموقع»؛ السعر ثابت لأن الخادم يتحقق منه عند الدفع
  const kit = useContent("offers").kit;
  const price = useKitPrice();
  const [code, setCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { user } = useAuth();
  const [params] = useSearchParams();
  // العودة من دفع فاشل: نكمل الطلب المحفوظ مباشرة دون إعادة الاختبار
  const [pending, setPending] = useState<PendingKitOrder | null>(() => (PAYMENTS.enabled && params.get("retry") ? readPendingOrder() : null));
  const [answers, setAnswers] = useState<Answers>({});
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<"quiz" | "result" | "order" | "pay" | "done">(() => (pending ? "pay" : "quiz"));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [orderName, setOrderName] = useState("");
  // الشحن لأغلب دول العالم: المدن السعودية قائمة، وخارجها اسم المدينة نصاً
  const [shipCountry, setShipCountry] = useState(guessCountry);

  const directions = DIRECTIONS[answers.family ?? "oud"];
  const q = QUESTIONS[qi];
  const labelOf = (k: keyof Answers) => {
    const opt = QUESTIONS.find((x) => x.id === k)?.options.find((o) => o.id === answers[k]);
    return opt ? pick(opt.label) : "";
  };

  const choose = (id: string) => {
    setAnswers((a) => ({ ...a, [q.id]: id }));
    if (qi < QUESTIONS.length - 1) setQi(qi + 1);
    else setPhase("result");
  };

  const restart = () => {
    setAnswers({});
    setQi(0);
    setPhase("quiz");
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ref = newOrderRef();
    form.set("request_type", "discovery_kit");
    form.set("order_ref", ref);
    form.set("payment", PAYMENTS.enabled ? "online_pending" : "manual");
    form.set("subject", `Discovery kit — ${price} SAR`);
    form.set("quiz", QUESTIONS.map((x) => `${x.id}=${answers[x.id] ?? "-"}`).join("; "));
    form.set("directions", directions.map((d) => d.name.en).join(" / "));
    setStatus("loading");
    setError("");
    const r = await submitForm("kit", form);
    if (r.ok) {
      const name = String(form.get("firstName") || "");
      setOrderName(name);
      if (PAYMENTS.enabled) {
        const order: PendingKitOrder = {
          ref,
          name,
          email: String(form.get("email") || ""),
          directions: directions.map((d) => pick(d.name)),
          amount: price,
        };
        savePendingOrder(order);
        setPending(order);
        setPhase("pay");
      } else {
        setPhase("done");
      }
      setStatus("idle");
    } else {
      setError(t(r.message, "Couldn't place the order right now. Please try again shortly."));
      setStatus("error");
    }
  };

  const includes = [
    { icon: "ri-flask-line", text: t(`${num(kit.vials)} عينات (${num(kit.ml)} مل) مركّبة على إجاباتك`, `${kit.vials} vials (${kit.ml} ml) built from your answers`) },
    { icon: "ri-file-paper-2-line", text: t("بطاقة تقييم لتجربة العينات على جمهورك", "An evaluation card to test them with your audience") },
    { icon: "ri-phone-line", text: t("مكالمة متابعة مع خبير لاختيار الاتجاه", "A follow-up call with an expert to pick a direction") },
    { icon: "ri-refund-2-line", text: t(`يُخصم المبلغ كاملاً إن بدأت مشروعك خلال ${num(kit.creditDays)} يوماً`, `Fully credited if you start your project within ${kit.creditDays} days`) },
  ];

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />

      {/* البطل */}
      <header className="pt-28 md:pt-36 pb-16 max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 text-sm text-paper-500 fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("عينة الاكتشاف", "Discovery kit")}
          </p>
          <h1 className="mt-5 font-display text-[2.4rem] leading-[1.15] md:text-6xl text-ink-900">
            <span className="line-mask"><span>{t("شمّ براندك", "Smell your brand")}</span></span>{" "}
            <span className="line-mask"><span className="text-paper-400">{t("قبل أن تبنيه.", "before you build it.")}</span></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-[1.8] text-paper-600 fade-up" style={{ ["--d" as string]: 2 }}>
            {t(
              `أجب عن أربعة أسئلة، ونركّب لك ${num(kit.vials)} اتجاهات عطرية تصلك إلى بابك. جرّبها مع جمهورك، ثم قرّر بثقة.`,
              `Answer four questions and we'll compound ${kit.vials} scent directions delivered to your door. Test them with your audience, then decide with confidence.`,
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 fade-up" style={{ ["--d" as string]: 3 }}>
            <div>
              <p className="text-xs text-paper-500">{t("السعر", "Price")}</p>
              <p className="font-display text-4xl text-ink-900">{sar(price)}</p>
            </div>
            <p className="text-sm text-accent2-ink max-w-[16rem] pb-1">
              {t(`يُخصم من مشروعك إن بدأت خلال ${num(kit.creditDays)} يوماً`, `Credited to your project if you start within ${kit.creditDays} days`)}
            </p>
          </div>
        </div>
        <div className="lg:col-span-6 curtain">
          <Photo src={PHOTOS.samples} alt={t("قوارير عينات مرقّمة على رخام أبيض", "Numbered sample vials on white marble")} className="aspect-[5/4] rounded-[1.75rem]" priority zoom />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-8 items-start">
        {/* ما يصلك */}
        <Reveal className="lg:col-span-5 min-w-0 rounded-[1.75rem] bg-white border border-paper-200 p-7">
          <p className="text-sm text-paper-500">{t("ما يصلك في الصندوق", "What's in the box")}</p>
          <ul className="mt-5 space-y-4">
            {includes.map((a) => (
              <li key={a.text} className="flex gap-3 text-ink-900">
                <span className="w-9 h-9 shrink-0 rounded-full bg-sand-soft flex items-center justify-center"><i className={a.icon} aria-hidden="true"></i></span>
                <span className="pt-1.5">{a.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-6 border-t border-paper-200 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper-600">
            <span className="inline-flex items-center gap-2"><i className="ri-truck-line" aria-hidden="true"></i>{pick(kit.shipping)}</span>
          </div>
        </Reveal>

        {/* الاختبار ← النتيجة ← الطلب */}
        <Reveal index={1} className="lg:col-span-7 min-w-0 order-first lg:order-none">
          <div className="rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-9" id="kit-flow">
            {phase === "quiz" && (
              <div key={qi} className="panel-in">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-paper-500">{t(`سؤال ${num(qi + 1)} من ${num(QUESTIONS.length)}`, `Question ${qi + 1} of ${QUESTIONS.length}`)}</p>
                  {qi > 0 && (
                    <button type="button" onClick={() => setQi(qi - 1)} className="text-sm text-paper-500 hover:text-ink-900 underline underline-offset-4">
                      {t("السابق", "Back")}
                    </button>
                  )}
                </div>
                <div className="mt-3 h-1 rounded-full bg-paper-100 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-ink-900 transition-[width] duration-500" style={{ width: `${(qi / QUESTIONS.length) * 100}%` }} />
                </div>
                <h2 className="mt-8 font-display text-3xl text-ink-900">{pick(q.q)}</h2>
                <div className={`mt-6 grid gap-3 ${q.options.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`} role="radiogroup" aria-label={pick(q.q)}>
                  {q.options.map((o) => {
                    const on = answers[q.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => choose(o.id)}
                        className={`lift rounded-2xl border p-5 text-start transition-colors ${on ? "border-ink-900 bg-paper-50" : "border-paper-200 hover:border-ink-900"}`}
                      >
                        <span className="block text-ink-900">{pick(o.label)}</span>
                        {o.hint && <span className="block mt-1 text-sm text-paper-500">{pick(o.hint)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === "result" && (
              <div className="panel-in">
                <p className="text-sm text-paper-500">{t("اتجاهاتك المقترحة", "Your suggested directions")}</p>
                <h2 className="mt-2 font-display text-3xl text-ink-900">
                  {t("ثلاث قراءات لفكرتك", "Three takes on your idea")}
                </h2>
                <p className="mt-2 text-sm text-paper-600">
                  {[labelOf("family"), labelOf("audience"), labelOf("price")].filter(Boolean).join(" · ")} — {pick(INTENSITY_NOTE[answers.intensity ?? "balanced"])}
                </p>
                <ol className="mt-6 grid sm:grid-cols-3 gap-3">
                  {directions.map((d, i) => (
                    <li key={d.name.en} className="rounded-2xl border border-paper-200 p-5 fade-up" style={{ ["--d" as string]: i }}>
                      <span className="label-mono">N° 0{i + 1}</span>
                      <p className="mt-3 font-display text-xl text-ink-900">{pick(d.name)}</p>
                      <p className="mt-2 text-sm text-paper-600 leading-[1.7]">{pick(d.notes)}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <button type="button" onClick={restart} className="text-sm text-paper-500 hover:text-ink-900 underline underline-offset-4">
                    {t("أعد الاختبار", "Retake the quiz")}
                  </button>
                  <Button onClick={() => setPhase("order")} arrow>
                    {t(`اطلب العينات · ${sar(price)}`, `Order the kit · ${sar(price)}`)}
                  </Button>
                </div>
              </div>
            )}

            {phase === "order" && (
              <form onSubmit={onSubmit} className="panel-in">
                <button type="button" onClick={() => setPhase("result")} className="mb-6 inline-flex items-center gap-2 rounded-full bg-sand-soft px-4 py-2 text-sm text-ink-900">
                  <i className="ri-flask-line" aria-hidden="true"></i>
                  {directions.map((d) => pick(d.name)).join(" · ")}
                  <span className="text-paper-500 underline underline-offset-4 ms-2">{t("تعديل", "Edit")}</span>
                </button>
                <h2 className="font-display text-2xl text-ink-900">{t("بيانات الشحن", "Shipping details")}</h2>
                <div className="mt-5 grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="k-first" className="block text-sm text-paper-600 mb-2">{t("الاسم الأول", "First name")}</label>
                    <input id="k-first" name="firstName" required autoComplete="given-name" defaultValue={user?.firstName} className={field} />
                  </div>
                  <div>
                    <label htmlFor="k-last" className="block text-sm text-paper-600 mb-2">{t("اسم العائلة", "Last name")}</label>
                    <input id="k-last" name="lastName" required autoComplete="family-name" defaultValue={user?.lastName} className={field} />
                  </div>
                  <div>
                    <label htmlFor="k-phone" className="block text-sm text-paper-600 mb-2">{t("الجوال", "Mobile")}</label>
                    <PhoneField id="k-phone" name="phone" countryName="phone_country" required className={field} />
                  </div>
                  <div>
                    <label htmlFor="k-email" className="block text-sm text-paper-600 mb-2">{t("البريد الإلكتروني", "Email")}</label>
                    <input id="k-email" name="email" type="email" required autoComplete="email" defaultValue={user?.email} className={field} />
                  </div>
                  <div>
                    <label htmlFor="k-country" className="block text-sm text-paper-600 mb-2">{t("دولة الشحن", "Ship to country")}</label>
                    <select id="k-country" name="country" required value={shipCountry} onChange={(e) => setShipCountry(e.target.value)} autoComplete="country" className={field}>
                      {COUNTRIES.map((c) => (
                        <option key={c.iso} value={c.iso}>{`${flag(c.iso)} ${pick(c.name)}`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="k-city" className="block text-sm text-paper-600 mb-2">{t("المدينة", "City")}</label>
                    {shipCountry === "SA" ? (
                      <select id="k-city" name="city" required defaultValue="" className={field}>
                        <option value="" disabled>{t("اختر المدينة", "Choose a city")}</option>
                        {SAUDI_CITIES.map((c) => (
                          <option key={c.en} value={c.en}>{pick(c)}</option>
                        ))}
                      </select>
                    ) : (
                      <input id="k-city" name="city" required maxLength={60} autoComplete="address-level2" className={field} />
                    )}
                  </div>
                  <div>
                    <label htmlFor="k-address" className="block text-sm text-paper-600 mb-2">{shipCountry === "SA" ? t("العنوان الوطني أو الحي", "National address or district") : t("العنوان الكامل والرمز البريدي", "Full address and postcode")}</label>
                    <input id="k-address" name="address" required autoComplete="street-address" className={field} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="k-notes" className="block text-sm text-paper-600 mb-2">{t("ملاحظات (اختياري)", "Notes (optional)")}</label>
                    <textarea id="k-notes" name="message" rows={2} maxLength={400} className={`${field} resize-none`} />
                  </div>
                </div>
                <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
                  <input type="text" name="phone_alt" tabIndex={-1} autoComplete="off" />
                </div>
                {status === "error" && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
                <div className="mt-8 rounded-2xl bg-paper-50 border border-paper-200 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-paper-600">{t("الإجمالي", "Total")}</p>
                    <p className="font-display text-3xl text-ink-900">{sar(price)}</p>
                    <p className="text-xs text-paper-500">{shipCountry === "SA" ? t("شامل الشحن داخل المملكة", "Includes shipping within KSA") : t("يُشحن من السعودية؛ نؤكد معك تكلفة الشحن الدولي قبل الإرسال", "Ships from Saudi Arabia; we confirm international shipping with you before dispatch")}</p>
                  </div>
                  <Button type="submit" disabled={status === "loading"} arrow>
                    {status === "loading"
                      ? t("جارٍ الإرسال…", "Sending…")
                      : PAYMENTS.enabled
                        ? t("المتابعة للدفع", "Continue to payment")
                        : t("أكّد الطلب", "Place order")}
                  </Button>
                </div>
                <p className="mt-4 text-xs text-paper-500">
                  {PAYMENTS.enabled
                    ? t("الخطوة التالية: الدفع الآمن بمدى أو Apple Pay أو STC Pay أو البطاقة.", "Next: secure payment with mada, Apple Pay, STC Pay or card.")
                    : t("لا يُخصم أي مبلغ الآن؛ سنتواصل معك لإتمام الدفع وتأكيد الشحن.", "Nothing is charged now; we'll contact you to complete payment and confirm shipping.")}
                </p>
              </form>
            )}

            {phase === "pay" && pending && (
              <div className="panel-in">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-2xl text-ink-900">{t("الدفع", "Payment")}</h2>
                  <span className="text-sm text-paper-500">
                    {t("رقم الطلب", "Order")} <span className="font-mono text-ink-900" dir="ltr">{pending.ref}</span>
                  </span>
                </div>
                <div className="mt-5 rounded-2xl bg-paper-50 border border-paper-200 p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink-900">{t("عينة الاكتشاف", "Discovery kit")}</p>
                    <p className="text-sm text-paper-500 truncate">{pending.directions.join(" · ")}</p>
                  </div>
                  <p className="font-display text-2xl text-ink-900" data-testid="kit-payable">
                    {pending.coupon && <span className="me-2 text-base text-paper-400 line-through">{sar(pending.amount)}</span>}
                    {money(pending.payable ?? pending.amount)}
                  </p>
                </div>
                <form
                  className="mt-4 flex flex-wrap items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const c = code.trim().toUpperCase();
                    if (!c) return;
                    let after: number | null;
                    try {
                      after = await pricingRepo.couponPrice(c, Math.round(pending.amount * 100));
                    } catch {
                      return setCouponMsg({ ok: false, text: t("محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.", "Too many attempts. Wait a few minutes and try again.") });
                    }
                    if (after === null) return setCouponMsg({ ok: false, text: t("الكوبون غير صالح أو منتهٍ.", "That coupon is invalid or expired.") });
                    const next = { ...pending, coupon: c, payable: after / 100 };
                    savePendingOrder(next);
                    setPending(next);
                    setCouponMsg({ ok: true, text: t(`طُبّق الكوبون ${c}`, `Coupon ${c} applied`) });
                  }}
                >
                  <label htmlFor="k-coupon" className="sr-only">{t("كوبون الخصم", "Coupon code")}</label>
                  <input id="k-coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={24} dir="ltr" placeholder={t("كوبون الخصم", "Coupon code")} className={`${field} !w-48`} />
                  <button type="submit" disabled={!code} className="rounded-full border border-paper-300 px-4 py-2.5 text-sm text-ink-900 hover:border-ink-900 disabled:opacity-50">{t("تطبيق", "Apply")}</button>
                  {couponMsg && <p role={couponMsg.ok ? "status" : "alert"} className={`w-full text-sm ${couponMsg.ok ? "text-[#1F6B4F]" : "text-red-700"}`}>{couponMsg.text}</p>}
                </form>
                <LegalConsent refund action={{ ar: "بالدفع", en: "paying" }} className="mt-5" />
                <div className="mt-3">
                  <PaymentForm
                    amountSar={pending.payable ?? pending.amount}
                    description={t(`عينة الاكتشاف ${pending.ref}`, `Discovery kit ${pending.ref}`)}
                    callbackPath="/discovery-kit/paid"
                    metadata={{ order_ref: pending.ref, kind: "kit", email: pending.email, ...(pending.coupon ? { coupon: pending.coupon } : {}) }}
                  />
                </div>
              </div>
            )}

            {phase === "done" && (
              <div role="status" className="panel-in text-center py-6">
                <span className="w-16 h-16 mx-auto rounded-full bg-ink-900 text-white flex items-center justify-center">
                  <i className="ri-flask-line text-2xl" aria-hidden="true"></i>
                </span>
                <h2 className="mt-6 font-display text-3xl text-ink-900">{t(`وصلنا طلبك، ${orderName}.`, `Order received, ${orderName}.`)}</h2>
                <p className="mt-3 text-paper-600 max-w-md mx-auto leading-[1.8]">
                  {t(
                    "سيتواصل معك فريقنا خلال يوم عمل لإتمام الدفع، ثم نبدأ تركيب عيناتك.",
                    "Our team will contact you within one business day to complete payment, then we start compounding your samples.",
                  )}
                </p>
                <ol className="mt-8 grid sm:grid-cols-3 gap-3 text-start">
                  {[
                    t("تأكيد الدفع", "Payment confirmation"),
                    t("تركيب العينات", "Compounding"),
                    pick(kit.shipping),
                  ].map((s, i) => (
                    <li key={s} className="rounded-2xl border border-paper-200 p-4">
                      <span className="label-mono">0{i + 1}</span>
                      <p className="mt-2 text-sm text-ink-900">{s}</p>
                    </li>
                  ))}
                </ol>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button to="/book" variant="secondary">{t("احجز مكالمة اكتشاف", "Book a discovery call")}</Button>
                  <Button to="/services" arrow>{t("استكشف الخدمات", "Explore services")}</Button>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </main>
      <FooterSection />
    </div>
  );
};

export default DiscoveryKitPage;
