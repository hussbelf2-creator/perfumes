import { supabase } from "@/lib/supabase";
import { extractProfile, DEFAULT_EXTRACT, type PixelData } from "./profile";
import { putBlob } from "./blobStore";

// تحويل صورة إلى نموذج 3D بالذكاء الاصطناعي.
//   server: عبر /api/ai3d (Meshy أو fal.ai) — يتطلب Supabase ومفتاح المزوّد على الخادم
//   demo:   محاكاة محلية واضحة التسمية: نموذج من المقطع مكسوّ بالصورة نفسها، لتجربة المسار كاملاً

export type AiStatus = "queued" | "running" | "succeeded" | "failed";
export interface AiJobState {
  status: AiStatus;
  progress: number;
  glbUrl?: string | null;
  usdzUrl?: string | null;
  error?: string | null;
}

export const AI_MODE: "server" | "demo" = supabase ? "server" : "demo";

/** يصغّر الصورة (أقصى ضلع 1024) ويحافظ على الشفافية إن وُجدت */
export async function prepareImage(file: Blob): Promise<{ dataUrl: string; px: PixelData; blob: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    let alpha = false;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 250) { alpha = true; break; }
    const type = alpha ? "image/png" : "image/jpeg";
    const dataUrl = cv.toDataURL(type, 0.9);
    const blob = await new Promise<Blob>((res) => cv.toBlob((b) => res(b!), type, 0.9));
    return { dataUrl, px: { data, width: w, height: h }, blob };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase!.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export class AiError extends Error {}

// ─── المحاكاة (الوضع التجريبي) ─────────────────────────────────────
const demoJobs = new Map<string, { start: number; done?: AiJobState; image: { dataUrl: string; px: PixelData }; heightMm: number }>();
const DEMO_MS = 6000;

async function simulateGlb(job: { image: { dataUrl: string; px: PixelData }; heightMm: number }, key: string): Promise<string> {
  const ex = extractProfile(job.image.px, { ...DEFAULT_EXTRACT, heightMm: job.heightMm });
  if (!ex) throw new AiError("no_subject");
  const three = await import("three");
  const { buildLoft } = await import("./geometry");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const geo = buildLoft(ex.profile, { squareness: 2, depthRatio: 1, segments: 96 });
  // إسقاط الصورة من الأمام على المجسم: كل نقطة تأخذ لون البكسل المقابل لها في الصورة
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  const { width, height } = job.image.px;
  const scale = (ex.bottom - ex.top) / job.heightMm;
  for (let i = 0; i < pos.count; i++) {
    const xPx = ex.axisX + pos.getX(i) * scale;
    const yPx = ex.bottom - pos.getY(i) * scale;
    uv.setXY(i, Math.min(1, Math.max(0, xPx / width)), Math.min(1, Math.max(0, 1 - yPx / height)));
  }
  const img = new Image();
  img.src = job.image.dataUrl;
  await img.decode();
  const tex = new three.Texture(img);
  tex.colorSpace = three.SRGBColorSpace;
  tex.flipY = true;
  tex.needsUpdate = true;
  const mesh = new three.Mesh(geo, new three.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0 }));
  mesh.scale.setScalar(0.001);
  const out = (await new GLTFExporter().parseAsync(mesh, { binary: true })) as ArrayBuffer;
  geo.dispose();
  tex.dispose();
  await putBlob(key, new Blob([out], { type: "model/gltf-binary" }));
  return `idb:${key}`;
}

// ─── الواجهة ──────────────────────────────────────────────────────
export async function startAiJob(image: { dataUrl: string; px: PixelData }, heightMm: number): Promise<string> {
  if (AI_MODE === "demo") {
    const id = `demo-${Date.now().toString(36)}`;
    demoJobs.set(id, { start: Date.now(), image, heightMm });
    return id;
  }
  const r = await fetch("/api/ai3d", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ image: image.dataUrl }) });
  const d = (await r.json().catch(() => ({}))) as { jobId?: string; error?: string };
  if (!r.ok || !d.jobId) throw new AiError(d.error || `http_${r.status}`);
  return d.jobId;
}

export async function getAiJob(id: string): Promise<AiJobState> {
  if (AI_MODE === "demo") {
    const job = demoJobs.get(id);
    if (!job) return { status: "failed", progress: 0, error: "not_found" };
    if (job.done) return job.done;
    const p = Math.min(99, Math.round(((Date.now() - job.start) / DEMO_MS) * 100));
    if (p < 99) return { status: p < 12 ? "queued" : "running", progress: p };
    try {
      job.done = { status: "succeeded", progress: 100, glbUrl: await simulateGlb(job, id) };
    } catch (e) {
      job.done = { status: "failed", progress: 0, error: e instanceof Error ? e.message : "failed" };
    }
    return job.done;
  }
  const r = await fetch(`/api/ai3d?id=${encodeURIComponent(id)}`, { headers: await authHeader() });
  const d = (await r.json().catch(() => ({}))) as AiJobState & { error?: string };
  if (!r.ok) throw new AiError(d.error || `http_${r.status}`);
  return d;
}
