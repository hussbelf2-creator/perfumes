import { supabase } from "@/lib/supabase";
import { can, type Role } from "@/lib/rbac";
import { PermissionError, ValidationError } from "@/admin/data/types";
import { SEED_CREATIVES, SEED_WORKS } from "./seed";
import { isSlug, SPECIALTIES, type Creative, type NewCreative, type NewWork, type Work } from "./types";
import { MAX_IMAGES } from "./images";

// المصممون وأعمالهم: Supabase (creatives + creative_works) أو تخزين المتصفح في الوضع التجريبي.
// الزائر يرى المنشور فقط: المصمم المنشور وأعماله المنشورة.

export interface Catalog {
  creatives: Creative[];
  works: Work[];
}

export interface CreativesRepo {
  listPublished(): Promise<Catalog>;
  listAll(): Promise<Catalog>;
  saveCreative(c: NewCreative, id: string | null, role: Role): Promise<Creative>;
  removeCreative(id: string, role: Role): Promise<void>;
  saveWork(w: NewWork, id: string | null, role: Role): Promise<Work>;
  removeWork(id: string, role: Role): Promise<void>;
}

export function validateCreative(c: NewCreative) {
  if (!c.name.ar.trim() || c.name.ar.length > 80) throw new ValidationError("name");
  if (!isSlug(c.slug)) throw new ValidationError("slug");
  if (!c.specialties.length || c.specialties.some((s) => !SPECIALTIES.includes(s))) throw new ValidationError("specialties");
  if (c.bio.ar.length > 1200 || c.bio.en.length > 1200) throw new ValidationError("bio");
  if (!(c.yearsExp >= 0 && c.yearsExp <= 60)) throw new ValidationError("years");
  if (c.rateFrom != null && !(c.rateFrom >= 0 && c.rateFrom <= 10_000_000)) throw new ValidationError("rate");
  if (c.avatar && !/^(https:\/\/|idb:)/.test(c.avatar)) throw new ValidationError("avatar");
}

export function validateWork(w: NewWork) {
  if (!w.title.ar.trim() || w.title.ar.length > 120) throw new ValidationError("title");
  if (!w.images.length) throw new ValidationError("images");
  if (w.images.length > MAX_IMAGES) throw new ValidationError("too_many_images");
  if (w.images.some((u) => !/^(https:\/\/|idb:)/.test(u))) throw new ValidationError("image_url");
  if (!SPECIALTIES.includes(w.category)) throw new ValidationError("category");
  if (!(w.year >= 1990 && w.year <= 2100)) throw new ValidationError("year");
  if (w.summary.ar.length > 600 || w.summary.en.length > 600) throw new ValidationError("summary");
}

const guard = (role: Role) => {
  if (!can(role, "studio.manage")) throw new PermissionError("studio.manage");
};
const byCreative = (a: Creative, b: Creative) => Number(b.featured) - Number(a.featured) || a.sort - b.sort || a.createdAt.localeCompare(b.createdAt);
const byWork = (a: Work, b: Work) => a.sort - b.sort || b.year - a.year || a.createdAt.localeCompare(b.createdAt);
const publishedOnly = (c: Catalog): Catalog => {
  const creatives = c.creatives.filter((x) => x.published);
  const ids = new Set(creatives.map((x) => x.id));
  return { creatives, works: c.works.filter((w) => w.published && ids.has(w.creativeId)) };
};
const sorted = (c: Catalog): Catalog => ({ creatives: [...c.creatives].sort(byCreative), works: [...c.works].sort(byWork) });

// ─── الوضع التجريبي ───────────────────────────────────────────────
const KEY = "pp_creatives_v1";
function read(): Catalog {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Catalog;
  } catch {
    /* نعيد البذر */
  }
  return { creatives: SEED_CREATIVES, works: SEED_WORKS };
}
function write(c: Catalog) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    throw new ValidationError("storage_full");
  }
}
const uid = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

const localRepo: CreativesRepo = {
  async listPublished() {
    return sorted(publishedOnly(read()));
  },
  async listAll() {
    return sorted(read());
  },
  async saveCreative(c, id, role) {
    guard(role);
    validateCreative(c);
    const s = read();
    if (s.creatives.some((x) => x.slug === c.slug && x.id !== id)) throw new ValidationError("slug_taken");
    const now = new Date().toISOString();
    let out: Creative;
    if (id) {
      const prev = s.creatives.find((x) => x.id === id);
      if (!prev) throw new ValidationError("not_found");
      out = { ...prev, ...c, id, updatedAt: now };
      s.creatives = s.creatives.map((x) => (x.id === id ? out : x));
    } else {
      out = { ...c, id: uid("CR"), createdAt: now, updatedAt: now };
      s.creatives.push(out);
    }
    write(s);
    return out;
  },
  async removeCreative(id, role) {
    guard(role);
    const s = read();
    write({ creatives: s.creatives.filter((x) => x.id !== id), works: s.works.filter((w) => w.creativeId !== id) });
  },
  async saveWork(w, id, role) {
    guard(role);
    validateWork(w);
    const s = read();
    if (!s.creatives.some((x) => x.id === w.creativeId)) throw new ValidationError("not_found");
    const now = new Date().toISOString();
    let out: Work;
    if (id) {
      const prev = s.works.find((x) => x.id === id);
      if (!prev) throw new ValidationError("not_found");
      out = { ...prev, ...w, id, updatedAt: now };
      s.works = s.works.map((x) => (x.id === id ? out : x));
    } else {
      out = { ...w, id: uid("W"), createdAt: now, updatedAt: now };
      s.works.push(out);
    }
    write(s);
    return out;
  },
  async removeWork(id, role) {
    guard(role);
    const s = read();
    write({ ...s, works: s.works.filter((w) => w.id !== id) });
  },
};

