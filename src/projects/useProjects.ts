import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { PermissionError, ValidationError } from "@/admin/data/types";
import { validationText } from "@/creatives/messages";
import { projectsRepo, type PActor, type ProjectsData } from "./repo";

export function usePActor(): PActor | null {
  const { user } = useAuth();
  return useMemo(() => (user ? { id: user.id, role: user.role, email: user.email.toLowerCase(), name: `${user.firstName} ${user.lastName}`.trim() } : null), [user]);
}

/** بيانات المشاريع المرئية للمستخدم الحالي + تنفيذ عملية مع رسالة نجاح أو خطأ */
export function useProjectsData() {
  const actor = usePActor();
  const { t } = useI18n();
  const [data, setData] = useState<ProjectsData | null>(null);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // طلبات «ابدأ مسارك» تتحول لمشاريع مرة عند فتح الحساب (لا تمنع التحميل إن فشلت)
  const [claimed, setClaimed] = useState<string[]>([]);
  const claimedFor = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!actor) return;
    if (claimedFor.current !== actor.id) {
      claimedFor.current = actor.id;
      const ids = await projectsRepo.claimBriefs(actor).catch(() => []);
      if (ids.length) setClaimed(ids);
    }
    try {
      setData(await projectsRepo.load(actor));
      setError(false);
    } catch {
      setError(true);
    }
  }, [actor]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(id);
  }, [notice]);

  const run = useCallback(
    async (fn: (a: PActor) => Promise<unknown>, okText?: string) => {
      if (!actor) return false;
      try {
        await fn(actor);
        await reload();
        if (okText) setNotice({ ok: true, text: okText });
        return true;
      } catch (e) {
        setNotice({
          ok: false,
          text: e instanceof ValidationError ? validationText(e.code, t) : e instanceof PermissionError ? t("ليست لديك صلاحية لهذا الإجراء.", "You don't have permission for this action.") : t("تعذّر الحفظ. حاول مرة أخرى.", "Couldn't save. Please try again."),
        });
        return false;
      }
    },
    [actor, reload, t],
  );

  return { actor, data, error, reload, run, notice, claimed, clearNotice: () => setNotice(null) };
}

/** من يدخل قسم المشاريع في الإدارة: من يرى كلها، أو يديرها، أو مصمم (يرى المسند إليه) */
export function useCanSeeProjects() {
  const { can, user } = useAuth();
  return can("projects.view") || can("projects.manage") || user?.role === "designer";
}

/** عدد ما ينتظر الفريق: تصاميم طلب العميل تعديلها (أحدث نسخة) */
export function useProjectActionCount(enabled: boolean) {
  const actor = usePActor();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled || !actor) return;
    let live = true;
    projectsRepo
      .load(actor)
      .then((d) => {
        const latest = new Map<string, (typeof d.items)[number]>();
        for (const i of d.items) if (!latest.has(i.threadId) || latest.get(i.threadId)!.version < i.version) latest.set(i.threadId, i);
        if (live) setN([...latest.values()].filter((i) => i.status === "changes").length);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled, actor]);
  return n;
}
