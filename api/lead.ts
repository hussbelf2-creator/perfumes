// Vercel Function: استقبال طلبات الموقع بعد التحقق البشري (Cloudflare Turnstile).
// يعمل فقط حين تُضبط VITE_TURNSTILE_SITE_KEY في الواجهة: يرسل المتصفح الطلب ورمز التحقق إلى هنا،
// فنتحقق من الرمز لدى Cloudflare ثم نحفظ الطلب بمفتاح الخدمة مع عنوان الزائر الحقيقي
// (حدود الإرسال لكل عنوان وبريد يفرضها مُشغّل lead_flood_guard في قاعدة البيانات).
//
// المتغيرات (Vercel → Settings → Environment Variables، بدون بادئة VITE_):
//   TURNSTILE_SECRET_KEY        المفتاح السري من لوحة Cloudflare Turnstile (إلزامي)
//   SUPABASE_URL                رابط مشروع Supabase (إلزامي)
//   SUPABASE_SERVICE_ROLE_KEY   مفتاح الخادم — لا يوضع أبداً في متغيرات VITE_ (إلزامي)

const KINDS = ["contact", "consultation", "newsletter", "booking", "kit", "design", "brief"] as const;
const MAX_PAYLOAD = 16_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** عنوان الزائر كما تمرره Vercel (أول عنوان في x-forwarded-for هو العميل) */
export function clientIp(h: Headers): string | null {
  const v = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "";
  const ip = v.trim().slice(0, 64);
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
}

export interface LeadInput {
  kind: (typeof KINDS)[number];
  payload: Record<string, string>;
  page: string | null;
  token: string;
}

/** يتحقق من شكل الطلب قبل أي اتصال خارجي */
export function parseLead(body: unknown): LeadInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!KINDS.includes(b.kind as LeadInput["kind"])) return null;
  if (typeof b.token !== "string" || !b.token || b.token.length > 4096) return null;
  if (!b.payload || typeof b.payload !== "object" || Array.isArray(b.payload)) return null;
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.payload as Record<string, unknown>)) {
    if (typeof v !== "string" || k.length > 64) return null;
    payload[k] = v.slice(0, 5000);
  }
  if (JSON.stringify(payload).length > MAX_PAYLOAD) return null;
  const page = typeof b.page === "string" && b.page.startsWith("/") ? b.page.slice(0, 200) : null;
  return { kind: b.kind as LeadInput["kind"], payload, page, token: b.token };
}

/** true/false من Cloudflare، وnull إن تعذّر الوصول إليه (خطأ خادم لا «فشل التحقق») */
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean | null> {
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  if (ip) form.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    if (!r.ok) return null;
    const d = (await r.json()) as { success?: boolean };
    return d.success === true;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.TURNSTILE_SECRET_KEY || !url || !key) return json({ error: "not_configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const lead = parseLead(body);
  if (!lead) return json({ error: "bad_request" }, 400);

  const ip = clientIp(request.headers);
  const human = await verifyTurnstile(lead.token, ip);
  if (human === null) return json({ error: "captcha_unavailable" }, 502);
  if (!human) return json({ error: "captcha_failed" }, 403);

  let r: Response;
  try {
    r = await fetch(`${url}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(ip ? { "x-client-ip": ip } : {}),
    },
    body: JSON.stringify({ kind: lead.kind, payload: lead.payload, page: lead.page }),
    });
  } catch {
    return json({ error: "failed" }, 502);
  }
  if (r.ok) return json({ ok: true });
  const text = await r.text();
  if (text.includes("rate_limited")) return json({ error: "rate_limited" }, 429);
  return json({ error: "failed" }, 502);
}