// ─── Supabase ────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const bi = (r: Row, k: string) => ({ ar: String(r[`${k}_ar`] ?? ""), en: String(r[`${k}_en`] || r[`${k}_ar`] || "") });
const creativeFromRow = (r: Row): Creative => ({
  id: String(r.id),
  slug: String(r.slug),
  name: bi(r, "name"),
  title: bi(r, "title"),
  bio: bi(r, "bio"),
  city: bi(r, "city"),
  specialties: (r.specialties as Creative["specialties"]) ?? [],
  yearsExp: Number(r.years_exp ?? 0),
  rateFrom: r.rate_from == null ? null : Number(r.rate_from),
  turnaroundDays: r.turnaround_days == null ? null : Number(r.turnaround_days),
  avatar: (r.avatar as string) ?? null,
  available: Boolean(r.available),
  featured: Boolean(r.featured),
  published: Boolean(r.published),
  sample: Boolean(r.sample),
  profileId: (r.profile_id as string) ?? null,
  sort: Number(r.sort ?? 0),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const creativeToRow = (c: NewCreative): Row => ({
  slug: c.slug,
  name_ar: c.name.ar,
  name_en: c.name.en,
  title_ar: c.title.ar,
  title_en: c.title.en,
  bio_ar: c.bio.ar,
  bio_en: c.bio.en,
  city_ar: c.city.ar,
  city_en: c.city.en,
  specialties: c.specialties,
  years_exp: c.yearsExp,
  rate_from: c.rateFrom ?? null,
  turnaround_days: c.turnaroundDays ?? null,
  avatar: c.avatar ?? null,
  available: c.available,
  featured: c.featured,
  published: c.published,
  sample: c.sample,
  profile_id: c.profileId ?? null,
  sort: c.sort,
});
const workFromRow = (r: Row): Work => ({
  id: String(r.id),
  creativeId: String(r.creative_id),
  title: bi(r, "title"),
  summary: bi(r, "summary"),
  category: r.category as Work["category"],
  images: (r.images as string[]) ?? [],
  client: (r.client as string) ?? null,
  concept: Boolean(r.concept),
  year: Number(r.year),
  published: Boolean(r.published),
  sort: Number(r.sort ?? 0),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const workToRow = (w: NewWork): Row => ({
  creative_id: w.creativeId,
  title_ar: w.title.ar,
  title_en: w.title.en,
  summary_ar: w.summary.ar,
  summary_en: w.summary.en,
  category: w.category,
  images: w.images,
  client: w.client ?? null,
  concept: w.concept,
  year: w.year,
  published: w.published,
  sort: w.sort,
});

function remoteRepo(): CreativesRepo {
  const db = supabase!;
  const fail = (e: { message: string; code?: string } | null) => {
    if (!e) return;
    if (/row-level security|permission/i.test(e.message)) throw new PermissionError("studio.manage");
    if (e.code === "23505") throw new ValidationError("slug_taken");
    throw new Error(e.message);
  };
  const load = async (): Promise<Catalog> => {
    // RLS تعيد المنشور فقط للزوار، والكل لفريق الاستوديو
    const [c, w] = await Promise.all([db.from("creatives").select("*"), db.from("creative_works").select("*")]);
    fail(c.error);
    fail(w.error);
    return sorted({ creatives: (c.data ?? []).map(creativeFromRow), works: (w.data ?? []).map(workFromRow) });
  };
  return {
    async listPublished() {
      return publishedOnly(await load());
    },
    listAll: load,
    async saveCreative(c, id) {
      validateCreative(c);
      const q = id ? db.from("creatives").update(creativeToRow(c)).eq("id", id) : db.from("creatives").insert(creativeToRow(c));
      const { data, error } = await q.select().single();
      fail(error);
      if (!data) throw new PermissionError("studio.manage");
      return creativeFromRow(data as Row);
    },
    async removeCreative(id) {
      const { error, count } = await db.from("creatives").delete({ count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("studio.manage");
    },
    async saveWork(w, id) {
      validateWork(w);
      const q = id ? db.from("creative_works").update(workToRow(w)).eq("id", id) : db.from("creative_works").insert(workToRow(w));
      const { data, error } = await q.select().single();
      fail(error);
      if (!data) throw new PermissionError("studio.manage");
      return workFromRow(data as Row);
    },
    async removeWork(id) {
      const { error, count } = await db.from("creative_works").delete({ count: "exact" }).eq("id", id);
      fail(error);
      if (count === 0) throw new PermissionError("studio.manage");
    },
  };
}

export const creativesRepo: CreativesRepo = supabase ? remoteRepo() : localRepo;
