import type { Bi } from "@/i18n/context";
import { THICKNESS, type BoxDesign } from "./types";

// شجرة الألواح: كل لوح مستطيل (أو مضلّع) بإحداثيات محلية بالمليمتر (x يميناً، y أعلى)،
// ومفصلاته تربطه بأبنائه. الشجرة نفسها تُنتج: المخطط المسطّح، خطوط القص والطي، والمجسم المطوي.

export type Pt = [number, number];
export type Edge = "top" | "bottom" | "left" | "right";
export type Face = "front" | "back" | "left" | "right" | "top" | "bottom";

export interface Panel {
  id: string;
  w: number;
  h: number;
  /** حدود اللوح بإحداثياته المحلية؛ الافتراضي مستطيل كامل */
  outline?: Pt[];
  /** الوجه الذي يظهر عليه التصميم بعد الطي (إن وُجد) */
  face?: Face;
  /** دوران محتوى الوجه بالدرجات حتى يُقرأ معتدلاً بعد الطي */
  rot?: 0 | 90 | 180 | 270;
  kind?: "panel" | "glue" | "flap";
  /** شريط مختصر (اسم الدار فقط) بدل التصميم الكامل */
  band?: boolean;
  /** عرض منطقة التصميم إن كانت أضيق من اللوح (الأسطوانة: الواجهة فقط من الورقة الملفوفة) */
  contentW?: number;
  /** إزاحة للداخل (مم) للألسنة التي تُطوى خلف لوح آخر — تمنع تداخل السطحين */
  inset?: number;
  hinges: Hinge[];
}

export interface Hinge {
  edge: Edge;
  /** بداية الابن على طول حافة الأب */
  at: number;
  /** زاوية الطي عند الإغلاق (درجات) */
  fold: number;
  /** ترتيب الطي في الحركة: الجدران أولاً ثم الألسنة */
  stage: number;
  /** مفصل غطاء: زاويته عند الفتح الكامل */
  openTo?: number;
  /** false = حدّ منطقة لصق وليس خط تكسير */
  crease?: boolean;
  child: Panel;
}

/** تموضع القطعة في المشهد (مم وراديان) حسب نسبة الطي والفتح */
export interface Pose {
  pos: [number, number, number];
  rot: [number, number, number];
  order?: "XYZ" | "YXZ";
}

export interface Piece {
  id: string;
  name: Bi;
  root: Panel;
  /** نوع العرض ثلاثي الأبعاد: ألواح تُطوى، أو ورقة تُلف (الأسطوانة)، أو قرص */
  mode: "fold" | "wrap" | "disc";
  pose: (fold: number, open: number) => Pose;
  /** للأسطوانة: القطر والارتفاع */
  wrap?: { d: number; h: number; overlap: number };
}

export interface BoxSpec {
  pieces: Piece[];
  /** المقاس الخارجي بعد التجميع (مم) */
  outer: { w: number; d: number; h: number };
  /** يُحسب في buildSpec */
  stages: number;
  t: number;
}

// ── أدوات الأشكال

