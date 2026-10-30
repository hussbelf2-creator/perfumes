import { useEffect, useRef, useState } from "react";
import { Box3, CanvasTexture, Color, FrontSide, Mesh, MeshPhysicalMaterial, SRGBColorSpace, Vector3 } from "three";
import { buildLoft, profileHeight } from "./geometry";
import { finishById, glassById, liquidById } from "./materials";
import type { PackModel } from "./types";
import { resolveModelUrl } from "./blobStore";
import type { LabelDesign } from "./label/types";
import { useI18n } from "@/i18n/context";
import { createStage, disposeGroup, type Stage } from "./stage";

// عارض ثلاثي الأبعاد: المقاييس بالمتر (المليمتر × 0.001) فيظهر المنتج بحجمه الحقيقي في الواقع المعزز

const MM = 0.001;

export interface ViewerApi {
  /** صورة PNG من الزاوية الحالية */
  snapshot: (maxWidth?: number, type?: "image/png" | "image/webp") => string;
  /** ملف GLB للمنتج (للواقع المعزز أو للمصمم) */
  exportGlb: () => Promise<Blob>;
  resetView: () => void;
}

export interface ViewerProps {
  bottle?: PackModel | null;
  cap?: PackModel | null;
  glass?: string;
  capFinish?: string;
  liquid?: string;
  /** نسبة الامتلاء 0–1 */
  fill?: number;
  /** الملصق (للعبوات المولّدة من المقطع فقط) */
  label?: LabelDesign | null;
  autoRotate?: boolean;
  background?: string;
  /** يُستدعى بعد كل إعادة بناء للمجسم (يُستخدم للصورة المصغرة) */
  onReady?: (api: ViewerApi) => void;
  className?: string;
  ariaLabel: string;
}

