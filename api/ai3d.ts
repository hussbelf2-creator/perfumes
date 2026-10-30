// Vercel Function: تحويل صورة منتج إلى نموذج 3D بالذكاء الاصطناعي.
//
//   POST /api/ai3d            { image: dataURI, name?: string }  → { jobId }
//   GET  /api/ai3d?id=<jobId>                                    → { status, progress, glbUrl?, usdzUrl?, error? }
//
// المزوّد يُختار بمتغير AI3D_PROVIDER: "meshy" (افتراضي) أو "fal" (TRELLIS 2).
// المفتاح على الخادم فقط. لا يُنشأ طلب مدفوع إلا لمستخدم يملك صلاحية studio.manage.
// عند النجاح يُنسخ GLB (وUSDZ إن وُجد) إلى Supabase Storage لأن روابط المزوّد مؤقتة.
//
// المتغيرات (Vercel → Environment Variables، بدون بادئة VITE_):
//   AI3D_PROVIDER            meshy | fal
//   MESHY_API_KEY            لمزوّد Meshy
//   MESHY_AI_MODEL           اختياري (يُترك فارغاً = أحدث نموذج افتراضي لدى Meshy)
//   FAL_KEY                  لمزوّد fal.ai
//   FAL_MODEL                اختياري (افتراضي fal-ai/trellis-2)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

type Json = Record<string, unknown>;
type Status = "queued" | "running" | "succeeded" | "failed";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_MODEL_BYTES = 60 * 1024 * 1024;
const BUCKET = "models";
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const env = (k: string) => process.env[k] || "";

// ─── التحقق من هوية المستخدم وصلاحيته (بتوكنه هو، فتطبّق RLS ودالة has_perm) ───
async function authorize(request: Request): Promise<{ token: string; userId: string } | Response> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const url = env("SUPABASE_URL"), anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon || !env("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "not_configured" }, 503);
  if (!token) return json({ error: "unauthorized" }, 401);
  const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return json({ error: "unauthorized" }, 401);
  const user = (await u.json()) as { id?: string };
  const p = await fetch(`${url}/rest/v1/rpc/has_perm`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p: "studio.manage" }),
  });
  if (!p.ok || (await p.json()) !== true || !user.id) return json({ error: "forbidden" }, 403);
  return { token, userId: user.id };
}

// ─── جدول المهام (بمفتاح الخدمة: الحالة يكتبها الخادم فقط) ───────────
async function db(path: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
}

// ─── المزوّدون ────────────────────────────────────────────────────
interface Provider {
  name: string;
  submit(image: string): Promise<{ taskId: string; meta?: Json }>;
  poll(taskId: string, meta: Json): Promise<{ status: Status; progress: number; glb?: string; usdz?: string; error?: string }>;
}

