import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Arrow from "@/components/ui/Arrow";
import { useI18n } from "@/i18n/context";
import { useCatalog } from "@/creatives/useCatalog";
import BriefForm from "@/creatives/components/BriefForm";
import { Availability, CImg, Monogram, SampleBadge, SpecialtyChip, SpecialtyFilter } from "@/creatives/components/ui";
import { SPECIALTIES, type Specialty } from "@/creatives/types";
import WorkGrid from "./WorkGrid";
import { arCount, enCount } from "@/i18n/plural";

export default function CreativesPage() {
  const { t, pick, num, sar } = useI18n();
  const { data, error } = useCatalog();
  const [filter, setFilter] = useState<Specialty | "all">("all");

  const creativeOf = useMemo(() => {
    const m = new Map(data?.creatives.map((c) => [c.id, c]));
    return (id: string) => m.get(id);
  }, [data]);
  const used = useMemo(() => SPECIALTIES.filter((s) => data?.creatives.some((c) => c.specialties.includes(s)) || data?.works.some((w) => w.category === s)), [data]);
  const creatives = data?.creatives.filter((c) => filter === "all" || c.specialties.includes(filter)) ?? [];
  const works = data?.works.filter((w) => filter === "all" || w.category === filter) ?? [];
  const anySample = data?.creatives.some((c) => c.sample);

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("استوديو المبدعين", "Creative studio")}
        title={<>{t("مصممون يفهمون العطر.", "Designers who get fragrance.")} <span className="text-paper-400">{t("وأعمال تتكلم عنهم.", "Work that speaks for them.")}</span></>}
        intro={t(
          "هوية، ملصق، علبة، عبوة، وتصوير. اختر مصمماً من الاستوديو، أو أرسل فكرتك ونرشّح لك الأنسب لها ولميزانيتك.",
          "Identity, labels, boxes, bottles and photography. Pick a creative from the studio, or send your idea and we'll match the right one for it and your budget.",
        )}
      >
        <div className="flex flex-wrap gap-3">
          <a href="#brief" className="rounded-full bg-ink-900 text-white px-6 py-3 text-[0.95rem] inline-flex items-center gap-3">
            {t("اطلب مصمماً", "Request a creative")}
            <Arrow />
          </a>
          <a href="#works" className="rounded-full border border-paper-300 hover:border-ink-900 px-6 py-3 text-[0.95rem] text-ink-900">
            {t("تصفّح الأعمال", "Browse the work")}
          </a>
        </div>
      </PageHeader>

      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 space-y-20 md:space-y-28">
        {error ? (
          <p role="alert" className="text-paper-600">{t("تعذّر تحميل الاستوديو. حدّث الصفحة بعد قليل.", "Couldn't load the studio. Refresh in a moment.")}</p>
        ) : !data ? (
          <div className="grid md:grid-cols-3 gap-6" aria-label={t("جاري التحميل", "Loading")}>
            {[0, 1, 2].map((i) => <div key={i} className="h-80 rounded-[1.75rem] shimmer bg-paper-100" />)}
          </div>
        ) : data.creatives.length === 0 ? (
          <div className="rounded-[1.75rem] border border-paper-200 bg-white p-10 text-center">
            <i className="ri-palette-line text-4xl text-paper-400" aria-hidden="true"></i>
            <p className="mt-4 font-display text-2xl text-ink-900">{t("نجهّز ملفات المصممين", "Creative profiles are coming")}</p>
            <p className="mt-2 text-paper-600">{t("أرسل فكرتك الآن ونرشّح لك مصمماً من فريقنا.", "Send your idea now and we'll match you with a creative from our team.")}</p>
          </div>
        ) : (
          <>
            <section aria-labelledby="cr-team">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <h2 id="cr-team" className="font-display text-3xl md:text-4xl text-ink-900">{t("المصممون", "The creatives")}</h2>
                <SpecialtyFilter options={used} value={filter} onChange={setFilter} label={t("تصفية حسب التخصص", "Filter by specialty")} />
              </div>
              {anySample && (
                <p className="mb-6 text-sm text-paper-500 inline-flex items-center gap-2">
                  <i className="ri-information-line" aria-hidden="true"></i>
                  {t("الملفات المعلَّمة «توضيحية» نماذج لعرض شكل الاستوديو، وأعمالها مشاريع تصوّرية.", "Profiles marked “sample” illustrate the studio; their work is concept projects.")}
                </p>
              )}
              {creatives.length === 0 ? (
                <p className="text-paper-500">{t("لا مصممين في هذا التخصص بعد.", "No creatives in this specialty yet.")}</p>
              ) : (
                <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {creatives.map((c, i) => {
                    const covers = data.works.filter((w) => w.creativeId === c.id).slice(0, 3);
                    const count = data.works.filter((w) => w.creativeId === c.id).length;
                    return (
                      <Reveal as="li" key={c.id} index={i % 3} className="panel-in">
                        <Link to={`/creatives/${c.slug}`} className="group block rounded-[1.75rem] bg-white border border-paper-200 hover:border-ink-900 transition-colors overflow-hidden h-full">
                          <span className="grid grid-cols-3 gap-0.5 h-36 bg-paper-100">
                            {[0, 1, 2].map((k) =>
                              covers[k] ? <CImg key={k} src={covers[k].images[0]} alt="" className="h-full" imgClassName="group-hover:scale-105" /> : <span key={k} className="bg-sand-soft" />,
                            )}
                          </span>
                          <span className="block px-6 pb-6 -mt-7 relative">
                            <Monogram creative={c} />
                            <span className="mt-3 flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block font-display text-2xl text-ink-900 leading-snug">{pick(c.name)}</span>
                                <span className="block mt-1 text-sm text-paper-600">{pick(c.title)}</span>
                              </span>
                              {c.sample && <SampleBadge className="shrink-0" />}
                            </span>
                            <span className="mt-3 block text-xs text-paper-500">
                              {[pick(c.city), t(`خبرة ${arCount(c.yearsExp, { one: "سنة واحدة", two: "سنتين", few: "سنوات", many: "سنة" }, num)}`, `${enCount(c.yearsExp, "yr", "yrs")} experience`), t(arCount(count, { one: "عمل واحد", two: "عملان", few: "أعمال", many: "عملاً" }, num), enCount(count, "work", "works"))].filter(Boolean).join(" · ")}
                            </span>
                            <span className="mt-4 flex flex-wrap gap-1.5">
                              {c.specialties.map((s) => <SpecialtyChip key={s} s={s} />)}
                            </span>
                            <span className="mt-5 pt-4 border-t border-paper-100 flex items-center justify-between gap-3">
                              <Availability available={c.available} />
                              {c.rateFrom ? <span className="text-xs text-paper-600">{t("يبدأ من", "From")} <span className="font-display text-ink-900">{sar(c.rateFrom)}</span></span> : null}
                            </span>
                          </span>
                        </Link>
                      </Reveal>
                    );
                  })}
                </ul>
              )}
            </section>

            <section id="works" aria-labelledby="cr-works" className="scroll-mt-28">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <h2 id="cr-works" className="font-display text-3xl md:text-4xl text-ink-900">
                  {t("أحدث الأعمال", "Latest work")}
                  {filter !== "all" && <span className="text-paper-400"> · {num(works.length)}</span>}
                </h2>
              </div>
              {works.length ? <WorkGrid works={works} creativeOf={creativeOf} /> : <p className="text-paper-500">{t("لا أعمال في هذا التخصص بعد.", "No work in this specialty yet.")}</p>}
            </section>
          </>
        )}

        <section aria-labelledby="cr-how" className="grid md:grid-cols-3 gap-6">
          <h2 id="cr-how" className="sr-only">{t("كيف يعمل الاستوديو", "How the studio works")}</h2>
          {[
            { i: "ri-user-search-line", h: t("اختر أو دعنا نرشّح", "Choose, or let us match"), p: t("تصفّح الأعمال واختر مصمماً، أو اترك الترشيح لنا حسب مشروعك وميزانيتك.", "Browse the work and pick a creative, or let us match one to your project and budget.") },
            { i: "ri-draft-line", h: t("أرسل ملخصاً قصيراً", "Send a short brief"), p: t("ما الذي تحتاجه ومتى. ويمكنك إرفاق تصميمك من استوديو 3D مباشرة.", "What you need and when. You can attach your 3D studio design directly.") },
            { i: "ri-shake-hands-line", h: t("جلسة تعارف وعرض واضح", "Intro session and a clear quote"), p: t("خلال يومي عمل: جلسة مع المصمم، ثم عرض بالنطاق والمدة والسعر قبل أي دفع.", "Within two business days: a session with the creative, then a quote with scope, timeline and price before any payment.") },
          ].map((s, k) => (
            <div key={k} className="rounded-[1.75rem] bg-sand-soft p-7">
              <span className="font-mono text-xs text-paper-500">{num(k + 1)}</span>
              <i className={`${s.i} block mt-4 text-2xl text-ink-900`} aria-hidden="true"></i>
              <h3 className="mt-3 font-display text-xl text-ink-900">{s.h}</h3>
              <p className="mt-2 text-sm text-paper-600 leading-[1.8]">{s.p}</p>
            </div>
          ))}
        </section>

        <section id="brief" aria-labelledby="cr-brief" className="scroll-mt-28 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <h2 id="cr-brief" className="font-display text-3xl md:text-4xl text-ink-900">{t("اطلب مصمماً", "Request a creative")}</h2>
            <p className="mt-4 text-paper-600 leading-[1.8]">{t("أخبرنا بما تحتاجه. لا يلزمك الدفع الآن.", "Tell us what you need. No payment now.")}</p>
            <Link to="/studio-3d" className="mt-6 inline-flex items-center gap-2 text-sm text-ink-900 underline underline-offset-4">
              <i className="ri-shapes-line" aria-hidden="true"></i>
              {t("صمّم عبوتك وعلبتك في استوديو 3D أولاً", "Design your bottle and box in the 3D studio first")}
            </Link>
          </div>
          <div className="lg:col-span-8 rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-10">
            <BriefForm creatives={data?.creatives ?? []} />
          </div>
        </section>
      </main>
      <FooterSection />
    </div>
  );
}
