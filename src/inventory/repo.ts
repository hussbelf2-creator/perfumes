import { supabase } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { PermissionError, ValidationError } from "@/admin/data/types";
import type { PActor } from "@/projects/repo";
import { SKU_RE, type InventoryItem, type InventoryMove, type ItemInput, type MoveInput } from "./types";
import { round2 } from "@/projects/types";

// المخزون: الرصيد ومتوسط التكلفة تحسبهما الحركات (على الخادم في Supabase بالمُشغّل inventory_move_apply).
// الوضع التجريبي يطبّق القواعد نفسها محلياً.

export interface InventoryData {
  items: InventoryItem[];
  moves: InventoryMove[];
}
export interface InventoryRepo {
  load(a: PActor): Promise<InventoryData>;
  saveItem(input: ItemInput, id: string | null, a: PActor): Promise<InventoryItem>;
  addMove(input: MoveInput, a: PActor): Promise<void>;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

function checkItem(i: ItemInput) {
  if (!SKU_RE.test(i.sku.trim().toUpperCase())) throw new ValidationError("sku");
  if (!i.name.trim() || i.name.length > 120) throw new ValidationError("item_name");
  if (!(i.reorderLevel >= 0)) throw new ValidationError("reorder_level");
}
function checkMove(m: MoveInput) {
  if (!Number.isFinite(m.qty) || m.qty === 0 || (m.kind !== "adjust" && m.qty < 0)) throw new ValidationError("qty_positive");
  if (m.kind === "receive" && !(Number(m.unitCost) >= 0 && m.unitCost !== null && m.unitCost !== undefined)) throw new ValidationError("unit_cost_required");
  if ((m.kind === "reserve" || m.kind === "release") && !m.projectId) throw new ValidationError("project_required");
  if (m.kind === "adjust" && !m.note.trim()) throw new ValidationError("note_required");
  if (m.note.length > 300) throw new ValidationError("note_too_long");
}

// ─── الوضع التجريبي ───────────────────────────────────────────────
const KEY = "pp_inventory_v1";
function read(): InventoryData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as InventoryData;
  } catch {
    /* نبدأ فارغاً */
  }
  return { items: [], moves: [] };
}
function write(s: InventoryData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new ValidationError("storage_full");
  }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();
const reservedFor = (s: InventoryData, itemId: string, projectId: string) =>
  s.moves.filter((m) => m.itemId === itemId && m.projectId === projectId).reduce((t, m) => t + (m.kind === "reserve" ? m.qty : m.kind === "release" || m.kind === "issue" ? -m.qty : 0), 0);

/** يطبّق حركة على الرصيد (مطابق لـ inventory_move_apply) ويعيد تكلفة الصرف إن وُجدت */
function apply(s: InventoryData, m: MoveInput, by: string | null): { move: InventoryMove; materialCost: number } {
  const it = s.items.find((x) => x.id === m.itemId);
  if (!it) throw new ValidationError("not_found");
  const move: InventoryMove = { id: uid(), itemId: it.id, kind: m.kind, qty: r3(m.qty), unitCost: m.unitCost ?? null, projectId: m.projectId ?? null, quoteId: null, note: m.note.trim(), createdBy: by, createdAt: now() };
  let materialCost = 0;
  if (m.kind === "receive") {
    const base = Math.max(it.onHand, 0);
    it.avgCost = base + m.qty > 0 ? r4((base * it.avgCost + m.qty * Number(m.unitCost)) / (base + m.qty)) : Number(m.unitCost);
    it.onHand = r3(it.onHand + m.qty);
  } else if (m.kind === "issue") {
    if (m.qty > it.onHand) throw new ValidationError("insufficient_stock");
    move.unitCost = it.avgCost;
    const held = m.projectId ? Math.max(reservedFor(s, it.id, m.projectId), 0) : 0;
    it.onHand = r3(it.onHand - m.qty);
    it.reserved = r3(Math.max(it.reserved - Math.min(m.qty, held), 0));
    if (m.projectId) materialCost = round2(it.avgCost * m.qty);
  } else if (m.kind === "reserve") {
    it.reserved = r3(it.reserved + m.qty);
  } else if (m.kind === "release") {
    if (m.qty > reservedFor(s, it.id, m.projectId!)) throw new ValidationError("release_exceeds");
    it.reserved = r3(Math.max(it.reserved - m.qty, 0));
  } else {
    if (it.onHand + m.qty < 0) throw new ValidationError("insufficient_stock");
    move.unitCost = it.avgCost;
    it.onHand = r3(it.onHand + m.qty);
  }
  it.updatedAt = now();
  s.moves.unshift(move);
  return { move, materialCost };
}

