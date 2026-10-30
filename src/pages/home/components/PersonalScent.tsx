import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Button from "@/components/ui/Button";
import { PRESETS, noteById } from "@/bespoke/notes";
import { startingPrice } from "@/bespoke/compose";
import { useBespokeRates } from "@/pricing/usePrices";

// «عطرك الخاص» للأفراد: باب مستقل عن مسارات البراندات، يبدأ من فكرة جاهزة بنقرة
const PersonalScent = () => {
  const { t, pick, num } = useI18n();
  const rates = useBespokeRates();
  return (
    <section className="px-5 md:px-8 pb-24 md:pb-32" aria-labelledby="personal-title">
      <Reveal className="max-w-7xl mx-auto rounded-[2rem] bg-ink-900 text-white p-7 md:p-12 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <p className="inline-flex items-center gap-2 text-sm text-white/60 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("للأفراد", "For individuals")}
          </p>
          <h2 id="personal-title" className="font-display text-[2.1rem] leading-[1.2] md:text-5xl">{t("عطرك الخاص، بمكوناتك أنت.", "Your own scent, from your own notes.")}</h2>
          <p className="mt-5 text-white/70 leading-[1.8]">
            {t(
              "اختر المقدمة والقلب والقاعدة من مكونات مثل الورد الطائفي والعود واللبان الظفاري، ثم يضبط معك مستشار التكوين النسب. عينتان تجربهما، ثم زجاجة باسمك.",
              "Pick your top, heart and base from notes like Taif rose, oud and Dhofari frankincense, then a composition consultant fine-tunes the ratios with you. Two samples to try, then a bottle with your name.",
            )}
          </p>
          <p className="mt-5 text-sm text-white/60">{t(`يبدأ من ${num(startingPrice(rates))} ر.س · جلسة المستشار مجانية`, `From SAR ${num(startingPrice(rates))} · the consultation is free`)}</p>
          <Button to="/bespoke" variant="light" arrow className="mt-8">{t("كوّن عطرك", "Compose your scent")}</Button>
        </div>
        <ul className="lg:col-span-7 grid sm:grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <li key={p.id}>
              <Link to={`/bespoke?preset=${p.id}`} className="group block h-full rounded-2xl border border-white/15 p-5 hover:bg-white/5 transition-colors">
                <span className="block font-display text-2xl">{pick(p.name)}</span>
                <span className="block mt-2 text-sm text-white/60">{pick(p.story)}</span>
                <span className="mt-4 flex flex-wrap gap-1.5">
                  {p.notes.map((id) => (
                    <span key={id} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">{pick(noteById(id)!.name)}</span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
};

export default PersonalScent;
