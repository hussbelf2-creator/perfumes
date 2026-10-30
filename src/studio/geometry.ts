import { BufferGeometry, Float32BufferAttribute } from "three";
import type { ProfilePoint } from "./types";

// يبني مجسماً من المقطع الجانبي بتدوير مقطع عرضي "فائق الإهليلج" على طول الارتفاع:
//   أُس 2 = دائري، وكلما زاد اقترب من مربع بزوايا ناعمة؛ ونسبة العمق تجعله بيضاوياً أو مسطحاً.
// إحداثيات UV مهيأة للمرحلة التالية (لف الملصق على الجسم).

export interface LoftOptions {
  squareness: number;
  depthRatio: number;
  segments?: number;
  /** يُنقص نصف القطر (لسائل داخل الزجاج) */
  inset?: number;
  /** يقص المجسم بين ارتفاعين (للسائل) */
  fromY?: number;
  toY?: number;
}

/** نقطة على محيط المقطع الفائق عند الزاوية t */
export function sectionPoint(t: number, a: number, b: number, n: number): [number, number] {
  const c = Math.cos(t), s = Math.sin(t);
  const e = 2 / n;
  return [a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(s) * Math.abs(s) ** e];
}

/** يقص المقطع بين ارتفاعين مع استيفاء خطي عند الحدود */
function clip(p: ProfilePoint[], from: number, to: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  const rAt = (y: number) => {
    for (let i = 1; i < p.length; i++) {
      const [r0, y0] = p[i - 1], [r1, y1] = p[i];
      if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0 || 1));
    }
    return p[p.length - 1][0];
  };
  out.push([rAt(from), from]);
  for (const pt of p) if (pt[1] > from && pt[1] < to) out.push(pt);
  out.push([rAt(to), to]);
  return out;
}

/**
 * منحنى ناعم يمر بنقاط المقطع: نصف القطر كدالة في الارتفاع باستيفاء تكعيبي رتيب (PCHIP).
 * لا يتجاوز النقاط أبداً — الجدار المستقيم يبقى مستقيماً، والأكتاف والقباب تصبح ناعمة.
 */
export function smoothProfile(p: ProfilePoint[], steps = 8): ProfilePoint[] {
  if (p.length < 3) return p;
  // ارتفاعات متزايدة تماماً (نقطتان على نفس الارتفاع = حافة أفقية: نفصلهما بمقدار ضئيل)
  const xs: number[] = [], ys: number[] = [];
  for (const [r, y] of p) {
    const yy = xs.length && y <= xs[xs.length - 1] ? xs[xs.length - 1] + 1e-4 : y;
    xs.push(yy);
    ys.push(r);
  }
  const n = xs.length;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const delta = h.map((hi, i) => (ys[i + 1] - ys[i]) / hi);
  const m = new Array<number>(n).fill(0);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }
  // طرفا المنحنى: نحد الميل لئلا يتجاوز (شرط Fritsch–Carlson)
  for (const [i, j] of [[0, 0], [n - 1, n - 2]]) if (m[i] * delta[j] <= 0) m[i] = 0;
  const out: ProfilePoint[] = [[ys[0], p[0][1]]];
  for (let i = 0; i < n - 1; i++) {
    const segSteps = Math.abs(delta[i]) < 1e-9 ? 1 : steps; // المستقيم الرأسي لا يحتاج نقاطاً إضافية
    for (let k = 1; k <= segSteps; k++) {
      const t = k / segSteps;
      const t2 = t * t, t3 = t2 * t;
      const r = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
      out.push([Math.max(0, r), xs[i] + t * h[i]]);
    }
  }
  return out;
}

export function buildLoft(profile: ProfilePoint[], opts: LoftOptions): BufferGeometry {
  const M = opts.segments ?? 96;
  const n = Math.max(2, opts.squareness);
  const d = opts.depthRatio;
  let p = smoothProfile([...profile].sort((a, b) => a[1] - b[1]));
  if (opts.fromY !== undefined || opts.toY !== undefined) p = clip(p, opts.fromY ?? p[0][1], opts.toY ?? p[p.length - 1][1]);
  if (opts.inset) p = p.map(([r, y]) => [Math.max(0.2, r - opts.inset!), y]);

  const yMin = p[0][1];
  const yMax = p[p.length - 1][1];
  const h = yMax - yMin || 1;

  // طول القوس على المقطع الجانبي — يجعل الملصق لا يتمطط عند الكتف
  const arc = [0];
  for (let i = 1; i < p.length; i++) arc.push(arc[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const total = arc[arc.length - 1] || h;

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  // الجدار: (M+1) نقطة لكل حلقة (الأخيرة تكرار الأولى لدرز UV)
  for (let i = 0; i < p.length; i++) {
    const [r, y] = p[i];
    for (let j = 0; j <= M; j++) {
      // البداية من الخلف: الدرز خلف العبوة، والواجهة الأمامية عند u = 0.5 (موضع الملصق)
      const t = (j / M) * Math.PI * 2 + Math.PI / 2;
      const [x, z] = sectionPoint(t, r, r * d, n);
      pos.push(x, y, -z);
      uv.push(j / M, arc[i] / total);
    }
  }
  const ring = M + 1;
  for (let i = 0; i < p.length - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * ring + j, b = a + 1, c = a + ring, e = c + 1;
      // ترتيب عكس عقارب الساعة من الخارج — العموديات للخارج
      idx.push(a, b, c, b, e, c);
    }
  }

  // الغطاءان العلوي والسفلي: رؤوس مستقلة لزوايا حادة نظيفة
  const fan = (ri: number, up: boolean) => {
    const [r, y] = p[ri];
    if (r < 0.05) return;
    const center = pos.length / 3;
    pos.push(0, y, 0);
    uv.push(0.5, up ? 1 : 0);
    for (let j = 0; j <= M; j++) {
      const t = (j / M) * Math.PI * 2 + Math.PI / 2;
      const [x, z] = sectionPoint(t, r, r * d, n);
      pos.push(x, y, -z);
      uv.push(0.5 + (x / r) * 0.5, 0.5 + (z / r) * 0.5);
    }
    for (let j = 0; j < M; j++) {
      const a = center + 1 + j;
      if (up) idx.push(center, a, a + 1);
      else idx.push(center, a + 1, a);
    }
  };
  fan(0, false);
  fan(p.length - 1, true);

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // توحيد العموديات عند درز الدوران (j = 0 و j = M نفس النقطة) — بلا خط ظاهر
  const nrm = g.getAttribute("normal");
  for (let i = 0; i < p.length; i++) {
    const a = i * ring, b = a + M;
    for (const k of [0, 1, 2]) {
      const v = (nrm.getComponent(a, k) + nrm.getComponent(b, k)) / 2;
      nrm.setComponent(a, k, v);
      nrm.setComponent(b, k, v);
    }
  }
  g.computeBoundingBox();
  return g;
}

export const profileHeight = (p: ProfilePoint[]) => Math.max(...p.map((x) => x[1]));
export const profileMaxRadius = (p: ProfilePoint[]) => Math.max(...p.map((x) => x[0]));
