import type { Bi } from "@/i18n/context";
import type { PackModel } from "../types";
import { labelZone, perimeter } from "./geometry";
import type { LabelDesign, LabelText } from "./types";

// قوالب جاهزة: نقطة بداية يعدّلها العميل. المقاسات تُحسب من شكل العبوة نفسها.

export type TemplateId = "minimal" | "classic" | "luxury" | "modern" | "botanical";

export const TEMPLATES: { id: TemplateId; name: Bi }[] = [
  { id: "minimal", name: { ar: "بسيط", en: "Minimal" } },
  { id: "classic", name: { ar: "كلاسيكي عربي", en: "Classic Arabic" } },
  { id: "luxury", name: { ar: "فاخر بالذهب", en: "Gold luxury" } },
  { id: "modern", name: { ar: "عصري جريء", en: "Bold modern" } },
  { id: "botanical", name: { ar: "طبيعي كرافت", en: "Kraft botanical" } },
];

const text = (id: LabelText["id"], t: string, o: Partial<LabelText>): LabelText => ({
  id,
  text: t,
  font: "readex",
  sizeMm: 5,
  weight: 400,
  color: "#151515",
  foil: "none",
  y: 0.5,
  trackingMm: 0,
  ...o,
});

/** المقاس الافتراضي: نحو ثلث المحيط عرضاً، ونصف منطقة الجسم ارتفاعاً */
export function defaultSize(bottle: PackModel) {
  const z = labelZone(bottle.profile, bottle.neckMm);
  const per = perimeter(z.radius, bottle.squareness, bottle.depthRatio);
  // في العبوات المسطحة الواجهة هي العرض كاملاً: نأخذ 80% من عرض الواجهة
  const faceWidth = bottle.section === "round" ? per * 0.36 : z.radius * 2 * 0.8;
  const widthMm = Math.round(Math.min(90, Math.max(20, faceWidth)));
  const heightMm = Math.round(Math.min(z.height * 0.62, widthMm * 1.15));
  return { widthMm, heightMm, centerYmm: Math.round(z.center * 10) / 10, zone: z, perimeter: per };
}

export function makeTemplate(id: TemplateId, bottle: PackModel, brand = "نور", name = "عود الليل"): LabelDesign {
  const { widthMm, heightMm, centerYmm } = defaultSize(bottle);
  const base: LabelDesign = {
    enabled: true,
    shape: "rect",
    widthMm,
    heightMm,
    centerYmm,
    paper: "white",
    customColor: "#e9e1d3",
    finish: "matte",
    border: { enabled: false, color: "#151515", foil: "none" },
    texts: [],
    logo: null,
  };
  const s = Math.min(widthMm, heightMm * 1.3) / 40; // مقياس الخطوط حسب حجم الملصق
  switch (id) {
    case "classic":
      return {
        ...base,
        shape: "arch",
        paper: "cream",
        border: { enabled: true, color: "#6b4b2a", foil: "none" },
        texts: [
          text("brand", brand, { font: "amiri", sizeMm: 7.5 * s, weight: 700, color: "#3b2a1a", y: 0.38 }),
          text("name", name, { font: "amiri", sizeMm: 4.6 * s, color: "#3b2a1a", y: 0.6 }),
          text("details", "EAU DE PARFUM · 100 ML", { font: "playfair", sizeMm: 2.2 * s, color: "#6b4b2a", y: 0.82, trackingMm: 0.5 }),
        ],
      };
    case "luxury":
      return {
        ...base,
        shape: "rounded",
        paper: "black",
        finish: "gloss",
        border: { enabled: true, color: "#d1a95b", foil: "gold" },
        texts: [
          text("brand", brand, { font: "reem", sizeMm: 8 * s, weight: 700, foil: "gold", y: 0.4 }),
          text("name", name, { font: "amiri", sizeMm: 4.4 * s, color: "#e9e1d3", y: 0.62 }),
          text("details", "EXTRAIT DE PARFUM", { font: "playfair", sizeMm: 2.1 * s, foil: "gold", y: 0.82, trackingMm: 0.6 }),
        ],
      };
    case "modern":
      return {
        ...base,
        paper: "custom",
        customColor: "#c2612f",
        texts: [
          text("brand", brand.toUpperCase(), { font: "readex", sizeMm: 10 * s, weight: 700, color: "#ffffff", y: 0.42 }),
          text("name", name, { font: "readex", sizeMm: 4 * s, color: "#ffffff", y: 0.66 }),
          text("details", "100 ML · EDP", { font: "readex", sizeMm: 2.4 * s, color: "#fbe9de", y: 0.84, trackingMm: 0.3 }),
        ],
      };
    case "botanical":
      return {
        ...base,
        shape: "oval",
        paper: "kraft",
        texts: [
          text("brand", brand, { font: "reem", sizeMm: 7 * s, weight: 700, color: "#2e2418", y: 0.4 }),
          text("name", name, { font: "plex", sizeMm: 4 * s, color: "#2e2418", y: 0.6 }),
          text("details", "NATURAL · 100 ML", { font: "plex", sizeMm: 2.2 * s, color: "#4a3a26", y: 0.76, trackingMm: 0.3 }),
        ],
      };
    default:
      return {
        ...base,
        texts: [
          text("brand", brand, { font: "readex", sizeMm: 7 * s, weight: 700, y: 0.4 }),
          text("name", name, { font: "plex", sizeMm: 4 * s, color: "#444444", y: 0.6 }),
          text("details", "EAU DE PARFUM · 100 ML", { font: "plex", sizeMm: 2.2 * s, color: "#666666", y: 0.8, trackingMm: 0.4 }),
        ],
      };
  }
}
