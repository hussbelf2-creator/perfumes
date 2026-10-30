import { useI18n } from "@/i18n/context";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** صفحة مشتركة بين الطرفين (نسخة العقد): يدخلها الفريق والعميل */
  shared?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false, shared = false }: AuthGuardProps) {
  const { user, isLoading, isAdmin, isStaff } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" role="status" aria-live="polite">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-stone-500 text-sm">{t("جارٍ التحميل…", "Loading…")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={isStaff ? "/admin" : "/account"} replace />;
  }

  // صفحات العميل لا تُفتح لفريق المنصة: كل طرف في لوحته
  if (!requireAdmin && !shared && isStaff) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
