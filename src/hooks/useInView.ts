import { useEffect, useRef, useState } from "react";

// يرصد دخول العنصر إلى الشاشة مرة واحدة (للعدادات ورسم الخطوط والرسوم البيانية)
export function useInView<T extends Element = HTMLDivElement>(rootMargin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    const failsafe = window.setTimeout(() => setInView(true), 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [rootMargin]);

  return { ref, inView };
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
