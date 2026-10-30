import { Link } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import ClosingCTA from "@/pages/home/components/ClosingCTA";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import Arrow from "@/components/ui/Arrow";
import TrackChooser from "@/components/feature/TrackChooser";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { SERVICE_TRACKS, CAPABILITIES } from "@/data/services";
import { useServicePrice } from "@/pricing/usePrices";
import { ExportSection } from "@/components/feature/Requirements";
import FeesSection from "@/pages/home/components/FeesSection";

const ServicesPage = () => {
  const { t, pick } = useI18n();
  const priceOf = useServicePrice();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("الخدمات", "Services")}
        title={
          user ? (
            <>
              {t(`أهلاً ${user.firstName}،`, `Welcome, ${user.firstName}.`)} <span className="text-paper-400">{t("من أين نبدأ؟", "Where shall we start?")}</span>
            </>
          ) : (
            <>
              {t("ستة مسارات،", "Six tracks,")} <span className="text-paper-400">{t("ابدأ من حيث تحتاج.", "start where you need.")}</span>
            </>
          )
        }
        intro={t(
          "كل مسار مستقل بمخرجات ومدة وسعر واضحين. اختر واحداً، أو اجمع أكثر من مسار في مشروع واحد بإدارة واحدة.",
          "Each track stands alone with clear deliverables, timing and price. Pick one, or combine several into one project under one manager.",
        )}
      >
        <div className="flex flex-wrap gap-3">
          <a href="#chooser" className="group inline-flex items-center gap-3 rounded-full bg-ink-900 text-white ps-6 pe-1.5 py-1.5 min-h-[3rem] hover:bg-ink-700 transition-colors">
            {t("ساعدني أختار", "Help me choose")}
            <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"><Arrow /></span>
          </a>
          <Button to="/book" variant="secondary">{t("مكالمة اكتشاف مجانية", "Free discovery call")}</Button>
        </div>
      </PageHeader>

      {/* بطاقات المسارات */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          {SERVICE_TRACKS.map((s, i) => (
            <Reveal key={s.id} index={i % 2} className={i === 0 ? "md:col-span-2" : ""}>
              <Link
                to={`/services/${s.id}`}
                className={`group lift h-full grid rounded-[1.75rem] overflow-hidden bg-white border border-paper-200 hover:border-ink-900 ${i === 0 ? "md:grid-cols-2" : "grid-rows-[auto_1fr]"}`}
              >
                <Photo src={s.photo} alt={pick(s.title)} className={i === 0 ? "min-h-[18rem] md:min-h-[26rem]" : "aspect-[16/9]"} imgClassName="group-hover:scale-105" />
                <div className="p-7 md:p-9 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-xl bg-sand-soft flex items-center justify-center text-ink-900">
                      <i className={`${s.icon} text-lg`} aria-hidden="true"></i>
                    </span>
                    <span className="label-mono">N°{s.no}</span>
                  </div>
                  <h2 className={`mt-6 font-display text-ink-900 leading-[1.2] ${i === 0 ? "text-4xl md:text-5xl" : "text-3xl"}`}>{pick(s.title)}</h2>
                  <p className="mt-2 text-accent2-ink">{pick(s.tagline)}</p>
                  <p className="mt-4 text-paper-600 leading-[1.8]">{pick(s.summary)}</p>
                  {i === 0 && (
                    <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {s.deliverables.map((d) => (
                        <li key={d.title.en} className="flex items-center gap-2 text-sm text-paper-700">
                          <i className={`${d.icon} text-ink-900`} aria-hidden="true"></i>
                          {pick(d.title)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-8 flex flex-wrap items-end justify-between gap-4">
                    <div className="flex gap-8">
                      <div>
                        <p className="text-xs text-paper-500">{t("السعر", "Price")}</p>
                        <p className="text-ink-900 font-medium">{pick(priceOf(s))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-paper-500">{t("المدة", "Duration")}</p>
                        <p className="text-ink-900 font-medium">{pick(s.duration)}</p>
                      </div>
                    </div>
                    <span className="w-11 h-11 rounded-full bg-ink-900 text-white flex items-center justify-center">
                      <Arrow />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ساعدني أختار */}
      <section id="chooser" className="px-5 md:px-8 pb-24 scroll-mt-24">
        <Reveal className="max-w-7xl mx-auto">
          <TrackChooser />
          <div className="mt-6">
            <ExportSection dark />
          </div>
        </Reveal>
      </section>

      {/* جدول المقارنة */}
      <section className="py-24 bg-white border-y border-paper-200">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead
            eyebrow={t("المقارنة", "Compare")}
            title={t("ماذا يشمل كل مسار؟", "What does each track include?")}
            intro={t(
              "البراند الكامل يجمع كل شيء. بقية المسارات تغطي مرحلة بعينها ويمكن جمعها.",
              "The full brand covers everything. The other tracks cover one stage each and can be combined.",
            )}
          />
          <Reveal className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">{t("مقارنة المسارات", "Track comparison")}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-start font-normal text-paper-500 py-4 pe-4 w-56">{t("القدرة", "Capability")}</th>
                  {SERVICE_TRACKS.map((s) => (
                    <th key={s.id} scope="col" className="py-4 px-2 font-normal">
                      <Link to={`/services/${s.id}`} className="flex flex-col items-center gap-2 text-ink-900 hover:underline underline-offset-4">
                        <i className={`${s.icon} text-lg`} aria-hidden="true"></i>
                        <span className="text-center leading-[1.4]">{pick(s.title)}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((c) => (
                  <tr key={c.key} className="border-t border-paper-200">
                    <th scope="row" className="text-start font-normal text-paper-700 py-4 pe-4">{pick(c.label)}</th>
                    {SERVICE_TRACKS.map((s) => (
                      <td key={s.id} className="text-center py-4">
                        {s.capabilities.includes(c.key) ? (
                          <span className="inline-flex w-7 h-7 rounded-full bg-ink-900 text-white items-center justify-center" role="img" aria-label={t("مشمول", "Included")}>
                            <i className="ri-check-line" aria-hidden="true"></i>
                          </span>
                        ) : (
                          <span className="text-paper-300" role="img" aria-label={t("غير مشمول", "Not included")}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-paper-200">
                  <th scope="row" className="text-start font-normal text-paper-700 py-4 pe-4">{t("المدة", "Duration")}</th>
                  {SERVICE_TRACKS.map((s) => (
                    <td key={s.id} className="text-center py-4 text-ink-900">{pick(s.duration)}</td>
                  ))}
                </tr>
                <tr className="border-t border-paper-200">
                  <th scope="row" className="text-start font-normal text-paper-700 py-4 pe-4">{t("السعر", "Price")}</th>
                  {SERVICE_TRACKS.map((s) => (
                    <td key={s.id} className="text-center py-4 text-ink-900">{pick(priceOf(s))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* كيف نبدأ */}
      <section className="py-24 bg-white border-b border-paper-200">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("الأسعار والرسوم", "Pricing & fees")} title={t("أسعار بلا مفاجآت.", "No-surprise pricing.")} intro={t("ما هو مجاني، ومتى تدفع وكم — قبل أن تبدأ.", "What's free, when you pay and how much — before you start.")} />
          <FeesSection compact />
        </div>
      </section>
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("كيف نبدأ", "How we start")} title={t("من أول رسالة إلى بدء العمل.", "From first message to kickoff.")} />
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "ri-chat-3-line", title: t("أخبرنا عن فكرتك", "Tell us your idea"), desc: t("عبر النموذج أو التسجيل. سطران يكفيان.", "Via the form or sign-up. Two lines are enough.") },
              { icon: "ri-file-list-3-line", title: t("بريف وعرض سعر", "Brief & quote"), desc: t("جلسة تعريف، ثم عرض سعر مفصّل بجدول زمني.", "A discovery call, then a detailed quote with a timeline.") },
              { icon: "ri-rocket-2-line", title: t("نبدأ العمل", "We kick off"), desc: t("مدير مشروعك يفتح مساحة مشروعك وتتابع كل شيء منها.", "Your project manager opens your project space; you follow everything there.") },
            ].map((x, i) => (
              <Reveal key={x.title} index={i} className="rounded-[1.75rem] bg-white border border-paper-200 p-8">
                <span className="w-12 h-12 rounded-full bg-ink-900 text-white flex items-center justify-center">
                  <i className={`${x.icon} text-lg`} aria-hidden="true"></i>
                </span>
                <p className="mt-6 label-mono">0{i + 1}</p>
                <h3 className="mt-2 font-display text-2xl text-ink-900">{x.title}</h3>
                <p className="mt-3 text-paper-600 leading-[1.8]">{x.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA />
      <FooterSection />
    </div>
  );
};

export default ServicesPage;
