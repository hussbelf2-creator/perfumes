import type { PackModel } from "./types";

// صورة ظلية SVG من المقطع الجانبي — خفيفة وحادة، بلا تحميل three.js
export default function ProfileIcon({ model, cap, className = "", fill = "currentColor" }: { model?: PackModel | null; cap?: PackModel | null; className?: string; fill?: string }) {
  const parts: { m: PackModel; dy: number }[] = [];
  let total = 0;
  if (model) {
    parts.push({ m: model, dy: 0 });
    total = model.heightMm;
  }
  if (cap) {
    const dy = model ? model.heightMm - model.neckMm : 0;
    parts.push({ m: cap, dy });
    total = Math.max(total, dy + cap.heightMm);
  }
  if (!parts.length) return null;
  const w = Math.max(...parts.map((p) => Math.max(...p.m.profile.map((x) => x[0])))) * 2;
  const pad = 2;
  const vbW = w + pad * 2;
  const vbH = total + pad * 2;
  const path = (m: PackModel, dy: number) => {
    const pts = [...m.profile].sort((a, b) => a[1] - b[1]);
    const cx = vbW / 2;
    const Y = (y: number) => vbH - pad - (y + dy);
    const right = pts.map(([r, y]) => `${cx + r},${Y(y)}`);
    const left = [...pts].reverse().map(([r, y]) => `${cx - r},${Y(y)}`);
    return `M${right.join(" L")} L${left.join(" L")} Z`;
  };
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className={className} aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      {parts.map(({ m, dy }, i) => (
        <path key={m.id + i} d={path(m, dy)} fill={fill} opacity={i === 0 && cap ? 0.55 : 1} />
      ))}
    </svg>
  );
}
