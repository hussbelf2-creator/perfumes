import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { supabase } from "@/lib/supabase";
import { localRepo } from "./localRepo";
import { createSupabaseRepo } from "./supabaseRepo";
import type { Actor, Contact, CrmRepo, CrmSnapshot, TeamMember } from "./types";
import { NotFoundError, PermissionError, ValidationError } from "./types";
import { validationText } from "@/creatives/messages";

const repo: CrmRepo = supabase ? createSupabaseRepo(supabase) : localRepo;

interface Toast {
  id: number;
  kind: "ok" | "error";
  text: string;
}

interface CrmContextType {
  data: CrmSnapshot | null;
  loading: boolean;
  /** خطأ تحميل (حساب معطّل، انقطاع اتصال) */
  error: string;
  mode: CrmRepo["mode"];
  actor: Actor | null;
  member: (id?: string | null) => TeamMember | undefined;
  contact: (id?: string | null) => Contact | undefined;
  /** ينفّذ عملية ثم يعيد التحميل؛ يعرض رسالة نجاح أو سبب الرفض */
  run: (fn: (repo: CrmRepo, actor: Actor) => Promise<unknown>, okText?: string) => Promise<boolean>;
  reload: () => Promise<void>;
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const CrmContext = createContext<CrmContextType | null>(null);

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<CrmSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const actor = useMemo<Actor | null>(() => (user ? { id: user.id, role: user.role } : null), [user]);

  const reload = useCallback(async () => {
    if (!actor) return;
    try {
      setData(await repo.load(actor));
      setError("");
    } catch (e) {
      setError(e instanceof PermissionError && e.perm === "account.inactive" ? "inactive" : e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // الوضع التجريبي: تحديث عند وصول طلب جديد من تبويب آخر (نموذج الموقع)
  useEffect(() => {
    if (repo.mode !== "demo") return;
    const onStorage = (e: StorageEvent) => e.key === "pp_crm_v1" && void reload();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);

  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4500);
  }, []);

  const deniedText = useCallback(
    (perm: string) => {
      if (perm.includes("self") || perm.includes("own_role")) return t("لا يمكنك تغيير دورك أو حالة حسابك بنفسك.", "You can't change your own role or status.");
      if (perm.includes("last_owner")) return t("لا يمكن ترك المنصة بلا مالك نشط.", "The platform must keep at least one active owner.");
      if (perm.includes("owner")) return t("المالك فقط يدير أدوار الملاك.", "Only an owner can manage owners.");
      if (perm.includes("assign")) return t("ليست لديك صلاحية إسناد العملاء.", "You don't have permission to assign clients.");
      if (perm.includes("team")) return t("ليست لديك صلاحية إدارة الفريق.", "You don't have permission to manage the team.");
      if (perm.includes("discount_cap")) return t("الخصم أعلى من السقف المسموح لدورك. اخفضه أو اطلب من المالك أو المدير إرسال العرض.", "The discount is above your role's cap. Lower it, or ask an owner or admin to send the quote.");
      if (perm.includes("contracts.sign")) return t("التوقيع عن المنشأة للمالك والمدير.", "Only owners and admins sign on behalf of the company.");
      if (perm.includes("inventory")) return t("ليست لديك صلاحية إدارة المخزون.", "You don't have permission to manage stock.");
      if (perm.includes("pricing")) return t("الأسعار والخصومات والكوبونات للمالك والمدير.", "Prices, discounts and coupons are for owners and admins.");
      return t("ليست لديك صلاحية لهذا الإجراء.", "You don't have permission for this action.");
    },
    [t],
  );

  const run = useCallback<CrmContextType["run"]>(
    async (fn, okText) => {
      if (!actor) return false;
      try {
        await fn(repo, actor);
        await reload();
        if (okText) push("ok", okText);
        return true;
      } catch (e) {
        push(
          "error",
          e instanceof PermissionError
            ? deniedText(e.perm)
            : e instanceof ValidationError
              ? validationText(e.code, t)
              : e instanceof NotFoundError
              ? t("لا يوجد حساب بهذا البريد. اطلب منه التسجيل في الموقع أولاً ثم امنحه الدور.", "No account with that email. Ask them to sign up on the website first, then grant the role.")
              : t("تعذّر الحفظ. حاول مرة أخرى.", "Couldn't save. Please try again."),
        );
        return false;
      }
    },
    [actor, reload, push, deniedText, t],
  );

  const value = useMemo<CrmContextType>(() => {
    const team = new Map(data?.team.map((m) => [m.id, m]));
    const contacts = new Map(data?.contacts.map((c) => [c.id, c]));
    return {
      data,
      loading,
      error,
      mode: repo.mode,
      actor,
      member: (id) => (id ? team.get(id) : undefined),
      contact: (id) => (id ? contacts.get(id) : undefined),
      run,
      reload,
      toasts,
      dismiss: (id) => setToasts((ts) => ts.filter((x) => x.id !== id)),
    };
  }, [data, loading, error, actor, run, reload, toasts]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}
