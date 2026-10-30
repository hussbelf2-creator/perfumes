// Vercel Function: يتحقق من دفعة مويسر بالمفتاح السري ويطابق المبلغ والعملة.
// العميل لا يُعتمد على معاملات رابط العودة (status=paid) لأنها قابلة للتلاعب.
//
// المتغيرات (في Vercel → Settings → Environment Variables، بدون بادئة VITE_):
//   MOYASAR_SECRET_KEY          sk_test_... أو sk_live_...  (إلزامي)
//   KIT_PRICE_HALALAS           المبلغ المتوقع بالهللة (افتراضي 75000 = 750 ر.س)
//   SUPABASE_URL                اختياري: لتسجيل الدفعة في جدول payments
//   SUPABASE_SERVICE_ROLE_KEY   اختياري: مفتاح الخادم — لا يوضع أبداً في متغيرات VITE_
//                               (إلزامي لعربون عروض الأسعار: يقرأ مبلغ العرض ويسجّل الدفعة)

interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string> | null;
  source?: { type?: string; company?: string } | null;
}

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

async function record(p: MoyasarPayment) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/payments?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: p.id,
        order_ref: p.metadata?.order_ref ?? null,
        kind: p.metadata?.kind ?? null,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.source?.company || p.source?.type || null,
        email: p.metadata?.email ?? null,
      }),
    });
  } catch {
    // فشل التسجيل لا يُفشل التحقق — الدفعة مسجّلة في لوحة مويسر على أي حال
  }
}

async function rpc(name: string, body: unknown): Promise<unknown> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** سعر العينة بالهللة: المنشور في وثيقة الأسعار، وإلا KIT_PRICE_HALALAS، وإلا 750 ر.س.
 *  null = تعذّرت قراءة الأسعار (لا نحكم على دفعة بسعر احتياطي قد يخالف المنشور) */
