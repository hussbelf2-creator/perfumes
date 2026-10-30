import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "@/cms/ContentProvider";
import { estimateBox } from "./pricing";
import { useI18n } from "@/i18n/context";
import { FONTS } from "../label/fonts";
import { FoilPicker, Section } from "../label/LabelPanel";
import type { FontId, LabelDesign } from "../label/types";
import { buildSpec, flatten } from "./dielines";
import { dielineStats, CREASE, CUT, GLUE } from "./export";
import { BOARDS, DEFAULT_QTY, FINISHES, LIMITS, STYLES, fitFor, type Board, type BoxDesign, type BoxStyle } from "./types";
import { EXTRAS, EXTRA_GROUPS, cleanExtras, extraById, fitStatus, recommendStyle, recommendedExtras, toggleExtra, type ExtraId } from "../spec";

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs border transition-colors ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white/70 border-paper-200 text-paper-700 hover:border-ink-900"}`;
const input = "w-full bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-3 py-2 text-sm outline-none";

const ICONS: Record<BoxStyle, string> = {
  tuck: "ri-box-3-line",
  rigid: "ri-archive-line",
  drawer: "ri-archive-drawer-line",
  magnetic: "ri-magnet-line",
  tube: "ri-database-2-line",
};

/** حقل مقاس: يقبل الكتابة الحرة ويُقيَّد بالحدود عند الخروج */
function Dim({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n > 0) onChange(Math.min(LIMITS.max, Math.max(LIMITS.min, n)));
    setDraft(null);
  };
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[11px] text-paper-500 mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={LIMITS.min}
          max={LIMITS.max}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className={`${input} pe-9 font-mono`}
        />
        <span aria-hidden="true" className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-paper-400 pointer-events-none">{t("مم", "mm")}</span>
      </div>
    </div>
  );
}

