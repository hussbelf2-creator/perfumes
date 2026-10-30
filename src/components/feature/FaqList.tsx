import { useState } from "react";
import { useI18n } from "@/i18n/context";
import type { Bi } from "@/i18n/context";

// أكورديون أسئلة بخطوط فاصلة فقط، بلا صناديق
export default function FaqList({ items, idPrefix = "faq", initialOpen = 0 }: { items: { q: Bi; a: Bi }[]; idPrefix?: string; initialOpen?: number | null }) {
  const { pick } = useI18n();
  const [open, setOpen] = useState<number | null>(initialOpen);

  return (
    <div className="border-t border-paper-200">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q.en} className="border-b border-paper-200">
            <h3>
              <button
                type="button"
                id={`${idPrefix}-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`${idPrefix}-a-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-6 py-6 text-start text-ink-900 text-lg"
              >
                {pick(f.q)}
                <span aria-hidden="true" className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center transition-all ${isOpen ? "bg-ink-900 border-ink-900 text-white rotate-45" : "border-paper-300 text-ink-900"}`}>
                  <i className="ri-add-line"></i>
                </span>
              </button>
            </h3>
            <div id={`${idPrefix}-a-${i}`} role="region" aria-labelledby={`${idPrefix}-q-${i}`} hidden={!isOpen} className="pb-7 pe-14 text-paper-600 leading-[1.9] panel-in">
              {pick(f.a)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
