import type { ProfilePoint } from "./types";

// استخراج المقطع الجانبي (Silhouette) من صورة أمامية للعبوة أو الغطاء.
// الفكرة: لكل صف نجد أقصى يمين وأقصى يسار الجسم، فيكون نصف العرض هو نصف القطر عند ذلك الارتفاع.
// دوال نقية بلا DOM — قابلة للاختبار خارج المتصفح.

export interface PixelData {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface ExtractOptions {
  /** حساسية فصل الخلفية (مسافة لونية 0–255) */
  threshold: number;
  /** قص من الأعلى والأسفل (نسبة 0–0.45) — لإزالة الغطاء أو الظل */
  cropTop: number;
  cropBottom: number;
  /** نافذة التنعيم بالصفوف */
  smoothing: number;
  /** الارتفاع الحقيقي بالمليمتر — يحدد المقياس */
  heightMm: number;
  /** عدد نقاط المقطع الناتج */
  samples?: number;
  /** يمنع ظل القاعدة من أن يصبح "صحناً" تحت العبوة (افتراضي: مفعّل) */
  suppressBaseShadow?: boolean;
}

export interface Extraction {
  profile: ProfilePoint[];
  /** للعرض فوق الصورة: حدود كل صف مكتشف */
  rows: { y: number; left: number; right: number }[];
  axisX: number;
  top: number;
  bottom: number;
  mode: "alpha" | "color";
  /** نسبة عدم التناظر بين النصفين — مؤشر جودة الصورة (0 ممتاز) */
  asymmetry: number;
  /** عدد صفوف القاعدة التي قُصّ فيها ظل */
  shadowRows: number;
}

export const DEFAULT_EXTRACT: ExtractOptions = { threshold: 42, cropTop: 0, cropBottom: 0, smoothing: 5, heightMm: 100, samples: 72 };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** لون الخلفية: وسيط بكسلات الإطار */
function borderColor(px: PixelData, y0: number, y1: number): [number, number, number] {
  const { data, width } = px;
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let x = 0; x < width; x += 2) {
    push(x, y0);
    push(x, y1);
  }
  for (let y = y0; y <= y1; y += 2) {
    push(0, y);
    push(1, y);
    push(width - 1, y);
    push(width - 2, y);
  }
  return [median(rs), median(gs), median(bs)];
}

export function extractProfile(px: PixelData, opts: ExtractOptions): Extraction | null {
  const { data, width, height } = px;
  const y0 = Math.floor(height * Math.min(0.45, Math.max(0, opts.cropTop)));
  const y1 = Math.ceil(height * (1 - Math.min(0.45, Math.max(0, opts.cropBottom)))) - 1;
  if (y1 - y0 < 8) return null;

  // صورة شفافة الخلفية (PNG مقصوص) أم خلفية لونية؟
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 16) transparent++;
  const mode: Extraction["mode"] = transparent / (data.length / 28) > 0.15 ? "alpha" : "color";
  const [br, bg, bb] = borderColor(px, y0, y1);
  const thr2 = opts.threshold * opts.threshold;

  const isFg = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (mode === "alpha") return data[i + 3] > 128;
    const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb;
    return dr * dr + dg * dg + db * db > thr2;
  };

  // لكل صف: أطراف الجسم، بشرط ثلاثة بكسلات متتالية (تتجاهل الضوضاء والغبار)
  const RUN = 3;
  const raw: { y: number; left: number; right: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    let left = -1, right = -1, run = 0;
    for (let x = 0; x < width; x++) {
      run = isFg(x, y) ? run + 1 : 0;
      if (run === RUN) {
        left = x - RUN + 1;
        break;
      }
    }
    if (left < 0) continue;
    run = 0;
    for (let x = width - 1; x >= 0; x--) {
      run = isFg(x, y) ? run + 1 : 0;
      if (run === RUN) {
        right = x + RUN - 1;
        break;
      }
    }
    if (right - left >= 2) raw.push({ y, left, right });
  }
  if (raw.length < 8) return null;

  // أطول امتداد عمودي متصل (يتجاهل البقع المنفصلة فوق الجسم أو تحته)
  let best: typeof raw = [], cur: typeof raw = [];
  for (const r of raw) {
    if (cur.length && r.y - cur[cur.length - 1].y > 2) cur = [];
    cur.push(r);
    if (cur.length > best.length) best = cur;
  }
  const rows = best;
  if (rows.length < 8) return null;

  const axisX = median(rows.map((r) => (r.left + r.right) / 2));
  const asymmetry = median(rows.map((r) => Math.abs(axisX - r.left - (r.right - axisX)) / Math.max(1, r.right - r.left)));

  // نصف القطر لكل صف، ثم مرشح وسيط (يزيل القفزات) وتنعيم متحرك
  const radii = rows.map((r) => (r.right - r.left + 1) / 2);

  // ظل القاعدة: العبوات نادراً ما تتسع عند القاعدة أكثر من جسمها.
  // نحد صفوف الـ 10% السفلية بأقصى نصف قطر في الشريط فوقها (10–25%) مع سماح 3%.
  let shadowRows = 0;
  if (opts.suppressBaseShadow !== false && rows.length > 30) {
    const n = rows.length;
    const band = radii.slice(Math.floor(n * 0.75), Math.floor(n * 0.9));
    const cap = Math.max(...band) * 1.03;
    for (let i = Math.floor(n * 0.9); i < n; i++) {
      if (radii[i] > cap) {
        radii[i] = cap;
        rows[i] = { ...rows[i], left: Math.round(rows[i].left + (rows[i].right - rows[i].left + 1) / 2 - cap), right: Math.round(rows[i].left + (rows[i].right - rows[i].left + 1) / 2 + cap) };
        shadowRows++;
      }
    }
  }
  const med = radii.map((_, i) => median(radii.slice(Math.max(0, i - 2), i + 3)));
  const k = Math.max(1, Math.round(opts.smoothing));
  const smooth = med.map((_, i) => {
    const a = Math.max(0, i - k), b = Math.min(med.length, i + k + 1);
    let s = 0;
    for (let j = a; j < b; j++) s += med[j];
    return s / (b - a);
  });

  const top = rows[0].y;
  const bottom = rows[rows.length - 1].y;
  const pxHeight = Math.max(1, bottom - top);
  const scale = opts.heightMm / pxHeight;
  const n = Math.max(12, opts.samples ?? 72);

  // إعادة أخذ العينات بالتساوي من القاعدة للأعلى
  const profile: ProfilePoint[] = [];
  for (let s = 0; s < n; s++) {
    const t = s / (n - 1);
    const idx = Math.round((1 - t) * (smooth.length - 1));
    const r = smooth[idx] * scale;
    const y = (bottom - rows[idx].y) * scale;
    profile.push([round2(r), round2(y)]);
  }
  return { profile: simplify(profile), rows, axisX, top, bottom, mode, asymmetry, shadowRows };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** يحذف النقاط الواقعة على خط مستقيم تقريباً — أخف للتخزين بلا فقد شكل */
