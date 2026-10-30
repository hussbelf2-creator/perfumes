import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { SERVICE_TRACKS } from "@/data/services";
import Photo from "@/components/base/Photo";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import Arrow from "@/components/ui/Arrow";
import { prefersReducedMotion } from "@/hooks/useInView";
import { useServicePrice } from "@/pricing/usePrices";
import { useTilt } from "@/hooks/useTilt";

// عرض تفاعلي للمسارات: قائمة + لوحة تفاصيل. يتنقل تلقائياً حتى يتفاعل الزائر.
const ServicesShowcase = () => {
  const { t, pick } = useI18n();
  const priceOf = useServicePrice();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const tilt = useTilt<HTMLDivElement>(4);

  useEffect(() => {
    if (!auto || prefersReducedMotion()) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % SERVICE_TRACKS.length), 6000);
    return () => window.clearInterval(id);
  }, [auto]);

  const s = SERVICE_TRACKS[active];
  const select = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <section id="services" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHead
          eyebrow={t("الخدمات", "Services")}
          title={t("ستة مسارات. ابدأ من حيث تحتاج.", "Six tracks. Start where you need.")}
          intro={t(
            "براند كامل، أو مرحلة واحدة فقط. كل مسار مستقل بمخرجات ومدة وسعر واضحين، ويمكن ضمّه لغيره لاحقاً.",
            "A full brand, or a single stage. Each track stands alone with clear deliverables, timing and price — and can be combined later.",
          )}
          action={<Button to="/services" variant="secondary" arrow>{t("كل الخدمات", "All services")}</Button>}
        />

        <div className="grid lg:grid-cols-12 gap-6">
          <ul role="tablist" aria-label={t("مسارات الخدمة", "Service tracks")} className="lg:col-span-5 space-y-2">
            {SERVICE_TRACKS.map((tr, i) => {
              const on = i === active;
              return (
                <li key={tr.id} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="track-panel"
                    onClick={() => select(i)}
                    onMouseEnter={() => select(i)}
                    className={`relative w-full overflow-hidden text-start rounded-2xl border px-5 py-4 flex items-center gap-4 transition-colors ${
                      on ? "bg-white border-ink-900" : "bg-transparent border-paper-200 hover:bg-white"
                    }`}
                  >
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${on ? "bg-ink-900 text-white" : "bg-sand-soft text-ink-900"}`}>
                      <i className={`${tr.icon} text-lg`} aria-hidden="true"></i>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-ink-900 font-medium">{pick(tr.title)}</span>
                      <span className="block text-sm text-paper-500">{pick(tr.duration)} · {pick(priceOf(tr))}</span>
                    </span>
                    <span className="label-mono">N°{tr.no}</span>
                    {on && auto && <span key={active} className="absolute bottom-0 start-0 h-0.5 bg-gradient-to-r from-accent2 via-gold to-accent3 progress-6s" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div id="track-panel" role="tabpanel" className="lg:col-span-7">
            <div ref={tilt.ref} onMouseMove={tilt.onMouseMove} onMouseLeave={tilt.onMouseLeave} className="tilt glow h-full rounded-[1.75rem]">
            <div key={s.id} className="panel-in h-full grid md:grid-cols-2 rounded-[1.75rem] overflow-hidden bg-white border border-paper-200">
              <Photo src={s.photo} alt={pick(s.title)} zoom className="min-h-[18rem] md:min-h-full" />
              <div className="p-7 md:p-9 flex flex-col">
                <p className="label-mono">N°{s.no} · {s.title.en}</p>
                <h3 className="mt-4 font-display text-3xl leading-[1.25] text-ink-900">{pick(s.title)}</h3>
                <p className="mt-2 text-accent2-ink">{pick(s.tagline)}</p>
                <p className="mt-4 text-paper-600 leading-[1.8]">{pick(s.summary)}</p>
                <ul className="mt-6 space-y-2.5">
                  {s.deliverables.slice(0, 4).map((d) => (
                    <li key={d.title.en} className="flex items-center gap-3 text-sm text-paper-700">
                      <i className={`${d.icon} text-ink-900`} aria-hidden="true"></i>
                      {pick(d.title)}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-paper-500">{t("السعر", "Price")}</p>
                    <p className="text-ink-900 font-medium">{pick(priceOf(s))}</p>
                  </div>
                  <Link to={`/services/${s.id}`} className="group inline-flex items-center gap-2 text-ink-900 border-b border-ink-900/30 hover:border-ink-900 pb-1">
                    {t("تفاصيل المسار", "Track details")}
                    <Arrow />
                  </Link>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesShowcase;