/** يحوّل شكلاً معرّفاً بـ (u على طول المفصل، v بعيداً عنه) إلى إحداثيات الابن */
function mapUV(edge: Edge, along: number, depth: number, pts: Pt[]): { w: number; h: number; outline: Pt[] } {
  switch (edge) {
    case "top":
      return { w: along, h: depth, outline: pts.map(([u, v]) => [u, v]) };
    case "bottom":
      return { w: along, h: depth, outline: pts.map(([u, v]) => [u, depth - v]) };
    case "right":
      return { w: depth, h: along, outline: pts.map(([u, v]) => [v, u]) };
    case "left":
      return { w: depth, h: along, outline: pts.map(([u, v]) => [depth - v, u]) };
  }
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

type FlapShape = "rect" | "taper" | "tuck" | "dust";

function shape(kind: FlapShape, A: number, D: number): Pt[] {
  if (kind === "taper") {
    const c = Math.min(D * 0.85, A * 0.22);
    return [[0, 0], [A, 0], [A - c, D], [c, D]];
  }
  if (kind === "tuck") {
    // لسان الإغلاق: زوايا مستديرة حتى ينزلق بسهولة
    const r = Math.min(D * 0.75, A * 0.2, 12);
    return [[0, 0], [A, 0], [A, D - r], ...arc(A - r, D - r, r, 0, Math.PI / 2), ...arc(r, D - r, r, Math.PI / 2, Math.PI)];
  }
  if (kind === "dust") {
    // لسان الغبار: مائل من جهة الغطاء ليُفسح له
    return [[0, 0], [A, 0], [A - 1.5, D * 0.55], [A - A * 0.3, D], [A * 0.06 + 1, D], [0.8, D * 0.35]];
  }
  return [[0, 0], [A, 0], [A, D], [0, D]];
}

function flap(id: string, edge: Edge, along: number, depth: number, kind: FlapShape, extra: Partial<Panel> = {}): Panel {
  const m = mapUV(edge, along, depth, shape(kind, along, depth));
  return { id, ...m, kind: "flap", hinges: [], ...extra };
}

const H = (edge: Edge, child: Panel, fold: number, stage: number, more: Partial<Hinge> = {}): Hinge => ({ edge, at: 0, fold, stage, child, ...more });

// ── الأنواع

function tuckEnd(d: BoxDesign): BoxSpec {
  const t = THICKNESS.tuck;
  const { L, W } = d;
  const Hh = d.H;
  const tuck = Math.min(18, Math.max(10, W * 0.45));
  const dust = Math.min(W * 0.8, L * 0.9, 30);
  const glue = Math.min(14, Math.max(8, Math.min(L, Hh) * 0.25));
  const inset = t + 0.12;
  const sideFlaps = (p: string): Hinge[] => [
    H("top", flap(`${p}-dust-top`, "top", W, dust, "dust", { inset }), 90, 1),
    H("bottom", flap(`${p}-dust-bottom`, "bottom", W, dust, "dust", { inset }), 90, 1),
  ];
  const root: Panel = {
    id: "front",
    w: L,
    h: Hh,
    face: "front",
    hinges: [
      H("right", {
        id: "side-r",
        w: W,
        h: Hh,
        face: "right",
        hinges: [
          ...sideFlaps("side-r"),
          H("right", {
            id: "back",
            w: L,
            h: Hh,
            face: "back",
            hinges: [
              H("top", { id: "lid-top", w: L, h: W, face: "top", rot: 180, kind: "flap", hinges: [H("top", flap("tuck-top", "top", L, tuck, "tuck", { inset }), 90, 3, { openTo: 0 })] }, 90, 2, { openTo: -70 }),
              H("right", {
                id: "side-l",
                w: W,
                h: Hh,
                face: "left",
                hinges: [...sideFlaps("side-l"), H("right", flap("glue", "right", Hh, glue, "taper", { kind: "glue", inset }), 90, 0)],
              }, 90, 0),
            ],
          }, 90, 0),
        ],
      }, 90, 0),
      H("bottom", { id: "lid-bottom", w: L, h: W, face: "bottom", kind: "flap", hinges: [H("bottom", flap("tuck-bottom", "bottom", L, tuck, "tuck", { inset }), 90, 3)] }, 90, 2),
    ],
  };
  // تُطوى ووجهها المطبوع للأسفل على الطاولة ثم تقف العلبة
  const piece: Piece = {
    id: "carton",
    name: { ar: "العلبة", en: "Carton" },
    root,
    mode: "fold",
    pose: (f) => {
      const k = smooth(Math.max(0, (f - 0.82) / 0.18));
      return { pos: [-L / 2, 0, W / 2 * k], rot: [(Math.PI / 2) * (1 - k), 0, 0] };
    },
  };
  return { pieces: [piece], outer: { w: L + 2 * t, d: W + 2 * t, h: Hh + 2 * t }, stages: 0, t };
}

/** صينية: قاعدة وأربعة جدران مع ألسنة الزوايا. root.x = العرض، root.y = العمق */
function tray(id: string, Lx: number, Wy: number, Hz: number, t: number, faces: Partial<Record<"front" | "back" | "left" | "right" | "base", { face: Face; rot?: Panel["rot"] }>> = {}, notch = 0): Panel {
  const tab = Math.min(14, Hz * 0.4, Wy * 0.3);
  const inset = t + 0.15;
  const tabs = (p: string, horizontal: boolean): Hinge[] =>
    horizontal
      ? [H("left", flap(`${p}-tab-l`, "left", Hz, tab, "taper", { kind: "glue", inset }), 90, 1), H("right", flap(`${p}-tab-r`, "right", Hz, tab, "taper", { kind: "glue", inset }), 90, 1)]
      : [];
  const front: Panel = { id: `${id}-front`, w: Lx, h: Hz, ...faces.front, hinges: tabs(`${id}-front`, true) };
  if (notch > 0) {
    // فتحة الإبهام في جدار الدرج الأمامي
    const r = notch;
    front.outline = [[0, 0], [Lx, 0], [Lx, Hz], [Lx / 2 + r, Hz], ...arc(Lx / 2, Hz, r, 0, -Math.PI, 12).slice(1, -1), [Lx / 2 - r, Hz], [0, Hz]];
  }
  return {
    id: `${id}-base`,
    w: Lx,
    h: Wy,
    ...faces.base,
    hinges: [
      H("top", front, 90, 0),
      H("bottom", { id: `${id}-back`, w: Lx, h: Hz, ...faces.back, hinges: tabs(`${id}-back`, true) }, 90, 0),
      H("left", { id: `${id}-left`, w: Hz, h: Wy, ...faces.left, hinges: [] }, 90, 0),
      H("right", { id: `${id}-right`, w: Hz, h: Wy, ...faces.right, hinges: [] }, 90, 0),
    ],
  };
}

// صينية القاعدة (مفتوحة للأعلى): R_x(+90°) — الجدار العلوي في المخطط يصبح الأمامي
const upTray = (Lx: number, Wy: number, y = 0): Pose => ({ pos: [-Lx / 2, y, -Wy / 2], rot: [Math.PI / 2, 0, 0] });

function rigid(d: BoxDesign): BoxSpec {
  const t = THICKNESS.rigid;
  const Lb = d.L + 2 * t, Wb = d.W + 2 * t, Hb = d.H + t;
  const Ll = Lb + 2 * t + 1, Wl = Wb + 2 * t + 1, Hl = Math.round(Math.min(Math.max(d.H * 0.3, 18), 50));
  // القاعدة سادة: الغطاء يغطي معظمها
  const base = tray("base", Lb, Wb, Hb, t);
  // الغطاء مقلوب: الجدار السفلي في المخطط هو الأمامي
  const lid = tray("lid", Ll, Wl, Hl, t, { base: { face: "top" }, back: { face: "front" } });
  return {
    pieces: [
      { id: "base", name: { ar: "القاعدة", en: "Base" }, root: base, mode: "fold", pose: () => upTray(Lb, Wb) },
      {
        id: "lid",
        name: { ar: "الغطاء", en: "Lid" },
        root: lid,
        mode: "fold",
        pose: (f, o) => {
          // يهبط الغطاء بعد اكتمال طي الجدران؛ والفتح يرفعه ويزيحه جانباً
          const drop = smooth(Math.max(0, (f - 0.6) / 0.4));
          const lift = (1 - drop) * (Hb + 30) + o * (Hb * 0.55 + 20);
          return { pos: [-Ll / 2 + o * Lb * 0.62, Hb + t + lift, Wl / 2], rot: [-Math.PI / 2, 0, -o * 0.18], order: "XYZ" };
        },
      },
    ],
    outer: { w: Ll, d: Wl, h: Hb + t },
    stages: 0,
    t,
  };
}

function drawer(d: BoxDesign): BoxSpec {
  const t = THICKNESS.drawer;
  // يستلقي الدرج: الطول = محور الانزلاق، العرض = الواجهة العلوية، الارتفاع = السماكة
  const Lt = d.L + 2 * t, Wt = d.W + 2 * t, Ht = d.H + t;
  const Ls = Lt + 1, Ws = Wt + 2 * t + 1, Hs = Ht + 2 * t + 1;
  const glue = 12;
  const inset = t + 0.12;
  const sleeve: Panel = {
    id: "sleeve-top",
    w: Ws,
    h: Ls,
    face: "top",
    rot: 270,
    hinges: [
      H("right", {
        id: "sleeve-side-r",
        w: Hs,
        h: Ls,
        face: "right",
        rot: 270,
        hinges: [
          H("right", {
            id: "sleeve-bottom",
            w: Ws,
            h: Ls,
            face: "bottom",
            hinges: [H("right", { id: "sleeve-side-l", w: Hs, h: Ls, face: "left", rot: 270, hinges: [H("right", flap("sleeve-glue", "right", Ls, glue, "taper", { kind: "glue", inset }), 90, 0)] }, 90, 0)],
          }, 90, 0),
        ],
      }, 90, 0),
    ],
  };
  const trayPanel = tray("tray", Wt, Lt, Ht, t, {}, Math.min(11, Ht * 0.45, Wt * 0.2));
  // الدرج مسحوب جزئياً أثناء الطي ثم ينزلق للداخل؛ والفتح يُخرجه
  return {
    pieces: [
      {
        id: "sleeve",
        name: { ar: "الغلاف", en: "Sleeve" },
        root: sleeve,
        mode: "fold",
        pose: () => ({ pos: [Ls / 2, Hs, Ws / 2], rot: [-Math.PI / 2, Math.PI / 2, 0], order: "YXZ" }),
      },
      {
        id: "tray",
        name: { ar: "الدرج", en: "Tray" },
        root: trayPanel,
        mode: "fold",
        pose: (f, o) => {
          const out = (1 - smooth(Math.max(0, (f - 0.55) / 0.45))) * (Ls + 15) + o * Lt * 0.62;
          // ينزلق الدرج من جهة فتحة الإبهام (طرف x الموجب)
          return { pos: [-Lt / 2 + out, t + 0.5, Wt / 2], rot: [Math.PI / 2, Math.PI / 2, 0], order: "YXZ" };
        },
      },
    ],
    outer: { w: Ls, d: Ws, h: Hs },
    stages: 0,
    t,
  };
}

function magnetic(d: BoxDesign): BoxSpec {
  const t = THICKNESS.magnetic;
  const Lb = d.L + 2 * t, Wb = d.W + 2 * t, Hb = d.H + t;
  const Lc = Lb + 1, Wc = Wb + 2 * t + 1, Hc = Hb + t;
  const Hf = Math.round(Math.min(Math.max(Hb * 0.45, 20), Hb - 4));
  const base = tray("mbase", Lb, Wb, Hb, t);
  const cover: Panel = {
    id: "cover-back",
    w: Lc,
    h: Hc,
    face: "back",
    hinges: [
      H("top", {
        id: "cover-top",
        w: Lc,
        h: Wc,
        face: "top",
        rot: 180,
        hinges: [H("top", { id: "cover-flap", w: Lc, h: Hf, face: "front", rot: 180, band: true, hinges: [] }, 90, 1, { openTo: 25 })],
      }, 90, 0, { openTo: -20 }),
    ],
  };
  return {
    pieces: [
      { id: "mbase", name: { ar: "القاعدة", en: "Base" }, root: base, mode: "fold", pose: () => upTray(Lb, Wb) },
      {
        id: "cover",
        name: { ar: "الغطاء المتصل", en: "Hinged cover" },
        root: cover,
        mode: "fold",
        // الظهر ملصوق خلف القاعدة؛ دوران 180° يجعل وجهه المطبوع للخلف وطيّه نحو الأمام
        pose: () => ({ pos: [Lc / 2, 0, -Wb / 2 - t - 0.3], rot: [0, Math.PI, 0] }),
      },
    ],
    outer: { w: Lc, d: Wb + t + 0.3, h: Hc },
    stages: 0,
    t,
  };
}

function tube(d: BoxDesign): BoxSpec {
  const t = THICKNESS.tube;
  const D = Math.max(d.L, d.W) + 2 * t;
  const Hb = d.H + t;
  const Dl = D + 2 * t + 0.6;
  const Hl = Math.round(Math.min(Math.max(d.H * 0.35, 25), 60));
  const overlap = 10;
  const wrapPanel = (id: string, dia: number, h: number, face: Face, band = false): Panel => {
    const c = Math.PI * dia;
    return { id, w: c, h, face, band, contentW: dia * 0.95, hinges: [H("right", { id: `${id}-glue`, w: overlap, h, kind: "glue", hinges: [] }, 0, 0, { crease: false })] };
  };
  const disc = (id: string, dia: number, face?: Face): Panel => ({ id, w: dia, h: dia, face, outline: arc(dia / 2, dia / 2, dia / 2, 0, Math.PI * 2, 72).slice(0, -1), hinges: [] });
  const rise = (f: number) => smooth(Math.max(0, (f - 0.75) / 0.25));
  return {
    pieces: [
      { id: "tube-body", name: { ar: "جسم الأسطوانة", en: "Tube body" }, root: wrapPanel("tube-body", D, Hb, "front"), mode: "wrap", wrap: { d: D, h: Hb, overlap }, pose: () => ({ pos: [0, 0, 0], rot: [0, 0, 0] }) },
      {
        id: "tube-lid",
        name: { ar: "الغطاء", en: "Lid" },
        root: wrapPanel("tube-lid", Dl, Hl, "front", true),
        mode: "wrap",
        wrap: { d: Dl, h: Hl, overlap },
        pose: (f, o) => ({ pos: [o * D * 0.9, Hb + t - Hl + (1 - rise(f)) * (Hl + 25) + o * (Hl * 0.9 + 15), 0], rot: [0, 0, -o * 0.25] }),
      },
      { id: "tube-floor", name: { ar: "القاع", en: "Base disc" }, root: disc("tube-floor", D), mode: "disc", pose: () => ({ pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }) },
      {
        id: "tube-cap",
        name: { ar: "سقف الغطاء", en: "Lid disc" },
        root: disc("tube-cap", Dl, "top"),
        mode: "disc",
        pose: (f, o) => ({ pos: [o * D * 0.9, Hb + t + (1 - rise(f)) * (Hl + 25) + o * (Hl * 0.9 + 15), 0], rot: [-Math.PI / 2, -o * 0.25, 0] }),
      },
    ],
    outer: { w: Dl, d: Dl, h: Hb + t },
    stages: 0,
    t,
  };
}

export const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

const BUILDERS: Record<BoxDesign["style"], (d: BoxDesign) => BoxSpec> = { tuck: tuckEnd, rigid, drawer, magnetic, tube };

export function buildSpec(d: BoxDesign): BoxSpec {
  const spec = (BUILDERS[d.style] ?? tuckEnd)(d);
  // عدد المراحل من الشجرة نفسها: أعلى مرحلة + 1 (رقم يدوي ينسى لساناً فلا يُطوى)
  let max = 0;
  const walk = (p: Panel) => p.hinges.forEach((h) => {
    max = Math.max(max, h.stage);
    walk(h.child);
  });
  spec.pieces.forEach((pc) => walk(pc.root));
  return { ...spec, stages: max + 1 };
}

/** زاوية المفصل لنسبة طي f (0 مسطّح – 1 مغلق) وفتح o */
export function hingeAngle(h: Hinge, f: number, o: number, stages: number) {
  const local = smooth(f * stages - h.stage);
  const closed = h.fold * local;
  if (h.openTo === undefined || o <= 0) return closed;
  return closed + (h.openTo - closed) * smooth(o);
}

// ── التسطيح: مواضع الألواح في المخطط

export interface FlatPanel {
  id: string;
  piece: string;
  x: number;
  y: number;
  w: number;
  h: number;
  poly: Pt[];
  face?: Face;
  rot: number;
  kind: "panel" | "glue" | "flap";
  contentW?: number;
  band?: boolean;
}
export interface Seg {
  a: Pt;
  b: Pt;
}
export interface Flat {
  panels: FlatPanel[];
  cuts: Seg[];
  folds: Seg[];
  /** حدود لصق (ليست خطوط طي) */
  glueEdges: Seg[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function childOrigin(parent: Panel, h: Hinge): Pt {
  const c = h.child;
  switch (h.edge) {
    case "right":
      return [parent.w, h.at];
    case "left":
      return [-c.w, h.at];
    case "top":
      return [h.at, parent.h];
    case "bottom":
      return [h.at, -c.h];
  }
}

function hingeSeg(parent: Panel, h: Hinge, ox: number, oy: number): Seg {
  const c = h.child;
  switch (h.edge) {
    case "right":
      return { a: [ox + parent.w, oy + h.at], b: [ox + parent.w, oy + h.at + c.h] };
    case "left":
      return { a: [ox, oy + h.at], b: [ox, oy + h.at + c.h] };
    case "top":
      return { a: [ox + h.at, oy + parent.h], b: [ox + h.at + c.w, oy + parent.h] };
    case "bottom":
      return { a: [ox + h.at, oy], b: [ox + h.at + c.w, oy] };
  }
}

export const outlineOf = (p: Panel): Pt[] => p.outline ?? [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]];

/** يطرح مقاطع الطي من حواف الألواح فيبقى خط القص */
function subtract(seg: Seg, holes: Seg[]): Seg[] {
  const [ax, ay] = seg.a, [bx, by] = seg.b;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return [];
  let spans: [number, number][] = [[0, 1]];
  for (const h of holes) {
    // على الخط نفسه فقط
    const c1 = dx * (h.a[1] - ay) - dy * (h.a[0] - ax);
    const c2 = dx * (h.b[1] - ay) - dy * (h.b[0] - ax);
    if (Math.abs(c1) > 1e-3 * Math.sqrt(len2) || Math.abs(c2) > 1e-3 * Math.sqrt(len2)) continue;
    let t1 = ((h.a[0] - ax) * dx + (h.a[1] - ay) * dy) / len2;
    let t2 = ((h.b[0] - ax) * dx + (h.b[1] - ay) * dy) / len2;
    if (t1 > t2) [t1, t2] = [t2, t1];
    spans = spans.flatMap(([s, e]) => {
      if (t2 <= s + 1e-6 || t1 >= e - 1e-6) return [[s, e] as [number, number]];
      const out: [number, number][] = [];
      if (t1 > s) out.push([s, t1]);
      if (t2 < e) out.push([t2, e]);
      return out;
    });
  }
  return spans.filter(([s, e]) => (e - s) * Math.sqrt(len2) > 0.01).map(([s, e]) => ({ a: [ax + dx * s, ay + dy * s], b: [ax + dx * e, ay + dy * e] }));
}

const key = (s: Seg) => {
  const r = (n: number) => Math.round(n * 100);
  const a = `${r(s.a[0])},${r(s.a[1])}`, b = `${r(s.b[0])},${r(s.b[1])}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
};

export const PIECE_GAP = 14;

export function flatten(spec: BoxSpec): Flat {
  const panels: FlatPanel[] = [];
  const folds: Seg[] = [];
  const glueEdges: Seg[] = [];
  const edges: Seg[] = [];
  let cursor = 0;
  for (const piece of spec.pieces) {
    const local: FlatPanel[] = [];
    const lf: Seg[] = [], lg: Seg[] = [];
    const walk = (p: Panel, ox: number, oy: number) => {
      const poly = outlineOf(p).map(([x, y]) => [ox + x, oy + y] as Pt);
      local.push({ id: p.id, piece: piece.id, x: ox, y: oy, w: p.w, h: p.h, poly, face: p.face, rot: p.rot ?? 0, kind: p.kind ?? "panel", contentW: p.contentW, band: p.band });
      for (const h of p.hinges) {
        (h.crease === false ? lg : lf).push(hingeSeg(p, h, ox, oy));
        const [cx, cy] = childOrigin(p, h);
        walk(h.child, ox + cx, oy + cy);
      }
    };
    walk(piece.root, 0, 0);
    // كل قطعة بجانب سابقتها، بمحاذاة الأسفل
    let minX = Infinity, minY = Infinity, maxX = -Infinity;
    for (const fp of local) for (const [x, y] of fp.poly) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
    }
    const dx = cursor - minX, dy = -minY;
    const mv = ([x, y]: Pt): Pt => [x + dx, y + dy];
    for (const fp of local) {
      fp.x += dx;
      fp.y += dy;
      fp.poly = fp.poly.map(mv);
      panels.push(fp);
      fp.poly.forEach((a, i) => edges.push({ a, b: fp.poly[(i + 1) % fp.poly.length] }));
    }
    lf.forEach((s) => folds.push({ a: mv(s.a), b: mv(s.b) }));
    lg.forEach((s) => glueEdges.push({ a: mv(s.a), b: mv(s.b) }));
    cursor += maxX - minX + PIECE_GAP;
  }
  const holes = [...folds, ...glueEdges];
  const seen = new Set<string>();
  const cuts: Seg[] = [];
  for (const e of edges) {
    for (const s of subtract(e, holes)) {
      const k = key(s);
      if (seen.has(k)) continue;
      seen.add(k);
      cuts.push(s);
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of panels) for (const [x, y] of p.poly) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { panels, cuts, folds, glueEdges, bounds: { minX, minY, maxX, maxY } };
}

export const segLen = (s: Seg) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);

export function polyArea(p: Pt[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
