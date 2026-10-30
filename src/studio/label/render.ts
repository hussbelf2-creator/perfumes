import { FONTS, ensureFonts } from "./fonts";
import { FOILS, hasArabic, paperColor, type Foil, type LabelDesign, type LabelShape } from "./types";

// يرسم الملصق على لوحتين:
//   color: الألوان كما تُطبع
//   pbr:   خريطة الخامة لـ three.js — الأخضر = الخشونة، الأزرق = المعدنية (الفويل يلمع، الورق مطفأ)
// bleedMm > 0 للطباعة: الخلفية تمتد خارج خط القص.

export interface Rendered {
  color: HTMLCanvasElement;
  pbr: HTMLCanvasElement;
  /** هل الملصق بلا خلفية (طباعة مباشرة على الزجاج)؟ */
  clear: boolean;
}

/** مسار الشكل داخل مستطيل (x, y, w, h) — يُستخدم للرسم وللقص */
export function shapePath(ctx: CanvasRenderingContext2D, shape: LabelShape, x: number, y: number, w: number, h: number, cornerPx: number) {
  ctx.beginPath();
  if (shape === "oval") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === "arch") {
    const r = Math.min(w / 2, h);
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + w / 2, y + r, w / 2 > r ? r : w / 2, Math.PI, 0);
    if (w / 2 > r) {
      // قوس أعرض من الارتفاع: نُبقي الجانبين مستقيمين
      ctx.lineTo(x + w, y + r);
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  } else if (shape === "rounded") {
    ctx.roundRect(x, y, w, h, Math.min(cornerPx, w / 2, h / 2));
  } else {
    ctx.rect(x, y, w, h);
  }
}

const foilColor = (f: Foil, fallback: string) => (f === "none" ? fallback : FOILS[f].color);
// قيم خريطة الخامة: [R غير مستخدم، G خشونة، B معدنية]
const PBR_PAPER = { matte: "rgb(255,220,0)", gloss: "rgb(255,90,0)" } as const;
const PBR_FOIL = "rgb(255,60,255)";
const PBR_INK = { matte: "rgb(255,200,0)", gloss: "rgb(255,80,0)" } as const;

async function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export async function renderLabel(d: LabelDesign, pxPerMm: number, bleedMm = 0): Promise<Rendered> {
  await ensureFonts(d.texts.map((t) => t.font), d.texts.map((t) => t.text).join(" ") || "عطر");
  const k = pxPerMm;
  const b = bleedMm * k;
  const W = Math.round(d.widthMm * k), H = Math.round(d.heightMm * k);
  const cw = Math.round(W + 2 * b), ch = Math.round(H + 2 * b);
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    return c;
  };
  const color = mk(), pbr = mk();
  const g = color.getContext("2d")!, p = pbr.getContext("2d")!;
  const paper = paperColor(d);
  const corner = 4 * k;

  // القص على شكل الملصق (مع الهامش عند الطباعة)
  for (const ctx of [g, p]) {
    ctx.save();
    shapePath(ctx, d.shape, 0, 0, cw, ch, corner + b);
    ctx.clip();
  }
  if (paper) {
    g.fillStyle = paper;
    g.fillRect(0, 0, cw, ch);
    if (d.paper === "kraft") {
      // ألياف الكرافت: نقاط عشوائية ثابتة البذرة لتطابق المعاينة الطباعة
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < (cw * ch) / 60; i++) {
        g.fillStyle = `rgba(${rnd() > 0.5 ? "90,60,30" : "235,210,170"},${0.05 + rnd() * 0.12})`;
        g.fillRect(rnd() * cw, rnd() * ch, 1 + rnd() * 2 * (k / 8), 1);
      }
    }
    p.fillStyle = PBR_PAPER[d.finish];
    p.fillRect(0, 0, cw, ch);
  }

  // من هنا الإحداثيات نسبة لمنطقة القص (بدون الهامش)
  const ox = b, oy = b;

  if (d.border.enabled) {
    const inset = 2.2 * k;
    for (const [ctx, style] of [[g, foilColor(d.border.foil, d.border.color)], [p, d.border.foil === "none" ? PBR_INK[d.finish] : PBR_FOIL]] as const) {
      ctx.lineWidth = Math.max(1, 0.35 * k);
      ctx.strokeStyle = style;
      shapePath(ctx, d.shape, ox + inset, oy + inset, W - 2 * inset, H - 2 * inset, Math.max(0, corner - inset));
      ctx.stroke();
    }
  }

  if (d.logo?.dataUrl) {
    try {
      const img = await loadImage(d.logo.dataUrl);
      const lw = d.logo.widthMm * k;
      const lh = (img.naturalHeight / img.naturalWidth) * lw;
      const lx = ox + (W - lw) / 2, ly = oy + d.logo.y * H - lh / 2;
      if (d.logo.foil === "none") {
        g.drawImage(img, lx, ly, lw, lh);
        p.globalAlpha = 1;
        p.globalCompositeOperation = "source-over";
      } else {
        // شعار مذهّب: نستخدم شكل الشعار (قناة الشفافية) ونلوّنه بلون الفويل
        const tmp = document.createElement("canvas");
        tmp.width = Math.max(1, Math.round(lw));
        tmp.height = Math.max(1, Math.round(lh));
        const tg = tmp.getContext("2d")!;
        tg.drawImage(img, 0, 0, tmp.width, tmp.height);
        tg.globalCompositeOperation = "source-in";
        tg.fillStyle = FOILS[d.logo.foil].color;
        tg.fillRect(0, 0, tmp.width, tmp.height);
        g.drawImage(tmp, lx, ly);
        tg.fillStyle = PBR_FOIL;
        tg.fillRect(0, 0, tmp.width, tmp.height);
        p.drawImage(tmp, lx, ly);
      }
    } catch {
      /* شعار تالف: نتجاهله ولا نوقف الرسم */
    }
  }

  for (const t of d.texts) {
    if (!t.text.trim()) continue;
    const rtl = hasArabic(t.text);
    let px = t.sizeMm * k;
    const setFont = (ctx: CanvasRenderingContext2D) => {
      ctx.font = `${t.weight} ${px}px "${FONTS[t.font].family}", "IBM Plex Sans Arabic", sans-serif`;
      ctx.direction = rtl ? "rtl" : "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // تباعد الحروف يكسر اتصال الحروف العربية — للاتينية فقط
      ctx.letterSpacing = rtl ? "0px" : `${t.trackingMm * k}px`;
    };
    setFont(g);
    // يُصغَّر النص تلقائياً ليبقى داخل الملصق بهامش 3 مم من كل جانب
    const maxW = W - 6 * k;
    const w = g.measureText(t.text).width;
    if (w > maxW) {
      px = (px * maxW) / w;
      setFont(g);
    }
    const x = ox + W / 2, y = oy + t.y * H;
    g.fillStyle = foilColor(t.foil, t.color);
    g.fillText(t.text, x, y);
    setFont(p);
    p.fillStyle = t.foil === "none" ? PBR_INK[d.finish] : PBR_FOIL;
    p.fillText(t.text, x, y);
  }

  g.restore();
  p.restore();
  return { color, pbr, clear: !paper };
}
