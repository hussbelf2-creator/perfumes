import { supabase } from "@/lib/supabase";
import { can, type Role } from "@/lib/rbac";
import { PermissionError, ValidationError } from "@/admin/data/types";
import { CMS_KEYS, sanitize, type CmsDocs, type CmsKey } from "./schema";

// المحتوى: منشور (للجميع) + مسودات ونسخ (content.edit). في Supabase النشر والاسترجاع دالتان على الخادم.

export type Partial5 = { [K in CmsKey]?: CmsDocs[K] };
export interface Meta {
  at: string;
  by?: string | null;
}
export interface Version {
  id: string;
  key: CmsKey;
  value: unknown;
  publishedAt: string;
  publishedBy?: string | null;
}
export interface Snapshot {
  published: Partial5;
  publishedMeta: { [K in CmsKey]?: Meta };
}
export interface Drafts {
  drafts: Partial5;
  draftMeta: { [K in CmsKey]?: Meta };
}

export interface CmsRepo {
  loadPublished(): Promise<Snapshot>;
  loadDrafts(role: Role): Promise<Drafts>;
  saveDraft<K extends CmsKey>(key: K, value: CmsDocs[K], role: Role, actorId?: string): Promise<void>;
  discardDraft(key: CmsKey, role: Role): Promise<void>;
  publish(key: CmsKey, role: Role, actorId?: string): Promise<void>;
  versions(key: CmsKey, role: Role): Promise<Version[]>;
  restore(id: string, role: Role, actorId?: string): Promise<void>;
}

// وثيقة الأسعار قرار تجاري: تحتاج pricing.manage فوق صلاحية المحتوى (كما على الخادم)
export const canEditKey = (role: Role, key: CmsKey) => can(role, "content.edit") && (key !== "pricing" || can(role, "pricing.manage"));
const guardKey = (role: Role, key: CmsKey) => {
  if (!canEditKey(role, key)) throw new PermissionError(key === "pricing" ? "pricing.manage" : "content.edit");
};
const guard = (role: Role) => {
  if (!can(role, "content.edit")) throw new PermissionError("content.edit");
};
const isKey = (k: unknown): k is CmsKey => typeof k === "string" && (CMS_KEYS as readonly string[]).includes(k);
const MAX_BYTES = 60_000;
const checkSize = (v: unknown) => {
  if (JSON.stringify(v).length > MAX_BYTES) throw new ValidationError("content_too_large");
};

