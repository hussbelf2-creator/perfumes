import type { ReactNode } from "react";
import Reveal from "@/components/base/Reveal";

export function Panel({ title, kicker, action, children, className = "", index = 0 }: { title: string; kicker?: string; action?: ReactNode; children: ReactNode; className?: string; index?: number }) {
  return (
    <Reveal index={index} className={`min-w-0 bg-white border border-paper-200 rounded-2xl p-5 md:p-7 ${className}`}>
      <section aria-label={title}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            {kicker && <p className="text-xs text-paper-500 mb-1.5">{kicker}</p>}
            <h2 className="font-display text-lg md:text-xl text-ink-900">{title}</h2>
          </div>
          {action}
        </div>
        {children}
      </section>
    </Reveal>
  );
}

export function Kpi({ label, value, sub, children, index = 0 }: { label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode; index?: number }) {
  return (
    <Reveal index={index} className="min-w-0 bg-white border border-paper-200 rounded-2xl p-5 lift">
      <p className="text-xs text-paper-500">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink-900">{value}</p>
      {sub && <div className="mt-2 text-xs text-paper-600">{sub}</div>}
      {children}
    </Reveal>
  );
}

export function PageTitle({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div>
        <p className="text-sm text-paper-500 mb-3 fade-up">{kicker}</p>
        <h1 className="font-display text-3xl md:text-4xl text-ink-900 leading-[1.3]">
          <span className="line-mask">
            <span>{title}</span>
          </span>
        </h1>
      </div>
      {children && <div className="flex flex-wrap gap-3 fade-up" style={{ ["--d" as string]: 2 }}>{children}</div>}
    </header>
  );
}
