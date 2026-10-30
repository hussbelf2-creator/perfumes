import { useEffect, useRef, useState, type ElementType, type ReactNode, type CSSProperties } from "react";

interface RevealProps {
  as?: ElementType;
  index?: number;
  className?: string;
  children: ReactNode;
}

/**
 * يُظهر المحتوى بهدوء حين يدخل مجال الرؤية.
 * المحتوى ظاهر افتراضياً؛ لا يُخفى إلا ما هو أسفل الشاشة فعلاً، مع مهلة أمان
 * حتى لا يبقى أي قسم مخفياً إن لم يعمل المراقب (طباعة، زواحف، متصفحات قديمة).
 */
export default function Reveal({ as: Tag = "div", index = 0, className = "", children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    const failsafe = window.setTimeout(() => setState("shown"), 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const cls = state === "idle" ? "" : `reveal ${state === "shown" ? "is-visible" : ""}`;

  return (
    <Tag ref={ref} className={`${cls} ${className}`} style={{ "--i": index } as CSSProperties}>
      {children}
    </Tag>
  );
}
