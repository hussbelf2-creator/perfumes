import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import type { PackModel } from "../types";
import { FONTS } from "./fonts";
import { defaultSize, makeTemplate, TEMPLATES, type TemplateId } from "./templates";
import { FOILS, PAPERS, SHAPES, type Foil, type FontId, type LabelDesign, type LabelText, type Paper } from "./types";

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs border transition-colors ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white/70 border-paper-200 text-paper-700 hover:border-ink-900"}`;
const input = "w-full bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-3 py-2 text-sm outline-none";

function Range({ label, value, min, max, step = 0.5, unit = "mm", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const { num, t } = useI18n();
  const u = unit === "mm" ? t("مم", "mm") : unit;
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-paper-500 mb-1">
        <span>{label}</span>
        <span className="font-mono text-ink-900">{num(Math.round(value * 10) / 10)} {u}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ink-900" />
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl bg-white/70 border border-paper-200 p-4 space-y-3">
      <legend className="sr-only">{title}</legend>
      <p className="text-xs text-paper-500" aria-hidden="true">{title}</p>
      {children}
    </fieldset>
  );
}

export function FoilPicker({ value, onChange, label }: { value: Foil; onChange: (f: Foil) => void; label: string }) {
  const { t, pick } = useI18n();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      <button type="button" role="radio" aria-checked={value === "none"} onClick={() => onChange("none")} className={chip(value === "none")}>{t("حبر", "Ink")}</button>
      {(Object.keys(FOILS) as Exclude<Foil, "none">[]).map((f) => (
        <button key={f} type="button" role="radio" aria-checked={value === f} onClick={() => onChange(f)} className={`${chip(value === f)} inline-flex items-center gap-1.5`}>
          <span className="w-3 h-3 rounded-full" style={{ background: FOILS[f].color }} aria-hidden="true" />
          {t("فويل", "Foil")} {pick(FOILS[f].name)}
        </button>
      ))}
    </div>
  );
}