async function kitPrice(): Promise<number | null> {
  const fallback = Number(process.env.KIT_PRICE_HALALAS || 75000);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fallback;
  try {
    const r = await fetch(`${url}/rest/v1/site_content?key=eq.pricing&select=value`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const [row] = (await r.json()) as { value?: { kit?: { price?: number } } }[];
    const sar = Number(row?.value?.kit?.price);
    return Number.isFinite(sar) && sar > 0 ? Math.round(sar * 100) : fallback;
  } catch {
    return null;
  }
}

/** السعر بعد الكوبون (هللة) أو null إن لم يكن صالحاً */
async function couponPrice(code: string, base: number): Promise<number | null> {
  const r = await rpc("coupon_price", { p_code: code, p_scope: "kit", p_base: base });
  return typeof r === "number" ? r : null;
}

/** استخدام كوبون سُجّل لهذه الدفعة سابقاً (التحقق يتكرر عند تحديث صفحة النجاح) */
async function priorRedemption(paymentId: string): Promise<number | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/coupon_redemptions?payment_id=eq.${encodeURIComponent(paymentId)}&select=amount`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const [row] = r.ok ? ((await r.json()) as { amount: number }[]) : [];
    return row ? Number(row.amount) : null;
  } catch {
    return null;
  }
}

async function deposit(p: MoyasarPayment): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const quote = p.metadata?.quote_id ?? "";
  if (!url || !key) return json({ paid: false, status: "not_configured" }, 503);
  if (!ID_RE.test(quote)) return json({ paid: false, status: "invalid_quote" }, 400);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    const r = await fetch(`${url}/rest/v1/project_quotes?id=eq.${quote}&select=ref,deposit,status`, { headers });
    const [q] = r.ok ? ((await r.json()) as { ref: string; deposit: number; status: string }[]) : [];
    if (!q) return json({ paid: false, status: "quote_not_found" }, 404);
    if (p.status !== "paid") return json({ paid: false, status: p.status, ref: q.ref, id: p.id });
    if (p.currency !== "SAR" || p.amount !== Math.round(Number(q.deposit) * 100)) {
      await record({ ...p, status: "amount_mismatch" });
      return json({ paid: false, status: "amount_mismatch", ref: q.ref, id: p.id });
    }
    const rr = await fetch(`${url}/rest/v1/rpc/record_deposit`, { method: "POST", headers, body: JSON.stringify({ p_quote: quote, p_payment: p.id, p_halalas: p.amount }) });
    const outcome = rr.ok ? ((await rr.json()) as string) : "record_failed";
    // مُحصّلة لدى مويسر لكن العرض دُفع بغيرها أو لم يعد معتمداً: تحتاج مراجعة واسترداداً، لا «فشل الدفع»
    const review = outcome === "already_paid" || outcome === "not_accepted";
    await record({ ...p, status: outcome === "paid" ? "paid" : review ? "needs_review" : p.status, metadata: { ...p.metadata, order_ref: q.ref } });
    if (review) return json({ paid: false, status: "needs_review", reason: outcome, amount: p.amount, ref: q.ref, id: p.id }, 409);
    return json({ paid: outcome === "paid", status: outcome, amount: p.amount, ref: q.ref, id: p.id }, outcome === "record_failed" ? 502 : 200);
  } catch {
    return json({ paid: false, status: "db_unreachable" }, 502);
  }
}

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID_RE.test(id)) return json({ paid: false, status: "invalid_id" }, 400);

  const secret = process.env.MOYASAR_SECRET_KEY;
  if (!secret) return json({ paid: false, status: "not_configured" }, 503);

  let p: MoyasarPayment;
  try {
    const r = await fetch(`https://api.moyasar.com/v1/payments/${id}`, {
      headers: { Authorization: `Basic ${btoa(`${secret}:`)}`, Accept: "application/json" },
    });
    if (r.status === 404) return json({ paid: false, status: "not_found" }, 404);
    if (!r.ok) return json({ paid: false, status: "gateway_error" }, 502);
    p = (await r.json()) as MoyasarPayment;
  } catch {
    return json({ paid: false, status: "gateway_unreachable" }, 502);
  }

  // عربون عرض سعر: المبلغ المتوقع من العرض نفسه في قاعدة البيانات، والتسجيل عبر record_deposit
  if (p.metadata?.kind === "deposit") return deposit(p);

  // السعر من وثيقة «الأسعار» المنشورة (تُعدَّل من اللوحة)، والكوبون يحسبه الخادم لا المتصفح
  const base = await kitPrice();
  if (base === null) return json({ paid: false, status: "pricing_unavailable" }, 502);
  const coupon = p.metadata?.coupon ? String(p.metadata.coupon) : "";
  // كوبون سُجّل لهذه الدفعة: نقارن بالمبلغ المسجّل (الكوبون قد استُنفد أو انتهى بعدها)
  const prior = coupon ? await priorRedemption(p.id) : null;
  const expected = prior ?? (coupon ? await couponPrice(coupon, base) : base);
  const amountOk = expected !== null && p.amount === expected && p.currency === "SAR";
  let paid = p.status === "paid" && amountOk;
  let status = p.status === "paid" && !amountOk ? "amount_mismatch" : p.status;
  // أول تحقق: يُحتسب الكوبون الآن؛ إن سبقنا مشترٍ آخر لآخر استخدام فالدفعة تحتاج مراجعة
  if (paid && coupon && prior === null) {
    const redeemed = await rpc("redeem_coupon", { p_code: coupon, p_scope: "kit", p_payment: p.id, p_base: base, p_paid: p.amount });
    if (redeemed !== "ok") {
      paid = false;
      status = "needs_review";
    }
  }
  // المسجَّل هو نتيجة التحقق لا حالة مويسر الخام: دفعة بمبلغ معدَّل لا تظهر «مدفوعة» في اللوحة
  await record({ ...p, status: paid ? "paid" : status });

  return json({
    paid,
    status,
    amount: p.amount,
    ref: p.metadata?.order_ref,
    id: p.id,
  });
}
