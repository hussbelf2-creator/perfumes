import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { studioRepo } from "@/studio/repo";
import { DEFAULT_EXTRACT, estimateCapacityMl, extractProfile, rescale, type ExtractOptions, type PixelData } from "@/studio/profile";
import type { PackKind, PackModel, ProfilePoint, Section } from "@/studio/types";
import type { ViewerApi } from "@/studio/Viewer";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, PageTitle, fieldCls } from "../components/ui";

const Viewer = lazy(() => import("@/studio/Viewer"));
const MAX_SIDE = 900;

const SECTION_DEFAULTS: Record<Section, { squareness: number; depthRatio: number }> = {
  round: { squareness: 2, depthRatio: 1 },
  square: { squareness: 7, depthRatio: 1 },
  oval: { squareness: 2, depthRatio: 0.62 },
};

function Slider({ label, value, min, max, step = 1, onChange, suffix = "", hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; hint?: string }) {
  const { num } = useI18n();
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-paper-500 mb-1.5">
        <span>{label}</span>
        <span className="font-mono text-ink-900">{num(Math.round(value * 100) / 100)}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ink-900" />
      {hint && <span className="block mt-1 text-[11px] text-paper-500">{hint}</span>}
    </label>
  );
}

/** يقرأ ملف صورة ويعيد بكسلاتها مصغّرة (أقصى ضلع 900 بكسل) */
async function readPixels(file: File): Promise<{ px: PixelData; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  return { px: { data: g.getImageData(0, 0, w, h).data, width: w, height: h }, url };
}

