import { useInView } from "@/hooks/useInView";
import { SERIES, STATUS } from "./theme";
import { useI18n } from "@/i18n/context";

interface BarItem {
  label: string;
  value: number;
  /** سقف مرجعي (الميزانية) يُرسم مساراً خلف العمود */
  target?: number;
}

interface BarListProps {
  items: BarItem[];
  format: (n: number) => string;
  max?: number;
  color?: string;
  ariaLabel: string;
}

/**
 * أعمدة أفقية من اليمين لليسار (HTML لا SVG — أوضح للنص العربي).
 * إن وُجد target يظهر كمسار، ويُعلَّم التجاوز بأيقونة ونص لا بلون فقط.
 */
export default function BarList({ items, format, max, color = SERIES[0], ariaLabel }: BarListProps) {
  const { ref, inView } = useInView<HTMLUListElement>();
  const { t } = useI18n();
  const top = max ?? Math.max(...items.map((i) => Math.max(i.value, i.target ?? 0)));

  return (
    <ul ref={ref} role="list" aria-label={ariaLabel} className={`space-y-4 ${inView ? "is-in" : ""}`}>
      {items.map((it, i) => {
        const over = it.target !== undefined && it.value > it.target;
        const pct = (it.value / top) * 100;
        const targetPct = it.target !== undefined ? (it.target / top) * 100 : undefined;
        return (
          <li key={it.label}>
            <div className="flex justify-between items-baseline gap-3 text-sm mb-1.5">
              <span className="text-paper-700">{it.label}</span>
              <span className="font-mono text-ink-900 text-xs whitespace-nowrap">
                {format(it.value)}
                {it.target !== undefined && <span className="text-paper-500"> / {format(it.target)}</span>}
              </span>
            </div>
            <div className="relative h-3">
              {targetPct !== undefined && <div className="absolute inset-y-0 start-0 rounded-[3px] bg-paper-100" style={{ width: `${targetPct}%` }} />}
              <div
                className="bar-grow absolute inset-y-0 start-0 rounded-e-[4px]"
                style={{ width: `${Math.max(pct, 0.5)}%`, background: color, ["--d" as string]: i }}
              />
              {targetPct !== undefined && <div className="absolute -inset-y-1 w-px bg-ink-900" style={{ insetInlineStart: `${targetPct}%` }} aria-hidden="true" />}
            </div>
            {over && (
              <p className="mt-1 text-xs text-[#9A4A25] inline-flex items-center gap-1">
                <i className={STATUS.serious.icon} aria-hidden="true" style={{ color: STATUS.serious.color }}></i>
                {t("تجاوز الميزانية بـ", "Over budget by")} {format(it.value - (it.target as number))} ({Math.round(((it.value - (it.target as number)) / (it.target as number)) * 100)}%)
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
