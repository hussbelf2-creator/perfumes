import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useContent } from "@/cms/ContentProvider";
import { estimateBox } from "@/studio/box/pricing";
import { STYLES as BOX_STYLES, defaultBox, type BoxDesign } from "@/studio/box/types";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import PageHeader from "@/components/base/PageHeader";
import Reveal from "@/components/base/Reveal";
import Button from "@/components/ui/Button";
import BarList from "@/components/charts/BarList";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { COST_ITEMS, SPEEDS, estimate } from "@/lib/pricing";
import { useCalc } from "@/pricing/usePrices";
import WorkspaceBar, { useCompleteWork, type WorkDraft } from "@/start/WorkspaceBar";

function Stepper({ label, value, onChange, min, max, hint }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; hint: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-paper-200 bg-paper-50 p-5">
      <p className="text-sm text-paper-600">{label}</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={t("إنقاص", "Decrease")} className="w-10 h-10 rounded-full border border-paper-300 hover:border-ink-900 flex items-center justify-center">
          <i className="ri-subtract-line" aria-hidden="true"></i>
        </button>
        <span className="font-display text-3xl text-ink-900" aria-live="polite">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={t("زيادة", "Increase")} className="w-10 h-10 rounded-full border border-paper-300 hover:border-ink-900 flex items-center justify-center">
          <i className="ri-add-line" aria-hidden="true"></i>
        </button>
      </div>
      <p className="mt-2 text-xs text-paper-500 text-center">{hint}</p>
    </div>
  );
}

/** آخر علبة صممها الزائر في الاستوديو (محفوظة في متصفحه) */
function loadStudioBox(): BoxDesign | null {
  try {
    const raw = localStorage.getItem("pp_box_v1");
    return raw ? { ...defaultBox(), ...(JSON.parse(raw) as Partial<BoxDesign>) } : null;
  } catch {
    return null;
  }
}