function DielinePreview({ design }: { design: BoxDesign }) {
  const { t, num } = useI18n();
  const { flat, stats } = useMemo(() => {
    const f = flatten(buildSpec(design));
    return { flat: f, stats: dielineStats(f) };
  }, [design]);
  const { minX, minY, maxX, maxY } = flat.bounds;
  const pad = 4;
  const vb = `${minX - pad} ${-maxY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
  return (
    <figure>
      <svg viewBox={vb} className="w-full max-h-64 bg-white rounded-xl border border-paper-200" role="img" aria-label={t("معاينة مخطط القص", "Dieline preview")} data-testid="dieline-preview">
        <g transform="scale(1,-1)">
          {flat.panels
            .filter((p) => p.kind === "glue")
            .map((p) => (
              <polygon key={p.id} points={p.poly.map(([x, y]) => `${x},${y}`).join(" ")} fill={GLUE} fillOpacity={0.25} />
            ))}
          {flat.folds.map((s, i) => (
            <line key={`f${i}`} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={CREASE} strokeWidth={0.7} strokeDasharray="3 1.6" vectorEffect="non-scaling-stroke" />
          ))}
          {flat.cuts.map((s, i) => (
            <line key={`c${i}`} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={CUT} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-paper-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5" style={{ background: CUT }} aria-hidden="true" />{t("قص", "Cut")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed" style={{ borderColor: CREASE }} aria-hidden="true" />{t("تكسير (طي)", "Crease")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: GLUE, opacity: 0.4 }} aria-hidden="true" />{t("لصق", "Glue")}</span>
        <span className="ms-auto font-mono" data-testid="sheet-size">
          {t("الفرخ", "Sheet")} <bdi dir="ltr">{num(Math.round(stats.sheetW))} × {num(Math.round(stats.sheetH))}</bdi> {t("مم", "mm")}
        </span>
      </figcaption>
    </figure>
  );
}

export interface BoxPanelProps {
  design: BoxDesign;
  onChange: (d: BoxDesign) => void;
  /** أبعاد المنتج الحالي لملاءمة العلبة */
  fit: { w: number; d: number; h: number } | null;
  /** سعة العبوة (مل) لاقتراح النوع المناسب */
  capacityMl?: number | null;
  /** هل العميل خارج السعودية؟ (يغيّر الملحقات الموصى بها) */
  exporting?: boolean;
  label: LabelDesign | null;
  onExport: (kind: "svg" | "pdf") => Promise<void>;
}

/** السعر التقديري للعلبة: يتحدث مع كل تغيير في النوع والمقاس والخامة والطباعة */
function PriceCard({ design: d, onQty }: { design: BoxDesign; onQty: (q: number) => void }) {
  const { t, pick, num } = useI18n();
  const rates = useContent("pricing").box;
  const volume = useContent("pricing").calc.tiers;
  const qty = d.qty ?? DEFAULT_QTY;
  const e = useMemo(() => estimateBox(d, qty, rates, volume), [d, qty, rates, volume]);
  const [draft, setDraft] = useState<string | null>(null);
  const qid = useId();
  const money = (n: number) => t(`${num(n, 2)} ر.س`, `SAR ${num(n, 2)}`);
  const tiers = [...new Set([e.moq, ...volume.map((x) => x.qty)])].sort((a, b) => a - b);
  const next = volume.find((x) => x.qty > qty);
  const nextUnit = next ? estimateBox(d, next.qty, rates, volume).unit : null;
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n > 0) onQty(Math.min(100_000, Math.max(50, n)));
    setDraft(null);
  };
  return (
    <section aria-labelledby={`${qid}-h`} className="rounded-2xl bg-ink-900 text-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`${qid}-h`} className="text-sm text-white/60">{t("السعر التقديري للعلبة", "Estimated price per box")}</h3>
          <p className="mt-1 font-display text-4xl" dir="ltr" style={{ textAlign: "start" }} aria-live="polite" data-testid="box-unit-price">{money(e.unit)}</p>
          <p className="mt-1 text-xs text-white/60" data-testid="box-total">{t(`الإجمالي ${num(e.total)} ر.س لـ ${num(qty)} علبة`, `Total SAR ${num(e.total)} for ${num(qty)} boxes`)}</p>
        </div>
        <div className="w-28 shrink-0">
          <label htmlFor={`${qid}-q`} className="block text-[11px] text-white/60 mb-1">{t("الكمية", "Quantity")}</label>
          <input
            id={`${qid}-q`}
            type="number"
            inputMode="numeric"
            min={50}
            step={100}
            value={draft ?? qty}
            onChange={(x) => setDraft(x.target.value)}
            onBlur={commit}
            onKeyDown={(x) => x.key === "Enter" && commit()}
            className="w-full rounded-xl bg-white/10 border border-white/15 focus:border-white px-3 py-2 text-sm font-mono outline-none"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label={t("كميات شائعة", "Common quantities")}>
        {tiers.map((q) => (
          <button key={q} type="button" aria-pressed={q === qty} onClick={() => onQty(q)} className={`rounded-full px-3 py-1 text-xs border ${q === qty ? "bg-white text-ink-900 border-white" : "border-white/20 text-white/75 hover:border-white"}`}>
            {num(q)}
          </button>
        ))}
      </div>
      {e.belowMoq && (
        <p role="alert" className="mt-3 rounded-xl bg-accent2/20 text-white px-3 py-2 text-xs">
          {t(`أقل كمية لهذا النوع ${num(e.moq)} علبة. الكميات الأقل ممكنة بسعر أعلى بعد مراجعة الطلب.`, `The minimum for this style is ${num(e.moq)} boxes. Smaller runs are possible at a higher price after review.`)}
        </p>
      )}
      {next && nextUnit !== null && (
        <p className="mt-3 text-xs text-white/70">{t(`عند ${num(next.qty)} علبة يصبح السعر ${money(nextUnit)} للعلبة.`, `At ${num(next.qty)} boxes it becomes ${money(nextUnit)} per box.`)}</p>
      )}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs text-white/70 hover:text-white list-none inline-flex items-center gap-1">
          <i className="ri-arrow-down-s-line group-open:rotate-180 transition-transform" aria-hidden="true"></i>
          {t("كيف حُسب السعر؟", "How is this calculated?")}
        </summary>
        <dl className="mt-3 space-y-1.5 text-xs" data-testid="box-breakdown">
          {e.variable.map((l) => (
            <div key={l.key} className="flex justify-between gap-3">
              <dt className="text-white/60">{pick(l.label)}</dt>
              <dd className="font-mono" dir="ltr">{money(l.value)}</dd>
            </div>
          ))}
          {e.discount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-white/60">{t("خصم الكمية", "Volume discount")}</dt>
              <dd className="font-mono" dir="ltr">−{e.discount}%</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5">
            <dt className="text-white/60">{t(`التجهيز (${e.setup.map((l) => pick(l.label)).join("، ")}) ÷ الكمية`, `Setup (${e.setup.map((l) => pick(l.label)).join(", ")}) ÷ qty`)}</dt>
            <dd className="font-mono shrink-0" dir="ltr">{money(e.setupTotal / e.qty)}</dd>
          </div>
          <p className="pt-2 text-white/45 leading-[1.7]">
            {t(`محسوب من مخطط القص نفسه: فرخ ${num(e.sheetM2, 3)} م² شاملاً الهدر، و${num(Math.round(e.dieMm))} مم من خطوط القص والتكسير. التجهيز لمرة واحدة ${num(e.setupTotal)} ر.س.`, `Computed from the dieline itself: a ${num(e.sheetM2, 3)} m² sheet including waste, and ${num(Math.round(e.dieMm))} mm of cut and crease lines. One-off setup SAR ${num(e.setupTotal)}.`)}
          </p>
        </dl>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-white/45 leading-[1.6] max-w-[15rem]">{t("تقديري قبل الضريبة والشحن؛ العرض الرسمي بعد مراجعة التصميم.", "Estimate before VAT and shipping; the formal quote follows design review.")}</p>
        <Link to={`/pricing?qty=${qty}&box=1`} className="rounded-full bg-white text-ink-900 px-4 py-2 text-xs">{t("تكلفة العطر كاملة", "Full product cost")}</Link>
      </div>
    </section>
  );
}

/** الملاءمة الذكية: النوع الذي يناسب حجم العبوة، وهل المقاس الحالي يحتضنها */
function SmartFit({ design: d, fit, capacityMl, onChange }: { design: BoxDesign; fit: { w: number; d: number; h: number }; capacityMl?: number | null; onChange: (patch: Partial<BoxDesign>) => void }) {
  const { t, pick, num } = useI18n();
  const status = fitStatus(d, fit);
  const rec = recommendStyle(fit, capacityMl);
  const fitted = fitFor(d.style, fit);
  const already = fitted.L === d.L && fitted.W === d.W && fitted.H === d.H;
  const tone = status.level === "ok" ? "border-[#1F6B4F]/30 bg-[#E6F2EC] text-[#1F6B4F]" : status.level === "tight" ? "border-red-200 bg-red-50 text-red-800" : "border-accent2/30 bg-accent2-soft text-accent2-ink";
  const short = Math.min(status.clearance.w, status.clearance.d, status.clearance.h);
  return (
    <div className="space-y-2" data-testid="smart-fit" data-level={status.level}>
      <div className={`rounded-xl border px-3 py-2.5 text-xs leading-[1.7] flex items-start gap-2 ${tone}`} role="status">
        <i className={`${status.level === "ok" ? "ri-checkbox-circle-fill" : status.level === "tight" ? "ri-error-warning-fill" : "ri-information-fill"} text-base mt-0.5`} aria-hidden="true"></i>
        <span className="flex-1">
          {pick(status.message)}
          {status.level === "tight" && <> <bdi dir="ltr">{num(Math.ceil(1 - short))}</bdi> {t("مم", "mm")}</>}
          {status.level !== "ok" && !already && (
            <button type="button" onClick={() => onChange(fitted)} className="ms-2 underline underline-offset-2 font-medium">{t("طابق المقاس تلقائياً", "Auto-fit the size")}</button>
          )}
        </span>
      </div>
      {rec.style !== d.style && (
        <p className="text-[11px] text-paper-500 leading-[1.7]">
          <i className="ri-lightbulb-line me-1" aria-hidden="true"></i>
          {t(`لهذه العبوة${capacityMl ? ` (${num(capacityMl)} مل)` : ""} ننصح بـ«${pick(STYLES.find((x) => x.id === rec.style)!.name)}»: ${pick(rec.reason)}.`, `For this bottle${capacityMl ? ` (${capacityMl} ml)` : ""} we suggest “${pick(STYLES.find((x) => x.id === rec.style)!.name)}”: ${pick(rec.reason)}.`)}{" "}
          <button type="button" onClick={() => onChange({ style: rec.style, ...fitFor(rec.style, fit) })} className="underline underline-offset-2 text-ink-900">{t("اعتمد المقترح", "Use it")}</button>
        </p>
      )}
    </div>
  );
}

/** ملحقات التغليف: ما يدخل العلبة مع الزجاجة ويصل المصنع ضمن المواصفة */
function ExtrasPicker({ design: d, fit, exporting, onChange }: { design: BoxDesign; fit: { w: number; d: number; h: number } | null; exporting: boolean; onChange: (extras: ExtraId[]) => void }) {
  const { t, pick, num } = useI18n();
  const rates = useContent("pricing").box.extrasPerUnit ?? {};
  const chosen = cleanExtras(d.extras);
  const rec = recommendedExtras(d, fit, exporting);
  const missing = rec.filter((r) => !chosen.includes(r.id));
  return (
    <div className="space-y-3" data-testid="extras">
      {missing.length > 0 && (
        <div className="rounded-xl bg-paper-50 border border-paper-200 p-3 text-xs leading-[1.7]">
          <p className="text-ink-900 font-medium flex items-center gap-1.5"><i className="ri-sparkling-2-line" aria-hidden="true"></i>{t("موصى به لهذه العلبة", "Recommended for this box")}</p>
          <ul className="mt-1.5 space-y-1">
            {missing.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-paper-600">
                <button type="button" onClick={() => onChange(toggleExtra(chosen, r.id))} className="shrink-0 rounded-full border border-ink-900 text-ink-900 px-2 py-0.5 text-[11px] hover:bg-ink-900 hover:text-white transition-colors">{t("أضف", "Add")} {pick(extraById(r.id)!.name)}</button>
                <span>{pick(r.why)}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onChange(missing.reduce((acc, r) => toggleExtra(acc, r.id), chosen))} className="mt-2 text-ink-900 underline underline-offset-2">{t("أضف كل المقترحات", "Add all suggestions")}</button>
        </div>
      )}
      {EXTRA_GROUPS.map((g) => (
        <div key={g.id}>
          <p className="text-[11px] text-paper-500 mb-1.5">{pick(g.name)}{g.id === "insert" && <span className="ms-1">{t("(واحدة)", "(one)")}</span>}</p>
          <div className="grid sm:grid-cols-2 gap-1.5" role="group" aria-label={pick(g.name)}>
            {EXTRAS.filter((x) => x.group === g.id).map((x) => {
              const on = chosen.includes(x.id);
              const price = rates[x.id] ?? x.perUnit;
              return (
                <label key={x.id} className={`cursor-pointer rounded-xl border px-3 py-2 flex items-start gap-2.5 text-xs transition-colors ${on ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 hover:border-paper-400"}`} title={pick(x.note)}>
                  <input type="checkbox" checked={on} onChange={() => onChange(toggleExtra(chosen, x.id))} className="mt-0.5 w-4 h-4 accent-ink-900 shrink-0" aria-describedby={`${x.id}-note`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-ink-900">
                      <span className="flex items-center gap-1.5 min-w-0"><i className={`${x.icon} text-paper-500`} aria-hidden="true"></i><span className="truncate">{pick(x.name)}</span></span>
                      <span className="font-mono text-[11px] text-paper-500 shrink-0" dir="ltr">+{num(price, 2)}</span>
                    </span>
                    <span id={`${x.id}-note`} className="block text-[11px] text-paper-500 leading-[1.6] mt-0.5">{pick(x.note)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BoxPanel({ design: d, onChange, fit, capacityMl, exporting = false, label, onExport }: BoxPanelProps) {
  const { t, pick, num } = useI18n();
  const [busy, setBusy] = useState<"" | "svg" | "pdf">("");
  const set = (patch: Partial<BoxDesign>) => onChange({ ...d, ...patch });
  const spec = useMemo(() => buildSpec(d), [d]);
  const style = STYLES.find((s) => s.id === d.style)!;
  const hasLogo = !!label?.logo?.dataUrl;

  const pickStyle = (s: BoxStyle) => {
    if (s === d.style) return;
    // الدرج يستلقي فيه المنتج والأسطوانة دائرية: نعيد ملاءمة المقاس عند التبديل
    onChange({ ...d, style: s, ...(fit ? fitFor(s, fit) : {}) });
  };

  const fromLabel = () => {
    if (!label) return;
    const txt = (id: "brand" | "name" | "details") => label.texts.find((x) => x.id === id);
    set({
      brand: txt("brand")?.text ?? d.brand,
      name: txt("name")?.text ?? d.name,
      details: txt("details")?.text ?? d.details,
      font: (txt("brand")?.font ?? d.font) as FontId,
      useLogo: hasLogo,
    });
  };

  const run = async (kind: "svg" | "pdf") => {
    setBusy(kind);
    try {
      await onExport(kind);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <PriceCard design={d} onQty={(qty) => set({ qty })} />

      <Section title={t("نوع العلبة", "Box style")}>
        <div role="radiogroup" aria-label={t("نوع العلبة", "Box style")} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STYLES.map((s) => {
            const on = s.id === d.style;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => pickStyle(s.id)} className={`rounded-2xl border p-3 text-start transition-colors ${on ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 hover:border-paper-400"}`}>
                <i className={`${ICONS[s.id]} text-xl ${on ? "text-ink-900" : "text-paper-500"}`} aria-hidden="true"></i>
                <span className="mt-1 block text-xs text-ink-900 leading-snug">{pick(s.name)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-paper-500 leading-[1.7]">{pick(style.note)}</p>
        {fit && <SmartFit design={d} fit={fit} capacityMl={capacityMl} onChange={set} />}
      </Section>

      <Section title={t("المقاس الداخلي", "Inner size")}>
        <div className="grid grid-cols-3 gap-2">
          <Dim label={d.style === "drawer" ? t("الطول", "Length") : d.style === "tube" ? t("القطر", "Diameter") : t("العرض", "Width")} value={d.L} onChange={(v) => set(d.style === "tube" ? { L: v, W: v } : { L: v })} />
          {d.style === "tube" ? <span /> : <Dim label={d.style === "drawer" ? t("العرض", "Width") : t("العمق", "Depth")} value={d.W} onChange={(v) => set({ W: v })} />}
          <Dim label={d.style === "drawer" ? t("السماكة", "Thickness") : t("الارتفاع", "Height")} value={d.H} onChange={(v) => set({ H: v })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-paper-500 font-mono" data-testid="outer-size">
            {t("الخارجي", "Outer")}: <bdi dir="ltr">{num(Math.round(spec.outer.w * 10) / 10)} × {num(Math.round(spec.outer.d * 10) / 10)} × {num(Math.round(spec.outer.h * 10) / 10)}</bdi> {t("مم", "mm")}
          </p>
          {fit && (
            <button type="button" onClick={() => set(fitFor(d.style, fit))} className={chip(false)}>
              <i className="ri-ruler-line me-1" aria-hidden="true"></i>
              {t("ملاءمة للعبوة المختارة", "Fit to selected bottle")}
            </button>
          )}
        </div>
      </Section>

      <Section title={t("ملحقات التغليف", "Packaging extras")}>
        <ExtrasPicker design={d} fit={fit} exporting={exporting} onChange={(extras) => set({ extras })} />
      </Section>

      <Section title={t("الخامة واللون", "Board & colour")}>
        <div role="radiogroup" aria-label={t("لون العلبة", "Box colour")} className="flex flex-wrap gap-1.5">
          {(Object.keys(BOARDS) as Exclude<Board, "custom">[]).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={d.board === b} onClick={() => set({ board: b })} className={`${chip(d.board === b)} inline-flex items-center gap-1.5`}>
              <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: BOARDS[b].color }} aria-hidden="true" />
              {pick(BOARDS[b].name)}
            </button>
          ))}
          <label className={`${chip(d.board === "custom")} inline-flex items-center gap-1.5 cursor-pointer`}>
            <input type="color" value={d.customColor} onChange={(e) => set({ board: "custom", customColor: e.target.value })} className="w-4 h-4 rounded-full border-0 p-0 bg-transparent" aria-label={t("لون مخصص", "Custom colour")} />
            {t("لون مخصص", "Custom")}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label={t("التشطيب", "Finish")} className="flex flex-wrap gap-1.5">
            {FINISHES.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={d.finish === f.id} onClick={() => set({ finish: f.id })} className={chip(d.finish === f.id)}>
                {pick(f.name)}
              </button>
            ))}
          </div>
          <label className="ms-auto inline-flex items-center gap-2 text-xs text-paper-600">
            {t("البطانة", "Lining")}
            <input type="color" value={d.interior} onChange={(e) => set({ interior: e.target.value })} className="w-7 h-7 rounded-full border border-paper-200 p-0" aria-label={t("لون البطانة الداخلية", "Lining colour")} />
          </label>
        </div>
      </Section>

      <Section title={t("الطباعة", "Print")}>
        <FoilPicker value={d.foil} onChange={(foil) => set({ foil })} label={t("لون اسم الدار والشعار", "Brand & logo finish")} />
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-xs text-paper-700">
            <input type="checkbox" checked={d.frame} onChange={(e) => set({ frame: e.target.checked })} className="w-4 h-4 accent-ink-900" />
            {t("إطار رفيع حول الواجهة", "Thin frame on the front")}
          </label>
          <label className={`inline-flex items-center gap-2 text-xs ${hasLogo ? "text-paper-700" : "text-paper-400"}`}>
            <input type="checkbox" checked={d.useLogo && hasLogo} disabled={!hasLogo} onChange={(e) => set({ useLogo: e.target.checked })} className="w-4 h-4 accent-ink-900" />
            {hasLogo ? t("شعار الملصق على الواجهة", "Label logo on the front") : t("ارفع شعاراً في تبويب الملصق لإظهاره هنا", "Upload a logo in the Label tab to use it here")}
          </label>
        </div>
      </Section>

      <Section title={t("النصوص", "Text")}>
        <label className="block">
          <span className="block text-[11px] text-paper-500 mb-1">{t("اسم الدار", "Brand")}</span>
          <input value={d.brand} maxLength={40} onChange={(e) => set({ brand: e.target.value })} className={input} />
        </label>
        <label className="block">
          <span className="block text-[11px] text-paper-500 mb-1">{t("اسم العطر", "Fragrance name")}</span>
          <input value={d.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} className={input} />
        </label>
        <label className="block">
          <span className="block text-[11px] text-paper-500 mb-1">{t("التفاصيل (الخلف والقاعدة)", "Details (back & base)")}</span>
          <input value={d.details} maxLength={70} onChange={(e) => set({ details: e.target.value })} className={input} />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-[10rem]">
            <span className="block text-[11px] text-paper-500 mb-1">{t("الخط", "Typeface")}</span>
            <select value={d.font} onChange={(e) => set({ font: e.target.value as FontId })} className={input}>
              {(Object.keys(FONTS) as FontId[]).map((f) => (
                <option key={f} value={f}>{pick(FONTS[f].name)}</option>
              ))}
            </select>
          </label>
          {label && (
            <button type="button" onClick={fromLabel} className={chip(false)}>
              <i className="ri-price-tag-3-line me-1" aria-hidden="true"></i>
              {t("انسخ من تصميم الملصق", "Copy from label design")}
            </button>
          )}
        </div>
      </Section>

      <Section title={t("مخطط القص (Dieline)", "Dieline")}>
        <DielinePreview design={d} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run("pdf")} disabled={busy !== ""} className="rounded-full bg-ink-900 text-white px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50">
            <i className="ri-file-pdf-2-line" aria-hidden="true"></i>
            {busy === "pdf" ? t("جاري التجهيز…", "Preparing…") : t("ملف الطباعة PDF", "Print-ready PDF")}
          </button>
          <button type="button" onClick={() => run("svg")} disabled={busy !== ""} className="rounded-full bg-white border border-paper-200 px-4 py-2 text-sm text-ink-900 inline-flex items-center gap-2 disabled:opacity-50">
            <i className="ri-scissors-cut-line" aria-hidden="true"></i>
            {t("مخطط القص SVG", "Dieline SVG")}
          </button>
        </div>
        <p className="text-[11px] text-paper-500 leading-[1.7]">
          {t("PDF: الصفحة الأولى التصميم بمقاسه الحقيقي مع هامش قص 3 مم، والثانية خطوط القص والتكسير وحدها. SVG بطبقات مسمّاة لبرامج التصميم وماكينات القص.", "PDF: page 1 is the artwork at true size with 3 mm bleed, page 2 is the cut & crease lines alone. The SVG has named layers for design software and cutting tables.")}
        </p>
      </Section>
    </div>
  );
}
