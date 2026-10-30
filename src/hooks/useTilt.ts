import { useCallback, useRef } from "react";
import { prefersReducedMotion } from "./useInView";

// ميل ثلاثي الأبعاد خفيف يتبع المؤشر (للبطاقات)، مع بقعة ضوء تتبعه عبر متغيرات CSS.
// لا شيء يحدث على اللمس أو مع تفضيل تقليل الحركة.
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 6) {
  const ref = useRef<T>(null);
  const onMove = useCallback(
    (e: React.MouseEvent<T>) => {
      const el = ref.current;
      if (!el || prefersReducedMotion() || (e.nativeEvent as PointerEvent).pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * maxDeg}deg) rotateY(${(x - 0.5) * maxDeg}deg) translateZ(0)`;
    },
    [maxDeg],
  );
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = "";
  }, []);
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
}

/** بقعة ضوء تتبع المؤشر على قسم كامل (الهيرو) */
export function useSpotlight<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  const onMove = useCallback((e: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  }, []);
  return { ref, onMouseMove: onMove };
}
