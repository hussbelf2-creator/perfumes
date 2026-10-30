// Vercel Function: إشعار فوري للفريق بكل طلب يصل من الموقع (Supabase Database Webhook على جدول leads).
// الطلب الوارد يُحفظ أولاً في قاعدة البيانات؛ هذه الدالة تنبّه فقط، ففشلها لا يضيّع طلباً.
//
// الإعداد في Supabase: Database → Webhooks → Create
//   الجدول public.leads · الحدث Insert · HTTP Request · POST إلى https://<نطاقك>/api/lead-notify
//   وأضف ترويسة  x-webhook-secret: <نفس قيمة LEAD_WEBHOOK_SECRET>
//
// المتغيرات (Vercel → Settings → Environment Variables، بدون بادئة VITE_). كل قناة تعمل متى اكتملت متغيراتها:
//   LEAD_WEBHOOK_SECRET   إلزامي — سر مشترك مع الـWebhook (32 حرفاً على الأقل)
//   SITE_URL              رابط الموقع لفتح الطلب من الإشعار (مثل https://example.sa)
//   NOTIFY_KINDS          اختياري: أنواع الطلبات (افتراضياً كلها عدا النشرة)
//   واتساب (WhatsApp Cloud API): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, NOTIFY_WHATSAPP_TO (أرقام بصيغة 9665xxxxxxxx مفصولة بفواصل),
//                                WHATSAPP_TEMPLATE (قالب معتمد بمتغير نصي واحد في المتن), WHATSAPP_TEMPLATE_LANG (افتراضي ar)
//   البريد (Resend):            RESEND_API_KEY, NOTIFY_EMAIL_TO (مفصولة بفواصل), NOTIFY_EMAIL_FROM (من نطاق موثّق لدى Resend)
//   Webhook عام (Slack/Discord/Make/Zapier): NOTIFY_WEBHOOK_URL (https)

import { timingSafeEqual } from "node:crypto";

/** نص الزائر لا يتحول في Slack/Discord إلى إشارات (<!channel>) أو روابط مقنّعة */
const chatSafe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@(everyone|here)/g, "@\u200b$1");
import { briefLines } from "../src/start/briefs";

interface Lead {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at?: string;
}

const KIND_TITLES: Record<string, string> = {
  brief: "طلب «ابدأ مسارك»",
  booking: "حجز مكالمة اكتشاف",
  kit: "طلب عينة الاكتشاف",
  design: "طلب تصميم",
  contact: "رسالة من الموقع",
  consultation: "طلب استشارة",
};
const DEFAULT_KINDS = Object.keys(KIND_TITLES);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const list = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pickAr = (b: { ar: string }) => b.ar;
const tAr = (ar: string) => ar;

function secretOk(got: string | null, want: string) {
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** نص الإشعار: العنوان، من؟ كيف نتواصل؟ ماذا يريد؟ ورابط فتح الطلب */
export function compose(lead: Lead, site: string) {
  const p = Object.fromEntries(Object.entries(lead.payload ?? {}).map(([k, v]) => [k, String(v ?? "").trim()]));
  const title = KIND_TITLES[lead.kind] ?? "طلب جديد";
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
  const what: string[] = [];
  if (lead.kind === "brief") {
    if (p.track_title) what.push(p.track_title);
    for (const l of briefLines(p, pickAr, tAr)) what.push(`${l.q} ${clip(l.a, 160)}`);
  } else {
    for (const k of ["subject", "service", "creative_name", "order_ref", "message"]) if (p[k]) what.push(clip(p[k], 300));
  }
  const link = site ? `${site.replace(/\/$/, "")}/admin/inbox?open=${encodeURIComponent(lead.id)}` : "";
  const contact = [p.phone, p.email].filter(Boolean).join(" · ");
  const text = [`${title} — ${name}`, contact, ...what, link].filter(Boolean).join("\n");
  // متغيرات قوالب واتساب لا تقبل أسطراً جديدة ولا مسافات متتالية طويلة
  const oneLine = clip([`${title}: ${name}`, contact, ...what.slice(0, 3)].filter(Boolean).join(" | ").replace(/\s+/g, " "), 900);
  // الاسم من نموذج عام: لا أسطر في عنوان البريد (يرفضه مزوّد البريد فيضيع التنبيه)
  return { subject: `${title} — ${name}`.replace(/[\r\n]+/g, " ").slice(0, 200), text, oneLine, link };
}

async function send(name: string, url: string, init: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  return name;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.LEAD_WEBHOOK_SECRET ?? "";
  if (secret.length < 32) return json({ ok: false, error: "not_configured" }, 503);
  if (!secretOk(request.headers.get("x-webhook-secret"), secret)) return json({ ok: false, error: "unauthorized" }, 401);

  let body: { type?: string; table?: string; record?: Lead };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const lead = body.record;
  if (body.type !== "INSERT" || body.table !== "leads" || !lead?.id || typeof lead.kind !== "string") return json({ ok: true, skipped: "not_a_new_lead" });
  const kinds = list(process.env.NOTIFY_KINDS);
  if (!(kinds.length ? kinds : DEFAULT_KINDS).includes(lead.kind)) return json({ ok: true, skipped: "kind" });

  const msg = compose(lead, process.env.SITE_URL ?? "");
  const jobs: Promise<string>[] = [];

  const wa = { token: process.env.WHATSAPP_TOKEN, phone: process.env.WHATSAPP_PHONE_NUMBER_ID, template: process.env.WHATSAPP_TEMPLATE, to: list(process.env.NOTIFY_WHATSAPP_TO) };
  if (wa.token && wa.phone && wa.template && wa.to.length) {
    for (const to of wa.to)
      jobs.push(
        send("whatsapp", `https://graph.facebook.com/v21.0/${encodeURIComponent(wa.phone)}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${wa.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ""),
            type: "template",
            template: { name: wa.template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "ar" }, components: [{ type: "body", parameters: [{ type: "text", text: msg.oneLine }] }] },
          }),
        }),
      );
  }

  const mail = { key: process.env.RESEND_API_KEY, to: list(process.env.NOTIFY_EMAIL_TO), from: process.env.NOTIFY_EMAIL_FROM };
  if (mail.key && mail.to.length && mail.from) {
    jobs.push(
      send("email", "https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${mail.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: mail.from, to: mail.to, subject: msg.subject, text: msg.text }),
      }),
    );
  }

  const hook = process.env.NOTIFY_WEBHOOK_URL;
  if (hook?.startsWith("https://")) {
    // text لـSlack وcontent لـDiscord؛ والبقية تقرأ الحقول المنظمة
    jobs.push(send("webhook", hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chatSafe(msg.text), content: clip(chatSafe(msg.text), 1900), kind: lead.kind, lead_id: lead.id, link: msg.link }) }));
  }

  if (!jobs.length) return json({ ok: false, error: "no_channel" }, 503);
  const results = await Promise.allSettled(jobs);
  const sent = results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => String(r.reason?.message ?? r.reason));
  return json({ ok: sent.length > 0, sent, failed }, sent.length ? 200 : 502);
}
