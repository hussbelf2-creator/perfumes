import type { ReactNode } from "react";
import Reveal from "@/components/base/Reveal";

interface SectionHeadProps {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  dark?: boolean;
}

// رأس قسم موحّد: وسم صغير بنقطة لونية، عنوان كبير، ومقدمة
export default function SectionHead({ eyebrow, title, intro, action, dark = false }: SectionHeadProps) {
  return (
    <Reveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
      <div className="max-w-3xl">
        <p className={`inline-flex items-center gap-2 text-sm mb-5 ${dark ? "text-white/60" : "text-paper-500"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 className={`font-display text-[2.1rem] leading-[1.2] md:text-5xl md:leading-[1.15] ${dark ? "text-white" : "text-ink-900"}`}>{title}</h2>
        {intro && <p className={`mt-5 text-lg leading-[1.8] max-w-2xl ${dark ? "text-white/65" : "text-paper-600"}`}>{intro}</p>}
      </div>
      {action}
    </Reveal>
  );
}
