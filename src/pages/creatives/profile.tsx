import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import { useI18n } from "@/i18n/context";
import { SITE } from "@/config/site";
import { useCatalog } from "@/creatives/useCatalog";
import BriefForm from "@/creatives/components/BriefForm";
import { Availability, Monogram, SampleBadge, SpecialtyChip, SpecialtyFilter } from "@/creatives/components/ui";
import { SPECIALTIES, type Specialty } from "@/creatives/types";
import WorkGrid from "./WorkGrid";
import { arCount, enCount } from "@/i18n/plural";

export default function CreativeProfilePage() {
  const { slug } = useParams();
  const { t, pick, num, sar, lang } = useI18n();
  const { data, error } = useCatalog();
  const [filter, setFilter] = useState<Specialty | "all">("all");
  const c = data?.creatives.find((x) => x.slug === slug);
  const works = useMemo(() => data?.works.filter((w) => w.creativeId === c?.id) ?? [], [data, c]);
  const cats = SPECIALTIES.filter((s) => works.some((w) => w.category === s));
  const shown = works.filter((w) => filter === "all" || w.category === filter);
  const creativeOf = () => c;

  // عنوان الصفحة باسم المصمم (المسار العام لا يعرفه)
  useEffect(() => {
    if (c) document.title = `${pick(c.name)} · ${t("استوديو المبدعين", "Creative studio")} | ${pick(SITE.shortName)}`;
  }, [c, pick, t, lang]);

  const short = c ? pick(c.name).split(" ·")[0] : "";

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-5 md:px-8 pt-28 md:pt-36 pb-24">
        <Link to="/creatives" className="inline-flex items-center gap-2 text-sm text-paper-600 hover:text-ink-900">
          <i className="ri-arrow-right-line inline-block flip-ltr" aria-hidden="true"></i>
          {t("كل المصممين", "All creatives")}
        </Link>

        {error ? (
          <p role="alert" className="mt-10 text-paper-600">{t("تعذّر التحميل. حدّث الصفحة بعد قليل.", "Couldn't load. Refresh in a moment.")}</p>
        ) : !data ? (
          <div className="mt-10 h-64 rounded-[1.75rem] shimmer bg-paper-100" aria-label={t("جاري التحميل", "Loading")} />
        ) : !c ? (
          <div className="mt-10 rounded-[1.75rem] border border-paper-200 bg-white p-10 text-center">
            <h1 className="font-display text-3xl text-ink-900">{t("لم نجد هذا المصمم", "We couldn't find this creative")}</h1>
            <p className="mt-3 text-paper-600">{t("ربما تغيّر رابط الملف أو لم يعد منشوراً.", "The profile link may have changed or it's no longer published.")}</p>
            <Link to="/creatives" className="mt-6 inline-flex rounded-full bg-ink-900 text-white px-6 py-3 text-sm">{t("تصفّح الاستوديو", "Browse the studio")}</Link>
          </div>
        ) : (
          <>
            <header className="mt-8 grid lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-5">
                  <Monogram creative={c} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Availability available={c.available} />
                      {c.sample && <SampleBadge />}
                    </div>
                    <h1 className="mt-2 font-display text-[2.2rem] leading-[1.15] md:text-5xl text-ink-900">{pick(c.name)}</h1>
                    <p className="mt-2 text-paper-600">{[pick(c.title), pick(c.city)].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {c.specialties.map((s) => <SpecialtyChip key={s} s={s} />)}
                </div>
                {pick(c.bio) && <p className="mt-6 text-lg text-paper-700 leading-[1.9] max-w-3xl">{pick(c.bio)}</p>}
              </div>
              <aside className="lg:col-span-4 rounded-[1.75rem] bg-white border border-paper-200 p-6">
                <dl className="grid grid-cols-2 gap-4">
                  {[
                    { k: t("سنوات الخبرة", "Experience"), v: t(`${num(c.yearsExp)} سنوات`, `${c.yearsExp} yrs`) },
                    { k: t("الأعمال", "Works"), v: num(works.length) },
                    { k: t("مدة التسليم المعتادة", "Usual turnaround"), v: c.turnaroundDays ? t(arCount(c.turnaroundDays, { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوماً" }, num), enCount(c.turnaroundDays, "day", "days")) : "—" },
                    { k: t("يبدأ من", "Starting from"), v: c.rateFrom ? sar(c.rateFrom) : t("حسب المشروع", "By project") },
                  ].map((x) => (
                    <div key={x.k}>
                      <dt className="text-xs text-paper-500">{x.k}</dt>
                      <dd className="mt-1 font-display text-xl text-ink-900">{x.v}</dd>
                    </div>
                  ))}
                </dl>
                <a href="#brief" className="mt-6 w-full rounded-full bg-ink-900 text-white px-6 py-3 text-sm inline-flex items-center justify-center gap-2">
                  <i className="ri-palette-line" aria-hidden="true"></i>
                  {t(`اطلب ${short}`, `Request ${short}`)}
                </a>
                {!c.available && <p className="mt-3 text-xs text-paper-500 text-center">{t("جدوله ممتلئ حالياً: نضعك في قائمته أو نرشّح بديلاً قريباً من أسلوبه.", "Fully booked: we'll queue you or suggest a creative with a similar style.")}</p>}
              </aside>
            </header>

            <section aria-labelledby="pf-works" className="mt-16 md:mt-24">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <h2 id="pf-works" className="font-display text-3xl md:text-4xl text-ink-900">{t("الأعمال", "Work")}</h2>
                {cats.length > 1 && <SpecialtyFilter options={cats} value={filter} onChange={setFilter} label={t("تصفية الأعمال", "Filter work")} />}
              </div>
              {shown.length ? <WorkGrid works={shown} creativeOf={creativeOf} showCreative={false} /> : <p className="text-paper-500">{t("لا أعمال منشورة بعد.", "No published work yet.")}</p>}
            </section>

            <section id="brief" aria-labelledby="pf-brief" className="mt-20 md:mt-28 scroll-mt-28 grid lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4">
                <h2 id="pf-brief" className="font-display text-3xl md:text-4xl text-ink-900">{t(`اعمل مع ${short}`, `Work with ${short}`)}</h2>
                <p className="mt-4 text-paper-600 leading-[1.8]">{t("ملخص قصير يكفي. نرتّب جلسة تعارف ثم عرضاً واضحاً قبل أي دفع.", "A short brief is enough. We'll arrange an intro session, then a clear quote before any payment.")}</p>
              </div>
              <div className="lg:col-span-8 rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-10">
                <BriefForm creatives={data.creatives} fixed={c} />
              </div>
            </section>
          </>
        )}
      </main>
      <FooterSection />
    </div>
  );
}
