import { supabase } from "@/lib/supabase";
import { can, type Role } from "@/lib/rbac";
import { PermissionError, ValidationError } from "@/admin/data/types";
import type { PActor } from "@/projects/repo";

// سياسة التسعير الداخلية (سقف الخصم لكل دور، حد الهامش) والكوبونات.
// القواعد نفسها على الخادم: send_quote يفرض السقف، وcoupon_price/redeem_coupon تحسب الكوبون.

export interface PricingPolicy {
  /** أقصى خصم ٪ يرسله كل دور في عرض سعر */
  discountCaps: Partial<Record<Role, number>>;
  /** الزائر لا يرسل طلباً إلا بعد التحقق البشري (Turnstile عبر /api/lead) */
  captchaRequired?: boolean;
  /** تنبيه حين يقل الهامش المتوقع عن هذه النسبة */
  marginFloor: number;
}
export const DEFAULT_POLICY: PricingPolicy = { discountCaps: { owner: 100, admin: 100, sales: 10 }, marginFloor: 25 };
export const capFor = (p: PricingPolicy, role: Role) => p.discountCaps[role] ?? 0;

export interface Coupon {
  code: string;
  kind: "pct" | "amount";
  value: number;
  scope: "kit";
  validUntil?: string | null;
  maxUses?: number | null;
  uses: number;
  active: boolean;
  note: string;
  createdAt: string;
}
export type CouponInput = Pick<Coupon, "code" | "kind" | "value" | "validUntil" | "maxUses" | "note">;
export const COUPON_RE = /^[A-Z0-9]{3,24}$/;

/** السعر بعد الكوبون بالهللة، أو null إن لم يكن صالحاً (مطابق لـ coupon_price) */
export function priceWith(c: Pick<Coupon, "kind" | "value" | "active" | "validUntil" | "maxUses" | "uses">, base: number, today = new Date().toISOString().slice(0, 10)) {
  if (!c.active || base <= 0 || (c.validUntil && c.validUntil < today) || (c.maxUses != null && c.uses >= c.maxUses)) return null;
  // بالهللة صحيحةً (لا أخطاء الكسور العشرية) لتطابق coupon_price حرفياً
  return c.kind === "pct" ? Math.max(base - Math.round((base * Math.round(c.value * 100)) / 10000 + 1e-9), 0) : Math.max(base - Math.round(c.value * 100), 0);
}

export interface PricingRepo {
  policy(a: PActor): Promise<PricingPolicy>;
  /** يدمج التعديل مع السياسة الحالية (بطاقتان تحفظان أجزاء مختلفة منها) */
  savePolicy(patch: Partial<PricingPolicy>, a: PActor): Promise<void>;
  coupons(a: PActor): Promise<Coupon[]>;
  saveCoupon(c: CouponInput, a: PActor): Promise<void>;
  setCouponActive(code: string, active: boolean, a: PActor): Promise<void>;
  /** للزائر: السعر بعد الكوبون (هللة) أو null */
  couponPrice(code: string, base: number): Promise<number | null>;
}

function checkPolicy(p: PricingPolicy) {
  if (Object.values(p.discountCaps).some((v) => !(Number(v) >= 0 && Number(v) <= 100))) throw new ValidationError("discount_caps");
  if (!(p.marginFloor >= 0 && p.marginFloor <= 100)) throw new ValidationError("margin_floor");
}
function checkCoupon(c: CouponInput) {
  if (!COUPON_RE.test(c.code.trim().toUpperCase())) throw new ValidationError("coupon_code");
  if (!(c.value > 0) || (c.kind === "pct" && c.value > 100)) throw new ValidationError("coupon_value");
  if (c.maxUses != null && !(Number.isInteger(c.maxUses) && c.maxUses > 0)) throw new ValidationError("coupon_max");
}

