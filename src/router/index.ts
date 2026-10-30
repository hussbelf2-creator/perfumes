import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes, useLocation } from "react-router-dom";
import { useEffect, Suspense, createElement } from "react";
import routes from "./config";
import { SITE } from "@/config/site";
import { useI18n } from "@/i18n/context";
import type { Bi } from "@/i18n/context";
import PageLoader from "@/components/base/PageLoader";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

const PAGE_TITLES: Record<string, Bi> = {
  "/auth": { ar: "تسجيل الدخول", en: "Sign in" },
  "/services": { ar: "الخدمات", en: "Services" },
  "/about": { ar: "عن المنصة", en: "About" },
  "/portfolio": { ar: "نماذج تصوّرية", en: "Concepts" },
  "/creatives": { ar: "استوديو المبدعين", en: "Creative studio" },
  "/admin/creatives": { ar: "المبدعون · الإدارة", en: "Creatives · Admin" },
  "/admin/cms": { ar: "محتوى الموقع · الإدارة", en: "Site content · Admin" },
  "/faq": { ar: "الأسئلة الشائعة", en: "FAQ" },
  "/bespoke": { ar: "عطرك الخاص", en: "Your signature scent" },
  "/privacy": { ar: "سياسة الخصوصية", en: "Privacy policy" },
  "/terms": { ar: "الشروط والأحكام", en: "Terms & conditions" },
  "/refund": { ar: "سياسة الإلغاء والاسترجاع", en: "Refund policy" },
  "/contact": { ar: "تواصل معنا", en: "Contact" },
  "/pricing": { ar: "حاسبة التكلفة", en: "Cost calculator" },
  "/book": { ar: "مكالمة اكتشاف مجانية", en: "Free discovery call" },
  "/discovery-kit": { ar: "عينة الاكتشاف", en: "Discovery kit" },
  "/discovery-kit/paid": { ar: "تأكيد الدفع", en: "Payment confirmation" },
  "/studio-3d": { ar: "استوديو العبوة 3D", en: "3D bottle studio" },
  "/account": { ar: "حسابي", en: "My account" },
  "/admin": { ar: "لوحة الإدارة", en: "Admin" },
  "/admin/inbox": { ar: "صندوق الوارد · الإدارة", en: "Inbox · Admin" },
  "/admin/pipeline": { ar: "مراحل البيع · الإدارة", en: "Pipeline · Admin" },
  "/admin/contacts": { ar: "العملاء · الإدارة", en: "Clients · Admin" },
  "/admin/tasks": { ar: "المهام · الإدارة", en: "Tasks · Admin" },
  "/admin/payments": { ar: "المدفوعات · الإدارة", en: "Payments · Admin" },
  "/admin/team": { ar: "الفريق والصلاحيات · الإدارة", en: "Team · Admin" },
  "/admin/audit": { ar: "سجل التدقيق · الإدارة", en: "Audit log · Admin" },
  "/admin/studio": { ar: "استوديو العبوات · الإدارة", en: "Packaging studio · Admin" },
};

function useRouteEffects() {
  const { pathname, hash } = useLocation();
  const { pick, lang } = useI18n();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  useEffect(() => {
    // صفحات المسارات تضبط عنوانها بنفسها
    if (/^\/services\/[A-F]$/.test(pathname)) return;
    // ملف المصمم يضبط عنوانه باسم المصمم
    if (/^\/creatives\/[^/]+$/.test(pathname)) return;
    if (pathname === "/bespoke") return;
    // صفحة العقد تضبط عنوانها برقمه
    if (/^\/contract\//.test(pathname)) return;
    // «ابدأ مسارك» يضبط عنوانه باسم المسار
    if (/^\/start\//.test(pathname)) return;
    const key = Object.keys(PAGE_TITLES)
      .filter((p) => pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    document.title = key ? `${pick(PAGE_TITLES[key])} | ${pick(SITE.shortName)}` : `${pick(SITE.name)} — ${pick(SITE.tagline)}`;
  }, [pathname, pick, lang]);
}

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  useRouteEffects();
  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });
  return createElement(Suspense, { fallback: createElement(PageLoader) }, element);
}