export default function StudioEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t, pick, num } = useI18n();
  const { run } = useCrm();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [existing, setExisting] = useState<PackModel | null>(null);
  const [partners, setPartners] = useState<PackModel[]>([]);
  const [kind, setKind] = useState<PackKind>((params.get("kind") as PackKind) || "bottle");
  const [image, setImage] = useState<{ px: PixelData; url: string } | null>(null);
  const [opts, setOpts] = useState<ExtractOptions>({ ...DEFAULT_EXTRACT, heightMm: kind === "bottle" ? 100 : 30 });
  const [section, setSection] = useState<Section>("round");
  const [squareness, setSquareness] = useState(2);
  const [depthRatio, setDepthRatio] = useState(1);
  const [neckMm, setNeckMm] = useState(12);
  const [capacity, setCapacity] = useState(50);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const overlay = useRef<HTMLCanvasElement>(null);
  const api = useRef<ViewerApi | null>(null);

  useEffect(() => {
    void studioRepo.listAll().then((all) => {
      setPartners(all);
      if (!isNew) {
        const m = all.find((x) => x.id === id) ?? null;
        setExisting(m);
        if (m) {
          setKind(m.kind);
          setSection(m.section);
          setSquareness(m.squareness);
          setDepthRatio(m.depthRatio);
          setNeckMm(m.neckMm);
          setCapacity(m.capacityMl ?? 0);
          setNameAr(m.name.ar);
          setNameEn(m.name.en);
          setPublished(m.published);
          setOpts((o) => ({ ...o, heightMm: m.heightMm }));
        }
      }
    });
  }, [id, isNew]);

  const isAi = existing?.source === "ai";
  const extraction = useMemo(() => (image ? extractProfile(image.px, opts) : null), [image, opts]);

  // المقطع الحالي: من الصورة إن رُفعت، وإلا من النموذج المحفوظ (مع إعادة القياس للارتفاع الجديد)
  const profile: ProfilePoint[] | null = useMemo(() => {
    if (extraction) return extraction.profile;
    if (existing) return Math.abs(existing.heightMm - opts.heightMm) > 0.01 ? rescale(existing.profile, opts.heightMm) : existing.profile;
    return null;
  }, [extraction, existing, opts.heightMm]);

  const draft: PackModel | null = useMemo(() => {
    if (!profile) return null;
    const now = new Date().toISOString();
    return {
      id: existing?.id ?? "draft",
      kind,
      name: { ar: nameAr || "—", en: nameEn || nameAr || "—" },
      capacityMl: kind === "bottle" ? capacity : null,
      heightMm: opts.heightMm,
      neckMm: kind === "bottle" ? neckMm : 0,
      profile,
      section,
      depthRatio,
      squareness,
      thumb: existing?.thumb ?? null,
      // نموذج الذكاء الاصطناعي يبقى كذلك: لا نفقد ملف GLB عند تعديل الاسم أو النشر
      source: existing?.source ?? "profile",
      glbUrl: existing?.glbUrl ?? null,
      usdzUrl: existing?.usdzUrl ?? null,
      published,
      sort: existing?.sort ?? 99,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }, [profile, kind, nameAr, nameEn, capacity, opts.heightMm, neckMm, section, depthRatio, squareness, published, existing]);

  const brimful = draft && kind === "bottle" ? estimateCapacityMl(draft.profile, { squareness, depthRatio, neckMm }) : 0;
  const ratio = capacity > 0 && brimful > 0 ? brimful / capacity : 1;

  // رسم الصورة مع حدود الجسم المكتشفة فوقها
  useEffect(() => {
    const cv = overlay.current;
    if (!cv || !image) return;
    const { width, height, data } = image.px;
    cv.width = width;
    cv.height = height;
    const g = cv.getContext("2d")!;
    g.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    g.fillStyle = "rgba(17,17,17,0.35)";
    const top = Math.floor(height * opts.cropTop), bottom = Math.ceil(height * (1 - opts.cropBottom));
    g.fillRect(0, 0, width, top);
    g.fillRect(0, bottom, width, height - bottom);
    if (!extraction) return;
    g.strokeStyle = "#E4612E";
    g.lineWidth = Math.max(2, width / 300);
    for (const side of ["left", "right"] as const) {
      g.beginPath();
      extraction.rows.forEach((r, i) => (i ? g.lineTo(r[side], r.y) : g.moveTo(r[side], r.y)));
      g.stroke();
    }
    g.setLineDash([6, 6]);
    g.strokeStyle = "#3B6FB6";
    g.beginPath();
    g.moveTo(extraction.axisX, extraction.top);
    g.lineTo(extraction.axisX, extraction.bottom);
    g.stroke();
  }, [image, extraction, opts.cropTop, opts.cropBottom]);

  const onFile = async (f?: File | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (image) URL.revokeObjectURL(image.url);
    setImage(await readPixels(f));
  };

  const setOpt = (k: keyof ExtractOptions) => (v: number) => setOpts((o) => ({ ...o, [k]: v }));
  const onReady = useCallback((a: ViewerApi) => {
    api.current = a;
  }, []);

  // شريك المعاينة: غطاء افتراضي للعبوة، أو عبوة افتراضية للغطاء — لرؤية الملاءمة على العنق
  const partnerBottle = partners.find((m) => m.kind === "bottle" && m.published && m.id !== draft?.id);
  const partnerCap = partners.find((m) => m.kind === "cap" && m.published && m.id !== draft?.id);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const thumb = api.current ? api.current.snapshot(360, "image/webp") : null;
    const { id: _id, createdAt: _c, updatedAt: _u, ...body } = draft;
    void _id;
    void _c;
    void _u;
    const payload = { ...body, name: { ar: nameAr.trim(), en: (nameEn || nameAr).trim() }, thumb };
    const ok = await run(
      (_, a) => (existing ? studioRepo.update(existing.id, payload, a.role) : studioRepo.create(payload, a.role)),
      existing ? t("حُفظت التعديلات", "Changes saved") : t("أُضيف النموذج إلى الكتالوج", "Model added to the catalogue"),
    );
    setSaving(false);
    if (ok) navigate("/admin/studio");
  };

  const quality = extraction ? (extraction.asymmetry < 0.03 ? "good" : extraction.asymmetry < 0.08 ? "ok" : "bad") : null;

  return (
    <>
      <nav className="text-sm text-paper-500 mb-4" aria-label={t("مسار التنقل", "Breadcrumb")}>
        <Link to="/admin/studio" className="hover:text-ink-900">{t("استوديو العبوات", "Packaging studio")}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-ink-900">{existing ? pick(existing.name) : t("نموذج جديد", "New model")}</span>
      </nav>
      <PageTitle
        title={existing ? pick(existing.name) : kind === "bottle" ? t("عبوة جديدة من صورة", "New bottle from a photo") : t("غطاء جديد من صورة", "New cap from a photo")}
        actions={<Btn onClick={save} disabled={!draft || !nameAr.trim() || saving}>{saving ? t("جاري الحفظ…", "Saving…") : t("حفظ في الكتالوج", "Save to catalogue")}</Btn>}
      />

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {isNew && (
            <div className="inline-flex rounded-full bg-paper-100 p-1" role="radiogroup" aria-label={t("النوع", "Type")}>
              {(["bottle", "cap"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    setKind(k);
                    setOpts((o) => ({ ...o, heightMm: k === "bottle" ? 100 : 30 }));
                  }}
                  className={`rounded-full px-5 py-1.5 text-sm ${kind === k ? "bg-white text-ink-900 shadow-sm" : "text-paper-600"}`}
                >
                  {k === "bottle" ? t("عبوة", "Bottle") : t("غطاء", "Cap")}
                </button>
              ))}
            </div>
          )}

          {isAi ? (
            <Card className="p-4 text-sm text-paper-600 leading-[1.8]">
              <span className="rounded-full bg-accent2-soft text-accent2-ink px-2 py-0.5 text-xs me-2">AI</span>
              {t("نموذج مولّد بالذكاء الاصطناعي من صورة المنتج. يمكنك تعديل الاسم والارتفاع والسعة والنشر؛ ولتغيير الشكل أنشئ نموذجاً جديداً.", "Generated by AI from the product photo. You can edit the name, height, capacity and publishing; to change the shape, create a new model.")}
            </Card>
          ) : (
          <Card className="p-4">
            <label
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                setDragOver(false);
                void onFile(e.dataTransfer.files[0]);
              }}
              className={`block rounded-xl border-2 border-dashed cursor-pointer transition-colors ${dragOver ? "border-ink-900 bg-sand-soft" : "border-paper-300 hover:border-ink-900"} ${image ? "p-2" : "p-8 text-center"}`}
            >
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e: ChangeEvent<HTMLInputElement>) => void onFile(e.target.files?.[0])} aria-label={t("صورة العبوة", "Packaging photo")} />
              {image ? (
                <canvas ref={overlay} className="w-full h-auto max-h-[60vh] object-contain rounded-lg" aria-label={t("الصورة مع الحدود المكتشفة", "Photo with detected outline")} />
              ) : (
                <>
                  <i className="ri-image-add-line text-3xl text-paper-500" aria-hidden="true"></i>
                  <p className="mt-3 text-ink-900">{existing ? t("استبدل الشكل بصورة جديدة (اختياري)", "Replace the shape with a new photo (optional)") : t("اسحب صورة هنا أو اضغط للاختيار", "Drop a photo here or click to choose")}</p>
                  <p className="mt-1 text-xs text-paper-500 leading-[1.8]">{t("صورة أمامية مستقيمة، على خلفية فاتحة سادة أو PNG شفاف. تجنّب الزاوية المائلة والظل الكثيف.", "A straight front photo on a plain light background, or a transparent PNG. Avoid tilted angles and heavy shadows.")}</p>
                </>
              )}
            </label>

            {image && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {extraction ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${quality === "good" ? "bg-[#E3F2EC] text-[#1F6B4F]" : quality === "ok" ? "bg-sand-soft text-ink-900" : "bg-accent2-soft text-accent2-ink"}`}>
                      <i className={quality === "bad" ? "ri-error-warning-line" : "ri-checkbox-circle-line"} aria-hidden="true"></i>
                      {quality === "good" ? t("حدود واضحة ومتناظرة", "Clear, symmetric outline") : quality === "ok" ? t("مقبول — راجع الحدود", "Acceptable — check the outline") : t("غير متناظر: الصورة مائلة أو الظل قوي", "Asymmetric: tilted photo or strong shadow")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-accent2-soft text-accent2-ink">
                      <i className="ri-error-warning-line" aria-hidden="true"></i>
                      {t("لم يُكتشف جسم — غيّر الحساسية", "No object found — adjust sensitivity")}
                    </span>
                  )}
                  {extraction && <span className="text-paper-500">{extraction.mode === "alpha" ? t("خلفية شفافة", "Transparent background") : t("خلفية لونية", "Colour background")}</span>}
                  <span className="text-paper-500"><span className="inline-block w-3 h-0.5 bg-accent2 align-middle me-1" />{t("الحدود", "Outline")} <span className="inline-block w-3 border-t border-dashed border-[#3B6FB6] align-middle mx-1" />{t("المحور", "Axis")}</span>
                </div>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <Slider label={t("حساسية فصل الخلفية", "Background sensitivity")} value={opts.threshold} min={10} max={140} onChange={setOpt("threshold")} hint={t("ارفعها إذا دخل الظل في الحدود", "Raise it if the shadow enters the outline")} />
                  <Slider label={t("التنعيم", "Smoothing")} value={opts.smoothing} min={1} max={14} onChange={setOpt("smoothing")} />
                  <Slider label={t("قص من الأعلى", "Crop top")} value={opts.cropTop * 100} min={0} max={45} suffix="%" onChange={(v) => setOpt("cropTop")(v / 100)} hint={kind === "bottle" ? t("لإزالة الغطاء إن كان في الصورة", "To remove the cap if it's in the photo") : undefined} />
                  <Slider label={t("قص من الأسفل", "Crop bottom")} value={opts.cropBottom * 100} min={0} max={45} suffix="%" onChange={(v) => setOpt("cropBottom")(v / 100)} />
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm text-ink-900">
                  <input type="checkbox" checked={opts.suppressBaseShadow !== false} onChange={(e) => setOpts((o) => ({ ...o, suppressBaseShadow: e.target.checked }))} className="mt-0.5 w-4 h-4 accent-ink-900" />
                  <span>
                    {t("تجاهل ظل القاعدة", "Ignore the base shadow")}
                    <span className="block text-[11px] text-paper-500">
                      {extraction?.shadowRows
                        ? t(`قُصّ ظل في ${extraction.shadowRows} صفاً أسفل العبوة. أطفئه فقط إن كانت قاعدتها أعرض من جسمها فعلاً.`, `A shadow was trimmed in ${extraction.shadowRows} rows at the base. Turn off only if the base is truly wider than the body.`)
                        : t("يمنع ظل الصورة من أن يصبح قاعدة عريضة في النموذج.", "Stops the photo's shadow from becoming a wide base in the model.")}
                    </span>
                  </span>
                </label>
              </>
            )}
          </Card>
          )}
          <Card className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("الاسم بالعربية", "Arabic name")} *</span>
                <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required maxLength={60} className={fieldCls} placeholder={t("مثال: أطلس · أسطواني", "e.g. أطلس · أسطواني")} />
              </label>
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("الاسم بالإنجليزية", "English name")}</span>
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={60} dir="ltr" className={fieldCls} placeholder="Atlas · cylinder" />
              </label>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("الارتفاع الحقيقي (مم)", "Real height (mm)")}</span>
                <input type="number" min={5} max={400} step={0.5} value={opts.heightMm} onChange={(e) => setOpt("heightMm")(Math.max(5, Number(e.target.value) || 5))} className={`${fieldCls} font-mono`} />
              </label>
              {kind === "bottle" && (
                <>
                  {!isAi && <label className="block">
                    <span className="block text-xs text-paper-500 mb-1.5">{t("طول العنق (مم)", "Neck length (mm)")}</span>
                    <input type="number" min={0} max={60} step={0.5} value={neckMm} onChange={(e) => setNeckMm(Math.max(0, Number(e.target.value) || 0))} className={`${fieldCls} font-mono`} />
                  </label>}
                  <label className="block">
                    <span className="block text-xs text-paper-500 mb-1.5">{t("السعة الاسمية (مل)", "Nominal capacity (ml)")}</span>
                    <input type="number" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} className={`${fieldCls} font-mono`} />
                  </label>
                </>
              )}
            </div>
            {kind === "bottle" && draft && !isAi && (
              <p className={`text-xs rounded-xl px-3 py-2 ${ratio < 1.03 || ratio > 1.35 ? "bg-accent2-soft text-accent2-ink" : "bg-paper-50 text-paper-600"}`}>
                <i className={ratio < 1.03 || ratio > 1.35 ? "ri-error-warning-line me-1" : "ri-ruler-line me-1"} aria-hidden="true"></i>
                {t(`السعة حتى الحافة من الشكل ≈ ${num(brimful)} مل (${num(Math.round(ratio * 100))}% من الاسمية). `, `Brimful capacity from the shape ≈ ${brimful} ml (${Math.round(ratio * 100)}% of nominal). `)}
                {ratio < 1.03 || ratio > 1.35
                  ? t("خارج المعتاد (105–130%): راجع الارتفاع الحقيقي أو القص.", "Outside the usual 105–130%: check the real height or the crop.")
                  : t("ضمن المعتاد — المقياس صحيح.", "Within the usual range — the scale looks right.")}
              </p>
            )}
            {!isAi && <div>
              <span className="block text-xs text-paper-500 mb-2">{t("المقطع العرضي", "Cross-section")}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("المقطع العرضي", "Cross-section")}>
                {(["round", "square", "oval"] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    role="radio"
                    aria-checked={section === x}
                    onClick={() => {
                      setSection(x);
                      setSquareness(SECTION_DEFAULTS[x].squareness);
                      setDepthRatio(SECTION_DEFAULTS[x].depthRatio);
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm border ${section === x ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 text-paper-700 hover:border-ink-900"}`}
                  >
                    {x === "round" ? t("دائري", "Round") : x === "square" ? t("مربع", "Square") : t("بيضاوي", "Oval")}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {section !== "round" && <Slider label={t("العمق ÷ العرض", "Depth ÷ width")} value={depthRatio} min={0.3} max={1} step={0.01} onChange={setDepthRatio} hint={t("الصورة تعطي العرض فقط؛ العمق من هنا", "The photo gives width only; depth comes from here")} />}
                {section === "square" && <Slider label={t("حدّة الزوايا", "Corner sharpness")} value={squareness} min={3} max={14} step={0.5} onChange={setSquareness} />}
              </div>
            </div>}
            <label className="inline-flex items-center gap-2 text-sm text-ink-900">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="w-4 h-4 accent-ink-900" />
              {t("منشور — يظهر للعملاء في استوديو 3D", "Published — visible to clients in the 3D studio")}
            </label>
          </Card>
        </div>

        <div className="xl:sticky xl:top-20 min-w-0">
          <Card className="overflow-hidden">
            <div className="relative h-[60vh] min-h-[22rem] bg-[#F3F1EC]">
              {draft ? (
                <Suspense fallback={<div className="absolute inset-0 shimmer" />}>
                  <Viewer
                    className="absolute inset-0"
                    bottle={kind === "bottle" ? draft : partnerBottle}
                    cap={kind === "cap" ? draft : isAi ? null : partnerCap}
                    glass="clear"
                    capFinish="gold"
                    liquid="amber"
                    fill={0.7}
                    onReady={onReady}
                    ariaLabel={t("معاينة ثلاثية الأبعاد", "3D preview")}
                  />
                </Suspense>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-paper-500 px-6 text-center">{t("ارفع صورة لتظهر المعاينة ثلاثية الأبعاد هنا.", "Upload a photo and the 3D preview appears here.")}</div>
              )}
            </div>
            <p className="px-4 py-3 text-xs text-paper-500 border-t border-paper-100">
              {kind === "bottle" ? t("المعاينة بغطاء افتراضي من الكتالوج لرؤية الملاءمة.", "Previewed with a default catalogue cap to check the fit.") : t("المعاينة على عبوة افتراضية من الكتالوج لرؤية الملاءمة على العنق.", "Previewed on a default catalogue bottle to check the neck fit.")}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
