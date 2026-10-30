import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getBlob, putBlob } from "@/studio/blobStore";

// صور الأعمال: تُصغَّر في المتصفح قبل الرفع (أقصى ضلع 1600 بكسل، WebP)،
// ثم تُحفظ في Supabase Storage (حاوية portfolio للأعمال، وsite لصور المحتوى) أو في IndexedDB في الوضع التجريبي (idb:<مفتاح>).

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGES = 12;

export async function compressImage(file: File | Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("too_large");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", quality));
    if (!out) throw new Error("encode_failed");
    return out;
  } catch (e) {
    throw e instanceof Error && e.message !== "encode_failed" && e.message !== "not_image" ? new Error("bad_image") : e;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/** يحفظ الصورة ويعيد رابطها الدائم */
export async function storeImage(blob: Blob, folder: string, bucket: "portfolio" | "site" = "portfolio"): Promise<string> {
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  if (supabase) {
    const path = `${folder}/${rid()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw new Error(/row-level security|permission|unauthorized/i.test(error.message) ? "permission" : "upload_failed");
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const key = `img-${rid()}`;
  await putBlob(key, blob);
  return `idb:${key}`;
}

const cache = new Map<string, Promise<string>>();
const signedAt = new Map<string, number>();
/**
 * idb:<مفتاح> → رابط blob (مخزَّن مؤقتاً طوال الجلسة)
 * sb:<حاوية>/<مسار> → رابط موقّع مؤقت من حاوية خاصة (ملفات المشاريع)
 * الروابط العادية تمر كما هي
 */
export function resolveImage(src: string): Promise<string> {
  if (src.startsWith("sb:")) {
    // الرابط الموقّع صالح ساعة؛ نجدده بعد 50 دقيقة
    const at = signedAt.get(src);
    if (!cache.has(src) || !at || Date.now() - at > 50 * 60_000) {
      const [bucket, ...rest] = src.slice(3).split("/");
      const p = (async () => {
        if (!supabase) throw new Error("no_storage");
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 3600);
        if (error || !data) throw new Error("sign_failed");
        return data.signedUrl;
      })();
      p.catch(() => cache.delete(src));
      cache.set(src, p);
      signedAt.set(src, Date.now());
    }
    return cache.get(src)!;
  }
  if (!src.startsWith("idb:")) return Promise.resolve(src);
  let p = cache.get(src);
  if (!p) {
    p = getBlob(src.slice(4)).then((b) => {
      if (!b) throw new Error("missing");
      return URL.createObjectURL(b);
    });
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

export function useImageSrc(src?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(src && !/^(idb|sb):/.test(src) ? src : null);
  useEffect(() => {
    let live = true;
    if (!src) {
      setUrl(null);
      return;
    }
    resolveImage(src)
      .then((u) => live && setUrl(u))
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [src]);
  return url;
}

export const isPdf = (src: string) => /\.pdf$/i.test(src);

/** ملف مشروع (صورة أو PDF) في حاوية خاصة: المسار يبدأ بمعرّف المشروع لتطبّق صلاحياته */
export async function storeProjectFile(file: File, projectId: string): Promise<string> {
  const pdf = file.type === "application/pdf";
  if (!pdf && !file.type.startsWith("image/")) throw new Error("not_image");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("too_large");
  const blob = pdf ? file : await compressImage(file, 2400, 0.9);
  const ext = pdf ? "pdf" : blob.type === "image/webp" ? "webp" : "jpg";
  if (supabase) {
    const path = `${projectId}/${rid()}.${ext}`;
    const { error } = await supabase.storage.from("projects").upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw new Error(/row-level security|permission|unauthorized/i.test(error.message) ? "permission" : "upload_failed");
    return `sb:projects/${path}`;
  }
  const key = `file-${rid()}.${ext}`;
  await putBlob(key, blob);
  return `idb:${key}`;
}
