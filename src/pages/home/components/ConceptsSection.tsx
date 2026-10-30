import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { CONCEPTS } from "@/data/concepts";

const ConceptsSection = () => {
  const { t, pick } = useI18n();
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          eyebrow={t("نماذج تصوّرية", "Concepts")}
          title={t("هكذا قد يبدو براندك.", "This is what your brand could look like.")}
          intro={t("تصورات توضيحية لمخرجات المسارات، وليست مشاريع عملاء.", "Illustrative concepts of what each track delivers — not client projects.")}
          action={<Button to="/portfolio" variant="secondary" arrow>{t("كل النماذج", "All concepts")}</Button>}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {CONCEPTS.slice(0, 4).map((c, i) => (
            <Reveal as="figure" key={c.name.en} index={i} className={`group ${i % 2 === 1 ? "lg:mt-14" : ""}`}>
              <Photo src={c.photo} alt={`${t("نموذج تصوّري لعطر", "Concept for")} ${pick(c.name)}`} className="aspect-[3/4] rounded-2xl" imgClassName="group-hover:scale-105" />
              <figcaption className="mt-4">
                <p className="font-display text-xl text-ink-900">{pick(c.name)}</p>
                <p className="mt-1 text-sm text-paper-500">{pick(c.notes)}</p>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ConceptsSection;
