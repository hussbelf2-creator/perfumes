import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cmsRepo, type Partial5 } from "./repo";
import { CMS_KEYS, DEFAULTS, sanitize, type CmsDocs, type CmsKey } from "./schema";

// يحمّل المحتوى المنشور مرة واحدة ويخزّنه محلياً: الزيارة التالية تُرسم بالمحتوى الصحيح فوراً
// (بلا ومضة للنص القديم). وضع المعاينة يُظهر المسودات لمن يملك content.edit فقط.

const CACHE = "pp_cms_cache";
const PREVIEW = "pp_cms_preview";

interface Ctx {
  get: <K extends CmsKey>(key: K) => CmsDocs[K];
  preview: boolean;
  setPreview: (on: boolean) => void;
  refresh: () => Promise<void>;
}

const ContentContext = createContext<Ctx | null>(null);

function readCache(): Partial5 {
  try {
    const raw = localStorage.getItem(CACHE);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial5 = {};
    for (const k of CMS_KEYS) if (o[k]) (out as Record<string, unknown>)[k] = sanitize(k, o[k]);
    return out;
  } catch {
    return {};
  }
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const { can, user } = useAuth();
  const editor = can("content.edit");
  const role = user?.role;
  const [published, setPublished] = useState<Partial5>(readCache);
  const [drafts, setDrafts] = useState<Partial5>({});
  const [previewFlag, setPreviewFlag] = useState(() => {
    try {
      // التبويب الذي يفتحه زر «معاينة» لا يرث sessionStorage (noopener)، فتصل العلامة في الرابط
      const url = new URL(window.location.href);
      if (url.searchParams.get("cms_preview") === "1") {
        sessionStorage.setItem(PREVIEW, "1");
        url.searchParams.delete("cms_preview");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
      return sessionStorage.getItem(PREVIEW) === "1";
    } catch {
      return false;
    }
  });
  const preview = previewFlag && editor;

  const refresh = useCallback(async () => {
    try {
      const s = await cmsRepo.loadPublished();
      setPublished(s.published);
      try {
        localStorage.setItem(CACHE, JSON.stringify(s.published));
      } catch {
        /* التخزين غير متاح */
      }
    } catch {
      /* نبقى على المخزَّن أو الافتراضي */
    }
  }, []);

  useEffect(() => {
    void refresh();
    // عودة المستخدم للتبويب (مثلاً بعد النشر من تبويب الإدارة): نحدّث
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  useEffect(() => {
    if (!preview || !role) {
      setDrafts({});
      return;
    }
    let live = true;
    const load = () =>
      cmsRepo
        .loadDrafts(role)
        .then((d) => live && setDrafts(d.drafts))
        .catch(() => live && setDrafts({}));
    void load();
    const onVis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [preview, role]);

  const setPreview = useCallback((on: boolean) => {
    try {
      if (on) sessionStorage.setItem(PREVIEW, "1");
      else sessionStorage.removeItem(PREVIEW);
    } catch {
      /* */
    }
    setPreviewFlag(on);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      get: <K extends CmsKey>(key: K) => ((preview && drafts[key]) || published[key] || DEFAULTS[key]) as CmsDocs[K],
      preview,
      setPreview,
      refresh,
    }),
    [preview, drafts, published, setPreview, refresh],
  );
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

/** المحتوى الفعّال لوثيقة (المنشور، أو المسودة في وضع المعاينة، أو الافتراضي) */
export function useContent<K extends CmsKey>(key: K): CmsDocs[K] {
  const c = useContext(ContentContext);
  return c ? c.get(key) : DEFAULTS[key];
}

export function useCms() {
  const c = useContext(ContentContext);
  if (!c) throw new Error("ContentProvider missing");
  return c;
}