/** يقرأ الشعار ويصغّره (أقصى ضلع 800 بكسل) مع الحفاظ على الشفافية */
async function readLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function LabelPanel({ design, onChange, bottle, onExport }: { design: LabelDesign; onChange: (d: LabelDesign) => void; bottle: PackModel; onExport: (kind: "pdf" | "png") => Promise<void> }) {
  const { t, pick } = useI18n();
  const [busy, setBusy] = useState<"" | "pdf" | "png">("");
  const [logoError, setLogoError] = useState("");
  const fit = defaultSize(bottle);
  const zone = fit.zone;
  const maxW = Math.round(Math.min(110, fit.perimeter * 0.9));
  const set = (patch: Partial<LabelDesign>) => onChange({ ...design, ...patch });
  const setText = (id: LabelText["id"], patch: Partial<LabelText>) => onChange({ ...design, texts: design.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const half = design.heightMm / 2;

  const applyTemplate = (id: TemplateId) => {
    // نحتفظ بنصوص العميل عند تبديل القالب
    const brand = design.texts.find((x) => x.id === "brand")?.text;
    const name = design.texts.find((x) => x.id === "name")?.text;
    const next = makeTemplate(id, bottle, brand || undefined, name || undefined);
    onChange({ ...next, logo: design.logo });
  };

  const exportAs = async (kind: "pdf" | "png") => {
    setBusy(kind);
    try {
      await onExport(kind);
    } finally {
      setBusy("");
    }
  };

  const textLabels: Record<LabelText["id"], string> = { brand: t("اسم البراند", "Brand name"), name: t("اسم العطر", "Fragrance name"), details: t("سطر التفاصيل", "Details line") };

  return (
    <div className="space-y-4">
      <Section title={t("قالب البداية", "Starting template")}>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((x) => (
            <button key={x.id} type="button" onClick={() => applyTemplate(x.id)} className={chip(false)}>{pick(x.name)}</button>
          ))}
        </div>
      </Section>

      <Section title={t("النصوص", "Text")}>
        {design.texts.map((x) => (
          <div key={x.id} className="rounded-xl border border-paper-200 bg-white p-3 space-y-2">
            <label className="block">
              <span className="block text-[11px] text-paper-500 mb-1">{textLabels[x.id]}</span>
              <input value={x.text} onChange={(e) => setText(x.id, { text: e.target.value })} maxLength={40} dir="auto" className={input} />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center">
              <select value={x.font} onChange={(e) => setText(x.id, { font: e.target.value as FontId })} aria-label={`${textLabels[x.id]} — ${t("الخط", "font")}`} className={input}>
                {(Object.keys(FONTS) as FontId[]).map((f) => <option key={f} value={f}>{pick(FONTS[f].name)}</option>)}
              </select>
              <button type="button" onClick={() => setText(x.id, { weight: x.weight === 700 ? 400 : 700 })} aria-pressed={x.weight === 700} className={`${chip(x.weight === 700)} font-bold`} aria-label={t("عريض", "Bold")}>B</button>
              <input type="color" value={x.color} onChange={(e) => setText(x.id, { color: e.target.value })} aria-label={`${textLabels[x.id]} — ${t("اللون", "colour")}`} className="w-9 h-9 rounded-full border border-paper-200 bg-white p-0.5" disabled={x.foil !== "none"} />
            </div>
            <FoilPicker value={x.foil} onChange={(f) => setText(x.id, { foil: f })} label={`${textLabels[x.id]} — ${t("التشطيب", "finish")}`} />
            <div className="grid grid-cols-2 gap-3">
              <Range label={t("الحجم", "Size")} value={x.sizeMm} min={1.5} max={16} step={0.1} onChange={(v) => setText(x.id, { sizeMm: v })} />
              <Range label={t("الموضع", "Position")} value={Math.round(x.y * 100)} min={5} max={95} step={1} unit="%" onChange={(v) => setText(x.id, { y: v / 100 })} />
            </div>
          </div>
        ))}
      </Section>

      <Section title={t("الشعار", "Logo")}>
        {design.logo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src={design.logo.dataUrl} alt={t("الشعار المرفوع", "Uploaded logo")} className="w-14 h-14 object-contain rounded-lg bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px]" />
              <button type="button" onClick={() => set({ logo: null })} className="text-xs text-red-700 underline underline-offset-4">{t("إزالة الشعار", "Remove logo")}</button>
            </div>
            <FoilPicker value={design.logo.foil} onChange={(f) => set({ logo: { ...design.logo!, foil: f } })} label={t("تشطيب الشعار", "Logo finish")} />
            <div className="grid grid-cols-2 gap-3">
              <Range label={t("العرض", "Width")} value={design.logo.widthMm} min={4} max={Math.round(design.widthMm * 0.9)} onChange={(v) => set({ logo: { ...design.logo!, widthMm: v } })} />
              <Range label={t("الموضع", "Position")} value={Math.round(design.logo.y * 100)} min={5} max={95} step={1} unit="%" onChange={(v) => set({ logo: { ...design.logo!, y: v / 100 } })} />
            </div>
          </div>
        ) : (
          <label className="block rounded-xl border-2 border-dashed border-paper-300 hover:border-ink-900 p-4 text-center text-sm text-paper-600 cursor-pointer">
            <input
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="sr-only"
              aria-label={t("رفع الشعار", "Upload logo")}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) return setLogoError(t("الملف أكبر من 5 ميغابايت.", "File is larger than 5 MB."));
                setLogoError("");
                try {
                  // نفسح مكاناً للشعار في الأعلى: ننقل النصوص إلى النطاق 45–88% مع الحفاظ على ترتيبها
                  const ys = design.texts.map((x) => x.y);
                  const lo = Math.min(...ys), hi = Math.max(...ys);
                  const texts = design.texts.map((x) => ({ ...x, y: hi > lo ? 0.45 + ((x.y - lo) / (hi - lo)) * 0.43 : 0.6 }));
                  onChange({ ...design, texts, logo: { dataUrl: await readLogo(f), widthMm: Math.round(design.widthMm * 0.28), y: 0.2, foil: "none" } });
                } catch {
                  setLogoError(t("تعذّرت قراءة الصورة.", "Couldn't read the image."));
                }
              }}
            />
            <i className="ri-image-add-line me-1" aria-hidden="true"></i>
            {t("ارفع شعارك (PNG شفاف أو SVG يعطي أفضل نتيجة)", "Upload your logo (transparent PNG or SVG works best)")}
          </label>
        )}
        {logoError && <p role="alert" className="text-xs text-red-700">{logoError}</p>}
      </Section>

      <Section title={t("الورق والتشطيب", "Paper & finish")}>
        <div role="radiogroup" aria-label={t("الورق", "Paper")} className="flex flex-wrap gap-1.5">
          {(Object.keys(PAPERS) as Exclude<Paper, "custom">[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={design.paper === p} onClick={() => set({ paper: p })} className={`${chip(design.paper === p)} inline-flex items-center gap-1.5`}>
              <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: PAPERS[p].swatch }} aria-hidden="true" />
              {pick(PAPERS[p].name)}
            </button>
          ))}
          <label className={`${chip(design.paper === "custom")} inline-flex items-center gap-1.5 cursor-pointer`}>
            <input type="color" value={design.customColor} onChange={(e) => set({ paper: "custom", customColor: e.target.value })} className="w-4 h-4 rounded-full border-0 p-0 bg-transparent" aria-label={t("لون مخصص", "Custom colour")} />
            {t("لون مخصص", "Custom")}
          </label>
        </div>
        <div role="radiogroup" aria-label={t("التشطيب", "Finish")} className="flex gap-1.5">
          {(["matte", "gloss"] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={design.finish === f} onClick={() => set({ finish: f })} className={chip(design.finish === f)}>
              {f === "matte" ? t("مطفأ", "Matte") : t("لامع", "Gloss")}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-900">
          <input type="checkbox" checked={design.border.enabled} onChange={(e) => set({ border: { ...design.border, enabled: e.target.checked } })} className="w-4 h-4 accent-ink-900" />
          {t("إطار داخلي", "Inner frame")}
        </label>
        {design.border.enabled && <FoilPicker value={design.border.foil} onChange={(f) => set({ border: { ...design.border, foil: f } })} label={t("تشطيب الإطار", "Frame finish")} />}
      </Section>

      <Section title={t("الشكل والمقاس", "Shape & size")}>
        <div role="radiogroup" aria-label={t("شكل الملصق", "Label shape")} className="flex flex-wrap gap-1.5">
          {SHAPES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={design.shape === x.id} onClick={() => set({ shape: x.id })} className={chip(design.shape === x.id)}>{pick(x.name)}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Range label={t("العرض", "Width")} value={design.widthMm} min={15} max={maxW} onChange={(v) => set({ widthMm: v })} />
          <Range
            label={t("الارتفاع", "Height")}
            value={design.heightMm}
            min={10}
            max={Math.floor(zone.height)}
            onChange={(v) => set({ heightMm: v, centerYmm: Math.min(zone.top - v / 2, Math.max(zone.bottom + v / 2, design.centerYmm)) })}
          />
        </div>
        <Range label={t("الارتفاع عن القاعدة", "Height from base")} value={design.centerYmm} min={zone.bottom + half} max={Math.max(zone.bottom + half, zone.top - half)} onChange={(v) => set({ centerYmm: v })} />
        <p className="text-[11px] text-paper-500">{t(`المساحة المتاحة على الجسم ${Math.round(zone.height)} مم ارتفاعاً، ومحيطه ${Math.round(fit.perimeter)} مم.`, `Available body area: ${Math.round(zone.height)} mm tall, ${Math.round(fit.perimeter)} mm around.`)}</p>
      </Section>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => exportAs("pdf")} disabled={busy !== ""} className="rounded-full bg-ink-900 text-white px-4 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-50">
          <i className="ri-file-pdf-2-line" aria-hidden="true"></i>
          {busy === "pdf" ? t("جاري التجهيز…", "Preparing…") : t("ملف الطباعة PDF", "Print-ready PDF")}
        </button>
        <button type="button" onClick={() => exportAs("png")} disabled={busy !== ""} className="rounded-full border border-paper-300 bg-white px-4 py-2.5 text-sm text-ink-900 inline-flex items-center gap-2 disabled:opacity-50">
          <i className="ri-image-line" aria-hidden="true"></i>
          {t("صورة الملصق PNG", "Label PNG")}
        </button>
      </div>
      <p className="text-[11px] text-paper-500 leading-[1.7]">{t("ملف PDF بالمقاس الحقيقي، بهامش قص 3 مم وعلامات القص، وخط القص في صفحة مستقلة. يراجعه فريقنا قبل الطباعة.", "Real-size PDF with 3 mm bleed and crop marks, and the cut line on its own page. Our team reviews it before printing.")}</p>
    </div>
  );
}
