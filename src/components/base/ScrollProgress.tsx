import { useEffect, useRef } from "react";

// شريط تقدّم القراءة أعلى الصفحة — يتحرك عبر transform فقط
export default function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={bar} aria-hidden="true" className="fixed top-0 inset-x-0 h-[2px] bg-ink-900 origin-right rtl:origin-right ltr:origin-left z-[60] pointer-events-none" style={{ transform: "scaleX(0)" }} />;
}
