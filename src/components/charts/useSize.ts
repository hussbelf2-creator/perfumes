import { useEffect, useRef, useState } from "react";

// عرض الحاوية الفعلي لرسم SVG متجاوب
export function useSize<T extends HTMLElement = HTMLDivElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);

  return { ref, width };
}
