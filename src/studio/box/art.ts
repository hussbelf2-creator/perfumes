import { FONTS, ensureFonts } from "../label/fonts";
import { FOILS, hasArabic } from "../label/types";
import type { Flat, FlatPanel } from "./dielines";
import { FINISHES, boardColor, type BoxDesign } from "./types";

// ورقة الطباعة: لوحة واحدة بحجم المخطط المسطّح + هامش القص. هي نفسها ملف الطباعة
// وهي نفسها خامة المجسم ثلاثي الأبعاد — فما يراه العميل مطويّاً هو ما سيُطبع حرفياً.
//   color: الألوان     pbr: الأخضر = الخشونة، الأزرق = المعدنية (الفويل)

export const BLEED = 3;

export interface Sheet {
  color: HTMLCanvasElement;
  pbr: HTMLCanvasElement;
  /** أبعاد الورقة بالمليمتر شاملة الهامش */
  wMm: number;
  hMm: number;
  pxPerMm: number;
}

/** لون الكرتون الخام (مناطق اللصق تبقى بلا حبر) */
export const rawBoard = (d: BoxDesign) => (d.board === "kraft" ? "#b98f62" : "#efede6");

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export const inkFor = (bg: string) => (luminance(bg) > 0.35 ? "#1d1b19" : "#f3efe6");

const PBR_FOIL = "rgb(255,60,255)";
const pbrPaper = (d: BoxDesign) => `rgb(255,${Math.round((FINISHES.find((f) => f.id === d.finish)?.roughness ?? 0.8) * 255)},0)`;

async function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

interface Ctxs {
  g: CanvasRenderingContext2D;
  p: CanvasRenderingContext2D;
  k: number;
  d: BoxDesign;
  ink: string;
  foil: string | null;
  logo: HTMLImageElement | null;
}

/** نص في سطر واحد، يُصغَّر ليتسع للعرض المتاح */
function line(c: Ctxs, text: string, x: number, y: number, sizeMm: number, maxWmm: number, opts: { weight?: 400 | 700; foil?: boolean; alpha?: number; tracking?: number }) {
  if (!text.trim()) return;
  const rtl = hasArabic(text);
  let px = sizeMm * c.k;
  const set = (ctx: CanvasRenderingContext2D) => {
    ctx.font = `${opts.weight ?? 400} ${px}px "${FONTS[c.d.font].family}", "IBM Plex Sans Arabic", sans-serif`;
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = rtl ? "0px" : `${(opts.tracking ?? 0) * px}px`;
  };
  set(c.g);
  const w = c.g.measureText(text).width;
  if (w > maxWmm * c.k) {
    px = (px * maxWmm * c.k) / w;
    set(c.g);
  }
  const foil = opts.foil && c.foil;
  c.g.globalAlpha = opts.alpha ?? 1;
  c.g.fillStyle = foil ? c.foil! : c.ink;
  c.g.fillText(text, x, y);
  c.g.globalAlpha = 1;
  if (foil) {
    set(c.p);
    c.p.fillStyle = PBR_FOIL;
    c.p.fillText(text, x, y);
  }
}

function drawLogo(c: Ctxs, cx: number, cy: number, wMm: number) {
  if (!c.logo) return 0;
  const lw = wMm * c.k;
  const lh = (c.logo.naturalHeight / c.logo.naturalWidth) * lw;
  const x = cx - lw / 2, y = cy - lh / 2;
  if (!c.foil) {
    c.g.drawImage(c.logo, x, y, lw, lh);
    return lh / c.k;
  }
  // الشعار بالفويل: شكله فقط (قناة الشفافية) بلون الفويل
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(lw));
  tmp.height = Math.max(1, Math.round(lh));
  const tg = tmp.getContext("2d")!;
  tg.drawImage(c.logo, 0, 0, tmp.width, tmp.height);
  tg.globalCompositeOperation = "source-in";
  tg.fillStyle = c.foil;
  tg.fillRect(0, 0, tmp.width, tmp.height);
  c.g.drawImage(tmp, x, y);
  tg.fillStyle = PBR_FOIL;
  tg.fillRect(0, 0, tmp.width, tmp.height);
  c.p.drawImage(tmp, x, y);
  return lh / c.k;
}

function frame(c: Ctxs, w: number, h: number, inset: number) {
  if (!c.d.frame || w < 2 * inset + 8 || h < 2 * inset + 8) return;
  for (const [ctx, style] of [[c.g, c.foil ?? c.ink], [c.p, c.foil ? PBR_FOIL : null]] as const) {
    if (!style) continue;
    ctx.lineWidth = Math.max(1, 0.35 * c.k);
    ctx.strokeStyle = style;
    ctx.strokeRect((-w / 2 + inset) * c.k, (-h / 2 + inset) * c.k, (w - 2 * inset) * c.k, (h - 2 * inset) * c.k);
  }
}

