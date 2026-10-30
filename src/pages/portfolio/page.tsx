import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import ClosingCTA from "@/pages/home/components/ClosingCTA";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import { useI18n } from "@/i18n/context";
import { CONCEPTS } from "@/data/concepts";
import { serviceById, SERVICE_TRACKS } from "@/data/services";

const PortfolioPage = () => {
  const { t, pick } = useI18n();
  const [filter, setFilter] = useState<string>("all");
  const tracksUsed = SERVICE_TRACKS.filter((s) => CONCEPTS.some((c) => c.track === s.id));
  const list = filter === "all" ? CONCEPTS : CONCEPTS.filter((c) => c.track === filter);

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("نماذج تصوّرية", "Concepts")}
        title={<>{t("تخيّل براندك", "Picture your brand")} <span className="text-paper-400">{t("قبل أن يُصنع.", "before it's made.")}</span></>}
        intro={t(
          "نماذج توضّح مخرجات كل مسار. الأسماء والصور توضيحية وليست مشاريع عملاء، وتُستبدل بمشاريع عملائنا المنجزة فور توفرها.",
          "Concepts that illustrate each track's output. Names and images are illustrative, not client work, and will be replaced with delivered projects.",
        )}
      />
      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24">
        <div className="flex flex-wrap gap-2 mb-10" role="tablist" aria-label={t("تصفية حسب المسار", "Filter by track")}>
          {[{ id: "all", label: t("الكل", "All") }, ...tracksUsed.map((s) => ({ id: s.id, label: pick(s.title) }))].map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-5 py-2.5 text-sm border transition-colors ${filter === f.id ? "bg-ink-900 text-white border-ink-900" : "border-paper-300 text-paper-700 hover:border-ink-900"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((c, i) => {
            const tr = serviceById(c.track)!;
            return (
              <Reveal as="figure" key={c.name.en} index={i % 3} className="group panel-in">
                <Photo src={c.photo} alt={`${t("نموذج تصوّري لعطر", "Concept for")} ${pick(c.name)}`} className="aspect-[4/5] rounded-[1.75rem]" imgClassName="group-hover:scale-105" />
                <figcaption className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl text-ink-900">{pick(c.name)}</p>
                    <p className="mt-1 text-sm text-paper-500">{pick(c.family)} · {pick(c.notes)}</p>
                  </div>
                  <Link to={`/services/${tr.id}`} className="shrink-0 rounded-full border border-paper-300 hover:border-ink-900 px-3 py-1.5 text-xs text-paper-700">{pick(tr.title)}</Link>
                </figcaption>
              </Reveal>
            );
          })}
        </div>
        <Link to="/creatives" className="mt-14 group flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] bg-sand-soft p-7 md:p-9">
          <span>
            <span className="block font-display text-2xl text-ink-900">{t("أعمال مصممينا في استوديو المبدعين", "Our creatives' work is in the creative studio")}</span>
            <span className="block mt-1 text-sm text-paper-600">{t("هوية، ملصقات، علب وعبوات — واطلب المصمم مباشرة.", "Identity, labels, boxes and bottles — and request the creative directly.")}</span>
          </span>
          <span className="rounded-full bg-ink-900 text-white px-5 py-2.5 text-sm inline-flex items-center gap-2">
            {t("استوديو المبدعين", "Creative studio")}
            <i className="ri-arrow-left-line inline-block flip-ltr" aria-hidden="true"></i>
          </span>
        </Link>
      </main>
      <ClosingCTA />
      <FooterSection />
    </div>
  );
};

export default PortfolioPage;
