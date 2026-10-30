import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { CHOOSER, serviceById } from "@/data/services";
import Photo from "@/components/base/Photo";
import Button from "@/components/ui/Button";
import { useServicePrice } from "@/pricing/usePrices";

// "ساعدني أختار": سؤال واحد → المسار المقترح مع سبب الاقتراح
export default function TrackChooser({ dark = false }: { dark?: boolean }) {
  const { t, pick } = useI18n();
  const priceOf = useServicePrice();
  const [choice, setChoice] = useState<string | null>(null);
  const picked = CHOOSER.find((c) => c.key === choice);
  const track = picked ? serviceById(picked.recommend) : undefined;

  return (
    <div className={`rounded-[1.75rem] p-6 md:p-10 ${dark ? "bg-ink-900 text-white" : "bg-white border border-paper-200"}`}>
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <p className={`inline-flex items-center gap-2 text-sm mb-4 ${dark ? "text-white/60" : "text-paper-500"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("ساعدني أختار", "Help me choose")}
          </p>
          <h3 className="font-display text-3xl md:text-4xl leading-[1.25]">{t("ما الذي لديك الآن؟", "What do you have today?")}</h3>
          <div className="mt-8 flex flex-wrap gap-2.5" role="radiogroup" aria-label={t("ما الذي لديك الآن؟", "What do you have today?")}>
            {CHOOSER.map((c) => {
              const on = c.key === choice;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setChoice(c.key)}
                  className={`rounded-full px-4 py-2.5 text-sm border transition-colors ${
                    on
                      ? dark ? "bg-white text-ink-900 border-white" : "bg-ink-900 text-white border-ink-900"
                      : dark ? "border-white/20 text-white/80 hover:border-white/60" : "border-paper-300 text-paper-700 hover:border-ink-900"
                  }`}
                >
                  {pick(c.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div aria-live="polite" className="min-h-[14rem]">
          {track ? (
            <div key={track.id} className={`panel-in rounded-2xl overflow-hidden grid sm:grid-cols-[10rem_1fr] ${dark ? "bg-white/5 border border-white/10" : "bg-paper-50 border border-paper-200"}`}>
              <Photo src={track.photo} alt={pick(track.title)} className="aspect-[4/3] sm:aspect-auto sm:h-full" />
              <div className="p-6">
                <p className={`text-sm ${dark ? "text-white/60" : "text-paper-500"}`}>{t("المسار المقترح لك", "Your recommended track")}</p>
                <p className="mt-2 font-display text-2xl">{pick(track.title)}</p>
                <p className={`mt-2 text-sm leading-[1.7] ${dark ? "text-white/70" : "text-paper-600"}`}>{pick(track.outcome)}</p>
                <p className={`mt-3 text-sm ${dark ? "text-white/80" : "text-ink-900"}`}>{pick(track.duration)} · {pick(priceOf(track))}</p>
                <div className="mt-5">
                  <Button to={`/services/${track.id}`} variant={dark ? "light" : "primary"} arrow>
                    {t("اعرض المسار", "View track")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`h-full min-h-[14rem] rounded-2xl border border-dashed flex items-center justify-center text-center p-6 ${dark ? "border-white/20 text-white/50" : "border-paper-300 text-paper-500"}`}>
              <p>{t("اختر ما ينطبق عليك، وسنقترح المسار الأنسب فوراً.", "Pick what applies to you and we'll suggest the right track instantly.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
