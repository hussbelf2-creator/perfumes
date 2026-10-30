import { createContext, useContext } from "react";
import type { Permission, Role } from "@/lib/rbac";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** دولة العميل (ISO من حرفين) — المصنع في السعودية والعملاء من أغلب دول العالم */
  country?: string;
  clientType: string;
  role: Role;
}

export interface AuthResult {
  success: boolean;
  message: string;
  /** أُنشئ الحساب لكنه ينتظر تأكيد البريد (لا جلسة بعد) */
  needsConfirm?: boolean;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** مالك أو مدير */
  isAdmin: boolean;
  /** أي دور من فريق المنصة (ليس عميلاً) — يدخل /admin فقط */
  isStaff: boolean;
  can: (perm: Permission) => boolean;
  /** true عند عدم ضبط Supabase — الحسابات محفوظة في هذا المتصفح فقط */
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (firstName: string, lastName: string, email: string, phone: string, clientType: string, password: string, country?: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  logout: () => void;
  /** الوضع التجريبي: الدخول بأي دور لتجربة الصلاحيات */
  loginAsDemo: (role?: Role) => void;
}

// دخول الفريق التجريبي (المالك وبقية الأدوار): مفعّل افتراضياً في النسخة التجريبية (بلا Supabase) لأن بياناتها نموذجية
// ومحفوظة في متصفح الزائر فقط؛ يُعطَّل بـ VITE_ENABLE_DEMO_ADMIN=false. ولا يعمل أبداً مع Supabase (loginAsDemo يرفضه).
export const DEMO_ADMIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ADMIN !== "false";

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
