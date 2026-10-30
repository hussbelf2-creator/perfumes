import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import Arrow from "@/components/ui/Arrow";
import FaqList from "@/components/feature/FaqList";
import ContactForm from "@/components/feature/ContactForm";
import { useI18n } from "@/i18n/context";
import { serviceById, SERVICE_TRACKS } from "@/data/services";
import { useContent } from "@/cms/ContentProvider";
import { useEffect } from "react";
import { useServicePrice } from "@/pricing/usePrices";
import { trackStart, workspaceOf } from "@/start/workspaces";
import { ManufacturingRequirements } from "@/components/feature/Requirements";

const ServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, pick } = useI18n();
  const priceOf = useServicePrice();
  const general = useContent("faq").items.filter((f) => f.published);
  const s = serviceById(id);

  useEffect(() => {
    if (s) document.title = `${pick(s.title)} | ${t("منصة العطور", "Perfume Platform")}`;
  }, [s, pick, t]);

  if (!s) return <Navigate to="/services" replace />;

  // الملخص أولاً ثم البيانات — لا تسجيل قبل أن يقول العميل ما يريد
  // المسار يبدأ من لوحة عمله (استوديو، حاسبة، مكوّن) إن كانت له، وإلا من البريف
  const startTo = trackStart(s.id);
  const ws = workspaceOf(s.id);
  const sections = [
    { id: "overview", label: t("نظرة عامة", "Overview") },
    { id: "deliverables", label: t("المخرجات", "Deliverables") },
    { id: "process", label: t("المراحل", "Process") },
    { id: "requirements", label: t("متطلبات التصنيع", "Requirements") },
    { id: "packages", label: t("الباقات", "Packages") },
    { id: "faq", label: t("الأسئلة", "FAQ") },
  ];
  const faqs = [...s.faqs, ...general.filter((f) => f.topic === "cost" || f.topic === "ownership").slice(0, 2)];
  const related = s.related.map((r) => serviceById(r)!).filter(Boolean);
  const index = SERVICE_TRACKS.findIndex((x) => x.id === s.id);
  const next = SERVICE_TRACKS[(index + 1) % SERVICE_TRACKS.length];

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />

      {/* الهيرو */}
      <header className="pt-28 md:pt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <nav aria-label={t("شريط التنقل", "Breadcrumb")} className="text-sm text-paper-500 flex items-center gap-2 mb-8">
            <Link to="/services" className="hover:text-ink-900">{t("الخدمات", "Services")}</Link>
            <i className="ri-arrow-left-s-line flip-ltr" aria-hidden="true"></i>
            <span className="text-ink-900">{pick(s.title)}</span>
          </nav>
          <div className="grid lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col">
              <p className="inline-flex items-center gap-2 text-sm text-paper-500 fade-up">
                <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
                {t("المسار", "Track")} N°{s.no} · <span dir="ltr">{s.title.en}</span>
              </p>
              <h1 className="mt-6 font-display text-ink-900 text-[2.6rem] leading-[1.12] sm:text-6xl xl:text-7xl tracking-tight">
                <span className="line-mask"><span>{pick(s.title)}</span></span>
              </h1>
              <p className="mt-5 text-xl text-accent2-ink fade-up" style={{ ["--d" as string]: 2 }}>{pick(s.tagline)}</p>
              <p className="mt-5 text-lg text-paper-600 leading-[1.8] max-w-xl fade-up" style={{ ["--d" as string]: 3 }}>{pick(s.summary)}</p>

              <dl className="mt-8 grid grid-cols-2 gap-3 max-w-md fade-up" style={{ ["--d" as string]: 4 }}>
                <div className="rounded-2xl bg-white border border-paper-200 p-4">
                  <dt className="text-xs text-paper-500">{t("السعر", "Price")}</dt>
                  <dd className="mt-1 text-ink-900 font-medium">{pick(priceOf(s))}</dd>
                </div>
                <div className="rounded-2xl bg-white border border-paper-200 p-4">
                  <dt className="text-xs text-paper-500">{t("المدة", "Duration")}</dt>
                  <dd className="mt-1 text-ink-900 font-medium">{pick(s.duration)}</dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-wrap gap-3 fade-up" style={{ ["--d" as string]: 5 }}>
                <Button to={startTo} arrow>{t("ابدأ هذا المسار", "Start this track")}</Button>
                <Button to={`/book?track=${s.id}`} variant="secondary">{t("تحدّث مع خبير أولاً", "Talk to an expert first")}</Button>
              </div>
              {ws && (
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-paper-600 fade-up" style={{ ["--d" as string]: 6 }}>
                  <i className={`${ws.icon} text-ink-900`} aria-hidden="true"></i>
                  {t(`تبدأ في ${pick(ws.label)}: ${pick(ws.verb)}، ثم أسئلة سريعة، ثم حسابك ولوحة التحكم.`, `You start in the ${pick(ws.label)}: ${pick(ws.verb).toLowerCase()}, then quick questions, then your account and dashboard.`)}
                </p>
              )}
            </div>
            <div className="lg:col-span-6">
              <div className="curtain h-full rounded-[2rem] overflow-hidden">
                <Photo src={s.photo} alt={pick(s.title)} priority zoom className="h-full min-h-[22rem] lg:min-h-[34rem]" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* تنقل داخل الصفحة */}
      <nav aria-label={t("أقسام الصفحة", "On this page")} className="sticky top-[4.25rem] z-30 mt-14 bg-paper-50/90 backdrop-blur border-y border-paper-200">
        <ul className="max-w-7xl mx-auto px-5 md:px-8 flex gap-6 overflow-x-auto text-sm">
          {sections.map((x) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className="block py-4 text-paper-600 hover:text-ink-900 whitespace-nowrap">{x.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {/* لمن هذا المسار */}
      <section id="overview" className="py-20 md:py-28 scroll-mt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-6">
          <Reveal className="rounded-[1.75rem] bg-white border border-paper-200 p-8 md:p-10">
            <p className="text-sm text-paper-500">{t("لمن هذا المسار", "Who it's for")}</p>
            <ul className="mt-6 space-y-4">
              {pick(s.forWho).map((w) => (
                <li key={w} className="flex gap-3 text-lg text-ink-900">
                  <i className="ri-user-heart-line text-accent2 mt-1" aria-hidden="true"></i>
                  {w}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal index={1} className="rounded-[1.75rem] bg-ink-900 text-white p-8 md:p-10 flex flex-col">
            <p className="text-sm text-white/55">{t("ما تستلمه في النهاية", "What you walk away with")}</p>
            <p className="mt-6 font-display text-3xl md:text-4xl leading-[1.3]">{pick(s.outcome)}</p>
          </Reveal>
        </div>
      </section>

      {/* المخرجات */}
      <section id="deliverables" className="py-20 md:py-28 bg-white border-y border-paper-200 scroll-mt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("المخرجات", "Deliverables")} title={t("ماذا ستستلم بالتحديد؟", "What exactly do you receive?")} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.deliverables.map((d, i) => (
              <Reveal key={d.title.en} index={i % 3} className="lift rounded-2xl border border-paper-200 bg-paper-50 p-7">
                <span className="w-12 h-12 rounded-xl bg-white border border-paper-200 flex items-center justify-center text-ink-900">
                  <i className={`${d.icon} text-xl`} aria-hidden="true"></i>
                </span>
                <h3 className="mt-6 font-display text-xl text-ink-900">{pick(d.title)}</h3>
                <p className="mt-2 text-paper-600 leading-[1.7]">{pick(d.desc)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* المراحل */}
      <section id="process" className="py-20 md:py-28 scroll-mt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("المراحل", "Process")} title={t("كيف يسير العمل", "How the work flows")} intro={t("تعتمد كل مرحلة قبل الانتقال لما بعدها.", "You approve each stage before the next begins.")} />
          <ol className={`grid gap-4 ${s.steps.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
            {s.steps.map((st, i) => (
              <Reveal as="li" key={st.title.en} index={i} className="relative rounded-2xl border border-paper-200 bg-white p-7">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-full bg-ink-900 text-white font-mono text-sm flex items-center justify-center">{i + 1}</span>
                  <span className="text-xs rounded-full bg-sand-soft text-ink-900 px-3 py-1">{pick(st.time)}</span>
                </div>
                <h3 className="mt-6 font-display text-xl text-ink-900">{pick(st.title)}</h3>
                <p className="mt-2 text-sm text-paper-600 leading-[1.8]">{pick(st.desc)}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* متطلبات التصنيع */}
      <section id="requirements" className="py-20 md:py-28 bg-paper-100/60 scroll-mt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("متطلبات التصنيع", "Manufacturing requirements")} title={t("ما نحتاجه منك، وما تستلمه منا", "What we need from you, and what you get from us")} intro={t("لا مفاجآت في منتصف الطريق: هذه قائمة ما يلزم لكل مرحلة، من البدء إلى التسليم — داخل المملكة أو للتصدير.", "No mid-project surprises: everything each stage needs, from start to delivery — in the Kingdom or for export.")} />
          <ManufacturingRequirements track={s.id} />
        </div>
      </section>

      {/* الباقات */}
      <section id="packages" className="py-20 md:py-28 bg-ink-900 text-white scroll-mt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead
            dark
            eyebrow={t("الباقات", "Packages")}
            title={t("اختر حجم المشروع", "Choose your scope")}
            intro={t("الأسعار النهائية تصدر في عرض سعر مفصّل بعد مراجعة البريف.", "Final prices come in a detailed quote after we review your brief.")}
          />
          <div className={`grid gap-5 ${s.packages.length >= 3 ? "lg:grid-cols-3" : s.packages.length === 2 ? "md:grid-cols-2" : "max-w-xl"}`}>
            {s.packages.map((p, i) => (
              <Reveal
                key={p.name.en}
                index={i}
                className={`relative rounded-[1.75rem] p-8 flex flex-col ${p.featured ? "bg-white text-ink-900" : "bg-white/5 border border-white/10"}`}
              >
                {p.featured && s.packages.length > 1 && (
                  <span className="absolute top-6 end-6 rounded-full bg-accent2 text-white text-xs px-3 py-1">{pick(p.note)}</span>
                )}
                <p className={`text-sm ${p.featured ? "text-paper-500" : "text-white/55"}`}>{p.featured && s.packages.length > 1 ? t("باقة", "Package") : pick(p.note)}</p>
                <h3 className="mt-2 font-display text-3xl">{pick(p.name)}</h3>
                <p className={`mt-4 text-lg ${p.featured ? "text-ink-900" : "text-white"}`}>{pick(i === 0 ? priceOf(s) : p.price)}</p>
                <ul className="mt-6 space-y-3 flex-1">
                  {pick(p.features).map((f) => (
                    <li key={f} className={`flex gap-3 ${p.featured ? "text-paper-700" : "text-white/75"}`}>
                      <i className={`ri-check-line ${p.featured ? "text-ink-900" : "text-accent2"}`} aria-hidden="true"></i>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button to={trackStart(s.id, i)} variant={p.featured ? "primary" : "light"} arrow className="w-full !justify-between">
                    {t("اطلب هذه الباقة", "Request this package")}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 rounded-2xl border border-white/10 p-6 md:p-8">
            <p className="text-sm text-white/55">{t("إضافات اختيارية", "Optional add-ons")}</p>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {pick(s.addons).map((a) => (
                <li key={a} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80">+ {a}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* الأسئلة */}
      <section id="faq" className="py-20 md:py-28 scroll-mt-32">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-12">
          <Reveal className="lg:col-span-4">
            <p className="inline-flex items-center gap-2 text-sm text-paper-500 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
              {t("أسئلة عن هذا المسار", "About this track")}
            </p>
            <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.2]">{t("قبل أن تقرر.", "Before you decide.")}</h2>
          </Reveal>
          <div className="lg:col-span-8">
            <FaqList items={faqs} idPrefix={`svc-${s.id}`} />
          </div>
        </div>
      </section>

      {/* تواصل بخصوص المسار */}
      <section className="py-20 md:py-28 bg-white border-y border-paper-200">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-12">
          <Reveal className="lg:col-span-5">
            <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.2]">{t("لديك سؤال عن", "Questions about")} {pick(s.title)}{t("؟", "?")}</h2>
            <p className="mt-5 text-paper-600 leading-[1.8]">{t("أرسل لنا، وسيرد عليك المختص بهذا المسار خلال يوم عمل.", "Send us a note and the specialist for this track will reply within one business day.")}</p>
          </Reveal>
          <Reveal index={1} className="lg:col-span-7">
            <ContactForm defaultTrack={`${s.id} — ${s.title.en}`} />
          </Reveal>
        </div>
      </section>

      {/* مسارات مرتبطة */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("غالباً تُجمع مع", "Often combined with")} title={t("مسارات مرتبطة", "Related tracks")} />
          <div className="grid md:grid-cols-3 gap-5">
            {related.map((r, i) => (
              <Reveal key={r.id} index={i}>
                <Link to={`/services/${r.id}`} className="group lift block rounded-2xl overflow-hidden bg-white border border-paper-200 hover:border-ink-900">
                  <Photo src={r.photo} alt={pick(r.title)} className="aspect-[16/10]" imgClassName="group-hover:scale-105" />
                  <div className="p-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-display text-xl text-ink-900">{pick(r.title)}</p>
                      <p className="text-sm text-paper-500">{pick(r.duration)}</p>
                    </div>
                    <Arrow />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 flex justify-end">
            <Link to={`/services/${next.id}`} className="group inline-flex items-center gap-2 text-ink-900 border-b border-ink-900/30 hover:border-ink-900 pb-1">
              {t("المسار التالي:", "Next track:")} {pick(next.title)}
              <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* شريط إجراء ثابت على الجوال */}
      <div className="md:hidden sticky bottom-0 z-40 bg-paper-50/95 backdrop-blur border-t border-paper-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-900 truncate">{pick(s.title)}</p>
          <p className="text-xs text-paper-500">{pick(priceOf(s))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/book?track=${s.id}`} aria-label={t("احجز مكالمة مجانية", "Book a free call")} className="w-11 h-11 rounded-full border border-paper-300 text-ink-900 flex items-center justify-center">
            <i className="ri-calendar-event-line" aria-hidden="true"></i>
          </Link>
          <Link to={startTo} className="rounded-full bg-ink-900 text-white text-sm px-5 py-3 whitespace-nowrap">{t("ابدأ الآن", "Start now")}</Link>
        </div>
      </div>

      <FooterSection />
    </div>
  );
};

export default ServiceDetail;
