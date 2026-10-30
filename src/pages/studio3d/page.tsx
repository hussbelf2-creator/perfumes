import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { projectsRepo } from "@/projects/repo";
import { usePActor } from "@/projects/useProjects";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import Button from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { studioRepo } from "@/studio/repo";
import { CAP_FINISH, GLASS, LIQUID, glassById, finishById, liquidById } from "@/studio/materials";
import { estimateCapacityMl } from "@/studio/profile";
import ProfileIcon from "@/studio/ProfileIcon";
import type { PackModel } from "@/studio/types";
import type { ViewerApi } from "@/studio/Viewer";
import LabelPanel from "@/studio/label/LabelPanel";
import { defaultSize, makeTemplate } from "@/studio/label/templates";
import type { LabelDesign } from "@/studio/label/types";
import BoxPanel from "@/studio/box/BoxPanel";
import { DEFAULT_QTY, STYLES as BOX_STYLES, defaultBox, type BoxDesign } from "@/studio/box/types";
import { estimateBox } from "@/studio/box/pricing";
import { useContent } from "@/cms/ContentProvider";
import { buildSpec, flatten } from "@/studio/box/dielines";
import { dielineStats, dielineSvg, exportBoxPdf } from "@/studio/box/export";
import WorkspaceBar, { useCompleteWork, type WorkDraft } from "@/start/WorkspaceBar";
import { CAP_MECHANISMS, DECORATIONS, PUMPS, bottleSpecExtra, bottleSpecLines, cleanExtras, extraById, labelChecklist, parseBottleSpec } from "@/studio/spec";
import { guessCountry } from "@/lib/phone";

const LABEL_KEY = "pp_label_v1";
function loadLabel(): LabelDesign | null {
  try {
    const raw = localStorage.getItem(LABEL_KEY);
    return raw ? (JSON.parse(raw) as LabelDesign) : null;
  } catch {
    return null;
  }
}

const BOX_KEY = "pp_box_v1";
function loadBox(): BoxDesign | null {
  try {
    const raw = localStorage.getItem(BOX_KEY);
    return raw ? { ...defaultBox(), ...(JSON.parse(raw) as Partial<BoxDesign>) } : null;
  } catch {
    return null;
  }
}

type Tab = "bottle" | "label" | "box";
const TABS: Tab[] = ["bottle", "label", "box"];