// ─── الوضع التجريبي ───────────────────────────────────────────────
const KEY = "pp_pricing_v1";
interface Store {
  policy: PricingPolicy;
  coupons: Coupon[];
}
function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* افتراضي */
  }
  return { policy: DEFAULT_POLICY, coupons: [] };
}
function write(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
/** الوضع التجريبي: تُقرأ في مستودع المشاريع عند إرسال العرض */
export const localPolicy = () => read().policy;
/** الوضع التجريبي: تسجيل استخدام كوبون بعد الدفع */
export function localRedeem(code: string) {
  const s = read();
  s.coupons = s.coupons.map((c) => (c.code === code.toUpperCase() ? { ...c, uses: c.uses + 1 } : c));
  write(s);
}

const localRepo: PricingRepo = {
  async policy() {
    return read().policy;
  },
  async savePolicy(patch, a) {
    if (!can(a.role, "pricing.manage")) throw new PermissionError("pricing.manage");
    const p = { ...read().policy, ...patch };
    checkPolicy(p);
    write({ ...read(), policy: p });
  },
  async coupons(a) {
    return can(a.role, "pricing.manage") ? read().coupons : [];
  },
  async saveCoupon(c, a) {
    if (!can(a.role, "pricing.manage")) throw new PermissionError("pricing.manage");
    checkCoupon(c);
    const s = read();
    const code = c.code.trim().toUpperCase();
    if (s.coupons.some((x) => x.code === code)) throw new ValidationError("coupon_taken");
    s.coupons.unshift({ ...c, code, scope: "kit", uses: 0, active: true, createdAt: new Date().toISOString() });
    write(s);
  },
  async setCouponActive(code, active, a) {
    if (!can(a.role, "pricing.manage")) throw new PermissionError("pricing.manage");
    const s = read();
    s.coupons = s.coupons.map((x) => (x.code === code ? { ...x, active } : x));
    write(s);
  },
  async couponPrice(code, base) {
    const c = read().coupons.find((x) => x.code === code.trim().toUpperCase());
    return c ? priceWith(c, base) : null;
  },
};

// ─── Supabase ────────────────────────────────────────────────────
function remoteRepo(): PricingRepo {
  const db = supabase!;
  const fail = (e: { message: string; code?: string } | null) => {
    if (!e) return;
    if (e.code === "23505") throw new ValidationError("coupon_taken");
    if (/permission|row-level security/i.test(e.message)) throw new PermissionError("pricing.manage");
    for (const code of ["discount_caps", "margin_floor"]) if (e.message.includes(code)) throw new ValidationError(code);
    if (e.message.includes("coupons_code_check")) throw new ValidationError("coupon_code");
    if (e.message.includes("coupons_check") || e.message.includes("coupons_value_check")) throw new ValidationError("coupon_value");
    throw new Error(e.message);
  };
  return {
    async policy() {
      const { data, error } = await db.from("business_settings").select("value").maybeSingle();
      fail(error);
      const v = (data?.value ?? {}) as { discount_caps?: Record<string, number>; margin_floor?: number; captcha_required?: boolean };
      return { discountCaps: v.discount_caps ?? DEFAULT_POLICY.discountCaps, marginFloor: v.margin_floor ?? DEFAULT_POLICY.marginFloor, captchaRequired: v.captcha_required === true };
    },
    async savePolicy(patch, a) {
      const p = { ...(await this.policy(a)), ...patch };
      checkPolicy(p);
      const { error, count } = await db.from("business_settings").update({ value: { discount_caps: p.discountCaps, margin_floor: p.marginFloor, captcha_required: p.captchaRequired === true } }, { count: "exact" }).eq("id", true);
      fail(error);
      if (count === 0) throw new PermissionError("pricing.manage");
    },
    async coupons() {
      const { data, error } = await db.from("coupons").select("*").order("created_at", { ascending: false });
      fail(error);
      return (data ?? []).map((r) => ({ code: r.code, kind: r.kind, value: Number(r.value), scope: r.scope, validUntil: r.valid_until, maxUses: r.max_uses, uses: r.uses, active: r.active, note: r.note ?? "", createdAt: r.created_at }));
    },
    async saveCoupon(c) {
      checkCoupon(c);
      const { error } = await db.from("coupons").insert({ code: c.code.trim().toUpperCase(), kind: c.kind, value: c.value, valid_until: c.validUntil || null, max_uses: c.maxUses ?? null, note: c.note });
      fail(error);
    },
    async setCouponActive(code, active) {
      const { error } = await db.from("coupons").update({ active }).eq("code", code);
      fail(error);
    },
    async couponPrice(code, base) {
      const { data, error } = await db.rpc("coupon_price", { p_code: code, p_scope: "kit", p_base: base });
      if (error?.message.includes("rate_limited")) throw new ValidationError("rate_limited");
      if (error) return null;
      return data == null ? null : Number(data);
    },
  };
}

export const pricingRepo: PricingRepo = supabase ? remoteRepo() : localRepo;