export default function Viewer({ bottle, cap, glass, capFinish, liquid, fill = 0.75, label, autoRotate = false, background = "#F3F1EC", onReady, className = "", ariaLabel }: ViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<Stage | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const { t } = useI18n();

  // ── إعداد المشهد مرة واحدة
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const stage = createStage(el);
    ctx.current = stage;
    return () => {
      stage.dispose();
      ctx.current = null;
    };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.scene.background = new Color(background);
    c.controls.autoRotate = autoRotate;
    c.invalidate();
  }, [background, autoRotate]);

  // ── إعادة بناء المنتج عند تغيّر الاختيارات
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    disposeGroup(c.product);
    let cancelled = false;
    let raf = 0;

    let top = 0;
    let maxW = 30;
    const finish = () => {
      c.product.scale.setScalar(MM);
      c.frame(Math.max(top, 20) * MM, maxW * MM);
      c.invalidate();
      const api: ViewerApi = {
        snapshot: (maxWidth = 1600, type = "image/png") => {
          c.renderer.render(c.scene, c.camera);
          const src = c.renderer.domElement;
          const k = Math.min(1, maxWidth / src.width);
          if (k === 1 && type === "image/png") return src.toDataURL(type);
          const out = document.createElement("canvas");
          out.width = Math.round(src.width * k);
          out.height = Math.round(src.height * k);
          out.getContext("2d")!.drawImage(src, 0, 0, out.width, out.height);
          return out.toDataURL(type, 0.86);
        },
        exportGlb: async () => {
          const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
          const result = await new GLTFExporter().parseAsync(c.product, { binary: true });
          return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        },
        resetView: () => c.frame(Math.max(top, 20) * MM, maxW * MM),
      };
      // إطار واحد قبل الإبلاغ ليكون المشهد مرسوماً
      raf = requestAnimationFrame(() => readyRef.current?.(api));
    };

    // نموذج الذكاء الاصطناعي: ملف GLB كامل (العبوة والغطاء معاً) يُعرض كما هو
    if (bottle?.source === "ai" && bottle.glbUrl) {
      setLoadState("loading");
      const url = bottle.glbUrl;
      void (async () => {
        try {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const src = await resolveModelUrl(url);
          const gltf = await new GLTFLoader().loadAsync(src);
          if (src.startsWith("blob:")) URL.revokeObjectURL(src);
          if (cancelled) return;
          const root = gltf.scene;
          root.traverse((o) => {
            if (o instanceof Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          // وحدات مخرجات الذكاء الاصطناعي اعتباطية: نحجّمه لارتفاعه الحقيقي بالمليمتر ونضعه على الأرض
          const box = new Box3().setFromObject(root);
          const size = box.getSize(new Vector3());
          const k = bottle.heightMm / (size.y || 1);
          root.scale.setScalar(k);
          const b2 = new Box3().setFromObject(root);
          const center = b2.getCenter(new Vector3());
          root.position.set(-center.x, -b2.min.y, -center.z);
          c.product.add(root);
          top = bottle.heightMm;
          maxW = Math.max(size.x, size.z) * k;
          setLoadState("idle");
          finish();
        } catch {
          if (!cancelled) setLoadState("error");
        }
      })();
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    setLoadState("idle");

    if (bottle) {
      const g = glassById(glass);
      const h = profileHeight(bottle.profile);
      const geo = buildLoft(bottle.profile, { squareness: bottle.squareness, depthRatio: bottle.depthRatio, segments: 128 });
      const mat = new MeshPhysicalMaterial({
        color: g.color,
        roughness: g.roughness,
        metalness: 0,
        transmission: g.transmission,
        // السماكة بوحدات المجسم (مم)، أما مسافة امتصاص اللون فبوحدات العالم (متر)
        thickness: 7,
        ior: 1.5,
        attenuationColor: new Color(g.attenuationColor),
        attenuationDistance: g.attenuationDistance * MM,
        specularIntensity: 1,
        clearcoat: g.transmission ? 0 : 0.6,
        envMapIntensity: g.transmission ? 0.9 : 1.15,
      });
      const mesh = new Mesh(geo, mat);
      mesh.name = "bottle";
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      c.product.add(mesh);

      const lq = liquidById(liquid);
      if (lq.id !== "none" && g.transmission > 0 && fill > 0) {
        const base = 6;
        const bodyTop = (h - bottle.neckMm) * 0.94;
        const level = base + Math.min(1, fill) * (bodyTop - base);
        // العطر الشفاف لا يُرسم كتلةً (يبدو كالحليب): نُظهر خط الامتلاء فقط
        const clearLiquid = lq.id === "clear";
        const lgeo = buildLoft(bottle.profile, { squareness: bottle.squareness, depthRatio: bottle.depthRatio, segments: 96, inset: 2.6, fromY: clearLiquid ? level - 0.6 : base, toY: level });
        // السائل معتم تقنياً: نفاذية three.js لا ترى جسماً شفافاً خلف آخر؛ والزجاج فوقه يمنحه العمق
        // انعكاسات خافتة على السائل: الزجاج فوقه يعكس ما يكفي، وإلا بهت اللون
        const lmat = new MeshPhysicalMaterial({ color: clearLiquid ? "#cfc8b8" : lq.color, roughness: 0.35, envMapIntensity: 0.35 });
        const lmesh = new Mesh(lgeo, lmat);
        lmesh.name = "liquid";
        c.product.add(lmesh);
      }
      top = h;
      maxW = Math.max(...bottle.profile.map((p) => p[0])) * 2;
    }
    if (cap) {
      const f = finishById(capFinish);
      const geo = buildLoft(cap.profile, { squareness: cap.squareness, depthRatio: cap.depthRatio, segments: 128 });
      const mat = new MeshPhysicalMaterial({ color: f.color, metalness: f.metalness, roughness: f.roughness, clearcoat: f.clearcoat ?? 0, envMapIntensity: 1.2 });
      const mesh = new Mesh(geo, mat);
      mesh.name = "cap";
      mesh.castShadow = true;
      // الغطاء يغطي العنق: قاعدته عند بداية العنق
      const y = bottle ? profileHeight(bottle.profile) - bottle.neckMm : 0;
      mesh.position.y = y;
      c.product.add(mesh);
      top = Math.max(top, y + profileHeight(cap.profile));
      maxW = Math.max(maxW, Math.max(...cap.profile.map((p) => p[0])) * 2);
    }
    finish();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [bottle, cap, glass, capFinish, liquid, fill]);

  // ── الملصق: لوحة مرسومة تُلف على سطح العبوة. يُعاد بعد كل بناء للمنتج (لأنه يُفرَّغ)
  const labelMesh = useRef<Mesh | null>(null);
  useEffect(() => {
    const c = ctx.current;
    const drop = () => {
      const m = labelMesh.current;
      if (!m) return;
      m.parent?.remove(m);
      m.geometry.dispose();
      const mat = m.material as MeshPhysicalMaterial;
      mat.map?.dispose();
      mat.roughnessMap?.dispose();
      mat.dispose();
      labelMesh.current = null;
      c?.invalidate();
    };
    if (!c || !label?.enabled || !bottle || bottle.source === "ai") {
      drop();
      return;
    }
    let cancelled = false;
    // تأخير قصير أثناء الكتابة: لا نعيد الرسم مع كل حرف
    const timer = window.setTimeout(async () => {
      const [{ renderLabel }, { buildLabelGeometry }] = await Promise.all([import("./label/render"), import("./label/geometry")]);
      const art = await renderLabel(label, 10);
      if (cancelled) return;
      drop();
      const map = new CanvasTexture(art.color);
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = 8;
      const pbr = new CanvasTexture(art.pbr);
      const mat = new MeshPhysicalMaterial({
        map,
        roughnessMap: pbr,
        metalnessMap: pbr,
        roughness: 1,
        metalness: 1,
        alphaTest: 0.5,
        transparent: false,
        side: FrontSide,
        envMapIntensity: 1.1,
      });
      const geo = buildLabelGeometry(bottle.profile, bottle.squareness, bottle.depthRatio, { widthMm: label.widthMm, heightMm: label.heightMm, centerYmm: label.centerYmm });
      const mesh = new Mesh(geo, mat);
      mesh.name = "label";
      mesh.receiveShadow = true;
      c.product.add(mesh);
      labelMesh.current = mesh;
      c.invalidate();
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [label, bottle, cap, glass, capFinish, liquid, fill]);

  // التموضع يأتي من className (absolute/relative) — دمجهما يجعل أحدهما يُلغي الآخر
  return (
    <div className={`overflow-hidden touch-none ${className || "relative"}`} aria-label={ariaLabel} role="img" aria-busy={loadState === "loading"}>
      <div ref={host} className="absolute inset-0" />
      {loadState !== "idle" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {loadState === "loading" ? (
            <span className="w-10 h-10 rounded-full border-2 border-paper-300 border-t-ink-900 animate-spin" />
          ) : (
            <span role="alert" className="rounded-full bg-white/90 px-4 py-2 text-sm text-red-700">{t("تعذّر تحميل النموذج ثلاثي الأبعاد", "Couldn't load the 3D model")}</span>
          )}
        </div>
      )}
    </div>
  );
}