const PricingPage = () => {
  const { t, pick, sar, num } = useI18n();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [qty, setQty] = useState(() => {
    const q = Number(params.get("qty"));
    return Number.isFinite(q) && q >= 100 && q <= 10000 ? Math.round(q / 100) * 100 : 1000;
  });
  const rates = useContent("pricing").box;
  const cfg = useCalc();
  const [studioBox] = useState(loadStudioBox);
  const [useBox, setUseBox] = useState(() => !!studioBox);
  const boxEst = useMemo(() => (studioBox ? estimateBox(studioBox, qty, rates, cfg.tiers) : null), [studioBox, qty, rates, cfg.tiers]);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>(() => (SPEEDS.some((x) => x.id === params.get("speed")) ? (params.get("speed") as (typeof SPEEDS)[number]["id"]) : "standard"));
  const [shipping, setShipping] = useState(false);
  const [samples, setSamples] = useState(3);
  const [rounds, setRounds] = useState(2);

  const e = estimate({ qty, speed, shipping, samples, designRounds: rounds, box: useBox && boxEst ? { perUnit: boxEst.variableTotal, setup: boxEst.setupTotal } : null, cfg });
  const nextTier = cfg.tiers.find((tier) => tier.qty > qty);
  // لوحة عمل مسار التصنيع (?track=E): الكمية والخيارات والتقدير تُرفق بالطلب
  const isWorkspace = params.get("track") === "E";
  const completeWork = useCompleteWork("E");
  const workDraft = (): WorkDraft => {
    const sp = SPEEDS.find((x) => x.id === speed)!;
    const parts = [t(`${num(qty)} زجاجة`, `${qty} bottles`), pick(sp.label), ...(useBox && boxEst ? [t("مع علبة الاستوديو", "with the studio box")] : []), ...(shipping ? [t("مع الشحن", "with shipping")] : []), t(`${sar(e.unit)} للزجاجة`, `${sar(e.unit)} per bottle`), t(`الإجمالي التقديري ${sar(e.total)}`, `estimated total ${sar(e.total)}`)];
    return {
      summary: parts.join(" · "),
      link: `/pricing?qty=${qty}&speed=${speed}${useBox && boxEst ? "&box=1" : ""}`,
      fields: { calc_qty: String(qty), calc_speed: speed, calc_unit: String(Math.round(e.unit * 100) / 100), calc_total: String(Math.round(e.total)), calc_samples: String(samples), calc_rounds: String(rounds), calc_shipping: shipping ? "1" : "0" },
    };
  };

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      {isWorkspace && <div className="pt-[4.25rem]"><WorkspaceBar track="E" work={workDraft} /></div>}
      <PageHeader
        compact={isWorkspace}
        label={t("حاسبة التكلفة", "Cost calculator")}
        title={<>{t("كم تكلّف زجاجتك؟", "What will each bottle cost?")}</>}
        intro={t(
          "غيّر الكمية والخيارات واطّلع فوراً على تكلفة الوحدة والإجمالي وسعر التجزئة المقترح. الأرقام تقديرية للتخطيط، والعرض الرسمي يصدر بعد مراجعة البريف.",
          "Change volume and options to see unit cost, total and suggested retail instantly. Figures are planning estimates; the formal quote follows your brief review.",
        )}
      />

      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* الكمية */}
          <Reveal className="rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl text-ink-900">{t("الكمية", "Volume")}</h2>
              <p className="font-display text-3xl text-ink-900" aria-live="polite">{num(qty)} <span className="text-base text-paper-500">{t("زجاجة", "bottles")}</span></p>
            </div>
            <label htmlFor="qty" className="sr-only">{t("الكمية", "Volume")}</label>
            <input id="qty" type="range" min={100} max={10000} step={100} value={qty} onChange={(ev) => setQty(Number(ev.target.value))} className="mt-6 w-full accent-ink-900" />
            <div className="mt-4 flex flex-wrap gap-2">
              {cfg.tiers.map((tier) => (
                <button
                  key={tier.qty}
                  type="button"
                  onClick={() => setQty(tier.qty)}
                  className={`rounded-full px-4 py-2 text-sm border transition-colors ${qty === tier.qty ? "bg-ink-900 text-white border-ink-900" : "border-paper-300 text-paper-700 hover:border-ink-900"}`}
                >
                  {num(tier.qty)} {tier.discount > 0 && <span className="opacity-70" dir="ltr">· −{tier.discount}%</span>}
                </button>
              ))}
            </div>
            {nextTier && (
              <p className="mt-4 text-sm text-accent2-ink">
                {t(`أضف ${num(nextTier.qty - qty)} زجاجة لتحصل على خصم ${nextTier.discount}%.`, `Add ${num(nextTier.qty - qty)} bottles to unlock a ${nextTier.discount}% discount.`)}
              </p>
            )}
          </Reveal>

          {/* السرعة */}
          <Reveal className="rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-8">
            <h2 className="font-display text-2xl text-ink-900">{t("سرعة التنفيذ", "Turnaround")}</h2>
            <div className="mt-5 grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label={t("سرعة التنفيذ", "Turnaround")}>
              {SPEEDS.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  role="radio"
                  aria-checked={speed === sp.id}
                  onClick={() => setSpeed(sp.id)}
                  className={`rounded-2xl border p-4 text-start transition-colors ${speed === sp.id ? "border-ink-900 bg-paper-50" : "border-paper-200 hover:border-paper-400"}`}
                >
                  <span className="block text-ink-900">{pick(sp.label)}</span>
                  <span className="block text-sm text-paper-500">{pick(sp.time)}</span>
                  {cfg.speeds[sp.id] > 1 && <span className="block mt-1 text-xs text-accent2-ink" dir="ltr" style={{ textAlign: "start" }}>+{Math.round((cfg.speeds[sp.id] - 1) * 100)}%</span>}
                </button>
              ))}
            </div>
            <label className="mt-5 flex items-center gap-3 text-paper-700 cursor-pointer">
              <input type="checkbox" checked={shipping} onChange={(ev) => setShipping(ev.target.checked)} className="w-5 h-5 rounded accent-ink-900" />
              {t(`أضف الشحن والتوصيل (${num(cfg.items.shipping ?? 3, 2)} ر.س للوحدة)`, `Include shipping & delivery (SAR ${num(cfg.items.shipping ?? 3, 2)} per unit)`)}
            </label>
          </Reveal>

          {/* التطوير */}
          <Reveal className="rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-8">
            <h2 className="font-display text-2xl text-ink-900">{t("التطوير", "Development")}</h2>
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <Stepper label={t("جولات العينات", "Sample rounds")} value={samples} onChange={setSamples} min={1} max={8} hint={t(`${num(cfg.sample)} ر.س للجولة`, `SAR ${num(cfg.sample)} per round`)} />
              <Stepper label={t("جولات التصميم", "Design rounds")} value={rounds} onChange={setRounds} min={1} max={6} hint={t(`${num(cfg.designRound)} ر.س للجولة`, `SAR ${num(cfg.designRound)} per round`)} />
            </div>
          </Reveal>

          {/* تفصيل تكلفة الوحدة */}
          <Reveal className="rounded-[1.75rem] bg-white border border-paper-200 p-6 md:p-8">
            <h2 className="font-display text-2xl text-ink-900 mb-6">{t("مكوّنات تكلفة الوحدة", "Unit cost breakdown")}</h2>
            {studioBox && boxEst ? (
              <div className="mb-6 rounded-2xl bg-sand-soft p-4 flex flex-wrap items-center gap-3" data-testid="studio-box">
                <i className="ri-box-3-line text-xl text-ink-900" aria-hidden="true"></i>
                <div className="flex-1 min-w-[12rem]">
                  <p className="text-sm text-ink-900">
                    {t("علبتك من الاستوديو:", "Your studio box:")} {pick(BOX_STYLES.find((x) => x.id === studioBox.style)!.name)} <bdi dir="ltr">{studioBox.L}×{studioBox.W}×{studioBox.H}</bdi> {t("مم", "mm")}
                  </p>
                  <p className="text-xs text-paper-600">{t(`${num(boxEst.variableTotal, 2)} ر.س للعلبة قبل خصم الكمية + تجهيز ${num(boxEst.setupTotal)} ر.س لمرة واحدة`, `SAR ${num(boxEst.variableTotal, 2)} per box before volume discount + SAR ${num(boxEst.setupTotal)} one-off setup`)}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-ink-900 cursor-pointer">
                  <input type="checkbox" checked={useBox} onChange={(ev) => setUseBox(ev.target.checked)} className="w-4 h-4 accent-ink-900" />
                  {t("احسب بعلبتي", "Use my box")}
                </label>
                <Link to="/studio-3d?tab=box" className="text-sm underline underline-offset-4 text-ink-900">{t("عدّلها", "Edit it")}</Link>
              </div>
            ) : (
              <Link to="/studio-3d?tab=box" className="mb-6 rounded-2xl border border-dashed border-paper-300 p-4 flex items-center gap-3 hover:border-ink-900" data-testid="studio-box-cta">
                <i className="ri-box-3-line text-xl text-ink-900" aria-hidden="true"></i>
                <span className="text-sm text-paper-700">{t("تقدير العلبة هنا عام. صمّم علبتك في استوديو 3D ليُحسب سعرها الفعلي من مقاسها وخامتها.", "The box figure here is generic. Design your box in the 3D studio to price it from its actual size and materials.")}</span>
              </Link>
            )}
            <BarList
              items={e.items.map((i) => ({ label: pick(i.label), value: i.perUnit }))}
              format={(n) => sar(n)}
              ariaLabel={t("مكونات تكلفة الوحدة بالريال", "Unit cost components in SAR")}
            />
            <p className="mt-5 text-xs text-paper-500">{t("قبل خصم الكمية ومعامل السرعة.", "Before volume discount and turnaround multiplier.")}</p>
          </Reveal>
        </div>

        {/* الملخص */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24">
          <Reveal className="rounded-[1.75rem] bg-ink-900 text-white p-7 md:p-9">
            <p className="text-sm text-white/55">{t("تكلفة الوحدة التقديرية", "Estimated unit cost")}</p>
            <p key={`${e.unit}`} className="mt-2 font-display text-6xl panel-in">{sar(e.unit)}</p>
            <dl className="mt-8 space-y-3 text-sm">
              {[
                { k: t("التكلفة الأساسية", "Base cost"), v: sar(e.base) },
                { k: t("خصم الكمية", "Volume discount"), v: `−${e.discount}%` },
                { k: t("معامل السرعة", "Turnaround"), v: `×${e.mult}` },
                { k: t("الإنتاج", "Production"), v: sar(e.production) },
                { k: t("العينات", "Sampling"), v: sar(e.sampling) },
                { k: t("التصميم", "Design"), v: sar(e.design) },
                ...(e.boxSetup ? [{ k: t("تجهيز العلبة (قالب وألواح)", "Box setup (die & plates)"), v: sar(e.boxSetup) }] : []),
              ].map((x) => (
                <div key={x.k} className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <dt className="text-white/60">{x.k}</dt>
                  <dd className="font-mono" dir="ltr">{x.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex justify-between items-baseline">
              <span className="text-white/70">{t("الإجمالي التقديري", "Estimated total")}</span>
              <span className="font-display text-3xl">{sar(e.total)}</span>
            </div>
            <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/50">{t("سعر التجزئة المقترح", "Suggested retail")}</p>
                <p className="mt-1 font-display text-2xl">{sar(e.retail)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">{t("الهامش الإجمالي", "Gross margin")}</p>
                <p className="mt-1 font-display text-2xl">{Math.round(e.margin * 100)}%</p>
              </div>
            </div>
            <div className="mt-8">
              {completeWork ? (
                <Button onClick={() => completeWork(workDraft())} variant="light" arrow className="w-full !justify-between">
                  {t("اطلب عرض سعر رسمي بهذه الأرقام", "Request a formal quote with these numbers")}
                </Button>
              ) : (
                <Button to={user ? "/account" : "/auth?mode=register"} variant="light" arrow className="w-full !justify-between">
                  {t("اطلب عرض سعر رسمي", "Request a formal quote")}
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs text-white/45 leading-[1.7]">
              {t(`السعر المقترح = تكلفة الوحدة × ${num(cfg.retail, 1)}، قبل الضريبة وعمولات البيع.`, `Suggested retail = unit cost × ${num(cfg.retail, 1)}, before VAT and sales commissions.`)}
            </p>
          </Reveal>
        </aside>
      </main>
      <FooterSection />
    </div>
  );
};

export default PricingPage;