export function simplify(p: ProfilePoint[], tol = 0.15): ProfilePoint[] {
  if (p.length < 3) return p;
  const out: ProfilePoint[] = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = out[out.length - 1];
    const [bx, by] = p[i];
    const [cx, cy] = p[i + 1];
    const cross = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    const len = Math.hypot(cx - ax, cy - ay) || 1;
    if (cross / len > tol) out.push(p[i]);
  }
  out.push(p[p.length - 1]);
  return out;
}

/** يعيد قياس المقطع لارتفاع جديد مع الحفاظ على النسب */
export function rescale(p: ProfilePoint[], heightMm: number): ProfilePoint[] {
  const h = Math.max(...p.map((x) => x[1])) || 1;
  const k = heightMm / h;
  return p.map(([r, y]) => [round2(r * k), round2(y * k)]);
}

// ─── الحجم ────────────────────────────────────────────────────────

/** دالة جاما (تقريب Lanczos) — لمساحة المقطع الفائق */
function gamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/** معامل مساحة المقطع الفائق |x/a|^n + |z/b|^n ≤ 1 : المساحة = k·a·b (الدائرة k = π) */
export function sectionAreaFactor(n: number) {
  return (4 * gamma(1 + 1 / n) ** 2) / gamma(1 + 2 / n);
}

/**
 * السعة التقريبية بالمليلتر لجسم العبوة (بدون العنق)، بخصم سماكة الزجاج.
 * مفيد للتأكد أن المقياس صحيح: عبوة 50 مل يجب أن تعطي رقماً قريباً.
 */
export function estimateCapacityMl(p: ProfilePoint[], opts: { squareness: number; depthRatio: number; neckMm: number; wallMm?: number; baseMm?: number }) {
  const wall = opts.wallMm ?? 2.5;
  const base = opts.baseMm ?? 6;
  const h = Math.max(...p.map((x) => x[1]));
  const k = sectionAreaFactor(opts.squareness);
  let vol = 0;
  for (let i = 1; i < p.length; i++) {
    const [r0, y0] = p[i - 1];
    const [r1, y1] = p[i];
    const lo = Math.max(y0, base), hi = Math.min(y1, h - opts.neckMm);
    if (hi <= lo) continue;
    const r = Math.max(0, (r0 + r1) / 2 - wall);
    vol += k * r * (r * opts.depthRatio) * (hi - lo);
  }
  return Math.round(vol / 1000); // mm³ → ml
}