const meshy: Provider = {
  name: "meshy",
  async submit(image) {
    const body: Json = { image_url: image, should_texture: true, enable_pbr: true };
    if (env("MESHY_AI_MODEL")) body.ai_model = env("MESHY_AI_MODEL");
    const r = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("MESHY_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok || typeof d.result !== "string") throw new Error(`meshy_submit_${r.status}:${String(d.message ?? "")}`);
    return { taskId: d.result };
  },
  async poll(taskId) {
    const r = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${env("MESHY_API_KEY")}` } });
    const d = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) return { status: "failed", progress: 0, error: `meshy_poll_${r.status}` };
    const s = String(d.status);
    const urls = (d.model_urls ?? {}) as Json;
    if (s === "SUCCEEDED") return { status: "succeeded", progress: 100, glb: urls.glb as string | undefined, usdz: urls.usdz as string | undefined };
    if (s === "FAILED" || s === "CANCELED" || s === "EXPIRED") return { status: "failed", progress: 0, error: String((d.task_error as Json | undefined)?.message || s) };
    return { status: s === "PENDING" ? "queued" : "running", progress: Number(d.progress ?? 0) };
  },
};

const fal: Provider = {
  name: "fal",
  async submit(image) {
    const model = env("FAL_MODEL") || "fal-ai/trellis-2";
    const r = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${env("FAL_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: image }),
    });
    const d = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok || typeof d.request_id !== "string") throw new Error(`fal_submit_${r.status}`);
    // نستخدم الروابط التي يعيدها fal نفسه بدل تركيبها
    return { taskId: d.request_id, meta: { status_url: d.status_url, response_url: d.response_url } };
  },
  async poll(_taskId, meta) {
    const headers = { Authorization: `Key ${env("FAL_KEY")}` };
    const sr = await fetch(String(meta.status_url), { headers });
    const s = (await sr.json().catch(() => ({}))) as Json;
    if (!sr.ok) return { status: "failed", progress: 0, error: `fal_status_${sr.status}` };
    if (s.status === "IN_QUEUE") return { status: "queued", progress: 5 };
    if (s.status === "IN_PROGRESS") return { status: "running", progress: 50 };
    if (s.status !== "COMPLETED") return { status: "failed", progress: 0, error: String(s.status) };
    const rr = await fetch(String(meta.response_url), { headers });
    const d = (await rr.json().catch(() => ({}))) as Json;
    const file = (d.model_glb ?? d.model_mesh) as Json | undefined;
    if (!rr.ok || !file?.url) return { status: "failed", progress: 0, error: String((d.detail as string) || "fal_no_model") };
    return { status: "succeeded", progress: 100, glb: String(file.url) };
  },
};

function provider(): Provider | null {
  const p = (env("AI3D_PROVIDER") || "meshy").toLowerCase();
  if (p === "meshy" && env("MESHY_API_KEY")) return meshy;
  if (p === "fal" && env("FAL_KEY")) return fal;
  return null;
}

/** ينسخ الملف من رابط المزوّد المؤقت إلى تخزيننا الدائم */
async function persist(src: string, path: string, type: string, magic?: string): Promise<string> {
  if (!/^https:\/\//i.test(src)) throw new Error("insecure_asset_url");
  const r = await fetch(src);
  if (!r.ok) throw new Error(`download_${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_MODEL_BYTES) throw new Error("model_too_large");
  if (magic && String.fromCharCode(...buf.slice(0, magic.length)) !== magic) throw new Error("not_a_" + magic);
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const up = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": type, "x-upsert": "true", "Cache-Control": "31536000" },
    body: buf,
  });
  if (!up.ok) throw new Error(`upload_${up.status}`);
  return `${env("SUPABASE_URL")}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(request: Request): Promise<Response> {
  const prov = provider();
  if (!prov) return json({ error: "provider_not_configured" }, 503);
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  const body = (await request.json().catch(() => null)) as { image?: string } | null;
  const image = body?.image ?? "";
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) return json({ error: "invalid_image" }, 400);
  if ((m[2].length * 3) / 4 > MAX_IMAGE_BYTES) return json({ error: "image_too_large" }, 413);

  let task: { taskId: string; meta?: Json };
  try {
    task = await prov.submit(image);
  } catch (e) {
    return json({ error: "provider_error", detail: e instanceof Error ? e.message.slice(0, 160) : "" }, 502);
  }
  const ins = await db("ai3d_jobs", {
    method: "POST",
    body: JSON.stringify({ provider: prov.name, provider_task_id: task.taskId, meta: task.meta ?? {}, status: "queued", progress: 0, created_by: auth.userId }),
  });
  if (!ins.ok) return json({ error: "db_error" }, 500);
  const [row] = (await ins.json()) as { id: string }[];
  return json({ jobId: row.id, provider: prov.name }, 202);
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID_RE.test(id)) return json({ error: "invalid_id" }, 400);

  const r = await db(`ai3d_jobs?id=eq.${id}&select=*`);
  const [job] = ((await r.json().catch(() => [])) as Json[]) ?? [];
  if (!job) return json({ error: "not_found" }, 404);
  // منتهية: نعيد المحفوظ دون الاتصال بالمزوّد مرة أخرى
  if (job.status === "succeeded" || job.status === "failed") {
    return json({ status: job.status, progress: job.progress, glbUrl: job.glb_url, usdzUrl: job.usdz_url, error: job.error });
  }
  const prov = job.provider === "fal" ? fal : meshy;
  let st: Awaited<ReturnType<Provider["poll"]>>;
  try {
    st = await prov.poll(String(job.provider_task_id), (job.meta as Json) ?? {});
  } catch {
    return json({ status: job.status, progress: job.progress }); // عطل مؤقت: نعيد آخر حالة ونحاول لاحقاً
  }
  const patch: Json = { status: st.status, progress: Math.max(0, Math.min(100, Math.round(st.progress))), updated_at: new Date().toISOString() };
  if (st.status === "succeeded") {
    try {
      if (!st.glb) throw new Error("no_glb");
      patch.glb_url = await persist(st.glb, `ai/${id}.glb`, "model/gltf-binary", "glTF");
      if (st.usdz) patch.usdz_url = await persist(st.usdz, `ai/${id}.usdz`, "model/vnd.usdz+zip").catch(() => null);
    } catch (e) {
      patch.status = "failed";
      patch.error = e instanceof Error ? e.message.slice(0, 160) : "persist_failed";
    }
  } else if (st.status === "failed") {
    patch.error = (st.error || "failed").slice(0, 160);
  }
  await db(`ai3d_jobs?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return json({ status: patch.status, progress: patch.progress, glbUrl: patch.glb_url, usdzUrl: patch.usdz_url, error: patch.error });
}