// ─── الوضع التجريبي ───────────────────────────────────────────────
const KEY = "pp_cms_v1";
interface Store {
  published: Record<string, { value: unknown; at: string; by?: string | null }>;
  drafts: Record<string, { value: unknown; at: string; by?: string | null }>;
  versions: Version[];
}
function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* تخزين تالف: نبدأ من الافتراضي */
  }
  return { published: {}, drafts: {}, versions: [] };
}
function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new ValidationError("storage_full");
  }
}
const now = () => new Date().toISOString();
const vid = () => `V-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

const localRepo: CmsRepo = {
  async loadPublished() {
    const s = read();
    const out: Snapshot = { published: {}, publishedMeta: {} };
    for (const [k, v] of Object.entries(s.published)) {
      if (!isKey(k)) continue;
      (out.published as Record<string, unknown>)[k] = sanitize(k, v.value);
      out.publishedMeta[k] = { at: v.at, by: v.by };
    }
    return out;
  },
  async loadDrafts(role) {
    guard(role);
    const s = read();
    const out: Drafts = { drafts: {}, draftMeta: {} };
    for (const [k, v] of Object.entries(s.drafts)) {
      if (!isKey(k)) continue;
      (out.drafts as Record<string, unknown>)[k] = sanitize(k, v.value);
      out.draftMeta[k] = { at: v.at, by: v.by };
    }
    return out;
  },
  async saveDraft(key, value, role, actorId) {
    guardKey(role, key);
    checkSize(value);
    const s = read();
    s.drafts[key] = { value: sanitize(key, value), at: now(), by: actorId ?? null };
    write(s);
  },
  async discardDraft(key, role) {
    guardKey(role, key);
    const s = read();
    delete s.drafts[key];
    write(s);
  },
  async publish(key, role, actorId) {
    guardKey(role, key);
    const s = read();
    const d = s.drafts[key];
    if (!d) throw new ValidationError("no_draft");
    const at = now();
    s.published[key] = { value: d.value, at, by: actorId ?? null };
    s.versions.unshift({ id: vid(), key, value: d.value, publishedAt: at, publishedBy: actorId ?? null });
    // آخر 30 نسخة لكل وثيقة (مثل الخادم)
    const kept: Version[] = [];
    const count: Record<string, number> = {};
    for (const v of s.versions) if ((count[v.key] = (count[v.key] ?? 0) + 1) <= 30) kept.push(v);
    s.versions = kept;
    delete s.drafts[key];
    write(s);
  },
  async versions(key, role) {
    guard(role);
    return read().versions.filter((v) => v.key === key);
  },
  async restore(id, role, actorId) {
    guard(role);
    const s = read();
    const v = s.versions.find((x) => x.id === id);
    if (!v) throw new ValidationError("not_found");
    guardKey(role, v.key);
    s.drafts[v.key] = { value: v.value, at: now(), by: actorId ?? null };
    write(s);
  },
};

// ─── Supabase ────────────────────────────────────────────────────
function remoteRepo(): CmsRepo {
  const db = supabase!;
  const fail = (e: { message: string } | null) => {
    if (!e) return;
    if (/permission|row-level security/i.test(e.message)) throw new PermissionError(/pricing/.test(e.message) ? "pricing.manage" : "content.edit");
    if (/no_draft/.test(e.message)) throw new ValidationError("no_draft");
    if (/not_found/.test(e.message)) throw new ValidationError("not_found");
    throw new Error(e.message);
  };
  return {
    async loadPublished() {
      const { data, error } = await db.from("site_content").select("key,value,published_at,published_by");
      fail(error);
      const out: Snapshot = { published: {}, publishedMeta: {} };
      for (const r of data ?? []) {
        if (!isKey(r.key)) continue;
        (out.published as Record<string, unknown>)[r.key] = sanitize(r.key, r.value);
        out.publishedMeta[r.key] = { at: r.published_at, by: r.published_by };
      }
      return out;
    },
    async loadDrafts() {
      const { data, error } = await db.from("site_content_drafts").select("key,value,updated_at,updated_by");
      fail(error);
      const out: Drafts = { drafts: {}, draftMeta: {} };
      for (const r of data ?? []) {
        if (!isKey(r.key)) continue;
        (out.drafts as Record<string, unknown>)[r.key] = sanitize(r.key, r.value);
        out.draftMeta[r.key] = { at: r.updated_at, by: r.updated_by };
      }
      return out;
    },
    async saveDraft(key, value) {
      checkSize(value);
      const { error } = await db.from("site_content_drafts").upsert({ key, value: sanitize(key, value) });
      fail(error);
    },
    async discardDraft(key) {
      const { error } = await db.from("site_content_drafts").delete().eq("key", key);
      fail(error);
    },
    async publish(key) {
      const { error } = await db.rpc("publish_content", { p_key: key });
      fail(error);
    },
    async versions(key) {
      const { data, error } = await db.from("site_content_versions").select("id,key,value,published_at,published_by").eq("key", key).order("published_at", { ascending: false });
      fail(error);
      return (data ?? []).map((r) => ({ id: r.id, key: r.key, value: r.value, publishedAt: r.published_at, publishedBy: r.published_by }));
    },
    async restore(id) {
      const { error } = await db.rpc("restore_content_version", { p_id: id });
      fail(error);
    },
  };
}

export const cmsRepo: CmsRepo = supabase ? remoteRepo() : localRepo;
