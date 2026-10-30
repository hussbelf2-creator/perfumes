import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import LangToggle from "@/components/base/LangToggle";
import { SITE } from "@/config/site";
import { ROLE_LABELS, STAFF_ROLES, type Permission } from "@/lib/rbac";
import { DEMO_ADMIN_ENABLED } from "@/hooks/useAuth";
import { CrmProvider, useCrm } from "./data/CrmProvider";
import { Avatar } from "./components/ui";
import { useCanSeeProjects, useProjectActionCount } from "@/projects/useProjects";

type Item = { to: string; icon: string; label: string; perm?: Permission; badge?: number; end?: boolean; show?: boolean };

function useNav(): { main: Item[]; studio: Item[]; manage: Item[] } {
  const { t } = useI18n();
  const { data, actor } = useCrm();
  // النشرة البريدية لا تظهر في صندوق الوارد، فلا تُحسب في شارته
  const newLeads = data?.leads.filter((l) => l.status === "new" && l.kind !== "newsletter").length ?? 0;
  const dueTasks = data?.tasks.filter((x) => !x.done && x.assigneeId === actor?.id && new Date(x.dueAt).getTime() < Date.now() + 864e5).length ?? 0;
  // المصمم يرى المسند إليه فقط؛ الشارة = طلبات تعديل وتصاميم من العملاء تنتظر الفريق
  const canSeeProjects = useCanSeeProjects();
  const actionable = useProjectActionCount(canSeeProjects);
  return {
    main: [
      { to: "/admin", icon: "ri-dashboard-3-line", label: t("نظرة عامة", "Overview"), end: true },
      { to: "/admin/inbox", icon: "ri-inbox-2-line", label: t("صندوق الوارد", "Inbox"), perm: "crm.view", badge: newLeads },
      { to: "/admin/pipeline", icon: "ri-git-branch-line", label: t("مراحل البيع", "Pipeline"), perm: "crm.view" },
      { to: "/admin/contacts", icon: "ri-contacts-book-3-line", label: t("العملاء", "Clients"), perm: "crm.view" },
      { to: "/admin/tasks", icon: "ri-task-line", label: t("المهام", "Tasks"), badge: dueTasks },
      { to: "/admin/quotes", icon: "ri-file-list-3-line", label: t("عروض الأسعار", "Quotes"), perm: "payments.view" },
      { to: "/admin/payments", icon: "ri-bank-card-line", label: t("المدفوعات", "Payments"), perm: "payments.view" },
      { to: "/admin/projects", icon: "ri-folder-3-line", label: t("مشاريع العملاء", "Client projects"), show: canSeeProjects, badge: actionable },
      { to: "/admin/inventory", icon: "ri-archive-stack-line", label: t("المخزون", "Stock"), perm: "inventory.view" },
    ],
    studio: [
      { to: "/admin/studio", icon: "ri-box-3-line", label: t("استوديو العبوات", "Packaging studio"), perm: "studio.manage" },
      { to: "/admin/creatives", icon: "ri-palette-line", label: t("استوديو المبدعين", "Creative studio"), perm: "studio.manage" },
    ],
    manage: [
      { to: "/admin/reports", icon: "ri-line-chart-line", label: t("التقارير", "Reports"), perm: "payments.view" },
      { to: "/admin/pricing", icon: "ri-price-tag-3-line", label: t("التسعير والربحية", "Pricing & margins"), perm: "pricing.manage" },
      { to: "/admin/cms", icon: "ri-layout-masonry-line", label: t("محتوى الموقع", "Site content"), perm: "content.edit" },
      { to: "/admin/team", icon: "ri-shield-user-line", label: t("الفريق والصلاحيات", "Team & roles"), perm: "team.view" },
      { to: "/admin/audit", icon: "ri-file-shield-2-line", label: t("سجل التدقيق", "Audit log"), perm: "audit.view" },
    ],
  };
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t, pick } = useI18n();
  const { can } = useAuth();
  const { main, studio, manage } = useNav();
  const visible = (xs: Item[]) => xs.filter((i) => (i.show ?? true) && (!i.perm || can(i.perm)));

  const link = (i: Item) => (
    <li key={i.to}>
      <NavLink
        to={i.to}
        end={i.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`
        }
      >
        <i className={`${i.icon} text-base`} aria-hidden="true"></i>
        <span className="flex-1 truncate">{i.label}</span>
        {!!i.badge && <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent2 text-white text-[11px] font-mono flex items-center justify-center">{i.badge}</span>}
      </NavLink>
    </li>
  );

  const groups = [
    { key: "main", label: t("العمل اليومي", "Daily work"), items: visible(main) },
    { key: "studio", label: t("التصميم", "Design"), items: visible(studio) },
    { key: "manage", label: t("الإدارة", "Management"), items: visible(manage) },
  ];

  return (
    <div className="flex flex-col h-full bg-ink-900 text-white">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
        <Link to="/admin" onClick={onNavigate} className="font-display text-lg">{pick(SITE.shortName)}</Link>
        <span className="text-[11px] text-white/45 border border-white/15 rounded-full px-2 py-0.5">{t("الإدارة", "Admin")}</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={t("لوحة الإدارة", "Admin")}>
        {groups.map((g) =>
          g.items.length ? (
            <div key={g.key} className="mb-5">
              <p className="px-3 mb-2 text-[11px] text-white/35">{g.label}</p>
              <ul className="space-y-0.5">{g.items.map(link)}</ul>
            </div>
          ) : null,
        )}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5">
          <i className="ri-external-link-line" aria-hidden="true"></i>
          {t("عرض الموقع", "View website")}
        </Link>
      </div>
    </div>
  );
}

function DemoRoleSwitch() {
  const { user, loginAsDemo, isDemoMode } = useAuth();
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  if (!isDemoMode || !DEMO_ADMIN_ENABLED || !user) return null;
  return (
    <label className="hidden md:flex items-center gap-2 rounded-full border border-dashed border-paper-300 ps-3 pe-1 py-1 text-xs text-paper-600">
      <i className="ri-user-settings-line" aria-hidden="true"></i>
      <span className="whitespace-nowrap">{t("جرّب كدور", "Try as")}</span>
      <select
        value={user.role}
        onChange={(e) => {
          loginAsDemo(e.target.value as (typeof STAFF_ROLES)[number]);
          navigate("/admin");
        }}
        className="bg-paper-100 rounded-full px-2 py-1 text-ink-900 outline-none"
        aria-label={t("تبديل الدور التجريبي", "Switch demo role")}
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>{pick(ROLE_LABELS[r])}</option>
        ))}
      </select>
    </label>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout, can } = useAuth();
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/admin/contacts?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-paper-50/90 backdrop-blur border-b border-paper-200 px-4 md:px-8 flex items-center gap-3">
      <button type="button" onClick={onMenu} className="lg:hidden w-10 h-10 -ms-2 flex items-center justify-center text-ink-900" aria-label={t("فتح القائمة", "Open menu")}>
        <i className="ri-menu-line text-xl" aria-hidden="true"></i>
      </button>
      {can("crm.view") && (
        <form onSubmit={search} role="search" className="flex-1 max-w-md">
          <label className="relative block">
            <span className="sr-only">{t("ابحث عن عميل", "Search clients")}</span>
            <i className="ri-search-line absolute top-1/2 -translate-y-1/2 start-3.5 text-paper-400" aria-hidden="true"></i>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث بالاسم أو الجوال أو البريد…", "Search name, phone or email…")} className="w-full bg-white border border-paper-200 focus:border-ink-900 rounded-full ps-10 pe-4 py-2 text-sm outline-none" />
          </label>
        </form>
      )}
      <div className="ms-auto flex items-center gap-2 md:gap-3">
        <DemoRoleSwitch />
        <LangToggle />
        <div className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="true" className="flex items-center gap-2 rounded-full ps-1 pe-3 py-1 hover:bg-paper-100">
            {user && <Avatar m={user} />}
            <span className="hidden sm:block text-start leading-tight">
              <span className="block text-sm text-ink-900">{user?.firstName}</span>
              <span className="block text-[11px] text-paper-500">{user && pick(ROLE_LABELS[user.role])}</span>
            </span>
          </button>
          {menu && (
            <div className="absolute end-0 mt-2 w-56 rounded-2xl bg-white border border-paper-200 shadow-lg py-2 z-40" role="menu">
              <p className="px-4 py-2 text-xs text-paper-500 truncate" dir="ltr">{user?.email}</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="w-full text-start px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"
              >
                {t("تسجيل الخروج", "Sign out")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Toasts() {
  const { toasts, dismiss } = useCrm();
  const { t } = useI18n();
  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[60] flex flex-col gap-2 sm:w-96" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} role={x.kind === "error" ? "alert" : "status"} className={`panel-in flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg ${x.kind === "error" ? "bg-white border border-red-200 text-red-800" : "bg-ink-900 text-white"}`}>
          <i className={x.kind === "error" ? "ri-error-warning-line mt-0.5" : "ri-check-line mt-0.5"} aria-hidden="true"></i>
          <span className="flex-1">{x.text}</span>
          <button type="button" onClick={() => dismiss(x.id)} aria-label={t("إغلاق", "Close")} className="opacity-60 hover:opacity-100">
            <i className="ri-close-line" aria-hidden="true"></i>
          </button>
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const { t } = useI18n();
  const { error, loading, mode } = useCrm();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  if (error === "inactive") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-50 px-6 text-center">
        <div>
          <p className="font-display text-2xl text-ink-900">{t("حسابك معطّل", "Your account is disabled")}</p>
          <p className="mt-2 text-paper-600">{t("تواصل مع مالك المنصة لإعادة تفعيله.", "Contact the platform owner to re-enable it.")}</p>
          <button type="button" onClick={logout} className="mt-6 text-sm underline underline-offset-4">{t("تسجيل الخروج", "Sign out")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:block sticky top-0 h-screen">
        <Sidebar />
      </aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("القائمة", "Menu")}>
          <button type="button" aria-label={t("إغلاق", "Close")} className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] drawer-in">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-w-0 flex flex-col">
        <Topbar onMenu={() => setOpen(true)} />
        {mode === "demo" && (
          <p className="px-4 md:px-8 py-2 text-xs text-paper-500 bg-sand-soft border-b border-paper-200">
            {t("وضع تجريبي: البيانات نموذجية ومحفوظة في هذا المتصفح. الطلبات التي ترسلها من نماذج الموقع تظهر هنا.", "Demo mode: sample data stored in this browser. Requests you submit through the website forms appear here.")}
          </p>
        )}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
          {loading ? (
            <div className="space-y-4" aria-busy="true">
              <div className="h-10 w-56 rounded-xl shimmer bg-paper-100" />
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl shimmer bg-paper-100" />)}
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="h-40 rounded-2xl shimmer bg-paper-100" />}>
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>
      <Toasts />
    </div>
  );
}

/** نقطة دخول لوحة الإدارة: فريق المنصة فقط — العميل يُحوَّل للوحته */
export default function AdminApp() {
  const { user, isLoading, isStaff } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-50" role="status">
        <p className="text-paper-500 text-sm">{t("جاري التحميل…", "Loading…")}</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  if (!isStaff) return <Navigate to="/account" replace />;
  return (
    <CrmProvider>
      <Shell />
    </CrmProvider>
  );
}

/** حماية صفحة داخل اللوحة بصلاحية محددة: تعرض رسالة واضحة بدل التحويل الصامت */
export function RequirePerm({ perm, children }: { perm: Permission; children: React.ReactNode }) {
  const { can } = useAuth();
  const { t } = useI18n();
  if (can(perm)) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <span className="w-14 h-14 mx-auto rounded-full bg-sand-soft text-ink-900 flex items-center justify-center">
        <i className="ri-lock-2-line text-2xl" aria-hidden="true"></i>
      </span>
      <h1 className="mt-5 font-display text-2xl text-ink-900">{t("هذه الصفحة خارج صلاحياتك", "This page is outside your permissions")}</h1>
      <p className="mt-2 text-paper-600">{t("اطلب من مدير المنصة تعديل دورك إن احتجت الوصول.", "Ask a platform admin to change your role if you need access.")}</p>
      <Link to="/admin" className="mt-6 inline-block text-sm underline underline-offset-4">{t("العودة للنظرة العامة", "Back to overview")}</Link>
    </div>
  );
}
