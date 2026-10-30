import { useState } from "react";
import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import Button from "@/components/ui/Button";
import { estimate } from "@/lib/pricing";
import { useCalc } from "@/pricing/usePrices";

// حاسبة مصغّرة تفاعلية — تفتح الشهية للحاسبة الكاملة
const CostTeaser = () => {
  const { t, sar, num } = useI18n();
  const [tier, setTier] = useState(1);
  const cfg = useCalc();
  const qty = cfg.tiers[tier].qty;
  const e = estimate({ qty, cfg });

  return (
    <section className="py-24 md:py-32 bg-ink-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-sm text-white/60 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("حاسبة التكلفة", "Cost calculator")}
          </p>
          <h2 className="font-display text-[2.1rem] leading-[1.2] md:text-5xl">{t("اعرف تكلفة زجاجتك قبل أن تبدأ.", "Know your cost per bottle before you start.")}</h2>
          <p className="mt-5 text-lg text-white/65 leading-[1.8] max-w-xl">
            {t("حرّك الكمية وشاهد تكلفة الوحدة وسعر التجزئة المقترح يتغيران فوراً. الأرقام تقديرية للتخطيط.", "Move the volume and watch unit cost and suggested retail update instantly. Figures are planning estimates.")}
          </p>
          <div className="mt-10">
            <Button to="/pricing" variant="light" arrow>{t("افتح الحاسبة الكاملة", "Open the full calculator")}</Button>
          </div>
        </Reveal>

        <Reveal index={1} className="rounded-[1.75rem] bg-white/5 border border-white/10 p-7 md:p-9">
          <p className="text-sm text-white/60">{t("الكمية", "Volume")}</p>
          <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label={t("الكمية", "Volume")}>
            {cfg.tiers.map((v, i) => (
              <button
                key={v.qty}
                type="button"
                role="radio"
                aria-checked={i === tier}
                onClick={() => setTier(i)}
                className={`rounded-xl py-3 text-sm font-mono transition-colors ${i === tier ? "bg-white text-ink-900" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
              >
                {num(v.qty)}
              </button>
            ))}
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {[
              { k: t("تكلفة الوحدة", "Unit cost"), v: sar(e.unit) },
              { k: t("سعر التجزئة المقترح", "Suggested retail"), v: sar(e.retail) },
              { k: t("خصم الكمية", "Volume discount"), v: `${e.discount}%` },
              { k: t("إجمالي تقديري", "Estimated total"), v: sar(e.total) },
            ].map((x) => (
              <div key={x.k} className="bg-ink-900 p-5">
                <dt className="text-xs text-white/50">{x.k}</dt>
                <dd key={`${x.k}-${tier}`} className="mt-2 font-display text-2xl panel-in">{x.v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
};

export default CostTeaser;