/** حركة ناعمة لقيمتي الطي والفتح (تُرسم في المشهد فقط — لا تعيد بناء المجسم) */
function useTween(initial: { fold: number; open: number }) {
  const [v, setV] = useState(initial);
  const cur = useRef(initial);
  const raf = useRef(0);
  const set = useCallback((next: { fold: number; open: number }) => {
    cancelAnimationFrame(raf.current);
    cur.current = next;
    setV(next);
  }, []);
  const to = useCallback((target: { fold: number; open: number }, ms: number, from?: { fold: number; open: number }) => {
    cancelAnimationFrame(raf.current);
    const a = from ?? cur.current;
    const t0 = performance.now();
    // من يفضّل تقليل الحركة: ينتقل مباشرة
    const instant = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = (now: number) => {
      const k = instant ? 1 : Math.min(1, (now - t0) / ms);
      const next = { fold: a.fold + (target.fold - a.fold) * k, open: a.open + (target.open - a.open) * k };
      cur.current = next;
      setV(next);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { v, set, to };
}

const Viewer = lazy(() => import("@/studio/Viewer"));
const BoxViewer = lazy(() => import("@/studio/box/BoxViewer"));
const ArViewer = lazy(() => import("@/studio/ArViewer"));

function Swatches<T extends { id: string; swatch?: string; color?: string; name: { ar: string; en: string } }>({ items, value, onChange, label }: { items: T[]; value: string; onChange: (id: string) => void; label: string }) {
  const { pick } = useI18n();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((x) => {
        const on = x.id === value;
        const bg = x.swatch ?? (x.color === "transparent" ? "repeating-linear-gradient(45deg,#fff 0 4px,#eee 4px 8px)" : x.color);
        return (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={pick(x.name)}
            onClick={() => onChange(x.id)}
            className={`group inline-flex items-center gap-2 rounded-full ps-1 pe-3 py-1 border text-sm transition-colors ${on ? "border-ink-900 bg-white text-ink-900" : "border-paper-200 bg-white/60 text-paper-600 hover:border-paper-400"}`}
          >
            <span className="w-6 h-6 rounded-full border border-black/10" style={{ background: bg }} aria-hidden="true" />
            {pick(x.name)}
          </button>
        );
      })}
    </div>
  );
}

function ModelPicker({ items, value, onChange, cap, label, allowNone }: { items: PackModel[]; value?: string; onChange: (id: string) => void; cap?: PackModel | null; label: string; allowNone?: string }) {
  const { pick, t, num } = useI18n();
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {allowNone && (
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange("")} className={`rounded-2xl border p-2 text-xs flex flex-col items-center justify-center gap-1 min-h-[7.5rem] ${!value ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 text-paper-500"}`}>
          <i className="ri-forbid-line text-xl" aria-hidden="true"></i>
          {allowNone}
        </button>
      )}
      {items.map((m) => {
        const on = m.id === value;
        return (
          <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(m.id)} className={`rounded-2xl border p-2 flex flex-col items-center gap-1 transition-colors ${on ? "border-ink-900 bg-white text-ink-900" : "border-paper-200 bg-white/60 text-paper-500 hover:border-paper-400"}`}>
            <ProfileIcon model={m} cap={m.kind === "bottle" ? cap : undefined} className="h-16 w-full" />
            <span className="text-[11px] leading-tight text-center text-ink-900">
              {pick(m.name)}
              {m.source === "ai" && <span className="ms-1 rounded-full bg-accent2-soft text-accent2-ink px-1.5 text-[9px] align-middle">3D AI</span>}
            </span>
            {m.capacityMl ? <span className="text-[10px] text-paper-500">{t(`${num(m.capacityMl)} مل`, `${m.capacityMl} ml`)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function BoxStats({ design }: { design: BoxDesign }) {
  const { t, num } = useI18n();
  const rates = useContent("pricing").box;
  const volume = useContent("pricing").calc.tiers;
  const stats = useMemo(() => {
    const spec = buildSpec(design);
    const st = dielineStats(flatten(spec));
    const r = (n: number) => num(Math.round(n));
    // السعر بجانب المعاينة: يراه العميل وهو يغيّر التصميم (اللوحة الجانبية تتمرر)
    const e = estimateBox(design, design.qty ?? DEFAULT_QTY, rates, volume);
    return { outer: `${r(spec.outer.w)}×${r(spec.outer.d)}×${r(spec.outer.h)}`, sheet: `${r(st.sheetW)}×${r(st.sheetH)}`, price: t(`${num(e.unit, 2)} ر.س`, `SAR ${num(e.unit, 2)}`), qty: e.qty };
  }, [design, num, rates, volume, t]);
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
      {[
        { k: t("المقاس الخارجي (مم)", "Outer (mm)"), v: stats.outer },
        { k: t("الفرخ المسطّح (مم)", "Flat sheet (mm)"), v: stats.sheet },
        { k: t(`للعلبة × ${num(stats.qty)}`, `Per box × ${num(stats.qty)}`), v: stats.price },
      ].map((x) => (
        <div key={x.k} className="rounded-2xl bg-white border border-paper-200 py-3 px-1 min-w-0">
          <dt className="text-[11px] text-paper-500">{x.k}</dt>
          {/* الأبعاد تُقرأ عرض×عمق×ارتفاع من اليسار حتى في الواجهة العربية */}
          <dd dir="ltr" className="mt-0.5 font-display text-ink-900 text-sm sm:text-base truncate">{x.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Studio3DPage() {
  const { t, pick, num } = useI18n();
  const [params, setParams] = useSearchParams();
  const [models, setModels] = useState<PackModel[] | null>(null);
  const [error, setError] = useState(false);
  const [rotate, setRotate] = useState(true);
  const [ar, setAr] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<"" | "png" | "ar">("");
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "bottle";
  const setTab = (k: Tab) => set("tab", k === "bottle" ? "" : k);
  const [box, setBox] = useState<BoxDesign | null>(loadBox);
  const pose = useTween({ fold: 1, open: 0 });
  const { user } = useAuth();
  const actor = usePActor();
  const navigate = useNavigate();
  const location = useLocation();
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);
  // قادم من مسار (?track=C|F): الاستوديو لوحة عمله، و«أكمل الطلب» يحمل التصميم إلى البريف
  const trackParam = params.get("track");
  const workTrack = trackParam === "F" ? "F" : "C";
  const completeWork = useCompleteWork(workTrack);
  // تصميم الملصق يُحفظ في هذا المتصفح تلقائياً (الشعار ضمنه)
  const [label, setLabel] = useState<LabelDesign | null>(loadLabel);
  const api = useRef<ViewerApi | null>(null);

  useEffect(() => {
    studioRepo
      .listPublished()
      .then(setModels)
      .catch(() => setError(true));
  }, []);

  const bottles = useMemo(() => models?.filter((m) => m.kind === "bottle") ?? [], [models]);
  const caps = useMemo(() => models?.filter((m) => m.kind === "cap") ?? [], [models]);

  // الحالة في الرابط: قابلة للمشاركة وتعود كما هي
  const get = (k: string, d: string) => params.get(k) ?? d;
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const bottle = bottles.find((b) => b.id === params.get("b")) ?? bottles[0] ?? null;
  const capId = params.has("c") ? params.get("c") ?? "" : caps[0]?.id ?? "";
  // منتج الذكاء الاصطناعي كامل بغطائه وخاماته: يُعرض كما صُوِّر
  const isAi = bottle?.source === "ai";
  const cap = isAi ? null : caps.find((c) => c.id === capId) ?? null;
  const glass = get("g", "clear");
  const finish = get("cf", "gold");
  const liquid = get("l", "amber");
  const fill = Math.min(100, Math.max(0, Number(get("f", "75")))) / 100;
  // مواصفة التصنيع للعبوة (آلية الغطاء، المضخة، زخرفة الزجاج) — في الرابط مثل بقية الخيارات
  const spec = parseBottleSpec((k) => params.get(k));
  const specExtra = bottleSpecExtra(spec);
  // عميل خارج السعودية: ملحقات التصدير تُقترح تلقائياً
  const exporting = (user?.country ?? guessCountry()) !== "SA";

  // الملصق (قد يحمل شعاراً كبيراً) يُحفظ مؤجّلاً أثناء التعديل، ويُكمَل فوراً عند مغادرة الصفحة فلا يضيع آخر تعديل
  const latest = useRef({ label });
  latest.current = { label };
  useEffect(() => {
    const flush = () => {
      try {
        if (latest.current.label) localStorage.setItem(LABEL_KEY, JSON.stringify(latest.current.label));
      } catch {
        /* التخزين غير متاح أو ممتلئ */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (label) localStorage.setItem(LABEL_KEY, JSON.stringify(label));
      } catch {
        /* التخزين ممتلئ (شعار كبير) — يبقى التصميم في الجلسة */
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [label]);

  // العلبة صغيرة: تُحفظ فوراً مع كل تعديل (حاسبة التكلفة تقرؤها لحظة فتحها، قبل أن تُغلق هذه الصفحة)
  useLayoutEffect(() => {
    try {
      if (box) localStorage.setItem(BOX_KEY, JSON.stringify(box));
    } catch {
      /* التخزين غير متاح */
    }
  }, [box]);

  // عند تغيير العبوة: نُبقي الملصق داخل منطقة جسمها الجديدة
  useEffect(() => {
    if (!bottle || isAi) return;
    setLabel((l) => {
      if (!l) return l;
      const fit = defaultSize(bottle);
      const z = fit.zone;
      const maxW = Math.round(Math.min(110, fit.perimeter * 0.9));
      const heightMm = Math.min(l.heightMm, Math.floor(z.height));
      const widthMm = Math.min(l.widthMm, maxW);
      const centerYmm = Math.min(z.top - heightMm / 2, Math.max(z.bottom + heightMm / 2, l.centerYmm));
      return heightMm === l.heightMm && widthMm === l.widthMm && centerYmm === l.centerYmm ? l : { ...l, heightMm, widthMm, centerYmm };
    });
  }, [bottle, isAi]);

  const exportLabel = async (kind: "pdf" | "png") => {
    if (!label) return;
    const ref = `${bottle?.id ?? "B"}-${Date.now().toString(36).toUpperCase()}`;
    const a = document.createElement("a");
    if (kind === "pdf") {
      const { exportLabelPdf } = await import("@/studio/label/pdf");
      const blob = await exportLabelPdf(label, { reference: ref });
      a.href = URL.createObjectURL(blob);
      a.download = `label-${ref}.pdf`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else {
      const { exportLabelPng } = await import("@/studio/label/pdf");
      a.href = await exportLabelPng(label);
      a.download = `label-${ref}.png`;
      a.click();
    }
  };

  const onReady = useCallback((a: ViewerApi) => {
    api.current = a;
  }, []);
  // مرجع ثابت: وإلا أعادت نافذة الواقع المعزز بناء النموذج مع كل تحديث للصفحة
  const closeAr = useCallback(() => setAr(null), []);

  const totalH = (bottle?.heightMm ?? 0) + (cap ? cap.heightMm - (bottle?.neckMm ?? 0) : 0);
  // أبعاد المنتج (العبوة مع غطائها) لملاءمة العلبة
  const fit = useMemo(() => {
    if (!bottle) return null;
    const r = Math.max(0, ...bottle.profile.map((p) => p[0]), ...(cap ? cap.profile.map((p) => p[0]) : []));
    const w = r > 0 ? r * 2 : 50;
    return { w, d: w * (bottle.depthRatio || 1), h: totalH };
  }, [bottle, cap, totalH]);
  const boxDesign = useMemo(() => box ?? defaultBox(fit ?? undefined), [box, fit]);
  const labelLogo = label?.logo?.dataUrl ?? null;

  const exportBox = async (kind: "svg" | "pdf") => {
    const spec = buildSpec(boxDesign);
    const flat = flatten(spec);
    const ref = `${boxDesign.style.toUpperCase()}-${boxDesign.L}x${boxDesign.W}x${boxDesign.H}`;
    const blob = kind === "svg" ? new Blob([dielineSvg(boxDesign, spec, flat)], { type: "image/svg+xml" }) : await exportBoxPdf(boxDesign, spec, flat, boxDesign.useLogo ? labelLogo : null, ref);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `box-${ref}.${kind}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const playFold = () => pose.to({ fold: 1, open: 0 }, 3600, { fold: 0, open: 0 });
  const toggleOpen = () => {
    const o = pose.v.open > 0.5 ? 0 : 1;
    pose.to({ fold: 1, open: o }, 1100);
  };
  const brimful = bottle && !isAi ? estimateCapacityMl(bottle.profile, { squareness: bottle.squareness, depthRatio: bottle.depthRatio, neckMm: bottle.neckMm }) : 0;
  const summary = bottle && isAi
    ? `${pick(bottle.name)}${bottle.capacityMl ? ` ${bottle.capacityMl}ml` : ""}`
    : bottle
    ? [
        `${pick(bottle.name)}${bottle.capacityMl ? ` ${bottle.capacityMl}ml` : ""}`,
        `${t("زجاج", "Glass")}: ${pick(glassById(glass).name)}`,
        cap ? `${t("غطاء", "Cap")}: ${pick(cap.name)} · ${pick(finishById(finish).name)}` : t("بدون غطاء", "No cap"),
        `${t("السائل", "Liquid")}: ${pick(liquidById(liquid).name)}`,
        ...bottleSpecLines(spec, pick),
        ...(label?.enabled
          ? [`${t("ملصق", "Label")}: ${label.widthMm}×${label.heightMm} ${t("مم", "mm")}${label.texts[0]?.text ? ` «${label.texts[0].text}»` : ""}`]
          : []),
        ...(box ? [`${t("علبة", "Box")}: ${pick(BOX_STYLES.find((s) => s.id === box.style)!.name)} ${box.L}×${box.W}×${box.H} ${t("مم", "mm")}`] : []),
        ...(cleanExtras(box?.extras).length ? [`${t("ملحقات", "Extras")}: ${cleanExtras(box?.extras).map((x) => pick(extraById(x)!.name)).join("، ")}`] : []),
      ].join(" | ")
    : "";

  // فتح تصميم محفوظ من الحساب (?design=…): يستعيد الملصق والعلبة كما حُفظا، ثم يُزال المعرّف من الرابط
  const designParam = params.get("design");
  useEffect(() => {
    if (!designParam || !actor) return;
    let live = true;
    void projectsRepo.listDesigns(actor).then((list) => {
      const d = list.find((x) => x.id === designParam);
      if (!live) return;
      if (d) {
        if (d.label) setLabel(d.label as LabelDesign);
        if (d.box) setBox(d.box as BoxDesign);
      }
      const next = new URLSearchParams(window.location.search);
      next.delete("design");
      setParams(next, { replace: true });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designParam, actor]);

  const saveToAccount = async () => {
    if (!user || !actor) {
      navigate("/auth", { state: { from: location.pathname + location.search } });
      return;
    }
    const base = bottle ? pick(bottle.name) : t("تصميمي", "My design");
    const name = window.prompt(t("اسم التصميم", "Design name"), `${base} · ${new Date().toLocaleDateString("en-GB")}`)?.trim();
    if (!name) return;
    let thumb: string | null = null;
    try {
      thumb = api.current?.snapshot(360, "image/webp") ?? null;
      if (thumb && (!/^data:image\/(webp|png|jpeg)/.test(thumb) || thumb.length >= 120_000)) thumb = api.current?.snapshot(240, "image/webp") ?? null;
      if (thumb && thumb.length >= 120_000) thumb = null;
    } catch {
      thumb = null;
    }
    // الشعار المضمَّن قد يكون كبيراً: يُحفظ الملصق بدونه إن تجاوز الحد
    let lbl: LabelDesign | null = label;
    if (lbl && JSON.stringify(lbl).length > 250_000) lbl = { ...lbl, logo: null };
    const q = new URLSearchParams(window.location.search);
    q.delete("design");
    const link = `/studio-3d${q.toString() ? `?${q}` : ""}`;
    try {
      await projectsRepo.saveDesign({ name, link, summary: summary.slice(0, 600), thumb, label: lbl, box }, null, actor);
      setSaved({ ok: true, text: lbl !== label ? t("حُفظ التصميم في حسابك (بدون الشعار لكبر حجمه)", "Saved to your account (without the logo — too large)") : t("حُفظ التصميم في حسابك", "Saved to your account") });
    } catch {
      setSaved({ ok: false, text: t("تعذّر الحفظ. حاول مرة أخرى.", "Couldn't save. Please try again.") });
    }
  };

  // ما يُرفق بالطلب: الملخص، ورابط يعيد فتح الاستوديو بالحالة نفسها، والملصق والعلبة لحفظهما في الحساب
  const workDraft = (): WorkDraft => {
    const q = new URLSearchParams(window.location.search);
    for (const k of ["design", "track", "package"]) q.delete(k);
    let lbl: LabelDesign | null = label;
    if (lbl && JSON.stringify(lbl).length > 250_000) lbl = { ...lbl, logo: null };
    // العلبة المعروضة تُرفق حتى لو لم يعدّلها (هي ما رآه واعتمده بصرياً)
    const bx = box ?? (tab === "box" ? boxDesign : null);
    const sum = [summary, ...(!box && bx ? [`${t("علبة", "Box")}: ${pick(BOX_STYLES.find((x) => x.id === bx.style)!.name)} ${bx.L}×${bx.W}×${bx.H} ${t("مم", "mm")}`] : [])].filter(Boolean).join(" | ");
    let thumb: string | null = null;
    try {
      thumb = api.current?.snapshot(240, "image/webp") ?? null;
      if (thumb && (!/^data:image\/(webp|png|jpeg)/.test(thumb) || thumb.length >= 120_000)) thumb = null;
    } catch {
      thumb = null;
    }
    // مواصفة التصنيع تصل الفريق حقولاً مقروءة لا نصاً فقط
    const fields: Record<string, string> = { spec_cap: spec.cap, spec_pump: spec.pump, spec_deco: spec.deco };
    if (bx) fields.box_extras = cleanExtras(bx.extras).join(",");
    if (bottle) fields.spec_bottle = `${pick(bottle.name)}${bottle.capacityMl ? ` ${bottle.capacityMl}ml` : ""}`;
    return { summary: sum || t("تصميم من الاستوديو", "A studio design"), link: `/studio-3d${q.toString() ? `?${q}` : ""}`, fields, design: { label: lbl ?? undefined, box: bx ?? undefined, thumb } };
  };

  const download = () => {
    if (!api.current) return;
    setBusy("png");
    const a = document.createElement("a");
    a.href = api.current.snapshot(2000);
    a.download = tab === "box" ? `box-${boxDesign.style}-${boxDesign.L}x${boxDesign.W}x${boxDesign.H}.png` : `${bottle?.id ?? "design"}-${glass}-${finish}.png`;
    a.click();
    setBusy("");
  };

  const openAr = async () => {
    if (!api.current) return;
    setBusy("ar");
    try {
      setAr(await api.current.exportGlb());
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      {trackParam && <div className="pt-[4.25rem]"><WorkspaceBar track={workTrack} work={workDraft} ready={!!bottle || tab === "box"} /></div>}
      <header className={`${trackParam ? "pt-10" : "pt-28 md:pt-32"} pb-8 max-w-7xl mx-auto px-5 md:px-8`}>
        <p className="inline-flex items-center gap-2 text-sm text-paper-500 fade-up">
          <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
          {t("استوديو العبوة ثلاثي الأبعاد", "3D bottle studio")}
        </p>
        <h1 className="mt-4 font-display text-[2.2rem] leading-[1.15] md:text-5xl text-ink-900">
          <span className="line-mask"><span>{t("ركّب عبوتك", "Build your bottle")}</span></span>{" "}
          <span className="line-mask"><span className="text-paper-400">{t("وشاهدها من كل زاوية.", "and see it from every angle.")}</span></span>
        </h1>
        <p className="mt-4 max-w-2xl text-paper-600 leading-[1.8] fade-up" style={{ ["--d" as string]: 2 }}>
          {t("اختر الشكل والغطاء والزجاج ولون العطر. اسحب للتدوير، وقرّب بإصبعين، وشاهدها بحجمها الحقيقي على طاولتك.", "Pick the shape, cap, glass and scent colour. Drag to rotate, pinch to zoom, and see it at real size on your table.")}
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 lg:sticky lg:top-24 min-w-0">
          <div className="relative rounded-[1.75rem] overflow-hidden border border-paper-200 bg-[#F3F1EC] h-[56vh] lg:h-[74vh] min-h-[22rem]">
            {tab === "box" ? (
              <Suspense fallback={<div className="absolute inset-0 shimmer" />}>
                <BoxViewer
                  className="absolute inset-0"
                  design={boxDesign}
                  fold={pose.v.fold}
                  open={pose.v.open}
                  logoUrl={boxDesign.useLogo ? labelLogo : null}
                  autoRotate={rotate && pose.v.fold >= 1}
                  onReady={onReady}
                  ariaLabel={t(`علبة ${pick(BOX_STYLES.find((s) => s.id === boxDesign.style)!.name)} ثلاثية الأبعاد`, `3D ${pick(BOX_STYLES.find((s) => s.id === boxDesign.style)!.name)} box`)}
                />
              </Suspense>
            ) : models && bottle ? (
              <Suspense fallback={<div className="absolute inset-0 shimmer" />}>
                <Viewer
                  className="absolute inset-0"
                  bottle={bottle}
                  cap={cap}
                  glass={glass}
                  capFinish={finish}
                  liquid={liquid}
                  fill={fill}
                  label={!isAi && label?.enabled ? label : null}
                  autoRotate={rotate}
                  onReady={onReady}
                  ariaLabel={summary}
                />
              </Suspense>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-paper-500 text-sm">
                {error ? t("تعذّر تحميل الكتالوج.", "Couldn't load the catalogue.") : models ? t("لا عبوات منشورة بعد.", "No published bottles yet.") : <span className="w-10 h-10 rounded-full border-2 border-paper-300 border-t-ink-900 animate-spin" aria-label={t("جاري التحميل", "Loading")} />}
              </div>
            )}
            <div className="absolute top-3 inset-x-3 flex justify-between gap-2 pointer-events-none">
              <span className="pointer-events-auto rounded-full bg-white/85 backdrop-blur px-3 py-1.5 text-xs text-paper-600">{t("اسحب للتدوير · قرّب للتكبير", "Drag to rotate · pinch to zoom")}</span>
              <div className="pointer-events-auto flex gap-1.5">
                <button type="button" onClick={() => setRotate((v) => !v)} aria-pressed={rotate} className="w-9 h-9 rounded-full bg-white/85 backdrop-blur flex items-center justify-center text-ink-900" title={t("دوران تلقائي", "Auto-rotate")} aria-label={t("دوران تلقائي", "Auto-rotate")}>
                  <i className={rotate ? "ri-pause-line" : "ri-refresh-line"} aria-hidden="true"></i>
                </button>
                <button type="button" onClick={() => api.current?.resetView()} className="w-9 h-9 rounded-full bg-white/85 backdrop-blur flex items-center justify-center text-ink-900" title={t("إعادة الضبط", "Reset view")} aria-label={t("إعادة الضبط", "Reset view")}>
                  <i className="ri-focus-3-line" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            {tab === "box" && (
              <div className="absolute bottom-[4.25rem] inset-x-3 flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-paper-200 ps-1.5 pe-2 py-1.5 w-full max-w-md">
                  <button type="button" onClick={playFold} className="shrink-0 w-9 h-9 rounded-full bg-ink-900 text-white flex items-center justify-center" aria-label={t("شغّل حركة الطي", "Play the fold")} title={t("شغّل حركة الطي", "Play the fold")}>
                    <i className="ri-play-fill" aria-hidden="true"></i>
                  </button>
                  <label className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[11px] text-paper-500 shrink-0">{t("مسطّحة", "Flat")}</span>
                    <input type="range" min={0} max={100} step={1} value={Math.round(pose.v.fold * 100)} onChange={(e) => pose.set({ fold: Number(e.target.value) / 100, open: 0 })} className="flex-1 min-w-0 accent-ink-900" aria-label={t("مرحلة الطي", "Fold progress")} />
                    <span className="text-[11px] text-paper-500 shrink-0">{t("مطوية", "Folded")}</span>
                  </label>
                  <button type="button" onClick={toggleOpen} aria-pressed={pose.v.open > 0.5} className={`shrink-0 rounded-full px-3 h-9 text-xs border inline-flex items-center gap-1 ${pose.v.open > 0.5 ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 text-ink-900"}`}>
                    <i className={pose.v.open > 0.5 ? "ri-door-closed-line" : "ri-door-open-line"} aria-hidden="true"></i>
                    {pose.v.open > 0.5 ? t("أغلق", "Close") : t("افتح", "Open")}
                  </button>
                </div>
              </div>
            )}
            <div className="absolute bottom-3 inset-x-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={openAr} disabled={(tab !== "box" && !bottle) || busy !== ""} className="rounded-full bg-ink-900 text-white px-4 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-50">
                <i className="ri-camera-lens-line" aria-hidden="true"></i>
                {busy === "ar" ? t("جاري التجهيز…", "Preparing…") : t("شاهدها في مساحتك", "See it in your space")}
              </button>
              <button type="button" onClick={download} disabled={(tab !== "box" && !bottle) || busy !== ""} className="rounded-full bg-white/90 backdrop-blur border border-paper-200 px-4 py-2.5 text-sm text-ink-900 inline-flex items-center gap-2 disabled:opacity-50">
                <i className="ri-image-line" aria-hidden="true"></i>
                {t("حفظ صورة", "Save image")}
              </button>
            </div>
          </div>
          {tab === "box" ? (
            <BoxStats design={boxDesign} />
          ) : bottle && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: t("السعة الاسمية", "Nominal"), v: bottle.capacityMl ? t(`${num(bottle.capacityMl)} مل`, `${bottle.capacityMl} ml`) : "—" },
                { k: t("الارتفاع الكلي", "Total height"), v: t(`${num(Math.round(totalH))} مم`, `${Math.round(totalH)} mm`) },
                { k: t("حتى الحافة", "Brimful"), v: isAi ? "—" : t(`≈ ${num(brimful)} مل`, `≈ ${brimful} ml`) },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl bg-white border border-paper-200 py-3">
                  <dt className="text-[11px] text-paper-500">{x.k}</dt>
                  <dd className="mt-0.5 font-display text-ink-900">{x.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="lg:col-span-5 space-y-6 min-w-0" aria-label={t("خيارات التصميم", "Design options")}>
          <div className="inline-flex rounded-full bg-paper-100 p-1" role="tablist" aria-label={t("خيارات التصميم", "Design options")}>
            {TABS.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 sm:px-5 py-2 text-sm ${tab === k ? "bg-white text-ink-900 shadow-sm" : "text-paper-600"}`}>
                {k === "bottle" ? t("العبوة والخامات", "Bottle & materials") : k === "label" ? t("الملصق", "Label") : t("العلبة", "Box")}
                {k === "label" && label?.enabled && <span className="ms-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent2 align-middle" aria-hidden="true" />}
              </button>
            ))}
          </div>
          {tab === "box" && <BoxPanel design={boxDesign} onChange={setBox} fit={fit} capacityMl={bottle?.capacityMl} exporting={exporting} label={label} onExport={exportBox} />}
          {tab === "label" && bottle && (
            isAi ? (
              <p className="rounded-2xl bg-white border border-paper-200 p-4 text-sm text-paper-600 leading-[1.8]">{t("منتجات الذكاء الاصطناعي تُعرض بملصقها كما صُوِّرت. اختر شكلاً من الكتالوج لتصميم ملصق جديد.", "AI products show their label as photographed. Pick a catalogue shape to design a new label.")}</p>
            ) : (
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-paper-200 px-4 py-3">
                  <span className="text-sm text-ink-900">{t("أضف ملصقاً على العبوة", "Add a label to the bottle")}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={!!label?.enabled}
                    onChange={(e) => setLabel((l) => (l ? { ...l, enabled: e.target.checked } : e.target.checked ? makeTemplate("minimal", bottle) : null))}
                    className="w-5 h-5 accent-ink-900"
                  />
                </label>
                {label?.enabled && <LabelPanel design={label} onChange={setLabel} bottle={bottle} onExport={exportLabel} />}
                {label?.enabled && (
                  <section className="rounded-2xl bg-white border border-paper-200 p-4" aria-labelledby="lbl-ready" data-testid="label-checklist">
                    <h3 id="lbl-ready" className="text-sm text-ink-900 flex items-center gap-2"><i className="ri-shield-check-line" aria-hidden="true"></i>{t("جاهزية الملصق للطباعة والتسجيل", "Label readiness for print & registration")}</h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      {labelChecklist(label, bottle).map((c) => (
                        <li key={c.id} className={`flex items-start gap-2 ${c.ok ? "text-paper-600" : "text-accent2-ink"}`} data-ok={c.ok}>
                          <i className={`${c.ok ? "ri-checkbox-circle-fill text-[#1F6B4F]" : "ri-error-warning-line"} mt-0.5`} aria-hidden="true"></i>
                          {pick(c.text)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] text-paper-400 leading-[1.6]">{t("قائمة المكوّنات ورقم التشغيلة والباركود تُطبع على العلبة أو بطاقة المكوّنات (تبويب العلبة).", "Ingredients, batch number and barcode go on the box or the ingredients card (Box tab).")}</p>
                  </section>
                )}
              </div>
            )
          )}
          {tab === "bottle" && <>
          <div>
            <h2 className="text-sm text-paper-500 mb-3">{t("1 · شكل العبوة", "1 · Bottle shape")}</h2>
            <ModelPicker items={bottles} value={bottle?.id} onChange={(id) => set("b", id)} label={t("شكل العبوة", "Bottle shape")} />
          </div>
          {isAi ? (
            <p className="rounded-2xl bg-white border border-paper-200 p-4 text-sm text-paper-600 leading-[1.8]">
              <span className="rounded-full bg-accent2-soft text-accent2-ink px-2 py-0.5 text-xs me-2">3D AI</span>
              {t("نموذج مولّد بالذكاء الاصطناعي من صورة المنتج الفعلي، بغطائه وخاماته كما هي. اسحب لتدويره، أو شاهده بحجمه الحقيقي في مساحتك.", "Generated by AI from a photo of the actual product, with its cap and materials as they are. Drag to rotate, or see it at real size in your space.")}
            </p>
          ) : (
            <>
          <div>
            <h2 className="text-sm text-paper-500 mb-3">{t("2 · الزجاج", "2 · Glass")}</h2>
            <Swatches items={GLASS} value={glass} onChange={(id) => set("g", id)} label={t("الزجاج", "Glass")} />
          </div>
          <div>
            <h2 className="text-sm text-paper-500 mb-3">{t("3 · الغطاء", "3 · Cap")}</h2>
            <ModelPicker items={caps} value={capId} onChange={(id) => set("c", id)} label={t("الغطاء", "Cap")} allowNone={t("بدون", "None")} />
            {cap && (
              <div className="mt-3">
                <Swatches items={CAP_FINISH} value={finish} onChange={(id) => set("cf", id)} label={t("تشطيب الغطاء", "Cap finish")} />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-sm text-paper-500 mb-3">{t("4 · لون العطر", "4 · Scent colour")}</h2>
            <Swatches items={LIQUID} value={liquid} onChange={(id) => set("l", id)} label={t("لون العطر", "Scent colour")} />
            {liquid !== "none" && glassById(glass).transmission > 0 && (
              <label className="mt-4 block">
                <span className="flex justify-between text-xs text-paper-500 mb-2">
                  <span>{t("مستوى الامتلاء", "Fill level")}</span>
                  <span className="font-mono">{num(Math.round(fill * 100))}%</span>
                </span>
                <input type="range" min={10} max={100} step={5} value={Math.round(fill * 100)} onChange={(e) => set("f", e.target.value)} className="w-full accent-ink-900" />
              </label>
            )}
            {glassById(glass).transmission === 0 && <p className="mt-3 text-xs text-paper-500">{t("الزجاج المطلي لا يُظهر السائل.", "Lacquered glass hides the liquid.")}</p>}
          </div>
            </>
          )}
          <div data-testid="bottle-spec">
            <h2 className="text-sm text-paper-500 mb-1">{t("5 · خيارات التصنيع", "5 · Manufacturing options")}</h2>
            <p className="text-xs text-paper-500 mb-3 leading-[1.7]">{t("ما لا يظهر في المجسم لكنه يُصنَّع: آلية الغطاء، المضخة، وزخرفة الزجاج. تُضاف إلى سعر العبوة وتصل المصنع ضمن مواصفة طلبك.", "What the model doesn't show but the factory makes: cap mechanism, pump and glass decoration. Added to the bottle price and sent with your request.")}</p>
            <div className="space-y-3">
              {([
                { k: "cm", label: t("آلية الغطاء", "Cap mechanism"), items: CAP_MECHANISMS, v: spec.cap },
                { k: "pm", label: t("المضخة", "Pump"), items: PUMPS, v: spec.pump },
                { k: "dc", label: t("زخرفة الزجاج", "Glass decoration"), items: DECORATIONS, v: spec.deco },
              ] as const).map((g) => (
                <div key={g.k}>
                  <p className="text-[11px] text-paper-500 mb-1.5">{g.label}</p>
                  <div role="radiogroup" aria-label={g.label} className="flex flex-wrap gap-1.5">
                    {g.items.map((x) => {
                      const on = x.id === g.v;
                      return (
                        <button key={x.id} type="button" role="radio" aria-checked={on} title={pick(x.note)} onClick={() => set(g.k, x.id === g.items[0].id ? "" : x.id)} className={`rounded-full px-3 py-1.5 text-xs border transition-colors inline-flex items-center gap-1.5 ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white/70 border-paper-200 text-paper-700 hover:border-ink-900"}`}>
                          {pick(x.name)}
                          {x.perUnit > 0 && <span className={`font-mono text-[10px] ${on ? "text-white/70" : "text-paper-400"}`} dir="ltr">+{num(x.perUnit, 2)}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-paper-500">{pick(g.items.find((x) => x.id === g.v)!.note)}</p>
                </div>
              ))}
              {specExtra > 0 && <p className="text-xs text-ink-900">{t(`إضافة الخيارات: ${num(specExtra, 2)} ر.س لكل عبوة`, `Options add SAR ${num(specExtra, 2)} per bottle`)}</p>}
            </div>
          </div>
          </>}
          <div className="rounded-[1.75rem] bg-ink-900 text-white p-6">
            <p className="text-sm text-white/60">{t("تركيبتك", "Your design")}</p>
            <p className="mt-2 text-sm leading-[1.9] text-white/90">{summary || "—"}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {completeWork && (
                <Button onClick={() => completeWork(workDraft())} variant="light" arrow>
                  {t("أكمل الطلب بهذا التصميم", "Complete the request with this design")}
                </Button>
              )}
              <Button to={`/book?track=C&note=${encodeURIComponent(`${t("تصميم من استوديو 3D", "From the 3D studio")}: ${summary}`)}`} variant="ghost" className="!text-white border border-white/30 hover:!bg-white/10">
                {t("ناقش هذه التركيبة مع خبير", "Discuss this design with an expert")}
              </Button>
              <Button onClick={saveToAccount} variant="ghost" className="!text-white border border-white/30 hover:!bg-white/10">
                <i className="ri-bookmark-line" aria-hidden="true"></i>
                {user ? t("احفظ في حسابي", "Save to my account") : t("سجّل الدخول للحفظ", "Sign in to save")}
              </Button>
              <Button to={`/creatives?design=${encodeURIComponent(summary.slice(0, 600))}&link=${encodeURIComponent(window.location.href)}#brief`} variant="ghost" className="!text-white border border-white/30 hover:!bg-white/10">
                {t("أكملها مع مصمم", "Finish it with a creative")}
              </Button>
            </div>
            {saved && (
              <p role={saved.ok ? "status" : "alert"} className={`mt-4 text-sm ${saved.ok ? "text-white" : "text-red-300"}`}>
                {saved.text}
                {saved.ok && (
                  <Link to="/account/designs" className="ms-2 underline underline-offset-4">{t("تصاميمي", "My designs")}</Link>
                )}
              </p>
            )}
            <p className="mt-4 text-xs text-white/45 leading-[1.7]">
              {t("المعاينة تقريبية للون والإضاءة؛ نؤكد الخامات بعينة فعلية قبل الإنتاج.", "The preview approximates colour and light; we confirm materials with a physical sample before production.")}
            </p>
          </div>
        </section>
      </main>

      {ar && bottle && (
        <Suspense fallback={null}>
          <ArViewer glb={ar} iosSrc={isAi && tab !== "box" ? bottle.usdzUrl ?? undefined : undefined} title={summary} shareUrl={window.location.href} onClose={closeAr} />
        </Suspense>
      )}
      <FooterSection />
    </div>
  );
}
