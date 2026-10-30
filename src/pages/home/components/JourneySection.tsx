import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import SectionHead from "@/components/ui/SectionHead";
import { useInView } from "@/hooks/useInView";
import { PHOTOS } from "@/lib/photos";

const JourneySection = () => {
  const { t } = useI18n();
  const { ref, inView } = useInView<HTMLOListElement>();

  const steps = [
    { no: "01", title: t("البريف", "The brief"), time: t("الأسبوع 1", "Week 1"), photo: PHOTOS.brief, desc: t("جلسة تعريف تحدد الجمهور والسعر المستهدف وشخصية الرائحة، ثم بريف مكتوب تعتمده.", "A discovery session defines audience, target price and scent personality — then a written brief you approve.") },
    { no: "02", title: t("التركيبة والعينات", "Formula & samples"), time: t("الأسابيع 2 – 8", "Weeks 2 – 8"), photo: PHOTOS.samples, desc: t("جولات عينات مرقّمة تصلك وتقيّمها، حتى تعتمد التركيبة.", "Numbered sample rounds reach you for evaluation until you sign off the formula.") },
    { no: "03", title: t("الهوية والعبوة", "Identity & packaging"), time: t("بالتوازي", "In parallel"), photo: PHOTOS.packaging, desc: t("الاسم والشعار والزجاجة والعلبة تُصمَّم معاً، بمعاينات واقعية قبل الطباعة.", "Name, logo, bottle and box designed together, with realistic previews before print.") },
    { no: "04", title: t("التصنيع والإطلاق", "Production & launch"), time: t("آخر 4 – 8 أسابيع", "Final 4 – 8 weeks"), photo: PHOTOS.production, desc: t("تعبئة وفحص جودة وتغليف، ثم دفعتك الأولى جاهزة للبيع.", "Filling, quality control and packing — then your first batch, ready to sell.") },
  ];

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          eyebrow={t("الرحلة", "The journey")}
          title={t("أربع محطات، وقرار واحد في كل منها.", "Four stations, one decision at each.")}
          intro={t("لا ننتقل إلى المرحلة التالية قبل اعتمادك. كل ملف وعينة وملاحظة محفوظة في مساحة مشروعك.", "We never move on without your sign-off. Every file, sample and note lives in your project space.")}
        />
        <ol ref={ref} className="relative grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <span aria-hidden="true" className={`hidden lg:block draw-x absolute top-[1.35rem] inset-x-6 h-px bg-ink-900/20 ${inView ? "is-in" : ""}`} />
          {steps.map((s, i) => (
            <Reveal as="li" key={s.no} index={i} className="group relative">
              <span className="relative z-10 w-11 h-11 rounded-full bg-ink-900 text-white font-mono text-sm flex items-center justify-center">{s.no}</span>
              <Photo src={s.photo} alt={s.title} className="mt-6 aspect-[4/3] rounded-2xl" imgClassName="group-hover:scale-105" />
              <div className="mt-5 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl text-ink-900">{s.title}</h3>
                <span className="text-xs text-paper-500 whitespace-nowrap">{s.time}</span>
              </div>
              <p className="mt-2 text-sm text-paper-600 leading-[1.8]">{s.desc}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default JourneySection;
