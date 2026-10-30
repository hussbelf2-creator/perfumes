import type { ReactNode } from "react";
import { STATUS, type StatusLevel } from "./theme";
import { useI18n } from "@/i18n/context";

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-paper-600">
      {items.map((i) => (
        <li key={i.name} className="inline-flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="17" y2="4" stroke={i.color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={i.dashed ? "3 3" : undefined} />
          </svg>
          {i.name}
        </li>
      ))}
    </ul>
  );
}

export function StatusBadge({ level, label }: { level: StatusLevel; label: string }) {
  const s = STATUS[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${s.soft}`}>
      <i className={s.icon} aria-hidden="true"></i>
      {label}
    </span>
  );
}

export function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // يبقى داخل حدود الرسم
  const w = 200;
  const left = Math.min(Math.max(x - w / 2, 0), width - w);
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-[200px] rounded-[6px] border border-paper-200 bg-white/95 backdrop-blur px-3 py-2.5 text-xs text-paper-700 shadow-lg"
      style={{ left, top: Math.max(y - 12, 0), transform: "translateY(-100%)" }}
    >
      {children}
    </div>
  );
}

export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  const { t } = useI18n();
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-xs text-paper-500 hover:text-ink-900 select-none list-none inline-flex items-center gap-1">
        <i className="ri-table-line" aria-hidden="true"></i>
        {t("عرض البيانات كجدول", "View as table")}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-paper-200 text-paper-500">
              {head.map((h) => (
                <th key={h} scope="col" className="py-2 px-2 text-start font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-paper-100">
                {r.map((c, j) => (
                  <td key={j} className="py-2 px-2 text-paper-700 whitespace-nowrap font-mono">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
