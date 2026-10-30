import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { studioRepo } from "@/studio/repo";
import { AI_MODE, AiError, getAiJob, prepareImage, startAiJob, type AiJobState } from "@/studio/ai";
import { DEFAULT_EXTRACT, extractProfile, type PixelData } from "@/studio/profile";
import type { PackModel, ProfilePoint } from "@/studio/types";
import type { ViewerApi } from "@/studio/Viewer";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, PageTitle, fieldCls } from "../components/ui";

const Viewer = lazy(() => import("@/studio/Viewer"));

export default function StudioAi() {
  const { t, num } = useI18n();
  const { run } = useCrm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const jobId = params.get("job");
  const [image, setImage] = useState<{ dataUrl: string; px: PixelData } | null>(null);
  const [job, setJob] = useState<AiJobState | null>(null);
  const [startError, setStartError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [heightMm, setHeightMm] = useState(120);
  const [capacity, setCapacity] = useState(100);
  const [published, setPublished] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const api = useRef<ViewerApi | null>(null);
  const started = useRef(0);

  const errText = useCallback(
    (code?: string | null) => {
      const c = code || "";
      if (c.includes("provider_not_configured")) return t("لم يُضبط مفتاح مزوّد الذكاء الاصطناعي على الخادم (MESHY_API_KEY أو FAL_KEY).", "No AI provider key is configured on the server (MESHY_API_KEY or FAL_KEY).");
      if (c.includes("not_configured")) return t("الخادم غير مهيأ: أضف مفاتيح Supabase في Vercel.", "Server not configured: add the Supabase keys in Vercel.");
      if (c.includes("forbidden") || c.includes("unauthorized")) return t("ليست لديك صلاحية الاستوديو، أو انتهت جلستك.", "You lack studio permission, or your session expired.");
      if (c.includes("too_large")) return t("الصورة أو النموذج أكبر من المسموح.", "The image or model is too large.");
      if (c.includes("no_subject")) return t("لم يُكتشف منتج واضح في الصورة. استخدم خلفية سادة.", "No clear product found in the photo. Use a plain background.");
      if (c.includes("provider_error")) return t("رفض المزوّد الطلب. تحقق من رصيد الحساب أو جرّب صورة أخرى.", "The provider rejected the request. Check the account balance or try another photo.");
      return c || t("تعذّر التحويل.", "Conversion failed.");
    },
    [t],
  );

  // متابعة المهمة: كل 3 ثوانٍ على الخادم (أسرع في المحاكاة)، وتستمر إن عاد المستخدم للصفحة لاحقاً
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    if (!started.current) started.current = Date.now();
    const tick = async () => {
      try {
        const s = await getAiJob(jobId);
        if (stop) return;
        setJob(s);
        setElapsed(Math.round((Date.now() - started.current) / 1000));
        if (s.status === "queued" || s.status === "running") window.setTimeout(tick, AI_MODE === "demo" ? 500 : 3000);
      } catch (e) {
        if (!stop) setJob({ status: "failed", progress: 0, error: e instanceof Error ? e.message : "error" });
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);

  const onFile = async (f?: File | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    setImage(await prepareImage(f));
    setJob(null);
    setStartError("");
    if (jobId) setParams({}, { replace: true });
  };

  const start = async () => {
    if (!image) return;
    setBusy(true);
    setStartError("");
    setJob({ status: "queued", progress: 0 });
    started.current = Date.now();
    try {
      const id = await startAiJob(image, heightMm);
      setParams({ job: id }, { replace: true });
    } catch (e) {
      setJob(null);
      setStartError(e instanceof AiError ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  // الصورة الظلية للكتالوج من الصورة نفسها (أيقونة خفيفة بدل تحميل GLB في القوائم)
  const silhouette: ProfilePoint[] = useMemo(() => {
    const ex = image ? extractProfile(image.px, { ...DEFAULT_EXTRACT, heightMm }) : null;
    return ex?.profile ?? [[heightMm * 0.2, 0], [heightMm * 0.2, heightMm]];
  }, [image, heightMm]);

  const done = job?.status === "succeeded" && job.glbUrl;
  const draft: PackModel | null = useMemo(() => {
    if (!done || !job?.glbUrl) return null;
    const now = new Date().toISOString();
    return {
      id: "ai-draft",
      kind: "bottle",
      name: { ar: nameAr || "—", en: nameEn || nameAr || "—" },
      capacityMl: capacity,
      heightMm,
      neckMm: 0,
      profile: silhouette,
      section: "round",
      depthRatio: 1,
      squareness: 2,
      source: "ai",
      glbUrl: job.glbUrl,
      usdzUrl: job.usdzUrl ?? null,
      thumb: null,
      published,
      sort: 50,
      createdAt: now,
      updatedAt: now,
    };
  }, [done, job, nameAr, nameEn, capacity, heightMm, silhouette, published]);

  const onReady = useCallback((a: ViewerApi) => {
    api.current = a;
  }, []);

  const save = async () => {
    if (!draft) return;
    const { id: _i, createdAt: _c, updatedAt: _u, ...body } = draft;
    void _i;
    void _c;
    void _u;
    const thumb = api.current?.snapshot(360, "image/webp") ?? null;
    const ok = await run((_, a) => studioRepo.create({ ...body, name: { ar: nameAr.trim(), en: (nameEn || nameAr).trim() }, thumb }, a.role), t("أُضيف المنتج ثلاثي الأبعاد إلى الكتالوج", "3D product added to the catalogue"));
    if (ok) navigate("/admin/studio");
  };

  const running = job && (job.status === "queued" || job.status === "running");

  return (
    <>
      <nav className="text-sm text-paper-500 mb-4" aria-label={t("مسار التنقل", "Breadcrumb")}>
        <Link to="/admin/studio" className="hover:text-ink-900">{t("استوديو العبوات", "Packaging studio")}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-ink-900">{t("منتج بالذكاء الاصطناعي", "AI product")}</span>
      </nav>
      <PageTitle
        title={t("صورة منتج ← نموذج 3D بالذكاء الاصطناعي", "Product photo → 3D model with AI")}
        sub={t("للأشكال المعقدة والمنحوتة، وللمنتج كاملاً بغطائه وتفاصيله وألوانه. يستغرق عادة 1–3 دقائق.", "For complex, sculpted shapes and the full product with its cap, details and colours. Usually takes 1–3 minutes.")}
        actions={<Btn onClick={save} disabled={!draft || !nameAr.trim()}>{t("حفظ في الكتالوج", "Save to catalogue")}</Btn>}
      />

      {AI_MODE === "demo" && (
        <p className="mb-4 rounded-xl bg-sand-soft px-4 py-3 text-sm text-ink-900 leading-[1.8]">
          <i className="ri-flask-line me-1" aria-hidden="true"></i>
          {t(
            "وضع المحاكاة: لا يوجد خادم ومفتاح مزوّد في هذه النسخة، فيُولَّد نموذج تقريبي محلياً من الصورة لتجربة المسار كاملاً. بعد تفعيل Supabase وMeshy أو fal.ai يعمل التحويل الحقيقي من نفس الصفحة.",
            "Simulation mode: this build has no server or provider key, so an approximate model is generated locally from the photo to try the full flow. Once Supabase and Meshy or fal.ai are configured, real conversion runs from this same page.",
          )}
        </p>
      )}

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
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
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!!running} onChange={(e) => void onFile(e.target.files?.[0])} aria-label={t("صورة المنتج", "Product photo")} />
              {image ? (
                <img src={image.dataUrl} alt={t("صورة المنتج المرفوعة", "Uploaded product photo")} className="w-full max-h-[50vh] object-contain rounded-lg bg-white" />
              ) : (
                <>
                  <i className="ri-image-ai-line text-3xl text-paper-500" aria-hidden="true"></i>
                  <p className="mt-3 text-ink-900">{t("اسحب صورة المنتج هنا أو اضغط للاختيار", "Drop the product photo here or click to choose")}</p>
                  <p className="mt-1 text-xs text-paper-500 leading-[1.8]">{t("صورة واضحة للمنتج كاملاً، بإضاءة متساوية وخلفية سادة. زاوية ¾ تعطي نتائج أفضل من الأمامية تماماً.", "A clear photo of the full product, even lighting and a plain background. A ¾ angle gives better results than a straight front view.")}</p>
                </>
              )}
            </label>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("الاسم بالعربية", "Arabic name")} *</span>
                <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={60} className={fieldCls} placeholder={t("مثال: عنبر الملكي", "e.g. عنبر الملكي")} />
              </label>
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("الاسم بالإنجليزية", "English name")}</span>
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={60} dir="ltr" className={fieldCls} placeholder="Royal Amber" />
              </label>
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("الارتفاع الكلي الحقيقي (مم)", "Real total height (mm)")}</span>
                <input type="number" min={10} max={400} value={heightMm} onChange={(e) => setHeightMm(Math.max(10, Number(e.target.value) || 10))} className={`${fieldCls} font-mono`} />
              </label>
              <label className="block">
                <span className="block text-xs text-paper-500 mb-1.5">{t("السعة الاسمية (مل)", "Nominal capacity (ml)")}</span>
                <input type="number" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} className={`${fieldCls} font-mono`} />
              </label>
            </div>
            <p className="text-xs text-paper-500">{t("الارتفاع يضبط مقياس النموذج، فيظهر بحجمه الحقيقي في الواقع المعزز.", "Height sets the model's scale, so it appears at real size in AR.")}</p>
            <label className="inline-flex items-center gap-2 text-sm text-ink-900">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="w-4 h-4 accent-ink-900" />
              {t("منشور — يظهر للعملاء في استوديو 3D", "Published — visible to clients in the 3D studio")}
            </label>
          </Card>

          <Card className="p-4">
            {!running && !done && (
              <Btn onClick={start} disabled={!image || busy} className="w-full !py-3">
                <i className="ri-sparkling-2-line" aria-hidden="true"></i>
                {job?.status === "failed" ? t("أعد المحاولة", "Try again") : t("حوّل إلى 3D بالذكاء الاصطناعي", "Convert to 3D with AI")}
              </Btn>
            )}
            {running && (
              <div role="status" aria-live="polite">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-900">{job?.status === "queued" ? t("في قائمة الانتظار…", "Queued…") : t("الذكاء الاصطناعي يبني المجسم والخامات…", "AI is building the mesh and textures…")}</span>
                  <span className="font-mono text-paper-500">{num(job?.progress ?? 0)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-paper-100 overflow-hidden">
                  <div className="h-full bg-ink-900 transition-[width] duration-500" style={{ width: `${Math.max(3, job?.progress ?? 0)}%` }} />
                </div>
                <p className="mt-2 text-xs text-paper-500">{t(`مضى ${num(elapsed)} ث · يمكنك مغادرة الصفحة والعودة؛ المهمة تستمر على الخادم.`, `${elapsed}s elapsed · you can leave and come back; the job continues on the server.`)}</p>
              </div>
            )}
            {done && (
              <p role="status" className="text-sm text-[#1F6B4F]">
                <i className="ri-checkbox-circle-line me-1" aria-hidden="true"></i>
                {t("اكتمل النموذج. حرّكه للمراجعة، ثم احفظه في الكتالوج.", "Model ready. Rotate it to review, then save it to the catalogue.")}
              </p>
            )}
            {(job?.status === "failed" || startError) && (
              <p role="alert" className="mt-3 text-sm text-red-700">{errText(job?.error || startError)}</p>
            )}
          </Card>
        </div>

        <div className="xl:sticky xl:top-20 min-w-0">
          <Card className="overflow-hidden">
            <div className="relative h-[60vh] min-h-[22rem] bg-[#F3F1EC]">
              {draft ? (
                <Suspense fallback={<div className="absolute inset-0 shimmer" />}>
                  <Viewer className="absolute inset-0" bottle={draft} autoRotate onReady={onReady} ariaLabel={t("نموذج الذكاء الاصطناعي", "AI model")} />
                </Suspense>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-paper-500 px-6 text-center">
                  <i className="ri-box-3-line text-4xl text-paper-300" aria-hidden="true"></i>
                  {running ? t("يظهر النموذج هنا فور اكتماله.", "The model appears here once ready.") : t("ارفع صورة ثم اضغط «حوّل إلى 3D».", "Upload a photo, then press “Convert to 3D”.")}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