/** الوضع التجريبي: حجز مواد بنود العرض عند دفع العربون (تستدعيه مستودعات المشاريع) */
export function localReserveForQuote(projectId: string, quote: { id: string; ref: string; lines: { qty: number }[] }, costs: { itemId?: string | null; perUnit?: number | null }[]) {
  const s = read();
  costs.forEach((c, i) => {
    if (!c.itemId || !quote.lines[i] || !s.items.some((x) => x.id === c.itemId)) return;
    const { move } = apply(s, { itemId: c.itemId, kind: "reserve", qty: quote.lines[i].qty * (c.perUnit || 1), projectId, note: `حجز تلقائي عند دفع العربون ${quote.ref}` }, null);
    move.quoteId = quote.id;
  });
  write(s);
}

const localRepo: InventoryRepo = {
  async load(a) {
    if (!can(a.role, "inventory.view") && !can(a.role, "inventory.manage")) return { items: [], moves: [] };
    return read();
  },
  async saveItem(input, id, a) {
    if (!can(a.role, "inventory.manage")) throw new PermissionError("inventory.manage");
    checkItem(input);
    const s = read();
    const sku = input.sku.trim().toUpperCase();
    if (s.items.some((x) => x.sku === sku && x.id !== id)) throw new ValidationError("sku_taken");
    let out: InventoryItem;
    if (id) {
      const prev = s.items.find((x) => x.id === id);
      if (!prev) throw new ValidationError("not_found");
      out = { ...prev, ...input, sku, name: input.name.trim(), updatedAt: now() };
      s.items = s.items.map((x) => (x.id === id ? out : x));
    } else {
      out = { ...input, sku, name: input.name.trim(), id: uid(), onHand: 0, reserved: 0, avgCost: 0, createdAt: now(), updatedAt: now() };
      s.items.push(out);
    }
    write(s);
    return out;
  },
  async addMove(input, a) {
    if (!can(a.role, "inventory.manage")) throw new PermissionError("inventory.manage");
    checkMove(input);
    const s = read();
    const { materialCost, move } = apply(s, input, a.id);
    write(s);
    if (materialCost > 0 && input.projectId) {
      const it = s.items.find((x) => x.id === input.itemId)!;
      const { localAddMaterialCost } = await import("@/projects/repo");
      localAddMaterialCost(input.projectId, materialCost, `${it.name} × ${move.qty}`, move.id);
    }
  },
};

// ─── Supabase ────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const itemFromRow = (r: Row): InventoryItem => ({
  id: String(r.id),
  sku: String(r.sku),
  name: String(r.name),
  category: r.category as InventoryItem["category"],
  unit: r.unit as InventoryItem["unit"],
  onHand: Number(r.on_hand),
  reserved: Number(r.reserved),
  avgCost: Number(r.avg_cost),
  reorderLevel: Number(r.reorder_level),
  supplier: String(r.supplier ?? ""),
  notes: String(r.notes ?? ""),
  active: Boolean(r.active),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const moveFromRow = (r: Row): InventoryMove => ({
  id: String(r.id),
  itemId: String(r.item_id),
  kind: r.kind as InventoryMove["kind"],
  qty: Number(r.qty),
  unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
  projectId: (r.project_id as string) ?? null,
  quoteId: (r.quote_id as string) ?? null,
  note: String(r.note ?? ""),
  createdBy: (r.created_by as string) ?? null,
  createdAt: String(r.created_at),
});

function remoteRepo(): InventoryRepo {
  const db = supabase!;
  const fail = (e: { message: string; code?: string } | null) => {
    if (!e) return;
    const m = e.message;
    if (e.code === "23505" || m.includes("duplicate key")) throw new ValidationError("sku_taken");
    if (/permission|row-level security/i.test(m)) throw new PermissionError("inventory.manage");
    for (const code of ["insufficient_stock", "release_exceeds", "unit_cost_required", "project_required", "note_required", "qty_positive", "not_found"]) if (m.includes(code)) throw new ValidationError(code);
    if (m.includes("inventory_items_sku_check")) throw new ValidationError("sku");
    throw new Error(m);
  };
  return {
    async load() {
      const [i, m] = await Promise.all([db.from("inventory_items").select("*").order("name"), db.from("inventory_moves").select("*").order("created_at", { ascending: false }).limit(1000)]);
      fail(i.error);
      fail(m.error);
      return { items: (i.data ?? []).map(itemFromRow), moves: (m.data ?? []).map(moveFromRow) };
    },
    async saveItem(input, id) {
      checkItem(input);
      const row = { sku: input.sku.trim().toUpperCase(), name: input.name.trim(), category: input.category, unit: input.unit, reorder_level: input.reorderLevel, supplier: input.supplier, notes: input.notes, active: input.active };
      const q = id ? db.from("inventory_items").update(row).eq("id", id) : db.from("inventory_items").insert(row);
      const { data, error } = await q.select().single();
      fail(error);
      return itemFromRow(data as Row);
    },
    async addMove(input) {
      checkMove(input);
      const { error } = await db.from("inventory_moves").insert({ item_id: input.itemId, kind: input.kind, qty: input.qty, unit_cost: input.unitCost ?? null, project_id: input.projectId || null, note: input.note.trim() });
      fail(error);
    },
  };
}

export const inventoryRepo: InventoryRepo = supabase ? remoteRepo() : localRepo;
