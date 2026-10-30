import type { Bi } from "@/i18n/context";

// المخزون: المواد، وحركاتها (استلام بتكلفة، صرف لمشروع، حجز، فك حجز، تسوية جرد)

export const INV_CATEGORIES = ["bottle", "cap", "box", "label", "oil", "sample", "packaging", "other"] as const;
export type InvCategory = (typeof INV_CATEGORIES)[number];
export const INV_CATEGORY_LABELS: Record<InvCategory, Bi> = {
  bottle: { ar: "زجاجات", en: "Bottles" },
  cap: { ar: "أغطية وبخاخات", en: "Caps & sprayers" },
  box: { ar: "علب", en: "Boxes" },
  label: { ar: "ملصقات", en: "Labels" },
  oil: { ar: "زيوت وتركيبات", en: "Oils & formulas" },
  sample: { ar: "عينات", en: "Samples" },
  packaging: { ar: "تغليف", en: "Packaging" },
  other: { ar: "أخرى", en: "Other" },
};
export const INV_UNITS = ["pcs", "ml", "g", "kg", "l"] as const;
export type InvUnit = (typeof INV_UNITS)[number];
export const INV_UNIT_LABELS: Record<InvUnit, Bi> = {
  pcs: { ar: "قطعة", en: "pcs" },
  ml: { ar: "مل", en: "ml" },
  g: { ar: "غرام", en: "g" },
  kg: { ar: "كغ", en: "kg" },
  l: { ar: "لتر", en: "l" },
};
export const MOVE_KINDS = ["receive", "issue", "reserve", "release", "adjust"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];
export const MOVE_LABELS: Record<MoveKind, Bi> = {
  receive: { ar: "استلام", en: "Receive" },
  issue: { ar: "صرف", en: "Issue" },
  reserve: { ar: "حجز", en: "Reserve" },
  release: { ar: "فك حجز", en: "Release" },
  adjust: { ar: "تسوية جرد", en: "Stock-take adjustment" },
};

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InvCategory;
  unit: InvUnit;
  onHand: number;
  reserved: number;
  avgCost: number;
  reorderLevel: number;
  supplier: string;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryMove {
  id: string;
  itemId: string;
  kind: MoveKind;
  qty: number;
  unitCost?: number | null;
  projectId?: string | null;
  quoteId?: string | null;
  note: string;
  createdBy?: string | null;
  createdAt: string;
}
export type ItemInput = Pick<InventoryItem, "sku" | "name" | "category" | "unit" | "reorderLevel" | "supplier" | "notes" | "active">;
export type MoveInput = Pick<InventoryMove, "itemId" | "kind" | "qty" | "note"> & { unitCost?: number | null; projectId?: string | null };

export const available = (i: Pick<InventoryItem, "onHand" | "reserved">) => Math.round((i.onHand - i.reserved) * 1000) / 1000;
/** يحتاج إعادة طلب: المتاح عند حد الطلب أو دونه */
export const needsReorder = (i: InventoryItem) => i.active && available(i) <= i.reorderLevel;
export const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,39}$/;
