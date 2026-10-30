import { useEffect, useState } from "react";
import { useInView, prefersReducedMotion } from "@/hooks/useInView";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

// عدّاد يتصاعد حين يظهر في الشاشة
export default function CountUp({ value, duration = 1400, decimals = 0, prefix = "", suffix = "", className = "" }: CountUpProps) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted = shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={className} aria-label={`${prefix}${value.toLocaleString("en-US")}${suffix}`}>
      <span aria-hidden="true">{prefix}{formatted}{suffix}</span>
    </span>
  );
}
