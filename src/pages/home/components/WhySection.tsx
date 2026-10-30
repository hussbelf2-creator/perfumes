import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import SectionHead from "@/components/ui/SectionHead";
import { PHOTOS } from "@/lib/photos";

// المقارنة: خمسة موردين مقابل مدير مشروع واحد
const WhySection = () => {
  const { t } = useI18n();

  const usual = [
    { who: t("مختبر العطور", "Perfume lab"), pain: t("تركيبة بلا ربط بالهوية", "A formula disconnected from the brand") },
    { who: t("مصمم الهوية", "Identity designer"), pain: t("شعار لا يعرف شكل الزجاجة", "A logo that never met the bottle") },
    { who: t("مورّد العبوات", "Packaging supplier"), pain: t("حد أدنى لا يناسبك", "Minimums that don't fit you") },
    { who: t("المطبعة", "Printer"), pain: t("ألوان لا تطابق الملفات", "Colours that don't match the files") },
    { who: t("مصنع التعبئة", "Filling plant"), pain: t("جدول لا يملكه أحد", "A schedule nobody owns") },
  ];
  const ours = [
    t("بريف واحد تُبنى عليه كل المراحل", "One brief that drives every stage"),
    t("جدول زمني موحّد ومعلن", "One shared, visible timeline"),
    t("اعتماد كل مرحلة قبل التي تليها", "Sign-off before each next stage"),
    t("عرض تكلفة قبل البدء", "A cost estimate before you start"),
    t("لوحة تحكم تتابع منها كل شيء", "A dashboard to follow everything"),
  ];

  return (
    <section className="py-24 md:py-32 bg-white border-y border-paper-200">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          eyebrow={t("لماذا المنصة", "Why us")}
          title={t("خمسة موردين، ولا أحد يملك الصورة كاملة.", "Five suppliers, and no one sees the whole picture.")}
          intro={t(
            "البراندات الناشئة تتعثر في المسافة بين الموردين، لا في جودة أيٍّ منهم. نحن نغلق هذه المسافة.",
            "New brands stumble in the gaps between suppliers, not in any one supplier's quality. We close those gaps.",
          )}
        />
        <div className="grid lg:grid-cols-12 gap-6">
          <Reveal className="lg:col-span-4 rounded-[1.75rem] overflow-hidden">
            <Photo src={PHOTOS.lab} alt={t("خبير عطور يعمل في المختبر", "Perfumer working in the lab")} zoom className="h-full min-h-[20rem]" />
          </Reveal>
          <Reveal index={1} className="lg:col-span-4 rounded-[1.75rem] bg-paper-50 border border-paper-200 p-8">
            <p className="text-sm text-paper-500 mb-6">{t("الطريقة المعتادة", "The usual way")}</p>
            <ul className="space-y-5">
              {usual.map((u) => (
                <li key={u.who} className="flex gap-3">
                  <i className="ri-close-circle-line text-paper-400 text-lg mt-0.5" aria-hidden="true"></i>
                  <span>
                    <span className="block text-ink-900">{u.who}</span>
                    <span className="block text-sm text-paper-500">{u.pain}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal index={2} className="lg:col-span-4 rounded-[1.75rem] bg-ink-900 text-white p-8 flex flex-col">
            <p className="text-sm text-white/55 mb-6">{t("مع المنصة", "With us")}</p>
            <p className="font-display text-3xl leading-[1.3]">{t("مدير مشروع واحد.", "One project manager.")}</p>
            <ul className="mt-6 space-y-3.5">
              {ours.map((o) => (
                <li key={o} className="flex gap-3 text-white/80">
                  <i className="ri-checkbox-circle-fill text-accent2 text-lg" aria-hidden="true"></i>
                  {o}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default WhySection;
