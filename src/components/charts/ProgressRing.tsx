import { useInView } from "@/hooks/useInView";
import { CHART } from "./theme";

interface ProgressRingProps {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}

// حلقة تقدّم تُرسم عند الظهور؛ الرقم في المنتصف بخط النص لا خط العناوين
export default function ProgressRing({ value, size = 120, stroke = 8, color = "#15101D", label }: ProgressRingProps) {
  const { ref, inView } = useInView<SVGSVGElement>();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = inView ? c * (1 - value) : c;

  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "Progress"}: ${Math.round(value * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART.track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2}) scale(-1 1) translate(${-size} 0)`}
        className="ring-draw"
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24} fontWeight={600} fill="#15101D" fontFamily="IBM Plex Sans Arabic, sans-serif">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}
