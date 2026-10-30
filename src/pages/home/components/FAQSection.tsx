import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Button from "@/components/ui/Button";
import FaqList from "@/components/feature/FaqList";
import { useContent } from "@/cms/ContentProvider";

const FAQSection = () => {
  const { t } = useI18n();
  const faqs = useContent("faq").items.filter((f) => f.published);
  return (
    <section id="faq" className="py-24 md:py-32 bg-white border-y border-paper-200">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-12">
        <Reveal className="lg:col-span-4">
          <p className="inline-flex items-center gap-2 text-sm text-paper-500 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("أسئلة", "Questions")}
          </p>
          <h2 className="font-display text-[2.1rem] leading-[1.2] md:text-5xl text-ink-900">{t("قبل أن تبدأ.", "Before you start.")}</h2>
          <p className="mt-5 text-paper-600 leading-[1.8]">{t("لم تجد سؤالك؟ تصفح كل الأسئلة أو اسألنا مباشرة.", "Didn't find your question? Browse them all or ask us directly.")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/faq" variant="secondary">{t("كل الأسئلة", "All questions")}</Button>
            <Button to="/contact" variant="ghost">{t("اسألنا", "Ask us")}</Button>
          </div>
        </Reveal>
        <div className="lg:col-span-8">
          <FaqList items={faqs.slice(0, 5)} idPrefix="home-faq" />
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
