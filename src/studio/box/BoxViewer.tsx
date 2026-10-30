import { useEffect, useRef, useState } from "react";
import { Color, Vector3 } from "three";
import { createStage, disposeGroup, type Stage } from "../stage";
import type { ViewerApi } from "../Viewer";
import { renderSheet } from "./art";
import { buildSpec, flatten } from "./dielines";
import { buildBoxModel, type BoxModel } from "./model3d";
import type { BoxDesign } from "./types";

export interface BoxViewerProps {
  design: BoxDesign;
  /** 0 = مسطّحة، 1 = مطوية */
  fold: number;
  /** 0 = مغلقة، 1 = مفتوحة */
  open: number;
  logoUrl: string | null;
  autoRotate?: boolean;
  background?: string;
  onReady?: (api: ViewerApi) => void;
  className?: string;
  ariaLabel: string;
}

const VIEW_DIR = new Vector3(0.42, 0.5, 1).normalize();

export default function BoxViewer({ design, fold, open, logoUrl, autoRotate = false, background = "#F3F1EC", onReady, className = "", ariaLabel }: BoxViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const model = useRef<BoxModel | null>(null);
  const pose = useRef({ fold, open });
  pose.current = { fold, open };
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  // هدف الكاميرا: تتبع المجسم بنعومة أثناء الطي دون أن تلغي زاوية المستخدم
  const want = useRef({ target: new Vector3(), dist: 0, active: false });
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const s = createStage(el);
    stage.current = s;
    let last = performance.now();
    s.onTick(() => {
      const now = performance.now();
      // معامل حسب الزمن لا عدد الإطارات: نفس السرعة على الأجهزة البطيئة
      const k = 1 - Math.exp(-((now - last) / 1000) * 7);
      last = now;
      const w = want.current;
      if (!w.active) return false;
      const c = s.controls;
      c.target.lerp(w.target, k);
      const off = s.camera.position.clone().sub(c.target);
      const len = off.length();
      const next = len + (w.dist - len) * k;
      s.camera.position.copy(c.target).add(off.normalize().multiplyScalar(next));
      if (c.target.distanceTo(w.target) < 1e-4 && Math.abs(next - w.dist) < 1e-4) w.active = false;
      return true;
    });
    return () => {
      model.current?.dispose();
      model.current = null;
      s.dispose();
      stage.current = null;
    };
  }, []);

  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    s.scene.background = new Color(background);
    s.controls.autoRotate = autoRotate;
    s.invalidate();
  }, [background, autoRotate]);

  const aim = (snap: boolean) => {
    const s = stage.current, m = model.current;
    if (!s || !m) return;
    const z = m.size();
    // نصف القطر من نقطة الهدف (أسفل المنتصف) إلى أبعد زاوية علوية
    const r = Math.hypot(z.h * 0.64, z.w / 2);
    // الزاوية الأضيق من العمودية والأفقية (الشاشة الطولية في الجوال أضيق أفقياً)
    const half = (s.camera.fov * Math.PI) / 360;
    const fit = Math.min(half, Math.atan(Math.tan(half) * s.camera.aspect));
    const dist = (r / Math.sin(fit)) * 1.12;
    const w = want.current;
    // الهدف تحت المنتصف قليلاً: يرتفع المجسم في الإطار فوق أزرار التحكم السفلية
    w.target.set(z.cx, z.h * 0.36, z.cz);
    w.dist = dist;
    s.controls.minDistance = dist * 0.35;
    s.controls.maxDistance = dist * 3;
    s.camera.near = dist / 60;
    s.camera.far = dist * 30;
    s.camera.updateProjectionMatrix();
    if (snap) {
      s.controls.target.copy(w.target);
      s.camera.position.copy(w.target).add(VIEW_DIR.clone().multiplyScalar(dist));
      s.controls.update();
      w.active = false;
      s.invalidate();
    } else w.active = true;
  };

  // ── إعادة البناء عند تغيّر التصميم (تأخير قصير أثناء الكتابة)
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const first = !model.current;
    const timer = window.setTimeout(async () => {
      const s = stage.current;
      if (!s) return;
      setBusy(true);
      const spec = buildSpec(design);
      const flat = flatten(spec);
      const sheet = await renderSheet(design, flat, 5, logoUrl);
      if (cancelled || !stage.current) return;
      const prevStyle = model.current ? s.product.children[0]?.userData.style : null;
      model.current?.dispose();
      disposeGroup(s.product);
      const m = buildBoxModel(design, spec, flat, sheet);
      m.group.userData.style = design.style;
      s.product.add(m.group);
      model.current = m;
      m.setPose(pose.current.fold, pose.current.open);
      // نوع جديد أو أول تحميل: تأطير فوري؛ تعديل النص/اللون: تبقى الزاوية كما هي
      aim(first || prevStyle !== design.style);
      s.invalidate();
      setBusy(false);
      const api: ViewerApi = {
        snapshot: (maxWidth = 1600, type = "image/png") => {
          s.renderer.render(s.scene, s.camera);
          const src = s.renderer.domElement;
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
          const result = await new GLTFExporter().parseAsync(s.product, { binary: true });
          return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        },
        resetView: () => aim(true),
      };
      raf = requestAnimationFrame(() => readyRef.current?.(api));
    }, first ? 0 : 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
     
  }, [design, logoUrl]);

  // ── الطي والفتح: تدوير المفاصل فقط (بلا إعادة بناء)
  useEffect(() => {
    const m = model.current;
    if (!m) return;
    m.setPose(fold, open);
    aim(false);
    stage.current?.invalidate();
     
  }, [fold, open]);

  return (
    <div className={`overflow-hidden touch-none ${className || "relative"}`} aria-label={ariaLabel} role="img" aria-busy={busy}>
      <div ref={host} className="absolute inset-0" />
    </div>
  );
}
