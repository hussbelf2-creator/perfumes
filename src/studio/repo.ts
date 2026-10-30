import { supabase } from "@/lib/supabase";
import { can, type Role } from "@/lib/rbac";
import { SEED_MODELS } from "./seed";
import type { NewPackModel, PackModel, ProfilePoint, Section } from "./types";
import { PermissionError } from "@/admin/data/types";

// كتالوج العبوات والأغطية: Supabase (جدول packaging_models) أو تخزين المتصفح في الوضع التجريبي

export interface StudioRepo {
  /** الكتالوج المنشور للعملاء والزوار */
  listPublished(): Promise<PackModel[]>;
  /** كل النماذج (للإدارة: studio.manage) */
  listAll(): Promise<PackModel[]>;
  create(m: NewPackModel, role: Role): Promise<PackModel>;
  update(id: string, patch: Partial<NewPackModel>, role: Role): Promise<void>;
  remove(id: string, role: Role): Promise<void>;
}

// نفس نوع خطأ الصلاحيات في لوحة الإدارة — فتظهر رسالة الرفض الصحيحة
const guard = (role: Role) => {
  if (!can(role, "studio.manage")) throw new PermissionError("studio.manage");
};
const sortModels = (xs: PackModel[]) => [...xs].sort((a, b) => a.kind.localeCompare(b.kind) || a.sort - b.sort || a.createdAt.localeCompare(b.createdAt));

// ─── الوضع التجريبي ───────────────────────────────────────────────
const KEY = "pp_studio_v1";
function read(): PackModel[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as PackModel[];
  } catch {
    /* نعيد البذر */
  }
  return SEED_MODELS;
}
function write(xs: PackModel[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(xs));
  } catch {
    throw new Error("storage_full");
  }
}

const localRepo: StudioRepo = {
  async listPublished() {
    return sortModels(read().filter((m) => m.published));
  },
  async listAll() {
    return sortModels(read());
  },
  async create(m, role) {
    guard(role);
    const now = new Date().toISOString();
    const model: PackModel = { ...m, id: `${m.kind === "bottle" ? "B" : "C"}-${Date.now().toString(36).toUpperCase()}`, createdAt: now, updatedAt: now };
    write([...read(), model]);
    return model;
  },
  async update(id, patch, role) {
    guard(role);
    write(read().map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)));
  },
  async remove(id, role) {
    guard(role);
    write(read().filter((m) => m.id !== id));
  },
};

// ─── Supabase ────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const fromRow = (r: Row): PackModel => ({
  id: String(r.id),
  kind: r.kind as PackModel["kind"],
  name: { ar: String(r.name_ar), en: String(r.name_en || r.name_ar) },
  capacityMl: r.capacity_ml == null ? null : Number(r.capacity_ml),
  heightMm: Number(r.height_mm),
  neckMm: Number(r.neck_mm ?? 0),
  profile: r.profile as ProfilePoint[],
  section: r.section as Section,
  depthRatio: Number(r.depth_ratio ?? 1),
  squareness: Number(r.squareness ?? 2),
  thumb: (r.thumb as string) ?? null,
  source: r.source === "ai" ? "ai" : "profile",
  glbUrl: (r.glb_url as string) ?? null,
  usdzUrl: (r.usdz_url as string) ?? null,
  published: Boolean(r.published),
  sort: Number(r.sort ?? 0),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const toRow = (m: Partial<NewPackModel>): Row => {
  const r: Row = {};
  if (m.kind) r.kind = m.kind;
  if (m.name) {
    r.name_ar = m.name.ar;
    r.name_en = m.name.en;
  }
  if (m.capacityMl !== undefined) r.capacity_ml = m.capacityMl;
  if (m.heightMm !== undefined) r.height_mm = m.heightMm;
  if (m.neckMm !== undefined) r.neck_mm = m.neckMm;
  if (m.profile) r.profile = m.profile;
  if (m.section) r.section = m.section;
  if (m.depthRatio !== undefined) r.depth_ratio = m.depthRatio;
  if (m.squareness !== undefined) r.squareness = m.squareness;
  if (m.thumb !== undefined) r.thumb = m.thumb;
  if (m.source !== undefined) r.source = m.source;
  if (m.glbUrl !== undefined) r.glb_url = m.glbUrl;
  if (m.usdzUrl !== undefined) r.usdz_url = m.usdzUrl;
  if (m.published !== undefined) r.published = m.published;
  if (m.sort !== undefined) r.sort = m.sort;
  return r;
};

function remoteRepo(): StudioRepo {
  const db = supabase!;
  const fail = (e: { message: string } | null) => {
    if (!e) return;
    if (/row-level security|permission/i.test(e.message)) throw new PermissionError("studio.manage");
    throw new Error(e.message);
  };
  return {
    async listPublished() {
      const { data, error } = await db.from("packaging_models").select("*").eq("published", true).order("kind").order("sort");
      fail(error);
      return (data ?? []).map(fromRow);
    },
    async listAll() {
      const { data, error } = await db.from("packaging_models").select("*").order("kind").order("sort");
      fail(error);
      return (data ?? []).map(fromRow);
    },
    async create(m) {
      const { data, error } = await db.from("packaging_models").insert(toRow(m)).select().single();
      fail(error);
      return fromRow(data as Row);
    },
    async update(id, patch) {
      const { error, count } = await db.from("packaging_models").update(toRow(patch), { count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("studio.manage");
    },
    async remove(id) {
      const { error, count } = await db.from("packaging_models").delete({ count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("studio.manage");
    },
  };
}

export const studioRepo: StudioRepo = supabase ? remoteRepo() : localRepo;
