import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { AuthContext, DEMO_ADMIN_ENABLED, type AuthResult, type User } from "@/hooks/useAuth";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";
import { can as canDo, isRole, isStaff as staffRole, type Permission, type Role } from "@/lib/rbac";
import { DEMO_TEAM } from "@/admin/data/seed";

const SESSION_KEY = "pp_session_email";
const ACCOUNTS_KEY = "pp_accounts";
const LEGACY_KEY = "alfajr_auth_user";

const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type StoredAccount = { user: User; passwordHash: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateId(): string {
  return "USR-" + crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 10);
}

async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${normalizeEmail(email)}::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function readAccounts(): Record<string, StoredAccount> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, StoredAccount>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function roleFor(email: string, metaRole?: unknown): Role {
  if (isRole(metaRole)) return metaRole;
  return ADMIN_EMAILS.includes(normalizeEmail(email)) ? "admin" : "client";
}

/** في Supabase الدور يُقرأ من جدول profiles (يعدّله فقط من يملك team.manage) */
async function withProfileRole(u: User): Promise<User> {
  if (!supabase) return u;
  const { data } = await supabase.from("profiles").select("role, active").eq("id", u.id).maybeSingle();
  // حساب فريق معطَّل لا يدخل لوحة الإدارة (بدل لوحة فارغة وأخطاء صلاحيات)
  if (data?.active === false) return { ...u, role: "client" };
  return isRole(data?.role) ? { ...u, role: data.role } : u;
}

function fromSupabase(u: SupabaseUser): User {
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    firstName: meta.first_name || "",
    lastName: meta.last_name || "",
    email: u.email || "",
    phone: meta.phone || "",
    country: meta.country || undefined,
    clientType: meta.client_type || "فرد",
    // الدور يُقرأ من app_metadata التي لا يستطيع المستخدم تعديلها
    role: roleFor(u.email || "", u.app_metadata?.role),
  };
}

function translateSupabaseError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (m.includes("already registered")) return "هذا البريد مسجّل مسبقاً. يرجى تسجيل الدخول";
  if (m.includes("email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني من الرسالة المرسلة إليك";
  if (m.includes("password")) return "كلمة المرور لا تستوفي الشروط المطلوبة";
  if (m.includes("rate limit")) return "محاولات كثيرة. يرجى الانتظار قليلاً ثم المحاولة";
  return "تعذّر إتمام العملية. يرجى المحاولة مرة أخرى";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem(LEGACY_KEY);

    if (supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        setUser(data.session ? await withProfileRole(fromSupabase(data.session.user)) : null);
        setIsLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) return setUser(null);
        // لا ننتظر داخل المستمع (توصية Supabase)؛ ونضبط المستخدم بعد معرفة دوره
        // حتى لا يُوجَّه موظف للحظة كعميل
        void withProfileRole(fromSupabase(session.user)).then(setUser);
      });
      return () => sub.subscription.unsubscribe();
    }

    const email = localStorage.getItem(SESSION_KEY);
    const account = email ? readAccounts()[email] : null;
    setUser(account ? { ...account.user, role: roleFor(account.user.email, account.user.role) } : null);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (rawEmail: string, password: string): Promise<AuthResult> => {
    const email = normalizeEmail(rawEmail);
    if (!email || !password) {
      return { success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور" };
    }

    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, message: translateSupabaseError(error.message) };
      return { success: true, message: "تم تسجيل الدخول بنجاح" };
    }

    const account = readAccounts()[email];
    if (!account || account.passwordHash !== (await hashPassword(email, password))) {
      return { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
    }
    localStorage.setItem(SESSION_KEY, email);
    setUser({ ...account.user, role: roleFor(email, account.user.role) });
    return { success: true, message: "تم تسجيل الدخول بنجاح" };
  }, []);

  const register = useCallback(async (
    firstName: string,
    lastName: string,
    rawEmail: string,
    phone: string,
    clientType: string,
    password: string,
    rawCountry?: string,
  ): Promise<AuthResult> => {
    const country = rawCountry && /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : undefined;
    const email = normalizeEmail(rawEmail);
    if (!firstName.trim() || !lastName.trim() || !email || !password) {
      return { success: false, message: "يرجى تعبئة جميع الحقول المطلوبة" };
    }
    if (!EMAIL_RE.test(email)) {
      return { success: false, message: "صيغة البريد الإلكتروني غير صحيحة" };
    }
    if (password.length < 8) {
      return { success: false, message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
    }

    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName.trim(), last_name: lastName.trim(), phone, country, client_type: clientType || "فرد" },
        },
      });
      if (error) return { success: false, message: translateSupabaseError(error.message) };
      if (!data.session) {
        return { success: true, message: "تم إنشاء الحساب. أرسلنا رابط تأكيد إلى بريدك الإلكتروني", needsConfirm: true };
      }
      return { success: true, message: "تم إنشاء الحساب بنجاح" };
    }

    const accounts = readAccounts();
    if (accounts[email]) {
      return { success: false, message: "هذا البريد مسجّل مسبقاً. يرجى تسجيل الدخول" };
    }
    const newUser: User = {
      id: generateId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      phone,
      country,
      clientType: clientType || "فرد",
      role: roleFor(email),
    };
    accounts[email] = { user: newUser, passwordHash: await hashPassword(email, password) };
    writeAccounts(accounts);
    localStorage.setItem(SESSION_KEY, email);
    setUser(newUser);
    return { success: true, message: "تم إنشاء الحساب بنجاح" };
  }, []);

  const requestPasswordReset = useCallback(async (rawEmail: string): Promise<AuthResult> => {
    const email = normalizeEmail(rawEmail);
    if (!EMAIL_RE.test(email)) {
      return { success: false, message: "يرجى إدخال بريد إلكتروني صحيح" };
    }
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${__BASE_PATH__.replace(/\/$/, "")}/auth`,
      });
      if (error) return { success: false, message: translateSupabaseError(error.message) };
      return { success: true, message: "إن كان البريد مسجّلاً لدينا فستصلك رسالة الاستعادة خلال دقائق" };
    }
    return {
      success: false,
      message: "استعادة كلمة المرور غير متاحة في الوضع التجريبي. أنشئ حساباً جديداً أو تواصل معنا",
    };
  }, []);

  const logout = useCallback(() => {
    if (supabase) {
      supabase.auth.signOut();
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const loginAsDemo = useCallback((role: Role = "client") => {
    if (isSupabaseEnabled) return;
    if (role !== "client" && !DEMO_ADMIN_ENABLED) return;
    // كل دور تجريبي هو عضو فعلي في فريق البيانات النموذجية، فتظهر إسناداته ومهامه
    const member = DEMO_TEAM.find((m) => m.role === role);
    const email = member?.email ?? "client@demo.local";
    const demoUser: User = member
      ? { id: member.id, firstName: member.firstName, lastName: member.lastName, email, clientType: "شركة", role }
      : { id: "USR-DEMO", firstName: "عميل", lastName: "تجريبي", email, clientType: "شركة", role: "client" };
    const accounts = readAccounts();
    accounts[email] = { user: demoUser, passwordHash: "" };
    writeAccounts(accounts);
    localStorage.setItem(SESSION_KEY, email);
    setUser(demoUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === "admin" || user?.role === "owner",
      isStaff: staffRole(user?.role),
      can: (perm: Permission) => canDo(user?.role, perm),
      isDemoMode: !isSupabaseEnabled,
      login,
      register,
      requestPasswordReset,
      logout,
      loginAsDemo,
    }),
    [user, isLoading, login, register, requestPasswordReset, logout, loginAsDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
