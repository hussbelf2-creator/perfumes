import { useMemo, useState } from "react";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Button from "@/components/ui/Button";
import FaqList from "@/components/feature/FaqList";
import { useI18n } from "@/i18n/context";
import { FAQ_TOPICS } from "@/data/faq";
import { useContent } from "@/cms/ContentProvider";
import { SERVICE_TRACKS } from "@/data/services";

const FAQPage = () => {
  const { t, pick } = useI18n();
  const [topic, setTopic] = useState<string>("all");
  const faqDoc = useContent("faq");
  const [query, setQuery] = useState("");

  const all = useMemo(
    () => [
      ...faqDoc.items.filter((f) => f.published).map((f) => ({ ...f, group: f.topic as string })),
      ...SERVICE_TRACKS.flatMap((s) => s.faqs.map((f) => ({ ...f, group: `track-${s.id}` }))),
    ],
    [faqDoc],
  );
  const tabs = [
    { key: "all", label: t("الكل", "All") },
    ...FAQ_TOPICS.map((x) => ({ key: x.key as string, label: pick(x.label) })),
    { key: "tracks", label: t("عن المسارات", "About tracks") },
  ];
  const q = query.trim().toLowerCase();
  const items = all
    .filter((f) => topic === "all" || (topic === "tracks" ? f.group.startsWith("track-") : f.group === topic))
    .filter((f) => !q || pick(f.q).toLowerCase().includes(q) || pick(f.a).toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("الأسئلة الشائعة", "FAQ")}
        title={<>{t("كل ما تريد معرفته", "Everything you want to know")} <span className="text-paper-400">{t("قبل أن تبدأ.", "before you start.")}</span></>}
        intro={t("عن المدة والتكلفة والعينات والملكية. لم تجد سؤالك؟ تواصل معنا مباشرة.", "Timing, cost, samples and ownership. Can't find yours? Ask us directly.")}
      />
      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-10">
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 self-start">
          <div className="relative">
            <label htmlFor="faq-search" className="sr-only">{t("ابحث في الأسئلة", "Search questions")}</label>
            <i className="ri-search-line absolute top-1/2 -translate-y-1/2 start-4 text-paper-400" aria-hidden="true"></i>
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ابحث في الأسئلة…", "Search questions…")}
              className="w-full rounded-full border border-paper-200 bg-white ps-11 pe-4 py-3 outline-none focus:border-ink-900"
            />
          </div>
          <div className="flex flex-wrap lg:flex-col gap-2" role="tablist" aria-label={t("الموضوعات", "Topics")}>
            {tabs.map((x) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={topic === x.key}
                onClick={() => setTopic(x.key)}
                className={`rounded-full lg:rounded-xl px-4 py-2.5 text-sm text-start border transition-colors ${topic === x.key ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 bg-white text-paper-700 hover:border-ink-900"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <Reveal className="rounded-2xl bg-ink-900 text-white p-6">
            <p className="font-display text-xl">{t("لم تجد إجابتك؟", "Still have a question?")}</p>
            <p className="mt-2 text-sm text-white/65">{t("نرد خلال يوم عمل.", "We reply within one business day.")}</p>
            <div className="mt-5">
              <Button to="/contact" variant="light" arrow>{t("اسألنا", "Ask us")}</Button>
            </div>
          </Reveal>
        </aside>
        <div className="lg:col-span-8">
          {items.length ? (
            <FaqList key={`${topic}-${q}`} items={items} idPrefix="faqp" initialOpen={null} />
          ) : (
            <p className="text-paper-500 py-10">{t("لا توجد نتائج مطابقة.", "No matching questions.")}</p>
          )}
        </div>
      </main>
      <FooterSection />
    </div>
  );
};

export default FAQPage;
