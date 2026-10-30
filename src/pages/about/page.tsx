import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import ClosingCTA from "@/pages/home/components/ClosingCTA";
import JourneySection from "@/pages/home/components/JourneySection";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import CountUp from "@/components/base/CountUp";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { useContent } from "@/cms/ContentProvider";
import { PHOTOS } from "@/lib/photos";

const AboutPage = () => {
  const { t, pick } = useI18n();
  const facts = useContent("hero").facts;
  const values = [
    { icon: "ri-eye-line", title: t("الشفافية", "Transparency"), desc: t("تكلفة معلنة قبل البدء، وجدول زمني تراه كما نراه.", "Costs shown before you start, and a timeline you see as we do.") },
    { icon: "ri-shake-hands-line", title: t("الشراكة", "Partnership"), desc: t("مدير مشروع واحد يعرف براندك من البريف إلى الرف.", "One project manager who knows your brand from brief to shelf.") },
    { icon: "ri-flask-line", title: t("الحِرفة", "Craft"), desc: t("لا ننتقل لمرحلة قبل أن تكون سابقتها صحيحة ومعتمدة.", "We never move on until the previous stage is right and approved.") },
    { icon: "ri-lock-line", title: t("الحصرية", "Exclusivity"), desc: t("تركيبتك وتصاميمك لعلامتك وحدها، وفق العقد.", "Your formula and designs belong to your brand alone, per contract.") },
  ];

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("عن المنصة", "About")}
        title={<>{t("نبني البراندات العطرية", "We build fragrance brands")} <span className="text-paper-400">{t("بإدارة واحدة.", "under one manager.")}</span></>}
        intro={t(
          "منصة متخصصة تجمع خبرة صناعة العطور مع أدوات رقمية تتيح لك متابعة كل مرحلة واعتمادها بنفسك.",
          "A specialised studio pairing perfumery know-how with digital tools that let you follow and approve every stage yourself.",
        )}
      >
        <div className="flex flex-wrap gap-3">
          <Button to="/auth?mode=register" arrow>{t("ابدأ مشروعك", "Start your project")}</Button>
          <Button to="/services" variant="secondary">{t("الخدمات", "Services")}</Button>
        </div>
      </PageHeader>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-6">
        <Reveal className="lg:col-span-7 rounded-[2rem] overflow-hidden">
          <Photo src={PHOTOS.consult} alt={t("جلسة عمل على لوحة مرجعية لبراند عطري", "Working session on a fragrance brand moodboard")} zoom className="h-full min-h-[22rem]" />
        </Reveal>
        <Reveal index={1} className="lg:col-span-5 rounded-[2rem] bg-white border border-paper-200 p-8 md:p-10 flex flex-col">
          <p className="text-sm text-paper-500">{t("قصتنا", "Our story")}</p>
          <p className="mt-6 font-display text-2xl md:text-3xl leading-[1.4] text-ink-900">
            {t("بدأنا من سؤال بسيط: لماذا يحتاج من يريد عطراً باسمه أن يدير خمسة موردين بنفسه؟", "We started from a simple question: why should anyone who wants a scent in their name have to manage five suppliers alone?")}
          </p>
          <p className="mt-6 text-paper-600 leading-[1.9]">
            {t(
              "فجمعنا خبراء العطور والمصممين والمصنّعين تحت إدارة واحدة، وبنينا لوحة تحكم تجعل كل قرار واضحاً وموثّقاً.",
              "So we brought perfumers, designers and manufacturers under one management, and built a dashboard that makes every decision clear and documented.",
            )}
          </p>
        </Reveal>
      </section>

      <section className="bg-ink-900 text-white py-20">
        <dl className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {facts.map((f, i) => (
            <div key={i}>
              <dt className="sr-only">{pick(f.label)}</dt>
              <dd className="font-display text-5xl md:text-6xl" dir="ltr" style={{ textAlign: "start" }}><CountUp value={f.value} prefix={f.prefix} /></dd>
              <dd className="mt-2 text-white/60">{pick(f.label)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHead eyebrow={t("قيمنا", "Our values")} title={t("أربعة التزامات في كل مشروع.", "Four commitments on every project.")} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((v, i) => (
              <Reveal key={v.title} index={i} className="lift rounded-2xl bg-white border border-paper-200 p-7">
                <span className="w-12 h-12 rounded-xl bg-sand-soft flex items-center justify-center text-ink-900"><i className={`${v.icon} text-xl`} aria-hidden="true"></i></span>
                <h3 className="mt-6 font-display text-xl text-ink-900">{v.title}</h3>
                <p className="mt-2 text-paper-600 leading-[1.8]">{v.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <JourneySection />
      <ClosingCTA />
      <FooterSection />
    </div>
  );
};

export default AboutPage;