/** محتوى الوجه في إطار متمركز (0,0) بعرض w وارتفاع h (مم) — بعد تدويره ليُقرأ معتدلاً */
function compose(c: Ctxs, fp: FlatPanel, w: number, h: number) {
  const k = c.k;
  const face = fp.face!;
  const big = Math.min(w, h);
  // واجهة رئيسية: شعار + اسم الدار + اسم العطر
  if ((face === "front" || face === "top") && !fp.band && h >= 40 && w >= 30) {
    // الإطار للألواح المستطيلة فقط (لا يناسب القرص)
    if (fp.poly.length === 4) frame(c, w, h, Math.min(5, big * 0.08));
    // الحجم من البُعدين: واجهة طولية يحدّها العرض، وأفقية يحدّها الارتفاع
    const brandMm = Math.min(w * 0.13, h * 0.16, 11);
    const nameMm = brandMm * 0.62;
    const logoW = c.logo ? Math.min(w * 0.42, h * 0.3, 34) : 0;
    let y = -h * 0.12;
    if (c.logo) {
      const lh = drawLogo(c, 0, (-h * 0.2) * k, logoW);
      y = -h * 0.2 + lh / 2 + brandMm * 1.1;
    }
    line(c, c.d.brand, 0, y * k, brandMm, w * 0.78, { weight: 700, foil: true, tracking: 0.16 });
    line(c, c.d.name, 0, (y + brandMm * 1.25) * k, nameMm, w * 0.78, {});
    if (h >= 90) line(c, c.d.details, 0, (h / 2 - Math.max(9, h * 0.1)) * k, Math.min(3.2, brandMm * 0.4), w * 0.8, { alpha: 0.75 });
    return;
  }
  if (face === "back" || face === "bottom") {
    line(c, c.d.brand, 0, (-h * 0.12) * k, Math.min(h * 0.07, w * 0.1, 7), w * 0.7, { weight: 700, foil: true, tracking: 0.12 });
    line(c, c.d.details, 0, (h * 0.02) * k, Math.min(3.2, h * 0.05), w * 0.8, { alpha: 0.8 });
    return;
  }
  // جانب أو شريط ضيق: اسم الدار على سطر واحد (عمودي إن كان اللوح طويلاً)
  if (h > w * 1.6) {
    c.g.save();
    c.p.save();
    c.g.rotate(-Math.PI / 2);
    c.p.rotate(-Math.PI / 2);
    line(c, c.d.brand, 0, 0, Math.min(w * 0.14, 4.5), h * 0.6, { weight: 700, foil: true, tracking: 0.2 });
    c.g.restore();
    c.p.restore();
    return;
  }
  line(c, c.d.brand, 0, 0, Math.min(h * 0.26, w * 0.07, 6), w * 0.7, { weight: 700, foil: true, tracking: 0.2 });
}

function polyPath(ctx: CanvasRenderingContext2D, pts: [number, number][], map: (p: [number, number]) => [number, number]) {
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const [x, y] = map(pt);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
}

export async function renderSheet(d: BoxDesign, flat: Flat, pxPerMm: number, logoUrl: string | null): Promise<Sheet> {
  await ensureFonts([d.font], `${d.brand} ${d.name} ${d.details} عطر`);
  const { minX, minY, maxX, maxY } = flat.bounds;
  const wMm = maxX - minX + 2 * BLEED, hMm = maxY - minY + 2 * BLEED;
  // حد أعلى لحجم اللوحة (ذاكرة الهاتف)
  const k = Math.min(pxPerMm, 7000 / Math.max(wMm, hMm));
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(wMm * k));
    c.height = Math.max(1, Math.round(hMm * k));
    return c;
  };
  const color = mk(), pbr = mk();
  const g = color.getContext("2d")!, p = pbr.getContext("2d")!;
  const map = ([x, y]: [number, number]): [number, number] => [(x - minX + BLEED) * k, (maxY - y + BLEED) * k];

  // ما خارج الألواح: كرتون خام (لن يظهر — يُقص)
  g.fillStyle = rawBoard(d);
  g.fillRect(0, 0, color.width, color.height);
  p.fillStyle = "rgb(255,235,0)";
  p.fillRect(0, 0, pbr.width, pbr.height);

  const bg = boardColor(d);
  const ink = inkFor(bg);
  const printed = flat.panels.filter((fp) => fp.kind !== "glue");
  // الخلفية + هامش القص: نملأ كل لوح ونرسم حوله خطاً بعرض الهامش بنفس اللون
  for (const [ctx, style] of [[g, bg], [p, pbrPaper(d)]] as const) {
    ctx.fillStyle = style;
    ctx.strokeStyle = style;
    ctx.lineWidth = 2 * BLEED * k;
    ctx.lineJoin = "round";
    for (const fp of printed) {
      polyPath(ctx, fp.poly, map);
      ctx.fill();
      ctx.stroke();
    }
  }
  // مناطق اللصق بلا حبر ولا ورنيش، وإلا لا يمسك الغراء
  for (const fp of flat.panels.filter((x) => x.kind === "glue")) {
    for (const [ctx, style] of [[g, rawBoard(d)], [p, "rgb(255,235,0)"]] as const) {
      ctx.fillStyle = style;
      polyPath(ctx, fp.poly, map);
      ctx.fill();
    }
  }

  let logo: HTMLImageElement | null = null;
  if (d.useLogo && logoUrl) {
    try {
      logo = await loadImage(logoUrl);
    } catch {
      logo = null;
    }
  }
  const c: Ctxs = { g, p, k, d, ink, foil: d.foil === "none" ? null : FOILS[d.foil].color, logo };
  for (const fp of printed) {
    if (!fp.face) continue;
    const [cx, cy] = map([fp.x + fp.w / 2, fp.y + fp.h / 2]);
    const rad = (fp.rot * Math.PI) / 180;
    const swap = fp.rot === 90 || fp.rot === 270;
    const w = swap ? fp.h : Math.min(fp.w, fp.contentW ?? fp.w);
    const h = swap ? fp.w : fp.h;
    for (const ctx of [g, p]) {
      ctx.save();
      polyPath(ctx, fp.poly, map);
      ctx.clip();
      ctx.translate(cx, cy);
      // المحور الصادي في اللوحة للأسفل، لذا يُعكس اتجاه الدوران
      ctx.rotate(-rad);
    }
    compose(c, fp, w, h);
    g.restore();
    p.restore();
  }
  return { color, pbr, wMm, hMm, pxPerMm: k };
}
