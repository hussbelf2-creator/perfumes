import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import Button from "@/components/ui/Button";
import { useContent } from "@/cms/ContentProvider";
import { PHOTOS } from "@/lib/photos";
import { useKitPrice } from "@/pricing/usePrices";

// نقطتا دخول منخفضتا الالتزام قبل المشروع الكامل: مكالمة مجانية وعينة مدفوعة
const EntryOffers = () => {
  const { t, sar, num } = useI18n();
  // المدة والعينة من «محتوى الموقع» (كصفحتي الحجز والعينة)
  const offers = useContent("offers");
  const DISCOVERY_CALL = offers.call;
  const DISCOVERY_KIT = offers.kit;
  const price = useKitPrice();

  return (
    <section className="px-5 md:px-8 pb-24 md:pb-32" aria-labelledby="entry-title">
      <div className="max-w-7xl mx-auto">
        <Reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-sm text-paper-500 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("لست مستعداً لمشروع كامل؟", "Not ready for a full project?")}
          </p>
          <h2 id="entry-title" className="font-display text-[2.1rem] leading-[1.2] md:text-5xl text-ink-900">
            {t("ابدأ بخطوة صغيرة.", "Start with a small step.")}
          </h2>
        </Reveal>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          <Reveal className="lift group rounded-[1.75rem] bg-white border border-paper-200 overflow-hidden flex flex-col">
            <Photo src={PHOTOS.consult} alt={t("جلسة اكتشاف حول لوحة مرجعية", "A discovery session around a moodboard")} className="aspect-[16/9]" zoom />
            <div className="p-7 md:p-9 flex-1 flex flex-col">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-2xl md:text-3xl text-ink-900">{t("مكالمة اكتشاف", "Discovery call")}</h3>
                <span className="rounded-full bg-sand-soft px-3 py-1 text-sm text-ink-900">{t("مجانية", "Free")}</span>
              </div>
              <p className="mt-3 text-paper-600 leading-[1.8]">
                {t(
                  `${num(DISCOVERY_CALL.minutes)} دقيقة مع مختص: نسمع فكرتك، ونقترح المسار والمدة ونطاق التكلفة. بلا التزام.`,
                  `${DISCOVERY_CALL.minutes} minutes with a specialist: we hear your idea and suggest the track, timeline and cost range. No obligation.`,
                )}
              </p>
              <div className="mt-auto pt-8">
                <Button to="/book" arrow>{t("اختر موعدك", "Pick a time")}</Button>
              </div>
            </div>
          </Reveal>

          <Reveal index={1} className="lift group rounded-[1.75rem] bg-ink-900 text-white overflow-hidden flex flex-col">
            <Photo src={PHOTOS.samples} alt={t("قوارير عينات مرقّمة", "Numbered sample vials")} className="aspect-[16/9]" zoom />
            <div className="p-7 md:p-9 flex-1 flex flex-col">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-2xl md:text-3xl">{t("عينة الاكتشاف", "Discovery kit")}</h3>
                <span className="font-display text-2xl">{sar(price)}</span>
              </div>
              <p className="mt-3 text-white/70 leading-[1.8]">
                {t(
                  `${num(DISCOVERY_KIT.vials)} اتجاهات عطرية مركّبة على ذوقك تصلك إلى بابك، مع بطاقة تقييم ومكالمة متابعة.`,
                  `${DISCOVERY_KIT.vials} scent directions built around your taste, delivered to your door with an evaluation card and follow-up call.`,
                )}
              </p>
              <p className="mt-3 text-sm text-[#F0B08C]">
                {t(`يُخصم من مشروعك إن بدأت خلال ${num(DISCOVERY_KIT.creditDays)} يوماً`, `Credited to your project if you start within ${DISCOVERY_KIT.creditDays} days`)}
              </p>
              <div className="mt-auto pt-8">
                <Button to="/discovery-kit" variant="light" arrow>{t("ابدأ الاختبار", "Take the quiz")}</Button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default EntryOffers;
