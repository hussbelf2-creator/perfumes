import type { Bi } from "@/i18n/context";

// خامات قياسية: الزجاج والأغطية والسائل. القيم مضبوطة لمظهر واقعي تحت إضاءة استوديو.

export interface GlassPreset {
  id: string;
  name: Bi;
  color: string;
  roughness: number;
  /** 1 = زجاج شفاف (نفاذية)، 0 = مطلي معتم */
  transmission: number;
  attenuationColor: string;
  attenuationDistance: number;
  swatch: string;
}

export const GLASS: GlassPreset[] = [
  { id: "clear", name: { ar: "شفاف", en: "Clear" }, color: "#ffffff", roughness: 0.04, transmission: 1, attenuationColor: "#ffffff", attenuationDistance: 1e6, swatch: "linear-gradient(135deg,#f6f8f9,#dfe6ea)" },
  { id: "frosted", name: { ar: "مطفأ (فروستد)", en: "Frosted" }, color: "#ffffff", roughness: 0.42, transmission: 1, attenuationColor: "#ffffff", attenuationDistance: 1e6, swatch: "linear-gradient(135deg,#eeeeec,#d8d8d4)" },
  { id: "amber", name: { ar: "كهرماني", en: "Amber" }, color: "#ffffff", roughness: 0.05, transmission: 1, attenuationColor: "#b8671e", attenuationDistance: 22, swatch: "linear-gradient(135deg,#d99a4e,#8a4a14)" },
  { id: "smoke", name: { ar: "مدخّن", en: "Smoked" }, color: "#ffffff", roughness: 0.06, transmission: 1, attenuationColor: "#3b3936", attenuationDistance: 26, swatch: "linear-gradient(135deg,#8a8783,#3b3936)" },
  { id: "aqua", name: { ar: "بحري", en: "Aqua" }, color: "#ffffff", roughness: 0.08, transmission: 1, attenuationColor: "#7fb6cf", attenuationDistance: 30, swatch: "linear-gradient(135deg,#cfe6ef,#7fb6cf)" },
  { id: "black", name: { ar: "أسود مطلي", en: "Lacquered black" }, color: "#121212", roughness: 0.18, transmission: 0, attenuationColor: "#000000", attenuationDistance: 1, swatch: "linear-gradient(135deg,#3a3a3a,#050505)" },
  { id: "white", name: { ar: "أبيض حليبي", en: "Opal white" }, color: "#f1eee8", roughness: 0.22, transmission: 0, attenuationColor: "#ffffff", attenuationDistance: 1, swatch: "linear-gradient(135deg,#ffffff,#e4dfd6)" },
];

export interface FinishPreset {
  id: string;
  name: Bi;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat?: number;
  swatch: string;
}

export const CAP_FINISH: FinishPreset[] = [
  { id: "gold", name: { ar: "ذهبي لامع", en: "Polished gold" }, color: "#d4af6a", metalness: 1, roughness: 0.22, swatch: "linear-gradient(135deg,#f3dc9c,#a77b2f)" },
  { id: "brushed-gold", name: { ar: "ذهبي مصقول", en: "Brushed gold" }, color: "#c9a35a", metalness: 1, roughness: 0.45, swatch: "linear-gradient(135deg,#dcc28a,#9c7a3c)" },
  { id: "silver", name: { ar: "فضي", en: "Silver" }, color: "#dcdcdc", metalness: 1, roughness: 0.2, swatch: "linear-gradient(135deg,#ffffff,#9a9a9a)" },
  { id: "black", name: { ar: "أسود مطفأ", en: "Matte black" }, color: "#1b1b1b", metalness: 0.1, roughness: 0.62, swatch: "linear-gradient(135deg,#444,#0d0d0d)" },
  { id: "wood", name: { ar: "خشب جوز", en: "Walnut wood" }, color: "#7a4f2c", metalness: 0, roughness: 0.78, swatch: "linear-gradient(135deg,#a2714a,#5a3a1f)" },
  { id: "ceramic", name: { ar: "سيراميك أبيض", en: "White ceramic" }, color: "#f2efe9", metalness: 0, roughness: 0.32, clearcoat: 0.8, swatch: "linear-gradient(135deg,#ffffff,#ddd8cf)" },
];

export interface LiquidPreset {
  id: string;
  name: Bi;
  color: string;
}

export const LIQUID: LiquidPreset[] = [
  { id: "none", name: { ar: "فارغة", en: "Empty" }, color: "transparent" },
  { id: "clear", name: { ar: "شفاف", en: "Clear" }, color: "#f2ead2" },
  { id: "amber", name: { ar: "كهرماني", en: "Amber" }, color: "#d9a03c" },
  { id: "rose", name: { ar: "وردي", en: "Rose" }, color: "#e7a1a6" },
  { id: "oud", name: { ar: "عودي داكن", en: "Dark oud" }, color: "#5c2d12" },
  { id: "green", name: { ar: "أخضر عشبي", en: "Herbal green" }, color: "#9fb56a" },
];

export const glassById = (id?: string) => GLASS.find((g) => g.id === id) ?? GLASS[0];
export const finishById = (id?: string) => CAP_FINISH.find((g) => g.id === id) ?? CAP_FINISH[0];
export const liquidById = (id?: string) => LIQUID.find((g) => g.id === id) ?? LIQUID[2];
