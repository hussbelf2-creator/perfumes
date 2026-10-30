import { createContext, useContext, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { SITE } from "@/config/site";
import LangToggle from "@/components/base/LangToggle";
import { Notice } from "@/projects/components";
import { useProjectsData } from "@/projects/useProjects";
import { clientActions } from "@/projects/next";

// لوحة العميل: بيانات مشاريعه (الحقيقية) مشتركة بين صفحاتها عبر سياق واحد

type Ctx = ReturnType<typeof useProjectsData>;
const AccountContext = createContext<Ctx | null>(null);
export function useAccount() {
  const c = useContext(AccountContext);
  if (!c) throw new Error("AccountLayout missing");
  return c;
}

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { user, logout, isDemoMode } = useAuth();
  const { t, pick, num } = useI18n();
  const navigate = useNavigate();
  const { data } = useAccount();
  const pending = data ? clientActions(data).length : 0;
  const nav = [
    { icon: "ri-layout-grid-line", label: t("نظرة عامة", "Overview"), path: "/account" },
    { icon: "ri-folder-3-line", label: t("مشاريعي", "My projects"), path: "/account/projects" },
    { icon: "ri-checkbox-circle-line", label: t("بانتظار اعتمادي", "Awaiting my approval"), path: "/account/approvals", badge: pending },
    { icon: "ri-shapes-line", label: t("تصاميمي", "My designs"), path: "/account/designs" },
  ];
  const active = (p: string) => (p === "/account" ? pathname === p : pathname === p || (p === "/account/projects" && pathname.startsWith("/account/projects/")));
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 h-16 flex items-center justify-between border-b border-paper-200">
        <Link to="/" className="font-display text-xl text-ink-900">{pick(SITE.shortName)}</Link>
        <div className="flex items-center gap-3">
          {isDemoMode && <span className="label-mono text-[10px] border border-paper-300 rounded px-1.5 py-0.5">Demo</span>}
          <LangToggle />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label={t("حسابي", "My account")}>
        <ul className="space-y-0.5">
          {nav.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                onClick={onNavigate}
                aria-current={active(item.path) ? "page" : undefined}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${active(item.path) ? "bg-white border border-paper-200 text-ink-900" : "border border-transparent text-paper-600 hover:text-ink-900 hover:bg-white/60"}`}
              >
                <span className="flex items-center gap-3">
                  <i className={`${item.icon} text-base`} aria-hidden="true"></i>
                  {item.label}
                </span>
                {!!item.badge && <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent2 text-white text-[11px] flex items-center justify-center" aria-label={t(`${num(item.badge)} بانتظارك`, `${item.badge} waiting`)}>{num(item.badge)}</span>}
              </Link>
            </li>
          ))}
        </ul>
        {!!data?.projects.length && (
          <>
            <p className="label-mono px-3 mt-8 mb-3">{t("مشاريعك", "Your projects")}</p>
            <ul className="space-y-0.5">
              {data.projects.map((p) => {
                const path = `/account/projects/${p.id}`;
                return (
                  <li key={p.id}>
                    <Link to={path} onClick={onNavigate} aria-current={pathname === path ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${pathname === path ? "bg-white border border-paper-200 text-ink-900" : "border border-transparent text-paper-600 hover:text-ink-900"}`}>
                      <span className="w-6 h-6 rounded-full bg-sand flex items-center justify-center font-display text-xs text-ink-900 shrink-0">{p.title.trim().charAt(0)}</span>
                      <span className="truncate">{p.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>
      <div className="p-3 border-t border-paper-200 space-y-1">
        <Link to="/studio-3d" onClick={onNavigate} className="flex items-center justify-center gap-2 rounded-full bg-ink-900 hover:bg-ink-700 text-white text-sm py-2.5 transition-colors">
          <i className="ri-shapes-line" aria-hidden="true"></i>
          {t("صمّم في استوديو 3D", "Design in the 3D studio")}
        </Link>
        <div className="flex items-center gap-3 px-2 pt-3">
          <span className="w-8 h-8 rounded-full bg-sand flex items-center justify-center text-xs text-ink-900">{user?.firstName?.charAt(0) || "ع"}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink-900 truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-[11px] text-paper-500 truncate" dir="ltr">{user?.email}</div>
          </div>
          <button
            type="button"
            aria-label={t("تسجيل الخروج", "Sign out")}
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="w-8 h-8 flex items-center justify-center text-paper-500 hover:text-red-700"
          >
            <i className="ri-logout-box-r-line" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountLayout() {
  const value = useProjectsData();
  const { t, pick } = useI18n();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <AccountContext.Provider value={value}>
      <div className="flex flex-col lg:flex-row min-h-screen bg-paper-50">
        <div className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-paper-50/90 backdrop-blur border-b border-paper-200">
          <Link to="/" className="font-display text-lg text-ink-900">{pick(SITE.shortName)}</Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <button type="button" onClick={() => setOpen(true)} aria-label={t("فتح قائمة حسابي", "Open account menu")} aria-expanded={open} className="w-10 h-10 flex items-center justify-center text-ink-900">
              <i className="ri-menu-line text-xl" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("قائمة حسابي", "Account menu")}>
            <button type="button" aria-label={t("إغلاق", "Close")} className="absolute inset-0 bg-ink-900/30" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-paper-50 border-e border-paper-200 drawer-in">
              <NavBody onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen bg-paper-50 border-e border-paper-200">
          <NavBody />
        </aside>
        <main className="flex-1 min-w-0 px-4 md:px-8 lg:px-10 py-8 md:py-10">
          <Outlet />
        </main>
      </div>
      <Notice notice={value.notice} onClose={value.clearNotice} />
    </AccountContext.Provider>
  );
}
