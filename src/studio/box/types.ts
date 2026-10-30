import type { Bi } from "@/i18n/context";
import type { Foil, FontId } from "../label/types";

export type BoxStyle = "tuck" | "rigid" | "drawer" | "magnetic" | "tube";
export type Board = "white" | "cream" | "kraft" | "black" | "custom";
export type BoxFinish = "matte" | "gloss" | "soft";

export interface BoxDesign {
  style: BoxStyle;
  /** المقاسات الداخلية بالمليمتر: الطول (الواجهة) × العمق × الارتفاع */
  L: number;
  W: number;
  H: number;
  board: Board;
  customColor: string;
  /** لون البطانة الداخلية */
  interior: string;
  finish: BoxFinish;
  foil: Foil;
  /** خط ذهبي حول الواجهة */
  frame: boolean;
  brand: string;
  name: string;
  details: string;
  font: FontId;
  /** يُستخدم شعار الملصق (إن وُجد) على الواجهة */
  useLogo: boolean;
  /** الكمية لتقدير السعر (اختياري في التصاميم القديمة) */
  qty?: number;
  /** ملحقات التغليف (بطاقة شكر، حشوة…) — معرّفاتها في studio/spec.ts */
  extras?: string[];
}

export const DEFAULT_QTY = 1000;

export const STYLES: { id: BoxStyle; name: Bi; note: Bi }[] = [
  { id: "tuck", name: { ar: "علبة بلسان (Tuck End)", en: "Reverse tuck end" }, note: { ar: "كرتون مقوّى 350 غم — الأوفر والأسرع إنتاجاً", en: "350 gsm folding carton — the most economical" } },
  { id: "rigid", name: { ar: "علبة صلبة بغطاء", en: "Rigid lid & base" }, note: { ar: "كرتون رمادي 2 مم مغلّف بورق مطبوع", en: "2 mm greyboard wrapped in printed paper" } },
  { id: "drawer", name: { ar: "علبة درج", en: "Drawer (sleeve & tray)" }, note: { ar: "غلاف خارجي ودرج ينزلق — تجربة فتح مميزة", en: "Outer sleeve with a sliding tray" } },
  { id: "magnetic", name: { ar: "علبة مغناطيسية", en: "Magnetic closure" }, note: { ar: "غطاء متصل يُغلق بمغناطيس — الأكثر فخامة", en: "Hinged lid with a magnet — the most premium" } },
  { id: "tube", name: { ar: "أسطوانة ورقية", en: "Paper tube" }, note: { ar: "أنبوب كرتوني بغطاء — مناسب للهدايا", en: "Cardboard tube with lid — great for gifting" } },
];

export const BOARDS: Record<Exclude<Board, "custom">, { name: Bi; color: string; edge: string }> = {
  white: { name: { ar: "أبيض", en: "White" }, color: "#f6f4ef", edge: "#ece8df" },
  cream: { name: { ar: "كريمي", en: "Cream" }, color: "#efe4cf", edge: "#e2d6bf" },
  kraft: { name: { ar: "كرافت", en: "Kraft" }, color: "#b98f62", edge: "#a07a51" },
  black: { name: { ar: "أسود", en: "Black" }, color: "#1b1a19", edge: "#2a2826" },
};

export const FINISHES: { id: BoxFinish; name: Bi; roughness: number; clearcoat: number }[] = [
  { id: "matte", name: { ar: "مطفأ", en: "Matte" }, roughness: 0.82, clearcoat: 0 },
  { id: "soft", name: { ar: "ملمس مخملي", en: "Soft-touch" }, roughness: 0.95, clearcoat: 0 },
  { id: "gloss", name: { ar: "لامع", en: "Gloss" }, roughness: 0.35, clearcoat: 0.6 },
];

export const boardColor = (d: Pick<BoxDesign, "board" | "customColor">) => (d.board === "custom" ? d.customColor : BOARDS[d.board].color);

/** سماكة الخامة بالمليمتر لكل نوع */
export const THICKNESS: Record<BoxStyle, number> = { tuck: 0.45, rigid: 2, drawer: 0.6, magnetic: 2, tube: 1.5 };

export const LIMITS = { min: 20, max: 400 };

export function defaultBox(fit?: { w: number; d: number; h: number }): BoxDesign {
  return {
    style: "tuck",
    ...fitFor("tuck", fit ?? { w: 52, d: 36, h: 120 }),
    board: "black",
    customColor: "#3b2f2a",
    interior: "#f1ece2",
    finish: "soft",
    foil: "gold",
    frame: true,
    brand: "Maison",
    name: "عود الليل",
    details: "Eau de Parfum · 50 ml",
    font: "playfair",
    useLogo: true,
  };
}

/** المقاس الداخلي المناسب للعبوة لكل نوع (مع هامش للحشوة) — الدرج يستلقي فيه المنتج */
export function fitFor(style: BoxStyle, f: { w: number; d: number; h: number }): Pick<BoxDesign, "L" | "W" | "H"> {
  const r = (n: number) => Math.min(LIMITS.max, Math.max(LIMITS.min, Math.round(n)));
  if (style === "drawer") return { L: r(f.h + 8), W: r(f.w + 8), H: r(f.d + 6) };
  if (style === "tube") return { L: r(Math.max(f.w, f.d) + 4), W: r(Math.max(f.w, f.d) + 4), H: r(f.h + 6) };
  const pad = style === "tuck" ? 3 : 10;
  return { L: r(f.w + pad), W: r(f.d + pad), H: r(f.h + pad) };
}
