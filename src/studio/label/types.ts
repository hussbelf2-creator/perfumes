import type { Bi } from "@/i18n/context";

export type LabelShape = "rect" | "rounded" | "oval" | "arch";
export type Foil = "none" | "gold" | "silver" | "copper";
export type Paper = "white" | "cream" | "kraft" | "black" | "clear" | "custom";
export type Finish = "matte" | "gloss";
export type FontId = "readex" | "plex" | "amiri" | "reem" | "playfair";

export interface LabelText {
  id: "brand" | "name" | "details";
  text: string;
  font: FontId;
  /** ارتفاع الخط بالمليمتر */
  sizeMm: number;
  weight: 400 | 700;
  color: string;
  foil: Foil;
  /** الموضع العمودي داخل الملصق 0 (أعلى) – 1 (أسفل) */
  y: number;
  /** تباعد الحروف بالمليمتر (يُتجاهل للعربية لأنه يكسر اتصال الحروف) */
  trackingMm: number;
}

export interface LabelDesign {
  enabled: boolean;
  shape: LabelShape;
  widthMm: number;
  heightMm: number;
  /** مركز الملصق من قاعدة العبوة بالمليمتر */
  centerYmm: number;
  paper: Paper;
  /** لون الورق عند paper = custom */
  customColor: string;
  finish: Finish;
  border: { enabled: boolean; color: string; foil: Foil };
  texts: LabelText[];
  logo: { dataUrl: string; widthMm: number; y: number; foil: Foil } | null;
}

export const PAPERS: Record<Exclude<Paper, "custom">, { name: Bi; color: string | null; swatch: string }> = {
  white: { name: { ar: "أبيض", en: "White" }, color: "#fbfaf7", swatch: "#fbfaf7" },
  cream: { name: { ar: "كريمي", en: "Cream" }, color: "#f1e8d6", swatch: "#f1e8d6" },
  kraft: { name: { ar: "كرافت", en: "Kraft" }, color: "#c19a6b", swatch: "#c19a6b" },
  black: { name: { ar: "أسود", en: "Black" }, color: "#151515", swatch: "#151515" },
  clear: { name: { ar: "شفاف (طباعة مباشرة)", en: "Clear (no-label look)" }, color: null, swatch: "repeating-linear-gradient(45deg,#fff 0 4px,#e8e8e8 4px 8px)" },
};

export const FOILS: Record<Exclude<Foil, "none">, { name: Bi; color: string }> = {
  gold: { name: { ar: "ذهبي", en: "Gold" }, color: "#d1a95b" },
  silver: { name: { ar: "فضي", en: "Silver" }, color: "#cfd2d4" },
  copper: { name: { ar: "نحاسي", en: "Copper" }, color: "#c27c55" },
};

export const SHAPES: { id: LabelShape; name: Bi }[] = [
  { id: "rect", name: { ar: "مستطيل", en: "Rectangle" } },
  { id: "rounded", name: { ar: "بزوايا دائرية", en: "Rounded" } },
  { id: "oval", name: { ar: "بيضاوي", en: "Oval" } },
  { id: "arch", name: { ar: "قوس", en: "Arch" } },
];

export const paperColor = (d: Pick<LabelDesign, "paper" | "customColor">) => (d.paper === "custom" ? d.customColor : PAPERS[d.paper].color);
export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
