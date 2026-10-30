// لوحة الرسوم البيانية — ثلاث درجات ترابية متحقق منها (سلامة عمى الألوان، التباين، التمييز)
// عبر validate_palette.js: "#3B6FB6,#C2612F,#2A9D8F" --pairs all → ALL CHECKS PASS
export const SERIES = ["#3B6FB6", "#C2612F", "#2A9D8F"] as const;

export const CHART = {
  surface: "#FFFFFF",
  grid: "#EAEAEA",
  axis: "#787774",
  text: "#2F3437",
  muted: "#9A968E",
  track: "#F1EFEA",
  planned: "#D9D6CF",
};

// ألوان الحالة محجوزة — تُرفق دائماً بأيقونة ونص
export const STATUS = {
  good: { color: "#0ca30c", icon: "ri-checkbox-circle-fill", soft: "bg-[#EDF3EC] text-[#346538]" },
  warning: { color: "#fab219", icon: "ri-error-warning-fill", soft: "bg-[#FBF3DB] text-[#956400]" },
  serious: { color: "#ec835a", icon: "ri-alarm-warning-fill", soft: "bg-[#FCEEE7] text-[#9A4A25]" },
  critical: { color: "#d03b3b", icon: "ri-close-circle-fill", soft: "bg-[#FDEBEC] text-[#9F2F2D]" },
} as const;

export type StatusLevel = keyof typeof STATUS;

export const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return `${Math.round(n)}`;
};

export function niceMax(v: number, steps = 4) {
  if (v <= 0) return 1;
  const raw = v / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return step * steps;
}
