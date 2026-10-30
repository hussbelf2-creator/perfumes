import type { ReactNode } from "react";

interface PageHeaderProps {
  label: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  /** شريط ثابت فوق الترويسة (لوحة العمل): نكتفي بمسافة صغيرة بدل مسافة شريط التنقل */
  compact?: boolean;
}

// ترويسة موحّدة للصفحات الداخلية
export default function PageHeader({ label, title, intro, children, aside, compact }: PageHeaderProps) {
  return (
    <header className={`${compact ? "pt-10 md:pt-14" : "pt-32 md:pt-40"} pb-14 md:pb-20`}>
      <div className={`max-w-7xl mx-auto px-5 md:px-8 ${aside ? "grid lg:grid-cols-12 gap-10 items-end" : ""}`}>
        <div className={aside ? "lg:col-span-7" : ""}>
          <p className="inline-flex items-center gap-2 text-sm text-paper-500 mb-6 fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {label}
          </p>
          <h1 className="font-display text-ink-900 text-[2.5rem] leading-[1.15] sm:text-5xl md:text-6xl xl:text-7xl tracking-tight max-w-4xl">
            <span className="line-mask"><span>{title}</span></span>
          </h1>
          {intro && <p className="mt-6 max-w-2xl text-lg leading-[1.8] text-paper-600 fade-up" style={{ ["--d" as string]: 2 }}>{intro}</p>}
          {children && <div className="mt-10 fade-up" style={{ ["--d" as string]: 3 }}>{children}</div>}
        </div>
        {aside && <div className="lg:col-span-5 fade-up" style={{ ["--d" as string]: 3 }}>{aside}</div>}
      </div>
    </header>
  );
}
