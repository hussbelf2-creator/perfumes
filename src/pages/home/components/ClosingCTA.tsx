import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Photo from "@/components/base/Photo";
import Button from "@/components/ui/Button";
import { PHOTOS } from "@/lib/photos";

const ClosingCTA = () => {
  const { t } = useI18n();
  return (
    <section className="px-5 md:px-8 pb-24 md:pb-32">
      <div className="relative max-w-7xl mx-auto rounded-[2rem] overflow-hidden min-h-[28rem] flex items-center">
        <Photo src={PHOTOS.shelf} alt="" zoom className="!absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/50 to-ink-900/20" />
        <Reveal className="relative px-6 md:px-14 py-16 max-w-3xl text-white">
          <h2 className="font-display text-4xl md:text-6xl leading-[1.15]">{t("كل عطر يبدأ بسطرٍ في بريف.", "Every fragrance starts with a line in a brief.")}</h2>
          <p className="mt-6 text-lg text-white/75 leading-[1.8] max-w-xl">
            {t("سجّل، واكتب فكرتك، وسيتواصل معك مدير مشروعك بخطة وتكلفة تقديرية.", "Sign up, write your idea, and your project manager will come back with a plan and an estimate.")}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button to="/auth?mode=register" variant="light" arrow>{t("ابدأ مشروعك", "Start your project")}</Button>
            <Button to="/book" variant="ghost" className="!text-white hover:!bg-white/10 border border-white/25">{t("تحدّث مع خبير أولاً", "Talk to an expert first")}</Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default ClosingCTA;
