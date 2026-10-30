import { useState } from "react";
import { useSize } from "./useSize";
import { useInView } from "@/hooks/useInView";
import { CHART, niceMax, compact } from "./theme";
import { Tooltip } from "./parts";
import { useI18n } from "@/i18n/context";

export interface LineSeries {
  key: string;
  name: string;
  color: string;
  dashed?: boolean;
  area?: boolean;
}

interface LineChartProps<Row> {
  data: Row[];
  x: (row: Row) => number;
  xLabel: (row: Row) => string;
  series: LineSeries[];
  value: (row: Row, key: string) => number | null;
  format?: (n: number) => string;
  height?: number;
  yMax?: number;
  yMin?: number;
  /** عدد أقسام المحور الرأسي */
  yDivisions?: number;
  marker?: { at: number; label: string };
  ariaLabel: string;
}

const M = { top: 20, bottom: 30, axis: 52, edge: 12 };

/** رسم خطي متعدد السلاسل، باتجاه من اليمين لليسار، مع خط تتبّع وتلميح */
export default function LineChart<Row>({
  data,
  x,
  xLabel,
  series,
  value,
  format = (n) => compact(n),
  height = 280,
  yMax,
  yMin = 0,
  yDivisions = 4,
  marker,
  ariaLabel,
}: LineChartProps<Row>) {
  const { ref, width } = useSize();
  const { ref: viewRef, inView } = useInView<SVGSVGElement>();
  const [hover, setHover] = useState<number | null>(null);

  const xs = data.map(x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const allValues = data.flatMap((r) => series.map((s) => value(r, s.key))).filter((v): v is number => v !== null);
  const top = yMax ?? niceMax(Math.max(...allValues));
  const { dir } = useI18n();
  const rtl = dir === "rtl";
  // محور القيم على جهة البداية: يمين في العربية، يسار في الإنجليزية
  const L = rtl ? M.edge : M.axis;
  const plotW = Math.max(width - M.edge - M.axis, 10);
  const plotH = height - M.top - M.bottom;
  const R = L + plotW;
  const px = (v: number) => (rtl ? R - ((v - x0) / (x1 - x0 || 1)) * plotW : L + ((v - x0) / (x1 - x0 || 1)) * plotW);
  const py = (v: number) => M.top + plotH - ((v - yMin) / (top - yMin || 1)) * plotH;
  const yTicks = Array.from({ length: yDivisions + 1 }, (_, i) => yMin + ((top - yMin) / yDivisions) * i);

  const pathFor = (key: string) => {
    let d = "";
    let pen = false;
    data.forEach((r, i) => {
      const v = value(r, key);
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${px(xs[i]).toFixed(1)},${py(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const areaFor = (key: string) => {
    const pts = data.map((r, i) => ({ v: value(r, key), x: px(xs[i]) })).filter((p) => p.v !== null) as { v: number; x: number }[];
    if (pts.length < 2) return "";
    return `M${pts[0].x},${py(yMin)} ${pts.map((p) => `L${p.x},${py(p.v)}`).join(" ")} L${pts[pts.length - 1].x},${py(yMin)} Z`;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    xs.forEach((v, i) => {
      const d = Math.abs(px(v) - mx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg ref={viewRef} width={width} height={height} role="img" aria-label={ariaLabel} className={inView ? "is-in" : ""}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={R} y1={py(t)} y2={py(t)} stroke={CHART.grid} strokeWidth={1} />
            <text x={rtl ? R + 8 : L - 8} y={py(t)} dominantBaseline="middle" textAnchor={rtl ? "start" : "end"} fontSize="11" fill={CHART.axis} fontFamily="IBM Plex Mono, monospace">
              {format(t)}
            </text>
          </g>
        ))}
        {(() => {
          // نختار التسميات بالمسافة الفعلية حتى لا تتداخل
          const minGap = 72;
          const shown: number[] = [];
          data.forEach((_, i) => {
            const pos = px(xs[i]);
            if (shown.every((j) => Math.abs(px(xs[j]) - pos) >= minGap)) shown.push(i);
          });
          return shown.map((i) => (
            <text key={i} x={px(xs[i])} y={height - 8} textAnchor="middle" fontSize="11" fill={CHART.axis}>
              {xLabel(data[i])}
            </text>
          ));
        })()}

        {marker && (
          <g>
            <line x1={px(marker.at)} x2={px(marker.at)} y1={M.top - 6} y2={M.top + plotH} stroke={CHART.text} strokeWidth={1} />
            <text x={px(marker.at)} y={M.top - 9} textAnchor="middle" fontSize="11" fill={CHART.text}>
              {marker.label}
            </text>
          </g>
        )}

        {series.map((s) =>
          s.area ? <path key={`a-${s.key}`} d={areaFor(s.key)} fill={s.color} opacity={0.08} /> : null,
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={pathFor(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dashed ? "4 4" : undefined}
            pathLength={s.dashed ? undefined : 1}
            className={s.dashed ? "" : "line-draw"}
            style={s.dashed ? undefined : ({ "--len": 1 } as React.CSSProperties)}
          />
        ))}

        {/* نقاط نهاية السلاسل */}
        {series.map((s) => {
          let last = -1;
          data.forEach((r, i) => {
            if (value(r, s.key) !== null) last = i;
          });
          if (last < 0) return null;
          return <circle key={`e-${s.key}`} cx={px(xs[last])} cy={py(value(data[last], s.key) as number)} r={4} fill={s.color} stroke={CHART.surface} strokeWidth={2} />;
        })}

        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={px(xs[hover])} x2={px(xs[hover])} y1={M.top} y2={M.top + plotH} stroke={CHART.axis} strokeWidth={1} />
            {series.map((s) => {
              const v = value(h, s.key);
              return v === null ? null : <circle key={s.key} cx={px(xs[hover])} cy={py(v)} r={5} fill={s.color} stroke={CHART.surface} strokeWidth={2} />;
            })}
          </g>
        )}

        <rect
          x={L}
          y={M.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {h && hover !== null && (
        <Tooltip x={px(xs[hover])} y={M.top + 8} width={width}>
          <div className="mb-1.5 text-ink-900">{xLabel(h)}</div>
          {series.map((s) => {
            const v = value(h, s.key);
            return (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-mono text-ink-900">{v === null ? "—" : format(v)}</span>
              </div>
            );
          })}
        </Tooltip>
      )}
    </div>
  );
}
